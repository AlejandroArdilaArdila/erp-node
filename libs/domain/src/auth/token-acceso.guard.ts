import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { RequestAutenticado } from './api-key.guard.js';
import { SesionPosService } from './sesion-pos.service.js';

/** Extrae el token de "Authorization: Bearer <token>" (como bearerToken() de Laravel). */
export function tokenBearer(autorizacion: string | undefined): string | null {
  const coincidencia = /^Bearer\s+(.+)$/i.exec(autorizacion ?? '');
  return coincidencia ? coincidencia[1].trim() : null;
}

/**
 * Protege rutas con el access token del POS (equivalente a `auth:sanctum`).
 * Sin token o vencido → 401 { "message": "Unauthenticated." }.
 */
@Injectable()
export class TokenAccesoGuard implements CanActivate {
  constructor(private readonly sesiones: SesionPosService) {}

  async canActivate(contexto: ExecutionContext): Promise<boolean> {
    const req = contexto.switchToHttp().getRequest<RequestAutenticado>();
    const bearer = tokenBearer(req.headers.authorization);
    const resultado = bearer ? await this.sesiones.usuarioDeToken(bearer) : null;
    if (!resultado) {
      throw new UnauthorizedException('Unauthenticated.');
    }
    req.usuario = resultado.usuario;
    return true;
  }
}
