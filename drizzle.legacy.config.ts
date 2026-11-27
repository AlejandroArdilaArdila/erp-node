import { existsSync } from 'node:fs';
import { defineConfig } from 'drizzle-kit';

/**
 * SOLO para `npm run db:introspect:legacy`: lee la estructura de la base de
 * Dolibarr y la escribe en .introspeccion-legado/ como REFERENCIA para
 * definir tablas en libs/database/src/legacy/schema/.
 *
 * ⚠️ Nunca usar `drizzle-kit push` ni `migrate` con esta configuración:
 * la base legado no es nuestra (ver docs/adr/0003-base-de-datos.md).
 */
if (existsSync('.env')) {
  process.loadEnvFile('.env');
}

export default defineConfig({
  dialect: 'mysql',
  out: './.introspeccion-legado',
  dbCredentials: {
    host: process.env.LEGACY_DB_HOST ?? '',
    port: Number(process.env.LEGACY_DB_PORT ?? 3306),
    user: process.env.LEGACY_DB_USER ?? '',
    password: process.env.LEGACY_DB_PASSWORD ?? '',
    database: process.env.LEGACY_DB_NAME ?? '',
  },
});
