import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { ApiKeyGuard } from '@erp/domain/auth';
import { TirillasService } from '@erp/domain/tirillas';
import { responderJsonPhp } from '@erp/shared';
import type { Response } from 'express';

/**
 * Plantillas de tirilla del POS. Mantiene las URLs de apipos
 * (TicketTemplateController). Las respuestas llevan JSON guardado en la base,
 * así que se escriben como json_encode de PHP (orden de claves y números).
 */
@ApiTags('Tirillas')
@ApiSecurity('DolApiKey')
@Controller('api.php/integrospos/tickettemplate')
@UseGuards(ApiKeyGuard)
export class TirillasController {
  constructor(private readonly tirillas: TirillasService) {}

  @Post('tipos')
  @HttpCode(200)
  @ApiOperation({ summary: 'Lista los tipos de tirilla (plantillas) disponibles' })
  async tipos(@Res() res: Response): Promise<void> {
    responderJsonPhp(res, await this.tirillas.tipos());
  }

  @Post('get')
  @HttpCode(200)
  @ApiOperation({ summary: 'Configuracion completa de un tipo de tirilla, por nombre' })
  @ApiBody({ schema: { example: { nombre: 'factura_pos' } } })
  @ApiResponse({ status: 401, description: 'nombre requerido / Tipo no encontrado' })
  async configuracion(
    @Body() cuerpo: Record<string, unknown> | undefined,
    @Query() query: Record<string, unknown>,
    @Res() res: Response,
  ): Promise<void> {
    // Como $request->input() de Laravel: query + cuerpo (el cuerpo gana).
    responderJsonPhp(res, await this.tirillas.configuracion({ ...query, ...(cuerpo ?? {}) }));
  }

  @Post('variables')
  @HttpCode(200)
  @ApiOperation({ summary: 'Variables de campo disponibles en las tirillas' })
  async variables(@Res() res: Response): Promise<void> {
    responderJsonPhp(res, await this.tirillas.variables());
  }

  @Post('secciones')
  @HttpCode(200)
  @ApiOperation({ summary: 'Secciones reutilizables de tirilla' })
  async secciones(@Res() res: Response): Promise<void> {
    responderJsonPhp(res, await this.tirillas.secciones());
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Plantilla de tirilla por rowid o por nombre (todas si id es 0 o null)',
  })
  @ApiResponse({ status: 401, description: 'Plantilla no encontrada' })
  async plantilla(@Param('id') id: string, @Res() res: Response): Promise<void> {
    responderJsonPhp(res, await this.tirillas.plantillaPorIdONombre(id));
  }
}
