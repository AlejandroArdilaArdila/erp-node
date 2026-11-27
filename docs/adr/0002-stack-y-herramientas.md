# ADR 0002: Stack y herramientas

- Estado: aceptado
- Fecha: 2026-11-26

## Decisión

| Pieza | Elección | Nota |
|---|---|---|
| Runtime | Node.js 24 LTS | ya instalado en el servidor |
| Framework | NestJS 12 | **ESM** (`"type": "module"`): imports relativos con `.js` |
| Lenguaje | TypeScript 6 (`strict`) | TS 7 aún no es compatible con el CLI de Nest ni con typescript-eslint |
| Build | CLI de Nest + rspack | genera un único `dist/apps/api/main.js`; resuelve los alias `@erp/*` |
| Tests | Vitest 4 + supertest | unitarios junto al código, e2e en `apps/*/test` |
| Lint | ESLint 10 + typescript-eslint (con tipos) | reglas de arquitectura en `eslint.config.js` |
| Formato | Prettier | `singleQuote`, `printWidth: 100` |
| Validación de entrada | class-validator (DTOs) | errores 422 estilo Laravel |
| Configuración | `@nestjs/config` + zod | si falta una variable, la app no arranca |
| Logs | pino (`nestjs-pino`) | JSON, `requestId`, redacción de secretos |
| Docs API | `@nestjs/swagger` | `/api/docs` |
| Procesos | PM2 | `ecosystem.config.cjs` |

## Descartado

- **oxlint** (el lint por defecto de Nest 12): el CPU del servidor no tiene AVX2 y el binario se cae con "Instrucción ilegal". ESLint es JavaScript puro.
- **@nestjs/observe** (incluido por defecto en `nest new`): es un servicio externo que envía telemetría fuera del servidor. Si más adelante se quiere APM, se decide en otro ADR.
- **Prisma:** menos control sobre transacciones y bloqueos (`FOR UPDATE`) y un motor aparte. Ver ADR 0003.
