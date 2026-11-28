import { Body, Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { ApiKeyGuard } from '@erp/domain/auth';
import { type ProveedorAsignado, TercerosService } from '@erp/domain/terceros';

/** Terceros de integrosone (negociación con proveedores). Mantiene las URLs de apipos. */
@ApiTags('Terceros')
@ApiSecurity('DolApiKey')
@Controller('api.php/integrosone/negociacion')
@UseGuards(ApiKeyGuard)
export class TercerosController {
  constructor(private readonly terceros: TercerosService) {}

  /** Portado de ClientesController@getProveedores (apipos). */
  @Get('proveedores')
  @ApiOperation({ summary: 'Proveedores activos, con busqueda por nombre o NIT' })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'limit', required: false, example: 100 })
  @ApiResponse({ status: 200, description: '[{ id, nombre, rif, telefono }] por nombre' })
  proveedores(
    @Query() query: Record<string, unknown>,
    @Body() cuerpo: Record<string, unknown> | undefined,
  ): Promise<ProveedorAsignado[]> {
    // Como $request->input() de Laravel: query + cuerpo (el cuerpo gana).
    return this.terceros.proveedores({ ...query, ...(cuerpo ?? {}) });
  }
}
