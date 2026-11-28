import { Injectable } from '@nestjs/common';
import { type Almacen, AlmacenesRepositorio } from './almacenes.repositorio.js';

/** Elemento de GET /api.php/integrospos/pos/almacenes/jerarquia (contrato apipos). */
export interface SucursalLegado {
  id: number;
  nombre: string;
  hijos: Array<{ id: number; nombre: string }>;
}

@Injectable()
export class AlmacenesService {
  constructor(private readonly almacenes: AlmacenesRepositorio) {}

  /**
   * Réplica de ConfiguracionService::almacenesJerarquia (apipos): sucursales
   * (almacenes abiertos sin padre) con sus almacenes hijos abiertos, todo en
   * orden de ref.
   *
   * Igual que el original, solo hay dos niveles: un almacén cuyo padre está
   * cerrado, o cuyo padre es a su vez hijo de otro, no aparece en el resultado.
   */
  async jerarquia(): Promise<SucursalLegado[]> {
    const abiertos = await this.almacenes.abiertos();

    const hijosPorPadre = new Map<number, Almacen[]>();
    for (const almacen of abiertos) {
      if (almacen.idPadre > 0) {
        const hijos = hijosPorPadre.get(almacen.idPadre) ?? [];
        hijos.push(almacen);
        hijosPorPadre.set(almacen.idPadre, hijos);
      }
    }

    return abiertos
      .filter((a) => a.idPadre <= 0)
      .map((sucursal) => ({
        id: sucursal.id,
        nombre: sucursal.nombre,
        hijos: (hijosPorPadre.get(sucursal.id) ?? []).map((h) => ({ id: h.id, nombre: h.nombre })),
      }));
  }
}
