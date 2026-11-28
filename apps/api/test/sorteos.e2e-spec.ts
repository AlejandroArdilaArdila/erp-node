import type { NestExpressApplication } from '@nestjs/platform-express';
import { cifrarApiKeyDolibarr } from '@erp/dolibarr';
import type { UsuarioAutenticado } from '@erp/domain/auth';
import request from 'supertest';
// Solo en tests se importan archivos internos, para reemplazar el acceso a la base.
import { UsuariosRepositorio } from '../../../libs/domain/src/auth/usuarios.repositorio.js';
import { SorteosRepositorio } from '../../../libs/domain/src/sorteos/sorteos.repositorio.js';
import { crearAppPrueba } from './crear-app.js';

const RUTA = '/api/api.php/integrospos/sorteos/getSorteos';
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

const sorteosFalso = {
  vigentes: vi.fn(async () => [
    {
      id: 4,
      descripcion: 'Sorteo navideño',
      premio: 'Televisor',
      fechaInicio: '2026-11-01',
      fechaFinal: '2026-12-24',
      compraMinimo: 50000,
      valorParticipacion: 50000,
      tipoCliente: 'todos',
      tipoCalculo: 'proporcional',
      observacion: null,
      permitirEntregarSinCtrl: 1,
      clientesJson: null,
      productosJson: '[101,102]',
    },
  ]),
  proximos: vi.fn(async () => []),
};

describe('contrato apipos: GET /api/api.php/integrospos/sorteos/getSorteos', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    app = await crearAppPrueba({
      reemplazos: [
        [UsuariosRepositorio, usuariosFalso],
        [SorteosRepositorio, sorteosFalso],
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

  it('200 con vigentes y próximos', async () => {
    await request(app.getHttpServer())
      .get(RUTA)
      .set('DOLAPIKEY', API_KEY)
      .expect(200)
      .expect({
        vigentes: [
          {
            rowid: 4,
            descripcion: 'Sorteo navideño',
            premio: 'Televisor',
            fecha_inicio: '01/11/2026',
            fecha_final: '24/12/2026',
            fecha_inicio_raw: '2026-11-01',
            fecha_final_raw: '2026-12-24',
            compra_minimo: 50000,
            valor_participacion: 50000,
            tipo_cliente: 'todos',
            tipo_calculo: 'proporcional',
            observacion: null,
            permitir_entregar_sin_ctrl: 1,
            fk_clientes: [],
            fk_productos: [101, 102],
          },
        ],
        proximos: [],
      });
  });

  // Diferencia general con apipos (no solo de esta ruta): ante un método no permitido
  // Laravel responde 405 y Nest responde 404. Los POS usan GET.
  it('POST → 404 (apipos responde 405)', async () => {
    await request(app.getHttpServer()).post(RUTA).set('DOLAPIKEY', API_KEY).expect(404);
  });
});
