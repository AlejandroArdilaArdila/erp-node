import { Module } from '@nestjs/common';
import { CajaService } from './caja.service.js';
import { TerminalesRepositorio } from './terminales.repositorio.js';

/** Dominio POS: terminales, apertura y cierre de caja. */
@Module({
  providers: [TerminalesRepositorio, CajaService],
  exports: [CajaService],
})
export class PosDominioModule {}
