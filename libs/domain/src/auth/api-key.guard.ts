import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { ApiKeyService } from './api-key.service.js';
import type { UsuarioAutenticado } from './usuario-autenticado.js';

/** Header con el que el POS envía la api_key de Dolibarr. */
export const HEADER_DOLAPIKEY = 'dolapikey';

export type RequestAutenticado = Request & { usuario?: UsuarioAutenticado };

/**
 * Protege rutas con el header DOLAPIKEY (equivalente a `auth:apikey` en apipos).
 *
 *   @UseGuards(ApiKeyGuard)
 *   @Get('algo')
 *   algo(@UsuarioActual() usuario: UsuarioAutenticado) { ... }
 *
 * Sin header o con api_key inválida → 401 { "message": "Unauthenticated." }
 * (mismo cuerpo que Laravel).
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly apiKeys: ApiKeyService) {}

  async canActivate(contexto: ExecutionContext): Promise<boolean> {
    const req = contexto.switchToHttp().getRequest<RequestAutenticado>();
    const valor = req.headers[HEADER_DOLAPIKEY];
    const apiKey = typeof valor === 'string' ? valor : '';

    const usuario = await this.apiKeys.usuarioPorApiKey(apiKey);
    if (!usuario) {
      throw new UnauthorizedException('Unauthenticated.');
    }

    req.usuario = usuario;
    return true;
  }
}
