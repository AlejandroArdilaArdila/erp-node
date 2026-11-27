import { Injectable } from '@nestjs/common';
import { type PermisoDolibarr, PermisosRepositorio } from './permisos.repositorio.js';

/**
 * Módulos de Dolibarr cuyos permisos carga apipos para los usuarios del POS
 * (UsuariosService::MODULO_INTEGROSPOS, MODULO_INTEGROSAPK y MODULO_INTEGROS).
 */
export const MODULOS_PERMISOS_POS = ['integrospos', 'iapk', 'integros'];

function coincide(permiso: PermisoDolibarr, perms: string, subperms: string): boolean {
  return permiso.perms === perms && permiso.subperms === subperms;
}

@Injectable()
export class PermisosService {
  constructor(private readonly permisos: PermisosRepositorio) {}

  /**
   * Réplica de `Usuario::tieneDerecho($perms, $subperms)` de apipos.
   *
   * - Revisa los permisos de integrospos, iapk e integros, directos o por
   *   grupo, **sin distinguir el módulo**: `tieneDerecho('lire', '')` es
   *   verdadero si el usuario tiene `lire` en cualquiera de los tres.
   * - La comparación es estricta, como `===` en PHP: distingue mayúsculas
   *   y `NULL` no es igual a `''`. Por eso se compara aquí y no en SQL,
   *   donde la collation de MySQL ignora mayúsculas.
   *
   * ⚠ Dolibarr guarda `subperms = NULL` en los permisos que no tienen
   * subpermiso. Con la comparación estricta, `tieneDerecho('lire', '')` solo
   * es verdadero si la fila tiene `subperms = ''`. Se mantiene igual al
   * original. Pendiente: confirmarlo con el equipo contra los datos reales.
   */
  async tieneDerecho(idUsuario: number, perms: string, subperms: string): Promise<boolean> {
    const directos = await this.permisos.directos(idUsuario, MODULOS_PERMISOS_POS);
    if (directos.some((p) => coincide(p, perms, subperms))) {
      return true;
    }
    const deGrupos = await this.permisos.porGrupos(idUsuario, MODULOS_PERMISOS_POS);
    return deGrupos.some((p) => coincide(p, perms, subperms));
  }
}
