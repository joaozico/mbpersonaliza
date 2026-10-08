import { Router, Request, Response, NextFunction } from 'express';

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

// GET /api/system/maintenance - Obter status do modo de manutenção
systemRouter.get('/maintenance', (req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.json({
    success: true,
    maintenance: currentMaintenanceState,
    serverTime: new Date().toISOString(),
  });
});

// POST /api/system/maintenance - Atualizar status do modo de manutenção (somente Admin)
systemRouter.post('/maintenance', (req: Request, res: Response) => {
  const adminRole = req.headers['x-admin-role'] as string;
  
  // Permite se header admin/gerente estiver presente ou se requisição vier do próprio servidor local
  const isAuthorized =
    adminRole === 'admin' ||
    adminRole === 'gerente' ||
    req.ip === '127.0.0.1' ||
    req.ip === '::1';

  if (!isAuthorized) {
    return res.status(403).json({
      success: false,
      error: 'Acesso negado. Apenas administradores podem alterar o modo de manutenção.',
    });
  }

  const payload = req.body;
  if (typeof payload === 'object' && payload !== null) {
    currentMaintenanceState = {
      ...currentMaintenanceState,
      ...payload,
      enabled: Boolean(payload.enabled),
      updatedAt: new Date().toISOString(),
    };
  }

  console.log(
    `[SERVER MAINTENANCE] Modo de manutenção ${
      currentMaintenanceState.enabled ? 'ATIVADO' : 'DESATIVADO'
    } às ${currentMaintenanceState.updatedAt}`
  );

  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.json({
    success: true,
    maintenance: currentMaintenanceState,
    message: currentMaintenanceState.enabled
      ? 'Modo de manutenção ativado com sucesso no servidor.'
      : 'Modo de manutenção desativado com sucesso no servidor.',
  });
});

/**
 * Middleware para proteger APIs quando o Modo de Manutenção estiver ativo
 * Retorna status HTTP 503 (Service Unavailable) para requisições de clientes comuns.
 */
export function maintenanceApiMiddleware(req: Request, res: Response, next: NextFunction) {
  // Se a manutenção não estiver ativa, prossegue normalmente
  if (!currentMaintenanceState.enabled) {
    return next();
  }

  // Rotas isentas que devem sempre responder mesmo em manutenção
  const isExemptRoute =
    req.path.startsWith('/api/system/maintenance') ||
    req.path.startsWith('/api/health') ||
    req.path.startsWith('/api/auth');

  if (isExemptRoute) {
    return next();
  }

  // Verifica se o solicitante possui credencial de administrador
  const adminRole = req.headers['x-admin-role'] as string;
  const isAuthorizedAdmin = adminRole === 'admin' || adminRole === 'gerente';

  if (isAuthorizedAdmin) {
    return next();
  }

  // Se for uma chamada de API pública enquanto o sistema estiver em manutenção:
  if (req.path.startsWith('/api/')) {
    res.setHeader('Retry-After', '300'); // 5 minutos
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
