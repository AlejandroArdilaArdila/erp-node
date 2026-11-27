# ADR 0003: Acceso a datos con Drizzle sobre el MySQL de Dolibarr

- Estado: aceptado
- Fecha: 2026-11-26

## Contexto

Mientras Dolibarr siga en uso, su MySQL es la fuente de verdad. Partir los datos entre MySQL y PostgreSQL con productos, terceros y facturas cruzados exigiría sincronizar en ambas direcciones (ver plan §2).

## Decisión

1. **Drizzle ORM** con `mysql2`:
   - SQL explícito y visible (se ve qué bloquea);
   - transacciones con nivel de aislamiento configurable;
   - soporta MySQL hoy y PostgreSQL mañana con la misma API;
   - `drizzle-kit pull` para leer la estructura existente.
2. **Esquema legado parcial:** en `libs/database/src/legacy/schema/` se declaran solo las tablas y columnas que el código usa, con `tablaLegado()` (aplica el prefijo `llx_`).
3. **La base legado no es nuestra:** nunca `drizzle-kit push`/`migrate` sobre ella. Los cambios (índices, columnas) van como script SQL revisado, igual que hoy en `apipos/sql/`.
4. **Dinero:** `DECIMAL` llega como `string` (`decimalNumbers: false`). Nunca se convierte a `number` para hacer cálculos.
5. **Repositorios:** solo `*.repositorio.ts` usa Drizzle. Cuando llegue PostgreSQL (fase 6) se cambian los repositorios, no los servicios.
6. **PostgreSQL** entra primero para datos nuevos sin joins con el legado (auditoría, eventos, outbox, réplica de informes), como una conexión adicional en `DatabaseModule`.

## Diferencias conocidas con PHP

- `password_verify` de PHP acepta argon2; `verificarPasswordDolibarr` lo rechaza. Dolibarr usa bcrypt por defecto. Si algún usuario tiene un hash `$argon2`, hay que agregar el soporte.
