import type { Constante, ConstantesRepositorio } from './constantes.repositorio.js';
import { ConstantesService } from './constantes.service.js';

function crear(filas: Constante[]) {
  const repo = { porNombres: vi.fn().mockResolvedValue(filas) };
  return { servicio: new ConstantesService(repo as unknown as ConstantesRepositorio), repo };
}

describe('ConstantesService.valores (réplica de Configuracion::valores)', () => {
  it('consulta las entidades 0 y 1', async () => {
    const { servicio, repo } = crear([]);
    await servicio.valores(['A', 'B']);
    expect(repo.porNombres).toHaveBeenCalledWith(['A', 'B'], [0, 1]);
  });

  it('la entidad 1 sobreescribe a la 0 (filas ordenadas por entidad)', async () => {
    const { servicio } = crear([
      { nombre: 'A', entidad: 0, valor: 'global' },
      { nombre: 'B', entidad: 0, valor: 'solo-global' },
      { nombre: 'A', entidad: 1, valor: 'cliente' },
    ]);
    const valores = await servicio.valores(['A', 'B', 'C']);
    expect(Object.fromEntries(valores)).toEqual({ A: 'cliente', B: 'solo-global' });
  });
});
