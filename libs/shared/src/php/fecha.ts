/**
 * `Carbon::parse($texto)` de apipos para las fechas que manda el POS.
 *
 * Carbon acepta casi cualquier texto (strtotime de PHP: "now", "tomorrow",
 * "11/28/2026"...). Aquí se acepta solo el formato ISO que genera el POS en
 * Dart (`DateTime.toString()` y `toIso8601String()`), con los mismos límites y
 * normalizaciones que PHP (verificados con Carbon y PHP 8.4):
 * - la hora queda tal como viene escrita: la zona (Z, -05:00) no la convierte;
 * - mes 0..12, día 0..31, hora 0..24, segundo 0..60, y se normalizan
 *   ("2026-02-30" → "2026-03-02", "24:00:00" → día siguiente);
 * - los microsegundos se truncan a 6 dígitos.
 * Cualquier otro texto da null (apipos podría aceptarlo; es una diferencia
 * documentada y no aplica a lo que envía el POS).
 */
const ISO =
  /^\s*(\d{4})-(\d{1,2})-(\d{1,2})(?:[Tt](\d{1,2})(?::(\d{1,2})(?::(\d{1,2})(?:\.(\d*))?)?)?|\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2})(?:\.(\d*))?)?)?\s*(?:[Zz]|[+-]\d{1,2}(?::?\d{1,2})?)?\s*$/;

const dos = (n: number) => String(n).padStart(2, '0');

export interface FechaPhp {
  /** 'Y-m-d H:i:s' */
  fechaHora: string;
  /** 'Y-m-d H:i:s.u' (6 dígitos de microsegundos) */
  conMicrosegundos: string;
}

export function carbonParse(texto: string): FechaPhp | null {
  const m = ISO.exec(texto);
  if (!m) return null;
  const anio = Number(m[1]);
  const mes = Number(m[2]);
  const dia = Number(m[3]);
  const hora = Number(m[4] ?? m[8] ?? 0);
  const minuto = Number(m[5] ?? m[9] ?? 0);
  const segundo = Number(m[6] ?? m[10] ?? 0);
  const fraccion = (m[7] ?? m[11] ?? '').slice(0, 6).padEnd(6, '0');
  if (mes > 12 || dia > 31 || hora > 24 || minuto > 59 || segundo > 60) return null;

  // Aritmética en UTC solo para normalizar desbordes (día 0, 30 de febrero...).
  const fecha = new Date(0);
  fecha.setUTCFullYear(anio, mes - 1, dia);
  fecha.setUTCHours(hora, minuto, segundo, 0);
  const a = fecha.getUTCFullYear();
  const anioTexto = a < 0 ? `-${String(-a).padStart(4, '0')}` : String(a).padStart(4, '0');
  const fechaHora =
    `${anioTexto}-${dos(fecha.getUTCMonth() + 1)}-${dos(fecha.getUTCDate())} ` +
    `${dos(fecha.getUTCHours())}:${dos(fecha.getUTCMinutes())}:${dos(fecha.getUTCSeconds())}`;
  return { fechaHora, conMicrosegundos: `${fechaHora}.${fraccion}` };
}
