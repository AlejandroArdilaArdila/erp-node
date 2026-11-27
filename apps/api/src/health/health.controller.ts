import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SaludBaseDatos } from '@erp/database';

@ApiTags('Salud')
@Controller('health')
export class HealthController {
  constructor(private readonly salud: SaludBaseDatos) {}

  @Get()
  @ApiOperation({ summary: 'Liveness: el proceso está vivo (no toca la base de datos)' })
  vivo() {
    return { ok: true };
  }

  @Get('ready')
  @ApiOperation({ summary: 'Readiness: la API puede atender (base de datos accesible)' })
  async listo() {
    const legado = await this.salud.verificarLegado();
    const cuerpo = { ok: legado.ok, baseDatos: { legado } };
    if (!legado.ok) {
      throw new ServiceUnavailableException(cuerpo);
    }
    return cuerpo;
  }
}
