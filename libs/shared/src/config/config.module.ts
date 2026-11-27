import { type DynamicModule, Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { Reloj } from '../tiempo/reloj.js';
import { AppConfig } from './app-config.js';
import { validarEnv } from './env.schema.js';

/**
 * Registrar una sola vez, en el módulo raíz de cada app:
 *
 *   imports: [ConfigModule.forRoot(), ...]
 *
 * El archivo .env se carga en `cargar-env.ts` (primer import de main.ts);
 * aquí solo se valida process.env. Si algo falta, la app no arranca.
 */
@Module({})
export class ConfigModule {
  static forRoot(): DynamicModule {
    return {
      module: ConfigModule,
      global: true,
      imports: [NestConfigModule.forRoot({ ignoreEnvFile: true, validate: validarEnv })],
      // Reloj va aquí por ser transversal y global, igual que la configuración.
      providers: [AppConfig, Reloj],
      exports: [AppConfig, Reloj],
    };
  }
}
