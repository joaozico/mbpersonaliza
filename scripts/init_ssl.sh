#!/usr/bin/env bash
# ==============================================================================
# MB PERSONALIZA - SCRIPT DE EMISSÃO INICIAL DE CERTIFICADO SSL LET'S ENCRYPT
# Hostinger VPS KVM 2 - mbpersonaliza.com.br & www.mbpersonaliza.com.br
# ==============================================================================

set -euo pipefail

DOMAIN="mbpersonaliza.com.br"
EMAIL="${1:-contato@mbpersonaliza.com.br}"

echo "=== Iniciando obtenção de certificado SSL Let's Encrypt para $DOMAIN ==="
echo "Email de contato: $EMAIL"

# 1. Criar diretórios para o desafio ACME
mkdir -p nginx/certbot/conf nginx/certbot/www

# 2. Executar certbot via docker para emitir certificado
docker run -it --rm --name certbot_init \
    -v "$(pwd)/nginx/certbot/conf:/etc/letsencrypt" \
    -v "$(pwd)/nginx/certbot/www:/var/www/certbot" \
    certbot/certbot certonly --webroot \
    --webroot-path=/var/www/certbot \
    --email "$EMAIL" \
    --agree-tos \
    --no-eff-email \
    -d "$DOMAIN" \
    -d "www.$DOMAIN"

echo "=== Certificado emitido com sucesso! Recarregando Nginx... ==="
docker compose exec nginx nginx -s reload || true
echo "✓ HTTPS ativo em https://$DOMAIN e https://www.DOMAIN"
