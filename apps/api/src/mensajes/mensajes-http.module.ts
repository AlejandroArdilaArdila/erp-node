import { Module } from '@nestjs/common';
import { AuthModule } from '@erp/domain/auth';
import { MensajesModule } from '@erp/domain/mensajes';
import { MensajesController } from './mensajes.controller.js';

@Module({
  imports: [AuthModule, MensajesModule],
  controllers: [MensajesController],
})
export class MensajesHttpModule {}
