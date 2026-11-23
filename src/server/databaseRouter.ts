import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { isDatabaseConfigured, testDatabaseConnection } from '../db/index.ts';
import {
  seedInitialDataIfEmpty,
  getProductsFromDb,
  upsertProductInDb,
  deleteProductFromDb,
  getCategoriesFromDb,
  getSubcategoriesFromDb,
  upsertCategoryInDb,
  hasCategoryProductsInDb,
  deleteCategoryFromDb,
  upsertSubcategoryInDb,
  deleteSubcategoryFromDb,
  getOrdersFromDb,
  upsertOrderInDb,
  checkoutOrderAtomicInDb,
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
  settleBoletoAtomicInDb,
  getFinancialAccountsFromDb,
  upsertFinancialAccountInDb,
  getPdvSalesFromDb,
  upsertPdvSaleInDb,
  createPdvSaleAtomicInDb,
  getCashSessionsFromDb,
  upsertCashSessionInDb,
  getPaymentTransactionsFromDb,
  upsertPaymentTransactionInDb,
  getCartFromDb,
  saveCartToDb,
  getFavoritesFromDb,
  saveFavoritesToDb,
  getAppOperationLogsFromDb,
  insertAppOperationLogInDb,
  getDatabaseCountsFromDb,
  ensureAdditiveTablesInPostgres,
  runControlledLocalStorageMigration,
} from '../db/repository.ts';
import {
  canUserViewPrices,
  normalizePriceVisibilityMode,
  onlyDigits,
  parseCookies,
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
import { handleRouterError, isDbUnavailableError } from './dbErrorHelper.ts';
import type { PermissionKey } from '../types.ts';

export const databaseRouter = Router();

const CART_COOKIE_NAME = 'mb_cart_sid';
const CART_COOKIE_TTL_SECONDS = 60 * 60 * 24 * 30;
const CART_SIGNING_SECRET =
  process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');

function signGuestCartId(sid: string): string {
  const sig = crypto
    .createHmac('sha256', CART_SIGNING_SECRET)
    .update(sid)
    .digest('hex');
  return `${sid}.${sig}`;
}

function verifyGuestCartId(rawCookie?: string): string | null {
  if (!rawCookie || typeof rawCookie !== 'string') return null;
  const dotIdx = rawCookie.lastIndexOf('.');
  if (dotIdx <= 0) return null;
  const sid = rawCookie.slice(0, dotIdx);
  const sig = rawCookie.slice(dotIdx + 1);
  if (!sid || !sig) return null;
  const expected = crypto
    .createHmac('sha256', CART_SIGNING_SECRET)
    .update(sid)
    .digest('hex');
  try {
    const a = Buffer.from(sig, 'hex');
    const b = Buffer.from(expected, 'hex');
    if (a.length !== b.length) return null;
    return crypto.timingSafeEqual(a, b) ? sid : null;
  } catch {
    return null;
  }
}

function setGuestCartCookie(req: Request, res: Response, sid: string): void {
  const proto = String(req.headers['x-forwarded-proto'] || '').toLowerCase();
  const https = req.secure || proto.includes('https');
  const signed = signGuestCartId(sid);
  const parts = [
    `${CART_COOKIE_NAME}=${encodeURIComponent(signed)}`,
    'Path=/',
    'HttpOnly',
    `Max-Age=${CART_COOKIE_TTL_SECONDS}`,
    https ? 'SameSite=None' : 'SameSite=Lax',
  ];
  if (https) {
    parts.push('Secure', 'Partitioned');
  }
  const existing = res.getHeader('Set-Cookie');
  const cookieStr = parts.join('; ');
  if (existing) {
    const arr = Array.isArray(existing) ? existing.map(String) : [String(existing)];
    res.setHeader('Set-Cookie', [...arr, cookieStr]);
  } else {
    res.setHeader('Set-Cookie', cookieStr);
  }
}

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

// GET /api/db/status - Real PostgreSQL check (SELECT 1 + identity query), returns HTTP 503 when offline
databaseRouter.get('/status', async (_req: Request, res: Response) => {
  const check = await testDatabaseConnection();

  if (!check.connected) {
    return res.status(503).json({
      success: false,
      code: 'DB_UNAVAILABLE',
      database: 'PostgreSQL',
      connected: false,
      configured: check.configured,
      status: check.status,
      sslEnabled: check.sslEnabled,
      connectionMode: check.connectionMode,
      latencyMs: check.latencyMs,
      error: check.error || 'PostgreSQL indisponível no momento.',
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
    const counts = await getDatabaseCountsFromDb();

    return res.json({
      success: true,
      database: 'PostgreSQL (Hostinger VPS)',
      connected: true,
      configured: true,
      status: 'online',
      databaseInfo: {
        databaseName: check.currentDatabase,
        databaseUser: check.currentUser,
        serverVersion: check.version,
        tableCount: check.publicTablesCount,
        latencyMs: check.latencyMs,
        sslEnabled: check.sslEnabled,
        connectionMode: check.connectionMode,
      },
      counts,
    });
  } catch (error: any) {
    return res.status(503).json({
      success: false,
      code: 'DB_UNAVAILABLE',
      database: 'PostgreSQL',
      connected: false,
      configured: true,
      status: 'offline_or_unreachable',
      error: error?.message || 'Falha ao consultar tabelas no PostgreSQL.',
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
      targetProductIds: cp.allowedProductIds || cp.targetProductIds || [],
      targetCategoryIds: cp.allowedCategoryIds || cp.targetCategoryIds || [],
      specificCustomerIds: cp.allowedCustomerIds || cp.specificCustomerIds || [],
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
    if (!isDbUnavailableError(error)) {
      console.error('Failed to initialize database sync:', error);
    }
    return handleRouterError(res, error, 'PostgreSQL temporariamente indisponível.');
  }
});

// Cart (Logged user by userId; guest by HMAC-signed HttpOnly cookie mb_cart_sid)
databaseRouter.get('/cart', async (req: Request, res: Response) => {
  try {
    if (req.authUser) {
      const items = await getCartFromDb(`user:${req.authUser.id}`);
      return res.json({ success: true, items });
    }
    const cookies = parseCookies(req);
    const sid = verifyGuestCartId(cookies[CART_COOKIE_NAME]);
    if (!sid) {
      const freshSid = `gst_${crypto.randomBytes(12).toString('hex')}`;
      setGuestCartCookie(req, res, freshSid);
      return res.json({ success: true, items: [] });
    }
    const items = await getCartFromDb(`guest:${sid}`);
    return res.json({ success: true, items });
  } catch (error: any) {
    return handleRouterError(res, error, 'Erro ao consultar carrinho no PostgreSQL.');
  }
});

databaseRouter.put('/cart', async (req: Request, res: Response) => {
  try {
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    if (req.authUser) {
      await saveCartToDb(`user:${req.authUser.id}`, items);
      return res.json({ success: true, items });
    }
    const cookies = parseCookies(req);
    let sid = verifyGuestCartId(cookies[CART_COOKIE_NAME]);
    if (!sid) {
      sid = `gst_${crypto.randomBytes(12).toString('hex')}`;
      setGuestCartCookie(req, res, sid);
    }
    await saveCartToDb(`guest:${sid}`, items);
    return res.json({ success: true, items });
  } catch (error: any) {
    return handleRouterError(res, error, 'Erro ao salvar carrinho no PostgreSQL.');
  }
});

// Favorites (Authenticated user)
databaseRouter.get('/favorites', requireAuthSession, async (req: Request, res: Response) => {
  try {
    const productIds = await getFavoritesFromDb(`user:${req.authUser!.id}`);
    return res.json({ success: true, productIds });
  } catch (error: any) {
    return handleRouterError(res, error, 'Erro ao carregar favoritos no PostgreSQL.');
  }
});

databaseRouter.put('/favorites', requireAuthSession, async (req: Request, res: Response) => {
  try {
    const productIds = Array.isArray(req.body?.productIds)
      ? req.body.productIds.map(String)
      : [];
    await saveFavoritesToDb(`user:${req.authUser!.id}`, productIds);
    return res.json({ success: true, productIds });
  } catch (error: any) {
    return handleRouterError(res, error, 'Erro ao salvar favoritos no PostgreSQL.');
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
    return res.json({
      success: true,
      canViewPrices: allowed,
      priceVisibility: priceVisibilityMode,
      products: safeProducts,
    });
  } catch (error: any) {
    return handleRouterError(res, error, 'Erro ao consultar produtos no PostgreSQL.');
  }
});

databaseRouter.post(
  '/products',
  requirePermission('canManageProducts'),
  async (req: Request, res: Response) => {
    try {
      const saved = await upsertProductInDb(req.body);
      return res.json({ success: true, product: saved });
    } catch (error: any) {
      return handleRouterError(res, error, 'Erro ao gravar produto no PostgreSQL.');
    }
  }
);

databaseRouter.delete(
  '/products/:id',
  requirePermission('canManageProducts'),
  async (req: Request, res: Response) => {
    try {
      await deleteProductFromDb(req.params.id);
      return res.json({ success: true, message: 'Produto excluído do PostgreSQL' });
    } catch (error: any) {
      return handleRouterError(res, error, 'Erro ao excluir produto no PostgreSQL.');
    }
  }
);

// Categories & Subcategories (Public read; authorized staff write)
databaseRouter.get('/categories', async (_req: Request, res: Response) => {
  try {
    await seedInitialDataIfEmpty();
    const data = await getCategoriesFromDb();
    return res.json({ success: true, categories: data });
  } catch (error: any) {
    return handleRouterError(res, error, 'Erro ao consultar categorias no PostgreSQL.');
  }
});

databaseRouter.post(
  '/categories',
  requirePermission('canManageCategories'),
  async (req: Request, res: Response) => {
    try {
      const saved = await upsertCategoryInDb(req.body);
      return res.json({ success: true, category: saved });
    } catch (error: any) {
      return handleRouterError(res, error, 'Erro ao gravar categoria no PostgreSQL.');
    }
  }
);

databaseRouter.delete(
  '/categories/:id',
  requirePermission('canManageCategories'),
  async (req: Request, res: Response) => {
    try {
      const hasProducts = await hasCategoryProductsInDb(req.params.id);
      if (hasProducts) {
        return res.status(409).json({
          success: false,
          error: 'Não é possível excluir categoria que possui produtos vinculados.',
        });
      }
      await deleteCategoryFromDb(req.params.id);
      return res.json({ success: true, message: 'Categoria excluída do PostgreSQL.' });
    } catch (error: any) {
      return handleRouterError(res, error, 'Erro ao excluir categoria no PostgreSQL.');
    }
  }
);

databaseRouter.post(
  '/subcategories',
  requirePermission('canManageCategories'),
  async (req: Request, res: Response) => {
    try {
      const saved = await upsertSubcategoryInDb(req.body);
      return res.json({ success: true, subcategory: saved });
    } catch (error: any) {
      return handleRouterError(res, error, 'Erro ao gravar subcategoria no PostgreSQL.');
    }
  }
);

databaseRouter.delete(
  '/subcategories/:id',
  requirePermission('canManageCategories'),
  async (req: Request, res: Response) => {
    try {
      await deleteSubcategoryFromDb(req.params.id);
      return res.json({ success: true, message: 'Subcategoria excluída do PostgreSQL.' });
    } catch (error: any) {
      return handleRouterError(res, error, 'Erro ao excluir subcategoria no PostgreSQL.');
    }
  }
);

// Orders & Atomic Checkout
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
    return handleRouterError(res, error, 'Erro ao consultar pedidos no PostgreSQL.');
  }
});

databaseRouter.post('/orders/checkout', requireAuthSession, async (req: Request, res: Response) => {
  try {
    const authUser = req.authUser!;
    const { order, initialBoletos = [], initialFinancialAccount } = req.body || {};
    if (!order || !order.id || !order.code || !Array.isArray(order.items) || order.items.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Dados do pedido inválidos ou carrinho vazio.',
      });
    }

    const safeOrder = isStaffRole(authUser.role)
      ? order
      : {
          ...order,
          clientId: authUser.id,
          clientEmail: authUser.email,
          orderStatus: 'novo',
          paymentStatus: 'pendente',
        };

    const result = await checkoutOrderAtomicInDb({
      order: safeOrder,
      operatorName: authUser.name || 'Checkout Loja',
      initialBoletos: Array.isArray(initialBoletos) ? initialBoletos : [],
      initialFinancialAccount: initialFinancialAccount || undefined,
    });

    // Clear user's persisted cart after atomic checkout succeeds
    await saveCartToDb(`user:${authUser.id}`, []).catch(() => {});

    return res.status(result.duplicated ? 200 : 201).json({
      success: true,
      duplicated: result.duplicated,
      order: result.order,
    });
  } catch (error: any) {
    return handleRouterError(res, error, 'Erro ao processar checkout atômico no PostgreSQL.');
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
    return res.json({ success: true, order: saved });
  } catch (error: any) {
    return handleRouterError(res, error, 'Erro ao gravar pedido no PostgreSQL.');
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
    return handleRouterError(res, error, 'Erro ao consultar orçamentos no PostgreSQL.');
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
    return res.json({ success: true, quote: saved });
  } catch (error: any) {
    return handleRouterError(res, error, 'Erro ao gravar orçamento no PostgreSQL.');
  }
});

// Users (Strictly Admin/canManageUsers, ALWAYS sanitized without passwordHash)
databaseRouter.get(
  '/users',
  requirePermission('canManageUsers'),
  async (_req: Request, res: Response) => {
    try {
      const data = await getUsersFromDb();
      return res.json({
        success: true,
        users: (data || []).map((u: any) => sanitizeUserForClient(u)),
      });
    } catch (error: any) {
      return handleRouterError(res, error, 'Erro ao consultar usuários no PostgreSQL.');
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
        if (dupDoc && dupDoc.id !== uid) {
          return res.status(409).json({
            success: false,
            error: 'Já existe outro usuário cadastrado com este CPF/CNPJ.',
          });
        }
      }

      const dupEmail = await getUserByEmailFromDb(cleanEmail);
      if (dupEmail && dupEmail.id !== uid) {
        return res.status(409).json({
          success: false,
          error: 'Já existe outro usuário cadastrado com este e-mail.',
        });
      }

      if (payload.role === 'admin' && req.authUser?.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'Apenas administradores podem conceder perfil de Administrador.',
        });
      }

      const saved = await upsertUserInDb(payload);
      return res.json({
        success: true,
        user: saved.map((u: any) => sanitizeUserForClient(u)),
      });
    } catch (error: any) {
      return handleRouterError(res, error, 'Erro ao gravar usuário no PostgreSQL.');
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
      return res.json({ success: true, coupons: data });
    } catch (error: any) {
      return handleRouterError(res, error, 'Erro ao consultar cupons no PostgreSQL.');
    }
  }
);

databaseRouter.post(
  '/coupons',
  requirePermission('canCreateCoupons'),
  async (req: Request, res: Response) => {
    try {
      const saved = await upsertCouponInDb(req.body);
      return res.json({ success: true, coupon: saved });
    } catch (error: any) {
      return handleRouterError(res, error, 'Erro ao gravar cupom no PostgreSQL.');
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
      if (
        key === 'gateways' &&
        !hasServerPermission(req, 'canManagePaymentGateways') &&
        !hasServerPermission(req, 'canAccessPDV')
      ) {
        return res.status(403).json({ success: false, error: 'Permissão insuficiente.' });
      }
    }

    const value = await getSystemSettingsFromDb(key);
    if (key === 'company' && (!req.authUser || !isStaffRole(req.authUser.role))) {
      return res.json({ success: true, key, value: sanitizeCompanySettingsForPublic(value) });
    }
    return res.json({ success: true, key, value });
  } catch (error: any) {
    return handleRouterError(res, error, 'Erro ao consultar configuração no PostgreSQL.');
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
    return res.json({ success: true, key, message: 'Configurações salvas no PostgreSQL' });
  } catch (error: any) {
    return handleRouterError(res, error, 'Erro ao salvar configuração no PostgreSQL.');
  }
});

// Backups (Admin only)
databaseRouter.get('/backups', requireAdminSession, async (_req: Request, res: Response) => {
  try {
    const data = await getBackupsFromDb();
    return res.json({ success: true, backups: data });
  } catch (error: any) {
    return handleRouterError(res, error, 'Erro ao consultar backups no PostgreSQL.');
  }
});

databaseRouter.post('/backups', requireAdminSession, async (req: Request, res: Response) => {
  try {
    const saved = await recordBackupInDb(req.body);
    return res.json({ success: true, backup: saved });
  } catch (error: any) {
    return handleRouterError(res, error, 'Erro ao gravar registro de backup no PostgreSQL.');
  }
});

// Stock Movements
databaseRouter.get(
  '/stock-movements',
  requirePermission('canManageStock'),
  async (_req: Request, res: Response) => {
    try {
      const data = await getStockMovementsFromDb();
      return res.json({ success: true, stockMovements: data });
    } catch (error: any) {
      return handleRouterError(res, error, 'Erro ao consultar movimentações de estoque.');
    }
  }
);

databaseRouter.post('/stock-movements', requireStaffSession, async (req: Request, res: Response) => {
  try {
    if (!hasServerPermission(req, 'canManageStock') && !hasServerPermission(req, 'canAccessPDV')) {
      return res.status(403).json({ success: false, error: 'Permissão de estoque ou PDV necessária.' });
    }
    const saved = await upsertStockMovementInDb(req.body);
    return res.json({ success: true, stockMovement: saved });
  } catch (error: any) {
    return handleRouterError(res, error, 'Erro ao gravar movimentação de estoque.');
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
    return handleRouterError(res, error, 'Erro ao consultar boletos no PostgreSQL.');
  }
});

databaseRouter.post('/boletos', requireStaffSession, async (req: Request, res: Response) => {
  try {
    if (
      !hasServerPermission(req, 'canViewFinancialModule') &&
      !hasServerPermission(req, 'canViewReceivables') &&
      !hasServerPermission(req, 'canConfigureBoletoRules')
    ) {
      return res.status(403).json({
        success: false,
        error: 'Permissão financeira necessária para gravar boletos.',
      });
    }
    const saved = await upsertBoletoInDb(req.body);
    return res.json({ success: true, boleto: saved });
  } catch (error: any) {
    return handleRouterError(res, error, 'Erro ao gravar boleto no PostgreSQL.');
  }
});

databaseRouter.post('/boletos/:id/settle', requireStaffSession, async (req: Request, res: Response) => {
  try {
    if (
      !hasServerPermission(req, 'canViewFinancialModule') &&
      !hasServerPermission(req, 'canViewReceivables') &&
      !hasServerPermission(req, 'canReceivePayment')
    ) {
      return res.status(403).json({
        success: false,
        error: 'Permissão financeira necessária para liquidar boletos.',
      });
    }
    const result = await settleBoletoAtomicInDb({
      boletoId: req.params.id,
      paidDate: req.body?.paidDate,
      bankAccountId: req.body?.bankAccountId,
      operatorName: req.authUser!.name,
    });
    if (result.notFound) {
      return res.status(404).json({ success: false, error: 'Boleto não encontrado.' });
    }
    return res.json({ success: true, ...result });
  } catch (error: any) {
    return handleRouterError(res, error, 'Erro ao liquidar boleto no PostgreSQL.');
  }
});

// Financial Accounts (Strictly Financial Module permission)
databaseRouter.get(
  '/financial-accounts',
  requirePermission('canViewFinancialModule'),
  async (_req: Request, res: Response) => {
    try {
      const data = await getFinancialAccountsFromDb();
      return res.json({ success: true, financialAccounts: data });
    } catch (error: any) {
      return handleRouterError(res, error, 'Erro ao consultar contas financeiras no PostgreSQL.');
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
    return res.json({ success: true, financialAccount: saved });
  } catch (error: any) {
    return handleRouterError(res, error, 'Erro ao gravar conta financeira no PostgreSQL.');
  }
});

// PDV Sales & Cash Register Sessions (Strictly PDV permission)
databaseRouter.get(
  '/pdv-sales',
  requirePermission('canAccessPDV'),
  async (_req: Request, res: Response) => {
    try {
      const data = await getPdvSalesFromDb();
      return res.json({ success: true, pdvSales: data.map((s: any) => s.rawData || s) });
    } catch (error: any) {
      return handleRouterError(res, error, 'Erro ao consultar vendas PDV no PostgreSQL.');
    }
  }
);

databaseRouter.post(
  '/pdv-sales',
  requirePermission('canAccessPDV'),
  async (req: Request, res: Response) => {
    try {
      const saved = await upsertPdvSaleInDb(req.body);
      return res.json({ success: true, pdvSale: saved });
    } catch (error: any) {
      return handleRouterError(res, error, 'Erro ao gravar venda PDV no PostgreSQL.');
    }
  }
);

databaseRouter.post(
  '/pdv-sales/atomic',
  requirePermission('canAccessPDV'),
  async (req: Request, res: Response) => {
    try {
      const { sale, cashSessionId, transactions } = req.body || {};
      if (!sale || !sale.id || !sale.code) {
        return res.status(400).json({ success: false, error: 'Dados da venda PDV inválidos.' });
      }
      const result = await createPdvSaleAtomicInDb({
        sale,
        cashSessionId,
        transactions: Array.isArray(transactions) ? transactions : [],
      });
      return res.status(result.duplicated ? 200 : 201).json({ success: true, ...result });
    } catch (error: any) {
      return handleRouterError(res, error, 'Erro ao processar venda PDV atômica no PostgreSQL.');
    }
  }
);

databaseRouter.get(
  '/cash-sessions',
  requirePermission('canAccessPDV'),
  async (_req: Request, res: Response) => {
    try {
      const data = await getCashSessionsFromDb();
      return res.json({ success: true, cashSessions: data.map((cs: any) => cs.rawData || cs) });
    } catch (error: any) {
      return handleRouterError(res, error, 'Erro ao consultar sessões de caixa.');
    }
  }
);

databaseRouter.post(
  '/cash-sessions',
  requirePermission('canAccessPDV'),
  async (req: Request, res: Response) => {
    try {
      const saved = await upsertCashSessionInDb(req.body);
      return res.json({ success: true, cashSession: saved });
    } catch (error: any) {
      return handleRouterError(res, error, 'Erro ao gravar sessão de caixa.');
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
      return res.status(403).json({
        success: false,
        error: 'Acesso negado às transações financeiras.',
      });
    }
    const data = await getPaymentTransactionsFromDb();
    return res.json({
      success: true,
      paymentTransactions: data.map((tx: any) => tx.rawData || tx),
    });
  } catch (error: any) {
    return handleRouterError(res, error, 'Erro ao consultar transações de pagamento.');
  }
});

databaseRouter.post('/payment-transactions', requireAuthSession, async (req: Request, res: Response) => {
  try {
    const authUser = req.authUser!;
    const payload = req.body || {};

    if (isStaffRole(authUser.role)) {
      if (
        !hasServerPermission(req, 'canViewFinancialTransactions') &&
        !hasServerPermission(req, 'canViewFinancialModule') &&
        !hasServerPermission(req, 'canAccessPDV') &&
        !hasServerPermission(req, 'canManageOrders')
      ) {
        return res.status(403).json({
          success: false,
          error: 'Permissão insuficiente para registrar transação de pagamento.',
        });
      }
      const saved = await upsertPaymentTransactionInDb(payload);
      return res.json({ success: true, paymentTransaction: saved });
    }

    // Customer flow: must reference an existing order owned by this customer and cannot force approved status
    if (!payload.orderId) {
      return res.status(403).json({
        success: false,
        error: 'Clientes só podem registrar transações vinculadas a um pedido próprio.',
      });
    }
    const orders = await getOrdersFromDb();
    const targetOrder = orders.find((o: any) => o.id === payload.orderId);
    if (!targetOrder || !isOwnRecord(targetOrder, authUser)) {
      return res.status(403).json({
        success: false,
        error: 'Pedido não encontrado ou não pertence à conta autenticada.',
      });
    }

    const safeTx = {
      ...payload,
      status: 'pendente',
      origin: 'loja_online',
    };
    const saved = await upsertPaymentTransactionInDb(safeTx);
    return res.json({ success: true, paymentTransaction: saved });
  } catch (error: any) {
    return handleRouterError(res, error, 'Erro ao gravar transação de pagamento.');
  }
});

// Application Operation Logs (Admin audit / operation logs)
databaseRouter.get('/logs', requireAdminSession, async (_req: Request, res: Response) => {
  try {
    const logs = await getAppOperationLogsFromDb(200);
    return res.json({ success: true, logs });
  } catch (error: any) {
    return handleRouterError(res, error, 'Erro ao consultar logs operacionais no PostgreSQL.');
  }
});

databaseRouter.post('/logs', requireAuthSession, async (req: Request, res: Response) => {
  try {
    const { module = 'app', level = 'info', action = 'event', message = '', details } = req.body || {};
    const saved = await insertAppOperationLogInDb({
      module: String(module),
      level,
      actorId: req.authUser?.id,
      actorRole: req.authUser?.role,
      action: String(action),
      message: String(message),
      details,
    });
    return res.status(201).json({ success: true, log: saved });
  } catch (error: any) {
    return handleRouterError(res, error, 'Erro ao registrar log operacional no PostgreSQL.');
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

    return res.json({
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
          : 'NOT_CONFIGURED',
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
    return handleRouterError(res, error, 'Erro no diagnóstico VPS.');
  }
});

databaseRouter.post('/ensure-additive-tables', requireAdminSession, async (_req: Request, res: Response) => {
  try {
    const result = await ensureAdditiveTablesInPostgres(true);
    return res.json({ success: true, ...result });
  } catch (error: any) {
    return handleRouterError(res, error, 'Falha ao verificar tabelas aditivas.');
  }
});

databaseRouter.post('/migrate-local-storage', requireAdminSession, async (req: Request, res: Response) => {
  const { snapshot = {}, dryRun = true } = req.body || {};
  try {
    const report = await runControlledLocalStorageMigration(snapshot, Boolean(dryRun));
    return res.json(report);
  } catch (error: any) {
    return handleRouterError(res, error, 'Erro ao executar validação/migração controlada.');
  }
});
