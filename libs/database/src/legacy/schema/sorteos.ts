import { date, int, longtext, text, tinyint, varchar } from 'drizzle-orm/mysql-core';
import { tablaLegado } from './tabla-legado.js';

/** llx_pos_sorteo: sorteos del POS (módulo integrospos). estado 1 = activo. */
export const sorteos = tablaLegado('pos_sorteo', {
  rowid: int('rowid').primaryKey().autoincrement(),
  fechaInicio: date('fecha_inicio', { mode: 'string' }).notNull(),
  fechaFinal: date('fecha_final', { mode: 'string' }).notNull(),
  descripcion: varchar('descripcion', { length: 255 }),
  premio: varchar('premio', { length: 255 }),
  compraMinimo: int('compra_minimo').notNull(),
  valorParticipacion: int('valor_participacion').notNull(),
  estado: tinyint('estado').notNull(),
  tipoCliente: varchar('tipo_cliente', { length: 20 }).notNull(),
  permitirEntregarSinCtrl: tinyint('permitir_entregar_sin_ctrl').notNull(),
  /** JSON con los rowid de los terceros que participan. */
  fkClientes: longtext('fk_clientes'),
  /** JSON con los rowid de los productos que participan. */
  fkProductos: longtext('fk_productos'),
  /** 'fijo' = 1 boleto si supera el mínimo; 'proporcional' = floor(compra / valor_participacion). */
  tipoCalculo: varchar('tipo_calculo', { length: 15 }).notNull(),
  observacion: text('observacion'),
});
