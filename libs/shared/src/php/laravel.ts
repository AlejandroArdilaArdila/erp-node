/**
 * Lo que Laravel le hace a la entrada antes de que llegue al controlador, y
 * cómo enlaza los valores al insertar. Usar SOLO al portar endpoints de apipos
 * que guardan lo que manda el cliente.
 */

/**
 * Caracteres que recorta `Str::trim()` (TrimStrings): `\s` de PCRE con /u,
 * `Str::INVISIBLE_CHARACTERS` y " \n\r\t\v\0". El `\s` de JavaScript no sirve:
 * no incluye U+0085 ni los caracteres invisibles de Laravel.
 */
const ESPACIOS_PCRE =
  '\\u0009-\\u000D\\u0020\\u0085\\u00A0\\u1680\\u180E\\u2000-\\u200A\\u2028\\u2029\\u202F\\u205F\\u3000';
const INVISIBLES_LARAVEL =
  '\\u00AD\\u034F\\u061C\\u115F\\u1160\\u17B4\\u17B5\\u200B-\\u200F\\u2060-\\u2065\\u206A-\\u206F\\u2800\\u3164\\uFEFF\\uFFA0' +
  '\\u{1D159}\\u{1D173}-\\u{1D17A}\\u{E0020}';
const CLASE = `[${ESPACIOS_PCRE}${INVISIBLES_LARAVEL}\\u0000]`;
// La lista de Laravel incluye marcas combinables (U+034F, U+200D...) a propósito.
// eslint-disable-next-line no-misleading-character-class
const RECORTE = new RegExp(`^${CLASE}+|${CLASE}+$`, 'gu');

/** `Str::trim($texto)` de Laravel. */
export function laravelTrim(texto: string): string {
  return texto.replace(RECORTE, '');
}

/** Campos que TrimStrings no recorta (lista por defecto de Laravel). */
const SIN_RECORTE = new Set(['current_password', 'password', 'password_confirmation']);

/** TrimStrings + ConvertEmptyStringsToNull, recursivo como TransformsRequest::cleanArray. */
function limpiar(valor: unknown, clave: string): unknown {
  if (Array.isArray(valor)) return valor.map((v, i) => limpiar(v, `${clave}${i}`));
  if (valor !== null && typeof valor === 'object') {
    return Object.fromEntries(
      Object.entries(valor).map(([k, v]) => [k, limpiar(v, `${clave}${k}`)]),
    );
  }
  if (typeof valor !== 'string') return valor;
  const recortado = SIN_RECORTE.has(clave) ? valor : laravelTrim(valor);
  return recortado === '' ? null : recortado;
}

/**
 * `$request->input()` de Laravel con sus middlewares globales: query string y
 * cuerpo con los textos recortados y los vacíos en null; si una clave está en
 * los dos, gana el cuerpo.
 */
export function entradaLaravel(query: unknown, cuerpo: unknown): Record<string, unknown> {
  const q = limpiar(query ?? {}, '');
  const c = limpiar(cuerpo ?? {}, '');
  const comoObjeto = (v: unknown): Record<string, unknown> =>
    v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  return { ...comoObjeto(q), ...comoObjeto(c) };
}

/**
 * `$request->filled($clave)`: hay valor y no es un texto vacío (los booleanos
 * y los arrays cuentan como llenos).
 */
export function laravelFilled(entrada: Record<string, unknown>, clave: string): boolean {
  const valor = entrada[clave];
  if (typeof valor === 'boolean' || Array.isArray(valor)) return true;
  if (valor === null || valor === undefined) return false;
  // Números y objetos cuentan como llenos; solo un texto puede estar vacío.
  return typeof valor !== 'string' || valor.trim() !== '';
}
