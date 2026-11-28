import { Inject, Injectable } from '@nestjs/common';
import { imagenesCarrusel, LEGACY_DB, type LegacyDb } from '@erp/database';
import { and, desc, eq, sql } from 'drizzle-orm';

export interface ImagenCarrusel {
  id: number;
  archivo: string;
  label: string | null;
  /** 'YYYY-MM-DD' */
  desde: string;
  hasta: string;
}

/** Acceso a llx_pos_img_cp. Solo lectura. */
@Injectable()
export class CarruselRepositorio {
  constructor(@Inject(LEGACY_DB) private readonly db: LegacyDb) {}

  /**
   * Imágenes activas vigentes en `hoy` ('YYYY-MM-DD'), de la más reciente a la
   * más antigua. Compara con DATE(), como `whereDate()` de Laravel.
   */
  async vigentes(hoy: string): Promise<ImagenCarrusel[]> {
    const filas = await this.db
      .select({
        rowid: imagenesCarrusel.rowid,
        filename: imagenesCarrusel.filename,
        label: imagenesCarrusel.label,
        dateStart: imagenesCarrusel.dateStart,
        dateEnd: imagenesCarrusel.dateEnd,
      })
      .from(imagenesCarrusel)
      .where(
        and(
          sql`date(${imagenesCarrusel.dateStart}) <= ${hoy}`,
          sql`date(${imagenesCarrusel.dateEnd}) >= ${hoy}`,
          eq(imagenesCarrusel.active, 1),
        ),
      )
      .orderBy(desc(imagenesCarrusel.rowid));
    return filas.map((f) => ({
      id: f.rowid,
      archivo: f.filename,
      label: f.label,
      desde: f.dateStart,
      hasta: f.dateEnd,
    }));
  }
}
