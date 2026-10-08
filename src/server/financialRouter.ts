import { Router, Request, Response, NextFunction } from 'express';
import { RolePermissions, UserProfile, UserRole } from '../types';

export const financialRouter = Router();

// In-memory server-side audit log cache for security events and direct API operations
interface ServerSecurityAudit {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  userEmail: string;
  userRole: string;
  operation: string;
  permissionUsed?: string;
  result: 'sucesso' | 'bloqueado' | 'erro';
  details: string;
  ip: string;
  origin: string;
  affectedRecordId?: string;
}

const serverAuditLogs: ServerSecurityAudit[] = [];

/**
 * Middleware de Autenticação e Autorização para o Módulo Financeiro
 * Valida:
 * 1. Usuário autenticado (via headers x-user-id, x-user-role, x-user-email, x-user-status)
 * 2. Usuário ativo (status === 'ativo')
 * 3. Identidade do usuário
 * 4. Perfil/nível de acesso (admin possui bypass total)
 * 5. Permissão necessária passada como parâmetro
 */
export function requireFinancialPermission(requiredPermission: keyof RolePermissions) {
  return (req: Request, res: Response, next: NextFunction) => {
    const userId = (req.headers['x-user-id'] as string) || '';
    const userRole = (req.headers['x-user-role'] as string) || '';
    const userName = (req.headers['x-user-name'] as string) || 'Usuário Desconhecido';
    const userEmail = (req.headers['x-user-email'] as string) || '';
    const userStatus = (req.headers['x-user-status'] as string) || 'ativo';
    const customPermissionsHeader = (req.headers['x-user-permissions'] as string) || '{}';

    const clientIp = (req.headers['x-forwarded-for'] as string) || req.ip || '127.0.0.1';

    // 1. Validar autenticação
    if (!userId || !userRole) {
      const auditEntry: ServerSecurityAudit = {
        id: `sec-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        timestamp: new Date().toISOString(),
        userId: 'anonimo',
        userName: 'Não autenticado',
        userEmail: 'anonimo',
        userRole: 'visitante',
        operation: `API_${req.method}_${req.path}`,
        permissionUsed: String(requiredPermission),
        result: 'bloqueado',
        details: 'Tentativa de requisição não autenticada à API financeira.',
        ip: clientIp,
        origin: 'api',
      };
      serverAuditLogs.unshift(auditEntry);

      return res.status(401).json({
        success: false,
        error: 'Acesso negado. Usuário não autenticado.',
        code: 'UNAUTHENTICATED',
      });
    }

    // 2. Validar usuário ativo
    if (userStatus === 'inativo') {
      const auditEntry: ServerSecurityAudit = {
        id: `sec-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        timestamp: new Date().toISOString(),
        userId,
        userName,
        userEmail,
        userRole,
        operation: `API_${req.method}_${req.path}`,
        permissionUsed: String(requiredPermission),
        result: 'bloqueado',
        details: `Usuário com cadastro inativo tentou executar ${req.method} ${req.path}.`,
        ip: clientIp,
        origin: 'api',
      };
      serverAuditLogs.unshift(auditEntry);

      return res.status(403).json({
        success: false,
        error: 'Acesso negado. Cadastro de colaborador inativo no sistema.',
        code: 'USER_INACTIVE',
      });
    }

    // 3. Administrador possui acesso total
    if (userRole === 'admin') {
      return next();
    }

    // 4. Validar permissão específica
    let userPermissions: Partial<RolePermissions> = {};
    try {
      userPermissions = JSON.parse(customPermissionsHeader);
    } catch {
      userPermissions = {};
    }

    const hasPermission = Boolean(userPermissions[requiredPermission]);

    if (!hasPermission) {
      const auditEntry: ServerSecurityAudit = {
        id: `sec-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        timestamp: new Date().toISOString(),
        userId,
        userName,
        userEmail,
        userRole,
        operation: `API_${req.method}_${req.path}`,
        permissionUsed: String(requiredPermission),
        result: 'bloqueado',
        details: `Acesso negado: Usuário '${userName}' (${userRole}) não possui a permissão '${String(
          requiredPermission
        )}' para acessar ${req.method} ${req.path}.`,
        ip: clientIp,
        origin: 'api',
      };
      serverAuditLogs.unshift(auditEntry);

      return res.status(403).json({
        success: false,
        error:
          'Acesso negado. Você não possui permissão para acessar esta funcionalidade financeira. Entre em contato com o administrador do sistema.',
        code: 'FORBIDDEN',
        requiredPermission,
      });
    }

    // Autorizado
    next();
  };
}

// ----------------------------------------------------------------------------
// ROTAS DA API FINANCEIRA COM AUTORIZAÇÃO OBRIGATÓRIA POR OPERAÇÃO
// ----------------------------------------------------------------------------

// 1. Status e Verificação de Acesso Geral ao Módulo Financeiro
financialRouter.get(
  '/access-check',
  requireFinancialPermission('canViewFinancialModule'),
  (req: Request, res: Response) => {
    res.json({
      success: true,
      allowed: true,
      message: 'Acesso concedido ao módulo Financeiro.',
    });
  }
);

// 2. Dashboard Financeiro
financialRouter.get(
  '/dashboard',
  requireFinancialPermission('canViewFinancialDashboard'),
  (req: Request, res: Response) => {
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      authorized: true,
    });
  }
);

// 3. Contas a Receber (Visualização)
financialRouter.get(
  '/receivables',
  requireFinancialPermission('canViewReceivables'),
  (req: Request, res: Response) => {
    res.json({
      success: true,
      authorized: true,
    });
  }
);

// 4. Criar Conta a Receber
financialRouter.post(
  '/receivables',
  requireFinancialPermission('canCreateReceivable'),
  (req: Request, res: Response) => {
    res.status(201).json({
      success: true,
      message: 'Conta a receber criada com sucesso.',
    });
  }
);

// 5. Baixar Conta a Receber (Liquidação)
financialRouter.post(
  '/receivables/:id/settle',
  requireFinancialPermission('canReceivePayment'),
  (req: Request, res: Response) => {
    res.json({
      success: true,
      message: 'Baixa de recebimento processada com sucesso.',
    });
  }
);

// 6. Cancelar Conta a Receber
financialRouter.post(
  '/receivables/:id/cancel',
  requireFinancialPermission('canCancelReceivable'),
  (req: Request, res: Response) => {
    const { reason } = req.body;
    if (!reason || !String(reason).trim()) {
      return res.status(400).json({
        success: false,
        error: 'Motivo do cancelamento é obrigatório.',
      });
    }
    res.json({
      success: true,
      message: 'Conta a receber cancelada com sucesso.',
    });
  }
);

// 7. Estornar Recebimento
financialRouter.post(
  '/receivables/:id/refund',
  requireFinancialPermission('canRefundReceivable'),
  (req: Request, res: Response) => {
    const { reason } = req.body;
    if (!reason || !String(reason).trim()) {
      return res.status(400).json({
        success: false,
        error: 'Motivo do estorno é obrigatório.',
      });
    }
    res.json({
      success: true,
      message: 'Estorno de recebimento concluído com sucesso.',
    });
  }
);

// 8. Contas a Pagar (Visualização)
financialRouter.get(
  '/payables',
  requireFinancialPermission('canViewPayables'),
  (req: Request, res: Response) => {
    res.json({
      success: true,
      authorized: true,
    });
  }
);

// 9. Criar Conta a Pagar
financialRouter.post(
  '/payables',
  requireFinancialPermission('canCreatePayable'),
  (req: Request, res: Response) => {
    res.status(201).json({
      success: true,
      message: 'Conta a pagar criada com sucesso.',
    });
  }
);

// 10. Baixar Conta a Pagar (Pagamento)
financialRouter.post(
  '/payables/:id/settle',
  requireFinancialPermission('canPayBill'),
  (req: Request, res: Response) => {
    res.json({
      success: true,
      message: 'Pagamento de conta registrado com sucesso.',
    });
  }
);

// 11. Cancelar Conta a Pagar
financialRouter.post(
  '/payables/:id/cancel',
  requireFinancialPermission('canCancelPayable'),
  (req: Request, res: Response) => {
    const { reason } = req.body;
    if (!reason || !String(reason).trim()) {
      return res.status(400).json({
        success: false,
        error: 'Motivo do cancelamento é obrigatório.',
      });
    }
    res.json({
      success: true,
      message: 'Conta a pagar cancelada com sucesso.',
    });
  }
);

// 12. Estornar Pagamento
financialRouter.post(
  '/payables/:id/refund',
  requireFinancialPermission('canRefundPayable'),
  (req: Request, res: Response) => {
    const { reason } = req.body;
    if (!reason || !String(reason).trim()) {
      return res.status(400).json({
        success: false,
        error: 'Motivo do estorno é obrigatório.',
      });
    }
    res.json({
      success: true,
      message: 'Estorno de pagamento concluído com sucesso.',
    });
  }
);

// 13. Fluxo de Caixa
financialRouter.get(
  '/cash-flow',
  requireFinancialPermission('canViewCashFlow'),
  (req: Request, res: Response) => {
    res.json({
      success: true,
      authorized: true,
    });
  }
);

// 14. Relatórios Financeiros
financialRouter.get(
  '/reports',
  requireFinancialPermission('canViewFinancialReports'),
  (req: Request, res: Response) => {
    res.json({
      success: true,
      authorized: true,
    });
  }
);

// 15. Exportação de Relatórios Financeiros
financialRouter.post(
  '/reports/export',
  requireFinancialPermission('canExportFinancialReports'),
  (req: Request, res: Response) => {
    res.json({
      success: true,
      message: 'Exportação autorizada.',
    });
  }
);

// 16. Cadastros: Categorias
financialRouter.get(
  '/categories',
  requireFinancialPermission('canViewFinancialModule'),
  (req: Request, res: Response) => {
    res.json({ success: true });
  }
);

financialRouter.post(
  '/categories',
  requireFinancialPermission('canManageFinancialCategories'),
  (req: Request, res: Response) => {
    res.json({ success: true, message: 'Categoria financeira salva.' });
  }
);

financialRouter.delete(
  '/categories/:id',
  requireFinancialPermission('canManageFinancialCategories'),
  (req: Request, res: Response) => {
    res.json({ success: true, message: 'Categoria financeira excluída.' });
  }
);

// 17. Cadastros: Centros de Custo
financialRouter.post(
  '/cost-centers',
  requireFinancialPermission('canManageCostCenters'),
  (req: Request, res: Response) => {
    res.json({ success: true, message: 'Centro de custo salvo.' });
  }
);

financialRouter.delete(
  '/cost-centers/:id',
  requireFinancialPermission('canManageCostCenters'),
  (req: Request, res: Response) => {
    res.json({ success: true, message: 'Centro de custo excluído.' });
  }
);

// 18. Cadastros: Contas Bancárias
financialRouter.post(
  '/bank-accounts',
  requireFinancialPermission('canManageBankAccounts'),
  (req: Request, res: Response) => {
    res.json({ success: true, message: 'Conta bancária salva.' });
  }
);

financialRouter.delete(
  '/bank-accounts/:id',
  requireFinancialPermission('canManageBankAccounts'),
  (req: Request, res: Response) => {
    res.json({ success: true, message: 'Conta bancária excluída.' });
  }
);

// Formas de Pagamento
financialRouter.post(
  '/payment-methods',
  requireFinancialPermission('canManagePaymentMethods'),
  (req: Request, res: Response) => {
    res.json({ success: true, message: 'Forma de pagamento salva.' });
  }
);

financialRouter.delete(
  '/payment-methods/:id',
  requireFinancialPermission('canManagePaymentMethods'),
  (req: Request, res: Response) => {
    res.json({ success: true, message: 'Forma de pagamento excluída.' });
  }
);

// 19. Configurações Financeiras
financialRouter.post(
  '/settings',
  requireFinancialPermission('canManageFinancialSettings'),
  (req: Request, res: Response) => {
    res.json({ success: true, message: 'Configurações financeiras atualizadas.' });
  }
);

// 20. Auditoria Financeira
financialRouter.get(
  '/audit',
  requireFinancialPermission('canViewFinancialAudit'),
  (req: Request, res: Response) => {
    res.json({
      success: true,
      serverAuditLogs,
    });
  }
);
