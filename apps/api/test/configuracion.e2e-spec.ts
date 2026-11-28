import type { NestExpressApplication } from '@nestjs/platform-express';
import { cifrarApiKeyDolibarr } from '@erp/dolibarr';
import type { UsuarioAutenticado } from '@erp/domain/auth';
import request from 'supertest';
// Solo en tests se importan archivos internos, para reemplazar el acceso a la base.
import { UsuariosRepositorio } from '../../../libs/domain/src/auth/usuarios.repositorio.js';
import { CatalogosRepositorio } from '../../../libs/domain/src/configuracion/catalogos.repositorio.js';
import { CiudadesRepositorio } from '../../../libs/domain/src/configuracion/ciudades.repositorio.js';
import type { Constante } from '../../../libs/domain/src/configuracion/constantes.repositorio.js';
import { ConstantesRepositorio } from '../../../libs/domain/src/configuracion/constantes.repositorio.js';
import { AlmacenesRepositorio } from '../../../libs/domain/src/inventario/almacenes.repositorio.js';
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

const ciudadesFalso = {
  departamentosActivos: vi.fn(async () => [
    { codigo: '05', nombre: 'Antioquia' },
    { codigo: '11', nombre: 'Bogotá, D.C.' },
  ]),
  ciudadesActivas: vi.fn(async () => [
    {
      id: 80,
      codigoDepartamento: '05',
      codigo: '05001',
      nombre: 'Medellin',
      codigoPostal: '050013',
    },
    {
      id: 169,
      codigoDepartamento: '11',
      codigo: '11001',
      nombre: 'Bogotá, D.C.',
      codigoPostal: '111511',
    },
  ]),
};

const catalogosFalso = {
  // serialize() de PHP 8.3 de ['options' => [1 => 'Abarrotes', 2 => 'Licores 1']]
  parametrosExtrafield: vi.fn(
    async () => 'a:1:{s:7:"options";a:2:{i:1;s:9:"Abarrotes";i:2;s:9:"Licores 1";}}',
  ),
  tarifasIvaActivas: vi.fn(async () => [
    { codigo: 'Excento', tarifa: 0, impuestoLocal1: '0', tipoImpuestoLocal1: '0' },
    { codigo: '19', tarifa: 19, impuestoLocal1: '0', tipoImpuestoLocal1: '0' },
  ]),
  unidadesPorTipo: vi.fn(async (tipo: string) =>
    tipo === 'weight' ? [{ escala: -3, abreviatura: 'g' }] : [{ escala: 98, abreviatura: 'L' }],
  ),
};

const almacenesFalso = {
  abiertos: vi.fn(async () => [
    { id: 6, nombre: 'Almacen Principal S1', idPadre: 1 },
    { id: 1, nombre: 'Sucursal Principal', idPadre: 0 },
  ]),
};

let filasConstantes: Constante[] = [];
const constantesFalso = { porNombres: vi.fn(async () => filasConstantes) };

describe('contrato apipos: configuración del POS', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    app = await crearAppPrueba({
      reemplazos: [
        [UsuariosRepositorio, usuariosFalso],
        [CiudadesRepositorio, ciudadesFalso],
        [ConstantesRepositorio, constantesFalso],
        [CatalogosRepositorio, catalogosFalso],
        [AlmacenesRepositorio, almacenesFalso],
      ],
    });
  });

  afterAll(async () => {
    await app.close();
  });

  describe.each([
    '/api/api.php/integrospos/customers/posapi/departamentos',
    '/api/api.php/integrospos/pos/update/check',
    '/api/api.php/integrospos/pos/getCategorieIva',
    '/api/api.php/integrospos/pos/almacenes/jerarquia',
  ])('%s', (ruta) => {
    it('sin DOLAPIKEY → 401 { message: "Unauthenticated." }', async () => {
      const res = await request(app.getHttpServer()).get(ruta).expect(401);
      expect(res.body).toEqual({ message: 'Unauthenticated.', requestId: expect.any(String) });
    });
  });

  describe('GET /api/api.php/integrospos/customers/posapi/departamentos', () => {
    it('200 con departamentos y ciudades (todo como texto)', async () => {
      await request(app.getHttpServer())
        .get('/api/api.php/integrospos/customers/posapi/departamentos')
        .set('DOLAPIKEY', API_KEY)
        .expect(200)
        .expect({
          departamentos: [
            { code_depto: '05', depto: 'Antioquia' },
            { code_depto: '11', depto: 'Bogotá, D.C.' },
          ],
          ciudades: [
            { rowid: '80', code_depto: '05', code: '05001', ciudad: 'Medellin', zip: '050013' },
            {
              rowid: '169',
              code_depto: '11',
              code: '11001',
              ciudad: 'Bogotá, D.C.',
              zip: '111511',
            },
          ],
        });
    });
  });

  describe('GET /api/api.php/integrospos/pos/update/check', () => {
    it('sin actualización configurada → 404 { message }', async () => {
      filasConstantes = [];
      const res = await request(app.getHttpServer())
        .get('/api/api.php/integrospos/pos/update/check')
        .set('DOLAPIKEY', API_KEY)
        .expect(404);
      expect(res.body).toEqual({
        message: 'No hay una actualización configurada',
        requestId: expect.any(String),
      });
    });

    it('con versión publicada → 200; la entidad 1 gana sobre la 0', async () => {
      filasConstantes = [
        { nombre: 'POS_UPDATE_VERSION', entidad: 0, valor: '4.4.50' },
        { nombre: 'POS_UPDATE_VERSION', entidad: 1, valor: '4.4.51' },
        { nombre: 'POS_UPDATE_BUILD', entidad: 1, valor: '404051' },
        { nombre: 'POS_UPDATE_CHANGELOG', entidad: 1, valor: '- Tirillas dinámicas' },
        { nombre: 'POS_UPDATE_FORZAR', entidad: 1, valor: '1' },
      ];
      await request(app.getHttpServer())
        .get('/api/api.php/integrospos/pos/update/check')
        .set('DOLAPIKEY', API_KEY)
        .expect(200)
        .expect({
          version: '4.4.51',
          build: 404051,
          changelog: '- Tirillas dinámicas',
          forzar: true,
          // POS_ACTUALIZACION_URL_BASE de setup-env.ts, sin la barra final
          windows_url: 'https://apipos.pruebas.test/pos.exe',
          linux_url: 'https://apipos.pruebas.test/pos.deb',
        });
    });
  });

  describe('GET /api/api.php/integrospos/pos/getCategorieIva', () => {
    it('200 con ivas, categorias, peso y volumen', async () => {
      await request(app.getHttpServer())
        .get('/api/api.php/integrospos/pos/getCategorieIva')
        .set('DOLAPIKEY', API_KEY)
        .expect(200)
        .expect({
          ivas: [
            { valor: '0', label: 'Excento' },
            { valor: '19', label: '19' },
          ],
          categorias: [
            { valor: '1', label: 'Abarrotes' },
            { valor: '2', label: 'Licores 1' },
          ],
          peso: [{ valor: '-3', label: 'g' }],
          volumen: [{ valor: '98', label: 'L' }],
        });
    });
  });

  describe('GET /api/api.php/integrospos/pos/almacenes/jerarquia', () => {
    it('200 con sucursales y sus almacenes hijos', async () => {
      await request(app.getHttpServer())
        .get('/api/api.php/integrospos/pos/almacenes/jerarquia')
        .set('DOLAPIKEY', API_KEY)
        .expect(200)
        .expect([
          {
            id: 1,
            nombre: 'Sucursal Principal',
            hijos: [{ id: 6, nombre: 'Almacen Principal S1' }],
          },
        ]);
    });
  });
});
