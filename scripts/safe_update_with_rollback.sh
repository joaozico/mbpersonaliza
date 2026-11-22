#!/usr/bin/env bash
# ==============================================================================
# MB PERSONALIZA — ATUALIZAÇÃO SEGURA COM BACKUP E ROLLBACK (HOSTINGER VPS)
# Segue rigorosamente a Seção 13:
#   - Preserva volumes Docker (uploads_data, backups_data, certbot_conf)
#   - Preserva Nginx, SSL e .env existentes
#   - Executa backup prévio antes de qualquer alteração
#   - Reinicia apenas o serviço 'app' (--no-deps)
#   - Suporta --rollback para restaurar imediatamente a imagem anterior
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "$PROJECT_ROOT"

APPLY_ADDITIVE_TABLES=false
DO_ROLLBACK=false
ROLLBACK_FILE="${PROJECT_ROOT}/data/.last_release_rollback"

for arg in "$@"; do
  case "$arg" in
    --apply-migrations)
      APPLY_ADDITIVE_TABLES=true
      ;;
    --rollback)
      DO_ROLLBACK=true
      ;;
    *)
      echo "Uso: $0 [--apply-migrations] [--rollback]"
      exit 1
      ;;
  esac
done

CYAN="\033[1;36m"
GREEN="\033[1;32m"
YELLOW="\033[1;33m"
RED="\033[1;31m"
RESET="\033[0m"

if [ "$DO_ROLLBACK" = true ]; then
  echo -e "${YELLOW}=== INICIANDO ROLLBACK CONTROLADO DA APLICAÇÃO ===${RESET}"
  if [ ! -f "$ROLLBACK_FILE" ]; then
    echo -e "${RED}Erro: Arquivo de referência '${ROLLBACK_FILE}' não encontrado.${RESET}"
    exit 1
  fi
  # shellcheck disable=SC1090
  source "$ROLLBACK_FILE"
  if [ -n "${PREV_IMAGE_TAG:-}" ] && docker image inspect "$PREV_IMAGE_TAG" >/dev/null 2>&1; then
    CURRENT_APP_IMAGE=$(docker compose config --images | grep -E 'app' | head -n1 || true)
    if [ -n "$CURRENT_APP_IMAGE" ]; then
      docker tag "$PREV_IMAGE_TAG" "$CURRENT_APP_IMAGE"
    fi
    docker compose up -d --no-deps --no-build app
    echo -e "${GREEN}✓ Container 'app' revertido para imagem '${PREV_IMAGE_TAG}' sem tocar em Nginx, SSL ou volumes.${RESET}"
  else
    echo -e "${RED}Erro: Imagem de rollback '${PREV_IMAGE_TAG:-desconhecida}' não disponível localmente.${RESET}"
    echo -e "Caso use git, restaure o commit '${PREV_GIT_SHA:-HEAD~1}' e execute 'docker compose up -d --no-deps --build app'."
    exit 1
  fi
  exit 0
fi

echo -e "${CYAN}================================================================${RESET}"
echo -e "${CYAN}   MB PERSONALIZA — DEPLOY CONTROLADO COM ROLLBACK (SEÇÃO 13)   ${RESET}"
echo -e "${CYAN}================================================================${RESET}"

# Passo 1: Preflight Audit somente leitura
echo -e "\n${YELLOW}[1/6] Executando auditoria pré-voo...${RESET}"
bash "${SCRIPT_DIR}/vps_preflight_audit.sh"

# Passo 2: Registrar estado atual para rollback imediato
echo -e "\n${YELLOW}[2/6] Registrando snapshot da imagem/versão atual para rollback...${RESET}"
mkdir -p "${PROJECT_ROOT}/data"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
PREV_GIT_SHA=$(git rev-parse --short HEAD 2>/dev/null || echo "no-git")
RUNNING_IMAGE=$(docker inspect --format='{{.Image}}' mbpersonaliza_app 2>/dev/null || true)
PREV_IMAGE_TAG="mbpersonaliza-app-rollback:${TIMESTAMP}"

if [ -n "$RUNNING_IMAGE" ]; then
  docker tag "$RUNNING_IMAGE" "$PREV_IMAGE_TAG"
  echo -e "  ${GREEN}✓${RESET} Imagem atual preservada como '${PREV_IMAGE_TAG}'"
fi

cat > "$ROLLBACK_FILE" <<EOF
PREV_GIT_SHA="${PREV_GIT_SHA}"
PREV_IMAGE_TAG="${PREV_IMAGE_TAG}"
RECORDED_AT="${TIMESTAMP}"
EOF

# Passo 3: Backup completo do PostgreSQL antes da implantação
echo -e "\n${YELLOW}[3/6] Executando backup completo do PostgreSQL (./scripts/backup_db.sh)...${RESET}"
bash "${SCRIPT_DIR}/backup_db.sh"

# Passo 4: Compilar e reiniciar SOMENTE o serviço 'app' (preserva nginx, certbot e volumes)
echo -e "\n${YELLOW}[4/6] Reconstruindo e reiniciando apenas o container 'app'...${RESET}"
docker compose build app
docker compose up -d --no-deps app

# Passo 5: Aguardar /api/health e aplicar tabelas aditivas somente se solicitado
echo -e "\n${YELLOW}[5/6] Aguardando saúde da aplicação...${RESET}"
ONLINE=false
for _ in $(seq 1 20); do
  if curl -sf http://127.0.0.1:3000/api/health >/dev/null 2>&1; then
    ONLINE=true
    break
  fi
  sleep 2
done

if [ "$ONLINE" != true ]; then
  echo -e "${RED}ERRO: Container 'app' não respondeu em /api/health! Execute '$0 --rollback' para reverter.${RESET}"
  exit 1
fi
echo -e "  ${GREEN}✓${RESET} Aplicação saudável em http://127.0.0.1:3000"

if [ "$APPLY_ADDITIVE_TABLES" = true ]; then
  echo -e "  Garantindo novas tabelas aditivas (CREATE TABLE IF NOT EXISTS)..."
  curl -sf -X POST http://127.0.0.1:3000/api/db/ensure-additive-tables \
    -H "Content-Type: application/json" \
    -H "x-user-role: admin"
  echo ""
fi

# Passo 6: Verificações pós-deploy
echo -e "\n${YELLOW}[6/6] Validando status do PostgreSQL e containers...${RESET}"
curl -sf http://127.0.0.1:3000/api/db/status | head -c 500
echo ""
docker compose ps

echo -e "\n${GREEN}✓ Atualização segura concluída! Rollback disponível via: $0 --rollback${RESET}"
