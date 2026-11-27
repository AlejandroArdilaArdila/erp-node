/**
 * Variables de entorno para los tests e2e. La base de datos apunta a un
 * puerto cerrado: los tests NUNCA tocan una base real (ni la de producción).
 */
Object.assign(process.env, {
  NODE_ENV: 'test',
  TENANT_ID: 'pruebas',
  LOG_LEVEL: 'fatal',
  LEGACY_DB_HOST: '127.0.0.1',
  LEGACY_DB_PORT: '1',
  LEGACY_DB_NAME: 'no_existe',
  LEGACY_DB_USER: 'test',
  DOLIBARR_INSTANCE_KEY: 'clave-de-prueba',
  SWAGGER_ENABLED: 'true',
  SWAGGER_USER: 'equipo',
  SWAGGER_PASSWORD: 'clave-docs-de-prueba-123',
});
