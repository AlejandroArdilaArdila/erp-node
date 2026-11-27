import { Module } from '@nestjs/common';
import { PosDominioModule } from '@erp/domain/pos';
import { TercerosModule } from '@erp/domain/terceros';
import { ApiKeyGuard } from './api-key.guard.js';
import { ApiKeyService } from './api-key.service.js';
import { SesionPosService } from './sesion-pos.service.js';
import { SesionesDispositivoRepositorio } from './sesiones-dispositivo.repositorio.js';
import { TokenAccesoGuard } from './token-acceso.guard.js';
import { TokensRepositorio } from './tokens.repositorio.js';
import { UsuariosRepositorio } from './usuarios.repositorio.js';

/**
 * Dominio auth: identidad de usuarios de Dolibarr.
 *  - DOLAPIKEY (ApiKeyGuard): la mayoría de servicios del POS.
 *  - Sesión del POS (SesionPosService + TokenAccesoGuard): login, refresh, logout, /me.
 * El login web del ERP (sesión con cookie) llega con apps/web (fase 2).
 */
@Module({
  imports: [PosDominioModule, TercerosModule],
  providers: [
    UsuariosRepositorio,
    TokensRepositorio,
    SesionesDispositivoRepositorio,
    ApiKeyService,
    ApiKeyGuard,
    SesionPosService,
    TokenAccesoGuard,
  ],
  exports: [ApiKeyService, ApiKeyGuard, SesionPosService, TokenAccesoGuard],
})
export class AuthModule {}
