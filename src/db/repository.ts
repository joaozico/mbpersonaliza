import { db } from './index.ts';
import {
  users,
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
} from './schema.ts';
import { eq, desc } from 'drizzle-orm';
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
} from '../data/initialData.ts';

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
  try {
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
          address: u.address,
          customPermissions: u.customPermissions,
          isActive: (u as any).isActive !== false,
        }).onConflictDoNothing();
      }

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

      console.log('[PostgreSQL] Initial seed completed successfully.');
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
  return withDbRetry('getProductsFromDb', () => db.select().from(products));
}

export async function upsertProductInDb(item: any) {
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
  return withDbRetry('deleteProductFromDb', () =>
    db.delete(products).where(eq(products.id, id)).returning()
  );
}

// ==========================================
// CATEGORIES & SUBCATEGORIES
// ==========================================
export async function getCategoriesFromDb() {
  return withDbRetry('getCategoriesFromDb', () => db.select().from(categories));
}

export async function getSubcategoriesFromDb() {
  return withDbRetry('getSubcategoriesFromDb', () => db.select().from(subcategories));
}

export async function upsertCategoryInDb(cat: any) {
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
  return withDbRetry('getOrdersFromDb', () =>
    db.select().from(orders).orderBy(desc(orders.createdAt))
  );
}

export async function upsertOrderInDb(order: any) {
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
  return withDbRetry('getQuotesFromDb', () =>
    db.select().from(quotes).orderBy(desc(quotes.createdAt))
  );
}

export async function upsertQuoteInDb(q: any) {
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
// USERS
// ==========================================
export async function getUsersFromDb() {
  return withDbRetry('getUsersFromDb', () => db.select().from(users));
}

export async function upsertUserInDb(u: any) {
  return withDbRetry('upsertUserInDb', () =>
    db.insert(users).values({
      uid: u.uid || u.id,
      name: u.name,
      email: u.email,
      phone: u.phone || '',
      company: u.company || '',
      cpfCnpj: u.cpfCnpj || '',
      role: u.role || 'cliente',
      address: u.address,
      customPermissions: u.customPermissions,
      isActive: u.isActive !== false,
    }).onConflictDoUpdate({
      target: users.uid,
      set: {
        name: u.name,
        email: u.email,
        phone: u.phone || '',
        company: u.company || '',
        cpfCnpj: u.cpfCnpj || '',
        role: u.role || 'cliente',
        address: u.address,
        customPermissions: u.customPermissions,
        isActive: u.isActive !== false,
        updatedAt: new Date(),
      },
    }).returning()
  );
}

// ==========================================
// DISCOUNT COUPONS
// ==========================================
export async function getCouponsFromDb() {
  return withDbRetry('getCouponsFromDb', () => db.select().from(discountCoupons));
}

export async function upsertCouponInDb(c: any) {
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
// SYSTEM SETTINGS
// ==========================================
export async function getSystemSettingsFromDb(key: string) {
  return withDbRetry('getSystemSettingsFromDb', async () => {
    const res = await db.select().from(systemSettings).where(eq(systemSettings.key, key));
    return res[0]?.value || null;
  });
}

export async function saveSystemSettingsToDb(key: string, value: any) {
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

// ==========================================
// BACKUPS RECORDING IN POSTGRESQL
// ==========================================
export async function getBackupsFromDb() {
  return withDbRetry('getBackupsFromDb', () =>
    db.select().from(backups).orderBy(desc(backups.createdAt))
  );
}

export async function recordBackupInDb(entry: any) {
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
