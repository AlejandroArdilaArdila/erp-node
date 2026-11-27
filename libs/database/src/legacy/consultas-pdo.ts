import { Inject, Injectable } from '@nestjs/common';
import type { Pool, TypeCast } from 'mysql2/promise';
import { LEGACY_DB_POOL } from './legacy-db.js';

/**
 * Tipos como los entrega PDO (PHP 8.1+) a Laravel, para endpoints que
 * devuelven filas crudas (p. ej. un modelo Eloquent serializado):
 *  - enteros y flotantes → number (BIGINT fuera de rango seguro → string)
 *  - DECIMAL, fechas, JSON, TEXT → string (PDO no interpreta JSON)
 */
export const typeCastComoPdo: TypeCast = (campo, siguiente) => {
  switch (campo.type) {
    case 'JSON':
    case 'NEWDECIMAL':
    case 'DECIMAL':
    case 'BLOB':
    case 'TINY_BLOB':
    case 'MEDIUM_BLOB':
    case 'LONG_BLOB':
    case 'DATE':
    case 'DATETIME':
    case 'TIMESTAMP':
    case 'TIME':
      return campo.string();
    case 'LONGLONG': {
      const valor = campo.string();
      if (valor === null) return null;
      const numero = Number(valor);
      return Number.isSafeInteger(numero) ? numero : valor;
    }
    default:
      return siguiente();
  }
};

/**
 * Consultas SQL crudas con tipos compatibles con PDO. Usar SOLO cuando el
 * contrato legado devuelve filas completas; lo normal es Drizzle.
 */
@Injectable()
export class ConsultasPdoLegado {
  constructor(@Inject(LEGACY_DB_POOL) private readonly pool: Pool) {}

  async filas(sql: string, valores: unknown[] = []): Promise<Array<Record<string, unknown>>> {
    const [filas] = await this.pool.query({ sql, values: valores, typeCast: typeCastComoPdo });
    return filas as Array<Record<string, unknown>>;
  }
}
