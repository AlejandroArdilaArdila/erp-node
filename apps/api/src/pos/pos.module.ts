import { Module } from '@nestjs/common';
import { PosController } from './pos.controller.js';

@Module({ controllers: [PosController] })
export class PosModule {}
