import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { isDatabaseConfigured } from '../db/index.ts';
import {
  seedInitialDataIfEmpty,
  getProductsFromDb,
  upsertProductInDb,
  deleteProductFromDb,
  getCategoriesFromDb,
  getSubcategoriesFromDb,
  upsertCategoryInDb,
  upsertSubcategoryInDb,
  getOrdersFromDb,
  upsertOrderInDb,
  getQuotesFromDb,
  upsertQuoteInDb,
  getUsersFromDb,
  getUserByEmailFromDb,
  getUserByCpfCnpjFromDb,
  upsertUserInDb,
  getCouponsFromDb,
  upsertCouponInDb,
  getSystemSettingsFromDb,
  getAllSystemSettingsFromDb,
  saveSystemSettingsToDb,
  getPriceVisibilityFromDb,
  getBackupsFromDb,
  recordBackupInDb,
  getStockMovementsFromDb,
  upsertStockMovementInDb,
  getBoletosFromDb,
  upsertBoletoInDb,
  getFinancialAccountsFromDb,
  upsertFinancialAccountInDb,
  getPdvSalesFromDb,
  upsertPdvSaleInDb,
  getCashSessionsFromDb,
  upsertCashSessionInDb,
  getPaymentTransactionsFromDb,
  upsertPaymentTransactionInDb,
  ensureAdditiveTablesInPostgres,
  runControlledLocalStorageMigration,
} from '../db/repository.ts';
import {
  canUserViewPrices,
  normalizePriceVisibilityMode,
  onlyDigits,
  redactProductsForPriceVisibility,
  sanitizeUserForClient,
  validateCpfCnpj,
  validateEmail,
} from './authUtils.ts';
import {
  hasServerPermission,
  isStaffRole,
  requireAdminSession,
  requireAuthSession,
  requirePermission,
  requireStaffSession,
} from '../middleware/auth.ts';
import type { PermissionKey } from '../types.ts';

export const databaseRouter = Router();

function isPlaceholderConfig(val?: string): boolean {
  if (!val || typeof val !== 'string') return false;
  const lower = val.toLowerCase().trim();
  return (
    lower.includes('seu-postgresql-externo') ||
    lower.includes('sua_senha_segura') ||
    lower.includes('seu-host') ||
    lower.includes('example.com') ||
    lower.includes('placeholder')
  );
}

function sanitizeCompanySettingsForPublic(company: any) {
  if (!company || typeof company !== 'object') return company;
  const {
    pixKey: _pk,
    bankInfo: _bi,
    ...safe
  } = company;
  return safe;
}

function isOwnRecord(record: any, user: { id: string; email: string }): boolean {
  if (!record || !user) return false;
  if (record.clientId && record.clientId === user.id) return true;
  if (
    record.clientEmail &&
    user.email &&
    String(record.clientEmail).trim().toLowerCase() === String(user.email).trim().toLowerCase()
  ) {
    return true;
  }
  return false;
}

// GET /api/db/status - Confirms database connectivity, engine, and counts (no secrets leaked)
databaseRouter.get('/status', async (_req: Request, res: Response) => {
  const rawDbUrl = process.env.DATABASE_URL;
  const hasValidDbUrl =
    !!rawDbUrl &&
    !isPlaceholderConfig(rawDbUrl) &&
    (rawDbUrl.startsWith('postgres://') || rawDbUrl.startsWith('postgresql://'));
  const rawHost = process.env.SQL_HOST;
  const hasValidHost = !!rawHost && !isPlaceholderConfig(rawHost);

  const hasDbConfig =
    hasValidDbUrl || (hasValidHost && (process.env.SQL_USER || process.env.SQL_ADMIN_USER));

  if (!hasDbConfig) {
    return res.json({
      success: true,
      database: 'PostgreSQL',
      connected: false,
      status: 'pending_configuration',
      message:
        'Aguardando inserção das variáveis de ambiente de conexão no .env (DATABASE_URL ou SQL_HOST/SQL_USER).',
      counts: {
        products: 0,
        categories: 0,
        orders: 0,
        quotes: 0,
        users: 0,
      },
    });
  }

  try {
    await seedInitialDataIfEmpty();
    const products = (await getProductsFromDb()) || [];
    const categories = (await getCategoriesFromDb()) || [];
    const orders = (await getOrdersFromDb()) || [];
    const quotes = (await getQuotesFromDb()) || [];
    const users = (await getUsersFromDb()) || [];

    res.json({
      success: true,
      database: 'PostgreSQL (Cloud SQL / Hostinger VPS)',
      connected: true,
      status: 'online',
      counts: {
        products: products.length,
        categories: categories.length,
        orders: orders.length,
        quotes: quotes.length,
        users: users.length,
      },
    });
  } catch (error: any) {
    console.warn('[PostgreSQL Status] Conexão pendente ou em inicialização:', error.message);
    res.json({
      success: true,
      database: 'PostgreSQL',
      connected: false,
      status: 'offline_or_unreachable',
      error: error.message || 'Falha ao conectar no banco',
      counts: {
        products: 0,
        categories: 0,
        orders: 0,
        quotes: 0,
        users: 0,
      },
    });
  }
});

// GET /api/db/init - Strictly scoped by server-verified session & price visibility rules
databaseRouter.get('/init', async (req: Request, res: Response) => {
  try {
    await seedInitialDataIfEmpty();
    const authUser = req.authUser || null;
    const isStaff = authUser ? isStaffRole(authUser.role) : false;

    const rawProducts = (await getProductsFromDb()) || [];
    const categories = (await getCategoriesFromDb()) || [];
    const subcategories = (await getSubcategoriesFromDb()) || [];
    const allSettings = await getAllSystemSettingsFromDb();
    const priceVisibilityMode = normalizePriceVisibilityMode(allSettings.price_visibility);
    const canViewPrices = canUserViewPrices(authUser, priceVisibilityMode);
    const safeProducts = redactProductsForPriceVisibility(rawProducts, canViewPrices);

    // Public visitor: strictly public catalog + safe storefront settings ONLY (zero PII, zero financial/admin data)
    if (!authUser) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      return res.json({
        success: true,
        priceVisibility: priceVisibilityMode,
        canViewPrices,
        data: {
          products: safeProducts,
          categories,
          subcategories,
          quotes: [],
          orders: [],
          users: [],
          coupons: [],
          stockMovements: [],
          boletos: [],
          financialAccounts: [],
          pdvSales: [],
          cashSessions: [],
          paymentTransactions: [],
          settings: {
            company: sanitizeCompanySettingsForPublic(allSettings.company),
            layout: allSettings.layout,
            delivery: allSettings.delivery,
            maintenance: allSettings.maintenance,
            price_visibility: { mode: priceVisibilityMode },
          },
        },
      });
    }

    // Authenticated Customer: own orders/quotes/boletos + own sanitized user profile + full product prices
    if (!isStaff) {
      const allQuotes = (await getQuotesFromDb()) || [];
      const allOrders = (await getOrdersFromDb()) || [];
      const allBoletos = (await getBoletosFromDb()) || [];
      const myOrders = allOrders.filter((o: any) => isOwnRecord(o, authUser));
      const myOrderIds = new Set(myOrders.map((o: any) => o.id));
      const myQuotes = allQuotes.filter((q: any) => isOwnRecord(q, authUser));
      const myBoletos = allBoletos.filter(
        (b: any) =>
          (b.orderId && myOrderIds.has(b.orderId)) ||
          (authUser.cpfCnpj &&
            onlyDigits(b.sacadoDocumento || b.sacadoCpfCnpj) === onlyDigits(authUser.cpfCnpj))
      );

      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      return res.json({
        success: true,
        priceVisibility: priceVisibilityMode,
        canViewPrices,
        data: {
          products: safeProducts,
          categories,
          subcategories,
          quotes: myQuotes,
          orders: myOrders,
          users: [authUser],
          coupons: [],
          stockMovements: [],
          boletos: myBoletos,
          financialAccounts: [],
          pdvSales: [],
          cashSessions: [],
          paymentTransactions: [],
          settings: {
            company: sanitizeCompanySettingsForPublic(allSettings.company),
            layout: allSettings.layout,
            delivery: allSettings.delivery,
            maintenance: allSettings.maintenance,
            price_visibility: { mode: priceVisibilityMode },
          },
        },
      });
    }

    // Authenticated Staff: each collection filtered strictly by server-verified permissions
    const canUsers = hasServerPermission(req, 'canManageUsers');
    const canQuotes = hasServerPermission(req, 'canManageQuotes');
    const canOrders =
      hasServerPermission(req, 'canManageOrders') ||
      hasServerPermission(req, 'canAccessPDV') ||
      hasServerPermission(req, 'canViewFinancialModule');
    const canCoupons = hasServerPermission(req, 'canViewCoupons');
    const canStock =
      hasServerPermission(req, 'canManageStock') || hasServerPermission(req, 'canAccessPDV');
    const canBoletos =
      hasServerPermission(req, 'canViewFinancialModule') ||
      hasServerPermission(req, 'canViewReceivables') ||
      hasServerPermission(req, 'canConfigureBoletoRules');
    const canFinAccounts =
      hasServerPermission(req, 'canViewFinancialModule') ||
      hasServerPermission(req, 'canViewReceivables') ||
      hasServerPermission(req, 'canViewPayables') ||
      hasServerPermission(req, 'canViewCashFlow');
    const canPDV =
      hasServerPermission(req, 'canAccessPDV') ||
      hasServerPermission(req, 'canViewFinancialModule');
    const canTx =
      hasServerPermission(req, 'canViewFinancialTransactions') ||
      hasServerPermission(req, 'canViewFinancialModule') ||
      hasServerPermission(req, 'canAccessPDV');

    const rawUsers = canUsers ? (await getUsersFromDb()) || [] : [authUser];
    const sanitizedUsers = rawUsers.map((u: any) => sanitizeUserForClient(u));

    const quotesData = canQuotes ? (await getQuotesFromDb()) || [] : [];
    const ordersData = canOrders ? (await getOrdersFromDb()) || [] : [];
    const rawCoupons = canCoupons ? (await getCouponsFromDb()) || [] : [];
    const coupons = rawCoupons.map((cp: any) => ({
      ...cp,
      maxUsageTotal: cp.maxUsageTotal ?? cp.maxUses ?? undefined,
      currentUsageCount: cp.currentUsageCount ?? cp.currentUses ?? 0,
      maxUsagePerCustomer: cp.maxUsagePerCustomer ?? cp.limitPerCustomer ?? 1,
      targetType: cp.targetType ?? cp.applicableType ?? 'all_store',
      targetProductIds: cp.allowedProductIds || [],
      targetCategoryIds: cp.allowedCategoryIds || [],
      specificCustomerIds: cp.allowedCustomerIds || [],
      canCombineWithPromotions: cp.canCombineWithPromotions ?? cp.allowCumulative ?? true,
    }));

    const stockMovements = canStock ? (await getStockMovementsFromDb()) || [] : [];
    const boletos = canBoletos ? (await getBoletosFromDb()) || [] : [];
    const financialAccounts = canFinAccounts ? (await getFinancialAccountsFromDb()) || [] : [];
    const rawPdvSales = canPDV ? (await getPdvSalesFromDb()) || [] : [];
    const rawCashSessions = canPDV ? (await getCashSessionsFromDb()) || [] : [];
    const rawPaymentTransactions = canTx ? (await getPaymentTransactionsFromDb()) || [] : [];

    const filteredSettings: Record<string, any> = {
      company: allSettings.company,
      layout: allSettings.layout,
      delivery: allSettings.delivery,
      maintenance: allSettings.maintenance,
      permissions: allSettings.permissions,
      price_visibility: { mode: priceVisibilityMode },
    };
    if (
      hasServerPermission(req, 'canManagePaymentGateways') ||
      hasServerPermission(req, 'canAccessPDV')
    ) {
      filteredSettings.gateways = allSettings.gateways;
    }
    if (
      hasServerPermission(req, 'canConfigureBoletoRules') ||
      hasServerPermission(req, 'canViewFinancialModule')
    ) {
      filteredSettings.boleto = allSettings.boleto;
    }

    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    return res.json({
      success: true,
      priceVisibility: priceVisibilityMode,
      canViewPrices,
      data: {
        products: safeProducts,
        categories,
        subcategories,
        quotes: quotesData,
        orders: ordersData,
        users: sanitizedUsers,
        coupons,
        stockMovements,
        boletos,
        financialAccounts,
        pdvSales: rawPdvSales.map((s: any) => s.rawData || s),
        cashSessions: rawCashSessions.map((cs: any) => cs.rawData || cs),
        paymentTransactions: rawPaymentTransactions.map((tx: any) => tx.rawData || tx),
        settings: filteredSettings,
      },
    });
  } catch (error: any) {
    console.error('Failed to initialize database sync:', error);
    return res.status(500).json({
      success: false,
      error: error?.message || 'Database temporarily unavailable',
    });
  }
});

// Products (Public read with server-side price redaction; staff permission required for mutations)
databaseRouter.get('/products', async (req: Request, res: Response) => {
  try {
    await seedInitialDataIfEmpty();
    const raw = (await getProductsFromDb()) || [];
    const priceVisibilityMode = await getPriceVisibilityFromDb();
    const allowed = canUserViewPrices(req.authUser, priceVisibilityMode);
    const safeProducts = redactProductsForPriceVisibility(raw, allowed);
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.json({ success: true, canViewPrices: allowed, priceVisibility: priceVisibilityMode, products: safeProducts });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

databaseRouter.post(
  '/products',
  requirePermission('canManageProducts'),
  async (req: Request, res: Response) => {
    try {
      const saved = await upsertProductInDb(req.body);
      res.json({ success: true, product: saved });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

databaseRouter.delete(
  '/products/:id',
  requirePermission('canManageProducts'),
  async (req: Request, res: Response) => {
    try {
      await deleteProductFromDb(req.params.id);
      res.json({ success: true, message: 'Produto excluído do PostgreSQL' });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

// Categories & Subcategories (Public read; authorized staff write)
databaseRouter.get('/categories', async (_req: Request, res: Response) => {
  try {
    await seedInitialDataIfEmpty();
    const data = await getCategoriesFromDb();
    res.json({ success: true, categories: data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

databaseRouter.post(
  '/categories',
  requirePermission('canManageCategories'),
  async (req: Request, res: Response) => {
    try {
      const saved = await upsertCategoryInDb(req.body);
      res.json({ success: true, category: saved });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

databaseRouter.post(
  '/subcategories',
  requirePermission('canManageCategories'),
  async (req: Request, res: Response) => {
    try {
      const saved = await upsertSubcategoryInDb(req.body);
      res.json({ success: true, subcategory: saved });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

// Orders
databaseRouter.get('/orders', requireAuthSession, async (req: Request, res: Response) => {
  try {
    const authUser = req.authUser!;
    const all = (await getOrdersFromDb()) || [];
    if (isStaffRole(authUser.role)) {
      if (
        !hasServerPermission(req, 'canManageOrders') &&
        !hasServerPermission(req, 'canAccessPDV') &&
        !hasServerPermission(req, 'canViewFinancialModule')
      ) {
        return res.status(403).json({ success: false, error: 'Acesso negado aos pedidos.' });
      }
      return res.json({ success: true, orders: all });
    }
    return res.json({
      success: true,
      orders: all.filter((o: any) => isOwnRecord(o, authUser)),
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

databaseRouter.post('/orders', requireAuthSession, async (req: Request, res: Response) => {
  try {
    const authUser = req.authUser!;
    const payload = req.body || {};

    if (!isStaffRole(authUser.role)) {
      const all = (await getOrdersFromDb()) || [];
      const existing = all.find((o: any) => o.id === payload.id);
      if (existing) {
        return res.status(403).json({
          success: false,
          error: 'Clientes não podem alterar pedidos já registrados.',
        });
      }
      // Enforce ownership and initial statuses on customer-created order
      const saved = await upsertOrderInDb({
        ...payload,
        clientId: authUser.id,
        clientEmail: authUser.email,
        orderStatus: 'novo',
        paymentStatus: 'pendente',
      });
      return res.json({ success: true, order: saved });
    }

    if (
      !hasServerPermission(req, 'canManageOrders') &&
      !hasServerPermission(req, 'canAccessPDV')
    ) {
      return res.status(403).json({ success: false, error: 'Permissão insuficiente para gravar pedidos.' });
    }

    const saved = await upsertOrderInDb(payload);
    res.json({ success: true, order: saved });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Quotes
databaseRouter.get('/quotes', requireAuthSession, async (req: Request, res: Response) => {
  try {
    const authUser = req.authUser!;
    const all = (await getQuotesFromDb()) || [];
    if (isStaffRole(authUser.role)) {
      if (!hasServerPermission(req, 'canManageQuotes')) {
        return res.status(403).json({ success: false, error: 'Acesso negado aos orçamentos.' });
      }
      return res.json({ success: true, quotes: all });
    }
    return res.json({
      success: true,
      quotes: all.filter((q: any) => isOwnRecord(q, authUser)),
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

databaseRouter.post('/quotes', async (req: Request, res: Response) => {
  try {
    const authUser = req.authUser || null;
    const payload = req.body || {};

    if (!authUser || !isStaffRole(authUser.role)) {
      const priceVisibility = await getPriceVisibilityFromDb();
      const allowedPrices = canUserViewPrices(authUser, priceVisibility);
      const sanitizedItems = Array.isArray(payload.items)
        ? payload.items.map((item: any) => ({
            ...item,
            unit_price_estimated: allowedPrices ? item.unit_price_estimated : 0,
            subtotal: allowedPrices ? item.subtotal : 0,
          }))
        : [];

      const safeQuote = {
        ...payload,
        clientId: authUser ? authUser.id : undefined,
        status: 'pendente',
        adminNotes: undefined,
        respondedAt: undefined,
        respondedBy: undefined,
        billingTerms: undefined,
        items: sanitizedItems,
        subtotal: allowedPrices ? payload.subtotal || 0 : 0,
        discount: allowedPrices ? payload.discount || 0 : 0,
        total: allowedPrices ? payload.total || payload.totalEstimated || 0 : 0,
        totalEstimated: allowedPrices ? payload.totalEstimated || payload.total || 0 : 0,
      };
      const saved = await upsertQuoteInDb(safeQuote);
      return res.json({ success: true, quote: saved });
    }

    if (!hasServerPermission(req, 'canManageQuotes')) {
      return res.status(403).json({ success: false, error: 'Permissão insuficiente para gerenciar orçamentos.' });
    }

    const saved = await upsertQuoteInDb(payload);
    res.json({ success: true, quote: saved });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Users (Strictly Admin/canManageUsers, ALWAYS sanitized without passwordHash)
databaseRouter.get(
  '/users',
  requirePermission('canManageUsers'),
  async (_req: Request, res: Response) => {
    try {
      const data = await getUsersFromDb();
      res.json({ success: true, users: (data || []).map((u: any) => sanitizeUserForClient(u)) });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

databaseRouter.post(
  '/users',
  requirePermission('canManageUsers'),
  async (req: Request, res: Response) => {
    try {
      const payload = req.body || {};
      const uid = String(payload.uid || payload.id || '');
      const cleanEmail = String(payload.email || '').trim().toLowerCase();

      if (!payload.name || !validateEmail(cleanEmail)) {
        return res.status(400).json({
          success: false,
          error: 'Nome e e-mail válido são obrigatórios.',
        });
      }

      if (payload.cpfCnpj) {
        const docCheck = validateCpfCnpj(payload.cpfCnpj);
        if (!docCheck.valid) {
          return res.status(400).json({ success: false, error: docCheck.message });
        }
        const dupDoc = await getUserByCpfCnpjFromDb(docCheck.normalized);
        if (dupDoc && (dupDoc.uid || dupDoc.id) !== uid) {
          return res.status(409).json({
            success: false,
            error: 'Já existe outro usuário cadastrado com este CPF/CNPJ.',
          });
        }
      }

      const dupEmail = await getUserByEmailFromDb(cleanEmail);
      if (dupEmail && (dupEmail.uid || dupEmail.id) !== uid) {
        return res.status(409).json({
          success: false,
          error: 'Já existe outro usuário cadastrado com este e-mail.',
        });
      }

      // Only admin can assign/modify admin role
      if (payload.role === 'admin' && req.authUser?.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'Apenas administradores podem conceder perfil de Administrador.',
        });
      }

      const saved = await upsertUserInDb(payload);
      res.json({ success: true, user: saved.map((u: any) => sanitizeUserForClient(u)) });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

// Coupons
databaseRouter.get(
  '/coupons',
  requirePermission('canViewCoupons'),
  async (_req: Request, res: Response) => {
    try {
      const data = await getCouponsFromDb();
      res.json({ success: true, coupons: data });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

databaseRouter.post(
  '/coupons',
  requirePermission('canCreateCoupons'),
  async (req: Request, res: Response) => {
    try {
      const saved = await upsertCouponInDb(req.body);
      res.json({ success: true, coupon: saved });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

// Settings (Public keys safe; sensitive keys guarded by specific RBAC permission)
const PUBLIC_SETTING_KEYS = new Set(['company', 'layout', 'delivery', 'maintenance', 'price_visibility']);
const SETTING_WRITE_PERMISSION: Record<string, PermissionKey | 'ADMIN_ONLY'> = {
  company: 'canManageCompanySettings',
  price_visibility: 'canManageCompanySettings',
  delivery: 'canManageDeliverySettings',
  boleto: 'canConfigureBoletoRules',
  layout: 'canCustomizeLayout',
  maintenance: 'canManageMaintenanceMode',
  gateways: 'canManagePaymentGateways',
  permissions: 'ADMIN_ONLY',
  pdv: 'canAccessPDV',
};

databaseRouter.get('/settings/:key', async (req: Request, res: Response) => {
  try {
    const key = req.params.key;
    if (!PUBLIC_SETTING_KEYS.has(key)) {
      if (!req.authUser || !isStaffRole(req.authUser.role)) {
        return res.status(403).json({
          success: false,
          error: 'Acesso negado a esta configuração interna.',
        });
      }
      if (key === 'gateways' && !hasServerPermission(req, 'canManagePaymentGateways') && !hasServerPermission(req, 'canAccessPDV')) {
        return res.status(403).json({ success: false, error: 'Permissão insuficiente.' });
      }
    }

    const value = await getSystemSettingsFromDb(key);
    if (key === 'company' && (!req.authUser || !isStaffRole(req.authUser.role))) {
      return res.json({ success: true, key, value: sanitizeCompanySettingsForPublic(value) });
    }
    res.json({ success: true, key, value });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

databaseRouter.post('/settings/:key', requireStaffSession, async (req: Request, res: Response) => {
  try {
    const key = req.params.key;
    const reqPerm = SETTING_WRITE_PERMISSION[key] || 'ADMIN_ONLY';
    if (reqPerm === 'ADMIN_ONLY') {
      if (req.authUser?.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'Apenas administradores podem alterar esta configuração.',
        });
      }
    } else if (!hasServerPermission(req, reqPerm)) {
      return res.status(403).json({
        success: false,
        error: `Permissão '${String(reqPerm)}' necessária para alterar '${key}'.`,
      });
    }

    await saveSystemSettingsToDb(key, req.body.value);
    res.json({ success: true, key, message: 'Configurações salvas no PostgreSQL' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Backups (Admin only)
databaseRouter.get('/backups', requireAdminSession, async (_req: Request, res: Response) => {
  try {
    const data = await getBackupsFromDb();
    res.json({ success: true, backups: data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

databaseRouter.post('/backups', requireAdminSession, async (req: Request, res: Response) => {
  try {
    const saved = await recordBackupInDb(req.body);
    res.json({ success: true, backup: saved });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Stock Movements
databaseRouter.get(
  '/stock-movements',
  requirePermission('canManageStock'),
  async (_req: Request, res: Response) => {
    try {
      const data = await getStockMovementsFromDb();
      res.json({ success: true, stockMovements: data });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

databaseRouter.post('/stock-movements', requireStaffSession, async (req: Request, res: Response) => {
  try {
    if (!hasServerPermission(req, 'canManageStock') && !hasServerPermission(req, 'canAccessPDV')) {
      return res.status(403).json({ success: false, error: 'Permissão de estoque ou PDV necessária.' });
    }
    const saved = await upsertStockMovementInDb(req.body);
    res.json({ success: true, stockMovement: saved });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Boletos
databaseRouter.get('/boletos', requireAuthSession, async (req: Request, res: Response) => {
  try {
    const authUser = req.authUser!;
    const data = (await getBoletosFromDb()) || [];
    if (isStaffRole(authUser.role)) {
      if (
        !hasServerPermission(req, 'canViewFinancialModule') &&
        !hasServerPermission(req, 'canViewReceivables') &&
        !hasServerPermission(req, 'canConfigureBoletoRules')
      ) {
        return res.status(403).json({ success: false, error: 'Acesso negado aos boletos.' });
      }
      return res.json({ success: true, boletos: data });
    }
    const allOrders = (await getOrdersFromDb()) || [];
    const myOrderIds = new Set(
      allOrders.filter((o: any) => isOwnRecord(o, authUser)).map((o: any) => o.id)
    );
    const mine = data.filter(
      (b: any) =>
        (b.orderId && myOrderIds.has(b.orderId)) ||
        (authUser.cpfCnpj &&
          onlyDigits(b.sacadoDocumento || b.sacadoCpfCnpj) === onlyDigits(authUser.cpfCnpj))
    );
    return res.json({ success: true, boletos: mine });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

databaseRouter.post('/boletos', requireStaffSession, async (req: Request, res: Response) => {
  try {
    if (
      !hasServerPermission(req, 'canViewFinancialModule') &&
      !hasServerPermission(req, 'canViewReceivables') &&
      !hasServerPermission(req, 'canConfigureBoletoRules')
    ) {
      return res.status(403).json({ success: false, error: 'Permissão financeira necessária para gravar boletos.' });
    }
    const saved = await upsertBoletoInDb(req.body);
    res.json({ success: true, boleto: saved });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Financial Accounts (Strictly Financial Module permission)
databaseRouter.get(
  '/financial-accounts',
  requirePermission('canViewFinancialModule'),
  async (_req: Request, res: Response) => {
    try {
      const data = await getFinancialAccountsFromDb();
      res.json({ success: true, financialAccounts: data });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

databaseRouter.post('/financial-accounts', requireStaffSession, async (req: Request, res: Response) => {
  try {
    if (
      !hasServerPermission(req, 'canViewFinancialModule') &&
      !hasServerPermission(req, 'canCreateReceivable') &&
      !hasServerPermission(req, 'canCreatePayable')
    ) {
      return res.status(403).json({ success: false, error: 'Permissão financeira necessária.' });
    }
    const saved = await upsertFinancialAccountInDb(req.body);
    res.json({ success: true, financialAccount: saved });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PDV Sales & Cash Register Sessions (Strictly PDV permission)
databaseRouter.get(
  '/pdv-sales',
  requirePermission('canAccessPDV'),
  async (_req: Request, res: Response) => {
    try {
      const data = await getPdvSalesFromDb();
      res.json({ success: true, pdvSales: data.map((s: any) => s.rawData || s) });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

databaseRouter.post(
  '/pdv-sales',
  requirePermission('canAccessPDV'),
  async (req: Request, res: Response) => {
    try {
      const saved = await upsertPdvSaleInDb(req.body);
      res.json({ success: true, pdvSale: saved });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

databaseRouter.get(
  '/cash-sessions',
  requirePermission('canAccessPDV'),
  async (_req: Request, res: Response) => {
    try {
      const data = await getCashSessionsFromDb();
      res.json({ success: true, cashSessions: data.map((cs: any) => cs.rawData || cs) });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

databaseRouter.post(
  '/cash-sessions',
  requirePermission('canAccessPDV'),
  async (req: Request, res: Response) => {
    try {
      const saved = await upsertCashSessionInDb(req.body);
      res.json({ success: true, cashSession: saved });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

// Payment Transactions
databaseRouter.get('/payment-transactions', requireStaffSession, async (req: Request, res: Response) => {
  try {
    if (
      !hasServerPermission(req, 'canViewFinancialTransactions') &&
      !hasServerPermission(req, 'canViewFinancialModule') &&
      !hasServerPermission(req, 'canAccessPDV')
    ) {
      return res.status(403).json({ success: false, error: 'Acesso negado às transações financeiras.' });
    }
    const data = await getPaymentTransactionsFromDb();
    res.json({ success: true, paymentTransactions: data.map((tx: any) => tx.rawData || tx) });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

databaseRouter.post('/payment-transactions', requireAuthSession, async (req: Request, res: Response) => {
  try {
    const saved = await upsertPaymentTransactionInDb(req.body);
    res.json({ success: true, paymentTransaction: saved });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Admin-only infrastructure & migration endpoints
databaseRouter.get('/vps-preflight', requireAdminSession, async (_req: Request, res: Response) => {
  try {
    const uploadsDir = path.join(process.cwd(), 'uploads');
    const backupsDir = path.join(process.cwd(), 'data', 'backups');

    const countFilesRecursive = (dir: string): number => {
      if (!fs.existsSync(dir)) return 0;
      let count = 0;
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.isDirectory()) {
          count += countFilesRecursive(path.join(dir, entry.name));
        } else {
          count++;
        }
      }
      return count;
    };

    const backupFiles = fs.existsSync(backupsDir)
      ? fs
          .readdirSync(backupsDir)
          .filter((f) => f.endsWith('.json') || f.endsWith('.sql.gz') || f.endsWith('.json.gz'))
          .sort()
          .reverse()
      : [];

    const rawDbUrl = process.env.DATABASE_URL;
    const hasValidDbUrl =
      !!rawDbUrl &&
      !isPlaceholderConfig(rawDbUrl) &&
      (rawDbUrl.startsWith('postgres://') || rawDbUrl.startsWith('postgresql://'));
    const hasValidHost = !!process.env.SQL_HOST && !isPlaceholderConfig(process.env.SQL_HOST);

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      database: {
        configured: isDatabaseConfigured(),
        connectionMode: hasValidDbUrl
          ? 'DATABASE_URL'
          : hasValidHost
          ? process.env.SQL_HOST?.startsWith('/')
            ? 'UNIX_SOCKET'
            : 'SQL_HOST_TCP'
          : 'LOCAL_STORAGE_FALLBACK',
        sslEnabled:
          process.env.SQL_SSL === 'true' ||
          process.env.SSL_MODE === 'require' ||
          (hasValidDbUrl && rawDbUrl!.includes('sslmode=require')),
      },
      persistence: {
        uploadsDirExists: fs.existsSync(uploadsDir),
        uploadsFileCount: countFilesRecursive(uploadsDir),
        backupsDirExists: fs.existsSync(backupsDir),
        backupFilesCount: backupFiles.length,
        latestBackupFile: backupFiles[0] || null,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message || 'Erro no diagnóstico VPS' });
  }
});

databaseRouter.post('/ensure-additive-tables', requireAdminSession, async (_req: Request, res: Response) => {
  try {
    const result = await ensureAdditiveTablesInPostgres();
    res.json({ success: true, ...result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message || 'Falha ao verificar tabelas aditivas' });
  }
});

databaseRouter.post('/migrate-local-storage', requireAdminSession, async (req: Request, res: Response) => {
  const { snapshot = {}, dryRun = true } = req.body || {};
  try {
    const report = await runControlledLocalStorageMigration(snapshot, Boolean(dryRun));
    res.json(report);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error?.message || 'Erro ao executar validação/migração controlada.',
    });
  }
});
