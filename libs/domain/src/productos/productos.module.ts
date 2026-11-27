import { Module } from '@nestjs/common';
import { AuthModule } from '@erp/domain/auth';
import { CategoriasRepositorio } from './categorias.repositorio.js';
import { CategoriasService } from './categorias.service.js';

/**
 * Dominio productos: productos, categorías, precios, códigos de barra, packs
 * y variantes. Por ahora solo las categorías.
 */
@Module({
  imports: [AuthModule],
  providers: [CategoriasRepositorio, CategoriasService],
  exports: [CategoriasService],
})
export class ProductosModule {}
