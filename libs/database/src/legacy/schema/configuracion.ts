import { double, int, text, tinyint, varchar } from 'drizzle-orm/mysql-core';
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

/** llx_extrafields: definición de los campos adicionales de Dolibarr. */
export const definicionesExtrafield = tablaLegado('extrafields', {
  rowid: int('rowid').primaryKey().autoincrement(),
  name: varchar('name', { length: 64 }).notNull(),
  elementtype: varchar('elementtype', { length: 64 }).notNull(),
  /** Parámetros con serialize() de PHP, p. ej. las opciones de una lista. */
  param: text('param'),
});

/** llx_c_tva: tarifas de IVA por país (fk_pays 70 = Colombia). */
export const tarifasIva = tablaLegado('c_tva', {
  rowid: int('rowid').primaryKey().autoincrement(),
  fkPays: int('fk_pays').notNull(),
  code: varchar('code', { length: 10 }),
  taux: double('taux').notNull(),
  localtax1: varchar('localtax1', { length: 20 }).notNull(),
  localtax1Type: varchar('localtax1_type', { length: 10 }).notNull(),
  active: tinyint('active').notNull(),
});

/** llx_c_units: unidades de medida (peso, volumen, tamaño...). */
export const unidadesMedida = tablaLegado('c_units', {
  rowid: int('rowid').primaryKey().autoincrement(),
  scale: int('scale'),
  shortLabel: varchar('short_label', { length: 5 }),
  unitType: varchar('unit_type', { length: 10 }),
});
