#!/usr/bin/env bash
# ==============================================================================
# MB PERSONALIZA - SCRIPT DE DEPLOY E ATUALIZAÇÃO AUTOMÁTICA
# Hostinger VPS KVM 2 (Ubuntu Server 22.04 / 24.04 LTS)
# ==============================================================================

set -euo pipefail

# Garantir execução a partir da raiz do projeto, mesmo se chamado de dentro de scripts/
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "$PROJECT_ROOT"

COLOR_RESET="\033[0m"
COLOR_GREEN="\033[1;32m"
COLOR_YELLOW="\033[1;33m"
COLOR_RED="\033[1;31m"
COLOR_CYAN="\033[1;36m"

echo -e "${COLOR_CYAN}================================================================${COLOR_RESET}"
echo -e "${COLOR_CYAN}    MB PERSONALIZA - IMPLANTAÇÃO HOSTINGER VPS KVM 2            ${COLOR_RESET}"
echo -e "${COLOR_CYAN}    Diretório raiz: ${PROJECT_ROOT}                             ${COLOR_RESET}"
echo -e "${COLOR_CYAN}================================================================${COLOR_RESET}"

# Validar presença dos arquivos Docker na raiz do projeto
if [ ! -f "${PROJECT_ROOT}/Dockerfile" ] || [ ! -f "${PROJECT_ROOT}/docker-compose.yml" ]; then
    echo -e "${COLOR_RED}Erro crítico: 'Dockerfile' ou 'docker-compose.yml' não encontrados em ${PROJECT_ROOT}!${COLOR_RESET}"
    echo -e "${COLOR_YELLOW}Certifique-se de que todos os arquivos da raiz do projeto foram enviados para a VPS.${COLOR_RESET}"
    exit 1
fi

# 1. Verificar se Docker e Docker Compose estão instalados
echo -e "\n${COLOR_YELLOW}[1/6] Verificando dependências do host (Docker & Compose)...${COLOR_RESET}"
if ! command -v docker &> /dev/null; then
    echo -e "${COLOR_RED}Erro: Docker não encontrado. Instalando Docker Engine...${COLOR_RESET}"
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    systemctl enable --now docker
fi

if ! docker compose version &> /dev/null; then
    echo -e "${COLOR_RED}Erro: Plugin Docker Compose não encontrado.${COLOR_RESET}"
    apt-get update && apt-get install -y docker-compose-plugin
fi

echo -e "${COLOR_GREEN}✓ Docker e Docker Compose operacionais.${COLOR_RESET}"

# 2. Verificar arquivo .env
echo -e "\n${COLOR_YELLOW}[2/6] Verificando arquivo de ambiente (.env)...${COLOR_RESET}"
if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        echo -e "${COLOR_YELLOW}Arquivo .env não encontrado. Copiando de .env.example...${COLOR_RESET}"
        cp .env.example .env
        echo -e "${COLOR_RED}ATENÇÃO: Configure as credenciais no arquivo .env antes de colocar em produção!${COLOR_RESET}"
    else
        echo -e "${COLOR_RED}Erro crítico: Arquivo .env ou .env.example não encontrado!${COLOR_RESET}"
        exit 1
    fi
fi
echo -e "${COLOR_GREEN}✓ Arquivo de configuração presente.${COLOR_RESET}"

# 3. Criar diretórios locais de persistência
echo -e "\n${COLOR_YELLOW}[3/6] Preparando diretórios de volumes persistentes...${COLOR_RESET}"
mkdir -p uploads data/backups nginx/certbot/conf nginx/certbot/www
chmod -R 775 uploads data/backups
echo -e "${COLOR_GREEN}✓ Diretórios estruturados.${COLOR_RESET}"

# 4. Construir imagens Docker
echo -e "\n${COLOR_YELLOW}[4/6] Compilando container com Node 22 e React 19...${COLOR_RESET}"
docker compose -f "${PROJECT_ROOT}/docker-compose.yml" build --pull app
echo -e "${COLOR_GREEN}✓ Imagem da aplicação compilada com sucesso.${COLOR_RESET}"

# 5. Iniciar ou atualizar serviços
echo -e "\n${COLOR_YELLOW}[5/6] Subindo containers em background...${COLOR_RESET}"
docker compose -f "${PROJECT_ROOT}/docker-compose.yml" up -d --remove-orphans
echo -e "${COLOR_GREEN}✓ Containers ativos.${COLOR_RESET}"

# 6. Teste de Health Check
echo -e "\n${COLOR_YELLOW}[6/6] Verificando saúde da aplicação (/api/health)...${COLOR_RESET}"
MAX_RETRIES=15
COUNT=0
HEALTHY=false

while [ $COUNT -lt $MAX_RETRIES ]; do
    sleep 3
    if curl -s -f http://127.0.0.1:3000/api/health > /dev/null; then
        HEALTHY=true
        break
    fi
    COUNT=$((COUNT + 1))
    echo -n "."
done

echo ""
if [ "$HEALTHY" = true ]; then
    echo -e "${COLOR_GREEN}================================================================${COLOR_RESET}"
    echo -e "${COLOR_GREEN}  DEPLOY REALIZADO COM SUCESSO! APLICAÇÃO ONLINE E SAUDÁVEL.    ${COLOR_RESET}"
    echo -e "${COLOR_GREEN}================================================================${COLOR_RESET}"
    docker compose ps
else
    echo -e "${COLOR_RED}Aviso: A aplicação ainda está inicializando ou retornou erro.${COLOR_RESET}"
    echo -e "Verifique os logs com: ${COLOR_CYAN}docker compose logs -f app${COLOR_RESET}"
fi
