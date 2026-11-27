import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import {
  AppConfig,
  crearValidationPipe,
  HttpExceptionFilter,
  protegerConBasicAuth,
  quitarSlashFinal,
} from '@erp/shared';
import express from 'express';
import { Logger } from 'nestjs-pino';

/**
 * Configuración HTTP común. La usan main.ts Y los tests e2e, para que los
 * tests prueben exactamente el mismo pipeline que producción.
 */
export function configurarApp(app: NestExpressApplication): void {
  const config = app.get(AppConfig);

  app.useLogger(app.get(Logger));
  app.set('trust proxy', 'loopback'); // Apache hace de proxy inverso en el mismo servidor
  app.disable('x-powered-by'); // no anunciar Express
  app.use(quitarSlashFinal);
  // login.php lee el cuerpo CRUDO (como getContent() de Laravel) para responder
  // su propio error de JSON. Se registra antes que el parser JSON global de Nest.
  app.use(
    `/${config.http.prefijo}/custom/integrospos/login.php`,
    express.text({ type: () => true, limit: '1mb' }),
  );
  app.setGlobalPrefix(config.http.prefijo);
  app.useGlobalPipes(crearValidationPipe());
  app.useGlobalFilters(new HttpExceptionFilter(!config.esProduccion));
  app.enableShutdownHooks();

  if (config.swagger.habilitado) {
    // Protege la página (/api/docs) y el JSON (/api/docs-json) ANTES de montarlos.
    const { usuario, password } = config.swagger;
    const proteger = protegerConBasicAuth(usuario, password, 'erp-node docs');
    app.use(`/${config.http.prefijo}/docs`, proteger);
    app.use(`/${config.http.prefijo}/docs-json`, proteger);

    const documento = new DocumentBuilder()
      .setTitle('erp-node API')
      .setDescription('API del ERP Integros365 (reemplazo progresivo de apipos)')
      .setVersion('0.1.0')
      .addApiKey({ type: 'apiKey', in: 'header', name: 'DOLAPIKEY' }, 'DolApiKey')
      .build();
    SwaggerModule.setup(`${config.http.prefijo}/docs`, app, () =>
      SwaggerModule.createDocument(app, documento),
    );
  }
}
