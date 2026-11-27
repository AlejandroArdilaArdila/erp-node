import { DirectorioUsuariosService } from './directorio-usuarios.service.js';
import type { UsuariosRepositorio } from './usuarios.repositorio.js';

describe('DirectorioUsuariosService.nombresPorIds', () => {
  it('consulta cada id una sola vez y devuelve un mapa por id', async () => {
    const repo = {
      nombresPorIds: vi.fn().mockResolvedValue([{ id: 5, nombre: 'Juan', apellido: 'Pérez' }]),
    };
    const servicio = new DirectorioUsuariosService(repo as unknown as UsuariosRepositorio);

    const nombres = await servicio.nombresPorIds([5, 8, 5, 0, 8]);

    expect(repo.nombresPorIds).toHaveBeenCalledWith([5, 8, 0]);
    expect(nombres.get(5)).toEqual({ id: 5, nombre: 'Juan', apellido: 'Pérez' });
    expect(nombres.has(8)).toBe(false);
  });
});
