#!/usr/bin/env bash
# =============================================================================
# Captura instantáneas de bloqueos durante la hora pico (PARTE 1 de
# medir-bloqueos.sql) y las guarda en archivos TSV para analizarlas después.
#
# Uso:
#   ./capturar-bloqueos.sh <archivo-credenciales.cnf> <base> [intervalo_seg=5] [duracion_min=60]
#
# El archivo de credenciales (NUNCA la contraseña en la línea de comandos):
#   [client]
#   host=192.168.254.233
#   user=<usuario administrador>
#   password=<contraseña>
# con permisos 600:  chmod 600 archivo.cnf
#
# Resultado: carpeta captura-<base>-<fecha>/ con un TSV por consulta.
# ⚠ Contiene textos de consultas con datos de clientes: no compartir en público.
# =============================================================================
set -euo pipefail

CNF="${1:?Falta el archivo de credenciales .cnf}"
DB="${2:?Falta el nombre de la base}"
INTERVALO="${3:-5}"
DURACION_MIN="${4:-60}"

[[ -r "$CNF" ]] || { echo "No se puede leer $CNF" >&2; exit 1; }
[[ "$DB" =~ ^[A-Za-z0-9_]+$ ]] || { echo "Nombre de base inválido: $DB" >&2; exit 1; }
[[ "$INTERVALO" =~ ^[0-9]+$ && "$DURACION_MIN" =~ ^[0-9]+$ ]] || { echo "Intervalo y duración deben ser números" >&2; exit 1; }

SALIDA="captura-${DB}-$(date +%Y%m%d-%H%M)"
mkdir -p "$SALIDA"
chmod 700 "$SALIDA"

consultar() { mysql --defaults-extra-file="$CNF" --batch -e "SET @db='${DB}'; $1"; }

# Verifica conexión y permisos antes de empezar.
consultar "SELECT 1 FROM sys.innodb_lock_waits LIMIT 1" >/dev/null

declare -A CONSULTAS=(
  [esperas]="SELECT NOW() AS capturado, wait_age_secs, locked_table, locked_index, locked_type,
      waiting_pid, waiting_trx_age, waiting_lock_mode, REPLACE(LEFT(waiting_query,500),'\n',' ') AS waiting_query,
      blocking_pid, blocking_trx_age, blocking_lock_mode, REPLACE(LEFT(blocking_query,500),'\n',' ') AS blocking_query,
      blocking_trx_rows_locked
    FROM sys.innodb_lock_waits WHERE locked_table_schema=@db"
  [trx_largas]="SELECT NOW() AS capturado, t.trx_mysql_thread_id AS pid, th.PROCESSLIST_USER AS usuario,
      TIMESTAMPDIFF(SECOND,t.trx_started,NOW()) AS segundos_abierta, t.trx_state, th.PROCESSLIST_COMMAND AS comando,
      t.trx_rows_locked, t.trx_rows_modified, REPLACE(LEFT(t.trx_query,500),'\n',' ') AS consulta_actual,
      REPLACE(LEFT(esc.SQL_TEXT,500),'\n',' ') AS ultima_consulta
    FROM information_schema.INNODB_TRX t
    JOIN performance_schema.threads th ON th.PROCESSLIST_ID=t.trx_mysql_thread_id
    LEFT JOIN performance_schema.events_statements_current esc ON esc.THREAD_ID=th.THREAD_ID
    WHERE th.PROCESSLIST_DB=@db AND t.trx_started < NOW() - INTERVAL 2 SECOND"
  [bloqueos_tomados]="SELECT NOW() AS capturado, OBJECT_NAME AS tabla, INDEX_NAME AS indice, LOCK_MODE, LOCK_STATUS, COUNT(*) AS bloqueos
    FROM performance_schema.data_locks WHERE OBJECT_SCHEMA=@db
    GROUP BY OBJECT_NAME, INDEX_NAME, LOCK_MODE, LOCK_STATUS HAVING COUNT(*) >= 5"
  [metadatos]="SELECT NOW() AS capturado, ml.OBJECT_NAME AS tabla, ml.LOCK_TYPE, th.PROCESSLIST_ID AS pid,
      th.PROCESSLIST_TIME AS segundos, REPLACE(LEFT(th.PROCESSLIST_INFO,300),'\n',' ') AS consulta
    FROM performance_schema.metadata_locks ml JOIN performance_schema.threads th ON th.THREAD_ID=ml.OWNER_THREAD_ID
    WHERE ml.OBJECT_SCHEMA=@db AND ml.OBJECT_TYPE='TABLE' AND ml.LOCK_STATUS='PENDING'"
  [conexiones]="SELECT NOW() AS capturado, PROCESSLIST_USER AS usuario, PROCESSLIST_COMMAND AS comando, COUNT(*) AS conexiones
    FROM performance_schema.threads WHERE TYPE='FOREGROUND' AND PROCESSLIST_DB=@db
    GROUP BY PROCESSLIST_USER, PROCESSLIST_COMMAND"
)

FIN=$(( $(date +%s) + DURACION_MIN * 60 ))
echo "Capturando '${DB}' cada ${INTERVALO}s durante ${DURACION_MIN} min en ${SALIDA}/ (Ctrl+C para terminar antes)"

while (( $(date +%s) < FIN )); do
  for nombre in "${!CONSULTAS[@]}"; do
    archivo="${SALIDA}/${nombre}.tsv"
    if [[ -s "$archivo" ]]; then
      consultar "${CONSULTAS[$nombre]}" | tail -n +2 >>"$archivo" || true
    else
      consultar "${CONSULTAS[$nombre]}" >"$archivo" || true
      # Si la consulta no devolvió filas, el archivo queda vacío y el encabezado se escribe después.
    fi
  done
  esperas=$(( $(wc -l <"${SALIDA}/esperas.tsv") ))
  printf '\r%s  filas de esperas registradas: %s   ' "$(date +%H:%M:%S)" "$(( esperas > 0 ? esperas - 1 : 0 ))"
  sleep "$INTERVALO"
done

echo
echo "Listo. Resultados en ${SALIDA}/"
