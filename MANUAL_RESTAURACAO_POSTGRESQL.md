# Manual de Restauração, Implantação e Exportação PostgreSQL — MB Personaliza

Este manual descreve como criar o banco de dados PostgreSQL do **MB Personaliza**, restaurar dumps completos (`.sql` ou `.dump`), configurar a operação em containers Docker na **Hostinger VPS KVM 2** e validar a integridade dos dados.

---

## 1. Arquivos Incluídos neste Pacote

| Arquivo | Descrição |
|---|---|
| `create_database.sql` | Criação do banco `mb_personaliza`, usuário dedicado `mb_app_user` e permissões |
| `schema.sql` | Estrutura completa das **44 tabelas**, PKs, índices e chaves estrangeiras |
| `seed.sql` | Dados reais iniciais do catálogo, configurações, financeiro, precificação e Stricker |
| `mbpersonaliza_database.sql` | Script SQL unificado (`schema.sql` + `seed.sql` + sequências) para restauração direta via `psql` |
| `mbpersonaliza_database.dump` | Backup binário PostgreSQL Custom (`pg_dump -Fc`) — gerado na VPS via `scripts/export_postgres_package.sh` ou Painel Admin |
| `migrations/` | Histórico de migrations SQL aditivas (`drizzle/0000_*.sql`, `0001_*.sql`) |
| `.env.example` | Modelo seguro de variáveis de ambiente (sem credenciais reais) |
| `docker-compose.yml` | Orquestração com container `postgres:16-alpine` isolado, volume `postgres_data`, `app`, `nginx` e `certbot` |
| `scripts/export_postgres_package.sh` | Script oficial para gerar `.sql`, `.dump` (`pg_dump -Fc`), testar restauração e atualizar o `.zip` na VPS |

---

## 2. Subindo o PostgreSQL Independente na Hostinger VPS (Docker)

1. Copie `.env.example` para `.env` na raiz do projeto e defina senhas fortes (`POSTGRES_PASSWORD`, `SQL_PASSWORD`, `SESSION_SECRET`, `MASTER_ADMIN_PASSWORD`):
   ```bash
   cp .env.example .env
   chmod 600 .env
   nano .env
   ```
2. Suba o serviço PostgreSQL com volume persistente (`postgres_data`) **sem expor a porta 5432 publicamente**:
   ```bash
   docker compose up -d postgres
   docker compose ps
   ```
3. Confirme que o PostgreSQL está saudável:
   ```bash
   docker compose exec postgres pg_isready -U mb_app_user -d mb_personaliza
   ```

---

## 3. Restauração a partir do Arquivo `.sql` (`psql`)

### Em PostgreSQL Docker (Hostinger VPS)
```bash
docker compose exec -T postgres psql -U mb_app_user -d mb_personaliza < mbpersonaliza_database.sql
```

### Em PostgreSQL Local ou Externo
```bash
# 1. Criar usuário e banco (edite a senha no create_database.sql antes de executar)
psql -U postgres -f create_database.sql

# 2. Restaurar estrutura, índices, relacionamentos e registros
psql -U mb_app_user -d mb_personaliza -f mbpersonaliza_database.sql
```

---

## 4. Restauração a partir do Arquivo `.dump` (`pg_restore`)

O arquivo `mbpersonaliza_database.dump` utiliza o formato compacto binário PostgreSQL Custom (`-Fc`), suportando restauração paralela e seletiva:

```bash
# Em PostgreSQL Docker:
docker compose exec -T postgres pg_restore \
  -U mb_app_user \
  -d mb_personaliza \
  --clean --if-exists --no-owner --no-privileges < mbpersonaliza_database.dump

# Em servidor PostgreSQL direto:
pg_restore \
  -h localhost -p 5432 -U mb_app_user -d mb_personaliza \
  --clean --if-exists --no-owner --no-privileges \
  mbpersonaliza_database.dump
```

---

## 5. Gerando Novo Backup `.sql`, `.dump` e `.zip` Atualizado com Dados de Produção

Na Hostinger VPS, com os containers em execução, execute:
```bash
./scripts/export_postgres_package.sh
```
O script irá:
1. Gerar `mbpersonaliza_database.sql` (SQL completo via `pg_dump -Fp`);
2. Gerar `mbpersonaliza_database.dump` (binário PostgreSQL Custom via `pg_dump -Fc`);
3. Restaurar o `.dump` em um banco temporário isolado (`mbpersonaliza_restore_test`) para comprovar que o backup é 100% restaurável e removê-lo em seguida;
4. Atualizar `data/postgres_package/MB_PERSONALIZA_POSTGRESQL_COMPLETO.zip` para download pelo Painel Administrativo (**Admin > Backup & Recuperação**) ou cópia direta via SCP/SFTP.

---

## 6. Validação Pós-Restauração

Execute as consultas abaixo no PostgreSQL restaurado para confirmar integridade:
```sql
SELECT current_database(), current_user, version();
SELECT COUNT(*) AS total_tabelas FROM pg_tables WHERE schemaname = 'public';
SELECT
  (SELECT COUNT(*) FROM categories) AS categories,
  (SELECT COUNT(*) FROM products) AS products,
  (SELECT COUNT(*) FROM users) AS users,
  (SELECT COUNT(*) FROM orders) AS orders,
  (SELECT COUNT(*) FROM quotes) AS quotes;
```
Em seguida, valide a aplicação com:
```bash
curl -s http://127.0.0.1:3000/api/db/status
```
