import { Inject, Injectable } from '@nestjs/common';
import {
  definicionesExtrafield,
  LEGACY_DB,
  type LegacyDb,
  tarifasIva,
  unidadesMedida,
} from '@erp/database';
import { and, eq, like } from 'drizzle-orm';

export interface TarifaIva {
  codigo: string | null;
  /** Tarifa de IVA (columna DOUBLE `taux`). */
  tarifa: number;
  /** Impuesto local 1 (en Colombia, el impoconsumo), como texto. */
  impuestoLocal1: string;
  tipoImpuestoLocal1: string;
}

export interface UnidadMedida {
  escala: number | null;
  abreviatura: string | null;
}

/** Catálogos generales de Dolibarr: extrafields, tarifas de IVA y unidades. Solo lectura. */
@Injectable()
export class CatalogosRepositorio {
  constructor(@Inject(LEGACY_DB) private readonly db: LegacyDb) {}

  /**
   * `param` del primer extrafield cuyo nombre es `nombre`, de cualquier tipo de
   * elemento. Se compara con LIKE (sin comodines), como el original: ignora
   * mayúsculas según la collation.
   */
  async parametrosExtrafield(nombre: string): Promise<string | null> {
    const [fila] = await this.db
      .select({ param: definicionesExtrafield.param })
      .from(definicionesExtrafield)
      .where(like(definicionesExtrafield.name, nombre))
      .limit(1);
    return fila?.param ?? null;
  }

  /** Tarifas de IVA activas del país, en el orden de la tabla. */
  async tarifasIvaActivas(idPais: number): Promise<TarifaIva[]> {
    const filas = await this.db
      .select({
        code: tarifasIva.code,
        taux: tarifasIva.taux,
        localtax1: tarifasIva.localtax1,
        localtax1Type: tarifasIva.localtax1Type,
      })
      .from(tarifasIva)
      .where(and(eq(tarifasIva.fkPays, idPais), eq(tarifasIva.active, 1)));
    return filas.map((f) => ({
      codigo: f.code,
      tarifa: f.taux,
      impuestoLocal1: f.localtax1,
      tipoImpuestoLocal1: f.localtax1Type,
    }));
  }

  /** Unidades de un tipo ('weight', 'volume'...), en el orden de la tabla. */
  async unidadesPorTipo(tipo: string): Promise<UnidadMedida[]> {
    const filas = await this.db
      .select({ scale: unidadesMedida.scale, shortLabel: unidadesMedida.shortLabel })
      .from(unidadesMedida)
      .where(eq(unidadesMedida.unitType, tipo));
    return filas.map((f) => ({ escala: f.scale, abreviatura: f.shortLabel }));
  }
}
