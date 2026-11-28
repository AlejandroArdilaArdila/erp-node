import { Inject, Injectable } from '@nestjs/common';
import { LEGACY_DB, type LegacyDb, sorteos } from '@erp/database';
import { and, eq, sql, type SQL } from 'drizzle-orm';

/** Sorteo tal como está en llx_pos_sorteo. */
export interface Sorteo {
  id: number;
  descripcion: string | null;
  premio: string | null;
  /** 'YYYY-MM-DD' (puede ser '0000-00-00' si la base lo permite). */
  fechaInicio: string;
  fechaFinal: string;
  compraMinimo: number;
  valorParticipacion: number;
  tipoCliente: string;
  tipoCalculo: string;
  observacion: string | null;
  permitirEntregarSinCtrl: number;
  /** JSON tal como está guardado. */
  clientesJson: string | null;
  productosJson: string | null;
}

/** Acceso a llx_pos_sorteo. Solo lectura. */
@Injectable()
export class SorteosRepositorio {
  constructor(@Inject(LEGACY_DB) private readonly db: LegacyDb) {}

  /**
   * Sorteos activos vigentes hoy (fecha_inicio <= hoy <= fecha_final), por fecha
   * final. "Hoy" es CURDATE() de MySQL, igual que en apipos.
   */
  async vigentes(): Promise<Sorteo[]> {
    return this.activos(
      sql`${sorteos.fechaInicio} <= CURDATE() and ${sorteos.fechaFinal} >= CURDATE()`,
      sorteos.fechaFinal,
    );
  }

  /** Sorteos activos que empiezan después de hoy (CURDATE() de MySQL), por fecha de inicio. */
  async proximos(): Promise<Sorteo[]> {
    return this.activos(sql`${sorteos.fechaInicio} > CURDATE()`, sorteos.fechaInicio);
  }

  private async activos(
    condicion: SQL,
    orden: typeof sorteos.fechaInicio | typeof sorteos.fechaFinal,
  ): Promise<Sorteo[]> {
    const filas = await this.db
      .select({
        rowid: sorteos.rowid,
        descripcion: sorteos.descripcion,
        premio: sorteos.premio,
        fechaInicio: sorteos.fechaInicio,
        fechaFinal: sorteos.fechaFinal,
        compraMinimo: sorteos.compraMinimo,
        valorParticipacion: sorteos.valorParticipacion,
        tipoCliente: sorteos.tipoCliente,
        tipoCalculo: sorteos.tipoCalculo,
        observacion: sorteos.observacion,
        permitirEntregarSinCtrl: sorteos.permitirEntregarSinCtrl,
        fkClientes: sorteos.fkClientes,
        fkProductos: sorteos.fkProductos,
      })
      .from(sorteos)
      .where(and(eq(sorteos.estado, 1), condicion))
      .orderBy(orden);

    return filas.map((f) => ({
      id: f.rowid,
      descripcion: f.descripcion,
      premio: f.premio,
      fechaInicio: f.fechaInicio,
      fechaFinal: f.fechaFinal,
      compraMinimo: f.compraMinimo,
      valorParticipacion: f.valorParticipacion,
      tipoCliente: f.tipoCliente,
      tipoCalculo: f.tipoCalculo,
      observacion: f.observacion,
      permitirEntregarSinCtrl: f.permitirEntregarSinCtrl,
      clientesJson: f.fkClientes,
      productosJson: f.fkProductos,
    }));
  }
}
