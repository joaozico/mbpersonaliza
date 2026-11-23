import { Router, Request, Response } from 'express';
import {
  getAnalyticsDataFromDb,
  insertAnalyticsEventInDb,
  insertAnalyticsPageviewInDb,
} from '../db/repository.ts';
import { requirePermission } from '../middleware/auth.ts';
import { handleRouterError } from './dbErrorHelper.ts';

export const analyticsRouter = Router();

// POST /api/analytics/pageview - Public storefront tracking persisted in PostgreSQL
analyticsRouter.post('/pageview', async (req: Request, res: Response) => {
  try {
    const pv = req.body || {};
    if (!pv.id || !pv.sessionId || !pv.visitorId) {
      return res.status(400).json({
        success: false,
        error: 'Dados mínimos de visualização ausentes (id, sessionId, visitorId).',
      });
    }
    await insertAnalyticsPageviewInDb(pv);
    return res.json({ success: true });
  } catch (err: any) {
    return handleRouterError(res, err, 'Erro ao registrar visualização no PostgreSQL.');
  }
});

// POST /api/analytics/event - Public storefront event tracking persisted in PostgreSQL
analyticsRouter.post('/event', async (req: Request, res: Response) => {
  try {
    const ev = req.body || {};
    if (!ev.id || !ev.sessionId || !ev.visitorId || !ev.eventName) {
      return res.status(400).json({
        success: false,
        error: 'Dados mínimos de evento ausentes (id, sessionId, visitorId, eventName).',
      });
    }
    await insertAnalyticsEventInDb(ev);
    return res.json({ success: true });
  } catch (err: any) {
    return handleRouterError(res, err, 'Erro ao registrar evento no PostgreSQL.');
  }
});

// GET /api/analytics/data - Protected metrics dashboard hydration from PostgreSQL
analyticsRouter.get(
  '/data',
  requirePermission('canViewSiteMetrics'),
  async (_req: Request, res: Response) => {
    try {
      const data = await getAnalyticsDataFromDb();
      return res.json({
        success: true,
        ...data,
      });
    } catch (err: any) {
      return handleRouterError(res, err, 'Erro ao consultar métricas no PostgreSQL.');
    }
  }
);
