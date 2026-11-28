import type { NestExpressApplication } from '@nestjs/platform-express';
import { cifrarApiKeyDolibarr } from '@erp/dolibarr';
import type { UsuarioAutenticado } from '@erp/domain/auth';
import request from 'supertest';
// Solo en tests se importan archivos internos, para reemplazar el acceso a la base.
import { UsuariosRepositorio } from '../../../libs/domain/src/auth/usuarios.repositorio.js';
import { DashboardsRepositorio } from '../../../libs/domain/src/informes/dashboards.repositorio.js';
import { crearAppPrueba } from './crear-app.js';

const BASE = '/api/api.php/informes/dashboarddinamico/dashboards';
const API_KEY = 'ApiKeyGerente';
const USUARIO: UsuarioAutenticado = {
  id: 5,
  login: 'gerente',
  nombre: 'Juan',
  admin: true,
  entity: 1,
};

const DASH = {
  id: 3,
  nombre: 'Ventas diarias',
  descripcion: 'Resumen',
  colorTema: '#111',
  icono: 'fa-chart-bar',
  esPublico: 1,
  idAutor: 5,
  fechaCreacion: '2026-10-01 08:00:00',
  tms: '2026-11-20 10:00:00',
  tabsJson: '[{"orden":0,"nombre":"Ventas"}]',
};

const usuariosFalso = {
  buscarActivoPorApiKey: vi.fn(async ({ apiKeys }: { apiKeys: string[] }) =>
    apiKeys.includes(cifrarApiKeyDolibarr(API_KEY, 'clave-de-prueba')) ? USUARIO : null,
  ),
  nombresPorIds: vi.fn(async () => [{ id: 5, nombre: 'Juan', apellido: 'Pérez' }]),
};
const dashboardsFalso = {
  visiblesPara: vi.fn(async () => [{ ...DASH, totalWidgets: 2 }]),
  porId: vi.fn(async (id: number) => (id === 3 ? DASH : null)),
  widgetsPorTab: vi.fn(async () => new Map([['Ventas', 2]])),
};

describe('contrato apipos: /api/api.php/informes/dashboarddinamico/dashboards', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    app = await crearAppPrueba({
      reemplazos: [
        [UsuariosRepositorio, usuariosFalso],
        [DashboardsRepositorio, dashboardsFalso],
      ],
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it.each([BASE, `${BASE}/3`])('%s sin DOLAPIKEY → 401 Unauthenticated.', async (ruta) => {
    const res = await request(app.getHttpServer()).get(ruta).expect(401);
    expect(res.body).toEqual({ message: 'Unauthenticated.', requestId: expect.any(String) });
  });

  it('listado con user_id → 200', async () => {
    await request(app.getHttpServer())
      .get(`${BASE}?user_id=5`)
      .set('DOLAPIKEY', API_KEY)
      .expect(200)
      .expect({
        total: 1,
        dashboards: [
          {
            rowid: 3,
            nombre: 'Ventas diarias',
            descripcion: 'Resumen',
            color_tema: '#111',
            icono: 'fa-chart-bar',
            es_publico: 1,
            n_widgets: 2,
            date_creation: '2026-10-01 08:00:00',
            tms: '2026-11-20 10:00:00',
            propia: true,
            autor: 'Juan Pérez',
          },
        ],
      });
    expect(dashboardsFalso.visiblesPara).toHaveBeenCalledWith(5);
  });

  it('detalle → 200 con tabs', async () => {
    await request(app.getHttpServer())
      .get(`${BASE}/3`)
      .set('DOLAPIKEY', API_KEY)
      .expect(200)
      .expect({
        rowid: 3,
        nombre: 'Ventas diarias',
        descripcion: 'Resumen',
        color_tema: '#111',
        icono: 'fa-chart-bar',
        es_publico: 1,
        fk_user_creat: 5,
        date_creation: '2026-10-01 08:00:00',
        tms: '2026-11-20 10:00:00',
        tabs: [{ orden: 0, nombre: 'Ventas', total_widgets: 2 }],
      });
  });

  it('detalle inexistente → 404 { error: "Dashboard no encontrado" }', async () => {
    const res = await request(app.getHttpServer())
      .get(`${BASE}/9`)
      .set('DOLAPIKEY', API_KEY)
      .expect(404);
    expect(res.body).toEqual({ error: 'Dashboard no encontrado', requestId: expect.any(String) });
  });

  it('detalle con id no numérico → 500 (TypeError en apipos)', async () => {
    await request(app.getHttpServer()).get(`${BASE}/abc`).set('DOLAPIKEY', API_KEY).expect(500);
  });
});
