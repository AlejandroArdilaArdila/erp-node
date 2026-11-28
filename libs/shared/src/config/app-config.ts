import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from './env.schema.js';

export interface LegacyDbConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  prefijo: string;
  poolSize: number;
}

/**
 * Acceso tipado a la configuración. Inyectar `AppConfig` en vez de leer
 * `process.env` directamente: así todo pasa por la validación de env.schema.ts.
 */
@Injectable()
export class AppConfig {
  constructor(private readonly config: ConfigService<Env, true>) {}

  private get<K extends keyof Env>(clave: K): Env[K] {
    return this.config.get(clave, { infer: true });
  }

  get entorno(): Env['NODE_ENV'] {
    return this.get('NODE_ENV');
  }

  /** Cliente (tenant) de este proceso. */
  get tenant(): string {
    return this.get('TENANT_ID');
  }

  get esProduccion(): boolean {
    return this.entorno === 'production';
  }

  get http() {
    return {
      host: this.get('HOST'),
      puerto: this.get('PORT'),
      prefijo: this.get('API_PREFIX'),
    };
  }

  get swagger() {
    return {
      habilitado: this.get('SWAGGER_ENABLED'),
      usuario: this.get('SWAGGER_USER'),
      password: this.get('SWAGGER_PASSWORD'),
    };
  }

  get nivelLog(): Env['LOG_LEVEL'] {
    return this.get('LOG_LEVEL');
  }

  get legacyDb(): LegacyDbConfig {
    return {
      host: this.get('LEGACY_DB_HOST'),
      port: this.get('LEGACY_DB_PORT'),
      database: this.get('LEGACY_DB_NAME'),
      user: this.get('LEGACY_DB_USER'),
      password: this.get('LEGACY_DB_PASSWORD'),
      prefijo: this.get('LEGACY_DB_PREFIX'),
      poolSize: this.get('LEGACY_DB_POOL_SIZE'),
    };
  }

  get dolibarrInstanceKey(): string {
    return this.get('DOLIBARR_INSTANCE_KEY');
  }

  /** URL base de los instaladores del POS de escritorio (APP_URL de apipos). */
  get urlBaseActualizacionPos(): string {
    return this.get('POS_ACTUALIZACION_URL_BASE');
  }

  /** Carpeta "documents" de Dolibarr (DOL_DOCUMENTS_ROOT de apipos). */
  get dolibarrDocumentsRoot(): string {
    return this.get('DOL_DOCUMENTS_ROOT');
  }
}
