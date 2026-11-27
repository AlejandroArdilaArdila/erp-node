import { Injectable } from '@nestjs/common';
import { type NombreUsuario, UsuariosRepositorio } from './usuarios.repositorio.js';

export type { NombreUsuario };

/**
 * Datos públicos de los usuarios de Dolibarr para otros dominios, que no
 * pueden consultar llx_user directamente. Nunca expone credenciales.
 */
@Injectable()
export class DirectorioUsuariosService {
  constructor(private readonly usuarios: UsuariosRepositorio) {}

  /** Nombre y apellido por id. Los ids repetidos se consultan una sola vez. */
  async nombresPorIds(ids: number[]): Promise<Map<number, NombreUsuario>> {
    const unicos = [...new Set(ids)];
    const encontrados = await this.usuarios.nombresPorIds(unicos);
    return new Map(encontrados.map((u) => [u.id, u]));
  }
}
