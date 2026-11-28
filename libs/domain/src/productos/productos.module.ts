import { Module } from '@nestjs/common';
import { AuthModule } from '@erp/domain/auth';
import { CategoriasRepositorio } from './categorias.repositorio.js';
import { CategoriasService } from './categorias.service.js';
import { CodigosOperativosRepositorio } from './codigos-operativos.repositorio.js';
import { CodigosOperativosService } from './codigos-operativos.service.js';

/**
 * Dominio productos: productos, categorías, precios, códigos de barra, packs
 * y variantes. Por ahora, categorías y códigos operativos del POS.
 */
@Module({
  imports: [AuthModule],
  providers: [
    CategoriasRepositorio,
    CategoriasService,
    CodigosOperativosRepositorio,
    CodigosOperativosService,
  ],
  exports: [CategoriasService, CodigosOperativosService],
})
export class ProductosModule {}
