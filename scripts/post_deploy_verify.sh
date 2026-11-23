#!/usr/bin/env bash
# ==============================================================================
# MB PERSONALIZA - VERIFICAÇÃO PÓS-DEPLOY EM PRODUÇÃO (GO-LIVE)
# ==============================================================================

set -euo pipefail

COLOR_RESET="\033[0m"
COLOR_GREEN="\033[1;32m"
COLOR_YELLOW="\033[1;33m"
COLOR_RED="\033[1;31m"
COLOR_CYAN="\033[1;36m"

TARGET_URL="${1:-http://127.0.0.1:3000}"

echo -e "${COLOR_CYAN}================================================================${COLOR_RESET}"
echo -e "${COLOR_CYAN}    MB PERSONALIZA — CHECKLIST DE GO-LIVE EM PRODUÇÃO           ${COLOR_RESET}"
echo -e "${COLOR_CYAN}    Alvo: $TARGET_URL                                           ${COLOR_RESET}"
echo -e "${COLOR_CYAN}================================================================${COLOR_RESET}"

CHECK_FAILURES=0

COOKIE_JAR=$(mktemp)
trap 'rm -f "$COOKIE_JAR"' EXIT
AUTH_READY=false
AUTH_HEADER=""

if [ -n "${ADMIN_SESSION_TOKEN:-}" ]; then
    AUTH_HEADER="Authorization: Bearer ${ADMIN_SESSION_TOKEN}"
    AUTH_READY=true
elif [ -n "${ADMIN_EMAIL:-}" ] && [ -n "${ADMIN_PASSWORD:-}" ]; then
    LOGIN_PAYLOAD=$(printf '{"email":"%s","password":"%s"}' "$ADMIN_EMAIL" "$ADMIN_PASSWORD")
    if curl -sf -c "$COOKIE_JAR" -X POST "${TARGET_URL}/api/auth/login" \
        -H "Content-Type: application/json" \
        -d "$LOGIN_PAYLOAD" >/dev/null; then
        AUTH_READY=true
    fi
fi

test_endpoint() {
    local name="$1"
    local path="$2"
    local expected_code="${3:-200}"
    local use_auth="${4:-false}"

    echo -n "Testando $name ($path)... "
    local code
    if [ "$use_auth" = true ] && [ "$AUTH_READY" = true ]; then
        if [ -n "$AUTH_HEADER" ]; then
            code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 -H "$AUTH_HEADER" "${TARGET_URL}${path}" || echo "000")
        else
            code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 -b "$COOKIE_JAR" "${TARGET_URL}${path}" || echo "000")
        fi
    else
        code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "${TARGET_URL}${path}" || echo "000")
    fi

    if [ "$code" -eq "$expected_code" ]; then
        echo -e "${COLOR_GREEN}OK ($code)${COLOR_RESET}"
    else
        echo -e "${COLOR_RED}FALHA ($code - esperado $expected_code)${COLOR_RESET}"
        CHECK_FAILURES=$((CHECK_FAILURES + 1))
    fi
}

echo -e "\n${COLOR_YELLOW}[1/4] Testando Endpoints de Produção...${RESET}"
test_endpoint "API Healthcheck" "/api/health" 200 false
test_endpoint "PostgreSQL Status" "/api/db/status" 200 false
test_endpoint "Storage de Uploads" "/api/upload/health" 200 false
test_endpoint "Configurações da Empresa" "/api/system/settings" 200 false
test_endpoint "Visibilidade de Preços" "/api/system/price-visibility" 200 false

PROTECTED_EXPECTED=401
if [ "$AUTH_READY" = true ]; then
    PROTECTED_EXPECTED=200
fi
test_endpoint "Integração Stricker" "/api/stricker/config" "$PROTECTED_EXPECTED" true
test_endpoint "Tabelas de Custos/Margens" "/api/cost-pricing/tables" "$PROTECTED_EXPECTED" true
test_endpoint "Módulo Financeiro" "/api/financial/dashboard" "$PROTECTED_EXPECTED" true

echo -e "\n${COLOR_YELLOW}[2/4] Testando Recursos da VPS Hostinger KVM 2...${RESET}"
if command -v free &> /dev/null; then
    echo "Memória RAM do Sistema:"
    free -m | awk 'NR==1 || NR==2'
fi

if command -v df &> /dev/null; then
    echo -e "\nArmazenamento NVMe:"
    df -h / | awk 'NR==1 || NR==2'
fi

echo -e "\n${COLOR_YELLOW}[3/4] Verificando Containers Docker Ativos...${RESET}"
if command -v docker &> /dev/null; then
    docker compose ps || true
fi

echo -e "\n${COLOR_YELLOW}[4/4] Verificando Diretórios de Persistência...${RESET}"
for dir in "uploads" "data/backups"; do
    if [ -d "$dir" ]; then
        FILE_COUNT=$(find "$dir" -type f 2>/dev/null | wc -l)
        echo -e "${COLOR_GREEN}✓ Diretório '$dir' ativo ($FILE_COUNT arquivos armazenados).${COLOR_RESET}"
    else
        echo -e "${COLOR_RED}✗ Diretório '$dir' não encontrado!${COLOR_RESET}"
        CHECK_FAILURES=$((CHECK_FAILURES + 1))
    fi
done

echo -e "\n${COLOR_CYAN}================================================================${COLOR_RESET}"
if [ "$CHECK_FAILURES" -eq 0 ]; then
    echo -e "${COLOR_GREEN}✓ TODOS OS ITENS DE GO-LIVE FORAM VALIDADOS COM SUCESSO!       ${COLOR_RESET}"
    echo -e "A loja MB Personaliza está pronta para atender clientes em produção."
else
    echo -e "${COLOR_RED}Atenção: Foram detectados $CHECK_FAILURES avisos ou falhas. Revise os itens acima.${COLOR_RESET}"
fi
echo -e "${COLOR_CYAN}================================================================${COLOR_RESET}"
