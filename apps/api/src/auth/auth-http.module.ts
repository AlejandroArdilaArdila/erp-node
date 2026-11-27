import { Module } from '@nestjs/common';
import { AuthModule } from '@erp/domain/auth';
import { AuthController } from './auth.controller.js';
import { SesionPosController } from './sesion-pos.controller.js';

@Module({
  imports: [AuthModule],
  controllers: [AuthController, SesionPosController],
})
export class AuthHttpModule {}
