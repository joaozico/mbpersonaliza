import {
  Product,
  Category,
  Subcategory,
  Quote,
  Order,
  StockMovement,
  UserProfile,
  UserRole,
  CartItem,
  CompanySettings,
  RolePermissions,
  SystemLayoutSettings,
  OffersBannerSettings,
  PaymentGatewayConfig,
  PaymentGatewayProvider,
  PaymentTransaction,
  PaymentTransactionStatus,
  PDVSale,
  PDVSettings,
  CashRegisterSession,
  CashRegisterMovement,
  MaintenanceSettings,
  MaintenanceModeAuditEntry,
  FinancialAccount,
  FinancialCategory,
  CostCenter,
  BankAccount,
  FinancialPaymentMethod,
  FinancialRecurringTransaction,
  FinancialSettings,
  FinancialAuditEntry,
  BackupScheduleConfig,
  BackupHistoryEntry,
  SecureBackupPayload,
  BackupMetadata,
  BackupVerificationResult,
  DeliveryAndShippingSettings,
  BoletoTitulo,
  BoletoBillingSettings,
  QuoteBillingTerms,
  DiscountCoupon,
  CouponUsageEntry,
  CouponSendHistoryEntry,
  CouponAuditLog,
  CouponValidationResult,
  OrderCouponInfo,
  PriceVisibilityMode,
} from '../types';
import {
  INITIAL_PRODUCTS,
  INITIAL_CATEGORIES,
  INITIAL_SUBCATEGORIES,
  INITIAL_COMPANY_SETTINGS,
  INITIAL_DELIVERY_SETTINGS,
  INITIAL_PERMISSIONS_MATRIX,
  INITIAL_LAYOUT_SETTINGS,
  INITIAL_PAYMENT_GATEWAYS,
  INITIAL_PAYMENT_TRANSACTIONS,
  INITIAL_PDV_SALES,
  INITIAL_CASH_REGISTER_SESSION,
  INITIAL_PDV_SETTINGS,
  INITIAL_MAINTENANCE_SETTINGS,
  INITIAL_FINANCIAL_CATEGORIES,
  INITIAL_COST_CENTERS,
  INITIAL_BANK_ACCOUNTS,
  INITIAL_FINANCIAL_PAYMENT_METHODS,
  INITIAL_FINANCIAL_SETTINGS,
  INITIAL_FINANCIAL_ACCOUNTS,
  INITIAL_FINANCIAL_AUDIT,
  INITIAL_BACKUP_SCHEDULE_CONFIG,
  INITIAL_BACKUP_HISTORY,
  INITIAL_BOLETO_SETTINGS,
  INITIAL_BOLETOS,
  INITIAL_COUPONS,
  INITIAL_COUPON_USAGES,
  INITIAL_COUPON_SEND_HISTORY,
  INITIAL_COUPON_AUDIT_LOGS,
} from '../data/initialData';
import { calculateSha256Sync, formatBytes, generateBackupFilename } from '../utils/cryptoUtils';
import { criarBoletoTitulo, calcularDataVencimento } from '../utils/boletoGenerator';
import {
  authFetch,
  logoutSession,
  safeParseJson,
  savePriceVisibility as savePriceVisibilityApi,
  updateMyProfile,
} from './authClient';

export const VISITOR_PROFILE: UserProfile = {
  id: 'visitante',
  name: 'Visitante',
  email: '',
  phone: '',
  role: 'visitante',
  status: 'ativo',
  createdAt: '2026-01-01T00:00:00.000Z',
};

let memoryCurrentUser: UserProfile = { ...VISITOR_PROFILE };
let memoryUsers: UserProfile[] = [];
let memoryPermissionsMatrix: Record<UserRole, RolePermissions> = {
  ...INITIAL_PERMISSIONS_MATRIX,
};
let memoryPriceVisibilityMode: PriceVisibilityMode = 'registered_only';

const STORAGE_KEYS = {
  PRODUCTS: 'mb_personaliza_products_v1',
  CATEGORIES: 'mb_personaliza_categories_v1',
  SUBCATEGORIES: 'mb_personaliza_subcategories_v1',
  QUOTES: 'mb_personaliza_quotes_v1',
  ORDERS: 'mb_personaliza_orders_v1',
  STOCK_MOVEMENTS: 'mb_personaliza_stock_movements_v1',
  CART: 'mb_personaliza_cart_v1',
  COMPANY_SETTINGS: 'mb_personaliza_company_settings_v1',
  LAYOUT_SETTINGS: 'mb_personaliza_layout_settings_v1',
  LAYOUT_DRAFT: 'mb_personaliza_layout_draft_v1',
  PAYMENT_GATEWAYS: 'mb_personaliza_payment_gateways_v1',
  PAYMENT_TRANSACTIONS: 'mb_personaliza_payment_transactions_v1',
  PDV_SALES: 'mb_personaliza_pdv_sales_v1',
  CASH_REGISTER_SESSIONS: 'mb_personaliza_cash_register_sessions_v1',
  CURRENT_CASH_SESSION: 'mb_personaliza_current_cash_session_v1',
  PDV_SETTINGS: 'mb_personaliza_pdv_settings_v1',
  MAINTENANCE_SETTINGS: 'mb_personaliza_maintenance_settings_v1',
  FINANCIAL_ACCOUNTS: 'mb_personaliza_financial_accounts_v1',
  FINANCIAL_CATEGORIES: 'mb_personaliza_financial_categories_v1',
  COST_CENTERS: 'mb_personaliza_cost_centers_v1',
  BANK_ACCOUNTS: 'mb_personaliza_bank_accounts_v1',
  FINANCIAL_PAYMENT_METHODS: 'mb_personaliza_financial_payment_methods_v1',
  FINANCIAL_SETTINGS: 'mb_personaliza_financial_settings_v1',
  FINANCIAL_AUDIT: 'mb_personaliza_financial_audit_v1',
  BACKUP_SCHEDULE: 'mb_personaliza_backup_schedule_v1',
  BACKUP_HISTORY: 'mb_personaliza_backup_history_v1',
  DELIVERY_SETTINGS: 'mb_personaliza_delivery_settings_v1',
  BOLETOS: 'mb_personaliza_boletos_v1',
  BOLETO_SETTINGS: 'mb_personaliza_boleto_settings_v1',
  COUPONS: 'mb_personaliza_coupons_v1',
  COUPON_USAGES: 'mb_personaliza_coupon_usages_v1',
  COUPON_SEND_HISTORY: 'mb_personaliza_coupon_send_history_v1',
  COUPON_AUDIT_LOGS: 'mb_personaliza_coupon_audit_logs_v1',
  FAVORITES: 'mb_personaliza_user_favorites_v1',
};

const memoryStore = new Map<string, any>();
let hasSyncedProductsFromPostgres = false;

function cloneFallback<T>(fallback: T): T {
  if (Array.isArray(fallback)) return [...fallback] as unknown as T;
  if (fallback && typeof fallback === 'object') return { ...(fallback as any) } as T;
  return fallback;
}

function getStored<T>(key: string, fallback: T): T {
  try {
    if (!memoryStore.has(key)) return cloneFallback(fallback);
    const val = memoryStore.get(key);
    if (val === null || val === undefined) return cloneFallback(fallback);
    return val as T;
  } catch {
    return cloneFallback(fallback);
  }
}

function setStored<T>(key: string, data: T): boolean {
  try {
    memoryStore.set(key, data);
    if (typeof window !== 'undefined') {
      setTimeout(() => {
        window.dispatchEvent(new Event('mb_storage_updated'));
      }, 0);
    }
    return true;
  } catch (err) {
    console.error(`Error updating in-memory key ${key}:`, err);
    return false;
  }
}

function syncToPostgres(endpoint: string, method: string = 'POST', data?: any) {
  try {
    if (typeof fetch === 'undefined') return;
    authFetch(`/api/db/${endpoint}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: data ? JSON.stringify(data) : undefined,
    }).catch((err) => {
      console.warn(`[PostgreSQL Sync Notice] ${endpoint}:`, err);
    });
  } catch {
    // ignore
  }
}

export const StorageService = {
  // Price Visibility Control (persisted in PostgreSQL, cached strictly in memory)
  getPriceVisibilityMode(): PriceVisibilityMode {
    return memoryPriceVisibilityMode;
  },
  setPriceVisibilityModeMemory(mode: PriceVisibilityMode): void {
    memoryPriceVisibilityMode = mode === 'all' ? 'all' : 'registered_only';
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('mb_price_visibility_updated', { detail: { mode: memoryPriceVisibilityMode } })
      );
      window.dispatchEvent(new Event('mb_storage_updated'));
    }
  },
  async savePriceVisibilityMode(
    mode: PriceVisibilityMode
  ): Promise<{ success: boolean; mode?: PriceVisibilityMode; error?: string }> {
    try {
      const res = await savePriceVisibilityApi(mode);
      if (res.success) {
        const nextMode = res.mode || res.priceVisibility || mode;
        this.setPriceVisibilityModeMemory(nextMode);
        await this.initPostgresSync();
        return { success: true, mode: nextMode };
      }
      return { success: false, error: res.error || 'Falha ao salvar visibilidade dos preços.' };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Erro de comunicação ao salvar visibilidade dos preços.' };
    }
  },
  canViewPrices(user?: UserProfile | null): boolean {
    const target = user !== undefined ? user : memoryCurrentUser;
    if (memoryPriceVisibilityMode === 'all') return true;
    return Boolean(target && target.role !== 'visitante' && target.status !== 'inativo');
  },

  // PostgreSQL Database Initialization & Real-time Synchronization
  async initPostgresSync(): Promise<boolean> {
    try {
      const res = await authFetch('/api/db/init', { cache: 'no-store' });
      if (!res.ok) return false;
      const json = await safeParseJson(res);
      if (!json || !json.success || !json.data) return false;

      const {
        products,
        categories,
        subcategories,
        quotes,
        orders,
        users,
        coupons,
        stockMovements,
        boletos,
        financialAccounts,
        pdvSales,
        cashSessions,
        paymentTransactions,
        settings,
      } = json.data;

      const resolvedMode: PriceVisibilityMode =
        json.priceVisibility === 'all' || settings?.price_visibility?.mode === 'all'
          ? 'all'
          : 'registered_only';
      memoryPriceVisibilityMode = resolvedMode;

      if (Array.isArray(products)) {
        const mappedProducts: Product[] = products.map((p: any) => ({
          id: p.id,
          code: p.code || 'PRD-001',
          name: p.name,
          slug: p.slug,
          categoryId: p.categoryId,
          subcategoryId: p.subcategoryId,
          description: p.description || p.shortDescription || '',
          base_price: Number(p.basePrice ?? p.base_price) || 0,
          promo_price:
            p.promoPrice !== undefined && p.promoPrice !== null
              ? Number(p.promoPrice)
              : p.promo_price !== undefined
              ? Number(p.promo_price)
              : undefined,
          cost_price: Number(p.costPrice ?? p.cost_price) || 0,
          profit_margin: Number(p.profitMargin ?? p.profit_margin) || 0,
          stock_qty: Number(p.stockQty ?? p.stock_qty) || 0,
          min_stock_alert: Number(p.minStockAlert ?? p.min_stock_alert) || 5,
          min_order_qty: Number(p.minOrderQty ?? p.min_order_qty) || 1,
          is_active: p.isActive ?? p.is_active ?? true,
          is_featured: p.isFeatured ?? p.is_featured ?? false,
          images: Array.isArray(p.images) ? p.images : [],
          badge: p.badge,
          show_price: p.showPrice ?? p.show_price ?? true,
          price_tiers: Array.isArray(p.priceTiers ?? p.price_tiers) ? (p.priceTiers ?? p.price_tiers) : [],
          variants: Array.isArray(p.variants) ? p.variants : [],
          details: p.details || { customTechniques: ['Laser', 'UV'] },
          barcode: p.barcode,
          qrCode: p.qrCode,
          createdAt: p.createdAt ? new Date(p.createdAt).toISOString() : new Date().toISOString(),
        }));
        hasSyncedProductsFromPostgres = true;
        setStored(STORAGE_KEYS.PRODUCTS, mappedProducts);
      }

      if (Array.isArray(categories) && categories.length > 0) {
        setStored(STORAGE_KEYS.CATEGORIES, categories);
      }
      if (Array.isArray(subcategories) && subcategories.length > 0) {
        setStored(STORAGE_KEYS.SUBCATEGORIES, subcategories);
      }
      if (Array.isArray(quotes)) {
        setStored(STORAGE_KEYS.QUOTES, quotes);
      }
      if (Array.isArray(orders)) {
        setStored(STORAGE_KEYS.ORDERS, orders);
      }
      if (Array.isArray(users)) {
        memoryUsers = users;
      } else {
        memoryUsers = [];
      }
      if (Array.isArray(coupons)) {
        setStored(STORAGE_KEYS.COUPONS, coupons);
      }
      if (Array.isArray(stockMovements)) {
        const mappedMovements: StockMovement[] = stockMovements.map((m: any) => ({
          id: m.id,
          productId: m.productId,
          productName: m.productName,
          productSku: m.productSku || m.product_sku || '',
          variantId: m.variantId,
          variantName: m.variantName || m.variantColor || undefined,
          type: (m.type || 'ajuste') as StockMovement['type'],
          quantity: Number(m.quantity) || 0,
          previous_stock: Number(m.previousStock ?? m.previous_stock ?? 0),
          new_stock: Number(m.newStock ?? m.new_stock ?? 0),
          reason: m.reason || '',
          operator_name: m.operatorName || m.operator_name || 'Sistema',
          created_at: m.createdAtText || m.created_at || new Date().toISOString(),
        }));
        setStored(STORAGE_KEYS.STOCK_MOVEMENTS, mappedMovements);
      }
      if (Array.isArray(boletos)) {
        setStored(STORAGE_KEYS.BOLETOS, boletos);
      }
      if (Array.isArray(financialAccounts)) {
        setStored(STORAGE_KEYS.FINANCIAL_ACCOUNTS, financialAccounts);
      }
      if (Array.isArray(pdvSales)) {
        setStored(STORAGE_KEYS.PDV_SALES, pdvSales);
      }
      if (Array.isArray(cashSessions)) {
        setStored(STORAGE_KEYS.CASH_REGISTER_SESSIONS, cashSessions);
      }
      if (Array.isArray(paymentTransactions)) {
        setStored(STORAGE_KEYS.PAYMENT_TRANSACTIONS, paymentTransactions);
      }
      if (settings?.company) {
        setStored(STORAGE_KEYS.COMPANY_SETTINGS, settings.company);
      }
      if (settings?.delivery) {
        setStored(STORAGE_KEYS.DELIVERY_SETTINGS, settings.delivery);
      }
      if (settings?.boleto) {
        setStored(STORAGE_KEYS.BOLETO_SETTINGS, settings.boleto);
      }
      if (settings?.layout) {
        setStored(STORAGE_KEYS.LAYOUT_SETTINGS, settings.layout);
      }
      if (settings?.maintenance) {
        setStored(STORAGE_KEYS.MAINTENANCE_SETTINGS, settings.maintenance);
      }
      if (settings?.permissions) {
        this.setPermissionsMatrixMemory(settings.permissions);
      }
      if (settings?.gateways) {
        setStored(STORAGE_KEYS.PAYMENT_GATEWAYS, settings.gateways);
      }
      if (settings?.pdv) {
        setStored(STORAGE_KEYS.PDV_SETTINGS, settings.pdv);
      }
      if (settings?.financial_settings) {
        setStored(STORAGE_KEYS.FINANCIAL_SETTINGS, settings.financial_settings);
      }
      if (settings?.financial_categories) {
        setStored(STORAGE_KEYS.FINANCIAL_CATEGORIES, settings.financial_categories);
      }
      if (settings?.cost_centers) {
        setStored(STORAGE_KEYS.COST_CENTERS, settings.cost_centers);
      }
      if (settings?.bank_accounts) {
        setStored(STORAGE_KEYS.BANK_ACCOUNTS, settings.bank_accounts);
      }
      if (settings?.financial_payment_methods) {
        setStored(STORAGE_KEYS.FINANCIAL_PAYMENT_METHODS, settings.financial_payment_methods);
      }

      try {
        const cartRes = await authFetch('/api/db/cart', { cache: 'no-store' });
        if (cartRes.ok) {
          const cartJson = await safeParseJson(cartRes);
          if (Array.isArray(cartJson?.items)) {
            memoryStore.set(STORAGE_KEYS.CART, cartJson.items);
          }
        }
      } catch {
        // ignore cart sync warning when DB unavailable
      }

      if (memoryCurrentUser && memoryCurrentUser.role !== 'visitante') {
        try {
          const favRes = await authFetch('/api/db/favorites', { cache: 'no-store' });
          if (favRes.ok) {
            const favJson = await safeParseJson(favRes);
            if (Array.isArray(favJson?.productIds)) {
              const map = getStored<Record<string, string[]>>(STORAGE_KEYS.FAVORITES, {});
              map[memoryCurrentUser.id] = favJson.productIds;
              memoryStore.set(STORAGE_KEYS.FAVORITES, map);
              memoryCurrentUser = { ...memoryCurrentUser, favoriteProductIds: favJson.productIds };
            }
          }
        } catch {
          // ignore favorites sync warning
        }
      }

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('mb_storage_updated'));
        window.dispatchEvent(new Event('mb_products_updated'));
      }
      return true;
    } catch (err) {
      console.warn('[StorageService] PostgreSQL sync warning:', err);
      return false;
    }
  },

  async getPostgresStatus(): Promise<any> {
    try {
      const res = await authFetch('/api/db/status');
      return (await safeParseJson(res)) || { success: false, error: 'Resposta inválida do servidor.' };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  async getVpsPreflightStatus(): Promise<any> {
    try {
      const res = await authFetch('/api/db/vps-preflight');
      return (await safeParseJson(res)) || { success: false, error: 'Resposta inválida do servidor.' };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  collectSystemSnapshot(): Record<string, any> {
    return {
      products: this.getProducts(),
      categories: this.getCategories(),
      subcategories: this.getSubcategories(),
      quotes: this.getQuotes(),
      orders: this.getOrders(),
      users: this.getUsers(),
      coupons: this.getCoupons(),
      stockMovements: this.getStockMovements(),
      boletos: this.getBoletos(),
      financialAccounts: getStored<FinancialAccount[]>(STORAGE_KEYS.FINANCIAL_ACCOUNTS, INITIAL_FINANCIAL_ACCOUNTS),
      pdvSales: this.getPDVSales(),
      cashSessions: this.getCashRegisterSessions(),
      paymentTransactions: this.getPaymentTransactions(),
      settings: {
        company: this.getCompanySettings(),
        delivery: this.getDeliverySettings(),
        boleto: this.getBoletoSettings(),
        layout: this.getLayoutSettings(),
        maintenance: this.getMaintenanceSettings(),
        permissions: this.getPermissionsMatrix(),
        gateways: this.getPaymentGateways(),
        pdv: this.getPDVSettings(),
        financial_settings: this.getFinancialSettings(),
        financial_categories: getStored<FinancialCategory[]>(STORAGE_KEYS.FINANCIAL_CATEGORIES, INITIAL_FINANCIAL_CATEGORIES),
        cost_centers: getStored<CostCenter[]>(STORAGE_KEYS.COST_CENTERS, INITIAL_COST_CENTERS),
        bank_accounts: getStored<BankAccount[]>(STORAGE_KEYS.BANK_ACCOUNTS, INITIAL_BANK_ACCOUNTS),
        financial_payment_methods: getStored<FinancialPaymentMethod[]>(STORAGE_KEYS.FINANCIAL_PAYMENT_METHODS, INITIAL_FINANCIAL_PAYMENT_METHODS),
      },
    };
  },

  async runControlledMigrationToPostgres(dryRun = true): Promise<any> {
    const snapshot = this.collectSystemSnapshot();
    const res = await authFetch('/api/db/migrate-local-storage', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ snapshot, dryRun }),
    });
    return (await safeParseJson(res)) || { success: false, error: 'Resposta inválida do servidor.' };
  },
  // Products
  getProducts(): Product[] {
    const p = getStored<Product[]>(STORAGE_KEYS.PRODUCTS, INITIAL_PRODUCTS);
    const list = hasSyncedProductsFromPostgres
      ? (Array.isArray(p) ? p : [])
      : (Array.isArray(p) && p.length > 0 ? p : INITIAL_PRODUCTS);
    const merged = hasSyncedProductsFromPostgres
      ? list
      : (() => {
          const existingIds = new Set(list.map((item) => item.id));
          const missing = INITIAL_PRODUCTS.filter((initProd) => !existingIds.has(initProd.id));
          return missing.length > 0 ? [...list, ...missing] : list;
        })();
    const allowedPrices = this.canViewPrices();

    // Sanitiza cada produto garantindo que details, customTechniques, images e variants existam
    return merged.map((prod) => {
      const safeCustomTechniques =
        Array.isArray(prod.details?.customTechniques) && prod.details.customTechniques.length > 0
          ? prod.details.customTechniques
          : ['Gravação a Laser', 'Silk Screen', 'Transfer DTF'];

      const baseSanitized: Product = {
        ...prod,
        details: {
          materials: 'Materiais de Alto Padrão',
          dimensions: 'Dimensões padrão',
          printAreas: 'Área frontal / traseira',
          customTechniques: safeCustomTechniques,
          ...(prod.details || {}),
        },
        images:
          Array.isArray(prod.images) && prod.images.length > 0
            ? prod.images
            : ['https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&q=80&w=800'],
        price_tiers: Array.isArray(prod.price_tiers) ? prod.price_tiers : [],
        variants: Array.isArray(prod.variants) ? prod.variants : [],
      };

      if (!allowedPrices) {
        return {
          ...baseSanitized,
          base_price: 0,
          promo_price: undefined,
          cost_price: 0,
          profit_margin: 0,
          price_tiers: [],
        };
      }

      return baseSanitized;
    });
  },
  saveProducts(products: Product[]): void {
    setStored(STORAGE_KEYS.PRODUCTS, products);
  },
  getProductById(id: string): Product | undefined {
    return this.getProducts().find((p) => p.id === id || p.slug === id);
  },
  saveProduct(product: Product): void {
    const products = this.getProducts();
    const index = products.findIndex((p) => p.id === product.id);
    if (index >= 0) {
      products[index] = product;
    } else {
      products.unshift(product);
    }
    this.saveProducts(products);
    syncToPostgres('products', 'POST', product);
  },
  deleteProduct(id: string): void {
    const products = this.getProducts().filter((p) => p.id !== id);
    this.saveProducts(products);
    syncToPostgres(`products/${id}`, 'DELETE');
  },

  // Categories
  getCategories(): Category[] {
    const c = getStored<Category[]>(STORAGE_KEYS.CATEGORIES, INITIAL_CATEGORIES);
    return Array.isArray(c) ? c : INITIAL_CATEGORIES;
  },
  saveCategories(categories: Category[]): void {
    setStored(STORAGE_KEYS.CATEGORIES, categories);
  },
  saveCategory(category: Category): { success: boolean; error?: string } {
    const list = this.getCategories();
    const idx = list.findIndex((c) => c.id === category.id);
    if (idx >= 0) {
      list[idx] = category;
    } else {
      list.push(category);
    }
    this.saveCategories(list);
    syncToPostgres('categories', 'POST', category);
    return { success: true };
  },
  deleteCategory(id: string): { success: boolean; error?: string } {
    const prods = this.getProducts();
    const linkedCount = prods.filter((p) => p.categoryId === id).length;
    if (linkedCount > 0) {
      return {
        success: false,
        error: `Não é possível excluir a categoria: existem ${linkedCount} produtos vinculados a ela. Mova os produtos para outra categoria antes de remover.`,
      };
    }
    const categories = this.getCategories().filter((c) => c.id !== id);
    this.saveCategories(categories);
    const subcats = this.getSubcategories().filter((s) => s.categoryId !== id);
    this.saveSubcategories(subcats);
    return { success: true };
  },
  getSubcategories(): Subcategory[] {
    const s = getStored<Subcategory[]>(STORAGE_KEYS.SUBCATEGORIES, INITIAL_SUBCATEGORIES);
    return Array.isArray(s) ? s : INITIAL_SUBCATEGORIES;
  },
  saveSubcategories(subcategories: Subcategory[]): void {
    setStored(STORAGE_KEYS.SUBCATEGORIES, subcategories);
  },
  saveSubcategory(subcategory: Subcategory): { success: boolean; error?: string } {
    const list = this.getSubcategories();
    const idx = list.findIndex((s) => s.id === subcategory.id);
    if (idx >= 0) {
      list[idx] = subcategory;
    } else {
      list.push(subcategory);
    }
    this.saveSubcategories(list);
    syncToPostgres('subcategories', 'POST', subcategory);
    return { success: true };
  },
  deleteSubcategory(id: string): { success: boolean; error?: string } {
    const prods = this.getProducts();
    const linkedCount = prods.filter((p) => p.subcategoryId === id).length;
    if (linkedCount > 0) {
      return {
        success: false,
        error: `Não é possível excluir a subcategoria: existem ${linkedCount} produtos vinculados a ela.`,
      };
    }
    const subcats = this.getSubcategories().filter((s) => s.id !== id);
    this.saveSubcategories(subcats);
    return { success: true };
  },

  // Quotes
  getQuotes(): Quote[] {
    const q = getStored<Quote[]>(STORAGE_KEYS.QUOTES, []);
    return Array.isArray(q) ? q : [];
  },
  saveQuotes(quotes: Quote[]): void {
    setStored(STORAGE_KEYS.QUOTES, quotes);
  },
  addQuote(quote: Quote): Quote {
    const quotes = this.getQuotes();
    quotes.unshift(quote);
    this.saveQuotes(quotes);
    syncToPostgres('quotes', 'POST', quote);
    return quote;
  },
  updateQuote(quote: Quote): void {
    const quotes = this.getQuotes();
    const index = quotes.findIndex((q) => q.id === quote.id);
    if (index >= 0) {
      quotes[index] = { ...quote, updatedAt: new Date().toISOString() };
      this.saveQuotes(quotes);
      syncToPostgres('quotes', 'POST', quotes[index]);
    }
  },

  // Orders
  getOrders(): Order[] {
    const o = getStored<Order[]>(STORAGE_KEYS.ORDERS, []);
    return Array.isArray(o) ? o : [];
  },
  saveOrders(orders: Order[]): void {
    setStored(STORAGE_KEYS.ORDERS, orders);
  },
  addOrder(order: Order): Order {
    const orders = this.getOrders();
    orders.unshift(order);
    this.saveOrders(orders);
    syncToPostgres('orders', 'POST', order);

    // Record stock deduction for products
    order.items.forEach((item) => {
      this.recordStockMovement({
        productId: item.productId,
        productName: item.productName,
        productSku: item.productSku,
        variantName: item.variantName,
        type: 'saida',
        quantity: item.quantity,
        reason: `Venda gerada no Pedido ${order.code}`,
        operator_name: 'Sistema Automático de Vendas',
      });
    });

    // Record coupon usage if coupon applied
    if (order.couponInfo || order.couponCode) {
      const cInfo = order.couponInfo;
      const couponCode = cInfo?.code || order.couponCode || '';
      const coupon = this.getCouponByCode(couponCode);
      if (coupon) {
        this.recordCouponUsage({
          id: `cuse-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          couponId: coupon.id,
          couponCode: coupon.code,
          orderId: order.id,
          orderCode: order.code,
          customerId: order.clientId,
          customerName: order.clientName,
          customerEmail: order.clientEmail,
          customerPhone: order.clientPhone,
          customerCpfCnpj: undefined,
          subtotalOriginal: cInfo?.originalSubtotal ?? order.subtotal,
          eligibleAmount: cInfo?.eligibleSubtotal ?? order.subtotal,
          discountApplied: cInfo?.discountApplied ?? order.couponDiscount ?? order.discount,
          shippingCost: order.shippingCost,
          finalTotal: order.total,
          usedAt: new Date().toISOString(),
          status: 'confirmed',
        });
      }
    }

    return order;
  },
  updateOrder(order: Order): void {
    const orders = this.getOrders();
    const index = orders.findIndex((o) => o.id === order.id);
    if (index >= 0) {
      orders[index] = { ...order, updatedAt: new Date().toISOString() };
      this.saveOrders(orders);
    }
  },

  updateOrderStatus(
    orderId: string,
    status: Order['orderStatus'],
    trackingCode?: string,
    notes?: string
  ): { success: boolean; error?: string } {
    const orders = this.getOrders();
    const index = orders.findIndex((o) => o.id === orderId);
    if (index < 0) return { success: false, error: 'Pedido não encontrado.' };

    const order = orders[index];

    // Validação de Integridade: Não permitir alterar para pronto/entregue se frete aguarda definição
    if (
      (status === 'pronto' || status === 'entregue') &&
      order.shippingInfo?.methodType === 'transportadora' &&
      order.shippingInfo?.freightStatus === 'aguardando_cotacao'
    ) {
      return {
        success: false,
        error: 'Não é possível avançar o pedido para pronto/entregue enquanto o frete da transportadora estiver aguardando definição/cotação.',
      };
    }

    orders[index].orderStatus = status;
    if (trackingCode !== undefined) orders[index].trackingCode = trackingCode;
    if (notes !== undefined) orders[index].notes = notes;
    orders[index].updatedAt = new Date().toISOString();
    this.saveOrders(orders);

    // If order was cancelled, release coupon quota
    if (status === 'cancelado' && (order.couponInfo || order.couponCode)) {
      this.cancelCouponUsage(order.id, `Cancelamento do pedido ${order.code} via status de pedido`);
    }

    return { success: true };
  },

  updateOrderShipping(
    orderId: string,
    update: {
      freightStatus?: 'aguardando_cotacao' | 'proposta_enviada' | 'aprovado' | 'recusado' | 'definido';
      negotiatedCost?: number;
      negotiatedCarrier?: string;
      negotiatedDeadlineDays?: number;
      proposalNotes?: string;
      customerResponseNotes?: string;
      trackingCode?: string;
      actorName?: string;
      actionDescription?: string;
    }
  ): { success: boolean; error?: string } {
    const orders = this.getOrders();
    const index = orders.findIndex((o) => o.id === orderId);
    if (index < 0) return { success: false, error: 'Pedido não encontrado.' };

    const order = orders[index];
    const shippingInfo = order.shippingInfo || {
      methodId: 'sm-transportadora',
      methodName: 'Transportadora — Frete a Combinar',
      methodType: 'transportadora',
      cost: 0,
      freightStatus: 'aguardando_cotacao',
    };

    const history = [...(shippingInfo.history || [])];

    if (update.actionDescription) {
      history.push({
        id: `sh-hist-${Date.now()}`,
        date: new Date().toISOString(),
        action: update.freightStatus || 'atualizacao',
        actor: update.actorName || 'Administrador MB',
        details: update.actionDescription,
      });
    }

    // Se frete aprovado ou definido, atualiza custo de frete no pedido e recalcula total
    let newShippingCost = order.shippingCost;
    if (update.negotiatedCost !== undefined && (update.freightStatus === 'aprovado' || update.freightStatus === 'definido')) {
      newShippingCost = Number(update.negotiatedCost);
    }

    const updatedShippingInfo = {
      ...shippingInfo,
      history,
      ...(update.freightStatus !== undefined ? { freightStatus: update.freightStatus } : {}),
      ...(update.negotiatedCost !== undefined ? { negotiatedCost: update.negotiatedCost, cost: newShippingCost } : {}),
      ...(update.negotiatedCarrier !== undefined ? { negotiatedCarrier: update.negotiatedCarrier, carrierName: update.negotiatedCarrier } : {}),
      ...(update.negotiatedDeadlineDays !== undefined ? { negotiatedDeadlineDays: update.negotiatedDeadlineDays, estimatedDeliveryDays: update.negotiatedDeadlineDays } : {}),
      ...(update.proposalNotes !== undefined ? { proposalNotes: update.proposalNotes } : {}),
      ...(update.customerResponseNotes !== undefined ? { customerResponseNotes: update.customerResponseNotes } : {}),
      ...(update.freightStatus === 'proposta_enviada' ? { proposalSentAt: new Date().toISOString() } : {}),
      ...(update.freightStatus === 'aprovado' || update.freightStatus === 'recusado' ? { customerRespondedAt: new Date().toISOString() } : {}),
    };

    orders[index].shippingInfo = updatedShippingInfo;
    orders[index].shippingCost = newShippingCost;
    orders[index].total = Number((orders[index].subtotal - orders[index].discount + newShippingCost).toFixed(2));
    if (update.trackingCode !== undefined) {
      orders[index].trackingCode = update.trackingCode;
    }
    orders[index].updatedAt = new Date().toISOString();

    this.saveOrders(orders);
    return { success: true };
  },

  // Convert Quote to Order
  convertQuoteToOrder(quoteId: string, requestedPaymentMethod?: Order['paymentMethod']): Order | null {
    const quotes = this.getQuotes();
    const quote = quotes.find((q) => q.id === quoteId);
    if (!quote) return null;

    // Bloqueia conversão se a proposta estiver cancelada ou recusada
    if (quote.status === 'recusado' || quote.status === 'cancelado') {
      console.warn(`Tentativa de conversão de proposta cancelada/recusada bloqueada: ${quote.code}`);
      return null;
    }

    // Verifica se a proposta possui faturamento a prazo expressamente autorizado
    const isDeferredAuthorized = Boolean(
      quote.billingTerms?.isDeferredAuthorized && quote.billingTerms?.type === 'faturado_prazo'
    );
    // Se não for autorizado, impede faturamento a prazo mesmo que solicitado
    const effectivePaymentMethod: Order['paymentMethod'] = isDeferredAuthorized
      ? 'boleto_faturado'
      : (requestedPaymentMethod === 'boleto_faturado' || requestedPaymentMethod === 'faturado_pj')
      ? 'boleto'
      : (requestedPaymentMethod || 'boleto');

    const orderNumber = Math.floor(1000 + Math.random() * 9000);
    const newOrder: Order = {
      id: `ord-converted-${Date.now()}`,
      code: `PED-2026-${orderNumber}`,
      clientId: quote.clientId || 'user_cliente',
      clientName: quote.clientName,
      clientEmail: quote.clientEmail,
      clientPhone: quote.clientPhone,
      clientCompany: quote.clientCompany,
      shippingAddress: {
        street: 'Endereço Comercial da Empresa',
        number: 'S/N',
        neighborhood: 'Centro',
        city: quote.deliveryCityState ? quote.deliveryCityState.split('-')[0].trim() : 'São Paulo',
        state: quote.deliveryCityState && quote.deliveryCityState.includes('-') ? quote.deliveryCityState.split('-')[1].trim() : 'SP',
        zip: '01000-000',
      },
      items: quote.items.map((qi, idx) => ({
        id: `oi-${Date.now()}-${idx}`,
        productId: qi.productId,
        productName: qi.productName,
        productSku: qi.productSku,
        productImage: qi.productImage,
        variantName: qi.variantName,
        unitPrice: qi.unit_price_estimated || 0,
        quantity: qi.quantity,
        total: (qi.unit_price_estimated || 0) * qi.quantity,
        customTechnique: qi.customTechnique,
        customArtworkName: quote.artworkName,
      })),
      subtotal: quote.totalEstimated || 0,
      discount: 0,
      shippingCost: 0,
      total: quote.totalEstimated || 0,
      paymentMethod: effectivePaymentMethod,
      // Boleto inicia como pendente até confirmação bancária/baixa válida
      paymentStatus: 'pendente',
      orderStatus: 'novo',
      sourceQuoteId: quote.id,
      billingTerms: quote.billingTerms,
      notes: `Convertido a partir do Orçamento ${quote.code}. ${
        isDeferredAuthorized
          ? `Condição de Faturamento a Prazo Aprovada: ${quote.billingTerms?.conditionName || 'Faturado'}.`
          : 'Pagamento por Boleto à Vista.'
      } ${quote.adminNotes || ''}`,
      createdAt: new Date().toISOString(),
    };

    // Mark quote as converted
    quote.status = 'convertido';
    this.updateQuote(quote);

    // Save order & trigger stock movement
    const savedOrder = this.addOrder(newOrder);

    // Gera automaticamente os boletos e integra com Contas a Receber
    if (effectivePaymentMethod === 'boleto_faturado') {
      this.generateBoletosForOrder({
        order: savedOrder,
        quote,
        tipoCobranca: 'faturado_prazo',
      });
    } else if (effectivePaymentMethod === 'boleto') {
      this.generateBoletosForOrder({
        order: savedOrder,
        quote,
        tipoCobranca: 'a_vista',
      });
    }

    return savedOrder;
  },

  // Stock movements
  getStockMovements(): StockMovement[] {
    const s = getStored<StockMovement[]>(STORAGE_KEYS.STOCK_MOVEMENTS, []);
    return Array.isArray(s) ? s : [];
  },
  recordStockMovement(params: {
    productId: string;
    productName: string;
    productSku: string;
    variantId?: string;
    variantName?: string;
    type: 'entrada' | 'saida' | 'ajuste' | 'perda';
    quantity: number;
    reason: string;
    operator_name: string;
  }): void {
    const products = this.getProducts();
    const product = products.find((p) => p.id === params.productId);
    const prevStock = product ? product.stock_qty : 0;
    let newStock = prevStock;

    if (params.type === 'entrada') newStock += params.quantity;
    else if (params.type === 'saida' || params.type === 'perda') newStock = Math.max(0, newStock - params.quantity);
    else if (params.type === 'ajuste') newStock = params.quantity;

    if (product) {
      product.stock_qty = newStock;
      // Also update variant stock if specified
      if (params.variantId && product.variants) {
        const variant = product.variants.find((v) => v.id === params.variantId);
        if (variant) {
          if (params.type === 'entrada') variant.stock_qty += params.quantity;
          else if (params.type === 'saida' || params.type === 'perda') variant.stock_qty = Math.max(0, variant.stock_qty - params.quantity);
          else if (params.type === 'ajuste') variant.stock_qty = params.quantity;
        }
      }
      this.saveProducts(products);
    }

    const movements = this.getStockMovements();
    const movement: StockMovement = {
      id: `mov-${Date.now()}`,
      productId: params.productId,
      productName: params.productName,
      productSku: params.productSku,
      variantId: params.variantId,
      variantName: params.variantName,
      type: params.type,
      quantity: params.quantity,
      previous_stock: prevStock,
      new_stock: newStock,
      reason: params.reason,
      operator_name: params.operator_name,
      created_at: new Date().toISOString(),
    };
    movements.unshift(movement);
    setStored(STORAGE_KEYS.STOCK_MOVEMENTS, movements);
    syncToPostgres('stock-movements', 'POST', movement);
  },

  // Company Settings
  getCompanySettings(): CompanySettings {
    const stored = getStored<Partial<CompanySettings>>(STORAGE_KEYS.COMPANY_SETTINGS, INITIAL_COMPANY_SETTINGS);
    const contacts =
      Array.isArray(stored.whatsappContacts) && stored.whatsappContacts.length > 0
        ? stored.whatsappContacts
        : INITIAL_COMPANY_SETTINGS.whatsappContacts;

    const defaultContact = contacts?.find((c) => c.isDefault) || contacts?.[0];
    const primaryNumber = defaultContact?.number || stored.whatsapp || INITIAL_COMPANY_SETTINGS.whatsapp;

    const maintenanceStored = getStored<Partial<MaintenanceSettings>>(
      STORAGE_KEYS.MAINTENANCE_SETTINGS,
      stored.maintenance || INITIAL_MAINTENANCE_SETTINGS
    );

    const mergedMaintenance: MaintenanceSettings = {
      ...INITIAL_MAINTENANCE_SETTINGS,
      ...(stored.maintenance || {}),
      ...(maintenanceStored || {}),
    };

    return {
      ...INITIAL_COMPANY_SETTINGS,
      ...stored,
      whatsapp: primaryNumber,
      whatsappContacts: contacts,
      maintenance: mergedMaintenance,
      address: {
        ...INITIAL_COMPANY_SETTINGS.address,
        ...(stored.address || {}),
      },
      bankInfo: {
        ...INITIAL_COMPANY_SETTINGS.bankInfo,
        ...(stored.bankInfo || {}),
      },
      socialLinks: {
        ...INITIAL_COMPANY_SETTINGS.socialLinks,
        ...(stored.socialLinks || {}),
      },
    };
  },

  // Maintenance Mode Management
  getMaintenanceSettings(): MaintenanceSettings {
    const company = this.getCompanySettings();
    return company.maintenance || INITIAL_MAINTENANCE_SETTINGS;
  },

  setMaintenanceMemory(maintenance: MaintenanceSettings): void {
    memoryStore.set(STORAGE_KEYS.MAINTENANCE_SETTINGS, maintenance);
    const company = this.getCompanySettings();
    memoryStore.set(STORAGE_KEYS.COMPANY_SETTINGS, { ...company, maintenance });
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('mb_maintenance_updated', { detail: maintenance }));
    }
  },

  saveMaintenanceSettings(
    newSettings: MaintenanceSettings,
    user?: UserProfile,
    actionType?: 'activated' | 'deactivated' | 'config_updated'
  ): { success: boolean; error?: string } {
    try {
      const current = this.getMaintenanceSettings();
      const updatedTimestamp = new Date().toISOString();
      const auditLog = [...(current.auditLog || [])];

      // Automatically record audit log entry if action is specified or status changed
      const determinedAction =
        actionType ||
        (newSettings.enabled !== current.enabled
          ? newSettings.enabled
            ? 'activated'
            : 'deactivated'
          : 'config_updated');

      if (user) {
        const auditEntry: MaintenanceModeAuditEntry = {
          id: `audit-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          action: determinedAction,
          timestamp: updatedTimestamp,
          performedBy: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
          },
          details:
            determinedAction === 'activated'
              ? `Modo de manutenção ATIVADO. Previsão: ${newSettings.returnAt || 'Não informada'}`
              : determinedAction === 'deactivated'
              ? 'Modo de manutenção DESATIVADO. Sistema liberado para clientes.'
              : 'Configurações de apresentação da página de manutenção atualizadas.',
        };
        auditLog.unshift(auditEntry);
      }

      const finalSettings: MaintenanceSettings = {
        ...current,
        ...newSettings,
        auditLog: auditLog.slice(0, 50), // keep last 50 entries
        updatedAt: updatedTimestamp,
        updatedBy: user
          ? {
              id: user.id,
              name: user.name,
              email: user.email,
              role: user.role,
            }
          : current.updatedBy,
      };

      // Save to dedicated key and company settings
      setStored(STORAGE_KEYS.MAINTENANCE_SETTINGS, finalSettings);
      syncToPostgres('settings/maintenance', 'POST', { value: finalSettings });

      const company = this.getCompanySettings();
      company.maintenance = finalSettings;
      company.updatedAt = updatedTimestamp;
      setStored(STORAGE_KEYS.COMPANY_SETTINGS, company);
      syncToPostgres('settings/company', 'POST', { value: company });

      // Background sync to backend Express API server (uses authenticated session token)
      if (typeof fetch !== 'undefined') {
        authFetch('/api/system/maintenance', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(finalSettings),
        }).catch((err) => {
          console.warn('Backend maintenance sync notice:', err);
        });
      }

      // Notify window listeners
      if (typeof window !== 'undefined') {
        setTimeout(() => {
          window.dispatchEvent(
            new CustomEvent('mb_maintenance_updated', { detail: finalSettings })
          );
          window.dispatchEvent(
            new CustomEvent('mb_company_settings_updated', { detail: company })
          );
          window.dispatchEvent(new Event('mb_storage_updated'));
        }, 0);
      }

      return { success: true };
    } catch (err: any) {
      console.error('Error saving maintenance settings:', err);
      return { success: false, error: err?.message || 'Erro ao salvar modo de manutenção.' };
    }
  },

  toggleMaintenanceMode(
    enable: boolean,
    user: UserProfile,
    customReturnAt?: string
  ): { success: boolean; error?: string } {
    const current = this.getMaintenanceSettings();
    return this.saveMaintenanceSettings(
      {
        ...current,
        enabled: enable,
        returnAt: customReturnAt !== undefined ? customReturnAt : current.returnAt,
      },
      user,
      enable ? 'activated' : 'deactivated'
    );
  },
  saveCompanySettings(settings: CompanySettings): { success: boolean; error?: string } {
    try {
      settings.updatedAt = new Date().toISOString();
      if (settings.whatsappContacts && settings.whatsappContacts.length > 0) {
        const def = settings.whatsappContacts.find((c) => c.isDefault) || settings.whatsappContacts[0];
        if (def && def.number) {
          settings.whatsapp = def.number;
        }
      }
      const saved = setStored(STORAGE_KEYS.COMPANY_SETTINGS, settings);
      
      if (!saved) {
        return {
          success: false,
          error: 'Não foi possível atualizar as configurações em memória.',
        };
      }

      // Sync company settings to PostgreSQL
      syncToPostgres('settings/company', 'POST', { value: settings });

      // Update favicon in browser head if provided
      if (settings.faviconUrl && typeof document !== 'undefined') {
        let link = document.querySelector<HTMLLinkElement>("link[rel*='icon']");
        if (!link) {
          link = document.createElement('link');
          link.rel = 'shortcut icon';
          document.getElementsByTagName('head')[0]?.appendChild(link);
        }
        link.href = settings.faviconUrl;
      }

      // Notify application of company settings change asynchronously to avoid setState during render
      if (typeof window !== 'undefined') {
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('mb_company_settings_updated', { detail: settings }));
          window.dispatchEvent(new Event('mb_storage_updated'));
        }, 0);
      }

      return { success: true };
    } catch (err: any) {
      console.error('Error saving company settings:', err);
      return { success: false, error: err?.message || 'Erro inesperado ao salvar.' };
    }
  },
  resetCompanySettings(): { success: boolean } {
    setStored(STORAGE_KEYS.COMPANY_SETTINGS, INITIAL_COMPANY_SETTINGS);
    if (typeof window !== 'undefined') {
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('mb_company_settings_updated', { detail: INITIAL_COMPANY_SETTINGS }));
        window.dispatchEvent(new Event('mb_storage_updated'));
      }, 0);
    }
    return { success: true };
  },

  // ==========================================
  // CONFIGURAÇÕES DE ATENDIMENTO E ENTREGA (SHIPPING & DELIVERY)
  // ==========================================

  getDeliverySettings(): DeliveryAndShippingSettings {
    const stored = getStored<DeliveryAndShippingSettings | null>(STORAGE_KEYS.DELIVERY_SETTINGS, null);
    if (!stored) {
      return { ...INITIAL_DELIVERY_SETTINGS };
    }
    return {
      ...INITIAL_DELIVERY_SETTINGS,
      ...stored,
      serviceRegion: {
        ...INITIAL_DELIVERY_SETTINGS.serviceRegion,
        ...(stored.serviceRegion || {}),
        municipalConfig: {
          ...INITIAL_DELIVERY_SETTINGS.serviceRegion.municipalConfig,
          ...(stored.serviceRegion?.municipalConfig || {}),
          exceptions: stored.serviceRegion?.municipalConfig?.exceptions || INITIAL_DELIVERY_SETTINGS.serviceRegion.municipalConfig.exceptions,
        },
        stateConfig: {
          ...INITIAL_DELIVERY_SETTINGS.serviceRegion.stateConfig,
          ...(stored.serviceRegion?.stateConfig || {}),
          exceptions: stored.serviceRegion?.stateConfig?.exceptions || INITIAL_DELIVERY_SETTINGS.serviceRegion.stateConfig.exceptions,
        },
      },
      correiosConfig: {
        ...INITIAL_DELIVERY_SETTINGS.correiosConfig,
        ...(stored.correiosConfig || {}),
      },
      methods: Array.isArray(stored.methods) && stored.methods.length > 0 ? stored.methods : INITIAL_DELIVERY_SETTINGS.methods,
      carriersList: Array.isArray(stored.carriersList) && stored.carriersList.length > 0 ? stored.carriersList : INITIAL_DELIVERY_SETTINGS.carriersList,
    };
  },

  saveDeliverySettings(settings: DeliveryAndShippingSettings): { success: boolean; error?: string } {
    try {
      settings.updatedAt = new Date().toISOString();
      const saved = setStored(STORAGE_KEYS.DELIVERY_SETTINGS, settings);
      if (!saved) {
        return { success: false, error: 'Falha ao salvar configurações de entrega no armazenamento.' };
      }
      syncToPostgres('settings/delivery', 'POST', { value: settings });
      if (typeof window !== 'undefined') {
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('mb_delivery_settings_updated', { detail: settings }));
          window.dispatchEvent(new Event('mb_storage_updated'));
        }, 0);
      }
      return { success: true };
    } catch (err: any) {
      console.error('Error saving delivery settings:', err);
      return { success: false, error: err?.message || 'Erro inesperado ao salvar configurações de entrega.' };
    }
  },

  resetDeliverySettings(): { success: boolean } {
    setStored(STORAGE_KEYS.DELIVERY_SETTINGS, INITIAL_DELIVERY_SETTINGS);
    syncToPostgres('settings/delivery', 'POST', { value: INITIAL_DELIVERY_SETTINGS });
    if (typeof window !== 'undefined') {
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('mb_delivery_settings_updated', { detail: INITIAL_DELIVERY_SETTINGS }));
        window.dispatchEvent(new Event('mb_storage_updated'));
      }, 0);
    }
    return { success: true };
  },

  // ==========================================
  // REGRAS DE BOLETO BANCÁRIO & FATURAMENTO A PRAZO
  // ==========================================

  getBoletoSettings(): BoletoBillingSettings {
    const stored = getStored<BoletoBillingSettings | null>(STORAGE_KEYS.BOLETO_SETTINGS, null);
    if (!stored) {
      return { ...INITIAL_BOLETO_SETTINGS };
    }
    return {
      ...INITIAL_BOLETO_SETTINGS,
      ...stored,
      standardPaymentTerms: Array.isArray(stored.standardPaymentTerms)
        ? stored.standardPaymentTerms
        : INITIAL_BOLETO_SETTINGS.standardPaymentTerms,
    };
  },

  saveBoletoSettings(
    settings: BoletoBillingSettings,
    operatorName: string = 'Administrador'
  ): { success: boolean; error?: string } {
    try {
      // Regra fundamental inviolável: Compras comuns da loja virtual são SEMPRE à vista por boleto
      settings.commonPurchaseNoticeText =
        'O pagamento por boleto a prazo está disponível exclusivamente para propostas comerciais ou orçamentos personalizados aprovados e autorizados. Para compras comuns, o boleto é somente à vista.';
      settings.updatedAt = new Date().toISOString();
      settings.updatedBy = operatorName;

      const saved = setStored(STORAGE_KEYS.BOLETO_SETTINGS, settings);
      if (!saved) {
        return { success: false, error: 'Falha ao salvar configurações de boleto no armazenamento.' };
      }
      syncToPostgres('settings/boleto', 'POST', { value: settings });

      this.addFinancialAuditEntry({
        userId: 'admin_sys',
        userName: operatorName,
        userEmail: 'financeiro@mbpersonaliza.com.br',
        userRole: 'admin',
        operation: 'ATUALIZAR_CONFIGURACOES_BOLETO',
        affectedRecordType: 'configuracao_boleto',
        result: 'sucesso',
        details: `Configurações de faturamento por boleto atualizadas por ${operatorName}. Prazo max: ${settings.maxDeferredDays}d, Parcelas max: ${settings.maxInstallments}x, Alçada financeira: R$ ${settings.requireFinancialApprovalOverAmount}.`,
        origin: 'web_painel',
      });

      if (typeof window !== 'undefined') {
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('mb_boleto_settings_updated', { detail: settings }));
          window.dispatchEvent(new Event('mb_storage_updated'));
        }, 0);
      }

      return { success: true };
    } catch (err: any) {
      console.error('Error saving boleto settings:', err);
      return { success: false, error: err?.message || 'Erro inesperado ao salvar configurações de boleto.' };
    }
  },

  getBoletos(): BoletoTitulo[] {
    const raw = getStored<BoletoTitulo[]>(STORAGE_KEYS.BOLETOS, INITIAL_BOLETOS);
    return Array.isArray(raw) ? raw : INITIAL_BOLETOS;
  },

  saveBoletos(boletos: BoletoTitulo[]): void {
    setStored(STORAGE_KEYS.BOLETOS, boletos);
    if (typeof window !== 'undefined') {
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('mb_boletos_updated', { detail: boletos }));
        window.dispatchEvent(new Event('mb_storage_updated'));
      }, 0);
    }
  },

  getBoletoById(id: string): BoletoTitulo | undefined {
    return this.getBoletos().find((b) => b.id === id);
  },

  getBoletosByOrderId(orderId: string): BoletoTitulo[] {
    return this.getBoletos().filter((b) => b.orderId === orderId);
  },

  getBoletosByQuoteId(quoteId: string): BoletoTitulo[] {
    return this.getBoletos().filter((b) => b.quoteId === quoteId);
  },

  // Validação estrita das regras de negócio de faturamento a prazo por boleto
  validateBoletoEligibility(params: {
    isCommonStorePurchase: boolean;
    customerCpfCnpj?: string;
    quoteId?: string;
    requestedDeferred: boolean;
  }): { allowed: boolean; error?: string; reason?: string } {
    const { isCommonStorePurchase, quoteId, requestedDeferred } = params;

    if (!requestedDeferred) {
      // Boleto à vista é sempre permitido para PF e PJ em qualquer modalidade
      return { allowed: true };
    }

    // REGRA 1: Compra comum na loja virtual NUNCA permite boleto a prazo (nem PF nem PJ)
    if (isCommonStorePurchase) {
      return {
        allowed: false,
        error:
          'O pagamento por boleto a prazo está disponível exclusivamente para propostas comerciais ou orçamentos personalizados aprovados e autorizados. Para compras comuns, o boleto é somente à vista.',
        reason: 'COMPRA_COMUM_BLOQUEADA_A_PRAZO',
      };
    }

    // REGRA 2: Faturamento a prazo exige proposta comercial ou orçamento aprovado
    if (!quoteId) {
      return {
        allowed: false,
        error:
          'Faturamento a prazo bloqueado: Esta operação não possui vínculo com proposta comercial ou orçamento aprovado.',
        reason: 'SEM_DOCUMENTO_COMERCIAL',
      };
    }

    const quotes = this.getQuotes();
    const quote = quotes.find((q) => q.id === quoteId);
    if (!quote) {
      return {
        allowed: false,
        error: 'Proposta comercial ou orçamento de origem não localizado no sistema.',
        reason: 'PROPOSTA_NAO_ENCONTRADA',
      };
    }

    // REGRA 3: Não permitir propostas canceladas ou recusadas
    if (quote.status === 'recusado' || (quote as any).status === 'cancelado') {
      return {
        allowed: false,
        error:
          'Operação bloqueada: A proposta comercial vinculada encontra-se recusada ou cancelada.',
        reason: 'DOCUMENTO_CANCELADO_OU_RECUSADO',
      };
    }

    // REGRA 4: Proposta/Orçamento deve conter autorização expressa de faturamento a prazo
    const isAuthorized = quote.billingTerms?.isDeferredAuthorized;
    if (!isAuthorized) {
      return {
        allowed: false,
        error:
          'Operação bloqueada: A proposta comercial selecionada não possui autorização expressa da gerência para faturamento a prazo por boleto.',
        reason: 'PRAZO_NAO_AUTORIZADO',
      };
    }

    return { allowed: true };
  },

  // Geração de títulos de boleto e integração imediata com o módulo Financeiro / Contas a Receber
  generateBoletosForOrder(params: {
    order: Order;
    quote?: Quote;
    tipoCobranca: 'a_vista' | 'faturado_prazo';
    installmentsCount?: number;
    customDueDate?: string;
    customCondition?: string;
    operatorName?: string;
  }): { success: boolean; boletos: BoletoTitulo[]; error?: string } {
    const { order, quote, tipoCobranca, operatorName = 'Sistema Comercial' } = params;
    const settings = this.getBoletoSettings();

    // Validação de segurança
    const isCommonPurchase = !order.sourceQuoteId && !quote;
    const validation = this.validateBoletoEligibility({
      isCommonStorePurchase: isCommonPurchase,
      customerCpfCnpj: order.clientEmail,
      quoteId: order.sourceQuoteId || quote?.id,
      requestedDeferred: tipoCobranca === 'faturado_prazo',
    });

    if (!validation.allowed) {
      return { success: false, boletos: [], error: validation.error };
    }

    const boletosGerados: BoletoTitulo[] = [];
    const existingBoletos = this.getBoletos();

    if (tipoCobranca === 'a_vista') {
      // Boleto à Vista (1 parcela)
      const dueDate = params.customDueDate || calcularDataVencimento(settings.cashBoletoDueDays);
      const bol = criarBoletoTitulo({
        orderId: order.id,
        orderCode: order.code,
        quoteId: quote?.id || order.sourceQuoteId,
        quoteCode: quote?.code,
        customerName: order.clientName,
        customerCpfCnpj: quote?.clientCpfCnpj || (order as any).clientCpfCnpj || '000.000.000-00',
        customerEmail: order.clientEmail,
        customerAddress: `${order.shippingAddress.street}, ${order.shippingAddress.number} - ${order.shippingAddress.neighborhood}, ${order.shippingAddress.city}/${order.shippingAddress.state}`,
        amount: order.total,
        dueDate,
        installmentNumber: 1,
        totalInstallments: 1,
        conditionName: 'Boleto à Vista',
        tipoCobranca: 'a_vista',
        settings,
      });

      // Integração com Contas a Receber
      const newRec = this.createFinancialAccount(
        {
          type: 'receber',
          description: `Boleto à Vista - Pedido #${order.code}`,
          entityName: bol.sacadoNome,
          entityDocument: bol.sacadoCpfCnpj,
          amount: bol.valorOriginal,
          dueDate: bol.dataVencimento,
          issueDate: bol.dataEmissao,
          status: 'pendente',
          categoryId: 'cat-rec-1',
          categoryName: 'Vendas Loja Online & E-commerce',
          costCenterId: 'cc-1',
          costCenterName: 'Comercial & Vendas',
          paymentMethod: 'Boleto Bancário à Vista',
          orderCode: order.code,
          quoteCode: bol.quoteCode,
          notes: `Linha Digitável: ${bol.linhaDigitavel} | Nosso Número: ${bol.nossoNumero} | Vencimento: ${bol.dataVencimento}`,
          createdBy: 'system_auto',
          createdByName: operatorName,
        },
        this.getCurrentUser()
      );

      if (newRec.account) {
        bol.financialAccountId = newRec.account.id;
      }

      boletosGerados.push(bol);
    } else {
      // Boleto Faturado a Prazo (1 ou mais parcelas autorizadas)
      const terms = quote?.billingTerms || order.billingTerms;
      const count = Math.max(
        1,
        params.installmentsCount || terms?.installmentsCount || terms?.daysInterval?.length || 1
      );
      const conditionName =
        params.customCondition || terms?.conditionName || `${count}x Faturado Boleto`;

      if (terms?.customInstallments && terms.customInstallments.length > 0) {
        // Usa as parcelas customizadas aprovadas na proposta
        terms.customInstallments.forEach((inst) => {
          const bol = criarBoletoTitulo({
            orderId: order.id,
            orderCode: order.code,
            quoteId: quote?.id || order.sourceQuoteId,
            quoteCode: quote?.code,
            customerName: order.clientName,
            customerCpfCnpj: quote?.clientCpfCnpj || (order as any).clientCpfCnpj || '000.000.000-00',
            customerEmail: order.clientEmail,
            customerAddress: `${order.shippingAddress.street}, ${order.shippingAddress.number} - ${order.shippingAddress.neighborhood}, ${order.shippingAddress.city}/${order.shippingAddress.state}`,
            amount: inst.amount,
            dueDate: inst.dueDate,
            installmentNumber: inst.installmentNumber,
            totalInstallments: terms.customInstallments!.length,
            conditionName,
            tipoCobranca: 'faturado_prazo',
            settings,
          });

          // Integração com Contas a Receber
          const newRec = this.createFinancialAccount(
            {
              type: 'receber',
              description: `Boleto Faturado ${bol.parcelaNumero}/${bol.totalParcelas} - Pedido #${order.code}${bol.quoteCode ? ` (Orç. ${bol.quoteCode})` : ''}`,
              entityName: bol.sacadoNome,
              entityDocument: bol.sacadoCpfCnpj,
              amount: bol.valorOriginal,
              dueDate: bol.dataVencimento,
              issueDate: bol.dataEmissao,
              status: 'pendente',
              categoryId: 'cat-rec-1',
              categoryName: 'Vendas Corporativas B2B',
              costCenterId: 'cc-1',
              costCenterName: 'Comercial & Vendas B2B',
              paymentMethod: `Boleto Faturado (${bol.condicaoPagamento} - Parc. ${bol.parcelaNumero}/${bol.totalParcelas})`,
              orderCode: order.code,
              quoteCode: bol.quoteCode,
              notes: `Linha Digitável: ${bol.linhaDigitavel} | Nosso Número: ${bol.nossoNumero} | Parcela ${bol.parcelaNumero}/${bol.totalParcelas}`,
              createdBy: 'system_auto',
              createdByName: operatorName,
            },
            this.getCurrentUser()
          );

          if (newRec.account) {
            bol.financialAccountId = newRec.account.id;
          }

          boletosGerados.push(bol);
        });
      } else {
        // Cálculo proporcional padrão
        const installmentValue = Number((order.total / count).toFixed(2));
        const intervals =
          terms?.daysInterval && terms.daysInterval.length === count
            ? terms.daysInterval
            : Array.from({ length: count }, (_, i) => (i + 1) * 28);

        for (let i = 0; i < count; i++) {
          const installmentNum = i + 1;
          const days = intervals[i] || installmentNum * 28;
          const dueDate = calcularDataVencimento(days);
          // Ajusta centavos na última parcela se houver diferença de arredondamento
          const amount =
            installmentNum === count
              ? Number((order.total - installmentValue * (count - 1)).toFixed(2))
              : installmentValue;

          const bol = criarBoletoTitulo({
            orderId: order.id,
            orderCode: order.code,
            quoteId: quote?.id || order.sourceQuoteId,
            quoteCode: quote?.code,
            customerName: order.clientName,
            customerCpfCnpj: quote?.clientCpfCnpj || (order as any).clientCpfCnpj || '000.000.000-00',
            customerEmail: order.clientEmail,
            customerAddress: `${order.shippingAddress.street}, ${order.shippingAddress.number} - ${order.shippingAddress.neighborhood}, ${order.shippingAddress.city}/${order.shippingAddress.state}`,
            amount,
            dueDate,
            installmentNumber: installmentNum,
            totalInstallments: count,
            conditionName,
            tipoCobranca: 'faturado_prazo',
            settings,
          });

          // Integração com Contas a Receber
          const newRec = this.createFinancialAccount(
            {
              type: 'receber',
              description: `Boleto Faturado ${bol.parcelaNumero}/${bol.totalParcelas} - Pedido #${order.code}${bol.quoteCode ? ` (Orç. ${bol.quoteCode})` : ''}`,
              entityName: bol.sacadoNome,
              entityDocument: bol.sacadoCpfCnpj,
              amount: bol.valorOriginal,
              dueDate: bol.dataVencimento,
              issueDate: bol.dataEmissao,
              status: 'pendente',
              categoryId: 'cat-rec-1',
              categoryName: 'Vendas Corporativas B2B',
              costCenterId: 'cc-1',
              costCenterName: 'Comercial & Vendas B2B',
              paymentMethod: `Boleto Faturado (${bol.condicaoPagamento} - Parc. ${bol.parcelaNumero}/${bol.totalParcelas})`,
              orderCode: order.code,
              quoteCode: bol.quoteCode,
              notes: `Linha Digitável: ${bol.linhaDigitavel} | Nosso Número: ${bol.nossoNumero}`,
              createdBy: 'system_auto',
              createdByName: operatorName,
            },
            this.getCurrentUser()
          );

          if (newRec.account) {
            bol.financialAccountId = newRec.account.id;
          }

          boletosGerados.push(bol);
        }
      }
    }

    // Salva boletos atualizados
    this.saveBoletos([...boletosGerados, ...existingBoletos]);
    boletosGerados.forEach((b) => syncToPostgres('boletos', 'POST', b));

    // Anexa boletos ao pedido
    order.boletos = boletosGerados;
    this.updateOrder(order);

    return { success: true, boletos: boletosGerados };
  },

  // Baixa Financeira / Liquidação de Boleto com Conciliação Automática no Contas a Receber
  settleBoleto(
    boletoId: string,
    paidAmount?: number,
    operatorName: string = 'Retorno Bancário Integrado'
  ): { success: boolean; message: string; boleto?: BoletoTitulo; error?: string } {
    const boletos = this.getBoletos();
    const index = boletos.findIndex((b) => b.id === boletoId);
    if (index < 0) {
      return { success: false, message: 'Boleto não encontrado no sistema.', error: 'BOLETO_NAO_ENCONTRADO' };
    }

    const boleto = boletos[index];

    // Prevenção de duplicidade
    if (boleto.status === 'pago') {
      return {
        success: false,
        message: `O boleto ${boleto.nossoNumero} já foi baixado e quitado em ${new Date(boleto.dataLiquidacao || '').toLocaleDateString('pt-BR')}.`,
        error: 'BOLETO_JA_LIQUIDADO',
      };
    }

    if (boleto.status === 'cancelado') {
      return {
        success: false,
        message: 'Boletos cancelados não podem ser baixados.',
        error: 'BOLETO_CANCELADO',
      };
    }

    const liquidadoEm = new Date().toISOString();
    const valorEfetivo = paidAmount !== undefined ? paidAmount : boleto.valorOriginal;

    boleto.status = 'pago';
    boleto.valorPago = valorEfetivo;
    boleto.saldoAberto = 0;
    boleto.dataLiquidacao = liquidadoEm;
    boleto.updatedAt = liquidadoEm;

    boletos[index] = boleto;
    this.saveBoletos(boletos);
    syncToPostgres('boletos', 'POST', boleto);

    // Baixa automática no Contas a Receber (se houver lançamento vinculado)
    if (boleto.financialAccountId) {
      const allFinAccounts = getStored<FinancialAccount[]>(STORAGE_KEYS.FINANCIAL_ACCOUNTS, INITIAL_FINANCIAL_ACCOUNTS);
      const finIdx = allFinAccounts.findIndex((a) => a.id === boleto.financialAccountId);
      if (finIdx >= 0) {
        allFinAccounts[finIdx] = {
          ...allFinAccounts[finIdx],
          status: 'pago',
          paidAmount: valorEfetivo,
          paymentDate: liquidadoEm,
          updatedAt: liquidadoEm,
        };
        setStored(STORAGE_KEYS.FINANCIAL_ACCOUNTS, allFinAccounts);
        syncToPostgres('financial-accounts', 'POST', allFinAccounts[finIdx]);
        if (typeof window !== 'undefined') {
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('mb_financial_accounts_updated', { detail: allFinAccounts }));
            window.dispatchEvent(new Event('mb_storage_updated'));
          }, 0);
        }
      }
    }

    // Verifica se todos os boletos do Pedido foram pagos para atualizar status geral do pedido
    const orderBoletos = boletos.filter((b) => b.orderId === boleto.orderId);
    const allPaid = orderBoletos.length > 0 && orderBoletos.every((b) => b.status === 'pago');
    if (allPaid) {
      const orders = this.getOrders();
      const orderIdx = orders.findIndex((o) => o.id === boleto.orderId);
      if (orderIdx >= 0) {
        orders[orderIdx].paymentStatus = 'pago';
        orders[orderIdx].updatedAt = liquidadoEm;
        this.saveOrders(orders);
      }
    }

    // Auditoria de segurança e conciliação financeira
    this.addFinancialAuditEntry({
      userId: 'bank_webhook',
      userName: operatorName,
      userEmail: 'financeiro@mbpersonaliza.com.br',
      userRole: 'admin',
      operation: 'BAIXA_BOLETO_BANCARIO',
      affectedRecordId: boleto.id,
      affectedRecordType: 'boleto_titulo',
      result: 'sucesso',
      details: `Baixa e liquidação do boleto ${boleto.nossoNumero} (Pedido #${boleto.orderCode}, Valor: R$ ${valorEfetivo.toFixed(2)}). Status financeiro sincronizado sem duplicidade.`,
      origin: 'web_painel',
    });

    return {
      success: true,
      message: `Boleto ${boleto.nossoNumero} baixado com sucesso! Saldo quitado e Contas a Receber atualizado.`,
      boleto,
    };
  },

  // Cancelamento de Boleto
  cancelBoleto(
    boletoId: string,
    reason: string,
    operatorName: string = 'Administrador'
  ): { success: boolean; message: string; error?: string } {
    const boletos = this.getBoletos();
    const index = boletos.findIndex((b) => b.id === boletoId);
    if (index < 0) {
      return { success: false, message: 'Boleto não encontrado.', error: 'NOT_FOUND' };
    }

    const boleto = boletos[index];
    if (boleto.status === 'pago') {
      return { success: false, message: 'Não é possível cancelar um boleto já quitado.', error: 'ALREADY_PAID' };
    }

    boleto.status = 'cancelado';
    boleto.updatedAt = new Date().toISOString();
    boletos[index] = boleto;
    this.saveBoletos(boletos);
    syncToPostgres('boletos', 'POST', boleto);

    // Cancela no Contas a Receber se vinculado
    if (boleto.financialAccountId) {
      this.cancelFinancialAccount(boleto.financialAccountId, reason, this.getCurrentUser());
    }

    this.addFinancialAuditEntry({
      userId: 'admin_sys',
      userName: operatorName,
      userEmail: 'financeiro@mbpersonaliza.com.br',
      userRole: 'admin',
      operation: 'CANCELAR_BOLETO_BANCARIO',
      affectedRecordId: boleto.id,
      affectedRecordType: 'boleto_titulo',
      result: 'sucesso',
      details: `Boleto ${boleto.nossoNumero} cancelado por ${operatorName}. Motivo: ${reason}`,
      origin: 'web_painel',
    });

    return { success: true, message: `Boleto ${boleto.nossoNumero} cancelado com sucesso.` };
  },

  // ==========================================
  // SYSTEM LAYOUT & CUSTOMIZATION STORAGE
  // ==========================================

  getLayoutSettings(): SystemLayoutSettings {
    try {
      const stored = getStored<SystemLayoutSettings | null>(STORAGE_KEYS.LAYOUT_SETTINGS, null);
      if (!stored || typeof stored !== 'object') {
        return { ...INITIAL_LAYOUT_SETTINGS };
      }

      const safeColors = { ...INITIAL_LAYOUT_SETTINGS.colors, ...(stored.colors || {}) };
      const safeHeader = { ...INITIAL_LAYOUT_SETTINGS.header, ...(stored.header || {}) };

      const rawBadges =
        Array.isArray(stored.hero?.trustBadges) && stored.hero.trustBadges.length > 0
          ? stored.hero.trustBadges
          : INITIAL_LAYOUT_SETTINGS.hero.trustBadges;

      const safeTrustBadges = (Array.isArray(rawBadges) ? rawBadges : [])
        .filter((b: any) => !b?.title?.toLowerCase().includes('envio para todo brasil'))
        .map((b: any) => {
          if (b?.title?.toLowerCase().includes('gravação industrial') || b?.id === 'badge-1') {
            return { ...b, title: 'Gravações' };
          }
          return b;
        });

      const safeHero = {
        ...INITIAL_LAYOUT_SETTINGS.hero,
        ...(stored.hero || {}),
        secondaryCtaText: stored.hero?.secondaryCtaText
          ? stored.hero.secondaryCtaText.replace(/Cotação B2B/g, 'Cotação')
          : INITIAL_LAYOUT_SETTINGS.hero.secondaryCtaText,
        titleParts:
          Array.isArray(stored.hero?.titleParts) && stored.hero.titleParts.length > 0
            ? stored.hero.titleParts
            : INITIAL_LAYOUT_SETTINGS.hero.titleParts || [],
        trustBadges: safeTrustBadges,
      };

      const safeCategoriesSection = {
        ...INITIAL_LAYOUT_SETTINGS.categoriesSection,
        ...(stored.categoriesSection || {}),
      };

      const safeFeaturedSection = {
        ...INITIAL_LAYOUT_SETTINGS.featuredSection,
        ...(stored.featuredSection || {}),
      };

      const safeB2bBanner = {
        ...INITIAL_LAYOUT_SETTINGS.b2bBanner,
        ...(stored.b2bBanner || {}),
        benefits:
          Array.isArray(stored.b2bBanner?.benefits) && stored.b2bBanner.benefits.length > 0
            ? stored.b2bBanner.benefits
            : INITIAL_LAYOUT_SETTINGS.b2bBanner.benefits,
      };

      const safeWhyChoose = {
        ...INITIAL_LAYOUT_SETTINGS.whyChoose,
        ...(stored.whyChoose || {}),
        items:
          Array.isArray(stored.whyChoose?.items) && stored.whyChoose.items.length > 0
            ? stored.whyChoose.items
            : INITIAL_LAYOUT_SETTINGS.whyChoose.items,
      };

      const safeFooter = {
        ...INITIAL_LAYOUT_SETTINGS.footer,
        ...(stored.footer || {}),
      };

      let bList =
        Array.isArray(stored.blocks) && stored.blocks.length > 0
          ? [...stored.blocks]
          : [...INITIAL_LAYOUT_SETTINGS.blocks];

      const offersIdx = bList.findIndex((b) => b?.type === 'offers_banner');
      if (offersIdx > 0) {
        const [offers] = bList.splice(offersIdx, 1);
        bList.unshift(offers);
      } else if (offersIdx === -1) {
        bList.unshift({
          id: 'block-offers-banner',
          type: 'offers_banner',
          title: 'Banner de Ofertas',
          subtitle: 'Carrossel dinâmico com ofertas e transições de produtos',
          isVisible: true,
          order: 1,
        });
      }
      bList = bList.map((b, idx) => ({ ...b, order: idx + 1 }));

      const safeOffersBanner = {
        ...INITIAL_LAYOUT_SETTINGS.offersBanner,
        ...(stored.offersBanner || {}),
        enabled: stored.offersBanner?.enabled !== undefined ? stored.offersBanner.enabled : true,
        height: stored.offersBanner?.height || INITIAL_LAYOUT_SETTINGS.offersBanner?.height || 'panoramic',
        items: (() => {
          const storedItems = stored.offersBanner?.items;
          if (Array.isArray(storedItems) && storedItems.length > 0) {
            const hasNewThemes = storedItems.some((i: any) => i?.backgroundTheme);
            if (hasNewThemes) return storedItems;
          }
          return INITIAL_LAYOUT_SETTINGS.offersBanner?.items || [];
        })(),
      };

      return {
        ...INITIAL_LAYOUT_SETTINGS,
        ...stored,
        colors: safeColors,
        header: safeHeader,
        hero: safeHero,
        categoriesSection: safeCategoriesSection,
        featuredSection: safeFeaturedSection,
        b2bBanner: safeB2bBanner,
        whyChoose: safeWhyChoose,
        footer: safeFooter,
        blocks: bList,
        offersBanner: safeOffersBanner,
      };
    } catch (err) {
      console.warn('Error reading layout settings, falling back to initial:', err);
      return { ...INITIAL_LAYOUT_SETTINGS };
    }
  },

  saveLayoutSettings(settings: SystemLayoutSettings): { success: boolean; error?: string } {
    try {
      settings.updatedAt = new Date().toISOString();
      settings.publishedAt = new Date().toISOString();
      const saved = setStored(STORAGE_KEYS.LAYOUT_SETTINGS, settings);
      if (!saved) {
        return {
          success: false,
          error: 'Não foi possível atualizar as configurações de layout em memória.',
        };
      }
      // Clean draft upon publish
      memoryStore.delete(STORAGE_KEYS.LAYOUT_DRAFT);
      syncToPostgres('settings/layout', 'POST', { value: settings });

      if (typeof window !== 'undefined') {
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('mb_layout_updated', { detail: settings }));
          window.dispatchEvent(new Event('mb_storage_updated'));
        }, 0);
      }
      return { success: true };
    } catch (err: any) {
      console.error('Error saving layout settings:', err);
      return { success: false, error: err?.message || 'Erro inesperado ao salvar o layout.' };
    }
  },

  getLayoutDraft(): SystemLayoutSettings | null {
    const draft = getStored<SystemLayoutSettings | null>(STORAGE_KEYS.LAYOUT_DRAFT, null);
    return draft;
  },

  saveLayoutDraft(draft: SystemLayoutSettings): boolean {
    draft.updatedAt = new Date().toISOString();
    try {
      memoryStore.set(STORAGE_KEYS.LAYOUT_DRAFT, draft);
      return true;
    } catch (err) {
      console.error('Error saving layout draft:', err);
      return false;
    }
  },

  discardLayoutDraft(): void {
    memoryStore.delete(STORAGE_KEYS.LAYOUT_DRAFT);
  },

  publishLayout(settings?: SystemLayoutSettings): { success: boolean; error?: string } {
    const target = settings || this.getLayoutDraft() || this.getLayoutSettings();
    return this.saveLayoutSettings(target);
  },

  resetLayoutSettings(): { success: boolean } {
    setStored(STORAGE_KEYS.LAYOUT_SETTINGS, INITIAL_LAYOUT_SETTINGS);
    memoryStore.delete(STORAGE_KEYS.LAYOUT_DRAFT);
    if (typeof window !== 'undefined') {
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('mb_layout_updated', { detail: INITIAL_LAYOUT_SETTINGS }));
        window.dispatchEvent(new Event('mb_storage_updated'));
      }, 0);
    }
    return { success: true };
  },

  // Offers Banner helpers
  getOffersBannerSettings(): OffersBannerSettings {
    const layout = this.getLayoutSettings();
    return layout.offersBanner;
  },

  saveOffersBannerSettings(bannerSettings: OffersBannerSettings): boolean {
    const layout = this.getLayoutSettings();
    layout.offersBanner = bannerSettings;
    const res = this.saveLayoutSettings(layout);
    return res.success;
  },

  toggleProductInOffersBanner(
    productId: string,
    show: boolean,
    promoPrice?: number,
    badge?: string,
    order?: number,
    customImage?: string,
    startDate?: string,
    endDate?: string
  ): void {
    // 1. Update product object
    const products = this.getProducts();
    const prodIndex = products.findIndex((p) => p.id === productId);
    if (prodIndex >= 0) {
      products[prodIndex].showInOffersBanner = show;
      if (promoPrice !== undefined) products[prodIndex].promo_price = promoPrice;
      if (badge !== undefined) products[prodIndex].offersBannerBadge = badge;
      if (order !== undefined) products[prodIndex].offersBannerOrder = order;
      if (customImage !== undefined) products[prodIndex].offersBannerImage = customImage;
      if (startDate !== undefined) products[prodIndex].offerStartDate = startDate;
      if (endDate !== undefined) products[prodIndex].offerEndDate = endDate;
      this.saveProducts(products);
    }

    // 2. Sync with layout.offersBanner.items
    const layout = this.getLayoutSettings();
    const items = [...(layout.offersBanner?.items || [])];
    const itemIndex = items.findIndex((i) => i.productId === productId);

    if (show) {
      if (itemIndex >= 0) {
        items[itemIndex].active = true;
        if (promoPrice !== undefined) items[itemIndex].promoPrice = promoPrice;
        if (badge !== undefined) items[itemIndex].badge = badge;
        if (order !== undefined) items[itemIndex].order = order;
        if (customImage !== undefined) items[itemIndex].customImage = customImage;
        if (startDate !== undefined) items[itemIndex].startDate = startDate;
        if (endDate !== undefined) items[itemIndex].endDate = endDate;
      } else {
        items.push({
          productId,
          order: order !== undefined ? order : items.length + 1,
          active: true,
          promoPrice,
          badge: badge || 'OFERTA ESPECIAL',
          customImage,
          startDate,
          endDate,
        });
      }
    } else {
      if (itemIndex >= 0) {
        items[itemIndex].active = false;
      }
    }

    layout.offersBanner.items = items;
    this.saveLayoutSettings(layout);
  },

  // Permissions Matrix (Memory-only synced from PostgreSQL)
  getPermissionsMatrix(): Record<UserRole, RolePermissions> {
    const merged = { ...INITIAL_PERMISSIONS_MATRIX };
    for (const r of Object.keys(INITIAL_PERMISSIONS_MATRIX) as UserRole[]) {
      if (memoryPermissionsMatrix && memoryPermissionsMatrix[r]) {
        merged[r] = { ...INITIAL_PERMISSIONS_MATRIX[r], ...memoryPermissionsMatrix[r] };
      }
    }
    return merged;
  },
  setPermissionsMatrixMemory(matrix: Partial<Record<UserRole, RolePermissions>>): void {
    const next = { ...INITIAL_PERMISSIONS_MATRIX };
    for (const r of Object.keys(INITIAL_PERMISSIONS_MATRIX) as UserRole[]) {
      if (matrix && matrix[r]) {
        next[r] = { ...INITIAL_PERMISSIONS_MATRIX[r], ...matrix[r] };
      } else if (memoryPermissionsMatrix[r]) {
        next[r] = { ...INITIAL_PERMISSIONS_MATRIX[r], ...memoryPermissionsMatrix[r] };
      }
    }
    memoryPermissionsMatrix = next;
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('mb_storage_updated'));
    }
  },
  savePermissionsMatrix(matrix: Record<UserRole, RolePermissions>): void {
    this.setPermissionsMatrixMemory(matrix);
    syncToPostgres('settings/permissions', 'POST', { value: matrix });
  },
  getRolePermissions(role: UserRole): RolePermissions {
    const matrix = this.getPermissionsMatrix();
    return matrix[role] || INITIAL_PERMISSIONS_MATRIX[role];
  },
  hasUserPermission(user?: UserProfile | null, permission?: keyof RolePermissions): boolean {
    if (!user || !permission) return false;
    if (user.status === 'inativo') return false;
    if (user.role === 'admin') return true;
    if (user.customPermissions && user.customPermissions[permission] !== undefined) {
      return Boolean(user.customPermissions[permission]);
    }
    const rolePerms = this.getRolePermissions(user.role);
    return Boolean(rolePerms[permission]);
  },

  // Auth / Users (Memory-only synced from PostgreSQL)
  setUsersMemory(users: UserProfile[]): void {
    memoryUsers = Array.isArray(users) ? users : [];
  },
  getUsers(): UserProfile[] {
    if (memoryUsers.length > 0) return memoryUsers;
    if (memoryCurrentUser.role !== 'visitante') return [memoryCurrentUser];
    return [];
  },
  getEmployees(): UserProfile[] {
    return this.getUsers().filter((u) => u.role !== 'cliente' && u.role !== 'visitante');
  },
  getCustomers(): UserProfile[] {
    return this.getUsers().filter((u) => u.role === 'cliente');
  },
  saveUser(user: UserProfile): void {
    const users = [...this.getUsers()];
    const idx = users.findIndex((u) => u.id === user.id);
    const { password: rawPassword, ...cleanUser } = user as UserProfile & { password?: string };
    if (idx >= 0) {
      users[idx] = cleanUser;
    } else {
      users.push(cleanUser);
    }
    memoryUsers = users;

    if (memoryCurrentUser && memoryCurrentUser.id === user.id) {
      memoryCurrentUser = cleanUser;
    }

    syncToPostgres('users', 'POST', rawPassword ? { ...cleanUser, password: rawPassword } : cleanUser);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('mb_storage_updated'));
    }
  },
  deleteUser(userId: string): void {
    memoryUsers = this.getUsers().filter((u) => u.id !== userId);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('mb_storage_updated'));
    }
  },
  toggleUserStatus(userId: string): UserProfile | undefined {
    const users = [...this.getUsers()];
    const target = users.find((u) => u.id === userId);
    if (target) {
      target.status = target.status === 'inativo' ? 'ativo' : 'inativo';
      memoryUsers = users;
      syncToPostgres('users', 'POST', target);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('mb_storage_updated'));
      }
      return target;
    }
    return undefined;
  },
  getCurrentUser(): UserProfile {
    return memoryCurrentUser || VISITOR_PROFILE;
  },
  setCurrentUser(user: UserProfile | null): void {
    memoryCurrentUser = user ? { ...user } : { ...VISITOR_PROFILE };
    if (memoryCurrentUser.role === 'visitante') {
      memoryUsers = [];
    } else if (memoryUsers.length === 0) {
      memoryUsers = [memoryCurrentUser];
    } else {
      const idx = memoryUsers.findIndex((u) => u.id === memoryCurrentUser.id);
      if (idx >= 0) memoryUsers[idx] = memoryCurrentUser;
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('mb_storage_updated'));
    }
  },
  async logout(): Promise<void> {
    await logoutSession();
    memoryCurrentUser = { ...VISITOR_PROFILE };
    memoryUsers = [];
    memoryPermissionsMatrix = { ...INITIAL_PERMISSIONS_MATRIX };
    memoryStore.delete(STORAGE_KEYS.QUOTES);
    memoryStore.delete(STORAGE_KEYS.ORDERS);
    memoryStore.delete(STORAGE_KEYS.BOLETOS);
    memoryStore.delete(STORAGE_KEYS.FINANCIAL_ACCOUNTS);
    memoryStore.delete(STORAGE_KEYS.PDV_SALES);
    memoryStore.delete(STORAGE_KEYS.CASH_REGISTER_SESSIONS);
    memoryStore.delete(STORAGE_KEYS.PAYMENT_TRANSACTIONS);
    memoryStore.delete(STORAGE_KEYS.COUPONS);
    memoryStore.delete(STORAGE_KEYS.STOCK_MOVEMENTS);
    memoryStore.delete(STORAGE_KEYS.FAVORITES);
    memoryStore.delete(STORAGE_KEYS.CART);
    await this.initPostgresSync();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('mb_storage_updated'));
    }
  },

  // ==========================================
  // USER FAVORITES (WISHLIST)
  // ==========================================
  getUserFavorites(userId?: string): string[] {
    const current = this.getCurrentUser();
    const uid = userId || current?.id;
    if (!uid || uid === 'visitante' || (!userId && current?.role === 'visitante')) return [];

    const users = this.getUsers();
    const user = users.find((u) => u.id === uid) || (current.id === uid ? current : undefined);
    if (user?.favoriteProductIds && Array.isArray(user.favoriteProductIds)) {
      return user.favoriteProductIds;
    }

    const map = getStored<Record<string, string[]>>(STORAGE_KEYS.FAVORITES, {});
    return Array.isArray(map[uid]) ? map[uid] : [];
  },

  isProductFavorite(productId: string, userId?: string): boolean {
    if (!productId) return false;
    const favorites = this.getUserFavorites(userId);
    return favorites.includes(productId);
  },

  toggleProductFavorite(productId: string, userId?: string): { isFavorite: boolean; favorites: string[] } {
    const current = this.getCurrentUser();
    const uid = userId || current?.id;
    if (!uid || uid === 'visitante' || (!userId && current?.role === 'visitante')) {
      return { isFavorite: false, favorites: [] };
    }

    const currentFavorites = this.getUserFavorites(uid);
    let updatedFavorites: string[];
    let isFavorite: boolean;

    if (currentFavorites.includes(productId)) {
      updatedFavorites = currentFavorites.filter((id) => id !== productId);
      isFavorite = false;
    } else {
      updatedFavorites = [...currentFavorites, productId];
      isFavorite = true;
    }

    if (current && current.id === uid) {
      memoryCurrentUser = { ...current, favoriteProductIds: updatedFavorites };
    }
    const users = [...this.getUsers()];
    const userIdx = users.findIndex((u) => u.id === uid);
    if (userIdx >= 0) {
      users[userIdx] = { ...users[userIdx], favoriteProductIds: updatedFavorites };
      memoryUsers = users;
    }

    const map = getStored<Record<string, string[]>>(STORAGE_KEYS.FAVORITES, {});
    map[uid] = updatedFavorites;
    setStored(STORAGE_KEYS.FAVORITES, map);

    if (current && current.id === uid) {
      void updateMyProfile({ favoriteProductIds: updatedFavorites }).catch((err) => {
        console.warn('[Favorites] Falha ao sincronizar perfil de favoritos:', err);
      });
      void authFetch('/api/db/favorites', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productIds: updatedFavorites }),
      }).catch((err) => {
        console.warn('[Favorites] Falha ao persistir favoritos no PostgreSQL:', err);
      });
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('mb_favorites_updated', {
          detail: { productId, isFavorite, favorites: updatedFavorites, userId: uid },
        })
      );
      window.dispatchEvent(new Event('mb_storage_updated'));
    }

    return { isFavorite, favorites: updatedFavorites };
  },

  getFavoriteProducts(userId?: string): Product[] {
    const favIds = this.getUserFavorites(userId);
    if (favIds.length === 0) return [];
    const products = this.getProducts();
    return products.filter((p) => favIds.includes(p.id));
  },

  // Cart (In-memory cache synced with PostgreSQL /api/db/cart)
  getCart(): CartItem[] {
    const c = getStored<CartItem[]>(STORAGE_KEYS.CART, []);
    return Array.isArray(c) ? c : [];
  },
  saveCart(cart: CartItem[]): void {
    setStored(STORAGE_KEYS.CART, cart);
    if (typeof fetch !== 'undefined') {
      void authFetch('/api/db/cart', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: cart }),
      }).catch((err) => {
        console.warn('[Cart] Falha ao persistir carrinho no PostgreSQL:', err);
      });
    }
  },
  addToCart(item: CartItem): void {
    const cart = this.getCart();
    const existingIndex = cart.findIndex(
      (c) =>
        c.product.id === item.product.id &&
        c.variant?.id === item.variant?.id &&
        c.customTechnique === item.customTechnique
    );
    if (existingIndex >= 0) {
      cart[existingIndex].quantity += item.quantity;
      cart[existingIndex].calculatedUnitPrice = this.calculateUnitPrice(
        cart[existingIndex].product,
        cart[existingIndex].quantity
      );
    } else {
      cart.push(item);
    }
    this.saveCart(cart);
  },
  removeFromCart(id: string): void {
    const cart = this.getCart().filter((c) => c.id !== id);
    this.saveCart(cart);
  },
  updateCartQty(id: string, qty: number): void {
    const cart = this.getCart();
    const item = cart.find((c) => c.id === id);
    if (item) {
      item.quantity = Math.max(item.product.min_order_qty || 1, qty);
      item.calculatedUnitPrice = this.calculateUnitPrice(item.product, item.quantity);
      this.saveCart(cart);
    }
  },
  updateCartItemQuantity(id: string, qty: number): void {
    this.updateCartQty(id, qty);
  },
  clearCart(): void {
    this.saveCart([]);
  },

  // Update order tracking code
  updateOrderTracking(orderId: string, trackingCode: string): void {
    this.updateOrderStatus(orderId, undefined as any, trackingCode);
  },

  // Stock adjustment helper
  adjustStock(
    productId: string,
    quantity: number,
    type: 'entrada' | 'saida' | 'ajuste' = 'entrada',
    reason = 'Ajuste manual de estoque',
    operator_name = 'Administrador'
  ): void {
    const product = this.getProducts().find((p) => p.id === productId);
    if (!product) return;
    this.recordStockMovement({
      productId,
      productName: product.name,
      productSku: product.code,
      type,
      quantity,
      reason,
      operator_name,
    });
  },

  // Pricing Helpers
  calculateUnitPrice(product: Product, quantity: number): number {
    if (!this.canViewPrices() || !product.show_price) return 0;
    if (product.price_tiers && product.price_tiers.length > 0) {
      // Find tier that matches
      const sortedTiers = [...product.price_tiers].sort((a, b) => b.min_qty - a.min_qty);
      const matchingTier = sortedTiers.find(
        (t) => quantity >= t.min_qty && (t.max_qty === undefined || quantity <= t.max_qty)
      );
      if (matchingTier) {
        return matchingTier.unit_price;
      }
    }
    return product.promo_price || product.base_price;
  },

  // ==========================================
  // PAYMENT GATEWAYS (MERCADO PAGO & PAGBANK)
  // ==========================================
  getPaymentGateways(): PaymentGatewayConfig[] {
    const list = getStored<PaymentGatewayConfig[]>(STORAGE_KEYS.PAYMENT_GATEWAYS, INITIAL_PAYMENT_GATEWAYS);
    return Array.isArray(list) && list.length > 0 ? list : INITIAL_PAYMENT_GATEWAYS;
  },
  savePaymentGateways(gateways: PaymentGatewayConfig[]): void {
    setStored(STORAGE_KEYS.PAYMENT_GATEWAYS, gateways);
    syncToPostgres('settings/gateways', 'POST', { value: gateways });
  },
  getPaymentGateway(provider: PaymentGatewayProvider): PaymentGatewayConfig | undefined {
    return this.getPaymentGateways().find((gw) => gw.provider === provider);
  },
  savePaymentGateway(gateway: PaymentGatewayConfig): void {
    const gateways = this.getPaymentGateways();
    const idx = gateways.findIndex((g) => g.provider === gateway.provider);
    if (idx >= 0) {
      gateways[idx] = { ...gateway, updatedAt: new Date().toISOString() };
    } else {
      gateways.push({ ...gateway, updatedAt: new Date().toISOString() });
    }
    this.savePaymentGateways(gateways);
  },

  // ==========================================
  // TRANSAÇÕES DE PAGAMENTO (FINANCEIRO)
  // ==========================================
  getPaymentTransactions(): PaymentTransaction[] {
    const txs = getStored<PaymentTransaction[]>(STORAGE_KEYS.PAYMENT_TRANSACTIONS, INITIAL_PAYMENT_TRANSACTIONS);
    return Array.isArray(txs) ? txs : INITIAL_PAYMENT_TRANSACTIONS;
  },
  savePaymentTransactions(transactions: PaymentTransaction[]): void {
    setStored(STORAGE_KEYS.PAYMENT_TRANSACTIONS, transactions);
  },
  addPaymentTransaction(transaction: PaymentTransaction): PaymentTransaction {
    const txs = this.getPaymentTransactions();
    txs.unshift(transaction);
    this.savePaymentTransactions(txs);
    syncToPostgres('payment-transactions', 'POST', transaction);
    return transaction;
  },
  updatePaymentTransactionStatus(
    id: string,
    status: PaymentTransactionStatus,
    note: string,
    operator?: string
  ): void {
    const txs = this.getPaymentTransactions();
    const idx = txs.findIndex((t) => t.id === id);
    if (idx >= 0) {
      const tx = txs[idx];
      tx.status = status;
      tx.updatedAt = new Date().toISOString();
      tx.history.unshift({
        timestamp: new Date().toISOString(),
        status,
        note,
        operator,
      });
      this.savePaymentTransactions(txs);
      syncToPostgres('payment-transactions', 'POST', tx);
    }
  },
  refundPaymentTransaction(
    id: string,
    reason: string,
    operatorName: string
  ): { success: boolean; message: string } {
    const txs = this.getPaymentTransactions();
    const tx = txs.find((t) => t.id === id);
    if (!tx) {
      return { success: false, message: 'Transação não encontrada.' };
    }
    if (tx.status === 'estornado' || tx.status === 'cancelado') {
      return { success: false, message: 'Transação já se encontra estornada ou cancelada.' };
    }

    tx.status = 'estornado';
    tx.updatedAt = new Date().toISOString();
    tx.history.unshift({
      timestamp: new Date().toISOString(),
      status: 'estornado',
      note: `Estorno solicitado por ${operatorName}. Motivo: ${reason}`,
      operator: operatorName,
    });
    this.savePaymentTransactions(txs);
    syncToPostgres('payment-transactions', 'POST', tx);

    // Se a transação for de uma venda PDV, atualiza a venda também
    if (tx.origin === 'pdv') {
      const sales = this.getPDVSales();
      const sale = sales.find((s) => s.id === tx.saleId || s.code === tx.saleCode);
      if (sale && sale.status === 'concluida') {
        this.cancelPDVSale(sale.id, `Estorno financeiro aprovado: ${reason}`, operatorName);
      }
    }

    return {
      success: true,
      message: `Transação ${tx.id} estornada com sucesso junto ao gateway ${tx.gateway.toUpperCase()}.`,
    };
  },

  // ==========================================
  // PDV — VENDAS EM LOJA FÍSICA
  // ==========================================
  getPDVSales(): PDVSale[] {
    const sales = getStored<PDVSale[]>(STORAGE_KEYS.PDV_SALES, INITIAL_PDV_SALES);
    return Array.isArray(sales) ? sales : INITIAL_PDV_SALES;
  },
  savePDVSales(sales: PDVSale[]): void {
    setStored(STORAGE_KEYS.PDV_SALES, sales);
  },
  addPDVSale(sale: PDVSale): PDVSale {
    const sales = this.getPDVSales();
    sales.unshift(sale);
    this.savePDVSales(sales);
    syncToPostgres('pdv-sales', 'POST', sale);

    // 1. Baixa imediata de estoque de cada item vendido no PDV
    sale.items.forEach((item) => {
      this.adjustStock(
        item.productId,
        item.quantity,
        'saida',
        `Venda PDV #${sale.code} (Balcão - Operador: ${sale.operatorName})`,
        sale.operatorName
      );
    });

    // 2. Registra a movimentação no Caixa Atual aberto (se houver)
    const currentSession = this.getCurrentCashRegisterSession();
    if (currentSession && currentSession.status === 'aberto') {
      const cashAmount = sale.payments
        .filter((p) => p.method === 'dinheiro')
        .reduce((sum, p) => sum + p.amount, 0);

      const pixAmount = sale.payments
        .filter((p) => p.method === 'pix')
        .reduce((sum, p) => sum + p.amount, 0);

      const debitAmount = sale.payments
        .filter((p) => p.method === 'cartao_debito')
        .reduce((sum, p) => sum + p.amount, 0);

      const creditAmount = sale.payments
        .filter((p) => p.method === 'cartao_credito')
        .reduce((sum, p) => sum + p.amount, 0);

      currentSession.totalSalesCount += 1;
      currentSession.totalSalesAmount += sale.total;
      currentSession.totalCashSales += cashAmount;
      currentSession.totalPixSales += pixAmount;
      currentSession.totalDebitSales += debitAmount;
      currentSession.totalCreditSales += creditAmount;
      currentSession.expectedCash += cashAmount;

      const paymentSummary = sale.payments
        .map((p) => `${p.method.replace('_', ' ').toUpperCase()}: R$ ${p.amount.toFixed(2)}`)
        .join(' | ');

      currentSession.movements.unshift({
        id: `mov-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        registerId: currentSession.id,
        type: 'venda',
        amount: sale.total,
        paymentMethod: sale.payments.map((p) => p.method).join(','),
        reason: `Venda PDV #${sale.code} (${paymentSummary})`,
        saleId: sale.id,
        operatorId: sale.operatorId,
        operatorName: sale.operatorName,
        createdAt: new Date().toISOString(),
      });

      this.saveCurrentCashRegisterSession(currentSession);
    }

    // 3. Registra Transações Financeiras correspondentes para pagamentos eletrônicos
    sale.payments.forEach((payment, idx) => {
      const isCard = payment.method === 'cartao_credito' || payment.method === 'cartao_debito';
      const isPix = payment.method === 'pix';
      const gwProvider = payment.gateway || (isCard || isPix ? 'mercadopago' : 'manual');

      const gwConfig = this.getPaymentGateway(gwProvider);
      const feePct =
        payment.method === 'cartao_credito'
          ? gwConfig?.feePercentageCredit ?? 3.49
          : isPix
          ? gwConfig?.feePercentagePix ?? 0.99
          : 0;

      const feeAmount = (payment.amount * feePct) / 100;
      const netAmount = payment.amount - feeAmount;

      this.addPaymentTransaction({
        id: `tx-pdv-${sale.code}-${idx + 1}`,
        saleId: sale.id,
        saleCode: sale.code,
        origin: 'pdv',
        customerName: sale.customerName,
        customerCpfCnpj: sale.customerCpfCnpj,
        gateway: gwProvider,
        gatewayTransactionId: payment.gatewayTransactionId || `tx_${Date.now()}_${idx}`,
        method: payment.method === 'cartao_credito' ? 'credit_card' : payment.method === 'cartao_debito' ? 'debit_card' : payment.method === 'pix' ? 'pix' : 'dinheiro',
        installments: payment.installments || 1,
        installmentValue: payment.installments && payment.installments > 1 ? payment.amount / payment.installments : payment.amount,
        grossAmount: payment.amount,
        feeAmount: Number(feeAmount.toFixed(2)),
        netAmount: Number(netAmount.toFixed(2)),
        status: 'aprovado',
        statusDetail: `Pagamento PDV finalizado com sucesso no caixa balcão.`,
        cardBrand: payment.cardBrand,
        operatorId: sale.operatorId,
        operatorName: sale.operatorName,
        metadata: {
          cashRegisterNumber: sale.cashRegisterNumber,
          receivedAmount: payment.receivedAmount,
          changeAmount: payment.changeAmount,
        },
        history: [
          {
            timestamp: new Date().toISOString(),
            status: 'aprovado',
            note: `Venda balcão registrada pelo operador ${sale.operatorName}.`,
            operator: sale.operatorName,
          },
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    });

    return sale;
  },
  cancelPDVSale(saleId: string, reason: string, operatorName: string): boolean {
    const sales = this.getPDVSales();
    const sale = sales.find((s) => s.id === saleId);
    if (!sale || sale.status === 'cancelada') return false;

    sale.status = 'cancelada';
    sale.cancellationReason = reason;
    sale.cancelledAt = new Date().toISOString();
    sale.cancelledBy = operatorName;
    this.savePDVSales(sales);
    syncToPostgres('pdv-sales', 'POST', sale);

    // Devolve os itens ao estoque
    sale.items.forEach((item) => {
      this.adjustStock(
        item.productId,
        item.quantity,
        'entrada',
        `Estorno Venda PDV #${sale.code}: ${reason}`,
        operatorName
      );
    });

    // Se houve pagamento em dinheiro, ajusta no caixa aberto
    const cashPaid = sale.payments
      .filter((p) => p.method === 'dinheiro')
      .reduce((sum, p) => sum + p.amount, 0);

    const currentSession = this.getCurrentCashRegisterSession();
    if (currentSession && currentSession.status === 'aberto' && cashPaid > 0) {
      currentSession.expectedCash -= cashPaid;
      currentSession.movements.unshift({
        id: `mov-${Date.now()}`,
        registerId: currentSession.id,
        type: 'estorno',
        amount: cashPaid,
        reason: `Estorno devolução dinheiro Venda PDV #${sale.code} (${reason})`,
        saleId: sale.id,
        operatorId: currentSession.operatorId,
        operatorName,
        createdAt: new Date().toISOString(),
      });
      this.saveCurrentCashRegisterSession(currentSession);
    }

    return true;
  },

  // ==========================================
  // CONTROLE DE CAIXA (SESSÕES DO OPERADOR)
  // ==========================================
  getCashRegisterSessions(): CashRegisterSession[] {
    const list = getStored<CashRegisterSession[]>(STORAGE_KEYS.CASH_REGISTER_SESSIONS, [INITIAL_CASH_REGISTER_SESSION]);
    return Array.isArray(list) ? list : [INITIAL_CASH_REGISTER_SESSION];
  },
  saveCashRegisterSessions(sessions: CashRegisterSession[]): void {
    setStored(STORAGE_KEYS.CASH_REGISTER_SESSIONS, sessions);
  },
  getCurrentCashRegisterSession(): CashRegisterSession | null {
    const current = getStored<CashRegisterSession | null>(STORAGE_KEYS.CURRENT_CASH_SESSION, INITIAL_CASH_REGISTER_SESSION);
    return current;
  },
  saveCurrentCashRegisterSession(session: CashRegisterSession | null): void {
    setStored(STORAGE_KEYS.CURRENT_CASH_SESSION, session);
    if (session) {
      const allSessions = this.getCashRegisterSessions();
      const idx = allSessions.findIndex((s) => s.id === session.id);
      if (idx >= 0) {
        allSessions[idx] = session;
      } else {
        allSessions.unshift(session);
      }
      this.saveCashRegisterSessions(allSessions);
      syncToPostgres('cash-sessions', 'POST', session);
    }
  },
  openCashRegister(
    initialFund: number,
    registerNumber = 1,
    registerName = 'Caixa Balcão 01',
    operator?: UserProfile
  ): CashRegisterSession {
    const currentUser = operator || this.getCurrentUser();
    const newSession: CashRegisterSession = {
      id: `cash-session-${Date.now()}`,
      registerNumber,
      registerName,
      operatorId: currentUser.id,
      operatorName: currentUser.name,
      openedAt: new Date().toISOString(),
      initialFund,
      status: 'aberto',
      totalSalesCount: 0,
      totalSalesAmount: 0,
      totalCashSales: 0,
      totalPixSales: 0,
      totalDebitSales: 0,
      totalCreditSales: 0,
      totalSangrias: 0,
      totalSuprimentos: 0,
      expectedCash: initialFund,
      movements: [
        {
          id: `mov-open-${Date.now()}`,
          registerId: `cash-session-${Date.now()}`,
          type: 'abertura',
          amount: initialFund,
          reason: `Abertura do caixa com fundo de troco inicial de R$ ${initialFund.toFixed(2)}.`,
          operatorId: currentUser.id,
          operatorName: currentUser.name,
          createdAt: new Date().toISOString(),
        },
      ],
    };

    this.saveCurrentCashRegisterSession(newSession);
    return newSession;
  },
  closeCashRegister(
    sessionId: string,
    actualCash: number,
    closingNotes?: string
  ): CashRegisterSession {
    const current = this.getCurrentCashRegisterSession();
    const targetSession = current && current.id === sessionId ? current : this.getCashRegisterSessions().find((s) => s.id === sessionId);

    if (!targetSession) {
      throw new Error('Sessão de caixa não encontrada.');
    }

    const cashDiff = actualCash - targetSession.expectedCash;

    targetSession.status = 'fechado';
    targetSession.closedAt = new Date().toISOString();
    targetSession.actualCash = actualCash;
    targetSession.cashDifference = Number(cashDiff.toFixed(2));
    targetSession.closingNotes = closingNotes;

    targetSession.movements.unshift({
      id: `mov-close-${Date.now()}`,
      registerId: targetSession.id,
      type: 'fechamento',
      amount: actualCash,
      reason: `Fechamento de caixa. Esperado: R$ ${targetSession.expectedCash.toFixed(2)} | Informado: R$ ${actualCash.toFixed(2)} | Diferença: R$ ${cashDiff.toFixed(2)}.`,
      operatorId: targetSession.operatorId,
      operatorName: targetSession.operatorName,
      createdAt: new Date().toISOString(),
    });

    this.saveCurrentCashRegisterSession(null);
    const all = this.getCashRegisterSessions();
    const idx = all.findIndex((s) => s.id === targetSession.id);
    if (idx >= 0) {
      all[idx] = targetSession;
    } else {
      all.unshift(targetSession);
    }
    this.saveCashRegisterSessions(all);

    return targetSession;
  },
  addCashRegisterMovement(
    sessionId: string,
    movement: Omit<CashRegisterMovement, 'id' | 'createdAt'>
  ): CashRegisterMovement {
    const current = this.getCurrentCashRegisterSession();
    if (!current || current.id !== sessionId) {
      throw new Error('O caixa selecionado não está aberto no momento.');
    }

    const fullMovement: CashRegisterMovement = {
      ...movement,
      id: `mov-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      createdAt: new Date().toISOString(),
    };

    if (movement.type === 'sangria') {
      current.totalSangrias += movement.amount;
      current.expectedCash -= movement.amount;
    } else if (movement.type === 'suprimento') {
      current.totalSuprimentos += movement.amount;
      current.expectedCash += movement.amount;
    }

    current.movements.unshift(fullMovement);
    this.saveCurrentCashRegisterSession(current);
    return fullMovement;
  },

  // ==========================================
  // CONFIGURAÇÕES DO PDV
  // ==========================================
  getPDVSettings(): PDVSettings {
    const s = getStored<PDVSettings>(STORAGE_KEYS.PDV_SETTINGS, INITIAL_PDV_SETTINGS);
    return s && typeof s === 'object' ? { ...INITIAL_PDV_SETTINGS, ...s } : INITIAL_PDV_SETTINGS;
  },
  savePDVSettings(settings: PDVSettings): void {
    setStored(STORAGE_KEYS.PDV_SETTINGS, settings);
    syncToPostgres('settings/pdv', 'POST', { value: settings });
  },

  // ============================================================================
  // MÓDULO FINANCEIRO — CONTROLE DE ACESSO, SEGURANÇA E OPERAÇÕES CRÍTICAS
  // ============================================================================

  // Auditoria de Segurança Financeira
  getFinancialAudit(currentUser?: UserProfile): FinancialAuditEntry[] {
    const fallback = INITIAL_FINANCIAL_AUDIT;
    const logs = getStored<FinancialAuditEntry[]>(STORAGE_KEYS.FINANCIAL_AUDIT, fallback);
    const list = Array.isArray(logs) ? logs : fallback;

    if (!currentUser) return list;

    // Apenas Administrador ou usuário com permissão explícita pode visualizar a auditoria
    const canView = this.hasUserPermission(currentUser, 'canViewFinancialAudit');
    if (!canView) {
      this.addFinancialAuditEntry({
        userId: currentUser.id,
        userName: currentUser.name,
        userEmail: currentUser.email,
        userRole: currentUser.role,
        operation: 'ACESSO_AUDITORIA_NEGADO',
        permissionUsed: 'canViewFinancialAudit',
        affectedRecordType: 'auditoria',
        result: 'bloqueado',
        details: `Tentativa não autorizada de consultar a Auditoria Financeira pelo usuário ${currentUser.name}.`,
        origin: 'web_painel',
      });
      return [];
    }

    return list;
  },

  addFinancialAuditEntry(entry: Omit<FinancialAuditEntry, 'id' | 'timestamp'>): FinancialAuditEntry {
    const logs = getStored<FinancialAuditEntry[]>(STORAGE_KEYS.FINANCIAL_AUDIT, INITIAL_FINANCIAL_AUDIT);
    const currentList = Array.isArray(logs) ? logs : INITIAL_FINANCIAL_AUDIT;

    const newEntry: FinancialAuditEntry = {
      ...entry,
      id: `audit-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toISOString(),
    };

    const updated = [newEntry, ...currentList].slice(0, 500); // mantém últimos 500 registros
    setStored(STORAGE_KEYS.FINANCIAL_AUDIT, updated);
    return newEntry;
  },

  // Configurações Financeiras
  getFinancialSettings(currentUser?: UserProfile): FinancialSettings {
    const s = getStored<FinancialSettings>(STORAGE_KEYS.FINANCIAL_SETTINGS, INITIAL_FINANCIAL_SETTINGS);
    return s && typeof s === 'object' ? { ...INITIAL_FINANCIAL_SETTINGS, ...s } : INITIAL_FINANCIAL_SETTINGS;
  },

  saveFinancialSettings(
    settings: FinancialSettings,
    currentUser: UserProfile
  ): { success: boolean; error?: string } {
    if (!this.hasUserPermission(currentUser, 'canManageFinancialSettings')) {
      this.addFinancialAuditEntry({
        userId: currentUser.id,
        userName: currentUser.name,
        userEmail: currentUser.email,
        userRole: currentUser.role,
        operation: 'CONFIG_FINANCEIRA_NEGADA',
        permissionUsed: 'canManageFinancialSettings',
        affectedRecordType: 'configuracao',
        result: 'bloqueado',
        details: 'Tentativa não autorizada de alterar configurações financeiras.',
        origin: 'web_painel',
      });
      return {
        success: false,
        error: 'Acesso negado. Você não possui permissão para alterar as configurações financeiras.',
      };
    }

    const previous = this.getFinancialSettings();
    const updated: FinancialSettings = {
      ...settings,
      updatedAt: new Date().toISOString(),
      updatedBy: currentUser.name,
    };

    setStored(STORAGE_KEYS.FINANCIAL_SETTINGS, updated);
    syncToPostgres('settings/financial_settings', 'POST', { value: updated });

    this.addFinancialAuditEntry({
      userId: currentUser.id,
      userName: currentUser.name,
      userEmail: currentUser.email,
      userRole: currentUser.role,
      operation: 'ALTERAR_CONFIGURACOES_FINANCEIRAS',
      permissionUsed: 'canManageFinancialSettings',
      affectedRecordType: 'configuracao',
      result: 'sucesso',
      details: 'Parâmetros e políticas financeiras atualizados com sucesso.',
      origin: 'web_painel',
      previousValues: previous,
      newValues: updated,
    });

    return { success: true };
  },

  // Categorias Financeiras (Receitas & Despesas)
  getFinancialCategories(currentUser?: UserProfile): FinancialCategory[] {
    if (currentUser && !this.hasUserPermission(currentUser, 'canViewFinancialModule')) {
      return [];
    }
    const c = getStored<FinancialCategory[]>(STORAGE_KEYS.FINANCIAL_CATEGORIES, INITIAL_FINANCIAL_CATEGORIES);
    return Array.isArray(c) ? c : INITIAL_FINANCIAL_CATEGORIES;
  },

  saveFinancialCategory(
    category: FinancialCategory,
    currentUser: UserProfile
  ): { success: boolean; error?: string } {
    if (!this.hasUserPermission(currentUser, 'canManageFinancialCategories')) {
      this.addFinancialAuditEntry({
        userId: currentUser.id,
        userName: currentUser.name,
        userEmail: currentUser.email,
        userRole: currentUser.role,
        operation: 'GERENCIAR_CATEGORIA_NEGADA',
        permissionUsed: 'canManageFinancialCategories',
        affectedRecordType: 'categoria_financeira',
        result: 'bloqueado',
        details: `Tentativa de salvar categoria ${category.name} sem autorização.`,
        origin: 'web_painel',
      });
      return { success: false, error: 'Acesso negado: sem permissão para gerenciar categorias financeiras.' };
    }

    const categories = this.getFinancialCategories();
    const idx = categories.findIndex((c) => c.id === category.id);
    const prev = idx >= 0 ? categories[idx] : null;

    if (idx >= 0) {
      categories[idx] = category;
    } else {
      categories.push(category);
    }
    setStored(STORAGE_KEYS.FINANCIAL_CATEGORIES, categories);

    this.addFinancialAuditEntry({
      userId: currentUser.id,
      userName: currentUser.name,
      userEmail: currentUser.email,
      userRole: currentUser.role,
      operation: prev ? 'EDITAR_CATEGORIA_FINANCEIRA' : 'CRIAR_CATEGORIA_FINANCEIRA',
      permissionUsed: 'canManageFinancialCategories',
      affectedRecordId: category.id,
      affectedRecordType: 'categoria_financeira',
      result: 'sucesso',
      details: `Categoria financeira ${category.name} salva com sucesso.`,
      origin: 'web_painel',
      previousValues: prev,
      newValues: category,
    });

    return { success: true };
  },

  deleteFinancialCategory(
    id: string,
    currentUser: UserProfile
  ): { success: boolean; error?: string } {
    if (!this.hasUserPermission(currentUser, 'canManageFinancialCategories')) {
      return { success: false, error: 'Acesso negado: sem permissão para gerenciar categorias financeiras.' };
    }
    const categories = this.getFinancialCategories();
    const target = categories.find((c) => c.id === id);
    if (!target) {
      return { success: false, error: 'Categoria não encontrada.' };
    }
    const accounts = this.getFinancialAccounts();
    const linkedCount = accounts.filter((a) => a.categoryId === id).length;
    if (linkedCount > 0) {
      return {
        success: false,
        error: `Não é possível excluir a categoria "${target.name}": existem ${linkedCount} lançamentos vinculados.`,
      };
    }
    const updated = categories.filter((c) => c.id !== id);
    setStored(STORAGE_KEYS.FINANCIAL_CATEGORIES, updated);

    this.addFinancialAuditEntry({
      userId: currentUser.id,
      userName: currentUser.name,
      userEmail: currentUser.email,
      userRole: currentUser.role,
      operation: 'DELETAR_CATEGORIA_FINANCEIRA',
      permissionUsed: 'canManageFinancialCategories',
      affectedRecordId: id,
      affectedRecordType: 'categoria_financeira',
      result: 'sucesso',
      details: `Categoria financeira "${target.name}" excluída com sucesso.`,
      origin: 'web_painel',
      previousValues: target,
    });
    return { success: true };
  },

  // Centros de Custo
  getCostCenters(currentUser?: UserProfile): CostCenter[] {
    if (currentUser && !this.hasUserPermission(currentUser, 'canViewFinancialModule')) {
      return [];
    }
    const cc = getStored<CostCenter[]>(STORAGE_KEYS.COST_CENTERS, INITIAL_COST_CENTERS);
    return Array.isArray(cc) ? cc : INITIAL_COST_CENTERS;
  },

  saveCostCenter(
    center: CostCenter,
    currentUser: UserProfile
  ): { success: boolean; error?: string } {
    if (!this.hasUserPermission(currentUser, 'canManageCostCenters')) {
      return { success: false, error: 'Acesso negado: sem permissão para gerenciar centros de custo.' };
    }

    const centers = this.getCostCenters();
    const idx = centers.findIndex((c) => c.id === center.id);
    const prev = idx >= 0 ? centers[idx] : null;
    if (idx >= 0) {
      centers[idx] = center;
    } else {
      centers.push(center);
    }
    setStored(STORAGE_KEYS.COST_CENTERS, centers);

    this.addFinancialAuditEntry({
      userId: currentUser.id,
      userName: currentUser.name,
      userEmail: currentUser.email,
      userRole: currentUser.role,
      operation: prev ? 'EDITAR_CENTRO_DE_CUSTO' : 'CRIAR_CENTRO_DE_CUSTO',
      permissionUsed: 'canManageCostCenters',
      affectedRecordId: center.id,
      affectedRecordType: 'centro_custo',
      result: 'sucesso',
      details: `Centro de custo ${center.name} (${center.code}) salvo com sucesso.`,
      origin: 'web_painel',
      previousValues: prev,
      newValues: center,
    });

    return { success: true };
  },

  deleteCostCenter(
    id: string,
    currentUser: UserProfile
  ): { success: boolean; error?: string } {
    if (!this.hasUserPermission(currentUser, 'canManageCostCenters')) {
      return { success: false, error: 'Acesso negado: sem permissão para gerenciar centros de custo.' };
    }
    const centers = this.getCostCenters();
    const target = centers.find((c) => c.id === id);
    if (!target) {
      return { success: false, error: 'Centro de custo não encontrado.' };
    }
    const accounts = this.getFinancialAccounts();
    const linkedCount = accounts.filter((a) => a.costCenterId === id).length;
    if (linkedCount > 0) {
      return {
        success: false,
        error: `Não é possível excluir o centro de custo "${target.name}": existem ${linkedCount} lançamentos vinculados.`,
      };
    }
    const updated = centers.filter((c) => c.id !== id);
    setStored(STORAGE_KEYS.COST_CENTERS, updated);

    this.addFinancialAuditEntry({
      userId: currentUser.id,
      userName: currentUser.name,
      userEmail: currentUser.email,
      userRole: currentUser.role,
      operation: 'DELETAR_CENTRO_DE_CUSTO',
      permissionUsed: 'canManageCostCenters',
      affectedRecordId: id,
      affectedRecordType: 'centro_custo',
      result: 'sucesso',
      details: `Centro de custo "${target.name}" (${target.code}) excluído com sucesso.`,
      origin: 'web_painel',
      previousValues: target,
    });
    return { success: true };
  },

  // Contas Bancárias & Caixas
  getBankAccounts(currentUser?: UserProfile): BankAccount[] {
    if (currentUser && !this.hasUserPermission(currentUser, 'canViewFinancialModule')) {
      return [];
    }
    const b = getStored<BankAccount[]>(STORAGE_KEYS.BANK_ACCOUNTS, INITIAL_BANK_ACCOUNTS);
    return Array.isArray(b) ? b : INITIAL_BANK_ACCOUNTS;
  },

  saveBankAccount(
    account: BankAccount,
    currentUser: UserProfile
  ): { success: boolean; error?: string } {
    if (!this.hasUserPermission(currentUser, 'canManageBankAccounts')) {
      return { success: false, error: 'Acesso negado: sem permissão para gerenciar contas bancárias.' };
    }

    const accounts = this.getBankAccounts();
    const idx = accounts.findIndex((b) => b.id === account.id);
    const prev = idx >= 0 ? accounts[idx] : null;

    // Se marcado como padrão, desmarca outros
    if (account.isDefault) {
      accounts.forEach((b) => {
        if (b.id !== account.id) b.isDefault = false;
      });
    }

    if (idx >= 0) {
      accounts[idx] = account;
    } else {
      accounts.push(account);
    }
    setStored(STORAGE_KEYS.BANK_ACCOUNTS, accounts);

    this.addFinancialAuditEntry({
      userId: currentUser.id,
      userName: currentUser.name,
      userEmail: currentUser.email,
      userRole: currentUser.role,
      operation: prev ? 'EDITAR_CONTA_BANCARIA' : 'CRIAR_CONTA_BANCARIA',
      permissionUsed: 'canManageBankAccounts',
      affectedRecordId: account.id,
      affectedRecordType: 'conta_bancaria',
      result: 'sucesso',
      details: `Conta bancária/caixa ${account.name} salva com sucesso.`,
      origin: 'web_painel',
      previousValues: prev,
      newValues: account,
    });

    return { success: true };
  },

  deleteBankAccount(
    id: string,
    currentUser: UserProfile
  ): { success: boolean; error?: string } {
    if (!this.hasUserPermission(currentUser, 'canManageBankAccounts')) {
      return { success: false, error: 'Acesso negado: sem permissão para gerenciar contas bancárias.' };
    }
    const accounts = this.getBankAccounts();
    const target = accounts.find((b) => b.id === id);
    if (!target) {
      return { success: false, error: 'Conta bancária não encontrada.' };
    }
    if (target.isDefault && accounts.length > 1) {
      return {
        success: false,
        error: `A conta "${target.name}" é a conta bancária padrão do sistema. Defina outra conta como padrão antes de excluí-la.`,
      };
    }
    const finAccounts = this.getFinancialAccounts();
    const linkedCount = finAccounts.filter((a) => a.bankAccountId === id).length;
    if (linkedCount > 0) {
      return {
        success: false,
        error: `Não é possível excluir a conta "${target.name}": existem ${linkedCount} lançamentos vinculados a esta conta.`,
      };
    }
    const updated = accounts.filter((b) => b.id !== id);
    setStored(STORAGE_KEYS.BANK_ACCOUNTS, updated);

    this.addFinancialAuditEntry({
      userId: currentUser.id,
      userName: currentUser.name,
      userEmail: currentUser.email,
      userRole: currentUser.role,
      operation: 'DELETAR_CONTA_BANCARIA',
      permissionUsed: 'canManageBankAccounts',
      affectedRecordId: id,
      affectedRecordType: 'conta_bancaria',
      result: 'sucesso',
      details: `Conta bancária/caixa "${target.name}" excluída com sucesso.`,
      origin: 'web_painel',
      previousValues: target,
    });
    return { success: true };
  },

  // Formas de Pagamento Financeiras
  getFinancialPaymentMethods(currentUser?: UserProfile): FinancialPaymentMethod[] {
    if (currentUser && !this.hasUserPermission(currentUser, 'canViewFinancialModule')) {
      return [];
    }
    const pm = getStored<FinancialPaymentMethod[]>(STORAGE_KEYS.FINANCIAL_PAYMENT_METHODS, INITIAL_FINANCIAL_PAYMENT_METHODS);
    return Array.isArray(pm) ? pm : INITIAL_FINANCIAL_PAYMENT_METHODS;
  },

  saveFinancialPaymentMethod(
    method: FinancialPaymentMethod,
    currentUser: UserProfile
  ): { success: boolean; error?: string } {
    if (!this.hasUserPermission(currentUser, 'canManagePaymentMethods')) {
      return { success: false, error: 'Acesso negado: sem permissão para gerenciar formas de pagamento.' };
    }

    const methods = this.getFinancialPaymentMethods();
    const idx = methods.findIndex((m) => m.id === method.id);
    const prev = idx >= 0 ? methods[idx] : null;
    if (idx >= 0) {
      methods[idx] = method;
    } else {
      methods.push(method);
    }
    setStored(STORAGE_KEYS.FINANCIAL_PAYMENT_METHODS, methods);

    this.addFinancialAuditEntry({
      userId: currentUser.id,
      userName: currentUser.name,
      userEmail: currentUser.email,
      userRole: currentUser.role,
      operation: prev ? 'EDITAR_FORMA_PAGAMENTO' : 'CRIAR_FORMA_PAGAMENTO',
      permissionUsed: 'canManagePaymentMethods',
      affectedRecordId: method.id,
      affectedRecordType: 'forma_pagamento',
      result: 'sucesso',
      details: `Forma de pagamento ${method.name} salva com sucesso.`,
      origin: 'web_painel',
      previousValues: prev,
      newValues: method,
    });

    return { success: true };
  },

  deleteFinancialPaymentMethod(
    id: string,
    currentUser: UserProfile
  ): { success: boolean; error?: string } {
    if (!this.hasUserPermission(currentUser, 'canManagePaymentMethods')) {
      return { success: false, error: 'Acesso negado: sem permissão para gerenciar formas de pagamento.' };
    }
    const methods = this.getFinancialPaymentMethods();
    const target = methods.find((m) => m.id === id);
    if (!target) {
      return { success: false, error: 'Forma de pagamento não encontrada.' };
    }
    const updated = methods.filter((m) => m.id !== id);
    setStored(STORAGE_KEYS.FINANCIAL_PAYMENT_METHODS, updated);

    this.addFinancialAuditEntry({
      userId: currentUser.id,
      userName: currentUser.name,
      userEmail: currentUser.email,
      userRole: currentUser.role,
      operation: 'DELETAR_FORMA_PAGAMENTO',
      permissionUsed: 'canManagePaymentMethods',
      affectedRecordId: id,
      affectedRecordType: 'forma_pagamento',
      result: 'sucesso',
      details: `Forma de pagamento "${target.name}" excluída com sucesso.`,
      origin: 'web_painel',
      previousValues: target,
    });
    return { success: true };
  },

  // Contas a Receber e a Pagar (com Filtro Efetivo por Perfil e Permissão)
  getFinancialAccounts(currentUser?: UserProfile): FinancialAccount[] {
    const raw = getStored<FinancialAccount[]>(STORAGE_KEYS.FINANCIAL_ACCOUNTS, INITIAL_FINANCIAL_ACCOUNTS);
    const list = Array.isArray(raw) ? raw : INITIAL_FINANCIAL_ACCOUNTS;

    if (!currentUser) return list;

    // Usuário inativo: nenhum dado retornado
    if (currentUser.status === 'inativo') {
      return [];
    }

    // Administrador: acesso completo
    if (currentUser.role === 'admin') {
      return list;
    }

    const canReceivables = this.hasUserPermission(currentUser, 'canViewReceivables');
    const canPayables = this.hasUserPermission(currentUser, 'canViewPayables');

    // Princípio do Menor Privilégio:
    if (!canReceivables && !canPayables) {
      return [];
    }

    if (canReceivables && !canPayables) {
      return list.filter((a) => a.type === 'receber');
    }

    if (!canReceivables && canPayables) {
      return list.filter((a) => a.type === 'pagar');
    }

    return list;
  },

  getFinancialAccountById(id: string, currentUser?: UserProfile): FinancialAccount | undefined {
    const accounts = this.getFinancialAccounts(currentUser);
    return accounts.find((a) => a.id === id);
  },

  createFinancialAccount(
    data: Omit<FinancialAccount, 'id' | 'code' | 'createdAt' | 'updatedAt'>,
    currentUser: UserProfile
  ): { success: boolean; account?: FinancialAccount; error?: string } {
    const isReceivable = data.type === 'receber';
    const requiredPermission = isReceivable ? 'canCreateReceivable' : 'canCreatePayable';

    if (!this.hasUserPermission(currentUser, requiredPermission)) {
      this.addFinancialAuditEntry({
        userId: currentUser.id,
        userName: currentUser.name,
        userEmail: currentUser.email,
        userRole: currentUser.role,
        operation: isReceivable ? 'CRIAR_RECEBIVEL_NEGADO' : 'CRIAR_PAGAVEL_NEGADO',
        permissionUsed: requiredPermission,
        affectedRecordType: isReceivable ? 'conta_receber' : 'conta_pagar',
        result: 'bloqueado',
        details: `Acesso negado: Usuário sem permissão '${requiredPermission}' tentou criar lançamento.`,
        origin: 'web_painel',
      });

      return {
        success: false,
        error: `Acesso negado: Você não possui a permissão '${requiredPermission}' para lançar esta conta.`,
      };
    }

    const allAccounts = getStored<FinancialAccount[]>(STORAGE_KEYS.FINANCIAL_ACCOUNTS, INITIAL_FINANCIAL_ACCOUNTS);
    const countThisType = allAccounts.filter((a) => a.type === data.type).length + 1;
    const prefix = isReceivable ? 'REC' : 'PAG';
    const year = new Date().getFullYear();
    const code = `${prefix}-${year}-${String(countThisType).padStart(4, '0')}`;

    const newAccount: FinancialAccount = {
      ...data,
      id: `${data.type}-${Date.now()}`,
      code,
      createdBy: currentUser.id,
      createdByName: currentUser.name,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const updatedList = [newAccount, ...allAccounts];
    setStored(STORAGE_KEYS.FINANCIAL_ACCOUNTS, updatedList);
    syncToPostgres('financial-accounts', 'POST', newAccount);

    this.addFinancialAuditEntry({
      userId: currentUser.id,
      userName: currentUser.name,
      userEmail: currentUser.email,
      userRole: currentUser.role,
      operation: isReceivable ? 'CRIAR_CONTA_RECEBER' : 'CRIAR_CONTA_PAGAR',
      permissionUsed: requiredPermission,
      affectedRecordId: newAccount.id,
      affectedRecordType: isReceivable ? 'conta_receber' : 'conta_pagar',
      result: 'sucesso',
      details: `Conta ${code} criada no valor de R$ ${data.amount.toFixed(2)} (${data.description}).`,
      origin: 'web_painel',
      newValues: newAccount,
    });

    return { success: true, account: newAccount };
  },

  updateFinancialAccount(
    account: FinancialAccount,
    currentUser: UserProfile
  ): { success: boolean; error?: string } {
    const isReceivable = account.type === 'receber';
    const requiredPermission = isReceivable ? 'canEditReceivable' : 'canEditPayable';

    if (!this.hasUserPermission(currentUser, requiredPermission)) {
      this.addFinancialAuditEntry({
        userId: currentUser.id,
        userName: currentUser.name,
        userEmail: currentUser.email,
        userRole: currentUser.role,
        operation: isReceivable ? 'EDITAR_RECEBIVEL_NEGADO' : 'EDITAR_PAGAVEL_NEGADO',
        permissionUsed: requiredPermission,
        affectedRecordId: account.id,
        affectedRecordType: isReceivable ? 'conta_receber' : 'conta_pagar',
        result: 'bloqueado',
        details: `Tentativa de editar a conta ${account.code} sem a permissão '${requiredPermission}'.`,
        origin: 'web_painel',
      });

      return {
        success: false,
        error: `Acesso negado: Você não possui a permissão '${requiredPermission}' para editar este registro.`,
      };
    }

    const allAccounts = getStored<FinancialAccount[]>(STORAGE_KEYS.FINANCIAL_ACCOUNTS, INITIAL_FINANCIAL_ACCOUNTS);
    const idx = allAccounts.findIndex((a) => a.id === account.id);
    if (idx < 0) {
      return { success: false, error: 'Conta financeira não encontrada.' };
    }

    const previous = allAccounts[idx];
    const updatedAccount: FinancialAccount = {
      ...account,
      updatedAt: new Date().toISOString(),
    };

    allAccounts[idx] = updatedAccount;
    setStored(STORAGE_KEYS.FINANCIAL_ACCOUNTS, allAccounts);
    syncToPostgres('financial-accounts', 'POST', updatedAccount);

    this.addFinancialAuditEntry({
      userId: currentUser.id,
      userName: currentUser.name,
      userEmail: currentUser.email,
      userRole: currentUser.role,
      operation: isReceivable ? 'EDITAR_CONTA_RECEBER' : 'EDITAR_CONTA_PAGAR',
      permissionUsed: requiredPermission,
      affectedRecordId: account.id,
      affectedRecordType: isReceivable ? 'conta_receber' : 'conta_pagar',
      result: 'sucesso',
      details: `Conta ${account.code} alterada com sucesso.`,
      origin: 'web_painel',
      previousValues: previous,
      newValues: updatedAccount,
    });

    return { success: true };
  },

  // Baixar / Liquidar Conta Financeira
  settleFinancialAccount(
    id: string,
    settlement: {
      paidAmount: number;
      paymentDate: string;
      paymentMethod?: string;
      bankAccountId?: string;
      bankAccountName?: string;
      discountAmount?: number;
      interestAmount?: number;
      notes?: string;
    },
    currentUser: UserProfile
  ): { success: boolean; error?: string } {
    const allAccounts = getStored<FinancialAccount[]>(STORAGE_KEYS.FINANCIAL_ACCOUNTS, INITIAL_FINANCIAL_ACCOUNTS);
    const idx = allAccounts.findIndex((a) => a.id === id);
    if (idx < 0) {
      return { success: false, error: 'Conta financeira não encontrada.' };
    }

    const account = allAccounts[idx];
    const isReceivable = account.type === 'receber';
    const requiredPermission = isReceivable ? 'canReceivePayment' : 'canPayBill';

    if (!this.hasUserPermission(currentUser, requiredPermission)) {
      this.addFinancialAuditEntry({
        userId: currentUser.id,
        userName: currentUser.name,
        userEmail: currentUser.email,
        userRole: currentUser.role,
        operation: isReceivable ? 'BAIXAR_RECEBIVEL_NEGADO' : 'PAGAR_CONTA_NEGADO',
        permissionUsed: requiredPermission,
        affectedRecordId: account.id,
        affectedRecordType: isReceivable ? 'conta_receber' : 'conta_pagar',
        result: 'bloqueado',
        details: `Tentativa de baixa na conta ${account.code} sem permissão '${requiredPermission}'.`,
        origin: 'web_painel',
      });

      return {
        success: false,
        error: `Acesso negado: Você não possui permissão para ${isReceivable ? 'receber/baixar contas' : 'pagar contas'}.`,
      };
    }

    if (account.status === 'pago') {
      return { success: false, error: 'Esta conta já se encontra quitada.' };
    }
    if (account.status === 'cancelado') {
      return { success: false, error: 'Contas canceladas não podem receber baixa.' };
    }

    const previous = { ...account };
    account.status = 'pago';
    account.paidAmount = settlement.paidAmount;
    account.paymentDate = settlement.paymentDate || new Date().toISOString();
    if (settlement.paymentMethod) account.paymentMethod = settlement.paymentMethod;
    if (settlement.bankAccountId) account.bankAccountId = settlement.bankAccountId;
    if (settlement.bankAccountName) account.bankAccountName = settlement.bankAccountName;
    if (settlement.discountAmount !== undefined) account.discountAmount = settlement.discountAmount;
    if (settlement.interestAmount !== undefined) account.interestAmount = settlement.interestAmount;
    if (settlement.notes) account.notes = settlement.notes;
    account.updatedAt = new Date().toISOString();

    // Atualiza saldo da conta bancária se selecionada
    if (settlement.bankAccountId) {
      const bankAccounts = this.getBankAccounts();
      const bankIdx = bankAccounts.findIndex((b) => b.id === settlement.bankAccountId);
      if (bankIdx >= 0) {
        if (isReceivable) {
          bankAccounts[bankIdx].currentBalance += settlement.paidAmount;
        } else {
          bankAccounts[bankIdx].currentBalance -= settlement.paidAmount;
        }
        setStored(STORAGE_KEYS.BANK_ACCOUNTS, bankAccounts);
      }
    }

    allAccounts[idx] = account;
    setStored(STORAGE_KEYS.FINANCIAL_ACCOUNTS, allAccounts);

    this.addFinancialAuditEntry({
      userId: currentUser.id,
      userName: currentUser.name,
      userEmail: currentUser.email,
      userRole: currentUser.role,
      operation: isReceivable ? 'BAIXAR_CONTA_RECEBER' : 'BAIXAR_CONTA_PAGAR',
      permissionUsed: requiredPermission,
      affectedRecordId: account.id,
      affectedRecordType: isReceivable ? 'conta_receber' : 'conta_pagar',
      result: 'sucesso',
      details: `Baixa realizada na conta ${account.code}: R$ ${settlement.paidAmount.toFixed(2)} liquidado via ${settlement.paymentMethod || 'não informado'}.`,
      origin: 'web_painel',
      previousValues: previous,
      newValues: account,
    });

    return { success: true };
  },

  // Cancelar Conta Financeira
  cancelFinancialAccount(
    id: string,
    reason: string,
    currentUser: UserProfile
  ): { success: boolean; error?: string } {
    if (!reason || !reason.trim()) {
      return { success: false, error: 'O motivo do cancelamento é obrigatório.' };
    }

    const allAccounts = getStored<FinancialAccount[]>(STORAGE_KEYS.FINANCIAL_ACCOUNTS, INITIAL_FINANCIAL_ACCOUNTS);
    const idx = allAccounts.findIndex((a) => a.id === id);
    if (idx < 0) {
      return { success: false, error: 'Conta financeira não encontrada.' };
    }

    const account = allAccounts[idx];
    const isReceivable = account.type === 'receber';
    const requiredPermission = isReceivable ? 'canCancelReceivable' : 'canCancelPayable';

    if (!this.hasUserPermission(currentUser, requiredPermission)) {
      this.addFinancialAuditEntry({
        userId: currentUser.id,
        userName: currentUser.name,
        userEmail: currentUser.email,
        userRole: currentUser.role,
        operation: isReceivable ? 'CANCELAR_RECEBIVEL_NEGADO' : 'CANCELAR_PAGAVEL_NEGADO',
        permissionUsed: requiredPermission,
        affectedRecordId: account.id,
        affectedRecordType: isReceivable ? 'conta_receber' : 'conta_pagar',
        result: 'bloqueado',
        details: `Tentativa de cancelamento da conta ${account.code} sem a permissão '${requiredPermission}'.`,
        origin: 'web_painel',
      });

      return {
        success: false,
        error: `Acesso negado: Você não possui a permissão '${requiredPermission}' para cancelar esta conta.`,
      };
    }

    if (account.status === 'pago') {
      return {
        success: false,
        error: 'Esta conta já foi liquidada. É necessário realizar o estorno antes de cancelar.',
      };
    }

    const previous = { ...account };
    account.status = 'cancelado';
    account.cancelledAt = new Date().toISOString();
    account.cancelledBy = currentUser.id;
    account.cancelledByName = currentUser.name;
    account.cancellationReason = reason.trim();
    account.updatedAt = new Date().toISOString();

    allAccounts[idx] = account;
    setStored(STORAGE_KEYS.FINANCIAL_ACCOUNTS, allAccounts);

    this.addFinancialAuditEntry({
      userId: currentUser.id,
      userName: currentUser.name,
      userEmail: currentUser.email,
      userRole: currentUser.role,
      operation: isReceivable ? 'CANCELAR_CONTA_RECEBER' : 'CANCELAR_CONTA_PAGAR',
      permissionUsed: requiredPermission,
      affectedRecordId: account.id,
      affectedRecordType: isReceivable ? 'conta_receber' : 'conta_pagar',
      result: 'sucesso',
      details: `Conta ${account.code} cancelada por ${currentUser.name}. Motivo: ${reason}`,
      origin: 'web_painel',
      previousValues: previous,
      newValues: account,
    });

    return { success: true };
  },

  // Estornar Pagamento ou Recebimento
  refundFinancialAccount(
    id: string,
    reason: string,
    currentUser: UserProfile
  ): { success: boolean; error?: string } {
    if (!reason || !reason.trim()) {
      return { success: false, error: 'O motivo do estorno é obrigatório.' };
    }

    const allAccounts = getStored<FinancialAccount[]>(STORAGE_KEYS.FINANCIAL_ACCOUNTS, INITIAL_FINANCIAL_ACCOUNTS);
    const idx = allAccounts.findIndex((a) => a.id === id);
    if (idx < 0) {
      return { success: false, error: 'Conta financeira não encontrada.' };
    }

    const account = allAccounts[idx];
    const isReceivable = account.type === 'receber';
    const requiredPermission = isReceivable ? 'canRefundReceivable' : 'canRefundPayable';

    if (!this.hasUserPermission(currentUser, requiredPermission)) {
      this.addFinancialAuditEntry({
        userId: currentUser.id,
        userName: currentUser.name,
        userEmail: currentUser.email,
        userRole: currentUser.role,
        operation: isReceivable ? 'ESTORNAR_RECEBIVEL_NEGADO' : 'ESTORNAR_PAGAVEL_NEGADO',
        permissionUsed: requiredPermission,
        affectedRecordId: account.id,
        affectedRecordType: isReceivable ? 'conta_receber' : 'conta_pagar',
        result: 'bloqueado',
        details: `Tentativa de estorno da conta ${account.code} sem a permissão '${requiredPermission}'.`,
        origin: 'web_painel',
      });

      return {
        success: false,
        error: `Acesso negado: Você não possui a permissão '${requiredPermission}' para estornar esta operação.`,
      };
    }

    if (account.status !== 'pago') {
      return { success: false, error: 'Apenas contas quitadas/pagas podem ser estornadas.' };
    }

    const previous = { ...account };
    const refundValue = account.paidAmount || account.amount;

    // Se houve movimentação de conta bancária, reverte o saldo
    if (account.bankAccountId) {
      const bankAccounts = this.getBankAccounts();
      const bankIdx = bankAccounts.findIndex((b) => b.id === account.bankAccountId);
      if (bankIdx >= 0) {
        if (isReceivable) {
          bankAccounts[bankIdx].currentBalance -= refundValue;
        } else {
          bankAccounts[bankIdx].currentBalance += refundValue;
        }
        setStored(STORAGE_KEYS.BANK_ACCOUNTS, bankAccounts);
      }
    }

    account.status = 'estornado';
    account.refundedAt = new Date().toISOString();
    account.refundedBy = currentUser.id;
    account.refundedByName = currentUser.name;
    account.refundReason = reason.trim();
    account.updatedAt = new Date().toISOString();

    allAccounts[idx] = account;
    setStored(STORAGE_KEYS.FINANCIAL_ACCOUNTS, allAccounts);

    this.addFinancialAuditEntry({
      userId: currentUser.id,
      userName: currentUser.name,
      userEmail: currentUser.email,
      userRole: currentUser.role,
      operation: isReceivable ? 'ESTORNAR_RECEBIMENTO' : 'ESTORNAR_PAGAMENTO',
      permissionUsed: requiredPermission,
      affectedRecordId: account.id,
      affectedRecordType: isReceivable ? 'conta_receber' : 'conta_pagar',
      result: 'sucesso',
      details: `Estorno de R$ ${refundValue.toFixed(2)} na conta ${account.code}. Motivo: ${reason}`,
      origin: 'web_painel',
      previousValues: previous,
      newValues: account,
    });

    return { success: true };
  },

  // Conceder / Alterar / Remover Permissões Financeiras de Colaborador (Apenas Administrador)
  grantFinancialPermissions(
    targetUserId: string,
    permissions: Partial<RolePermissions>,
    adminUser: UserProfile
  ): { success: boolean; error?: string } {
    if (adminUser.role !== 'admin' && !this.hasUserPermission(adminUser, 'canManageUsers')) {
      return {
        success: false,
        error: 'Apenas o Administrador do sistema pode alterar permissões financeiras de usuários.',
      };
    }

    const users = this.getUsers();
    const targetIdx = users.findIndex((u) => u.id === targetUserId);
    if (targetIdx < 0) {
      return { success: false, error: 'Colaborador não encontrado.' };
    }

    const targetUser = users[targetIdx];
    const prevPerms = { ...(targetUser.customPermissions || {}) };

    const updatedPerms: Partial<RolePermissions> = {
      ...targetUser.customPermissions,
      ...permissions,
    };

    targetUser.customPermissions = updatedPerms;
    this.saveUser(targetUser);

    // Se o usuário alterado for o usuário logado atualmente, atualiza a sessão
    const current = this.getCurrentUser();
    if (current && current.id === targetUserId) {
      this.setCurrentUser(targetUser);
    }

    // Registra auditoria da alteração de segurança
    this.addFinancialAuditEntry({
      userId: adminUser.id,
      userName: adminUser.name,
      userEmail: adminUser.email,
      userRole: adminUser.role,
      operation: 'ALTERAR_PERMISSOES_FINANCEIRAS',
      affectedRecordId: targetUserId,
      affectedRecordType: 'permissao',
      result: 'sucesso',
      details: `Administrador ${adminUser.name} alterou as permissões financeiras do colaborador ${targetUser.name} (${targetUser.role}).`,
      origin: 'web_painel',
      previousValues: prevPerms,
      newValues: permissions,
    });

    return { success: true };
  },

  // Conceder / Alterar / Remover Permissões de Custos e Precificação (Apenas Administrador)
  grantCostPricingPermissions(
    targetUserId: string,
    permissions: Partial<RolePermissions>,
    adminUser: UserProfile
  ): { success: boolean; error?: string } {
    if (adminUser.role !== 'admin' && !this.hasUserPermission(adminUser, 'canManageUsers')) {
      return {
        success: false,
        error: 'Apenas o Administrador do sistema pode alterar permissões do módulo de custos e precificação.',
      };
    }

    const users = this.getUsers();
    const targetIdx = users.findIndex((u) => u.id === targetUserId);
    if (targetIdx < 0) {
      return { success: false, error: 'Colaborador não encontrado.' };
    }

    const targetUser = users[targetIdx];
    const prevPerms = { ...(targetUser.customPermissions || {}) };

    const updatedPerms: Partial<RolePermissions> = {
      ...targetUser.customPermissions,
      ...permissions,
    };

    targetUser.customPermissions = updatedPerms;
    this.saveUser(targetUser);

    // Se o usuário alterado for o usuário logado atualmente, atualiza a sessão
    const current = this.getCurrentUser();
    if (current && current.id === targetUserId) {
      this.setCurrentUser(targetUser);
    }

    // Registra na auditoria de segurança
    const logsKey = 'mb_cost_pricing_audit_logs';
    const auditLogs = getStored<any[]>(logsKey, []);
    const newLog = {
      id: `CP-LOG-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      timestamp: new Date().toISOString(),
      userId: adminUser.id,
      userName: adminUser.name,
      userRole: adminUser.role,
      action: 'UPDATE_PERMISSIONS',
      entityType: 'PERMISSOES',
      entityId: targetUserId,
      entityName: `Permissões de ${targetUser.name}`,
      previousValues: prevPerms,
      newValues: permissions,
      notes: `Administrador ${adminUser.name} alterou permissões de precificação do usuário ${targetUser.name}.`,
    };
    auditLogs.unshift(newLog);
    setStored(logsKey, auditLogs);

    return { success: true };
  },

  // Consulta de Usuários com Acesso Financeiro (Requisito 6)
  getUsersWithFinancialAccess(): {
    user: UserProfile;
    isFullAdmin: boolean;
    grantedPermissionsCount: number;
    canViewModule: boolean;
    canViewDashboard: boolean;
    canReceivables: boolean;
    canPayables: boolean;
    canCashFlow: boolean;
    canReports: boolean;
    canAudit: boolean;
  }[] {
    const employees = this.getEmployees();
    const result: any[] = [];

    const financialKeys: (keyof RolePermissions)[] = [
      'canViewFinancialModule',
      'canViewFinancialDashboard',
      'canViewReceivables',
      'canCreateReceivable',
      'canEditReceivable',
      'canReceivePayment',
      'canCancelReceivable',
      'canRefundReceivable',
      'canViewPayables',
      'canCreatePayable',
      'canEditPayable',
      'canPayBill',
      'canCancelPayable',
      'canRefundPayable',
      'canViewCashFlow',
      'canViewRealizedValues',
      'canViewProjectedValues',
      'canViewFinancialReports',
      'canExportFinancialReports',
      'canManageFinancialCategories',
      'canManageCostCenters',
      'canManageBankAccounts',
      'canManagePaymentMethods',
      'canManageRecurringTransactions',
      'canManageFinancialSettings',
      'canViewFinancialAudit',
    ];

    for (const emp of employees) {
      if (emp.role === 'admin') {
        result.push({
          user: emp,
          isFullAdmin: true,
          grantedPermissionsCount: financialKeys.length,
          canViewModule: true,
          canViewDashboard: true,
          canReceivables: true,
          canPayables: true,
          canCashFlow: true,
          canReports: true,
          canAudit: true,
        });
        continue;
      }

      let count = 0;
      for (const k of financialKeys) {
        if (this.hasUserPermission(emp, k)) {
          count++;
        }
      }

      if (count > 0) {
        result.push({
          user: emp,
          isFullAdmin: false,
          grantedPermissionsCount: count,
          canViewModule: this.hasUserPermission(emp, 'canViewFinancialModule'),
          canViewDashboard: this.hasUserPermission(emp, 'canViewFinancialDashboard'),
          canReceivables: this.hasUserPermission(emp, 'canViewReceivables'),
          canPayables: this.hasUserPermission(emp, 'canViewPayables'),
          canCashFlow: this.hasUserPermission(emp, 'canViewCashFlow'),
          canReports: this.hasUserPermission(emp, 'canViewFinancialReports'),
          canAudit: this.hasUserPermission(emp, 'canViewFinancialAudit'),
        });
      }
    }

    return result;
  },

  // ==========================================
  // BACKUP E RECUPERAÇÃO DE DESASTRES (JSON SEGURO)
  // ==========================================

  getBackupScheduleConfig(): BackupScheduleConfig {
    const cfg = getStored<BackupScheduleConfig>(
      STORAGE_KEYS.BACKUP_SCHEDULE,
      INITIAL_BACKUP_SCHEDULE_CONFIG
    );
    // Garante que o nextRunAt esteja sempre calculado
    if (!cfg.nextRunAt) {
      cfg.nextRunAt = this.calculateNextBackupRun(cfg);
    }
    return cfg;
  },

  saveBackupScheduleConfig(config: BackupScheduleConfig): void {
    const updated: BackupScheduleConfig = {
      ...config,
      nextRunAt: this.calculateNextBackupRun(config),
      updatedAt: new Date().toISOString(),
    };
    setStored(STORAGE_KEYS.BACKUP_SCHEDULE, updated);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('mb_backup_schedule_updated', { detail: updated }));
    }
  },

  getBackupHistory(): BackupHistoryEntry[] {
    return getStored<BackupHistoryEntry[]>(
      STORAGE_KEYS.BACKUP_HISTORY,
      INITIAL_BACKUP_HISTORY
    );
  },

  addBackupHistoryEntry(entry: BackupHistoryEntry): void {
    const list = this.getBackupHistory();
    const cfg = this.getBackupScheduleConfig();
    const retention = cfg.retentionCount || 15;
    
    // Adiciona no topo e remove além da retenção
    const updated = [entry, ...list.filter((b) => b.id !== entry.id)].slice(0, retention);
    setStored(STORAGE_KEYS.BACKUP_HISTORY, updated);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('mb_backup_history_updated', { detail: updated }));
    }
  },

  deleteBackupHistoryEntry(id: string): void {
    const list = this.getBackupHistory();
    const updated = list.filter((b) => b.id !== id);
    setStored(STORAGE_KEYS.BACKUP_HISTORY, updated);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('mb_backup_history_updated', { detail: updated }));
    }
  },

  clearBackupHistory(): void {
    setStored(STORAGE_KEYS.BACKUP_HISTORY, []);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('mb_backup_history_updated', { detail: [] }));
    }
  },

  calculateNextBackupRun(config: BackupScheduleConfig): string {
    const now = new Date();
    const next = new Date(now);

    const [targetHours, targetMinutes] = (config.scheduledTime || '03:00')
      .split(':')
      .map((n) => parseInt(n, 10) || 0);

    if (config.frequency === 'hourly') {
      next.setHours(next.getHours() + 1, 0, 0, 0);
      return next.toISOString();
    }

    if (config.frequency === 'custom_interval') {
      const interval = Math.max(1, config.intervalHours || 6);
      next.setHours(next.getHours() + interval, 0, 0, 0);
      return next.toISOString();
    }

    if (config.frequency === 'weekly') {
      // Próximo dia da semana configurado
      const days = config.daysOfWeek && config.daysOfWeek.length > 0 ? config.daysOfWeek : [0]; // Padrão domingo
      next.setHours(targetHours, targetMinutes, 0, 0);
      let dayOffset = 1;
      while (!days.includes((next.getDay() + dayOffset) % 7) || dayOffset <= 0) {
        dayOffset++;
        if (dayOffset > 7) break;
      }
      next.setDate(next.getDate() + dayOffset);
      return next.toISOString();
    }

    // Padrão: 'daily'
    next.setHours(targetHours, targetMinutes, 0, 0);
    if (next.getTime() <= now.getTime()) {
      next.setDate(next.getDate() + 1);
    }
    return next.toISOString();
  },

  /**
   * Gera o pacote de Backup Seguro em formato JSON com metadados e checksum SHA-256
   */
  generateSecureBackupJson(options: {
    trigger?: 'manual' | 'scheduled' | 'disaster_recovery_preflight';
    passphrase?: string;
  } = {}): {
    jsonString: string;
    payload: SecureBackupPayload;
    checksum: string;
    filename: string;
    sizeBytes: number;
    sizeFormatted: string;
  } {
    const trigger = options.trigger || 'manual';
    const cfg = this.getBackupScheduleConfig();

    const products = cfg.includeProducts ? this.getProducts() : [];
    const categories = cfg.includeProducts ? this.getCategories() : [];
    const subcategories = cfg.includeProducts ? this.getSubcategories() : [];
    const quotes = cfg.includeQuotes ? this.getQuotes() : [];
    const orders = cfg.includeOrders ? this.getOrders() : [];
    const stockMovements = cfg.includeStock ? this.getStockMovements() : [];
    const customers = cfg.includeCustomers
      ? this.getUsers().filter((u) => u.role === 'cliente')
      : [];
    const companySettings = cfg.includeSettings ? this.getCompanySettings() : undefined;

    const timestamp = new Date().toISOString();

    const rawData = {
      products,
      categories,
      subcategories,
      quotes,
      orders,
      stockMovements,
      customers,
      companySettings,
    };

    // Gera checksum dos dados crus
    const rawDataJson = JSON.stringify(rawData);
    const dataChecksum = calculateSha256Sync(rawDataJson + (options.passphrase || 'mb_personaliza_salt'));

    const metadata: BackupMetadata = {
      system: 'MB Personaliza - Sistema Integrado de Gestão',
      appletId: 'c2a4b442-9b4f-41b6-8554-96d40752f5a7',
      version: '2.0.0',
      exportTimestamp: timestamp,
      exportType: trigger,
      schemaVersion: '1.0.0',
      counts: {
        products: products.length,
        categories: categories.length,
        subcategories: subcategories.length,
        quotes: quotes.length,
        orders: orders.length,
        stockMovements: stockMovements.length,
        customers: customers.length,
      },
      security: {
        algorithm: 'SHA-256',
        checksumSha256: dataChecksum,
        signature: `SIG-MB-${dataChecksum.substring(0, 16).toUpperCase()}`,
        encrypted: Boolean(cfg.encryptPayload),
        integrityVerified: true,
      },
      disasterRecoveryNote:
        'Cópia de segurança para recuperação de desastres. Contém catálogo, orçamentos e pedidos da MB Personaliza.',
    };

    const payload: SecureBackupPayload = {
      metadata,
      data: rawData,
    };

    const jsonString = JSON.stringify(payload, null, 2);
    const filename = generateBackupFilename(
      trigger === 'scheduled'
        ? 'mb_personaliza_backup_agendado'
        : 'mb_personaliza_backup_recuperacao'
    );

    const sizeBytes = new Blob([jsonString]).size;
    const sizeFormatted = formatBytes(sizeBytes);

    return {
      jsonString,
      payload,
      checksum: dataChecksum,
      filename,
      sizeBytes,
      sizeFormatted,
    };
  },

  /**
   * Valida a integridade, sintaxe JSON e integridade SHA-256 de um arquivo de backup
   */
  verifyBackupJson(jsonString: string): BackupVerificationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!jsonString || typeof jsonString !== 'string') {
      return {
        valid: false,
        checksumMatches: false,
        calculatedChecksum: '',
        statedChecksum: '',
        errors: ['Arquivo vazio ou inválido.'],
        warnings: [],
      };
    }

    let parsed: any;
    try {
      parsed = JSON.parse(jsonString);
    } catch (err: any) {
      return {
        valid: false,
        checksumMatches: false,
        calculatedChecksum: '',
        statedChecksum: '',
        errors: [`JSON inválido ou corrompido: ${err.message || 'Erro de parsing'}`],
        warnings: [],
      };
    }

    if (!parsed || typeof parsed !== 'object') {
      return {
        valid: false,
        checksumMatches: false,
        calculatedChecksum: '',
        statedChecksum: '',
        errors: ['O arquivo de backup deve ser um objeto JSON válido.'],
        warnings: [],
      };
    }

    const metadata: BackupMetadata = parsed.metadata;
    const data = parsed.data;

    if (!metadata) {
      errors.push('Metadados de cabeçalho ausentes (metadata não encontrado).');
    }

    if (!data) {
      errors.push('Corpo de dados ausente (data não encontrado).');
    }

    if (errors.length > 0) {
      return {
        valid: false,
        checksumMatches: false,
        calculatedChecksum: '',
        statedChecksum: metadata?.security?.checksumSha256 || '',
        metadata,
        errors,
        warnings,
      };
    }

    // Validação de entidades obrigatórias
    if (!Array.isArray(data.products)) {
      errors.push('A lista de produtos (data.products) não é um array válido.');
    }
    if (!Array.isArray(data.quotes)) {
      errors.push('A lista de orçamentos (data.quotes) não é um array válido.');
    }
    if (!Array.isArray(data.orders)) {
      errors.push('A lista de pedidos (data.orders) não é um array válido.');
    }

    // Verificação criptográfica do Checksum SHA-256
    const statedChecksum = metadata?.security?.checksumSha256 || '';
    const rawDataJson = JSON.stringify(data);
    const calculatedChecksum = calculateSha256Sync(rawDataJson + 'mb_personaliza_salt');

    const checksumMatches = statedChecksum === calculatedChecksum;
    if (!checksumMatches && statedChecksum) {
      warnings.push('Aviso de integridade: O hash SHA-256 dos dados difere do carimbo original assinado.');
    }

    const counts = {
      products: Array.isArray(data.products) ? data.products.length : 0,
      quotes: Array.isArray(data.quotes) ? data.quotes.length : 0,
      orders: Array.isArray(data.orders) ? data.orders.length : 0,
      categories: Array.isArray(data.categories) ? data.categories.length : 0,
    };

    return {
      valid: errors.length === 0,
      checksumMatches,
      calculatedChecksum,
      statedChecksum,
      metadata,
      counts,
      errors,
      warnings,
    };
  },

  /**
   * Restauração Segura de Desastres a partir de JSON
   * Executa validação de pré-voo, cria cópia de segurança antes do restore e aplica dados
   */
  restoreStoreDataFromBackup(
    jsonString: string,
    currentUser?: UserProfile
  ): {
    success: boolean;
    restoredCounts?: {
      products: number;
      categories: number;
      quotes: number;
      orders: number;
      stockMovements: number;
      customers: number;
    };
    error?: string;
  } {
    const verification = this.verifyBackupJson(jsonString);
    if (!verification.valid) {
      return {
        success: false,
        error: `Falha na verificação de integridade: ${verification.errors.join('; ')}`,
      };
    }

    try {
      const parsed: SecureBackupPayload = JSON.parse(jsonString);
      const data = parsed.data;

      // Cria backup de segurança de pré-voo antes de sobrescrever
      try {
        const safetyBackup = this.generateSecureBackupJson({ trigger: 'disaster_recovery_preflight' });
        this.addBackupHistoryEntry({
          id: `bkp-safety-${Date.now()}`,
          filename: safetyBackup.filename,
          timestamp: new Date().toISOString(),
          sizeBytes: safetyBackup.sizeBytes,
          sizeFormatted: safetyBackup.sizeFormatted,
          checksum: safetyBackup.checksum,
          trigger: 'disaster_recovery_preflight',
          status: 'verified',
          counts: {
            products: safetyBackup.payload.metadata.counts.products,
            quotes: safetyBackup.payload.metadata.counts.quotes,
            orders: safetyBackup.payload.metadata.counts.orders,
          },
        });
      } catch {
        // Ignora erro ao salvar ponto de segurança preliminar
      }

      // Restaura Produtos
      if (Array.isArray(data.products)) {
        this.saveProducts(data.products);
      }
      // Restaura Categorias
      if (Array.isArray(data.categories)) {
        this.saveCategories(data.categories);
      }
      // Restaura Subcategorias
      if (Array.isArray(data.subcategories)) {
        this.saveSubcategories(data.subcategories);
      }
      // Restaura Orçamentos
      if (Array.isArray(data.quotes)) {
        this.saveQuotes(data.quotes);
      }
      // Restaura Pedidos
      if (Array.isArray(data.orders)) {
        this.saveOrders(data.orders);
      }
      // Restaura Movimentações de Estoque
      if (Array.isArray(data.stockMovements)) {
        this.saveStockMovements(data.stockMovements);
      }
      // Restaura Clientes cadastrados se houver
      if (Array.isArray(data.customers) && data.customers.length > 0) {
        const existingUsers = this.getUsers();
        const nonCustomers = existingUsers.filter((u) => u.role !== 'cliente');
        this.saveUsers([...nonCustomers, ...data.customers]);
      }
      // Restaura Configurações da Empresa se houver
      if (data.companySettings && typeof data.companySettings === 'object') {
        this.saveCompanySettings(data.companySettings);
      }

      // Dispara eventos de atualização do sistema
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('mb_storage_updated'));
        window.dispatchEvent(new CustomEvent('mb_products_updated'));
        window.dispatchEvent(new CustomEvent('mb_quotes_updated'));
        window.dispatchEvent(new CustomEvent('mb_orders_updated'));
        window.dispatchEvent(new CustomEvent('mb_company_settings_updated'));
      }

      return {
        success: true,
        restoredCounts: {
          products: Array.isArray(data.products) ? data.products.length : 0,
          categories: Array.isArray(data.categories) ? data.categories.length : 0,
          quotes: Array.isArray(data.quotes) ? data.quotes.length : 0,
          orders: Array.isArray(data.orders) ? data.orders.length : 0,
          stockMovements: Array.isArray(data.stockMovements) ? data.stockMovements.length : 0,
          customers: Array.isArray(data.customers) ? data.customers.length : 0,
        },
      };
    } catch (err: any) {
      return {
        success: false,
        error: `Erro ao processar dados de recuperação: ${err.message || 'Erro inesperado'}`,
      };
    }
  },

  // ==========================================
  // MÓDULO DE CUPONS DE DESCONTO & PROMOÇÕES
  // ==========================================

  getCoupons(): DiscountCoupon[] {
    const list = getStored<DiscountCoupon[]>(STORAGE_KEYS.COUPONS, INITIAL_COUPONS);
    return Array.isArray(list) ? list : INITIAL_COUPONS;
  },

  saveCoupons(coupons: DiscountCoupon[]): void {
    setStored(STORAGE_KEYS.COUPONS, coupons);
  },

  getCouponById(id: string): DiscountCoupon | undefined {
    return this.getCoupons().find((c) => c.id === id);
  },

  getCouponByCode(code: string): DiscountCoupon | undefined {
    if (!code) return undefined;
    const clean = code.trim().toUpperCase();
    return this.getCoupons().find((c) => c.code.trim().toUpperCase() === clean);
  },

  saveCoupon(
    couponData: Partial<DiscountCoupon> & { code: string; campaignName: string; discountType: 'percentage' | 'fixed'; discountValue: number },
    actor?: { id: string; name: string; role: string }
  ): { success: boolean; coupon?: DiscountCoupon; error?: string } {
    const coupons = this.getCoupons();
    const cleanCode = couponData.code.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');

    if (!cleanCode) {
      return { success: false, error: 'O código do cupom é obrigatório e deve conter apenas letras, números e traços.' };
    }

    if (!couponData.campaignName || couponData.campaignName.trim().length === 0) {
      return { success: false, error: 'O nome da campanha ou descrição do cupom é obrigatório.' };
    }

    if (couponData.discountValue <= 0) {
      return { success: false, error: 'O valor do desconto deve ser maior que zero.' };
    }

    if (couponData.discountType === 'percentage' && couponData.discountValue > 100) {
      return { success: false, error: 'O percentual de desconto não pode ser maior que 100%.' };
    }

    const existingIndex = coupons.findIndex(
      (c) => c.id !== couponData.id && c.code.trim().toUpperCase() === cleanCode
    );
    if (existingIndex >= 0) {
      return { success: false, error: `Já existe um cupom cadastrado com o código "${cleanCode}".` };
    }

    const isUpdate = !!couponData.id;
    let savedCoupon: DiscountCoupon;

    if (isUpdate) {
      const idx = coupons.findIndex((c) => c.id === couponData.id);
      if (idx < 0) return { success: false, error: 'Cupom não encontrado para atualização.' };
      savedCoupon = {
        ...coupons[idx],
        ...couponData,
        code: cleanCode,
        updatedAt: new Date().toISOString(),
      };
      coupons[idx] = savedCoupon;
    } else {
      savedCoupon = {
        id: `cpn-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        code: cleanCode,
        campaignName: couponData.campaignName.trim(),
        discountType: couponData.discountType,
        discountValue: Number(couponData.discountValue),
        startDate: couponData.startDate || new Date().toISOString().substring(0, 16),
        endDate: couponData.endDate || new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().substring(0, 16),
        minPurchaseAmount: couponData.minPurchaseAmount ? Number(couponData.minPurchaseAmount) : undefined,
        maxDiscountAmount: couponData.maxDiscountAmount ? Number(couponData.maxDiscountAmount) : undefined,
        maxUsageTotal: couponData.maxUsageTotal ? Number(couponData.maxUsageTotal) : undefined,
        maxUsagePerCustomer: couponData.maxUsagePerCustomer ? Number(couponData.maxUsagePerCustomer) : 1,
        targetType: couponData.targetType || 'all_store',
        targetCategoryIds: couponData.targetCategoryIds || [],
        targetProductIds: couponData.targetProductIds || [],
        customerRestriction: couponData.customerRestriction || 'general',
        specificCustomerIds: couponData.specificCustomerIds || [],
        specificCustomerEmails: couponData.specificCustomerEmails || [],
        canCombineWithPromotions: couponData.canCombineWithPromotions !== undefined ? couponData.canCombineWithPromotions : true,
        status: couponData.status || 'active',
        internalNotes: couponData.internalNotes || '',
        currentUsageCount: 0,
        totalDiscountGranted: 0,
        totalSalesVolume: 0,
        sentCount: 0,
        createdAt: new Date().toISOString(),
        createdByUserId: actor?.id || 'admin',
        createdByUserName: actor?.name || 'Administrador',
      };
      coupons.unshift(savedCoupon);
    }

    this.saveCoupons(coupons);
    syncToPostgres('coupons', 'POST', savedCoupon);

    this.logCouponAudit({
      couponId: savedCoupon.id,
      couponCode: savedCoupon.code,
      action: isUpdate ? 'update' : 'create',
      userId: actor?.id || 'admin',
      userName: actor?.name || 'Administrador MB',
      userRole: actor?.role || 'admin',
      details: isUpdate
        ? `Atualização do cupom ${savedCoupon.code} (${savedCoupon.campaignName})`
        : `Criação do cupom ${savedCoupon.code} (${savedCoupon.discountType === 'percentage' ? `${savedCoupon.discountValue}%` : `R$ ${savedCoupon.discountValue.toFixed(2)}`})`,
    });

    return { success: true, coupon: savedCoupon };
  },

  deleteCoupon(id: string, actor?: { id: string; name: string; role: string }): { success: boolean; error?: string } {
    const coupons = this.getCoupons();
    const idx = coupons.findIndex((c) => c.id === id);
    if (idx < 0) return { success: false, error: 'Cupom não encontrado.' };

    const coupon = coupons[idx];
    if (coupon.currentUsageCount > 0) {
      // Soft cancel instead of hard delete if already used
      coupon.status = 'cancelled';
      coupon.updatedAt = new Date().toISOString();
      this.saveCoupons(coupons);
      this.logCouponAudit({
        couponId: coupon.id,
        couponCode: coupon.code,
        action: 'cancel',
        userId: actor?.id || 'admin',
        userName: actor?.name || 'Administrador MB',
        userRole: actor?.role || 'admin',
        details: `Cupom ${coupon.code} cancelado (não excluído fisicamente pois possui ${coupon.currentUsageCount} utilizações registradas)`,
      });
      return { success: true };
    }

    coupons.splice(idx, 1);
    this.saveCoupons(coupons);

    this.logCouponAudit({
      couponId: coupon.id,
      couponCode: coupon.code,
      action: 'delete',
      userId: actor?.id || 'admin',
      userName: actor?.name || 'Administrador MB',
      userRole: actor?.role || 'admin',
      details: `Exclusão permanente do cupom ${coupon.code}`,
    });

    return { success: true };
  },

  toggleCouponStatus(
    id: string,
    newStatus: 'active' | 'paused' | 'cancelled',
    actor?: { id: string; name: string; role: string }
  ): { success: boolean; error?: string } {
    const coupons = this.getCoupons();
    const coupon = coupons.find((c) => c.id === id);
    if (!coupon) return { success: false, error: 'Cupom não encontrado.' };

    const oldStatus = coupon.status;
    coupon.status = newStatus;
    coupon.updatedAt = new Date().toISOString();
    this.saveCoupons(coupons);
    syncToPostgres('coupons', 'POST', coupon);

    this.logCouponAudit({
      couponId: coupon.id,
      couponCode: coupon.code,
      action: newStatus === 'active' ? 'activate' : newStatus === 'paused' ? 'pause' : 'cancel',
      userId: actor?.id || 'admin',
      userName: actor?.name || 'Administrador MB',
      userRole: actor?.role || 'admin',
      details: `Status do cupom ${coupon.code} alterado de "${oldStatus}" para "${newStatus}"`,
    });

    return { success: true };
  },

  validateCoupon(
    rawCode: string,
    cartItems: Array<{ productId: string; categoryId?: string; unitPrice: number; quantity: number; isPromo?: boolean }>,
    subtotal: number,
    customer?: { id?: string; email?: string; cpfCnpj?: string }
  ): CouponValidationResult {
    const emptyResult = (errorCode: CouponValidationResult['errorCode'], errorMsg: string): CouponValidationResult => ({
      valid: false,
      discountAmount: 0,
      originalSubtotal: subtotal,
      eligibleSubtotal: 0,
      finalSubtotalAfterCoupon: subtotal,
      errorCode,
      error: errorMsg,
    });

    if (!rawCode || !rawCode.trim()) {
      return emptyResult('NOT_FOUND', 'Informe o código do cupom.');
    }

    const coupon = this.getCouponByCode(rawCode);
    if (!coupon) {
      return emptyResult('NOT_FOUND', 'Código de cupom inválido ou inexistente.');
    }

    const now = new Date();

    // 1. Status ativo
    if (coupon.status === 'paused') {
      return emptyResult('INACTIVE', 'Este cupom está temporariamente pausado pela administração.');
    }
    if (coupon.status === 'cancelled') {
      return emptyResult('INACTIVE', 'Este cupom foi cancelado e não pode mais ser utilizado.');
    }
    if (coupon.status === 'draft') {
      return emptyResult('INACTIVE', 'Este cupom ainda não foi publicado.');
    }

    // 2. Data de Início
    if (coupon.startDate) {
      const start = new Date(coupon.startDate);
      if (!isNaN(start.getTime()) && now < start) {
        return emptyResult('NOT_STARTED', `Este cupom será válido somente a partir de ${start.toLocaleDateString('pt-BR')} às ${start.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}.`);
      }
    }

    // 3. Data de Término
    if (coupon.endDate) {
      const end = new Date(coupon.endDate);
      if (!isNaN(end.getTime()) && now > end) {
        return emptyResult('EXPIRED', `Este cupom expirou em ${end.toLocaleDateString('pt-BR')}.`);
      }
    }

    // 4. Limite de utilizações globais
    if (coupon.maxUsageTotal && coupon.currentUsageCount >= coupon.maxUsageTotal) {
      return emptyResult('MAX_USAGE_REACHED', 'Este cupom atingiu o limite máximo de utilizações permitidas.');
    }

    // 5. Restrição de cliente específico
    if (coupon.customerRestriction === 'specific_customers') {
      const custEmail = customer?.email?.toLowerCase().trim();
      const custId = customer?.id;
      const allowedEmails = (coupon.specificCustomerEmails || []).map((e) => e.toLowerCase().trim());
      const allowedIds = coupon.specificCustomerIds || [];

      const isMatch = (custEmail && allowedEmails.includes(custEmail)) || (custId && allowedIds.includes(custId));
      if (!isMatch) {
        return emptyResult('CUSTOMER_NOT_ELIGIBLE', 'Este cupom é exclusivo e não está associado à sua conta/e-mail.');
      }
    }

    // 6. Limite de utilizações por cliente
    if (coupon.maxUsagePerCustomer && coupon.maxUsagePerCustomer > 0 && customer) {
      const usages = this.getCouponUsages(coupon.id);
      const custEmail = customer.email?.toLowerCase().trim();
      const custCpf = customer.cpfCnpj?.replace(/\D/g, '');
      const custId = customer.id;

      const customerUsageCount = usages.filter((u) => {
        if (u.status !== 'confirmed') return false;
        if (custId && u.customerId === custId) return true;
        if (custEmail && u.customerEmail?.toLowerCase().trim() === custEmail) return true;
        if (custCpf && u.customerCpfCnpj?.replace(/\D/g, '') === custCpf) return true;
        return false;
      }).length;

      if (customerUsageCount >= coupon.maxUsagePerCustomer) {
        return emptyResult('CUSTOMER_LIMIT_REACHED', `Você já atingiu o limite de ${coupon.maxUsagePerCustomer} ${coupon.maxUsagePerCustomer === 1 ? 'utilização' : 'utilizações'} para este cupom.`);
      }
    }

    // 7. Base de cálculo e produtos elegíveis
    let eligibleItems = cartItems || [];

    // Se não permite acumular com promoções, filtrar itens com promo
    if (!coupon.canCombineWithPromotions) {
      eligibleItems = eligibleItems.filter((item) => !item.isPromo);
    }

    // Filtrar por categorias ou produtos específicos
    if (coupon.targetType === 'categories' && coupon.targetCategoryIds && coupon.targetCategoryIds.length > 0) {
      eligibleItems = eligibleItems.filter((item) => item.categoryId && coupon.targetCategoryIds?.includes(item.categoryId));
    } else if (coupon.targetType === 'products' && coupon.targetProductIds && coupon.targetProductIds.length > 0) {
      eligibleItems = eligibleItems.filter((item) => coupon.targetProductIds?.includes(item.productId));
    }

    const eligibleSubtotal = eligibleItems.reduce((acc, it) => acc + (it.unitPrice * it.quantity), 0);

    if (eligibleSubtotal <= 0) {
      return emptyResult(
        'NO_ELIGIBLE_ITEMS',
        coupon.canCombineWithPromotions === false
          ? 'Este cupom não é acumulável com os produtos em promoção que estão no seu carrinho.'
          : 'Nenhum dos produtos no seu carrinho é elegível para este cupom.'
      );
    }

    // 8. Valor mínimo de compra elegível
    if (coupon.minPurchaseAmount && eligibleSubtotal < coupon.minPurchaseAmount) {
      return emptyResult(
        'MIN_PURCHASE_NOT_MET',
        `O valor mínimo em produtos elegíveis para usar este cupom é de R$ ${coupon.minPurchaseAmount.toFixed(2).replace('.', ',')}. Subtotal elegível atual: R$ ${eligibleSubtotal.toFixed(2).replace('.', ',')}.`
      );
    }

    // 9. Cálculo do desconto
    let calculatedDiscount = 0;
    if (coupon.discountType === 'percentage') {
      calculatedDiscount = (eligibleSubtotal * coupon.discountValue) / 100;
      if (coupon.maxDiscountAmount && coupon.maxDiscountAmount > 0) {
        calculatedDiscount = Math.min(calculatedDiscount, coupon.maxDiscountAmount);
      }
    } else {
      // Valor fixo
      calculatedDiscount = coupon.discountValue;
    }

    // O desconto nunca pode ultrapassar o subtotal elegível ou gerar valor negativo
    calculatedDiscount = Math.min(calculatedDiscount, eligibleSubtotal);
    calculatedDiscount = Math.max(0, Math.round(calculatedDiscount * 100) / 100);

    const finalSubtotal = Math.max(0, subtotal - calculatedDiscount);

    return {
      valid: true,
      coupon,
      discountAmount: calculatedDiscount,
      originalSubtotal: subtotal,
      eligibleSubtotal,
      finalSubtotalAfterCoupon: finalSubtotal,
    };
  },

  getCouponUsages(couponId?: string): CouponUsageEntry[] {
    const list = getStored<CouponUsageEntry[]>(STORAGE_KEYS.COUPON_USAGES, INITIAL_COUPON_USAGES);
    const valid = Array.isArray(list) ? list : INITIAL_COUPON_USAGES;
    if (!couponId) return valid;
    return valid.filter((u) => u.couponId === couponId);
  },

  recordCouponUsage(entry: CouponUsageEntry, actor?: { id: string; name: string; role: string }): void {
    const usages = this.getCouponUsages();
    usages.unshift(entry);
    setStored(STORAGE_KEYS.COUPON_USAGES, usages);

    // Atualiza estatísticas no cupom
    const coupons = this.getCoupons();
    const coupon = coupons.find((c) => c.id === entry.couponId || c.code.toUpperCase() === entry.couponCode.toUpperCase());
    if (coupon) {
      coupon.currentUsageCount = (coupon.currentUsageCount || 0) + 1;
      coupon.totalDiscountGranted = Number(((coupon.totalDiscountGranted || 0) + entry.discountApplied).toFixed(2));
      coupon.totalSalesVolume = Number(((coupon.totalSalesVolume || 0) + entry.finalTotal).toFixed(2));
      coupon.updatedAt = new Date().toISOString();
      this.saveCoupons(coupons);
    }

    this.logCouponAudit({
      couponId: entry.couponId,
      couponCode: entry.couponCode,
      action: 'confirm_order',
      userId: actor?.id || entry.customerId || 'online_checkout',
      userName: actor?.name || entry.customerName,
      userRole: actor?.role || 'cliente',
      details: `Utilização confirmada no pedido ${entry.orderCode} - Desconto concedido: R$ ${entry.discountApplied.toFixed(2)} - Total: R$ ${entry.finalTotal.toFixed(2)}`,
    });
  },

  cancelCouponUsage(orderId: string, reason?: string, actor?: { id: string; name: string; role: string }): void {
    const usages = this.getCouponUsages();
    const usage = usages.find((u) => u.orderId === orderId && u.status === 'confirmed');
    if (!usage) return;

    usage.status = 'cancelled';
    usage.cancelledAt = new Date().toISOString();
    usage.cancelReason = reason || 'Cancelamento de pedido';
    setStored(STORAGE_KEYS.COUPON_USAGES, usages);

    // Reverte contagem no cupom
    const coupons = this.getCoupons();
    const coupon = coupons.find((c) => c.id === usage.couponId);
    if (coupon) {
      coupon.currentUsageCount = Math.max(0, (coupon.currentUsageCount || 1) - 1);
      coupon.totalDiscountGranted = Math.max(0, Number(((coupon.totalDiscountGranted || 0) - usage.discountApplied).toFixed(2)));
      coupon.totalSalesVolume = Math.max(0, Number(((coupon.totalSalesVolume || 0) - usage.finalTotal).toFixed(2)));
      coupon.updatedAt = new Date().toISOString();
      this.saveCoupons(coupons);
    }

    this.logCouponAudit({
      couponId: usage.couponId,
      couponCode: usage.couponCode,
      action: 'revert_cancel',
      userId: actor?.id || 'system',
      userName: actor?.name || 'Sistema de Vendas',
      userRole: actor?.role || 'admin',
      details: `Utilização do cupom ${usage.couponCode} estornada referente ao pedido ${usage.orderCode}. Motivo: ${reason || 'Cancelamento'}`,
    });
  },

  getCouponSendHistory(couponId?: string): CouponSendHistoryEntry[] {
    const list = getStored<CouponSendHistoryEntry[]>(STORAGE_KEYS.COUPON_SEND_HISTORY, INITIAL_COUPON_SEND_HISTORY);
    const valid = Array.isArray(list) ? list : INITIAL_COUPON_SEND_HISTORY;
    if (!couponId) return valid;
    return valid.filter((s) => s.couponId === couponId);
  },

  recordCouponSend(entry: CouponSendHistoryEntry): void {
    const history = this.getCouponSendHistory();
    history.unshift(entry);
    setStored(STORAGE_KEYS.COUPON_SEND_HISTORY, history);

    const coupons = this.getCoupons();
    const coupon = coupons.find((c) => c.id === entry.couponId);
    if (coupon) {
      coupon.sentCount = (coupon.sentCount || 0) + 1;
      this.saveCoupons(coupons);
    }

    this.logCouponAudit({
      couponId: entry.couponId,
      couponCode: entry.couponCode,
      action: 'send',
      userId: entry.sentByUserId,
      userName: entry.sentByUserName,
      userRole: 'operador',
      details: `Envio do cupom ${entry.couponCode} para ${entry.customerName} via ${entry.channel.toUpperCase()} (${entry.status})`,
    });
  },

  getCouponAuditLogs(couponId?: string): CouponAuditLog[] {
    const list = getStored<CouponAuditLog[]>(STORAGE_KEYS.COUPON_AUDIT_LOGS, INITIAL_COUPON_AUDIT_LOGS);
    const valid = Array.isArray(list) ? list : INITIAL_COUPON_AUDIT_LOGS;
    if (!couponId) return valid;
    return valid.filter((l) => l.couponId === couponId);
  },

  logCouponAudit(entry: Omit<CouponAuditLog, 'id' | 'timestamp'>): void {
    const logs = this.getCouponAuditLogs();
    const newLog: CouponAuditLog = {
      id: `caud-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      ...entry,
    };
    logs.unshift(newLog);
    // Manter últimos 200 logs
    if (logs.length > 200) logs.length = 200;
    setStored(STORAGE_KEYS.COUPON_AUDIT_LOGS, logs);
  },

  getCouponMetrics(): {
    totalCoupons: number;
    activeCoupons: number;
    totalUsageCount: number;
    totalDiscountGranted: number;
    totalSalesVolume: number;
    totalSent: number;
    conversionRatePercent: number;
  } {
    const coupons = this.getCoupons();
    const totalCoupons = coupons.length;
    const activeCoupons = coupons.filter((c) => c.status === 'active').length;
    const totalUsageCount = coupons.reduce((acc, c) => acc + (c.currentUsageCount || 0), 0);
    const totalDiscountGranted = Number(coupons.reduce((acc, c) => acc + (c.totalDiscountGranted || 0), 0).toFixed(2));
    const totalSalesVolume = Number(coupons.reduce((acc, c) => acc + (c.totalSalesVolume || 0), 0).toFixed(2));
    const totalSent = coupons.reduce((acc, c) => acc + (c.sentCount || 0), 0);
    const conversionRatePercent = totalSent > 0 ? Number(((totalUsageCount / totalSent) * 100).toFixed(1)) : 0;

    return {
      totalCoupons,
      activeCoupons,
      totalUsageCount,
      totalDiscountGranted,
      totalSalesVolume,
      totalSent,
      conversionRatePercent,
    };
  },

  // Reset in-memory cache without any automatic admin login and resync with PostgreSQL
  resetAllData(): void {
    memoryStore.clear();
    hasSyncedProductsFromPostgres = false;
    memoryCurrentUser = { ...VISITOR_PROFILE };
    memoryUsers = [];
    memoryPermissionsMatrix = { ...INITIAL_PERMISSIONS_MATRIX };
    memoryPriceVisibilityMode = 'registered_only';
    setStored(STORAGE_KEYS.PRODUCTS, INITIAL_PRODUCTS);
    setStored(STORAGE_KEYS.CATEGORIES, INITIAL_CATEGORIES);
    setStored(STORAGE_KEYS.SUBCATEGORIES, INITIAL_SUBCATEGORIES);
    setStored(STORAGE_KEYS.QUOTES, []);
    setStored(STORAGE_KEYS.ORDERS, []);
    setStored(STORAGE_KEYS.STOCK_MOVEMENTS, []);
    setStored(STORAGE_KEYS.CART, []);
    setStored(STORAGE_KEYS.COMPANY_SETTINGS, INITIAL_COMPANY_SETTINGS);
    setStored(STORAGE_KEYS.LAYOUT_SETTINGS, INITIAL_LAYOUT_SETTINGS);
    setStored(STORAGE_KEYS.DELIVERY_SETTINGS, INITIAL_DELIVERY_SETTINGS);
    setStored(STORAGE_KEYS.PAYMENT_GATEWAYS, INITIAL_PAYMENT_GATEWAYS);
    setStored(STORAGE_KEYS.MAINTENANCE_SETTINGS, INITIAL_MAINTENANCE_SETTINGS);
    setStored(STORAGE_KEYS.COUPONS, INITIAL_COUPONS);
    setStored(STORAGE_KEYS.COUPON_USAGES, INITIAL_COUPON_USAGES);
    setStored(STORAGE_KEYS.COUPON_SEND_HISTORY, INITIAL_COUPON_SEND_HISTORY);
    setStored(STORAGE_KEYS.COUPON_AUDIT_LOGS, INITIAL_COUPON_AUDIT_LOGS);
    void this.initPostgresSync();
  },
};

export function hasPermission(
  role: UserRole,
  permission:
    | 'view_admin'
    | 'manage_products'
    | 'manage_pricing'
    | 'manage_stock'
    | 'manage_quotes'
    | 'manage_orders'
    | 'manage_users'
): boolean {
  switch (role) {
    case 'admin':
      return true;
    case 'gerente':
      return permission !== 'manage_users';
    case 'vendedor':
      return ['view_admin', 'manage_quotes', 'manage_orders'].includes(permission);
    case 'estoquista':
      return ['view_admin', 'manage_stock', 'manage_orders'].includes(permission);
    case 'cliente':
      return false;
    default:
      return false;
  }
}
