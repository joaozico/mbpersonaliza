import { db, requireDb, createPool, isDatabaseConfigured, DatabaseUnavailableError } from './index.ts';
import {
  users,
  authSessions,
  categories,
  subcategories,
  products,
  quotes,
  orders,
  discountCoupons,
  couponUsages,
  couponSendHistory,
  couponLogs,
  financialAccounts,
  financialCategories,
  costCenters,
  bankAccounts,
  financialPaymentMethods,
  financialAuditLogs,
  boletos,
  systemSettings,
  backups,
  stockMovements,
  pdvSales,
  cashRegisterSessions,
  paymentTransactions,
  paymentAuditLogs,
  costPricingSettings,
  costRawMaterials,
  costMachines,
  costLaborOperations,
  costIndirectExpenses,
  costCompositionSheets,
  costQuotes,
  costPricingAuditLogs,
  strickerConfig,
  strickerProducts,
  strickerCustomizationTables,
  strickerOrders,
  strickerLogs,
  shoppingCarts,
  userFavorites,
  analyticsPageviews,
  analyticsEvents,
  analyticsRealtime,
  appOperationLogs,
} from './schema.ts';
import {
  INITIAL_PRODUCTS,
  INITIAL_CATEGORIES,
  INITIAL_SUBCATEGORIES,
  INITIAL_ORDERS,
  INITIAL_QUOTES,
  INITIAL_USERS,
  INITIAL_COUPONS,
  INITIAL_COUPON_USAGES,
  INITIAL_COUPON_SEND_HISTORY,
  INITIAL_COUPON_AUDIT_LOGS,
  INITIAL_COMPANY_SETTINGS,
  INITIAL_DELIVERY_SETTINGS,
  INITIAL_BOLETO_SETTINGS,
  INITIAL_LAYOUT_SETTINGS,
  INITIAL_PERMISSIONS_MATRIX,
  INITIAL_PAYMENT_GATEWAYS,
  INITIAL_PDV_SETTINGS,
  INITIAL_FINANCIAL_SETTINGS,
  INITIAL_FINANCIAL_CATEGORIES,
  INITIAL_COST_CENTERS,
  INITIAL_BANK_ACCOUNTS,
  INITIAL_FINANCIAL_PAYMENT_METHODS,
  INITIAL_FINANCIAL_ACCOUNTS,
  INITIAL_BOLETOS,
  INITIAL_STOCK_MOVEMENTS,
  INITIAL_PDV_SALES,
  INITIAL_CASH_REGISTER_SESSION,
  INITIAL_PAYMENT_TRANSACTIONS,
  INITIAL_BACKUP_SCHEDULE_CONFIG,
} from '../data/initialData.ts';
import {
  INITIAL_COST_PRICING_SETTINGS,
  INITIAL_RAW_MATERIALS,
  INITIAL_MACHINES,
  INITIAL_LABOR_OPERATIONS,
  INITIAL_INDIRECT_EXPENSES,
  INITIAL_TECHNICAL_SHEETS,
  INITIAL_COST_QUOTES,
  INITIAL_COST_PRICING_AUDIT_LOGS,
} from '../data/costPricingInitialData.ts';
import {
  INITIAL_STRICKER_PRODUCTS,
  INITIAL_STRICKER_CUSTOMIZATION_TABLES,
} from '../data/strickerInitialData.ts';
import { eq, desc, sql, and, gt } from 'drizzle-orm';
import { hashPassword } from '../server/authUtils.ts';

function ensureDbReady() {
  if (!isDatabaseConfigured()) {
    throw new DatabaseUnavailableError(
      'PostgreSQL não configurado. Nenhuma operação foi persistida.'
    );
  }
  return requireDb();
}

function getMasterAdminSeed() {
  const email = (process.env.MASTER_ADMIN_EMAIL || 'mbpersonaliza@gmail.com').trim().toLowerCase();
  const password = process.env.MASTER_ADMIN_PASSWORD || '10M@53cy';
  return {
    id: 'user_admin_master',
    name: process.env.MASTER_ADMIN_NAME || 'Administrador Master MB',
    email,
    phone: '(11) 99999-0000',
    company: 'MB Personaliza Brindes & Estamparia',
    cpfCnpj: '00.000.000/0001-00',
    role: 'admin' as const,
    status: 'ativo' as const,
    password,
    createdAt: new Date().toISOString(),
  };
}

let isEnsuringSchema = false;
let schemaEnsured = false;

/**
 * Garante de forma aditiva (NUNCA destrutiva) que todas as 44 tabelas, colunas e índices
 * existam no PostgreSQL sem alterar ou apagar registros existentes.
 */
export async function ensureAdditiveTablesInPostgres(force = false): Promise<{
  tablesEnsured: number;
  alreadyEnsured?: boolean;
  ensuredAt: string;
}> {
  if (!isDatabaseConfigured()) {
    throw new DatabaseUnavailableError('PostgreSQL não configurado para inicialização de schema.');
  }
  if (schemaEnsured && !force) {
    return { tablesEnsured: 44, alreadyEnsured: true, ensuredAt: new Date().toISOString() };
  }
  if (isEnsuringSchema) {
    return { tablesEnsured: 44, alreadyEnsured: true, ensuredAt: new Date().toISOString() };
  }
  isEnsuringSchema = true;

  try {
    const pool = createPool();
    const statements = [
      // Additive columns on pre-existing tables
      `ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS state_registration text DEFAULT '';`,
      `ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS favorite_product_ids jsonb DEFAULT '[]'::jsonb;`,
      `ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS last_login text;`,
      `ALTER TABLE IF EXISTS orders ADD COLUMN IF NOT EXISTS tracking_code text;`,
      `ALTER TABLE IF EXISTS boletos ADD COLUMN IF NOT EXISTS financial_account_id text;`,
      `ALTER TABLE IF EXISTS boletos ADD COLUMN IF NOT EXISTS raw_data jsonb;`,
      `ALTER TABLE IF EXISTS financial_accounts ADD COLUMN IF NOT EXISTS raw_data jsonb;`,
      `ALTER TABLE IF EXISTS discount_coupons ADD COLUMN IF NOT EXISTS customer_restriction text DEFAULT 'general';`,
      `ALTER TABLE IF EXISTS discount_coupons ADD COLUMN IF NOT EXISTS specific_customer_emails jsonb DEFAULT '[]'::jsonb;`,
      `ALTER TABLE IF EXISTS discount_coupons ADD COLUMN IF NOT EXISTS total_discount_granted double precision DEFAULT 0;`,
      `ALTER TABLE IF EXISTS discount_coupons ADD COLUMN IF NOT EXISTS total_sales_volume double precision DEFAULT 0;`,
      `ALTER TABLE IF EXISTS discount_coupons ADD COLUMN IF NOT EXISTS sent_count integer DEFAULT 0;`,
      `ALTER TABLE IF EXISTS discount_coupons ADD COLUMN IF NOT EXISTS created_by_user_id text;`,
      `ALTER TABLE IF EXISTS coupon_usages ADD COLUMN IF NOT EXISTS customer_name text DEFAULT 'Cliente';`,
      `ALTER TABLE IF EXISTS coupon_usages ADD COLUMN IF NOT EXISTS customer_phone text;`,
      `ALTER TABLE IF EXISTS coupon_usages ADD COLUMN IF NOT EXISTS eligible_amount double precision DEFAULT 0;`,
      `ALTER TABLE IF EXISTS coupon_usages ADD COLUMN IF NOT EXISTS shipping_cost double precision DEFAULT 0;`,
      `ALTER TABLE IF EXISTS coupon_usages ADD COLUMN IF NOT EXISTS final_total double precision DEFAULT 0;`,
      `ALTER TABLE IF EXISTS coupon_usages ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'confirmed';`,
      `ALTER TABLE IF EXISTS coupon_usages ADD COLUMN IF NOT EXISTS cancelled_at text;`,
      `ALTER TABLE IF EXISTS coupon_usages ADD COLUMN IF NOT EXISTS cancel_reason text;`,
      `ALTER TABLE IF EXISTS coupon_logs ADD COLUMN IF NOT EXISTS coupon_code text;`,
      `ALTER TABLE IF EXISTS coupon_logs ADD COLUMN IF NOT EXISTS user_id text;`,
      `ALTER TABLE IF EXISTS coupon_logs ADD COLUMN IF NOT EXISTS user_role text;`,

      // Core 17 tables IF NOT EXISTS (safe on fresh DB)
      `CREATE TABLE IF NOT EXISTS users (
        id serial PRIMARY KEY,
        uid text NOT NULL UNIQUE,
        name text NOT NULL,
        email text NOT NULL,
        phone text DEFAULT '',
        company text DEFAULT '',
        cpf_cnpj text DEFAULT '',
        state_registration text DEFAULT '',
        role text NOT NULL DEFAULT 'cliente',
        password_hash text,
        address jsonb,
        custom_permissions jsonb,
        favorite_product_ids jsonb DEFAULT '[]'::jsonb,
        is_active boolean DEFAULT true,
        last_login text,
        created_at timestamp DEFAULT now(),
        updated_at timestamp DEFAULT now()
      );`,
      `CREATE TABLE IF NOT EXISTS auth_sessions (
        token_hash text PRIMARY KEY,
        user_uid text NOT NULL,
        role text NOT NULL,
        expires_at timestamp NOT NULL,
        user_agent text DEFAULT '',
        ip text DEFAULT '',
        created_at timestamp DEFAULT now()
      );`,
      `CREATE TABLE IF NOT EXISTS categories (
        id text PRIMARY KEY,
        name text NOT NULL,
        slug text NOT NULL,
        description text DEFAULT '',
        image text DEFAULT '',
        icon text DEFAULT '',
        order_index integer DEFAULT 0,
        is_active boolean DEFAULT true,
        created_at timestamp DEFAULT now()
      );`,
      `CREATE TABLE IF NOT EXISTS subcategories (
        id text PRIMARY KEY,
        category_id text NOT NULL,
        name text NOT NULL,
        slug text NOT NULL,
        description text DEFAULT '',
        is_active boolean DEFAULT true,
        created_at timestamp DEFAULT now()
      );`,
      `CREATE TABLE IF NOT EXISTS products (
        id text PRIMARY KEY,
        code text NOT NULL,
        name text NOT NULL,
        slug text NOT NULL,
        category_id text NOT NULL,
        subcategory_id text,
        short_description text DEFAULT '',
        description text DEFAULT '',
        base_price double precision NOT NULL DEFAULT 0,
        promo_price double precision,
        cost_price double precision,
        stock_qty integer NOT NULL DEFAULT 0,
        min_order_qty integer NOT NULL DEFAULT 1,
        is_active boolean NOT NULL DEFAULT true,
        is_featured boolean DEFAULT false,
        images jsonb DEFAULT '[]'::jsonb,
        badge text,
        show_price boolean DEFAULT true,
        price_tiers jsonb DEFAULT '[]'::jsonb,
        variants jsonb DEFAULT '[]'::jsonb,
        details jsonb,
        barcode text,
        qr_code text,
        total_stock_available integer DEFAULT 0,
        total_next_quantities integer DEFAULT 0,
        raw_data jsonb,
        created_at timestamp DEFAULT now(),
        updated_at timestamp DEFAULT now()
      );`,
      `CREATE TABLE IF NOT EXISTS quotes (
        id text PRIMARY KEY,
        code text NOT NULL,
        client_id text,
        client_name text NOT NULL,
        client_email text NOT NULL,
        client_phone text NOT NULL,
        client_company text,
        items jsonb NOT NULL DEFAULT '[]'::jsonb,
        subtotal double precision NOT NULL DEFAULT 0,
        discount double precision DEFAULT 0,
        total double precision NOT NULL DEFAULT 0,
        notes text,
        status text NOT NULL DEFAULT 'pendente',
        admin_notes text,
        responded_at text,
        responded_by text,
        billing_terms jsonb,
        validity_date text,
        created_at timestamp DEFAULT now(),
        updated_at timestamp DEFAULT now()
      );`,
      `CREATE TABLE IF NOT EXISTS orders (
        id text PRIMARY KEY,
        code text NOT NULL,
        client_id text,
        client_name text NOT NULL,
        client_email text NOT NULL,
        client_phone text NOT NULL,
        client_company text,
        shipping_address jsonb,
        items jsonb NOT NULL DEFAULT '[]'::jsonb,
        subtotal double precision NOT NULL DEFAULT 0,
        discount double precision DEFAULT 0,
        coupon_code text,
        coupon_id text,
        coupon_discount double precision,
        coupon_info jsonb,
        shipping_cost double precision DEFAULT 0,
        shipping_info jsonb,
        total double precision NOT NULL DEFAULT 0,
        payment_method text NOT NULL DEFAULT 'pix',
        payment_status text NOT NULL DEFAULT 'pendente',
        order_status text NOT NULL DEFAULT 'novo',
        tracking_code text,
        source_quote_id text,
        billing_terms jsonb,
        notes text,
        boletos jsonb,
        created_at timestamp DEFAULT now(),
        updated_at timestamp DEFAULT now()
      );`,
      `CREATE TABLE IF NOT EXISTS discount_coupons (
        id text PRIMARY KEY,
        code text NOT NULL UNIQUE,
        campaign_name text NOT NULL,
        discount_type text NOT NULL,
        discount_value double precision NOT NULL,
        start_date text NOT NULL,
        end_date text NOT NULL,
        min_purchase_amount double precision,
        max_discount_amount double precision,
        max_uses integer DEFAULT 0,
        current_uses integer DEFAULT 0,
        limit_per_customer integer DEFAULT 1,
        applicable_type text NOT NULL DEFAULT 'all_store',
        allowed_product_ids jsonb DEFAULT '[]'::jsonb,
        allowed_category_ids jsonb DEFAULT '[]'::jsonb,
        allowed_customer_ids jsonb DEFAULT '[]'::jsonb,
        customer_restriction text DEFAULT 'general',
        specific_customer_emails jsonb DEFAULT '[]'::jsonb,
        allow_cumulative boolean DEFAULT true,
        total_discount_granted double precision DEFAULT 0,
        total_sales_volume double precision DEFAULT 0,
        sent_count integer DEFAULT 0,
        status text NOT NULL DEFAULT 'active',
        internal_notes text,
        created_by text,
        created_by_user_id text,
        created_at timestamp DEFAULT now(),
        updated_at timestamp DEFAULT now()
      );`,
      `CREATE TABLE IF NOT EXISTS coupon_usages (
        id text PRIMARY KEY,
        coupon_id text NOT NULL,
        coupon_code text NOT NULL,
        order_id text NOT NULL,
        order_code text NOT NULL,
        customer_id text,
        customer_name text DEFAULT 'Cliente',
        customer_email text,
        customer_phone text,
        customer_cpf_cnpj text,
        subtotal double precision NOT NULL DEFAULT 0,
        eligible_amount double precision DEFAULT 0,
        discount_applied double precision NOT NULL DEFAULT 0,
        shipping_cost double precision DEFAULT 0,
        final_total double precision DEFAULT 0,
        status text NOT NULL DEFAULT 'confirmed',
        cancelled_at text,
        cancel_reason text,
        used_at timestamp DEFAULT now()
      );`,
      `CREATE TABLE IF NOT EXISTS coupon_send_history (
        id text PRIMARY KEY,
        coupon_id text NOT NULL,
        coupon_code text NOT NULL,
        customer_id text,
        customer_name text NOT NULL,
        customer_phone text,
        customer_email text,
        channel text NOT NULL DEFAULT 'clipboard',
        sent_at text NOT NULL,
        sent_by_user_id text NOT NULL,
        sent_by_user_name text NOT NULL,
        message_preview text NOT NULL,
        status text NOT NULL DEFAULT 'copied',
        created_at timestamp DEFAULT now()
      );`,
      `CREATE TABLE IF NOT EXISTS coupon_logs (
        id text PRIMARY KEY,
        coupon_id text NOT NULL,
        coupon_code text,
        action text NOT NULL,
        performed_by text NOT NULL,
        user_id text,
        user_role text,
        details jsonb,
        timestamp timestamp DEFAULT now()
      );`,
      `CREATE TABLE IF NOT EXISTS financial_accounts (
        id text PRIMARY KEY,
        type text NOT NULL,
        description text NOT NULL,
        entity_name text NOT NULL,
        document_number text,
        amount double precision NOT NULL,
        paid_amount double precision DEFAULT 0,
        remaining_amount double precision NOT NULL,
        due_date text NOT NULL,
        issue_date text NOT NULL,
        payment_date text,
        status text NOT NULL,
        category_id text,
        cost_center_id text,
        bank_account_id text,
        payment_method_id text,
        order_id text,
        quote_id text,
        notes text,
        installments jsonb,
        raw_data jsonb,
        created_at timestamp DEFAULT now(),
        updated_at timestamp DEFAULT now()
      );`,
      `CREATE TABLE IF NOT EXISTS financial_categories (
        id text PRIMARY KEY,
        name text NOT NULL,
        type text NOT NULL,
        color text DEFAULT '#10B981',
        description text DEFAULT '',
        active boolean NOT NULL DEFAULT true,
        created_at timestamp DEFAULT now()
      );`,
      `CREATE TABLE IF NOT EXISTS cost_centers (
        id text PRIMARY KEY,
        code text NOT NULL,
        name text NOT NULL,
        description text DEFAULT '',
        active boolean NOT NULL DEFAULT true,
        created_at timestamp DEFAULT now()
      );`,
      `CREATE TABLE IF NOT EXISTS bank_accounts (
        id text PRIMARY KEY,
        name text NOT NULL,
        bank_name text DEFAULT '',
        agency text DEFAULT '',
        account_number text DEFAULT '',
        type text NOT NULL DEFAULT 'corrente',
        initial_balance double precision NOT NULL DEFAULT 0,
        current_balance double precision NOT NULL DEFAULT 0,
        is_default boolean DEFAULT false,
        active boolean NOT NULL DEFAULT true,
        created_at timestamp DEFAULT now(),
        updated_at timestamp DEFAULT now()
      );`,
      `CREATE TABLE IF NOT EXISTS financial_payment_methods (
        id text PRIMARY KEY,
        name text NOT NULL,
        code text NOT NULL,
        tax_percent double precision DEFAULT 0,
        settlement_days integer DEFAULT 0,
        allow_installments boolean DEFAULT false,
        active boolean NOT NULL DEFAULT true,
        created_at timestamp DEFAULT now()
      );`,
      `CREATE TABLE IF NOT EXISTS financial_audit_logs (
        id text PRIMARY KEY,
        user_id text NOT NULL,
        user_name text NOT NULL,
        user_email text,
        user_role text NOT NULL,
        operation text NOT NULL,
        permission_used text,
        affected_record_id text,
        affected_record_type text NOT NULL,
        previous_values jsonb,
        new_values jsonb,
        result text NOT NULL DEFAULT 'sucesso',
        details text NOT NULL,
        origin text DEFAULT 'web_painel',
        timestamp text NOT NULL,
        created_at timestamp DEFAULT now()
      );`,
      `CREATE TABLE IF NOT EXISTS boletos (
        id text PRIMARY KEY,
        nosso_numero text NOT NULL,
        numero_documento text NOT NULL,
        order_id text NOT NULL,
        quote_id text,
        financial_account_id text,
        tipo_cobranca text NOT NULL,
        status text NOT NULL DEFAULT 'emitido',
        valor double precision NOT NULL,
        data_vencimento text NOT NULL,
        data_emissao text NOT NULL,
        data_pagamento text,
        linha_digitavel text NOT NULL,
        codigo_barras text NOT NULL,
        banco_codigo text NOT NULL,
        banco_nome text NOT NULL,
        sacado_nome text NOT NULL,
        sacado_documento text NOT NULL,
        parcela_atual integer,
        total_parcelas integer,
        raw_data jsonb,
        created_at timestamp DEFAULT now()
      );`,
      `CREATE TABLE IF NOT EXISTS system_settings (
        key text PRIMARY KEY,
        value jsonb NOT NULL,
        updated_at timestamp DEFAULT now()
      );`,
      `CREATE TABLE IF NOT EXISTS backups (
        id text PRIMARY KEY,
        filename text NOT NULL,
        size_bytes integer NOT NULL,
        size_formatted text NOT NULL,
        checksum text NOT NULL,
        trigger text NOT NULL,
        status text NOT NULL DEFAULT 'success',
        counts jsonb,
        payload jsonb,
        created_at timestamp DEFAULT now()
      );`,
      `CREATE TABLE IF NOT EXISTS stock_movements (
        id text PRIMARY KEY,
        product_id text NOT NULL,
        product_name text NOT NULL,
        variant_id text,
        variant_color text,
        type text NOT NULL,
        quantity integer NOT NULL,
        previous_stock integer NOT NULL DEFAULT 0,
        new_stock integer NOT NULL DEFAULT 0,
        reason text DEFAULT '',
        operator_name text DEFAULT 'Sistema',
        created_at_text text,
        created_at timestamp DEFAULT now()
      );`,
      `CREATE TABLE IF NOT EXISTS pdv_sales (
        id text PRIMARY KEY,
        code text NOT NULL,
        customer_name text DEFAULT 'Consumidor Final',
        customer_cpf_cnpj text,
        operator_id text,
        operator_name text,
        cash_register_number integer DEFAULT 1,
        subtotal double precision NOT NULL DEFAULT 0,
        discount double precision DEFAULT 0,
        total double precision NOT NULL DEFAULT 0,
        status text NOT NULL DEFAULT 'concluida',
        items jsonb NOT NULL DEFAULT '[]'::jsonb,
        payments jsonb NOT NULL DEFAULT '[]'::jsonb,
        raw_data jsonb,
        created_at timestamp DEFAULT now(),
        updated_at timestamp DEFAULT now()
      );`,
      `CREATE TABLE IF NOT EXISTS cash_register_sessions (
        id text PRIMARY KEY,
        register_number integer NOT NULL DEFAULT 1,
        register_name text NOT NULL DEFAULT 'Caixa Balcão 01',
        operator_id text NOT NULL,
        operator_name text NOT NULL,
        status text NOT NULL DEFAULT 'aberto',
        initial_fund double precision NOT NULL DEFAULT 0,
        expected_cash double precision NOT NULL DEFAULT 0,
        actual_cash double precision,
        total_sales_amount double precision DEFAULT 0,
        raw_data jsonb NOT NULL,
        opened_at text,
        closed_at text,
        created_at timestamp DEFAULT now(),
        updated_at timestamp DEFAULT now()
      );`,
      `CREATE TABLE IF NOT EXISTS payment_transactions (
        id text PRIMARY KEY,
        sale_id text,
        sale_code text,
        order_id text,
        origin text NOT NULL DEFAULT 'loja_online',
        gateway text NOT NULL DEFAULT 'mercadopago',
        gateway_transaction_id text,
        method text NOT NULL,
        gross_amount double precision NOT NULL DEFAULT 0,
        fee_amount double precision DEFAULT 0,
        net_amount double precision NOT NULL DEFAULT 0,
        status text NOT NULL DEFAULT 'pendente',
        raw_data jsonb NOT NULL,
        created_at timestamp DEFAULT now(),
        updated_at timestamp DEFAULT now()
      );`,
      `CREATE TABLE IF NOT EXISTS payment_audit_logs (
        id text PRIMARY KEY,
        user_id text NOT NULL,
        user_name text NOT NULL,
        user_role text NOT NULL,
        action text NOT NULL,
        details text NOT NULL,
        timestamp text NOT NULL,
        created_at timestamp DEFAULT now()
      );`,
      `CREATE TABLE IF NOT EXISTS cost_pricing_settings (
        id text PRIMARY KEY,
        data jsonb NOT NULL,
        updated_by text,
        updated_at timestamp DEFAULT now()
      );`,
      `CREATE TABLE IF NOT EXISTS cost_raw_materials (
        id text PRIMARY KEY,
        code text NOT NULL,
        name text NOT NULL,
        category text NOT NULL,
        cost_with_waste double precision NOT NULL DEFAULT 0,
        data jsonb NOT NULL,
        updated_at timestamp DEFAULT now()
      );`,
      `CREATE TABLE IF NOT EXISTS cost_machines (
        id text PRIMARY KEY,
        code text NOT NULL,
        name text NOT NULL,
        status text NOT NULL DEFAULT 'ativo',
        total_machine_cost_per_hour double precision NOT NULL DEFAULT 0,
        data jsonb NOT NULL,
        updated_at timestamp DEFAULT now()
      );`,
      `CREATE TABLE IF NOT EXISTS cost_labor_operations (
        id text PRIMARY KEY,
        code text NOT NULL,
        name text NOT NULL,
        effective_hourly_rate double precision NOT NULL DEFAULT 0,
        data jsonb NOT NULL,
        updated_at timestamp DEFAULT now()
      );`,
      `CREATE TABLE IF NOT EXISTS cost_indirect_expenses (
        id text PRIMARY KEY,
        code text NOT NULL,
        name text NOT NULL,
        monthly_amount double precision NOT NULL DEFAULT 0,
        active boolean NOT NULL DEFAULT true,
        data jsonb NOT NULL,
        updated_at timestamp DEFAULT now()
      );`,
      `CREATE TABLE IF NOT EXISTS cost_composition_sheets (
        id text PRIMARY KEY,
        code text NOT NULL,
        product_name text NOT NULL,
        category text NOT NULL,
        total_unit_cost double precision NOT NULL DEFAULT 0,
        suggested_unit_price double precision NOT NULL DEFAULT 0,
        data jsonb NOT NULL,
        updated_at timestamp DEFAULT now()
      );`,
      `CREATE TABLE IF NOT EXISTS cost_quotes (
        id text PRIMARY KEY,
        code text NOT NULL,
        client_name text NOT NULL,
        status text NOT NULL DEFAULT 'pendente',
        total double precision NOT NULL DEFAULT 0,
        data jsonb NOT NULL,
        updated_at timestamp DEFAULT now()
      );`,
      `CREATE TABLE IF NOT EXISTS cost_pricing_audit_logs (
        id text PRIMARY KEY,
        user_id text NOT NULL,
        user_name text NOT NULL,
        user_role text NOT NULL,
        operation text NOT NULL,
        entity_type text NOT NULL,
        entity_id text NOT NULL,
        entity_name text NOT NULL,
        details text NOT NULL,
        data jsonb,
        timestamp text NOT NULL,
        created_at timestamp DEFAULT now()
      );`,
      `CREATE TABLE IF NOT EXISTS stricker_config (
        id text PRIMARY KEY,
        environment text NOT NULL DEFAULT 'homologacao',
        api_url text NOT NULL DEFAULT 'https://ws.spotgifts.com.br/api/v1SSL/',
        session_token text,
        token_expires_at text,
        auto_sync_enabled boolean NOT NULL DEFAULT true,
        sync_interval_hours integer NOT NULL DEFAULT 12,
        last_sync_at text,
        data jsonb,
        updated_at timestamp DEFAULT now()
      );`,
      `CREATE TABLE IF NOT EXISTS stricker_products (
        reference text PRIMARY KEY,
        name text NOT NULL,
        brand text DEFAULT '',
        category text DEFAULT '',
        status text DEFAULT 'ativo',
        published_to_catalog boolean DEFAULT false,
        total_stock_available integer DEFAULT 0,
        data jsonb NOT NULL,
        updated_at timestamp DEFAULT now()
      );`,
      `CREATE TABLE IF NOT EXISTS stricker_customization_tables (
        table_code text PRIMARY KEY,
        technique_code text DEFAULT '',
        data jsonb NOT NULL,
        updated_at timestamp DEFAULT now()
      );`,
      `CREATE TABLE IF NOT EXISTS stricker_orders (
        id text PRIMARY KEY,
        order_stamp text NOT NULL,
        internal_reference text NOT NULL,
        status text NOT NULL DEFAULT 'PROCESSING',
        order_total double precision NOT NULL DEFAULT 0,
        data jsonb NOT NULL,
        created_at timestamp DEFAULT now(),
        updated_at timestamp DEFAULT now()
      );`,
      `CREATE TABLE IF NOT EXISTS stricker_logs (
        id text PRIMARY KEY,
        log_type text NOT NULL,
        status text NOT NULL,
        data jsonb NOT NULL,
        timestamp text NOT NULL,
        created_at timestamp DEFAULT now()
      );`,
      `CREATE TABLE IF NOT EXISTS shopping_carts (
        owner_key text PRIMARY KEY,
        items jsonb NOT NULL DEFAULT '[]'::jsonb,
        updated_at timestamp DEFAULT now()
      );`,
      `CREATE TABLE IF NOT EXISTS user_favorites (
        owner_key text PRIMARY KEY,
        product_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
        updated_at timestamp DEFAULT now()
      );`,
      `CREATE TABLE IF NOT EXISTS analytics_pageviews (
        id text PRIMARY KEY,
        timestamp text NOT NULL,
        session_id text NOT NULL,
        visitor_id text NOT NULL,
        path text NOT NULL,
        title text DEFAULT '',
        source text DEFAULT 'direto',
        device text DEFAULT 'computador',
        browser text DEFAULT 'Chrome',
        os text DEFAULT 'Windows',
        country text DEFAULT 'Brasil',
        state text DEFAULT 'SP',
        city text DEFAULT 'São Paulo',
        duration_seconds integer DEFAULT 15,
        is_new_visitor boolean DEFAULT false,
        data jsonb,
        created_at timestamp DEFAULT now()
      );`,
      `CREATE TABLE IF NOT EXISTS analytics_events (
        id text PRIMARY KEY,
        timestamp text NOT NULL,
        session_id text NOT NULL,
        visitor_id text NOT NULL,
        event_name text NOT NULL,
        category text DEFAULT 'Interação',
        label text DEFAULT '',
        path text DEFAULT '/',
        value double precision,
        metadata jsonb,
        created_at timestamp DEFAULT now()
      );`,
      `CREATE TABLE IF NOT EXISTS analytics_realtime (
        session_id text PRIMARY KEY,
        visitor_id text NOT NULL,
        last_active text NOT NULL,
        data jsonb NOT NULL,
        updated_at timestamp DEFAULT now()
      );`,
      `CREATE TABLE IF NOT EXISTS app_operation_logs (
        id text PRIMARY KEY,
        module text NOT NULL,
        level text NOT NULL DEFAULT 'info',
        actor_id text,
        actor_role text,
        action text NOT NULL,
        message text NOT NULL,
        details jsonb,
        created_at timestamp DEFAULT now()
      );`,
      // Safe non-unique lookup indexes
      `CREATE INDEX IF NOT EXISTS idx_users_email_lower ON users (lower(email));`,
      `CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_uid ON auth_sessions (user_uid);`,
      `CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires_at ON auth_sessions (expires_at);`,
      `CREATE INDEX IF NOT EXISTS idx_subcategories_category_id ON subcategories (category_id);`,
      `CREATE INDEX IF NOT EXISTS idx_products_category_id ON products (category_id);`,
      `CREATE INDEX IF NOT EXISTS idx_products_slug ON products (slug);`,
      `CREATE INDEX IF NOT EXISTS idx_orders_client_id ON orders (client_id);`,
      `CREATE INDEX IF NOT EXISTS idx_orders_code ON orders (code);`,
      `CREATE INDEX IF NOT EXISTS idx_orders_status ON orders (order_status);`,
      `CREATE INDEX IF NOT EXISTS idx_quotes_client_id ON quotes (client_id);`,
      `CREATE INDEX IF NOT EXISTS idx_coupon_usages_coupon_id ON coupon_usages (coupon_id);`,
      `CREATE INDEX IF NOT EXISTS idx_coupon_usages_order_id ON coupon_usages (order_id);`,
      `CREATE INDEX IF NOT EXISTS idx_financial_accounts_type_status ON financial_accounts (type, status);`,
      `CREATE INDEX IF NOT EXISTS idx_financial_accounts_order_id ON financial_accounts (order_id);`,
      `CREATE INDEX IF NOT EXISTS idx_boletos_order_id ON boletos (order_id);`,
      `CREATE INDEX IF NOT EXISTS idx_stock_movements_product_id ON stock_movements (product_id);`,
      `CREATE INDEX IF NOT EXISTS idx_payment_transactions_order_id ON payment_transactions (order_id);`,
      `CREATE INDEX IF NOT EXISTS idx_analytics_pv_ts ON analytics_pageviews (timestamp);`,
      `CREATE INDEX IF NOT EXISTS idx_analytics_pv_session ON analytics_pageviews (session_id);`,
      `CREATE INDEX IF NOT EXISTS idx_analytics_ev_ts ON analytics_events (timestamp);`,
      `CREATE INDEX IF NOT EXISTS idx_analytics_ev_session ON analytics_events (session_id);`,
      `CREATE INDEX IF NOT EXISTS idx_stricker_orders_stamp ON stricker_orders (order_stamp);`,
      `DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_auth_sessions_user_uid') THEN
          ALTER TABLE auth_sessions ADD CONSTRAINT fk_auth_sessions_user_uid FOREIGN KEY (user_uid) REFERENCES users(uid) ON DELETE CASCADE NOT VALID;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_subcategories_category_id') THEN
          ALTER TABLE subcategories ADD CONSTRAINT fk_subcategories_category_id FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT NOT VALID;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_products_category_id') THEN
          ALTER TABLE products ADD CONSTRAINT fk_products_category_id FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT NOT VALID;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_coupon_usages_coupon_id') THEN
          ALTER TABLE coupon_usages ADD CONSTRAINT fk_coupon_usages_coupon_id FOREIGN KEY (coupon_id) REFERENCES discount_coupons(id) ON DELETE CASCADE NOT VALID;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_coupon_send_history_coupon_id') THEN
          ALTER TABLE coupon_send_history ADD CONSTRAINT fk_coupon_send_history_coupon_id FOREIGN KEY (coupon_id) REFERENCES discount_coupons(id) ON DELETE CASCADE NOT VALID;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_stock_movements_product_id') THEN
          ALTER TABLE stock_movements ADD CONSTRAINT fk_stock_movements_product_id FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE NOT VALID;
        END IF;
      END $$;`,
    ];

    for (const stmt of statements) {
      await pool.query(stmt);
    }

    schemaEnsured = true;
    console.log('[PostgreSQL Schema] Estrutura de 44 tabelas e índices verificada com sucesso.');
    return { tablesEnsured: 44, ensuredAt: new Date().toISOString() };
  } finally {
    isEnsuringSchema = false;
  }
}

let isSeeding = false;
let hasSeeded = false;

/**
 * Popula dados iniciais no PostgreSQL APENAS para tabelas vazias (idempotente, ON CONFLICT DO NOTHING).
 * Nunca sobrescreve dados de produção existentes.
 */
export async function seedInitialDataIfEmpty(): Promise<void> {
  const activeDb = ensureDbReady();
  if (hasSeeded || isSeeding) return;
  isSeeding = true;

  try {
    await ensureAdditiveTablesInPostgres();

    // 1. Seed Users & Master Admin (deduplicated by email so MASTER_ADMIN_SEED doesn't conflict with INITIAL_USERS)
    const existingUsers = await activeDb.select().from(users);
    if (existingUsers.length === 0) {
      const masterSeed = getMasterAdminSeed();
      const seenEmails = new Set<string>();
      const usersToSeed: any[] = [];
      for (const u of [...INITIAL_USERS, masterSeed]) {
        const lowerEmail = (u.email || '').trim().toLowerCase();
        if (!lowerEmail || seenEmails.has(lowerEmail)) continue;
        seenEmails.add(lowerEmail);
        usersToSeed.push(u);
      }

      for (const u of usersToSeed) {
        const defaultPlain =
          (u as any).password ||
          (u.role === 'admin'
            ? process.env.DEFAULT_ADMIN_PASSWORD || 'admin123'
            : u.role === 'gerente'
            ? 'gerente123'
            : u.role === 'vendedor'
            ? 'vendedor123'
            : u.role === 'estoquista'
            ? 'estoque123'
            : 'cliente123');
        await activeDb
          .insert(users)
          .values({
            uid: u.id,
            name: u.name,
            email: u.email.toLowerCase(),
            phone: u.phone || '',
            company: u.company || '',
            cpfCnpj: u.cpfCnpj || '',
            stateRegistration: (u as any).stateRegistration || '',
            role: u.role,
            passwordHash: hashPassword(defaultPlain),
            address: (u as any).address || null,
            customPermissions: (u as any).customPermissions || null,
            favoriteProductIds: (u as any).favoriteProductIds || [],
            isActive: u.status !== 'inativo',
          })
          .onConflictDoNothing();
      }
    } else {
      // Ensure master admin account exists if not already present by uid OR email
      const masterSeed = getMasterAdminSeed();
      const existingMaster = existingUsers.find(
        (u) => u.uid === masterSeed.id || (u.email || '').trim().toLowerCase() === masterSeed.email
      );
      if (!existingMaster) {
        await activeDb
          .insert(users)
          .values({
            uid: masterSeed.id,
            name: masterSeed.name,
            email: masterSeed.email,
            phone: masterSeed.phone,
            company: masterSeed.company,
            cpfCnpj: masterSeed.cpfCnpj,
            role: 'admin',
            passwordHash: hashPassword(masterSeed.password),
            isActive: true,
          })
          .onConflictDoNothing();
      }
    }

    // 2. Categories & Subcategories
    const existingCats = await activeDb.select().from(categories).limit(1);
    if (existingCats.length === 0) {
      for (const cat of INITIAL_CATEGORIES) {
        await activeDb.insert(categories).values({
          id: cat.id,
          name: cat.name,
          slug: cat.slug,
          description: cat.description || '',
          image: cat.image || '',
          icon: cat.icon || '',
          orderIndex: cat.order || 0,
          isActive: true,
        }).onConflictDoNothing();
      }
    }

    const existingSubcats = await activeDb.select().from(subcategories).limit(1);
    if (existingSubcats.length === 0) {
      for (const sub of INITIAL_SUBCATEGORIES) {
        await activeDb.insert(subcategories).values({
          id: sub.id,
          categoryId: sub.categoryId,
          name: sub.name,
          slug: sub.slug,
          description: '',
          isActive: true,
        }).onConflictDoNothing();
      }
    }

    // 3. Products
    const existingProds = await activeDb.select().from(products).limit(1);
    if (existingProds.length === 0) {
      for (const p of INITIAL_PRODUCTS) {
        await upsertProductInDb(p);
      }
    }

    // 4. Quotes & Orders
    const existingQuotes = await activeDb.select().from(quotes).limit(1);
    if (existingQuotes.length === 0) {
      for (const q of INITIAL_QUOTES) {
        await upsertQuoteInDb(q);
      }
    }

    const existingOrders = await activeDb.select().from(orders).limit(1);
    if (existingOrders.length === 0) {
      for (const o of INITIAL_ORDERS) {
        await upsertOrderInDb(o);
      }
    }

    // 5. Coupons, Send History & Logs
    const existingCoupons = await activeDb.select().from(discountCoupons).limit(1);
    if (existingCoupons.length === 0) {
      for (const c of INITIAL_COUPONS) {
        await upsertCouponInDb(c);
      }
      for (const u of INITIAL_COUPON_USAGES) {
        await insertCouponUsageInDb(u);
      }
      for (const s of INITIAL_COUPON_SEND_HISTORY) {
        await insertCouponSendHistoryInDb(s);
      }
      for (const l of INITIAL_COUPON_AUDIT_LOGS) {
        await insertCouponAuditLogInDb(l);
      }
    }

    // 6. System Settings
    const existingSettings = await activeDb.select().from(systemSettings);
    const existingKeys = new Set(existingSettings.map((s) => s.key));
    const defaultSettingsPairs: Array<[string, any]> = [
      ['company', INITIAL_COMPANY_SETTINGS],
      ['delivery', INITIAL_DELIVERY_SETTINGS],
      ['boleto', INITIAL_BOLETO_SETTINGS],
      ['layout', INITIAL_LAYOUT_SETTINGS],
      ['permissions', INITIAL_PERMISSIONS_MATRIX],
      ['gateways', INITIAL_PAYMENT_GATEWAYS],
      ['pdv', INITIAL_PDV_SETTINGS],
      ['financial', INITIAL_FINANCIAL_SETTINGS],
      ['price_visibility', { mode: 'all', updatedAt: new Date().toISOString() }],
      ['maintenance', { enabled: false, message: 'Estamos realizando melhorias programadas em nossa loja. Voltaremos em instantes!', estimatedReturn: '' }],
      ['backup_schedule', INITIAL_BACKUP_SCHEDULE_CONFIG],
    ];
    for (const [k, v] of defaultSettingsPairs) {
      if (!existingKeys.has(k)) {
        await saveSystemSettingsToDb(k, v);
      }
    }

    // 7. Financial Catalogs & Accounts
    if ((await activeDb.select().from(financialCategories).limit(1)).length === 0) {
      for (const fc of INITIAL_FINANCIAL_CATEGORIES) {
        await upsertFinancialCategoryInDb(fc);
      }
    }
    if ((await activeDb.select().from(costCenters).limit(1)).length === 0) {
      for (const cc of INITIAL_COST_CENTERS) {
        await upsertCostCenterInDb(cc);
      }
    }
    if ((await activeDb.select().from(bankAccounts).limit(1)).length === 0) {
      for (const ba of INITIAL_BANK_ACCOUNTS) {
        await upsertBankAccountInDb(ba);
      }
    }
    if ((await activeDb.select().from(financialPaymentMethods).limit(1)).length === 0) {
      for (const pm of INITIAL_FINANCIAL_PAYMENT_METHODS) {
        await upsertFinancialPaymentMethodInDb(pm);
      }
    }
    if ((await activeDb.select().from(financialAccounts).limit(1)).length === 0) {
      for (const fa of INITIAL_FINANCIAL_ACCOUNTS) {
        await upsertFinancialAccountInDb(fa);
      }
    }

    // 8. Boletos, Stock Movements, PDV, Cash Sessions, Payment Transactions
    if ((await activeDb.select().from(boletos).limit(1)).length === 0) {
      for (const b of INITIAL_BOLETOS) {
        await upsertBoletoInDb(b);
      }
    }
    if ((await activeDb.select().from(stockMovements).limit(1)).length === 0) {
      for (const sm of INITIAL_STOCK_MOVEMENTS) {
        await upsertStockMovementInDb(sm);
      }
    }
    if ((await activeDb.select().from(pdvSales).limit(1)).length === 0) {
      for (const ps of INITIAL_PDV_SALES) {
        await upsertPdvSaleInDb(ps);
      }
    }
    if ((await activeDb.select().from(cashRegisterSessions).limit(1)).length === 0) {
      if (INITIAL_CASH_REGISTER_SESSION) {
        await upsertCashSessionInDb(INITIAL_CASH_REGISTER_SESSION);
      }
    }
    if ((await activeDb.select().from(paymentTransactions).limit(1)).length === 0) {
      for (const pt of INITIAL_PAYMENT_TRANSACTIONS) {
        await upsertPaymentTransactionInDb(pt);
      }
    }

    // 9. Cost & Pricing Module
    if ((await activeDb.select().from(costPricingSettings).limit(1)).length === 0) {
      await saveCostPricingSettingsInDb(INITIAL_COST_PRICING_SETTINGS, 'Sistema');
    }
    if ((await activeDb.select().from(costRawMaterials).limit(1)).length === 0) {
      for (const m of INITIAL_RAW_MATERIALS) await upsertCostMaterialInDb(m);
    }
    if ((await activeDb.select().from(costMachines).limit(1)).length === 0) {
      for (const m of INITIAL_MACHINES) await upsertCostMachineInDb(m);
    }
    if ((await activeDb.select().from(costLaborOperations).limit(1)).length === 0) {
      for (const l of INITIAL_LABOR_OPERATIONS) await upsertCostLaborInDb(l);
    }
    if ((await activeDb.select().from(costIndirectExpenses).limit(1)).length === 0) {
      for (const e of INITIAL_INDIRECT_EXPENSES) await upsertCostExpenseInDb(e);
    }
    if ((await activeDb.select().from(costCompositionSheets).limit(1)).length === 0) {
      for (const s of INITIAL_TECHNICAL_SHEETS) await upsertCostSheetInDb(s);
    }
    if ((await activeDb.select().from(costQuotes).limit(1)).length === 0) {
      for (const q of INITIAL_COST_QUOTES) await upsertCostQuoteInDb(q);
    }
    if ((await activeDb.select().from(costPricingAuditLogs).limit(1)).length === 0) {
      for (const l of INITIAL_COST_PRICING_AUDIT_LOGS) await insertCostPricingAuditLogInDb(l);
    }

    // 10. Stricker Integration
    if ((await activeDb.select().from(strickerConfig).limit(1)).length === 0) {
      await saveStrickerConfigInDb({
        environment: 'homologacao',
        apiUrl: 'https://ws.spotgifts.com.br/api/v1SSL/',
        sessionToken: null,
        tokenExpiresAt: null,
        autoSyncEnabled: true,
        syncIntervalHours: 12,
        lastSyncAt: null,
      });
    }
    if ((await activeDb.select().from(strickerProducts).limit(1)).length === 0) {
      for (const sp of INITIAL_STRICKER_PRODUCTS) await upsertStrickerProductInDb(sp);
    }
    if ((await activeDb.select().from(strickerCustomizationTables).limit(1)).length === 0) {
      for (const ct of INITIAL_STRICKER_CUSTOMIZATION_TABLES) await upsertStrickerCustomizationTableInDb(ct);
    }

    hasSeeded = true;
    console.log('[PostgreSQL Seed] Verificação e população inicial concluídas.');
  } finally {
    isSeeding = false;
  }
}

// ==========================================
// 1. PRODUCTS & CATEGORIES REPOSITORY
// ==========================================
export async function getProductsFromDb() {
  const activeDb = ensureDbReady();
  const rows = await activeDb.select().from(products).orderBy(desc(products.createdAt));
  return rows.map((r) => {
    const raw = (r.rawData as any) || {};
    return {
      ...raw,
      id: r.id,
      code: r.code,
      name: r.name,
      slug: r.slug,
      categoryId: r.categoryId,
      subcategoryId: r.subcategoryId || undefined,
      shortDescription: r.shortDescription || '',
      description: r.description || '',
      basePrice: r.basePrice,
      promoPrice: r.promoPrice ?? undefined,
      costPrice: r.costPrice ?? undefined,
      stockQty: r.stockQty,
      minOrderQty: r.minOrderQty,
      isActive: r.isActive,
      isFeatured: r.isFeatured ?? false,
      images: (r.images as string[]) || [],
      badge: r.badge ?? undefined,
      showPrice: r.showPrice ?? true,
      priceTiers: (r.priceTiers as any[]) || [],
      variants: (r.variants as any[]) || [],
      details: r.details || undefined,
      barcode: r.barcode ?? undefined,
      qrCode: r.qrCode ?? undefined,
      totalStockAvailable: r.totalStockAvailable ?? 0,
      totalNextQuantities: r.totalNextQuantities ?? 0,
      createdAt: r.createdAt?.toISOString() || new Date().toISOString(),
    };
  });
}

export async function upsertProductInDb(p: any) {
  const activeDb = ensureDbReady();
  await activeDb
    .insert(products)
    .values({
      id: p.id,
      code: p.code || '',
      name: p.name || '',
      slug: p.slug || '',
      categoryId: p.categoryId || 'cat-1',
      subcategoryId: p.subcategoryId || null,
      shortDescription: p.shortDescription || '',
      description: p.description || '',
      basePrice: Number(p.basePrice || 0),
      promoPrice: p.promoPrice !== undefined && p.promoPrice !== null ? Number(p.promoPrice) : null,
      costPrice: p.costPrice !== undefined && p.costPrice !== null ? Number(p.costPrice) : null,
      stockQty: Number(p.stockQty || 0),
      minOrderQty: Number(p.minOrderQty || 1),
      isActive: p.isActive !== undefined ? Boolean(p.isActive) : true,
      isFeatured: Boolean(p.isFeatured),
      images: p.images || [],
      badge: p.badge || null,
      showPrice: p.showPrice !== undefined ? Boolean(p.showPrice) : true,
      priceTiers: p.priceTiers || [],
      variants: p.variants || [],
      details: p.details || null,
      barcode: p.barcode || null,
      qrCode: p.qrCode || null,
      totalStockAvailable: p.totalStockAvailable ?? 0,
      totalNextQuantities: p.totalNextQuantities ?? 0,
      rawData: p,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: products.id,
      set: {
        code: p.code || '',
        name: p.name || '',
        slug: p.slug || '',
        categoryId: p.categoryId || 'cat-1',
        subcategoryId: p.subcategoryId || null,
        shortDescription: p.shortDescription || '',
        description: p.description || '',
        basePrice: Number(p.basePrice || 0),
        promoPrice: p.promoPrice !== undefined && p.promoPrice !== null ? Number(p.promoPrice) : null,
        costPrice: p.costPrice !== undefined && p.costPrice !== null ? Number(p.costPrice) : null,
        stockQty: Number(p.stockQty || 0),
        minOrderQty: Number(p.minOrderQty || 1),
        isActive: p.isActive !== undefined ? Boolean(p.isActive) : true,
        isFeatured: Boolean(p.isFeatured),
        images: p.images || [],
        badge: p.badge || null,
        showPrice: p.showPrice !== undefined ? Boolean(p.showPrice) : true,
        priceTiers: p.priceTiers || [],
        variants: p.variants || [],
        details: p.details || null,
        barcode: p.barcode || null,
        qrCode: p.qrCode || null,
        totalStockAvailable: p.totalStockAvailable ?? 0,
        totalNextQuantities: p.totalNextQuantities ?? 0,
        rawData: p,
        updatedAt: new Date(),
      },
    });
  return p;
}

export async function deleteProductFromDb(id: string) {
  const activeDb = ensureDbReady();
  await activeDb.delete(products).where(eq(products.id, id));
}

export async function getCategoriesFromDb() {
  const activeDb = ensureDbReady();
  const rows = await activeDb.select().from(categories).orderBy(categories.orderIndex);
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    description: r.description || '',
    image: r.image || '',
    icon: r.icon || '',
    order: r.orderIndex ?? 0,
    isActive: r.isActive ?? true,
  }));
}

export async function getSubcategoriesFromDb() {
  const activeDb = ensureDbReady();
  const rows = await activeDb.select().from(subcategories);
  return rows.map((r) => ({
    id: r.id,
    categoryId: r.categoryId,
    name: r.name,
    slug: r.slug,
    description: r.description || '',
    isActive: r.isActive ?? true,
  }));
}

export async function upsertCategoryInDb(c: any) {
  const activeDb = ensureDbReady();
  await activeDb
    .insert(categories)
    .values({
      id: c.id,
      name: c.name,
      slug: c.slug,
      description: c.description || '',
      image: c.image || '',
      icon: c.icon || '',
      orderIndex: c.order || 0,
      isActive: c.isActive !== undefined ? c.isActive : true,
    })
    .onConflictDoUpdate({
      target: categories.id,
      set: {
        name: c.name,
        slug: c.slug,
        description: c.description || '',
        image: c.image || '',
        icon: c.icon || '',
        orderIndex: c.order || 0,
        isActive: c.isActive !== undefined ? c.isActive : true,
      },
    });
  return c;
}

export async function hasCategoryProductsInDb(id: string): Promise<boolean> {
  const activeDb = ensureDbReady();
  const rows = await activeDb
    .select({ id: products.id })
    .from(products)
    .where(eq(products.categoryId, id))
    .limit(1);
  return rows.length > 0;
}

export async function deleteCategoryFromDb(id: string) {
  const activeDb = ensureDbReady();
  await activeDb.transaction(async (tx) => {
    await tx.delete(subcategories).where(eq(subcategories.categoryId, id));
    await tx.delete(categories).where(eq(categories.id, id));
  });
}

export async function upsertSubcategoryInDb(s: any) {
  const activeDb = ensureDbReady();
  await activeDb
    .insert(subcategories)
    .values({
      id: s.id,
      categoryId: s.categoryId,
      name: s.name,
      slug: s.slug,
      description: s.description || '',
      isActive: s.isActive !== undefined ? s.isActive : true,
    })
    .onConflictDoUpdate({
      target: subcategories.id,
      set: {
        categoryId: s.categoryId,
        name: s.name,
        slug: s.slug,
        description: s.description || '',
        isActive: s.isActive !== undefined ? s.isActive : true,
      },
    });
  return s;
}

export async function deleteSubcategoryFromDb(id: string) {
  const activeDb = ensureDbReady();
  await activeDb.delete(subcategories).where(eq(subcategories.id, id));
}

// ==========================================
// 2. ORDERS & QUOTES REPOSITORY (WITH ATOMIC TRANSACTIONS)
// ==========================================
export async function getOrdersFromDb() {
  const activeDb = ensureDbReady();
  const rows = await activeDb.select().from(orders).orderBy(desc(orders.createdAt));
  return rows.map((r) => ({
    id: r.id,
    code: r.code,
    clientId: r.clientId || undefined,
    clientName: r.clientName,
    clientEmail: r.clientEmail,
    clientPhone: r.clientPhone,
    clientCompany: r.clientCompany || undefined,
    shippingAddress: r.shippingAddress as any,
    items: (r.items as any[]) || [],
    subtotal: r.subtotal,
    discount: r.discount ?? 0,
    couponCode: r.couponCode || undefined,
    couponId: r.couponId || undefined,
    couponDiscount: r.couponDiscount ?? undefined,
    couponInfo: r.couponInfo as any,
    shippingCost: r.shippingCost ?? 0,
    shippingInfo: r.shippingInfo as any,
    total: r.total,
    paymentMethod: r.paymentMethod as any,
    paymentStatus: r.paymentStatus as any,
    orderStatus: r.orderStatus as any,
    trackingCode: r.trackingCode || undefined,
    sourceQuoteId: r.sourceQuoteId || undefined,
    billingTerms: r.billingTerms as any,
    notes: r.notes || undefined,
    boletos: (r.boletos as any[]) || undefined,
    createdAt: r.createdAt?.toISOString() || new Date().toISOString(),
  }));
}

export async function upsertOrderInDb(o: any) {
  const activeDb = ensureDbReady();
  await activeDb
    .insert(orders)
    .values({
      id: o.id,
      code: o.code,
      clientId: o.clientId || null,
      clientName: o.clientName,
      clientEmail: o.clientEmail,
      clientPhone: o.clientPhone || '',
      clientCompany: o.clientCompany || null,
      shippingAddress: o.shippingAddress || null,
      items: o.items || [],
      subtotal: Number(o.subtotal || 0),
      discount: Number(o.discount || 0),
      couponCode: o.couponCode || null,
      couponId: o.couponId || null,
      couponDiscount: o.couponDiscount !== undefined ? Number(o.couponDiscount) : null,
      couponInfo: o.couponInfo || null,
      shippingCost: Number(o.shippingCost || 0),
      shippingInfo: o.shippingInfo || null,
      total: Number(o.total || 0),
      paymentMethod: o.paymentMethod || 'pix',
      paymentStatus: o.paymentStatus || 'pendente',
      orderStatus: o.orderStatus || 'novo',
      trackingCode: o.trackingCode || null,
      sourceQuoteId: o.sourceQuoteId || null,
      billingTerms: o.billingTerms || null,
      notes: o.notes || null,
      boletos: o.boletos || null,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: orders.id,
      set: {
        orderStatus: o.orderStatus || 'novo',
        paymentStatus: o.paymentStatus || 'pendente',
        trackingCode: o.trackingCode || null,
        boletos: o.boletos || null,
        notes: o.notes || null,
        updatedAt: new Date(),
      },
    });
  return o;
}

/**
 * Checkout transacional atômico no PostgreSQL:
 * - Impede duplicação por id
 * - Deduz estoque dos produtos e variações com verificação atômica
 * - Grava movimentações de estoque
 * - Registra uso do cupom de forma idempotente e incrementa contadores
 * - Gera conta a receber e boletos no financeiro se aplicável
 */
export async function checkoutOrderAtomicInDb(params: {
  order: any;
  operatorName?: string;
  initialBoletos?: any[];
  initialFinancialAccount?: any;
}) {
  const activeDb = ensureDbReady();
  const { order, operatorName = 'Checkout Loja', initialBoletos = [], initialFinancialAccount } = params;

  return await activeDb.transaction(async (tx) => {
    const existing = await tx.select().from(orders).where(eq(orders.id, order.id)).limit(1);
    if (existing.length > 0) {
      return { order: existing[0], duplicated: true };
    }

    // 1. Deduct stock safely for each item belonging to catalog products
    const items = Array.isArray(order.items) ? order.items : [];
    for (const item of items) {
      const qty = Math.max(0, Number(item.quantity || 0));
      if (!item.productId || qty <= 0) continue;

      const prodRows = await tx.select().from(products).where(eq(products.id, item.productId)).limit(1);
      if (prodRows.length === 0) continue;
      const prod = prodRows[0];
      const previousStock = Number(prod.stockQty || 0);
      const nextStock = Math.max(0, previousStock - qty);

      let updatedVariants = Array.isArray(prod.variants) ? [...(prod.variants as any[])] : [];
      if (item.variantId) {
        updatedVariants = updatedVariants.map((v: any) =>
          v.id === item.variantId
            ? { ...v, stockQty: Math.max(0, Number(v.stockQty || 0) - qty) }
            : v
        );
      }

      const raw = (prod.rawData as any) || {};
      await tx
        .update(products)
        .set({
          stockQty: nextStock,
          variants: updatedVariants,
          rawData: { ...raw, stockQty: nextStock, variants: updatedVariants },
          updatedAt: new Date(),
        })
        .where(eq(products.id, prod.id));

      await tx.insert(stockMovements).values({
        id: `mov-ord-${order.id}-${prod.id}-${Math.random().toString(36).slice(2, 6)}`,
        productId: prod.id,
        productName: prod.name,
        variantId: item.variantId || null,
        variantColor: item.variantColor || null,
        type: 'saida',
        quantity: qty,
        previousStock,
        newStock: nextStock,
        reason: `Baixa automática Pedido ${order.code}`,
        operatorName,
        createdAtText: new Date().toISOString(),
      }).onConflictDoNothing();
    }

    // 2. Insert Order
    await tx.insert(orders).values({
      id: order.id,
      code: order.code,
      clientId: order.clientId || null,
      clientName: order.clientName,
      clientEmail: order.clientEmail,
      clientPhone: order.clientPhone || '',
      clientCompany: order.clientCompany || null,
      shippingAddress: order.shippingAddress || null,
      items: order.items || [],
      subtotal: Number(order.subtotal || 0),
      discount: Number(order.discount || 0),
      couponCode: order.couponCode || null,
      couponId: order.couponId || null,
      couponDiscount: order.couponDiscount !== undefined ? Number(order.couponDiscount) : null,
      couponInfo: order.couponInfo || null,
      shippingCost: Number(order.shippingCost || 0),
      shippingInfo: order.shippingInfo || null,
      total: Number(order.total || 0),
      paymentMethod: order.paymentMethod || 'pix',
      paymentStatus: order.paymentStatus || 'pendente',
      orderStatus: order.orderStatus || 'novo',
      trackingCode: order.trackingCode || null,
      sourceQuoteId: order.sourceQuoteId || null,
      billingTerms: order.billingTerms || null,
      notes: order.notes || null,
      boletos: order.boletos || initialBoletos || null,
      updatedAt: new Date(),
    });

    // 3. Idempotent Coupon Confirmation if coupon applied
    if (order.couponCode) {
      const cleanCode = String(order.couponCode).trim().toUpperCase();
      const couponRows = await tx
        .select()
        .from(discountCoupons)
        .where(eq(discountCoupons.code, cleanCode))
        .limit(1);
      if (couponRows.length > 0) {
        const coupon = couponRows[0];
        const existingUse = await tx
          .select()
          .from(couponUsages)
          .where(and(eq(couponUsages.orderId, order.id), eq(couponUsages.status, 'confirmed')))
          .limit(1);
        if (existingUse.length === 0) {
          const discApplied = Number(order.couponDiscount || order.discount || 0);
          await tx.insert(couponUsages).values({
            id: `cuse-${order.id}-${Date.now()}`,
            couponId: coupon.id,
            couponCode: coupon.code,
            orderId: order.id,
            orderCode: order.code,
            customerId: order.clientId || null,
            customerName: order.clientName,
            customerEmail: order.clientEmail,
            customerPhone: order.clientPhone || null,
            customerCpfCnpj: order.clientCpfCnpj || null,
            subtotal: Number(order.subtotal || 0),
            eligibleAmount: Number(order.subtotal || 0),
            discountApplied: discApplied,
            shippingCost: Number(order.shippingCost || 0),
            finalTotal: Number(order.total || 0),
            status: 'confirmed',
          });
          await tx
            .update(discountCoupons)
            .set({
              currentUses: (coupon.currentUses || 0) + 1,
              totalDiscountGranted: Number(((coupon.totalDiscountGranted || 0) + discApplied).toFixed(2)),
              totalSalesVolume: Number(((coupon.totalSalesVolume || 0) + Number(order.total || 0)).toFixed(2)),
              updatedAt: new Date(),
            })
            .where(eq(discountCoupons.id, coupon.id));
        }
      }
    }

    // 4. Persist initial Financial Account if provided
    if (initialFinancialAccount) {
      await tx
        .insert(financialAccounts)
        .values({
          id: initialFinancialAccount.id,
          type: initialFinancialAccount.type || 'receber',
          description: initialFinancialAccount.description,
          entityName: initialFinancialAccount.entityName,
          documentNumber: initialFinancialAccount.documentNumber || null,
          amount: Number(initialFinancialAccount.amount || 0),
          paidAmount: Number(initialFinancialAccount.paidAmount || 0),
          remainingAmount: Number(initialFinancialAccount.remainingAmount || 0),
          dueDate: initialFinancialAccount.dueDate,
          issueDate: initialFinancialAccount.issueDate,
          paymentDate: initialFinancialAccount.paymentDate || null,
          status: initialFinancialAccount.status || 'pendente',
          categoryId: initialFinancialAccount.categoryId || null,
          costCenterId: initialFinancialAccount.costCenterId || null,
          bankAccountId: initialFinancialAccount.bankAccountId || null,
          paymentMethodId: initialFinancialAccount.paymentMethodId || null,
          orderId: initialFinancialAccount.orderId || order.id,
          quoteId: initialFinancialAccount.quoteId || null,
          notes: initialFinancialAccount.notes || null,
          installments: initialFinancialAccount.installments || null,
          rawData: initialFinancialAccount,
          updatedAt: new Date(),
        })
        .onConflictDoNothing();
    }

    // 5. Persist initial Boletos if provided
    for (const b of initialBoletos) {
      await tx
        .insert(boletos)
        .values({
          id: b.id,
          nossoNumero: b.nossoNumero,
          numeroDocumento: b.numeroDocumento,
          orderId: b.orderId || order.id,
          quoteId: b.quoteId || null,
          financialAccountId: b.financialAccountId || initialFinancialAccount?.id || null,
          tipoCobranca: b.tipoCobranca || 'a_vista',
          status: b.status || 'emitido',
          valor: Number(b.valor || 0),
          dataVencimento: b.dataVencimento,
          dataEmissao: b.dataEmissao,
          dataPagamento: b.dataPagamento || null,
          linhaDigitavel: b.linhaDigitavel,
          codigoBarras: b.codigoBarras,
          bancoCodigo: b.bancoCodigo,
          bancoNome: b.bancoNome,
          sacadoNome: b.sacadoNome,
          sacadoDocumento: b.sacadoDocumento,
          parcelaAtual: b.parcelaAtual || null,
          totalParcelas: b.totalParcelas || null,
          rawData: b,
        })
        .onConflictDoNothing();
    }

    return { order, duplicated: false };
  });
}

export async function getQuotesFromDb() {
  const activeDb = ensureDbReady();
  const rows = await activeDb.select().from(quotes).orderBy(desc(quotes.createdAt));
  return rows.map((r) => ({
    id: r.id,
    code: r.code,
    clientId: r.clientId || undefined,
    clientName: r.clientName,
    clientEmail: r.clientEmail,
    clientPhone: r.clientPhone,
    clientCompany: r.clientCompany || undefined,
    items: (r.items as any[]) || [],
    subtotal: r.subtotal,
    discount: r.discount ?? 0,
    total: r.total,
    notes: r.notes || undefined,
    status: r.status as any,
    adminNotes: r.adminNotes || undefined,
    respondedAt: r.respondedAt || undefined,
    respondedBy: r.respondedBy || undefined,
    billingTerms: r.billingTerms as any,
    validityDate: r.validityDate || undefined,
    createdAt: r.createdAt?.toISOString() || new Date().toISOString(),
  }));
}

export async function upsertQuoteInDb(q: any) {
  const activeDb = ensureDbReady();
  await activeDb
    .insert(quotes)
    .values({
      id: q.id,
      code: q.code,
      clientId: q.clientId || null,
      clientName: q.clientName,
      clientEmail: q.clientEmail,
      clientPhone: q.clientPhone || '',
      clientCompany: q.clientCompany || null,
      items: q.items || [],
      subtotal: Number(q.subtotal || 0),
      discount: Number(q.discount || 0),
      total: Number(q.total || 0),
      notes: q.notes || null,
      status: q.status || 'pendente',
      adminNotes: q.adminNotes || null,
      respondedAt: q.respondedAt || null,
      respondedBy: q.respondedBy || null,
      billingTerms: q.billingTerms || null,
      validityDate: q.validityDate || null,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: quotes.id,
      set: {
        items: q.items || [],
        subtotal: Number(q.subtotal || 0),
        discount: Number(q.discount || 0),
        total: Number(q.total || 0),
        status: q.status || 'pendente',
        adminNotes: q.adminNotes || null,
        respondedAt: q.respondedAt || null,
        respondedBy: q.respondedBy || null,
        billingTerms: q.billingTerms || null,
        validityDate: q.validityDate || null,
        updatedAt: new Date(),
      },
    });
  return q;
}

// ==========================================
// 3. USERS & SESSIONS REPOSITORY
// ==========================================
function mapUserRow(r: any) {
  return {
    id: r.uid,
    name: r.name,
    email: r.email,
    phone: r.phone || '',
    company: r.company || '',
    cpfCnpj: r.cpfCnpj || '',
    stateRegistration: r.stateRegistration || undefined,
    role: r.role as any,
    status: r.isActive === false ? ('inativo' as const) : ('ativo' as const),
    address: r.address as any,
    customPermissions: r.customPermissions as any,
    favoriteProductIds: (r.favoriteProductIds as string[]) || [],
    lastLogin: r.lastLogin || undefined,
    createdAt: r.createdAt?.toISOString() || new Date().toISOString(),
  };
}

export async function getUsersFromDb() {
  const activeDb = ensureDbReady();
  const rows = await activeDb.select().from(users);
  return rows.map(mapUserRow);
}

export async function getUserByUidFromDb(uid: string) {
  const activeDb = ensureDbReady();
  const rows = await activeDb.select().from(users).where(eq(users.uid, uid)).limit(1);
  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    ...mapUserRow(r),
    passwordHash: r.passwordHash || null,
  };
}

export async function getUserByEmailFromDb(email: string) {
  const activeDb = ensureDbReady();
  const normalized = email.trim().toLowerCase();
  const rows = await activeDb.select().from(users);
  const matched = rows.find((u) => (u.email || '').trim().toLowerCase() === normalized);
  if (!matched) return null;
  return {
    ...mapUserRow(matched),
    passwordHash: matched.passwordHash || null,
  };
}

export async function getUserByCpfCnpjFromDb(cpfCnpj: string) {
  const activeDb = ensureDbReady();
  const cleanDigits = cpfCnpj.replace(/\D/g, '');
  if (!cleanDigits) return null;
  const rows = await activeDb.select().from(users);
  const matched = rows.find((u) => (u.cpfCnpj || '').replace(/\D/g, '') === cleanDigits);
  if (!matched) return null;
  return mapUserRow(matched);
}

export async function upsertUserInDb(u: any) {
  const activeDb = ensureDbReady();
  const uid = String(u.uid || u.id || '');
  const updateSet: Record<string, any> = {
    name: u.name,
    email: (u.email || '').trim().toLowerCase(),
    phone: u.phone || '',
    company: u.company || '',
    cpfCnpj: u.cpfCnpj || '',
    stateRegistration: u.stateRegistration || '',
    role: u.role || 'cliente',
    address: u.address || null,
    customPermissions: u.customPermissions || null,
    favoriteProductIds: u.favoriteProductIds || [],
    isActive: u.status !== 'inativo',
    lastLogin: u.lastLogin || null,
    updatedAt: new Date(),
  };
  if (u.passwordHash) {
    updateSet.passwordHash = u.passwordHash;
  }

  await activeDb
    .insert(users)
    .values({
      uid,
      name: u.name,
      email: (u.email || '').trim().toLowerCase(),
      phone: u.phone || '',
      company: u.company || '',
      cpfCnpj: u.cpfCnpj || '',
      stateRegistration: u.stateRegistration || '',
      role: u.role || 'cliente',
      passwordHash: u.passwordHash || null,
      address: u.address || null,
      customPermissions: u.customPermissions || null,
      favoriteProductIds: u.favoriteProductIds || [],
      isActive: u.status !== 'inativo',
      lastLogin: u.lastLogin || null,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: users.uid,
      set: updateSet,
    });

  const savedRows = await activeDb.select().from(users).where(eq(users.uid, uid)).limit(1);
  return savedRows.map(mapUserRow);
}

export async function updateUserLastLoginInDb(uid: string) {
  const activeDb = ensureDbReady();
  const nowStr = new Date().toISOString();
  await activeDb
    .update(users)
    .set({ lastLogin: nowStr, updatedAt: new Date() })
    .where(eq(users.uid, uid));
}

export async function createAuthSessionInDb(session: {
  tokenHash: string;
  userUid: string;
  role: string;
  expiresAt: Date;
  userAgent?: string;
  ip?: string;
}) {
  const activeDb = ensureDbReady();
  await activeDb
    .insert(authSessions)
    .values({
      tokenHash: session.tokenHash,
      userUid: session.userUid,
      role: session.role,
      expiresAt: session.expiresAt,
      userAgent: session.userAgent || '',
      ip: session.ip || '',
    })
    .onConflictDoUpdate({
      target: authSessions.tokenHash,
      set: {
        expiresAt: session.expiresAt,
        role: session.role,
      },
    });
}

export async function getAuthSessionWithUserFromDb(tokenHash: string) {
  const activeDb = ensureDbReady();
  const now = new Date();
  const sessionRows = await activeDb
    .select()
    .from(authSessions)
    .where(and(eq(authSessions.tokenHash, tokenHash), gt(authSessions.expiresAt, now)))
    .limit(1);

  if (sessionRows.length === 0) return null;
  const session = sessionRows[0];
  const user = await getUserByUidFromDb(session.userUid);
  if (!user) return null;
  return { session, user };
}

export async function deleteAuthSessionByTokenHashFromDb(tokenHash: string) {
  const activeDb = ensureDbReady();
  await activeDb.delete(authSessions).where(eq(authSessions.tokenHash, tokenHash));
}

export async function deleteAllSessionsForUserFromDb(userUid: string) {
  const activeDb = ensureDbReady();
  await activeDb.delete(authSessions).where(eq(authSessions.userUid, userUid));
}

// ==========================================
// 4. COUPONS REPOSITORY (FULL CRUD + SEND HISTORY + AUDIT + TRANSACTIONAL USAGE)
// ==========================================
function mapCouponRow(r: any) {
  return {
    id: r.id,
    code: r.code,
    campaignName: r.campaignName,
    discountType: r.discountType as any,
    discountValue: r.discountValue,
    startDate: r.startDate,
    endDate: r.endDate,
    minPurchaseAmount: r.minPurchaseAmount ?? undefined,
    maxDiscountAmount: r.maxDiscountAmount ?? undefined,
    maxUsageTotal: r.maxUses || undefined,
    currentUsageCount: r.currentUses ?? 0,
    maxUsagePerCustomer: r.limitPerCustomer ?? 1,
    targetType: (r.applicableType || 'all_store') as any,
    targetProductIds: (r.allowedProductIds as string[]) || [],
    targetCategoryIds: (r.allowedCategoryIds as string[]) || [],
    customerRestriction: (r.customerRestriction || 'general') as any,
    specificCustomerIds: (r.allowedCustomerIds as string[]) || [],
    specificCustomerEmails: (r.specificCustomerEmails as string[]) || [],
    canCombineWithPromotions: r.allowCumulative !== undefined ? r.allowCumulative : true,
    status: r.status as any,
    internalNotes: r.internalNotes || undefined,
    totalDiscountGranted: r.totalDiscountGranted ?? 0,
    totalSalesVolume: r.totalSalesVolume ?? 0,
    sentCount: r.sentCount ?? 0,
    createdByUserId: r.createdByUserId || '',
    createdByUserName: r.createdBy || '',
    createdAt: r.createdAt?.toISOString() || new Date().toISOString(),
    updatedAt: r.updatedAt?.toISOString(),
  };
}

export async function getCouponsFromDb() {
  const activeDb = ensureDbReady();
  const rows = await activeDb.select().from(discountCoupons).orderBy(desc(discountCoupons.createdAt));
  return rows.map(mapCouponRow);
}

export async function getCouponByIdFromDb(id: string) {
  const activeDb = ensureDbReady();
  const rows = await activeDb.select().from(discountCoupons).where(eq(discountCoupons.id, id)).limit(1);
  return rows.length ? mapCouponRow(rows[0]) : null;
}

export async function getCouponByCodeFromDb(code: string) {
  const activeDb = ensureDbReady();
  const clean = code.trim().toUpperCase();
  const rows = await activeDb.select().from(discountCoupons).where(eq(discountCoupons.code, clean)).limit(1);
  return rows.length ? mapCouponRow(rows[0]) : null;
}

export async function upsertCouponInDb(c: any) {
  const activeDb = ensureDbReady();
  const cleanCode = (c.code || '').trim().toUpperCase();
  await activeDb
    .insert(discountCoupons)
    .values({
      id: c.id,
      code: cleanCode,
      campaignName: c.campaignName || cleanCode,
      discountType: c.discountType || 'percentage',
      discountValue: Number(c.discountValue || 0),
      startDate: c.startDate || new Date().toISOString(),
      endDate: c.endDate || new Date(Date.now() + 30 * 86400000).toISOString(),
      minPurchaseAmount: c.minPurchaseAmount ?? null,
      maxDiscountAmount: c.maxDiscountAmount ?? null,
      maxUses: c.maxUsageTotal ?? c.maxUses ?? 0,
      currentUses: c.currentUsageCount ?? c.currentUses ?? 0,
      limitPerCustomer: c.maxUsagePerCustomer ?? c.limitPerCustomer ?? 1,
      applicableType: c.targetType || c.applicableType || 'all_store',
      allowedProductIds: c.targetProductIds || c.allowedProductIds || [],
      allowedCategoryIds: c.targetCategoryIds || c.allowedCategoryIds || [],
      allowedCustomerIds: c.specificCustomerIds || c.allowedCustomerIds || [],
      customerRestriction: c.customerRestriction || 'general',
      specificCustomerEmails: c.specificCustomerEmails || [],
      allowCumulative: c.canCombineWithPromotions ?? c.allowCumulative ?? true,
      totalDiscountGranted: Number(c.totalDiscountGranted || 0),
      totalSalesVolume: Number(c.totalSalesVolume || 0),
      sentCount: Number(c.sentCount || 0),
      status: c.status || 'active',
      internalNotes: c.internalNotes || null,
      createdBy: c.createdByUserName || c.createdBy || null,
      createdByUserId: c.createdByUserId || null,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: discountCoupons.id,
      set: {
        code: cleanCode,
        campaignName: c.campaignName || cleanCode,
        discountType: c.discountType || 'percentage',
        discountValue: Number(c.discountValue || 0),
        startDate: c.startDate,
        endDate: c.endDate,
        minPurchaseAmount: c.minPurchaseAmount ?? null,
        maxDiscountAmount: c.maxDiscountAmount ?? null,
        maxUses: c.maxUsageTotal ?? c.maxUses ?? 0,
        currentUses: c.currentUsageCount ?? c.currentUses ?? 0,
        limitPerCustomer: c.maxUsagePerCustomer ?? c.limitPerCustomer ?? 1,
        applicableType: c.targetType || c.applicableType || 'all_store',
        allowedProductIds: c.targetProductIds || c.allowedProductIds || [],
        allowedCategoryIds: c.targetCategoryIds || c.allowedCategoryIds || [],
        allowedCustomerIds: c.specificCustomerIds || c.allowedCustomerIds || [],
        customerRestriction: c.customerRestriction || 'general',
        specificCustomerEmails: c.specificCustomerEmails || [],
        allowCumulative: c.canCombineWithPromotions ?? c.allowCumulative ?? true,
        totalDiscountGranted: Number(c.totalDiscountGranted || 0),
        totalSalesVolume: Number(c.totalSalesVolume || 0),
        sentCount: Number(c.sentCount || 0),
        status: c.status || 'active',
        internalNotes: c.internalNotes || null,
        updatedAt: new Date(),
      },
    });
  return (await getCouponByIdFromDb(c.id)) || c;
}

export async function deleteCouponFromDb(id: string) {
  const activeDb = ensureDbReady();
  await activeDb.delete(discountCoupons).where(eq(discountCoupons.id, id));
}

export async function getCouponUsagesFromDb(couponId?: string) {
  const activeDb = ensureDbReady();
  const rows = couponId
    ? await activeDb.select().from(couponUsages).where(eq(couponUsages.couponId, couponId)).orderBy(desc(couponUsages.usedAt))
    : await activeDb.select().from(couponUsages).orderBy(desc(couponUsages.usedAt));
  return rows.map((r) => ({
    id: r.id,
    couponId: r.couponId,
    couponCode: r.couponCode,
    orderId: r.orderId,
    orderCode: r.orderCode,
    customerId: r.customerId || undefined,
    customerName: r.customerName || 'Cliente',
    customerEmail: r.customerEmail || '',
    customerPhone: r.customerPhone || undefined,
    customerCpfCnpj: r.customerCpfCnpj || undefined,
    subtotalOriginal: r.subtotal,
    eligibleAmount: r.eligibleAmount ?? r.subtotal,
    discountApplied: r.discountApplied,
    shippingCost: r.shippingCost ?? 0,
    finalTotal: r.finalTotal ?? Math.max(0, r.subtotal - r.discountApplied),
    usedAt: r.usedAt?.toISOString() || new Date().toISOString(),
    status: (r.status || 'confirmed') as 'confirmed' | 'cancelled',
    cancelledAt: r.cancelledAt || undefined,
    cancelReason: r.cancelReason || undefined,
  }));
}

export async function insertCouponUsageInDb(u: any) {
  const activeDb = ensureDbReady();
  await activeDb
    .insert(couponUsages)
    .values({
      id: u.id,
      couponId: u.couponId,
      couponCode: u.couponCode,
      orderId: u.orderId,
      orderCode: u.orderCode,
      customerId: u.customerId || null,
      customerName: u.customerName || 'Cliente',
      customerEmail: u.customerEmail || null,
      customerPhone: u.customerPhone || null,
      customerCpfCnpj: u.customerCpfCnpj || null,
      subtotal: Number(u.subtotalOriginal ?? u.subtotal ?? 0),
      eligibleAmount: Number(u.eligibleAmount ?? u.subtotalOriginal ?? 0),
      discountApplied: Number(u.discountApplied || 0),
      shippingCost: Number(u.shippingCost || 0),
      finalTotal: Number(u.finalTotal || 0),
      status: u.status || 'confirmed',
      cancelledAt: u.cancelledAt || null,
      cancelReason: u.cancelReason || null,
      usedAt: u.usedAt ? new Date(u.usedAt) : new Date(),
    })
    .onConflictDoNothing();
}

export async function confirmCouponUsageAtomicInDb(params: {
  couponCode: string;
  usage: any;
  auditLog: any;
}) {
  const activeDb = ensureDbReady();
  return await activeDb.transaction(async (tx) => {
    const clean = params.couponCode.trim().toUpperCase();
    const rows = await tx.select().from(discountCoupons).where(eq(discountCoupons.code, clean)).limit(1);
    if (rows.length === 0) {
      return { notFound: true };
    }
    const coupon = rows[0];
    const existing = await tx
      .select()
      .from(couponUsages)
      .where(and(eq(couponUsages.orderId, params.usage.orderId), eq(couponUsages.status, 'confirmed')))
      .limit(1);
    if (existing.length > 0) {
      return { alreadyConfirmed: true, usage: existing[0] };
    }
    const u = { ...params.usage, couponId: coupon.id, couponCode: coupon.code };
    await tx.insert(couponUsages).values({
      id: u.id,
      couponId: u.couponId,
      couponCode: u.couponCode,
      orderId: u.orderId,
      orderCode: u.orderCode,
      customerId: u.customerId || null,
      customerName: u.customerName || 'Cliente Online',
      customerEmail: u.customerEmail || null,
      customerPhone: u.customerPhone || null,
      customerCpfCnpj: u.customerCpfCnpj || null,
      subtotal: Number(u.subtotalOriginal || 0),
      eligibleAmount: Number(u.eligibleAmount || 0),
      discountApplied: Number(u.discountApplied || 0),
      shippingCost: Number(u.shippingCost || 0),
      finalTotal: Number(u.finalTotal || 0),
      status: 'confirmed',
    });
    await tx
      .update(discountCoupons)
      .set({
        currentUses: (coupon.currentUses || 0) + 1,
        totalDiscountGranted: Number(((coupon.totalDiscountGranted || 0) + Number(u.discountApplied || 0)).toFixed(2)),
        totalSalesVolume: Number(((coupon.totalSalesVolume || 0) + Number(u.finalTotal || 0)).toFixed(2)),
        updatedAt: new Date(),
      })
      .where(eq(discountCoupons.id, coupon.id));
    await tx.insert(couponLogs).values({
      id: params.auditLog.id,
      couponId: coupon.id,
      couponCode: coupon.code,
      action: params.auditLog.action,
      performedBy: params.auditLog.userName,
      userId: params.auditLog.userId,
      userRole: params.auditLog.userRole,
      details: { message: params.auditLog.details },
    });
    return { alreadyConfirmed: false, usage: u };
  });
}

export async function releaseCouponUsageAtomicInDb(params: {
  orderId: string;
  reason?: string;
  auditLog: any;
}) {
  const activeDb = ensureDbReady();
  return await activeDb.transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(couponUsages)
      .where(and(eq(couponUsages.orderId, params.orderId), eq(couponUsages.status, 'confirmed')))
      .limit(1);
    if (rows.length === 0) return { notFound: true };
    const u = rows[0];
    await tx
      .update(couponUsages)
      .set({
        status: 'cancelled',
        cancelledAt: new Date().toISOString(),
        cancelReason: params.reason || 'Cancelamento de pedido',
      })
      .where(eq(couponUsages.id, u.id));

    const couponRows = await tx.select().from(discountCoupons).where(eq(discountCoupons.id, u.couponId)).limit(1);
    if (couponRows.length > 0) {
      const c = couponRows[0];
      await tx
        .update(discountCoupons)
        .set({
          currentUses: Math.max(0, (c.currentUses || 1) - 1),
          totalDiscountGranted: Math.max(0, Number(((c.totalDiscountGranted || 0) - Number(u.discountApplied || 0)).toFixed(2))),
          totalSalesVolume: Math.max(0, Number(((c.totalSalesVolume || 0) - Number(u.finalTotal || 0)).toFixed(2))),
          updatedAt: new Date(),
        })
        .where(eq(discountCoupons.id, c.id));
    }

    await tx.insert(couponLogs).values({
      id: params.auditLog.id,
      couponId: u.couponId,
      couponCode: u.couponCode,
      action: 'revert_cancel',
      performedBy: params.auditLog.userName,
      userId: params.auditLog.userId,
      userRole: params.auditLog.userRole,
      details: { message: params.auditLog.details },
    });
    return { notFound: false, usage: u };
  });
}

export async function getCouponSendHistoryFromDb(couponId?: string) {
  const activeDb = ensureDbReady();
  const rows = couponId
    ? await activeDb.select().from(couponSendHistory).where(eq(couponSendHistory.couponId, couponId)).orderBy(desc(couponSendHistory.createdAt))
    : await activeDb.select().from(couponSendHistory).orderBy(desc(couponSendHistory.createdAt));
  return rows.map((r) => ({
    id: r.id,
    couponId: r.couponId,
    couponCode: r.couponCode,
    customerId: r.customerId || undefined,
    customerName: r.customerName,
    customerPhone: r.customerPhone || undefined,
    customerEmail: r.customerEmail || undefined,
    channel: r.channel as any,
    sentAt: r.sentAt,
    sentByUserId: r.sentByUserId,
    sentByUserName: r.sentByUserName,
    messagePreview: r.messagePreview,
    status: r.status as any,
  }));
}

export async function insertCouponSendHistoryInDb(s: any) {
  const activeDb = ensureDbReady();
  await activeDb
    .insert(couponSendHistory)
    .values({
      id: s.id,
      couponId: s.couponId,
      couponCode: s.couponCode,
      customerId: s.customerId || null,
      customerName: s.customerName,
      customerPhone: s.customerPhone || null,
      customerEmail: s.customerEmail || null,
      channel: s.channel || 'clipboard',
      sentAt: s.sentAt || new Date().toISOString(),
      sentByUserId: s.sentByUserId,
      sentByUserName: s.sentByUserName,
      messagePreview: s.messagePreview,
      status: s.status || 'copied',
    })
    .onConflictDoNothing();
}

export async function getCouponAuditLogsFromDb() {
  const activeDb = ensureDbReady();
  const rows = await activeDb.select().from(couponLogs).orderBy(desc(couponLogs.timestamp)).limit(500);
  return rows.map((r) => ({
    id: r.id,
    couponId: r.couponId,
    couponCode: r.couponCode || undefined,
    action: r.action as any,
    userId: r.userId || '',
    userName: r.performedBy,
    userRole: r.userRole || 'admin',
    details: typeof (r.details as any)?.message === 'string' ? (r.details as any).message : JSON.stringify(r.details || ''),
    timestamp: r.timestamp?.toISOString() || new Date().toISOString(),
  }));
}

export async function insertCouponAuditLogInDb(l: any) {
  const activeDb = ensureDbReady();
  await activeDb
    .insert(couponLogs)
    .values({
      id: l.id,
      couponId: l.couponId || 'system',
      couponCode: l.couponCode || null,
      action: l.action,
      performedBy: l.userName || l.performedBy || 'Sistema',
      userId: l.userId || null,
      userRole: l.userRole || 'admin',
      details: typeof l.details === 'string' ? { message: l.details } : l.details || {},
      timestamp: l.timestamp ? new Date(l.timestamp) : new Date(),
    })
    .onConflictDoNothing();
}

// ==========================================
// 5. SYSTEM SETTINGS & BACKUPS REPOSITORY
// ==========================================
export async function getSystemSettingsFromDb<T>(key: string): Promise<T | null> {
  const activeDb = ensureDbReady();
  const rows = await activeDb.select().from(systemSettings).where(eq(systemSettings.key, key)).limit(1);
  if (rows.length === 0) return null;
  return rows[0].value as T;
}

export async function getAllSystemSettingsFromDb(): Promise<Record<string, any>> {
  const activeDb = ensureDbReady();
  const rows = await activeDb.select().from(systemSettings);
  const result: Record<string, any> = {};
  for (const row of rows) {
    result[row.key] = row.value;
  }
  return result;
}

export async function getPermissionsMatrixFromDb() {
  const saved = await getSystemSettingsFromDb<any>('permissions');
  return saved || INITIAL_PERMISSIONS_MATRIX;
}

export async function getPriceVisibilityFromDb(): Promise<'all' | 'registered_only'> {
  const saved = await getSystemSettingsFromDb<any>('price_visibility');
  const rawMode = typeof saved === 'string' ? saved : saved?.mode;
  return rawMode === 'all' || rawMode === 'public' ? 'all' : 'registered_only';
}

export async function savePriceVisibilityToDb(
  mode: 'all' | 'registered_only',
  updatedBy = 'Sistema'
): Promise<{ mode: 'all' | 'registered_only'; updatedAt: string; updatedBy: string }> {
  const normalized: 'all' | 'registered_only' = mode === 'all' ? 'all' : 'registered_only';
  const payload = {
    mode: normalized,
    updatedAt: new Date().toISOString(),
    updatedBy,
  };
  await saveSystemSettingsToDb('price_visibility', payload);
  return payload;
}

export async function saveSystemSettingsToDb(key: string, value: any) {
  const activeDb = ensureDbReady();
  await activeDb
    .insert(systemSettings)
    .values({ key, value, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: systemSettings.key,
      set: { value, updatedAt: new Date() },
    });
  return value;
}

export async function getBackupsFromDb(includePayload = false) {
  const activeDb = ensureDbReady();
  const rows = await activeDb.select().from(backups).orderBy(desc(backups.createdAt)).limit(100);
  return rows.map((r) => ({
    id: r.id,
    filename: r.filename,
    sizeBytes: r.sizeBytes,
    sizeFormatted: r.sizeFormatted,
    checksum: r.checksum,
    trigger: r.trigger as any,
    status: r.status as any,
    counts: r.counts as any,
    ...(includePayload ? { payload: r.payload } : {}),
    timestamp: r.createdAt?.toISOString() || new Date().toISOString(),
  }));
}

export async function getBackupByIdFromDb(id: string) {
  const activeDb = ensureDbReady();
  const rows = await activeDb.select().from(backups).where(eq(backups.id, id)).limit(1);
  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    id: r.id,
    filename: r.filename,
    sizeBytes: r.sizeBytes,
    sizeFormatted: r.sizeFormatted,
    checksum: r.checksum,
    trigger: r.trigger as any,
    status: r.status as any,
    counts: r.counts as any,
    payload: r.payload,
    timestamp: r.createdAt?.toISOString() || new Date().toISOString(),
  };
}

export async function deleteBackupFromDb(id: string) {
  const activeDb = ensureDbReady();
  await activeDb.delete(backups).where(eq(backups.id, id));
}

export async function recordBackupInDb(b: any) {
  const activeDb = ensureDbReady();
  await activeDb
    .insert(backups)
    .values({
      id: b.id,
      filename: b.filename,
      sizeBytes: b.sizeBytes,
      sizeFormatted: b.sizeFormatted,
      checksum: b.checksum,
      trigger: b.trigger,
      status: b.status || 'success',
      counts: b.counts || null,
      payload: b.payload || null,
    })
    .onConflictDoNothing();
  return b;
}

export async function enforceBackupRetentionInDb(retentionCount: number) {
  const activeDb = ensureDbReady();
  const rows = await activeDb.select({ id: backups.id }).from(backups).orderBy(desc(backups.createdAt));
  if (rows.length > retentionCount) {
    for (const extra of rows.slice(retentionCount)) {
      await activeDb.delete(backups).where(eq(backups.id, extra.id));
    }
  }
}

// ==========================================
// 6. STOCK MOVEMENTS REPOSITORY
// ==========================================
export async function getStockMovementsFromDb() {
  const activeDb = ensureDbReady();
  const rows = await activeDb.select().from(stockMovements).orderBy(desc(stockMovements.createdAt));
  return rows.map((r) => ({
    id: r.id,
    productId: r.productId,
    productName: r.productName,
    variantId: r.variantId || undefined,
    variantColor: r.variantColor || undefined,
    type: r.type as any,
    quantity: r.quantity,
    previousStock: r.previousStock,
    newStock: r.newStock,
    reason: r.reason || '',
    operatorName: r.operatorName || 'Sistema',
    createdAt: r.createdAtText || r.createdAt?.toISOString() || new Date().toISOString(),
  }));
}

export async function upsertStockMovementInDb(m: any) {
  const activeDb = ensureDbReady();
  await activeDb
    .insert(stockMovements)
    .values({
      id: m.id,
      productId: m.productId,
      productName: m.productName || '',
      variantId: m.variantId || null,
      variantColor: m.variantColor || null,
      type: m.type || 'ajuste',
      quantity: Number(m.quantity || 0),
      previousStock: Number(m.previousStock || 0),
      newStock: Number(m.newStock || 0),
      reason: m.reason || '',
      operatorName: m.operatorName || 'Sistema',
      createdAtText: m.createdAt || new Date().toISOString(),
    })
    .onConflictDoUpdate({
      target: stockMovements.id,
      set: {
        quantity: Number(m.quantity || 0),
        previousStock: Number(m.previousStock || 0),
        newStock: Number(m.newStock || 0),
        reason: m.reason || '',
      },
    });
  return m;
}

// ==========================================
// 7. BOLETOS REPOSITORY (WITH TRANSACTIONAL SETTLE / CANCEL)
// ==========================================
export async function getBoletosFromDb() {
  const activeDb = ensureDbReady();
  const rows = await activeDb.select().from(boletos).orderBy(desc(boletos.createdAt));
  return rows.map((r) => {
    const raw = (r.rawData as any) || {};
    return {
      ...raw,
      id: r.id,
      nossoNumero: r.nossoNumero,
      numeroDocumento: r.numeroDocumento,
      orderId: r.orderId,
      quoteId: r.quoteId || undefined,
      financialAccountId: r.financialAccountId || undefined,
      tipoCobranca: r.tipoCobranca as any,
      status: r.status as any,
      valor: r.valor,
      dataVencimento: r.dataVencimento,
      dataEmissao: r.dataEmissao,
      dataPagamento: r.dataPagamento || undefined,
      linhaDigitavel: r.linhaDigitavel,
      codigoBarras: r.codigoBarras,
      bancoCodigo: r.bancoCodigo,
      bancoNome: r.bancoNome,
      sacadoNome: r.sacadoNome,
      sacadoDocumento: r.sacadoDocumento,
      parcelaAtual: r.parcelaAtual ?? undefined,
      totalParcelas: r.totalParcelas ?? undefined,
    };
  });
}

export async function upsertBoletoInDb(b: any) {
  const activeDb = ensureDbReady();
  await activeDb
    .insert(boletos)
    .values({
      id: b.id,
      nossoNumero: b.nossoNumero || '',
      numeroDocumento: b.numeroDocumento || '',
      orderId: b.orderId || '',
      quoteId: b.quoteId || null,
      financialAccountId: b.financialAccountId || null,
      tipoCobranca: b.tipoCobranca || 'a_vista',
      status: b.status || 'emitido',
      valor: Number(b.valor || 0),
      dataVencimento: b.dataVencimento || '',
      dataEmissao: b.dataEmissao || '',
      dataPagamento: b.dataPagamento || null,
      linhaDigitavel: b.linhaDigitavel || '',
      codigoBarras: b.codigoBarras || '',
      bancoCodigo: b.bancoCodigo || '',
      bancoNome: b.bancoNome || '',
      sacadoNome: b.sacadoNome || '',
      sacadoDocumento: b.sacadoDocumento || '',
      parcelaAtual: b.parcelaAtual ?? null,
      totalParcelas: b.totalParcelas ?? null,
      rawData: b,
    })
    .onConflictDoUpdate({
      target: boletos.id,
      set: {
        status: b.status || 'emitido',
        dataPagamento: b.dataPagamento || null,
        financialAccountId: b.financialAccountId || null,
        rawData: b,
      },
    });
  return b;
}

export async function settleBoletoAtomicInDb(params: {
  boletoId: string;
  paidDate?: string;
  bankAccountId?: string;
  operatorName: string;
}) {
  const activeDb = ensureDbReady();
  return await activeDb.transaction(async (tx) => {
    const bRows = await tx.select().from(boletos).where(eq(boletos.id, params.boletoId)).limit(1);
    if (bRows.length === 0) return { notFound: true };
    const b = bRows[0];
    if (b.status === 'pago') {
      return { alreadyPaid: true, boleto: b };
    }
    const paymentDate = params.paidDate || new Date().toISOString();
    const raw = (b.rawData as any) || {};
    const updatedRaw = { ...raw, status: 'pago', dataPagamento: paymentDate };

    await tx
      .update(boletos)
      .set({ status: 'pago', dataPagamento: paymentDate, rawData: updatedRaw })
      .where(eq(boletos.id, b.id));

    // Sync linked financial account if present
    if (b.financialAccountId) {
      const faRows = await tx.select().from(financialAccounts).where(eq(financialAccounts.id, b.financialAccountId)).limit(1);
      if (faRows.length > 0 && faRows[0].status !== 'pago') {
        const fa = faRows[0];
        await tx
          .update(financialAccounts)
          .set({
            status: 'pago',
            paidAmount: fa.amount,
            remainingAmount: 0,
            paymentDate,
            bankAccountId: params.bankAccountId || fa.bankAccountId,
            updatedAt: new Date(),
          })
          .where(eq(financialAccounts.id, fa.id));
      }
    }

    // Update bank balance if bankAccountId provided
    if (params.bankAccountId) {
      const baRows = await tx.select().from(bankAccounts).where(eq(bankAccounts.id, params.bankAccountId)).limit(1);
      if (baRows.length > 0) {
        const ba = baRows[0];
        await tx
          .update(bankAccounts)
          .set({
            currentBalance: Number((ba.currentBalance + Number(b.valor || 0)).toFixed(2)),
            updatedAt: new Date(),
          })
          .where(eq(bankAccounts.id, ba.id));
      }
    }

    // Check if all boletos for the order are paid; if so, mark order paid
    if (b.orderId) {
      const orderBoletos = await tx.select().from(boletos).where(eq(boletos.orderId, b.orderId));
      const allPaid = orderBoletos.every((ob) => ob.id === b.id || ob.status === 'pago');
      if (allPaid) {
        await tx
          .update(orders)
          .set({ paymentStatus: 'pago', updatedAt: new Date() })
          .where(eq(orders.id, b.orderId));
      }
    }

    return { notFound: false, alreadyPaid: false, boleto: { ...b, ...updatedRaw } };
  });
}

// ==========================================
// 8. FULL FINANCIAL REPOSITORY (ACCOUNTS, CATEGORIES, COST CENTERS, BANKS, METHODS, AUDIT)
// ==========================================
export async function getFinancialAccountsFromDb() {
  const activeDb = ensureDbReady();
  const rows = await activeDb.select().from(financialAccounts).orderBy(desc(financialAccounts.createdAt));
  return rows.map((r) => {
    const raw = (r.rawData as any) || {};
    return {
      ...raw,
      id: r.id,
      type: r.type as any,
      description: r.description,
      entityName: r.entityName,
      documentNumber: r.documentNumber || undefined,
      amount: r.amount,
      paidAmount: r.paidAmount ?? 0,
      remainingAmount: r.remainingAmount,
      dueDate: r.dueDate,
      issueDate: r.issueDate,
      paymentDate: r.paymentDate || undefined,
      status: r.status as any,
      categoryId: r.categoryId || '',
      costCenterId: r.costCenterId || undefined,
      bankAccountId: r.bankAccountId || undefined,
      paymentMethodId: r.paymentMethodId || undefined,
      orderId: r.orderId || undefined,
      quoteId: r.quoteId || undefined,
      notes: r.notes || undefined,
      installments: (r.installments as any) || undefined,
      createdAt: r.createdAt?.toISOString() || new Date().toISOString(),
    };
  });
}

export async function upsertFinancialAccountInDb(a: any) {
  const activeDb = ensureDbReady();
  await activeDb
    .insert(financialAccounts)
    .values({
      id: a.id,
      type: a.type || 'receber',
      description: a.description || '',
      entityName: a.entityName || '',
      documentNumber: a.documentNumber || null,
      amount: Number(a.amount || 0),
      paidAmount: Number(a.paidAmount || 0),
      remainingAmount: Number(a.remainingAmount ?? a.amount ?? 0),
      dueDate: a.dueDate || '',
      issueDate: a.issueDate || '',
      paymentDate: a.paymentDate || null,
      status: a.status || 'pendente',
      categoryId: a.categoryId || null,
      costCenterId: a.costCenterId || null,
      bankAccountId: a.bankAccountId || null,
      paymentMethodId: a.paymentMethodId || null,
      orderId: a.orderId || null,
      quoteId: a.quoteId || null,
      notes: a.notes || null,
      installments: a.installments || null,
      rawData: a,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: financialAccounts.id,
      set: {
        description: a.description || '',
        entityName: a.entityName || '',
        amount: Number(a.amount || 0),
        paidAmount: Number(a.paidAmount || 0),
        remainingAmount: Number(a.remainingAmount ?? a.amount ?? 0),
        dueDate: a.dueDate || '',
        paymentDate: a.paymentDate || null,
        status: a.status || 'pendente',
        categoryId: a.categoryId || null,
        costCenterId: a.costCenterId || null,
        bankAccountId: a.bankAccountId || null,
        paymentMethodId: a.paymentMethodId || null,
        notes: a.notes || null,
        installments: a.installments || null,
        rawData: a,
        updatedAt: new Date(),
      },
    });
  return a;
}

export async function cancelFinancialAccountAtomicInDb(params: {
  id: string;
  reason: string;
  auditEntry: any;
}) {
  const activeDb = ensureDbReady();
  return await activeDb.transaction(async (tx) => {
    const rows = await tx.select().from(financialAccounts).where(eq(financialAccounts.id, params.id)).limit(1);
    if (rows.length === 0) return { notFound: true };
    const acc = rows[0];
    if (acc.status === 'cancelado') return { alreadyCancelled: true, account: acc };

    const updatedRaw = {
      ...((acc.rawData as any) || {}),
      status: 'cancelado',
      remainingAmount: 0,
      cancelReason: params.reason,
      cancelledAt: new Date().toISOString(),
    };

    await tx
      .update(financialAccounts)
      .set({
        status: 'cancelado',
        remainingAmount: 0,
        notes: [acc.notes, `Cancelado: ${params.reason}`].filter(Boolean).join(' | '),
        rawData: updatedRaw,
        updatedAt: new Date(),
      })
      .where(eq(financialAccounts.id, acc.id));

    await tx.insert(financialAuditLogs).values({
      ...params.auditEntry,
      previousValues: acc,
      newValues: updatedRaw,
    });

    return { notFound: false, alreadyCancelled: false, account: { ...acc, ...updatedRaw } };
  });
}

export async function refundFinancialAccountAtomicInDb(params: {
  id: string;
  reason: string;
  auditEntry: any;
}) {
  const activeDb = ensureDbReady();
  return await activeDb.transaction(async (tx) => {
    const rows = await tx.select().from(financialAccounts).where(eq(financialAccounts.id, params.id)).limit(1);
    if (rows.length === 0) return { notFound: true };
    const acc = rows[0];
    if (acc.status === 'cancelado') return { cancelled: true, account: acc };
    const refundedAmount = Number(acc.paidAmount || 0);

    const updatedRaw = {
      ...((acc.rawData as any) || {}),
      paidAmount: 0,
      remainingAmount: Number(acc.amount || 0),
      status: 'pendente',
      paymentDate: undefined,
      refundReason: params.reason,
      refundedAt: new Date().toISOString(),
    };

    await tx
      .update(financialAccounts)
      .set({
        paidAmount: 0,
        remainingAmount: Number(acc.amount || 0),
        status: 'pendente',
        paymentDate: null,
        notes: [acc.notes, `Estornado: ${params.reason}`].filter(Boolean).join(' | '),
        rawData: updatedRaw,
        updatedAt: new Date(),
      })
      .where(eq(financialAccounts.id, acc.id));

    if (acc.bankAccountId && refundedAmount > 0) {
      const baRows = await tx.select().from(bankAccounts).where(eq(bankAccounts.id, acc.bankAccountId)).limit(1);
      if (baRows.length > 0) {
        const ba = baRows[0];
        const delta = acc.type === 'receber' ? -refundedAmount : refundedAmount;
        await tx
          .update(bankAccounts)
          .set({
            currentBalance: Number((ba.currentBalance + delta).toFixed(2)),
            updatedAt: new Date(),
          })
          .where(eq(bankAccounts.id, ba.id));
      }
    }

    if (acc.orderId && acc.type === 'receber') {
      await tx
        .update(orders)
        .set({ paymentStatus: 'estornado', updatedAt: new Date() })
        .where(eq(orders.id, acc.orderId));
    }

    await tx.insert(financialAuditLogs).values({
      ...params.auditEntry,
      previousValues: acc,
      newValues: updatedRaw,
    });

    return { notFound: false, account: { ...acc, ...updatedRaw } };
  });
}

export async function settleFinancialAccountAtomicInDb(params: {
  id: string;
  amountPaid: number;
  paymentDate?: string;
  bankAccountId?: string;
  paymentMethodId?: string;
  notes?: string;
  auditEntry: any;
}) {
  const activeDb = ensureDbReady();
  return await activeDb.transaction(async (tx) => {
    const rows = await tx.select().from(financialAccounts).where(eq(financialAccounts.id, params.id)).limit(1);
    if (rows.length === 0) return { notFound: true };
    const acc = rows[0];
    if (acc.status === 'pago') return { alreadyPaid: true, account: acc };
    if (acc.status === 'cancelado') return { cancelled: true, account: acc };

    const payAmt = Math.max(0, Number(params.amountPaid || acc.remainingAmount || acc.amount || 0));
    const nextPaid = Number(((acc.paidAmount || 0) + payAmt).toFixed(2));
    const nextRemaining = Math.max(0, Number((acc.amount - nextPaid).toFixed(2)));
    const nextStatus = nextRemaining <= 0.009 ? 'pago' : 'parcial';
    const payDate = params.paymentDate || new Date().toISOString().split('T')[0];

    const updatedRaw = {
      ...((acc.rawData as any) || {}),
      paidAmount: nextPaid,
      remainingAmount: nextRemaining,
      status: nextStatus,
      paymentDate: payDate,
      bankAccountId: params.bankAccountId || acc.bankAccountId,
      paymentMethodId: params.paymentMethodId || acc.paymentMethodId,
    };

    await tx
      .update(financialAccounts)
      .set({
        paidAmount: nextPaid,
        remainingAmount: nextRemaining,
        status: nextStatus,
        paymentDate: payDate,
        bankAccountId: params.bankAccountId || acc.bankAccountId,
        paymentMethodId: params.paymentMethodId || acc.paymentMethodId,
        notes: params.notes || acc.notes,
        rawData: updatedRaw,
        updatedAt: new Date(),
      })
      .where(eq(financialAccounts.id, acc.id));

    const targetBankId = params.bankAccountId || acc.bankAccountId;
    if (targetBankId && payAmt > 0) {
      const baRows = await tx.select().from(bankAccounts).where(eq(bankAccounts.id, targetBankId)).limit(1);
      if (baRows.length > 0) {
        const ba = baRows[0];
        const delta = acc.type === 'receber' ? payAmt : -payAmt;
        await tx
          .update(bankAccounts)
          .set({
            currentBalance: Number((ba.currentBalance + delta).toFixed(2)),
            updatedAt: new Date(),
          })
          .where(eq(bankAccounts.id, ba.id));
      }
    }

    if (acc.orderId && nextStatus === 'pago' && acc.type === 'receber') {
      await tx
        .update(orders)
        .set({ paymentStatus: 'pago', updatedAt: new Date() })
        .where(eq(orders.id, acc.orderId));
    }

    await tx.insert(financialAuditLogs).values({
      ...params.auditEntry,
      previousValues: acc,
      newValues: updatedRaw,
    });

    return { notFound: false, alreadyPaid: false, account: { ...acc, ...updatedRaw } };
  });
}

export async function getFinancialCategoriesFromDb() {
  const activeDb = ensureDbReady();
  const rows = await activeDb.select().from(financialCategories);
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    type: r.type as any,
    color: r.color || '#10B981',
    description: r.description || '',
    active: r.active,
  }));
}

export async function upsertFinancialCategoryInDb(fc: any) {
  const activeDb = ensureDbReady();
  await activeDb
    .insert(financialCategories)
    .values({
      id: fc.id,
      name: fc.name,
      type: fc.type || 'receita',
      color: fc.color || '#10B981',
      description: fc.description || '',
      active: fc.active !== undefined ? fc.active : true,
    })
    .onConflictDoUpdate({
      target: financialCategories.id,
      set: {
        name: fc.name,
        type: fc.type || 'receita',
        color: fc.color || '#10B981',
        description: fc.description || '',
        active: fc.active !== undefined ? fc.active : true,
      },
    });
  return fc;
}

export async function deleteFinancialCategoryFromDb(id: string) {
  const activeDb = ensureDbReady();
  await activeDb.delete(financialCategories).where(eq(financialCategories.id, id));
}

export async function getCostCentersFromDb() {
  const activeDb = ensureDbReady();
  const rows = await activeDb.select().from(costCenters);
  return rows.map((r) => ({
    id: r.id,
    code: r.code,
    name: r.name,
    description: r.description || '',
    active: r.active,
  }));
}

export async function upsertCostCenterInDb(cc: any) {
  const activeDb = ensureDbReady();
  await activeDb
    .insert(costCenters)
    .values({
      id: cc.id,
      code: cc.code,
      name: cc.name,
      description: cc.description || '',
      active: cc.active !== undefined ? cc.active : true,
    })
    .onConflictDoUpdate({
      target: costCenters.id,
      set: {
        code: cc.code,
        name: cc.name,
        description: cc.description || '',
        active: cc.active !== undefined ? cc.active : true,
      },
    });
  return cc;
}

export async function deleteCostCenterFromDb(id: string) {
  const activeDb = ensureDbReady();
  await activeDb.delete(costCenters).where(eq(costCenters.id, id));
}

export async function getBankAccountsFromDb() {
  const activeDb = ensureDbReady();
  const rows = await activeDb.select().from(bankAccounts);
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    bankName: r.bankName || '',
    agency: r.agency || '',
    accountNumber: r.accountNumber || '',
    type: r.type as any,
    initialBalance: r.initialBalance,
    currentBalance: r.currentBalance,
    isDefault: r.isDefault ?? false,
    active: r.active,
  }));
}

export async function upsertBankAccountInDb(ba: any) {
  const activeDb = ensureDbReady();
  await activeDb
    .insert(bankAccounts)
    .values({
      id: ba.id,
      name: ba.name,
      bankName: ba.bankName || '',
      agency: ba.agency || '',
      accountNumber: ba.accountNumber || '',
      type: ba.type || 'corrente',
      initialBalance: Number(ba.initialBalance || 0),
      currentBalance: Number(ba.currentBalance ?? ba.initialBalance ?? 0),
      isDefault: Boolean(ba.isDefault),
      active: ba.active !== undefined ? ba.active : true,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: bankAccounts.id,
      set: {
        name: ba.name,
        bankName: ba.bankName || '',
        agency: ba.agency || '',
        accountNumber: ba.accountNumber || '',
        type: ba.type || 'corrente',
        currentBalance: Number(ba.currentBalance ?? 0),
        isDefault: Boolean(ba.isDefault),
        active: ba.active !== undefined ? ba.active : true,
        updatedAt: new Date(),
      },
    });
  return ba;
}

export async function deleteBankAccountFromDb(id: string) {
  const activeDb = ensureDbReady();
  await activeDb.delete(bankAccounts).where(eq(bankAccounts.id, id));
}

export async function getFinancialPaymentMethodsFromDb() {
  const activeDb = ensureDbReady();
  const rows = await activeDb.select().from(financialPaymentMethods);
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    code: r.code,
    taxPercent: r.taxPercent ?? 0,
    settlementDays: r.settlementDays ?? 0,
    allowInstallments: r.allowInstallments ?? false,
    active: r.active,
  }));
}

export async function upsertFinancialPaymentMethodInDb(pm: any) {
  const activeDb = ensureDbReady();
  await activeDb
    .insert(financialPaymentMethods)
    .values({
      id: pm.id,
      name: pm.name,
      code: pm.code,
      taxPercent: Number(pm.taxPercent || 0),
      settlementDays: Number(pm.settlementDays || 0),
      allowInstallments: Boolean(pm.allowInstallments),
      active: pm.active !== undefined ? pm.active : true,
    })
    .onConflictDoUpdate({
      target: financialPaymentMethods.id,
      set: {
        name: pm.name,
        code: pm.code,
        taxPercent: Number(pm.taxPercent || 0),
        settlementDays: Number(pm.settlementDays || 0),
        allowInstallments: Boolean(pm.allowInstallments),
        active: pm.active !== undefined ? pm.active : true,
      },
    });
  return pm;
}

export async function deleteFinancialPaymentMethodFromDb(id: string) {
  const activeDb = ensureDbReady();
  await activeDb.delete(financialPaymentMethods).where(eq(financialPaymentMethods.id, id));
}

export async function getFinancialAuditLogsFromDb() {
  const activeDb = ensureDbReady();
  const rows = await activeDb.select().from(financialAuditLogs).orderBy(desc(financialAuditLogs.createdAt)).limit(500);
  return rows.map((r) => ({
    id: r.id,
    userId: r.userId,
    userName: r.userName,
    userEmail: r.userEmail || '',
    userRole: r.userRole as any,
    operation: r.operation,
    permissionUsed: r.permissionUsed || '',
    affectedRecordId: r.affectedRecordId || undefined,
    affectedRecordType: r.affectedRecordType,
    previousValues: r.previousValues,
    newValues: r.newValues,
    result: r.result as any,
    details: r.details,
    origin: r.origin || 'web_painel',
    timestamp: r.timestamp,
  }));
}

export async function insertFinancialAuditLogInDb(entry: any) {
  const activeDb = ensureDbReady();
  await activeDb
    .insert(financialAuditLogs)
    .values({
      id: entry.id || `fin-aud-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      userId: entry.userId,
      userName: entry.userName,
      userEmail: entry.userEmail || '',
      userRole: entry.userRole,
      operation: entry.operation,
      permissionUsed: entry.permissionUsed || '',
      affectedRecordId: entry.affectedRecordId || null,
      affectedRecordType: entry.affectedRecordType || 'modulo_financeiro',
      previousValues: entry.previousValues || null,
      newValues: entry.newValues || null,
      result: entry.result || 'sucesso',
      details: entry.details,
      origin: entry.origin || 'web_painel',
      timestamp: entry.timestamp || new Date().toISOString(),
    })
    .onConflictDoNothing();
}

// ==========================================
// 9. PDV SALES, CASH SESSIONS & PAYMENT TRANSACTIONS REPOSITORY
// ==========================================
export async function getPdvSalesFromDb() {
  const activeDb = ensureDbReady();
  const rows = await activeDb.select().from(pdvSales).orderBy(desc(pdvSales.createdAt));
  return rows.map((r) => ({
    ...((r.rawData as any) || {}),
    id: r.id,
    code: r.code,
    customerName: r.customerName || 'Consumidor Final',
    customerCpfCnpj: r.customerCpfCnpj || undefined,
    operatorId: r.operatorId || undefined,
    operatorName: r.operatorName || undefined,
    cashRegisterNumber: r.cashRegisterNumber ?? 1,
    subtotal: r.subtotal,
    discount: r.discount ?? 0,
    total: r.total,
    status: r.status as any,
    items: (r.items as any[]) || [],
    payments: (r.payments as any[]) || [],
    createdAt: r.createdAt?.toISOString() || new Date().toISOString(),
  }));
}

export async function upsertPdvSaleInDb(s: any) {
  const activeDb = ensureDbReady();
  await activeDb
    .insert(pdvSales)
    .values({
      id: s.id,
      code: s.code || '',
      customerName: s.customerName || 'Consumidor Final',
      customerCpfCnpj: s.customerCpfCnpj || null,
      operatorId: s.operatorId || null,
      operatorName: s.operatorName || null,
      cashRegisterNumber: Number(s.cashRegisterNumber || 1),
      subtotal: Number(s.subtotal || 0),
      discount: Number(s.discount || 0),
      total: Number(s.total || 0),
      status: s.status || 'concluida',
      items: s.items || [],
      payments: s.payments || [],
      rawData: s,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: pdvSales.id,
      set: {
        status: s.status || 'concluida',
        rawData: s,
        updatedAt: new Date(),
      },
    });
  return s;
}

export async function createPdvSaleAtomicInDb(params: {
  sale: any;
  cashSessionId?: string;
  transactions?: any[];
}) {
  const activeDb = ensureDbReady();
  const { sale, cashSessionId, transactions = [] } = params;
  return await activeDb.transaction(async (tx) => {
    const existing = await tx.select().from(pdvSales).where(eq(pdvSales.id, sale.id)).limit(1);
    if (existing.length > 0) return { sale, duplicated: true };

    const items = Array.isArray(sale.items) ? sale.items : [];
    for (const item of items) {
      const qty = Math.max(0, Number(item.quantity || 0));
      if (!item.productId || qty <= 0) continue;
      const prodRows = await tx.select().from(products).where(eq(products.id, item.productId)).limit(1);
      if (prodRows.length === 0) continue;
      const prod = prodRows[0];
      const prevStock = Number(prod.stockQty || 0);
      const nextStock = Math.max(0, prevStock - qty);
      let updatedVariants = Array.isArray(prod.variants) ? [...(prod.variants as any[])] : [];
      if (item.variantId) {
        updatedVariants = updatedVariants.map((v: any) =>
          v.id === item.variantId ? { ...v, stockQty: Math.max(0, Number(v.stockQty || 0) - qty) } : v
        );
      }
      const raw = (prod.rawData as any) || {};
      await tx
        .update(products)
        .set({
          stockQty: nextStock,
          variants: updatedVariants,
          rawData: { ...raw, stockQty: nextStock, variants: updatedVariants },
          updatedAt: new Date(),
        })
        .where(eq(products.id, prod.id));

      await tx.insert(stockMovements).values({
        id: `mov-pdv-${sale.id}-${prod.id}-${Math.random().toString(36).slice(2, 6)}`,
        productId: prod.id,
        productName: prod.name,
        variantId: item.variantId || null,
        variantColor: item.variantColor || null,
        type: 'saida',
        quantity: qty,
        previousStock: prevStock,
        newStock: nextStock,
        reason: `Venda PDV ${sale.code}`,
        operatorName: sale.operatorName || 'Operador PDV',
        createdAtText: new Date().toISOString(),
      }).onConflictDoNothing();
    }

    await tx.insert(pdvSales).values({
      id: sale.id,
      code: sale.code,
      customerName: sale.customerName || 'Consumidor Final',
      customerCpfCnpj: sale.customerCpfCnpj || null,
      operatorId: sale.operatorId || null,
      operatorName: sale.operatorName || null,
      cashRegisterNumber: Number(sale.cashRegisterNumber || 1),
      subtotal: Number(sale.subtotal || 0),
      discount: Number(sale.discount || 0),
      total: Number(sale.total || 0),
      status: sale.status || 'concluida',
      items: sale.items || [],
      payments: sale.payments || [],
      rawData: sale,
      updatedAt: new Date(),
    });

    if (cashSessionId) {
      const csRows = await tx.select().from(cashRegisterSessions).where(eq(cashRegisterSessions.id, cashSessionId)).limit(1);
      if (csRows.length > 0 && csRows[0].status === 'aberto') {
        const cs = csRows[0];
        const cashPaid = (Array.isArray(sale.payments) ? sale.payments : [])
          .filter((p: any) => p.method === 'dinheiro')
          .reduce((acc: number, p: any) => acc + Number(p.amount || 0), 0);
        const nextExpected = Number(((cs.expectedCash || 0) + cashPaid).toFixed(2));
        const nextTotalSales = Number(((cs.totalSalesAmount || 0) + Number(sale.total || 0)).toFixed(2));
        const rawCs = { ...(cs.rawData as any), expectedCash: nextExpected, totalSalesAmount: nextTotalSales };
        await tx
          .update(cashRegisterSessions)
          .set({ expectedCash: nextExpected, totalSalesAmount: nextTotalSales, rawData: rawCs, updatedAt: new Date() })
          .where(eq(cashRegisterSessions.id, cs.id));
      }
    }

    for (const ptx of transactions) {
      await tx.insert(paymentTransactions).values({
        id: ptx.id,
        saleId: ptx.saleId || sale.id,
        saleCode: ptx.saleCode || sale.code,
        orderId: ptx.orderId || null,
        origin: ptx.origin || 'pdv_balcao',
        gateway: ptx.gateway || 'manual_pdv',
        gatewayTransactionId: ptx.gatewayTransactionId || null,
        method: ptx.method || 'dinheiro',
        grossAmount: Number(ptx.grossAmount || 0),
        feeAmount: Number(ptx.feeAmount || 0),
        netAmount: Number(ptx.netAmount || ptx.grossAmount || 0),
        status: ptx.status || 'aprovado',
        rawData: ptx,
      }).onConflictDoNothing();
    }

    return { sale, duplicated: false };
  });
}

export async function getCashSessionsFromDb() {
  const activeDb = ensureDbReady();
  const rows = await activeDb.select().from(cashRegisterSessions).orderBy(desc(cashRegisterSessions.createdAt));
  return rows.map((r) => (r.rawData as any) || r);
}

export async function upsertCashSessionInDb(s: any) {
  const activeDb = ensureDbReady();
  await activeDb
    .insert(cashRegisterSessions)
    .values({
      id: s.id,
      registerNumber: Number(s.registerNumber || 1),
      registerName: s.registerName || 'Caixa Balcão 01',
      operatorId: s.operatorId || '',
      operatorName: s.operatorName || '',
      status: s.status || 'aberto',
      initialFund: Number(s.initialFund || 0),
      expectedCash: Number(s.expectedCash || 0),
      actualCash: s.actualCash !== undefined && s.actualCash !== null ? Number(s.actualCash) : null,
      totalSalesAmount: Number(s.totalSalesAmount || 0),
      rawData: s,
      openedAt: s.openedAt || null,
      closedAt: s.closedAt || null,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: cashRegisterSessions.id,
      set: {
        status: s.status || 'aberto',
        expectedCash: Number(s.expectedCash || 0),
        actualCash: s.actualCash !== undefined && s.actualCash !== null ? Number(s.actualCash) : null,
        totalSalesAmount: Number(s.totalSalesAmount || 0),
        rawData: s,
        closedAt: s.closedAt || null,
        updatedAt: new Date(),
      },
    });
  return s;
}

export async function getPaymentTransactionsFromDb() {
  const activeDb = ensureDbReady();
  const rows = await activeDb.select().from(paymentTransactions).orderBy(desc(paymentTransactions.createdAt));
  return rows.map((r) => (r.rawData as any) || r);
}

export async function upsertPaymentTransactionInDb(tx: any) {
  const activeDb = ensureDbReady();
  await activeDb
    .insert(paymentTransactions)
    .values({
      id: tx.id,
      saleId: tx.saleId || null,
      saleCode: tx.saleCode || null,
      orderId: tx.orderId || null,
      origin: tx.origin || 'loja_online',
      gateway: tx.gateway || 'mercadopago',
      gatewayTransactionId: tx.gatewayTransactionId || null,
      method: tx.method || 'pix',
      grossAmount: Number(tx.grossAmount || 0),
      feeAmount: Number(tx.feeAmount || 0),
      netAmount: Number(tx.netAmount || tx.grossAmount || 0),
      status: tx.status || 'pendente',
      rawData: tx,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: paymentTransactions.id,
      set: {
        status: tx.status || 'pendente',
        gatewayTransactionId: tx.gatewayTransactionId || null,
        rawData: tx,
        updatedAt: new Date(),
      },
    });
  return tx;
}

export async function getPaymentAuditLogsFromDb() {
  const activeDb = ensureDbReady();
  const rows = await activeDb.select().from(paymentAuditLogs).orderBy(desc(paymentAuditLogs.createdAt)).limit(500);
  return rows.map((r) => ({
    id: r.id,
    userId: r.userId,
    userName: r.userName,
    userRole: r.userRole,
    action: r.action,
    details: r.details,
    timestamp: r.timestamp,
  }));
}

export async function insertPaymentAuditLogInDb(entry: any) {
  const activeDb = ensureDbReady();
  await activeDb
    .insert(paymentAuditLogs)
    .values({
      id: entry.id || `pay-aud-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      userId: entry.userId || 'sistema',
      userName: entry.userName || 'Sistema',
      userRole: entry.userRole || 'sistema',
      action: entry.action,
      details: entry.details,
      timestamp: entry.timestamp || new Date().toISOString(),
    })
    .onConflictDoNothing();
}

// ==========================================
// 10. COST & PRICING REPOSITORY
// ==========================================
export async function getCostPricingSettingsFromDb() {
  const activeDb = ensureDbReady();
  const rows = await activeDb.select().from(costPricingSettings).where(eq(costPricingSettings.id, 'global_settings')).limit(1);
  return rows.length ? (rows[0].data as any) : INITIAL_COST_PRICING_SETTINGS;
}

export async function saveCostPricingSettingsInDb(data: any, updatedBy = 'Sistema') {
  const activeDb = ensureDbReady();
  await activeDb
    .insert(costPricingSettings)
    .values({ id: 'global_settings', data, updatedBy, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: costPricingSettings.id,
      set: { data, updatedBy, updatedAt: new Date() },
    });
  return data;
}

export async function getCostMaterialsFromDb() {
  const activeDb = ensureDbReady();
  const rows = await activeDb.select().from(costRawMaterials);
  return rows.map((r) => r.data as any);
}

export async function upsertCostMaterialInDb(m: any) {
  const activeDb = ensureDbReady();
  await activeDb
    .insert(costRawMaterials)
    .values({
      id: m.id,
      code: m.code || '',
      name: m.name || '',
      category: m.category || 'papeis',
      costWithWaste: Number(m.costWithWaste || 0),
      data: m,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: costRawMaterials.id,
      set: { code: m.code || '', name: m.name || '', category: m.category || 'papeis', costWithWaste: Number(m.costWithWaste || 0), data: m, updatedAt: new Date() },
    });
  return m;
}

export async function deleteCostMaterialFromDb(id: string) {
  const activeDb = ensureDbReady();
  await activeDb.delete(costRawMaterials).where(eq(costRawMaterials.id, id));
}

export async function getCostMachinesFromDb() {
  const activeDb = ensureDbReady();
  const rows = await activeDb.select().from(costMachines);
  return rows.map((r) => r.data as any);
}

export async function upsertCostMachineInDb(m: any) {
  const activeDb = ensureDbReady();
  await activeDb
    .insert(costMachines)
    .values({
      id: m.id,
      code: m.code || '',
      name: m.name || '',
      status: m.status || 'ativo',
      totalMachineCostPerHour: Number(m.totalMachineCostPerHour || 0),
      data: m,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: costMachines.id,
      set: { code: m.code || '', name: m.name || '', status: m.status || 'ativo', totalMachineCostPerHour: Number(m.totalMachineCostPerHour || 0), data: m, updatedAt: new Date() },
    });
  return m;
}

export async function deleteCostMachineFromDb(id: string) {
  const activeDb = ensureDbReady();
  await activeDb.delete(costMachines).where(eq(costMachines.id, id));
}

export async function getCostLaborFromDb() {
  const activeDb = ensureDbReady();
  const rows = await activeDb.select().from(costLaborOperations);
  return rows.map((r) => r.data as any);
}

export async function upsertCostLaborInDb(l: any) {
  const activeDb = ensureDbReady();
  await activeDb
    .insert(costLaborOperations)
    .values({
      id: l.id,
      code: l.code || '',
      name: l.name || '',
      effectiveHourlyRate: Number(l.effectiveHourlyRate || 0),
      data: l,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: costLaborOperations.id,
      set: { code: l.code || '', name: l.name || '', effectiveHourlyRate: Number(l.effectiveHourlyRate || 0), data: l, updatedAt: new Date() },
    });
  return l;
}

export async function deleteCostLaborFromDb(id: string) {
  const activeDb = ensureDbReady();
  await activeDb.delete(costLaborOperations).where(eq(costLaborOperations.id, id));
}

export async function getCostExpensesFromDb() {
  const activeDb = ensureDbReady();
  const rows = await activeDb.select().from(costIndirectExpenses);
  return rows.map((r) => r.data as any);
}

export async function upsertCostExpenseInDb(e: any) {
  const activeDb = ensureDbReady();
  await activeDb
    .insert(costIndirectExpenses)
    .values({
      id: e.id,
      code: e.code || '',
      name: e.name || '',
      monthlyAmount: Number(e.monthlyAmount || 0),
      active: e.active !== undefined ? Boolean(e.active) : true,
      data: e,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: costIndirectExpenses.id,
      set: { code: e.code || '', name: e.name || '', monthlyAmount: Number(e.monthlyAmount || 0), active: e.active !== undefined ? Boolean(e.active) : true, data: e, updatedAt: new Date() },
    });
  return e;
}

export async function deleteCostExpenseFromDb(id: string) {
  const activeDb = ensureDbReady();
  await activeDb.delete(costIndirectExpenses).where(eq(costIndirectExpenses.id, id));
}

export async function getCostSheetsFromDb() {
  const activeDb = ensureDbReady();
  const rows = await activeDb.select().from(costCompositionSheets);
  return rows.map((r) => r.data as any);
}

export async function upsertCostSheetInDb(s: any) {
  const activeDb = ensureDbReady();
  await activeDb
    .insert(costCompositionSheets)
    .values({
      id: s.id,
      code: s.code || '',
      productName: s.productName || '',
      category: s.category || 'Personalizados',
      totalUnitCost: Number(s.totalUnitCost || 0),
      suggestedUnitPrice: Number(s.suggestedUnitPrice || 0),
      data: s,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: costCompositionSheets.id,
      set: { code: s.code || '', productName: s.productName || '', category: s.category || 'Personalizados', totalUnitCost: Number(s.totalUnitCost || 0), suggestedUnitPrice: Number(s.suggestedUnitPrice || 0), data: s, updatedAt: new Date() },
    });
  return s;
}

export async function deleteCostSheetFromDb(id: string) {
  const activeDb = ensureDbReady();
  await activeDb.delete(costCompositionSheets).where(eq(costCompositionSheets.id, id));
}

export async function getCostQuotesFromDb() {
  const activeDb = ensureDbReady();
  const rows = await activeDb.select().from(costQuotes);
  return rows.map((r) => r.data as any);
}

export async function upsertCostQuoteInDb(q: any) {
  const activeDb = ensureDbReady();
  await activeDb
    .insert(costQuotes)
    .values({
      id: q.id,
      code: q.code || '',
      clientName: q.clientName || '',
      status: q.status || 'pendente',
      total: Number(q.total || 0),
      data: q,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: costQuotes.id,
      set: { code: q.code || '', clientName: q.clientName || '', status: q.status || 'pendente', total: Number(q.total || 0), data: q, updatedAt: new Date() },
    });
  return q;
}

export async function getCostPricingAuditLogsFromDb() {
  const activeDb = ensureDbReady();
  const rows = await activeDb.select().from(costPricingAuditLogs).orderBy(desc(costPricingAuditLogs.createdAt)).limit(500);
  return rows.map((r) => ({
    ...((r.data as any) || {}),
    id: r.id,
    userId: r.userId,
    userName: r.userName,
    userRole: r.userRole,
    operation: r.operation,
    entityType: r.entityType,
    entityId: r.entityId,
    entityName: r.entityName,
    details: r.details,
    timestamp: r.timestamp,
  }));
}

export async function insertCostPricingAuditLogInDb(entry: any) {
  const activeDb = ensureDbReady();
  await activeDb
    .insert(costPricingAuditLogs)
    .values({
      id: entry.id || `cp-aud-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      userId: entry.userId,
      userName: entry.userName,
      userRole: entry.userRole,
      operation: entry.operation,
      entityType: entry.entityType,
      entityId: entry.entityId,
      entityName: entry.entityName,
      details: entry.details,
      data: entry,
      timestamp: entry.timestamp || new Date().toISOString(),
    })
    .onConflictDoNothing();
}

// ==========================================
// 11. STRICKER INTEGRATION REPOSITORY
// ==========================================
export async function getStrickerConfigFromDb() {
  const activeDb = ensureDbReady();
  const rows = await activeDb.select().from(strickerConfig).where(eq(strickerConfig.id, 'default')).limit(1);
  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    ...((r.data as any) || {}),
    environment: r.environment,
    apiUrl: r.apiUrl,
    sessionToken: r.sessionToken,
    tokenExpiresAt: r.tokenExpiresAt,
    autoSyncEnabled: r.autoSyncEnabled,
    syncIntervalHours: r.syncIntervalHours,
    lastSyncAt: r.lastSyncAt,
  };
}

export async function saveStrickerConfigInDb(cfg: any) {
  const activeDb = ensureDbReady();
  await activeDb
    .insert(strickerConfig)
    .values({
      id: 'default',
      environment: cfg.environment || 'homologacao',
      apiUrl: cfg.apiUrl || 'https://ws.spotgifts.com.br/api/v1SSL/',
      sessionToken: cfg.sessionToken || null,
      tokenExpiresAt: cfg.tokenExpiresAt || null,
      autoSyncEnabled: cfg.autoSyncEnabled !== undefined ? Boolean(cfg.autoSyncEnabled) : true,
      syncIntervalHours: Number(cfg.syncIntervalHours || 12),
      lastSyncAt: cfg.lastSyncAt || null,
      data: cfg,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: strickerConfig.id,
      set: {
        environment: cfg.environment || 'homologacao',
        apiUrl: cfg.apiUrl || 'https://ws.spotgifts.com.br/api/v1SSL/',
        sessionToken: cfg.sessionToken || null,
        tokenExpiresAt: cfg.tokenExpiresAt || null,
        autoSyncEnabled: cfg.autoSyncEnabled !== undefined ? Boolean(cfg.autoSyncEnabled) : true,
        syncIntervalHours: Number(cfg.syncIntervalHours || 12),
        lastSyncAt: cfg.lastSyncAt || null,
        data: cfg,
        updatedAt: new Date(),
      },
    });
  return cfg;
}

export async function getStrickerProductsFromDb() {
  const activeDb = ensureDbReady();
  const rows = await activeDb.select().from(strickerProducts);
  return rows.map((r) => r.data as any);
}

export async function upsertStrickerProductInDb(sp: any) {
  const activeDb = ensureDbReady();
  await activeDb
    .insert(strickerProducts)
    .values({
      reference: sp.reference,
      name: sp.name || '',
      brand: sp.brand || '',
      category: sp.category || '',
      status: sp.status || 'ativo',
      publishedToCatalog: Boolean(sp.publishedToCatalog),
      totalStockAvailable: Number(sp.totalStockAvailable || 0),
      data: sp,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: strickerProducts.reference,
      set: {
        name: sp.name || '',
        brand: sp.brand || '',
        category: sp.category || '',
        status: sp.status || 'ativo',
        publishedToCatalog: Boolean(sp.publishedToCatalog),
        totalStockAvailable: Number(sp.totalStockAvailable || 0),
        data: sp,
        updatedAt: new Date(),
      },
    });
  return sp;
}

export async function getStrickerCustomizationTablesFromDb() {
  const activeDb = ensureDbReady();
  const rows = await activeDb.select().from(strickerCustomizationTables);
  return rows.map((r) => r.data as any);
}

export async function upsertStrickerCustomizationTableInDb(t: any) {
  const activeDb = ensureDbReady();
  await activeDb
    .insert(strickerCustomizationTables)
    .values({
      tableCode: t.tableCode,
      techniqueCode: t.techniqueCode || '',
      data: t,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: strickerCustomizationTables.tableCode,
      set: { techniqueCode: t.techniqueCode || '', data: t, updatedAt: new Date() },
    });
  return t;
}

export async function getStrickerOrdersFromDb() {
  const activeDb = ensureDbReady();
  const rows = await activeDb.select().from(strickerOrders).orderBy(desc(strickerOrders.createdAt));
  return rows.map((r) => r.data as any);
}

export async function upsertStrickerOrderInDb(o: any) {
  const activeDb = ensureDbReady();
  const id = o.id || o.orderStamp;
  await activeDb
    .insert(strickerOrders)
    .values({
      id,
      orderStamp: o.orderStamp,
      internalReference: o.internalReference || '',
      status: o.status || 'PROCESSING',
      orderTotal: Number(o.orderTotal || 0),
      data: o,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: strickerOrders.id,
      set: { status: o.status || 'PROCESSING', orderTotal: Number(o.orderTotal || 0), data: o, updatedAt: new Date() },
    });
  return o;
}

export async function getStrickerLogsFromDb(logType?: 'sync' | 'request') {
  const activeDb = ensureDbReady();
  const rows = logType
    ? await activeDb.select().from(strickerLogs).where(eq(strickerLogs.logType, logType)).orderBy(desc(strickerLogs.createdAt)).limit(200)
    : await activeDb.select().from(strickerLogs).orderBy(desc(strickerLogs.createdAt)).limit(200);
  return rows.map((r) => r.data as any);
}

export async function insertStrickerLogInDb(logType: 'sync' | 'request', log: any) {
  const activeDb = ensureDbReady();
  await activeDb
    .insert(strickerLogs)
    .values({
      id: log.id || `stk-log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      logType,
      status: log.status || 'success',
      data: log,
      timestamp: log.startedAt || log.timestamp || new Date().toISOString(),
    })
    .onConflictDoNothing();
}

// ==========================================
// 12. SHOPPING CARTS & FAVORITES REPOSITORY
// ==========================================
export async function getCartFromDb(ownerKey: string): Promise<any[]> {
  const activeDb = ensureDbReady();
  const rows = await activeDb.select().from(shoppingCarts).where(eq(shoppingCarts.ownerKey, ownerKey)).limit(1);
  return rows.length ? ((rows[0].items as any[]) || []) : [];
}

export async function saveCartToDb(ownerKey: string, items: any[]): Promise<void> {
  const activeDb = ensureDbReady();
  await activeDb
    .insert(shoppingCarts)
    .values({ ownerKey, items, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: shoppingCarts.ownerKey,
      set: { items, updatedAt: new Date() },
    });
}

export async function getFavoritesFromDb(ownerKey: string): Promise<string[]> {
  const activeDb = ensureDbReady();
  const rows = await activeDb.select().from(userFavorites).where(eq(userFavorites.ownerKey, ownerKey)).limit(1);
  return rows.length ? ((rows[0].productIds as string[]) || []) : [];
}

export async function saveFavoritesToDb(ownerKey: string, productIds: string[]): Promise<void> {
  const activeDb = ensureDbReady();
  await activeDb
    .insert(userFavorites)
    .values({ ownerKey, productIds, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: userFavorites.ownerKey,
      set: { productIds, updatedAt: new Date() },
    });
}

// ==========================================
// 13. SITE ANALYTICS REPOSITORY
// ==========================================
export async function insertAnalyticsPageviewInDb(pv: any) {
  const activeDb = ensureDbReady();
  await activeDb.transaction(async (tx) => {
    await tx
      .insert(analyticsPageviews)
      .values({
        id: pv.id,
        timestamp: pv.timestamp,
        sessionId: pv.sessionId,
        visitorId: pv.visitorId,
        path: pv.path || '/',
        title: pv.title || '',
        source: pv.source || 'direto',
        device: pv.device || 'computador',
        browser: pv.browser || 'Chrome',
        os: pv.os || 'Windows',
        country: pv.country || 'Brasil',
        state: pv.state || 'SP',
        city: pv.city || 'São Paulo',
        durationSeconds: Number(pv.durationSeconds || 15),
        isNewVisitor: Boolean(pv.isNewVisitor),
        data: pv,
      })
      .onConflictDoNothing();

    const rtVisitor = {
      id: `rt_${pv.sessionId}`,
      sessionId: pv.sessionId,
      visitorId: pv.visitorId,
      lastActive: pv.timestamp,
      currentPath: pv.path || '/',
      pageTitle: pv.title || 'MB Personaliza',
      device: pv.device || 'computador',
      browser: pv.browser || 'Chrome',
      location: `${pv.city || 'São Paulo'} - ${pv.state || 'SP'}`,
      source: pv.source || 'direto',
    };
    await tx
      .insert(analyticsRealtime)
      .values({
        sessionId: pv.sessionId,
        visitorId: pv.visitorId,
        lastActive: pv.timestamp,
        data: rtVisitor,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: analyticsRealtime.sessionId,
        set: { lastActive: pv.timestamp, data: rtVisitor, updatedAt: new Date() },
      });
  });
}

export async function insertAnalyticsEventInDb(ev: any) {
  const activeDb = ensureDbReady();
  await activeDb
    .insert(analyticsEvents)
    .values({
      id: ev.id,
      timestamp: ev.timestamp,
      sessionId: ev.sessionId,
      visitorId: ev.visitorId,
      eventName: ev.eventName,
      category: ev.category || 'Interação',
      label: ev.label || '',
      path: ev.path || '/',
      value: ev.value !== undefined && ev.value !== null ? Number(ev.value) : null,
      metadata: ev.metadata || null,
    })
    .onConflictDoNothing();
}

export async function getAnalyticsDataFromDb() {
  const activeDb = ensureDbReady();
  const [pvs, evs, rts] = await Promise.all([
    activeDb.select().from(analyticsPageviews).orderBy(desc(analyticsPageviews.timestamp)).limit(8000),
    activeDb.select().from(analyticsEvents).orderBy(desc(analyticsEvents.timestamp)).limit(6000),
    activeDb.select().from(analyticsRealtime).orderBy(desc(analyticsRealtime.lastActive)).limit(50),
  ]);
  const fiveMinAgo = Date.now() - 5 * 60 * 1000;
  return {
    pageviews: pvs.map((r) => ({
      id: r.id,
      timestamp: r.timestamp,
      sessionId: r.sessionId,
      visitorId: r.visitorId,
      path: r.path,
      title: r.title || '',
      source: r.source as any,
      device: r.device as any,
      browser: r.browser as any,
      os: r.os as any,
      country: r.country || 'Brasil',
      state: r.state || 'SP',
      city: r.city || 'São Paulo',
      durationSeconds: r.durationSeconds ?? 15,
      isNewVisitor: r.isNewVisitor ?? false,
      referrer: ((r.data as any)?.referrer) || '',
    })),
    events: evs.map((r) => ({
      id: r.id,
      timestamp: r.timestamp,
      sessionId: r.sessionId,
      visitorId: r.visitorId,
      eventName: r.eventName as any,
      category: r.category || 'Interação',
      label: r.label || '',
      path: r.path || '/',
      value: r.value ?? undefined,
      metadata: (r.metadata as any) || undefined,
    })),
    realtime: rts
      .map((r) => r.data as any)
      .filter((v) => new Date(v.lastActive).getTime() > fiveMinAgo),
  };
}

export async function insertAppOperationLogInDb(entry: {
  module: string;
  level?: 'info' | 'warn' | 'error';
  actorId?: string;
  actorRole?: string;
  action: string;
  message: string;
  details?: any;
}) {
  const activeDb = ensureDbReady();
  const id = `oplog-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  await activeDb.insert(appOperationLogs).values({
    id,
    module: entry.module,
    level: entry.level || 'info',
    actorId: entry.actorId || null,
    actorRole: entry.actorRole || null,
    action: entry.action,
    message: entry.message,
    details: entry.details || null,
  }).onConflictDoNothing();
  return { id, ...entry };
}

export async function getAppOperationLogsFromDb(limit = 200) {
  const activeDb = ensureDbReady();
  const rows = await activeDb
    .select()
    .from(appOperationLogs)
    .orderBy(desc(appOperationLogs.createdAt))
    .limit(limit);
  return rows.map((r) => ({
    id: r.id,
    module: r.module,
    level: r.level,
    actorId: r.actorId || undefined,
    actorRole: r.actorRole || undefined,
    action: r.action,
    message: r.message,
    details: r.details || undefined,
    createdAt: r.createdAt?.toISOString() || new Date().toISOString(),
  }));
}

// ==========================================
// 14. FULL DATABASE EXPORT & TRANSACTIONAL RESTORE (BACKUP/DRP)
// ==========================================
export async function exportAllBusinessTablesFromDb(options?: {
  includeProducts?: boolean;
  includeQuotes?: boolean;
  includeOrders?: boolean;
  includeStock?: boolean;
  includeCustomers?: boolean;
  includeSettings?: boolean;
}) {
  const activeDb = ensureDbReady();
  const opts = {
    includeProducts: true,
    includeQuotes: true,
    includeOrders: true,
    includeStock: true,
    includeCustomers: true,
    includeSettings: true,
    ...options,
  };

  const [
    prods,
    cats,
    subcats,
    qts,
    ords,
    movs,
    usrs,
    cpns,
    cpnUses,
    cpnSends,
    finAccs,
    finCats,
    ccList,
    bankList,
    pmList,
    blts,
    pdvs,
    cashSess,
    payTxs,
    settings,
    costCfg,
    costMats,
    costMachs,
    costLabs,
    costExps,
    costShts,
    costQts,
  ] = await Promise.all([
    opts.includeProducts ? getProductsFromDb() : Promise.resolve([]),
    opts.includeProducts ? getCategoriesFromDb() : Promise.resolve([]),
    opts.includeProducts ? getSubcategoriesFromDb() : Promise.resolve([]),
    opts.includeQuotes ? getQuotesFromDb() : Promise.resolve([]),
    opts.includeOrders ? getOrdersFromDb() : Promise.resolve([]),
    opts.includeStock ? getStockMovementsFromDb() : Promise.resolve([]),
    opts.includeCustomers
      ? activeDb.select().from(users).then((r) => r.map(mapUserRow)) // Strictly excludes passwordHash
      : Promise.resolve([]),
    getCouponsFromDb(),
    getCouponUsagesFromDb(),
    getCouponSendHistoryFromDb(),
    getFinancialAccountsFromDb(),
    getFinancialCategoriesFromDb(),
    getCostCentersFromDb(),
    getBankAccountsFromDb(),
    getFinancialPaymentMethodsFromDb(),
    getBoletosFromDb(),
    getPdvSalesFromDb(),
    getCashSessionsFromDb(),
    getPaymentTransactionsFromDb(),
    opts.includeSettings ? getAllSystemSettingsFromDb() : Promise.resolve({}),
    getCostPricingSettingsFromDb(),
    getCostMaterialsFromDb(),
    getCostMachinesFromDb(),
    getCostLaborFromDb(),
    getCostExpensesFromDb(),
    getCostSheetsFromDb(),
    getCostQuotesFromDb(),
  ]);

  return {
    products: prods,
    categories: cats,
    subcategories: subcats,
    quotes: qts,
    orders: ords,
    stockMovements: movs,
    users: usrs,
    coupons: cpns,
    couponUsages: cpnUses,
    couponSendHistory: cpnSends,
    financialAccounts: finAccs,
    financialCategories: finCats,
    costCenters: ccList,
    bankAccounts: bankList,
    financialPaymentMethods: pmList,
    boletos: blts,
    pdvSales: pdvs,
    cashSessions: cashSess,
    paymentTransactions: payTxs,
    settings,
    costPricing: {
      settings: costCfg,
      materials: costMats,
      machines: costMachs,
      labor: costLabs,
      expenses: costExps,
      sheets: costShts,
      quotes: costQts,
    },
  };
}

export async function restoreDatabaseFromBackupPayloadInDb(data: any) {
  const activeDb = ensureDbReady();
  await ensureAdditiveTablesInPostgres();

  const restoredCounts = {
    products: 0,
    categories: 0,
    subcategories: 0,
    quotes: 0,
    orders: 0,
    stockMovements: 0,
    coupons: 0,
    financialAccounts: 0,
    boletos: 0,
    pdvSales: 0,
  };

  await activeDb.transaction(async () => {
    if (Array.isArray(data.categories)) {
      for (const c of data.categories) {
        if (c?.id) {
          await upsertCategoryInDb(c);
          restoredCounts.categories++;
        }
      }
    }
    if (Array.isArray(data.subcategories)) {
      for (const s of data.subcategories) {
        if (s?.id) {
          await upsertSubcategoryInDb(s);
          restoredCounts.subcategories++;
        }
      }
    }
    if (Array.isArray(data.products)) {
      for (const p of data.products) {
        if (p?.id) {
          await upsertProductInDb(p);
          restoredCounts.products++;
        }
      }
    }
    if (Array.isArray(data.quotes)) {
      for (const q of data.quotes) {
        if (q?.id) {
          await upsertQuoteInDb(q);
          restoredCounts.quotes++;
        }
      }
    }
    if (Array.isArray(data.orders)) {
      for (const o of data.orders) {
        if (o?.id) {
          await upsertOrderInDb(o);
          restoredCounts.orders++;
        }
      }
    }
    if (Array.isArray(data.stockMovements)) {
      for (const sm of data.stockMovements) {
        if (sm?.id) {
          await upsertStockMovementInDb(sm);
          restoredCounts.stockMovements++;
        }
      }
    }
    if (Array.isArray(data.coupons)) {
      for (const cp of data.coupons) {
        if (cp?.id) {
          await upsertCouponInDb(cp);
          restoredCounts.coupons++;
        }
      }
    }
    if (Array.isArray(data.financialAccounts)) {
      for (const fa of data.financialAccounts) {
        if (fa?.id) {
          await upsertFinancialAccountInDb(fa);
          restoredCounts.financialAccounts++;
        }
      }
    }
    if (Array.isArray(data.boletos)) {
      for (const b of data.boletos) {
        if (b?.id) {
          await upsertBoletoInDb(b);
          restoredCounts.boletos++;
        }
      }
    }
    if (Array.isArray(data.pdvSales)) {
      for (const ps of data.pdvSales) {
        if (ps?.id) {
          await upsertPdvSaleInDb(ps);
          restoredCounts.pdvSales++;
        }
      }
    }
    if (data.settings && typeof data.settings === 'object') {
      for (const [k, v] of Object.entries(data.settings)) {
        if (k && v !== undefined) {
          await saveSystemSettingsToDb(k, v);
        }
      }
    }
  });

  return restoredCounts;
}

// ==========================================
// 15. TABLE COUNTS & CONTROLLED ADDITIVE MIGRATION HELPER
// ==========================================
export async function getDatabaseCountsFromDb() {
  const activeDb = ensureDbReady();
  const [
    usersRows,
    productsRows,
    categoriesRows,
    subcategoriesRows,
    quotesRows,
    ordersRows,
    couponsRows,
    financialRows,
    boletosRows,
    stockRows,
    pdvRows,
    cashRows,
    txRows,
    backupsRows,
    costMatsRows,
    costSheetsRows,
    strickerProdRows,
  ] = await Promise.all([
    activeDb.select({ count: sql<number>`count(*)::int` }).from(users),
    activeDb.select({ count: sql<number>`count(*)::int` }).from(products),
    activeDb.select({ count: sql<number>`count(*)::int` }).from(categories),
    activeDb.select({ count: sql<number>`count(*)::int` }).from(subcategories),
    activeDb.select({ count: sql<number>`count(*)::int` }).from(quotes),
    activeDb.select({ count: sql<number>`count(*)::int` }).from(orders),
    activeDb.select({ count: sql<number>`count(*)::int` }).from(discountCoupons),
    activeDb.select({ count: sql<number>`count(*)::int` }).from(financialAccounts),
    activeDb.select({ count: sql<number>`count(*)::int` }).from(boletos),
    activeDb.select({ count: sql<number>`count(*)::int` }).from(stockMovements),
    activeDb.select({ count: sql<number>`count(*)::int` }).from(pdvSales),
    activeDb.select({ count: sql<number>`count(*)::int` }).from(cashRegisterSessions),
    activeDb.select({ count: sql<number>`count(*)::int` }).from(paymentTransactions),
    activeDb.select({ count: sql<number>`count(*)::int` }).from(backups),
    activeDb.select({ count: sql<number>`count(*)::int` }).from(costRawMaterials),
    activeDb.select({ count: sql<number>`count(*)::int` }).from(costCompositionSheets),
    activeDb.select({ count: sql<number>`count(*)::int` }).from(strickerProducts),
  ]);

  return {
    users: usersRows[0]?.count ?? 0,
    products: productsRows[0]?.count ?? 0,
    categories: categoriesRows[0]?.count ?? 0,
    subcategories: subcategoriesRows[0]?.count ?? 0,
    quotes: quotesRows[0]?.count ?? 0,
    orders: ordersRows[0]?.count ?? 0,
    coupons: couponsRows[0]?.count ?? 0,
    financialAccounts: financialRows[0]?.count ?? 0,
    boletos: boletosRows[0]?.count ?? 0,
    stockMovements: stockRows[0]?.count ?? 0,
    pdvSales: pdvRows[0]?.count ?? 0,
    cashSessions: cashRows[0]?.count ?? 0,
    paymentTransactions: txRows[0]?.count ?? 0,
    backups: backupsRows[0]?.count ?? 0,
    costMaterials: costMatsRows[0]?.count ?? 0,
    costSheets: costSheetsRows[0]?.count ?? 0,
    strickerProducts: strickerProdRows[0]?.count ?? 0,
  };
}

export interface EntityMigrationSummary {
  entity: string;
  tableName: string;
  localCount: number;
  postgresBeforeCount: number;
  missingInPostgresCount: number;
  skippedExistingCount: number;
  migratedCount: number;
}

export async function runControlledLocalStorageMigration(
  snapshot: Record<string, any>,
  dryRun = true
) {
  const activeDb = ensureDbReady();
  await ensureAdditiveTablesInPostgres();

  const entityReports: EntityMigrationSummary[] = [];
  const safeArray = (val: any): any[] => (Array.isArray(val) ? val : []);

  const compareAndMigrate = async (
    entityLabel: string,
    tableName: string,
    tableRef: any,
    idCol: any,
    incomingItems: any[],
    extractId: (item: any) => string,
    insertOnlyMissing: (item: any) => Promise<void>
  ) => {
    const existingRows = await activeDb.select({ id: idCol }).from(tableRef);
    const existingIds = new Set(existingRows.map((r: any) => String(r.id)));
    const validItems = incomingItems.filter((it) => it && extractId(it));
    const missingItems = validItems.filter((it) => !existingIds.has(String(extractId(it))));

    let migratedCount = 0;
    if (!dryRun && missingItems.length > 0) {
      for (const item of missingItems) {
        await insertOnlyMissing(item);
        migratedCount++;
      }
    }

    entityReports.push({
      entity: entityLabel,
      tableName,
      localCount: validItems.length,
      postgresBeforeCount: existingRows.length,
      missingInPostgresCount: missingItems.length,
      skippedExistingCount: validItems.length - missingItems.length,
      migratedCount,
    });
  };

  await compareAndMigrate('Produtos', 'products', products, products.id, safeArray(snapshot.products), (p) => p.id, async (p) => upsertProductInDb(p));
  await compareAndMigrate('Categorias', 'categories', categories, categories.id, safeArray(snapshot.categories), (c) => c.id, async (c) => upsertCategoryInDb(c));
  await compareAndMigrate('Subcategorias', 'subcategories', subcategories, subcategories.id, safeArray(snapshot.subcategories), (s) => s.id, async (s) => upsertSubcategoryInDb(s));
  await compareAndMigrate('Orçamentos', 'quotes', quotes, quotes.id, safeArray(snapshot.quotes), (q) => q.id, async (q) => upsertQuoteInDb(q));
  await compareAndMigrate('Pedidos', 'orders', orders, orders.id, safeArray(snapshot.orders), (o) => o.id, async (o) => upsertOrderInDb(o));
  await compareAndMigrate('Cupons', 'discount_coupons', discountCoupons, discountCoupons.id, safeArray(snapshot.coupons), (c) => c.id, async (c) => upsertCouponInDb(c));
  await compareAndMigrate('Movimentações de Estoque', 'stock_movements', stockMovements, stockMovements.id, safeArray(snapshot.stockMovements), (m) => m.id, async (m) => upsertStockMovementInDb(m));
  await compareAndMigrate('Boletos', 'boletos', boletos, boletos.id, safeArray(snapshot.boletos), (b) => b.id, async (b) => upsertBoletoInDb(b));
  await compareAndMigrate('Contas Financeiras', 'financial_accounts', financialAccounts, financialAccounts.id, safeArray(snapshot.financialAccounts), (f) => f.id, async (f) => upsertFinancialAccountInDb(f));
  await compareAndMigrate('Vendas PDV', 'pdv_sales', pdvSales, pdvSales.id, safeArray(snapshot.pdvSales), (s) => s.id, async (s) => upsertPdvSaleInDb(s));
  await compareAndMigrate('Sessões de Caixa', 'cash_register_sessions', cashRegisterSessions, cashRegisterSessions.id, safeArray(snapshot.cashSessions), (c) => c.id, async (c) => upsertCashSessionInDb(c));
  await compareAndMigrate('Transações de Pagamento', 'payment_transactions', paymentTransactions, paymentTransactions.id, safeArray(snapshot.paymentTransactions), (t) => t.id, async (t) => upsertPaymentTransactionInDb(t));

  return {
    success: true,
    dryRun,
    databaseConnected: true,
    timestamp: new Date().toISOString(),
    entities: entityReports,
    totals: {
      localRecords: entityReports.reduce((acc, e) => acc + e.localCount, 0),
      postgresExisting: entityReports.reduce((acc, e) => acc + e.postgresBeforeCount, 0),
      missingInPostgres: entityReports.reduce((acc, e) => acc + e.missingInPostgresCount, 0),
      skippedExisting: entityReports.reduce((acc, e) => acc + e.skippedExistingCount, 0),
      migratedNow: entityReports.reduce((acc, e) => acc + e.migratedCount, 0),
    },
  };
}
