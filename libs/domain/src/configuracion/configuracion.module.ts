import { Module } from '@nestjs/common';
import { CiudadesRepositorio } from './ciudades.repositorio.js';
import { ConfiguracionPosService } from './configuracion-pos.service.js';
import { ConstantesRepositorio } from './constantes.repositorio.js';
import { ConstantesService } from './constantes.service.js';

/**
 * Dominio configuración: constantes de Dolibarr (llx_const), catálogos
 * generales (ciudades DIAN) y la configuración que consume el POS.
 */
@Module({
  providers: [
    ConstantesRepositorio,
    CiudadesRepositorio,
    ConstantesService,
    ConfiguracionPosService,
  ],
  exports: [ConstantesService, ConfiguracionPosService],
})
export class ConfiguracionModule {}
