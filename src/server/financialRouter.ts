import { Router, Request, Response, NextFunction } from 'express';
import { PermissionKey, RolePermissions } from '../types.ts';
import { hasServerPermission } from '../middleware/auth.ts';
import {
  cancelFinancialAccountAtomicInDb,
  deleteBankAccountFromDb,
  deleteCostCenterFromDb,
  deleteFinancialCategoryFromDb,
  deleteFinancialPaymentMethodFromDb,
  getBankAccountsFromDb,
  getCostCentersFromDb,
  getFinancialAccountsFromDb,
  getFinancialAuditLogsFromDb,
  getFinancialCategoriesFromDb,
  getFinancialPaymentMethodsFromDb,
  getSystemSettingsFromDb,
  insertFinancialAuditLogInDb,
  refundFinancialAccountAtomicInDb,
  saveSystemSettingsToDb,
  settleFinancialAccountAtomicInDb,
  upsertBankAccountInDb,
  upsertCostCenterInDb,
  upsertFinancialAccountInDb,
  upsertFinancialCategoryInDb,
  upsertFinancialPaymentMethodInDb,
} from '../db/repository.ts';
import { handleRouterError } from './dbErrorHelper.ts';

export const financialRouter = Router();

function buildAuditEntry(req: Request, params: {
  operation: string;
  permissionUsed?: string;
  affectedRecordId?: string;
  affectedRecordType?: string;
  result?: 'sucesso' | 'bloqueado' | 'erro';
  details: string;
  previousValues?: any;
  newValues?: any;
}) {
  const user = req.authUser;
  return {
    id: `fin-aud-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
    userId: user?.id || 'anonimo',
    userName: user?.name || 'Não autenticado',
    userEmail: user?.email || 'anonimo',
    userRole: user?.role || 'visitante',
    operation: params.operation,
    permissionUsed: params.permissionUsed || '',
    affectedRecordId: params.affectedRecordId || null,
    affectedRecordType: params.affectedRecordType || 'modulo_financeiro',
    previousValues: params.previousValues || null,
    newValues: params.newValues || null,
    result: params.result || 'sucesso',
    details: params.details,
    origin: 'api_financeira',
  };
}

/**
 * Middleware de Autenticação e Autorização para o Módulo Financeiro
 * Usa exclusivamente req.authUser validado via sessão PostgreSQL (nunca confia em headers x-user-*).
 */
export function requireFinancialPermission(requiredPermission: keyof RolePermissions) {
  return (req: Request, res: Response, next: NextFunction) => {
    const authUser = req.authUser || null;

    if (!authUser) {
      void insertFinancialAuditLogInDb(
        buildAuditEntry(req, {
          operation: `API_${req.method}_${req.path}`,
          permissionUsed: String(requiredPermission),
          result: 'bloqueado',
          details: 'Tentativa de requisição não autenticada à API financeira.',
        })
      ).catch(() => {});

      return res.status(401).json({
        success: false,
        error: 'Acesso negado. Usuário não autenticado.',
        code: 'UNAUTHENTICATED',
      });
    }

    if (authUser.status === 'inativo') {
      void insertFinancialAuditLogInDb(
        buildAuditEntry(req, {
          operation: `API_${req.method}_${req.path}`,
          permissionUsed: String(requiredPermission),
          result: 'bloqueado',
          details: `Usuário com cadastro inativo tentou executar ${req.method} ${req.path}.`,
        })
      ).catch(() => {});

      return res.status(403).json({
        success: false,
        error: 'Acesso negado. Cadastro de colaborador inativo no sistema.',
        code: 'USER_INACTIVE',
      });
    }

    if (!hasServerPermission(req, requiredPermission as PermissionKey)) {
      void insertFinancialAuditLogInDb(
        buildAuditEntry(req, {
          operation: `API_${req.method}_${req.path}`,
          permissionUsed: String(requiredPermission),
          result: 'bloqueado',
          details: `Acesso negado: Usuário '${authUser.name}' (${authUser.role}) não possui a permissão '${String(
            requiredPermission
          )}' para acessar ${req.method} ${req.path}.`,
        })
      ).catch(() => {});

      return res.status(403).json({
        success: false,
        error:
          'Acesso negado. Você não possui permissão para acessar esta funcionalidade financeira. Entre em contato com o administrador do sistema.',
        code: 'FORBIDDEN',
        requiredPermission,
      });
    }

    next();
  };
}

// 1. Status e Verificação de Acesso Geral ao Módulo Financeiro
financialRouter.get(
  '/access-check',
  requireFinancialPermission('canViewFinancialModule'),
  (_req: Request, res: Response) => {
    res.json({
      success: true,
      allowed: true,
      message: 'Acesso concedido ao módulo Financeiro.',
    });
  }
);

// 2. Dashboard Financeiro (PostgreSQL)
financialRouter.get(
  '/dashboard',
  requireFinancialPermission('canViewFinancialDashboard'),
  async (_req: Request, res: Response) => {
    try {
      const [accounts, bankAccounts, categories] = await Promise.all([
        getFinancialAccountsFromDb(),
        getBankAccountsFromDb(),
        getFinancialCategoriesFromDb(),
      ]);

      const totalReceivablesOpen = accounts
        .filter((a: any) => a.type === 'receber' && a.status !== 'pago' && a.status !== 'cancelado')
        .reduce((acc: number, a: any) => acc + Number(a.remainingAmount ?? a.amount ?? 0), 0);
      const totalPayablesOpen = accounts
        .filter((a: any) => a.type === 'pagar' && a.status !== 'pago' && a.status !== 'cancelado')
        .reduce((acc: number, a: any) => acc + Number(a.remainingAmount ?? a.amount ?? 0), 0);
      const totalBankBalance = bankAccounts.reduce(
        (acc: number, ba: any) => acc + Number(ba.currentBalance || 0),
        0
      );

      return res.json({
        success: true,
        authorized: true,
        timestamp: new Date().toISOString(),
        summary: {
          totalReceivablesOpen: Number(totalReceivablesOpen.toFixed(2)),
          totalPayablesOpen: Number(totalPayablesOpen.toFixed(2)),
          totalBankBalance: Number(totalBankBalance.toFixed(2)),
          accountsCount: accounts.length,
        },
        accounts,
        bankAccounts,
        categories,
      });
    } catch (err: any) {
      return handleRouterError(res, err, 'Erro ao carregar dashboard financeiro do PostgreSQL.');
    }
  }
);

// 3. Contas a Receber
financialRouter.get(
  '/receivables',
  requireFinancialPermission('canViewReceivables'),
  async (_req: Request, res: Response) => {
    try {
      const accounts = await getFinancialAccountsFromDb();
      const receivables = accounts.filter((a: any) => a.type === 'receber');
      return res.json({ success: true, authorized: true, receivables });
    } catch (err: any) {
      return handleRouterError(res, err, 'Erro ao consultar contas a receber no PostgreSQL.');
    }
  }
);

financialRouter.post(
  '/receivables',
  requireFinancialPermission('canCreateReceivable'),
  async (req: Request, res: Response) => {
    try {
      const payload = req.body || {};
      if (!payload.description || Number(payload.amount || 0) <= 0) {
        return res.status(400).json({
          success: false,
          error: 'Descrição e valor válido são obrigatórios.',
        });
      }
      const record = {
        ...payload,
        id: payload.id || `fin-rec-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type: 'receber',
      };
      const saved = await upsertFinancialAccountInDb(record);
      await insertFinancialAuditLogInDb(
        buildAuditEntry(req, {
          operation: 'CRIAR_CONTA_RECEBER',
          permissionUsed: 'canCreateReceivable',
          affectedRecordId: saved.id,
          affectedRecordType: 'conta_receber',
          newValues: saved,
          details: `Conta a receber '${saved.description}' (R$ ${Number(saved.amount).toFixed(2)}) gravada no PostgreSQL.`,
        })
      );
      return res.status(201).json({
        success: true,
        account: saved,
        message: 'Conta a receber salva com sucesso no PostgreSQL.',
      });
    } catch (err: any) {
      return handleRouterError(res, err, 'Erro ao gravar conta a receber no PostgreSQL.');
    }
  }
);

financialRouter.post(
  '/receivables/:id/settle',
  requireFinancialPermission('canReceivePayment'),
  async (req: Request, res: Response) => {
    try {
      const { amountPaid, paymentDate, bankAccountId, paymentMethodId, notes } = req.body || {};
      const auditEntry = buildAuditEntry(req, {
        operation: 'BAIXAR_RECEBIMENTO',
        permissionUsed: 'canReceivePayment',
        affectedRecordId: req.params.id,
        affectedRecordType: 'conta_receber',
        details: `Liquidação de recebimento ${req.params.id} (Valor: R$ ${Number(amountPaid || 0).toFixed(2)}).`,
      });
      const result = await settleFinancialAccountAtomicInDb({
        id: req.params.id,
        amountPaid: Number(amountPaid || 0),
        paymentDate,
        bankAccountId,
        paymentMethodId,
        notes,
        auditEntry,
      });
      if (result.notFound) {
        return res.status(404).json({ success: false, error: 'Conta a receber não encontrada.' });
      }
      if (result.cancelled) {
        return res.status(400).json({ success: false, error: 'Conta cancelada não pode ser liquidada.' });
      }
      return res.json({
        success: true,
        ...result,
        message: 'Baixa de recebimento processada com sucesso no PostgreSQL.',
      });
    } catch (err: any) {
      return handleRouterError(res, err, 'Erro ao baixar recebimento no PostgreSQL.');
    }
  }
);

financialRouter.post(
  '/receivables/:id/cancel',
  requireFinancialPermission('canCancelReceivable'),
  async (req: Request, res: Response) => {
    try {
      const { reason } = req.body || {};
      if (!reason || !String(reason).trim()) {
        return res.status(400).json({
          success: false,
          error: 'Motivo do cancelamento é obrigatório.',
        });
      }
      const result = await cancelFinancialAccountAtomicInDb({
        id: req.params.id,
        reason: String(reason).trim(),
        auditEntry: buildAuditEntry(req, {
          operation: 'CANCELAR_RECEBIMENTO',
          permissionUsed: 'canCancelReceivable',
          affectedRecordId: req.params.id,
          affectedRecordType: 'conta_receber',
          details: `Cancelamento de conta a receber ${req.params.id}. Motivo: ${String(reason).trim()}`,
        }),
      });
      if (result.notFound) {
        return res.status(404).json({ success: false, error: 'Conta a receber não encontrada.' });
      }
      return res.json({
        success: true,
        ...result,
        message: 'Conta a receber cancelada com sucesso no PostgreSQL.',
      });
    } catch (err: any) {
      return handleRouterError(res, err, 'Erro ao cancelar conta a receber no PostgreSQL.');
    }
  }
);

financialRouter.post(
  '/receivables/:id/refund',
  requireFinancialPermission('canRefundReceivable'),
  async (req: Request, res: Response) => {
    try {
      const { reason } = req.body || {};
      if (!reason || !String(reason).trim()) {
        return res.status(400).json({
          success: false,
          error: 'Motivo do estorno é obrigatório.',
        });
      }
      const result = await refundFinancialAccountAtomicInDb({
        id: req.params.id,
        reason: String(reason).trim(),
        auditEntry: buildAuditEntry(req, {
          operation: 'ESTORNAR_RECEBIMENTO',
          permissionUsed: 'canRefundReceivable',
          affectedRecordId: req.params.id,
          affectedRecordType: 'conta_receber',
          details: `Estorno de recebimento ${req.params.id}. Motivo: ${String(reason).trim()}`,
        }),
      });
      if (result.notFound) {
        return res.status(404).json({ success: false, error: 'Conta a receber não encontrada.' });
      }
      return res.json({
        success: true,
        ...result,
        message: 'Estorno de recebimento concluído com sucesso no PostgreSQL.',
      });
    } catch (err: any) {
      return handleRouterError(res, err, 'Erro ao estornar recebimento no PostgreSQL.');
    }
  }
);

// 8. Contas a Pagar
financialRouter.get(
  '/payables',
  requireFinancialPermission('canViewPayables'),
  async (_req: Request, res: Response) => {
    try {
      const accounts = await getFinancialAccountsFromDb();
      const payables = accounts.filter((a: any) => a.type === 'pagar');
      return res.json({ success: true, authorized: true, payables });
    } catch (err: any) {
      return handleRouterError(res, err, 'Erro ao consultar contas a pagar no PostgreSQL.');
    }
  }
);

financialRouter.post(
  '/payables',
  requireFinancialPermission('canCreatePayable'),
  async (req: Request, res: Response) => {
    try {
      const payload = req.body || {};
      if (!payload.description || Number(payload.amount || 0) <= 0) {
        return res.status(400).json({
          success: false,
          error: 'Descrição e valor válido são obrigatórios.',
        });
      }
      const record = {
        ...payload,
        id: payload.id || `fin-pag-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type: 'pagar',
      };
      const saved = await upsertFinancialAccountInDb(record);
      await insertFinancialAuditLogInDb(
        buildAuditEntry(req, {
          operation: 'CRIAR_CONTA_PAGAR',
          permissionUsed: 'canCreatePayable',
          affectedRecordId: saved.id,
          affectedRecordType: 'conta_pagar',
          newValues: saved,
          details: `Conta a pagar '${saved.description}' (R$ ${Number(saved.amount).toFixed(2)}) gravada no PostgreSQL.`,
        })
      );
      return res.status(201).json({
        success: true,
        account: saved,
        message: 'Conta a pagar salva com sucesso no PostgreSQL.',
      });
    } catch (err: any) {
      return handleRouterError(res, err, 'Erro ao gravar conta a pagar no PostgreSQL.');
    }
  }
);

financialRouter.post(
  '/payables/:id/settle',
  requireFinancialPermission('canPayBill'),
  async (req: Request, res: Response) => {
    try {
      const { amountPaid, paymentDate, bankAccountId, paymentMethodId, notes } = req.body || {};
      const result = await settleFinancialAccountAtomicInDb({
        id: req.params.id,
        amountPaid: Number(amountPaid || 0),
        paymentDate,
        bankAccountId,
        paymentMethodId,
        notes,
        auditEntry: buildAuditEntry(req, {
          operation: 'PAGAR_CONTA',
          permissionUsed: 'canPayBill',
          affectedRecordId: req.params.id,
          affectedRecordType: 'conta_pagar',
          details: `Pagamento de conta ${req.params.id} registrado no PostgreSQL.`,
        }),
      });
      if (result.notFound) {
        return res.status(404).json({ success: false, error: 'Conta a pagar não encontrada.' });
      }
      return res.json({
        success: true,
        ...result,
        message: 'Pagamento de conta registrado com sucesso no PostgreSQL.',
      });
    } catch (err: any) {
      return handleRouterError(res, err, 'Erro ao registrar pagamento no PostgreSQL.');
    }
  }
);

financialRouter.post(
  '/payables/:id/cancel',
  requireFinancialPermission('canCancelPayable'),
  async (req: Request, res: Response) => {
    try {
      const { reason } = req.body || {};
      if (!reason || !String(reason).trim()) {
        return res.status(400).json({
          success: false,
          error: 'Motivo do cancelamento é obrigatório.',
        });
      }
      const result = await cancelFinancialAccountAtomicInDb({
        id: req.params.id,
        reason: String(reason).trim(),
        auditEntry: buildAuditEntry(req, {
          operation: 'CANCELAR_CONTA_PAGAR',
          permissionUsed: 'canCancelPayable',
          affectedRecordId: req.params.id,
          affectedRecordType: 'conta_pagar',
          details: `Cancelamento de conta a pagar ${req.params.id}. Motivo: ${String(reason).trim()}`,
        }),
      });
      if (result.notFound) {
        return res.status(404).json({ success: false, error: 'Conta a pagar não encontrada.' });
      }
      return res.json({
        success: true,
        ...result,
        message: 'Conta a pagar cancelada com sucesso no PostgreSQL.',
      });
    } catch (err: any) {
      return handleRouterError(res, err, 'Erro ao cancelar conta a pagar no PostgreSQL.');
    }
  }
);

financialRouter.post(
  '/payables/:id/refund',
  requireFinancialPermission('canRefundPayable'),
  async (req: Request, res: Response) => {
    try {
      const { reason } = req.body || {};
      if (!reason || !String(reason).trim()) {
        return res.status(400).json({
          success: false,
          error: 'Motivo do estorno é obrigatório.',
        });
      }
      const result = await refundFinancialAccountAtomicInDb({
        id: req.params.id,
        reason: String(reason).trim(),
        auditEntry: buildAuditEntry(req, {
          operation: 'ESTORNAR_PAGAMENTO',
          permissionUsed: 'canRefundPayable',
          affectedRecordId: req.params.id,
          affectedRecordType: 'conta_pagar',
          details: `Estorno de pagamento ${req.params.id}. Motivo: ${String(reason).trim()}`,
        }),
      });
      if (result.notFound) {
        return res.status(404).json({ success: false, error: 'Conta a pagar não encontrada.' });
      }
      return res.json({
        success: true,
        ...result,
        message: 'Estorno de pagamento concluído com sucesso no PostgreSQL.',
      });
    } catch (err: any) {
      return handleRouterError(res, err, 'Erro ao estornar pagamento no PostgreSQL.');
    }
  }
);

// 13. Fluxo de Caixa
financialRouter.get(
  '/cash-flow',
  requireFinancialPermission('canViewCashFlow'),
  async (_req: Request, res: Response) => {
    try {
      const [accounts, bankAccounts] = await Promise.all([
        getFinancialAccountsFromDb(),
        getBankAccountsFromDb(),
      ]);
      return res.json({ success: true, authorized: true, accounts, bankAccounts });
    } catch (err: any) {
      return handleRouterError(res, err, 'Erro ao carregar fluxo de caixa do PostgreSQL.');
    }
  }
);

// 14. Relatórios Financeiros
financialRouter.get(
  '/reports',
  requireFinancialPermission('canViewFinancialReports'),
  async (_req: Request, res: Response) => {
    try {
      const [accounts, categories, costCenters, bankAccounts] = await Promise.all([
        getFinancialAccountsFromDb(),
        getFinancialCategoriesFromDb(),
        getCostCentersFromDb(),
        getBankAccountsFromDb(),
      ]);
      return res.json({
        success: true,
        authorized: true,
        accounts,
        categories,
        costCenters,
        bankAccounts,
      });
    } catch (err: any) {
      return handleRouterError(res, err, 'Erro ao carregar relatórios financeiros do PostgreSQL.');
    }
  }
);

financialRouter.post(
  '/reports/export',
  requireFinancialPermission('canExportFinancialReports'),
  async (req: Request, res: Response) => {
    try {
      await insertFinancialAuditLogInDb(
        buildAuditEntry(req, {
          operation: 'EXPORTAR_RELATORIO_FINANCEIRO',
          permissionUsed: 'canExportFinancialReports',
          affectedRecordType: 'relatorio_financeiro',
          details: `Exportação de relatório financeiro autorizada para ${req.authUser?.name}.`,
        })
      );
      return res.json({ success: true, message: 'Exportação autorizada e auditada no PostgreSQL.' });
    } catch (err: any) {
      return handleRouterError(res, err, 'Erro ao registrar exportação financeira no PostgreSQL.');
    }
  }
);

// 16. Cadastros: Categorias Financeiras
financialRouter.get(
  '/categories',
  requireFinancialPermission('canViewFinancialModule'),
  async (_req: Request, res: Response) => {
    try {
      const categories = await getFinancialCategoriesFromDb();
      return res.json({ success: true, categories });
    } catch (err: any) {
      return handleRouterError(res, err, 'Erro ao carregar categorias financeiras.');
    }
  }
);

financialRouter.post(
  '/categories',
  requireFinancialPermission('canManageFinancialCategories'),
  async (req: Request, res: Response) => {
    try {
      const payload = req.body || {};
      const record = {
        ...payload,
        id: payload.id || `fcat-${Date.now()}`,
      };
      const saved = await upsertFinancialCategoryInDb(record);
      return res.json({ success: true, category: saved, message: 'Categoria financeira salva no PostgreSQL.' });
    } catch (err: any) {
      return handleRouterError(res, err, 'Erro ao salvar categoria financeira.');
    }
  }
);

financialRouter.delete(
  '/categories/:id',
  requireFinancialPermission('canManageFinancialCategories'),
  async (req: Request, res: Response) => {
    try {
      await deleteFinancialCategoryFromDb(req.params.id);
      return res.json({ success: true, message: 'Categoria financeira excluída do PostgreSQL.' });
    } catch (err: any) {
      return handleRouterError(res, err, 'Erro ao excluir categoria financeira.');
    }
  }
);

// 17. Cadastros: Centros de Custo
financialRouter.get(
  '/cost-centers',
  requireFinancialPermission('canViewFinancialModule'),
  async (_req: Request, res: Response) => {
    try {
      const costCenters = await getCostCentersFromDb();
      return res.json({ success: true, costCenters });
    } catch (err: any) {
      return handleRouterError(res, err, 'Erro ao carregar centros de custo.');
    }
  }
);

financialRouter.post(
  '/cost-centers',
  requireFinancialPermission('canManageCostCenters'),
  async (req: Request, res: Response) => {
    try {
      const payload = req.body || {};
      const saved = await upsertCostCenterInDb({
        ...payload,
        id: payload.id || `cc-${Date.now()}`,
      });
      return res.json({ success: true, costCenter: saved, message: 'Centro de custo salvo no PostgreSQL.' });
    } catch (err: any) {
      return handleRouterError(res, err, 'Erro ao salvar centro de custo.');
    }
  }
);

financialRouter.delete(
  '/cost-centers/:id',
  requireFinancialPermission('canManageCostCenters'),
  async (req: Request, res: Response) => {
    try {
      await deleteCostCenterFromDb(req.params.id);
      return res.json({ success: true, message: 'Centro de custo excluído do PostgreSQL.' });
    } catch (err: any) {
      return handleRouterError(res, err, 'Erro ao excluir centro de custo.');
    }
  }
);

// 18. Cadastros: Contas Bancárias
financialRouter.get(
  '/bank-accounts',
  requireFinancialPermission('canViewFinancialModule'),
  async (_req: Request, res: Response) => {
    try {
      const bankAccounts = await getBankAccountsFromDb();
      return res.json({ success: true, bankAccounts });
    } catch (err: any) {
      return handleRouterError(res, err, 'Erro ao carregar contas bancárias.');
    }
  }
);

financialRouter.post(
  '/bank-accounts',
  requireFinancialPermission('canManageBankAccounts'),
  async (req: Request, res: Response) => {
    try {
      const payload = req.body || {};
      const saved = await upsertBankAccountInDb({
        ...payload,
        id: payload.id || `bank-${Date.now()}`,
      });
      return res.json({ success: true, bankAccount: saved, message: 'Conta bancária salva no PostgreSQL.' });
    } catch (err: any) {
      return handleRouterError(res, err, 'Erro ao salvar conta bancária.');
    }
  }
);

financialRouter.delete(
  '/bank-accounts/:id',
  requireFinancialPermission('canManageBankAccounts'),
  async (req: Request, res: Response) => {
    try {
      await deleteBankAccountFromDb(req.params.id);
      return res.json({ success: true, message: 'Conta bancária excluída do PostgreSQL.' });
    } catch (err: any) {
      return handleRouterError(res, err, 'Erro ao excluir conta bancária.');
    }
  }
);

// Formas de Pagamento Financeiras
financialRouter.get(
  '/payment-methods',
  requireFinancialPermission('canViewFinancialModule'),
  async (_req: Request, res: Response) => {
    try {
      const paymentMethods = await getFinancialPaymentMethodsFromDb();
      return res.json({ success: true, paymentMethods });
    } catch (err: any) {
      return handleRouterError(res, err, 'Erro ao carregar formas de pagamento.');
    }
  }
);

financialRouter.post(
  '/payment-methods',
  requireFinancialPermission('canManagePaymentMethods'),
  async (req: Request, res: Response) => {
    try {
      const payload = req.body || {};
      const saved = await upsertFinancialPaymentMethodInDb({
        ...payload,
        id: payload.id || `fpm-${Date.now()}`,
      });
      return res.json({ success: true, paymentMethod: saved, message: 'Forma de pagamento salva no PostgreSQL.' });
    } catch (err: any) {
      return handleRouterError(res, err, 'Erro ao salvar forma de pagamento.');
    }
  }
);

financialRouter.delete(
  '/payment-methods/:id',
  requireFinancialPermission('canManagePaymentMethods'),
  async (req: Request, res: Response) => {
    try {
      await deleteFinancialPaymentMethodFromDb(req.params.id);
      return res.json({ success: true, message: 'Forma de pagamento excluída do PostgreSQL.' });
    } catch (err: any) {
      return handleRouterError(res, err, 'Erro ao excluir forma de pagamento.');
    }
  }
);

// 19. Configurações Financeiras
financialRouter.get(
  '/settings',
  requireFinancialPermission('canViewFinancialModule'),
  async (_req: Request, res: Response) => {
    try {
      const settings = await getSystemSettingsFromDb('financial');
      return res.json({ success: true, settings });
    } catch (err: any) {
      return handleRouterError(res, err, 'Erro ao carregar configurações financeiras.');
    }
  }
);

financialRouter.post(
  '/settings',
  requireFinancialPermission('canManageFinancialSettings'),
  async (req: Request, res: Response) => {
    try {
      const saved = await saveSystemSettingsToDb('financial', req.body || {});
      await insertFinancialAuditLogInDb(
        buildAuditEntry(req, {
          operation: 'ATUALIZAR_CONFIG_FINANCEIRA',
          permissionUsed: 'canManageFinancialSettings',
          affectedRecordType: 'config_financeira',
          newValues: saved,
          details: 'Configurações financeiras atualizadas no PostgreSQL.',
        })
      );
      return res.json({
        success: true,
        settings: saved,
        message: 'Configurações financeiras atualizadas no PostgreSQL.',
      });
    } catch (err: any) {
      return handleRouterError(res, err, 'Erro ao atualizar configurações financeiras.');
    }
  }
);

// 20. Auditoria Financeira (PostgreSQL)
financialRouter.get(
  '/audit',
  requireFinancialPermission('canViewFinancialAudit'),
  async (_req: Request, res: Response) => {
    try {
      const logs = await getFinancialAuditLogsFromDb();
      return res.json({
        success: true,
        serverAuditLogs: logs,
      });
    } catch (err: any) {
      return handleRouterError(res, err, 'Erro ao consultar auditoria financeira no PostgreSQL.');
    }
  }
);
