import { date, int, tinyint, varchar } from 'drizzle-orm/mysql-core';
import { tablaLegado } from './tabla-legado.js';

/**
 * llx_pos_img_cp: imágenes del carrusel del Price Checker (módulo integrospos).
 * `filename` es el nombre del archivo dentro de
 * htdocs/custom/integrospos/frontend/img/carrouselPriceChecker.
 */
export const imagenesCarrusel = tablaLegado('pos_img_cp', {
  rowid: int('rowid').primaryKey().autoincrement(),
  filename: varchar('filename', { length: 255 }).notNull(),
  label: varchar('label', { length: 255 }),
  dateStart: date('date_start', { mode: 'string' }).notNull(),
  dateEnd: date('date_end', { mode: 'string' }).notNull(),
  active: tinyint('active').notNull(),
});
