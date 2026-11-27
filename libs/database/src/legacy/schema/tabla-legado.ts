import { mysqlTableCreator } from 'drizzle-orm/mysql-core';

/**
 * Prefijo de tablas de Dolibarr ($dolibarr_main_db_prefix, normalmente `llx_`).
 * Se lee al importar el módulo; por eso `cargar-env` debe ser el primer import
 * de main.ts.
 */
export const PREFIJO_LEGADO = process.env.LEGACY_DB_PREFIX ?? 'llx_';

/**
 * Define una tabla de la base de Dolibarr SIN el prefijo:
 *
 *   export const usuarios = tablaLegado('user', { ... });   // → llx_user
 *
 * ⚠️ Estas definiciones describen tablas que NO son nuestras: nunca se
 * generan migraciones ni se hace `drizzle-kit push` sobre la base legado.
 * Declarar solo las columnas que el código realmente usa.
 */
export const tablaLegado = mysqlTableCreator((nombre) => `${PREFIJO_LEGADO}${nombre}`);
