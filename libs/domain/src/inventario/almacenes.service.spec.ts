import type { Almacen, AlmacenesRepositorio } from './almacenes.repositorio.js';
import { AlmacenesService } from './almacenes.service.js';

function crear(abiertos: Almacen[]) {
  const repo = { abiertos: vi.fn().mockResolvedValue(abiertos) };
  return new AlmacenesService(repo as unknown as AlmacenesRepositorio);
}

describe('AlmacenesService.jerarquia (réplica de almacenesJerarquia)', () => {
  it('sucursales con sus hijos, en el orden en que llegan (por ref)', async () => {
    const servicio = crear([
      { id: 6, nombre: 'Almacen Calle 30 S1', idPadre: 1 },
      { id: 7, nombre: 'Almacen Principal S1', idPadre: 1 },
      { id: 2, nombre: 'Sucursal Norte', idPadre: 0 },
      { id: 1, nombre: 'Sucursal Principal', idPadre: 0 },
    ]);
    await expect(servicio.jerarquia()).resolves.toEqual([
      { id: 2, nombre: 'Sucursal Norte', hijos: [] },
      {
        id: 1,
        nombre: 'Sucursal Principal',
        hijos: [
          { id: 6, nombre: 'Almacen Calle 30 S1' },
          { id: 7, nombre: 'Almacen Principal S1' },
        ],
      },
    ]);
  });

  it('padre negativo cuenta como sucursal ((int) fk_parent <= 0)', async () => {
    const servicio = crear([{ id: 3, nombre: 'Rara', idPadre: -1 }]);
    await expect(servicio.jerarquia()).resolves.toEqual([{ id: 3, nombre: 'Rara', hijos: [] }]);
  });

  it('hijo de un padre cerrado o de otro hijo no aparece (solo dos niveles)', async () => {
    const servicio = crear([
      { id: 1, nombre: 'Sucursal', idPadre: 0 },
      { id: 5, nombre: 'Hijo', idPadre: 1 },
      { id: 8, nombre: 'Nieto', idPadre: 5 },
      { id: 9, nombre: 'Huérfano', idPadre: 99 },
    ]);
    await expect(servicio.jerarquia()).resolves.toEqual([
      { id: 1, nombre: 'Sucursal', hijos: [{ id: 5, nombre: 'Hijo' }] },
    ]);
  });
});
