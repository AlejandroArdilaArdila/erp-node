import { existsSync } from 'node:fs';

/**
 * Carga `.env` en process.env ANTES de que se evalúe cualquier otro módulo.
 * Debe ser el primer import de cada `main.ts`:
 *
 *   import '@erp/shared/cargar-env';   // ← siempre primero
 *
 * Así TZ y las variables que se leen al importar (p. ej. el prefijo de
 * tablas legado) ya están disponibles. Las variables ya definidas en el
 * entorno (PM2, systemd) tienen prioridad sobre el archivo.
 */
const archivo = process.env.ENV_FILE ?? '.env';
if (existsSync(archivo)) {
  process.loadEnvFile(archivo);
}
