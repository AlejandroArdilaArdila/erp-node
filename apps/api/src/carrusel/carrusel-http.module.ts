import { Module } from '@nestjs/common';
import { AuthModule } from '@erp/domain/auth';
import { CarruselModule } from '@erp/domain/carrusel';
import { CarruselController } from './carrusel.controller.js';

@Module({
  imports: [AuthModule, CarruselModule],
  controllers: [CarruselController],
})
export class CarruselHttpModule {}
