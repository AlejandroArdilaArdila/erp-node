import { stdSerializers } from 'pino';

/**
 * Los errores de consulta (DrizzleQueryError, errores de mysql2) incluyen los
 * PARÁMETROS de la consulta en `message`, `stack`, `params` y `sql`: api keys,
 * contraseñas, documentos de clientes... Nada de eso puede llegar a un log
 * ni a una respuesta HTTP.
 */
const PARAMS_EN_TEXTO = /\nparams: [\s\S]*?(?=\n\s+at |$)/;

function limpiarTexto(texto: string | undefined): string | undefined {
  return texto?.replace(PARAMS_EN_TEXTO, '\nparams: [oculto]');
}

/** Mensaje de un error, sin parámetros de consulta. */
export function mensajeSeguro(error: unknown): string {
  if (!(error instanceof Error)) {
    return String(error);
  }
  return limpiarTexto(error.message) ?? '';
}

const CAMPOS_SENSIBLES = ['params', 'sql', 'values'] as const;

function limpiarSerializado(origen: Record<string, unknown>, nivel = 0): Record<string, unknown> {
  const limpio: Record<string, unknown> = { ...origen };
  for (const campo of CAMPOS_SENSIBLES) delete limpio[campo];
  if (typeof limpio.message === 'string') limpio.message = limpiarTexto(limpio.message);
  if (typeof limpio.stack === 'string') limpio.stack = limpiarTexto(limpio.stack);
  const causa = limpio.cause;
  if (causa && typeof causa === 'object' && nivel < 5) {
    limpio.cause = limpiarSerializado(causa as Record<string, unknown>, nivel + 1);
  }
  return limpio;
}

/**
 * Serializador `err` de pino que elimina datos sensibles de errores de base de datos.
 *
 * pino-http envuelve los serializadores: primero aplica el de pino y luego llama a
 * este con un objeto PLANO ({ type, message, stack, ... }), no con el `Error`.
 * Por eso se aceptan las dos formas. Antes, el objeto plano se convertía con
 * String() y los logs mostraban "[object Object]" en lugar del error.
 */
export function serializarErrorSeguro(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return limpiarSerializado(stdSerializers.err(error));
  }
  if (error !== null && typeof error === 'object') {
    return limpiarSerializado(error as Record<string, unknown>);
  }
  return { message: String(error) };
}
