-- =============================================================================
-- Diagnóstico de bloqueos y consultas costosas (plan de migración, fase 0)
-- MySQL 8.0.x. Ejecutar con un usuario ADMINISTRADOR (necesita performance_schema,
-- sys, SYSTEM_VARIABLES_ADMIN y PROCESS).
--
-- Cómo usarlo (detalle en README.md de esta carpeta):
--   PARTE 0  → justo ANTES de la hora pico (una vez).
--   PARTE 1  → DURANTE la hora pico, varias veces (o con capturar-bloqueos.sh).
--   PARTE 2  → AL FINAL de la hora pico (una vez); guardar el resultado.
--   PARTE 3  → cuando se termine de medir (deja todo como estaba).
--
-- Nada de este script modifica datos ni la estructura de las tablas: solo
-- cambia variables globales de diagnóstico, que se pierden al reiniciar MySQL.
--
-- ⚠ Los textos de las consultas pueden incluir datos de clientes (documentos,
--   nombres, valores). Tratar los resultados como información confidencial.
-- =============================================================================

-- Base del cliente que se va a medir (cambiar):
SET @db = 'NOMBRE_DE_LA_BASE';


-- =============================================================================
-- PARTE 0 · Activar la medición (antes de la hora pico)
-- =============================================================================

-- 0.1 Foto de la configuración actual (guardarla para la PARTE 3).
SELECT @@version, @@transaction_isolation, @@innodb_lock_wait_timeout,
       @@innodb_print_all_deadlocks, @@slow_query_log, @@long_query_time,
       @@log_slow_extra, @@innodb_buffer_pool_size / 1048576 AS buffer_pool_mb,
       @@max_connections;

-- 0.2 Registrar TODOS los deadlocks en el log de errores de MySQL
--     (por defecto solo queda el último en SHOW ENGINE INNODB STATUS).
SET GLOBAL innodb_print_all_deadlocks = ON;

-- 0.3 Slow log más fino: consultas de más de 0,5 s, con filas examinadas y bloqueos.
--     Solo aplica a conexiones NUEVAS (PHP-FPM y Laravel abren una por petición).
SET GLOBAL slow_query_log  = ON;
SET GLOBAL long_query_time = 0.5;
SET GLOBAL log_slow_extra  = ON;

-- 0.4 Medir la duración de cada TRANSACCIÓN completa (apagado por defecto).
--     Costo moderado: dejarlo solo durante la ventana de medición.
UPDATE performance_schema.setup_instruments
   SET ENABLED = 'YES', TIMED = 'YES'
 WHERE NAME = 'transaction';
UPDATE performance_schema.setup_consumers
   SET ENABLED = 'YES'
 WHERE NAME IN ('events_transactions_current', 'events_transactions_history_long',
                'events_statements_history_long');

-- 0.5 Reiniciar los acumulados para que la PARTE 2 refleje solo la hora pico.
--     (Afecta a todo el servidor MySQL, no solo a esta base.)
TRUNCATE TABLE performance_schema.events_statements_summary_by_digest;
TRUNCATE TABLE performance_schema.table_lock_waits_summary_by_table;
TRUNCATE TABLE performance_schema.events_transactions_summary_global_by_event_name;

-- 0.6 Contadores de bloqueos al inicio (restar del valor final en la PARTE 2).
SELECT NOW() AS inicio, VARIABLE_NAME, VARIABLE_VALUE
  FROM performance_schema.global_status
 WHERE VARIABLE_NAME LIKE 'Innodb_row_lock%';
SELECT NOW() AS inicio, NAME, COUNT
  FROM information_schema.INNODB_METRICS
 WHERE NAME IN ('lock_deadlocks', 'lock_timeouts');


-- =============================================================================
-- PARTE 1 · Instantánea (durante la hora pico; repetir cada pocos segundos,
--           sobre todo cuando los cajeros reporten que "se pegó")
-- =============================================================================

-- 1.1 ¿Quién espera a quién? Una fila por cada espera de bloqueo en curso.
--     blocking_query vacío = la transacción que bloquea está ABIERTA SIN HACER NADA:
--     casi siempre es código que llamó a algo externo (DIAN, datáfono, correo,
--     impresión) con la transacción abierta. Su última consulta sale en 1.3.
SELECT wait_started, wait_age_secs,
       locked_table, locked_index, locked_type,
       waiting_pid,  waiting_trx_age,  waiting_lock_mode,  LEFT(waiting_query, 500)  AS waiting_query,
       blocking_pid, blocking_trx_age, blocking_lock_mode, LEFT(blocking_query, 500) AS blocking_query,
       blocking_trx_rows_locked
  FROM sys.innodb_lock_waits
 WHERE locked_table_schema = @db
 ORDER BY wait_age_secs DESC;

-- 1.2 Transacciones abiertas hace más de 2 segundos (deberían durar milisegundos).
SELECT t.trx_mysql_thread_id                         AS pid,
       th.PROCESSLIST_USER                           AS usuario,
       th.PROCESSLIST_HOST                           AS origen,
       TIMESTAMPDIFF(SECOND, t.trx_started, NOW())   AS segundos_abierta,
       t.trx_state, t.trx_isolation_level,
       th.PROCESSLIST_COMMAND                        AS comando,   -- 'Sleep' = abierta sin hacer nada
       t.trx_tables_locked, t.trx_rows_locked, t.trx_rows_modified,
       LEFT(t.trx_query, 500)                        AS consulta_actual
  FROM information_schema.INNODB_TRX t
  JOIN performance_schema.threads th ON th.PROCESSLIST_ID = t.trx_mysql_thread_id
 WHERE th.PROCESSLIST_DB = @db
   AND t.trx_started < NOW() - INTERVAL 2 SECOND
 ORDER BY t.trx_started;

-- 1.3 Última consulta de cada transacción abierta e inactiva ("Sleep" en 1.2).
--     Es lo último que hizo el código antes de irse a hacer otra cosa sin COMMIT.
SELECT t.trx_mysql_thread_id                       AS pid,
       TIMESTAMPDIFF(SECOND, t.trx_started, NOW()) AS segundos_abierta,
       LEFT(esc.SQL_TEXT, 1000)                    AS ultima_consulta
  FROM information_schema.INNODB_TRX t
  JOIN performance_schema.threads th                 ON th.PROCESSLIST_ID = t.trx_mysql_thread_id
  JOIN performance_schema.events_statements_current esc ON esc.THREAD_ID   = th.THREAD_ID
 WHERE th.PROCESSLIST_DB = @db
   AND th.PROCESSLIST_COMMAND = 'Sleep'
   AND t.trx_started < NOW() - INTERVAL 1 SECOND;

-- 1.4 Qué bloqueos hay tomados, por tabla e índice.
--     lock_mode 'X' o 'S' a secas = next-key (fila + hueco); 'X,GAP' = gap lock;
--     'X,REC_NOT_GAP' = solo la fila. Muchos next-key/GAP = efecto de REPEATABLE READ.
SELECT OBJECT_NAME AS tabla, INDEX_NAME AS indice, LOCK_TYPE, LOCK_MODE, LOCK_STATUS,
       COUNT(*) AS bloqueos
  FROM performance_schema.data_locks
 WHERE OBJECT_SCHEMA = @db
 GROUP BY OBJECT_NAME, INDEX_NAME, LOCK_TYPE, LOCK_MODE, LOCK_STATUS
 ORDER BY bloqueos DESC
 LIMIT 30;

-- 1.5 Esperas por bloqueo de METADATOS (ALTER, TRUNCATE, LOCK TABLES, backups).
SELECT ml.OBJECT_NAME AS tabla, ml.LOCK_TYPE, ml.LOCK_STATUS,
       th.PROCESSLIST_ID AS pid, th.PROCESSLIST_TIME AS segundos,
       LEFT(th.PROCESSLIST_INFO, 300) AS consulta
  FROM performance_schema.metadata_locks ml
  JOIN performance_schema.threads th ON th.THREAD_ID = ml.OWNER_THREAD_ID
 WHERE ml.OBJECT_SCHEMA = @db
   AND ml.OBJECT_TYPE = 'TABLE'
   AND ml.LOCK_STATUS = 'PENDING';

-- 1.6 Conexiones por usuario y estado (¿se está agotando max_connections?).
SELECT PROCESSLIST_USER AS usuario, PROCESSLIST_COMMAND AS comando, COUNT(*) AS conexiones,
       MAX(PROCESSLIST_TIME) AS max_segundos
  FROM performance_schema.threads
 WHERE TYPE = 'FOREGROUND' AND PROCESSLIST_DB = @db
 GROUP BY PROCESSLIST_USER, PROCESSLIST_COMMAND
 ORDER BY conexiones DESC;


-- =============================================================================
-- PARTE 2 · Acumulados (al final de la hora pico; guardar todo el resultado)
-- =============================================================================

-- 2.1 Contadores de bloqueos al final (comparar con 0.6).
--     Innodb_row_lock_waits = cuántas veces alguien esperó un bloqueo de fila.
--     lock_timeouts = esperas que llegaron a innodb_lock_wait_timeout y fallaron.
SELECT NOW() AS fin, VARIABLE_NAME, VARIABLE_VALUE
  FROM performance_schema.global_status
 WHERE VARIABLE_NAME LIKE 'Innodb_row_lock%';
SELECT NOW() AS fin, NAME, COUNT
  FROM information_schema.INNODB_METRICS
 WHERE NAME IN ('lock_deadlocks', 'lock_timeouts');

-- 2.2 Las 20 consultas que más tiempo total consumieron.
--     tiempo_bloqueo alto = esperó bloqueos; filas_examinadas >> filas_enviadas = falta índice.
SELECT FORMAT_PICO_TIME(SUM_TIMER_WAIT)  AS tiempo_total,
       COUNT_STAR                        AS ejecuciones,
       FORMAT_PICO_TIME(AVG_TIMER_WAIT)  AS promedio,
       FORMAT_PICO_TIME(QUANTILE_95)     AS p95,
       FORMAT_PICO_TIME(MAX_TIMER_WAIT)  AS maximo,
       FORMAT_PICO_TIME(SUM_LOCK_TIME)   AS tiempo_bloqueo,
       SUM_ROWS_EXAMINED                 AS filas_examinadas,
       SUM_ROWS_SENT                     AS filas_enviadas,
       SUM_ROWS_AFFECTED                 AS filas_modificadas,
       SUM_NO_INDEX_USED                 AS sin_indice,
       LEFT(DIGEST_TEXT, 800)            AS consulta
  FROM performance_schema.events_statements_summary_by_digest
 WHERE SCHEMA_NAME = @db
 ORDER BY SUM_TIMER_WAIT DESC
 LIMIT 20;

-- 2.3 Las 20 consultas que más tiempo pasaron ESPERANDO bloqueos.
SELECT FORMAT_PICO_TIME(SUM_LOCK_TIME)                  AS tiempo_bloqueo,
       COUNT_STAR                                       AS ejecuciones,
       FORMAT_PICO_TIME(SUM_LOCK_TIME / COUNT_STAR)     AS bloqueo_promedio,
       FORMAT_PICO_TIME(MAX_TIMER_WAIT)                 AS maximo,
       LEFT(DIGEST_TEXT, 800)                           AS consulta
  FROM performance_schema.events_statements_summary_by_digest
 WHERE SCHEMA_NAME = @db
 ORDER BY SUM_LOCK_TIME DESC
 LIMIT 20;

-- 2.4 Consultas que recorren tablas completas (candidatas a índice; revisar con EXPLAIN).
SELECT exec_count, total_latency, no_index_used_count, rows_examined_avg, rows_sent_avg,
       LEFT(query, 800) AS consulta
  FROM sys.statements_with_full_table_scans
 WHERE db = @db
 ORDER BY no_index_used_count DESC
 LIMIT 20;

-- 2.5 Tablas con más espera de bloqueos de tabla y más escrituras (dónde chocan).
SELECT OBJECT_NAME AS tabla,
       FORMAT_PICO_TIME(SUM_TIMER_WAIT)       AS espera_total,
       COUNT_READ, COUNT_WRITE,
       FORMAT_PICO_TIME(SUM_TIMER_WRITE)      AS espera_escritura
  FROM performance_schema.table_lock_waits_summary_by_table
 WHERE OBJECT_SCHEMA = @db
 ORDER BY SUM_TIMER_WAIT DESC
 LIMIT 20;

-- 2.6 Las 20 transacciones más largas registradas y sus consultas, en orden.
--     Requiere 0.4. El historial guarda las últimas 10.000 transacciones del
--     servidor: correr esta consulta varias veces durante el pico si hay mucho tráfico.
SELECT FORMAT_PICO_TIME(trx.TIMER_WAIT)          AS duracion,
       th.PROCESSLIST_USER                       AS usuario,
       trx.ISOLATION_LEVEL,
       COUNT(st.EVENT_ID)                        AS consultas,
       LEFT(GROUP_CONCAT(LEFT(st.SQL_TEXT, 200) ORDER BY st.EVENT_ID SEPARATOR '  ⟶  '), 3000)
                                                 AS consultas_de_la_transaccion
  FROM performance_schema.events_transactions_history_long trx
  JOIN performance_schema.threads th ON th.THREAD_ID = trx.THREAD_ID
  LEFT JOIN performance_schema.events_statements_history_long st
         ON st.THREAD_ID = trx.THREAD_ID
        AND st.NESTING_EVENT_ID = trx.EVENT_ID
        AND st.NESTING_EVENT_TYPE = 'TRANSACTION'
 WHERE trx.STATE = 'COMMITTED' OR trx.STATE = 'ROLLED BACK'
 GROUP BY trx.THREAD_ID, trx.EVENT_ID, trx.TIMER_WAIT, th.PROCESSLIST_USER, trx.ISOLATION_LEVEL
 ORDER BY trx.TIMER_WAIT DESC
 LIMIT 20;

-- 2.7 ¿Qué nivel de aislamiento usa realmente cada aplicación?
--     (El global es REPEATABLE-READ; si apipos ya pide READ COMMITTED se ve aquí.)
SELECT th.PROCESSLIST_USER AS usuario, vbt.VARIABLE_VALUE AS aislamiento, COUNT(*) AS conexiones
  FROM performance_schema.variables_by_thread vbt
  JOIN performance_schema.threads th ON th.THREAD_ID = vbt.THREAD_ID
 WHERE vbt.VARIABLE_NAME = 'transaction_isolation'
   AND th.PROCESSLIST_DB = @db
 GROUP BY th.PROCESSLIST_USER, vbt.VARIABLE_VALUE;

-- 2.8 Último deadlock con detalle (sección "LATEST DETECTED DEADLOCK").
--     Los demás quedan en el log de errores de MySQL gracias a 0.2.
SHOW ENGINE INNODB STATUS;


-- =============================================================================
-- PARTE 3 · Dejar todo como estaba (usar los valores de 0.1)
-- =============================================================================

-- SET GLOBAL innodb_print_all_deadlocks = OFF;   -- o dejarlo ON: no cuesta casi nada
-- SET GLOBAL long_query_time = 1;
-- SET GLOBAL log_slow_extra  = OFF;
-- UPDATE performance_schema.setup_instruments SET ENABLED = 'NO', TIMED = 'NO'
--  WHERE NAME = 'transaction';
-- UPDATE performance_schema.setup_consumers SET ENABLED = 'NO'
--  WHERE NAME IN ('events_transactions_current', 'events_transactions_history_long',
--                 'events_statements_history_long');
