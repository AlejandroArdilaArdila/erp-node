import type { NestExpressApplication } from '@nestjs/platform-express';
import { ApiKeyService, SesionPosService } from '@erp/domain/auth';
import request from 'supertest';
import { crearAppPrueba } from './crear-app.js';

const USUARIO = { id: 7, login: 'cajero1', nombre: 'Ana', admin: false, entity: 1 };

/** Servicio falso: aquí se prueba la capa HTTP; la lógica tiene sus tests unitarios. */
const sesiones = {
  login: vi.fn(async () => ({ status: 200, cuerpo: { access_token: 'abc' } })),
  refresh: vi.fn(async () => ({
    status: 401,
    cuerpo: { message: 'Refresh token inválido o expirado.' },
  })),
  usuarioDeToken: vi.fn(async (t: string) =>
    t === 'token-bueno' ? { usuario: USUARIO, idToken: 1 } : null,
  ),
  perfil: vi.fn(async () => ({ rowid: 7, login: 'cajero1' })),
  logout: vi.fn(async () => ({ status: 200, cuerpo: { success: true } })),
  registrarActividad: vi.fn(async () => ({ status: 200, cuerpo: { success: true } })),
};
const apiKeys = {
  usuarioPorApiKey: vi.fn(async (k: string) => (k === 'clave-buena' ? USUARIO : null)),
  validar: vi.fn(),
};

describe('Sesión POS (e2e, contrato HTTP de apipos)', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    app = await crearAppPrueba({
      reemplazos: [
        [SesionPosService, sesiones],
        [ApiKeyService, apiKeys],
      ],
    });
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => vi.clearAllMocks());

  it.each([
    ['application/json', '{"login":"a"}'],
    ['text/plain', '{"login":"a"}'],
    ['application/json', '{login: roto'],
  ])('login.php entrega el cuerpo CRUDO al servicio (%s)', async (tipo, cuerpo) => {
    await request(app.getHttpServer())
      .post('/api/custom/integrospos/login.php')
      .set('Content-Type', tipo)
      .send(cuerpo)
      .expect(200)
      .expect({ access_token: 'abc' });
    expect(sesiones.login).toHaveBeenCalledWith(cuerpo, expect.any(String));
  });

  it('login.php sin cuerpo → el servicio recibe cadena vacía', async () => {
    await request(app.getHttpServer()).post('/api/custom/integrospos/login.php').expect(200);
    expect(sesiones.login).toHaveBeenCalledWith('', expect.any(String));
  });

  it('refresh: reenvía status y cuerpo del servicio', async () => {
    await request(app.getHttpServer())
      .post('/api/custom/integrospos/refresh')
      .send({ refresh_token: 'x' })
      .expect(401)
      .expect({ message: 'Refresh token inválido o expirado.' });
    expect(sesiones.refresh).toHaveBeenCalledWith({ refresh_token: 'x' });
  });

  it('refresh con JSON mal formado → 400 (no 500)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/custom/integrospos/refresh')
      .set('Content-Type', 'application/json')
      .send('{roto')
      .expect(400);
    expect(res.body.message).toBe('El cuerpo de la petición no es un JSON válido.');
  });

  it('me: sin token o con token inválido → 401 Unauthenticated.', async () => {
    for (const auth of [undefined, 'Bearer token-malo']) {
      const req = request(app.getHttpServer()).get('/api/custom/integrospos/me');
      const res = await (auth ? req.set('Authorization', auth) : req).expect(401);
      expect(res.body.message).toBe('Unauthenticated.');
    }
  });

  it('me: con token válido → perfil del usuario', async () => {
    await request(app.getHttpServer())
      .get('/api/custom/integrospos/me')
      .set('Authorization', 'Bearer token-bueno')
      .expect(200)
      .expect({ rowid: 7, login: 'cajero1' });
    expect(sesiones.perfil).toHaveBeenCalledWith(7);
  });

  it('logout: pasa Bearer, access_token del cuerpo y DOLAPIKEY al servicio', async () => {
    await request(app.getHttpServer())
      .post('/api/custom/integrospos/logout')
      .set('Authorization', 'Bearer t1')
      .set('DOLAPIKEY', 'k1')
      .send({ access_token: 't2' })
      .expect(200);
    expect(sesiones.logout).toHaveBeenCalledWith({
      bearer: 't1',
      accessTokenCampo: 't2',
      apiKey: 'k1',
    });
  });

  it('integrosTokenOpen: sin DOLAPIKEY → 401 Unauthenticated. (middleware auth:apikey)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/api.php/integrospos/terminales/integrosTokenOpen')
      .send({ device_id: 'caja-1' })
      .expect(401);
    expect(res.body.message).toBe('Unauthenticated.');
    expect(sesiones.registrarActividad).not.toHaveBeenCalled();
  });

  it('integrosTokenOpen: con DOLAPIKEY → une query y cuerpo (como $request->all())', async () => {
    await request(app.getHttpServer())
      .post('/api/api.php/integrospos/terminales/integrosTokenOpen?version=1&device_id=q')
      .set('DOLAPIKEY', 'clave-buena')
      .send({ device_id: 'caja-1' })
      .expect(200);
    expect(sesiones.registrarActividad).toHaveBeenCalledWith(USUARIO, {
      version: '1',
      device_id: 'caja-1',
    });
  });
});
