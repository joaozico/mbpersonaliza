# CHECKLIST DE GO-LIVE — PUBLICAÇÃO EM PRODUÇÃO (FASE 5)
## MB PERSONALIZA — E-COMMERCE & CATÁLOGO DIGITAL DE BRINDES
**Domínio Oficial:** `https://www.mbpersonaliza.com.br`  
**Servidor:** Hostinger VPS KVM 2 (Ubuntu Server LTS + Docker)

---

## 1. CHECKLIST PRÉ-PUBLICAÇÃO (INFRAESTRUTURA)

- [x] **Arquitetura Homologada:** Docker Multi-stage + Express + React 19 + Nginx.
- [x] **Independência do PostgreSQL:** Banco de dados externo desacoplado (Regra 11), imune a atualizações e reinicializações de container.
- [x] **Persistência de Arquivos:** Volume `/app/uploads` separado do container para logomarcas e mockups.
- [x] **Segurança de Borda:** Nginx com TLS 1.2/1.3, Gzip, HSTS e limite de upload de 50MB.
- [x] **Rotina de Backup:** Script `scripts/backup_db.sh` com checksum SHA-256 e retenção de 30 dias.
- [x] **Workers em Background:** Stricker Sync e Backup Scheduler com desligamento gracioso (`SIGTERM`/`SIGINT`).

---

## 2. PROCEDIMENTO DE PUBLICAÇÃO NA HOSTINGER VPS (PASSO A PASSO)

### 1. Conexão SSH na VPS
```bash
ssh root@SEU_IP_HOSTINGER
```

### 2. Entrar no Diretório da Aplicação
```bash
cd /var/www/mbpersonaliza
```

### 3. Configurar Credenciais Definitivas no `.env`
```bash
nano .env
```
Preencha as variáveis definitivas de produção:
- `DATABASE_URL`: String de conexão segura com o PostgreSQL externo.
- `STRICKER_ACCESS_KEY`: Chave de produção da Stricker Brasil.
- `MERCADOPAGO_ACCESS_KEY`: Chave de produção Mercado Pago.
- `PAGBANK_TOKEN`: Token de produção PagBank.

### 4. Executar Publicação em Produção
```bash
chmod +x scripts/*.sh
./scripts/production_release.sh
```

### 5. Configurar Apontamentos de DNS
No painel do registrador do domínio (`mbpersonaliza.com.br`):
| Tipo | Nome | Valor / Destino | TTL |
| :--- | :--- | :--- | :--- |
| **A** | `@` | IPv4 da Hostinger VPS | 300 / Padrão |
| **CNAME** | `www` | `mbpersonaliza.com.br` | 300 / Padrão |

### 6. Emissão do Certificado SSL Let's Encrypt (HTTPS)
Após a propagação do DNS:
```bash
./scripts/init_ssl.sh contato@mbpersonaliza.com.br
```

### 7. Validação Final de Produção (Go-Live)
```bash
./scripts/post_deploy_verify.sh https://www.mbpersonaliza.com.br
```

---

## 3. CHECKLIST OPERACIONAL PÓS-PUBLICAÇÃO

- [ ] **Navegação HTTPS:** Acessar `https://www.mbpersonaliza.com.br` e verificar o cadeado de segurança verde/ativo.
- [ ] **Redirecionamento:** Acessar `http://mbpersonaliza.com.br` e certificar-se de que é redirecionado para `https://www.mbpersonaliza.com.br`.
- [ ] **Cadastro e Catálogo:** Conferir listagem dos produtos, fotos e variações de cores/tamanhos.
- [ ] **Painel de Personalização:** Fazer upload de uma logomarca de teste e validar pré-visualização.
- [ ] **Carrinho e Checkout:** Simular a emissão de um orçamento e um pedido com Pix/Boleto.
- [ ] **Backups Automáticos:** Confirmar agendamento diário no crontab (`crontab -l`).
- [ ] **Monitoramento de Recursos:** Executar `htop` ou `./scripts/health_check.sh` para verificar uso de CPU e memória RAM (< 10% no VPS KVM 2).

---

## 4. CONTATOS DE SUPORTE & COMANDOS DE EMERGÊNCIA

* **Reiniciar aplicação:** `docker compose restart app`
* **Ver logs em tempo real:** `docker compose logs -f app`
* **Executar backup manual:** `./scripts/backup_db.sh`
* **Restaurar banco de dados:** `./scripts/restore_db.sh data/backups/ARQUIVO.sql.gz`
