# Análisis: la venta POS hoy (`POST /api.php/integrospos/pos/ticket/payment`)

Fecha: 2026-11-28. Basado en el código de `erp-mercaboy` (apipos + procedimientos de
`htdocs/custom/integrospos/sql/procedures/`). **Todavía sin medición en producción**:
cada hallazgo de concurrencia dice qué hay que confirmar con
`sql/diagnostico/medir-bloqueos.sql` (fase 0 del plan).

## 1. Cómo funciona

```
POS ──HTTP──▶ apipos FacturacionService::validarFacturaPos
                │  arma ~60 parámetros (líneas y pagos como JSON)
                │  (si vienen) UPDATE llx_facture_extrafields bloqueo_usuario/en_pedido   ← fuera de transacción
                ▼
          CALL sp_pos_validar_factura_pos        (275 líneas, sin transacción propia)
                │  idempotencia: SELECT por ref_local (sin bloqueo)
                ▼
          CALL sp_pos_crear_ticket_v1            (792 líneas)
                │  A) numeración + encabezado  ── TX corta, reintento hasta 30 veces
                │  B) cuerpo de la venta        ── TX larga (ver tabla)
                │  C) después del COMMIT: eventos, JSON DIAN (1.206 líneas, en autocommit)
                ▼
          UPDATE llx_societe_extrafields autorizacion_credito = 0           ← en cada venta
                ▼
apipos: escribe el CALL completo en procedimientos.log y lanza procesos de portapapeles
```

En total son **27 procedimientos y ~4.900 líneas de SQL**. La lógica de la venta no
está en PHP: está en la base.

### Transacción B (cuerpo de la venta), en orden

| Paso | Procedimiento / sentencia                                                                                                                                                                                | Tablas que bloquea                                                             |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| 1    | `sp_pos_crear_lineas_factura_bulk` (1.080 líneas)                                                                                                                                                        | `llx_facturedet` (+ extrafields)                                               |
| 2    | `sp_pos_recalcular_totales_factura`, `sp_pos_aplicar_cupon`                                                                                                                                              | `llx_facture`, cupones                                                         |
| 3    | `sp_pos_registrar_pago` × métodos                                                                                                                                                                        | pagos                                                                          |
| 4    | Stock: `INSERT INTO llx_stock_mouvement`; `INSERT ... ON DUPLICATE KEY UPDATE llx_product_stock` (ordenado por producto); `UPDATE llx_product SET stock = (SELECT SUM(reel) FROM llx_product_stock ...)` | **`llx_product_stock`, `llx_product`** (filas compartidas por todas las cajas) |
| 5    | extrafields, domicilio, coordenadas, cierre                                                                                                                                                              | `llx_facture_extrafields`                                                      |
| 6    | `sp_pos_acumular_puntos_fidelizacion`                                                                                                                                                                    | puntos del cliente                                                             |
| 7    | `sp_pos_generar_asientos_contables` (466 líneas, 24 INSERT, con `SAVEPOINT`)                                                                                                                             | tablas contables                                                               |
| 8    | `COMMIT`                                                                                                                                                                                                 |                                                                                |

## 2. Hallazgos

### H1. La numeración recorre `llx_facture` en cada venta y reintenta en cascada (alta)

`sp_pos_numerar_factura` no usa un contador. Calcula el siguiente número así:

1. `SELECT ... FROM llx_facture WHERE ref LIKE 'PREFIJO%' ... ORDER BY CAST(SUBSTRING(ref, n) AS UNSIGNED) DESC LIMIT 1`
   — el `ORDER BY` sobre una expresión no usa índice: **ordena todas las facturas del
   prefijo**, y eso crece con el historial.
2. `SELECT COUNT(*)` sobre el mismo rango.
3. Si falta algún número (una factura borrada, un número liberado), busca huecos con
   `NOT IN (subconsulta)` sobre todas las facturas del prefijo: costo cuadrático.

Dos ventas simultáneas calculan el mismo número; la segunda falla al insertar el
encabezado (error 1062, clave duplicada), espera hasta 50 ms (`SLEEP(RAND()*0.05)`) y
**repite todo el cálculo, hasta 30 veces**. Con 5 a 10 cajas a la vez, cada colisión
vuelve a recorrer la tabla. Es el patrón que coincide con el síntoma reportado
(fallas desde 5–10 ventas simultáneas) y con el mensaje del propio SP: _"No se pudo
asignar un número de factura tras varios intentos (alta concurrencia)"_.

Efecto adicional: al **rellenar huecos**, una venta de hoy puede recibir un número
menor que el de una venta de ayer. Hay que revisar si eso es aceptable para la DIAN
(consecutivo y fecha).

**Confirmar:** buscar `sp_pos_numerar_factura` / `llx_facture` en el slow log y
contar los mensajes "tras varios intentos" en el log de apipos.

### H2. La idempotencia puede crear facturas duplicadas (alta)

`sp_pos_validar_factura_pos` evita repetir una venta buscando `ref_local` con un
`SELECT` sin bloqueo, y el índice `idx_facture_extrafields_ref_local` **no es único**.
Si el POS reintenta mientras la primera petición sigue en curso (lo normal cuando hay
bloqueos y vence el timeout), las dos peticiones pueden no encontrar nada y crear
**dos facturas** para la misma venta.

**Confirmar:** `SELECT ref_local, COUNT(*) FROM llx_facture_extrafields WHERE ref_local
IS NOT NULL GROUP BY ref_local HAVING COUNT(*) > 1;`

### H3. La contabilidad corre dentro de la transacción de la venta (media)

`sp_pos_generar_asientos_contables` se ejecuta antes del `COMMIT` (con `SAVEPOINT`, así
que la venta sí es atómica). Alarga la transacción con 24 `INSERT` y mantiene
bloqueados mientras tanto el stock y los productos del paso 4. El ADR 0004 (regla 6)
pide sacarla a una cola (outbox) y ejecutarla después del commit.

### H4. Filas de stock compartidas bloqueadas durante toda la transacción (media)

El paso 4 actualiza `llx_product_stock` y `llx_product.stock` de cada producto vendido,
y esos bloqueos se mantienen hasta el `COMMIT` (después de puntos y contabilidad). Los
productos más vendidos están en casi todas las ventas, así que las ventas que los
comparten se ejecutan en fila. Además, con `REPEATABLE READ` el
`UPDATE ... (SELECT SUM(reel) FROM llx_product_stock ...)` probablemente toma bloqueos
compartidos sobre las filas de **todos los almacenes** del producto (gap locks).

Lo bueno: el upsert de stock sale de una tabla temporal con clave primaria por
producto, así que en la práctica va **ordenado por id de producto**, lo que evita
deadlocks entre ventas (regla 3 del ADR 0004).

**Confirmar:** `llx_product_stock` / `llx_product` en `esperas.tsv` y en los
deadlocks del log de errores de MySQL.

### H5. Cada venta escribe el SQL completo en un log y lanza hasta 4 procesos (media, fácil de corregir)

En `FacturacionService::validarFacturaPos` hay una llamada a `copiarSqlAlPortapapeles`
**antes** del `if ($razon !== 'OK')`, aunque el comentario dice que solo debe ocurrir
cuando el SP falla. En cada venta:

- arma el `CALL` con todos los valores (incluidos datos del cliente) y lo agrega a
  `procedimientos.log` (en esta copia: 27 MB, 5.342 ventas registradas);
- intenta copiarlo al portapapeles ejecutando `xclip`, `wl-copy`, `xsel` y `pbcopy`.
  Ninguno está instalado en el servidor: **4 procesos que fallan por venta**.

No bloquea la base (ocurre después del commit), pero suma latencia a cada venta y
deja datos de clientes en un archivo plano, contra la regla de seguridad del proyecto.

### H6. Escrituras fuera de transacción en cada venta (baja)

`UPDATE llx_societe_extrafields SET autorizacion_credito = 0` se ejecuta siempre, y el
armado del JSON DIAN (8 `UPDATE` / 8 `INSERT`) corre en autocommit después del
`COMMIT`. Si el proceso falla a mitad, quedan estados intermedios. Con el cliente
"consumidor final", el primer `UPDATE` toca la **misma fila en todas las ventas**.

## 3. Arreglos rápidos posibles en apipos (antes de migrar)

Ordenados por relación impacto/riesgo. Ninguno se aplicó: son propuestas para el equipo.

1. **H5:** borrar la llamada a `copiarSqlAlPortapapeles` que está antes del `if`
   (una línea). Beneficio inmediato y sin riesgo funcional.
2. **H2:** índice único en `llx_facture_extrafields.ref_local` (después de limpiar los
   duplicados que encuentre la consulta de H2). El SP ya maneja el error 1062.
3. **H1 (parcial):** guardar el último consecutivo por resolución en una tabla
   contador y tomarlo con `SELECT ... FOR UPDATE` al final de la transacción (regla 4
   del ADR 0004), en vez de recorrer `llx_facture`. Requiere decidir qué hacer con los
   huecos.
4. **H6:** ejecutar el `UPDATE autorizacion_credito = 0` solo si estaba en 1.

## 4. Diseño propuesto en erp-node (ADR 0004)

| Paso                                | Hoy                                                       | erp-node                                                                                                                                       |
| ----------------------------------- | --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Idempotencia                        | `SELECT` por `ref_local` sin bloqueo                      | Índice único en `ref_local` + `INSERT` del encabezado como primera escritura: el reintento choca con el índice y devuelve la factura existente |
| Líneas, pagos                       | dentro de la TX                                           | dentro de la TX (cálculos hechos en TypeScript antes de abrirla)                                                                               |
| Stock                               | upsert + recálculo de `llx_product.stock` con subconsulta | `UPDATE ... SET reel = reel - ? WHERE ... ` por producto **ordenado por id**; `llx_product.stock = stock - ?` (sin subconsulta)                |
| Consecutivo                         | recorrido de `llx_facture` al inicio + reintentos         | fila contador por resolución, `FOR UPDATE` **al final** de la TX                                                                               |
| Contabilidad, DIAN, puntos, eventos | dentro de la TX / autocommit                              | evento en tabla outbox dentro de la TX; los ejecuta el `worker` después del commit                                                             |
| Aislamiento                         | REPEATABLE READ                                           | READ COMMITTED (ya lo hace `TransaccionesLegado`)                                                                                              |

### Cómo portarlo sin riesgo

1. **Medir primero** (fase 0): línea base de p95 y de esperas con los scripts de
   `sql/diagnostico/`.
2. **Golden tests de los SP:** en una base de QA, ejecutar `sp_pos_validar_factura_pos`
   con ventas reales grabadas y guardar el estado resultante de las tablas (factura,
   líneas, pagos, stock, asientos). Esos resultados son el contrato que erp-node debe
   reproducir. Sin esto, portar 4.900 líneas de SQL es adivinar.
3. **Portar por partes, empezando por lo que más bloquea:** numeración e idempotencia
   (H1, H2), luego stock (H4), y dejar contabilidad y DIAN en el outbox (H3).
4. **Prueba de carga** con 50 ventas simultáneas (criterio de salida de la fase 1).

## 5. Decisiones que necesita el equipo

- ¿Se permite rellenar huecos en la numeración? (H1, impacto DIAN)
- ¿Se aplican los arreglos rápidos 1 y 2 en apipos ya, mientras se migra?
- Base de QA con datos de un cliente real para grabar los golden tests.
