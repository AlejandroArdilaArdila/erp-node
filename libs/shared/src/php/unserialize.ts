/**
 * `@unserialize()` de PHP, limitado a escalares y arrays (lo que Dolibarr guarda
 * en llx_extrafields.param y similares). Devuelve `false` donde PHP devuelve
 * `false`: texto mal formado, longitudes o cantidades que no coinciden, etc.
 *
 * Diferencias conocidas con PHP (no aparecen en los datos de Dolibarr):
 * - Objetos (`O:`, `C:`), enums (`E:`) y referencias (`r:`, `R:`) → `false`.
 * - Enteros fuera del rango seguro de JavaScript pierden precisión.
 *
 * Los arrays se devuelven como `Map` porque conserva el orden de inserción de
 * PHP; un objeto de JavaScript reordena las claves numéricas.
 */
export type PhpValor = null | boolean | number | string | PhpArray;
export type PhpArray = Map<number | string, PhpValor>;

class ErrorFormato extends Error {}

/** Clave de texto que PHP convierte a entero al usarla en un array ("5" → 5, "05" no). */
const CLAVE_ENTERA = /^(0|-?[1-9]\d*)$/;

class Lector {
  private pos = 0;

  constructor(private readonly bytes: Buffer) {}

  private byte(): string {
    if (this.pos >= this.bytes.length) throw new ErrorFormato();
    return String.fromCharCode(this.bytes[this.pos++]);
  }

  private esperar(texto: string): void {
    for (const c of texto) {
      if (this.byte() !== c) throw new ErrorFormato();
    }
  }

  /** Lee hasta `fin` (sin incluirlo) y lo consume. */
  private hasta(fin: string): string {
    const indice = this.bytes.indexOf(fin, this.pos, 'latin1');
    if (indice < 0) throw new ErrorFormato();
    const texto = this.bytes.toString('latin1', this.pos, indice);
    this.pos = indice + 1;
    return texto;
  }

  private entero(fin: string): number {
    const texto = this.hasta(fin);
    if (!/^[+-]?\d+$/.test(texto)) throw new ErrorFormato();
    return Number.parseInt(texto, 10);
  }

  private cantidad(): number {
    const texto = this.hasta(':');
    if (!/^\d+$/.test(texto)) throw new ErrorFormato();
    return Number.parseInt(texto, 10);
  }

  private texto(): string {
    const largo = this.cantidad();
    this.esperar('"');
    if (this.pos + largo > this.bytes.length) throw new ErrorFormato();
    const valor = this.bytes.toString('utf8', this.pos, this.pos + largo);
    this.pos += largo;
    this.esperar('";');
    return valor;
  }

  valor(): PhpValor {
    const tipo = this.byte();
    if (tipo === 'N') {
      this.esperar(';');
      return null;
    }
    this.esperar(':');
    switch (tipo) {
      case 'b': {
        const v = this.hasta(';');
        if (v !== '0' && v !== '1') throw new ErrorFormato();
        return v === '1';
      }
      case 'i':
        return this.entero(';');
      case 'd': {
        const v = this.hasta(';');
        if (v === 'INF') return Infinity;
        if (v === '-INF') return -Infinity;
        if (v === 'NAN') return NaN;
        if (!/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(v)) throw new ErrorFormato();
        return Number(v);
      }
      case 's':
        return this.texto();
      case 'a':
        return this.array();
      default:
        throw new ErrorFormato();
    }
  }

  private clave(): number | string {
    const tipo = this.byte();
    this.esperar(':');
    if (tipo === 'i') return this.entero(';');
    if (tipo === 's') {
      const texto = this.texto();
      return CLAVE_ENTERA.test(texto) && Number.isSafeInteger(Number(texto))
        ? Number(texto)
        : texto;
    }
    throw new ErrorFormato();
  }

  private array(): PhpArray {
    const cantidad = this.cantidad();
    this.esperar('{');
    const resultado: PhpArray = new Map();
    for (let i = 0; i < cantidad; i++) {
      const clave = this.clave();
      // Clave repetida: PHP reemplaza el valor y conserva la posición, igual que Map.set.
      resultado.set(clave, this.valor());
    }
    this.esperar('}');
    return resultado;
  }
}

export function phpUnserialize(serializado: string): PhpValor | false {
  try {
    // PHP ignora lo que sobre después del valor (solo emite un aviso).
    return new Lector(Buffer.from(serializado, 'utf8')).valor();
  } catch (error) {
    if (error instanceof ErrorFormato) return false;
    throw error;
  }
}
