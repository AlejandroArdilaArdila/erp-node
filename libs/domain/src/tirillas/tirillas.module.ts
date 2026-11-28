import { Module } from '@nestjs/common';
import { TirillasRepositorio } from './tirillas.repositorio.js';
import { TirillasService } from './tirillas.service.js';

/** Dominio tirillas: plantillas, secciones y variables de las tirillas del POS. */
@Module({
  providers: [TirillasRepositorio, TirillasService],
  exports: [TirillasService],
})
export class TirillasModule {}
