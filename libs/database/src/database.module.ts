import { Global, Inject, Injectable, Module, type OnApplicationShutdown } from '@nestjs/common';
import { AppConfig } from '@erp/shared';
import { drizzle } from 'drizzle-orm/mysql2';
import { createPool, type Pool } from 'mysql2/promise';
import * as esquemaLegado from './legacy/schema/index.js';
import { LEGACY_DB, LEGACY_DB_POOL } from './legacy/legacy-db.js';
import { BloqueosLegado } from './legacy/bloqueos.js';
import { ConsultasPdoLegado } from './legacy/consultas-pdo.js';
import { SaludBaseDatos } from './salud-base-datos.js';
import { TransaccionesLegado } from './transactions/transacciones-legado.service.js';

@Injectable()
class CierrePool implements OnApplicationShutdown {
  constructor(@Inject(LEGACY_DB_POOL) private readonly pool: Pool) {}

  async onApplicationShutdown(): Promise<void> {
    await this.pool.end();
  }
}

/**
 * Conexiones a base de datos. Hoy: MySQL de Dolibarr (fuente de verdad
 * durante las fases 1-5). PostgreSQL se agrega aquí cuando entre
 * (ver PLAN_MIGRACION_ERP_NODE.md §2).
 */
@Global()
@Module({
  providers: [
    {
      provide: LEGACY_DB_POOL,
      inject: [AppConfig],
      useFactory: (config: AppConfig): Pool => {
        const db = config.legacyDb;
        return createPool({
          host: db.host,
          port: db.port,
          user: db.user,
          password: db.password,
          database: db.database,
          connectionLimit: db.poolSize,
          waitForConnections: true,
          queueLimit: 0,
          connectTimeout: 10_000,
          enableKeepAlive: true,
          charset: 'utf8mb4',
          timezone: 'local',
          // Fechas como texto 'YYYY-MM-DD HH:mm:ss' (hora local), igual que PHP/PDO:
          // sin conversiones de zona horaria. Ver docs/adr/0003.
          dateStrings: true,
          // DECIMAL llega como string: el dinero NUNCA se maneja como float.
          decimalNumbers: false,
          supportBigNumbers: true,
          bigNumberStrings: true,
        });
      },
    },
    {
      provide: LEGACY_DB,
      inject: [LEGACY_DB_POOL],
      useFactory: (pool: Pool) => drizzle({ client: pool, schema: esquemaLegado, mode: 'default' }),
    },
    TransaccionesLegado,
    BloqueosLegado,
    ConsultasPdoLegado,
    SaludBaseDatos,
    CierrePool,
  ],
  exports: [LEGACY_DB, TransaccionesLegado, BloqueosLegado, ConsultasPdoLegado, SaludBaseDatos],
})
export class DatabaseModule {}
