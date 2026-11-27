import type { NextFunction, Request, Response } from 'express';

/**
 * Réplica de TrimTrailingSlash de apipos: `/ruta/` se atiende como `/ruta`.
 * Algunos POS en producción llaman las rutas con barra final.
 * Se registra con `app.use()` en main.ts, antes del router.
 */
export function quitarSlashFinal(req: Request, _res: Response, next: NextFunction): void {
  const [ruta, query] = req.url.split(/\?(.*)/s, 2);
  if (ruta.length > 1 && ruta.endsWith('/')) {
    const limpia = ruta.replace(/\/+$/, '') || '/';
    req.url = query !== undefined ? `${limpia}?${query}` : limpia;
  }
  next();
}
