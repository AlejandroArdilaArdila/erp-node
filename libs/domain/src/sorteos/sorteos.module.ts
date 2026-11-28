import { Module } from '@nestjs/common';
import { SorteosRepositorio } from './sorteos.repositorio.js';
import { SorteosService } from './sorteos.service.js';

/** Dominio sorteos: sorteos del POS y boletos de participación. */
@Module({
  providers: [SorteosRepositorio, SorteosService],
  exports: [SorteosService],
})
export class SorteosModule {}
