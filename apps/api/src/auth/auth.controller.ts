import { Controller, Headers, HttpCode, Post } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiKeyService } from '@erp/domain/auth';

@ApiTags('Auth')
@Controller('custom/integrospos')
export class AuthController {
  constructor(private readonly apiKeys: ApiKeyService) {}

  /**
   * Portado de UsuariosController@validateApiKey (apipos).
   * Siempre responde 200; el resultado va en `ok`.
   */
  @Post('validateApiKey')
  @HttpCode(200)
  @ApiOperation({ summary: 'Indica si una DOLAPIKEY pertenece a un usuario activo' })
  @ApiHeader({ name: 'DOLAPIKEY', required: true })
  validarApiKey(@Headers('dolapikey') apiKey?: string) {
    return this.apiKeys.validar(apiKey ?? '');
  }
}
