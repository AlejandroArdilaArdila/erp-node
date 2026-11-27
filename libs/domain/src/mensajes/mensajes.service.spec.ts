import { HttpException } from '@nestjs/common';
import type { DirectorioUsuariosService, NombreUsuario } from '@erp/domain/auth';
import type { MensajeChat, MensajesRepositorio } from './mensajes.repositorio.js';
import { MensajesService } from './mensajes.service.js';

const MENSAJE: MensajeChat = {
  id: 10,
  idEmisor: 5,
  idReceptor: 8,
  mensaje: 'Hola, como vas con el pedido?',
  tipo: 'mensaje',
  fecha: '2026-07-16 10:23:45',
  leido: false,
};

function crear(mensajes: MensajeChat[] = [], usuarios: NombreUsuario[] = []) {
  const repo = { deUsuario: vi.fn().mockResolvedValue(mensajes) };
  const directorio = {
    nombresPorIds: vi.fn().mockResolvedValue(new Map(usuarios.map((u) => [u.id, u]))),
  };
  const servicio = new MensajesService(
    repo as unknown as MensajesRepositorio,
    directorio as unknown as DirectorioUsuariosService,
  );
  return { servicio, repo, directorio };
}

async function errorDe(promesa: Promise<unknown>): Promise<HttpException> {
  const error = await promesa.catch((e: unknown) => e);
  expect(error).toBeInstanceOf(HttpException);
  return error as HttpException;
}

describe('MensajesService.listar (réplica de MensajeService::getMensajes)', () => {
  it.each([
    ['sin user', {}],
    ['user 0', { user: 0 }],
    ['user negativo', { user: -3 }],
    ['user no numérico', { user: 'abc' }],
    ['user vacío', { user: '' }],
    ['user null', { user: null }],
  ])('%s → 401 { message: "El campo \'user\' es obligatorio." }', async (_caso, entrada) => {
    const { servicio, repo } = crear();
    const error = await errorDe(servicio.listar(entrada));
    expect(error.getStatus()).toBe(401);
    expect(error.getResponse()).toEqual({ message: "El campo 'user' es obligatorio." });
    expect(repo.deUsuario).not.toHaveBeenCalled();
  });

  it.each([
    ['número', 5, 5],
    ['texto', '5', 5],
    ['decimal (se trunca como (int))', 5.9, 5],
    ['texto con sufijo ((int) "5abc" = 5)', '5abc', 5],
    ['con espacios', ' 5', 5],
  ])('user como %s → %s', async (_caso, user, esperado) => {
    const { servicio, repo } = crear();
    await servicio.listar({ user });
    expect(repo.deUsuario).toHaveBeenCalledWith(esperado, null);
  });

  it('fecha vacía, solo espacios o ausente → todos los mensajes', async () => {
    const { servicio, repo } = crear();
    await servicio.listar({ user: 5, fecha: '' });
    await servicio.listar({ user: 5, fecha: '   ' });
    await servicio.listar({ user: 5, fecha: null });
    expect(repo.deUsuario.mock.calls).toEqual([
      [5, null],
      [5, null],
      [5, null],
    ]);
  });

  it('fecha con espacios → se recorta y filtra por ese día', async () => {
    const { servicio, repo } = crear();
    await servicio.listar({ user: 5, fecha: ' 2026-07-16 ' });
    expect(repo.deUsuario).toHaveBeenCalledWith(5, '2026-07-16');
  });

  it('sin mensajes → [] sin consultar usuarios', async () => {
    const { servicio, directorio } = crear();
    await expect(servicio.listar({ user: 5 })).resolves.toEqual([]);
    expect(directorio.nombresPorIds).not.toHaveBeenCalled();
  });

  it('arma la respuesta con los nombres de emisor y receptor', async () => {
    const { servicio, directorio } = crear(
      [MENSAJE],
      [
        { id: 5, nombre: 'Juan', apellido: 'Pérez' },
        { id: 8, nombre: 'Ana', apellido: 'Gómez' },
      ],
    );

    await expect(servicio.listar({ user: 5 })).resolves.toEqual([
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
    ]);
    expect(directorio.nombresPorIds).toHaveBeenCalledWith([5, 8]);
  });

  it('difusión (fk_user_to 0) o usuario inexistente → nombre "" ; nombre o apellido NULL se recorta', async () => {
    const { servicio } = crear(
      [
        { ...MENSAJE, id: 1, idEmisor: 5, idReceptor: 0, leido: true },
        { ...MENSAJE, id: 2, idEmisor: 6, idReceptor: 99 },
      ],
      [
        { id: 5, nombre: 'Juan', apellido: null },
        { id: 6, nombre: null, apellido: 'Gómez' },
      ],
    );

    const respuesta = await servicio.listar({ user: 5 });

    expect(respuesta.map((m) => [m.nombre_from, m.nombre_to, m.leido])).toEqual([
      ['Juan', '', true],
      ['Gómez', '', false],
    ]);
  });
});
