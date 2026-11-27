import { int, varchar } from 'drizzle-orm/mysql-core';
import { tablaLegado } from './tabla-legado.js';

/** llx_rights_def: catálogo de permisos de los módulos de Dolibarr. */
export const definicionesPermiso = tablaLegado('rights_def', {
  id: int('id').primaryKey(),
  module: varchar('module', { length: 64 }),
  perms: varchar('perms', { length: 50 }),
  subperms: varchar('subperms', { length: 50 }),
});

/** llx_user_rights: permisos asignados directamente a un usuario. */
export const permisosUsuario = tablaLegado('user_rights', {
  rowid: int('rowid').primaryKey().autoincrement(),
  fkUser: int('fk_user').notNull(),
  fkId: int('fk_id').notNull(),
});

/** llx_usergroup: grupos de usuarios. */
export const gruposUsuario = tablaLegado('usergroup', {
  rowid: int('rowid').primaryKey().autoincrement(),
});

/** llx_usergroup_user: usuarios que pertenecen a cada grupo. */
export const miembrosGrupo = tablaLegado('usergroup_user', {
  rowid: int('rowid').primaryKey().autoincrement(),
  fkUser: int('fk_user').notNull(),
  fkUsergroup: int('fk_usergroup').notNull(),
});

/** llx_usergroup_rights: permisos asignados a un grupo. */
export const permisosGrupo = tablaLegado('usergroup_rights', {
  rowid: int('rowid').primaryKey().autoincrement(),
  fkUsergroup: int('fk_usergroup').notNull(),
  fkId: int('fk_id').notNull(),
});
