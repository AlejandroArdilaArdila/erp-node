import { Body, Controller, HttpCode, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { ApiKeyGuard } from '@erp/domain/auth';
import { type MensajeLegado, MensajesService } from '@erp/domain/mensajes';

/** Chat de vendedores de integrosone. Mantiene la URL de apipos. */
@ApiTags('Mensajes')
@ApiSecurity('DolApiKey')
@Controller('api.php/integrosone')
@UseGuards(ApiKeyGuard)
export class MensajesController {
  constructor(private readonly mensajes: MensajesService) {}

  /** Portado de MensajeController@getMensajes (apipos). */
  @Post('mensajes')
  @HttpCode(200)
  @ApiOperation({
    summary:
      'Mensajes del chat de vendedores por usuario (emisor, receptor o difusion) y opcionalmente por fecha',
  })
  @ApiBody({ schema: { example: { user: 5, fecha: '2026-07-16' } } })
  @ApiResponse({ status: 200, description: 'Mensajes ordenados por fecha ascendente' })
  @ApiResponse({ status: 401, description: "DOLAPIKEY invalida o falta el campo 'user'" })
  listar(
    @Body() cuerpo: Record<string, unknown> | undefined,
    @Query() query: Record<string, unknown>,
  ): Promise<MensajeLegado[]> {
    // Como $request->input() de Laravel: query + cuerpo (el cuerpo gana).
    return this.mensajes.listar({ ...query, ...(cuerpo ?? {}) });
  }
}
