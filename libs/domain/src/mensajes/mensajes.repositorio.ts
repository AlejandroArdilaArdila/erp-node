import { Inject, Injectable } from '@nestjs/common';
import { LEGACY_DB, type LegacyDb, mensajesChat } from '@erp/database';
import { and, eq, or, sql } from 'drizzle-orm';

/** Mensaje del chat de vendedores. */
export interface MensajeChat {
  id: number;
  idEmisor: number;
  /** 0 = difusión (para todos). */
  idReceptor: number;
  mensaje: string;
  tipo: string;
  /** 'YYYY-MM-DD HH:MM:SS', tal como está en la base. */
  fecha: string;
  leido: boolean;
}

/** Acceso a llx_chat_vendedor. Solo lectura. */
@Injectable()
export class MensajesRepositorio {
  constructor(@Inject(LEGACY_DB) private readonly db: LegacyDb) {}

  /**
   * Mensajes donde el usuario es emisor o receptor, más los de difusión,
   * ordenados por fecha. Con `fecha`, solo los de ese día.
   *
   * `fecha` se compara con `DATE(fecha) = ?` sin validarla, igual que
   * `whereDate()` de Laravel: un texto que no es fecha no devuelve filas.
   */
  async deUsuario(idUsuario: number, fecha: string | null): Promise<MensajeChat[]> {
    const filas = await this.db
      .select()
      .from(mensajesChat)
      .where(
        and(
          or(
            eq(mensajesChat.fkUserFrom, idUsuario),
            eq(mensajesChat.fkUserTo, idUsuario),
            eq(mensajesChat.fkUserTo, 0),
          ),
          fecha === null ? undefined : sql`date(${mensajesChat.fecha}) = ${fecha}`,
        ),
      )
      .orderBy(mensajesChat.fecha);

    return filas.map((f) => ({
      id: f.rowid,
      idEmisor: f.fkUserFrom,
      idReceptor: f.fkUserTo,
      mensaje: f.mensaje,
      tipo: f.tipo,
      fecha: f.fecha,
      leido: f.leido !== 0,
    }));
  }
}
