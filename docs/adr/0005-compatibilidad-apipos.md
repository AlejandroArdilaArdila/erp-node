# ADR 0005: Compatibilidad de contratos con apipos

- Estado: aceptado
- Fecha: 2026-11-26

## Contexto

Hay POS en producción que llaman a apipos. Migrar no puede obligar a actualizarlos todos al mismo tiempo.

## Decisión

Durante las fases 1 a 5, erp-node responde **exactamente** como apipos en cada endpoint portado:

| Aspecto | Comportamiento |
|---|---|
| URL | Misma ruta bajo el prefijo `api` (p. ej. `/api/api.php/integrospos/pos/ping`) |
| Barra final | Se ignora (`/ruta/` = `/ruta`), como `TrimTrailingSlash` |
| Autenticación | Header `DOLAPIKEY` (api_key de `llx_user`, en texto plano o cifrada `dolcrypt`), entidades 0 y 1, `statut = 1` |
| Falla de autenticación | `401 {"message":"Unauthenticated."}` |
| Errores de negocio | El cuerpo legado tal cual: `throw new HttpException({ error: 'TEXTO' }, status)` |
| Validación | `422 {"message": "...", "errors": {"campo": ["..."]}}` |
| Error interno | `500 {"message": "Error interno del servidor."}`; el detalle queda solo en el log |

**Única diferencia agregada:** las respuestas de error incluyen `requestId`, que también va en el header `X-Request-Id`. Es un campo adicional, así que no rompe a los clientes, y permite cruzar un error que reporta el POS con el log del servidor.

## Cómo se garantiza

- Cada endpoint portado tiene tests e2e con el rótulo "contrato apipos" (`apps/api/test`) que cubren los casos del original.
- Antes de portar, se capturan pares reales de petición y respuesta en QA (ver `docs/guia-portar-endpoint.md`).
- El paso a producción es por endpoint en Apache, con retorno inmediato a apipos si algo falla.

## Diferencias detectadas en el original (se conservan hasta decidir)

- `validateApiKey` **no** filtra por `entity`, pero el guard `DOLAPIKEY` sí (0 y 1). Se conserva igual; está anotado en `ApiKeyService.validar`.
