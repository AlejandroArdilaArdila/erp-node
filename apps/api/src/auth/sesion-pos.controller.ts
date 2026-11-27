import { Body, Controller, Get, Headers, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiHeader,
  ApiOperation,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import {
  ApiKeyGuard,
  type RespuestaLegado,
  SesionPosService,
  TokenAccesoGuard,
  tokenBearer,
  UsuarioActual,
  type UsuarioAutenticado,
} from '@erp/domain/auth';
import type { Request, Response } from 'express';

function enviar(res: Response, r: RespuestaLegado): void {
  res.status(r.status).json(r.cuerpo);
}

/**
 * Sesión del POS (Flutter). Mismas rutas y respuestas que AuthController de apipos.
 * El cuerpo crudo de login.php lo prepara configurar-app.ts (express.text).
 */
@ApiTags('Auth POS')
@Controller()
export class SesionPosController {
  constructor(private readonly sesiones: SesionPosService) {}

  @Post('custom/integrospos/login.php')
  @ApiOperation({ summary: 'Inicia sesión del POS y emite access/refresh token' })
  @ApiBody({
    schema: {
      example: {
        login: 'cajero1',
        password: '***',
        device_name: 'caja-1',
        ip: '192.168.1.20',
        version: '4.4.81',
      },
    },
  })
  async login(@Req() req: Request, @Res() res: Response): Promise<void> {
    const crudo = typeof req.body === 'string' ? req.body : '';
    enviar(res, await this.sesiones.login(crudo, req.ip ?? null));
  }

  @Post('custom/integrospos/refresh')
  @ApiOperation({ summary: 'Renueva la sesión (rota access y refresh token)' })
  @ApiBody({ schema: { example: { refresh_token: '…' } } })
  async refresh(@Body() cuerpo: unknown, @Res() res: Response): Promise<void> {
    enviar(res, await this.sesiones.refresh(cuerpo));
  }

  @Get('custom/integrospos/me')
  @UseGuards(TokenAccesoGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Datos del usuario dueño del access token' })
  async me(@UsuarioActual() usuario: UsuarioAutenticado) {
    return this.sesiones.perfil(usuario.id);
  }

  @Post('custom/integrospos/logout')
  @ApiOperation({ summary: 'Cierra la sesión (por access token o DOLAPIKEY)' })
  @ApiHeader({ name: 'DOLAPIKEY', required: false })
  async logout(
    @Headers('authorization') autorizacion: string | undefined,
    @Headers('dolapikey') apiKey: string | undefined,
    @Body() cuerpo: Record<string, unknown> | undefined,
    @Query() query: Record<string, unknown>,
    @Res() res: Response,
  ): Promise<void> {
    enviar(
      res,
      await this.sesiones.logout({
        bearer: tokenBearer(autorizacion),
        accessTokenCampo: cuerpo?.access_token ?? query.access_token,
        apiKey: apiKey ?? '',
      }),
    );
  }

  @Post('api.php/integrospos/terminales/integrosTokenOpen')
  @UseGuards(ApiKeyGuard)
  @ApiSecurity('DolApiKey')
  @ApiOperation({ summary: 'Actualiza IP, versión y servidor local de la sesión del dispositivo' })
  async tokenOpen(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Body() cuerpo: Record<string, unknown> | undefined,
    @Query() query: Record<string, unknown>,
    @Res() res: Response,
  ): Promise<void> {
    // Como $request->all() de Laravel: query + cuerpo (el cuerpo gana).
    enviar(res, await this.sesiones.registrarActividad(usuario, { ...query, ...(cuerpo ?? {}) }));
  }
}
