# ADR 0001: Monolito modular con NestJS

- Estado: aceptado
- Fecha: 2026-11-26

## Contexto

Hoy la lógica del ERP está repartida entre Dolibarr (núcleo + ~790k líneas en `htdocs/custom`), `apipos` (Laravel) y `wss` (Node). Varias capas escriben en las mismas tablas `llx_*` sin un dueño claro, y ahí está el origen del "código espagueti". El equipo es de 5 personas.

## Decisión

Un **monolito modular** en NestJS (modo monorepo del CLI de Nest):

- `apps/*`: puntos de entrada desplegables (`api` hoy; `worker` y `web` más adelante). Solo adaptan transporte (HTTP, colas) a servicios.
- `libs/domain/src/<dominio>`: un módulo por dominio de negocio, con su API pública en `index.ts`.
- `libs/database`, `libs/shared`, `libs/dolibarr`: infraestructura sin lógica de negocio.

Fronteras que hace cumplir ESLint (`eslint.config.js`):
- solo se importa `@erp/domain/<dominio>`, nunca un archivo interno;
- no se usan rutas relativas a `libs/`;
- no se lee `process.env` fuera de la configuración.

Los controladores viven en `apps/api`, no en los dominios, para que `apps/worker` pueda reutilizar los dominios sin exponer rutas HTTP.

## Alternativas descartadas

- **Microservicios:** con 5 personas multiplican despliegues, observabilidad y consistencia distribuida sin un beneficio real hoy. Si un dominio lo necesita, el monolito modular permite separarlo después.
- **Un solo `src/` plano:** es más simple al inicio, pero repetiría el problema de Dolibarr al no tener fronteras.

## Consecuencias

- Un solo build y un solo despliegue.
- Separar un dominio en otro servicio más adelante es mover una carpeta de `libs/domain`.
- Hay que vigilar en code review que los dominios no se consulten tablas entre sí (ESLint no lo detecta todo).
