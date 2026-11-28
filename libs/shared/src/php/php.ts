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

/** `(int) $valor`: prefijo numérico o 0. */
export function phpEntero(valor: unknown): number {
  if (typeof valor === 'number') return Math.trunc(valor);
  const coincidencia = /^\s*[+-]?\d+/.exec(phpString(valor));
  return coincidencia ? Number.parseInt(coincidencia[0], 10) : 0;
}

/** `mb_substr($texto, 0, $largo)`: corta por caracteres, no por bytes. */
export function mbSubstr(texto: string, largo: number): string {
  return Array.from(texto).slice(0, largo).join('');
}

/**
 * Valor falso para PHP (`!$v` o `$v ?: ...`): null, false, 0, '', '0' y el
 * array vacío. Para valores que vienen de `phpJsonDecode`.
 */
export function phpFalso(valor: unknown): boolean {
  if (valor === null || valor === undefined || valor === false || valor === 0 || valor === '') {
    return true;
  }
  if (valor === '0') return true;
  if (Array.isArray(valor)) return valor.length === 0;
  if (typeof valor === 'object') return Object.keys(valor).length === 0;
  return false;
}

/** Objeto JSON cuyas claves son "0".."n-1": PHP lo guarda como lista y json_encode lo escribe como array. */
function aArrayPhp(valor: unknown): unknown {
  if (Array.isArray(valor)) return valor.map(aArrayPhp);
  if (valor === null || typeof valor !== 'object') return valor;
  const entradas = Object.entries(valor).map(([k, v]) => [k, aArrayPhp(v)] as const);
  const esLista = entradas.every(([k], i) => k === String(i));
  return esLista ? entradas.map(([, v]) => v) : Object.fromEntries(entradas);
}

/**
 * `json_decode($texto, true)` de PHP, tal como lo vería después `json_encode`:
 * null si el texto no es JSON válido; los objetos con claves 0..n-1 quedan como
 * lista (el objeto vacío `{}` queda como `[]`).
 *
 * Diferencia conocida: JavaScript ordena las claves numéricas de un objeto, así
 * que `{"1":5,"0":6}` sale como `[6,5]` (PHP lo deja como objeto en su orden).
 */
export function phpJsonDecode(texto: string): unknown {
  try {
    return aArrayPhp(JSON.parse(texto));
  } catch {
    return null;
  }
}
