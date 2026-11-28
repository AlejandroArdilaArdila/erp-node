import type { NestExpressApplication } from '@nestjs/platform-express';
import { cifrarApiKeyDolibarr } from '@erp/dolibarr';
import type { UsuarioAutenticado } from '@erp/domain/auth';
import request from 'supertest';
// Solo en tests se importan archivos internos, para reemplazar el acceso a la base.
import { UsuariosRepositorio } from '../../../libs/domain/src/auth/usuarios.repositorio.js';
import { RegistrosPosRepositorio } from '../../../libs/domain/src/pos/registros-pos.repositorio.js';
import { crearAppPrueba } from './crear-app.js';

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
const registrosFalso = {
  insertarErrorEndpoint: vi.fn(async () => undefined),
  insertarAuditoria: vi.fn(async () => undefined),
};

describe('contrato apipos: registros del POS', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    app = await crearAppPrueba({
      reemplazos: [
        [UsuariosRepositorio, usuariosFalso],
        [RegistrosPosRepositorio, registrosFalso],
      ],
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it.each([
    '/api/api.php/integrospos/logs/registrarErrorEndpoint',
    '/api/api.php/integrospos/pos/auditoria',
  ])('%s sin DOLAPIKEY → 401 Unauthenticated.', async (ruta) => {
    const res = await request(app.getHttpServer()).post(ruta).send({}).expect(401);
    expect(res.body).toEqual({ message: 'Unauthenticated.', requestId: expect.any(String) });
  });

  it('registrarErrorEndpoint → 201 { ok: true }', async () => {
    await request(app.getHttpServer())
      .post('/api/api.php/integrospos/logs/registrarErrorEndpoint')
      .set('DOLAPIKEY', API_KEY)
      .send({
        metodo: 'get',
        url: ' /api/x ',
        status_code: '404',
        fecha: '2026-11-28T10:15:30',
        deviceid: 'CAJA01',
      })
      .expect(201)
      .expect({ ok: true });
    expect(registrosFalso.insertarErrorEndpoint).toHaveBeenCalledWith(
      expect.objectContaining({
        metodo: 'GET',
        url: '/api/x',
        statusCode: 404,
        fechaCliente: '2026-11-28 10:15:30',
        deviceid: 'CAJA01',
      }),
    );
  });

  it('registrarErrorEndpoint sin metodo → 401 { message }', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/api.php/integrospos/logs/registrarErrorEndpoint')
      .set('DOLAPIKEY', API_KEY)
      .send({ url: '/x', status_code: 500, fecha: '2026-11-28' })
      .expect(401);
    expect(res.body).toEqual({
      message: "El campo 'metodo' es obligatorio.",
      requestId: expect.any(String),
    });
  });

  it('auditoria → 201 { ok: true, id }', async () => {
    await request(app.getHttpServer())
      .post('/api/api.php/integrospos/pos/auditoria')
      .set('DOLAPIKEY', API_KEY)
      .send({
        id: 55,
        modulo: 'ventas',
        accion: 'anular',
        entidad_tipo: 'cotizacion',
        fecha: '2026-11-28 10:15:30.123',
      })
      .expect(201)
      .expect({ ok: true, id: 55 });
    expect(registrosFalso.insertarAuditoria).toHaveBeenCalledWith(
      expect.objectContaining({ idLocal: 55, fechaEvento: '2026-11-28 10:15:30.123000' }),
    );
  });

  it('auditoria con fecha inválida → 401 { message }', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/api.php/integrospos/pos/auditoria')
      .set('DOLAPIKEY', API_KEY)
      .send({ modulo: 'v', accion: 'a', entidad_tipo: 'e', fecha: 'mañana' })
      .expect(401);
    expect(res.body).toEqual({
      message: "El campo 'fecha' no es una fecha valida.",
      requestId: expect.any(String),
    });
  });
});
