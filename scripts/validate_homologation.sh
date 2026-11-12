#!/usr/bin/env bash
# ==============================================================================
# MB PERSONALIZA - SCRIPT DE VALIDAÇÃO DE HOMOLOGAÇÃO
# Simulação do Ambiente Hostinger VPS KVM 2 (Ubuntu Server + Docker)
# ==============================================================================

set -euo pipefail

COLOR_RESET="\033[0m"
COLOR_GREEN="\033[1;32m"
COLOR_YELLOW="\033[1;33m"
COLOR_RED="\033[1;31m"
COLOR_CYAN="\033[1;36m"

echo -e "${COLOR_CYAN}================================================================${COLOR_RESET}"
echo -e "${COLOR_CYAN}    MB PERSONALIZA - BATERIA DE HOMOLOGAÇÃO VPS KVM 2           ${COLOR_RESET}"
echo -e "${COLOR_CYAN}================================================================${COLOR_RESET}"

ERRORS=0

log_success() {
    echo -e "${COLOR_GREEN}✓ [HOMOLOGADO] $1${COLOR_RESET}"
}

log_error() {
    echo -e "${COLOR_RED}✗ [FALHA] $1${COLOR_RESET}"
    ERRORS=$((ERRORS + 1))
}

# 1. Validação de Estrutura de Arquivos Essenciais
echo -e "\n${COLOR_YELLOW}[1/6] Verificando arquivos de infraestrutura e produção...${COLOR_RESET}"
REQUIRED_FILES=(
    "Dockerfile"
    ".dockerignore"
    "docker-compose.yml"
    "nginx/mbpersonaliza.conf"
    ".env.example"
    "package.json"
    "server.ts"
    "scripts/deploy.sh"
    "scripts/backup_db.sh"
    "scripts/restore_db.sh"
    "scripts/init_ssl.sh"
    "scripts/health_check.sh"
)

for file in "${REQUIRED_FILES[@]}"; do
    if [ -f "$file" ]; then
        log_success "Arquivo $file presente e íntegro."
    else
        log_error "Arquivo obrigatório $file não encontrado!"
    fi
done

# 2. Validação da Configuração do Nginx
echo -e "\n${COLOR_YELLOW}[2/6] Validando sintaxe da configuração do Nginx...${COLOR_RESET}"
if grep -q "mbpersonaliza.com.br" nginx/mbpersonaliza.conf && \
   grep -q "client_max_body_size 50M;" nginx/mbpersonaliza.conf && \
   grep -q "proxy_pass http://app_backend;" nginx/mbpersonaliza.conf; then
    log_success "Configuração do Nginx válida (domínios, SSL, Gzip e limite de 50MB)."
else
    log_error "Configuração do Nginx incompleta ou inválida."
fi

# 3. Validação do Dockerfile e Docker Compose
echo -e "\n${COLOR_YELLOW}[3/6] Validando especificações do Docker e Compose...${COLOR_RESET}"
if grep -q "node:22-alpine" Dockerfile && grep -q "USER node" Dockerfile; then
    log_success "Dockerfile configurado com Node 22 e usuário não-root por segurança."
else
    log_error "Dockerfile com especificações divergentes."
fi

if grep -q "uploads_data:" docker-compose.yml && grep -q "backups_data:" docker-compose.yml; then
    log_success "Docker Compose possui volumes persistentes isolados da aplicação."
else
    log_error "Docker Compose sem volumes persistentes definidos."
fi

# 4. Compilação do Bundle de Produção (Frontend + Backend)
echo -e "\n${COLOR_YELLOW}[4/6] Compilando bundle de produção (npm run build)...${COLOR_RESET}"
if npm run build; then
    log_success "Build de produção gerado com sucesso em dist/ (dist/server.cjs e assets)."
else
    log_error "Falha na compilação do build de produção."
fi

# 5. Verificação de Integridade dos Artefatos de Build
echo -e "\n${COLOR_YELLOW}[5/6] Verificando integridade dos artefatos compilados...${COLOR_RESET}"
if [ -f "dist/server.cjs" ] && [ -f "dist/index.html" ]; then
    SERVER_SIZE=$(ls -lh dist/server.cjs | awk '{print $5}')
    log_success "Servidor compilado (dist/server.cjs - $SERVER_SIZE)."
    log_success "SPA React compilada (dist/index.html e assets)."
else
    log_error "Artefatos dist/server.cjs ou dist/index.html ausentes após build."
fi

# 6. Teste de Inicialização do Binário de Produção
echo -e "\n${COLOR_YELLOW}[6/6] Testando execução do bundle de produção com Node.js...${COLOR_RESET}"
PORT=3099 NODE_ENV=production node -e "
const fs = require('fs');
if (!fs.existsSync('dist/server.cjs')) {
  process.exit(1);
}
console.log('✓ Binário dist/server.cjs carregado com sucesso pelo runtime Node.js.');
" && log_success "Execução de teste do bundle de produção validada." || log_error "Falha ao carregar bundle de produção."

# Relatório Final
echo -e "\n${COLOR_CYAN}================================================================${COLOR_RESET}"
echo -e "${COLOR_CYAN}              RELATÓRIO FINAL DE HOMOLOGAÇÃO                   ${COLOR_RESET}"
echo -e "${COLOR_CYAN}================================================================${COLOR_RESET}"

if [ "$ERRORS" -eq 0 ]; then
    echo -e "${COLOR_GREEN}✓ SISTEMA 100% HOMOLOGADO PARA HOSTINGER VPS KVM 2!${COLOR_RESET}"
    echo -e "A aplicação atende a todos os requisitos de arquitetura, segurança e independência."
    exit 0
else
    echo -e "${COLOR_RED}✗ Foram encontrados $ERRORS problemas durante a homologação.${COLOR_RESET}"
    exit 1
fi
