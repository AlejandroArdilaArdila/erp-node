import { Inject, Injectable } from '@nestjs/common';
import { auditoriaPos, LEGACY_DB, type LegacyDb, logsErroresPos } from '@erp/database';
import { sql } from 'drizzle-orm';

/** Valor tal como lo enlaza Laravel (ver phpValorEnlazado): texto, número o null. */
export type ValorCliente = string | number | null;

/** Parámetro enlazado sin conversión de tipo, como hace Eloquent con lo que manda el cliente. */
const crudo = (valor: ValorCliente) => sql`${valor}`;

export interface ErrorEndpointNuevo {
  deviceid: ValorCliente;
  idUsuario: number | null;
  metodo: string;
  url: string;
  statusCode: number;
  tiempoMs: number | null;
  requestBody: ValorCliente;
  responseBody: ValorCliente;
  /** 'Y-m-d H:i:s' */
  fechaCliente: string;
  /** 'Y-m-d H:i:s' (created_at y updated_at) */
  registradoEn: string;
}

export interface EventoAuditoriaNuevo {
  idLocal: number | null;
  /** 'Y-m-d H:i:s.u' */
  fechaEvento: string;
  modulo: string;
  accion: string;
  usuarioId: number | null;
  usuarioNombre: ValorCliente;
  entidadTipo: string;
  entidadId: ValorCliente;
  tipoDocumento: ValorCliente;
  datosAntesJson: ValorCliente;
  datosDespuesJson: ValorCliente;
  descripcion: ValorCliente;
  fkCajaLocal: ValorCliente;
  total: ValorCliente;
  subtotal: ValorCliente;
  iva: ValorCliente;
  items: number | null;
}

/**
 * Escritura de los registros que sube el POS (llx_pos_logs_errores y
 * llx_pos_auditoria). Cada uno es un solo INSERT, sin transacción.
 */
@Injectable()
export class RegistrosPosRepositorio {
  constructor(@Inject(LEGACY_DB) private readonly db: LegacyDb) {}

  async insertarErrorEndpoint(e: ErrorEndpointNuevo): Promise<void> {
    await this.db.insert(logsErroresPos).values({
      deviceid: crudo(e.deviceid),
      fkUser: e.idUsuario,
      metodo: e.metodo,
      url: e.url,
      statusCode: e.statusCode,
      tiempoMs: e.tiempoMs,
      requestBody: crudo(e.requestBody),
      responseBody: crudo(e.responseBody),
      fechaCliente: e.fechaCliente,
      createdAt: e.registradoEn,
      updatedAt: e.registradoEn,
    });
  }

  async insertarAuditoria(a: EventoAuditoriaNuevo): Promise<void> {
    await this.db.insert(auditoriaPos).values({
      idLocal: a.idLocal,
      fechaEvento: a.fechaEvento,
      modulo: a.modulo,
      accion: a.accion,
      usuarioId: a.usuarioId,
      usuarioNombre: crudo(a.usuarioNombre),
      entidadTipo: a.entidadTipo,
      entidadId: crudo(a.entidadId),
      tipoDocumento: crudo(a.tipoDocumento),
      datosAntesJson: crudo(a.datosAntesJson),
      datosDespuesJson: crudo(a.datosDespuesJson),
      descripcion: crudo(a.descripcion),
      fkCajaLocal: crudo(a.fkCajaLocal),
      total: crudo(a.total),
      subtotal: crudo(a.subtotal),
      iva: crudo(a.iva),
      items: a.items,
    });
  }
}
