import fs from 'fs';
import path from 'path';
import { db, isDatabaseConfigured, createPool } from './index.ts';
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
  couponLogs,
  financialAccounts,
  boletos,
  systemSettings,
  backups,
  stockMovements,
  pdvSales,
  cashRegisterSessions,
  paymentTransactions,
} from './schema.ts';
import { eq, desc, sql } from 'drizzle-orm';
import {
  INITIAL_PRODUCTS,
  INITIAL_CATEGORIES,
  INITIAL_SUBCATEGORIES,
  INITIAL_QUOTES,
  INITIAL_ORDERS,
  INITIAL_USERS,
  INITIAL_COMPANY_SETTINGS,
  INITIAL_DELIVERY_SETTINGS,
  INITIAL_BOLETO_SETTINGS,
  INITIAL_COUPONS,
  INITIAL_LAYOUT_SETTINGS,
  INITIAL_PAYMENT_GATEWAYS,
  INITIAL_PERMISSIONS_MATRIX,
  INITIAL_MAINTENANCE_SETTINGS,
  INITIAL_PRICE_VISIBILITY_MODE,
} from '../data/initialData.ts';
import {
  hashPassword,
  normalizePriceVisibilityMode,
  onlyDigits,
} from '../server/authUtils.ts';
import type { PriceVisibilityMode, RolePermissions, UserRole } from '../types.ts';

// ==========================================
// SANDBOX / PREVIEW SERVER-SIDE FALLBACK STORE
// Used ONLY when PostgreSQL env vars are not configured (e.g. AI Studio container without external DB).
// On Hostinger VPS where PostgreSQL is configured, this file is NEVER read or written.
// ==========================================
const DEV_FALLBACK_PATH = path.join(process.cwd(), 'data', '.dev-server-state.json');

interface DevServerState {
  users: any[];
  authSessions: Array<{
    tokenHash: string;
    userUid: string;
    role: string;
    expiresAt: string;
    userAgent?: string;
    ip?: string;
    createdAt: string;
  }>;
  categories: any[];
  subcategories: any[];
  products: any[];
  quotes: any[];
  orders: any[];
  coupons: any[];
  stockMovements: any[];
  boletos: any[];
  financialAccounts: any[];
  pdvSales: any[];
  cashSessions: any[];
  paymentTransactions: any[];
  backups: any[];
  settings: Record<string, any>;
}

let memoryDevState: DevServerState | null = null;

const MASTER_ADMIN_SEED = {
  uid: 'user_admin_master',
  id: 'user_admin_master',
  name: 'Administrador Master (MB Personaliza)',
  email: 'mbpersonaliza@gmail.com',
  phone: '',
  company: 'MB Personaliza',
  cpfCnpj: '',
  role: 'admin' as UserRole,
  department: 'Administração Master',
  status: 'ativo' as const,
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  passwordHash:
    'scrypt$ea8560caf9ab1968b292af7d337d7cdb$0776578e8c97a3127e1c50e4f63fc4b2ba81f6445a5ea4d409061eff4f565c6a56ab744ba7a8779ea6a91c407feab24698188a7869eb814587a5320bb9836875',
};

function buildInitialDevState(): DevServerState {
  const initialUsers = INITIAL_USERS.map((u) => {
    const { password, ...rest } = u;
    return {
      ...rest,
      uid: u.id,
      cpfCnpj: u.cpfCnpj || '',
      passwordHash: password ? hashPassword(password) : null,
      isActive: u.status !== 'inativo',
    };
  });
  if (!initialUsers.some((u) => u.email.toLowerCase() === MASTER_ADMIN_SEED.email)) {
    initialUsers.unshift({ ...MASTER_ADMIN_SEED });
  }

  return {
    users: initialUsers,
    authSessions: [],
    categories: JSON.parse(JSON.stringify(INITIAL_CATEGORIES)),
    subcategories: JSON.parse(JSON.stringify(INITIAL_SUBCATEGORIES)),
    products: JSON.parse(JSON.stringify(INITIAL_PRODUCTS)),
    quotes: JSON.parse(JSON.stringify(INITIAL_QUOTES)),
    orders: JSON.parse(JSON.stringify(INITIAL_ORDERS)),
    coupons: JSON.parse(JSON.stringify(INITIAL_COUPONS)),
    stockMovements: [],
    boletos: [],
    financialAccounts: [],
    pdvSales: [],
    cashSessions: [],
    paymentTransactions: [],
    backups: [],
    settings: {
      company: INITIAL_COMPANY_SETTINGS,
      delivery: INITIAL_DELIVERY_SETTINGS,
      boleto: INITIAL_BOLETO_SETTINGS,
      layout: INITIAL_LAYOUT_SETTINGS,
      gateways: INITIAL_PAYMENT_GATEWAYS,
      permissions: INITIAL_PERMISSIONS_MATRIX,
      maintenance: INITIAL_MAINTENANCE_SETTINGS,
      price_visibility: { mode: INITIAL_PRICE_VISIBILITY_MODE },
    },
  };
}

function getDevState(): DevServerState {
  if (memoryDevState) return memoryDevState;
  try {
    if (fs.existsSync(DEV_FALLBACK_PATH)) {
      const parsed = JSON.parse(fs.readFileSync(DEV_FALLBACK_PATH, 'utf-8'));
      const base = buildInitialDevState();
      memoryDevState = {
        ...base,
        ...parsed,
        settings: {
          ...base.settings,
          ...(parsed.settings || {}),
        },
      };
      if (
        !memoryDevState.users.some(
          (u: any) => String(u.email || '').trim().toLowerCase() === MASTER_ADMIN_SEED.email
        )
      ) {
        memoryDevState.users.unshift({ ...MASTER_ADMIN_SEED });
        saveDevState(memoryDevState);
      }
      return memoryDevState!;
    }
  } catch (err) {
    console.warn('[Server Fallback Store] Could not load fallback state, using initial seed:', err);
  }
  memoryDevState = buildInitialDevState();
  saveDevState(memoryDevState);
  return memoryDevState;
}

function saveDevState(state: DevServerState): void {
  try {
    const dir = path.dirname(DEV_FALLBACK_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(DEV_FALLBACK_PATH, JSON.stringify(state, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[Server Fallback Store] Failed to persist dev state:', err);
  }
}

// Helper to sanitize and wrap errors safely
function handleDbError(operation: string, error: unknown): never {
  console.error(`[PostgreSQL] Database operation '${operation}' failed:`, error);
  throw new Error(`Database operation '${operation}' failed.`, { cause: error });
}

function isTransientConnectionError(error: any): boolean {
  if (!error) return false;
  const msg = String(error?.message || '') + ' ' + String(error?.cause?.message || '') + ' ' + String(error?.cause || '');
  return (
    msg.includes('Connection terminated unexpectedly') ||
    msg.includes('connection terminated') ||
    msg.includes('ECONNRESET') ||
    msg.includes('EPIPE') ||
    msg.includes('ETIMEDOUT') ||
    msg.includes('Client has encountered a connection error') ||
    msg.includes('closed the connection') ||
    msg.includes('Connection lost')
  );
}

export async function withDbRetry<T>(operation: string, fn: () => Promise<T>): Promise<T> {
  let attempt = 0;
  const maxAttempts = 3;
  while (true) {
    try {
      return await fn();
    } catch (error: any) {
      attempt++;
      if (attempt < maxAttempts && isTransientConnectionError(error)) {
        const delay = 500 * Math.pow(2, attempt - 1) + Math.random() * 200;
        console.warn(`[PostgreSQL] Transient connection error in '${operation}' (attempt ${attempt}/${maxAttempts}). Retrying in ${Math.round(delay)}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
      handleDbError(operation, error);
    }
  }
}

// ==========================================
// INITIAL SEEDING & STATUS
// ==========================================
export async function seedInitialDataIfEmpty() {
  if (!isDatabaseConfigured()) {
    getDevState();
    return;
  }
  try {
    await ensureAdditiveTablesInPostgres();

    await withDbRetry('seedInitialDataIfEmpty', async () => {
      const existingCats = await db.select().from(categories).limit(1);
      if (existingCats.length === 0) {
        console.log('[PostgreSQL] Seeding initial categories into Cloud SQL...');
        for (const cat of INITIAL_CATEGORIES) {
          await db.insert(categories).values({
            id: cat.id,
            name: cat.name,
            slug: cat.slug,
            description: cat.description || '',
            image: cat.image || '',
            icon: cat.icon || '',
            orderIndex: (cat as any).order || (cat as any).orderIndex || 0,
            isActive: (cat as any).isActive !== false,
          }).onConflictDoNothing();
        }

        console.log('[PostgreSQL] Seeding initial subcategories into Cloud SQL...');
        for (const sub of INITIAL_SUBCATEGORIES) {
          await db.insert(subcategories).values({
            id: sub.id,
            categoryId: sub.categoryId,
            name: sub.name,
            slug: sub.slug,
            description: (sub as any).description || '',
            isActive: (sub as any).isActive !== false,
          }).onConflictDoNothing();
        }

        console.log('[PostgreSQL] Seeding initial products into Cloud SQL...');
        for (const p of INITIAL_PRODUCTS) {
          await db.insert(products).values({
            id: p.id,
            code: p.code,
            name: p.name,
            slug: p.slug,
            categoryId: p.categoryId,
            subcategoryId: p.subcategoryId,
            shortDescription: (p as any).short_description || (p as any).shortDescription || '',
            description: p.description || '',
            basePrice: p.base_price || 0,
            promoPrice: p.promo_price,
            costPrice: p.cost_price,
            stockQty: p.stock_qty || 0,
            minOrderQty: p.min_order_qty || 1,
            isActive: p.is_active !== false,
            isFeatured: p.is_featured || false,
            images: p.images || [],
            badge: p.badge,
            showPrice: p.show_price !== false,
            priceTiers: p.price_tiers || [],
            variants: p.variants || [],
            details: p.details || {},
            barcode: p.barcode,
            qrCode: p.qrCode,
            totalStockAvailable: (p as any).totalStockAvailable || 0,
            totalNextQuantities: (p as any).totalNextQuantities || 0,
          }).onConflictDoNothing();
        }

        console.log('[PostgreSQL] Seeding initial users into Cloud SQL...');
        for (const u of INITIAL_USERS) {
          await db.insert(users).values({
            uid: u.id,
            name: u.name,
            email: u.email,
            phone: u.phone || '',
            company: u.company || '',
            cpfCnpj: u.cpfCnpj || '',
            role: u.role || 'cliente',
            passwordHash: u.password ? hashPassword(u.password) : null,
            address: u.address,
            customPermissions: u.customPermissions,
            isActive: (u as any).isActive !== false,
          }).onConflictDoNothing();
        }
        await db.insert(users).values({
          uid: MASTER_ADMIN_SEED.uid,
          name: MASTER_ADMIN_SEED.name,
          email: MASTER_ADMIN_SEED.email,
          phone: MASTER_ADMIN_SEED.phone,
          company: MASTER_ADMIN_SEED.company,
          cpfCnpj: MASTER_ADMIN_SEED.cpfCnpj,
          role: MASTER_ADMIN_SEED.role,
          passwordHash: MASTER_ADMIN_SEED.passwordHash,
          isActive: true,
        }).onConflictDoNothing();

        console.log('[PostgreSQL] Seeding initial quotes and orders into Cloud SQL...');
        for (const q of INITIAL_QUOTES) {
          const estTotal = (q as any).totalEstimated || (q as any).total || 0;
          await db.insert(quotes).values({
            id: q.id,
            code: q.code,
            clientId: q.clientId,
            clientName: q.clientName,
            clientEmail: q.clientEmail,
            clientPhone: q.clientPhone,
            clientCompany: q.clientCompany,
            items: q.items || [],
            subtotal: estTotal,
            discount: 0,
            total: estTotal,
            notes: q.notes,
            status: q.status || 'pendente',
            billingTerms: q.billingTerms,
          }).onConflictDoNothing();
        }

        for (const o of INITIAL_ORDERS) {
          await db.insert(orders).values({
            id: o.id,
            code: o.code,
            clientId: o.clientId,
            clientName: o.clientName,
            clientEmail: o.clientEmail,
            clientPhone: o.clientPhone,
            clientCompany: o.clientCompany,
            shippingAddress: o.shippingAddress,
            items: o.items || [],
            subtotal: o.subtotal || 0,
            discount: o.discount || 0,
            shippingCost: o.shippingCost || 0,
            shippingInfo: o.shippingInfo,
            total: o.total || 0,
            paymentMethod: o.paymentMethod || 'pix',
            paymentStatus: o.paymentStatus || 'pago',
            orderStatus: o.orderStatus || 'concluido',
          }).onConflictDoNothing();
        }

        console.log('[PostgreSQL] Seeding initial coupons into Cloud SQL...');
        for (const cp of INITIAL_COUPONS) {
          await db.insert(discountCoupons).values({
            id: cp.id,
            code: cp.code,
            campaignName: cp.campaignName,
            discountType: cp.discountType,
            discountValue: cp.discountValue,
            startDate: cp.startDate,
            endDate: cp.endDate,
            minPurchaseAmount: cp.minPurchaseAmount,
            maxDiscountAmount: cp.maxDiscountAmount,
            maxUses: (cp as any).maxUsageTotal || (cp as any).maxUses || 0,
            currentUses: (cp as any).currentUsageCount || (cp as any).currentUses || 0,
            limitPerCustomer: (cp as any).maxUsagePerCustomer || (cp as any).limitPerCustomer || 1,
            applicableType: (cp as any).targetType || (cp as any).applicableType || 'all_store',
            status: cp.status || 'active',
          }).onConflictDoNothing();
        }

        // System Settings initial seed
        await db.insert(systemSettings).values({ key: 'company', value: INITIAL_COMPANY_SETTINGS }).onConflictDoNothing();
        await db.insert(systemSettings).values({ key: 'delivery', value: INITIAL_DELIVERY_SETTINGS }).onConflictDoNothing();
        await db.insert(systemSettings).values({ key: 'boleto', value: INITIAL_BOLETO_SETTINGS }).onConflictDoNothing();
        await db.insert(systemSettings).values({ key: 'layout', value: INITIAL_LAYOUT_SETTINGS }).onConflictDoNothing();
        await db.insert(systemSettings).values({ key: 'gateways', value: INITIAL_PAYMENT_GATEWAYS }).onConflictDoNothing();
        await db.insert(systemSettings).values({ key: 'permissions', value: INITIAL_PERMISSIONS_MATRIX }).onConflictDoNothing();
        await db.insert(systemSettings).values({ key: 'maintenance', value: INITIAL_MAINTENANCE_SETTINGS }).onConflictDoNothing();
        await db.insert(systemSettings).values({ key: 'price_visibility', value: { mode: INITIAL_PRICE_VISIBILITY_MODE } }).onConflictDoNothing();

        console.log('[PostgreSQL] Initial seed completed successfully.');
      } else {
        // Non-destructive additive seed for existing production PostgreSQL databases:
        // 1. Ensure price_visibility key exists without altering if already saved
        await db.insert(systemSettings).values({
          key: 'price_visibility',
          value: { mode: INITIAL_PRICE_VISIBILITY_MODE },
        }).onConflictDoNothing();

        // 2. Backfill password_hash ONLY for pre-seeded accounts where password_hash IS NULL
        const pool = createPool();
        for (const u of INITIAL_USERS) {
          if (u.password) {
            const hashed = hashPassword(u.password);
            await pool.query(
              'UPDATE users SET password_hash = $1 WHERE uid = $2 AND password_hash IS NULL',
              [hashed, u.id]
            );
          }
        }

        // 3. Ensure Master Administrator account exists in PostgreSQL
        const masterCheck = await pool.query(
          'SELECT uid, password_hash FROM users WHERE LOWER(email) = $1 LIMIT 1',
          [MASTER_ADMIN_SEED.email]
        );
        if (masterCheck.rows.length === 0) {
          await db.insert(users).values({
            uid: MASTER_ADMIN_SEED.uid,
            name: MASTER_ADMIN_SEED.name,
            email: MASTER_ADMIN_SEED.email,
            phone: MASTER_ADMIN_SEED.phone,
            company: MASTER_ADMIN_SEED.company,
            cpfCnpj: MASTER_ADMIN_SEED.cpfCnpj,
            role: MASTER_ADMIN_SEED.role,
            passwordHash: MASTER_ADMIN_SEED.passwordHash,
            isActive: true,
          }).onConflictDoNothing();
        } else if (!masterCheck.rows[0].password_hash) {
          await pool.query(
            'UPDATE users SET password_hash = $1, role = $2, is_active = true WHERE uid = $3',
            [MASTER_ADMIN_SEED.passwordHash, 'admin', masterCheck.rows[0].uid]
          );
        }
      }
    });
  } catch (err) {
    console.warn('[PostgreSQL] Note during seeding:', err);
  }
}

// ==========================================
// PRODUCTS
// ==========================================
export async function getProductsFromDb() {
  if (!isDatabaseConfigured()) {
    return getDevState().products;
  }
  return withDbRetry('getProductsFromDb', () => db.select().from(products));
}

export async function upsertProductInDb(item: any) {
  if (!isDatabaseConfigured()) {
    const state = getDevState();
    const idx = state.products.findIndex((p: any) => p.id === item.id);
    if (idx !== -1) state.products[idx] = { ...state.products[idx], ...item };
    else state.products.push(item);
    saveDevState(state);
    return [item];
  }
  return withDbRetry('upsertProductInDb', () =>
    db.insert(products).values({
      id: item.id,
      code: item.code,
      name: item.name,
      slug: item.slug,
      categoryId: item.categoryId,
      subcategoryId: item.subcategoryId,
      shortDescription: item.short_description || item.shortDescription || '',
      description: item.description || '',
      basePrice: item.base_price !== undefined ? item.base_price : (item.basePrice || 0),
      promoPrice: item.promo_price !== undefined ? item.promo_price : item.promoPrice,
      costPrice: item.cost_price !== undefined ? item.cost_price : item.costPrice,
      stockQty: item.stock_qty !== undefined ? item.stock_qty : (item.stockQty || 0),
      minOrderQty: item.min_order_qty !== undefined ? item.min_order_qty : (item.minOrderQty || 1),
      isActive: item.is_active !== undefined ? item.is_active : (item.isActive !== false),
      isFeatured: item.is_featured !== undefined ? item.is_featured : (item.isFeatured || false),
      images: item.images || [],
      badge: item.badge,
      showPrice: item.show_price !== undefined ? item.show_price : (item.showPrice !== false),
      priceTiers: item.price_tiers || item.priceTiers || [],
      variants: item.variants || [],
      details: item.details || {},
      barcode: item.barcode,
      qrCode: item.qrCode,
      totalStockAvailable: item.totalStockAvailable || 0,
      totalNextQuantities: item.totalNextQuantities || 0,
      rawData: item.rawData,
    }).onConflictDoUpdate({
      target: products.id,
      set: {
        code: item.code,
        name: item.name,
        slug: item.slug,
        categoryId: item.categoryId,
        subcategoryId: item.subcategoryId,
        shortDescription: item.short_description || item.shortDescription || '',
        description: item.description || '',
        basePrice: item.base_price !== undefined ? item.base_price : (item.basePrice || 0),
        promoPrice: item.promo_price !== undefined ? item.promo_price : item.promoPrice,
        costPrice: item.cost_price !== undefined ? item.cost_price : item.costPrice,
        stockQty: item.stock_qty !== undefined ? item.stock_qty : (item.stockQty || 0),
        minOrderQty: item.min_order_qty !== undefined ? item.min_order_qty : (item.minOrderQty || 1),
        isActive: item.is_active !== undefined ? item.is_active : (item.isActive !== false),
        isFeatured: item.is_featured !== undefined ? item.is_featured : (item.isFeatured || false),
        images: item.images || [],
        badge: item.badge,
        showPrice: item.show_price !== undefined ? item.show_price : (item.showPrice !== false),
        priceTiers: item.price_tiers || item.priceTiers || [],
        variants: item.variants || [],
        details: item.details || {},
        barcode: item.barcode,
        qrCode: item.qrCode,
        totalStockAvailable: item.totalStockAvailable || 0,
        totalNextQuantities: item.totalNextQuantities || 0,
        updatedAt: new Date(),
      },
    }).returning()
  );
}

export async function deleteProductFromDb(id: string) {
  if (!isDatabaseConfigured()) {
    const state = getDevState();
    const removed = state.products.filter((p: any) => p.id === id);
    state.products = state.products.filter((p: any) => p.id !== id);
    saveDevState(state);
    return removed;
  }
  return withDbRetry('deleteProductFromDb', () =>
    db.delete(products).where(eq(products.id, id)).returning()
  );
}

// ==========================================
// CATEGORIES & SUBCATEGORIES
// ==========================================
export async function getCategoriesFromDb() {
  if (!isDatabaseConfigured()) {
    return getDevState().categories;
  }
  return withDbRetry('getCategoriesFromDb', () => db.select().from(categories));
}

export async function getSubcategoriesFromDb() {
  if (!isDatabaseConfigured()) {
    return getDevState().subcategories;
  }
  return withDbRetry('getSubcategoriesFromDb', () => db.select().from(subcategories));
}

export async function upsertCategoryInDb(cat: any) {
  if (!isDatabaseConfigured()) {
    const state = getDevState();
    const idx = state.categories.findIndex((c: any) => c.id === cat.id);
    if (idx !== -1) state.categories[idx] = { ...state.categories[idx], ...cat };
    else state.categories.push(cat);
    saveDevState(state);
    return [cat];
  }
  return withDbRetry('upsertCategoryInDb', () =>
    db.insert(categories).values({
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      description: cat.description || '',
      image: cat.image || '',
      icon: cat.icon || '',
      orderIndex: cat.orderIndex || 0,
      isActive: cat.isActive !== false,
    }).onConflictDoUpdate({
      target: categories.id,
      set: {
        name: cat.name,
        slug: cat.slug,
        description: cat.description || '',
        image: cat.image || '',
        icon: cat.icon || '',
        orderIndex: cat.orderIndex || 0,
        isActive: cat.isActive !== false,
      },
    }).returning()
  );
}

// ==========================================
// ORDERS
// ==========================================
export async function getOrdersFromDb() {
  if (!isDatabaseConfigured()) {
    return getDevState().orders;
  }
  return withDbRetry('getOrdersFromDb', () =>
    db.select().from(orders).orderBy(desc(orders.createdAt))
  );
}

export async function upsertOrderInDb(order: any) {
  if (!isDatabaseConfigured()) {
    const state = getDevState();
    const idx = state.orders.findIndex((o: any) => o.id === order.id);
    if (idx !== -1) state.orders[idx] = { ...state.orders[idx], ...order };
    else state.orders.unshift(order);
    saveDevState(state);
    return [order];
  }
  return withDbRetry('upsertOrderInDb', () =>
    db.insert(orders).values({
      id: order.id,
      code: order.code,
      clientId: order.clientId,
      clientName: order.clientName,
      clientEmail: order.clientEmail,
      clientPhone: order.clientPhone,
      clientCompany: order.clientCompany,
      shippingAddress: order.shippingAddress,
      items: order.items || [],
      subtotal: order.subtotal || 0,
      discount: order.discount || 0,
      couponCode: order.couponCode,
      couponId: order.couponId,
      couponDiscount: order.couponDiscount,
      couponInfo: order.couponInfo,
      shippingCost: order.shippingCost || 0,
      shippingInfo: order.shippingInfo,
      total: order.total || 0,
      paymentMethod: order.paymentMethod || 'pix',
      paymentStatus: order.paymentStatus || 'pendente',
      orderStatus: order.orderStatus || 'novo',
      sourceQuoteId: order.sourceQuoteId,
      billingTerms: order.billingTerms,
      notes: order.notes,
      boletos: order.boletos,
    }).onConflictDoUpdate({
      target: orders.id,
      set: {
        clientName: order.clientName,
        clientEmail: order.clientEmail,
        clientPhone: order.clientPhone,
        clientCompany: order.clientCompany,
        shippingAddress: order.shippingAddress,
        items: order.items || [],
        subtotal: order.subtotal || 0,
        discount: order.discount || 0,
        couponCode: order.couponCode,
        couponId: order.couponId,
        couponDiscount: order.couponDiscount,
        couponInfo: order.couponInfo,
        shippingCost: order.shippingCost || 0,
        shippingInfo: order.shippingInfo,
        total: order.total || 0,
        paymentMethod: order.paymentMethod || 'pix',
        paymentStatus: order.paymentStatus || 'pendente',
        orderStatus: order.orderStatus || 'novo',
        notes: order.notes,
        boletos: order.boletos,
        updatedAt: new Date(),
      },
    }).returning()
  );
}

// ==========================================
// QUOTES
// ==========================================
export async function getQuotesFromDb() {
  if (!isDatabaseConfigured()) {
    return getDevState().quotes;
  }
  return withDbRetry('getQuotesFromDb', () =>
    db.select().from(quotes).orderBy(desc(quotes.createdAt))
  );
}

export async function upsertQuoteInDb(q: any) {
  if (!isDatabaseConfigured()) {
    const state = getDevState();
    const idx = state.quotes.findIndex((item: any) => item.id === q.id);
    if (idx !== -1) state.quotes[idx] = { ...state.quotes[idx], ...q };
    else state.quotes.unshift(q);
    saveDevState(state);
    return [q];
  }
  return withDbRetry('upsertQuoteInDb', () =>
    db.insert(quotes).values({
      id: q.id,
      code: q.code,
      clientId: q.clientId,
      clientName: q.clientName,
      clientEmail: q.clientEmail,
      clientPhone: q.clientPhone,
      clientCompany: q.clientCompany,
      items: q.items || [],
      subtotal: q.subtotal || 0,
      discount: q.discount || 0,
      total: q.total || 0,
      notes: q.notes,
      status: q.status || 'pendente',
      adminNotes: q.adminNotes,
      respondedAt: q.respondedAt,
      respondedBy: q.respondedBy,
      billingTerms: q.billingTerms,
      validityDate: q.validityDate,
    }).onConflictDoUpdate({
      target: quotes.id,
      set: {
        clientName: q.clientName,
        clientEmail: q.clientEmail,
        clientPhone: q.clientPhone,
        clientCompany: q.clientCompany,
        items: q.items || [],
        subtotal: q.subtotal || 0,
        discount: q.discount || 0,
        total: q.total || 0,
        notes: q.notes,
        status: q.status || 'pendente',
        adminNotes: q.adminNotes,
        respondedAt: q.respondedAt,
        respondedBy: q.respondedBy,
        billingTerms: q.billingTerms,
        validityDate: q.validityDate,
        updatedAt: new Date(),
      },
    }).returning()
  );
}

// ==========================================
// USERS & AUTH SESSIONS (POSTGRESQL + SAFE PASSWORD HASHING)
// ==========================================
export async function getUsersFromDb() {
  if (!isDatabaseConfigured()) {
    return getDevState().users;
  }
  return withDbRetry('getUsersFromDb', () => db.select().from(users));
}

export async function getUserByUidFromDb(uid: string) {
  if (!uid) return null;
  if (!isDatabaseConfigured()) {
    const state = getDevState();
    return state.users.find((u: any) => (u.uid || u.id) === uid) || null;
  }
  return withDbRetry('getUserByUidFromDb', async () => {
    const res = await db.select().from(users).where(eq(users.uid, uid)).limit(1);
    return res[0] || null;
  });
}

export async function getUserByEmailFromDb(email: string) {
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized) return null;
  if (!isDatabaseConfigured()) {
    const state = getDevState();
    return state.users.find((u: any) => String(u.email || '').trim().toLowerCase() === normalized) || null;
  }
  return withDbRetry('getUserByEmailFromDb', async () => {
    const res = await db
      .select()
      .from(users)
      .where(sql`LOWER(TRIM(${users.email})) = ${normalized}`)
      .limit(1);
    return res[0] || null;
  });
}

export async function getUserByCpfCnpjFromDb(cpfCnpj: string) {
  const digits = onlyDigits(cpfCnpj);
  if (!digits) return null;
  if (!isDatabaseConfigured()) {
    const state = getDevState();
    return state.users.find((u: any) => onlyDigits(u.cpfCnpj) === digits) || null;
  }
  return withDbRetry('getUserByCpfCnpjFromDb', async () => {
    const all = await db.select().from(users);
    return all.find((u: any) => onlyDigits(u.cpfCnpj) === digits) || null;
  });
}

export async function upsertUserInDb(u: any) {
  const uid = String(u.uid || u.id);
  const resolvedPasswordHash =
    typeof u.passwordHash === 'string' && u.passwordHash.startsWith('scrypt$')
      ? u.passwordHash
      : typeof u.password === 'string' && u.password.trim().length > 0
      ? hashPassword(u.password)
      : undefined;
  const normalizedEmail = String(u.email || '').trim().toLowerCase();
  const isActiveVal = u.status === 'inativo' ? false : u.isActive !== false;

  if (!isDatabaseConfigured()) {
    const state = getDevState();
    const idx = state.users.findIndex((item: any) => (item.uid || item.id) === uid);
    const existing = idx !== -1 ? state.users[idx] : null;
    const savedRecord = {
      ...(existing || {}),
      ...u,
      id: uid,
      uid,
      email: normalizedEmail || existing?.email || '',
      phone: u.phone ?? existing?.phone ?? '',
      company: u.company ?? existing?.company ?? '',
      cpfCnpj: u.cpfCnpj ?? existing?.cpfCnpj ?? '',
      role: u.role || existing?.role || 'cliente',
      isActive: isActiveVal,
      status: isActiveVal ? 'ativo' : 'inativo',
      passwordHash: resolvedPasswordHash ?? existing?.passwordHash ?? null,
      updatedAt: new Date().toISOString(),
    };
    delete savedRecord.password;
    if (idx !== -1) state.users[idx] = savedRecord;
    else state.users.push(savedRecord);
    saveDevState(state);
    return [savedRecord];
  }

  return withDbRetry('upsertUserInDb', () => {
    const setPayload: any = {
      name: u.name,
      email: normalizedEmail,
      phone: u.phone || '',
      company: u.company || '',
      cpfCnpj: u.cpfCnpj || '',
      role: u.role || 'cliente',
      address: u.address,
      customPermissions: u.customPermissions,
      isActive: isActiveVal,
      updatedAt: new Date(),
    };
    if (resolvedPasswordHash) {
      setPayload.passwordHash = resolvedPasswordHash;
    }

    return db
      .insert(users)
      .values({
        uid,
        name: u.name,
        email: normalizedEmail,
        phone: u.phone || '',
        company: u.company || '',
        cpfCnpj: u.cpfCnpj || '',
        role: u.role || 'cliente',
        passwordHash: resolvedPasswordHash || null,
        address: u.address,
        customPermissions: u.customPermissions,
        isActive: isActiveVal,
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: setPayload,
      })
      .returning();
  });
}

export async function updateUserLastLoginInDb(uid: string) {
  if (!uid) return;
  if (!isDatabaseConfigured()) {
    const state = getDevState();
    const user = state.users.find((u: any) => (u.uid || u.id) === uid);
    if (user) {
      user.lastLogin = new Date().toISOString();
      saveDevState(state);
    }
    return;
  }
  await withDbRetry('updateUserLastLoginInDb', () =>
    db.update(users).set({ updatedAt: new Date() }).where(eq(users.uid, uid))
  );
}

export async function createAuthSessionInDb(session: {
  tokenHash: string;
  userUid: string;
  role: string;
  expiresAt: Date;
  userAgent?: string;
  ip?: string;
}) {
  if (!isDatabaseConfigured()) {
    const state = getDevState();
    state.authSessions = state.authSessions.filter((s) => new Date(s.expiresAt) > new Date());
    state.authSessions.push({
      tokenHash: session.tokenHash,
      userUid: session.userUid,
      role: session.role,
      expiresAt: session.expiresAt.toISOString(),
      userAgent: session.userAgent || '',
      ip: session.ip || '',
      createdAt: new Date().toISOString(),
    });
    saveDevState(state);
    return;
  }

  await ensureAdditiveTablesInPostgres();
  await withDbRetry('createAuthSessionInDb', () =>
    db.insert(authSessions).values({
      tokenHash: session.tokenHash,
      userUid: session.userUid,
      role: session.role,
      expiresAt: session.expiresAt,
      userAgent: session.userAgent || '',
      ip: session.ip || '',
    })
  );
}

export async function getAuthSessionWithUserFromDb(tokenHash: string): Promise<{
  session: any;
  user: any;
} | null> {
  if (!tokenHash) return null;
  if (!isDatabaseConfigured()) {
    const state = getDevState();
    const sess = state.authSessions.find((s) => s.tokenHash === tokenHash);
    if (!sess) return null;
    if (new Date(sess.expiresAt) <= new Date()) {
      state.authSessions = state.authSessions.filter((s) => s.tokenHash !== tokenHash);
      saveDevState(state);
      return null;
    }
    const user = state.users.find((u: any) => (u.uid || u.id) === sess.userUid);
    if (!user) return null;
    return { session: sess, user };
  }

  return withDbRetry('getAuthSessionWithUserFromDb', async () => {
    const rows = await db
      .select()
      .from(authSessions)
      .where(eq(authSessions.tokenHash, tokenHash))
      .limit(1);
    const sess = rows[0];
    if (!sess) return null;
    if (new Date(sess.expiresAt) <= new Date()) {
      await db.delete(authSessions).where(eq(authSessions.tokenHash, tokenHash));
      return null;
    }
    const userRows = await db.select().from(users).where(eq(users.uid, sess.userUid)).limit(1);
    const user = userRows[0];
    if (!user) return null;
    return { session: sess, user };
  });
}

export async function deleteAuthSessionByTokenHashFromDb(tokenHash: string) {
  if (!tokenHash) return;
  if (!isDatabaseConfigured()) {
    const state = getDevState();
    state.authSessions = state.authSessions.filter((s) => s.tokenHash !== tokenHash);
    saveDevState(state);
    return;
  }
  await withDbRetry('deleteAuthSessionByTokenHashFromDb', () =>
    db.delete(authSessions).where(eq(authSessions.tokenHash, tokenHash))
  );
}

export async function deleteUserAuthSessionsFromDb(userUid: string) {
  if (!userUid) return;
  if (!isDatabaseConfigured()) {
    const state = getDevState();
    state.authSessions = state.authSessions.filter((s) => s.userUid !== userUid);
    saveDevState(state);
    return;
  }
  await withDbRetry('deleteUserAuthSessionsFromDb', () =>
    db.delete(authSessions).where(eq(authSessions.userUid, userUid))
  );
}

// ==========================================
// DISCOUNT COUPONS
// ==========================================
export async function getCouponsFromDb() {
  if (!isDatabaseConfigured()) {
    return getDevState().coupons;
  }
  return withDbRetry('getCouponsFromDb', () => db.select().from(discountCoupons));
}

export async function upsertCouponInDb(c: any) {
  if (!isDatabaseConfigured()) {
    const state = getDevState();
    const idx = state.coupons.findIndex((cp: any) => cp.id === c.id);
    if (idx !== -1) state.coupons[idx] = { ...state.coupons[idx], ...c };
    else state.coupons.push(c);
    saveDevState(state);
    return [c];
  }
  return withDbRetry('upsertCouponInDb', () =>
    db.insert(discountCoupons).values({
      id: c.id,
      code: c.code.toUpperCase().trim(),
      campaignName: c.campaignName,
      discountType: c.discountType,
      discountValue: c.discountValue,
      startDate: c.startDate,
      endDate: c.endDate,
      minPurchaseAmount: c.minPurchaseAmount,
      maxDiscountAmount: c.maxDiscountAmount,
      maxUses: c.maxUses || 0,
      currentUses: c.currentUses || 0,
      limitPerCustomer: c.limitPerCustomer || 1,
      applicableType: c.applicableType || 'all_store',
      allowedProductIds: c.allowedProductIds || [],
      allowedCategoryIds: c.allowedCategoryIds || [],
      allowedCustomerIds: c.allowedCustomerIds || [],
      allowCumulative: c.allowCumulative || false,
      status: c.status || 'active',
      internalNotes: c.internalNotes,
      createdBy: c.createdBy,
    }).onConflictDoUpdate({
      target: discountCoupons.id,
      set: {
        code: c.code.toUpperCase().trim(),
        campaignName: c.campaignName,
        discountType: c.discountType,
        discountValue: c.discountValue,
        startDate: c.startDate,
        endDate: c.endDate,
        minPurchaseAmount: c.minPurchaseAmount,
        maxDiscountAmount: c.maxDiscountAmount,
        maxUses: c.maxUses || 0,
        currentUses: c.currentUses || 0,
        limitPerCustomer: c.limitPerCustomer || 1,
        applicableType: c.applicableType || 'all_store',
        allowedProductIds: c.allowedProductIds || [],
        allowedCategoryIds: c.allowedCategoryIds || [],
        allowedCustomerIds: c.allowedCustomerIds || [],
        allowCumulative: c.allowCumulative || false,
        status: c.status || 'active',
        internalNotes: c.internalNotes,
        updatedAt: new Date(),
      },
    }).returning()
  );
}

// ==========================================
// SYSTEM SETTINGS, PERMISSIONS & PRICE VISIBILITY
// ==========================================
export async function getSystemSettingsFromDb(key: string) {
  if (!isDatabaseConfigured()) {
    return getDevState().settings[key] ?? null;
  }
  return withDbRetry('getSystemSettingsFromDb', async () => {
    const res = await db.select().from(systemSettings).where(eq(systemSettings.key, key));
    return res[0]?.value || null;
  });
}

export async function saveSystemSettingsToDb(key: string, value: any) {
  if (!isDatabaseConfigured()) {
    const state = getDevState();
    state.settings[key] = value;
    saveDevState(state);
    return [{ key, value, updatedAt: new Date().toISOString() }];
  }
  return withDbRetry('saveSystemSettingsToDb', () =>
    db.insert(systemSettings).values({
      key,
      value,
      updatedAt: new Date(),
    }).onConflictDoUpdate({
      target: systemSettings.key,
      set: {
        value,
        updatedAt: new Date(),
      },
    }).returning()
  );
}

export async function getPriceVisibilityFromDb(): Promise<PriceVisibilityMode> {
  const raw = await getSystemSettingsFromDb('price_visibility');
  if (!raw) return INITIAL_PRICE_VISIBILITY_MODE;
  return normalizePriceVisibilityMode(raw);
}

export async function savePriceVisibilityToDb(
  mode: PriceVisibilityMode,
  updatedBy?: { id: string; name: string; email: string }
): Promise<{ mode: PriceVisibilityMode; updatedAt: string; updatedBy?: any }> {
  const normalized: PriceVisibilityMode = mode === 'all' ? 'all' : 'registered_only';
  const payload = {
    mode: normalized,
    updatedAt: new Date().toISOString(),
    updatedBy: updatedBy || undefined,
  };
  await saveSystemSettingsToDb('price_visibility', payload);
  return payload;
}

export async function getPermissionsMatrixFromDb(): Promise<Record<UserRole, RolePermissions>> {
  const saved = await getSystemSettingsFromDb('permissions');
  if (!saved || typeof saved !== 'object') {
    return INITIAL_PERMISSIONS_MATRIX;
  }
  return {
    ...INITIAL_PERMISSIONS_MATRIX,
    ...saved,
  };
}

// ==========================================
// BACKUPS RECORDING IN POSTGRESQL
// ==========================================
export async function getBackupsFromDb() {
  if (!isDatabaseConfigured()) {
    return getDevState().backups;
  }
  return withDbRetry('getBackupsFromDb', () =>
    db.select().from(backups).orderBy(desc(backups.createdAt))
  );
}

export async function recordBackupInDb(entry: any) {
  if (!isDatabaseConfigured()) {
    const state = getDevState();
    const idx = state.backups.findIndex((b: any) => b.id === entry.id);
    if (idx !== -1) state.backups[idx] = { ...state.backups[idx], ...entry };
    else state.backups.unshift(entry);
    saveDevState(state);
    return [entry];
  }
  return withDbRetry('recordBackupInDb', () =>
    db.insert(backups).values({
      id: entry.id,
      filename: entry.filename,
      sizeBytes: entry.sizeBytes || 0,
      sizeFormatted: entry.sizeFormatted || '0 B',
      checksum: entry.checksum,
      trigger: entry.trigger || 'manual',
      status: entry.status || 'success',
      counts: entry.counts || {},
      payload: entry.payload || null,
    }).onConflictDoUpdate({
      target: backups.id,
      set: {
        status: entry.status,
      },
    }).returning()
  );
}

// ==========================================
// SUBCATEGORIES
// ==========================================
export async function upsertSubcategoryInDb(sub: any) {
  if (!isDatabaseConfigured()) {
    const state = getDevState();
    const idx = state.subcategories.findIndex((s: any) => s.id === sub.id);
    if (idx !== -1) state.subcategories[idx] = { ...state.subcategories[idx], ...sub };
    else state.subcategories.push(sub);
    saveDevState(state);
    return [sub];
  }
  return withDbRetry('upsertSubcategoryInDb', () =>
    db.insert(subcategories).values({
      id: sub.id,
      categoryId: sub.categoryId,
      name: sub.name,
      slug: sub.slug,
      description: sub.description || '',
      isActive: sub.isActive !== false,
    }).onConflictDoUpdate({
      target: subcategories.id,
      set: {
        categoryId: sub.categoryId,
        name: sub.name,
        slug: sub.slug,
        description: sub.description || '',
        isActive: sub.isActive !== false,
      },
    }).returning()
  );
}

// ==========================================
// STOCK MOVEMENTS
// ==========================================
export async function getStockMovementsFromDb() {
  if (!isDatabaseConfigured()) {
    return getDevState().stockMovements;
  }
  try {
    return await withDbRetry('getStockMovementsFromDb', () =>
      db.select().from(stockMovements).orderBy(desc(stockMovements.createdAt))
    );
  } catch {
    return [];
  }
}

export async function upsertStockMovementInDb(m: any) {
  if (!isDatabaseConfigured()) {
    const state = getDevState();
    state.stockMovements.unshift(m);
    saveDevState(state);
    return [m];
  }
  return withDbRetry('upsertStockMovementInDb', () =>
    db.insert(stockMovements).values({
      id: m.id,
      productId: m.productId,
      productName: m.productName || '',
      variantId: m.variantId,
      variantColor: m.variantColor,
      type: m.type || 'ajuste',
      quantity: Number(m.quantity) || 0,
      previousStock: Number(m.previous_stock ?? m.previousStock ?? 0),
      newStock: Number(m.new_stock ?? m.newStock ?? 0),
      reason: m.reason || '',
      operatorName: m.operator_name || m.operatorName || 'Sistema',
      createdAtText: m.created_at || m.createdAtText || new Date().toISOString(),
    }).onConflictDoNothing().returning()
  );
}

// ==========================================
// BOLETOS & FINANCIAL ACCOUNTS
// ==========================================
export async function getBoletosFromDb() {
  if (!isDatabaseConfigured()) {
    return getDevState().boletos;
  }
  try {
    return await withDbRetry('getBoletosFromDb', () =>
      db.select().from(boletos).orderBy(desc(boletos.createdAt))
    );
  } catch {
    return [];
  }
}

export async function upsertBoletoInDb(b: any) {
  if (!isDatabaseConfigured()) {
    const state = getDevState();
    const idx = state.boletos.findIndex((item: any) => item.id === b.id);
    if (idx !== -1) state.boletos[idx] = { ...state.boletos[idx], ...b };
    else state.boletos.unshift(b);
    saveDevState(state);
    return [b];
  }
  return withDbRetry('upsertBoletoInDb', () =>
    db.insert(boletos).values({
      id: b.id,
      nossoNumero: b.nossoNumero || '',
      numeroDocumento: b.numeroDocumento || b.orderCode || b.id,
      orderId: b.orderId || '',
      quoteId: b.quoteId,
      tipoCobranca: b.tipoCobranca || 'a_vista',
      status: b.status || 'pendente',
      valor: Number(b.valorOriginal ?? b.valor ?? 0),
      dataVencimento: b.dataVencimento || '',
      dataEmissao: b.dataEmissao || new Date().toISOString(),
      dataPagamento: b.dataPagamento,
      linhaDigitavel: b.linhaDigitavel || '',
      codigoBarras: b.codigoBarras || '',
      bancoCodigo: b.bancoCodigo || '341',
      bancoNome: b.bancoNome || b.bancoEmissor || 'Itaú',
      sacadoNome: b.sacadoNome || '',
      sacadoDocumento: b.sacadoDocumento || b.sacadoCpfCnpj || '',
      parcelaAtual: b.parcelaNumero ?? b.parcelaAtual ?? 1,
      totalParcelas: b.totalParcelas ?? 1,
    }).onConflictDoUpdate({
      target: boletos.id,
      set: {
        status: b.status || 'pendente',
        dataPagamento: b.dataPagamento,
        dataVencimento: b.dataVencimento || '',
      },
    }).returning()
  );
}

export async function getFinancialAccountsFromDb() {
  if (!isDatabaseConfigured()) {
    return getDevState().financialAccounts;
  }
  try {
    return await withDbRetry('getFinancialAccountsFromDb', () =>
      db.select().from(financialAccounts).orderBy(desc(financialAccounts.createdAt))
    );
  } catch {
    return [];
  }
}

export async function upsertFinancialAccountInDb(a: any) {
  if (!isDatabaseConfigured()) {
    const state = getDevState();
    const idx = state.financialAccounts.findIndex((item: any) => item.id === a.id);
    if (idx !== -1) state.financialAccounts[idx] = { ...state.financialAccounts[idx], ...a };
    else state.financialAccounts.unshift(a);
    saveDevState(state);
    return [a];
  }
  return withDbRetry('upsertFinancialAccountInDb', () =>
    db.insert(financialAccounts).values({
      id: a.id,
      type: a.type || 'receber',
      description: a.description || '',
      entityName: a.entityName || a.customerOrSupplierName || '',
      documentNumber: a.documentNumber,
      amount: Number(a.amount ?? a.originalAmount ?? 0),
      paidAmount: Number(a.paidAmount ?? 0),
      remainingAmount: Number(a.remainingAmount ?? a.openAmount ?? a.amount ?? 0),
      dueDate: a.dueDate || '',
      issueDate: a.issueDate || new Date().toISOString().split('T')[0],
      paymentDate: a.paymentDate,
      status: a.status || 'pendente',
      categoryId: a.categoryId,
      costCenterId: a.costCenterId,
      bankAccountId: a.bankAccountId,
      paymentMethodId: a.paymentMethodId,
      orderId: a.orderId,
      quoteId: a.quoteId,
      notes: a.notes,
      installments: a.installments || null,
    }).onConflictDoUpdate({
      target: financialAccounts.id,
      set: {
        paidAmount: Number(a.paidAmount ?? 0),
        remainingAmount: Number(a.remainingAmount ?? a.openAmount ?? a.amount ?? 0),
        paymentDate: a.paymentDate,
        status: a.status || 'pendente',
        notes: a.notes,
        updatedAt: new Date(),
      },
    }).returning()
  );
}

// ==========================================
// PDV SALES, CASH SESSIONS & PAYMENT TRANSACTIONS
// ==========================================
export async function getPdvSalesFromDb() {
  if (!isDatabaseConfigured()) {
    return getDevState().pdvSales;
  }
  try {
    return await withDbRetry('getPdvSalesFromDb', () =>
      db.select().from(pdvSales).orderBy(desc(pdvSales.createdAt))
    );
  } catch {
    return [];
  }
}

export async function upsertPdvSaleInDb(s: any) {
  if (!isDatabaseConfigured()) {
    const state = getDevState();
    const idx = state.pdvSales.findIndex((item: any) => item.id === s.id);
    if (idx !== -1) state.pdvSales[idx] = { ...state.pdvSales[idx], ...s };
    else state.pdvSales.unshift(s);
    saveDevState(state);
    return [s];
  }
  return withDbRetry('upsertPdvSaleInDb', () =>
    db.insert(pdvSales).values({
      id: s.id,
      code: s.code || s.id,
      customerName: s.customerName || 'Consumidor Final',
      customerCpfCnpj: s.customerCpfCnpj,
      operatorId: s.operatorId,
      operatorName: s.operatorName,
      cashRegisterNumber: s.cashRegisterNumber || 1,
      subtotal: Number(s.subtotal || 0),
      discount: Number(s.discount || 0),
      total: Number(s.total || 0),
      status: s.status || 'concluida',
      items: s.items || [],
      payments: s.payments || [],
      rawData: s,
    }).onConflictDoUpdate({
      target: pdvSales.id,
      set: {
        status: s.status || 'concluida',
        rawData: s,
        updatedAt: new Date(),
      },
    }).returning()
  );
}

export async function getCashSessionsFromDb() {
  if (!isDatabaseConfigured()) {
    return getDevState().cashSessions;
  }
  try {
    return await withDbRetry('getCashSessionsFromDb', () =>
      db.select().from(cashRegisterSessions).orderBy(desc(cashRegisterSessions.createdAt))
    );
  } catch {
    return [];
  }
}

export async function upsertCashSessionInDb(cs: any) {
  if (!isDatabaseConfigured()) {
    const state = getDevState();
    const idx = state.cashSessions.findIndex((item: any) => item.id === cs.id);
    if (idx !== -1) state.cashSessions[idx] = { ...state.cashSessions[idx], ...cs };
    else state.cashSessions.unshift(cs);
    saveDevState(state);
    return [cs];
  }
  return withDbRetry('upsertCashSessionInDb', () =>
    db.insert(cashRegisterSessions).values({
      id: cs.id,
      registerNumber: cs.registerNumber || 1,
      registerName: cs.registerName || 'Caixa Balcão 01',
      operatorId: cs.operatorId || '',
      operatorName: cs.operatorName || '',
      status: cs.status || 'aberto',
      initialFund: Number(cs.initialFund || 0),
      expectedCash: Number(cs.expectedCash || 0),
      actualCash: cs.actualCash !== undefined ? Number(cs.actualCash) : null,
      totalSalesAmount: Number(cs.totalSalesAmount || 0),
      rawData: cs,
      openedAt: cs.openedAt,
      closedAt: cs.closedAt,
    }).onConflictDoUpdate({
      target: cashRegisterSessions.id,
      set: {
        status: cs.status || 'aberto',
        expectedCash: Number(cs.expectedCash || 0),
        actualCash: cs.actualCash !== undefined ? Number(cs.actualCash) : null,
        totalSalesAmount: Number(cs.totalSalesAmount || 0),
        rawData: cs,
        closedAt: cs.closedAt,
        updatedAt: new Date(),
      },
    }).returning()
  );
}

export async function getPaymentTransactionsFromDb() {
  if (!isDatabaseConfigured()) {
    return getDevState().paymentTransactions;
  }
  try {
    return await withDbRetry('getPaymentTransactionsFromDb', () =>
      db.select().from(paymentTransactions).orderBy(desc(paymentTransactions.createdAt))
    );
  } catch {
    return [];
  }
}

export async function upsertPaymentTransactionInDb(tx: any) {
  if (!isDatabaseConfigured()) {
    const state = getDevState();
    const idx = state.paymentTransactions.findIndex((item: any) => item.id === tx.id);
    if (idx !== -1) state.paymentTransactions[idx] = { ...state.paymentTransactions[idx], ...tx };
    else state.paymentTransactions.unshift(tx);
    saveDevState(state);
    return [tx];
  }
  return withDbRetry('upsertPaymentTransactionInDb', () =>
    db.insert(paymentTransactions).values({
      id: tx.id,
      saleId: tx.saleId,
      saleCode: tx.saleCode,
      orderId: tx.orderId,
      origin: tx.origin || 'loja_online',
      gateway: tx.gateway || 'mercadopago',
      gatewayTransactionId: tx.gatewayTransactionId,
      method: tx.method || 'pix',
      grossAmount: Number(tx.grossAmount || 0),
      feeAmount: Number(tx.feeAmount || 0),
      netAmount: Number(tx.netAmount || 0),
      status: tx.status || 'pendente',
      rawData: tx,
    }).onConflictDoUpdate({
      target: paymentTransactions.id,
      set: {
        status: tx.status || 'pendente',
        rawData: tx,
        updatedAt: new Date(),
      },
    }).returning()
  );
}

export async function getAllSystemSettingsFromDb(): Promise<Record<string, any>> {
  if (!isDatabaseConfigured()) {
    return { ...getDevState().settings };
  }
  try {
    const rows = await withDbRetry('getAllSystemSettingsFromDb', () =>
      db.select().from(systemSettings)
    );
    const map: Record<string, any> = {};
    for (const r of rows || []) {
      map[r.key] = r.value;
    }
    return map;
  } catch {
    return {};
  }
}

// ==========================================
// NON-DESTRUCTIVE ADDITIVE TABLE GUARANTEE (HOSTINGER VPS SAFE)
// ==========================================
export async function ensureAdditiveTablesInPostgres(): Promise<{ createdOrVerified: string[] }> {
  if (!isDatabaseConfigured()) {
    return { createdOrVerified: [] };
  }
  const pool = createPool();
  const ddlStatements = [
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT`,
    `CREATE TABLE IF NOT EXISTS auth_sessions (
      token_hash TEXT PRIMARY KEY,
      user_uid TEXT NOT NULL,
      role TEXT NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      user_agent TEXT DEFAULT '',
      ip TEXT DEFAULT '',
      created_at TIMESTAMP DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_uid ON auth_sessions(user_uid)`,
    `CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires_at ON auth_sessions(expires_at)`,
    `CREATE TABLE IF NOT EXISTS stock_movements (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      product_name TEXT NOT NULL,
      variant_id TEXT,
      variant_color TEXT,
      type TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      previous_stock INTEGER NOT NULL DEFAULT 0,
      new_stock INTEGER NOT NULL DEFAULT 0,
      reason TEXT DEFAULT '',
      operator_name TEXT DEFAULT 'Sistema',
      created_at_text TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS pdv_sales (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL,
      customer_name TEXT DEFAULT 'Consumidor Final',
      customer_cpf_cnpj TEXT,
      operator_id TEXT,
      operator_name TEXT,
      cash_register_number INTEGER DEFAULT 1,
      subtotal DOUBLE PRECISION NOT NULL DEFAULT 0,
      discount DOUBLE PRECISION DEFAULT 0,
      total DOUBLE PRECISION NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'concluida',
      items JSONB NOT NULL DEFAULT '[]'::jsonb,
      payments JSONB NOT NULL DEFAULT '[]'::jsonb,
      raw_data JSONB,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS cash_register_sessions (
      id TEXT PRIMARY KEY,
      register_number INTEGER NOT NULL DEFAULT 1,
      register_name TEXT NOT NULL DEFAULT 'Caixa Balcão 01',
      operator_id TEXT NOT NULL,
      operator_name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'aberto',
      initial_fund DOUBLE PRECISION NOT NULL DEFAULT 0,
      expected_cash DOUBLE PRECISION NOT NULL DEFAULT 0,
      actual_cash DOUBLE PRECISION,
      total_sales_amount DOUBLE PRECISION DEFAULT 0,
      raw_data JSONB NOT NULL,
      opened_at TEXT,
      closed_at TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS payment_transactions (
      id TEXT PRIMARY KEY,
      sale_id TEXT,
      sale_code TEXT,
      order_id TEXT,
      origin TEXT NOT NULL DEFAULT 'loja_online',
      gateway TEXT NOT NULL DEFAULT 'mercadopago',
      gateway_transaction_id TEXT,
      method TEXT NOT NULL,
      gross_amount DOUBLE PRECISION NOT NULL DEFAULT 0,
      fee_amount DOUBLE PRECISION DEFAULT 0,
      net_amount DOUBLE PRECISION NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pendente',
      raw_data JSONB NOT NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )`,
  ];

  for (const stmt of ddlStatements) {
    await pool.query(stmt);
  }
  return {
    createdOrVerified: [
      'users.password_hash',
      'auth_sessions',
      'stock_movements',
      'pdv_sales',
      'cash_register_sessions',
      'payment_transactions',
    ],
  };
}

// ==========================================
// CONTROLLED & NON-DESTRUCTIVE LOCALSTORAGE -> POSTGRESQL MIGRATION
// ==========================================
export interface MigrationEntitySummary {
  entity: string;
  tableName: string;
  localCount: number;
  postgresBeforeCount: number;
  missingInPostgresCount: number;
  migratedCount: number;
  skippedExistingCount: number;
  sampleMissingIds: string[];
  errors: string[];
}

export async function runControlledLocalStorageMigration(
  snapshot: Record<string, any>,
  dryRun = true
): Promise<{
  success: boolean;
  dryRun: boolean;
  timestamp: string;
  databaseConnected: boolean;
  entities: MigrationEntitySummary[];
  totals: {
    localRecords: number;
    missingInPostgres: number;
    migratedNow: number;
    skippedExisting: number;
  };
}> {
  const timestamp = new Date().toISOString();
  const entities: MigrationEntitySummary[] = [];

  if (!isDatabaseConfigured()) {
    // Still compute local inventory audit cleanly even when DB is offline in dev
    const specs: Array<{ key: string; tableName: string }> = [
      { key: 'products', tableName: 'products' },
      { key: 'categories', tableName: 'categories' },
      { key: 'subcategories', tableName: 'subcategories' },
      { key: 'quotes', tableName: 'quotes' },
      { key: 'orders', tableName: 'orders' },
      { key: 'users', tableName: 'users' },
      { key: 'coupons', tableName: 'discount_coupons' },
      { key: 'stockMovements', tableName: 'stock_movements' },
      { key: 'boletos', tableName: 'boletos' },
      { key: 'financialAccounts', tableName: 'financial_accounts' },
      { key: 'pdvSales', tableName: 'pdv_sales' },
      { key: 'cashSessions', tableName: 'cash_register_sessions' },
      { key: 'paymentTransactions', tableName: 'payment_transactions' },
    ];
    for (const s of specs) {
      const arr = Array.isArray(snapshot[s.key]) ? snapshot[s.key] : [];
      entities.push({
        entity: s.key,
        tableName: s.tableName,
        localCount: arr.length,
        postgresBeforeCount: 0,
        missingInPostgresCount: arr.length,
        migratedCount: 0,
        skippedExistingCount: 0,
        sampleMissingIds: arr.slice(0, 5).map((x: any) => String(x?.id || x?.code || '')),
        errors: ['PostgreSQL não conectado neste ambiente (use esta auditoria para validar os dados locais).'],
      });
    }
    return {
      success: true,
      dryRun: true,
      timestamp,
      databaseConnected: false,
      entities,
      totals: {
        localRecords: entities.reduce((acc, e) => acc + e.localCount, 0),
        missingInPostgres: entities.reduce((acc, e) => acc + e.missingInPostgresCount, 0),
        migratedNow: 0,
        skippedExisting: 0,
      },
    };
  }

  if (!dryRun) {
    await ensureAdditiveTablesInPostgres();
  }

  const processCollection = async (
    entity: string,
    tableName: string,
    localItems: any[],
    fetchExistingIds: () => Promise<Set<string>>,
    getId: (item: any) => string,
    insertMissing: (item: any) => Promise<void>
  ) => {
    const summary: MigrationEntitySummary = {
      entity,
      tableName,
      localCount: Array.isArray(localItems) ? localItems.length : 0,
      postgresBeforeCount: 0,
      missingInPostgresCount: 0,
      migratedCount: 0,
      skippedExistingCount: 0,
      sampleMissingIds: [],
      errors: [],
    };
    try {
      const existingIds = await fetchExistingIds();
      summary.postgresBeforeCount = existingIds.size;

      const missing = (Array.isArray(localItems) ? localItems : []).filter((item) => {
        const id = getId(item);
        return id && !existingIds.has(id);
      });

      summary.missingInPostgresCount = missing.length;
      summary.skippedExistingCount = Math.max(0, summary.localCount - missing.length);
      summary.sampleMissingIds = missing.slice(0, 5).map((it) => getId(it));

      if (!dryRun) {
        for (const item of missing) {
          try {
            await insertMissing(item);
            summary.migratedCount++;
          } catch (err: any) {
            summary.errors.push(`${getId(item)}: ${err?.message || 'Erro ao inserir'}`);
          }
        }
      }
    } catch (err: any) {
      summary.errors.push(err?.message || 'Falha ao consultar tabela');
    }
    entities.push(summary);
  };

  await processCollection(
    'categories',
    'categories',
    snapshot.categories,
    async () => new Set((await db.select({ id: categories.id }).from(categories)).map((r) => r.id)),
    (c) => String(c.id),
    async (cat) => {
      await db.insert(categories).values({
        id: cat.id,
        name: cat.name,
        slug: cat.slug,
        description: cat.description || '',
        image: cat.image || '',
        icon: cat.icon || '',
        orderIndex: cat.order ?? cat.orderIndex ?? 0,
        isActive: cat.isActive !== false,
      }).onConflictDoNothing();
    }
  );

  await processCollection(
    'subcategories',
    'subcategories',
    snapshot.subcategories,
    async () => new Set((await db.select({ id: subcategories.id }).from(subcategories)).map((r) => r.id)),
    (s) => String(s.id),
    async (sub) => {
      await db.insert(subcategories).values({
        id: sub.id,
        categoryId: sub.categoryId,
        name: sub.name,
        slug: sub.slug,
        description: sub.description || '',
        isActive: sub.isActive !== false,
      }).onConflictDoNothing();
    }
  );

  await processCollection(
    'products',
    'products',
    snapshot.products,
    async () => new Set((await db.select({ id: products.id }).from(products)).map((r) => r.id)),
    (p) => String(p.id),
    async (p) => {
      await db.insert(products).values({
        id: p.id,
        code: p.code || 'PRD-001',
        name: p.name,
        slug: p.slug || p.id,
        categoryId: p.categoryId || 'cat-geral',
        subcategoryId: p.subcategoryId,
        shortDescription: p.short_description || p.shortDescription || '',
        description: p.description || '',
        basePrice: Number(p.base_price ?? p.basePrice ?? 0),
        promoPrice: p.promo_price ?? p.promoPrice,
        costPrice: p.cost_price ?? p.costPrice,
        stockQty: Number(p.stock_qty ?? p.stockQty ?? 0),
        minOrderQty: Number(p.min_order_qty ?? p.minOrderQty ?? 1),
        isActive: p.is_active !== false && p.isActive !== false,
        isFeatured: Boolean(p.is_featured ?? p.isFeatured),
        images: p.images || [],
        badge: p.badge,
        showPrice: p.show_price !== false && p.showPrice !== false,
        priceTiers: p.price_tiers || p.priceTiers || [],
        variants: p.variants || [],
        details: p.details || {},
        barcode: p.barcode,
        qrCode: p.qrCode,
      }).onConflictDoNothing();
    }
  );

  await processCollection(
    'users',
    'users',
    snapshot.users,
    async () => new Set((await db.select({ uid: users.uid }).from(users)).map((r) => r.uid)),
    (u) => String(u.uid || u.id),
    async (u) => {
      await db.insert(users).values({
        uid: u.uid || u.id,
        name: u.name,
        email: u.email,
        phone: u.phone || '',
        company: u.company || '',
        cpfCnpj: u.cpfCnpj || '',
        role: u.role || 'cliente',
        address: u.address,
        customPermissions: u.customPermissions,
        isActive: u.status !== 'inativo' && u.isActive !== false,
      }).onConflictDoNothing();
    }
  );

  await processCollection(
    'quotes',
    'quotes',
    snapshot.quotes,
    async () => new Set((await db.select({ id: quotes.id }).from(quotes)).map((r) => r.id)),
    (q) => String(q.id),
    async (q) => {
      const totalEst = Number(q.totalEstimated ?? q.total ?? 0);
      await db.insert(quotes).values({
        id: q.id,
        code: q.code || q.id,
        clientId: q.clientId,
        clientName: q.clientName || 'Cliente',
        clientEmail: q.clientEmail || '',
        clientPhone: q.clientPhone || '',
        clientCompany: q.clientCompany,
        items: q.items || [],
        subtotal: Number(q.subtotal ?? totalEst),
        discount: Number(q.discount ?? 0),
        total: totalEst,
        notes: q.notes,
        status: q.status || 'pendente',
        adminNotes: q.adminNotes,
        respondedAt: q.respondedAt,
        respondedBy: q.respondedBy,
        billingTerms: q.billingTerms,
        validityDate: q.validityDate,
      }).onConflictDoNothing();
    }
  );

  await processCollection(
    'orders',
    'orders',
    snapshot.orders,
    async () => new Set((await db.select({ id: orders.id }).from(orders)).map((r) => r.id)),
    (o) => String(o.id),
    async (o) => {
      await db.insert(orders).values({
        id: o.id,
        code: o.code || o.id,
        clientId: o.clientId,
        clientName: o.clientName || 'Cliente',
        clientEmail: o.clientEmail || '',
        clientPhone: o.clientPhone || '',
        clientCompany: o.clientCompany,
        shippingAddress: o.shippingAddress,
        items: o.items || [],
        subtotal: Number(o.subtotal || 0),
        discount: Number(o.discount || 0),
        couponCode: o.couponCode,
        couponId: o.couponId,
        couponDiscount: o.couponDiscount,
        couponInfo: o.couponInfo,
        shippingCost: Number(o.shippingCost || 0),
        shippingInfo: o.shippingInfo,
        total: Number(o.total || 0),
        paymentMethod: o.paymentMethod || 'pix',
        paymentStatus: o.paymentStatus || 'pendente',
        orderStatus: o.orderStatus || 'novo',
        sourceQuoteId: o.sourceQuoteId,
        billingTerms: o.billingTerms,
        notes: o.notes,
        boletos: o.boletos,
      }).onConflictDoNothing();
    }
  );

  await processCollection(
    'coupons',
    'discount_coupons',
    snapshot.coupons,
    async () => new Set((await db.select({ id: discountCoupons.id }).from(discountCoupons)).map((r) => r.id)),
    (c) => String(c.id),
    async (cp) => {
      await db.insert(discountCoupons).values({
        id: cp.id,
        code: String(cp.code || cp.id).toUpperCase().trim(),
        campaignName: cp.campaignName || cp.code,
        discountType: cp.discountType || 'percentage',
        discountValue: Number(cp.discountValue || 0),
        startDate: cp.startDate || new Date().toISOString(),
        endDate: cp.endDate || new Date().toISOString(),
        minPurchaseAmount: cp.minPurchaseAmount,
        maxDiscountAmount: cp.maxDiscountAmount,
        maxUses: cp.maxUsageTotal ?? cp.maxUses ?? 0,
        currentUses: cp.currentUsageCount ?? cp.currentUses ?? 0,
        limitPerCustomer: cp.maxUsagePerCustomer ?? cp.limitPerCustomer ?? 1,
        applicableType: cp.targetType ?? cp.applicableType ?? 'all_store',
        status: cp.status || 'active',
      }).onConflictDoNothing();
    }
  );

  await processCollection(
    'stockMovements',
    'stock_movements',
    snapshot.stockMovements,
    async () => {
      try {
        return new Set((await db.select({ id: stockMovements.id }).from(stockMovements)).map((r) => r.id));
      } catch {
        return new Set<string>();
      }
    },
    (m) => String(m.id),
    async (m) => {
      await upsertStockMovementInDb(m);
    }
  );

  await processCollection(
    'boletos',
    'boletos',
    snapshot.boletos,
    async () => {
      try {
        return new Set((await db.select({ id: boletos.id }).from(boletos)).map((r) => r.id));
      } catch {
        return new Set<string>();
      }
    },
    (b) => String(b.id),
    async (b) => {
      await upsertBoletoInDb(b);
    }
  );

  await processCollection(
    'financialAccounts',
    'financial_accounts',
    snapshot.financialAccounts,
    async () => {
      try {
        return new Set((await db.select({ id: financialAccounts.id }).from(financialAccounts)).map((r) => r.id));
      } catch {
        return new Set<string>();
      }
    },
    (a) => String(a.id),
    async (a) => {
      await upsertFinancialAccountInDb(a);
    }
  );

  await processCollection(
    'pdvSales',
    'pdv_sales',
    snapshot.pdvSales,
    async () => {
      try {
        return new Set((await db.select({ id: pdvSales.id }).from(pdvSales)).map((r) => r.id));
      } catch {
        return new Set<string>();
      }
    },
    (s) => String(s.id),
    async (s) => {
      await upsertPdvSaleInDb(s);
    }
  );

  await processCollection(
    'cashSessions',
    'cash_register_sessions',
    snapshot.cashSessions,
    async () => {
      try {
        return new Set((await db.select({ id: cashRegisterSessions.id }).from(cashRegisterSessions)).map((r) => r.id));
      } catch {
        return new Set<string>();
      }
    },
    (cs) => String(cs.id),
    async (cs) => {
      await upsertCashSessionInDb(cs);
    }
  );

  await processCollection(
    'paymentTransactions',
    'payment_transactions',
    snapshot.paymentTransactions,
    async () => {
      try {
        return new Set((await db.select({ id: paymentTransactions.id }).from(paymentTransactions)).map((r) => r.id));
      } catch {
        return new Set<string>();
      }
    },
    (tx) => String(tx.id),
    async (tx) => {
      await upsertPaymentTransactionInDb(tx);
    }
  );

  // Settings keys (only insert missing keys — never overwrite existing production settings!)
  if (snapshot.settings && typeof snapshot.settings === 'object') {
    const settingKeys = Object.keys(snapshot.settings).filter((k) => snapshot.settings[k] !== undefined && snapshot.settings[k] !== null);
    await processCollection(
      'systemSettings',
      'system_settings',
      settingKeys.map((k) => ({ id: k, value: snapshot.settings[k] })),
      async () => new Set((await db.select({ key: systemSettings.key }).from(systemSettings)).map((r) => r.key)),
      (s) => String(s.id),
      async (s) => {
        await db.insert(systemSettings).values({
          key: s.id,
          value: s.value,
          updatedAt: new Date(),
        }).onConflictDoNothing();
      }
    );
  }

  return {
    success: true,
    dryRun,
    timestamp,
    databaseConnected: true,
    entities,
    totals: {
      localRecords: entities.reduce((acc, e) => acc + e.localCount, 0),
      missingInPostgres: entities.reduce((acc, e) => acc + e.missingInPostgresCount, 0),
      migratedNow: entities.reduce((acc, e) => acc + e.migratedCount, 0),
      skippedExisting: entities.reduce((acc, e) => acc + e.skippedExistingCount, 0),
    },
  };
}
