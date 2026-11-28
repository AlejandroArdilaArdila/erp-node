/**
 * Semántica de PHP que los contratos de apipos necesitan replicar.
 * Usar SOLO al portar comportamiento legado; el código nuevo usa TypeScript normal.
 */

/** Caracteres que elimina `trim()` de PHP (no incluye espacios Unicode, a diferencia de JS). */
const ESPACIOS_PHP = ' \t\n\r\0\x0B';

export function phpTrim(texto: string): string {
  let inicio = 0;
  let fin = texto.length;
  while (inicio < fin && ESPACIOS_PHP.includes(texto[inicio])) inicio++;
  while (fin > inicio && ESPACIOS_PHP.includes(texto[fin - 1])) fin--;
  return texto.slice(inicio, fin);
}

/** `(string) $valor` para escalares; arrays/objetos → '' (PHP daría "Array" + warning). */
export function phpString(valor: unknown): string {
  if (valor === null || valor === undefined || valor === false) return '';
  if (valor === true) return '1';
  if (typeof valor === 'string') return valor;
  if (typeof valor === 'number' || typeof valor === 'bigint') return String(valor);
  return '';
}

/** `!$valor` de PHP para strings: '' y '0' son falsos. */
export function phpVacio(valor: string | null | undefined): boolean {
  return valor === null || valor === undefined || valor === '' || valor === '0';
}

/** `filter_var($v, FILTER_VALIDATE_BOOLEAN)`: true solo para 1/true/on/yes. */
export function phpBooleano(valor: unknown): boolean {
  if (valor === true) return true;
  return ['1', 'true', 'on', 'yes'].includes(phpTrim(phpString(valor)).toLowerCase());
}

/**
 * `(int) $valor` de PHP 8: el prefijo numérico del texto (con espacios antes,
 * signo, decimales y exponente: "4e2" → 400, "1.9e1" → 19), truncado y limitado
 * al rango de 64 bits; 0 si no hay prefijo numérico.
 */
export function phpEntero(valor: unknown): number {
  if (typeof valor === 'number') return Math.trunc(valor);
  const coincidencia = /^[ \t\n\r\v\f]*[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?/.exec(
    phpString(valor),
  );
  if (!coincidencia) return 0;
  const numero = Math.trunc(Number(coincidencia[0]));
  // PHP_INT_MAX (2^63 - 1) no cabe exacto en un double: el más cercano es 2^63.
  const MAXIMO = 2 ** 63;
  return Math.max(-MAXIMO, Math.min(MAXIMO, numero)) || 0;
}

/** `mb_substr($texto, 0, $largo)`: corta por caracteres, no por bytes. */
export function mbSubstr(texto: string, largo: number): string {
  return Array.from(texto).slice(0, largo).join('');
}

/**
 * `is_numeric($valor)`: enteros, decimales y textos numéricos de PHP 8 (con
 * espacios antes o después, signo, decimales o exponente; no hexadecimales).
 */
export function phpEsNumerico(valor: unknown): boolean {
  if (typeof valor === 'number') return Number.isFinite(valor);
  if (typeof valor !== 'string') return false;
  return /^[ \t\n\r\v\f]*[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?[ \t\n\r\v\f]*$/.test(valor);
}

/**
 * `(string) $float` de PHP (precision = 14, formato %.14G de zend_gcvt). Es lo
 * que hace PDO al enlazar un float: con este texto quedan guardados en la base
 * los decimales que manda el POS por JSON.
 */
export function phpDecimalATexto(valor: number): string {
  if (!Number.isFinite(valor)) return valor > 0 ? 'INF' : valor < 0 ? '-INF' : 'NAN';
  if (valor === 0) return Object.is(valor, -0) ? '-0' : '0';
  const [mantisa, exponente] = valor.toExponential(13).split('e');
  const signo = mantisa.startsWith('-') ? '-' : '';
  const digitos = mantisa.replace('-', '').replace('.', '').replace(/0+$/, '');
  const decpt = Number(exponente) + 1;
  if (decpt < -3 || decpt > 14) {
    const resto = digitos.length > 1 ? digitos.slice(1) : '0';
    const exp = decpt - 1;
    return `${signo}${digitos[0]}.${resto}E${exp < 0 ? '-' : '+'}${Math.abs(exp)}`;
  }
  if (decpt <= 0) return `${signo}0.${'0'.repeat(-decpt)}${digitos}`;
  if (digitos.length <= decpt) return `${signo}${digitos}${'0'.repeat(decpt - digitos.length)}`;
  return `${signo}${digitos.slice(0, decpt)}.${digitos.slice(decpt)}`;
}

/**
 * Valor que Laravel enlaza al insertar lo que mandó el cliente (`$request->input`):
 * booleanos como 1/0 (Connection::prepareBindings), enteros tal cual, decimales
 * como `(string) $float` de PHP. Un array u objeto no se puede enlazar: PDO
 * falla y apipos responde 500.
 */
export function phpValorEnlazado(valor: unknown): string | number | null {
  if (valor === null || valor === undefined) return null;
  if (typeof valor === 'boolean') return valor ? 1 : 0;
  if (typeof valor === 'string') return valor;
  if (typeof valor === 'number') {
    return Number.isSafeInteger(valor) ? valor : phpDecimalATexto(valor);
  }
  throw new Error('Array to string conversion: PDO no puede enlazar un array (500 en apipos)');
}

/** `!$valor` de PHP para lo que llega en la entrada (null, false, 0, '', '0', array vacío). */
export function phpEsFalso(valor: unknown): boolean {
  if (valor === null || valor === undefined || valor === false || valor === 0 || valor === '') {
    return true;
  }
  if (valor === '0') return true;
  if (Array.isArray(valor)) return valor.length === 0;
  if (typeof valor === 'object') return Object.keys(valor).length === 0;
  return false;
}
