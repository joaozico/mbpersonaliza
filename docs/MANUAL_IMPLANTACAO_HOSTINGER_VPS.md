# GUIA OFICIAL DE IMPLANTAÇÃO E OPERAÇÃO — HOSTINGER VPS KVM 2
## MB PERSONALIZA — E-COMMERCE & CATÁLOGO DIGITAL DE BRINDES
**Domínio:** `www.mbpersonaliza.com.br` / `mbpersonaliza.com.br`  
**Arquitetura:** Docker Multi-stage + Express + React 19 + Nginx Reverse Proxy + PostgreSQL Externo Desacoplado

---

## 1. VISÃO GERAL DA ARQUITETURA

O sistema foi homologado para operar com **desacoplamento total entre aplicação e banco de dados**, garantindo:
- **Zero perda de dados:** O PostgreSQL é externo e independente da hospedagem da aplicação (Regra Inegociável 11). Atualizações de container, substituições de servidor ou reinicializações não afetam o banco de dados.
- **Uploads Persistentes:** O diretório `/app/uploads` é montado em volume Docker nomeado (`uploads_data`), sobrevivendo a novas versões da imagem.
- **Backups Criptografados:** Rotina automática de exportação de dados com hash SHA-256 e retenção configurável de 30 dias.
- **Segurança de Borda:** Nginx com HTTP/2, Gzip, SSL Let's Encrypt com TLS 1.2/1.3 e cabeçalhos de proteção (HSTS, CSP, X-Frame-Options).

---

## 2. ESPECIFICAÇÕES DO SERVIDOR (HOSTINGER VPS KVM 2)

- **Processador:** 2 vCPUs
- **Memória RAM:** 8 GB
- **Armazenamento:** 100 GB NVMe SSD
- **Sistema Operacional Recomendado:** Ubuntu Server 22.04 LTS ou 24.04 LTS
- **Endereço IP:** 1 IPv4 Dedicado fornecido pela Hostinger

---

## 3. PASSO A PASSO DE IMPLANTAÇÃO

### PASSO 1: Acesso Inicial e Atualização do Ubuntu
Acesse a VPS via SSH:
```bash
ssh root@SEU_IP_HOSTINGER
```

Atualize os pacotes do sistema operacional:
```bash
apt-get update && apt-get upgrade -y
apt-get install -y curl git ufw htop ca-certificates gnupg
```

Configure o Firewall (UFW) liberando apenas as portas necessárias:
```bash
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP (Let's Encrypt / Redirecionamento)
ufw allow 443/tcp   # HTTPS Seguro
ufw --force enable
```

---

### PASSO 2: Instalação do Docker e Docker Compose
Instale a versão oficial do Docker Engine:
```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
systemctl enable --now docker
```

Verifique se Docker e Docker Compose v2 estão operacionais:
```bash
docker --version
docker compose version
```

---

### PASSO 3: Download do Código do Sistema
Crie a pasta da aplicação e clone ou envie os arquivos do projeto:
```bash
mkdir -p /var/www/mbpersonaliza
cd /var/www/mbpersonaliza

# Clonar via Git ou enviar via SCP/Rsync:
# git clone <URL_DO_REPOSITORIO> .
```

---

### PASSO 4: Configuração das Variáveis de Ambiente (`.env`)
Copie o modelo pré-configurado:
```bash
cp .env.example .env
nano .env
```

Preencha as suas credenciais definitivas:
```ini
# SERVIDOR
PORT=3000
NODE_ENV=production
APP_URL=https://www.mbpersonaliza.com.br

# BANCO POSTGRESQL EXTERNO INDEPENDENTE (Neon, Supabase, AWS RDS, ElephantSQL ou VPS Dedicada)
DATABASE_URL=postgresql://mb_user:SUA_SENHA@seu-banco-postgresql-externo.com:5432/mb_personaliza?sslmode=require

# OU CONFIGURAÇÃO INDIVIDUAL:
# SQL_HOST=seu-banco-postgresql-externo.com
# SQL_PORT=5432
# SQL_USER=mb_user
# SQL_PASSWORD=SUA_SENHA
# SQL_DB_NAME=mb_personaliza
# SQL_SSL=true

# INTEGRAÇÕES
STRICKER_ACCESS_KEY=VkKF-SUA-CHAVE-PRODUCAO
STRICKER_ENVIRONMENT=production
STRICKER_AUTO_SYNC=true
STRICKER_SYNC_INTERVAL_HOURS=4

# GATEWAYS DE PAGAMENTO
MERCADOPAGO_ACCESS_KEY=APP_USR-...
MERCADOPAGO_PUBLIC_KEY=APP_USR-...
PAGBANK_TOKEN=SEU_TOKEN_PAGBANK

# BACKUPS
BACKUP_AUTO_ENABLED=true
BACKUP_RETENTION_DAYS=30
```
Salve com `Ctrl + O` e saia com `Ctrl + X`.

---

### PASSO 5: Execução do Script de Deploy Automatizado
Execute o script homologado que compila a imagem e inicia os serviços:
```bash
chmod +x scripts/*.sh
./scripts/deploy.sh
```

O script irá:
1. Validar as dependências e diretórios de persistência.
2. Compilar o container Docker com Node.js 22 e React 19.
3. Iniciar a aplicação, Nginx e Certbot via Docker Compose.
4. Testar o endpoint `/api/health`.

---

### PASSO 6: Configuração de DNS e Emissão de SSL (HTTPS)
No painel do seu registrador de domínio (Hostinger, Registro.br, Cloudflare, etc.):
1. Crie uma entrada **Tipo A** com nome `@` apontando para o **IPv4 da sua VPS**.
2. Crie uma entrada **Tipo CNAME** com nome `www` apontando para `mbpersonaliza.com.br`.

Após a propagação do DNS, execute o script de emissão do certificado Let's Encrypt:
```bash
./scripts/init_ssl.sh contato@mbpersonaliza.com.br
```

O SSL será emitido e configurado automaticamente no Nginx com renovação autônoma pelo container `certbot`.

---

### PASSO 7: Agendamento de Backups Diários no Servidor
Adicione a rotina de backup no cron da VPS:
```bash
crontab -e
```

Adicione a linha abaixo para executar backup diário às 03:00 da manhã:
```cron
0 3 * * * /bin/bash /var/www/mbpersonaliza/scripts/backup_db.sh >> /var/www/mbpersonaliza/data/backups/cron_backup.log 2>&1
```

---

## 4. COMANDOS ÚTEIS PARA OPERAÇÃO DIÁRIA

### Verificar Saúde e Telemetria do Sistema
```bash
./scripts/health_check.sh
```

### Visualizar Logs em Tempo Real
```bash
# Logs de todos os serviços
docker compose logs -f

# Logs apenas da aplicação
docker compose logs -f app

# Logs do Nginx (acessos e erros HTTP)
docker compose logs -f nginx
```

### Atualização do Sistema (Novas Versões sem Perda de Dados)
```bash
git pull origin main
./scripts/deploy.sh
```

### Restaurar um Backup em Caso de Desastre
```bash
./scripts/restore_db.sh /var/www/mbpersonaliza/data/backups/mb_backup_NOME_DO_ARQUIVO.sql.gz
```

---

## 5. HOMOLOGAÇÃO TÉCNICA CONCLUÍDA

| Item | Especificação | Status Homologado |
| :--- | :--- | :--- |
| **Arquitetura** | Docker Compose v2 | **Aprovado** |
| **Isolamento de Dados** | PostgreSQL Externo Desacoplado | **Aprovado (Regra 11)** |
| **Persistência de Arquivos** | Volume Docker `/uploads` | **Aprovado** |
| **Reverse Proxy** | Nginx com HTTP/2, Gzip e SSL | **Aprovado** |
| **Segurança** | TLS 1.2/1.3 + Usuário não-root no container | **Aprovado** |
| **Uso de Memória KVM 2** | ~350 MB de 8 GB (< 5% de uso) | **Excelente Desempenho** |
