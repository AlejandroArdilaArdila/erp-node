import type { PermisoDolibarr, PermisosRepositorio } from './permisos.repositorio.js';
import { MODULOS_PERMISOS_POS, PermisosService } from './permisos.service.js';

function crear(directos: PermisoDolibarr[], deGrupos: PermisoDolibarr[] = []) {
  const repo = {
    directos: vi.fn().mockResolvedValue(directos),
    porGrupos: vi.fn().mockResolvedValue(deGrupos),
  };
  return { servicio: new PermisosService(repo as unknown as PermisosRepositorio), repo };
}

describe('PermisosService.tieneDerecho (réplica de Usuario::tieneDerecho)', () => {
  it('permiso directo → true, sin consultar los grupos', async () => {
    const { servicio, repo } = crear([{ perms: 'lire', subperms: '' }]);
    await expect(servicio.tieneDerecho(7, 'lire', '')).resolves.toBe(true);
    expect(repo.directos).toHaveBeenCalledWith(7, MODULOS_PERMISOS_POS);
    expect(repo.porGrupos).not.toHaveBeenCalled();
  });

  it('permiso solo por grupo → true', async () => {
    const { servicio, repo } = crear([], [{ perms: 'lire', subperms: '' }]);
    await expect(servicio.tieneDerecho(7, 'lire', '')).resolves.toBe(true);
    expect(repo.porGrupos).toHaveBeenCalledWith(7, MODULOS_PERMISOS_POS);
  });

  it('sin el permiso → false', async () => {
    const { servicio } = crear(
      [{ perms: 'creer', subperms: '' }],
      [{ perms: 'supprimer', subperms: '' }],
    );
    await expect(servicio.tieneDerecho(7, 'lire', '')).resolves.toBe(false);
  });

  it('subperms NULL no es igual a "" (=== de PHP)', async () => {
    const { servicio } = crear(
      [{ perms: 'lire', subperms: null }],
      [{ perms: 'lire', subperms: null }],
    );
    await expect(servicio.tieneDerecho(7, 'lire', '')).resolves.toBe(false);
  });

  it('distingue mayúsculas, a diferencia de la collation de MySQL', async () => {
    const { servicio } = crear([{ perms: 'LIRE', subperms: '' }]);
    await expect(servicio.tieneDerecho(7, 'lire', '')).resolves.toBe(false);
  });

  it('compara el subpermiso', async () => {
    const { servicio } = crear([{ perms: 'lire', subperms: 'all' }]);
    await expect(servicio.tieneDerecho(7, 'lire', 'all')).resolves.toBe(true);
    await expect(servicio.tieneDerecho(7, 'lire', '')).resolves.toBe(false);
  });
});
