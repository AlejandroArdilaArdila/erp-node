import { Injectable } from '@nestjs/common';
import { ConstantesRepositorio } from './constantes.repositorio.js';

/** Entidad global (0) y entidad del cliente (1), en ese orden. */
const ENTIDADES = [0, 1];

@Injectable()
export class ConstantesService {
  constructor(private readonly constantes: ConstantesRepositorio) {}

  /**
   * Valores de las constantes pedidas (llx_const). Si una constante existe en
   * la entidad 0 (global) y en la 1, gana la 1, igual que `Conf::setValues()`
   * de Dolibarr y `Configuracion::valores()` de apipos. Las que no existen
   * no aparecen en el mapa.
   */
  async valores(nombres: string[]): Promise<Map<string, string>> {
    const filas = await this.constantes.porNombres(nombres, ENTIDADES);
    // Ordenadas por entidad: la última asignación (entidad 1) sobreescribe a la 0.
    return new Map(filas.map((f) => [f.nombre, f.valor]));
  }
}
