import {
  bigint,
  datetime,
  decimal,
  int,
  longtext,
  smallint,
  text,
  timestamp,
  tinyint,
  varchar,
} from 'drizzle-orm/mysql-core';
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

/**
 * llx_pos_logs_errores: errores de API (status >= 400) que reporta el POS.
 * created_at/updated_at los llenaba Eloquent con la hora de PHP (UTC en apipos).
 */
export const logsErroresPos = tablaLegado('pos_logs_errores', {
  id: bigint('id', { mode: 'number', unsigned: true }).primaryKey().autoincrement(),
  deviceid: varchar('deviceid', { length: 150 }),
  fkUser: int('fk_user'),
  metodo: varchar('metodo', { length: 10 }).notNull(),
  url: text('url').notNull(),
  statusCode: smallint('status_code', { unsigned: true }).notNull(),
  tiempoMs: int('tiempo_ms', { unsigned: true }),
  requestBody: longtext('request_body'),
  responseBody: longtext('response_body'),
  fechaCliente: datetime('fecha_cliente', { mode: 'string' }).notNull(),
  createdAt: timestamp('created_at', { mode: 'string' }),
  updatedAt: timestamp('updated_at', { mode: 'string' }),
});

/** llx_pos_auditoria: eventos de auditoría que sube la cola de sincronización del POS. */
export const auditoriaPos = tablaLegado('pos_auditoria', {
  rowid: int('rowid').primaryKey().autoincrement(),
  /** id LOCAL (SQLite) del evento en la terminal; se repite entre terminales. */
  idLocal: int('id_local'),
  fechaEvento: datetime('fecha_evento', { mode: 'string', fsp: 6 }).notNull(),
  modulo: varchar('modulo', { length: 100 }).notNull(),
  accion: varchar('accion', { length: 100 }).notNull(),
  usuarioId: int('usuario_id'),
  usuarioNombre: varchar('usuario_nombre', { length: 255 }),
  entidadTipo: varchar('entidad_tipo', { length: 100 }).notNull(),
  entidadId: varchar('entidad_id', { length: 255 }),
  tipoDocumento: varchar('tipo_documento', { length: 20 }),
  datosAntesJson: longtext('datos_antes_json'),
  datosDespuesJson: longtext('datos_despues_json'),
  descripcion: text('descripcion'),
  fkCajaLocal: varchar('fk_caja_local', { length: 255 }),
  total: decimal('total', { precision: 24, scale: 8 }),
  subtotal: decimal('subtotal', { precision: 24, scale: 8 }),
  iva: decimal('iva', { precision: 24, scale: 8 }),
  items: int('items'),
});
