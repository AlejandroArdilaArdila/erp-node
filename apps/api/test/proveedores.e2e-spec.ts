import type { NestExpressApplication } from '@nestjs/platform-express';
import { cifrarApiKeyDolibarr } from '@erp/dolibarr';
import type { UsuarioAutenticado } from '@erp/domain/auth';
import request from 'supertest';
// Solo en tests se importan archivos internos, para reemplazar el acceso a la base.
import { UsuariosRepositorio } from '../../../libs/domain/src/auth/usuarios.repositorio.js';
import { TercerosRepositorio } from '../../../libs/domain/src/terceros/terceros.repositorio.js';
import { crearAppPrueba } from './crear-app.js';

const RUTA = '/api/api.php/integrosone/negociacion/proveedores';
const API_KEY = 'ApiKeyVendedor';
const USUARIO: UsuarioAutenticado = {
  id: 5,
  login: 'vendedor5',
  nombre: 'Juan',
  admin: false,
  entity: 1,
};

const usuariosFalso = {
  buscarActivoPorApiKey: vi.fn(async ({ apiKeys }: { apiKeys: string[] }) =>
    apiKeys.includes(cifrarApiKeyDolibarr(API_KEY, 'clave-de-prueba')) ? USUARIO : null,
  ),
};

const tercerosFalso = {
  proveedoresAsignados: vi.fn(async () => []),
  proveedoresActivos: vi.fn(async () => [
    { id: 3, nombre: 'Distribuidora', rif: '900123', telefono: null },
  ]),
};

describe('contrato apipos: GET /api/api.php/integrosone/negociacion/proveedores', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    app = await crearAppPrueba({
      reemplazos: [
        [UsuariosRepositorio, usuariosFalso],
        [TercerosRepositorio, tercerosFalso],
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

  it('200 con los proveedores; search y limit por query string', async () => {
    await request(app.getHttpServer())
      .get(`${RUTA}?search=dist&limit=10`)
      .set('DOLAPIKEY', API_KEY)
      .expect(200)
      .expect([{ id: 3, nombre: 'Distribuidora', rif: '900123', telefono: null }]);
    expect(tercerosFalso.proveedoresActivos).toHaveBeenCalledWith('dist', 10);
  });
});
