import { Inject, Injectable } from '@nestjs/common';
import { LEGACY_DB, type LegacyDb, terceros, tercerosComerciales } from '@erp/database';
import { and, eq, inArray } from 'drizzle-orm';

export interface ProveedorAsignado {
  id: number;
  nombre: string | null;
  rif: string | null;
  telefono: string | null;
}

@Injectable()
export class TercerosRepositorio {
  constructor(@Inject(LEGACY_DB) private readonly db: LegacyDb) {}

  /** Proveedores (fournisseur = 1) donde el usuario figura como vendedor. */
  async proveedoresAsignados(idUsuario: number): Promise<ProveedorAsignado[]> {
    const asignaciones = await this.db
      .selectDistinct({ fkSoc: tercerosComerciales.fkSoc })
      .from(tercerosComerciales)
      .where(eq(tercerosComerciales.fkUser, idUsuario));
    const ids = asignaciones.map((a) => a.fkSoc).filter((id): id is number => id !== null);
    if (ids.length === 0) {
      return [];
    }

    const filas = await this.db
      .select({
        rowid: terceros.rowid,
        nom: terceros.nom,
        tvaIntra: terceros.tvaIntra,
        phone: terceros.phone,
      })
      .from(terceros)
      .where(and(inArray(terceros.rowid, ids), eq(terceros.fournisseur, 1)))
      .orderBy(terceros.rowid);

    return filas.map((f) => ({ id: f.rowid, nombre: f.nom, rif: f.tvaIntra, telefono: f.phone }));
  }
}
