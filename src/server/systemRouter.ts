import { Router, Request, Response, NextFunction } from 'express';
import {
  getPriceVisibilityFromDb,
  savePriceVisibilityToDb,
} from '../db/repository.ts';
import {
  hasServerPermission,
  isStaffRole,
  requirePermission,
} from '../middleware/auth.ts';
import { normalizePriceVisibilityMode } from './authUtils.ts';

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

let currentMaintenanceState: ServerMaintenanceState = {
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

export const systemRouter = Router();

// GET /api/system/maintenance - Public read of maintenance banner state
systemRouter.get('/maintenance', (_req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.json({
    success: true,
    maintenance: currentMaintenanceState,
    serverTime: new Date().toISOString(),
  });
});

// POST /api/system/maintenance - Server-verified permission only (no header/IP bypass)
systemRouter.post(
  '/maintenance',
  requirePermission('canManageMaintenanceMode'),
  (req: Request, res: Response) => {
    const payload = req.body;
    if (typeof payload === 'object' && payload !== null) {
      const actor = req.authUser!;
      currentMaintenanceState = {
        ...currentMaintenanceState,
        ...payload,
        enabled: Boolean(payload.enabled),
        updatedAt: new Date().toISOString(),
        updatedBy: {
          id: actor.id,
          name: actor.name,
          email: actor.email,
          role: actor.role,
        },
      };
    }

    console.log(
      `[SERVER MAINTENANCE] Modo de manutenção ${
        currentMaintenanceState.enabled ? 'ATIVADO' : 'DESATIVADO'
      } por ${req.authUser?.email} às ${currentMaintenanceState.updatedAt}`
    );

    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.json({
      success: true,
      maintenance: currentMaintenanceState,
      message: currentMaintenanceState.enabled
        ? 'Modo de manutenção ativado com sucesso no servidor.'
        : 'Modo de manutenção desativado com sucesso no servidor.',
    });
  }
);

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
    return res.status(500).json({
      success: false,
      error: err?.message || 'Erro ao consultar visibilidade dos preços.',
    });
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
    const saved = await savePriceVisibilityToDb(mode, {
      id: actor.id,
      name: actor.name,
      email: actor.email,
    });

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
    return res.status(500).json({
      success: false,
      error: err?.message || 'Erro ao salvar visibilidade dos preços.',
    });
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
 * Usa exclusivamente a sessão autenticada no servidor (req.authUser).
 */
export function maintenanceApiMiddleware(req: Request, res: Response, next: NextFunction) {
  if (!currentMaintenanceState.enabled) {
    return next();
  }

  const isExemptRoute =
    req.path.startsWith('/api/system/maintenance') ||
    req.path.startsWith('/api/system/price-visibility') ||
    req.path.startsWith('/api/health') ||
    req.path.startsWith('/api/auth');

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

  if (req.path.startsWith('/api/')) {
    res.setHeader('Retry-After', '300');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    return res.status(503).json({
      error: 'Sistema temporariamente em manutenção para atualizações.',
      maintenance: true,
      title: currentMaintenanceState.title,
      headline: currentMaintenanceState.headline,
      message: currentMaintenanceState.message,
      returnAt: currentMaintenanceState.returnAt,
      serverTime: new Date().toISOString(),
    });
  }

  next();
}
