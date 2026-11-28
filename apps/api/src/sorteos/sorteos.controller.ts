import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { ApiKeyGuard } from '@erp/domain/auth';
import { type SorteosPosLegado, SorteosService } from '@erp/domain/sorteos';

/** Sorteos del POS. Mantiene las URLs de apipos. */
@ApiTags('Sorteos')
@ApiSecurity('DolApiKey')
@Controller('api.php/integrospos/sorteos')
@UseGuards(ApiKeyGuard)
export class SorteosController {
  constructor(private readonly sorteos: SorteosService) {}

  /**
   * Portado de SorteosController@getSorteos (apipos), rama GET. La rama POST
   * (listado paginado para la grilla) no aplica: la ruta de apipos es solo GET.
   */
  @Get('getSorteos')
  @ApiOperation({ summary: 'Sorteos activos vigentes hoy y proximos, para el POS' })
  @ApiResponse({ status: 200, description: '{ vigentes: [...], proximos: [...] }' })
  vigentesYProximos(): Promise<SorteosPosLegado> {
    return this.sorteos.vigentesYProximos();
  }
}
