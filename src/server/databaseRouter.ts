import { Router, Request, Response } from 'express';
import {
  seedInitialDataIfEmpty,
  getProductsFromDb,
  upsertProductInDb,
  deleteProductFromDb,
  getCategoriesFromDb,
  getSubcategoriesFromDb,
  upsertCategoryInDb,
  getOrdersFromDb,
  upsertOrderInDb,
  getQuotesFromDb,
  upsertQuoteInDb,
  getUsersFromDb,
  upsertUserInDb,
  getCouponsFromDb,
  upsertCouponInDb,
  getSystemSettingsFromDb,
  saveSystemSettingsToDb,
  getBackupsFromDb,
  recordBackupInDb,
} from '../db/repository.ts';

export const databaseRouter = Router();

// GET /api/db/status - Confirms database connectivity, engine, and counts
databaseRouter.get('/status', async (req: Request, res: Response) => {
  try {
    await seedInitialDataIfEmpty();
    const products = (await getProductsFromDb()) || [];
    const categories = (await getCategoriesFromDb()) || [];
    const orders = (await getOrdersFromDb()) || [];
    const quotes = (await getQuotesFromDb()) || [];
    const users = (await getUsersFromDb()) || [];

    res.json({
      success: true,
      database: 'PostgreSQL (Cloud SQL)',
      connected: true,
      host: process.env.SQL_HOST ? 'Unix Socket / Cloud SQL Auth Proxy' : 'configured',
      databaseName: process.env.SQL_DB_NAME,
      counts: {
        products: products.length,
        categories: categories.length,
        orders: orders.length,
        quotes: quotes.length,
        users: users.length,
      },
    });
  } catch (error: any) {
    console.error('Failed to get database status:', error);
    res.status(500).json({ success: false, error: error.message || 'Database connection error' });
  }
});

// GET /api/db/init - Initialize database and get all startup tables
databaseRouter.get('/init', async (req: Request, res: Response) => {
  try {
    await seedInitialDataIfEmpty();
    const products = (await getProductsFromDb()) || [];
    const categories = (await getCategoriesFromDb()) || [];
    const subcategories = (await getSubcategoriesFromDb()) || [];
    const quotes = (await getQuotesFromDb()) || [];
    const orders = (await getOrdersFromDb()) || [];
    const users = (await getUsersFromDb()) || [];
    const coupons = (await getCouponsFromDb()) || [];

    const companySettings = await getSystemSettingsFromDb('company');
    const deliverySettings = await getSystemSettingsFromDb('delivery');
    const boletoSettings = await getSystemSettingsFromDb('boleto');
    const layoutSettings = await getSystemSettingsFromDb('layout');
    const maintenanceSettings = await getSystemSettingsFromDb('maintenance');

    res.json({
      success: true,
      data: {
        products,
        categories,
        subcategories,
        quotes,
        orders,
        users,
        coupons,
        settings: {
          company: companySettings,
          delivery: deliverySettings,
          boleto: boletoSettings,
          layout: layoutSettings,
          maintenance: maintenanceSettings,
        },
      },
    });
  } catch (error: any) {
    console.error('Failed to initialize database sync:', error);
    // Graceful fallback to avoid crashing client frontend
    res.json({
      success: false,
      fallbackToLocal: true,
      error: error?.message || 'Database temporarily unavailable',
    });
  }
});

// Products
databaseRouter.get('/products', async (req: Request, res: Response) => {
  try {
    const data = await getProductsFromDb();
    res.json({ success: true, products: data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

databaseRouter.post('/products', async (req: Request, res: Response) => {
  try {
    const saved = await upsertProductInDb(req.body);
    res.json({ success: true, product: saved });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

databaseRouter.delete('/products/:id', async (req: Request, res: Response) => {
  try {
    await deleteProductFromDb(req.params.id);
    res.json({ success: true, message: 'Produto excluído do PostgreSQL' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Categories
databaseRouter.get('/categories', async (req: Request, res: Response) => {
  try {
    const data = await getCategoriesFromDb();
    res.json({ success: true, categories: data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

databaseRouter.post('/categories', async (req: Request, res: Response) => {
  try {
    const saved = await upsertCategoryInDb(req.body);
    res.json({ success: true, category: saved });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Orders
databaseRouter.get('/orders', async (req: Request, res: Response) => {
  try {
    const data = await getOrdersFromDb();
    res.json({ success: true, orders: data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

databaseRouter.post('/orders', async (req: Request, res: Response) => {
  try {
    const saved = await upsertOrderInDb(req.body);
    res.json({ success: true, order: saved });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Quotes
databaseRouter.get('/quotes', async (req: Request, res: Response) => {
  try {
    const data = await getQuotesFromDb();
    res.json({ success: true, quotes: data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

databaseRouter.post('/quotes', async (req: Request, res: Response) => {
  try {
    const saved = await upsertQuoteInDb(req.body);
    res.json({ success: true, quote: saved });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Users
databaseRouter.get('/users', async (req: Request, res: Response) => {
  try {
    const data = await getUsersFromDb();
    res.json({ success: true, users: data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

databaseRouter.post('/users', async (req: Request, res: Response) => {
  try {
    const saved = await upsertUserInDb(req.body);
    res.json({ success: true, user: saved });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Coupons
databaseRouter.get('/coupons', async (req: Request, res: Response) => {
  try {
    const data = await getCouponsFromDb();
    res.json({ success: true, coupons: data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

databaseRouter.post('/coupons', async (req: Request, res: Response) => {
  try {
    const saved = await upsertCouponInDb(req.body);
    res.json({ success: true, coupon: saved });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Settings
databaseRouter.get('/settings/:key', async (req: Request, res: Response) => {
  try {
    const value = await getSystemSettingsFromDb(req.params.key);
    res.json({ success: true, key: req.params.key, value });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

databaseRouter.post('/settings/:key', async (req: Request, res: Response) => {
  try {
    await saveSystemSettingsToDb(req.params.key, req.body.value);
    res.json({ success: true, key: req.params.key, message: 'Configurações salvas no PostgreSQL' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Backups in PostgreSQL
databaseRouter.get('/backups', async (req: Request, res: Response) => {
  try {
    const data = await getBackupsFromDb();
    res.json({ success: true, backups: data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

databaseRouter.post('/backups', async (req: Request, res: Response) => {
  try {
    const saved = await recordBackupInDb(req.body);
    res.json({ success: true, backup: saved });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});
