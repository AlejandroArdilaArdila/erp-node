import { createHash, timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, RequestHandler, Response } from 'express';

/** Compara en tiempo constante (vía hash, para no filtrar el largo). */
function igual(a: string, b: string): boolean {
  const hashA = createHash('sha256').update(a).digest();
  const hashB = createHash('sha256').update(b).digest();
  return timingSafeEqual(hashA, hashB);
}

/**
 * Protege rutas con HTTP Basic (el navegador pide usuario y contraseña).
 * Se usa para la documentación Swagger; NO para la API de negocio.
 */
export function protegerConBasicAuth(
  usuario: string,
  password: string,
  realm: string,
): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const encabezado = req.headers.authorization ?? '';
    const [esquema, credenciales] = encabezado.split(' ');
    if (esquema?.toLowerCase() === 'basic' && credenciales) {
      const decodificado = Buffer.from(credenciales, 'base64').toString('utf8');
      const separador = decodificado.indexOf(':');
      const okUsuario = igual(decodificado.slice(0, separador), usuario);
      const okPassword = igual(decodificado.slice(separador + 1), password);
      if (separador > 0 && okUsuario && okPassword) {
        next();
        return;
      }
    }
    res.setHeader('WWW-Authenticate', `Basic realm="${realm}", charset="UTF-8"`);
    res.status(401).json({ message: 'Unauthenticated.' });
  };
}
