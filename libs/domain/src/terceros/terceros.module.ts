import { Injectable, Module } from '@nestjs/common';
import { phpEntero, phpString, phpTrim } from '@erp/shared';
import { type ProveedorAsignado, TercerosRepositorio } from './terceros.repositorio.js';

@Injectable()
export class TercerosService {
  constructor(private readonly repositorio: TercerosRepositorio) {}

  /** Réplica de AuthService::proveedoresAsignados (apipos). */
  proveedoresAsignados(idUsuario: number): Promise<ProveedorAsignado[]> {
    return this.repositorio.proveedoresAsignados(idUsuario);
  }

  /**
   * Réplica de ClientesService::proveedores (apipos), para
   * GET /api.php/integrosone/negociacion/proveedores. `entrada` es
   * `$request->input()`: `search` (opcional) y `limit` (`(int)`; 0 o negativo → 100).
   */
  proveedores(entrada: Record<string, unknown>): Promise<ProveedorAsignado[]> {
    const busqueda = phpTrim(phpString(entrada.search ?? ''));
    const limite = phpEntero(entrada.limit ?? 100);
    return this.repositorio.proveedoresActivos(
      busqueda === '' ? null : busqueda,
      limite > 0 ? limite : 100,
    );
  }
}

/** Dominio terceros: clientes, proveedores y sus asignaciones. */
@Module({
  providers: [TercerosRepositorio, TercerosService],
  exports: [TercerosService],
})
export class TercerosModule {}
