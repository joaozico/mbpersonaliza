/**
 * Gera o pacote completo PostgreSQL em data/postgres_package/
 * a partir do schema oficial Drizzle (44 tabelas + índices/FKs) e
 * dos dados iniciais reais do catálogo, configurações, financeiro,
 * precificação e integração Stricker.
 *
 * Sem senhas hardcoded em texto plano (hashes scrypt ou NULL seguro).
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execFileSync } from 'child_process';
import {
  INITIAL_CATEGORIES,
  INITIAL_SUBCATEGORIES,
  INITIAL_PRODUCTS,
  INITIAL_QUOTES,
  INITIAL_ORDERS,
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
} from '../src/data/initialData.ts';
import {
  INITIAL_COST_PRICING_SETTINGS,
  INITIAL_RAW_MATERIALS,
  INITIAL_MACHINES,
  INITIAL_LABOR_OPERATIONS,
  INITIAL_INDIRECT_EXPENSES,
  INITIAL_TECHNICAL_SHEETS,
  INITIAL_COST_QUOTES,
  INITIAL_COST_PRICING_AUDIT_LOGS,
} from '../src/data/costPricingInitialData.ts';
import {
  INITIAL_STRICKER_PRODUCTS,
  INITIAL_STRICKER_CUSTOMIZATION_TABLES,
} from '../src/data/strickerInitialData.ts';

const PROJECT_ROOT = process.cwd();
const PKG_DIR = path.join(PROJECT_ROOT, 'data', 'postgres_package');
const MIGRATIONS_OUT_DIR = path.join(PKG_DIR, 'migrations');

function sqlStr(val: unknown): string {
  if (val === undefined || val === null) return 'NULL';
  const s = String(val).replace(/'/g, "''");
  return `'${s}'`;
}

function sqlNum(val: unknown, fallback: number | null = 0): string {
  if (val === undefined || val === null || val === '') {
    return fallback === null ? 'NULL' : String(fallback);
  }
  const n = Number(val);
  return Number.isFinite(n) ? String(n) : fallback === null ? 'NULL' : String(fallback);
}

function sqlBool(val: unknown, fallback = false): string {
  if (val === undefined || val === null) return fallback ? 'TRUE' : 'FALSE';
  return Boolean(val) ? 'TRUE' : 'FALSE';
}

function sqlJsonb(val: unknown, fallback: unknown = null): string {
  const target = val === undefined ? fallback : val;
  if (target === null) return 'NULL';
  const json = JSON.stringify(target).replace(/'/g, "''");
  return `'${json}'::jsonb`;
}

function createScryptHashPlaceholder(): string {
  const randomSecret = crypto.randomBytes(24).toString('hex');
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(randomSecret, salt, 64).toString('hex');
  return `scrypt:${salt}:${derived}`;
}

function buildInsert(
  table: string,
  columns: string[],
  valuesSql: string[],
  conflictTarget = '(id)'
): string {
  return `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${valuesSql.join(', ')}) ON CONFLICT ${conflictTarget} DO NOTHING;`;
}

function copyDirRecursive(src: string, dest: string) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

async function main() {
  fs.mkdirSync(PKG_DIR, { recursive: true });
  fs.mkdirSync(MIGRATIONS_OUT_DIR, { recursive: true });

  // 1. create_database.sql
  const createDatabaseSql = `-- ==============================================================================
-- MB PERSONALIZA — SCRIPT DE CRIAÇÃO DO BANCO E USUÁRIO POSTGRESQL
-- Substitua 'DEFINA_UMA_SENHA_FORTE_AQUI' antes de executar em produção.
-- ==============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'mb_app_user') THEN
    CREATE ROLE mb_app_user WITH LOGIN PASSWORD 'DEFINA_UMA_SENHA_FORTE_AQUI';
  END IF;
END $$;

SELECT 'CREATE DATABASE mb_personaliza OWNER mb_app_user ENCODING ''UTF8'''
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'mb_personaliza')\\gexec

GRANT ALL PRIVILEGES ON DATABASE mb_personaliza TO mb_app_user;

\\connect mb_personaliza

GRANT USAGE, CREATE ON SCHEMA public TO mb_app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO mb_app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO mb_app_user;
`;
  fs.writeFileSync(path.join(PKG_DIR, 'create_database.sql'), createDatabaseSql, 'utf8');

  // 2. schema.sql (from drizzle migrations 0000 + 0001 with IF NOT EXISTS for idempotency)
  const mig0 = fs
    .readFileSync(path.join(PROJECT_ROOT, 'drizzle', '0000_worried_iron_lad.sql'), 'utf8')
    .replace(/--> statement-breakpoint\r?\n?/g, '')
    .replace(/CREATE TABLE "/g, 'CREATE TABLE IF NOT EXISTS "');
  const mig1 = fs.readFileSync(
    path.join(PROJECT_ROOT, 'drizzle', '0001_indexes_and_relations.sql'),
    'utf8'
  );

  const schemaSql = `-- ==============================================================================
-- MB PERSONALIZA — SCHEMA OFICIAL POSTGRESQL (44 TABELAS, ÍNDICES E FKs)
-- ==============================================================================

${mig0}

${mig1}
`;
  fs.writeFileSync(path.join(PKG_DIR, 'schema.sql'), schemaSql, 'utf8');

  // 3. seed.sql (Real canonical initial dataset, zero plaintext passwords)
  const lines: string[] = [
    '-- ==============================================================================',
    '-- MB PERSONALIZA — CARGA DE DADOS OFICIAL (IDEMPOTENTE / ON CONFLICT DO NOTHING)',
    `-- Gerado em: ${new Date().toISOString()}`,
    '-- Nota de Segurança: hashes scrypt gerados sem exposição de senhas em texto plano.',
    '-- Defina MASTER_ADMIN_PASSWORD no .env para ativar a conta Master na inicialização.',
    '-- ==============================================================================',
    '',
    'BEGIN;',
    '',
  ];

  // Users
  const placeholderHash = createScryptHashPlaceholder();
  for (const u of INITIAL_USERS) {
    lines.push(
      buildInsert(
        'users',
        [
          'uid',
          'name',
          'email',
          'phone',
          'company',
          'cpf_cnpj',
          'state_registration',
          'role',
          'password_hash',
          'address',
          'custom_permissions',
          'favorite_product_ids',
          'is_active',
        ],
        [
          sqlStr(u.id),
          sqlStr(u.name),
          sqlStr((u.email || '').trim().toLowerCase()),
          sqlStr(u.phone || ''),
          sqlStr(u.company || ''),
          sqlStr(u.cpfCnpj || ''),
          sqlStr((u as any).stateRegistration || ''),
          sqlStr(u.role || 'cliente'),
          sqlStr(placeholderHash),
          sqlJsonb((u as any).address ?? null),
          sqlJsonb((u as any).customPermissions ?? null),
          sqlJsonb((u as any).favoriteProductIds ?? []),
          sqlBool(u.status !== 'inativo', true),
        ],
        '(uid)'
      )
    );
  }
  lines.push('');

  // Categories
  for (const c of INITIAL_CATEGORIES) {
    lines.push(
      buildInsert(
        'categories',
        ['id', 'name', 'slug', 'description', 'image', 'icon', 'order_index', 'is_active'],
        [
          sqlStr(c.id),
          sqlStr(c.name),
          sqlStr(c.slug),
          sqlStr(c.description || ''),
          sqlStr(c.image || ''),
          sqlStr(c.icon || ''),
          sqlNum(c.order ?? 0),
          sqlBool(true),
        ]
      )
    );
  }
  lines.push('');

  // Subcategories
  for (const s of INITIAL_SUBCATEGORIES) {
    lines.push(
      buildInsert(
        'subcategories',
        ['id', 'category_id', 'name', 'slug', 'description', 'is_active'],
        [
          sqlStr(s.id),
          sqlStr(s.categoryId),
          sqlStr(s.name),
          sqlStr(s.slug),
          sqlStr(''),
          sqlBool(true),
        ]
      )
    );
  }
  lines.push('');

  // Products
  for (const p of INITIAL_PRODUCTS) {
    lines.push(
      buildInsert(
        'products',
        [
          'id',
          'code',
          'name',
          'slug',
          'category_id',
          'subcategory_id',
          'short_description',
          'description',
          'base_price',
          'promo_price',
          'cost_price',
          'stock_qty',
          'min_order_qty',
          'is_active',
          'is_featured',
          'images',
          'badge',
          'show_price',
          'price_tiers',
          'variants',
          'details',
          'barcode',
          'qr_code',
          'raw_data',
        ],
        [
          sqlStr(p.id),
          sqlStr(p.code || 'PRD'),
          sqlStr(p.name),
          sqlStr(p.slug),
          sqlStr(p.categoryId),
          sqlStr(p.subcategoryId ?? null),
          sqlStr((p as any).shortDescription || ''),
          sqlStr(p.description || ''),
          sqlNum(p.base_price, 0),
          sqlNum(p.promo_price ?? null, null),
          sqlNum(p.cost_price ?? null, null),
          sqlNum(p.stock_qty, 0),
          sqlNum(p.min_order_qty, 1),
          sqlBool(p.is_active, true),
          sqlBool(p.is_featured, false),
          sqlJsonb(p.images || []),
          sqlStr(p.badge ?? null),
          sqlBool(p.show_price, true),
          sqlJsonb(p.price_tiers || []),
          sqlJsonb(p.variants || []),
          sqlJsonb(p.details ?? null),
          sqlStr(p.barcode ?? null),
          sqlStr(p.qrCode ?? null),
          sqlJsonb(p),
        ]
      )
    );
  }
  lines.push('');

  // Quotes
  for (const q of INITIAL_QUOTES) {
    lines.push(
      buildInsert(
        'quotes',
        [
          'id',
          'code',
          'client_id',
          'client_name',
          'client_email',
          'client_phone',
          'client_company',
          'items',
          'subtotal',
          'discount',
          'total',
          'notes',
          'status',
          'admin_notes',
          'responded_at',
          'responded_by',
          'billing_terms',
          'validity_date',
        ],
        [
          sqlStr(q.id),
          sqlStr(q.code),
          sqlStr(q.clientId ?? null),
          sqlStr(q.clientName),
          sqlStr(q.clientEmail),
          sqlStr(q.clientPhone),
          sqlStr(q.clientCompany ?? null),
          sqlJsonb(q.items || []),
          sqlNum((q as any).subtotal ?? q.totalEstimated ?? 0, 0),
          sqlNum((q as any).discount ?? 0, 0),
          sqlNum((q as any).total ?? q.totalEstimated ?? 0, 0),
          sqlStr(q.notes ?? null),
          sqlStr(q.status || 'pendente'),
          sqlStr(q.adminNotes ?? null),
          sqlStr((q as any).respondedAt ?? null),
          sqlStr((q as any).respondedBy ?? null),
          sqlJsonb(q.billingTerms ?? null),
          sqlStr(q.validityDate ?? null),
        ]
      )
    );
  }
  lines.push('');

  // Orders
  for (const o of INITIAL_ORDERS) {
    lines.push(
      buildInsert(
        'orders',
        [
          'id',
          'code',
          'client_id',
          'client_name',
          'client_email',
          'client_phone',
          'client_company',
          'shipping_address',
          'items',
          'subtotal',
          'discount',
          'coupon_code',
          'coupon_id',
          'coupon_discount',
          'coupon_info',
          'shipping_cost',
          'shipping_info',
          'total',
          'payment_method',
          'payment_status',
          'order_status',
          'tracking_code',
          'source_quote_id',
          'billing_terms',
          'notes',
          'boletos',
        ],
        [
          sqlStr(o.id),
          sqlStr(o.code),
          sqlStr(o.clientId ?? null),
          sqlStr(o.clientName),
          sqlStr(o.clientEmail),
          sqlStr(o.clientPhone),
          sqlStr(o.clientCompany ?? null),
          sqlJsonb(o.shippingAddress ?? null),
          sqlJsonb(o.items || []),
          sqlNum(o.subtotal, 0),
          sqlNum(o.discount ?? 0, 0),
          sqlStr((o as any).couponCode ?? null),
          sqlStr((o as any).couponId ?? null),
          sqlNum((o as any).couponDiscount ?? null, null),
          sqlJsonb((o as any).couponInfo ?? null),
          sqlNum((o as any).shippingCost ?? 0, 0),
          sqlJsonb((o as any).shippingInfo ?? null),
          sqlNum(o.total, 0),
          sqlStr(o.paymentMethod || 'pix'),
          sqlStr(o.paymentStatus || 'pendente'),
          sqlStr(o.orderStatus || 'novo'),
          sqlStr((o as any).trackingCode ?? null),
          sqlStr((o as any).sourceQuoteId ?? null),
          sqlJsonb((o as any).billingTerms ?? null),
          sqlStr(o.notes ?? null),
          sqlJsonb((o as any).boletos ?? null),
        ]
      )
    );
  }
  lines.push('');

  // Coupons & Logs
  for (const cp of INITIAL_COUPONS) {
    lines.push(
      buildInsert(
        'discount_coupons',
        [
          'id',
          'code',
          'campaign_name',
          'discount_type',
          'discount_value',
          'start_date',
          'end_date',
          'min_purchase_amount',
          'max_discount_amount',
          'max_uses',
          'current_uses',
          'limit_per_customer',
          'applicable_type',
          'allowed_product_ids',
          'allowed_category_ids',
          'allowed_customer_ids',
          'customer_restriction',
          'specific_customer_emails',
          'allow_cumulative',
          'total_discount_granted',
          'total_sales_volume',
          'sent_count',
          'status',
          'internal_notes',
          'created_by',
          'created_by_user_id',
        ],
        [
          sqlStr(cp.id),
          sqlStr(cp.code),
          sqlStr(cp.campaignName),
          sqlStr(cp.discountType),
          sqlNum(cp.discountValue, 0),
          sqlStr(cp.startDate),
          sqlStr(cp.endDate),
          sqlNum(cp.minPurchaseAmount ?? null, null),
          sqlNum(cp.maxDiscountAmount ?? null, null),
          sqlNum((cp as any).maxUses ?? (cp as any).maxUsageTotal ?? 0, 0),
          sqlNum((cp as any).currentUses ?? (cp as any).currentUsageCount ?? 0, 0),
          sqlNum((cp as any).limitPerCustomer ?? (cp as any).maxUsagePerCustomer ?? 1, 1),
          sqlStr((cp as any).applicableType ?? (cp as any).targetType ?? 'all_store'),
          sqlJsonb((cp as any).allowedProductIds ?? (cp as any).targetProductIds ?? []),
          sqlJsonb((cp as any).allowedCategoryIds ?? (cp as any).targetCategoryIds ?? []),
          sqlJsonb((cp as any).allowedCustomerIds ?? (cp as any).specificCustomerIds ?? []),
          sqlStr((cp as any).customerRestriction ?? 'general'),
          sqlJsonb((cp as any).specificCustomerEmails ?? []),
          sqlBool((cp as any).allowCumulative ?? (cp as any).canCombineWithPromotions ?? true, true),
          sqlNum((cp as any).totalDiscountGranted ?? 0, 0),
          sqlNum((cp as any).totalSalesVolume ?? 0, 0),
          sqlNum((cp as any).sentCount ?? 0, 0),
          sqlStr(cp.status || 'active'),
          sqlStr((cp as any).internalNotes ?? null),
          sqlStr((cp as any).createdBy ?? null),
          sqlStr((cp as any).createdByUserId ?? null),
        ]
      )
    );
  }
  for (const cu of INITIAL_COUPON_USAGES) {
    lines.push(
      buildInsert(
        'coupon_usages',
        [
          'id',
          'coupon_id',
          'coupon_code',
          'order_id',
          'order_code',
          'customer_id',
          'customer_name',
          'customer_email',
          'customer_phone',
          'customer_cpf_cnpj',
          'subtotal',
          'eligible_amount',
          'discount_applied',
          'shipping_cost',
          'final_total',
          'status',
        ],
        [
          sqlStr(cu.id),
          sqlStr(cu.couponId),
          sqlStr(cu.couponCode),
          sqlStr(cu.orderId),
          sqlStr(cu.orderCode),
          sqlStr(cu.customerId ?? null),
          sqlStr(cu.customerName || 'Cliente'),
          sqlStr(cu.customerEmail ?? null),
          sqlStr((cu as any).customerPhone ?? null),
          sqlStr((cu as any).customerCpfCnpj ?? null),
          sqlNum((cu as any).subtotal ?? 0, 0),
          sqlNum((cu as any).eligibleAmount ?? 0, 0),
          sqlNum(cu.discountApplied, 0),
          sqlNum((cu as any).shippingCost ?? 0, 0),
          sqlNum((cu as any).finalTotal ?? 0, 0),
          sqlStr((cu as any).status ?? 'confirmed'),
        ]
      )
    );
  }
  for (const cs of INITIAL_COUPON_SEND_HISTORY) {
    lines.push(
      buildInsert(
        'coupon_send_history',
        [
          'id',
          'coupon_id',
          'coupon_code',
          'customer_id',
          'customer_name',
          'customer_phone',
          'customer_email',
          'channel',
          'sent_at',
          'sent_by_user_id',
          'sent_by_user_name',
          'message_preview',
          'status',
        ],
        [
          sqlStr(cs.id),
          sqlStr(cs.couponId),
          sqlStr(cs.couponCode),
          sqlStr(cs.customerId ?? null),
          sqlStr(cs.customerName),
          sqlStr(cs.customerPhone ?? null),
          sqlStr(cs.customerEmail ?? null),
          sqlStr(cs.channel || 'clipboard'),
          sqlStr(cs.sentAt),
          sqlStr(cs.sentByUserId),
          sqlStr(cs.sentByUserName),
          sqlStr(cs.messagePreview),
          sqlStr(cs.status || 'copied'),
        ]
      )
    );
  }
  for (const cl of INITIAL_COUPON_AUDIT_LOGS) {
    lines.push(
      buildInsert(
        'coupon_logs',
        ['id', 'coupon_id', 'coupon_code', 'action', 'performed_by', 'user_id', 'user_role', 'details'],
        [
          sqlStr(cl.id),
          sqlStr(cl.couponId ?? null),
          sqlStr(cl.couponCode ?? null),
          sqlStr(cl.action),
          sqlStr((cl as any).performedBy ?? cl.userName ?? 'Sistema'),
          sqlStr(cl.userId ?? null),
          sqlStr(cl.userRole ?? null),
          sqlJsonb(cl.details ?? null),
        ]
      )
    );
  }
  lines.push('');

  // System Settings
  const settingsPairs: Array<[string, unknown]> = [
    ['company', INITIAL_COMPANY_SETTINGS],
    ['delivery', INITIAL_DELIVERY_SETTINGS],
    ['boleto', INITIAL_BOLETO_SETTINGS],
    ['layout', INITIAL_LAYOUT_SETTINGS],
    ['permissions', INITIAL_PERMISSIONS_MATRIX],
    ['gateways', INITIAL_PAYMENT_GATEWAYS],
    ['pdv', INITIAL_PDV_SETTINGS],
    ['financial', INITIAL_FINANCIAL_SETTINGS],
    ['price_visibility', { mode: 'all', updatedAt: new Date().toISOString() }],
    [
      'maintenance',
      {
        enabled: false,
        message: 'Estamos realizando melhorias programadas em nossa loja. Voltaremos em instantes!',
        estimatedReturn: '',
      },
    ],
    ['backup_schedule', INITIAL_BACKUP_SCHEDULE_CONFIG],
  ];
  for (const [k, v] of settingsPairs) {
    lines.push(buildInsert('system_settings', ['key', 'value'], [sqlStr(k), sqlJsonb(v)], '(key)'));
  }
  lines.push('');

  // Financial & Boletos & Stock & PDV
  for (const fc of INITIAL_FINANCIAL_CATEGORIES) {
    lines.push(
      buildInsert(
        'financial_categories',
        ['id', 'name', 'type', 'color', 'description', 'active'],
        [sqlStr(fc.id), sqlStr(fc.name), sqlStr(fc.type), sqlStr(fc.color || '#10B981'), sqlStr(fc.description || ''), sqlBool(fc.active, true)]
      )
    );
  }
  for (const cc of INITIAL_COST_CENTERS) {
    lines.push(
      buildInsert(
        'cost_centers',
        ['id', 'code', 'name', 'description', 'active'],
        [sqlStr(cc.id), sqlStr(cc.code), sqlStr(cc.name), sqlStr(cc.description || ''), sqlBool(cc.active, true)]
      )
    );
  }
  for (const ba of INITIAL_BANK_ACCOUNTS) {
    lines.push(
      buildInsert(
        'bank_accounts',
        ['id', 'name', 'bank_name', 'agency', 'account_number', 'type', 'initial_balance', 'current_balance', 'is_default', 'active'],
        [
          sqlStr(ba.id),
          sqlStr(ba.name),
          sqlStr(ba.bankName || ''),
          sqlStr(ba.agency || ''),
          sqlStr(ba.accountNumber || ''),
          sqlStr((ba as any).type ?? ba.accountType ?? 'corrente'),
          sqlNum(ba.initialBalance, 0),
          sqlNum(ba.currentBalance, 0),
          sqlBool(ba.isDefault, false),
          sqlBool(ba.active, true),
        ]
      )
    );
  }
  for (const pm of INITIAL_FINANCIAL_PAYMENT_METHODS) {
    lines.push(
      buildInsert(
        'financial_payment_methods',
        ['id', 'name', 'code', 'tax_percent', 'settlement_days', 'allow_installments', 'active'],
        [
          sqlStr(pm.id),
          sqlStr(pm.name),
          sqlStr(pm.code),
          sqlNum((pm as any).taxPercent ?? 0, 0),
          sqlNum((pm as any).settlementDays ?? 0, 0),
          sqlBool((pm as any).allowInstallments, false),
          sqlBool(pm.active, true),
        ]
      )
    );
  }
  for (const fa of INITIAL_FINANCIAL_ACCOUNTS) {
    lines.push(
      buildInsert(
        'financial_accounts',
        [
          'id',
          'type',
          'description',
          'entity_name',
          'document_number',
          'amount',
          'paid_amount',
          'remaining_amount',
          'due_date',
          'issue_date',
          'payment_date',
          'status',
          'category_id',
          'cost_center_id',
          'bank_account_id',
          'payment_method_id',
          'order_id',
          'quote_id',
          'notes',
          'installments',
          'raw_data',
        ],
        [
          sqlStr(fa.id),
          sqlStr(fa.type),
          sqlStr(fa.description),
          sqlStr(fa.entityName),
          sqlStr((fa as any).documentNumber ?? fa.entityDocument ?? null),
          sqlNum(fa.amount, 0),
          sqlNum(fa.paidAmount ?? 0, 0),
          sqlNum((fa as any).remainingAmount ?? Math.max(0, Number(fa.amount || 0) - Number(fa.paidAmount || 0)), 0),
          sqlStr(fa.dueDate),
          sqlStr(fa.issueDate),
          sqlStr(fa.paymentDate ?? null),
          sqlStr(fa.status),
          sqlStr(fa.categoryId ?? null),
          sqlStr(fa.costCenterId ?? null),
          sqlStr(fa.bankAccountId ?? null),
          sqlStr((fa as any).paymentMethodId ?? fa.paymentMethod ?? null),
          sqlStr((fa as any).orderId ?? fa.orderCode ?? null),
          sqlStr((fa as any).quoteId ?? fa.quoteCode ?? null),
          sqlStr(fa.notes ?? null),
          sqlJsonb((fa as any).installments ?? null),
          sqlJsonb(fa),
        ]
      )
    );
  }
  for (const b of INITIAL_BOLETOS) {
    lines.push(
      buildInsert(
        'boletos',
        [
          'id',
          'nosso_numero',
          'numero_documento',
          'order_id',
          'quote_id',
          'financial_account_id',
          'tipo_cobranca',
          'status',
          'valor',
          'data_vencimento',
          'data_emissao',
          'data_pagamento',
          'linha_digitavel',
          'codigo_barras',
          'banco_codigo',
          'banco_nome',
          'sacado_nome',
          'sacado_documento',
          'parcela_atual',
          'total_parcelas',
          'raw_data',
        ],
        [
          sqlStr(b.id),
          sqlStr(b.nossoNumero),
          sqlStr((b as any).numeroDocumento ?? b.nossoNumero ?? ''),
          sqlStr(b.orderId),
          sqlStr(b.quoteId ?? null),
          sqlStr(b.financialAccountId ?? null),
          sqlStr(b.tipoCobranca),
          sqlStr(b.status),
          sqlNum((b as any).valor ?? b.valorOriginal ?? 0, 0),
          sqlStr(b.dataVencimento),
          sqlStr(b.dataEmissao),
          sqlStr((b as any).dataPagamento ?? b.dataLiquidacao ?? null),
          sqlStr(b.linhaDigitavel),
          sqlStr(b.codigoBarras),
          sqlStr(b.bancoCodigo),
          sqlStr((b as any).bancoNome ?? b.bancoEmissor ?? ''),
          sqlStr(b.sacadoNome),
          sqlStr((b as any).sacadoDocumento ?? b.sacadoCpfCnpj ?? ''),
          sqlNum((b as any).parcelaAtual ?? b.parcelaNumero ?? null, null),
          sqlNum(b.totalParcelas ?? null, null),
          sqlJsonb(b),
        ]
      )
    );
  }
  for (const sm of INITIAL_STOCK_MOVEMENTS) {
    lines.push(
      buildInsert(
        'stock_movements',
        ['id', 'product_id', 'product_name', 'variant_id', 'variant_color', 'type', 'quantity', 'previous_stock', 'new_stock', 'reason', 'operator_name', 'created_at_text'],
        [
          sqlStr(sm.id),
          sqlStr(sm.productId),
          sqlStr(sm.productName),
          sqlStr(sm.variantId ?? null),
          sqlStr((sm as any).variantColor ?? sm.variantName ?? null),
          sqlStr(sm.type),
          sqlNum(sm.quantity, 0),
          sqlNum((sm as any).previousStock ?? sm.previous_stock ?? 0, 0),
          sqlNum((sm as any).newStock ?? sm.new_stock ?? 0, 0),
          sqlStr(sm.reason || ''),
          sqlStr((sm as any).operatorName ?? sm.operator_name ?? 'Sistema'),
          sqlStr((sm as any).createdAt ?? sm.created_at ?? null),
        ]
      )
    );
  }
  for (const ps of INITIAL_PDV_SALES) {
    lines.push(
      buildInsert(
        'pdv_sales',
        ['id', 'code', 'customer_name', 'customer_cpf_cnpj', 'operator_id', 'operator_name', 'cash_register_number', 'subtotal', 'discount', 'total', 'status', 'items', 'payments', 'raw_data'],
        [
          sqlStr(ps.id),
          sqlStr(ps.code),
          sqlStr(ps.customerName || 'Consumidor Final'),
          sqlStr(ps.customerCpfCnpj ?? null),
          sqlStr(ps.operatorId ?? null),
          sqlStr(ps.operatorName ?? null),
          sqlNum((ps as any).cashRegisterNumber ?? 1, 1),
          sqlNum(ps.subtotal, 0),
          sqlNum(ps.discount ?? 0, 0),
          sqlNum(ps.total, 0),
          sqlStr(ps.status || 'concluida'),
          sqlJsonb(ps.items || []),
          sqlJsonb(ps.payments || []),
          sqlJsonb(ps),
        ]
      )
    );
  }
  if (INITIAL_CASH_REGISTER_SESSION) {
    const cs = INITIAL_CASH_REGISTER_SESSION;
    lines.push(
      buildInsert(
        'cash_register_sessions',
        ['id', 'register_number', 'register_name', 'operator_id', 'operator_name', 'status', 'initial_fund', 'expected_cash', 'actual_cash', 'total_sales_amount', 'raw_data', 'opened_at', 'closed_at'],
        [
          sqlStr(cs.id),
          sqlNum((cs as any).registerNumber ?? 1, 1),
          sqlStr((cs as any).registerName || 'Caixa Balcão 01'),
          sqlStr(cs.operatorId),
          sqlStr(cs.operatorName),
          sqlStr(cs.status || 'aberto'),
          sqlNum(cs.initialFund, 0),
          sqlNum((cs as any).expectedCash ?? cs.initialFund, 0),
          sqlNum((cs as any).actualCash ?? null, null),
          sqlNum((cs as any).totalSalesAmount ?? 0, 0),
          sqlJsonb(cs),
          sqlStr(cs.openedAt ?? null),
          sqlStr(cs.closedAt ?? null),
        ]
      )
    );
  }
  for (const pt of INITIAL_PAYMENT_TRANSACTIONS) {
    lines.push(
      buildInsert(
        'payment_transactions',
        ['id', 'sale_id', 'sale_code', 'order_id', 'origin', 'gateway', 'gateway_transaction_id', 'method', 'gross_amount', 'fee_amount', 'net_amount', 'status', 'raw_data'],
        [
          sqlStr(pt.id),
          sqlStr(pt.saleId ?? null),
          sqlStr(pt.saleCode ?? null),
          sqlStr((pt as any).orderId ?? (pt.origin === 'loja_online' ? pt.saleId : null)),
          sqlStr(pt.origin || 'loja_online'),
          sqlStr(pt.gateway || 'mercadopago'),
          sqlStr((pt as any).gatewayTransactionId ?? null),
          sqlStr(pt.method),
          sqlNum(pt.grossAmount, 0),
          sqlNum(pt.feeAmount ?? 0, 0),
          sqlNum(pt.netAmount, 0),
          sqlStr(pt.status || 'pendente'),
          sqlJsonb(pt),
        ]
      )
    );
  }
  lines.push('');

  // Cost & Pricing
  lines.push(
    buildInsert(
      'cost_pricing_settings',
      ['id', 'data', 'updated_by'],
      [sqlStr('global_settings'), sqlJsonb(INITIAL_COST_PRICING_SETTINGS), sqlStr('Sistema')]
    )
  );
  for (const m of INITIAL_RAW_MATERIALS) {
    lines.push(
      buildInsert(
        'cost_raw_materials',
        ['id', 'code', 'name', 'category', 'cost_with_waste', 'data'],
        [sqlStr(m.id), sqlStr(m.code), sqlStr(m.name), sqlStr(m.category), sqlNum(m.costWithWaste, 0), sqlJsonb(m)]
      )
    );
  }
  for (const m of INITIAL_MACHINES) {
    lines.push(
      buildInsert(
        'cost_machines',
        ['id', 'code', 'name', 'status', 'total_machine_cost_per_hour', 'data'],
        [sqlStr(m.id), sqlStr(m.code), sqlStr(m.name), sqlStr(m.status || 'ativo'), sqlNum(m.totalMachineCostPerHour, 0), sqlJsonb(m)]
      )
    );
  }
  for (const l of INITIAL_LABOR_OPERATIONS) {
    lines.push(
      buildInsert(
        'cost_labor_operations',
        ['id', 'code', 'name', 'effective_hourly_rate', 'data'],
        [sqlStr(l.id), sqlStr(l.code), sqlStr(l.name), sqlNum(l.effectiveHourlyRate, 0), sqlJsonb(l)]
      )
    );
  }
  for (const e of INITIAL_INDIRECT_EXPENSES) {
    lines.push(
      buildInsert(
        'cost_indirect_expenses',
        ['id', 'code', 'name', 'monthly_amount', 'active', 'data'],
        [sqlStr(e.id), sqlStr(e.code), sqlStr(e.name), sqlNum(e.monthlyAmount, 0), sqlBool(e.active, true), sqlJsonb(e)]
      )
    );
  }
  for (const s of INITIAL_TECHNICAL_SHEETS) {
    lines.push(
      buildInsert(
        'cost_composition_sheets',
        ['id', 'code', 'product_name', 'category', 'total_unit_cost', 'suggested_unit_price', 'data'],
        [sqlStr(s.id), sqlStr(s.code), sqlStr(s.productName), sqlStr(s.category), sqlNum(s.totalUnitCost, 0), sqlNum(s.suggestedUnitPrice, 0), sqlJsonb(s)]
      )
    );
  }
  for (const q of INITIAL_COST_QUOTES) {
    lines.push(
      buildInsert(
        'cost_quotes',
        ['id', 'code', 'client_name', 'status', 'total', 'data'],
        [sqlStr(q.id), sqlStr(q.code), sqlStr(q.clientName), sqlStr(q.status || 'pendente'), sqlNum(q.total, 0), sqlJsonb(q)]
      )
    );
  }
  for (const l of INITIAL_COST_PRICING_AUDIT_LOGS) {
    lines.push(
      buildInsert(
        'cost_pricing_audit_logs',
        ['id', 'user_id', 'user_name', 'user_role', 'operation', 'entity_type', 'entity_id', 'entity_name', 'details', 'data', 'timestamp'],
        [
          sqlStr(l.id),
          sqlStr(l.userId),
          sqlStr(l.userName),
          sqlStr(l.userRole),
          sqlStr(l.operation),
          sqlStr(l.entityType),
          sqlStr(l.entityId),
          sqlStr(l.entityName),
          sqlStr(l.details),
          sqlJsonb(l),
          sqlStr(l.timestamp),
        ]
      )
    );
  }
  lines.push('');

  // Stricker
  lines.push(
    buildInsert(
      'stricker_config',
      ['id', 'environment', 'api_url', 'auto_sync_enabled', 'sync_interval_hours'],
      [sqlStr('default'), sqlStr('homologacao'), sqlStr('https://ws.spotgifts.com.br/api/v1SSL/'), sqlBool(true), sqlNum(12)]
    )
  );
  for (const sp of INITIAL_STRICKER_PRODUCTS) {
    lines.push(
      buildInsert(
        'stricker_products',
        ['reference', 'name', 'brand', 'category', 'status', 'published_to_catalog', 'total_stock_available', 'data'],
        [
          sqlStr(sp.reference),
          sqlStr(sp.name),
          sqlStr((sp as any).brand || ''),
          sqlStr((sp as any).category || ''),
          sqlStr((sp as any).status || 'ativo'),
          sqlBool((sp as any).publishedToCatalog, false),
          sqlNum((sp as any).totalStockAvailable ?? 0, 0),
          sqlJsonb(sp),
        ],
        '(reference)'
      )
    );
  }
  for (const ct of INITIAL_STRICKER_CUSTOMIZATION_TABLES) {
    lines.push(
      buildInsert(
        'stricker_customization_tables',
        ['table_code', 'technique_code', 'data'],
        [sqlStr(ct.tableCode), sqlStr(ct.techniqueCode || ''), sqlJsonb(ct)],
        '(table_code)'
      )
    );
  }

  lines.push('');
  lines.push("-- Sincronização segura da sequência de 'users.id'");
  lines.push("SELECT setval(pg_get_serial_sequence('users', 'id'), COALESCE((SELECT MAX(id) FROM users), 1), true);");
  lines.push('');
  lines.push('COMMIT;');
  lines.push('');

  const seedSql = lines.join('\n');
  fs.writeFileSync(path.join(PKG_DIR, 'seed.sql'), seedSql, 'utf8');

  // 4. mbpersonaliza_database.sql (Full self-contained SQL restore script)
  const fullSql = `-- ==============================================================================
-- MB PERSONALIZA — EXPORTAÇÃO COMPLETA DO BANCO DE DADOS POSTGRESQL (.sql)
-- Inclui: Schema completo (44 tabelas), índices, FKs, dados iniciais e sequências
-- Para restaurar: psql -U mb_app_user -d mb_personaliza -f mbpersonaliza_database.sql
-- ==============================================================================

${schemaSql}

${seedSql}
`;
  fs.writeFileSync(path.join(PKG_DIR, 'mbpersonaliza_database.sql'), fullSql, 'utf8');

  // 5. Copy migrations/, .env.example, docker-compose.yml, MANUAL_RESTAURACAO_POSTGRESQL.md, export script
  copyDirRecursive(path.join(PROJECT_ROOT, 'drizzle'), MIGRATIONS_OUT_DIR);
  fs.copyFileSync(path.join(PROJECT_ROOT, '.env.example'), path.join(PKG_DIR, '.env.example'));
  fs.copyFileSync(path.join(PROJECT_ROOT, 'docker-compose.yml'), path.join(PKG_DIR, 'docker-compose.yml'));
  fs.copyFileSync(
    path.join(PROJECT_ROOT, 'MANUAL_RESTAURACAO_POSTGRESQL.md'),
    path.join(PKG_DIR, 'MANUAL_RESTAURACAO_POSTGRESQL.md')
  );
  if (fs.existsSync(path.join(PROJECT_ROOT, 'scripts', 'export_postgres_package.sh'))) {
    fs.copyFileSync(
      path.join(PROJECT_ROOT, 'scripts', 'export_postgres_package.sh'),
      path.join(PKG_DIR, 'export_postgres_package.sh')
    );
  }

  // 6. Build MB_PERSONALIZA_POSTGRESQL_COMPLETO.zip using Python zipfile
  const zipPath = path.join(PKG_DIR, 'MB_PERSONALIZA_POSTGRESQL_COMPLETO.zip');
  if (fs.existsSync(zipPath)) {
    fs.unlinkSync(zipPath);
  }

  execFileSync(
    'python3',
    [
      '-c',
      `
import os, zipfile
pkg_dir = os.path.abspath(${JSON.stringify(PKG_DIR)})
zip_path = os.path.abspath(${JSON.stringify(zipPath)})
with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
    for root, _, files in os.walk(pkg_dir):
        for fn in sorted(files):
            if fn.endswith(".zip"):
                continue
            full = os.path.join(root, fn)
            rel = os.path.relpath(full, pkg_dir)
            zf.write(full, rel)
print("Generated ZIP:", zip_path, os.path.getsize(zip_path))
      `,
    ],
    { stdio: 'inherit' }
  );

  console.log('✓ Pacote PostgreSQL gerado em:', PKG_DIR);
}

main().catch((err) => {
  console.error('Erro ao gerar pacote PostgreSQL:', err);
  process.exit(1);
});
