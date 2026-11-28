import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { ApiKeyGuard } from '@erp/domain/auth';
import {
  type ActualizacionPosLegado,
  type CatalogosProductoLegado,
  ConfiguracionPosService,
  type DepartamentosYCiudadesLegado,
} from '@erp/domain/configuracion';
import { AlmacenesService, type SucursalLegado } from '@erp/domain/inventario';

/**
 * Configuración que consume el POS. Mantiene las URLs de apipos
 * (ConfiguracionController); todas requieren DOLAPIKEY.
 */
@ApiTags('Configuracion')
@ApiSecurity('DolApiKey')
@Controller('api.php/integrospos')
@UseGuards(ApiKeyGuard)
export class ConfiguracionController {
  constructor(
    private readonly configuracion: ConfiguracionPosService,
    private readonly almacenes: AlmacenesService,
  ) {}

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

  /** Portado de ConfiguracionController@categorieIva (apipos). */
  @Get('pos/getCategorieIva')
  @ApiOperation({
    summary:
      'Catalogos del formulario de producto: tarifas de IVA, categorias, unidades de peso y volumen',
  })
  @ApiResponse({ status: 200, description: 'Catalogos para crear productos desde el POS' })
  catalogosProducto(): Promise<CatalogosProductoLegado> {
    return this.configuracion.catalogosProducto();
  }

  /** Portado de ConfiguracionController@almacenesJerarquia (apipos). */
  @Get('pos/almacenes/jerarquia')
  @ApiOperation({
    summary: 'Jerarquia de almacenes: sucursales (almacenes padre) con sus almacenes hijos',
  })
  @ApiResponse({ status: 200, description: 'Listado de sucursales con sus almacenes hijos' })
  almacenesJerarquia(): Promise<SucursalLegado[]> {
    return this.almacenes.jerarquia();
  }
}
