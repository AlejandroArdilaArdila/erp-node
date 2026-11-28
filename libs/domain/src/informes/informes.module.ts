import { Module } from '@nestjs/common';
import { AuthModule } from '@erp/domain/auth';
import { DashboardsRepositorio } from './dashboards.repositorio.js';
import { DashboardsService } from './dashboards.service.js';

/** Dominio informes: dashboards dinámicos y consultas. Por ahora, el listado y detalle de dashboards. */
@Module({
  imports: [AuthModule],
  providers: [DashboardsRepositorio, DashboardsService],
  exports: [DashboardsService],
})
export class InformesModule {}
