import { UnprocessableEntityException, ValidationPipe, type ValidationError } from '@nestjs/common';

function aplanar(errores: ValidationError[], padre = ''): Record<string, string[]> {
  const salida: Record<string, string[]> = {};
  for (const error of errores) {
    const campo = padre ? `${padre}.${error.property}` : error.property;
    if (error.constraints) {
      salida[campo] = Object.values(error.constraints);
    }
    if (error.children?.length) {
      Object.assign(salida, aplanar(error.children, campo));
    }
  }
  return salida;
}

/**
 * ValidationPipe global con respuesta estilo Laravel (422):
 *   { "message": "primer error", "errors": { "campo": ["..."] } }
 *
 * `whitelist` elimina propiedades no declaradas en el DTO (evita que un
 * cliente inyecte campos como `admin` o `entity`).
 */
export function crearValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    transform: true,
    whitelist: true,
    exceptionFactory: (errores) => {
      const errors = aplanar(errores);
      const primero = Object.values(errors)[0]?.[0] ?? 'Datos inválidos.';
      return new UnprocessableEntityException({ message: primero, errors });
    },
  });
}
