import { Inject, Injectable } from '@nestjs/common';
import {
  definicionesPermiso,
  gruposUsuario,
  LEGACY_DB,
  type LegacyDb,
  miembrosGrupo,
  permisosGrupo,
  permisosUsuario,
} from '@erp/database';
import { and, eq, inArray } from 'drizzle-orm';

/** Un permiso de Dolibarr tal como está en llx_rights_def. */
export interface PermisoDolibarr {
  perms: string | null;
  subperms: string | null;
}

/**
 * Acceso a los permisos de Dolibarr (llx_rights_def, llx_user_rights y los
 * grupos). Solo lectura.
 */
@Injectable()
export class PermisosRepositorio {
  constructor(@Inject(LEGACY_DB) private readonly db: LegacyDb) {}

  /**
   * Permisos de los módulos dados asignados directamente al usuario.
   * Equivale a la relación `Usuario::permisos()` de apipos.
   */
  async directos(idUsuario: number, modulos: string[]): Promise<PermisoDolibarr[]> {
    return this.db
      .select({ perms: definicionesPermiso.perms, subperms: definicionesPermiso.subperms })
      .from(permisosUsuario)
      .innerJoin(definicionesPermiso, eq(definicionesPermiso.id, permisosUsuario.fkId))
      .where(
        and(eq(permisosUsuario.fkUser, idUsuario), inArray(definicionesPermiso.module, modulos)),
      );
  }

  /**
   * Permisos de los módulos dados que el usuario recibe por sus grupos.
   * Equivale a `Usuario::grupos().permisos()` de apipos. El join con
   * llx_usergroup descarta, igual que Eloquent, las filas de usergroup_user
   * que apuntan a un grupo borrado.
   */
  async porGrupos(idUsuario: number, modulos: string[]): Promise<PermisoDolibarr[]> {
    return this.db
      .select({ perms: definicionesPermiso.perms, subperms: definicionesPermiso.subperms })
      .from(miembrosGrupo)
      .innerJoin(gruposUsuario, eq(gruposUsuario.rowid, miembrosGrupo.fkUsergroup))
      .innerJoin(permisosGrupo, eq(permisosGrupo.fkUsergroup, gruposUsuario.rowid))
      .innerJoin(definicionesPermiso, eq(definicionesPermiso.id, permisosGrupo.fkId))
      .where(
        and(eq(miembrosGrupo.fkUser, idUsuario), inArray(definicionesPermiso.module, modulos)),
      );
  }
}
