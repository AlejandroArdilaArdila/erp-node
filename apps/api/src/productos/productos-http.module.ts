import { Module } from '@nestjs/common';
import { AuthModule } from '@erp/domain/auth';
import { ProductosModule } from '@erp/domain/productos';
import { ProductosController } from './productos.controller.js';

@Module({
  imports: [AuthModule, ProductosModule],
  controllers: [ProductosController],
})
export class ProductosHttpModule {}
