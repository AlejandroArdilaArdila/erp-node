# Diagnóstico de bloqueos en MySQL

Primera tarea de la fase 0 del plan: medir **dónde y por qué** se bloquean las ventas antes de cambiar código. Lo que salga de aquí define los arreglos rápidos en apipos y la línea base para el criterio de salida de la fase 1 (50 ventas simultáneas, p95 < 500 ms).

Nada de esto modifica datos ni estructura. Solo cambia variables de diagnóstico que se pierden al reiniciar MySQL.

## Archivos

| Archivo                | Para qué                                                                               |
| ---------------------- | -------------------------------------------------------------------------------------- |
| `medir-bloqueos.sql`   | Todas las consultas, en 4 partes: activar, instantánea, acumulados y revertir          |
| `capturar-bloqueos.sh` | Repite la instantánea cada N segundos durante la hora pico y la guarda en archivos TSV |

## Pasos

**Requisito:** un usuario **administrador** de MySQL. El usuario `erp_node` no tiene permisos sobre `performance_schema` ni `sys`, y no debe tenerlos.

1. **Elegir la base que se mide.** Tiene que ser la del cliente donde se presentan los bloqueos. `mercaboy_erp_24` no sirve, porque no tiene facturas.
2. **Antes de la hora pico:** en `medir-bloqueos.sql`, cambiar `SET @db = 'NOMBRE_DE_LA_BASE'` y ejecutar la **PARTE 0**. Guardar el resultado de la consulta 0.1, que es la configuración actual.
3. **Durante la hora pico** (lo ideal es 1 o 2 horas):
   ```bash
   # credenciales en un archivo con permisos 600, nunca en la línea de comandos
   cat > ~/mysql-admin.cnf <<'EOF'
   [client]
   host=192.168.254.233
   user=ADMIN
   password=CLAVE
   EOF
   chmod 600 ~/mysql-admin.cnf

   cd /var/www/erp-node/sql/diagnostico
   ./capturar-bloqueos.sh ~/mysql-admin.cnf NOMBRE_DE_LA_BASE 5 90   # cada 5 s, 90 min
   ```
   Si un cajero reporta que "se pegó", anotar la hora: así se cruza con los TSV.
4. **Al terminar la hora pico:** ejecutar la **PARTE 2** completa y guardar el resultado. También copiar el log de errores de MySQL, que tiene todos los deadlocks, y el slow log (`/var/lib/mysql/mysql-slow.log`).
5. **Revertir** con la **PARTE 3**.
6. Pasar la carpeta `captura-*` y los resultados para analizarlos.

⚠ Los resultados incluyen textos de consultas con datos de clientes (documentos, nombres, valores). Hay que tratarlos como confidenciales: no compartirlos por chat ni subirlos a git. `capturar-bloqueos.sh` crea la carpeta con permisos `700`.

## Cómo leer los resultados

| Si se ve…                                                                               | Significa                                                                                                  | Arreglo típico (ADR 0004)                                                                    |
| --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `blocking_query` vacío en `esperas.tsv` / comando `Sleep` en `trx_largas.tsv`           | Una transacción quedó abierta mientras el código hacía otra cosa (DIAN, datáfono, correo, impresión, HTTP) | Hacer commit antes de la llamada externa, o mandarla a una cola                              |
| Transacciones de varios segundos con muchas consultas (2.6)                             | Transacciones largas que acumulan bloqueos                                                                 | Partir la transacción y dejar dentro solo las escrituras                                     |
| `filas_examinadas` mucho mayor que `filas_enviadas`, o `sin_indice` > 0 (2.2, 2.4)      | Falta un índice. En un `UPDATE` o `DELETE`, la consulta bloquea todas las filas que recorre                | Crear el índice (script SQL revisado) y verificar con `EXPLAIN`                              |
| Muchos bloqueos `X` o `X,GAP` en `bloqueos_tomados.tsv`                                 | Gap locks de REPEATABLE READ (hoy es el aislamiento global)                                                | `READ COMMITTED` en la sesión de apipos                                                      |
| Las mismas tablas en esperas y deadlocks (`llx_product_stock`, numeración de facturas…) | Choques entre ventas que tocan las mismas filas                                                            | Bloquear en orden por id, `UPDATE` atómico de stock y consecutivo al final de la transacción |
| `lock_timeouts` > 0 (2.1)                                                               | Ventas que esperaron `innodb_lock_wait_timeout` (hoy **50 s**) y fallaron                                  | Lo anterior. Además, bajar el timeout para que el POS falle rápido y reintente               |
| Pendientes en `metadatos.tsv`                                                           | Un `ALTER`, un backup o un `LOCK TABLES` en horario de ventas                                              | Mover ese proceso fuera del horario de atención                                              |

## Configuración actual del servidor (2026-11-27)

MySQL 8.0.44 en 192.168.254.233:

- `transaction_isolation = REPEATABLE-READ`: produce gap locks.
- `innodb_lock_wait_timeout = 50`: una venta bloqueada espera hasta 50 s antes de fallar.
- `innodb_print_all_deadlocks = OFF`: hoy solo queda registrado el último deadlock.
- `innodb_buffer_pool_size = 128 MB`, que es el valor de fábrica. Si las bases de los clientes suman varios GB, esto obliga a leer del disco. Se revisa con los resultados.
- `slow_query_log = ON` con `long_query_time = 1`.
