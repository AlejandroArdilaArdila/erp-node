import { datetime, int, text, timestamp, tinyint, varchar } from 'drizzle-orm/mysql-core';
import { tablaLegado } from './tabla-legado.js';

/** llx_informes_dashboard: dashboards dinámicos (módulo informes). */
export const dashboards = tablaLegado('informes_dashboard', {
  rowid: int('rowid').primaryKey().autoincrement(),
  nombre: varchar('nombre', { length: 255 }).notNull(),
  descripcion: text('descripcion'),
  colorTema: varchar('color_tema', { length: 20 }),
  icono: varchar('icono', { length: 40 }),
  esPublico: tinyint('es_publico').notNull(),
  fkUserCreat: int('fk_user_creat').notNull(),
  dateCreation: datetime('date_creation', { mode: 'string' }).notNull(),
  tms: timestamp('tms', { mode: 'string' }),
  /** JSON (TEXT): [{"orden":0,"nombre":"Ventas"}, ...] */
  tabsJson: text('tabs_json'),
});

/** llx_informes_dashboard_widget: widgets de cada dashboard, agrupados por tab. */
export const widgetsDashboard = tablaLegado('informes_dashboard_widget', {
  rowid: int('rowid').primaryKey().autoincrement(),
  fkDashboard: int('fk_dashboard').notNull(),
  tabNombre: varchar('tab_nombre', { length: 100 }).notNull(),
});
