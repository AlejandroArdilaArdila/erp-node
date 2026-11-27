import { setTimeout as esperar } from 'node:timers/promises';

/** Códigos MySQL que indican conflicto de bloqueo y que vale la pena reintentar. */
const ERRORES_REINTENTABLES = new Map<number | string, string>([
  [1213, 'deadlock'],
  ['ER_LOCK_DEADLOCK', 'deadlock'],
  [1205, 'lock wait timeout'],
  ['ER_LOCK_WAIT_TIMEOUT', 'lock wait timeout'],
]);

/**
 * Busca en la cadena de causas (Drizzle envuelve el error de mysql2 en
 * DrizzleQueryError.cause) un error de bloqueo reintentable.
 */
export function motivoReintentable(error: unknown): string | null {
  let actual: unknown = error;
  for (let profundidad = 0; actual && profundidad < 5; profundidad++) {
    if (typeof actual === 'object') {
      const { errno, code } = actual as { errno?: number; code?: string };
      const motivo =
        (errno !== undefined && ERRORES_REINTENTABLES.get(errno)) ||
        (code !== undefined && ERRORES_REINTENTABLES.get(code));
      if (motivo) {
        return motivo;
      }
      actual = (actual as { cause?: unknown }).cause;
    } else {
      break;
    }
  }
  return null;
}

export interface OpcionesReintento {
  /** Intentos totales (incluye el primero). Por defecto 3. */
  intentos?: number;
  /** Espera base en ms; crece exponencialmente con variación aleatoria. Por defecto 25. */
  esperaBaseMs?: number;
  /** Se llama antes de cada reintento (para registrar en el log). */
  alReintentar?: (info: { intento: number; motivo: string; error: unknown }) => void;
}

/**
 * Ejecuta `trabajo` y lo repite si falla por deadlock o lock wait timeout.
 *
 * El trabajo debe ser la transacción COMPLETA: al reintentar se ejecuta todo
 * de nuevo desde cero, así que dentro no puede haber efectos externos
 * (llamadas HTTP, correos, DIAN). Ver docs/adr/0004-concurrencia.md.
 */
export async function conReintentoPorBloqueo<T>(
  trabajo: () => Promise<T>,
  { intentos = 3, esperaBaseMs = 25, alReintentar }: OpcionesReintento = {},
): Promise<T> {
  for (let intento = 1; ; intento++) {
    try {
      return await trabajo();
    } catch (error) {
      const motivo = motivoReintentable(error);
      if (!motivo || intento >= intentos) {
        throw error;
      }
      alReintentar?.({ intento, motivo, error });
      const espera = esperaBaseMs * 2 ** (intento - 1);
      await esperar(espera + Math.random() * espera);
    }
  }
}
