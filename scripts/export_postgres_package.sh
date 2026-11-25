#!/usr/bin/env bash
# ==============================================================================
# MB PERSONALIZA — EXPORTAÇÃO OFICIAL POSTGRESQL (.sql, .dump, .zip) + TESTE
# Executar na Hostinger VPS com PostgreSQL ativo (Docker ou externo).
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "$PROJECT_ROOT"

PKG_DIR="${PROJECT_ROOT}/data/postgres_package"
mkdir -p "$PKG_DIR"

if [ -f ".env" ]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

DB_HOST="${SQL_HOST:-postgres}"
DB_PORT="${SQL_PORT:-5432}"
DB_NAME="${SQL_DB_NAME:-${POSTGRES_DB:-mb_personaliza}}"
DB_USER="${SQL_USER:-${POSTGRES_USER:-mb_app_user}}"
DB_PASS="${SQL_PASSWORD:-${POSTGRES_PASSWORD:-}}"

echo "=== [1/5] Gerando pacote SQL/DDL base ==="
npx tsx scripts/generate_postgres_package.ts

run_pg_dump_cmd() {
  if [ -n "${DATABASE_URL:-}" ] && command -v pg_dump >/dev/null 2>&1; then
    pg_dump "$DATABASE_URL" "$@"
  elif command -v pg_dump >/dev/null 2>&1; then
    PGPASSWORD="$DB_PASS" pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" "$@"
  elif command -v docker >/dev/null 2>&1 && docker ps --format '{{.Names}}' | grep -q 'mbpersonaliza_postgres'; then
    docker compose exec -T -e PGPASSWORD="$DB_PASS" postgres pg_dump -U "$DB_USER" -d "$DB_NAME" "$@"
  else
    echo "ERRO: pg_dump indisponível no host e container mbpersonaliza_postgres não está em execução."
    exit 1
  fi
}

echo "=== [2/5] Gerando backup completo PostgreSQL (.sql) ==="
run_pg_dump_cmd --clean --if-exists --no-owner --no-privileges -Fp > "${PKG_DIR}/mbpersonaliza_database.sql"

echo "=== [3/5] Gerando backup PostgreSQL Custom (.dump) ==="
run_pg_dump_cmd --no-owner --no-privileges -Fc > "${PKG_DIR}/mbpersonaliza_database.dump"

echo "=== [4/5] Testando restauração real em banco separado (mbpersonaliza_restore_test) ==="
TEST_DB="mbpersonaliza_restore_test"
if command -v docker >/dev/null 2>&1 && docker ps --format '{{.Names}}' | grep -q 'mbpersonaliza_postgres'; then
  docker compose exec -T -e PGPASSWORD="$DB_PASS" postgres psql -U "$DB_USER" -d postgres -c "DROP DATABASE IF EXISTS ${TEST_DB};"
  docker compose exec -T -e PGPASSWORD="$DB_PASS" postgres psql -U "$DB_USER" -d postgres -c "CREATE DATABASE ${TEST_DB};"
  docker compose exec -T -e PGPASSWORD="$DB_PASS" postgres pg_restore -U "$DB_USER" -d "$TEST_DB" --no-owner --no-privileges < "${PKG_DIR}/mbpersonaliza_database.dump"
  docker compose exec -T -e PGPASSWORD="$DB_PASS" postgres psql -U "$DB_USER" -d "$TEST_DB" -c "SELECT COUNT(*) AS tabelas_restauradas FROM pg_tables WHERE schemaname='public';"
  docker compose exec -T -e PGPASSWORD="$DB_PASS" postgres psql -U "$DB_USER" -d postgres -c "DROP DATABASE IF EXISTS ${TEST_DB};"
elif command -v psql >/dev/null 2>&1 && command -v pg_restore >/dev/null 2>&1; then
  PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c "DROP DATABASE IF EXISTS ${TEST_DB};"
  PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c "CREATE DATABASE ${TEST_DB};"
  PGPASSWORD="$DB_PASS" pg_restore -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$TEST_DB" --no-owner --no-privileges "${PKG_DIR}/mbpersonaliza_database.dump"
  PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$TEST_DB" -c "SELECT COUNT(*) AS tabelas_restauradas FROM pg_tables WHERE schemaname='public';"
  PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c "DROP DATABASE IF EXISTS ${TEST_DB};"
fi

echo "=== [5/5] Compactando MB_PERSONALIZA_POSTGRESQL_COMPLETO.zip ==="
python3 - <<'PY'
import os, zipfile
pkg_dir = os.path.abspath("data/postgres_package")
zip_path = os.path.join(pkg_dir, "MB_PERSONALIZA_POSTGRESQL_COMPLETO.zip")
with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
    for root, _, files in os.walk(pkg_dir):
        for fn in sorted(files):
            if fn.endswith(".zip"):
                continue
            full = os.path.join(root, fn)
            rel = os.path.relpath(full, pkg_dir)
            zf.write(full, rel)
print("ZIP gerado:", zip_path, os.path.getsize(zip_path), "bytes")
PY

echo "✓ Pacote PostgreSQL completo pronto em: ${PKG_DIR}/MB_PERSONALIZA_POSTGRESQL_COMPLETO.zip"
