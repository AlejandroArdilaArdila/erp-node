import type { ModuleMetadata, Provider } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module.js';
import { configurarApp } from '../src/configurar-app.js';

export interface OpcionesAppPrueba {
  /** Providers a reemplazar: [ClaseOriginal, valorFalso]. */
  reemplazos?: Array<[Provider | symbol | (abstract new (...args: never[]) => unknown), unknown]>;
  /** Módulos extra solo para el test (p. ej. un controlador protegido de prueba). */
  imports?: ModuleMetadata['imports'];
}

/** Levanta la API completa (mismo pipeline que main.ts) para tests e2e. */
export async function crearAppPrueba({ reemplazos = [], imports = [] }: OpcionesAppPrueba = {}) {
  let builder = Test.createTestingModule({ imports: [AppModule, ...imports] });
  for (const [token, valor] of reemplazos) {
    builder = builder.overrideProvider(token).useValue(valor);
  }
  const modulo = await builder.compile();
  const app = modulo.createNestApplication<NestExpressApplication>({ bufferLogs: true });
  configurarApp(app);
  await app.init();
  return app;
}
