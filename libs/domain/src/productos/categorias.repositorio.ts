import { Inject, Injectable } from '@nestjs/common';
import { categorias, categoriasProducto, LEGACY_DB, type LegacyDb } from '@erp/database';
import { and, eq, sql, type Table } from 'drizzle-orm';

/**
 * `tabla`.`columna` siempre calificada. En un SELECT de una sola tabla, Drizzle
 * escribe las columnas sin tabla, y dentro de una subconsulta correlacionada eso
 * es ambiguo: `rowid` se resolvería contra la tabla interna si la tuviera.
 */
function columna(tabla: Table, nombre: string) {
  return sql`${tabla}.${sql.identifier(nombre)}`;
}

/** Categoría de producto con el número de productos asociados. */
export interface CategoriaProducto {
  id: number;
  nombre: string;
  descripcion: string | null;
  color: string | null;
  idPadre: number;
  totalProductos: number;
}

/** Acceso a llx_categorie y llx_categorie_product. Solo lectura. */
@Injectable()
export class CategoriasRepositorio {
  constructor(@Inject(LEGACY_DB) private readonly db: LegacyDb) {}

  /**
   * Categorías de producto (type = 0) de la entidad dada, ordenadas por label,
   * con el total de productos de cada una. El conteo es la misma subconsulta
   * correlacionada que genera `withCount('productos')` en Eloquent.
   */
  async deProductoConTotales(entidad: number): Promise<CategoriaProducto[]> {
    const filas = await this.db
      .select({
        rowid: categorias.rowid,
        label: categorias.label,
        description: categorias.description,
        color: categorias.color,
        fkParent: categorias.fkParent,
        totalProductos:
          sql<number>`(select count(*) from ${categoriasProducto} where ${columna(categoriasProducto, 'fk_categorie')} = ${columna(categorias, 'rowid')})`.mapWith(
            Number,
          ),
      })
      .from(categorias)
      .where(and(eq(categorias.type, 0), eq(categorias.entity, entidad)))
      .orderBy(categorias.label);

    return filas.map((f) => ({
      id: f.rowid,
      nombre: f.label,
      descripcion: f.description,
      color: f.color,
      // (int) de PHP: NULL → 0.
      idPadre: f.fkParent ?? 0,
      totalProductos: f.totalProductos,
    }));
  }
}
