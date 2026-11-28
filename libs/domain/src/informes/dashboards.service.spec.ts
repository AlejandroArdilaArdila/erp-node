import { HttpException } from '@nestjs/common';
import type { DirectorioUsuariosService } from '@erp/domain/auth';
import type {
  Dashboard,
  DashboardConWidgets,
  DashboardsRepositorio,
} from './dashboards.repositorio.js';
import { DashboardsService, idDeRuta } from './dashboards.service.js';

const BASE: Dashboard = {
  id: 3,
  nombre: 'Ventas diarias',
  descripcion: null,
  colorTema: null,
  icono: '',
  esPublico: 0,
  idAutor: 5,
  fechaCreacion: '2026-10-01 08:00:00',
  tms: '2026-11-20 10:00:00',
  tabsJson: null,
};

function crear({
  visibles = [] as DashboardConWidgets[],
  dashboard = null as Dashboard | null,
  conteos = new Map<string, number>(),
} = {}) {
  const repo = {
    visiblesPara: vi.fn().mockResolvedValue(visibles),
    porId: vi.fn().mockResolvedValue(dashboard),
    widgetsPorTab: vi.fn().mockResolvedValue(conteos),
  };
  const directorio = {
    nombresPorIds: vi
      .fn()
      .mockResolvedValue(new Map([[5, { id: 5, nombre: 'Juan', apellido: 'Pérez' }]])),
  };
  const servicio = new DashboardsService(
    repo as unknown as DashboardsRepositorio,
    directorio as unknown as DirectorioUsuariosService,
  );
  return { servicio, repo, directorio };
}

describe('DashboardsService.listar (réplica de listarDashboards)', () => {
  it('valores por defecto, propia y autor', async () => {
    const { servicio, repo } = crear({
      visibles: [
        { ...BASE, totalWidgets: 4 },
        { ...BASE, id: 4, idAutor: 99, esPublico: 1, colorTema: '#000', totalWidgets: 0 },
      ],
    });

    await expect(servicio.listar(5)).resolves.toEqual({
      total: 2,
      dashboards: [
        {
          rowid: 3,
          nombre: 'Ventas diarias',
          descripcion: '',
          color_tema: '#6d28d9',
          icono: 'fa-chart-line',
          es_publico: 0,
          n_widgets: 4,
          date_creation: '2026-10-01 08:00:00',
          tms: '2026-11-20 10:00:00',
          propia: true,
          autor: 'Juan Pérez',
        },
        expect.objectContaining({ rowid: 4, color_tema: '#000', propia: false, autor: '—' }),
      ],
    });
    expect(repo.visiblesPara).toHaveBeenCalledWith(5);
  });

  it('sin dashboards → no consulta usuarios', async () => {
    const { servicio, directorio } = crear();
    await expect(servicio.listar(0)).resolves.toEqual({ total: 0, dashboards: [] });
    expect(directorio.nombresPorIds).not.toHaveBeenCalled();
  });
});

describe('DashboardsService.detalle (réplica de obtenerDashboard)', () => {
  it('no existe → 404 { error: "Dashboard no encontrado" }', async () => {
    const { servicio } = crear();
    const error = await servicio.detalle(9).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).getStatus()).toBe(404);
    expect((error as HttpException).getResponse()).toEqual({ error: 'Dashboard no encontrado' });
  });

  /** Vectores de PHP 8.3 con tabsDelDashboard() y conteos { Ventas: 5, Clientes: 2, "5": 9 }. */
  it.each([
    [
      '[{"orden":2,"nombre":"Clientes"},{"orden":0,"nombre":"Ventas"},{"orden":1,"nombre":"Ventas"}]',
      [
        { orden: 0, nombre: 'Ventas', total_widgets: 5 },
        { orden: 1, nombre: 'Ventas', total_widgets: 5 },
        { orden: 2, nombre: 'Clientes', total_widgets: 2 },
      ],
    ],
    [
      '{"a":{"orden":"3x","nombre":5},"b":"texto","c":7}',
      [
        { orden: 0, nombre: '', total_widgets: 0 },
        { orden: 0, nombre: '', total_widgets: 0 },
        { orden: 3, nombre: '5', total_widgets: 9 },
      ],
    ],
    ['basura', []],
    ['', []],
    ['"texto"', []],
    ['[]', []],
  ])('tabs_json %j → tabs como PHP', async (tabsJson, tabs) => {
    const { servicio } = crear({
      dashboard: { ...BASE, tabsJson },
      conteos: new Map([
        ['Ventas', 5],
        ['Clientes', 2],
        ['5', 9],
      ]),
    });
    await expect(servicio.detalle(3)).resolves.toMatchObject({
      rowid: 3,
      color_tema: '#6d28d9',
      icono: 'fa-chart-line',
      fk_user_creat: 5,
      tabs,
    });
  });
});

describe('idDeRuta (int $id de Laravel)', () => {
  it.each([
    ['5', 5],
    [' 5 ', 5],
    ['+7', 7],
    ['5.9', 5],
    ['1e2', 100],
  ])('%j → %s', (id, esperado) => {
    expect(idDeRuta(id)).toBe(esperado);
  });

  it.each(['abc', '5abc', ''])('%j → error (TypeError en PHP, 500)', (id) => {
    expect(() => idDeRuta(id)).toThrow();
  });
});
