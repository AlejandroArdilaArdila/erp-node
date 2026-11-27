# Guía: portar un endpoint de apipos a erp-node

Ejemplo real ya portado: `POST /custom/integrospos/validateApiKey`. Para verlo completo:

- controlador: `apps/api/src/auth/auth.controller.ts`
- servicio: `libs/domain/src/auth/api-key.service.ts`
- repositorio: `libs/domain/src/auth/usuarios.repositorio.ts`
- tests: `libs/domain/src/auth/api-key.service.spec.ts` y `apps/api/test/api.e2e-spec.ts`

## 1. Entender el original

En `apipos/`:
- Ruta y middleware en `routes/api.php` (¿`auth:apikey`? ¿`throttle`?).
- Controlador y servicio (`app/Http/Controllers/...`, `app/Services/...`).
- Escribir la lista de **todos** los caminos de respuesta: cada `return`, `abort()` y excepción, con su status y su cuerpo exacto.
- Anotar qué tablas lee y escribe, y si hay transacciones o bloqueos.
- Si algo parece un bug, **no lo corrijas en silencio**: anótalo y consúltalo.

> Con Claude Code: *"Lee `apipos/app/Services/X.php` y lista todos los caminos de respuesta del método Y con status y cuerpo exacto"*.

## 2. Capturar el contrato real (en QA)

```bash
curl -s -i -X POST "https://<qa>/api/custom/integrospos/validateApiKey" -H "DOLAPIKEY: <clave-qa>"
```

Guardar cada caso (éxito, cada error) como referencia para los tests. Nunca guardar claves reales en el repositorio.

## 3. Datos: esquema y repositorio

1. Si la tabla no está en `libs/database/src/legacy/schema/`, agregarla con **solo** las columnas necesarias:
   ```ts
   export const terceros = tablaLegado('societe', {
     rowid: int('rowid').primaryKey().autoincrement(),
     nom: varchar('nom', { length: 128 }).notNull(),
   });
   ```
   y exportarla en `schema/index.ts`. Para ver tipos exactos: `npm run db:introspect:legacy` (solo lectura).
2. En el dominio, un repositorio (`*.repositorio.ts`) con métodos que devuelvan **objetos del dominio**, no filas crudas.

## 4. Lógica: servicio del dominio

- En `libs/domain/src/<dominio>/`. Sin nada de HTTP (ni `Request` ni `Response`).
- Escrituras de varias sentencias → `TransaccionesLegado.ejecutar(tx => ...)`, siguiendo las reglas de `docs/adr/0004-concurrencia.md`.
- Errores legado: `throw new HttpException({ error: 'TEXTO EXACTO' }, 403)`.
- Exportar lo que otros necesiten en el `index.ts` del dominio.

## 5. HTTP: controlador

- En `apps/api/src/<dominio>/`, con la **misma ruta** que apipos (sin el `/api`, que es el prefijo global).
- Si la ruta requiere `auth:apikey`: `@UseGuards(ApiKeyGuard)` y `@UsuarioActual()`.
- Body tipado con un DTO (`class-validator`) si el original validaba; si el original aceptaba cualquier cosa, replicar ese comportamiento y anotarlo.
- `@HttpCode(200)` en los POST que en Laravel respondían 200 (Nest responde 201 por defecto).
- Decoradores de Swagger (`@ApiTags`, `@ApiOperation`).

## 6. Tests

- **Unitario** del servicio con un repositorio falso: un caso por cada camino de respuesta.
- **e2e "contrato apipos"**: la petición HTTP real contra la app (`crearAppPrueba`) con el cuerpo y el status exactos del paso 2.
- `npm run check` en verde.

## 7. Paso a producción

1. Desplegar en QA y comparar contra apipos con las mismas peticiones del paso 2.
2. Agregar la regla `ProxyPass` del endpoint en Apache (ver README) para un cliente piloto, luego para todos.
3. Vigilar el log por `requestId` y errores 5xx. Si hay problemas, se quita la regla y el tráfico vuelve a apipos.
4. Cuando todos los endpoints de un controlador de apipos estén migrados y estables, se elimina ese código de apipos.

## Checklist del PR

- [ ] Todos los caminos de respuesta del original están cubiertos con tests
- [ ] Ninguna llamada externa dentro de una transacción
- [ ] Sin `number` para dinero o cantidades
- [ ] Diferencias con el original documentadas y consultadas
- [ ] `npm run check` en verde
