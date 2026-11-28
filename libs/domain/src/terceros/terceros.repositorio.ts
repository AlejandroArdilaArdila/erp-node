import { Inject, Injectable } from '@nestjs/common';
import { LEGACY_DB, type LegacyDb, terceros, tercerosComerciales } from '@erp/database';
import { and, eq, inArray, like, or } from 'drizzle-orm';

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

  /**
   * Proveedores activos (fournisseur = 1, status = 1) por nombre, hasta `limite`.
   * Con `busqueda`, los que la contienen en el nombre o en el NIT. El texto va
   * tal cual dentro del LIKE, sin escapar % ni _, igual que en apipos.
   */
  async proveedoresActivos(busqueda: string | null, limite: number): Promise<ProveedorAsignado[]> {
    const patron = `%${busqueda ?? ''}%`;
    const filas = await this.db
      .select({
        rowid: terceros.rowid,
        nom: terceros.nom,
        tvaIntra: terceros.tvaIntra,
        phone: terceros.phone,
      })
      .from(terceros)
      .where(
        and(
          eq(terceros.fournisseur, 1),
          eq(terceros.status, 1),
          busqueda === null
            ? undefined
            : or(like(terceros.nom, patron), like(terceros.tvaIntra, patron)),
        ),
      )
      .orderBy(terceros.nom)
      .limit(limite);

    return filas.map((f) => ({ id: f.rowid, nombre: f.nom, rif: f.tvaIntra, telefono: f.phone }));
  }
}
