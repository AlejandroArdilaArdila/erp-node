import { Inject, Injectable } from '@nestjs/common';
import { constantes, LEGACY_DB, type LegacyDb } from '@erp/database';
import { and, asc, inArray } from 'drizzle-orm';

/** Una fila de llx_const. */
export interface Constante {
  nombre: string;
  entidad: number;
  valor: string;
}

/** Acceso a llx_const. Solo lectura. */
@Injectable()
export class ConstantesRepositorio {
  constructor(@Inject(LEGACY_DB) private readonly db: LegacyDb) {}

  /**
   * Filas de las constantes pedidas en las entidades dadas, ordenadas por
   * entidad (y por rowid, para que el orden sea estable).
   */
  async porNombres(nombres: string[], entidades: number[]): Promise<Constante[]> {
    if (nombres.length === 0) {
      return [];
    }
    const filas = await this.db
      .select({ name: constantes.name, entity: constantes.entity, value: constantes.value })
      .from(constantes)
      .where(and(inArray(constantes.name, nombres), inArray(constantes.entity, entidades)))
      .orderBy(asc(constantes.entity), asc(constantes.rowid));
    return filas.map((f) => ({ nombre: f.name, entidad: f.entity, valor: f.value }));
  }
}
