import { Module } from '@nestjs/common';
import { AlmacenesRepositorio } from './almacenes.repositorio.js';
import { AlmacenesService } from './almacenes.service.js';

/** Dominio inventario: almacenes, stock y toma física. Por ahora, los almacenes. */
@Module({
  providers: [AlmacenesRepositorio, AlmacenesService],
  exports: [AlmacenesService],
})
export class InventarioModule {}
