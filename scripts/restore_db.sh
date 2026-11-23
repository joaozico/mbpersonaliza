#!/usr/bin/env bash
# ==============================================================================
# MB PERSONALIZA - SCRIPT DE RECUPERAÇÃO E RESTAURAÇÃO DE DESASTRES (REQ. 11.5)
# Permite restaurar backups íntegros no PostgreSQL externo em caso de falha.
# ==============================================================================

set -euo pipefail

COLOR_RESET="\033[0m"
COLOR_GREEN="\033[1;32m"
COLOR_YELLOW="\033[1;33m"
COLOR_RED="\033[1;31m"
COLOR_CYAN="\033[1;36m"

if [ $# -lt 1 ]; then
    echo -e "${COLOR_RED}Uso: $0 <caminho_do_arquivo_de_backup>${COLOR_RESET}"
    echo -e "Exemplo: $0 data/backups/mb_backup_20261111_120000.sql.gz"
    exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "$BACKUP_FILE" ]; then
    echo -e "${COLOR_RED}Erro: Arquivo de backup '$BACKUP_FILE' não encontrado!${COLOR_RESET}"
    exit 1
fi

echo -e "${COLOR_CYAN}=== PROCEDIMENTO DE RESTAURAÇÃO - MB PERSONALIZA ===${COLOR_RESET}"
echo -e "Arquivo selecionado: ${COLOR_YELLOW}$BACKUP_FILE${COLOR_RESET}"

# 1. Verificação de Integridade SHA-256 (se arquivo .sha256 existir)
if [ -f "${BACKUP_FILE}.sha256" ]; then
    echo -e "\n${COLOR_YELLOW}Verificando integridade SHA-256...${COLOR_RESET}"
    if sha256sum -c "${BACKUP_FILE}.sha256"; then
        echo -e "${COLOR_GREEN}✓ Integridade do arquivo confirmada!${COLOR_RESET}"
    else
        echo -e "${COLOR_RED}ERRO CRÍTICO: Checksum SHA-256 inválido! O arquivo pode estar corrompido.${COLOR_RESET}"
        read -p "Deseja continuar mesmo assim? (s/N): " CONFIRM_CORRUPT
        if [[ "$CONFIRM_CORRUPT" != "s" && "$CONFIRM_CORRUPT" != "S" ]]; then
            exit 1
        fi
    fi
fi

# 2. Confirmação do Operador
echo -e "\n${COLOR_RED}AVISO: A restauração irá sobrescrever ou atualizar tabelas no PostgreSQL independente.${COLOR_RESET}"
read -p "Tem certeza absoluta de que deseja prosseguir com a restauração? (digite 'RESTAURAR'): " CONFIRM_RESTORE

if [ "$CONFIRM_RESTORE" != "RESTAURAR" ]; then
    echo -e "${COLOR_YELLOW}Operação abortada pelo usuário.${COLOR_RESET}"
    exit 0
fi

# 3. Carregar variáveis de ambiente
if [ -f ".env" ]; then
    set -a
    # shellcheck disable=SC1091
    source .env
    set +a
fi

# 4. Executar Restauração
echo -e "\n${COLOR_YELLOW}Executando processo de restauração no PostgreSQL...${COLOR_RESET}"

if [[ "$BACKUP_FILE" == *.sql.gz ]]; then
    if [ -n "${DATABASE_URL:-}" ]; then
        gunzip -c "$BACKUP_FILE" | psql "$DATABASE_URL"
    else
        PGPASSWORD="${SQL_PASSWORD:-}" gunzip -c "$BACKUP_FILE" | psql \
            -h "${SQL_HOST:-localhost}" \
            -p "${SQL_PORT:-5432}" \
            -U "${SQL_USER:-postgres}" \
            -d "${SQL_DB_NAME:-mb_personaliza}"
    fi
elif [[ "$BACKUP_FILE" == *.sql ]]; then
    if [ -n "${DATABASE_URL:-}" ]; then
        psql "$DATABASE_URL" < "$BACKUP_FILE"
    else
        PGPASSWORD="${SQL_PASSWORD:-}" psql \
            -h "${SQL_HOST:-localhost}" \
            -p "${SQL_PORT:-5432}" \
            -U "${SQL_USER:-postgres}" \
            -d "${SQL_DB_NAME:-mb_personaliza}" < "$BACKUP_FILE"
    fi
elif [[ "$BACKUP_FILE" == *.json.gz || "$BACKUP_FILE" == *.json ]]; then
    echo -e "${COLOR_YELLOW}Restaurando via API autenticada de Restauração JSON do MB Personaliza...${COLOR_RESET}"
    TEMP_JSON=$(mktemp)
    COOKIE_JAR=$(mktemp)
    trap 'rm -f "$TEMP_JSON" "$COOKIE_JAR"' EXIT
    if [[ "$BACKUP_FILE" == *.gz ]]; then
        gunzip -c "$BACKUP_FILE" > "$TEMP_JSON"
    else
        cp "$BACKUP_FILE" "$TEMP_JSON"
    fi
    if [ -n "${ADMIN_SESSION_TOKEN:-}" ]; then
        curl -sf -X POST http://127.0.0.1:3000/api/backup/restore \
             -H "Content-Type: application/json" \
             -H "Authorization: Bearer ${ADMIN_SESSION_TOKEN}" \
             --data-binary @"$TEMP_JSON"
    elif [ -n "${ADMIN_EMAIL:-}" ] && [ -n "${ADMIN_PASSWORD:-}" ]; then
        LOGIN_PAYLOAD=$(printf '{"email":"%s","password":"%s"}' "$ADMIN_EMAIL" "$ADMIN_PASSWORD")
        curl -sf -c "$COOKIE_JAR" -X POST http://127.0.0.1:3000/api/auth/login \
             -H "Content-Type: application/json" \
             -d "$LOGIN_PAYLOAD" >/dev/null
        curl -sf -b "$COOKIE_JAR" -X POST http://127.0.0.1:3000/api/backup/restore \
             -H "Content-Type: application/json" \
             --data-binary @"$TEMP_JSON"
    else
        echo -e "${COLOR_RED}ERRO: Defina ADMIN_SESSION_TOKEN ou ADMIN_EMAIL + ADMIN_PASSWORD para restaurar via API.${COLOR_RESET}"
        exit 1
    fi
    rm -f "$TEMP_JSON" "$COOKIE_JAR"
else
    echo -e "${COLOR_RED}Formato de backup não suportado! Use .sql.gz, .sql, .json.gz ou .json${COLOR_RESET}"
    exit 1
fi

echo -e "\n${COLOR_GREEN}================================================================${COLOR_RESET}"
echo -e "${COLOR_GREEN}  RESTAURAÇÃO CONCLUÍDA COM SUCESSO! DADOS RESTABELECIDOS.       ${COLOR_RESET}"
echo -e "${COLOR_GREEN}================================================================${COLOR_RESET}"
