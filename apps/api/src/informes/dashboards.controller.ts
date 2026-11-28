import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { ApiKeyGuard } from '@erp/domain/auth';
import {
  type DashboardDetalleLegado,
  type DashboardListadoLegado,
  DashboardsService,
  idDeRuta,
} from '@erp/domain/informes';
import { phpEntero } from '@erp/shared';

/** Dashboards dinámicos (módulo informes). Mantiene las URLs de apipos. */
@ApiTags('Dashboards')
@ApiSecurity('DolApiKey')
@Controller('api.php/informes/dashboarddinamico/dashboards')
@UseGuards(ApiKeyGuard)
export class DashboardsController {
  constructor(private readonly dashboards: DashboardsService) {}

  /** Portado de DashboardController@dashboards (apipos). */
  @Get()
  @ApiOperation({ summary: 'Dashboards propios de user_id y los publicos' })
  @ApiQuery({ name: 'user_id', required: false })
  @ApiResponse({ status: 200, description: '{ total, dashboards: [...] }' })
  listar(
    @Query('user_id') idUsuario: unknown,
  ): Promise<{ total: number; dashboards: DashboardListadoLegado[] }> {
    // (int) $request->query('user_id', 0)
    return this.dashboards.listar(phpEntero(idUsuario ?? 0));
  }

  /** Portado de DashboardController@detalle (apipos). */
  @Get(':id')
  @ApiOperation({ summary: 'Metadatos y tabs de un dashboard' })
  @ApiResponse({ status: 404, description: '{ "error": "Dashboard no encontrado" }' })
  detalle(@Param('id') id: string): Promise<DashboardDetalleLegado> {
    return this.dashboards.detalle(idDeRuta(id));
  }
}
