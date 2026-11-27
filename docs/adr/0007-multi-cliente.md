# ADR 0007: Un proceso y una base de datos por cliente

- Estado: aceptado
- Fecha: 2026-11-27

## Contexto

Integros365 atiende a varios clientes. Hoy cada cliente tiene **su propia instalación de Dolibarr**, con su propia base MySQL, su propio `conf.php` y, por lo tanto, su propia `$dolibarr_main_instance_unique_id`, que es la clave con la que se cifran las `api_key`. apipos se despliega igual: una instancia por cliente.

Durante las fases 1 a 5, erp-node trabaja sobre esas mismas bases (ADR 0003), así que tiene que respetar esa separación. Las opciones eran:

1. **Un proceso por cliente**, cada uno con su archivo de configuración.
2. **Un solo proceso multi-cliente** que elige la base según el subdominio o una cabecera, con un pool de conexiones por cliente.
3. **Una sola base con columna `tenant_id`**, que no es posible mientras las bases sean las de Dolibarr.

## Decisión

**Opción 1: un proceso de erp-node por cliente, con su propia base.**

- Cada cliente tiene un archivo `tenants/<cliente>.env` con `TENANT_ID=<cliente>`, su `PORT`, su base y su `DOLIBARR_INSTANCE_KEY`. Los archivos tienen permisos `600` y no se suben a git.
- `ecosystem.config.cjs` crea un proceso PM2 `erp-node-<cliente>` por cada archivo, le pasa `ENV_FILE` y valida que el nombre del archivo coincida con `TENANT_ID` y que no haya puertos repetidos.
- Cada cliente tiene su propio vhost de Apache (subdominio, puerto) y su propio usuario MySQL con permisos mínimos.
- `TENANT_ID` es obligatorio (`env.schema.ts`) y aparece en **cada línea de log** (`tenant`), para filtrar por cliente.
- El código **no sabe** que hay varios clientes: no hay contexto de cliente en servicios ni consultas.
- Los scripts de `sql/` se aplican en la base de **cada** cliente.

Pasos para agregar un cliente: `tenants/README.md`.

## Consecuencias

A favor:
- **Aislamiento total.** Los bloqueos, la caída o la carga de un cliente no afectan a los demás, y no hay riesgo de cruzar datos entre clientes por un bug.
- Es el mismo modelo que Dolibarr y apipos ya usan, sin cambios en los datos.
- El código es más simple: no hay que pasar el cliente por todas las capas.
- Se puede desplegar o revertir un cliente piloto sin tocar a los demás (plan §5).

En contra:
- **Memoria:** cada proceso ocupa unos 100 a 300 MB. Con muchos clientes en un servidor hay que vigilarla (`max_memory_restart: 512M`).
- Más conexiones abiertas a MySQL: `LEGACY_DB_POOL_SIZE` multiplicado por el número de clientes.
- Hay que llevar un registro de puertos y vhosts (tabla de `tenants/README.md`).
- `pm2 reload ecosystem.config.cjs` actualiza todos los clientes a la vez. Para hacer un despliegue gradual se recarga cliente por cliente (`pm2 reload erp-node-<cliente>`).

## Cuándo revisar esta decisión

- Si los clientes pasan de unos 15 a 20 por servidor, o si la memoria se vuelve un problema: evaluar la opción 2 (un proceso con un pool por cliente).
- En la fase 6 (corte a PostgreSQL): decidir entre una base por cliente y un esquema por cliente en un mismo servidor PostgreSQL. Esto se puede cambiar sin tocar los servicios, porque la configuración ya está separada por cliente.
