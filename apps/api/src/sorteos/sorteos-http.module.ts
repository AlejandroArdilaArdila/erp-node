import { Module } from '@nestjs/common';
import { AuthModule } from '@erp/domain/auth';
import { SorteosModule } from '@erp/domain/sorteos';
import { SorteosController } from './sorteos.controller.js';

@Module({
  imports: [AuthModule, SorteosModule],
  controllers: [SorteosController],
})
export class SorteosHttpModule {}
