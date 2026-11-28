import { z } from 'zod';

/**
 * Única fuente de verdad de las variables de entorno.
 * Si falta una variable obligatoria o tiene un formato inválido, la
 * aplicación NO arranca y dice exactamente cuál es. Documentar cada
 * variable nueva también en `.env.example`.
 */
export const esquemaEnv = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    // Cliente (tenant) que atiende este proceso: un proceso y una base por cliente (ADR 0007)
    TENANT_ID: z
      .string()
      .regex(/^[a-z0-9][a-z0-9-]{1,39}$/, 'solo minúsculas, números y guiones (p. ej. mercaboy)'),
    TZ: z.string().default('America/Bogota'),

    // HTTP
    HOST: z.string().default('127.0.0.1'),
    PORT: z.coerce.number().int().positive().default(3100),
    API_PREFIX: z.string().default('api'),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

    // Documentación Swagger (/api/docs), protegida con usuario y contraseña (HTTP Basic)
    SWAGGER_ENABLED: z.stringbool().default(false),
    SWAGGER_USER: z.string().default(''),
    SWAGGER_PASSWORD: z.string().default(''),

    // Base de datos legado (MySQL de Dolibarr)
    LEGACY_DB_HOST: z.string().min(1),
    LEGACY_DB_PORT: z.coerce.number().int().positive().default(3306),
    LEGACY_DB_NAME: z.string().min(1),
    LEGACY_DB_USER: z.string().min(1),
    LEGACY_DB_PASSWORD: z.string().default(''),
    LEGACY_DB_PREFIX: z.string().default('llx_'),
    LEGACY_DB_POOL_SIZE: z.coerce.number().int().positive().default(10),

    // Compatibilidad Dolibarr: $dolibarr_main_instance_unique_id de conf.php
    DOLIBARR_INSTANCE_KEY: z.string().default(''),

    // URL pública de apipos del cliente (su APP_URL). De ahí descarga el POS de
    // escritorio sus instaladores: <url>/pos.exe y <url>/pos.deb.
    // Mismo valor por defecto que APP_URL en Laravel.
    POS_ACTUALIZACION_URL_BASE: z.string().default('http://localhost'),

    // Carpeta "documents" de Dolibarr ($dolibarr_main_data_root), igual que
    // DOL_DOCUMENTS_ROOT de apipos. Su carpeta padre es la raíz del sitio, donde
    // está htdocs/ (de ahí se leen, p. ej., las imágenes del carrusel del POS).
    DOL_DOCUMENTS_ROOT: z.string().default(''),
  })
  .superRefine((env, ctx) => {
    // Swagger nunca queda expuesto sin credenciales fuertes.
    if (env.SWAGGER_ENABLED && (env.SWAGGER_USER === '' || env.SWAGGER_PASSWORD.length < 16)) {
      ctx.addIssue({
        code: 'custom',
        path: ['SWAGGER_PASSWORD'],
        message:
          'Con SWAGGER_ENABLED=true se requieren SWAGGER_USER y SWAGGER_PASSWORD (mín. 16 caracteres).',
      });
    }
  });

export type Env = z.infer<typeof esquemaEnv>;

/** Valida process.env y produce un mensaje legible si algo falta. */
export function validarEnv(raw: Record<string, unknown>): Env {
  const resultado = esquemaEnv.safeParse(raw);
  if (!resultado.success) {
    const detalle = resultado.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Configuración inválida (.env):\n${detalle}`);
  }
  return resultado.data;
}
