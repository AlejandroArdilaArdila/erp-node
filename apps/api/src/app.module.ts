import { Module } from '@nestjs/common';
import { DatabaseModule } from '@erp/database';
import { ConfigModule, LoggingModule } from '@erp/shared';
import { AuthHttpModule } from './auth/auth-http.module.js';
import { ConfiguracionHttpModule } from './configuracion/configuracion-http.module.js';
import { HealthModule } from './health/health.module.js';
import { MensajesHttpModule } from './mensajes/mensajes-http.module.js';
import { PosModule } from './pos/pos.module.js';
import { ProductosHttpModule } from './productos/productos-http.module.js';

/**
 * Raíz de la API. Aquí solo se registran módulos HTTP (controladores);
 * la lógica de negocio vive en libs/domain y se importa desde cada módulo HTTP.
 */
@Module({
  imports: [
    ConfigModule.forRoot(),
    LoggingModule,
    DatabaseModule,
    HealthModule,
    AuthHttpModule,
    PosModule,
    ProductosHttpModule,
    MensajesHttpModule,
    ConfiguracionHttpModule,
  ],
})
export class AppModule {}
