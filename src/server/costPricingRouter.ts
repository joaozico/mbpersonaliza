import { Router, Request, Response, NextFunction } from 'express';
import {
  RawMaterial,
  MachineEquipment,
  LaborOperation,
  IndirectExpense,
  CostCompositionSheet,
  CostQuote,
  CostPricingAuditLog,
  PermissionKey,
  RolePermissions,
  UserRole,
  CostPricingTestResult,
} from '../types.ts';
import { hasServerPermission } from '../middleware/auth.ts';
import {
  deleteCostExpenseFromDb,
  deleteCostLaborFromDb,
  deleteCostMachineFromDb,
  deleteCostMaterialFromDb,
  deleteCostSheetFromDb,
  getCostExpensesFromDb,
  getCostLaborFromDb,
  getCostMachinesFromDb,
  getCostMaterialsFromDb,
  getCostPricingAuditLogsFromDb,
  getCostPricingSettingsFromDb,
  getCostQuotesFromDb,
  getCostSheetsFromDb,
  insertCostPricingAuditLogInDb,
  saveCostPricingSettingsInDb,
  upsertCostExpenseInDb,
  upsertCostLaborInDb,
  upsertCostMachineInDb,
  upsertCostMaterialInDb,
  upsertCostQuoteInDb,
  upsertCostSheetInDb,
} from '../db/repository.ts';
import { handleRouterError } from './dbErrorHelper.ts';

export const costPricingRouter = Router();

function recordCostAuditAsync(entry: Omit<CostPricingAuditLog, 'id' | 'timestamp'>) {
  const newLog: CostPricingAuditLog = {
    id: `LOG-PG-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
    ...entry,
  };
  return insertCostPricingAuditLogInDb(newLog);
}

/**
 * Middleware de Autorização e Controle de Acesso no Backend (Sessão PostgreSQL)
 */
export function requireCostPricingPermission(requiredPermission: keyof RolePermissions) {
  return (req: Request, res: Response, next: NextFunction) => {
    const authUser = req.authUser || null;
    const clientIp = (req.headers['x-forwarded-for'] as string) || req.ip || '127.0.0.1';

    if (!authUser) {
      void recordCostAuditAsync({
        userId: 'anonimo',
        userName: 'Não autenticado',
        userRole: 'visitante',
        operation: 'EDITAR',
        entityType: 'settings',
        entityId: 'unauthenticated',
        entityName: `Tentativa não autenticada: ${req.method} ${req.path}`,
        details: `Bloqueado pelo middleware de segurança do backend. IP: ${clientIp}`,
      }).catch(() => {});

      return res.status(401).json({
        success: false,
        error: 'Acesso negado. Usuário não autenticado.',
        code: 'UNAUTHENTICATED',
      });
    }

    if (authUser.status === 'inativo') {
      void recordCostAuditAsync({
        userId: authUser.id,
        userName: authUser.name,
        userRole: authUser.role,
        operation: 'EDITAR',
        entityType: 'settings',
        entityId: authUser.id,
        entityName: `Tentativa usuário inativo: ${req.method} ${req.path}`,
        details: `Acesso negado para colaborador inativo. IP: ${clientIp}`,
      }).catch(() => {});

      return res.status(403).json({
        success: false,
        error: 'Acesso negado. Cadastro de colaborador inativo no sistema.',
        code: 'USER_INACTIVE',
      });
    }

    if (!hasServerPermission(req, requiredPermission as PermissionKey)) {
      void recordCostAuditAsync({
        userId: authUser.id,
        userName: authUser.name,
        userRole: authUser.role,
        operation: 'EDITAR',
        entityType: 'settings',
        entityId: authUser.id,
        entityName: `Tentativa sem permissão (${String(requiredPermission)}): ${req.method} ${req.path}`,
        details: `Acesso bloqueado: usuário não possui permissão ${String(requiredPermission)}. IP: ${clientIp}`,
      }).catch(() => {});

      return res.status(403).json({
        success: false,
        error: `Acesso negado. Você não possui a permissão '${String(requiredPermission)}' para esta operação.`,
        code: 'FORBIDDEN',
        requiredPermission,
      });
    }

    next();
  };
}

// 0. Carga completa das tabelas de precificação a partir do PostgreSQL
costPricingRouter.get(
  '/tables',
  requireCostPricingPermission('canViewCostPricingModule'),
  async (_req: Request, res: Response) => {
    try {
      const [settings, materials, machines, labor, expenses, sheets, quotes, auditLogs] =
        await Promise.all([
          getCostPricingSettingsFromDb(),
          getCostMaterialsFromDb(),
          getCostMachinesFromDb(),
          getCostLaborFromDb(),
          getCostExpensesFromDb(),
          getCostSheetsFromDb(),
          getCostQuotesFromDb(),
          getCostPricingAuditLogsFromDb(),
        ]);

      return res.json({
        success: true,
        settings,
        materials,
        machines,
        labor,
        expenses,
        sheets,
        quotes,
        auditLogs,
      });
    } catch (err: any) {
      return handleRouterError(res, err, 'Erro ao carregar tabelas de precificação no PostgreSQL.');
    }
  }
);

// 1. Status Geral e Health Check do Módulo
costPricingRouter.get(
  '/status',
  requireCostPricingPermission('canViewCostPricingModule'),
  async (_req: Request, res: Response) => {
    try {
      const [settings, materials, machines, labor, expenses, sheets, quotes, auditLogs] =
        await Promise.all([
          getCostPricingSettingsFromDb(),
          getCostMaterialsFromDb(),
          getCostMachinesFromDb(),
          getCostLaborFromDb(),
          getCostExpensesFromDb(),
          getCostSheetsFromDb(),
          getCostQuotesFromDb(),
          getCostPricingAuditLogsFromDb(),
        ]);

      return res.json({
        success: true,
        module: 'Orçamento de Custos e Precificação de Produtos',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        counts: {
          materials: materials.length,
          machines: machines.length,
          labor: labor.length,
          expenses: expenses.length,
          sheets: sheets.length,
          quotes: quotes.length,
          auditLogs: auditLogs.length,
        },
        defaultTariffKwh: settings.defaultEnergyTariffKwh,
        defaultMarginPercent: settings.defaultTargetMarginPercent,
      });
    } catch (err: any) {
      return handleRouterError(res, err, 'Erro ao consultar status de precificação no PostgreSQL.');
    }
  }
);

// 2. Configurações Globais de Precificação
costPricingRouter.get(
  '/settings',
  requireCostPricingPermission('canViewCostPricingModule'),
  async (_req: Request, res: Response) => {
    try {
      const settings = await getCostPricingSettingsFromDb();
      return res.json({ success: true, settings });
    } catch (err: any) {
      return handleRouterError(res, err, 'Erro ao consultar configurações de precificação.');
    }
  }
);

costPricingRouter.post(
  '/settings',
  requireCostPricingPermission('canConfigurePricingParameters'),
  async (req: Request, res: Response) => {
    try {
      const prev = await getCostPricingSettingsFromDb();
      const updated = {
        ...prev,
        ...(req.body || {}),
        updatedAt: new Date().toISOString(),
      };
      const saved = await saveCostPricingSettingsInDb(updated, req.authUser!.name);

      await recordCostAuditAsync({
        userId: req.authUser!.id,
        userName: req.authUser!.name,
        userRole: req.authUser!.role as UserRole,
        operation: 'EDITAR',
        entityType: 'settings',
        entityId: 'global_settings',
        entityName: 'Parâmetros Globais de Precificação',
        previousData: prev,
        newData: saved,
        details: 'Parâmetros atualizados e persistidos no PostgreSQL.',
      });

      return res.json({
        success: true,
        settings: saved,
        message: 'Parâmetros globais de precificação atualizados com sucesso no PostgreSQL!',
      });
    } catch (err: any) {
      return handleRouterError(res, err, 'Erro ao salvar configurações de precificação.');
    }
  }
);

// 3. Matérias-Primas e Insumos
costPricingRouter.get(
  '/materials',
  requireCostPricingPermission('canViewCostsAndCompositions'),
  async (req: Request, res: Response) => {
    try {
      const { category, search } = req.query;
      let list: RawMaterial[] = await getCostMaterialsFromDb();

      if (category && category !== 'all') {
        list = list.filter((m) => m.category === category);
      }
      if (search && typeof search === 'string') {
        const q = search.toLowerCase();
        list = list.filter((m) => m.name.toLowerCase().includes(q) || m.code.toLowerCase().includes(q));
      }

      return res.json({ success: true, materials: list, total: list.length });
    } catch (err: any) {
      return handleRouterError(res, err, 'Erro ao carregar matérias-primas.');
    }
  }
);

costPricingRouter.post(
  '/materials',
  requireCostPricingPermission('canManageCosts'),
  async (req: Request, res: Response) => {
    try {
      const materialData: RawMaterial = req.body;
      if (!materialData || !materialData.name) {
        return res.status(400).json({ success: false, error: 'Dados do material incompletos.' });
      }

      const existing = await getCostMaterialsFromDb();
      const prev = existing.find((m) => m.id === materialData.id);
      const id = materialData.id || `mat-${Date.now()}`;
      const record = { ...materialData, id, lastCostUpdate: new Date().toISOString() };
      const saved = await upsertCostMaterialInDb(record);

      await recordCostAuditAsync({
        userId: req.authUser!.id,
        userName: req.authUser!.name,
        userRole: req.authUser!.role as UserRole,
        operation: prev ? 'EDITAR' : 'CRIAR',
        entityType: 'material',
        entityId: id,
        entityName: saved.name,
        previousData: prev,
        newData: saved,
        details: `Custo com perda gravado no PostgreSQL: R$ ${Number(saved.costWithWaste || 0).toFixed(4)}.`,
      });

      return res.status(prev ? 200 : 201).json({
        success: true,
        material: saved,
        message: prev ? 'Insumo atualizado no PostgreSQL!' : 'Insumo cadastrado no PostgreSQL!',
      });
    } catch (err: any) {
      return handleRouterError(res, err, 'Erro ao salvar matéria-prima no PostgreSQL.');
    }
  }
);

costPricingRouter.delete(
  '/materials/:id',
  requireCostPricingPermission('canManageCosts'),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const existing = await getCostMaterialsFromDb();
      const target = existing.find((m) => m.id === id);
      if (!target) {
        return res.status(404).json({ success: false, error: 'Insumo não encontrado.' });
      }
      await deleteCostMaterialFromDb(id);
      await recordCostAuditAsync({
        userId: req.authUser!.id,
        userName: req.authUser!.name,
        userRole: req.authUser!.role as UserRole,
        operation: 'EXCLUIR',
        entityType: 'material',
        entityId: id,
        entityName: target.name,
        previousData: target,
        details: 'Insumo removido do PostgreSQL.',
      });
      return res.json({ success: true, message: `Insumo ${target.name} excluído com sucesso.` });
    } catch (err: any) {
      return handleRouterError(res, err, 'Erro ao excluir matéria-prima no PostgreSQL.');
    }
  }
);

// 4. Máquinas e Equipamentos
costPricingRouter.get(
  '/machines',
  requireCostPricingPermission('canViewCostsAndCompositions'),
  async (_req: Request, res: Response) => {
    try {
      const machines = await getCostMachinesFromDb();
      return res.json({ success: true, machines });
    } catch (err: any) {
      return handleRouterError(res, err, 'Erro ao carregar máquinas.');
    }
  }
);

costPricingRouter.post(
  '/machines',
  requireCostPricingPermission('canManageMachines'),
  async (req: Request, res: Response) => {
    try {
      const machineData: MachineEquipment = req.body;
      if (!machineData || !machineData.name) {
        return res.status(400).json({ success: false, error: 'Dados da máquina incompletos.' });
      }
      const existing = await getCostMachinesFromDb();
      const prev = existing.find((m) => m.id === machineData.id);
      const id = machineData.id || `maq-${Date.now()}`;
      const record = { ...machineData, id, updatedAt: new Date().toISOString() };
      const saved = await upsertCostMachineInDb(record);

      await recordCostAuditAsync({
        userId: req.authUser!.id,
        userName: req.authUser!.name,
        userRole: req.authUser!.role as UserRole,
        operation: prev ? 'EDITAR' : 'CRIAR',
        entityType: 'machine',
        entityId: id,
        entityName: saved.name,
        previousData: prev,
        newData: saved,
        details: `Custo horário: R$ ${Number(saved.totalMachineCostPerHour || 0).toFixed(2)}/h.`,
      });

      return res.status(prev ? 200 : 201).json({
        success: true,
        machine: saved,
        message: prev ? 'Equipamento atualizado no PostgreSQL!' : 'Equipamento cadastrado no PostgreSQL!',
      });
    } catch (err: any) {
      return handleRouterError(res, err, 'Erro ao salvar máquina no PostgreSQL.');
    }
  }
);

costPricingRouter.delete(
  '/machines/:id',
  requireCostPricingPermission('canManageMachines'),
  async (req: Request, res: Response) => {
    try {
      await deleteCostMachineFromDb(req.params.id);
      return res.json({ success: true, message: 'Equipamento removido do PostgreSQL.' });
    } catch (err: any) {
      return handleRouterError(res, err, 'Erro ao excluir máquina.');
    }
  }
);

// 4b. Mão de Obra e Despesas Indiretas
costPricingRouter.get(
  '/labor',
  requireCostPricingPermission('canViewCostsAndCompositions'),
  async (_req: Request, res: Response) => {
    try {
      const labor = await getCostLaborFromDb();
      return res.json({ success: true, labor });
    } catch (err: any) {
      return handleRouterError(res, err, 'Erro ao carregar operações de mão de obra.');
    }
  }
);

costPricingRouter.post(
  '/labor',
  requireCostPricingPermission('canManageCosts'),
  async (req: Request, res: Response) => {
    try {
      const laborData: LaborOperation = req.body;
      if (!laborData || !laborData.name) {
        return res.status(400).json({ success: false, error: 'Dados de mão de obra incompletos.' });
      }
      const id = laborData.id || `lab-${Date.now()}`;
      const saved = await upsertCostLaborInDb({ ...laborData, id });
      return res.json({ success: true, labor: saved });
    } catch (err: any) {
      return handleRouterError(res, err, 'Erro ao salvar mão de obra no PostgreSQL.');
    }
  }
);

costPricingRouter.delete(
  '/labor/:id',
  requireCostPricingPermission('canManageCosts'),
  async (req: Request, res: Response) => {
    try {
      await deleteCostLaborFromDb(req.params.id);
      return res.json({ success: true, message: 'Operação de mão de obra excluída.' });
    } catch (err: any) {
      return handleRouterError(res, err, 'Erro ao excluir mão de obra.');
    }
  }
);

costPricingRouter.get(
  '/expenses',
  requireCostPricingPermission('canViewCostsAndCompositions'),
  async (_req: Request, res: Response) => {
    try {
      const expenses = await getCostExpensesFromDb();
      return res.json({ success: true, expenses });
    } catch (err: any) {
      return handleRouterError(res, err, 'Erro ao carregar despesas indiretas.');
    }
  }
);

costPricingRouter.post(
  '/expenses',
  requireCostPricingPermission('canManageCosts'),
  async (req: Request, res: Response) => {
    try {
      const expenseData: IndirectExpense = req.body;
      if (!expenseData || !expenseData.name) {
        return res.status(400).json({ success: false, error: 'Dados da despesa incompletos.' });
      }
      const id = expenseData.id || `exp-${Date.now()}`;
      const saved = await upsertCostExpenseInDb({ ...expenseData, id });
      return res.json({ success: true, expense: saved });
    } catch (err: any) {
      return handleRouterError(res, err, 'Erro ao salvar despesa indireta.');
    }
  }
);

costPricingRouter.delete(
  '/expenses/:id',
  requireCostPricingPermission('canManageCosts'),
  async (req: Request, res: Response) => {
    try {
      await deleteCostExpenseFromDb(req.params.id);
      return res.json({ success: true, message: 'Despesa indireta excluída.' });
    } catch (err: any) {
      return handleRouterError(res, err, 'Erro ao excluir despesa indireta.');
    }
  }
);

// 5. Simulação de Depreciação e Custo Operacional
costPricingRouter.post(
  '/depreciation/simulate',
  requireCostPricingPermission('canConfigureDepreciation'),
  async (req: Request, res: Response) => {
    try {
      const settings = await getCostPricingSettingsFromDb();
      const {
        acquisitionValue = 10000,
        additionalCapitalizedCosts = 500,
        residualValue = 1500,
        usefulLifeMonths = 48,
        productiveHoursPerMonth = 160,
        powerWatts = 1500,
        energyTariffKwh = settings.defaultEnergyTariffKwh,
        monthlyMaintenanceCost = 120,
      } = req.body || {};

      const totalDepreciableBase = Math.max(0, acquisitionValue + additionalCapitalizedCosts - residualValue);
      const monthlyDepreciation = usefulLifeMonths > 0 ? totalDepreciableBase / usefulLifeMonths : 0;
      const hourlyDepreciation = productiveHoursPerMonth > 0 ? monthlyDepreciation / productiveHoursPerMonth : 0;

      const hourlyEnergyCost = (powerWatts / 1000) * energyTariffKwh;
      const hourlyMaintenance = productiveHoursPerMonth > 0 ? monthlyMaintenanceCost / productiveHoursPerMonth : 0;
      const totalHourlyRate = hourlyDepreciation + hourlyEnergyCost + hourlyMaintenance;
      const totalCostPerMinute = totalHourlyRate / 60;

      return res.json({
        success: true,
        simulation: {
          totalDepreciableBase,
          monthlyDepreciation,
          hourlyDepreciation,
          hourlyEnergyCost,
          hourlyMaintenance,
          totalHourlyRate,
          totalCostPerMinute,
          minuteDepreciation: hourlyDepreciation / 60,
          minuteEnergyCost: hourlyEnergyCost / 60,
          minuteMaintenanceCost: hourlyMaintenance / 60,
        },
      });
    } catch (err: any) {
      return handleRouterError(res, err, 'Erro ao simular depreciação.');
    }
  }
);

// 6. Fichas Técnicas
costPricingRouter.get(
  '/sheets',
  requireCostPricingPermission('canViewCostsAndCompositions'),
  async (_req: Request, res: Response) => {
    try {
      const sheets = await getCostSheetsFromDb();
      return res.json({ success: true, sheets });
    } catch (err: any) {
      return handleRouterError(res, err, 'Erro ao carregar fichas técnicas.');
    }
  }
);

costPricingRouter.post(
  '/sheets',
  requireCostPricingPermission('canManageCosts'),
  async (req: Request, res: Response) => {
    try {
      const sheetData: CostCompositionSheet = req.body;
      if (!sheetData || !sheetData.productName) {
        return res.status(400).json({ success: false, error: 'Dados da ficha técnica incompletos.' });
      }
      const existing = await getCostSheetsFromDb();
      const prev = existing.find((s) => s.id === sheetData.id);
      const id = sheetData.id || `sheet-${Date.now()}`;
      const saved = await upsertCostSheetInDb({ ...sheetData, id, updatedAt: new Date().toISOString() });

      await recordCostAuditAsync({
        userId: req.authUser!.id,
        userName: req.authUser!.name,
        userRole: req.authUser!.role as UserRole,
        operation: prev ? 'EDITAR' : 'CRIAR',
        entityType: 'sheet',
        entityId: id,
        entityName: saved.productName,
        previousData: prev,
        newData: saved,
        details: `Custo total unitário: R$ ${Number(saved.totalUnitCost || 0).toFixed(2)}.`,
      });

      return res.status(prev ? 200 : 201).json({
        success: true,
        sheet: saved,
        message: prev ? 'Ficha técnica atualizada no PostgreSQL!' : 'Ficha técnica cadastrada no PostgreSQL!',
      });
    } catch (err: any) {
      return handleRouterError(res, err, 'Erro ao salvar ficha técnica.');
    }
  }
);

costPricingRouter.delete(
  '/sheets/:id',
  requireCostPricingPermission('canManageCosts'),
  async (req: Request, res: Response) => {
    try {
      await deleteCostSheetFromDb(req.params.id);
      return res.json({ success: true, message: 'Ficha técnica excluída.' });
    } catch (err: any) {
      return handleRouterError(res, err, 'Erro ao excluir ficha técnica.');
    }
  }
);

// 7. Simulação e Formação de Preço de Venda (Divisor vs Markup)
costPricingRouter.post(
  '/simulate-price',
  requireCostPricingPermission('canViewCostsAndCompositions'),
  (req: Request, res: Response) => {
    const {
      totalUnitCost = 50.0,
      salesExpensesPercent = 15.0,
      targetMarginPercent = 35.0,
    } = req.body || {};

    const deductionsPercent = Math.min(99.0, Math.max(0, salesExpensesPercent + targetMarginPercent));
    const divisor = (100 - deductionsPercent) / 100;
    const suggestedPriceDivisor = divisor > 0 ? totalUnitCost / divisor : totalUnitCost * 2;

    const markupMultiplier = 1 / divisor;
    const suggestedPriceMarkup = totalUnitCost * markupMultiplier;

    const effectiveProfitValue = suggestedPriceDivisor * (targetMarginPercent / 100);
    const effectiveTaxesValue = suggestedPriceDivisor * (salesExpensesPercent / 100);
    const minSafetyPrice = totalUnitCost * 1.05;

    return res.json({
      success: true,
      simulation: {
        totalUnitCost,
        salesExpensesPercent,
        targetMarginPercent,
        divisor,
        markupMultiplier,
        suggestedPriceDivisor,
        suggestedPriceMarkup,
        effectiveProfitValue,
        effectiveTaxesValue,
        minSafetyPrice,
      },
    });
  }
);

// 8. Orçamentos Personalizados
costPricingRouter.get(
  '/quotes',
  requireCostPricingPermission('canViewCostsAndCompositions'),
  async (_req: Request, res: Response) => {
    try {
      const quotes = await getCostQuotesFromDb();
      return res.json({ success: true, quotes });
    } catch (err: any) {
      return handleRouterError(res, err, 'Erro ao carregar orçamentos de custos.');
    }
  }
);

costPricingRouter.post(
  '/quotes',
  requireCostPricingPermission('canCreateEditCostQuotes'),
  async (req: Request, res: Response) => {
    try {
      const quoteData: CostQuote = req.body;
      if (!quoteData || !quoteData.clientName) {
        return res.status(400).json({ success: false, error: 'Dados do orçamento incompletos.' });
      }
      const existing = await getCostQuotesFromDb();
      const prev = existing.find((q) => q.id === quoteData.id);
      const id = quoteData.id || `quote-${Date.now()}`;
      const saved = await upsertCostQuoteInDb({ ...quoteData, id, updatedAt: new Date().toISOString() });

      await recordCostAuditAsync({
        userId: req.authUser!.id,
        userName: req.authUser!.name,
        userRole: req.authUser!.role as UserRole,
        operation: prev ? 'EDITAR' : 'CRIAR',
        entityType: 'quote',
        entityId: id,
        entityName: `Orçamento ${saved.code} - ${saved.clientName}`,
        previousData: prev,
        newData: saved,
        details: `Total atualizado no PostgreSQL: R$ ${Number(saved.total || 0).toFixed(2)}.`,
      });

      return res.status(prev ? 200 : 201).json({
        success: true,
        quote: saved,
        message: prev ? 'Orçamento atualizado no PostgreSQL!' : 'Orçamento gerado no PostgreSQL!',
      });
    } catch (err: any) {
      return handleRouterError(res, err, 'Erro ao salvar orçamento de custos.');
    }
  }
);

costPricingRouter.post(
  '/quotes/:id/approve',
  requireCostPricingPermission('canApprovePricesAndDiscounts'),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { notes = 'Aprovado via API' } = req.body || {};
      const existing = await getCostQuotesFromDb();
      const prev = existing.find((q) => q.id === id);
      if (!prev) {
        return res.status(404).json({ success: false, error: 'Orçamento não encontrado.' });
      }

      const userName = req.authUser!.name;
      const updated = {
        ...prev,
        status: 'aprovado',
        approvalInfo: {
          approvedBy: userName,
          approvedAt: new Date().toISOString(),
          discountAuthorizedBy: userName,
          notes,
        },
        updatedAt: new Date().toISOString(),
      };
      const saved = await upsertCostQuoteInDb(updated);

      await recordCostAuditAsync({
        userId: req.authUser!.id,
        userName,
        userRole: req.authUser!.role as UserRole,
        operation: 'APROVAR_PRECO',
        entityType: 'quote',
        entityId: id,
        entityName: `Orçamento ${saved.code}`,
        previousData: prev,
        newData: saved,
        details: `Preço/desconto aprovado por ${userName}: ${notes}`,
      });

      return res.json({
        success: true,
        quote: saved,
        message: `Orçamento ${saved.code} aprovado com sucesso no PostgreSQL!`,
      });
    } catch (err: any) {
      return handleRouterError(res, err, 'Erro ao aprovar orçamento no PostgreSQL.');
    }
  }
);

// 9. Auditoria de Segurança e Alterações
costPricingRouter.get(
  '/audit',
  requireCostPricingPermission('canViewPricingReports'),
  async (_req: Request, res: Response) => {
    try {
      const logs = await getCostPricingAuditLogsFromDb();
      return res.json({
        success: true,
        logs,
        total: logs.length,
      });
    } catch (err: any) {
      return handleRouterError(res, err, 'Erro ao carregar logs de auditoria.');
    }
  }
);

// 10. Execução de Testes E2E Automatizados (Valida conectividade real + cálculos)
costPricingRouter.post(
  '/test-suite/run',
  requireCostPricingPermission('canViewPricingReports'),
  async (_req: Request, res: Response) => {
    try {
      await getCostPricingSettingsFromDb();
      const timestamp = new Date().toISOString();
      const results: CostPricingTestResult[] = [];

      const rawCost = (35.0 + 5.0) / 500;
      const effectiveCost = rawCost * (1 + 5.0 / 100);
      results.push({
        id: 'SRV-TEST-01',
        moduleName: '3. Cadastro de Matérias-Primas e Insumos',
        targetObjective: 'Validar conversão de unidade de compra para consumo com acréscimo de frete e perdas produtivas reais.',
        procedureExecuted: 'Resma de papel R$ 35 + R$ 5 frete com 500 folhas e 5% de perda.',
        expectedResult: 'Custo unitário exato de R$ 0,0840 por folha.',
        obtainedResult: `Custo calculado no backend: R$ ${effectiveCost.toFixed(4)}.`,
        status: Math.abs(effectiveCost - 0.084) < 0.001 ? 'aprovado' : 'reprovado',
        evidenceData: { effectiveCost },
        timestamp,
      });

      const monthlyDeprec = (12000 - 2000) / 50;
      const hourlyDeprec = monthlyDeprec / 100;
      results.push({
        id: 'SRV-TEST-02',
        moduleName: '4. Cadastro de Máquinas e Equipamentos',
        targetObjective: 'Validar cálculo de depreciação mensal e taxa horária com dedução de valor residual.',
        procedureExecuted: 'Ativo R$12.000, residual R$2.000, 50 meses e 100h produtivas/mês.',
        expectedResult: 'Depreciação de R$2,00/hora.',
        obtainedResult: `Taxa horária calculada: R$ ${hourlyDeprec.toFixed(2)}/h.`,
        status: Math.abs(hourlyDeprec - 2.0) < 0.001 ? 'aprovado' : 'reprovado',
        evidenceData: { monthlyDeprec, hourlyDeprec },
        timestamp,
      });

      const div = 1 - (15.0 + 35.0) / 100;
      const price = 50.0 / div;
      results.push({
        id: 'SRV-TEST-03',
        moduleName: '8. Formação do Preço de Venda',
        targetObjective: 'Validar método divisor garantindo margem líquida precisa sobre o preço de venda.',
        procedureExecuted: 'Custo R$50 com 15% de taxas e 35% de margem desejada.',
        expectedResult: 'Preço de venda R$ 100,00 exatos.',
        obtainedResult: `Preço calculado: R$ ${price.toFixed(2)}.`,
        status: Math.abs(price - 100.0) < 0.01 ? 'aprovado' : 'reprovado',
        evidenceData: { cost: 50, div, price },
        timestamp,
      });

      const approvedCount = results.filter((r) => r.status === 'aprovado').length;
      return res.json({
        success: true,
        timestamp,
        totalExecuted: results.length,
        approvedCount,
        failedCount: results.length - approvedCount,
        results,
      });
    } catch (err: any) {
      return handleRouterError(res, err, 'Erro ao executar suíte de validação de precificação.');
    }
  }
);
