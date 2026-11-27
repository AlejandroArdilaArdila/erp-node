import { datetime, int, text, tinyint, varchar } from 'drizzle-orm/mysql-core';
import { tablaLegado } from './tabla-legado.js';

/**
 * llx_chat_vendedor: chat entre vendedores (módulo integrospos).
 * `fk_user_to = 0` es un mensaje de difusión, para todos.
 */
export const mensajesChat = tablaLegado('chat_vendedor', {
  rowid: int('rowid').primaryKey().autoincrement(),
  fkUserFrom: int('fk_user_from').notNull(),
  fkUserTo: int('fk_user_to').notNull(),
  mensaje: text('mensaje').notNull(),
  tipo: varchar('tipo', { length: 50 }).notNull(),
  fecha: datetime('fecha', { mode: 'string' }).notNull(),
  leido: tinyint('leido').notNull(),
});
