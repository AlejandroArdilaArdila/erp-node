# erp-node: reglas del proyecto

ERP Integros365 en NestJS + TypeScript. Reemplaza de forma progresiva a Dolibarr y apipos (Laravel).
Plan general: `/var/www/PLAN_MIGRACION_ERP_NODE.md`. Decisiones: `docs/adr/`.

## Comandos

```bash
npm run start:dev     # API en modo desarrollo (http://127.0.0.1:3100/api, docs en /api/docs)
npm run check         # typecheck + lint + formato + tests unitarios + e2e: correr ANTES de cada PR
npm test              # tests unitarios (*.spec.ts junto al código)
npm run test:e2e      # tests e2e (apps/*/test/*.e2e-spec.ts)
npm run build         # build de producción → dist/apps/api/main.js
```

## Arquitectura (monolito modular)

```
apps/api/src/<dominio>/     Controladores HTTP. Solo traducen HTTP ↔ servicios. Sin lógica de negocio.
libs/domain/src/<dominio>/  Lógica de negocio: servicios, repositorios, guards. API pública en index.ts.
libs/database/              Conexiones, esquema de tablas legado (llx_*), transacciones.
libs/dolibarr/              Imitación de comportamientos de Dolibarr (cifrado, contraseñas). Con tests contra PHP real.
libs/shared/                Configuración, errores, logging. Sin lógica de negocio.
```

Reglas (ESLint hace cumplir varias de ellas):
- Otro módulo se importa **solo** desde su API pública: `@erp/domain/<dominio>`, nunca un archivo interno.
- Un dominio **no consulta tablas de otro dominio**: llama al servicio público del otro.
- Solo los repositorios (`*.repositorio.ts`) acceden a la base de datos.
- La configuración se lee **solo** con `AppConfig` (validada con zod en `env.schema.ts`), nunca con `process.env`.
- Cada variable de entorno nueva va en `env.schema.ts` **y** en `.env.example`.

## Base de datos

- La base MySQL de Dolibarr **no es nuestra**: nunca `drizzle-kit push`/`migrate` sobre ella y nunca `ALTER`/`CREATE` desde código. Los cambios de esquema van como script SQL revisado (igual que `apipos/sql/`).
- En `libs/database/src/legacy/schema/` se declaran **solo** las columnas que se usan, con `tablaLegado('nombre_sin_prefijo', ...)`.
- **Dinero y cantidades: nunca `number`/float.** DECIMAL llega como `string`; usar aritmética decimal exacta.
- Escrituras con más de una sentencia: **siempre** `TransaccionesLegado.ejecutar(tx => ...)`.

## Concurrencia (la razón de esta migración; ver docs/adr/0004)

1. Transacciones cortas. **Nada externo dentro de una transacción**: ni HTTP, ni DIAN, ni datáfono, ni correo, ni impresión. Primero commit, después el efecto externo (o a la cola).
2. Stock con UPDATE atómico condicionado (`SET qty = qty - ? WHERE ... AND qty >= ?`), nunca leer y luego escribir.
3. Bloquear filas (`FOR UPDATE`) **ordenadas por id**, para evitar deadlocks.
4. Consecutivos (facturas, resoluciones): bloquear la fila del contador **al final** de la transacción.
5. Operaciones que el POS puede reintentar (ventas): clave de idempotencia.
6. Toda transacción debe poder reintentarse completa (la reintenta `TransaccionesLegado` ante deadlock).

## Compatibilidad con apipos (fases 1–5)

- Al portar un endpoint se mantiene **idéntico** el contrato: URL, método, nombres de campos, tipos, status HTTP y textos de error. Los POS en producción no cambian.
- Respuestas de error legado: `throw new HttpException({ error: 'TEXTO' }, status)`; el filtro las devuelve tal cual (+ `requestId`).
- Cada diferencia con el original (bug que se corrige, filtro que falta) se documenta en el código y se consulta antes con el equipo.
- Cada endpoint portado lleva un test e2e "contrato apipos" con los casos reales. Guía paso a paso: `docs/guia-portar-endpoint.md`.

## Tests

- Los tests **nunca** se conectan a una base real (y menos a producción). Se reemplazan los repositorios con fakes.
- Comportamientos que imitan PHP/Dolibarr se prueban con vectores generados por el PHP real (`php -r ...`).
- Un bug corregido lleva su test de regresión.

## Seguridad

- Nunca registrar ni devolver credenciales, api keys, tokens o parámetros de consultas. El logger y el filtro de errores ya los ocultan; no evitarlos (p. ej. con `console.log` o metiendo datos sensibles en `message`).
- Secretos solo en `.env` (fuera de git). Nunca en código, `.md` ni archivos `.bak`.

## Convenciones

- Nombres de negocio en **español** (`UsuariosRepositorio`, `TransaccionesLegado`, `usuarioPorApiKey`); sufijos del framework en inglés (`Module`, `Controller`, `Service`, `Guard`).
- Archivos en kebab-case: `api-key.service.ts`, `usuarios.repositorio.ts`, `*.spec.ts` junto al archivo que prueban.
- ESM: los imports relativos llevan extensión `.js` (`import { x } from './x.js'`).
- `main.ts`: `import '@erp/shared/cargar-env'` **siempre** como primer import.

## Entorno del servidor

- El CPU no tiene AVX2: herramientas nativas que lo exijan (p. ej. oxlint) fallan con "Instrucción ilegal". Por eso se usa ESLint.
