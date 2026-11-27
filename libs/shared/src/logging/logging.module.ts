import { randomUUID } from 'node:crypto';
import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { AppConfig } from '../config/app-config.js';
import { serializarErrorSeguro } from './serializar-error.js';

/**
 * Logs JSON estructurados (pino). Cada petición lleva un `requestId`
 * (header X-Request-Id si viene, si no un UUID) que también se devuelve
 * en la respuesta de error.
 *
 * NUNCA se registran credenciales: los headers y campos sensibles se
 * reemplazan por "[oculto]".
 */
@Module({
  imports: [
    LoggerModule.forRootAsync({
      inject: [AppConfig],
      useFactory: (config: AppConfig) => ({
        pinoHttp: {
          level: config.nivelLog,
          base: { tenant: config.tenant },
          genReqId: (req, res) => {
            const entrante = req.headers['x-request-id'];
            const id =
              typeof entrante === 'string' && entrante.length <= 100 ? entrante : randomUUID();
            res.setHeader('X-Request-Id', id);
            return id;
          },
          redact: {
            paths: [
              'req.headers.dolapikey',
              'req.headers.authorization',
              'req.headers["x-api-key"]',
              'req.headers.cookie',
              'req.query.DOLAPIKEY',
              'req.query.api_key',
              'req.query.apiKey',
              '*.password',
              '*.api_key',
              '*.APIKEY',
              '*.access_token',
              '*.refresh_token',
            ],
            censor: '[oculto]',
          },
          serializers: { err: serializarErrorSeguro },
          autoLogging: { ignore: (req) => req.url?.endsWith('/health') ?? false },
          transport:
            config.entorno === 'development'
              ? {
                  target: 'pino-pretty',
                  options: { singleLine: true, translateTime: 'SYS:HH:MM:ss' },
                }
              : undefined,
        },
      }),
    }),
  ],
})
export class LoggingModule {}
