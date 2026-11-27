import { Injectable } from '@nestjs/common';
import { formatearFecha, inicioDelDia, leerFechaHora, Reloj } from '@erp/shared';
import { type TerminalPos, TerminalesRepositorio } from './terminales.repositorio.js';

export interface EstadoCaja {
  /** Debe abrir caja (no hay apertura abierta ni de hoy). */
  apertura: boolean;
  /** Tiene una caja abierta de un día anterior que debe cerrar. */
  cierre: boolean;
  /** Puede seguir vendiendo. */
  continuar: boolean;
}

const MS_POR_DIA = 86_400_000;

@Injectable()
export class CajaService {
  constructor(
    private readonly terminales: TerminalesRepositorio,
    private readonly reloj: Reloj,
  ) {}

  terminalDeUsuario(idUsuario: number): Promise<TerminalPos | null> {
    return this.terminales.terminalDeUsuario(idUsuario);
  }

  /**
   * Réplica de AuthService::estadoCaja (apipos). Diferencia deliberada: "hoy"
   * se calcula en hora local (como guarda Dolibarr), no en UTC como apipos.
   */
  async estadoCaja(idUsuario: number): Promise<EstadoCaja> {
    const hoy = inicioDelDia(this.reloj.ahora());
    const apertura = await this.terminales.aperturaRelevante(idUsuario, formatearFecha(hoy));
    if (!apertura) {
      return { apertura: true, cierre: false, continuar: true };
    }

    const diaApertura = inicioDelDia(leerFechaHora(apertura.fechaApertura));
    const dias = Math.abs(Math.round((hoy.getTime() - diaApertura.getTime()) / MS_POR_DIA));

    if (apertura.estado === 1 && dias >= 1) {
      return { apertura: false, cierre: true, continuar: false };
    }
    if (apertura.estado === 2) {
      return { apertura: false, cierre: false, continuar: false };
    }
    return { apertura: false, cierre: false, continuar: true };
  }
}
