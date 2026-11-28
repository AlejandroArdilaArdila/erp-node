import type { NestExpressApplication } from '@nestjs/platform-express';
import { cifrarApiKeyDolibarr } from '@erp/dolibarr';
import type { UsuarioAutenticado } from '@erp/domain/auth';
import request from 'supertest';
// Solo en tests se importan archivos internos, para reemplazar el acceso a la base.
import { UsuariosRepositorio } from '../../../libs/domain/src/auth/usuarios.repositorio.js';
import { CodigosOperativosRepositorio } from '../../../libs/domain/src/productos/codigos-operativos.repositorio.js';
import { crearAppPrueba } from './crear-app.js';

const RUTA = '/api/api.php/integrospos/products/codigosOperativos';
const API_KEY = 'ApiKeyCajero';
const USUARIO: UsuarioAutenticado = {
  id: 7,
  login: 'cajero1',
  nombre: 'Ana',
  admin: false,
  entity: 1,
};

const usuariosFalso = {
  buscarActivoPorApiKey: vi.fn(async ({ apiKeys }: { apiKeys: string[] }) =>
    apiKeys.includes(cifrarApiKeyDolibarr(API_KEY, 'clave-de-prueba')) ? USUARIO : null,
  ),
};

const codigosFalso = {
  activos: vi.fn(async () => [
    {
      id: 3,
      codigo: 'DESC10',
      idProducto: 50,
      descuento: 1,
      refProducto: 'SRV-DESC',
      nombreProducto: 'Descuento 10%',
      tipoProducto: 1,
      fechaCreacion: '2026-08-01 09:15:00',
    },
    {
      id: 2,
      codigo: 'BOLSA',
      idProducto: 51,
      descuento: null,
      refProducto: 'BOL-01',
      nombreProducto: 'Bolsa',
      tipoProducto: 0,
      fechaCreacion: '2026-07-01 08:00:00',
    },
  ]),
};

describe('contrato apipos: GET /api/api.php/integrospos/products/codigosOperativos', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    app = await crearAppPrueba({
      reemplazos: [
        [UsuariosRepositorio, usuariosFalso],
        [CodigosOperativosRepositorio, codigosFalso],
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

  it('200 con los códigos operativos activos', async () => {
    await request(app.getHttpServer())
      .get(RUTA)
      .set('DOLAPIKEY', API_KEY)
      .expect(200)
      .expect([
        {
          rowid: 3,
          codigo: 'DESC10',
          fk_product: 50,
          descuento: 1,
          ref: 'SRV-DESC',
          label: 'Descuento 10%',
          tipo: 'Servicio',
          date_creation: '2026-08-01 09:15:00',
        },
        {
          rowid: 2,
          codigo: 'BOLSA',
          fk_product: 51,
          descuento: null,
          ref: 'BOL-01',
          label: 'Bolsa',
          tipo: 'Producto',
          date_creation: '2026-07-01 08:00:00',
        },
      ]);
  });
});
