import { Module } from '@nestjs/common';
import { AuthModule } from '@erp/domain/auth';
import { ConfiguracionModule } from '@erp/domain/configuracion';
import { InventarioModule } from '@erp/domain/inventario';
import { ConfiguracionController } from './configuracion.controller.js';

@Module({
  imports: [AuthModule, ConfiguracionModule, InventarioModule],
  controllers: [ConfiguracionController],
})
export class ConfiguracionHttpModule {}
