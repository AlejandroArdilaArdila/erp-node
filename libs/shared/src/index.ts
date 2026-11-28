/**
 * @erp/shared: piezas transversales sin lógica de negocio
 * (configuración, errores, logging, utilidades HTTP).
 */
export * from './config/app-config.js';
export * from './config/config.module.js';
export * from './config/env.schema.js';
export * from './errors/http-exception.filter.js';
export * from './errors/validation.js';
export * from './http/basic-auth.middleware.js';
export * from './http/quitar-slash-final.middleware.js';
export * from './http/responder-json-php.js';
export * from './logging/logging.module.js';
export * from './logging/serializar-error.js';
export * from './php/fecha.js';
export * from './php/json.js';
export * from './php/laravel.js';
export * from './php/php.js';
export * from './php/unserialize.js';
export * from './tiempo/reloj.js';
