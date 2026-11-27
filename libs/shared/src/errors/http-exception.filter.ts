import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { mensajeSeguro, serializarErrorSeguro } from '../logging/serializar-error.js';

/**
 * Formato de error compatible con apipos (Laravel), que los POS ya saben leer
 * y suben a pos_logs_errores:
 *
 *   { "message": "texto" }                      ← errores normales
 *   { "message": "...", "errors": {campo: []} } ← validación (422)
 *
 * Además se agrega `requestId` para cruzar el error del POS con el log del
 * servidor. Los errores inesperados (500) NO exponen detalles internos en
 * producción; el detalle completo queda en el log.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('HttpExceptionFilter');

  constructor(private readonly exponerDetalles: boolean) {}

  catch(excepcion: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request & { id?: string | number }>();
    const requestId = req.id !== undefined ? String(req.id) : undefined;

    // Errores del parser de cuerpo (JSON mal formado, cuerpo muy grande). Nest los
    // envuelve en una HttpException con el original en `cause`; su mensaje es interno
    // y en inglés, así que se responde un texto propio.
    const origen = (excepcion instanceof HttpException ? excepcion.cause : excepcion) as
      { status?: unknown; type?: unknown } | undefined;
    const MENSAJES_PARSER: Record<string, string> = {
      'entity.parse.failed': 'El cuerpo de la petición no es un JSON válido.',
      'entity.too.large': 'El cuerpo de la petición es demasiado grande.',
    };
    if (typeof origen?.type === 'string' && origen.type in MENSAJES_PARSER) {
      const status = typeof origen.status === 'number' ? origen.status : HttpStatus.BAD_REQUEST;
      res.status(status).json({ message: MENSAJES_PARSER[origen.type], requestId });
      return;
    }

    if (excepcion instanceof HttpException) {
      const status = excepcion.getStatus();
      const cuerpo = excepcion.getResponse();
      res.status(status).json({ ...this.normalizar(cuerpo, excepcion.message), requestId });
      return;
    }

    this.logger.error(
      { err: excepcion, requestId, ruta: `${req.method} ${req.originalUrl}` },
      'Error no controlado',
    );

    const error = excepcion instanceof Error ? excepcion : new Error(String(excepcion));
    const seguro = serializarErrorSeguro(error);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      message: this.exponerDetalles ? mensajeSeguro(error) : 'Error interno del servidor.',
      requestId,
      ...(this.exponerDetalles && {
        exception: error.name,
        stack: (seguro.stack as string | undefined)?.split('\n'),
      }),
    });
  }

  /**
   * - string → { message }
   * - cuerpo por defecto de Nest ({ statusCode, message, error }) → { message }
   * - cualquier otro objeto (cuerpo legado, p. ej. { error: 'CREDENCIALES INVALIDAS' })
   *   → se devuelve TAL CUAL, para respetar el contrato de apipos.
   */
  private normalizar(cuerpo: string | object, mensajePorDefecto: string): Record<string, unknown> {
    if (typeof cuerpo === 'string') {
      return { message: cuerpo };
    }
    const objeto = cuerpo as Record<string, unknown>;
    if (!('statusCode' in objeto)) {
      return objeto;
    }
    const mensaje = Array.isArray(objeto.message)
      ? objeto.message.join(' ')
      : typeof objeto.message === 'string'
        ? objeto.message
        : mensajePorDefecto;
    return { message: mensaje };
  }
}
