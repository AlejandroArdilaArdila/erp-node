import {
  createParamDecorator,
  type ExecutionContext,
  InternalServerErrorException,
} from '@nestjs/common';
import type { RequestAutenticado } from './api-key.guard.js';
import type { UsuarioAutenticado } from './usuario-autenticado.js';

/**
 * Inyecta el usuario autenticado en el parámetro de un controlador.
 * Solo funciona en rutas protegidas por un guard de autenticación.
 */
export const UsuarioActual = createParamDecorator(
  (_dato: unknown, contexto: ExecutionContext): UsuarioAutenticado => {
    const usuario = contexto.switchToHttp().getRequest<RequestAutenticado>().usuario;
    if (!usuario) {
      throw new InternalServerErrorException(
        '@UsuarioActual() usado en una ruta sin guard de autenticación.',
      );
    }
    return usuario;
  },
);
