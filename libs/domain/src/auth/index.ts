/**
 * API pública del dominio auth. Otros módulos importan SOLO desde aquí
 * (`@erp/domain/auth`), nunca archivos internos ni los repositorios.
 */
export * from './api-key.guard.js';
export * from './api-key.service.js';
export * from './auth.module.js';
export { DirectorioUsuariosService, type NombreUsuario } from './directorio-usuarios.service.js';
export { MODULOS_PERMISOS_POS, PermisosService } from './permisos.service.js';
export { type RespuestaLegado, SesionPosService } from './sesion-pos.service.js';
export { TokenAccesoGuard, tokenBearer } from './token-acceso.guard.js';
export * from './usuario-actual.decorator.js';
export type { UsuarioAutenticado } from './usuario-autenticado.js';
