/**
 * `json_decode($texto, true)` y `json_encode($valor)` de PHP, para los
 * endpoints de apipos que devuelven JSON guardado en la base (configuraciones
 * de tirillas, listas de ids...). JSON.parse/JSON.stringify no sirven para eso:
 *
 * - PHP conserva el orden de las claves; JavaScript ordena las numéricas.
 * - PHP distingue enteros (64 bits, exactos) de decimales; JavaScript no.
 * - PHP escribe los decimales con otras reglas: `1.0e+17`, `1.0e-5`, `-0`.
 * - PHP convierte un objeto con claves 0..n-1 (y el vacío `{}`) en lista.
 *
 * Representación: los arrays de PHP son `Map` (orden de inserción, claves
 * enteras o de texto como las normaliza PHP), los decimales son `PhpDecimal` y
 * los enteros son `number` o `bigint` (fuera del rango seguro de JavaScript).
 *
 * Diferencia aceptada: los textos se escriben con JSON.stringify, que no escapa
 * "/" ni los caracteres no ASCII como PHP (`\/`, `ñ`). El JSON es
 * equivalente para cualquier cliente.
 */

/** Número decimal (float de PHP), para distinguirlo de un entero. */
export class PhpDecimal {
  constructor(readonly valor: number) {}
}

export type PhpJson =
  null | boolean | number | bigint | string | PhpDecimal | Map<number | string, PhpJson>;

/** Profundidad máxima de arrays que acepta json_decode con depth 512 (verificado con PHP 8.3). */
const PROFUNDIDAD_MAXIMA = 511;

const ENTERO_MAXIMO = 2n ** 63n - 1n;
const ENTERO_MINIMO = -(2n ** 63n);

/** Clave de texto que PHP guarda como entero en un array ("5" → 5; "05" y "-0" no). */
const CLAVE_ENTERA = /^(0|-?[1-9]\d*)$/;

function normalizarClave(clave: string): number | string {
  if (!CLAVE_ENTERA.test(clave)) return clave;
  const n = BigInt(clave);
  if (n > ENTERO_MAXIMO || n < ENTERO_MINIMO) return clave;
  // Las claves fuera del rango seguro quedan como texto: no afectan el JSON resultante.
  return Number.isSafeInteger(Number(clave)) ? Number(clave) : clave;
}

class ErrorJson extends Error {}

class Parser {
  private pos = 0;
  private profundidad = 0;

  constructor(private readonly texto: string) {}

  documento(): PhpJson {
    this.espacios();
    const valor = this.valor();
    this.espacios();
    if (this.pos !== this.texto.length) throw new ErrorJson();
    return valor;
  }

  private espacios(): void {
    while (this.pos < this.texto.length && ' \t\n\r'.includes(this.texto[this.pos])) this.pos++;
  }

  private literal(palabra: string): void {
    if (this.texto.startsWith(palabra, this.pos)) {
      this.pos += palabra.length;
      return;
    }
    throw new ErrorJson();
  }

  private valor(): PhpJson {
    const c = this.texto[this.pos];
    switch (c) {
      case '{':
        return this.objeto();
      case '[':
        return this.lista();
      case '"':
        return this.cadena();
      case 't':
        this.literal('true');
        return true;
      case 'f':
        this.literal('false');
        return false;
      case 'n':
        this.literal('null');
        return null;
      default:
        return this.numero();
    }
  }

  private entrar(): void {
    if (++this.profundidad > PROFUNDIDAD_MAXIMA) throw new ErrorJson();
  }

  private lista(): PhpJson {
    this.entrar();
    this.pos++; // [
    const resultado = new Map<number | string, PhpJson>();
    this.espacios();
    if (this.texto[this.pos] === ']') {
      this.pos++;
      this.profundidad--;
      return resultado;
    }
    for (let i = 0; ; i++) {
      this.espacios();
      resultado.set(i, this.valor());
      this.espacios();
      const c = this.texto[this.pos++];
      if (c === ']') break;
      if (c !== ',') throw new ErrorJson();
    }
    this.profundidad--;
    return resultado;
  }

  private objeto(): PhpJson {
    this.entrar();
    this.pos++; // {
    const resultado = new Map<number | string, PhpJson>();
    this.espacios();
    if (this.texto[this.pos] === '}') {
      this.pos++;
      this.profundidad--;
      return resultado;
    }
    for (;;) {
      this.espacios();
      if (this.texto[this.pos] !== '"') throw new ErrorJson();
      const clave = normalizarClave(this.cadena());
      this.espacios();
      if (this.texto[this.pos++] !== ':') throw new ErrorJson();
      this.espacios();
      // Clave repetida: gana el último valor y conserva la posición, como en PHP.
      resultado.set(clave, this.valor());
      this.espacios();
      const c = this.texto[this.pos++];
      if (c === '}') break;
      if (c !== ',') throw new ErrorJson();
    }
    this.profundidad--;
    return resultado;
  }

  private cadena(): string {
    this.pos++; // "
    let resultado = '';
    for (;;) {
      if (this.pos >= this.texto.length) throw new ErrorJson();
      const c = this.texto[this.pos++];
      if (c === '"') return resultado;
      if (c < ' ') throw new ErrorJson();
      if (c !== '\\') {
        resultado += c;
        continue;
      }
      const escape = this.texto[this.pos++];
      const simples: Record<string, string> = {
        '"': '"',
        '\\': '\\',
        '/': '/',
        b: '\b',
        f: '\f',
        n: '\n',
        r: '\r',
        t: '\t',
      };
      if (escape in simples) {
        resultado += simples[escape];
        continue;
      }
      if (escape !== 'u') throw new ErrorJson();
      const unidad = this.unidadUnicode();
      if (unidad >= 0xd800 && unidad <= 0xdbff) {
        // Par sustituto: PHP exige la segunda mitad; una mitad sola es un error.
        if (this.texto.slice(this.pos, this.pos + 2) !== '\\u') throw new ErrorJson();
        this.pos += 2;
        const baja = this.unidadUnicode();
        if (baja < 0xdc00 || baja > 0xdfff) throw new ErrorJson();
        resultado += String.fromCharCode(unidad, baja);
      } else if (unidad >= 0xdc00 && unidad <= 0xdfff) {
        throw new ErrorJson();
      } else {
        resultado += String.fromCharCode(unidad);
      }
    }
  }

  private unidadUnicode(): number {
    const hex = this.texto.slice(this.pos, this.pos + 4);
    if (!/^[0-9a-fA-F]{4}$/.test(hex)) throw new ErrorJson();
    this.pos += 4;
    return Number.parseInt(hex, 16);
  }

  private numero(): PhpJson {
    const m = /^-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?/.exec(this.texto.slice(this.pos));
    if (!m) throw new ErrorJson();
    this.pos += m[0].length;
    if (m[2] === undefined && m[3] === undefined) {
      const entero = BigInt(m[0]);
      // Entero fuera de 64 bits: PHP lo convierte en decimal.
      if (entero > ENTERO_MAXIMO || entero < ENTERO_MINIMO) return new PhpDecimal(Number(m[0]));
      return Number.isSafeInteger(Number(entero)) ? Number(entero) : entero;
    }
    return new PhpDecimal(Number(m[0]));
  }
}

/** `json_decode($texto, true)`: null si el texto no es JSON válido (como PHP). */
export function phpJsonDecode(texto: string): PhpJson {
  try {
    return new Parser(texto).documento();
  } catch (error) {
    if (error instanceof ErrorJson || error instanceof RangeError) return null;
    throw error;
  }
}

/** Decimal como lo escribe json_encode con serialize_precision = -1 (zend_gcvt, 17 dígitos). */
function decimalPhp(valor: number): string {
  if (!Number.isFinite(valor)) {
    // json_encode falla con INF/NAN y Laravel responde 500.
    throw new Error('json_encode: INF y NAN no se pueden representar en JSON');
  }
  if (valor === 0) return Object.is(valor, -0) ? '-0' : '0';
  // toExponential() sin argumento da los dígitos más cortos que identifican el número.
  const [mantisa, exponente] = valor.toExponential().split('e');
  const signo = mantisa.startsWith('-') ? '-' : '';
  const digitos = mantisa.replace('-', '').replace('.', '');
  // decpt: posición del punto decimal (valor = 0.d1d2... × 10^decpt), como en zend_gcvt.
  const decpt = Number(exponente) + 1;
  if (decpt < -3 || decpt > 17) {
    const resto = digitos.length > 1 ? digitos.slice(1) : '0';
    const exp = decpt - 1;
    return `${signo}${digitos[0]}.${resto}e${exp < 0 ? '-' : '+'}${Math.abs(exp)}`;
  }
  if (decpt <= 0) return `${signo}0.${'0'.repeat(-decpt)}${digitos}`;
  if (digitos.length <= decpt) return `${signo}${digitos}${'0'.repeat(decpt - digitos.length)}`;
  return `${signo}${digitos.slice(0, decpt)}.${digitos.slice(decpt)}`;
}

function esListaPhp(mapa: Map<number | string, unknown>): boolean {
  let i = 0;
  for (const clave of mapa.keys()) {
    if (clave !== i++) return false;
  }
  return true;
}

/**
 * `json_encode($valor)` de PHP para valores `PhpJson` y también para valores
 * normales de JavaScript (los `number` enteros como enteros de PHP y los demás
 * como decimales; los objetos en el orden de sus claves).
 */
export function phpJsonEncode(valor: unknown): string {
  if (valor === null || valor === undefined) return 'null';
  if (valor === true) return 'true';
  if (valor === false) return 'false';
  if (typeof valor === 'string') return JSON.stringify(valor);
  if (typeof valor === 'bigint') return valor.toString();
  if (typeof valor === 'number') {
    return Number.isInteger(valor) && !Object.is(valor, -0) ? String(valor) : decimalPhp(valor);
  }
  if (valor instanceof PhpDecimal) return decimalPhp(valor.valor);
  if (valor instanceof Map) {
    const mapa = valor as Map<number | string, unknown>;
    if (esListaPhp(mapa)) return `[${[...mapa.values()].map(phpJsonEncode).join(',')}]`;
    const pares = [...mapa].map(([k, v]) => `${JSON.stringify(String(k))}:${phpJsonEncode(v)}`);
    return `{${pares.join(',')}}`;
  }
  if (Array.isArray(valor)) return `[${valor.map(phpJsonEncode).join(',')}]`;
  if (typeof valor === 'object') {
    // Objeto de JavaScript: se escribe como objeto aunque esté vacío, igual que (object) [] en PHP.
    const pares = Object.entries(valor)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => `${JSON.stringify(k)}:${phpJsonEncode(v)}`);
    return `{${pares.join(',')}}`;
  }
  throw new Error(`phpJsonEncode: tipo no soportado (${typeof valor})`);
}

/** Valor falso para PHP (`$v ?: ...`) de un `PhpJson`: null, false, 0, '', '0', 0.0 y el array vacío. */
export function phpJsonFalso(valor: PhpJson): boolean {
  if (valor === null || valor === false || valor === '' || valor === '0') return true;
  if (valor === 0 || valor === 0n) return true;
  if (valor instanceof PhpDecimal) return valor.valor === 0;
  if (valor instanceof Map) return valor.size === 0;
  return false;
}
