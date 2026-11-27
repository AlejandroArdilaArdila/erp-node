# ADR 0004: Reglas de concurrencia

- Estado: aceptado
- Fecha: 2026-11-26

## Contexto

Con 5 a 10 pedidos o ventas simultáneos, Dolibarr y luego apipos se bloqueaban. La causa no es el lenguaje sino el diseño de las transacciones: largas, con llamadas externas mientras están abiertas, con bloqueos en distinto orden y con *gap locks* por REPEATABLE READ. Si la lógica se copia igual a NestJS, el resultado será el mismo.

## Decisión

Toda escritura de varias sentencias pasa por `TransaccionesLegado.ejecutar()` (`libs/database`), que:
- abre la transacción en **READ COMMITTED**;
- **la reintenta completa** ante deadlock (1213) o lock wait timeout (1205), hasta 3 intentos con espera exponencial aleatoria, y lo deja en el log.

Reglas de código (se revisan en code review):

1. **Transacciones cortas, sin efectos externos adentro.** Ni HTTP, ni DIAN, ni datáfono, ni Bold, ni correo, ni impresión. Como la transacción se puede reintentar, un efecto externo adentro se repetiría.
2. **Stock atómico:**
   ```ts
   const [r] = await tx.execute(sql`
     UPDATE ${stock} SET reel = reel - ${cantidad}
     WHERE fk_product = ${id} AND fk_entrepot = ${almacen} AND reel >= ${cantidad}`);
   if (r.affectedRows === 0) throw new ConflictException({ error: 'STOCK INSUFICIENTE' });
   ```
3. **Orden de bloqueo:** al tocar varios productos, se procesan ordenados por id.
4. **Consecutivos:** la fila del contador se bloquea (`FOR UPDATE`) al final, durante milisegundos.
5. **Idempotencia** en operaciones que el POS reintenta (ventas): clave enviada por el cliente con índice único.
6. **Outbox:** los efectos posteriores (contabilizar, enviar a la DIAN, notificar por WebSocket) se registran como evento dentro de la transacción y los ejecuta el `worker` después del commit (fase 1–2).

## Verificación

- Criterio de salida de la fase 1: prueba de carga con 50 ventas simultáneas sin deadlocks no resueltos y con p95 menor a 500 ms.
- Métricas: lock waits y deadlocks en MySQL (`performance_schema`) y reintentos en el log (`Transacción reintentada`).
