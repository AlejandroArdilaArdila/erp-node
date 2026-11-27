import { int, text, tinyint, varchar } from 'drizzle-orm/mysql-core';
import { tablaLegado } from './tabla-legado.js';

/** llx_const: constantes de configuración de Dolibarr (por entidad; 0 = global). */
export const constantes = tablaLegado('const', {
  rowid: int('rowid').primaryKey().autoincrement(),
  name: varchar('name', { length: 180 }).notNull(),
  entity: int('entity').notNull(),
  value: text('value').notNull(),
});

/** llx_c_ciudades_fe: ciudades y departamentos con su código DIAN (módulo integrospos). */
export const ciudadesFe = tablaLegado('c_ciudades_fe', {
  rowid: int('rowid').primaryKey().autoincrement(),
  code: varchar('code', { length: 5 }),
  zip: varchar('zip', { length: 10 }).notNull(),
  codeDepto: varchar('code_depto', { length: 5 }),
  depto: varchar('depto', { length: 180 }).notNull(),
  ciudad: varchar('ciudad', { length: 180 }).notNull(),
  active: tinyint('active').notNull(),
});
