import { Module } from '@nestjs/common';
import { CarruselArchivos } from './carrusel.archivos.js';
import { CarruselRepositorio } from './carrusel.repositorio.js';
import { CarruselService } from './carrusel.service.js';

/** Dominio carrusel: imágenes del carrusel del Price Checker del POS. */
@Module({
  providers: [CarruselRepositorio, CarruselArchivos, CarruselService],
  exports: [CarruselService],
})
export class CarruselModule {}
