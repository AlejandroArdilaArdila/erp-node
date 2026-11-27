import { Module } from '@nestjs/common';
import { AuthModule } from '@erp/domain/auth';
import { MensajesRepositorio } from './mensajes.repositorio.js';
import { MensajesService } from './mensajes.service.js';

/** Dominio mensajes: chat entre vendedores (llx_chat_vendedor). */
@Module({
  imports: [AuthModule],
  providers: [MensajesRepositorio, MensajesService],
  exports: [MensajesService],
})
export class MensajesModule {}
