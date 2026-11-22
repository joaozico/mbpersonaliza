# Plano de Migração Controlada e Rollback — Produção Hostinger VPS

Este documento formaliza o procedimento operacional para atualizar o sistema **MB Personaliza** na VPS da **Hostinger**, preservando integralmente a infraestrutura existente e realizando a migração incremental dos dados do `localStorage` para o **PostgreSQL** de forma auditada, segura e reversível.

---

## 1. Infraestrutura Preservada (Não Alterar)

Nenhuma modificação de código ou script altera os seguintes componentes de produção:

1. **Hospedagem**: Hostinger VPS KVM 2.
2. **Domínio & DNS**: `mbpersonaliza.com.br` e `www.mbpersonaliza.com.br`.
3. **Banco PostgreSQL**: Instância externa conectada via variáveis de ambiente existentes (`DATABASE_URL` ou `SQL_HOST`, `SQL_PORT`, `SQL_DB_NAME`, `SQL_USER`, `SQL_PASSWORD`, `SQL_SSL`).
4. **Variáveis de Ambiente**: Arquivo `.env` de produção mantido intacto.
5. **Containers Docker**: `mbpersonaliza_app`, `mbpersonaliza_nginx`, `mbpersonaliza_certbot` definidos em `docker-compose.yml`.
6. **Nginx Reverse Proxy**: `nginx/mbpersonaliza.conf` preservado sem alterações.
7. **SSL / HTTPS**: Certificados Let's Encrypt montados em `certbot_conf` e `certbot_www`.
8. **Volumes Persistentes**: `uploads_data` (`/app/uploads`) e `backups_data` (`/app/data/backups`).
9. **Integrações Externas**: API Stricker, Mercado Pago, PagBank e Firebase Auth.
10. **Portas e Redes**: Rede `mb_network` e portas `80`, `443`, `127.0.0.1:3000`.

---

## 2. Mapeamento das Novas Tabelas Aditivas no PostgreSQL

Todas as 13 tabelas existentes permanecem intactas. Foram adicionadas apenas **4 novas tabelas aditivas** (`CREATE TABLE IF NOT EXISTS`) em `src/db/schema.ts` e `src/db/repository.ts`:

| Domínio no `localStorage` | Tabela PostgreSQL | Modo de Gravação |
| --- | --- | --- |
| `mb_stock_movements` | `stock_movements` | Aditivo (`onConflictDoNothing` / `onConflictDoUpdate` por ID) |
| `mb_pdv_sales` | `pdv_sales` | Aditivo / Upsert seguro por ID |
| `mb_cash_register_sessions` | `cash_register_sessions` | Aditivo / Upsert seguro por ID |
| `mb_payment_transactions` | `payment_transactions` | Aditivo / Upsert seguro por ID |
| `mb_boletos` | `boletos` | Já existente; agora hidratada em `/api/db/init` e sincronizada |
| `mb_financial_accounts` | `financial_accounts` | Já existente; agora hidratada em `/api/db/init` e sincronizada |
| `mb_subcategories` | `subcategories` | Já existente; agora sincronizada via `POST /api/db/subcategories` |
| Configurações (permissões, gateways, PDV, financeiro) | `system_settings` | Armazenadas por chave em `system_settings` e hidratadas em `/api/db/init` |

> **Regra de Integridade**: Nenhum script executa `DROP TABLE`, `TRUNCATE`, nem sobrescreve registros existentes durante a migração controlada (`ON CONFLICT DO NOTHING`).

---

## 3. Procedimento Passo a Passo de Implantação Segura

### Passo 1 — Auditoria Somente-Leitura (Pré-Voo)
Na VPS Hostinger, dentro da raiz do projeto:
```bash
chmod +x scripts/vps_preflight_audit.sh scripts/safe_update_with_rollback.sh
./scripts/vps_preflight_audit.sh
```
Verifique se:
- Os containers `mbpersonaliza_app`, `mbpersonaliza_nginx` e `mbpersonaliza_certbot` estão `Up (healthy)`.
- Os volumes `uploads_data` e `backups_data` existem.
- As variáveis obrigatórias no `.env` estão definidas.

### Passo 2 — Validar em Homologação / Staging antes de Produção
Execute o build e os testes em ambiente de homologação antes de aplicar na VPS:
```bash
npm run build
npm run lint
```

### Passo 3 — Atualização Controlada com Backup Automático (Seção 13)
Execute o script seguro que:
1. Tira snapshot da imagem Docker atual em `data/.last_release_rollback`.
2. Executa `./scripts/backup_db.sh` (dump completo + SHA-256).
3. Recompila e reinicia **somente o serviço `app`** (`docker compose up -d --no-deps app`), mantendo Nginx, SSL e volumes em funcionamento contínuo.
4. Valida `/api/health` e cria as 4 novas tabelas aditivas se não existirem (`POST /api/db/ensure-additive-tables`).

```bash
./scripts/safe_update_with_rollback.sh --apply-migrations
```

### Passo 4 — Migração Controlada do `localStorage` → PostgreSQL (Painel Admin)
1. Acesse o **Painel Administrativo → Backup & Recuperação → Aba "Banco PostgreSQL Oficial"**.
2. Na seção **Pré-Voo Hostinger VPS & Migração Controlada**:
   - Confira o card de diagnóstico (`Modo PostgreSQL`, `SSL`, contagem de `/uploads` e `/data/backups`).
   - Clique em **"Simular & Validar Migração (Dry-Run)"**.
   - Audite a tabela comparativa (quantos registros existem no navegador vs. no PostgreSQL e quantos estão ausentes).
   - Marque a confirmação de segurança e clique em **"Executar Migração Segura (Apenas Novos Registros)"**.

### Passo 5 — Validação Pós-Implantação
1. Verifique conexão com PostgreSQL (`curl -sf http://127.0.0.1:3000/api/db/status`).
2. Teste login administrativo, catálogo de produtos, orçamento, pedido, PDV e upload de arte em `https://www.mbpersonaliza.com.br`.
3. Verifique logs do container:
```bash
docker compose logs --tail=100 app
docker compose logs --tail=50 nginx
```

---

## 4. Plano de Reversão (Rollback Imediato)

Caso qualquer anomalia seja detectada após a atualização do container `app`:

### Reverter a Aplicação (Container `app`)
```bash
./scripts/safe_update_with_rollback.sh --rollback
```
Este comando restaura a imagem Docker anterior registrada em `data/.last_release_rollback` e reinicia apenas o container `app`, sem tocar no PostgreSQL, Nginx, certificados SSL ou volumes persistentes.

### Reverter Dados do Banco PostgreSQL (Somente em Emergência Crítica)
Se necessário restaurar o estado completo do banco a partir do backup gerado no Passo 3:
```bash
ls -lh data/backups/
./scripts/restore_db.sh data/backups/mb_backup_<TIMESTAMP>.sql.gz
```
