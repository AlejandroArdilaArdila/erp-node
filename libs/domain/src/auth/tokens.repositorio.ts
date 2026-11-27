import { Inject, Injectable } from '@nestjs/common';
import { LEGACY_DB, type LegacyDb, type LegacyEjecutor, tokensAcceso } from '@erp/database';
import { and, eq } from 'drizzle-orm';

/**
 * Valor de `tokenable_type` que usa Sanctum en apipos. Debe ser idéntico para
 * que los tokens sirvan en ambos sistemas mientras conviven.
 */
export const TIPO_TOKENABLE = 'App\\Models\\DolibarrUser';

export interface TokenAcceso {
  id: number;
  idUsuario: number;
  /** device_name con que se emitió (el "slot" del dispositivo). */
  nombre: string;
  /** sha256 del token en texto plano. */
  hash: string;
  expiresAt: string | null;
  refreshExpiresAt: string | null;
}

export interface NuevoToken {
  idUsuario: number;
  nombre: string;
  hashAcceso: string;
  hashRefresh: string;
  expiresAt: string;
  refreshExpiresAt: string;
  ahora: string;
}

const campos = {
  id: tokensAcceso.id,
  idUsuario: tokensAcceso.tokenableId,
  nombre: tokensAcceso.name,
  hash: tokensAcceso.token,
  expiresAt: tokensAcceso.expiresAt,
  refreshExpiresAt: tokensAcceso.refreshExpiresAt,
};

/** llx_personal_access_tokens (compatible con Sanctum de apipos). */
@Injectable()
export class TokensRepositorio {
  constructor(@Inject(LEGACY_DB) private readonly db: LegacyDb) {}

  private async buscarUno(condicion: ReturnType<typeof eq>): Promise<TokenAcceso | null> {
    const [fila] = await this.db
      .select(campos)
      .from(tokensAcceso)
      .where(and(eq(tokensAcceso.tokenableType, TIPO_TOKENABLE), condicion))
      .limit(1);
    return fila ?? null;
  }

  buscarPorId(id: number): Promise<TokenAcceso | null> {
    return this.buscarUno(eq(tokensAcceso.id, id));
  }

  buscarPorHashAcceso(hash: string): Promise<TokenAcceso | null> {
    return this.buscarUno(eq(tokensAcceso.token, hash));
  }

  buscarPorHashRefresh(hash: string): Promise<TokenAcceso | null> {
    return this.buscarUno(eq(tokensAcceso.refreshToken, hash));
  }

  /** Un token por dispositivo: borra los anteriores del mismo device_name. */
  async eliminarDeDispositivo(
    ej: LegacyEjecutor,
    idUsuario: number,
    nombre: string,
  ): Promise<void> {
    await ej
      .delete(tokensAcceso)
      .where(
        and(
          eq(tokensAcceso.tokenableType, TIPO_TOKENABLE),
          eq(tokensAcceso.tokenableId, idUsuario),
          eq(tokensAcceso.name, nombre),
        ),
      );
  }

  /** Borra un token. Devuelve cuántas filas borró (0 si otro proceso ya lo hizo). */
  async eliminar(ej: LegacyEjecutor, id: number): Promise<number> {
    const [resultado] = await ej.delete(tokensAcceso).where(eq(tokensAcceso.id, id));
    return resultado.affectedRows;
  }

  async crear(ej: LegacyEjecutor, t: NuevoToken): Promise<void> {
    await ej.insert(tokensAcceso).values({
      tokenableType: TIPO_TOKENABLE,
      tokenableId: t.idUsuario,
      name: t.nombre,
      token: t.hashAcceso,
      refreshToken: t.hashRefresh,
      abilities: '["*"]',
      expiresAt: t.expiresAt,
      refreshExpiresAt: t.refreshExpiresAt,
      deviceId: t.nombre,
      createdAt: t.ahora,
      updatedAt: t.ahora,
    });
  }

  /** Igual que Sanctum: registra el último uso del token. */
  async marcarUso(id: number, ahora: string): Promise<void> {
    await this.db.update(tokensAcceso).set({ lastUsedAt: ahora }).where(eq(tokensAcceso.id, id));
  }
}
