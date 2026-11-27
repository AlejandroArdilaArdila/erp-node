import type { MySql2Database } from 'drizzle-orm/mysql2';
import type * as esquemaLegado from './schema/index.js';

/** Token de inyección de la conexión Drizzle a la base legado (MySQL Dolibarr). */
export const LEGACY_DB = Symbol('LEGACY_DB');

/** Token del pool mysql2 subyacente (solo para salud y cierre). */
export const LEGACY_DB_POOL = Symbol('LEGACY_DB_POOL');

export type LegacyDb = MySql2Database<typeof esquemaLegado>;

/** Transacción abierta sobre la base legado. */
export type LegacyTx = Parameters<Parameters<LegacyDb['transaction']>[0]>[0];

/** Ejecutor de consultas: la conexión normal o una transacción. */
export type LegacyEjecutor = LegacyDb | LegacyTx;
