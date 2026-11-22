import { pgTable, text, serial, integer, doublePrecision, boolean, timestamp, jsonb } from 'drizzle-orm/pg-core';

// 1. Users Table (PostgreSQL Auth + Profile)
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(), // MB User ID / Auth UID
  name: text('name').notNull(),
  email: text('email').notNull(),
  phone: text('phone').default(''),
  company: text('company').default(''),
  cpfCnpj: text('cpf_cnpj').default(''),
  role: text('role').notNull().default('cliente'),
  passwordHash: text('password_hash'),
  address: jsonb('address'),
  customPermissions: jsonb('custom_permissions'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// 1b. Auth Sessions Table (PostgreSQL Persistent Sessions)
export const authSessions = pgTable('auth_sessions', {
  tokenHash: text('token_hash').primaryKey(),
  userUid: text('user_uid').notNull(),
  role: text('role').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  userAgent: text('user_agent').default(''),
  ip: text('ip').default(''),
  createdAt: timestamp('created_at').defaultNow(),
});

// 2. Categories Table
export const categories = pgTable('categories', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  description: text('description').default(''),
  image: text('image').default(''),
  icon: text('icon').default(''),
  orderIndex: integer('order_index').default(0),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
});

// 3. Subcategories Table
export const subcategories = pgTable('subcategories', {
  id: text('id').primaryKey(),
  categoryId: text('category_id').notNull(),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  description: text('description').default(''),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
});

// 4. Products Table
export const products = pgTable('products', {
  id: text('id').primaryKey(),
  code: text('code').notNull(),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  categoryId: text('category_id').notNull(),
  subcategoryId: text('subcategory_id'),
  shortDescription: text('short_description').default(''),
  description: text('description').default(''),
  basePrice: doublePrecision('base_price').notNull().default(0),
  promoPrice: doublePrecision('promo_price'),
  costPrice: doublePrecision('cost_price'),
  stockQty: integer('stock_qty').notNull().default(0),
  minOrderQty: integer('min_order_qty').notNull().default(1),
  isActive: boolean('is_active').notNull().default(true),
  isFeatured: boolean('is_featured').default(false),
  images: jsonb('images').default([]),
  badge: text('badge'),
  showPrice: boolean('show_price').default(true),
  priceTiers: jsonb('price_tiers').default([]),
  variants: jsonb('variants').default([]),
  details: jsonb('details'),
  barcode: text('barcode'),
  qrCode: text('qr_code'),
  totalStockAvailable: integer('total_stock_available').default(0),
  totalNextQuantities: integer('total_next_quantities').default(0),
  rawData: jsonb('raw_data'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// 5. Quotes Table
export const quotes = pgTable('quotes', {
  id: text('id').primaryKey(),
  code: text('code').notNull(),
  clientId: text('client_id'),
  clientName: text('client_name').notNull(),
  clientEmail: text('client_email').notNull(),
  clientPhone: text('client_phone').notNull(),
  clientCompany: text('client_company'),
  items: jsonb('items').notNull().default([]),
  subtotal: doublePrecision('subtotal').notNull().default(0),
  discount: doublePrecision('discount').default(0),
  total: doublePrecision('total').notNull().default(0),
  notes: text('notes'),
  status: text('status').notNull().default('pendente'),
  adminNotes: text('admin_notes'),
  respondedAt: text('responded_at'),
  respondedBy: text('responded_by'),
  billingTerms: jsonb('billing_terms'),
  validityDate: text('validity_date'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// 6. Orders Table
export const orders = pgTable('orders', {
  id: text('id').primaryKey(),
  code: text('code').notNull(),
  clientId: text('client_id'),
  clientName: text('client_name').notNull(),
  clientEmail: text('client_email').notNull(),
  clientPhone: text('client_phone').notNull(),
  clientCompany: text('client_company'),
  shippingAddress: jsonb('shipping_address'),
  items: jsonb('items').notNull().default([]),
  subtotal: doublePrecision('subtotal').notNull().default(0),
  discount: doublePrecision('discount').default(0),
  couponCode: text('coupon_code'),
  couponId: text('coupon_id'),
  couponDiscount: doublePrecision('coupon_discount'),
  couponInfo: jsonb('coupon_info'),
  shippingCost: doublePrecision('shipping_cost').default(0),
  shippingInfo: jsonb('shipping_info'),
  total: doublePrecision('total').notNull().default(0),
  paymentMethod: text('payment_method').notNull().default('pix'),
  paymentStatus: text('payment_status').notNull().default('pendente'),
  orderStatus: text('order_status').notNull().default('novo'),
  sourceQuoteId: text('source_quote_id'),
  billingTerms: jsonb('billing_terms'),
  notes: text('notes'),
  boletos: jsonb('boletos'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// 7. Discount Coupons Table
export const discountCoupons = pgTable('discount_coupons', {
  id: text('id').primaryKey(),
  code: text('code').notNull().unique(),
  campaignName: text('campaign_name').notNull(),
  discountType: text('discount_type').notNull(), // 'percentage' | 'fixed'
  discountValue: doublePrecision('discount_value').notNull(),
  startDate: text('start_date').notNull(),
  endDate: text('end_date').notNull(),
  minPurchaseAmount: doublePrecision('min_purchase_amount'),
  maxDiscountAmount: doublePrecision('max_discount_amount'),
  maxUses: integer('max_uses').default(0),
  currentUses: integer('current_uses').default(0),
  limitPerCustomer: integer('limit_per_customer').default(1),
  applicableType: text('applicable_type').notNull().default('all_store'),
  allowedProductIds: jsonb('allowed_product_ids').default([]),
  allowedCategoryIds: jsonb('allowed_category_ids').default([]),
  allowedCustomerIds: jsonb('allowed_customer_ids').default([]),
  allowCumulative: boolean('allow_cumulative').default(false),
  status: text('status').notNull().default('active'),
  internalNotes: text('internal_notes'),
  createdBy: text('created_by'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// 8. Coupon Usages Table
export const couponUsages = pgTable('coupon_usages', {
  id: text('id').primaryKey(),
  couponId: text('coupon_id').notNull(),
  couponCode: text('coupon_code').notNull(),
  orderId: text('order_id').notNull(),
  orderCode: text('order_code').notNull(),
  customerId: text('customer_id'),
  customerEmail: text('customer_email'),
  customerCpfCnpj: text('customer_cpf_cnpj'),
  subtotal: doublePrecision('subtotal').notNull().default(0),
  discountApplied: doublePrecision('discount_applied').notNull().default(0),
  usedAt: timestamp('used_at').defaultNow(),
});

// 9. Coupon Audit Logs
export const couponLogs = pgTable('coupon_logs', {
  id: text('id').primaryKey(),
  couponId: text('coupon_id').notNull(),
  action: text('action').notNull(),
  performedBy: text('performed_by').notNull(),
  details: jsonb('details'),
  timestamp: timestamp('timestamp').defaultNow(),
});

// 10. Financial Accounts (Receivables & Payables)
export const financialAccounts = pgTable('financial_accounts', {
  id: text('id').primaryKey(),
  type: text('type').notNull(), // 'receber' | 'pagar'
  description: text('description').notNull(),
  entityName: text('entity_name').notNull(),
  documentNumber: text('document_number'),
  amount: doublePrecision('amount').notNull(),
  paidAmount: doublePrecision('paid_amount').default(0),
  remainingAmount: doublePrecision('remaining_amount').notNull(),
  dueDate: text('due_date').notNull(),
  issueDate: text('issue_date').notNull(),
  paymentDate: text('payment_date'),
  status: text('status').notNull(), // 'pendente' | 'pago' | 'parcial' | 'vencido' | 'cancelado'
  categoryId: text('category_id'),
  costCenterId: text('cost_center_id'),
  bankAccountId: text('bank_account_id'),
  paymentMethodId: text('payment_method_id'),
  orderId: text('order_id'),
  quoteId: text('quote_id'),
  notes: text('notes'),
  installments: jsonb('installments'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// 11. Boletos Table
export const boletos = pgTable('boletos', {
  id: text('id').primaryKey(),
  nossoNumero: text('nosso_numero').notNull(),
  numeroDocumento: text('numero_documento').notNull(),
  orderId: text('order_id').notNull(),
  quoteId: text('quote_id'),
  tipoCobranca: text('tipo_cobranca').notNull(), // 'a_vista' | 'faturado_prazo'
  status: text('status').notNull().default('emitido'),
  valor: doublePrecision('valor').notNull(),
  dataVencimento: text('data_vencimento').notNull(),
  dataEmissao: text('data_emissao').notNull(),
  dataPagamento: text('data_pagamento'),
  linhaDigitavel: text('linha_digitavel').notNull(),
  codigoBarras: text('codigo_barras').notNull(),
  bancoCodigo: text('banco_codigo').notNull(),
  bancoNome: text('banco_nome').notNull(),
  sacadoNome: text('sacado_nome').notNull(),
  sacadoDocumento: text('sacado_documento').notNull(),
  parcelaAtual: integer('parcela_atual'),
  totalParcelas: integer('total_parcelas'),
  createdAt: timestamp('created_at').defaultNow(),
});

// 12. System Settings Table (Store company, layout, delivery, boleto, maintenance settings as JSON)
export const systemSettings = pgTable('system_settings', {
  key: text('key').primaryKey(), // 'company', 'delivery', 'boleto', 'layout', 'maintenance', 'permissions', 'gateways', 'pdv'
  value: jsonb('value').notNull(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// 13. System Backups Table (Independent Disaster Recovery storage in PostgreSQL)
export const backups = pgTable('backups', {
  id: text('id').primaryKey(),
  filename: text('filename').notNull(),
  sizeBytes: integer('size_bytes').notNull(),
  sizeFormatted: text('size_formatted').notNull(),
  checksum: text('checksum').notNull(),
  trigger: text('trigger').notNull(), // 'manual' | 'scheduled'
  status: text('status').notNull().default('success'),
  counts: jsonb('counts'),
  payload: jsonb('payload'),
  createdAt: timestamp('created_at').defaultNow(),
});

// 14. Stock Movements Table (Additive migration from localStorage)
export const stockMovements = pgTable('stock_movements', {
  id: text('id').primaryKey(),
  productId: text('product_id').notNull(),
  productName: text('product_name').notNull(),
  variantId: text('variant_id'),
  variantColor: text('variant_color'),
  type: text('type').notNull(), // 'entrada' | 'saida' | 'ajuste'
  quantity: integer('quantity').notNull(),
  previousStock: integer('previous_stock').notNull().default(0),
  newStock: integer('new_stock').notNull().default(0),
  reason: text('reason').default(''),
  operatorName: text('operator_name').default('Sistema'),
  createdAtText: text('created_at_text'),
  createdAt: timestamp('created_at').defaultNow(),
});

// 15. PDV Sales Table (Additive migration from localStorage)
export const pdvSales = pgTable('pdv_sales', {
  id: text('id').primaryKey(),
  code: text('code').notNull(),
  customerName: text('customer_name').default('Consumidor Final'),
  customerCpfCnpj: text('customer_cpf_cnpj'),
  operatorId: text('operator_id'),
  operatorName: text('operator_name'),
  cashRegisterNumber: integer('cash_register_number').default(1),
  subtotal: doublePrecision('subtotal').notNull().default(0),
  discount: doublePrecision('discount').default(0),
  total: doublePrecision('total').notNull().default(0),
  status: text('status').notNull().default('concluida'),
  items: jsonb('items').notNull().default([]),
  payments: jsonb('payments').notNull().default([]),
  rawData: jsonb('raw_data'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// 16. Cash Register Sessions Table (Additive migration from localStorage)
export const cashRegisterSessions = pgTable('cash_register_sessions', {
  id: text('id').primaryKey(),
  registerNumber: integer('register_number').notNull().default(1),
  registerName: text('register_name').notNull().default('Caixa Balcão 01'),
  operatorId: text('operator_id').notNull(),
  operatorName: text('operator_name').notNull(),
  status: text('status').notNull().default('aberto'), // 'aberto' | 'fechado'
  initialFund: doublePrecision('initial_fund').notNull().default(0),
  expectedCash: doublePrecision('expected_cash').notNull().default(0),
  actualCash: doublePrecision('actual_cash'),
  totalSalesAmount: doublePrecision('total_sales_amount').default(0),
  rawData: jsonb('raw_data').notNull(),
  openedAt: text('opened_at'),
  closedAt: text('closed_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// 17. Payment Transactions Table (Additive migration from localStorage)
export const paymentTransactions = pgTable('payment_transactions', {
  id: text('id').primaryKey(),
  saleId: text('sale_id'),
  saleCode: text('sale_code'),
  orderId: text('order_id'),
  origin: text('origin').notNull().default('loja_online'),
  gateway: text('gateway').notNull().default('mercadopago'),
  gatewayTransactionId: text('gateway_transaction_id'),
  method: text('method').notNull(),
  grossAmount: doublePrecision('gross_amount').notNull().default(0),
  feeAmount: doublePrecision('fee_amount').default(0),
  netAmount: doublePrecision('net_amount').notNull().default(0),
  status: text('status').notNull().default('pendente'),
  rawData: jsonb('raw_data').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

