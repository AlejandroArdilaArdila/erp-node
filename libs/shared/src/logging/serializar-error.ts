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

/** Serializador `err` de pino que elimina datos sensibles de errores de base de datos. */
export function serializarErrorSeguro(error: unknown): Record<string, unknown> {
  if (!(error instanceof Error)) {
    return { message: String(error) };
  }
  const serializado = stdSerializers.err(error) as unknown as Record<string, unknown>;
  delete serializado.params;
  delete serializado.sql;
  delete serializado.values;
  serializado.message = limpiarTexto(serializado.message as string | undefined);
  serializado.stack = limpiarTexto(serializado.stack as string | undefined);
  return serializado;
}
