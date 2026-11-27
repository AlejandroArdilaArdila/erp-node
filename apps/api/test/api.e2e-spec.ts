import { Controller, Get, Module, UseGuards } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { cifrarApiKeyDolibarr } from '@erp/dolibarr';
import { ApiKeyGuard, AuthModule, UsuarioActual, type UsuarioAutenticado } from '@erp/domain/auth';
import request from 'supertest';
// Solo en tests se importa un archivo interno, para reemplazar el acceso a la base.
import { UsuariosRepositorio } from '../../../libs/domain/src/auth/usuarios.repositorio.js';
import { crearAppPrueba } from './crear-app.js';

const API_KEY_VALIDA = 'ApiKeyDePrueba123';
const USUARIO: UsuarioAutenticado = {
  id: 7,
  login: 'cajero1',
  nombre: 'Ana Pérez',
  admin: false,
  entity: 1,
};

/** Repositorio falso: conoce una sola api_key, guardada cifrada como en Dolibarr. */
const repoFalso = {
  buscarActivoPorApiKey: vi.fn(async ({ apiKeys }: { apiKeys: string[] }) =>
    apiKeys.includes(cifrarApiKeyDolibarr(API_KEY_VALIDA, 'clave-de-prueba')) ? USUARIO : null,
  ),
};

@Controller('prueba')
class ControladorProtegido {
  @Get('protegida')
  @UseGuards(ApiKeyGuard)
  protegida(@UsuarioActual() usuario: UsuarioAutenticado) {
    return { login: usuario.login };
  }
}

@Module({ imports: [AuthModule], controllers: [ControladorProtegido] })
class ModuloPrueba {}

describe('API (e2e)', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    app = await crearAppPrueba({
      reemplazos: [[UsuariosRepositorio, repoFalso]],
      imports: [ModuloPrueba],
    });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('contrato apipos: GET /api/api.php/integrospos/pos/ping', () => {
    it('responde { ok: true }', async () => {
      await request(app.getHttpServer())
        .get('/api/api.php/integrospos/pos/ping')
        .expect(200)
        .expect({ ok: true });
    });

    it('acepta barra final como apipos (TrimTrailingSlash)', async () => {
      await request(app.getHttpServer())
        .get('/api/api.php/integrospos/pos/ping/')
        .expect(200)
        .expect({ ok: true });
    });
  });

  describe('contrato apipos: POST /api/custom/integrospos/validateApiKey', () => {
    it('sin header → APIKEY requerida (200)', async () => {
      await request(app.getHttpServer())
        .post('/api/custom/integrospos/validateApiKey')
        .expect(200)
        .expect({ ok: false, error: 'APIKEY requerida' });
    });

    it('api_key inválida → APIKEY inválida (200)', async () => {
      await request(app.getHttpServer())
        .post('/api/custom/integrospos/validateApiKey')
        .set('DOLAPIKEY', 'otra')
        .expect(200)
        .expect({ ok: false, error: 'APIKEY inválida' });
    });

    it('api_key válida (guardada cifrada) → datos del usuario', async () => {
      await request(app.getHttpServer())
        .post('/api/custom/integrospos/validateApiKey')
        .set('DOLAPIKEY', API_KEY_VALIDA)
        .expect(200)
        .expect({ ok: true, user: { id: 7, login: 'cajero1', nombre: 'Ana Pérez', admin: 0 } });
    });
  });

  describe('ApiKeyGuard', () => {
    it('sin DOLAPIKEY → 401 { message: "Unauthenticated." } como Laravel', async () => {
      const res = await request(app.getHttpServer()).get('/api/prueba/protegida').expect(401);
      expect(res.body).toMatchObject({ message: 'Unauthenticated.' });
      expect(res.body.requestId).toEqual(expect.any(String));
      expect(res.headers['x-request-id']).toBe(res.body.requestId);
    });

    it('con DOLAPIKEY válida → entrega el usuario al controlador', async () => {
      await request(app.getHttpServer())
        .get('/api/prueba/protegida')
        .set('DOLAPIKEY', API_KEY_VALIDA)
        .expect(200)
        .expect({ login: 'cajero1' });
    });
  });

  describe('errores', () => {
    it('ruta inexistente → 404 con { message }', async () => {
      const res = await request(app.getHttpServer()).get('/api/no-existe').expect(404);
      expect(res.body).toEqual({ message: expect.any(String), requestId: expect.any(String) });
    });
  });

  describe('documentación Swagger', () => {
    it.each(['/api/docs', '/api/docs-json'])(
      '%s sin credenciales → 401 y pide login',
      async (ruta) => {
        const res = await request(app.getHttpServer()).get(ruta).expect(401);
        expect(res.headers['www-authenticate']).toContain('Basic');
      },
    );

    it('credenciales incorrectas → 401', async () => {
      await request(app.getHttpServer())
        .get('/api/docs-json')
        .auth('equipo', 'otra-clave')
        .expect(401);
    });

    it('credenciales correctas → documentación con los endpoints portados', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/docs-json')
        .auth('equipo', 'clave-docs-de-prueba-123')
        .expect(200);
      expect(Object.keys(res.body.paths)).toContain('/api/custom/integrospos/validateApiKey');
    });
  });

  describe('seguridad de errores', () => {
    let appSinReemplazos: NestExpressApplication;

    beforeAll(async () => {
      appSinReemplazos = await crearAppPrueba(); // repositorio real → la base no responde
    });

    afterAll(async () => {
      await appSinReemplazos.close();
    });

    it('un error de base de datos NO devuelve los parámetros de la consulta', async () => {
      const secreto = 'api-key-que-no-debe-filtrarse';
      const res = await request(appSinReemplazos.getHttpServer())
        .post('/api/custom/integrospos/validateApiKey')
        .set('DOLAPIKEY', secreto)
        .expect(500);
      expect(JSON.stringify(res.body)).not.toContain(secreto);
      expect(res.body.requestId).toEqual(expect.any(String));
    });
  });

  describe('salud', () => {
    it('GET /api/health → vivo sin tocar la base', async () => {
      await request(app.getHttpServer()).get('/api/health').expect(200).expect({ ok: true });
    });

    it('GET /api/health/ready → 503 si la base no responde', async () => {
      const res = await request(app.getHttpServer()).get('/api/health/ready').expect(503);
      expect(res.body.ok).toBe(false);
      expect(res.body.baseDatos.legado.ok).toBe(false);
    });
  });
});
