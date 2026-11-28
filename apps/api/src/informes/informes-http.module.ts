import { Module } from '@nestjs/common';
import { AuthModule } from '@erp/domain/auth';
import { InformesModule } from '@erp/domain/informes';
import { DashboardsController } from './dashboards.controller.js';

@Module({
  imports: [AuthModule, InformesModule],
  controllers: [DashboardsController],
})
export class InformesHttpModule {}
