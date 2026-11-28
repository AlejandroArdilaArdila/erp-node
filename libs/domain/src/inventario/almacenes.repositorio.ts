import { Inject, Injectable } from '@nestjs/common';
import { almacenes, LEGACY_DB, type LegacyDb } from '@erp/database';
import { eq } from 'drizzle-orm';

export interface Almacen {
  id: number;
  nombre: string;
  /** 0 si no tiene padre (fk_parent NULL o 0): es una sucursal. */
  idPadre: number;
}

/** Acceso a llx_entrepot. Solo lectura. */
@Injectable()
export class AlmacenesRepositorio {
  constructor(@Inject(LEGACY_DB) private readonly db: LegacyDb) {}

  /** Almacenes abiertos (statut = 1) de todas las entidades, ordenados por ref. */
  async abiertos(): Promise<Almacen[]> {
    const filas = await this.db
      .select({ rowid: almacenes.rowid, ref: almacenes.ref, fkParent: almacenes.fkParent })
      .from(almacenes)
      .where(eq(almacenes.statut, 1))
      .orderBy(almacenes.ref);
    // (int) de PHP: NULL → 0.
    return filas.map((f) => ({ id: f.rowid, nombre: f.ref, idPadre: f.fkParent ?? 0 }));
  }
}
