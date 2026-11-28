import type { Response } from 'express';
import { phpJsonEncode } from '../php/json.js';

/**
 * Responde con el cuerpo escrito por `phpJsonEncode` (como `response()->json()`
 * de Laravel) en vez de JSON.stringify. Para endpoints que devuelven JSON
 * guardado en la base (`PhpJson`), donde importan el orden de las claves y el
 * formato de los números. Usar con `@Res()` en el controlador.
 */
export function responderJsonPhp(res: Response, cuerpo: unknown, status = 200): void {
  res.status(status).type('application/json').send(phpJsonEncode(cuerpo));
}
