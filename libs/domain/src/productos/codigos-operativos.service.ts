import { Injectable } from '@nestjs/common';
import { CodigosOperativosRepositorio } from './codigos-operativos.repositorio.js';

/** Elemento de GET /api.php/integrospos/products/codigosOperativos (contrato apipos). */
export interface CodigoOperativoLegado {
  rowid: number;
  codigo: string;
  fk_product: number;
  descuento: number | null;
  ref: string | null;
  label: string | null;
  tipo: 'Servicio' | 'Producto';
  date_creation: string;
}

/** apipos consulta siempre la entidad 1. Se mantiene igual al original. */
const ENTIDAD_CODIGOS = 1;

/** fk_product_type de un servicio en Dolibarr. */
const TIPO_SERVICIO = 1;

@Injectable()
export class CodigosOperativosService {
  constructor(private readonly codigos: CodigosOperativosRepositorio) {}

  /**
   * Réplica de CodigoOperativoService::listar (apipos): códigos operativos
   * activos con su producto o servicio. Si el producto no existe, `ref` y
   * `label` van en null y `tipo` es 'Producto', como en el original.
   */
  async activos(): Promise<CodigoOperativoLegado[]> {
    const codigos = await this.codigos.activos(ENTIDAD_CODIGOS);
    return codigos.map((c) => ({
      rowid: c.id,
      codigo: c.codigo,
      fk_product: c.idProducto,
      descuento: c.descuento,
      ref: c.refProducto,
      label: c.nombreProducto,
      tipo: c.tipoProducto === TIPO_SERVICIO ? 'Servicio' : 'Producto',
      date_creation: c.fechaCreacion,
    }));
  }
}
