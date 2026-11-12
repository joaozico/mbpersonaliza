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

test_endpoint() {
    local name="$1"
    local path="$2"
    local expected_code="${3:-200}"

    echo -n "Testando $name ($path)... "
    local code
    code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "${TARGET_URL}${path}" || echo "000")

    if [ "$code" -eq "$expected_code" ]; then
        echo -e "${COLOR_GREEN}OK ($code)${COLOR_RESET}"
    else
        echo -e "${COLOR_RED}FALHA ($code - esperado $expected_code)${COLOR_RESET}"
        CHECK_FAILURES=$((CHECK_FAILURES + 1))
    fi
}

echo -e "\n${COLOR_YELLOW}[1/4] Testando Endpoints de Produção...${COLOR_RESET}"
test_endpoint "API Healthcheck" "/api/health" 200
test_endpoint "PostgreSQL Status" "/api/db/status" 200
test_endpoint "Storage de Uploads" "/api/upload/health" 200
test_endpoint "Integração Stricker" "/api/stricker/config" 200
test_endpoint "Configurações da Empresa" "/api/system/settings" 200
test_endpoint "Tabelas de Custos/Margens" "/api/cost-pricing/tables" 200
test_endpoint "Módulo Financeiro" "/api/financial/summary" 200

echo -e "\n${COLOR_YELLOW}[2/4] Testando Recursos da VPS Hostinger KVM 2...${COLOR_RESET}"
if command -v free &> /dev/null; then
    echo "Memória RAM do Sistema:"
    free -m | awk 'NR==1 || NR==2'
fi

if command -v df &> /dev/null; then
    echo -e "\nArmazenamento NVMe:"
    df -h / | awk 'NR==1 || NR==2'
fi

echo -e "\n${COLOR_YELLOW}[3/4] Verificando Containers Docker Ativos...${COLOR_RESET}"
if command -v docker &> /dev/null; then
    docker compose ps || true
fi

echo -e "\n${COLOR_YELLOW}[4/4] Verificando Diretórios de Persistência...${COLOR_RESET}"
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
