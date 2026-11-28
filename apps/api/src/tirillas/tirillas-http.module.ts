import { Module } from '@nestjs/common';
import { AuthModule } from '@erp/domain/auth';
import { TirillasModule } from '@erp/domain/tirillas';
import { TirillasController } from './tirillas.controller.js';

@Module({
  imports: [AuthModule, TirillasModule],
  controllers: [TirillasController],
})
export class TirillasHttpModule {}
