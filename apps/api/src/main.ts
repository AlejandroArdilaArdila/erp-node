import '@erp/shared/cargar-env'; // ← SIEMPRE el primer import (carga .env y TZ)
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppConfig } from '@erp/shared';
import { AppModule } from './app.module.js';
import { configurarApp } from './configurar-app.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  configurarApp(app);

  const { host, puerto } = app.get(AppConfig).http;
  await app.listen(puerto, host);
}

await bootstrap();
