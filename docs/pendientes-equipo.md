# Pendientes para decidir con el equipo (porteo de apipos)

Al portar cada endpoint se mantuvo el comportamiento de apipos tal cual, como pide
`CLAUDE.md`. Lo que sigue son bugs, riesgos de seguridad o choques con las reglas
del proyecto que aparecieron en el camino y que **no se corrigieron en silencio**.
Cada punto dice dónde está y qué haría falta para resolverlo.

Fecha: 2026-11-28.

## Seguridad (prioridad alta)

| #   | Endpoint                                             | Problema                                                                                                                                                                                                                 | Estado en erp-node                                                                                                                   |
| --- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| S1  | `GET /api.php/integrosone/user/getUsersOne`          | Devuelve `pass_crypted` (hash de contraseña) y `api_key` de **todos** los usuarios activos a cualquiera con una DOLAPIKEY válida. Choca con la regla "nunca devolver credenciales". En producción es una vulnerabilidad. | **No portado.** Hay que decidir qué necesita realmente la app (¿validación offline del PIN?) y diseñar un contrato sin credenciales. |
| S2  | `POST /api.php/integrosone/mensajes`                 | No verifica que `user` sea el dueño de la DOLAPIKEY: cualquier usuario autenticado lee el chat de otro.                                                                                                                  | Portado igual. Corregirlo es usar `@UsuarioActual()` en lugar de `user`.                                                             |
| S3  | `GET /api.php/informes/dashboarddinamico/dashboards` | `user_id` viene del query string y no del dueño de la DOLAPIKEY: cualquiera lista los dashboards privados de otro.                                                                                                       | Portado igual. Misma corrección que S2.                                                                                              |
| S4  | `GET /api.php/integrospos/pos/configuracion`         | Entrega descifradas las claves del datáfono (`password`, `client_secret`), de Wompi y de Bold.                                                                                                                           | **No portado** (además es grande: ~700 líneas con reglas tributarias y resoluciones DIAN).                                           |
| S5  | `consultadinamica/*`                                 | Arma SQL a partir de lo guardado en la base, con guards anti-inyección validados contra `information_schema`, y ejecuta consultas para llenar opciones.                                                                  | **No portado.** Requiere revisión de seguridad dedicada antes de portar.                                                             |

## Bugs del original que se mantuvieron

| #   | Dónde                                           | Problema                                                                                                                                                                                                                                                                                                                                                        | Cómo se corrige                                                                                 |
| --- | ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| B1  | `GET /api.php/integrosone/productos/categorias` | Dolibarr guarda `subperms = NULL` en los permisos sin subpermiso, y apipos compara con `''` de forma estricta. Si los datos reales tienen `NULL`, responde "Sin permisos" a **todos**. Verificar con: `SELECT module, perms, subperms IS NULL, COUNT(*) FROM llx_rights_def WHERE module IN ('integrospos','iapk','integros') AND perms='lire' GROUP BY 1,2,3;` | Si es NULL: comparar `NULL` como `''` en `PermisosService.coincide`.                            |
| B2  | `GET /api.php/integrospos/carrusel/activas`     | apipos corre con `app.timezone = 'UTC'`: desde las 7 p. m. hora de Colombia el carrusel ya muestra las imágenes del día siguiente y oculta las que terminan hoy.                                                                                                                                                                                                | Una línea en `CarruselService.activas`: usar `formatearFecha(...)` (hora local).                |
| B3  | `GET /api.php/integrospos/pos/update/check`     | En la copia de apipos revisada, `APP_URL=http://localhost`: el POS recibe `http://localhost/pos.exe`.                                                                                                                                                                                                                                                           | Configurar `POS_ACTUALIZACION_URL_BASE` con la URL pública correcta en `tenants/<cliente>.env`. |
| B4  | Varios (`chat`, `DATE(fecha) = ?`)              | Filtros que no usan índices: `DATE(columna) = ?` y `OR` entre columnas.                                                                                                                                                                                                                                                                                         | Reescribir como rango (`fecha >= ? AND fecha < ? + 1 día`) después de validar la fecha.         |

## Criterio que hay que unificar

- **Zona horaria.** apipos calcula "hoy" en UTC. La sesión anterior decidió usar
  hora local en `CajaService.estadoCaja` (diferencia documentada), pero el
  carrusel quedó en UTC (B2) por fidelidad. Conviene una regla única en un ADR:
  recomendación, **hora local** (America/Bogota) en todo, que es como guarda
  Dolibarr, y documentar cada endpoint donde cambie el resultado.

## Choques con las reglas del proyecto

| #   | Endpoint                                                | Problema                                                                                                                                                                                                                                                                                        |
| --- | ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | `GET /api.php/integrospos/pos/actividadesEconomicasIca` | Calcula `base_imponible = (float) base × UVT` y lo responde como número decimal. Replicarlo exacto exige `float` para dinero. Opciones: (a) aceptar `number` solo para replicar la respuesta legado, documentado; (b) calcular con decimal exacto y aceptar diferencias en los últimos dígitos. |
| R2  | `integrosone/productos/clientes` y similares            | Devuelven cantidades y stock con `(float)`. Mismo dilema que R1.                                                                                                                                                                                                                                |

## Diferencias generales aceptadas

- Ante un método HTTP no permitido, Laravel responde 405 y erp-node 404.
- En las respuestas con JSON de la base (`responderJsonPhp`), los textos se
  escriben con `JSON.stringify`: no se escapan `/` ni los caracteres no ASCII
  como hace PHP (`\/`, `ñ`). El JSON es equivalente para cualquier cliente.
