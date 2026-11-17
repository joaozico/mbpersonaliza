#!/usr/bin/env bash
# ==============================================================================
# MB PERSONALIZA - SCRIPT DE BACKUP PERIÓDICO DO POSTGRESQL EXTERNO (REQ. 11.5)
# Executa dump completo, compacta com gzip, calcula checksum SHA256 e
# aplica política de retenção configurável (padrão 30 dias).
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "$PROJECT_ROOT"

BACKUP_DIR="${BACKUP_DIR:-${PROJECT_ROOT}/data/backups}"
mkdir -p "$BACKUP_DIR"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/mb_backup_${TIMESTAMP}.sql.gz"
CHECKSUM_FILE="${BACKUP_FILE}.sha256"
LOG_FILE="${BACKUP_DIR}/backup.log"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log "=== Iniciando rotina de Backup do PostgreSQL MB Personaliza ==="

# Carregar variáveis de ambiente se disponíveis
if [ -f ".env" ]; then
    export $(grep -v '^#' .env | xargs)
fi

# 1. Estratégia de Dump: pg_dump nativo ou via Container
if command -v pg_dump &> /dev/null; then
    log "Executando pg_dump no host local..."
    if [ -n "${DATABASE_URL:-}" ]; then
        pg_dump "$DATABASE_URL" --clean --if-exists --no-owner --no-privileges | gzip > "$BACKUP_FILE"
    else
        PGPASSWORD="${SQL_PASSWORD:-}" pg_dump \
            -h "${SQL_HOST:-localhost}" \
            -p "${SQL_PORT:-5432}" \
            -U "${SQL_USER:-postgres}" \
            -d "${SQL_DB_NAME:-mb_personaliza}" \
            --clean --if-exists --no-owner --no-privileges | gzip > "$BACKUP_FILE"
    fi
elif docker compose exec -T app command -v curl &> /dev/null; then
    log "pg_dump não encontrado no host. Gerando exportação JSON consistente via API interna de Backup..."
    BACKUP_JSON="${BACKUP_DIR}/mb_backup_${TIMESTAMP}.json"
    curl -s -X POST http://127.0.0.1:3000/api/backup/export \
         -H "Content-Type: application/json" \
         -d '{"triggeredBy": "cron_script"}' > "$BACKUP_JSON"
    gzip "$BACKUP_JSON"
    BACKUP_FILE="${BACKUP_JSON}.gz"
    CHECKSUM_FILE="${BACKUP_FILE}.sha256"
else
    log "ERRO: Nem pg_dump nem container da aplicação estão disponíveis para backup!"
    exit 1
fi

# 2. Gerar Checksum SHA-256 para integridade
sha256sum "$BACKUP_FILE" > "$CHECKSUM_FILE"
BACKUP_SIZE=$(ls -lh "$BACKUP_FILE" | awk '{print $5}')

log "✓ Backup concluído com sucesso: $BACKUP_FILE ($BACKUP_SIZE)"
log "✓ Checksum: $(cat "$CHECKSUM_FILE")"

# 3. Política de Retenção: Limpar backups mais antigos que RETENTION_DAYS
log "Aplicando retenção de $RETENTION_DAYS dias..."
find "$BACKUP_DIR" -type f \( -name "mb_backup_*.sql.gz" -o -name "mb_backup_*.json.gz" -o -name "*.sha256" \) -mtime +$RETENTION_DAYS -exec rm -f {} +
log "✓ Política de retenção aplicada."
log "=== Rotina de Backup finalizada com êxito ==="
