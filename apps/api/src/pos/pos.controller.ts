import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

/**
 * Rutas del POS. Mantienen las URLs de apipos (`/api.php/integrospos/...`)
 * para que los POS no cambien nada al pasar a erp-node.
 */
@ApiTags('POS')
@Controller('api.php/integrospos')
export class PosController {
  /** Portado de UsuariosController@ping (apipos). */
  @Get('pos/ping')
  @ApiOperation({ summary: 'Healthcheck liviano del POS: 200 inmediato, sin tocar la base' })
  ping() {
    return { ok: true };
  }
}
