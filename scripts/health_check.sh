#!/usr/bin/env bash
# ==============================================================================
# MB PERSONALIZA - DIAGNÓSTICO E MONITORAMENTO DE SAÚDE DO SISTEMA
# ==============================================================================

set -euo pipefail

COLOR_RESET="\033[0m"
COLOR_GREEN="\033[1;32m"
COLOR_YELLOW="\033[1;33m"
COLOR_RED="\033[1;31m"
COLOR_CYAN="\033[1;36m"

BASE_URL="${1:-http://127.0.0.1:3000}"

echo -e "${COLOR_CYAN}=== DIAGNÓSTICO DO MB PERSONALIZA (${BASE_URL}) ===${COLOR_RESET}"

# 1. API Health
echo -n "Testando API Principal (/api/health)... "
HEALTH_RESPONSE=$(curl -s -w "\n%{http_code}" "${BASE_URL}/api/health" || echo "FAIL\n000")
HTTP_CODE=$(echo "$HEALTH_RESPONSE" | tail -n1)
BODY=$(echo "$HEALTH_RESPONSE" | head -n -1)

if [ "$HTTP_CODE" -eq 200 ]; then
    echo -e "${COLOR_GREEN}OK (200)${COLOR_RESET}"
    echo "  Detalhes: $BODY"
else
    echo -e "${COLOR_RED}FALHA ($HTTP_CODE)${COLOR_RESET}"
fi

# 2. Database Status
echo -n "Testando Conexão PostgreSQL (/api/db/status)... "
DB_RESPONSE=$(curl -s -w "\n%{http_code}" "${BASE_URL}/api/db/status" || echo "FAIL\n000")
DB_CODE=$(echo "$DB_RESPONSE" | tail -n1)
DB_BODY=$(echo "$DB_RESPONSE" | head -n -1)

if [ "$DB_CODE" -eq 200 ]; then
    echo -e "${COLOR_GREEN}OK (200)${COLOR_RESET}"
    echo "  Status DB: $DB_BODY"
else
    echo -e "${COLOR_RED}FALHA ($DB_CODE)${COLOR_RESET}"
    echo "  Erro DB: $DB_BODY"
fi

# 3. Upload Service
echo -n "Testando Serviço de Uploads (/api/upload/health)... "
UP_RESPONSE=$(curl -s -w "\n%{http_code}" "${BASE_URL}/api/upload/health" || echo "FAIL\n000")
UP_CODE=$(echo "$UP_RESPONSE" | tail -n1)
UP_BODY=$(echo "$UP_RESPONSE" | head -n -1)

if [ "$UP_CODE" -eq 200 ]; then
    echo -e "${COLOR_GREEN}OK (200)${COLOR_RESET}"
    echo "  Storage: $UP_BODY"
else
    echo -e "${COLOR_RED}FALHA ($UP_CODE)${COLOR_RESET}"
fi

# 4. Uso de Disco e Memória no Host VPS
echo -e "\n${COLOR_CYAN}--- Recursos do Host VPS KVM 2 ---${COLOR_RESET}"
echo "Uso de Memória:"
free -h || true
echo -e "\nUso de Disco (NVMe):"
df -h / | awk 'NR==1 || NR==2'
echo -e "\nStatus dos Containers Docker:"
docker compose ps || true

echo -e "\n${COLOR_GREEN}Diagnóstico finalizado.${COLOR_RESET}"
