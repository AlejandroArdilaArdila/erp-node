import { Module } from '@nestjs/common';
import { AuthModule } from '@erp/domain/auth';
import { ProductosModule } from '@erp/domain/productos';
import { ProductosPosController } from './productos-pos.controller.js';
import { ProductosController } from './productos.controller.js';

@Module({
  imports: [AuthModule, ProductosModule],
  controllers: [ProductosController, ProductosPosController],
})
export class ProductosHttpModule {}
