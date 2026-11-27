# erp-node

ERP Integros365 sobre **Node.js 24 + TypeScript + NestJS 12**. Reemplaza de forma progresiva a Dolibarr y a `apipos` (Laravel), dominio por dominio, sin cambiar nada en los POS.

- Plan de migración: [`/var/www/PLAN_MIGRACION_ERP_NODE.md`](../PLAN_MIGRACION_ERP_NODE.md)
- Reglas del proyecto (para el equipo y para Claude): [`CLAUDE.md`](CLAUDE.md)
- Decisiones de arquitectura: [`docs/adr/`](docs/adr/)
- Cómo portar un endpoint de apipos: [`docs/guia-portar-endpoint.md`](docs/guia-portar-endpoint.md)

## Primeros pasos

```bash
cd /var/www/erp-node
npm install
cp .env.example .env        # completar con la base de QA (NO la de producción)
npm run start:dev           # http://127.0.0.1:3100/api
```

Comprobar que funciona:

```bash
curl http://127.0.0.1:3100/api/health                          # {"ok":true}
curl http://127.0.0.1:3100/api/health/ready                    # base de datos accesible
curl http://127.0.0.1:3100/api/api.php/integrospos/pos/ping    # {"ok":true} (contrato apipos)
```

Documentación interactiva (Swagger): `http://127.0.0.1:3100/api/docs` (con `SWAGGER_ENABLED=true`).

## Estructura

```
erp-node/
├── apps/
│   └── api/                    # NestJS: API HTTP (reemplaza apipos)
│       ├── src/
│       │   ├── main.ts         # arranque
│       │   ├── configurar-app.ts  # pipeline HTTP (compartido con los tests e2e)
│       │   ├── app.module.ts
│       │   ├── auth/           # controladores HTTP por dominio…
│       │   ├── pos/
│       │   └── health/
│       └── test/               # tests e2e (contratos apipos)
├── libs/
│   ├── domain/src/<dominio>/   # lógica de negocio (@erp/domain/<dominio>)
│   │   └── auth/               # DOLAPIKEY, usuarios de Dolibarr
│   ├── database/               # MySQL legado, esquema llx_*, transacciones (@erp/database)
│   ├── dolibarr/               # compatibilidad Dolibarr: cifrado, contraseñas (@erp/dolibarr)
│   └── shared/                 # config, errores, logging (@erp/shared)
├── docs/
│   ├── adr/                    # decisiones de arquitectura
│   └── guia-portar-endpoint.md
└── CLAUDE.md
```

Próximas apps (según el plan): `apps/worker` (colas: DIAN, contabilización, correos) y `apps/web` (frontend).

## Scripts

| Comando | Qué hace |
|---|---|
| `npm run start:dev` | API con recarga automática |
| `npm run check` | typecheck + lint + formato + tests unitarios + e2e (**obligatorio antes de un PR**) |
| `npm test` / `npm run test:watch` | tests unitarios |
| `npm run test:e2e` | tests e2e (no tocan ninguna base real) |
| `npm run test:cov` | cobertura |
| `npm run lint` / `npm run format` | ESLint / Prettier |
| `npm run build` | build de producción en `dist/apps/api/main.js` |
| `npm run db:introspect:legacy` | lee la estructura de la base Dolibarr en `.introspeccion-legado/` (solo referencia, solo lectura) |

## Despliegue

Publicado en **https://erp-node.waplicaciones.co** (la raíz redirige a `/api/docs`).

| Pieza | Dónde |
|---|---|
| Proceso | PM2 `erp-node-api` → `127.0.0.1:3100` (`ecosystem.config.cjs`) |
| Apache | `/etc/httpd/conf.d/zz-erp-node.conf` (certificado `*.waplicaciones.co`) |
| Logs Apache | `/var/log/httpd/erp-node-{access,error}.log` |
| Logs app | `pm2 logs erp-node-api` |
| Configuración | `/var/www/erp-node/.env` (permisos 600, fuera de git) |
| Swagger | `/api/docs`: usuario `SWAGGER_USER`, contraseña `SWAGGER_PASSWORD` del `.env` |

Actualizar después de un cambio:

```bash
cd /var/www/erp-node
npm ci && npm run check && npm run build
pm2 reload erp-node-api
curl -s https://erp-node.waplicaciones.co/api/health
```

### Migración de endpoints desde apipos

La API escucha solo en `127.0.0.1`. Apache enruta **endpoint por endpoint** hacia erp-node a medida que se migran; el resto sigue en apipos. Ejemplo (ajustar al vhost real de apipos):

```apache
# Endpoints ya migrados → erp-node. Deben ir ANTES de la regla general de apipos.
ProxyPass        /api/api.php/integrospos/pos/ping  http://127.0.0.1:3100/api/api.php/integrospos/pos/ping
ProxyPassReverse /api/api.php/integrospos/pos/ping  http://127.0.0.1:3100/api/api.php/integrospos/pos/ping
```

Para volver atrás basta con quitar la línea y recargar Apache.
