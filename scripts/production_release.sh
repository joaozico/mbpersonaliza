#!/usr/bin/env bash
# ==============================================================================
# MB PERSONALIZA - SCRIPT DE PUBLICAÇÃO EM PRODUÇÃO (FASE 5)
# Hostinger VPS KVM 2 — Domínio Oficial: www.mbpersonaliza.com.br
# ==============================================================================

set -euo pipefail

COLOR_RESET="\033[0m"
COLOR_GREEN="\033[1;32m"
COLOR_YELLOW="\033[1;33m"
COLOR_RED="\033[1;31m"
COLOR_CYAN="\033[1;36m"

echo -e "${COLOR_CYAN}================================================================${COLOR_RESET}"
echo -e "${COLOR_CYAN}    MB PERSONALIZA — PUBLICAÇÃO OFICIAL EM PRODUÇÃO (FASE 5)    ${COLOR_RESET}"
echo -e "${COLOR_CYAN}    Domínio: www.mbpersonaliza.com.br / mbpersonaliza.com.br    ${COLOR_RESET}"
echo -e "${COLOR_CYAN}================================================================${COLOR_RESET}"

# 1. Checagem de Privilégios e Diretório
if [ ! -f "docker-compose.yml" ]; then
    echo -e "${COLOR_RED}Erro: Execute este script a partir da raiz do projeto (/var/www/mbpersonaliza).${COLOR_RESET}"
    exit 1
fi

# 2. Verificação do Arquivo de Ambiente (.env)
echo -e "\n${COLOR_YELLOW}[1/5] Verificando arquivo de ambiente de produção (.env)...${COLOR_RESET}"
if [ ! -f ".env" ]; then
    echo -e "${COLOR_RED}Arquivo .env não encontrado! Criando a partir de .env.example...${COLOR_RESET}"
    cp .env.example .env
    echo -e "${COLOR_YELLOW}Lembrete: edite o arquivo .env (nano .env) com suas chaves reais.${COLOR_RESET}"
else
    echo -e "${COLOR_GREEN}✓ Arquivo .env presente.${COLOR_RESET}"
fi

# 3. Preparação dos Volumes Persistentes Isolados
echo -e "\n${COLOR_YELLOW}[2/5] Garantindo diretórios e permissões de persistência...${COLOR_RESET}"
mkdir -p uploads data/backups nginx/certbot/conf nginx/certbot/www
chmod 775 uploads data/backups
echo -e "${COLOR_GREEN}✓ Volumes persistentes estruturados (uploads e backups desacoplados).${COLOR_RESET}"

# 4. Compilação e Lançamento dos Containers Docker
echo -e "\n${COLOR_YELLOW}[3/5] Compilando e iniciando containers em modo de produção...${COLOR_RESET}"
docker compose build --pull app
docker compose up -d --remove-orphans
echo -e "${COLOR_GREEN}✓ Containers ativos e operacionais.${COLOR_RESET}"

# 5. Verificação de Saúde da Aplicação
echo -e "\n${COLOR_YELLOW}[4/5] Aguardando inicialização da aplicação e testando saúde...${COLOR_RESET}"
RETRIES=15
ONLINE=false
while [ $RETRIES -gt 0 ]; do
    if curl -s -f http://127.0.0.1:3000/api/health > /dev/null; then
        ONLINE=true
        break
    fi
    echo -n "."
    sleep 2
    RETRIES=$((RETRIES - 1))
done

echo ""
if [ "$ONLINE" = true ]; then
    echo -e "${COLOR_GREEN}✓ Aplicação online no endereço interno http://127.0.0.1:3000${COLOR_RESET}"
else
    echo -e "${COLOR_RED}Aviso: A aplicação demorou mais que o esperado para responder. Verifique os logs:${COLOR_RESET}"
    echo -e "  docker compose logs app"
fi

# 6. Status dos Serviços
echo -e "\n${COLOR_YELLOW}[5/5] Status dos serviços orquestrados:${COLOR_RESET}"
docker compose ps

echo -e "\n${COLOR_CYAN}================================================================${COLOR_RESET}"
echo -e "${COLOR_GREEN}           SISTEMA PRONTO PARA OPERAÇÃO EM PRODUÇÃO!            ${COLOR_RESET}"
echo -e "${COLOR_CYAN}================================================================${COLOR_RESET}"
echo -e "Próximos passos recomendados:"
echo -e "1. Apontar o DNS do domínio para o IP desta VPS:"
echo -e "   - Entrada A:     ${COLOR_YELLOW}@${COLOR_RESET}   -> ${COLOR_YELLOW}SEU_IP_VPS${COLOR_RESET}"
echo -e "   - Entrada CNAME: ${COLOR_YELLOW}www${COLOR_RESET} -> ${COLOR_YELLOW}mbpersonaliza.com.br${COLOR_RESET}"
echo -e "2. Emitir o certificado SSL Let's Encrypt definitivo:"
echo -e "   ${COLOR_CYAN}./scripts/init_ssl.sh contato@mbpersonaliza.com.br${COLOR_RESET}"
echo -e "3. Validar a operação completa:"
echo -e "   ${COLOR_CYAN}./scripts/health_check.sh${COLOR_RESET}"
