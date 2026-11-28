import { Module } from '@nestjs/common';
import { AuthModule } from '@erp/domain/auth';
import { PosDominioModule } from '@erp/domain/pos';
import { PosController } from './pos.controller.js';

@Module({
  imports: [AuthModule, PosDominioModule],
  controllers: [PosController],
})
export class PosModule {}
