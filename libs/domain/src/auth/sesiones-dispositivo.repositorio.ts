import { Inject, Injectable } from '@nestjs/common';
import {
  LEGACY_DB,
  type LegacyDb,
  type LegacyEjecutor,
  registroLoginPos,
  sesionesDispositivo,
} from '@erp/database';
import { and, desc, eq, gt, isNull } from 'drizzle-orm';

export interface SesionDispositivo {
  id: number;
  deviceId: string;
  ip: string | null;
  versionPos: string | null;
  servidorLocal: string | null;
}

export interface InicioSesionDispositivo {
  /** Sesión activa del mismo dispositivo que se reutiliza, o null para crear una. */
  idExistente: number | null;
  idUsuario: number;
  deviceId: string;
  hashAcceso: string;
  hashRefresh: string;
  expiresAt: string;
  ahora: string;
  ip: string | null;
  versionPos: string | null;
}

const campos = {
  id: sesionesDispositivo.id,
  deviceId: sesionesDispositivo.deviceId,
  ip: sesionesDispositivo.ip,
  versionPos: sesionesDispositivo.versionPos,
  servidorLocal: sesionesDispositivo.servidorLocal,
};

/**
 * llx_integros_user_token (candado de un solo dispositivo activo) y
 * llx_pos_login_logout (bitácora de entradas y salidas).
 */
@Injectable()
export class SesionesDispositivoRepositorio {
  constructor(@Inject(LEGACY_DB) private readonly db: LegacyDb) {}

  /** Última sesión no revocada y vigente del usuario, en cualquier dispositivo. */
  async activaDeUsuario(
    ej: LegacyEjecutor,
    idUsuario: number,
    ahora: string,
  ): Promise<SesionDispositivo | null> {
    const [fila] = await ej
      .select(campos)
      .from(sesionesDispositivo)
      .where(
        and(
          eq(sesionesDispositivo.fkUser, idUsuario),
          eq(sesionesDispositivo.revoked, 0),
          gt(sesionesDispositivo.expiresAt, ahora),
        ),
      )
      .orderBy(desc(sesionesDispositivo.id))
      .limit(1);
    return fila ?? null;
  }

  /** Última sesión vigente del usuario en un dispositivo concreto. */
  async activaEnDispositivo(
    idUsuario: number,
    deviceId: string,
    ahora: string,
  ): Promise<SesionDispositivo | null> {
    const [fila] = await this.db
      .select(campos)
      .from(sesionesDispositivo)
      .where(
        and(
          eq(sesionesDispositivo.fkUser, idUsuario),
          eq(sesionesDispositivo.deviceId, deviceId),
          eq(sesionesDispositivo.revoked, 0),
          gt(sesionesDispositivo.expiresAt, ahora),
        ),
      )
      .orderBy(desc(sesionesDispositivo.id))
      .limit(1);
    return fila ?? null;
  }

  /** Registra el token emitido: reutiliza la sesión del mismo dispositivo o crea una. */
  async guardarInicio(ej: LegacyEjecutor, s: InicioSesionDispositivo): Promise<void> {
    const datos = {
      revoked: 0,
      tokenHash: s.hashAcceso,
      refreshHash: s.hashRefresh,
      expiresAt: s.expiresAt,
      lastSeenAt: s.ahora,
      ip: s.ip,
      versionPos: s.versionPos,
    };
    if (s.idExistente !== null) {
      await ej
        .update(sesionesDispositivo)
        .set(datos)
        .where(eq(sesionesDispositivo.id, s.idExistente));
      return;
    }
    await ej
      .insert(sesionesDispositivo)
      .values({ ...datos, fkUser: s.idUsuario, deviceId: s.deviceId });
  }

  /** Revoca la ÚLTIMA sesión del usuario (cualquier dispositivo), como apipos. */
  async revocarUltima(ej: LegacyEjecutor, idUsuario: number, ahora: string): Promise<void> {
    const [ultima] = await ej
      .select({ id: sesionesDispositivo.id })
      .from(sesionesDispositivo)
      .where(eq(sesionesDispositivo.fkUser, idUsuario))
      .orderBy(desc(sesionesDispositivo.id))
      .limit(1);
    if (ultima) {
      await ej
        .update(sesionesDispositivo)
        .set({ revoked: 1, cierreSesion: ahora })
        .where(eq(sesionesDispositivo.id, ultima.id));
    }
  }

  async actualizarActividad(
    id: number,
    cambios: Partial<Pick<SesionDispositivo, 'ip' | 'versionPos' | 'servidorLocal'>> & {
      lastSeenAt: string;
    },
  ): Promise<void> {
    await this.db.update(sesionesDispositivo).set(cambios).where(eq(sesionesDispositivo.id, id));
  }

  async registrarEntrada(ej: LegacyEjecutor, idUsuario: number, ahora: string): Promise<void> {
    await ej.insert(registroLoginPos).values({ fkUser: idUsuario, dateLogin: ahora });
  }

  /** Cierra la última entrada abierta. Devuelve false si no había ninguna. */
  async registrarSalida(ej: LegacyEjecutor, idUsuario: number, ahora: string): Promise<boolean> {
    const [abierta] = await ej
      .select({ rowid: registroLoginPos.rowid })
      .from(registroLoginPos)
      .where(and(eq(registroLoginPos.fkUser, idUsuario), isNull(registroLoginPos.dateLogout)))
      .orderBy(desc(registroLoginPos.dateLogin))
      .limit(1);
    if (!abierta) {
      return false;
    }
    await ej
      .update(registroLoginPos)
      .set({ dateLogout: ahora })
      .where(eq(registroLoginPos.rowid, abierta.rowid));
    return true;
  }
}
