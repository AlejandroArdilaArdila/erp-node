import { Body, Controller, Get, HttpCode, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { ApiKeyGuard } from '@erp/domain/auth';
import { RegistrosPosService } from '@erp/domain/pos';
import { entradaLaravel } from '@erp/shared';

/**
 * Rutas del POS. Mantienen las URLs de apipos (`/api.php/integrospos/...`)
 * para que los POS no cambien nada al pasar a erp-node.
 */
@ApiTags('POS')
@Controller('api.php/integrospos')
export class PosController {
  constructor(private readonly registros: RegistrosPosService) {}

  /** Portado de UsuariosController@ping (apipos). */
  @Get('pos/ping')
  @ApiOperation({ summary: 'Healthcheck liviano del POS: 200 inmediato, sin tocar la base' })
  ping() {
    return { ok: true };
  }

  /** Portado de LogErrorEndpointController@registrarErrorEndpoint (apipos). */
  @Post('logs/registrarErrorEndpoint')
  @HttpCode(201)
  @UseGuards(ApiKeyGuard)
  @ApiSecurity('DolApiKey')
  @ApiOperation({ summary: 'Registra un error de API (status >= 400) reportado por el POS' })
  @ApiBody({
    schema: {
      example: {
        deviceid: 'DESKTOP-CAJA01_192.168.1.50',
        metodo: 'POST',
        url: '/api/api.php/integrospos/pos/ticket/payment',
        status_code: 500,
        fecha: '2026-11-28T10:15:30.123',
      },
    },
  })
  @ApiResponse({ status: 201, description: '{ ok: true }' })
  @ApiResponse({ status: 401, description: 'DOLAPIKEY inválida o falta un campo obligatorio' })
  async registrarErrorEndpoint(
    @Query() query: unknown,
    @Body() cuerpo: unknown,
  ): Promise<{ ok: true }> {
    await this.registros.registrarErrorEndpoint(entradaLaravel(query, cuerpo));
    return { ok: true };
  }

  /** Portado de LogErrorEndpointController@registrarAuditoria (apipos). */
  @Post('pos/auditoria')
  @HttpCode(201)
  @UseGuards(ApiKeyGuard)
  @ApiSecurity('DolApiKey')
  @ApiOperation({ summary: 'Registra un evento de auditoria de la cola local del POS' })
  @ApiResponse({ status: 201, description: '{ ok: true, id: <id local> }' })
  @ApiResponse({ status: 401, description: 'DOLAPIKEY inválida o falta un campo obligatorio' })
  registrarAuditoria(
    @Query() query: unknown,
    @Body() cuerpo: unknown,
  ): Promise<{ ok: true; id: number | null }> {
    return this.registros.registrarAuditoria(entradaLaravel(query, cuerpo));
  }
}
