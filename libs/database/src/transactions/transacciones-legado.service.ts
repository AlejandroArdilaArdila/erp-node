import { Inject, Injectable, Logger } from '@nestjs/common';
import { LEGACY_DB, type LegacyDb, type LegacyTx } from '../legacy/legacy-db.js';
import { conReintentoPorBloqueo } from './transaccion.js';

/**
 * Única forma aprobada de abrir una transacción sobre la base legado.
 *
 *   await this.transacciones.ejecutar(async (tx) => {
 *     await tx.update(...)...
 *   });
 *
 * - Nivel de aislamiento READ COMMITTED (menos gap locks que el
 *   REPEATABLE READ por defecto de InnoDB).
 * - Reintenta automáticamente ante deadlock / lock wait timeout.
 * - Reglas: transacción corta, sin llamadas externas adentro, bloquear filas
 *   ordenadas por id. Ver docs/adr/0004-concurrencia.md.
 */
@Injectable()
export class TransaccionesLegado {
  private readonly logger = new Logger(TransaccionesLegado.name);

  constructor(@Inject(LEGACY_DB) private readonly db: LegacyDb) {}

  ejecutar<T>(trabajo: (tx: LegacyTx) => Promise<T>): Promise<T> {
    return conReintentoPorBloqueo(
      () => this.db.transaction(trabajo, { isolationLevel: 'read committed' }),
      {
        alReintentar: ({ intento, motivo }) =>
          this.logger.warn(`Transacción reintentada (intento ${intento}) por ${motivo}`),
      },
    );
  }
}
