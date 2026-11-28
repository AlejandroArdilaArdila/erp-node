import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { DirectorioUsuariosService, type NombreUsuario } from '@erp/domain/auth';
import { PhpDecimal, type PhpJson, phpEntero, phpJsonDecode, phpTrim, phpVacio } from '@erp/shared';
import { type Dashboard, DashboardsRepositorio } from './dashboards.repositorio.js';

const COLOR_POR_DEFECTO = '#6d28d9';
const ICONO_POR_DEFECTO = 'fa-chart-line';

/** Elemento de GET /api.php/informes/dashboarddinamico/dashboards (contrato apipos). */
export interface DashboardListadoLegado {
  rowid: number;
  nombre: string;
  descripcion: string;
  color_tema: string;
  icono: string;
  es_publico: number;
  n_widgets: number;
  date_creation: string;
  tms: string | null;
  propia: boolean;
  autor: string;
}

/** Respuesta de GET /api.php/informes/dashboarddinamico/dashboards/{id} (contrato apipos). */
export interface DashboardDetalleLegado {
  rowid: number;
  nombre: string;
  descripcion: string;
  color_tema: string;
  icono: string;
  es_publico: number;
  fk_user_creat: number;
  date_creation: string;
  tms: string | null;
  tabs: Array<{ orden: number; nombre: string; total_widgets: number }>;
}

/** `$t['clave'] ?? null` sobre un elemento de tabs_json (que puede no ser un array). */
function campo(valor: PhpJson, clave: string): PhpJson {
  return valor instanceof Map ? (valor.get(clave) ?? null) : null;
}

/** `(string)` de PHP para un valor de JSON. Un array da "Array" con un warning: Laravel responde 500. */
function textoPhp(valor: PhpJson): string {
  if (valor === null || valor === false) return '';
  if (valor === true) return '1';
  if (typeof valor === 'string') return valor;
  if (typeof valor === 'number' || typeof valor === 'bigint') return String(valor);
  if (valor instanceof PhpDecimal) return String(Number(valor.valor.toPrecision(14)));
  throw new Error('(string) de un array: "Array to string conversion" (500 en apipos)');
}

/** `(int)` de PHP para un valor de JSON. */
function enteroPhp(valor: PhpJson): number {
  if (valor instanceof PhpDecimal) return Math.trunc(valor.valor);
  if (valor instanceof Map) return valor.size > 0 ? 1 : 0;
  if (typeof valor === 'bigint') return Number(valor);
  return phpEntero(valor);
}

/**
 * Conversión de `{id}` a int que hace Laravel al llamar `detalle(int $id)`: un
 * texto numérico de PHP (con espacios, signo, decimales o exponente) se trunca;
 * cualquier otro produce un TypeError (500).
 */
export function idDeRuta(id: string): number {
  if (!/^\s*[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?\s*$/.test(id)) {
    throw new Error(`detalle(): Argument #1 ($id) must be of type int, string given`);
  }
  return Math.trunc(Number(id));
}

@Injectable()
export class DashboardsService {
  constructor(
    private readonly dashboards: DashboardsRepositorio,
    private readonly directorio: DirectorioUsuariosService,
  ) {}

  /**
   * Réplica de DashboardService::listarDashboards (apipos): dashboards propios
   * de `idUsuario` y los públicos.
   *
   * ⚠ Igual que en apipos, `idUsuario` viene del query string (`user_id`) y no
   * del dueño de la DOLAPIKEY: cualquier usuario autenticado puede listar los
   * dashboards privados de otro. Pendiente de revisar con el equipo.
   */
  async listar(
    idUsuario: number,
  ): Promise<{ total: number; dashboards: DashboardListadoLegado[] }> {
    const filas = await this.dashboards.visiblesPara(idUsuario);
    // apipos hace LEFT JOIN con llx_user; aquí los nombres los da el dominio auth.
    const autores =
      filas.length > 0
        ? await this.directorio.nombresPorIds(filas.map((d) => d.idAutor))
        : new Map<number, NombreUsuario>();

    const lista = filas.map((d) => {
      const autor = autores.get(d.idAutor);
      const nombreAutor = phpTrim(`${autor?.nombre ?? ''} ${autor?.apellido ?? ''}`);
      return {
        rowid: d.id,
        nombre: d.nombre,
        descripcion: d.descripcion ?? '',
        color_tema: phpVacio(d.colorTema) ? COLOR_POR_DEFECTO : (d.colorTema as string),
        icono: phpVacio(d.icono) ? ICONO_POR_DEFECTO : (d.icono as string),
        es_publico: d.esPublico,
        n_widgets: d.totalWidgets,
        date_creation: d.fechaCreacion,
        tms: d.tms,
        propia: d.idAutor === idUsuario,
        autor: nombreAutor !== '' ? nombreAutor : '—',
      };
    });
    return { total: lista.length, dashboards: lista };
  }

  /**
   * Réplica de DashboardService::obtenerDashboard (apipos): metadatos y tabs
   * (de tabs_json, con la cantidad de widgets de cada una, ordenadas por
   * `orden`). No existe → 404 { "error": "Dashboard no encontrado" }.
   */
  async detalle(id: number): Promise<DashboardDetalleLegado> {
    const d = await this.dashboards.porId(id);
    if (!d) {
      throw new HttpException({ error: 'Dashboard no encontrado' }, HttpStatus.NOT_FOUND);
    }
    return {
      rowid: d.id,
      nombre: d.nombre,
      descripcion: d.descripcion ?? '',
      color_tema: phpVacio(d.colorTema) ? COLOR_POR_DEFECTO : (d.colorTema as string),
      icono: phpVacio(d.icono) ? ICONO_POR_DEFECTO : (d.icono as string),
      es_publico: d.esPublico,
      fk_user_creat: d.idAutor,
      date_creation: d.fechaCreacion,
      tms: d.tms,
      tabs: await this.tabs(d),
    };
  }

  private async tabs(d: Dashboard): Promise<DashboardDetalleLegado['tabs']> {
    const definicion = phpJsonDecode(d.tabsJson ?? '');
    // is_array(): solo un array (lista u objeto) tiene tabs.
    if (!(definicion instanceof Map)) {
      return [];
    }
    const conteos = await this.dashboards.widgetsPorTab(d.id);
    const tabs = [...definicion.values()].map((t) => {
      const nombre = textoPhp(campo(t, 'nombre'));
      return {
        orden: enteroPhp(campo(t, 'orden')),
        nombre,
        total_widgets: conteos.get(nombre) ?? 0,
      };
    });
    // usort de PHP 8 es estable, igual que Array.prototype.sort.
    return tabs.sort((a, b) => a.orden - b.orden);
  }
}
