import { Inject, Injectable } from '@nestjs/common';
import { codigosOperativos, LEGACY_DB, type LegacyDb, productos } from '@erp/database';
import { and, desc, eq } from 'drizzle-orm';

/** Código operativo del POS con los datos de su producto (NULL si el producto no existe). */
export interface CodigoOperativo {
  id: number;
  codigo: string;
  idProducto: number;
  /** 1 sí, 0 no, null sin definir. */
  descuento: number | null;
  refProducto: string | null;
  nombreProducto: string | null;
  tipoProducto: number | null;
  /** 'YYYY-MM-DD HH:MM:SS', tal como está en la base. */
  fechaCreacion: string;
}

/** Acceso a llx_product_codoperativos (con llx_product). Solo lectura. */
@Injectable()
export class CodigosOperativosRepositorio {
  constructor(@Inject(LEGACY_DB) private readonly db: LegacyDb) {}

  /**
   * Códigos activos de la entidad, del más reciente al más antiguo (rowid
   * descendente). El LEFT JOIN por la clave primaria de llx_product da las
   * mismas filas que la relación `producto` de Eloquent en apipos.
   */
  async activos(entidad: number): Promise<CodigoOperativo[]> {
    const filas = await this.db
      .select({
        rowid: codigosOperativos.rowid,
        codigo: codigosOperativos.codigo,
        fkProduct: codigosOperativos.fkProduct,
        descuento: codigosOperativos.descuento,
        dateCreation: codigosOperativos.dateCreation,
        ref: productos.ref,
        label: productos.label,
        fkProductType: productos.fkProductType,
      })
      .from(codigosOperativos)
      .leftJoin(productos, eq(productos.rowid, codigosOperativos.fkProduct))
      .where(and(eq(codigosOperativos.entity, entidad), eq(codigosOperativos.active, 1)))
      .orderBy(desc(codigosOperativos.rowid));

    return filas.map((f) => ({
      id: f.rowid,
      codigo: f.codigo,
      idProducto: f.fkProduct,
      descuento: f.descuento,
      refProducto: f.ref,
      nombreProducto: f.label,
      tipoProducto: f.fkProductType,
      fechaCreacion: f.dateCreation,
    }));
  }
}
