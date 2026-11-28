import { Module } from '@nestjs/common';
import { AuthModule } from '@erp/domain/auth';
import { TercerosModule } from '@erp/domain/terceros';
import { TercerosController } from './terceros.controller.js';

@Module({
  imports: [AuthModule, TercerosModule],
  controllers: [TercerosController],
})
export class TercerosHttpModule {}
