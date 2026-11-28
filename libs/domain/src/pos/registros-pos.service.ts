import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import {
  carbonParse,
  type FechaPhp,
  laravelFilled,
  phpEntero,
  phpEsFalso,
  phpEsNumerico,
  phpTrim,
  phpValorEnlazado,
  Reloj,
} from '@erp/shared';
import { RegistrosPosRepositorio } from './registros-pos.repositorio.js';

/** apipos responde 401 (no 422) en todas las validaciones de estos endpoints. */
function rechazo(mensaje: string): HttpException {
  return new HttpException({ message: mensaje }, HttpStatus.UNAUTHORIZED);
}

/**
 * `(string) $valor` de PHP para lo que llega en la entrada. Un array da "Array"
 * con un warning que Laravel convierte en excepción: apipos responde 500.
 */
function texto(valor: unknown): string {
  if (valor === null || valor === undefined || valor === false) return '';
  if (valor === true) return '1';
  if (typeof valor === 'string') return valor;
  if (typeof valor === 'number') return String(valor);
  throw new Error('Array to string conversion (500 en apipos)');
}

/** `(int) $valor` para lo que llega en la entrada (un array da 1 si no está vacío). */
function entero(valor: unknown): number {
  if (Array.isArray(valor)) return valor.length > 0 ? 1 : 0;
  if (valor !== null && typeof valor === 'object') return Object.keys(valor).length > 0 ? 1 : 0;
  return phpEntero(valor);
}

/** `$request->filled($clave) ? (int) $request->input($clave) : null` */
function enteroOpcional(entrada: Record<string, unknown>, clave: string): number | null {
  return laravelFilled(entrada, clave) ? entero(entrada[clave]) : null;
}

/** `strtoupper()` de PHP 8: solo letras ASCII. */
function mayusculasAscii(valor: string): string {
  return valor.replace(/[a-z]/g, (c) => c.toUpperCase());
}

/** Validación de `fecha`: obligatoria (`!$fecha`) y con formato de fecha (Carbon::parse). */
function fechaObligatoria(valor: unknown): FechaPhp {
  if (phpEsFalso(valor)) {
    throw rechazo("El campo 'fecha' es obligatorio.");
  }
  const fecha = carbonParse(texto(valor));
  if (!fecha) {
    throw rechazo("El campo 'fecha' no es una fecha valida.");
  }
  return fecha;
}

/** 'Y-m-d H:i:s' de la hora UTC: apipos corre con app.timezone = 'UTC'. */
function ahoraUtc(fecha: Date): string {
  return fecha.toISOString().slice(0, 19).replace('T', ' ');
}

/**
 * Réplica de LogErrorEndpointService (apipos): registros que sube el POS en
 * su ciclo de sincronización. `entrada` es `entradaLaravel(query, cuerpo)`
 * (textos recortados y vacíos en null, como los middlewares de Laravel).
 */
@Injectable()
export class RegistrosPosService {
  constructor(
    private readonly registros: RegistrosPosRepositorio,
    private readonly reloj: Reloj,
  ) {}

  /**
   * POST /api.php/integrospos/logs/registrarErrorEndpoint: error de API
   * (status >= 400) interceptado por el LoggingClient del POS.
   *
   * created_at/updated_at quedan con la hora UTC, igual que los guardaba
   * Eloquent en apipos (app.timezone = 'UTC').
   */
  async registrarErrorEndpoint(entrada: Record<string, unknown>): Promise<void> {
    const metodo = mayusculasAscii(phpTrim(texto(entrada.metodo ?? '')));
    const url = phpTrim(texto(entrada.url ?? ''));
    const statusCode = entrada.status_code;

    if (metodo === '') throw rechazo("El campo 'metodo' es obligatorio.");
    if (url === '') throw rechazo("El campo 'url' es obligatorio.");
    if (!phpEsNumerico(statusCode) || entero(statusCode) < 400) {
      throw rechazo("El campo 'status_code' es obligatorio y debe ser >= 400.");
    }
    const fecha = fechaObligatoria(entrada.fecha);

    await this.registros.insertarErrorEndpoint({
      deviceid: phpValorEnlazado(entrada.deviceid),
      idUsuario: enteroOpcional(entrada, 'fk_user'),
      metodo,
      url,
      statusCode: entero(statusCode),
      tiempoMs: enteroOpcional(entrada, 'tiempo_ms'),
      requestBody: phpValorEnlazado(entrada.request_body),
      responseBody: phpValorEnlazado(entrada.response_body),
      fechaCliente: fecha.fechaHora,
      registradoEn: ahoraUtc(this.reloj.ahora()),
    });
  }

  /**
   * POST /api.php/integrospos/pos/auditoria: evento de auditoría genérico de la
   * cola local del POS. `id` es el id LOCAL (SQLite) de la terminal y se guarda
   * como id_local. Responde { ok: true, id } con ese mismo id.
   */
  async registrarAuditoria(
    entrada: Record<string, unknown>,
  ): Promise<{ ok: true; id: number | null }> {
    const modulo = phpTrim(texto(entrada.modulo ?? ''));
    const accion = phpTrim(texto(entrada.accion ?? ''));
    const entidadTipo = phpTrim(texto(entrada.entidad_tipo ?? ''));
    const idLocal = enteroOpcional(entrada, 'id');

    if (modulo === '') throw rechazo("El campo 'modulo' es obligatorio.");
    if (accion === '') throw rechazo("El campo 'accion' es obligatorio.");
    if (entidadTipo === '') throw rechazo("El campo 'entidad_tipo' es obligatorio.");
    const fecha = fechaObligatoria(entrada.fecha);

    await this.registros.insertarAuditoria({
      idLocal,
      fechaEvento: fecha.conMicrosegundos,
      modulo,
      accion,
      usuarioId: enteroOpcional(entrada, 'usuario_id'),
      usuarioNombre: phpValorEnlazado(entrada.usuario_nombre),
      entidadTipo,
      entidadId: phpValorEnlazado(entrada.entidad_id),
      tipoDocumento: phpValorEnlazado(entrada.tipo_documento),
      datosAntesJson: phpValorEnlazado(entrada.datos_antes_json),
      datosDespuesJson: phpValorEnlazado(entrada.datos_despues_json),
      descripcion: phpValorEnlazado(entrada.descripcion),
      fkCajaLocal: phpValorEnlazado(entrada.fk_caja_local),
      total: phpValorEnlazado(entrada.total),
      subtotal: phpValorEnlazado(entrada.subtotal),
      iva: phpValorEnlazado(entrada.iva),
      items: enteroOpcional(entrada, 'items'),
    });

    return { ok: true, id: idLocal };
  }
}
