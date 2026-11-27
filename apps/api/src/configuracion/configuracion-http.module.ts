import { Module } from '@nestjs/common';
import { AuthModule } from '@erp/domain/auth';
import { ConfiguracionModule } from '@erp/domain/configuracion';
import { ConfiguracionController } from './configuracion.controller.js';

@Module({
  imports: [AuthModule, ConfiguracionModule],
  controllers: [ConfiguracionController],
})
export class ConfiguracionHttpModule {}
