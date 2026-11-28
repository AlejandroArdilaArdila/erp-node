import { Inject, Injectable } from '@nestjs/common';
import { dashboards, LEGACY_DB, type LegacyDb, widgetsDashboard } from '@erp/database';
import { count, desc, eq, or, sql } from 'drizzle-orm';

export interface Dashboard {
  id: number;
  nombre: string;
  descripcion: string | null;
  colorTema: string | null;
  icono: string | null;
  esPublico: number;
  idAutor: number;
  fechaCreacion: string;
  tms: string | null;
  tabsJson: string | null;
}

export interface DashboardConWidgets extends Dashboard {
  totalWidgets: number;
}

const columnas = {
  rowid: dashboards.rowid,
  nombre: dashboards.nombre,
  descripcion: dashboards.descripcion,
  colorTema: dashboards.colorTema,
  icono: dashboards.icono,
  esPublico: dashboards.esPublico,
  fkUserCreat: dashboards.fkUserCreat,
  dateCreation: dashboards.dateCreation,
  tms: dashboards.tms,
  tabsJson: dashboards.tabsJson,
};

type Fila = {
  rowid: number;
  nombre: string;
  descripcion: string | null;
  colorTema: string | null;
  icono: string | null;
  esPublico: number;
  fkUserCreat: number;
  dateCreation: string;
  tms: string | null;
  tabsJson: string | null;
};

function aDashboard(f: Fila): Dashboard {
  return {
    id: f.rowid,
    nombre: f.nombre,
    descripcion: f.descripcion,
    colorTema: f.colorTema,
    icono: f.icono,
    esPublico: f.esPublico,
    idAutor: f.fkUserCreat,
    fechaCreacion: f.dateCreation,
    tms: f.tms,
    tabsJson: f.tabsJson,
  };
}

/** Acceso a los dashboards dinámicos (llx_informes_dashboard*). Solo lectura. */
@Injectable()
export class DashboardsRepositorio {
  constructor(@Inject(LEGACY_DB) private readonly db: LegacyDb) {}

  /**
   * Dashboards del usuario o públicos, del modificado más reciente al más
   * antiguo, con su cantidad de widgets (la misma subconsulta que apipos).
   */
  async visiblesPara(idUsuario: number): Promise<DashboardConWidgets[]> {
    const filas = await this.db
      .select({
        ...columnas,
        totalWidgets:
          sql<number>`(select count(*) from ${widgetsDashboard} where ${widgetsDashboard}.${sql.identifier('fk_dashboard')} = ${dashboards}.${sql.identifier('rowid')})`.mapWith(
            Number,
          ),
      })
      .from(dashboards)
      .where(or(eq(dashboards.fkUserCreat, idUsuario), eq(dashboards.esPublico, 1)))
      .orderBy(desc(dashboards.tms));
    return filas.map((f) => ({ ...aDashboard(f), totalWidgets: f.totalWidgets }));
  }

  async porId(id: number): Promise<Dashboard | null> {
    const [fila] = await this.db
      .select(columnas)
      .from(dashboards)
      .where(eq(dashboards.rowid, id))
      .limit(1);
    return fila ? aDashboard(fila) : null;
  }

  /**
   * Cantidad de widgets por nombre de tab. El GROUP BY lo hace MySQL, con su
   * collation (sin distinguir mayúsculas), como `pluck('total', 'tab_nombre')`.
   */
  async widgetsPorTab(idDashboard: number): Promise<Map<string, number>> {
    const filas = await this.db
      .select({ tab: widgetsDashboard.tabNombre, total: count() })
      .from(widgetsDashboard)
      .where(eq(widgetsDashboard.fkDashboard, idDashboard))
      .groupBy(widgetsDashboard.tabNombre);
    return new Map(filas.map((f) => [f.tab, f.total]));
  }
}
