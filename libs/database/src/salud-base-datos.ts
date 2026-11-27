import { Inject, Injectable } from '@nestjs/common';
import type { Pool } from 'mysql2/promise';
import { LEGACY_DB_POOL } from './legacy/legacy-db.js';

export interface EstadoBaseDatos {
  ok: boolean;
  latenciaMs?: number;
  error?: string;
}

/** Verificación de conectividad para /health/ready. */
@Injectable()
export class SaludBaseDatos {
  constructor(@Inject(LEGACY_DB_POOL) private readonly pool: Pool) {}

  async verificarLegado(timeoutMs = 2_000): Promise<EstadoBaseDatos> {
    const inicio = performance.now();
    try {
      await this.pool.query({ sql: 'SELECT 1', timeout: timeoutMs });
      return { ok: true, latenciaMs: Math.round(performance.now() - inicio) };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
  }
}
