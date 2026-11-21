#!/usr/bin/env bash
# Corre TODAS las pruebas de la base de datos (empresas y roles) en un Postgres temporal.
# No toca ninguna base real. Uso:  PGBIN=/usr/lib/postgresql/16/bin ./run-local.sh
#
# Si lo corrés como root, usá un usuario común (Postgres no arranca como root).
set -u
PGBIN=${PGBIN:-/usr/lib/postgresql/16/bin}
PORT=${PGPORT:-54329}
HERE=$(cd "$(dirname "$0")" && pwd)
MIG="$HERE/../migrations"
ROLL="$HERE/../rollbacks"
WORK=${WORK:-$(mktemp -d)}
M1="$MIG/20260327120000_init_crm.sql"
M2="$MIG/20261119120000_save_note_atomic.sql"
M3="$MIG/20261120130000_profile_theme.sql"
M4="$MIG/20261121120000_orgs_roles_stage1.sql"
RB="$ROLL/20261121120000_orgs_roles_stage1_rollback.sql"
rm -f "$WORK/counts"

cleanup() { "$PGBIN/pg_ctl" -D "$WORK/data" stop -m fast >/dev/null 2>&1; }
trap cleanup EXIT

"$PGBIN/initdb" -D "$WORK/data" -A trust >/dev/null || exit 2
"$PGBIN/pg_ctl" -D "$WORK/data" -o "-p $PORT -k $WORK" -l "$WORK/pg.log" start -w >/dev/null || exit 2

psq()  { "$PGBIN/psql" -h "$WORK" -p "$PORT" -U postgres -X -q -v ON_ERROR_STOP=1 "$@"; }
psqt() { ( cd "$HERE" && "$PGBIN/psql" -h "$WORK" -p "$PORT" -U postgres -X -q -v ON_ERROR_STOP=0 "$@" 2>&1 ); }
newdb() { psq -d postgres -c "create database $1 $([ -n "${2:-}" ] && echo "template $2")" ; }

report() {  # $1 = título, lee las líneas de prueba por stdin
  local title="$1" ok=0 fail=0 line
  echo; echo "=== $title ==="
  while IFS= read -r line; do
    case "$line" in
      *"NOTICE:  OK"*)   ok=$((ok+1));   echo "  ${line#*NOTICE:  }" ;;
      *"NOTICE:  FAIL"*) fail=$((fail+1)); echo "  ${line#*NOTICE:  }" ;;
      *"ERROR:"*)        fail=$((fail+1)); echo "  FAIL (error inesperado) ${line}" ;;
    esac
  done
  echo "  -> $ok bien, $fail mal"
  echo "$ok $fail" >> "$WORK/counts"
}

# --- Base "como hoy": migraciones anteriores + datos de ejemplo ---
newdb t_legacy
psq -d t_legacy -f "$HERE/stubs.sql" -f "$M1" -f "$M2" -f "$M3" -f "$HERE/10_legacy_seed.sql" || { echo "No se pudo armar la base de partida"; exit 2; }

# --- 1) Traspaso de los datos actuales ---
newdb t_backfill t_legacy
psq -d t_backfill -f "$M4" || { echo "LA MIGRACIÓN FALLÓ"; exit 1; }
psqt -d t_backfill -f "$HERE/20_backfill_checks.sql" | report "1) Traspaso de los datos actuales"

# --- 2) Todo o nada: si falla a mitad de camino, no queda nada a medias ---
newdb t_atomic t_legacy
sed 's/^commit;$/select 1\/0;\ncommit;/' "$M4" > "$WORK/m4_roto.sql"
psq -d t_atomic -f "$WORK/m4_roto.sql" >/dev/null 2>&1; rc=$?
{
  [ $rc -ne 0 ] && echo "NOTICE:  OK   la migración con un error al final se rechaza" || echo "NOTICE:  FAIL la migración rota NO falló"
  [ "$(psq -d t_atomic -Atc "select to_regclass('public.organizations') is null")" = "t" ] && echo "NOTICE:  OK   no quedó la tabla de empresas" || echo "NOTICE:  FAIL quedó la tabla de empresas"
  [ "$(psq -d t_atomic -Atc "select count(*) from information_schema.columns where table_name='contacts' and column_name='org_id'")" = "0" ] && echo "NOTICE:  OK   no quedó la columna org_id" || echo "NOTICE:  FAIL quedó org_id"
  [ "$(psq -d t_atomic -Atc "select count(*) from pg_policies where policyname='contacts_select_own'")" = "1" ] && echo "NOTICE:  OK   las reglas anteriores siguen intactas" || echo "NOTICE:  FAIL se perdieron las reglas anteriores"
  [ "$(psq -d t_atomic -Atc "select count(*) from public.contacts")" = "6" ] && echo "NOTICE:  OK   los 6 contactos siguen ahí" || echo "NOTICE:  FAIL cambió la cantidad de contactos"
} | report "2) Todo o nada (la migración falla a propósito al final)"

# --- 3) Marcha atrás + volver a migrar ---
newdb t_rollback t_backfill
psq -d t_rollback -v snap=_snap_pre -f "$HERE/snap.sql"
psq -d t_rollback -f "$RB" || { echo "LA MARCHA ATRÁS FALLÓ"; exit 1; }
psqt -d t_rollback -f "$HERE/50_rollback_checks.sql" | report "3) Marcha atrás"
psq -d t_rollback -v snap=_snap_pre2 -f "$HERE/snap.sql"   # foto justo antes de volver a migrar
psq -d t_rollback -f "$M4" || { echo "NO SE PUDO VOLVER A MIGRAR"; exit 1; }
psqt -d t_rollback -f "$HERE/60_roundtrip_checks.sql" | report "4) Volver a migrar después de la marcha atrás"

# --- 5) Roles, espionaje y rendimiento ---
newdb t_roles
psq -d t_roles -f "$HERE/stubs.sql" -f "$M1" -f "$M2" -f "$M3" -f "$M4" || { echo "No se pudo armar la base de roles"; exit 2; }
psqt -d t_roles -f "$HERE/30_roles_matrix.sql" | report "5) Roles y espionaje (2 empresas, 11 personas)"
psqt -d t_roles -f "$HERE/40_performance.sql" | report "6) Rendimiento con 10.000 contactos"

TOTAL_OK=$(awk '{a+=$1} END {print a+0}' "$WORK/counts"); TOTAL_FAIL=$(awk '{a+=$2} END {print a+0}' "$WORK/counts")
echo; echo "================================================"
echo " TOTAL: $TOTAL_OK bien, $TOTAL_FAIL mal"
echo "================================================"
[ "$TOTAL_FAIL" -eq 0 ]
