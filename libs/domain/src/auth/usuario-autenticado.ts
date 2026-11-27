/** Usuario de Dolibarr ya autenticado, tal como lo ve el resto del sistema. */
export interface UsuarioAutenticado {
  id: number;
  login: string;
  /** "Nombre Apellido" o el login si no tiene nombre. */
  nombre: string;
  admin: boolean;
  entity: number;
}

/**
 * Réplica de `implode(' ', array_filter([firstname, lastname])) ?: login`.
 * array_filter de PHP también descarta la cadena "0".
 */
export function nombreVisible(
  firstname: string | null,
  lastname: string | null,
  login: string,
): string {
  const partes = [firstname, lastname].filter((p): p is string => !!p && p !== '0');
  return partes.join(' ') || login;
}
