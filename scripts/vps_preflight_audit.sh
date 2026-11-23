#!/usr/bin/env bash
# ==============================================================================
# MB PERSONALIZA — AUDITORIA PRÉ-VOO SOMENTE-LEITURA (HOSTINGER VPS)
# Verifica containers, volumes persistentes, Nginx, SSL, variáveis .env (apenas
# presença das chaves, sem expor segredos) e saúde do PostgreSQL antes de deploy.
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "$PROJECT_ROOT"

CYAN="\033[1;36m"
GREEN="\033[1;32m"
YELLOW="\033[1;33m"
RED="\033[1;31m"
RESET="\033[0m"

echo -e "${CYAN}================================================================${RESET}"
echo -e "${CYAN}   MB PERSONALIZA — PREFLIGHT AUDIT (SOMENTE LEITURA / VPS)     ${RESET}"
echo -e "${CYAN}================================================================${RESET}"

# 1. Estrutura de containers Docker
echo -e "\n${YELLOW}[1/6] Containers Docker ativos:${RESET}"
if command -v docker &> /dev/null; then
  docker compose ps || echo "Aviso: docker compose não inicializado neste diretório."
else
  echo "Docker CLI não disponível neste ambiente."
fi

# 2. Volumes persistentes (uploads_data, backups_data, certbot)
echo -e "\n${YELLOW}[2/6] Volumes Docker persistentes e diretórios locais:${RESET}"
if command -v docker &> /dev/null; then
  docker volume ls --filter name=uploads_data --filter name=backups_data --filter name=certbot || true
fi
for dir in "uploads" "data/backups" "nginx"; do
  if [ -d "$dir" ]; then
    COUNT=$(find "$dir" -maxdepth 4 -type f 2>/dev/null | wc -l)
    echo -e "  ${GREEN}✓${RESET} Diretório '${dir}' presente (${COUNT} arquivos)"
  else
    echo -e "  ${YELLOW}!${RESET} Diretório '${dir}' não encontrado no host (pode estar montado via volume nomeado Docker)"
  fi
done

# 3. Verificação segura de variáveis .env (SOMENTE NOMES DAS CHAVES)
echo -e "\n${YELLOW}[3/6] Presença de variáveis de ambiente (.env):${RESET}"
if [ -f ".env" ]; then
  REQUIRED_KEYS=(
    "DATABASE_URL"
    "SQL_HOST"
    "SQL_DB_NAME"
    "SQL_USER"
    "SQL_PASSWORD"
    "STRICKER_ACCESS_KEY"
    "MERCADOPAGO_ACCESS_KEY"
    "PAGBANK_TOKEN"
  )
  for key in "${REQUIRED_KEYS[@]}"; do
    if grep -qE "^${key}=.+" .env; then
      echo -e "  ${GREEN}✓${RESET} ${key}: definida"
    else
      echo -e "  ${YELLOW}-${RESET} ${key}: não definida / vazia"
    fi
  done
else
  echo -e "  ${RED}!${RESET} Arquivo .env não encontrado na raiz (${PROJECT_ROOT})."
fi

# 4. Nginx & Certificados SSL
echo -e "\n${YELLOW}[4/6] Validação Nginx & Certificados SSL Let's Encrypt:${RESET}"
if command -v docker &> /dev/null && docker ps --format '{{.Names}}' | grep -q 'mbpersonaliza_nginx'; then
  docker compose exec -T nginx nginx -t && echo -e "  ${GREEN}✓${RESET} Sintaxe Nginx válida" || echo -e "  ${RED}!${RESET} Falha na sintaxe Nginx"
  docker compose exec -T nginx sh -c "ls -l /etc/letsencrypt/live/ 2>/dev/null || true"
else
  echo -e "  ${YELLOW}-${RESET} Container mbpersonaliza_nginx não está em execução neste host."
fi

# 5. Endpoints internos da aplicação & PostgreSQL
echo -e "\n${YELLOW}[5/6] Diagnóstico API & PostgreSQL (/api/health e /api/db/vps-preflight):${RESET}"
if curl -sf http://127.0.0.1:3000/api/health; then
  echo ""
  echo -e "  ${GREEN}✓${RESET} /api/health respondendo em 127.0.0.1:3000"
else
  echo -e "  ${YELLOW}-${RESET} Aplicação não respondeu em http://127.0.0.1:3000/api/health"
fi

if [ -n "${ADMIN_SESSION_TOKEN:-}" ]; then
  if curl -sf -H "Authorization: Bearer ${ADMIN_SESSION_TOKEN}" http://127.0.0.1:3000/api/db/vps-preflight; then
    echo ""
    echo -e "  ${GREEN}✓${RESET} /api/db/vps-preflight coletado com sessão admin"
  else
    echo -e "  ${YELLOW}-${RESET} Endpoint /api/db/vps-preflight indisponível"
  fi
else
  PREFLIGHT_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3000/api/db/vps-preflight || echo "000")
  if [ "$PREFLIGHT_CODE" = "401" ]; then
    echo -e "  ${GREEN}✓${RESET} /api/db/vps-preflight protegido por sessão administrativa (HTTP 401 sem login)"
  else
    echo -e "  ${YELLOW}-${RESET} /api/db/vps-preflight retornou HTTP ${PREFLIGHT_CODE}"
  fi
fi

# 6. Domínio HTTPS externo (somente leitura)
echo -e "\n${YELLOW}[6/6] Verificação HTTPS do domínio oficial:${RESET}"
DOMAIN_URL="${APP_PUBLIC_URL:-https://www.mbpersonaliza.com.br/api/health}"
if curl -sfI --max-time 5 "$DOMAIN_URL" >/dev/null 2>&1; then
  echo -e "  ${GREEN}✓${RESET} Domínio HTTPS respondendo: ${DOMAIN_URL}"
else
  echo -e "  ${YELLOW}-${RESET} Não foi possível alcançar ${DOMAIN_URL} a partir deste host (normal em dev/sandbox)."
fi

echo -e "\n${CYAN}================================================================${RESET}"
echo -e "${GREEN}Auditoria somente-leitura concluída sem nenhuma alteração no host.${RESET}"
