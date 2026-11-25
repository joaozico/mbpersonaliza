# ==============================================================================
# MB PERSONALIZA - DOCKERFILE MULTI-STAGE OTIMIZADO PARA PRODUÇÃO
# HOSTINGER VPS KVM 2 (Ubuntu Server LTS)
# ==============================================================================

# STAGE 1: Build
FROM node:22-alpine AS builder

WORKDIR /app

# Instalar dependências necessárias para compilação
RUN apk add --no-cache libc6-compat python3 make g++

# Copiar arquivos de dependências
COPY package.json bun.lock* ./

# Instalar todas as dependências (incluindo devDependencies para build)
RUN npm install --ignore-scripts

# Copiar código fonte
COPY . .

# Compilar aplicação (Vite frontend -> dist/ e esbuild server -> dist/server.cjs)
RUN npm run build

# Prune devDependencies para manter imagem final enxuta
RUN npm prune --production

# ==============================================================================
# STAGE 2: Runner de Produção
# ==============================================================================
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Adicionar curl, tzdata e postgresql-client (pg_dump, pg_restore, psql)
RUN apk add --no-cache curl tzdata postgresql-client

# Configurar timezone para América/São Paulo (Horário de Brasília)
ENV TZ=America/Sao_Paulo

# Criar diretórios persistentes para uploads e backups
RUN mkdir -p /app/uploads /app/data/backups /app/dist && \
    chown -R node:node /app

# Copiar dependências de produção do builder
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/dist ./dist
COPY --from=builder --chown=node:node /app/package.json ./package.json

# Copiar arquivos de configuração pública se necessário
COPY --from=builder --chown=node:node /app/data ./data

# Mudar para usuário sem privilégios de root por segurança
USER node

# Expor porta da aplicação
EXPOSE 3000

# Healthcheck interno do container
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

# Comando de inicialização oficial
CMD ["node", "dist/server.cjs"]
