import { int, smallint, varchar } from 'drizzle-orm/mysql-core';
import { tablaLegado } from './tabla-legado.js';

/** llx_user: usuarios de Dolibarr (solo columnas usadas por erp-node). */
export const usuarios = tablaLegado('user', {
  rowid: int('rowid').primaryKey().autoincrement(),
  entity: int('entity').notNull(),
  login: varchar('login', { length: 50 }).notNull(),
  pass: varchar('pass', { length: 128 }),
  passCrypted: varchar('pass_crypted', { length: 128 }),
  apiKey: varchar('api_key', { length: 128 }),
  statut: smallint('statut').notNull(),
  admin: smallint('admin').notNull(),
  firstname: varchar('firstname', { length: 50 }),
  lastname: varchar('lastname', { length: 50 }),
  email: varchar('email', { length: 255 }),
});
