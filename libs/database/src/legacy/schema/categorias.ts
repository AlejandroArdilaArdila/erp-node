import { int, text, varchar } from 'drizzle-orm/mysql-core';
import { tablaLegado } from './tabla-legado.js';

/** llx_categorie: categorías de Dolibarr. type 0 = producto, 1 = proveedor, 2 = cliente... */
export const categorias = tablaLegado('categorie', {
  rowid: int('rowid').primaryKey().autoincrement(),
  entity: int('entity').notNull(),
  fkParent: int('fk_parent').notNull(),
  label: varchar('label', { length: 180 }).notNull(),
  type: int('type').notNull(),
  description: text('description'),
  color: varchar('color', { length: 8 }),
});

/** llx_categorie_product: productos de cada categoría (clave compuesta). */
export const categoriasProducto = tablaLegado('categorie_product', {
  fkCategorie: int('fk_categorie').notNull(),
  fkProduct: int('fk_product').notNull(),
});
