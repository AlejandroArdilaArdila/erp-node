import { HttpException } from '@nestjs/common';
import type { PermisosService, UsuarioAutenticado } from '@erp/domain/auth';
import type { CategoriaProducto, CategoriasRepositorio } from './categorias.repositorio.js';
import { CategoriasService } from './categorias.service.js';

const USUARIO: UsuarioAutenticado = {
  id: 7,
  login: 'cajero1',
  nombre: 'Ana',
  admin: false,
  entity: 1,
};

function crear(tienePermiso: boolean, categorias: CategoriaProducto[] = []) {
  const repo = { deProductoConTotales: vi.fn().mockResolvedValue(categorias) };
  const permisos = { tieneDerecho: vi.fn().mockResolvedValue(tienePermiso) };
  const servicio = new CategoriasService(
    repo as unknown as CategoriasRepositorio,
    permisos as unknown as PermisosService,
  );
  return { servicio, repo, permisos };
}

describe('CategoriasService.listar', () => {
  it('sin permiso lire → 401 { message: "Sin permisos" } y no consulta categorías', async () => {
    const { servicio, repo, permisos } = crear(false);

    const error = await servicio.listar(USUARIO).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).getStatus()).toBe(401);
    expect((error as HttpException).getResponse()).toEqual({ message: 'Sin permisos' });
    expect(permisos.tieneDerecho).toHaveBeenCalledWith(7, 'lire', '');
    expect(repo.deProductoConTotales).not.toHaveBeenCalled();
  });

  it('con permiso → categorías de la entidad 1 con los nombres de campo de apipos', async () => {
    const { servicio, repo } = crear(true, [
      {
        id: 12,
        nombre: 'Bebidas',
        descripcion: 'Gaseosas, jugos y aguas',
        color: '3399CC',
        idPadre: 0,
        totalProductos: 45,
      },
      { id: 13, nombre: 'Jugos', descripcion: null, color: null, idPadre: 12, totalProductos: 0 },
    ]);

    await expect(servicio.listar(USUARIO)).resolves.toEqual([
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
    expect(repo.deProductoConTotales).toHaveBeenCalledWith(1);
  });

  it('usa la entidad 1 aunque el usuario sea de otra entidad (igual que apipos)', async () => {
    const { servicio, repo } = crear(true);
    await expect(servicio.listar({ ...USUARIO, entity: 0 })).resolves.toEqual([]);
    expect(repo.deProductoConTotales).toHaveBeenCalledWith(1);
  });
});
