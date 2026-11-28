import { int, tinyint, varchar } from 'drizzle-orm/mysql-core';
import { tablaLegado } from './tabla-legado.js';

/**
 * llx_entrepot: almacenes. Un almacén sin padre (fk_parent 0 o NULL) es una
 * sucursal; sus hijos son los almacenes de esa sucursal.
 * statut: 1 abierto, 0 cerrado (2 = solo movimientos internos, con ENTREPOT_EXTRA_STATUS).
 */
export const almacenes = tablaLegado('entrepot', {
  rowid: int('rowid').primaryKey().autoincrement(),
  ref: varchar('ref', { length: 255 }).notNull(),
  statut: tinyint('statut'),
  fkParent: int('fk_parent'),
});
