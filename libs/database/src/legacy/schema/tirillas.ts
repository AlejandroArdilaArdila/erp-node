import { int, json, longtext, tinyint, varchar } from 'drizzle-orm/mysql-core';
import { tablaLegado } from './tabla-legado.js';

/**
 * llx_integrospos_ticket_template: plantillas de tirilla del POS.
 * ⚠ dato_preview y variables son columnas JSON de MySQL: mysql2 las convierte en
 * objeto y pierde el orden de las claves. Leerlas con `CAST(... AS CHAR)`, que
 * da el mismo texto que recibe PDO.
 */
export const plantillasTirilla = tablaLegado('integrospos_ticket_template', {
  rowid: int('rowid').primaryKey().autoincrement(),
  nombre: varchar('nombre', { length: 100 }).notNull(),
  label: varchar('label', { length: 200 }).notNull(),
  config: longtext('config'),
  activo: tinyint('activo'),
  datoPreview: json('dato_preview'),
  columnas: tinyint('columnas', { unsigned: true }).notNull(),
  variables: json('variables'),
});

/** llx_integrospos_ticket_secciones: secciones reutilizables de tirilla. `elementos` es JSON. */
export const seccionesTirilla = tablaLegado('integrospos_ticket_secciones', {
  rowid: int('rowid').primaryKey().autoincrement(),
  nombre: varchar('nombre', { length: 100 }).notNull(),
  descripcion: varchar('descripcion', { length: 500 }).notNull(),
  elementos: json('elementos').notNull(),
});

/** llx_integrospos_ticket_variables: variables de campo disponibles en las tirillas. */
export const variablesTirilla = tablaLegado('integrospos_ticket_variables', {
  rowid: int('rowid').primaryKey().autoincrement(),
  nombre: varchar('nombre', { length: 100 }).notNull(),
  descripcion: varchar('descripcion', { length: 500 }).notNull(),
  tipo: varchar('tipo', { length: 20 }).notNull(),
});
