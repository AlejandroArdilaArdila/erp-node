# ADR 0006: Seguridad y observabilidad

- Estado: aceptado
- Fecha: 2026-11-26

## Decisión

- **La API escucha solo en `127.0.0.1`;** Apache es el único punto de entrada (`trust proxy: loopback`).
- **Secretos solo en `.env`,** que está fuera de git. `.env.example` documenta las variables sin valores.
- **Logs JSON (pino)** con `requestId` por petición (header `X-Request-Id` entrante o UUID).
- **Redacción obligatoria en los logs:** headers `DOLAPIKEY`, `Authorization`, `x-api-key`, `Cookie`; query `DOLAPIKEY`/`api_key`/`apiKey`; campos `password`, `api_key`, `APIKEY`, `access_token`, `refresh_token`.
- **Errores de base de datos saneados:** Drizzle y mysql2 incluyen los *parámetros* de la consulta en el mensaje del error. `serializarErrorSeguro` y `mensajeSeguro` (`libs/shared`) los eliminan de logs y respuestas. Se detectó en la prueba del build: una API key aparecía en el log. Lo cubre un test unitario y uno e2e de regresión.
- **Salud:** `GET /api/health` (proceso vivo, sin tocar la base) y `GET /api/health/ready` (base accesible; 503 si no).

## Pendiente

- Rotar la API key que está en texto plano en `apipos/wss/Important.md` y eliminar los archivos `.bak` con código o secretos.
- ✅ (2026-11-27) erp-node usa su propio usuario MySQL `erp_node@192.168.254.212`, con **solo `SELECT`** en `mercaboy_erp_24`. Cuando se porte un endpoint que escribe, se agrega `INSERT`/`UPDATE` **solo en las tablas que necesita**, y se anota aquí qué permiso se dio y para qué endpoint.
- apipos sigue usando un usuario que es **administrador total** del MySQL (`SUPER`, `SHUTDOWN`, `CREATE USER`, `DROP` en `*.*`). Conviene limitarlo también.
- **Hallazgo en apipos (2026-11-27):** su `DOLIBARR_INSTANCE_KEY` no es la `$dolibarr_main_instance_unique_id` de Dolibarr, así que no descifra las `api_key` (se verificó contra los datos). Consecuencias probables: el guard no encuentra usuarios con api_key cifrada y el login devuelve `APIKEY: null`. erp-node usa la clave de `conf.php`.
- Límite de peticiones (`throttle`) en los endpoints públicos que lo tienen en apipos, cuando se porten.
