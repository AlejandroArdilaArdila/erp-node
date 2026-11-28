import { Module } from '@nestjs/common';
import { CajaService } from './caja.service.js';
import { RegistrosPosRepositorio } from './registros-pos.repositorio.js';
import { RegistrosPosService } from './registros-pos.service.js';
import { TerminalesRepositorio } from './terminales.repositorio.js';

/** Dominio POS: terminales, apertura y cierre de caja, y los registros que sube el POS. */
@Module({
  providers: [TerminalesRepositorio, CajaService, RegistrosPosRepositorio, RegistrosPosService],
  exports: [CajaService, RegistrosPosService],
})
export class PosDominioModule {}
