import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { ApiKeyGuard } from '@erp/domain/auth';
import { type CarruselLegado, CarruselService } from '@erp/domain/carrusel';

/** Carrusel del Price Checker. Mantiene la URL de apipos. */
@ApiTags('Carrusel')
@ApiSecurity('DolApiKey')
@Controller('api.php/integrospos/carrusel')
@UseGuards(ApiKeyGuard)
export class CarruselController {
  constructor(private readonly carrusel: CarruselService) {}

  /** Portado de CarruselController@activas (apipos). */
  @Get('activas')
  @ApiOperation({ summary: 'Imagenes del carrusel vigentes hoy, en base64' })
  @ApiResponse({ status: 200, description: '{ total, imagenes: [...] }' })
  activas(): Promise<CarruselLegado> {
    return this.carrusel.activas();
  }
}
