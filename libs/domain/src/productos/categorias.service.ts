import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { PermisosService, type UsuarioAutenticado } from '@erp/domain/auth';
import { CategoriasRepositorio } from './categorias.repositorio.js';

/** Elemento de GET /api.php/integrosone/productos/categorias (contrato apipos). */
export interface CategoriaLegado {
  rowid: number;
  label: string;
  description: string | null;
  color: string | null;
  fk_parent: number;
  total_productos: number;
}

/**
 * apipos consulta siempre la entidad 1 (`->where('entity', 1)`), sin importar
 * la entidad del usuario. Se mantiene igual al original.
 */
const ENTIDAD_CATEGORIAS = 1;

@Injectable()
export class CategoriasService {
  constructor(
    private readonly categorias: CategoriasRepositorio,
    private readonly permisos: PermisosService,
  ) {}

  /**
   * Réplica de CategoriaService::listar (apipos), que a su vez replica
   * getCategorias() de api_productos.class.php (módulo integrosapk).
   *
   * Sin el permiso `lire` → 401 { "message": "Sin permisos" }, el cuerpo
   * de `abort(401, 'Sin permisos')` en apipos con APP_DEBUG apagado.
   */
  async listar(usuario: UsuarioAutenticado): Promise<CategoriaLegado[]> {
    if (!(await this.permisos.tieneDerecho(usuario.id, 'lire', ''))) {
      throw new HttpException({ message: 'Sin permisos' }, HttpStatus.UNAUTHORIZED);
    }

    const categorias = await this.categorias.deProductoConTotales(ENTIDAD_CATEGORIAS);
    return categorias.map((c) => ({
      rowid: c.id,
      label: c.nombre,
      description: c.descripcion,
      color: c.color,
      fk_parent: c.idPadre,
      total_productos: c.totalProductos,
    }));
  }
}
