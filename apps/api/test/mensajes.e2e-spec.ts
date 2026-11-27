import type { NestExpressApplication } from '@nestjs/platform-express';
import { cifrarApiKeyDolibarr } from '@erp/dolibarr';
import type { UsuarioAutenticado } from '@erp/domain/auth';
import request from 'supertest';
// Solo en tests se importan archivos internos, para reemplazar el acceso a la base.
import { UsuariosRepositorio } from '../../../libs/domain/src/auth/usuarios.repositorio.js';
import type { MensajeChat } from '../../../libs/domain/src/mensajes/mensajes.repositorio.js';
import { MensajesRepositorio } from '../../../libs/domain/src/mensajes/mensajes.repositorio.js';
import { crearAppPrueba } from './crear-app.js';

const RUTA = '/api/api.php/integrosone/mensajes';
const API_KEY = 'ApiKeyVendedor';
const USUARIO: UsuarioAutenticado = {
  id: 5,
  login: 'vendedor5',
  nombre: 'Juan Pérez',
  admin: false,
  entity: 1,
};

const MENSAJES: MensajeChat[] = [
  {
    id: 10,
    idEmisor: 5,
    idReceptor: 8,
    mensaje: 'Hola, como vas con el pedido?',
    tipo: 'mensaje',
    fecha: '2026-07-16 10:23:45',
    leido: false,
  },
  {
    id: 11,
    idEmisor: 8,
    idReceptor: 0,
    mensaje: 'Reunión a las 3',
    tipo: 'mensaje',
    fecha: '2026-07-16 11:00:00',
    leido: true,
  },
];

const usuariosFalso = {
  buscarActivoPorApiKey: vi.fn(async ({ apiKeys }: { apiKeys: string[] }) =>
    apiKeys.includes(cifrarApiKeyDolibarr(API_KEY, 'clave-de-prueba')) ? USUARIO : null,
  ),
  nombresPorIds: vi.fn(async () => [
    { id: 5, nombre: 'Juan', apellido: 'Pérez' },
    { id: 8, nombre: 'Ana', apellido: 'Gómez' },
  ]),
};

const mensajesFalso = { deUsuario: vi.fn(async () => MENSAJES) };

describe('contrato apipos: POST /api/api.php/integrosone/mensajes', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    app = await crearAppPrueba({
      reemplazos: [
        [UsuariosRepositorio, usuariosFalso],
        [MensajesRepositorio, mensajesFalso],
      ],
    });
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    mensajesFalso.deUsuario.mockClear();
  });

  it('sin DOLAPIKEY → 401 { message: "Unauthenticated." }', async () => {
    const res = await request(app.getHttpServer()).post(RUTA).send({ user: 5 }).expect(401);
    expect(res.body).toEqual({ message: 'Unauthenticated.', requestId: expect.any(String) });
  });

  it('sin user → 401 { message: "El campo \'user\' es obligatorio." }', async () => {
    const res = await request(app.getHttpServer())
      .post(RUTA)
      .set('DOLAPIKEY', API_KEY)
      .send({})
      .expect(401);
    expect(res.body).toEqual({
      message: "El campo 'user' es obligatorio.",
      requestId: expect.any(String),
    });
    expect(mensajesFalso.deUsuario).not.toHaveBeenCalled();
  });

  it('con user → 200 con los mensajes y los nombres', async () => {
    await request(app.getHttpServer())
      .post(RUTA)
      .set('DOLAPIKEY', API_KEY)
      .send({ user: 5 })
      .expect(200)
      .expect([
        {
          rowid: 10,
          fk_user_from: 5,
          fk_user_to: 8,
          mensaje: 'Hola, como vas con el pedido?',
          tipo: 'mensaje',
          fecha: '2026-07-16 10:23:45',
          leido: false,
          nombre_from: 'Juan Pérez',
          nombre_to: 'Ana Gómez',
        },
        {
          rowid: 11,
          fk_user_from: 8,
          fk_user_to: 0,
          mensaje: 'Reunión a las 3',
          tipo: 'mensaje',
          fecha: '2026-07-16 11:00:00',
          leido: true,
          nombre_from: 'Ana Gómez',
          nombre_to: '',
        },
      ]);
    expect(mensajesFalso.deUsuario).toHaveBeenCalledWith(5, null);
  });

  it('con fecha → filtra por ese día', async () => {
    await request(app.getHttpServer())
      .post(RUTA)
      .set('DOLAPIKEY', API_KEY)
      .send({ user: '5', fecha: '2026-07-16' })
      .expect(200);
    expect(mensajesFalso.deUsuario).toHaveBeenCalledWith(5, '2026-07-16');
  });

  it('acepta los campos por query string y el cuerpo gana (como $request->input)', async () => {
    await request(app.getHttpServer())
      .post(`${RUTA}?user=9&fecha=2026-07-15`)
      .set('DOLAPIKEY', API_KEY)
      .send({ user: 5 })
      .expect(200);
    expect(mensajesFalso.deUsuario).toHaveBeenCalledWith(5, '2026-07-15');
  });

  it('acepta cuerpo de formulario (application/x-www-form-urlencoded)', async () => {
    await request(app.getHttpServer())
      .post(RUTA)
      .set('DOLAPIKEY', API_KEY)
      .type('form')
      .send('user=5')
      .expect(200);
    expect(mensajesFalso.deUsuario).toHaveBeenCalledWith(5, null);
  });
});
