import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { ApiKeyGuard } from '@erp/domain/auth';
import {
  type ActualizacionPosLegado,
  ConfiguracionPosService,
  type DepartamentosYCiudadesLegado,
} from '@erp/domain/configuracion';

/**
 * Configuración que consume el POS. Mantiene las URLs de apipos
 * (ConfiguracionController); todas requieren DOLAPIKEY.
 */
@ApiTags('Configuracion')
@ApiSecurity('DolApiKey')
@Controller('api.php/integrospos')
@UseGuards(ApiKeyGuard)
export class ConfiguracionController {
  constructor(private readonly configuracion: ConfiguracionPosService) {}

  /** Portado de ConfiguracionController@departamentosYCiudades (apipos). */
  @Get('customers/posapi/departamentos')
  @ApiOperation({
    summary: 'Departamentos y ciudades (con codigo DIAN) para formularios de domicilio',
  })
  @ApiResponse({ status: 200, description: 'Listado de departamentos y ciudades activos' })
  departamentosYCiudades(): Promise<DepartamentosYCiudadesLegado> {
    return this.configuracion.departamentosYCiudades();
  }

  /** Portado de ConfiguracionController@verificarActualizacion (apipos). */
  @Get('pos/update/check')
  @ApiOperation({
    summary: 'Version/build/changelog disponible del POS de escritorio, con sus URLs de descarga',
  })
  @ApiResponse({ status: 200, description: 'Datos de la ultima version publicada' })
  @ApiResponse({ status: 404, description: 'No hay una actualización configurada' })
  verificarActualizacion(): Promise<ActualizacionPosLegado> {
    return this.configuracion.verificarActualizacion();
  }
}
