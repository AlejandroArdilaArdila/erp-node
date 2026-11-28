import { datetime, int, tinyint, varchar } from 'drizzle-orm/mysql-core';
import { tablaLegado } from './tabla-legado.js';

/** llx_product: productos y servicios de Dolibarr. fk_product_type: 0 producto, 1 servicio. */
export const productos = tablaLegado('product', {
  rowid: int('rowid').primaryKey().autoincrement(),
  ref: varchar('ref', { length: 128 }).notNull(),
  label: varchar('label', { length: 255 }).notNull(),
  fkProductType: int('fk_product_type'),
});

/**
 * llx_product_codoperativos: códigos operativos del POS (módulo integrospos),
 * cada uno asociado a un producto o servicio.
 */
export const codigosOperativos = tablaLegado('product_codoperativos', {
  rowid: int('rowid').primaryKey().autoincrement(),
  codigo: varchar('codigo', { length: 50 }).notNull(),
  fkProduct: int('fk_product').notNull(),
  /** 1 aplica descuento, 0 no, NULL sin definir (filas anteriores a la columna). */
  descuento: tinyint('descuento'),
  entity: int('entity').notNull(),
  active: tinyint('active').notNull(),
  dateCreation: datetime('date_creation', { mode: 'string' }).notNull(),
});
