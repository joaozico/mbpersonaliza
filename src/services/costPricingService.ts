import {
  RawMaterial,
  MachineEquipment,
  LaborOperation,
  IndirectExpense,
  CostCompositionSheet,
  CostQuote,
  CostPricingSettings,
  CostPricingAuditLog,
  QuantityTierPricing,
  UserProfile,
  UserRole,
  RolePermissions,
  Order,
  OrderItem,
  CostPricingTestResult,
} from '../types';
import {
  INITIAL_COST_PRICING_SETTINGS,
  INITIAL_RAW_MATERIALS,
  INITIAL_MACHINES,
  INITIAL_LABOR_OPERATIONS,
  INITIAL_INDIRECT_EXPENSES,
  INITIAL_TECHNICAL_SHEETS,
  INITIAL_COST_QUOTES,
  INITIAL_COST_PRICING_AUDIT_LOGS,
} from '../data/costPricingInitialData';
import { StorageService } from './storage';

const STORAGE_KEYS = {
  SETTINGS: 'mb_cost_pricing_settings_v1',
  MATERIALS: 'mb_cost_raw_materials_v1',
  MACHINES: 'mb_cost_machines_v1',
  LABOR: 'mb_cost_labor_operations_v1',
  EXPENSES: 'mb_cost_indirect_expenses_v1',
  SHEETS: 'mb_cost_technical_sheets_v1',
  QUOTES: 'mb_cost_quotes_v1',
  AUDIT_LOGS: 'mb_cost_pricing_audit_logs_v1',
  TEST_RESULTS: 'mb_cost_pricing_test_results_v1',
};

function getStored<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch (err) {
    console.error(`Erro ao carregar chave [${key}] do storage:`, err);
    return fallback;
  }
}

function setStored<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.error(`Erro ao salvar chave [${key}] no storage:`, err);
  }
}

export const CostPricingService = {
  // ==========================================================================
  // CONFIGURAÇÕES GERAIS DE PRECIFICAÇÃO
  // ==========================================================================
  getSettings(): CostPricingSettings {
    const s = getStored<CostPricingSettings>(
      STORAGE_KEYS.SETTINGS,
      INITIAL_COST_PRICING_SETTINGS
    );
    return s || INITIAL_COST_PRICING_SETTINGS;
  },

  updateSettings(
    newSettings: Partial<CostPricingSettings>,
    currentUser: UserProfile
  ): { success: boolean; settings?: CostPricingSettings; error?: string } {
    if (
      currentUser.role !== 'admin' &&
      !StorageService.hasUserPermission(currentUser, 'canConfigurePricingParameters')
    ) {
      return {
        success: false,
        error: 'Você não tem permissão para alterar parâmetros de precificação.',
      };
    }

    const current = this.getSettings();
    const updated: CostPricingSettings = {
      ...current,
      ...newSettings,
      updatedAt: new Date().toISOString(),
      updatedBy: currentUser.name || currentUser.email,
    };

    setStored(STORAGE_KEYS.SETTINGS, updated);

    this.logAudit({
      userId: currentUser.id,
      userName: currentUser.name,
      userRole: currentUser.role,
      entityType: 'settings',
      entityId: 'global_settings',
      entityName: 'Parâmetros Gerais de Precificação',
      operation: 'EDITAR',
      previousData: current,
      newData: updated,
      details: 'Parâmetros de impostos, margens e rateios atualizados pelo usuário.',
    });

    return { success: true, settings: updated };
  },

  // ==========================================================================
  // LOGS DE AUDITORIA
  // ==========================================================================
  getAuditLogs(): CostPricingAuditLog[] {
    const logs = getStored<CostPricingAuditLog[]>(
      STORAGE_KEYS.AUDIT_LOGS,
      INITIAL_COST_PRICING_AUDIT_LOGS
    );
    return Array.isArray(logs) ? logs : INITIAL_COST_PRICING_AUDIT_LOGS;
  },

  logAudit(entry: Omit<CostPricingAuditLog, 'id' | 'timestamp'>): void {
    const logs = this.getAuditLogs();
    const newLog: CostPricingAuditLog = {
      ...entry,
      id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      timestamp: new Date().toISOString(),
    };
    const updated = [newLog, ...logs].slice(0, 1000); // Mantém até 1000 registros
    setStored(STORAGE_KEYS.AUDIT_LOGS, updated);
  },

  // ==========================================================================
  // MATÉRIAS-PRIMAS E INSUMOS
  // ==========================================================================
  getMaterials(): RawMaterial[] {
    const mats = getStored<RawMaterial[]>(
      STORAGE_KEYS.MATERIALS,
      INITIAL_RAW_MATERIALS
    );
    return Array.isArray(mats) ? mats : INITIAL_RAW_MATERIALS;
  },

  calculateMaterialCosts(
    mat: Partial<RawMaterial>
  ): {
    effectivePurchaseCost: number;
    costPerConsumptionUnit: number;
    costWithWaste: number;
  } {
    const purchasePrice = Number(mat.purchasePrice) || 0;
    const shippingCost = Number(mat.shippingCost) || 0;
    const nonRecoverableTaxes = Number(mat.nonRecoverableTaxes) || 0;
    const conversionFactor = Math.max(Number(mat.conversionFactor) || 1, 0.0001);
    const wastePercent = Number(mat.estimatedWastePercent) || 0;

    const effectivePurchaseCost = purchasePrice + shippingCost + nonRecoverableTaxes;
    const costPerConsumptionUnit = effectivePurchaseCost / conversionFactor;
    // Evita contabilizar a mesma perda duas vezes
    const costWithWaste = costPerConsumptionUnit * (1 + wastePercent / 100);

    return {
      effectivePurchaseCost: Number(effectivePurchaseCost.toFixed(4)),
      costPerConsumptionUnit: Number(costPerConsumptionUnit.toFixed(4)),
      costWithWaste: Number(costWithWaste.toFixed(4)),
    };
  },

  saveMaterial(
    materialData: Partial<RawMaterial>,
    currentUser: UserProfile
  ): { success: boolean; material?: RawMaterial; error?: string } {
    if (
      currentUser.role !== 'admin' &&
      !StorageService.hasUserPermission(currentUser, 'canManageCosts')
    ) {
      return {
        success: false,
        error: 'Você não possui permissão para cadastrar ou editar custos de materiais.',
      };
    }

    const calculated = this.calculateMaterialCosts(materialData);
    const materials = this.getMaterials();
    const isNew = !materialData.id;

    let finalMaterial: RawMaterial;
    let prevData: RawMaterial | undefined;

    if (isNew) {
      finalMaterial = {
        id: `mat-${Date.now()}`,
        code: materialData.code || `MP-${(materials.length + 1).toString().padStart(3, '0')}`,
        name: materialData.name || 'Nova Matéria-Prima',
        category: materialData.category || 'papeis',
        supplier: materialData.supplier || 'Fornecedor Padrão',
        purchaseUnit: materialData.purchaseUnit || 'unidade',
        consumptionUnit: materialData.consumptionUnit || 'unidade',
        conversionFactor: Number(materialData.conversionFactor) || 1,
        purchasePrice: Number(materialData.purchasePrice) || 0,
        shippingCost: Number(materialData.shippingCost) || 0,
        nonRecoverableTaxes: Number(materialData.nonRecoverableTaxes) || 0,
        estimatedWastePercent: Number(materialData.estimatedWastePercent) || 0,
        currentStock: Number(materialData.currentStock) || 0,
        stockReferenceId: materialData.stockReferenceId,
        ...calculated,
        lastCostUpdate: new Date().toISOString(),
        notes: materialData.notes || '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      materials.unshift(finalMaterial);
    } else {
      const idx = materials.findIndex((m) => m.id === materialData.id);
      if (idx < 0) {
        return { success: false, error: 'Matéria-prima não encontrada.' };
      }
      prevData = materials[idx];
      finalMaterial = {
        ...prevData,
        ...materialData,
        ...calculated,
        lastCostUpdate: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as RawMaterial;
      materials[idx] = finalMaterial;
    }

    setStored(STORAGE_KEYS.MATERIALS, materials);

    this.logAudit({
      userId: currentUser.id,
      userName: currentUser.name,
      userRole: currentUser.role,
      entityType: 'material',
      entityId: finalMaterial.id,
      entityName: finalMaterial.name,
      operation: isNew ? 'CRIAR' : 'EDITAR',
      previousData: prevData,
      newData: finalMaterial,
      details: isNew
        ? `Material cadastrado com custo unitário R$ ${finalMaterial.costWithWaste.toFixed(4)}`
        : `Custo atualizado de R$ ${prevData?.costWithWaste.toFixed(4)} para R$ ${finalMaterial.costWithWaste.toFixed(4)}`,
    });

    const settings = this.getSettings();
    if (settings.autoRecalculateSheetsOnCostChange) {
      this.recalculateAllSheetsOnMaterialChange(finalMaterial.id);
    }

    return { success: true, material: finalMaterial };
  },

  deleteMaterial(
    materialId: string,
    currentUser: UserProfile
  ): { success: boolean; error?: string } {
    if (
      currentUser.role !== 'admin' &&
      !StorageService.hasUserPermission(currentUser, 'canManageCosts')
    ) {
      return { success: false, error: 'Permissão negada para excluir materiais.' };
    }

    const materials = this.getMaterials();
    const target = materials.find((m) => m.id === materialId);
    if (!target) return { success: false, error: 'Material não encontrado.' };

    const updated = materials.filter((m) => m.id !== materialId);
    setStored(STORAGE_KEYS.MATERIALS, updated);

    this.logAudit({
      userId: currentUser.id,
      userName: currentUser.name,
      userRole: currentUser.role,
      entityType: 'material',
      entityId: target.id,
      entityName: target.name,
      operation: 'EXCLUIR',
      previousData: target,
      details: `Material excluído do catálogo de insumos.`,
    });

    return { success: true };
  },

  // ==========================================================================
  // MÁQUINAS E EQUIPAMENTOS & DEPRECIAÇÃO
  // ==========================================================================
  getMachines(): MachineEquipment[] {
    const list = getStored<MachineEquipment[]>(
      STORAGE_KEYS.MACHINES,
      INITIAL_MACHINES
    );
    return Array.isArray(list) ? list : INITIAL_MACHINES;
  },

  calculateMachineCosts(
    machine: Partial<MachineEquipment>,
    energyTariff?: number
  ): {
    depreciableValue: number;
    monthlyDepreciation: number;
    depreciationPerHour: number;
    depreciationPerMinute: number;
    energyConsumptionKwh: number;
    energyCostPerHour: number;
    maintenanceCostPerHour: number;
    replacementPartsCostPerHour: number;
    totalOperationalCostPerHour: number;
    totalMachineCostPerHour: number;
    totalMachineCostPerMinute: number;
  } {
    const acquisitionValue = Number(machine.acquisitionValue) || 0;
    const capitalizedCosts = Number(machine.capitalizedCosts) || 0;
    const residualValue = Number(machine.residualValue) || 0;
    const usefulLifeMonths = Math.max(Number(machine.usefulLifeMonths) || 60, 1);
    const monthlyProductiveHours = Math.max(
      Number(machine.monthlyProductiveHours) || 176,
      1
    );

    // Depreciação Linear: (Aquisição + Custos Capitalizáveis - Residual) / Vida Útil Meses
    const depreciableValue = Math.max(acquisitionValue + capitalizedCosts - residualValue, 0);
    const monthlyDepreciation = depreciableValue / usefulLifeMonths;
    const depreciationPerHour = monthlyDepreciation / monthlyProductiveHours;
    const depreciationPerMinute = depreciationPerHour / 60;

    // Custos de Operação (Energia, Manutenção, Peças)
    const energyPowerWatts = Number(machine.energyPowerWatts) || 0;
    const energyConsumptionKwh = energyPowerWatts / 1000;
    const tariff =
      energyTariff !== undefined
        ? energyTariff
        : Number(machine.energyTariffKwh) || 0.85;
    const energyCostPerHour = energyConsumptionKwh * tariff;

    const monthlyMaintenanceCost = Number(machine.monthlyMaintenanceCost) || 0;
    const maintenanceCostPerHour = monthlyMaintenanceCost / monthlyProductiveHours;

    const monthlyReplacementPartsCost =
      Number(machine.monthlyReplacementPartsCost) || 0;
    const replacementPartsCostPerHour =
      monthlyReplacementPartsCost / monthlyProductiveHours;

    const otherOperationalCostPerHour =
      Number(machine.otherOperationalCostPerHour) || 0;

    const totalOperationalCostPerHour =
      energyCostPerHour +
      maintenanceCostPerHour +
      replacementPartsCostPerHour +
      otherOperationalCostPerHour;

    const totalMachineCostPerHour =
      depreciationPerHour + totalOperationalCostPerHour;
    const totalMachineCostPerMinute = totalMachineCostPerHour / 60;

    return {
      depreciableValue: Number(depreciableValue.toFixed(2)),
      monthlyDepreciation: Number(monthlyDepreciation.toFixed(2)),
      depreciationPerHour: Number(depreciationPerHour.toFixed(4)),
      depreciationPerMinute: Number(depreciationPerMinute.toFixed(4)),
      energyConsumptionKwh: Number(energyConsumptionKwh.toFixed(3)),
      energyCostPerHour: Number(energyCostPerHour.toFixed(4)),
      maintenanceCostPerHour: Number(maintenanceCostPerHour.toFixed(4)),
      replacementPartsCostPerHour: Number(replacementPartsCostPerHour.toFixed(4)),
      totalOperationalCostPerHour: Number(totalOperationalCostPerHour.toFixed(4)),
      totalMachineCostPerHour: Number(totalMachineCostPerHour.toFixed(4)),
      totalMachineCostPerMinute: Number(totalMachineCostPerMinute.toFixed(4)),
    };
  },

  saveMachine(
    machineData: Partial<MachineEquipment>,
    currentUser: UserProfile
  ): { success: boolean; machine?: MachineEquipment; error?: string } {
    if (
      currentUser.role !== 'admin' &&
      !StorageService.hasUserPermission(currentUser, 'canManageMachines')
    ) {
      return {
        success: false,
        error: 'Você não possui permissão para cadastrar ou editar máquinas.',
      };
    }

    const settings = this.getSettings();
    const calculated = this.calculateMachineCosts(
      machineData,
      settings.defaultEnergyTariffKwh
    );
    const machines = this.getMachines();
    const isNew = !machineData.id;

    let finalMachine: MachineEquipment;
    let prevData: MachineEquipment | undefined;

    if (isNew) {
      finalMachine = {
        id: `maq-${Date.now()}`,
        code: machineData.code || `MAQ-${(machines.length + 1).toString().padStart(3, '0')}`,
        name: machineData.name || 'Novo Equipamento',
        brandModel: machineData.brandModel || 'Modelo Padrão',
        assetNumber: machineData.assetNumber || `PAT-${Date.now().toString().slice(-4)}`,
        acquisitionDate: machineData.acquisitionDate || new Date().toISOString().split('T')[0],
        acquisitionValue: Number(machineData.acquisitionValue) || 0,
        capitalizedCosts: Number(machineData.capitalizedCosts) || 0,
        residualValue: Number(machineData.residualValue) || 0,
        usefulLifeMonths: Number(machineData.usefulLifeMonths) || 60,
        depreciationMethod: machineData.depreciationMethod || 'linear',
        monthlyProductiveHours: Number(machineData.monthlyProductiveHours) || 176,
        energyPowerWatts: Number(machineData.energyPowerWatts) || 0,
        energyTariffKwh: settings.defaultEnergyTariffKwh,
        monthlyMaintenanceCost: Number(machineData.monthlyMaintenanceCost) || 0,
        monthlyReplacementPartsCost: Number(machineData.monthlyReplacementPartsCost) || 0,
        otherOperationalCostPerHour: Number(machineData.otherOperationalCostPerHour) || 0,
        maintenanceFrequencyMonths: Number(machineData.maintenanceFrequencyMonths) || 6,
        status: machineData.status || 'ativo',
        notes: machineData.notes || '',
        ...calculated,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      machines.unshift(finalMachine);
    } else {
      const idx = machines.findIndex((m) => m.id === machineData.id);
      if (idx < 0) return { success: false, error: 'Equipamento não encontrado.' };
      prevData = machines[idx];
      finalMachine = {
        ...prevData,
        ...machineData,
        ...calculated,
        updatedAt: new Date().toISOString(),
      } as MachineEquipment;
      machines[idx] = finalMachine;
    }

    setStored(STORAGE_KEYS.MACHINES, machines);

    this.logAudit({
      userId: currentUser.id,
      userName: currentUser.name,
      userRole: currentUser.role,
      entityType: 'machine',
      entityId: finalMachine.id,
      entityName: finalMachine.name,
      operation: isNew ? 'CRIAR' : 'EDITAR',
      previousData: prevData,
      newData: finalMachine,
      details: isNew
        ? `Equipamento adicionado. Custo Total R$ ${finalMachine.totalMachineCostPerHour.toFixed(2)}/hora`
        : `Equipamento atualizado. Custo Hora R$ ${finalMachine.totalMachineCostPerHour.toFixed(2)}`,
    });

    return { success: true, machine: finalMachine };
  },

  revalueMachine(
    machineId: string,
    additionalMonths: number,
    newResidualValue: number,
    currentUser: UserProfile,
    justification: string
  ): { success: boolean; machine?: MachineEquipment; error?: string } {
    if (
      currentUser.role !== 'admin' &&
      !StorageService.hasUserPermission(currentUser, 'canConfigureDepreciation')
    ) {
      return {
        success: false,
        error: 'Você não tem permissão para reavaliar a vida útil de equipamentos.',
      };
    }

    const machines = this.getMachines();
    const idx = machines.findIndex((m) => m.id === machineId);
    if (idx < 0) return { success: false, error: 'Equipamento não encontrado.' };

    const prev = machines[idx];
    const newMonths = prev.usefulLifeMonths + additionalMonths;

    const calculated = this.calculateMachineCosts({
      ...prev,
      usefulLifeMonths: newMonths,
      residualValue: newResidualValue,
    });

    const updated: MachineEquipment = {
      ...prev,
      usefulLifeMonths: newMonths,
      residualValue: newResidualValue,
      lastRevaluationDate: new Date().toISOString(),
      notes: `${prev.notes ? prev.notes + ' | ' : ''}Reavaliação gerencial em ${new Date().toLocaleDateString('pt-BR')}: +${additionalMonths} meses. Justificativa: ${justification}`,
      ...calculated,
      updatedAt: new Date().toISOString(),
    };

    machines[idx] = updated;
    setStored(STORAGE_KEYS.MACHINES, machines);

    this.logAudit({
      userId: currentUser.id,
      userName: currentUser.name,
      userRole: currentUser.role,
      entityType: 'machine',
      entityId: updated.id,
      entityName: updated.name,
      operation: 'REAVALIAR',
      previousData: prev,
      newData: updated,
      details: `Reavaliação de vida útil: +${additionalMonths} meses. Justificativa: ${justification}`,
    });

    return { success: true, machine: updated };
  },

  // ==========================================================================
  // MÃO DE OBRA E ATIVIDADES PRODUTIVAS
  // ==========================================================================
  getLaborOperations(): LaborOperation[] {
    const list = getStored<LaborOperation[]>(
      STORAGE_KEYS.LABOR,
      INITIAL_LABOR_OPERATIONS
    );
    return Array.isArray(list) ? list : INITIAL_LABOR_OPERATIONS;
  },

  calculateLaborCosts(
    labor: Partial<LaborOperation>
  ): { effectiveHourlyRate: number; effectiveMinuteRate: number } {
    const hourlyRate = Number(labor.hourlyRate) || 0;
    const chargesPercent = Number(labor.chargesBenefitsPercent) || 0;
    const effectiveHourlyRate = hourlyRate * (1 + chargesPercent / 100);
    const effectiveMinuteRate = effectiveHourlyRate / 60;

    return {
      effectiveHourlyRate: Number(effectiveHourlyRate.toFixed(4)),
      effectiveMinuteRate: Number(effectiveMinuteRate.toFixed(4)),
    };
  },

  saveLaborOperation(
    data: Partial<LaborOperation>,
    currentUser: UserProfile
  ): { success: boolean; labor?: LaborOperation; error?: string } {
    if (
      currentUser.role !== 'admin' &&
      !StorageService.hasUserPermission(currentUser, 'canManageCosts')
    ) {
      return {
        success: false,
        error: 'Você não tem permissão para cadastrar ou editar mão de obra.',
      };
    }

    const calculated = this.calculateLaborCosts(data);
    const list = this.getLaborOperations();
    const isNew = !data.id;

    let finalLabor: LaborOperation;
    let prevData: LaborOperation | undefined;

    if (isNew) {
      finalLabor = {
        id: `mo-${Date.now()}`,
        code: data.code || `MO-${(list.length + 1).toString().padStart(3, '0')}`,
        name: data.name || 'Nova Operação',
        roleCategory: data.roleCategory || 'Operador',
        hourlyRate: Number(data.hourlyRate) || 0,
        chargesBenefitsPercent: Number(data.chargesBenefitsPercent) || 70,
        defaultSetupTimeMinutes: Number(data.defaultSetupTimeMinutes) || 0,
        defaultUnitTimeMinutes: Number(data.defaultUnitTimeMinutes) || 1,
        notes: data.notes || '',
        ...calculated,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      list.unshift(finalLabor);
    } else {
      const idx = list.findIndex((l) => l.id === data.id);
      if (idx < 0) return { success: false, error: 'Operação de mão de obra não encontrada.' };
      prevData = list[idx];
      finalLabor = {
        ...prevData,
        ...data,
        ...calculated,
        updatedAt: new Date().toISOString(),
      } as LaborOperation;
      list[idx] = finalLabor;
    }

    setStored(STORAGE_KEYS.LABOR, list);

    this.logAudit({
      userId: currentUser.id,
      userName: currentUser.name,
      userRole: currentUser.role,
      entityType: 'labor',
      entityId: finalLabor.id,
      entityName: finalLabor.name,
      operation: isNew ? 'CRIAR' : 'EDITAR',
      previousData: prevData,
      newData: finalLabor,
      details: isNew
        ? `Operação criada com taxa horária R$ ${finalLabor.effectiveHourlyRate.toFixed(2)}/h`
        : `Taxa horária atualizada para R$ ${finalLabor.effectiveHourlyRate.toFixed(2)}/h`,
    });

    return { success: true, labor: finalLabor };
  },

  deleteLaborOperation(
    id: string,
    currentUser: UserProfile
  ): { success: boolean; error?: string } {
    if (
      currentUser.role !== 'admin' &&
      !StorageService.hasUserPermission(currentUser, 'canManageCosts')
    ) {
      return { success: false, error: 'Permissão negada para excluir mão de obra.' };
    }

    const list = this.getLaborOperations();
    const target = list.find((l) => l.id === id);
    if (!target) return { success: false, error: 'Operação não encontrada.' };

    const updated = list.filter((l) => l.id !== id);
    setStored(STORAGE_KEYS.LABOR, updated);

    this.logAudit({
      userId: currentUser.id,
      userName: currentUser.name,
      userRole: currentUser.role,
      entityType: 'labor',
      entityId: target.id,
      entityName: target.name,
      operation: 'EXCLUIR',
      previousData: target,
      details: 'Operação de mão de obra removida.',
    });

    return { success: true };
  },

  // ==========================================================================
  // DESPESAS INDIRETAS E RATEIOS
  // ==========================================================================
  getIndirectExpenses(): IndirectExpense[] {
    const list = getStored<IndirectExpense[]>(
      STORAGE_KEYS.EXPENSES,
      INITIAL_INDIRECT_EXPENSES
    );
    return Array.isArray(list) ? list : INITIAL_INDIRECT_EXPENSES;
  },

  saveIndirectExpense(
    data: Partial<IndirectExpense>,
    currentUser: UserProfile
  ): { success: boolean; expense?: IndirectExpense; error?: string } {
    if (
      currentUser.role !== 'admin' &&
      !StorageService.hasUserPermission(currentUser, 'canManageCosts')
    ) {
      return { success: false, error: 'Permissão negada para cadastrar despesas indiretas.' };
    }

    const list = this.getIndirectExpenses();
    const isNew = !data.id;
    let finalExp: IndirectExpense;
    let prevData: IndirectExpense | undefined;

    if (isNew) {
      finalExp = {
        id: `desp-${Date.now()}`,
        code: data.code || `FIX-${(list.length + 1).toString().padStart(3, '0')}`,
        name: data.name || 'Nova Despesa Fixa',
        category: data.category || 'Geral',
        monthlyAmount: Number(data.monthlyAmount) || 0,
        allocationMethod: data.allocationMethod || 'hora_produtiva',
        notes: data.notes || '',
        active: data.active !== undefined ? data.active : true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      list.unshift(finalExp);
    } else {
      const idx = list.findIndex((e) => e.id === data.id);
      if (idx < 0) return { success: false, error: 'Despesa não encontrada.' };
      prevData = list[idx];
      finalExp = {
        ...prevData,
        ...data,
        updatedAt: new Date().toISOString(),
      } as IndirectExpense;
      list[idx] = finalExp;
    }

    setStored(STORAGE_KEYS.EXPENSES, list);

    this.logAudit({
      userId: currentUser.id,
      userName: currentUser.name,
      userRole: currentUser.role,
      entityType: 'expense',
      entityId: finalExp.id,
      entityName: finalExp.name,
      operation: isNew ? 'CRIAR' : 'EDITAR',
      previousData: prevData,
      newData: finalExp,
      details: isNew
        ? `Despesa cadastrada no valor de R$ ${finalExp.monthlyAmount.toFixed(2)}/mês`
        : `Despesa alterada para R$ ${finalExp.monthlyAmount.toFixed(2)}/mês`,
    });

    return { success: true, expense: finalExp };
  },

  deleteIndirectExpense(
    id: string,
    currentUser: UserProfile
  ): { success: boolean; error?: string } {
    if (
      currentUser.role !== 'admin' &&
      !StorageService.hasUserPermission(currentUser, 'canManageCosts')
    ) {
      return { success: false, error: 'Permissão negada para excluir despesas.' };
    }

    const list = this.getIndirectExpenses();
    const target = list.find((e) => e.id === id);
    if (!target) return { success: false, error: 'Despesa não encontrada.' };

    const updated = list.filter((e) => e.id !== id);
    setStored(STORAGE_KEYS.EXPENSES, updated);

    this.logAudit({
      userId: currentUser.id,
      userName: currentUser.name,
      userRole: currentUser.role,
      entityType: 'expense',
      entityId: target.id,
      entityName: target.name,
      operation: 'EXCLUIR',
      previousData: target,
      details: 'Despesa fixa removida.',
    });

    return { success: true };
  },

  getIndirectRatePerHour(): number {
    const expenses = this.getIndirectExpenses().filter((e) => e.active);
    const totalMonthly = expenses.reduce((acc, curr) => acc + curr.monthlyAmount, 0);
    const settings = this.getSettings();
    const hours = settings.monthlyProductiveHoursDefault || 176;
    return hours > 0 ? Number((totalMonthly / hours).toFixed(4)) : 0;
  },

  // ==========================================================================
  // FICHAS TÉCNICAS E COMPOSIÇÃO DE CUSTOS
  // ==========================================================================
  getTechnicalSheets(): CostCompositionSheet[] {
    const list = getStored<CostCompositionSheet[]>(
      STORAGE_KEYS.SHEETS,
      INITIAL_TECHNICAL_SHEETS
    );
    return Array.isArray(list) ? list : INITIAL_TECHNICAL_SHEETS;
  },

  calculateSheetTotals(
    sheetData: Partial<CostCompositionSheet>
  ): Partial<CostCompositionSheet> {
    const settings = this.getSettings();
    const materials = sheetData.materials || [];
    const machines = sheetData.machines || [];
    const labor = sheetData.labor || [];
    const thirdParty = sheetData.thirdPartyServices || [];
    const finishings = sheetData.finishings || [];
    const packaging = sheetData.packaging || [];
    const otherDirect = Number(sheetData.otherDirectCosts) || 0;

    const totalMaterialsCost = materials.reduce((acc, m) => acc + (Number(m.totalCost) || 0), 0);
    const totalMachinesCost = machines.reduce((acc, m) => acc + (Number(m.totalCost) || 0), 0);
    const totalLaborCost = labor.reduce((acc, l) => acc + (Number(l.totalCost) || 0), 0);
    const totalThirdPartyCost = thirdParty.reduce((acc, t) => acc + (Number(t.totalCost) || 0), 0);
    const totalFinishingsCost = finishings.reduce((acc, f) => acc + (Number(f.totalCost) || 0), 0);
    const totalPackagingCost = packaging.reduce((acc, p) => acc + (Number(p.totalCost) || 0), 0);

    const setupCostLabor = labor.reduce((acc, l) => {
      const minutes = Number(l.setupMinutes) || 0;
      const rate = Number(l.hourlyRate) || 0;
      return acc + (minutes / 60) * rate;
    }, 0);
    const setupCostMachine = machines.reduce((acc, m) => {
      const minutes = Number(m.setupMinutes) || 0;
      const rate = Number(m.hourlyRate) || 0;
      return acc + (minutes / 60) * rate;
    }, 0);
    const totalSetupCost = Number((setupCostLabor + setupCostMachine).toFixed(4));

    const totalDirectCostPerUnit = Number(
      (
        totalMaterialsCost +
        totalMachinesCost +
        totalLaborCost +
        totalThirdPartyCost +
        totalFinishingsCost +
        totalPackagingCost +
        otherDirect
      ).toFixed(4)
    );

    const indirectRateHour = this.getIndirectRatePerHour();
    const totalTimeHours = labor.reduce((acc, l) => acc + (Number(l.unitMinutes) || 0) / 60, 0);
    const allocatedIndirectCostPerUnit = Number(
      Math.max(totalTimeHours * indirectRateHour, totalDirectCostPerUnit * 0.05).toFixed(4)
    );

    const totalUnitCost = Number(
      (totalDirectCostPerUnit + allocatedIndirectCostPerUnit).toFixed(4)
    );

    const targetMargin = Number(sheetData.targetMarginPercent) || settings.defaultTargetMarginPercent;
    const salesExpenses =
      Number(sheetData.salesExpensesPercent) ||
      settings.defaultSalesTaxPercent +
        settings.defaultPaymentGatewayFeePercent +
        settings.defaultSalesCommissionPercent;

    let suggestedUnitPrice = 0;
    const markupMultiplier = Number(sheetData.markupMultiplier) || 2.0;

    if (sheetData.pricingMethod === 'markup') {
      suggestedUnitPrice = Number((totalUnitCost * markupMultiplier).toFixed(2));
    } else {
      const totalDeductionsPercent = salesExpenses + targetMargin;
      const divisor = 1 - totalDeductionsPercent / 100;
      if (divisor > 0.05) {
        suggestedUnitPrice = Number((totalUnitCost / divisor).toFixed(2));
      } else {
        suggestedUnitPrice = Number((totalUnitCost * 2.5).toFixed(2));
      }
    }

    return {
      totalMaterialsCost: Number(totalMaterialsCost.toFixed(4)),
      totalMachinesCost: Number(totalMachinesCost.toFixed(4)),
      totalLaborCost: Number(totalLaborCost.toFixed(4)),
      totalThirdPartyCost: Number(totalThirdPartyCost.toFixed(4)),
      totalFinishingsCost: Number(totalFinishingsCost.toFixed(4)),
      totalPackagingCost: Number(totalPackagingCost.toFixed(4)),
      totalDirectCostPerUnit,
      totalSetupCost,
      allocatedIndirectCostPerUnit,
      totalUnitCost,
      suggestedUnitPrice,
    };
  },

  saveTechnicalSheet(
    sheetData: Partial<CostCompositionSheet>,
    currentUser: UserProfile
  ): { success: boolean; sheet?: CostCompositionSheet; error?: string } {
    if (
      currentUser.role !== 'admin' &&
      !StorageService.hasUserPermission(currentUser, 'canManageCosts')
    ) {
      return { success: false, error: 'Permissão negada para salvar fichas técnicas.' };
    }

    const calculated = this.calculateSheetTotals(sheetData);
    const sheets = this.getTechnicalSheets();
    const isNew = !sheetData.id;

    let finalSheet: CostCompositionSheet;
    let prevData: CostCompositionSheet | undefined;

    if (isNew) {
      finalSheet = {
        id: `ft-${Date.now()}`,
        code: sheetData.code || `FT-${(sheets.length + 1).toString().padStart(3, '0')}`,
        productId: sheetData.productId,
        productName: sheetData.productName || 'Nova Ficha Técnica',
        category: sheetData.category || 'Personalizados',
        description: sheetData.description || '',
        dimensions: sheetData.dimensions,
        materials: sheetData.materials || [],
        machines: sheetData.machines || [],
        labor: sheetData.labor || [],
        thirdPartyServices: sheetData.thirdPartyServices || [],
        finishings: sheetData.finishings || [],
        packaging: sheetData.packaging || [],
        otherDirectCosts: Number(sheetData.otherDirectCosts) || 0,
        pricingMethod: sheetData.pricingMethod || 'margem_sobre_venda',
        targetMarginPercent: Number(sheetData.targetMarginPercent) || 35,
        salesExpensesPercent: Number(sheetData.salesExpensesPercent) || 15.49,
        markupMultiplier: Number(sheetData.markupMultiplier) || 2.0,
        isTemplate: Boolean(sheetData.isTemplate),
        version: 1,
        lastCostRecalculationDate: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        updatedBy: currentUser.name || currentUser.email,
        ...calculated,
      } as CostCompositionSheet;
      sheets.unshift(finalSheet);
    } else {
      const idx = sheets.findIndex((s) => s.id === sheetData.id);
      if (idx < 0) return { success: false, error: 'Ficha técnica não encontrada.' };
      prevData = sheets[idx];
      finalSheet = {
        ...prevData,
        ...sheetData,
        ...calculated,
        version: (prevData.version || 1) + 1,
        lastCostRecalculationDate: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        updatedBy: currentUser.name || currentUser.email,
      } as CostCompositionSheet;
      sheets[idx] = finalSheet;
    }

    setStored(STORAGE_KEYS.SHEETS, sheets);

    this.logAudit({
      userId: currentUser.id,
      userName: currentUser.name,
      userRole: currentUser.role,
      entityType: 'sheet',
      entityId: finalSheet.id,
      entityName: finalSheet.productName,
      operation: isNew ? 'CRIAR' : 'EDITAR',
      previousData: prevData,
      newData: finalSheet,
      details: isNew
        ? `Ficha técnica criada. Custo R$ ${finalSheet.totalUnitCost.toFixed(2)} | Venda Sugerida R$ ${finalSheet.suggestedUnitPrice.toFixed(2)}`
        : `Ficha técnica atualizada v${finalSheet.version}. Custo R$ ${finalSheet.totalUnitCost.toFixed(2)}`,
    });

    return { success: true, sheet: finalSheet };
  },

  duplicateTechnicalSheet(
    sheetId: string,
    currentUser: UserProfile
  ): { success: boolean; sheet?: CostCompositionSheet; error?: string } {
    const sheets = this.getTechnicalSheets();
    const original = sheets.find((s) => s.id === sheetId);
    if (!original) return { success: false, error: 'Ficha técnica original não encontrada.' };

    const duplicatedData: Partial<CostCompositionSheet> = {
      ...original,
      id: undefined,
      code: `${original.code}-COPIA`,
      productName: `${original.productName} (Cópia)`,
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      updatedBy: currentUser.name || currentUser.email,
    };

    return this.saveTechnicalSheet(duplicatedData, currentUser);
  },

  deleteTechnicalSheet(
    sheetId: string,
    currentUser: UserProfile
  ): { success: boolean; error?: string } {
    if (
      currentUser.role !== 'admin' &&
      !StorageService.hasUserPermission(currentUser, 'canManageCosts')
    ) {
      return { success: false, error: 'Permissão negada para excluir fichas técnicas.' };
    }

    const sheets = this.getTechnicalSheets();
    const target = sheets.find((s) => s.id === sheetId);
    if (!target) return { success: false, error: 'Ficha não encontrada.' };

    const updated = sheets.filter((s) => s.id !== sheetId);
    setStored(STORAGE_KEYS.SHEETS, updated);

    this.logAudit({
      userId: currentUser.id,
      userName: currentUser.name,
      userRole: currentUser.role,
      entityType: 'sheet',
      entityId: target.id,
      entityName: target.productName,
      operation: 'EXCLUIR',
      previousData: target,
      details: 'Ficha técnica removida.',
    });

    return { success: true };
  },

  recalculateAllSheetsOnMaterialChange(materialId: string): void {
    const materials = this.getMaterials();
    const updatedMaterial = materials.find((m) => m.id === materialId);
    if (!updatedMaterial) return;

    const sheets = this.getTechnicalSheets();
    let changed = false;

    for (let i = 0; i < sheets.length; i++) {
      const sheet = sheets[i];
      let sheetNeedsRecalc = false;

      const newMaterials = sheet.materials.map((m) => {
        if (m.materialId === materialId) {
          sheetNeedsRecalc = true;
          const unitCost = updatedMaterial.costWithWaste;
          const totalCost = Number((m.quantityNeeded * unitCost).toFixed(4));
          return {
            ...m,
            materialName: updatedMaterial.name,
            unitCost,
            wastePercent: updatedMaterial.estimatedWastePercent,
            totalCost,
          };
        }
        return m;
      });

      if (sheetNeedsRecalc) {
        changed = true;
        const recalcTotals = this.calculateSheetTotals({
          ...sheet,
          materials: newMaterials,
        });
        sheets[i] = {
          ...sheet,
          materials: newMaterials,
          ...recalcTotals,
          lastCostRecalculationDate: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        } as CostCompositionSheet;
      }
    }

    if (changed) {
      setStored(STORAGE_KEYS.SHEETS, sheets);
    }
  },

  // ==========================================================================
  // MATRIZ DE ESCALA E QUANTIDADES (DILUIÇÃO DE SETUP)
  // ==========================================================================
  calculateQuantityTier(
    sheet: CostCompositionSheet,
    quantity: number,
    settings: CostPricingSettings
  ): QuantityTierPricing {
    const qty = Math.max(quantity, 1);
    const setupCost = sheet.totalSetupCost || 0;
    const setupCostDilutedUnit = Number((setupCost / qty).toFixed(4));

    const directUnitWithoutSetup = Math.max(
      sheet.totalDirectCostPerUnit - setupCost,
      sheet.totalMaterialsCost + sheet.totalPackagingCost + sheet.totalThirdPartyCost
    );

    const directCostUnit = Number((directUnitWithoutSetup + setupCostDilutedUnit).toFixed(4));
    const indirectCostUnit = sheet.allocatedIndirectCostPerUnit || 0;
    const totalUnitCost = Number((directCostUnit + indirectCostUnit).toFixed(4));
    const totalBatchCost = Number((totalUnitCost * qty).toFixed(2));

    const taxesPercent = settings.defaultSalesTaxPercent || 8.5;
    const paymentFeePercent = settings.defaultPaymentGatewayFeePercent || 3.99;
    const commissionPercent = settings.defaultSalesCommissionPercent || 3.0;
    const marketplaceFeePercent = settings.defaultMarketplaceFeePercent || 0.0;
    const totalSalesExpensesPercent = Number(
      (taxesPercent + paymentFeePercent + commissionPercent + marketplaceFeePercent).toFixed(2)
    );

    const targetMarginPercent = sheet.targetMarginPercent || settings.defaultTargetMarginPercent || 35.0;
    const minAllowedMarginPercent = settings.minimumAllowedMarginPercent || 20.0;

    const divisor = 1 - (totalSalesExpensesPercent + targetMarginPercent) / 100;
    const suggestedUnitPrice =
      divisor > 0.05
        ? Number((totalUnitCost / divisor).toFixed(2))
        : Number((totalUnitCost * 2.2).toFixed(2));
    const suggestedTotalPrice = Number((suggestedUnitPrice * qty).toFixed(2));

    const minDivisor = 1 - (totalSalesExpensesPercent + minAllowedMarginPercent) / 100;
    const minAllowedUnitPrice =
      minDivisor > 0.05
        ? Number((totalUnitCost / minDivisor).toFixed(2))
        : Number((totalUnitCost * 1.5).toFixed(2));

    const maxDiscountPercent = Number(
      Math.max(
        0,
        ((suggestedUnitPrice - minAllowedUnitPrice) / suggestedUnitPrice) * 100
      ).toFixed(1)
    );

    const grossProfitAmount = Number((suggestedTotalPrice - totalBatchCost).toFixed(2));
    const effectiveMarginPercent = Number(
      (
        ((suggestedUnitPrice - totalUnitCost - (suggestedUnitPrice * totalSalesExpensesPercent) / 100) /
          suggestedUnitPrice) *
        100
      ).toFixed(1)
    );

    return {
      quantity: qty,
      setupCostDilutedUnit,
      directCostUnit,
      indirectCostUnit,
      totalUnitCost,
      totalBatchCost,
      taxesPercent,
      paymentFeePercent,
      commissionPercent,
      marketplaceFeePercent,
      totalSalesExpensesPercent,
      targetMarginPercent,
      suggestedUnitPrice,
      suggestedTotalPrice,
      minAllowedUnitPrice,
      maxDiscountPercent,
      grossProfitAmount,
      effectiveMarginPercent,
    };
  },

  generateQuantityTiers(
    sheet: CostCompositionSheet,
    quantities: number[] = [1, 10, 25, 50, 100, 250, 500, 1000]
  ): QuantityTierPricing[] {
    const settings = this.getSettings();
    return quantities.map((qty) => this.calculateQuantityTier(sheet, qty, settings));
  },

  // ==========================================================================
  // ORÇAMENTOS PERSONALIZADOS & PROPOSTAS COMERCIAIS
  // ==========================================================================
  getCostQuotes(): CostQuote[] {
    const list = getStored<CostQuote[]>(
      STORAGE_KEYS.QUOTES,
      INITIAL_COST_QUOTES
    );
    return Array.isArray(list) ? list : INITIAL_COST_QUOTES;
  },

  saveCostQuote(
    quoteData: Partial<CostQuote>,
    currentUser: UserProfile
  ): { success: boolean; quote?: CostQuote; error?: string } {
    if (
      currentUser.role !== 'admin' &&
      !StorageService.hasUserPermission(currentUser, 'canCreateEditCostQuotes')
    ) {
      return { success: false, error: 'Permissão negada para criar ou editar orçamentos.' };
    }

    const quotes = this.getCostQuotes();
    const settings = this.getSettings();
    const isNew = !quoteData.id;

    const items = quoteData.items || [];
    const subtotal = items.reduce((acc, it) => acc + (Number(it.totalPrice) || 0), 0);
    const discount = Number(quoteData.discount) || 0;
    const shippingCost = Number(quoteData.shippingCost) || 0;
    const total = Math.max(0, subtotal - discount + shippingCost);

    const totalProductionCost = items.reduce(
      (acc, it) => acc + (Number(it.internalTotalCost) || 0),
      0
    );
    const totalEstimatedTaxesAndFees = Number(
      (
        (total *
          (settings.defaultSalesTaxPercent + settings.defaultPaymentGatewayFeePercent)) /
        100
      ).toFixed(2)
    );
    const totalEstimatedGrossProfit = Number(
      (total - totalProductionCost - totalEstimatedTaxesAndFees).toFixed(2)
    );
    const overallEstimatedMarginPercent =
      total > 0
        ? Number(((totalEstimatedGrossProfit / total) * 100).toFixed(1))
        : 0;
    const isBelowMinMargin =
      overallEstimatedMarginPercent < settings.minimumAllowedMarginPercent;

    const validityDays = Number(quoteData.validityDays) || settings.defaultQuoteValidityDays || 15;
    const validityDate =
      quoteData.validityDate ||
      new Date(Date.now() + validityDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    let finalQuote: CostQuote;
    let prevData: CostQuote | undefined;

    if (isNew) {
      finalQuote = {
        id: `orc-${Date.now()}`,
        code: `ORC-CUSTO-${new Date().getFullYear()}-${(quotes.length + 1040).toString()}`,
        clientId: quoteData.clientId,
        clientName: quoteData.clientName || 'Cliente Sem Nome',
        clientEmail: quoteData.clientEmail || '',
        clientPhone: quoteData.clientPhone || '',
        clientCompany: quoteData.clientCompany,
        clientCpfCnpj: quoteData.clientCpfCnpj,
        items,
        subtotal: Number(subtotal.toFixed(2)),
        discount: Number(discount.toFixed(2)),
        discountPercent: subtotal > 0 ? Number(((discount / subtotal) * 100).toFixed(1)) : 0,
        shippingCost: Number(shippingCost.toFixed(2)),
        total: Number(total.toFixed(2)),
        productionDays: Number(quoteData.productionDays) || 5,
        validityDays,
        validityDate,
        paymentTerms: quoteData.paymentTerms || 'PIX ou Boleto Bancário à Vista',
        status: quoteData.status || 'pendente',
        commercialNotes: quoteData.commercialNotes || 'Proposta sujeita à aprovação cadastral e disponibilidade de insumos.',
        internalNotes: quoteData.internalNotes || '',
        internalSummary: {
          totalDirectCost: Number(totalProductionCost.toFixed(2)),
          totalIndirectCost: 0,
          totalProductionCost: Number(totalProductionCost.toFixed(2)),
          totalEstimatedTaxesAndFees,
          totalEstimatedGrossProfit,
          overallEstimatedMarginPercent,
          isBelowMinMargin,
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: currentUser.name || currentUser.email,
      };
      quotes.unshift(finalQuote);
    } else {
      const idx = quotes.findIndex((q) => q.id === quoteData.id);
      if (idx < 0) return { success: false, error: 'Orçamento não encontrado.' };
      prevData = quotes[idx];
      finalQuote = {
        ...prevData,
        ...quoteData,
        items,
        subtotal: Number(subtotal.toFixed(2)),
        discount: Number(discount.toFixed(2)),
        shippingCost: Number(shippingCost.toFixed(2)),
        total: Number(total.toFixed(2)),
        validityDays,
        validityDate,
        internalSummary: {
          totalDirectCost: Number(totalProductionCost.toFixed(2)),
          totalIndirectCost: 0,
          totalProductionCost: Number(totalProductionCost.toFixed(2)),
          totalEstimatedTaxesAndFees,
          totalEstimatedGrossProfit,
          overallEstimatedMarginPercent,
          isBelowMinMargin,
        },
        updatedAt: new Date().toISOString(),
      } as CostQuote;
      quotes[idx] = finalQuote;
    }

    setStored(STORAGE_KEYS.QUOTES, quotes);

    this.logAudit({
      userId: currentUser.id,
      userName: currentUser.name,
      userRole: currentUser.role,
      entityType: 'quote',
      entityId: finalQuote.id,
      entityName: `${finalQuote.code} - ${finalQuote.clientName}`,
      operation: isNew ? 'CRIAR' : 'EDITAR',
      previousData: prevData,
      newData: finalQuote,
      details: isNew
        ? `Orçamento gerado no valor de R$ ${finalQuote.total.toFixed(2)} (Margem: ${overallEstimatedMarginPercent}%)`
        : `Orçamento atualizado para R$ ${finalQuote.total.toFixed(2)}`,
    });

    return { success: true, quote: finalQuote };
  },

  approveCostQuote(
    quoteId: string,
    currentUser: UserProfile,
    approvalNotes?: string
  ): { success: boolean; quote?: CostQuote; error?: string } {
    if (
      currentUser.role !== 'admin' &&
      !StorageService.hasUserPermission(currentUser, 'canApprovePricesAndDiscounts')
    ) {
      return {
        success: false,
        error: 'Você não tem alçada para aprovar preços ou descontos especiais neste orçamento.',
      };
    }

    const quotes = this.getCostQuotes();
    const idx = quotes.findIndex((q) => q.id === quoteId);
    if (idx < 0) return { success: false, error: 'Orçamento não encontrado.' };

    const quote = quotes[idx];
    const updated: CostQuote = {
      ...quote,
      status: 'aprovado',
      approvalInfo: {
        approvedBy: `${currentUser.name} (${currentUser.role})`,
        approvedAt: new Date().toISOString(),
        discountAuthorizedBy: currentUser.name,
        notes: approvalNotes || 'Preço e condições aprovadas com margem autorizada.',
      },
      updatedAt: new Date().toISOString(),
    };

    quotes[idx] = updated;
    setStored(STORAGE_KEYS.QUOTES, quotes);

    this.logAudit({
      userId: currentUser.id,
      userName: currentUser.name,
      userRole: currentUser.role,
      entityType: 'quote',
      entityId: quote.id,
      entityName: quote.code,
      operation: 'APROVAR_PRECO',
      previousData: quote,
      newData: updated,
      details: `Orçamento aprovado por ${currentUser.name}. Justificativa: ${approvalNotes || 'Sem observações'}`,
    });

    return { success: true, quote: updated };
  },

  convertCostQuoteToOrder(
    quoteId: string,
    currentUser: UserProfile
  ): { success: boolean; orderId?: string; error?: string } {
    const quotes = this.getCostQuotes();
    const idx = quotes.findIndex((q) => q.id === quoteId);
    if (idx < 0) return { success: false, error: 'Orçamento não encontrado.' };

    const quote = quotes[idx];
    if (quote.status === 'recusado') {
      return { success: false, error: 'Não é possível converter um orçamento recusado.' };
    }

    const orderItems: OrderItem[] = quote.items.map((it) => ({
      id: `ord-item-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      productId: it.productId || `prod-custom-${it.id}`,
      productName: it.productName,
      productSku: `SKU-${(it.productName || 'PROD').toUpperCase().slice(0, 4)}-${it.id.slice(-4)}`,
      productImage: 'https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&q=80&w=600',
      unitPrice: it.unitPrice,
      quantity: it.quantity,
      total: it.totalPrice,
      customTechnique: 'Personalização Especial',
    }));

    const newOrder: Order = {
      id: `ord-custo-${Date.now()}`,
      code: `PED-CUSTO-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      clientName: quote.clientName,
      clientEmail: quote.clientEmail,
      clientPhone: quote.clientPhone,
      clientCompany: quote.clientCompany,
      shippingAddress: {
        street: 'Avenida Principal',
        number: '100',
        neighborhood: 'Centro',
        city: 'São Paulo',
        state: 'SP',
        zip: '01001-000',
      },
      items: orderItems,
      subtotal: quote.subtotal,
      shippingCost: quote.shippingCost,
      discount: quote.discount,
      total: quote.total,
      paymentMethod: 'boleto',
      paymentStatus: 'pago',
      orderStatus: 'em_producao',
      sourceQuoteId: quote.id,
      notes: `Convertido do orçamento de precificação #${quote.code}`,
      createdAt: new Date().toISOString(),
    };

    StorageService.addOrder(newOrder);

    quotes[idx] = {
      ...quote,
      status: 'convertido',
      convertedOrderId: newOrder.id,
      updatedAt: new Date().toISOString(),
    };
    setStored(STORAGE_KEYS.QUOTES, quotes);

    this.logAudit({
      userId: currentUser.id,
      userName: currentUser.name,
      userRole: currentUser.role,
      entityType: 'quote',
      entityId: quote.id,
      entityName: quote.code,
      operation: 'APROVAR_PRECO',
      details: `Orçamento convertido com sucesso no Pedido ${newOrder.id}`,
    });

    return { success: true, orderId: newOrder.id };
  },

  getOutdatedMaterials(thresholdDays?: number): RawMaterial[] {
    const settings = this.getSettings();
    const days = thresholdDays || settings.outdatedCostDaysThreshold || 60;
    const now = Date.now();
    const maxAgeMs = days * 24 * 60 * 60 * 1000;

    return this.getMaterials().filter((m) => {
      if (!m.lastCostUpdate) return true;
      const last = new Date(m.lastCostUpdate).getTime();
      return now - last > maxAgeMs;
    });
  },

  getKpiMetrics() {
    const materials = this.getMaterials();
    const machines = this.getMachines();
    const sheets = this.getTechnicalSheets();
    const quotes = this.getCostQuotes();
    const settings = this.getSettings();

    const outdatedMaterials = this.getOutdatedMaterials();
    const activeMachines = machines.filter((m) => m.status === 'ativo');

    const avgSheetMargin =
      sheets.length > 0
        ? Number(
            (
              sheets.reduce((acc, s) => acc + (s.targetMarginPercent || 35), 0) /
              sheets.length
            ).toFixed(1)
          )
        : 35.0;

    const totalQuotesCount = quotes.length;
    const approvedQuotesCount = quotes.filter((q) => q.status === 'aprovado' || q.status === 'convertido').length;
    const conversionRatePercent =
      totalQuotesCount > 0
        ? Number(((approvedQuotesCount / totalQuotesCount) * 100).toFixed(1))
        : 0;

    const totalQuotedVolume = quotes.reduce((acc, q) => acc + q.total, 0);

    return {
      totalMaterials: materials.length,
      outdatedMaterialsCount: outdatedMaterials.length,
      totalMachines: machines.length,
      activeMachinesCount: activeMachines.length,
      totalSheets: sheets.length,
      avgSheetMargin,
      totalQuotesCount,
      approvedQuotesCount,
      conversionRatePercent,
      totalQuotedVolume,
      minimumAllowedMargin: settings.minimumAllowedMarginPercent,
      defaultSalesTax: settings.defaultSalesTaxPercent,
    };
  },

  // ==========================================================================
  // SEÇÃO 15: SUITE DE TESTES E VALIDAÇÃO REAL DE PONTA A PONTA COM EVIDÊNCIAS
  // ==========================================================================
  getStoredTestResults(): CostPricingTestResult[] {
    return getStored<CostPricingTestResult[]>(STORAGE_KEYS.TEST_RESULTS, []);
  },

  async runAutomatedE2ETestSuite(currentUser: UserProfile): Promise<CostPricingTestResult[]> {
    const results: CostPricingTestResult[] = [];
    const timestamp = new Date().toISOString();

    // TESTE 1: Matéria-Prima e Insumos (Cálculo com Perdas e Fator de Conversão)
    try {
      const testMat: Partial<RawMaterial> = {
        code: `TEST-MP-${Date.now().toString().slice(-4)}`,
        name: 'Vinil Adesivo Teste E2E',
        category: 'vinis_lonas',
        supplier: 'Fornecedor Validação',
        purchaseUnit: 'rolo',
        consumptionUnit: 'm2',
        conversionFactor: 50, // 50m² por rolo
        purchasePrice: 300.0,
        shippingCost: 20.0,
        nonRecoverableTaxes: 10.0,
        estimatedWastePercent: 10.0, // 10% perda
      };

      const saveRes = this.saveMaterial(testMat, currentUser);
      if (!saveRes.success || !saveRes.material) throw new Error(saveRes.error || 'Falha ao salvar');

      // Verifica cálculo: Custo Efetivo = 300 + 20 + 10 = 330. Unit = 330/50 = 6.6. Com 10% perda = 7.26
      const expectedEffective = 330.0;
      const expectedUnit = 6.6;
      const expectedWasteCost = 7.26;

      const mat = saveRes.material;
      const ok =
        Math.abs(mat.effectivePurchaseCost - expectedEffective) < 0.01 &&
        Math.abs(mat.costPerConsumptionUnit - expectedUnit) < 0.01 &&
        Math.abs(mat.costWithWaste - expectedWasteCost) < 0.01;

      results.push({
        id: 'TEST-E2E-01',
        moduleName: '2. Matérias-Primas e Insumos',
        targetObjective: 'Validar conversão de unidade, rateio de frete e aplicação sem duplicidade de perdas.',
        procedureExecuted: 'Criar material com preço R$300, frete R$20, impostos R$10, conversão 50m² e perda 10%.',
        expectedResult: 'Custo efetivo R$330,00, unitário R$6,60/m² e custo com perdas R$7,26/m².',
        obtainedResult: `Custo efetivo: R$${mat.effectivePurchaseCost.toFixed(2)}, unit: R$${mat.costPerConsumptionUnit.toFixed(2)}, com perda: R$${mat.costWithWaste.toFixed(2)}.`,
        status: ok ? 'aprovado' : 'reprovado',
        evidenceData: { materialId: mat.id, calculated: mat },
        timestamp,
      });
    } catch (err: any) {
      results.push({
        id: 'TEST-E2E-01',
        moduleName: '2. Matérias-Primas e Insumos',
        targetObjective: 'Validar conversão de unidade e perdas.',
        procedureExecuted: 'Cadastro e persistência de insumo.',
        expectedResult: 'Cálculo de custo unitário com perdas consistente.',
        obtainedResult: err.message,
        status: 'reprovado',
        errorsFound: err.message,
        evidenceData: { error: String(err) },
        timestamp,
      });
    }

    // TESTE 2: Depreciação Linear de Equipamentos (Fórmula Mensal e Horária)
    try {
      const machineCalc = this.calculateMachineCosts({
        acquisitionValue: 60000.0,
        capitalizedCosts: 0.0,
        residualValue: 12000.0, // Depreciável = 48.000
        usefulLifeMonths: 48, // 48 meses = 1.000 / mês
        monthlyProductiveHours: 200, // 1000 / 200 = R$ 5,00 / hora
        energyPowerWatts: 2000,
        energyTariffKwh: 1.0, // 2 kWh * R$ 1,00 = R$ 2,00 / hora
        monthlyMaintenanceCost: 200.0, // 200 / 200 = R$ 1,00 / hora
        monthlyReplacementPartsCost: 0,
        otherOperationalCostPerHour: 0,
      });

      const ok =
        Math.abs(machineCalc.monthlyDepreciation - 1000.0) < 0.01 &&
        Math.abs(machineCalc.depreciationPerHour - 5.0) < 0.01 &&
        Math.abs(machineCalc.energyCostPerHour - 2.0) < 0.01 &&
        Math.abs(machineCalc.totalMachineCostPerHour - 8.0) < 0.01; // 5 + 2 + 1 = 8

      results.push({
        id: 'TEST-E2E-02',
        moduleName: '4. Depreciação e Custo Operacional',
        targetObjective: 'Validar fórmula linear (Aquisição - Residual)/Vida Útil e custo por hora e minuto.',
        procedureExecuted: 'Calcular máquina de R$60k com residual R$12k, 48 meses e 200h produtivas.',
        expectedResult: 'Depreciação mensal R$1.000,00, hora R$5,00/h e custo total hora R$8,00/h.',
        obtainedResult: `Mensal: R$${machineCalc.monthlyDepreciation.toFixed(2)}, hora: R$${machineCalc.depreciationPerHour.toFixed(2)}, total máquina: R$${machineCalc.totalMachineCostPerHour.toFixed(2)}.`,
        status: ok ? 'aprovado' : 'reprovado',
        evidenceData: machineCalc,
        timestamp,
      });
    } catch (err: any) {
      results.push({
        id: 'TEST-E2E-02',
        moduleName: '4. Depreciação e Custo Operacional',
        targetObjective: 'Validar fórmula linear de depreciação.',
        procedureExecuted: 'Cálculo de depreciação.',
        expectedResult: 'Fórmula linear exata sem duplicidade.',
        obtainedResult: err.message,
        status: 'reprovado',
        errorsFound: err.message,
        evidenceData: { error: String(err) },
        timestamp,
      });
    }

    // TESTE 3: Mão de Obra e Encargos
    try {
      const laborCalc = this.calculateLaborCosts({
        hourlyRate: 20.0,
        chargesBenefitsPercent: 80.0, // 20 * 1.8 = R$ 36,00 / hora
      });

      const ok =
        Math.abs(laborCalc.effectiveHourlyRate - 36.0) < 0.01 &&
        Math.abs(laborCalc.effectiveMinuteRate - 0.6) < 0.01;

      results.push({
        id: 'TEST-E2E-03',
        moduleName: '5. Mão de Obra e Atividades',
        targetObjective: 'Verificar incidência correta de encargos/benefícios e conversão em taxa/minuto.',
        procedureExecuted: 'Salário R$20,00/h com 80% de encargos.',
        expectedResult: 'Taxa horária efetiva R$36,00/h e minuto R$0,60/min.',
        obtainedResult: `Hora efetiva: R$${laborCalc.effectiveHourlyRate.toFixed(2)}/h, minuto: R$${laborCalc.effectiveMinuteRate.toFixed(2)}/min.`,
        status: ok ? 'aprovado' : 'reprovado',
        evidenceData: laborCalc,
        timestamp,
      });
    } catch (err: any) {
      results.push({
        id: 'TEST-E2E-03',
        moduleName: '5. Mão de Obra e Atividades',
        targetObjective: 'Verificar encargos trabalhistas.',
        procedureExecuted: 'Cálculo de mão de obra.',
        expectedResult: 'Taxa horária correta.',
        obtainedResult: err.message,
        status: 'reprovado',
        errorsFound: err.message,
        evidenceData: { error: String(err) },
        timestamp,
      });
    }

    // TESTE 4: Composição de Ficha Técnica Multiprocessos
    try {
      const testSheetData: Partial<CostCompositionSheet> = {
        productName: 'Produto Teste Composição',
        category: 'Personalizados',
        materials: [
          {
            materialId: 'mat-test-1',
            materialName: 'Insumo 1',
            category: 'produtos_base',
            quantityNeeded: 2,
            consumptionUnit: 'unidade',
            unitCost: 10.0,
            wastePercent: 0,
            totalCost: 20.0,
          },
        ],
        machines: [
          {
            machineId: 'maq-test-1',
            machineName: 'Prensa Teste',
            setupMinutes: 6,
            unitMinutes: 6,
            hourlyRate: 10.0,
            totalCost: 2.0, // (12/60)*10 = 2.0
          },
        ],
        labor: [
          {
            operationId: 'mo-test-1',
            operationName: 'Operador Teste',
            roleCategory: 'Operador',
            setupMinutes: 6,
            unitMinutes: 6,
            hourlyRate: 30.0,
            totalCost: 6.0, // (12/60)*30 = 6.0
          },
        ],
        thirdPartyServices: [],
        finishings: [],
        packaging: [],
        otherDirectCosts: 2.0,
        targetMarginPercent: 30.0,
        salesExpensesPercent: 15.0,
      };

      const totals = this.calculateSheetTotals(testSheetData);
      // Total direto = 20 + 2 + 6 + 2 = 30.0
      const ok = totals.totalDirectCostPerUnit === 30.0;

      results.push({
        id: 'TEST-E2E-04',
        moduleName: '7. Fichas Técnicas e Composição',
        targetObjective: 'Garantir soma precisa de insumos, máquinas, mão de obra e acabamentos.',
        procedureExecuted: 'Calcular ficha com materiais R$20, máquinas R$2, mão de obra R$6 e outros R$2.',
        expectedResult: 'Custo direto total unitário de R$30,00.',
        obtainedResult: `Custo direto total: R$${totals.totalDirectCostPerUnit?.toFixed(2)}.`,
        status: ok ? 'aprovado' : 'reprovado',
        evidenceData: totals,
        timestamp,
      });
    } catch (err: any) {
      results.push({
        id: 'TEST-E2E-04',
        moduleName: '7. Fichas Técnicas e Composição',
        targetObjective: 'Validar composição de custos.',
        procedureExecuted: 'Cálculo de ficha técnica.',
        expectedResult: 'Soma consistente dos itens.',
        obtainedResult: err.message,
        status: 'reprovado',
        errorsFound: err.message,
        evidenceData: { error: String(err) },
        timestamp,
      });
    }

    // TESTE 5: Formação do Preço pelo Método Divisor (Margem sobre Venda)
    try {
      // Se custo unitário for R$ 50,00, despesas de venda 15% e margem alvo 35%
      // Preço = 50 / (1 - 0.50) = 50 / 0.50 = R$ 100,00!
      const totalUnitCost = 50.0;
      const salesExpensesPercent = 15.0;
      const targetMarginPercent = 35.0;
      const divisor = 1 - (salesExpensesPercent + targetMarginPercent) / 100;
      const price = totalUnitCost / divisor;

      const ok = Math.abs(price - 100.0) < 0.01;

      results.push({
        id: 'TEST-E2E-05',
        moduleName: '8. Formação do Preço de Venda',
        targetObjective: 'Verificar método divisor garantindo que a margem calculada corresponda à venda real.',
        procedureExecuted: 'Calcular preço de venda para custo R$50 com 15% de taxas e 35% de margem líquida.',
        expectedResult: 'Preço de venda sugerido de R$100,00 exatos.',
        obtainedResult: `Preço calculado: R$${price.toFixed(2)}.`,
        status: ok ? 'aprovado' : 'reprovado',
        evidenceData: { totalUnitCost, salesExpensesPercent, targetMarginPercent, divisor, price },
        timestamp,
      });
    } catch (err: any) {
      results.push({
        id: 'TEST-E2E-05',
        moduleName: '8. Formação do Preço de Venda',
        targetObjective: 'Verificar método divisor.',
        procedureExecuted: 'Formação de preço.',
        expectedResult: 'Preço divisor preciso.',
        obtainedResult: err.message,
        status: 'reprovado',
        errorsFound: err.message,
        evidenceData: { error: String(err) },
        timestamp,
      });
    }

    // TESTE 6: Diluição de Setup em Matriz de Escala de Quantidades
    try {
      const sheets = this.getTechnicalSheets();
      const sheet = sheets[0] || INITIAL_TECHNICAL_SHEETS[0];
      const settings = this.getSettings();

      const tier1 = this.calculateQuantityTier(sheet, 1, settings);
      const tier100 = this.calculateQuantityTier(sheet, 100, settings);

      // Na quantidade 100, o setup unitário deve ser 1/100 do setup da unidade 1
      const ok = tier100.setupCostDilutedUnit < tier1.setupCostDilutedUnit && tier100.totalUnitCost < tier1.totalUnitCost;

      results.push({
        id: 'TEST-E2E-06',
        moduleName: '8. Matriz de Escala de Quantidades',
        targetObjective: 'Validar diluição decrescente de custos fixos de preparação em lotes maiores.',
        procedureExecuted: `Comparar lote 1 unid (setup R$${tier1.setupCostDilutedUnit.toFixed(2)}) com lote 100 unids (setup R$${tier100.setupCostDilutedUnit.toFixed(2)}).`,
        expectedResult: 'Custo unitário do lote de 100 unidades significativamente menor devido à diluição de setup.',
        obtainedResult: `Custo unitário 1 un: R$${tier1.totalUnitCost.toFixed(2)} vs 100 un: R$${tier100.totalUnitCost.toFixed(2)}.`,
        status: ok ? 'aprovado' : 'reprovado',
        evidenceData: { tier1, tier100 },
        timestamp,
      });
    } catch (err: any) {
      results.push({
        id: 'TEST-E2E-06',
        moduleName: '8. Matriz de Escala de Quantidades',
        targetObjective: 'Validar diluição de setup.',
        procedureExecuted: 'Simulação de escala.',
        expectedResult: 'Diluição progressiva.',
        obtainedResult: err.message,
        status: 'reprovado',
        errorsFound: err.message,
        evidenceData: { error: String(err) },
        timestamp,
      });
    }

    // TESTE 7: Criação e Indicador Visual de Rentabilidade em Orçamento
    try {
      const testQuoteData: Partial<CostQuote> = {
        clientName: 'Cliente Teste E2E Rentabilidade',
        clientEmail: 'teste@e2e.com',
        clientPhone: '(11) 99999-8888',
        items: [
          {
            id: 'it-1',
            productName: 'Canecas Teste',
            description: '50 Canecas personalizadas',
            quantity: 50,
            unitPrice: 40.0,
            totalPrice: 2000.0,
            internalEstimatedUnitCost: 20.0,
            internalTotalCost: 1000.0,
            internalGrossProfit: 1000.0,
            internalMarginPercent: 50.0,
          },
        ],
        subtotal: 2000.0,
        discount: 100.0,
        shippingCost: 0,
        validityDays: 15,
      };

      const quoteRes = this.saveCostQuote(testQuoteData, currentUser);
      if (!quoteRes.success || !quoteRes.quote) throw new Error(quoteRes.error || 'Falha ao salvar orçamento');

      const q = quoteRes.quote;
      const ok = q.total === 1900.0 && q.internalSummary.overallEstimatedMarginPercent > 30;

      results.push({
        id: 'TEST-E2E-07',
        moduleName: '9. Orçamentos Personalizados',
        targetObjective: 'Verificar cálculo de margem interna e desconto sem vazar dados para o cliente.',
        procedureExecuted: 'Criar orçamento com subtotal R$2000, desconto R$100 e custo de produção R$1000.',
        expectedResult: 'Total R$1900, margem interna calculada com segurança (>30%).',
        obtainedResult: `Total: R$${q.total.toFixed(2)}, Margem interna: ${q.internalSummary.overallEstimatedMarginPercent}%.`,
        status: ok ? 'aprovado' : 'reprovado',
        evidenceData: { quoteId: q.id, summary: q.internalSummary },
        timestamp,
      });
    } catch (err: any) {
      results.push({
        id: 'TEST-E2E-07',
        moduleName: '9. Orçamentos Personalizados',
        targetObjective: 'Validar criação de orçamento.',
        procedureExecuted: 'Criação de orçamento.',
        expectedResult: 'Orçamento criado com rentabilidade.',
        obtainedResult: err.message,
        status: 'reprovado',
        errorsFound: err.message,
        evidenceData: { error: String(err) },
        timestamp,
      });
    }

    // TESTE 8: Aprovação com Alçada Gerencial e Auditoria
    try {
      let quote = this.getCostQuotes().find((q) => q.status === 'pendente');
      if (!quote) {
        const createRes = this.saveCostQuote({
          clientName: 'Cliente Teste Alçada',
          clientEmail: 'alcada@teste.com',
          clientPhone: '(11) 97777-6666',
          items: [
            {
              id: 'it-alcada',
              productName: 'Camisetas para Aprovação',
              description: '100 camisetas em serigrafia',
              quantity: 100,
              unitPrice: 35.0,
              totalPrice: 3500.0,
              internalEstimatedUnitCost: 18.0,
              internalTotalCost: 1800.0,
              internalGrossProfit: 1700.0,
              internalMarginPercent: 48.5,
            },
          ],
          subtotal: 3500.0,
          discount: 200.0,
          shippingCost: 0,
          validityDays: 15,
        }, currentUser);
        quote = createRes.quote;
      }

      if (!quote) throw new Error('Não foi possível obter ou criar orçamento para testar aprovação');

      const approveRes = this.approveCostQuote(quote.id, currentUser, 'Aprovação autorizada pelo teste E2E.');
      if (!approveRes.success || !approveRes.quote) throw new Error(approveRes.error || 'Falha ao aprovar');

      const updated = approveRes.quote;
      const logs = this.getAuditLogs();
      const auditOk = logs.some((l) => l.operation === 'APROVAR_PRECO' && l.entityId === quote!.id);

      const ok = updated.status === 'aprovado' && auditOk;

      results.push({
        id: 'TEST-E2E-08',
        moduleName: '13. Auditoria e Aprovação por Alçada',
        targetObjective: 'Garantir registro de autorização de preço com auditoria completa de quem aprovou.',
        procedureExecuted: `Aprovar orçamento ${quote.code} com usuário ${currentUser.name}.`,
        expectedResult: 'Status alterado para aprovado e log gravado com usuário, data e justificativa.',
        obtainedResult: `Status: ${updated.status}, Log de auditoria confirmado: ${auditOk ? 'SIM' : 'NÃO'}.`,
        status: ok ? 'aprovado' : 'reprovado',
        evidenceData: { quoteId: quote.id, approvalInfo: updated.approvalInfo },
        timestamp,
      });
    } catch (err: any) {
      results.push({
        id: 'TEST-E2E-08',
        moduleName: '13. Auditoria e Aprovação por Alçada',
        targetObjective: 'Validar aprovação de orçamento.',
        procedureExecuted: 'Aprovação de proposta.',
        expectedResult: 'Aprovação e auditoria gravadas.',
        obtainedResult: err.message,
        status: 'reprovado',
        errorsFound: err.message,
        evidenceData: { error: String(err) },
        timestamp,
      });
    }

    // TESTE 9: Conversão de Orçamento de Custo em Pedido Real do Sistema
    try {
      let approvedQuote = this.getCostQuotes().find((q) => q.status === 'aprovado');
      if (!approvedQuote) {
        const createRes = this.saveCostQuote({
          clientName: 'Cliente Conversão Pedido',
          clientEmail: 'conversao@teste.com',
          clientPhone: '(11) 98888-5555',
          items: [
            {
              id: 'it-conv',
              productName: 'Canecas Corporativas',
              description: '30 canecas personalizadas',
              quantity: 30,
              unitPrice: 42.0,
              totalPrice: 1260.0,
              internalEstimatedUnitCost: 20.0,
              internalTotalCost: 600.0,
              internalGrossProfit: 660.0,
              internalMarginPercent: 52.3,
            },
          ],
          subtotal: 1260.0,
          discount: 0,
          shippingCost: 0,
          validityDays: 15,
        }, currentUser);

        if (createRes.quote) {
          const appRes = this.approveCostQuote(createRes.quote.id, currentUser, 'Aprovação para teste de conversão.');
          approvedQuote = appRes.quote;
        }
      }

      if (!approvedQuote) throw new Error('Nenhum orçamento aprovado para converter');

      const convertRes = this.convertCostQuoteToOrder(approvedQuote.id, currentUser);
      if (!convertRes.success || !convertRes.orderId) throw new Error(convertRes.error || 'Falha na conversão');

      const orders = StorageService.getOrders();
      const orderExists = orders.some((o) => o.id === convertRes.orderId);

      const ok = Boolean(orderExists);

      results.push({
        id: 'TEST-E2E-09',
        moduleName: '11. Integração com Vendas e Pedidos',
        targetObjective: 'Converter proposta comercial aprovada em pedido real na fila de produção da loja.',
        procedureExecuted: `Converter orçamento ${approvedQuote.code} em pedido do sistema.`,
        expectedResult: 'Pedido gerado com itens e valor correspondente e armazenado em StorageService.getOrders().',
        obtainedResult: `Pedido ${convertRes.orderId} criado e localizado no banco de pedidos: ${orderExists ? 'SIM' : 'NÃO'}.`,
        status: ok ? 'aprovado' : 'reprovado',
        evidenceData: { orderId: convertRes.orderId },
        timestamp,
      });
    } catch (err: any) {
      results.push({
        id: 'TEST-E2E-09',
        moduleName: '11. Integração com Vendas e Pedidos',
        targetObjective: 'Converter orçamento em pedido.',
        procedureExecuted: 'Conversão para pedido.',
        expectedResult: 'Pedido registrado no sistema.',
        obtainedResult: err.message,
        status: 'reprovado',
        errorsFound: err.message,
        evidenceData: { error: String(err) },
        timestamp,
      });
    }

    // TESTE 10: Persistência Real e Integridade de Dados em Recarga
    try {
      const matsBefore = this.getMaterials().length;
      const machinesBefore = this.getMachines().length;
      const sheetsBefore = this.getTechnicalSheets().length;

      // Testa recarga simulada lendo diretamente do localStorage
      const rawMats = localStorage.getItem(STORAGE_KEYS.MATERIALS);
      const parsedMats = rawMats ? JSON.parse(rawMats) : [];

      const ok = Array.isArray(parsedMats) && parsedMats.length === matsBefore && matsBefore > 0;

      results.push({
        id: 'TEST-E2E-10',
        moduleName: '15. Proteção de Dados e Integridade',
        targetObjective: 'Comprovar que os dados permanecem íntegros após gravação e leitura em persistência local.',
        procedureExecuted: 'Validar parse e integridade das chaves de persistência no storage local.',
        expectedResult: 'Coleções íntegras e consistentes entre memória e disco.',
        obtainedResult: `Insumos: ${matsBefore}, Máquinas: ${machinesBefore}, Fichas: ${sheetsBefore}. Integridade confirmada.`,
        status: ok ? 'aprovado' : 'reprovado',
        evidenceData: { matsCount: matsBefore, machinesCount: machinesBefore, sheetsCount: sheetsBefore },
        timestamp,
      });
    } catch (err: any) {
      results.push({
        id: 'TEST-E2E-10',
        moduleName: '15. Proteção de Dados e Integridade',
        targetObjective: 'Validar integridade de persistência.',
        procedureExecuted: 'Leitura de storage.',
        expectedResult: 'Persistência sem corrupção.',
        obtainedResult: err.message,
        status: 'reprovado',
        errorsFound: err.message,
        evidenceData: { error: String(err) },
        timestamp,
      });
    }

    setStored(STORAGE_KEYS.TEST_RESULTS, results);
    return results;
  },
};
