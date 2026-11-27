# Clientes (tenants)

Un archivo `<cliente>.env` por cliente. Cada uno levanta su propio proceso
`erp-node-<cliente>` en PM2, con su propia base de datos (ADR 0007).

| Cliente | Archivo | Puerto | Subdominio | Base |
|---|---|---|---|---|
| mercaboy | `mercaboy.env` | 3100 | erp-node.waplicaciones.co | mercaboy_erp_24 |

Agregar un cliente:

1. `cp ../.env.example <cliente>.env` y completar: `TENANT_ID=<cliente>`, un `PORT` libre, su base y su `DOLIBARR_INSTANCE_KEY` (de SU `conf.php`).
2. `chmod 600 <cliente>.env`
3. Crear su usuario MySQL y aplicar los scripts de `../sql/` en SU base.
4. Vhost de Apache apuntando a su puerto (copiar `/etc/httpd/conf.d/zz-erp-node.conf`).
5. `pm2 start ../ecosystem.config.cjs && pm2 save`

Los `.env` NO se suben a git (contienen credenciales).
