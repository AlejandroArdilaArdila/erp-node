import { Injectable } from '@nestjs/common';
import { phpFalso, phpJsonDecode, phpTrim } from '@erp/shared';
import { type Sorteo, SorteosRepositorio } from './sorteos.repositorio.js';

/** Sorteo en GET /api.php/integrospos/sorteos/getSorteos (contrato apipos). */
export interface SorteoPosLegado {
  rowid: number;
  descripcion: string | null;
  premio: string | null;
  /** dd/mm/aaaa */
  fecha_inicio: string | null;
  fecha_final: string | null;
  /** aaaa-mm-dd */
  fecha_inicio_raw: string | null;
  fecha_final_raw: string | null;
  compra_minimo: number;
  valor_participacion: number;
  tipo_cliente: string;
  tipo_calculo: string;
  observacion: string | null;
  permitir_entregar_sin_ctrl: number;
  fk_clientes: unknown;
  fk_productos: unknown;
}

export interface SorteosPosLegado {
  vigentes: SorteoPosLegado[];
  proximos: SorteoPosLegado[];
}

/** `checkdate($mes, $dia, $anio)` de PHP. */
function fechaValida(anio: number, mes: number, dia: number): boolean {
  if (anio < 1 || anio > 32767 || mes < 1 || mes > 12 || dia < 1) return false;
  // Date.UTC con el día 0 del mes siguiente da el último día del mes (años bisiestos incluidos).
  const fecha = new Date(Date.UTC(2000, mes, 0));
  fecha.setUTCFullYear(anio, mes, 0);
  return dia <= fecha.getUTCDate();
}

/**
 * `soloFecha()` de SorteosService (apipos): 'aaaa-mm-dd' o 'dd/mm/aaaa' al
 * inicio del texto, si es una fecha real; si no, ''.
 */
export function soloFecha(valor: string): string {
  const texto = phpTrim(valor);
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(texto);
  if (m && fechaValida(Number(m[1]), Number(m[2]), Number(m[3]))) {
    return `${m[1]}-${m[2]}-${m[3]}`;
  }
  m = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(texto);
  if (m && fechaValida(Number(m[3]), Number(m[2]), Number(m[1]))) {
    return `${m[3]}-${m[2]}-${m[1]}`;
  }
  return '';
}

/** `json_decode($json ?? '[]', true) ?: []` de apipos. */
function listaJson(json: string | null): unknown {
  const valor = phpJsonDecode(json ?? '[]');
  return phpFalso(valor) ? [] : valor;
}

function formatear(sorteo: Sorteo): SorteoPosLegado {
  const inicio = soloFecha(sorteo.fechaInicio);
  const final = soloFecha(sorteo.fechaFinal);
  // date('d/m/Y', strtotime('aaaa-mm-dd')) solo reordena una fecha ya validada.
  const comoDiaMesAnio = (f: string) => `${f.slice(8, 10)}/${f.slice(5, 7)}/${f.slice(0, 4)}`;
  return {
    rowid: sorteo.id,
    descripcion: sorteo.descripcion,
    premio: sorteo.premio,
    fecha_inicio: inicio !== '' ? comoDiaMesAnio(inicio) : null,
    fecha_final: final !== '' ? comoDiaMesAnio(final) : null,
    fecha_inicio_raw: inicio || null,
    fecha_final_raw: final || null,
    compra_minimo: sorteo.compraMinimo,
    valor_participacion: sorteo.valorParticipacion,
    tipo_cliente: sorteo.tipoCliente,
    tipo_calculo: sorteo.tipoCalculo,
    observacion: sorteo.observacion,
    permitir_entregar_sin_ctrl: sorteo.permitirEntregarSinCtrl,
    fk_clientes: listaJson(sorteo.clientesJson),
    fk_productos: listaJson(sorteo.productosJson),
  };
}

@Injectable()
export class SorteosService {
  constructor(private readonly sorteos: SorteosRepositorio) {}

  /**
   * Réplica de SorteosService::listarVigentesYProximos (apipos), la respuesta
   * de GET getSorteos para el POS: sorteos activos vigentes hoy y próximos.
   */
  async vigentesYProximos(): Promise<SorteosPosLegado> {
    const vigentes = await this.sorteos.vigentes();
    const proximos = await this.sorteos.proximos();
    return { vigentes: vigentes.map(formatear), proximos: proximos.map(formatear) };
  }
}
