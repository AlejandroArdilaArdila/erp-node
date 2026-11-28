import type { NestExpressApplication } from '@nestjs/platform-express';
import { cifrarApiKeyDolibarr } from '@erp/dolibarr';
import type { UsuarioAutenticado } from '@erp/domain/auth';
import request from 'supertest';
// Solo en tests se importan archivos internos, para reemplazar el acceso a la base y al disco.
import { UsuariosRepositorio } from '../../../libs/domain/src/auth/usuarios.repositorio.js';
import { CarruselArchivos } from '../../../libs/domain/src/carrusel/carrusel.archivos.js';
import { CarruselRepositorio } from '../../../libs/domain/src/carrusel/carrusel.repositorio.js';
import { crearAppPrueba } from './crear-app.js';

const RUTA = '/api/api.php/integrospos/carrusel/activas';
const API_KEY = 'ApiKeyPriceChecker';
const USUARIO: UsuarioAutenticado = {
  id: 9,
  login: 'pricechecker',
  nombre: 'PC',
  admin: false,
  entity: 1,
};

const usuariosFalso = {
  buscarActivoPorApiKey: vi.fn(async ({ apiKeys }: { apiKeys: string[] }) =>
    apiKeys.includes(cifrarApiKeyDolibarr(API_KEY, 'clave-de-prueba')) ? USUARIO : null,
  ),
};
const carruselFalso = {
  vigentes: vi.fn(async () => [
    { id: 4, archivo: 'promo.png', label: 'Promo', desde: '2026-11-01', hasta: '2026-11-30' },
  ]),
};
const archivosFalso = { leer: vi.fn(async () => Buffer.from([1, 2, 3])) };

describe('contrato apipos: GET /api/api.php/integrospos/carrusel/activas', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    app = await crearAppPrueba({
      reemplazos: [
        [UsuariosRepositorio, usuariosFalso],
        [CarruselRepositorio, carruselFalso],
        [CarruselArchivos, archivosFalso],
      ],
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('sin DOLAPIKEY → 401 { message: "Unauthenticated." }', async () => {
    const res = await request(app.getHttpServer()).get(RUTA).expect(401);
    expect(res.body).toEqual({ message: 'Unauthenticated.', requestId: expect.any(String) });
  });

  it('200 con { total, imagenes }', async () => {
    await request(app.getHttpServer())
      .get(RUTA)
      .set('DOLAPIKEY', API_KEY)
      .expect(200)
      .expect({
        total: 1,
        imagenes: [
          {
            rowid: 4,
            label: 'Promo',
            date_start: '2026-11-01',
            date_end: '2026-11-30',
            imagen_base64: 'data:image/png;base64,AQID',
          },
        ],
      });
  });
});
