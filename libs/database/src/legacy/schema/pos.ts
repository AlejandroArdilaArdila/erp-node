import { bigint, datetime, int, tinyint, varchar } from 'drizzle-orm/mysql-core';
import { tablaLegado } from './tabla-legado.js';

/** llx_pos_cash: terminales (cajas) del POS. `fk_soc` guarda el id del USUARIO asignado. */
export const terminalesPos = tablaLegado('pos_cash', {
  rowid: int('rowid').primaryKey().autoincrement(),
  entity: int('entity').notNull(),
  name: varchar('name', { length: 30 }),
  fkSoc: int('fk_soc'),
  isUsed: tinyint('is_used'),
});

/** llx_integrospos_terminal_aperturacierre: aperturas y cierres de caja. estado 1=abierta, 2=cerrada, 3=conciliada. */
export const aperturasCaja = tablaLegado('integrospos_terminal_aperturacierre', {
  rowid: bigint('rowid', { mode: 'number', unsigned: true }).primaryKey().autoincrement(),
  fkUser: int('fk_user').notNull(),
  fechaApertura: datetime('fecha_apertura', { mode: 'string' }).notNull(),
  fechaCierre: datetime('fecha_cierre', { mode: 'string' }),
  estado: tinyint('estado').notNull(),
});
