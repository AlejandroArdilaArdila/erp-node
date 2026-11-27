import type { NestExpressApplication } from '@nestjs/platform-express';
import { cifrarApiKeyDolibarr } from '@erp/dolibarr';
import type { UsuarioAutenticado } from '@erp/domain/auth';
import request from 'supertest';
// Solo en tests se importan archivos internos, para reemplazar el acceso a la base.
import type { PermisoDolibarr } from '../../../libs/domain/src/auth/permisos.repositorio.js';
import { PermisosRepositorio } from '../../../libs/domain/src/auth/permisos.repositorio.js';
import { UsuariosRepositorio } from '../../../libs/domain/src/auth/usuarios.repositorio.js';
import { CategoriasRepositorio } from '../../../libs/domain/src/productos/categorias.repositorio.js';
import { crearAppPrueba } from './crear-app.js';

const RUTA = '/api/api.php/integrosone/productos/categorias';
const API_KEY_CON_PERMISO = 'ApiKeyConPermiso';
const API_KEY_SIN_PERMISO = 'ApiKeySinPermiso';

const usuario = (id: number): UsuarioAutenticado => ({
  id,
  login: `usuario${id}`,
  nombre: 'Usuario',
  admin: false,
  entity: 1,
});

/** api_key cifrada → usuario. El 7 tiene `lire` por grupo; el 8 no tiene permisos. */
const usuariosPorApiKey = new Map([
  [cifrarApiKeyDolibarr(API_KEY_CON_PERMISO, 'clave-de-prueba'), usuario(7)],
  [cifrarApiKeyDolibarr(API_KEY_SIN_PERMISO, 'clave-de-prueba'), usuario(8)],
]);

const usuariosFalso = {
  buscarActivoPorApiKey: vi.fn(
    async ({ apiKeys }: { apiKeys: string[] }) =>
      apiKeys.map((k) => usuariosPorApiKey.get(k)).find(Boolean) ?? null,
  ),
};

const permisosFalso = {
  directos: vi.fn(async (): Promise<PermisoDolibarr[]> => []),
  porGrupos: vi.fn(async (idUsuario: number): Promise<PermisoDolibarr[]> =>
    idUsuario === 7 ? [{ perms: 'lire', subperms: '' }] : [],
  ),
};

const categoriasFalso = {
  deProductoConTotales: vi.fn(async () => [
    {
      id: 12,
      nombre: 'Bebidas',
      descripcion: 'Gaseosas, jugos y aguas',
      color: '3399CC',
      idPadre: 0,
      totalProductos: 45,
    },
    { id: 13, nombre: 'Jugos', descripcion: null, color: null, idPadre: 12, totalProductos: 0 },
  ]),
};

describe('contrato apipos: GET /api/api.php/integrosone/productos/categorias', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    app = await crearAppPrueba({
      reemplazos: [
        [UsuariosRepositorio, usuariosFalso],
        [PermisosRepositorio, permisosFalso],
        [CategoriasRepositorio, categoriasFalso],
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

  it('DOLAPIKEY inválida → 401 { message: "Unauthenticated." }', async () => {
    const res = await request(app.getHttpServer()).get(RUTA).set('DOLAPIKEY', 'otra').expect(401);
    expect(res.body).toEqual({ message: 'Unauthenticated.', requestId: expect.any(String) });
  });

  it('usuario sin permiso lire → 401 { message: "Sin permisos" }', async () => {
    const res = await request(app.getHttpServer())
      .get(RUTA)
      .set('DOLAPIKEY', API_KEY_SIN_PERMISO)
      .expect(401);
    expect(res.body).toEqual({ message: 'Sin permisos', requestId: expect.any(String) });
    expect(categoriasFalso.deProductoConTotales).not.toHaveBeenCalled();
  });

  it('usuario con permiso → 200 con el arreglo de categorías', async () => {
    await request(app.getHttpServer())
      .get(RUTA)
      .set('DOLAPIKEY', API_KEY_CON_PERMISO)
      .expect(200)
      .expect([
        {
          rowid: 12,
          label: 'Bebidas',
          description: 'Gaseosas, jugos y aguas',
          color: '3399CC',
          fk_parent: 0,
          total_productos: 45,
        },
        {
          rowid: 13,
          label: 'Jugos',
          description: null,
          color: null,
          fk_parent: 12,
          total_productos: 0,
        },
      ]);
    expect(categoriasFalso.deProductoConTotales).toHaveBeenCalledWith(1);
  });

  it('acepta barra final como apipos (TrimTrailingSlash)', async () => {
    await request(app.getHttpServer())
      .get(`${RUTA}/`)
      .set('DOLAPIKEY', API_KEY_CON_PERMISO)
      .expect(200);
  });
});
