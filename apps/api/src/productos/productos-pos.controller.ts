import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { ApiKeyGuard } from '@erp/domain/auth';
import { type CodigoOperativoLegado, CodigosOperativosService } from '@erp/domain/productos';

/** Rutas de productos del POS (integrospos). Mantienen las URLs de apipos. */
@ApiTags('Productos POS')
@ApiSecurity('DolApiKey')
@Controller('api.php/integrospos/products')
@UseGuards(ApiKeyGuard)
export class ProductosPosController {
  constructor(private readonly codigosOperativos: CodigosOperativosService) {}

  /** Portado de CodigoOperativoController@getCodigosOperativos (apipos). */
  @Get('codigosOperativos')
  @ApiOperation({ summary: 'Codigos operativos activos con su producto o servicio asociado' })
  @ApiResponse({ status: 200, description: 'Codigos ordenados del mas reciente al mas antiguo' })
  listarCodigosOperativos(): Promise<CodigoOperativoLegado[]> {
    return this.codigosOperativos.activos();
  }
}
