import { Inject, Injectable } from '@nestjs/common';
import { aperturasCaja, LEGACY_DB, type LegacyDb, terminalesPos } from '@erp/database';
import { and, desc, eq, or, sql } from 'drizzle-orm';

export interface TerminalPos {
  id: number;
  enUso: boolean;
}

export interface AperturaCaja {
  estado: number;
  fechaApertura: string;
}

@Injectable()
export class TerminalesRepositorio {
  constructor(@Inject(LEGACY_DB) private readonly db: LegacyDb) {}

  /** Terminal asignada al usuario (pos_cash.fk_soc guarda el id del usuario). */
  async terminalDeUsuario(idUsuario: number): Promise<TerminalPos | null> {
    const [fila] = await this.db
      .select({ id: terminalesPos.rowid, isUsed: terminalesPos.isUsed })
      .from(terminalesPos)
      .where(eq(terminalesPos.fkSoc, idUsuario))
      .orderBy(terminalesPos.rowid)
      .limit(1);
    return fila ? { id: fila.id, enUso: fila.isUsed === 1 } : null;
  }

  /** Última apertura abierta, o de hoy, del usuario. */
  async aperturaRelevante(idUsuario: number, hoy: string): Promise<AperturaCaja | null> {
    const [fila] = await this.db
      .select({ estado: aperturasCaja.estado, fechaApertura: aperturasCaja.fechaApertura })
      .from(aperturasCaja)
      .where(
        and(
          eq(aperturasCaja.fkUser, idUsuario),
          or(eq(aperturasCaja.estado, 1), sql`DATE(${aperturasCaja.fechaApertura}) = ${hoy}`),
        ),
      )
      .orderBy(desc(aperturasCaja.rowid))
      .limit(1);
    return fila ?? null;
  }
}
