import { Controller, Get, Res, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { ApiKeyGuard } from '@erp/domain/auth';
import { SorteosService } from '@erp/domain/sorteos';
import { responderJsonPhp } from '@erp/shared';
import type { Response } from 'express';

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
  async vigentesYProximos(@Res() res: Response): Promise<void> {
    // fk_clientes y fk_productos son JSON de la base: se escriben como json_encode de PHP.
    responderJsonPhp(res, await this.sorteos.vigentesYProximos());
  }
}
