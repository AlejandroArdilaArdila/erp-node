import { Injectable, Module } from '@nestjs/common';
import { type ProveedorAsignado, TercerosRepositorio } from './terceros.repositorio.js';

@Injectable()
export class TercerosService {
  constructor(private readonly repositorio: TercerosRepositorio) {}

  /** Réplica de AuthService::proveedoresAsignados (apipos). */
  proveedoresAsignados(idUsuario: number): Promise<ProveedorAsignado[]> {
    return this.repositorio.proveedoresAsignados(idUsuario);
  }
}

/** Dominio terceros: clientes, proveedores y sus asignaciones. */
@Module({
  providers: [TercerosRepositorio, TercerosService],
  exports: [TercerosService],
})
export class TercerosModule {}
