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
