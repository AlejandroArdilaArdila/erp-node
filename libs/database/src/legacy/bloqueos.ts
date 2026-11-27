import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import type { LegacyTx } from './legacy-db.js';

/**
 * Bloqueo con nombre de MySQL (GET_LOCK), dentro de una transacción.
 *
 * Sirve para serializar una operación por "cosa" (p. ej. el login de un
 * usuario) aunque todavía no exista una fila que bloquear. No necesita
 * permisos sobre ninguna tabla. El nombre se prefija con la base de datos
 * porque los bloqueos con nombre son globales del servidor MySQL.
 *
 * Se libera siempre al terminar, aunque `trabajo` falle.
 */
@Injectable()
export class BloqueosLegado {
  async conBloqueo<T>(
    tx: LegacyTx,
    nombre: string,
    trabajo: () => Promise<T>,
    esperaSegundos = 5,
  ): Promise<T> {
    const clave = sql`CONCAT(DATABASE(), ':', ${nombre})`;
    const [filas] = await tx.execute<{ ok: number | string | null }>(
      sql`SELECT GET_LOCK(${clave}, ${esperaSegundos}) AS ok`,
    );
    // GET_LOCK devuelve BIGINT y el pool usa bigNumberStrings: llega como '1', no como 1.
    // 0 = se agotó la espera; NULL = error en MySQL.
    const ok = (filas as unknown as Array<{ ok: number | string | null }>)[0]?.ok;
    if (ok === null || ok === undefined || Number(ok) !== 1) {
      throw new ServiceUnavailableException('Operación en curso, intente de nuevo.');
    }
    try {
      return await trabajo();
    } finally {
      await tx.execute(sql`SELECT RELEASE_LOCK(${clave})`);
    }
  }
}
