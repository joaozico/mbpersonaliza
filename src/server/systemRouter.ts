import { Router, Request, Response, NextFunction } from 'express';
import {
  getAllSystemSettingsFromDb,
  getPriceVisibilityFromDb,
  getSystemSettingsFromDb,
  savePriceVisibilityToDb,
  saveSystemSettingsToDb,
} from '../db/repository.ts';
import {
  hasServerPermission,
  isStaffRole,
  requirePermission,
} from '../middleware/auth.ts';
import { normalizePriceVisibilityMode } from './authUtils.ts';
import { handleRouterError, isDbUnavailableError } from './dbErrorHelper.ts';

export interface ServerMaintenanceState {
  enabled: boolean;
  title: string;
  headline: string;
  message: string;
  returnAt?: string;
  showCompanyLogo?: boolean;
  showContacts?: boolean;
  themeStyle?: 'brand_gradient' | 'modern_dark' | 'clean_light';
  iconType?: 'tools' | 'cog' | 'server' | 'sparkles' | 'rocket';
  updatedAt: string;
  updatedBy?: {
    id: string;
    name: string;
    email: string;
    role?: string;
  };
}

const DEFAULT_MAINTENANCE_STATE: ServerMaintenanceState = {
  enabled: false,
  title: 'Sistema em Manutenção',
  headline: 'Estamos realizando melhorias no sistema.',
  message:
    'Nosso sistema está temporariamente indisponível para manutenção e atualização. Em breve estaremos de volta.',
  returnAt: '',
  showCompanyLogo: true,
  showContacts: true,
  themeStyle: 'brand_gradient',
  iconType: 'tools',
  updatedAt: new Date().toISOString(),
};

function sanitizeCompanyForPublic(company: any) {
  if (!company || typeof company !== 'object') return company;
  const { pixKey: _pk, bankInfo: _bi, ...safe } = company;
  return safe;
}

export const systemRouter = Router();

// GET /api/system/maintenance - Persisted in PostgreSQL system_settings('maintenance')
systemRouter.get('/maintenance', async (_req: Request, res: Response) => {
  try {
    const saved = await getSystemSettingsFromDb<Partial<ServerMaintenanceState>>('maintenance');
    const maintenance: ServerMaintenanceState = {
      ...DEFAULT_MAINTENANCE_STATE,
      ...(saved || {}),
      enabled: Boolean(saved?.enabled),
    };
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    return res.json({
      success: true,
      maintenance,
      serverTime: new Date().toISOString(),
    });
  } catch (err: any) {
    return handleRouterError(res, err, 'Erro ao consultar estado de manutenção no PostgreSQL.');
  }
});

// POST /api/system/maintenance - Server-verified permission only, persisted in PostgreSQL
systemRouter.post(
  '/maintenance',
  requirePermission('canManageMaintenanceMode'),
  async (req: Request, res: Response) => {
    try {
      const payload = req.body || {};
      const actor = req.authUser!;
      const existing = await getSystemSettingsFromDb<Partial<ServerMaintenanceState>>('maintenance');

      const nextState: ServerMaintenanceState = {
        ...DEFAULT_MAINTENANCE_STATE,
        ...(existing || {}),
        ...(typeof payload === 'object' && payload !== null ? payload : {}),
        enabled: Boolean(payload.enabled),
        updatedAt: new Date().toISOString(),
        updatedBy: {
          id: actor.id,
          name: actor.name,
          email: actor.email,
          role: actor.role,
        },
      };

      await saveSystemSettingsToDb('maintenance', nextState);

      console.log(
        `[SERVER MAINTENANCE] Modo de manutenção ${
          nextState.enabled ? 'ATIVADO' : 'DESATIVADO'
        } por ${actor.email} às ${nextState.updatedAt}`
      );

      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      return res.json({
        success: true,
        maintenance: nextState,
        message: nextState.enabled
          ? 'Modo de manutenção ativado com sucesso no servidor.'
          : 'Modo de manutenção desativado com sucesso no servidor.',
      });
    } catch (err: any) {
      return handleRouterError(res, err, 'Erro ao salvar modo de manutenção no PostgreSQL.');
    }
  }
);

// GET /api/system/settings - Public storefront safe settings summary from PostgreSQL
systemRouter.get('/settings', async (_req: Request, res: Response) => {
  try {
    const allSettings = await getAllSystemSettingsFromDb();
    const priceVisibility = normalizePriceVisibilityMode(allSettings.price_visibility);
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    return res.json({
      success: true,
      settings: {
        company: sanitizeCompanyForPublic(allSettings.company),
        layout: allSettings.layout || null,
        delivery: allSettings.delivery || null,
        maintenance: {
          ...DEFAULT_MAINTENANCE_STATE,
          ...(allSettings.maintenance || {}),
          enabled: Boolean(allSettings.maintenance?.enabled),
        },
        priceVisibility,
      },
    });
  } catch (err: any) {
    return handleRouterError(res, err, 'Erro ao consultar configurações públicas no PostgreSQL.');
  }
});

// GET /api/system/price-visibility - Current product price visibility mode
systemRouter.get('/price-visibility', async (_req: Request, res: Response) => {
  try {
    const mode = await getPriceVisibilityFromDb();
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    return res.json({
      success: true,
      mode,
      priceVisibility: mode,
    });
  } catch (err: any) {
    return handleRouterError(res, err, 'Erro ao consultar visibilidade dos preços.');
  }
});

// PUT & POST /api/system/price-visibility - Restricted to authorized admin/company settings manager
const handleSavePriceVisibility = async (req: Request, res: Response) => {
  try {
    const rawMode = req.body?.mode ?? req.body?.priceVisibility;
    if (rawMode !== 'registered_only' && rawMode !== 'all') {
      return res.status(400).json({
        success: false,
        error: "Modo inválido. Utilize 'registered_only' ou 'all'.",
      });
    }

    const mode = normalizePriceVisibilityMode(rawMode);
    const actor = req.authUser!;
    const saved = await savePriceVisibilityToDb(mode, actor.email || actor.name || 'Sistema');

    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    return res.json({
      success: true,
      mode: saved.mode,
      priceVisibility: saved.mode,
      updatedAt: saved.updatedAt,
      message:
        saved.mode === 'registered_only'
          ? 'Configuração salva: preços visíveis somente para clientes cadastrados.'
          : 'Configuração salva: preços visíveis para todos os visitantes.',
    });
  } catch (err: any) {
    return handleRouterError(res, err, 'Erro ao salvar visibilidade dos preços.');
  }
};

systemRouter.put(
  '/price-visibility',
  requirePermission('canManageCompanySettings'),
  handleSavePriceVisibility
);
systemRouter.post(
  '/price-visibility',
  requirePermission('canManageCompanySettings'),
  handleSavePriceVisibility
);

/**
 * Middleware para proteger APIs quando o Modo de Manutenção estiver ativo
 * Lê exclusivamente do PostgreSQL e usa a sessão autenticada no servidor (req.authUser).
 */
export async function maintenanceApiMiddleware(req: Request, res: Response, next: NextFunction) {
  if (!req.path.startsWith('/api/')) {
    return next();
  }

  const isExemptRoute =
    req.path.startsWith('/api/system/') ||
    req.path.startsWith('/api/health') ||
    req.path.startsWith('/api/auth') ||
    req.path.startsWith('/api/db/status') ||
    req.path.startsWith('/api/db/vps-preflight');

  if (isExemptRoute) {
    return next();
  }

  const isAuthorizedAdmin =
    req.authUser &&
    (req.authUser.role === 'admin' ||
      req.authUser.role === 'gerente' ||
      hasServerPermission(req, 'canManageMaintenanceMode') ||
      isStaffRole(req.authUser.role));

  if (isAuthorizedAdmin) {
    return next();
  }

  try {
    const maint = await getSystemSettingsFromDb<Partial<ServerMaintenanceState>>('maintenance');
    if (!maint || !maint.enabled) {
      return next();
    }

    res.setHeader('Retry-After', '300');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    return res.status(503).json({
      error: 'Sistema temporariamente em manutenção para atualizações.',
      maintenance: true,
      title: maint.title || DEFAULT_MAINTENANCE_STATE.title,
      headline: maint.headline || DEFAULT_MAINTENANCE_STATE.headline,
      message: maint.message || DEFAULT_MAINTENANCE_STATE.message,
      returnAt: maint.returnAt || '',
      serverTime: new Date().toISOString(),
    });
  } catch (err) {
    if (isDbUnavailableError(err)) {
      return next();
    }
    return next();
  }
}
