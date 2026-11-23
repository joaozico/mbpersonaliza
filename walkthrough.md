# MB Personaliza — Walkthrough de Auditoria, Persistência Exclusiva PostgreSQL e Homologação

# Security Summary

A aplicação **MB Personaliza** passou por auditoria completa e refatoração estrutural para garantir persistência exclusiva no **PostgreSQL**, isolamento estrito de controle de acesso no servidor (RBAC baseado em sessões persistidas em banco) e comportamento *fail-closed* caso o banco de dados não esteja disponível ou configurado.

Principais controles validados:
1. **Persistência Exclusiva em PostgreSQL (Zero Armazenamento de Navegador)**:
   - Removidas todas as ocorrências de `localStorage`, `sessionStorage` e `IndexedDB` da camada de aplicação, serviços, módulos administrativos, carrinho, favoritos, autenticação, precificação, analytics, integração Stricker e scripts operacionais.
   - Todas as 44 tabelas gerenciadas via Drizzle ORM (`src/db/schema.ts`) leem e gravam diretamente no PostgreSQL por meio do repositório central (`src/db/repository.ts`), preservando dados independentemente do ciclo de vida dos containers Docker.
2. **Autenticação e Autorização Server-Side (Zero Confiança em Cabeçalhos do Cliente)**:
   - Sessões autenticadas são emitidas via `/api/auth/login` e `/api/auth/register` com hash de senha seguro, tokens armazenados em `auth_sessions` no PostgreSQL e cookies `HttpOnly`.
   - O middleware (`src/middleware/auth.ts`) resolve usuário, função e matriz de permissões diretamente do banco. Cabeçalhos forjados pelo cliente (como `x-user-role: admin`) são ignorados e rejeitados com HTTP `401`.
   - Todas as rotas administrativas, financeiras, de backup, métricas, auditoria, usuários, integração Stricker e precificação exigem sessão válida e permissão específica no servidor.
3. **Fail-Closed & Higienização de Erros e Segredos**:
   - Quando o PostgreSQL não está configurado ou acessível, `isDatabaseConfigured()` / `requireDb()` e `handleRouterError()` retornam HTTP `503` com código `DB_UNAVAILABLE` sem simular sucesso, sem gravar em memória/navegador e sem expor `DATABASE_URL`, senhas ou tokens nos logs ou respostas HTTP.
   - Chaves de demonstração ou fallback hardcoded (`DEMO_STRICKER_ACCESS_KEY_2026`, `sess_spot_demo_*`) foram removidas. Credenciais de integração (Mercado Pago, PagBank, Stricker, PostgreSQL) são lidas exclusivamente de variáveis de ambiente no servidor e mascaradas quando exibidas.
4. **Integridade de Checkout, Estoque e Scripts VPS**:
   - O fluxo de pagamento e finalização (`POST /api/db/orders/checkout`) executa transação atômica no PostgreSQL (idempotência, baixa de estoque e variações, registro de movimentação, uso de cupom, boleto/conta financeira e limpeza de carrinho no servidor). Em caso de erro, o pedido não é simulado e o carrinho é preservado.
   - Os scripts de implantação e backup (`/scripts/*.sh`) preservam volumes Docker (`uploads_data`, `backups_data`, `certbot_conf`), Nginx e SSL, usam apenas migrações aditivas e autenticam chamadas administrativas via sessão real (`ADMIN_SESSION_TOKEN` ou `/api/auth/login`).

---

## PoC Verification

### 1. Verificação de Higiene do Código-Fonte e Migrações
Comandos executados sobre `src/`, `server.ts`, `scripts/` e `drizzle/`:
- **Busca por armazenamento de navegador e cabeçalhos forjados**:
  `grep -rnE "localStorage|sessionStorage|indexedDB|IndexedDB|DEMO_STRICKER_ACCESS_KEY|x-user-role" src server.ts scripts --exclude-dir=node_modules --exclude-dir=dist`
  - Resultado: **0 ocorrências** (`BROWSER_STORAGE_CLEAN`).
- **Verificação de migrações destrutivas**:
  `grep -rnE "DROP |TRUNCATE " drizzle/`
  - Resultado: **0 ocorrências** (`MIGRATIONS_SAFE_ADDITIVE`).
- **Sintaxe dos scripts operacionais**:
  `bash -n scripts/*.sh`
  - Resultado: **OK** (`SHELL_SYNTAX_OK`).

### 2. Verificação de Compilação e Tipagem (`npm run build` & `npm run lint`)
- `tsc --noEmit` (`lint_applet`): **aprovado com 0 erros**.
- `vite build && esbuild server.ts --bundle --platform=node --format=cjs ... --outfile=dist/server.cjs` (`compile_applet`): **aprovado com 0 erros** (gerou `dist/index.html`, assets e `dist/server.cjs`).

### 3. Verificação HTTP ao Vivo no Bundle Compilado (`dist/server.cjs`)
Testes executados contra o servidor de produção (`NODE_ENV=production node dist/server.cjs`) em ambiente sem `DATABASE_URL` configurada:
- **Healthcheck e Storage**:
  - `GET /api/health` -> `HTTP 200` (`{"status":"ok","app":"MB Personaliza","version":"1.0.0"}`)
  - `GET /api/upload/health` -> `HTTP 200` (`{"success":true,"storage":"Local Disk Volume (/uploads)"}`)
- **Fail-Closed sem PostgreSQL (HTTP 503 sem vazamento de credenciais)**:
  - `GET /api/db/status` -> `HTTP 503` (`"code":"DB_UNAVAILABLE"`)
  - `GET /api/system/price-visibility` -> `HTTP 503` (`"code":"DB_UNAVAILABLE"`)
  - `GET /api/system/settings` -> `HTTP 503` (`"code":"DB_UNAVAILABLE"`)
- **Bloqueio RBAC Sem Sessão (HTTP 401 `UNAUTHENTICATED`)**:
  - `GET /api/analytics/data` -> `HTTP 401`
  - `GET /api/cost-pricing/audit` -> `HTTP 401`
  - `GET /api/cost-pricing/tables` -> `HTTP 401`
  - `GET /api/financial/dashboard` -> `HTTP 401`
  - `GET /api/backup/history` -> `HTTP 401`
  - `GET /api/db/users` -> `HTTP 401`
  - `GET /api/db/vps-preflight` -> `HTTP 401`
  - `GET /api/v1SSL/config` -> `HTTP 401`
  - `GET /api/stricker/bootstrap` -> `HTTP 401`
- **Rejeição de Cabeçalho Administrativo Forjado (`x-user-role: admin`)**:
  - `POST /api/db/ensure-additive-tables` com `-H "x-user-role: admin"` -> `HTTP 401` (`"code":"UNAUTHENTICATED"`).

### 4. Validação Pendente em Produção (Hostinger VPS KVM 2 com PostgreSQL Ativo)
Como este ambiente sandbox não possui `DATABASE_URL` configurada, as consultas SQL ao vivo contra o banco oficial da Hostinger VPS devem ser confirmadas diretamente na VPS após o deploy:
- `SELECT current_database(), current_user, version();`
- Execução da bateria `./scripts/vps_preflight_audit.sh`, `./scripts/post_deploy_verify.sh` e `npx tsx scripts/run_fase3_tests.ts` para comprovar leitura, escrita e independência após reinício do container `app`.
