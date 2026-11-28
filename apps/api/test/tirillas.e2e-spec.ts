import type { NestExpressApplication } from '@nestjs/platform-express';
import { cifrarApiKeyDolibarr } from '@erp/dolibarr';
import type { UsuarioAutenticado } from '@erp/domain/auth';
import request from 'supertest';
// Solo en tests se importan archivos internos, para reemplazar el acceso a la base.
import { UsuariosRepositorio } from '../../../libs/domain/src/auth/usuarios.repositorio.js';
import type { PlantillaTirilla } from '../../../libs/domain/src/tirillas/tirillas.repositorio.js';
import { TirillasRepositorio } from '../../../libs/domain/src/tirillas/tirillas.repositorio.js';
import { crearAppPrueba } from './crear-app.js';

const BASE = '/api/api.php/integrospos/tickettemplate';
const API_KEY = 'ApiKeyCajero';
const USUARIO: UsuarioAutenticado = {
  id: 7,
  login: 'cajero1',
  nombre: 'Ana',
  admin: false,
  entity: 1,
};

const PLANTILLA: PlantillaTirilla = {
  id: 1,
  nombre: 'factura_pos',
  label: 'Factura POS',
  // Claves numéricas fuera de orden y un decimal pequeño: JSON.stringify los cambiaría.
  configJson: '{"ancho":80,"9":"a","10":"b","margen":0.00001}',
  activo: 1,
  datoPreviewJson: null,
  columnas: 0,
  variablesJson: '["total"]',
};

const usuariosFalso = {
  buscarActivoPorApiKey: vi.fn(async ({ apiKeys }: { apiKeys: string[] }) =>
    apiKeys.includes(cifrarApiKeyDolibarr(API_KEY, 'clave-de-prueba')) ? USUARIO : null,
  ),
};

const tirillasFalso = {
  plantillas: vi.fn(async () => [PLANTILLA]),
  plantillaPorId: vi.fn(async (id: number) => (id === 1 ? PLANTILLA : null)),
  plantillaPorNombre: vi.fn(async (n: string) => (n === 'factura_pos' ? PLANTILLA : null)),
  secciones: vi.fn(async () => [
    { id: 1, nombre: 'enc', descripcion: 'Encabezado', elementosJson: '{"items":[]}' },
  ]),
  variables: vi.fn(async () => [{ id: 1, nombre: 'total', descripcion: 'Total', tipo: '' }]),
};

describe('contrato apipos: /api/api.php/integrospos/tickettemplate', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    app = await crearAppPrueba({
      reemplazos: [
        [UsuariosRepositorio, usuariosFalso],
        [TirillasRepositorio, tirillasFalso],
      ],
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it.each([
    ['post', `${BASE}/tipos`],
    ['post', `${BASE}/get`],
    ['post', `${BASE}/variables`],
    ['post', `${BASE}/secciones`],
    ['get', `${BASE}/1`],
  ] as const)('%s %s sin DOLAPIKEY → 401 Unauthenticated.', async (metodo, ruta) => {
    const res = await request(app.getHttpServer())[metodo](ruta).expect(401);
    expect(res.body).toEqual({ message: 'Unauthenticated.', requestId: expect.any(String) });
  });

  it('GET /{id} → texto JSON igual al de json_encode de PHP', async () => {
    const res = await request(app.getHttpServer())
      .get(`${BASE}/1`)
      .set('DOLAPIKEY', API_KEY)
      .expect(200)
      .expect('Content-Type', /application\/json/);
    expect(res.text).toBe(
      '{"rowid":1,"nombre":"factura_pos","label":"Factura POS","config":{"ancho":80,"9":"a","10":"b","margen":1.0e-5},"activo":1}',
    );
  });

  it('GET /null → lista de todas', async () => {
    const res = await request(app.getHttpServer())
      .get(`${BASE}/null`)
      .set('DOLAPIKEY', API_KEY)
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('GET /{id} inexistente → 401 { message: "Plantilla no encontrada" }', async () => {
    const res = await request(app.getHttpServer())
      .get(`${BASE}/99`)
      .set('DOLAPIKEY', API_KEY)
      .expect(401);
    expect(res.body).toEqual({ message: 'Plantilla no encontrada', requestId: expect.any(String) });
  });

  it('POST /get con nombre → 200 (dato_preview {} y columnas 80 por defecto)', async () => {
    const res = await request(app.getHttpServer())
      .post(`${BASE}/get`)
      .set('DOLAPIKEY', API_KEY)
      .send({ nombre: 'factura_pos' })
      .expect(200);
    expect(res.text).toBe(
      '{"rowid":1,"nombre":"factura_pos","label":"Factura POS","config":{"ancho":80,"9":"a","10":"b","margen":1.0e-5},"dato_preview":{},"columnas":80,"variables":["total"]}',
    );
  });

  it('POST /get sin nombre → 401 { message: "nombre requerido" }', async () => {
    const res = await request(app.getHttpServer())
      .post(`${BASE}/get`)
      .set('DOLAPIKEY', API_KEY)
      .send({})
      .expect(401);
    expect(res.body).toEqual({ message: 'nombre requerido', requestId: expect.any(String) });
  });

  it('POST /tipos, /variables y /secciones → 200', async () => {
    const servidor = app.getHttpServer();
    const tipos = await request(servidor).post(`${BASE}/tipos`).set('DOLAPIKEY', API_KEY);
    expect(tipos.status).toBe(200);
    expect(tipos.text).toBe(
      '{"tipos":[{"rowid":1,"nombre":"factura_pos","label":"Factura POS","activo":1}]}',
    );
    const variables = await request(servidor).post(`${BASE}/variables`).set('DOLAPIKEY', API_KEY);
    expect(variables.text).toBe(
      '{"variables":[{"rowid":1,"nombre":"total","descripcion":"Total","tipo":"string"}]}',
    );
    const secciones = await request(servidor).post(`${BASE}/secciones`).set('DOLAPIKEY', API_KEY);
    expect(secciones.text).toBe(
      '{"secciones":[{"rowid":1,"nombre":"enc","descripcion":"Encabezado","elementos":[],"condicional":null,"repeat":null}]}',
    );
  });
});
