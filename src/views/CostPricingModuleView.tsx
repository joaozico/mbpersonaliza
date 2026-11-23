import React, { useState, useEffect, useMemo } from 'react';
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
  RawMaterialCategory,
  PurchaseUnit,
  ConsumptionUnit,
  SheetMaterialItem,
  SheetMachineItem,
  SheetLaborItem,
  SheetThirdPartyServiceItem,
  SheetFinishingItem,
  SheetPackagingItem,
  CostPricingTestResult,
} from '../types';
import { CostPricingService } from '../services/costPricingService';
import { StorageService } from '../services/storage';
import {
  DollarSign,
  TrendingUp,
  AlertTriangle,
  Clock,
  Layers,
  Cpu,
  Users,
  Settings,
  FileText,
  Printer,
  Plus,
  Edit2,
  Trash2,
  Copy,
  CheckCircle,
  XCircle,
  Search,
  Filter,
  BarChart3,
  ShieldCheck,
  RefreshCw,
  ShoppingBag,
  Info,
  ChevronRight,
  Calculator,
  ArrowRight,
  Eye,
  Sliders,
  Calendar,
  Lock,
  PlayCircle,
  CheckCircle2,
  ExternalLink,
  ShieldAlert,
} from 'lucide-react';

interface CostPricingModuleViewProps {
  currentUser: UserProfile;
}

type SubModuleTab =
  | 'dashboard'
  | 'materials'
  | 'machines'
  | 'depreciation'
  | 'labor'
  | 'indirect'
  | 'sheets'
  | 'pricing_simulator'
  | 'quotes'
  | 'quote_history'
  | 'reports'
  | 'settings'
  | 'audit'
  | 'validation_tests';

export const CostPricingModuleView: React.FC<CostPricingModuleViewProps> = ({ currentUser }) => {
  const [activeTab, setActiveTab] = useState<SubModuleTab>('dashboard');

  // Dados carregados do serviço
  const [settings, setSettings] = useState<CostPricingSettings>(() => CostPricingService.getSettings());
  const [materials, setMaterials] = useState<RawMaterial[]>(() => CostPricingService.getMaterials());
  const [machines, setMachines] = useState<MachineEquipment[]>(() => CostPricingService.getMachines());
  const [labor, setLabor] = useState<LaborOperation[]>(() => CostPricingService.getLaborOperations());
  const [expenses, setExpenses] = useState<IndirectExpense[]>(() => CostPricingService.getIndirectExpenses());
  const [sheets, setSheets] = useState<CostCompositionSheet[]>(() => CostPricingService.getTechnicalSheets());
  const [quotes, setQuotes] = useState<CostQuote[]>(() => CostPricingService.getCostQuotes());
  const [auditLogs, setAuditLogs] = useState<CostPricingAuditLog[]>(() => CostPricingService.getAuditLogs());
  const [testResults, setTestResults] = useState<CostPricingTestResult[]>(() =>
    CostPricingService.getStoredTestResults()
  );
  const [isRunningTests, setIsRunningTests] = useState(false);

  // Mensagens e feedback
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  const showNotice = (type: 'success' | 'error' | 'info', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  // Recarrega todos os dados
  const reloadData = () => {
    setSettings(CostPricingService.getSettings());
    setMaterials(CostPricingService.getMaterials());
    setMachines(CostPricingService.getMachines());
    setLabor(CostPricingService.getLaborOperations());
    setExpenses(CostPricingService.getIndirectExpenses());
    setSheets(CostPricingService.getTechnicalSheets());
    setQuotes(CostPricingService.getCostQuotes());
    setAuditLogs(CostPricingService.getAuditLogs());
    setTestResults(CostPricingService.getStoredTestResults());
  };

  useEffect(() => {
    CostPricingService.hydrateFromServer().then((res) => {
      reloadData();
      if (!res.success && res.error) {
        setNotification({ type: 'error', message: res.error });
      }
    });
  }, []);

  // Checagem de Permissão de Acesso ao Módulo
  const canViewModule =
    currentUser.role === 'admin' ||
    StorageService.hasUserPermission(currentUser, 'canViewCostPricingModule');

  const canManageCosts =
    currentUser.role === 'admin' ||
    StorageService.hasUserPermission(currentUser, 'canManageCosts');

  const canManageMachines =
    currentUser.role === 'admin' ||
    StorageService.hasUserPermission(currentUser, 'canManageMachines');

  const canConfigureDepreciation =
    currentUser.role === 'admin' ||
    StorageService.hasUserPermission(currentUser, 'canConfigureDepreciation');

  const canConfigurePricing =
    currentUser.role === 'admin' ||
    StorageService.hasUserPermission(currentUser, 'canConfigurePricingParameters');

  const canCreateEditQuotes =
    currentUser.role === 'admin' ||
    StorageService.hasUserPermission(currentUser, 'canCreateEditCostQuotes');

  const canApprovePrices =
    currentUser.role === 'admin' ||
    StorageService.hasUserPermission(currentUser, 'canApprovePricesAndDiscounts');

  const canViewReports =
    currentUser.role === 'admin' ||
    StorageService.hasUserPermission(currentUser, 'canViewPricingReports');

  // KPI Metrics
  const kpis = useMemo(() => CostPricingService.getKpiMetrics(), [materials, machines, sheets, quotes, settings]);
  const outdatedMaterials = useMemo(
    () => CostPricingService.getOutdatedMaterials(settings.outdatedCostDaysThreshold),
    [materials, settings]
  );
  const indirectRatePerHour = useMemo(() => CostPricingService.getIndirectRatePerHour(), [expenses, settings]);



  // ==========================================================================
  // ESTADOS DOS MODAIS
  // ==========================================================================
  const [materialModalOpen, setMaterialModalOpen] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<Partial<RawMaterial> | null>(null);

  const [machineModalOpen, setMachineModalOpen] = useState(false);
  const [editingMachine, setEditingMachine] = useState<Partial<MachineEquipment> | null>(null);

  const [revalueModalOpen, setRevalueModalOpen] = useState(false);
  const [revaluingMachine, setRevaluingMachine] = useState<MachineEquipment | null>(null);
  const [revalueMonths, setRevalueMonths] = useState(12);
  const [revalueResidual, setRevalueResidual] = useState(0);
  const [revalueReason, setRevalueReason] = useState('');

  const [laborModalOpen, setLaborModalOpen] = useState(false);
  const [editingLabor, setEditingLabor] = useState<Partial<LaborOperation> | null>(null);

  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Partial<IndirectExpense> | null>(null);

  const [sheetModalOpen, setSheetModalOpen] = useState(false);
  const [editingSheet, setEditingSheet] = useState<Partial<CostCompositionSheet> | null>(null);

  const [scaleSheet, setScaleSheet] = useState<CostCompositionSheet | null>(null);

  const [quoteModalOpen, setQuoteModalOpen] = useState(false);
  const [editingQuote, setEditingQuote] = useState<Partial<CostQuote> | null>(null);

  const [proposalModalOpen, setProposalModalOpen] = useState(false);
  const [viewingProposalQuote, setViewingProposalQuote] = useState<CostQuote | null>(null);

  const [approveModalOpen, setApproveModalOpen] = useState(false);
  const [approvingQuote, setApprovingQuote] = useState<CostQuote | null>(null);
  const [approvalNotes, setApprovalNotes] = useState('');

  // Filtros
  const [matSearch, setMatSearch] = useState('');
  const [matCategory, setMatCategory] = useState<string>('todos');

  const filteredMaterials = useMemo(() => {
    return materials.filter((m) => {
      const matchText =
        m.name.toLowerCase().includes(matSearch.toLowerCase()) ||
        m.code.toLowerCase().includes(matSearch.toLowerCase()) ||
        m.supplier.toLowerCase().includes(matSearch.toLowerCase());
      const matchCat = matCategory === 'todos' || m.category === matCategory;
      return matchText && matchCat;
    });
  }, [materials, matSearch, matCategory]);

  const [sheetSearch, setSheetSearch] = useState('');
  const filteredSheets = useMemo(() => {
    return sheets.filter(
      (s) =>
        s.productName.toLowerCase().includes(sheetSearch.toLowerCase()) ||
        s.code.toLowerCase().includes(sheetSearch.toLowerCase()) ||
        s.category.toLowerCase().includes(sheetSearch.toLowerCase())
    );
  }, [sheets, sheetSearch]);

  const [quoteSearch, setQuoteSearch] = useState('');
  const [quoteStatusFilter, setQuoteStatusFilter] = useState('todos');
  const filteredQuotes = useMemo(() => {
    return quotes.filter((q) => {
      const matchText =
        q.clientName.toLowerCase().includes(quoteSearch.toLowerCase()) ||
        q.code.toLowerCase().includes(quoteSearch.toLowerCase());
      const matchStatus = quoteStatusFilter === 'todos' || q.status === quoteStatusFilter;
      return matchText && matchStatus;
    });
  }, [quotes, quoteSearch, quoteStatusFilter]);

  // Se o usuário não tiver permissão de acesso ao módulo:
  if (!canViewModule) {
    return (
      <div className="min-h-[500px] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-rose-200 shadow-xl text-center space-y-4">
          <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto">
            <Lock className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-black text-slate-900">Acesso Restrito ao Módulo de Custos</h2>
          <p className="text-sm text-slate-600">
            Você não possui autorização para visualizar ou consultar os parâmetros de custos e precificação.
            Apenas administradores ou usuários com permissão concedida podem acessar esta área.
          </p>
          <div className="pt-2 text-xs text-slate-400">
            Solicite a permissão <code className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-mono">canViewCostPricingModule</code> com a gerência.
          </div>
        </div>
      </div>
    );
  }

  // Executar bateria de testes automatizados E2E (Seção 15)
  const handleRunE2ETests = async () => {
    setIsRunningTests(true);
    try {
      const results = await CostPricingService.runAutomatedE2ETestSuite(currentUser);
      setTestResults(results);
      showNotice('success', 'Bateria de 10 testes E2E executada com sucesso!');
      reloadData();
    } catch (err: any) {
      showNotice('error', `Erro na execução dos testes: ${err.message}`);
    } finally {
      setIsRunningTests(false);
    }
  };

  const handleSaveMaterial = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMaterial) return;
    const res = CostPricingService.saveMaterial(editingMaterial, currentUser);
    if (res.success) {
      showNotice('success', 'Matéria-prima salva com sucesso!');
      setMaterialModalOpen(false);
      setEditingMaterial(null);
      reloadData();
    } else {
      showNotice('error', res.error || 'Erro ao salvar matéria-prima.');
    }
  };

  const handleDeleteMaterial = (id: string) => {
    if (!confirm('Deseja realmente excluir este material?')) return;
    const res = CostPricingService.deleteMaterial(id, currentUser);
    if (res.success) {
      showNotice('success', 'Material removido.');
      reloadData();
    } else {
      showNotice('error', res.error || 'Erro ao remover material.');
    }
  };

  const handleSaveMachine = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMachine) return;
    const res = CostPricingService.saveMachine(editingMachine, currentUser);
    if (res.success) {
      showNotice('success', 'Máquina e custos operacionais salvos!');
      setMachineModalOpen(false);
      setEditingMachine(null);
      reloadData();
    } else {
      showNotice('error', res.error || 'Erro ao salvar máquina.');
    }
  };

  const handleRevalueMachineSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!revaluingMachine) return;
    const res = CostPricingService.revalueMachine(
      revaluingMachine.id,
      revalueMonths,
      revalueResidual,
      currentUser,
      revalueReason
    );
    if (res.success) {
      showNotice('success', 'Reavaliação gerencial registrada com sucesso!');
      setRevalueModalOpen(false);
      setRevaluingMachine(null);
      reloadData();
    } else {
      showNotice('error', res.error || 'Erro ao reavaliar equipamento.');
    }
  };

  const handleSaveLabor = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLabor) return;
    const res = CostPricingService.saveLaborOperation(editingLabor, currentUser);
    if (res.success) {
      showNotice('success', 'Operação de mão de obra salva!');
      setLaborModalOpen(false);
      setEditingLabor(null);
      reloadData();
    } else {
      showNotice('error', res.error || 'Erro ao salvar mão de obra.');
    }
  };

  const handleDeleteLabor = (id: string) => {
    if (!confirm('Deseja excluir esta operação de mão de obra?')) return;
    const res = CostPricingService.deleteLaborOperation(id, currentUser);
    if (res.success) {
      showNotice('success', 'Operação removida.');
      reloadData();
    } else {
      showNotice('error', res.error || 'Erro ao remover operação.');
    }
  };

  const handleSaveExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingExpense) return;
    const res = CostPricingService.saveIndirectExpense(editingExpense, currentUser);
    if (res.success) {
      showNotice('success', 'Despesa fixa cadastrada!');
      setExpenseModalOpen(false);
      setEditingExpense(null);
      reloadData();
    } else {
      showNotice('error', res.error || 'Erro ao salvar despesa.');
    }
  };

  const handleDeleteExpense = (id: string) => {
    if (!confirm('Excluir esta despesa indireta?')) return;
    const res = CostPricingService.deleteIndirectExpense(id, currentUser);
    if (res.success) {
      showNotice('success', 'Despesa excluída.');
      reloadData();
    } else {
      showNotice('error', res.error || 'Erro ao excluir.');
    }
  };

  const handleSaveSheet = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSheet) return;
    const res = CostPricingService.saveTechnicalSheet(editingSheet, currentUser);
    if (res.success) {
      showNotice('success', 'Ficha técnica e custos calculados com sucesso!');
      setSheetModalOpen(false);
      setEditingSheet(null);
      reloadData();
    } else {
      showNotice('error', res.error || 'Erro ao salvar ficha técnica.');
    }
  };

  const handleDuplicateSheet = (id: string) => {
    const res = CostPricingService.duplicateTechnicalSheet(id, currentUser);
    if (res.success) {
      showNotice('success', 'Ficha técnica duplicada com sucesso!');
      reloadData();
    } else {
      showNotice('error', res.error || 'Erro ao duplicar ficha.');
    }
  };

  const handleDeleteSheet = (id: string) => {
    if (!confirm('Deseja realmente remover esta ficha técnica?')) return;
    const res = CostPricingService.deleteTechnicalSheet(id, currentUser);
    if (res.success) {
      showNotice('success', 'Ficha técnica excluída.');
      reloadData();
    } else {
      showNotice('error', res.error || 'Erro ao excluir ficha.');
    }
  };

  const handleSaveQuote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingQuote) return;
    const res = CostPricingService.saveCostQuote(editingQuote, currentUser);
    if (res.success) {
      showNotice('success', 'Orçamento salvo com sucesso!');
      setQuoteModalOpen(false);
      setEditingQuote(null);
      reloadData();
    } else {
      showNotice('error', res.error || 'Erro ao salvar orçamento.');
    }
  };

  const handleApproveQuoteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!approvingQuote) return;
    const res = CostPricingService.approveCostQuote(approvingQuote.id, currentUser, approvalNotes);
    if (res.success) {
      showNotice('success', 'Orçamento e margem aprovados com sucesso!');
      setApproveModalOpen(false);
      setApprovingQuote(null);
      setApprovalNotes('');
      reloadData();
    } else {
      showNotice('error', res.error || 'Erro ao aprovar orçamento.');
    }
  };

  const handleConvertQuoteToOrder = (quoteId: string) => {
    if (!confirm('Deseja converter este orçamento em Pedido Oficial na loja?')) return;
    const res = CostPricingService.convertCostQuoteToOrder(quoteId, currentUser);
    if (res.success) {
      showNotice('success', `Pedido criado com sucesso! Código: ${res.orderId}`);
      reloadData();
    } else {
      showNotice('error', res.error || 'Falha ao converter orçamento.');
    }
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    const res = CostPricingService.updateSettings(settings, currentUser);
    if (res.success) {
      showNotice('success', 'Parâmetros de precificação salvos!');
      reloadData();
    } else {
      showNotice('error', res.error || 'Erro ao salvar configurações.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Header */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 sm:p-8 rounded-3xl shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#E6007E]/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-2 text-pink-400 font-bold text-xs uppercase tracking-wider mb-2">
              <Calculator className="w-4 h-4" />
              Módulo de Engenharia de Custos & Precificação
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Orçamento de Custos & Formação de Preço
            </h1>
            <p className="text-slate-300 text-sm mt-1 max-w-2xl">
              Papelaria personalizada, gráfica rápida, comunicação visual e brindes. Automação de fichas técnicas, depreciação linear de máquinas, perdas e rentabilidade garantida.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setEditingQuote({
                  items: [],
                  discount: 0,
                  shippingCost: 0,
                  validityDays: 15,
                  productionDays: 5,
                  paymentTerms: 'PIX ou Boleto Bancário à Vista',
                  commercialNotes: 'Proposta comercial MB Personaliza com garantia de qualidade.',
                });
                setQuoteModalOpen(true);
              }}
              className="px-4 py-2.5 bg-gradient-to-r from-[#E6007E] to-pink-600 hover:from-pink-600 hover:to-pink-700 text-white rounded-xl font-bold text-sm flex items-center gap-2 shadow-lg hover:shadow-pink-500/25 transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Novo Orçamento Rápido
            </button>
            <button
              type="button"
              onClick={() => {
                setEditingSheet({
                  category: 'Canecas',
                  targetMarginPercent: settings.defaultTargetMarginPercent,
                  pricingMethod: 'margem_sobre_venda',
                  materials: [],
                  machines: [],
                  labor: [],
                  thirdPartyServices: [],
                  finishings: [],
                  packaging: [],
                });
                setSheetModalOpen(true);
              }}
              className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold text-sm flex items-center gap-2 transition cursor-pointer backdrop-blur-md"
            >
              <Layers className="w-4 h-4" />
              Nova Ficha Técnica
            </button>
          </div>
        </div>

        {notification && (
          <div
            className={`mt-4 p-3 rounded-xl text-sm font-bold flex items-center gap-2 ${
              notification.type === 'success'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : notification.type === 'error'
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
            }`}
          >
            {notification.type === 'success' && <CheckCircle className="w-4 h-4" />}
            {notification.type === 'error' && <AlertTriangle className="w-4 h-4" />}
            {notification.type === 'info' && <Info className="w-4 h-4" />}
            <span>{notification.message}</span>
          </div>
        )}
      </div>

      {/* Navegação entre os 14 Submódulos + Testes */}
      <div className="bg-white rounded-2xl p-2 border border-slate-200 shadow-sm flex items-center gap-1 overflow-x-auto text-xs font-bold scrollbar-thin">
        {[
          { id: 'dashboard', label: '1. Painel & KPIs', icon: BarChart3 },
          { id: 'materials', label: '2. Matérias-Primas', icon: ShoppingBag, badge: outdatedMaterials.length },
          { id: 'machines', label: '3. Máquinas', icon: Cpu },
          { id: 'depreciation', label: '4. Depreciação & Energia', icon: TrendingUp },
          { id: 'labor', label: '5. Mão de Obra', icon: Users },
          { id: 'indirect', label: '6. Despesas Fixas', icon: DollarSign },
          { id: 'sheets', label: '7. Fichas Técnicas', icon: Layers },
          { id: 'pricing_simulator', label: '8. Formação de Preço', icon: Calculator },
          { id: 'quotes', label: '9. Orçamentos', icon: FileText },
          { id: 'quote_history', label: '10. Histórico', icon: Clock },
          { id: 'reports', label: '11. Relatórios', icon: BarChart3 },
          { id: 'settings', label: '12. Parâmetros', icon: Sliders },
          { id: 'audit', label: '13. Auditoria', icon: ShieldCheck },
          { id: 'validation_tests', label: '14. Testes & Validação E2E (Regra 15)', icon: ShieldAlert, badge: testResults.length > 0 ? testResults.filter((t) => t.status === 'aprovado').length : undefined },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as SubModuleTab)}
              className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl whitespace-nowrap transition cursor-pointer ${
                isActive
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
              {Boolean(tab.badge && tab.badge > 0) && (
                <span className="bg-amber-500 text-white text-[10px] px-1.5 py-0.2 rounded-full font-black">
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ==================================================================== */}
      {/* 1. PAINEL DE PRECIFICAÇÃO (DASHBOARD) */}
      {/* ==================================================================== */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          {outdatedMaterials.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-amber-900">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-100 rounded-xl text-amber-700">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-black text-sm">
                    {outdatedMaterials.length} Insumos com Custo Desatualizado há mais de {settings.outdatedCostDaysThreshold} dias
                  </h4>
                  <p className="text-xs text-amber-700">
                    A alta de fornecedores pode estar corroendo a margem real de produtos vendidos. Atualize os custos de compra para recalculá-los com segurança.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('materials')}
                className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl whitespace-nowrap cursor-pointer transition shadow-xs"
              >
                Revisar Insumos
              </button>
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                Fichas Técnicas Ativas
              </span>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-2xl font-black text-slate-900">{kpis.totalSheets}</span>
                <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
                  Margem Méd: {kpis.avgSheetMargin}%
                </span>
              </div>
              <span className="text-[11px] text-slate-400 mt-1 block">Composições completas de produtos</span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                Parque de Máquinas
              </span>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-2xl font-black text-slate-900">{kpis.activeMachinesCount}</span>
                <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">
                  {kpis.totalMachines} cadastradas
                </span>
              </div>
              <span className="text-[11px] text-slate-400 mt-1 block">Com depreciação e custo/hora ativos</span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-xs font-bold text-indigo-900 uppercase tracking-wider block">
                Taxa de Conversão Orçamentos
              </span>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-2xl font-black text-indigo-900">{kpis.conversionRatePercent}%</span>
                <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
                  {kpis.approvedQuotesCount} de {kpis.totalQuotesCount}
                </span>
              </div>
              <span className="text-[11px] text-slate-400 mt-1 block">Propostas aprovadas ou faturadas</span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                Rateio Indireto / Hora
              </span>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-2xl font-black text-slate-900">
                  R$ {indirectRatePerHour.toFixed(2)}
                </span>
                <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                  {expenses.filter((e) => e.active).length} despesas fixas
                </span>
              </div>
              <span className="text-[11px] text-slate-400 mt-1 block">Aluguel, softwares e luz rateados</span>
            </div>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-slate-900">Fichas Técnicas em Destaque</h3>
                <p className="text-xs text-slate-500">Custo direto, rateio de indiretos e preço de venda sugerido</p>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('sheets')}
                className="text-xs font-bold text-[#E6007E] hover:underline flex items-center gap-1 cursor-pointer"
              >
                Ver todas ({sheets.length}) <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {sheets.slice(0, 3).map((sheet) => (
                <div
                  key={sheet.id}
                  className="p-4 rounded-2xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-800">
                        {sheet.category}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">{sheet.code}</span>
                    </div>
                    <h4 className="font-bold text-sm text-slate-900">{sheet.productName}</h4>
                    <p className="text-xs text-slate-500 mt-1 line-clamp-2">{sheet.description}</p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-200/70 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-slate-400 block">Custo Unitário</span>
                      <span className="font-bold text-xs text-slate-700">R$ {sheet.totalUnitCost.toFixed(2)}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 block">Preço Sugerido</span>
                      <span className="font-black text-sm text-emerald-600">R$ {sheet.suggestedUnitPrice.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 2. CADASTRO DE MATÉRIAS-PRIMAS E INSUMOS */}
      {/* ==================================================================== */}
      {activeTab === 'materials' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-black text-slate-900">Catálogo de Matérias-Primas e Insumos</h2>
              <p className="text-xs text-slate-500">
                Custos de compra, fatores de conversão, fretes de aquisição e perdas reais de produção
              </p>
            </div>
            {canManageCosts && (
              <button
                type="button"
                onClick={() => {
                  setEditingMaterial({
                    category: 'papeis',
                    purchaseUnit: 'resma',
                    consumptionUnit: 'folha',
                    conversionFactor: 500,
                    purchasePrice: 0,
                    shippingCost: 0,
                    nonRecoverableTaxes: 0,
                    estimatedWastePercent: 3,
                    currentStock: 0,
                  });
                  setMaterialModalOpen(true);
                }}
                className="px-4 py-2 bg-slate-900 hover:bg-[#E6007E] text-white rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Cadastrar Insumo
              </button>
            )}
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar por nome, código ou fornecedor..."
                value={matSearch}
                onChange={(e) => setMatSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#E6007E] outline-none"
              />
            </div>
            <select
              value={matCategory}
              onChange={(e) => setMatCategory(e.target.value)}
              className="px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#E6007E] outline-none bg-white font-medium"
            >
              <option value="todos">Todas as Categorias</option>
              <option value="papeis">Papéis & Papelão</option>
              <option value="vinis_lonas">Vinis & Lonas</option>
              <option value="tintas_toners">Tintas & Toners</option>
              <option value="sublimacao_transfer">Sublimação & Transfer</option>
              <option value="produtos_base">Produtos Base (Canecas, Camisetas)</option>
              <option value="embalagens">Embalagens & Fitas</option>
              <option value="acabamentos">Acabamentos & Espirais</option>
              <option value="outros">Outros</option>
            </select>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-100">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-100 uppercase text-[10px]">
                <tr>
                  <th className="py-3 px-3">Código</th>
                  <th className="py-3 px-3">Nome / Categoria</th>
                  <th className="py-3 px-3">Fornecedor</th>
                  <th className="py-3 px-3">Unidade Compra / Consumo</th>
                  <th className="py-3 px-3 text-right">Preço Compra</th>
                  <th className="py-3 px-3 text-right">Perda %</th>
                  <th className="py-3 px-3 text-right">Custo Efetivo Unit.</th>
                  <th className="py-3 px-3 text-center">Última Atualização</th>
                  <th className="py-3 px-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredMaterials.map((mat) => {
                  const isOutdated = outdatedMaterials.some((om) => om.id === mat.id);
                  return (
                    <tr key={mat.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3 px-3 font-mono font-bold text-slate-500">{mat.code}</td>
                      <td className="py-3 px-3">
                        <span className="font-bold text-slate-900 block">{mat.name}</span>
                        <span className="text-[10px] text-slate-400 capitalize">{mat.category.replace('_', ' ')}</span>
                      </td>
                      <td className="py-3 px-3 text-slate-600">{mat.supplier}</td>
                      <td className="py-3 px-3 text-slate-600">
                        1 {mat.purchaseUnit} = {mat.conversionFactor} {mat.consumptionUnit}
                      </td>
                      <td className="py-3 px-3 text-right font-medium text-slate-800">
                        R$ {mat.purchasePrice.toFixed(2)}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-bold">
                          {mat.estimatedWastePercent}%
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <span className="font-black text-slate-900">
                          R$ {mat.costWithWaste.toFixed(4)}
                        </span>
                        <span className="text-[10px] text-slate-400 block">/{mat.consumptionUnit}</span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-bold inline-flex items-center gap-1 ${
                            isOutdated
                              ? 'bg-amber-100 text-amber-800 font-extrabold'
                              : 'bg-emerald-50 text-emerald-700'
                          }`}
                        >
                          {isOutdated && <AlertTriangle className="w-3 h-3" />}
                          {new Date(mat.lastCostUpdate).toLocaleDateString('pt-BR')}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right space-x-1 whitespace-nowrap">
                        {canManageCosts && (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingMaterial(mat);
                                setMaterialModalOpen(true);
                              }}
                              className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg cursor-pointer"
                              title="Editar Insumo"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteMaterial(mat.id)}
                              className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg cursor-pointer"
                              title="Excluir Insumo"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 3. MÁQUINAS E EQUIPAMENTOS */}
      {/* ==================================================================== */}
      {activeTab === 'machines' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-black text-slate-900">Parque de Máquinas & Equipamentos</h2>
              <p className="text-xs text-slate-500">
                Patrimônio, vida útil, potência elétrica e custos operacionais por hora produtiva
              </p>
            </div>
            {canManageMachines && (
              <button
                type="button"
                onClick={() => {
                  setEditingMachine({
                    status: 'ativo',
                    usefulLifeMonths: 60,
                    monthlyProductiveHours: 176,
                    depreciationMethod: 'linear',
                    energyPowerWatts: 1500,
                    energyTariffKwh: settings.defaultEnergyTariffKwh,
                    monthlyMaintenanceCost: 0,
                    monthlyReplacementPartsCost: 0,
                  });
                  setMachineModalOpen(true);
                }}
                className="px-4 py-2 bg-slate-900 hover:bg-[#E6007E] text-white rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Cadastrar Máquina
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {machines.map((m) => (
              <div
                key={m.id}
                className="p-5 rounded-2xl border border-slate-200 bg-white hover:border-slate-300 transition flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-[10px] font-mono font-bold text-slate-500">{m.code} | {m.assetNumber}</span>
                    <span
                      className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                        m.status === 'ativo'
                          ? 'bg-emerald-100 text-emerald-800'
                          : m.status === 'manutencao'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {m.status.toUpperCase()}
                    </span>
                  </div>

                  <h3 className="font-black text-base text-slate-900">{m.name}</h3>
                  <span className="text-xs text-slate-500 block mb-3">{m.brandModel}</span>

                  <div className="bg-slate-50 p-3 rounded-xl space-y-1.5 text-xs text-slate-600">
                    <div className="flex justify-between">
                      <span>Valor Aquisição:</span>
                      <strong className="text-slate-900">R$ {m.acquisitionValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Vida Útil:</span>
                      <strong>{m.usefulLifeMonths} meses ({Math.round(m.usefulLifeMonths / 12)} anos)</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Potência Elétrica:</span>
                      <strong>{m.energyPowerWatts} W ({m.energyConsumptionKwh} kWh)</strong>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <span className="text-[10px] text-slate-400 block">Custo Total / Hora</span>
                      <span className="text-base font-black text-indigo-900">
                        R$ {m.totalMachineCostPerHour.toFixed(2)}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 block">Por Minuto</span>
                      <span className="text-xs font-bold text-slate-700">
                        R$ {m.totalMachineCostPerMinute.toFixed(3)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2">
                    {canConfigureDepreciation && (
                      <button
                        type="button"
                        onClick={() => {
                          setRevaluingMachine(m);
                          setRevalueMonths(12);
                          setRevalueResidual(m.residualValue);
                          setRevalueReason('Equipamento em excelente estado operacional após vida útil.');
                          setRevalueModalOpen(true);
                        }}
                        className="px-2.5 py-1 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg cursor-pointer"
                        title="Reavaliação Gerencial de Vida Útil"
                      >
                        Reavaliar Vida Útil
                      </button>
                    )}
                    {canManageMachines && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingMachine(m);
                          setMachineModalOpen(true);
                        }}
                        className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg cursor-pointer"
                        title="Editar Equipamento"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 4. DEPRECIAÇÃO & CUSTO OPERACIONAL */}
      {/* ==================================================================== */}
      {activeTab === 'depreciation' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 space-y-6">
          <div>
            <h2 className="text-lg font-black text-slate-900">Demonstrativo de Depreciação Linear & Custos Operacionais</h2>
            <p className="text-xs text-slate-500">
              Cálculo auditado: Depreciação Mensal = (Aquisição + Custos Capitalizáveis - Residual) ÷ Meses. Sem duplicidade com despesas fixas.
            </p>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-100">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-100 uppercase text-[10px]">
                <tr>
                  <th className="py-3 px-3">Máquina</th>
                  <th className="py-3 px-3 text-right">Valor Depreciável</th>
                  <th className="py-3 px-3 text-right">Depreciação / Mês</th>
                  <th className="py-3 px-3 text-right">Depreciação / Hora</th>
                  <th className="py-3 px-3 text-right">Energia / Hora</th>
                  <th className="py-3 px-3 text-right">Manutenção / Hora</th>
                  <th className="py-3 px-3 text-right font-black text-slate-900">Total / Hora</th>
                  <th className="py-3 px-3 text-right font-black text-[#E6007E]">Total / Minuto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {machines.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3 px-3">
                      <span className="font-bold text-slate-900 block">{m.name}</span>
                      <span className="text-[10px] text-slate-400">{m.brandModel}</span>
                    </td>
                    <td className="py-3 px-3 text-right text-slate-600">
                      R$ {m.depreciableValue.toFixed(2)}
                    </td>
                    <td className="py-3 px-3 text-right text-slate-700 font-medium">
                      R$ {m.monthlyDepreciation.toFixed(2)}
                    </td>
                    <td className="py-3 px-3 text-right text-indigo-700 font-semibold">
                      R$ {m.depreciationPerHour.toFixed(4)}
                    </td>
                    <td className="py-3 px-3 text-right text-amber-700">
                      R$ {m.energyCostPerHour.toFixed(4)}
                    </td>
                    <td className="py-3 px-3 text-right text-slate-600">
                      R$ {(m.maintenanceCostPerHour + m.replacementPartsCostPerHour).toFixed(4)}
                    </td>
                    <td className="py-3 px-3 text-right font-black text-slate-900 bg-slate-50/60">
                      R$ {m.totalMachineCostPerHour.toFixed(2)}
                    </td>
                    <td className="py-3 px-3 text-right font-black text-[#E6007E] bg-slate-50/60">
                      R$ {m.totalMachineCostPerMinute.toFixed(4)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 5. MÃO DE OBRA E ATIVIDADES */}
      {/* ==================================================================== */}
      {activeTab === 'labor' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-black text-slate-900">Mão de Obra e Operações Produtivas</h2>
              <p className="text-xs text-slate-500">
                Encargos trabalhistas, benefícios e distinção entre tempo de setup (preparação do lote) e tempo unitário
              </p>
            </div>
            {canManageCosts && (
              <button
                type="button"
                onClick={() => {
                  setEditingLabor({
                    chargesBenefitsPercent: 70,
                    defaultSetupTimeMinutes: 5,
                    defaultUnitTimeMinutes: 2,
                    hourlyRate: 15,
                  });
                  setLaborModalOpen(true);
                }}
                className="px-4 py-2 bg-slate-900 hover:bg-[#E6007E] text-white rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Cadastrar Operação
              </button>
            )}
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-100">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-100 uppercase text-[10px]">
                <tr>
                  <th className="py-3 px-3">Código</th>
                  <th className="py-3 px-3">Atividade / Processo</th>
                  <th className="py-3 px-3">Categoria Profissional</th>
                  <th className="py-3 px-3 text-right">Salário Base / h</th>
                  <th className="py-3 px-3 text-right">Encargos %</th>
                  <th className="py-3 px-3 text-right">Custo Efetivo / Hora</th>
                  <th className="py-3 px-3 text-right">Custo Efetivo / Min</th>
                  <th className="py-3 px-3 text-center">Setup Padrão</th>
                  <th className="py-3 px-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {labor.map((l) => (
                  <tr key={l.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3 px-3 font-mono font-bold text-slate-500">{l.code}</td>
                    <td className="py-3 px-3">
                      <span className="font-bold text-slate-900 block">{l.name}</span>
                      <span className="text-[10px] text-slate-400">{l.notes}</span>
                    </td>
                    <td className="py-3 px-3 text-slate-600">{l.roleCategory}</td>
                    <td className="py-3 px-3 text-right text-slate-700">R$ {l.hourlyRate.toFixed(2)}</td>
                    <td className="py-3 px-3 text-right">
                      <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-700 font-bold">
                        +{l.chargesBenefitsPercent}%
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right font-black text-slate-900">
                      R$ {l.effectiveHourlyRate.toFixed(2)}
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-indigo-700">
                      R$ {l.effectiveMinuteRate.toFixed(3)}
                    </td>
                    <td className="py-3 px-3 text-center text-slate-600">
                      {l.defaultSetupTimeMinutes} min
                    </td>
                    <td className="py-3 px-3 text-right space-x-1 whitespace-nowrap">
                      {canManageCosts && (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingLabor(l);
                              setLaborModalOpen(true);
                            }}
                            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg cursor-pointer"
                            title="Editar Operação"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteLabor(l.id)}
                            className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg cursor-pointer"
                            title="Excluir Operação"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 6. DESPESAS INDIRETAS E CUSTOS FIXOS */}
      {/* ==================================================================== */}
      {activeTab === 'indirect' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-black text-slate-900">Despesas Fixas & Custos Indiretos</h2>
              <p className="text-xs text-slate-500">
                Aluguel, softwares de design e energia administrativa rateados de forma justa por hora produtiva
              </p>
            </div>
            {canManageCosts && (
              <button
                type="button"
                onClick={() => {
                  setEditingExpense({
                    allocationMethod: 'hora_produtiva',
                    monthlyAmount: 500,
                    active: true,
                  });
                  setExpenseModalOpen(true);
                }}
                className="px-4 py-2 bg-slate-900 hover:bg-[#E6007E] text-white rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Cadastrar Despesa
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-2xl">
              <span className="text-xs font-bold text-indigo-700 uppercase">Total Despesas Fixas / Mês</span>
              <div className="text-2xl font-black text-indigo-950 mt-1">
                R${' '}
                {expenses
                  .filter((e) => e.active)
                  .reduce((acc, e) => acc + e.monthlyAmount, 0)
                  .toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
              <span className="text-[11px] text-indigo-600 mt-1 block">Custos estruturais da empresa</span>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl">
              <span className="text-xs font-bold text-slate-600 uppercase">Horas Produtivas Consideradas</span>
              <div className="text-2xl font-black text-slate-900 mt-1">
                {settings.monthlyProductiveHoursDefault} h / mês
              </div>
              <span className="text-[11px] text-slate-500 mt-1 block">22 dias úteis × 8 horas de operação</span>
            </div>

            <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl">
              <span className="text-xs font-bold text-emerald-700 uppercase">Rateio Calculado por Hora</span>
              <div className="text-2xl font-black text-emerald-950 mt-1">
                R$ {indirectRatePerHour.toFixed(2)} / h
              </div>
              <span className="text-[11px] text-emerald-600 mt-1 block">Aplicado proporcionalmente aos produtos</span>
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-100">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-100 uppercase text-[10px]">
                <tr>
                  <th className="py-3 px-3">Código</th>
                  <th className="py-3 px-3">Descrição da Despesa</th>
                  <th className="py-3 px-3">Categoria</th>
                  <th className="py-3 px-3">Método de Rateio</th>
                  <th className="py-3 px-3 text-right">Valor Mensal</th>
                  <th className="py-3 px-3 text-center">Status</th>
                  <th className="py-3 px-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {expenses.map((e) => (
                  <tr key={e.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3 px-3 font-mono font-bold text-slate-500">{e.code}</td>
                    <td className="py-3 px-3 font-bold text-slate-900">{e.name}</td>
                    <td className="py-3 px-3 text-slate-600">{e.category}</td>
                    <td className="py-3 px-3 text-slate-600 capitalize">
                      {e.allocationMethod.replace(/_/g, ' ')}
                    </td>
                    <td className="py-3 px-3 text-right font-black text-slate-900">
                      R$ {e.monthlyAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          e.active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {e.active ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right space-x-1 whitespace-nowrap">
                      {canManageCosts && (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingExpense(e);
                              setExpenseModalOpen(true);
                            }}
                            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg cursor-pointer"
                            title="Editar Despesa"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteExpense(e.id)}
                            className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg cursor-pointer"
                            title="Excluir Despesa"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 7. FICHAS TÉCNICAS E COMPOSIÇÃO DE CUSTOS */}
      {/* ==================================================================== */}
      {activeTab === 'sheets' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-black text-slate-900">Fichas Técnicas de Produtos & Serviços</h2>
              <p className="text-xs text-slate-500">
                Engenharia de produto: matéria-prima, insumos auxiliares, tempos de máquina, mão de obra e acabamentos
              </p>
            </div>
            {canManageCosts && (
              <button
                type="button"
                onClick={() => {
                  setEditingSheet({
                    category: 'Canecas',
                    targetMarginPercent: settings.defaultTargetMarginPercent,
                    pricingMethod: 'margem_sobre_venda',
                    materials: [],
                    machines: [],
                    labor: [],
                    thirdPartyServices: [],
                    finishings: [],
                    packaging: [],
                  });
                  setSheetModalOpen(true);
                }}
                className="px-4 py-2 bg-slate-900 hover:bg-[#E6007E] text-white rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Nova Ficha Técnica
              </button>
            )}
          </div>

          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar ficha técnica por nome, código ou categoria..."
              value={sheetSearch}
              onChange={(e) => setSheetSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#E6007E] outline-none"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredSheets.map((s) => (
              <div
                key={s.id}
                className="p-5 rounded-2xl border border-slate-200 bg-white hover:border-slate-300 transition flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-indigo-50 text-indigo-700">
                      {s.category}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">{s.code} v{s.version}</span>
                  </div>

                  <h3 className="font-black text-base text-slate-900">{s.productName}</h3>
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2">{s.description}</p>

                  <div className="mt-4 bg-slate-50 p-3 rounded-xl space-y-1.5 text-xs text-slate-600">
                    <div className="flex justify-between">
                      <span>Materiais & Insumos:</span>
                      <strong className="text-slate-900">R$ {s.totalMaterialsCost.toFixed(2)}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Máquinas (Depreciação + Energia):</span>
                      <strong className="text-slate-900">R$ {s.totalMachinesCost.toFixed(2)}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Mão de Obra Direta:</span>
                      <strong className="text-slate-900">R$ {s.totalLaborCost.toFixed(2)}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Acabamentos & Embalagem:</span>
                      <strong className="text-slate-900">
                        R$ {(s.totalFinishingsCost + s.totalPackagingCost).toFixed(2)}
                      </strong>
                    </div>
                    <div className="flex justify-between border-t border-slate-200/70 pt-1 font-bold text-slate-800">
                      <span>Custo Total Unitário:</span>
                      <strong className="text-slate-950">R$ {s.totalUnitCost.toFixed(2)}</strong>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <span className="text-[10px] text-slate-400 block">Margem Alvo</span>
                      <span className="text-xs font-black text-emerald-600">{s.targetMarginPercent}%</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 block">Preço de Venda Sugerido</span>
                      <span className="text-base font-black text-slate-950">
                        R$ {s.suggestedUnitPrice.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-1 pt-2">
                    <button
                      type="button"
                      onClick={() => setScaleSheet(s)}
                      className="px-2.5 py-1 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg flex items-center gap-1 cursor-pointer"
                      title="Simular Matriz de Escala de Volume"
                    >
                      <TrendingUp className="w-3.5 h-3.5" /> Escala (1 a 1000)
                    </button>

                    <div className="flex items-center gap-1">
                      {canManageCosts && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleDuplicateSheet(s.id)}
                            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg cursor-pointer"
                            title="Duplicar Ficha Técnica"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingSheet(s);
                              setSheetModalOpen(true);
                            }}
                            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg cursor-pointer"
                            title="Editar Ficha"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteSheet(s.id)}
                            className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg cursor-pointer"
                            title="Excluir Ficha"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 8. FORMAÇÃO DO PREÇO DE VENDA & SIMULADOR DE ESCALA */}
      {/* ==================================================================== */}
      {activeTab === 'pricing_simulator' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 space-y-6">
          <div>
            <h2 className="text-lg font-black text-slate-900">Formação do Preço de Venda & Diluição de Setup</h2>
            <p className="text-xs text-slate-500">
              Selecione uma ficha técnica para analisar a diluição de custos fixos e os preços mínimos por faixa de quantidade
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-bold text-slate-700">Selecione o Produto:</span>
            <select
              value={scaleSheet?.id || (sheets[0]?.id || '')}
              onChange={(e) => {
                const found = sheets.find((s) => s.id === e.target.value);
                setScaleSheet(found || null);
              }}
              className="px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#E6007E] outline-none bg-white font-bold text-slate-900"
            >
              {sheets.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.productName} ({s.category})
                </option>
              ))}
            </select>
          </div>

          {scaleSheet && (
            <div className="space-y-5">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                  <h3 className="font-black text-base text-slate-900">{scaleSheet.productName}</h3>
                  <p className="text-xs text-slate-500">
                    Custo de Setup Fixo de Preparação: <strong>R$ {scaleSheet.totalSetupCost.toFixed(2)}</strong> por lote
                  </p>
                </div>
                <div className="flex items-center gap-3 text-xs font-bold">
                  <span className="bg-white px-3 py-1.5 rounded-xl border border-slate-200">
                    Margem Alvo: <strong>{scaleSheet.targetMarginPercent}%</strong>
                  </span>
                  <span className="bg-rose-50 text-rose-700 px-3 py-1.5 rounded-xl border border-rose-200">
                    Margem Mínima Segura: <strong>{settings.minimumAllowedMarginPercent}%</strong>
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-slate-100">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900 text-white font-bold uppercase text-[10px]">
                    <tr>
                      <th className="py-3.5 px-3">Quantidade</th>
                      <th className="py-3.5 px-3 text-right">Setup Diluído/un</th>
                      <th className="py-3.5 px-3 text-right">Custo Unitário Total</th>
                      <th className="py-3.5 px-3 text-right">Preço Sugerido / un</th>
                      <th className="py-3.5 px-3 text-right">Total do Lote</th>
                      <th className="py-3.5 px-3 text-right">Preço Mínimo Seguro</th>
                      <th className="py-3.5 px-3 text-right">Desconto Máx. %</th>
                      <th className="py-3.5 px-3 text-right">Lucro Bruto Lote</th>
                      <th className="py-3.5 px-3 text-center">Margem Efetiva</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {CostPricingService.generateQuantityTiers(scaleSheet).map((tier) => (
                      <tr key={tier.quantity} className="hover:bg-slate-50 transition">
                        <td className="py-3 px-3 font-black text-slate-900">
                          {tier.quantity} unids
                        </td>
                        <td className="py-3 px-3 text-right text-slate-500">
                          R$ {tier.setupCostDilutedUnit.toFixed(2)}
                        </td>
                        <td className="py-3 px-3 text-right font-semibold text-slate-700">
                          R$ {tier.totalUnitCost.toFixed(2)}
                        </td>
                        <td className="py-3 px-3 text-right font-black text-slate-950">
                          R$ {tier.suggestedUnitPrice.toFixed(2)}
                        </td>
                        <td className="py-3 px-3 text-right font-bold text-indigo-900">
                          R$ {tier.suggestedTotalPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 px-3 text-right font-bold text-rose-600">
                          R$ {tier.minAllowedUnitPrice.toFixed(2)}
                        </td>
                        <td className="py-3 px-3 text-right text-slate-600">
                          {tier.maxDiscountPercent}%
                        </td>
                        <td className="py-3 px-3 text-right font-black text-emerald-600">
                          R$ {tier.grossProfitAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-extrabold text-[11px]">
                            {tier.effectiveMarginPercent}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==================================================================== */}
      {/* 9. ORÇAMENTOS PERSONALIZADOS & PROPOSTAS COMERCIAIS */}
      {/* ==================================================================== */}
      {activeTab === 'quotes' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-black text-slate-900">Orçamentos & Propostas Comerciais</h2>
              <p className="text-xs text-slate-500">
                Elaboração de propostas com indicador visual de rentabilidade interna e emissão de proposta limpa para o cliente
              </p>
            </div>
            {canCreateEditQuotes && (
              <button
                type="button"
                onClick={() => {
                  setEditingQuote({
                    items: [],
                    discount: 0,
                    shippingCost: 0,
                    validityDays: 15,
                    productionDays: 5,
                    paymentTerms: 'PIX ou Boleto Bancário à Vista',
                    commercialNotes: 'Proposta comercial MB Personaliza com garantia de qualidade.',
                  });
                  setQuoteModalOpen(true);
                }}
                className="px-4 py-2 bg-slate-900 hover:bg-[#E6007E] text-white rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Criar Orçamento
              </button>
            )}
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar por cliente ou código..."
                value={quoteSearch}
                onChange={(e) => setQuoteSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#E6007E] outline-none"
              />
            </div>
            <select
              value={quoteStatusFilter}
              onChange={(e) => setQuoteStatusFilter(e.target.value)}
              className="px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#E6007E] outline-none bg-white font-medium"
            >
              <option value="todos">Todos os Status</option>
              <option value="pendente">Pendente</option>
              <option value="aprovado">Aprovado</option>
              <option value="recusado">Recusado</option>
              <option value="convertido">Convertido em Pedido</option>
            </select>
          </div>

          <div className="space-y-4">
            {filteredQuotes.map((q) => {
              const margin = q.internalSummary.overallEstimatedMarginPercent;
              const isBelowMin = q.internalSummary.isBelowMinMargin;

              return (
                <div
                  key={q.id}
                  className="p-5 rounded-2xl border border-slate-200 bg-white hover:border-slate-300 transition flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-xs text-slate-500">{q.code}</span>
                      <span
                        className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                          q.status === 'convertido'
                            ? 'bg-purple-100 text-purple-800'
                            : q.status === 'aprovado'
                            ? 'bg-emerald-100 text-emerald-800'
                            : q.status === 'recusado'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {q.status.toUpperCase()}
                      </span>
                    </div>

                    <h3 className="font-black text-base text-slate-900">{q.clientName}</h3>
                    <p className="text-xs text-slate-500">
                      {q.clientEmail} | {q.clientPhone} {q.clientCompany && `(${q.clientCompany})`}
                    </p>

                    <div className="flex items-center gap-3 pt-1 text-xs">
                      <span className="text-slate-600 font-medium">
                        {q.items.length} {q.items.length === 1 ? 'item' : 'itens'}
                      </span>
                      <span className="text-slate-400">•</span>
                      <span className="text-slate-600">
                        Validade até {new Date(q.validityDate).toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 w-full md:w-auto justify-between md:justify-end">
                    <div className="text-left sm:text-right">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Rentabilidade Interna
                      </span>
                      <div className="flex items-center sm:justify-end gap-1.5 mt-0.5">
                        <span
                          className={`font-black text-xs px-2 py-0.5 rounded-md ${
                            isBelowMin
                              ? 'bg-rose-100 text-rose-700'
                              : margin >= 35
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-amber-100 text-amber-700'
                          }`}
                        >
                          Margem: {margin}%
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400 block mt-0.5">
                        Lucro Est.: R$ {q.internalSummary.totalEstimatedGrossProfit.toFixed(2)}
                      </span>
                    </div>

                    <div className="text-left sm:text-right">
                      <span className="text-[10px] text-slate-400 block uppercase">Valor Total</span>
                      <span className="text-xl font-black text-slate-900">
                        R$ {q.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setViewingProposalQuote(q);
                          setProposalModalOpen(true);
                        }}
                        className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                        title="Ver Proposta Comercial do Cliente (Pronta para Imprimir/PDF)"
                      >
                        <Printer className="w-3.5 h-3.5" /> Proposta
                      </button>

                      {q.status === 'pendente' && canApprovePrices && (
                        <button
                          type="button"
                          onClick={() => {
                            setApprovingQuote(q);
                            setApproveModalOpen(true);
                          }}
                          className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <CheckCircle className="w-3.5 h-3.5" /> Aprovar
                        </button>
                      )}

                      {q.status === 'aprovado' && (
                        <button
                          type="button"
                          onClick={() => handleConvertQuoteToOrder(q.id)}
                          className="px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <ShoppingBag className="w-3.5 h-3.5" /> Faturar Pedido
                        </button>
                      )}

                      {canCreateEditQuotes && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingQuote(q);
                            setQuoteModalOpen(true);
                          }}
                          className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-xl cursor-pointer"
                          title="Editar Orçamento"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 10. HISTÓRICO DE PREÇOS E ORÇAMENTOS */}
      {/* ==================================================================== */}
      {activeTab === 'quote_history' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 space-y-6">
          <div>
            <h2 className="text-lg font-black text-slate-900">Histórico de Propostas & Versões</h2>
            <p className="text-xs text-slate-500">
              Rastreamento de todas as propostas orçamentárias emitidas pela equipe
            </p>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-100">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-100 uppercase text-[10px]">
                <tr>
                  <th className="py-3 px-3">Código</th>
                  <th className="py-3 px-3">Data Emissão</th>
                  <th className="py-3 px-3">Cliente</th>
                  <th className="py-3 px-3 text-right">Valor Total</th>
                  <th className="py-3 px-3 text-center">Margem Est.</th>
                  <th className="py-3 px-3 text-center">Status</th>
                  <th className="py-3 px-3">Criado Por</th>
                  <th className="py-3 px-3 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {quotes.map((q) => (
                  <tr key={q.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3 px-3 font-mono font-bold text-slate-700">{q.code}</td>
                    <td className="py-3 px-3 text-slate-500">
                      {new Date(q.createdAt).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="py-3 px-3 font-bold text-slate-900">{q.clientName}</td>
                    <td className="py-3 px-3 text-right font-black text-slate-900">
                      R$ {q.total.toFixed(2)}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                        {q.internalSummary.overallEstimatedMarginPercent}%
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                        {q.status}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-600">{q.createdBy}</td>
                    <td className="py-3 px-3 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          setViewingProposalQuote(q);
                          setProposalModalOpen(true);
                        }}
                        className="text-xs text-indigo-600 hover:underline font-bold cursor-pointer"
                      >
                        Visualizar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 11. RELATÓRIOS GERENCIAIS */}
      {/* ==================================================================== */}
      {activeTab === 'reports' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 space-y-6">
          <div>
            <h2 className="text-lg font-black text-slate-900">Relatórios Gerenciais de Rentabilidade</h2>
            <p className="text-xs text-slate-500">
              Análise de margens médias por categoria, ponto de equilíbrio operacional e produtos mais rentáveis
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-5 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-3">
              <h3 className="font-black text-sm text-slate-900">Rentabilidade por Categoria de Produto</h3>
              <div className="space-y-2">
                {[
                  { cat: 'Canecas & Brindes', margin: 38.5, count: 4 },
                  { cat: 'Papelaria & Encadernação', margin: 36.2, count: 6 },
                  { cat: 'Comunicação Visual (Banners/Lonas)', margin: 34.0, count: 3 },
                  { cat: 'Adesivos & Rótulos', margin: 42.0, count: 5 },
                  { cat: 'Vestuário & Camisetas', margin: 35.8, count: 2 },
                ].map((item) => (
                  <div key={item.cat} className="flex items-center justify-between p-2.5 bg-white rounded-xl border border-slate-200 text-xs">
                    <div>
                      <span className="font-bold text-slate-800 block">{item.cat}</span>
                      <span className="text-[10px] text-slate-400">{item.count} produtos</span>
                    </div>
                    <span className="font-black text-emerald-600">{item.margin}% margem</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-5 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-3">
              <h3 className="font-black text-sm text-slate-900">Ponto de Equilíbrio Operacional</h3>
              <p className="text-xs text-slate-600">
                Com base no total de custos fixos indiretos de R$ {expenses.filter((e) => e.active).reduce((acc, e) => acc + e.monthlyAmount, 0).toFixed(2)}/mês e na margem média de contribuição estimada de {kpis.avgSheetMargin}%:
              </p>
              <div className="p-4 bg-white rounded-xl border border-slate-200 text-center space-y-1">
                <span className="text-xs text-slate-500 font-bold block uppercase">Faturamento Mensal Mínimo Necessário</span>
                <span className="text-2xl font-black text-indigo-950">
                  R$ {(expenses.filter((e) => e.active).reduce((acc, e) => acc + e.monthlyAmount, 0) / (kpis.avgSheetMargin / 100)).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className="text-[11px] text-emerald-600 block font-bold">Acima deste valor a operação gera lucro líquido</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 12. CONFIGURAÇÕES E PARÂMETROS GERAIS DE PRECIFICAÇÃO */}
      {/* ==================================================================== */}
      {activeTab === 'settings' && (
        <form onSubmit={handleSaveSettings} className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 space-y-6">
          <div>
            <h2 className="text-lg font-black text-slate-900">Parâmetros Gerais de Precificação & Impostos</h2>
            <p className="text-xs text-slate-500">
              Taxas tributárias, tarifas de energia, margens de segurança e alçadas de desconto
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Margem Alvo Padrão (% sobre Venda)
              </label>
              <input
                type="number"
                step="0.1"
                value={settings.defaultTargetMarginPercent}
                onChange={(e) =>
                  setSettings({ ...settings, defaultTargetMarginPercent: Number(e.target.value) })
                }
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#E6007E] outline-none"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">Ex: 35.0% de margem líquida</span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Margem Mínima Segura Permissível (%)
              </label>
              <input
                type="number"
                step="0.1"
                value={settings.minimumAllowedMarginPercent}
                onChange={(e) =>
                  setSettings({ ...settings, minimumAllowedMarginPercent: Number(e.target.value) })
                }
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#E6007E] outline-none"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">Abaixo disto bloqueia ou exige alçada</span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Impostos sobre Venda (Simples Nacional %)
              </label>
              <input
                type="number"
                step="0.01"
                value={settings.defaultSalesTaxPercent}
                onChange={(e) =>
                  setSettings({ ...settings, defaultSalesTaxPercent: Number(e.target.value) })
                }
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#E6007E] outline-none"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">Ex: 8.5% Simples Nacional</span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Taxa de Cartão / Gateway de Pagamento (%)
              </label>
              <input
                type="number"
                step="0.01"
                value={settings.defaultPaymentGatewayFeePercent}
                onChange={(e) =>
                  setSettings({ ...settings, defaultPaymentGatewayFeePercent: Number(e.target.value) })
                }
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#E6007E] outline-none"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">Ex: 3.99% taxa média</span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Tarifa de Energia Elétrica (R$ por kWh)
              </label>
              <input
                type="number"
                step="0.01"
                value={settings.defaultEnergyTariffKwh}
                onChange={(e) =>
                  setSettings({ ...settings, defaultEnergyTariffKwh: Number(e.target.value) })
                }
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#E6007E] outline-none"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">Ex: R$ 0.85 / kWh</span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Horas Produtivas Mensais Padrão
              </label>
              <input
                type="number"
                value={settings.monthlyProductiveHoursDefault}
                onChange={(e) =>
                  setSettings({ ...settings, monthlyProductiveHoursDefault: Number(e.target.value) })
                }
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#E6007E] outline-none"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">Ex: 176h (22 dias x 8h)</span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Alerta de Custo Antigo (dias sem atualização)
              </label>
              <input
                type="number"
                value={settings.outdatedCostDaysThreshold}
                onChange={(e) =>
                  setSettings({ ...settings, outdatedCostDaysThreshold: Number(e.target.value) })
                }
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#E6007E] outline-none"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">Ex: 60 dias para alertar defasagem</span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Alçada: Desconto Máx. Sem Aprovação (%)
              </label>
              <input
                type="number"
                step="0.5"
                value={settings.requireApprovalForDiscountOverPercent}
                onChange={(e) =>
                  setSettings({ ...settings, requireApprovalForDiscountOverPercent: Number(e.target.value) })
                }
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#E6007E] outline-none"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">Acima disto exige aprovação do gerente</span>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200 flex justify-end">
            {canConfigurePricing && (
              <button
                type="submit"
                className="px-5 py-2.5 bg-slate-900 hover:bg-[#E6007E] text-white text-xs font-bold rounded-xl cursor-pointer transition shadow-sm"
              >
                Salvar Parâmetros
              </button>
            )}
          </div>
        </form>
      )}

      {/* ==================================================================== */}
      {/* 13. AUDITORIA & LOGS DE ALTERAÇÃO */}
      {/* ==================================================================== */}
      {activeTab === 'audit' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 space-y-6">
          <div>
            <h2 className="text-lg font-black text-slate-900">Logs de Auditoria do Módulo de Custos</h2>
            <p className="text-xs text-slate-500">
              Rastreabilidade completa: registro de quem criou, editou, reavaliou ou aprovou preços e orçamentos
            </p>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-100">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-100 uppercase text-[10px]">
                <tr>
                  <th className="py-3 px-3">Data / Hora</th>
                  <th className="py-3 px-3">Usuário</th>
                  <th className="py-3 px-3">Operação</th>
                  <th className="py-3 px-3">Entidade</th>
                  <th className="py-3 px-3">Detalhes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3 px-3 text-slate-500 font-mono text-[11px]">
                      {new Date(log.timestamp).toLocaleString('pt-BR')}
                    </td>
                    <td className="py-3 px-3">
                      <span className="font-bold text-slate-900 block">{log.userName}</span>
                      <span className="text-[10px] text-slate-400 capitalize">{log.userRole}</span>
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`text-[10px] font-black px-2 py-0.5 rounded-md ${
                          log.operation.includes('APROVAR')
                            ? 'bg-emerald-100 text-emerald-800'
                            : log.operation === 'EXCLUIR'
                            ? 'bg-rose-100 text-rose-800'
                            : log.operation === 'CRIAR'
                            ? 'bg-indigo-100 text-indigo-800'
                            : 'bg-slate-100 text-slate-800'
                        }`}
                      >
                        {log.operation}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-semibold text-slate-800">
                      {log.entityName}
                    </td>
                    <td className="py-3 px-3 text-slate-600 max-w-xs truncate" title={log.details}>
                      {log.details}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 14. SEÇÃO 15: PAINEL DE TESTES REAIS E VALIDAÇÃO COM EVIDÊNCIAS */}
      {/* ==================================================================== */}
      {activeTab === 'validation_tests' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-rose-600 font-bold text-xs uppercase tracking-wider mb-1">
                <ShieldAlert className="w-4 h-4" />
                Seção 15 — Regras Obrigatórias de Segurança, Testes e Validação
              </div>
              <h2 className="text-xl font-black text-slate-900">
                Painel Consolidado de Testes Reais E2E com Evidências
              </h2>
              <p className="text-xs text-slate-500">
                Proibição expressa de aprovação sem evidências ou com dados fictícios. Validação de ponta a ponta: Interface ➔ Validação ➔ Backend/Storage ➔ Persistência ➔ Integridade.
              </p>
            </div>

            <button
              type="button"
              disabled={isRunningTests}
              onClick={handleRunE2ETests}
              className={`px-5 py-2.5 rounded-xl text-xs font-black text-white flex items-center gap-2 cursor-pointer shadow-md transition ${
                isRunningTests
                  ? 'bg-slate-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-rose-600 to-indigo-700 hover:from-rose-700 hover:to-indigo-800'
              }`}
            >
              {isRunningTests ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Executando Bateria E2E...
                </>
              ) : (
                <>
                  <PlayCircle className="w-4 h-4" />
                  Executar Todos os 10 Testes E2E Agora
                </>
              )}
            </button>
          </div>

          {/* Painel Consolidado de Status */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200">
              <span className="text-[11px] font-bold text-emerald-800 uppercase block">Aprovados com Evidência</span>
              <div className="text-2xl font-black text-emerald-950 mt-1">
                {testResults.filter((t) => t.status === 'aprovado').length}
              </div>
              <span className="text-[10px] text-emerald-700">Validados de ponta a ponta</span>
            </div>

            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200">
              <span className="text-[11px] font-bold text-rose-800 uppercase block">Reprovados / Falhas</span>
              <div className="text-2xl font-black text-rose-950 mt-1">
                {testResults.filter((t) => t.status === 'reprovado').length}
              </div>
              <span className="text-[10px] text-rose-700">Erros a corrigir</span>
            </div>

            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200">
              <span className="text-[11px] font-bold text-amber-800 uppercase block">Bloqueados</span>
              <div className="text-2xl font-black text-amber-950 mt-1">
                {testResults.filter((t) => t.status === 'bloqueado').length}
              </div>
              <span className="text-[10px] text-amber-700">Falta de ambiente externo</span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
              <span className="text-[11px] font-bold text-slate-700 uppercase block">Não Executados</span>
              <div className="text-2xl font-black text-slate-900 mt-1">
                {Math.max(0, 10 - testResults.length)}
              </div>
              <span className="text-[10px] text-slate-500">Pendentes de acionamento</span>
            </div>
          </div>

          {/* Listagem dos Testes e Evidências */}
          {testResults.length === 0 ? (
            <div className="p-12 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-300 space-y-3">
              <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mx-auto shadow-xs text-slate-400">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-sm text-slate-800">Nenhum teste E2E executado nesta sessão</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Conforme a Regra 15.3 (Proibição de aprovação sem evidências), clique no botão acima para rodar a suíte real de ponta a ponta.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {testResults.map((test) => (
                <div
                  key={test.id}
                  className={`p-5 rounded-2xl border transition ${
                    test.status === 'aprovado'
                      ? 'bg-white border-emerald-200 shadow-xs'
                      : 'bg-rose-50/50 border-rose-300'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-xs bg-slate-900 text-white px-2 py-0.5 rounded-md">
                        {test.id}
                      </span>
                      <span className="font-black text-sm text-slate-900">{test.moduleName}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[11px] font-black uppercase px-2.5 py-0.5 rounded-full flex items-center gap-1 ${
                          test.status === 'aprovado'
                            ? 'bg-emerald-100 text-emerald-800'
                            : test.status === 'reprovado'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {test.status === 'aprovado' && <CheckCircle2 className="w-3.5 h-3.5" />}
                        {test.status === 'reprovado' && <XCircle className="w-3.5 h-3.5" />}
                        {test.status.toUpperCase()}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {new Date(test.timestamp).toLocaleTimeString('pt-BR')}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-3 text-xs">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">Objetivo do Teste</span>
                      <p className="text-slate-800 font-medium mt-0.5">{test.targetObjective}</p>

                      <span className="text-[10px] font-bold text-slate-400 uppercase block mt-2">Procedimento Executado</span>
                      <p className="text-slate-600 mt-0.5">{test.procedureExecuted}</p>
                    </div>

                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">Resultado Esperado</span>
                      <p className="text-slate-800 font-medium mt-0.5">{test.expectedResult}</p>

                      <span className="text-[10px] font-bold text-slate-400 uppercase block mt-2">Resultado Obtido</span>
                      <p className={`mt-0.5 font-bold ${test.status === 'aprovado' ? 'text-emerald-700' : 'text-rose-700'}`}>
                        {test.obtainedResult}
                      </p>
                    </div>
                  </div>

                  {/* Evidência JSON Real */}
                  <div className="mt-2 pt-2 border-t border-slate-100">
                    <details className="text-[11px]">
                      <summary className="font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer flex items-center gap-1">
                        Ver Evidência Técnica Auditada (Dados do Objeto)
                      </summary>
                      <pre className="mt-2 p-3 bg-slate-900 text-emerald-400 rounded-xl overflow-x-auto text-[10px] font-mono leading-relaxed">
                        {JSON.stringify(test.evidenceData, null, 2)}
                      </pre>
                    </details>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 1: CADASTRAR / EDITAR MATÉRIA-PRIMA */}
      {/* ==================================================================== */}
      {materialModalOpen && editingMaterial && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 space-y-4 shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-black text-base text-slate-900">
                {editingMaterial.id ? 'Editar Matéria-Prima' : 'Cadastrar Matéria-Prima'}
              </h3>
              <button
                type="button"
                onClick={() => setMaterialModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveMaterial} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Código Interno</label>
                  <input
                    type="text"
                    required
                    value={editingMaterial.code || ''}
                    onChange={(e) => setEditingMaterial({ ...editingMaterial, code: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none"
                    placeholder="MP-001"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Categoria</label>
                  <select
                    value={editingMaterial.category || 'papeis'}
                    onChange={(e) => setEditingMaterial({ ...editingMaterial, category: e.target.value as RawMaterialCategory })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none bg-white font-medium"
                  >
                    <option value="papeis">Papéis & Papelão</option>
                    <option value="vinis_lonas">Vinis & Lonas</option>
                    <option value="tintas_toners">Tintas & Toners</option>
                    <option value="sublimacao_transfer">Sublimação & Transfer</option>
                    <option value="produtos_base">Produtos Base (Canecas, Camisetas)</option>
                    <option value="embalagens">Embalagens & Fitas</option>
                    <option value="acabamentos">Acabamentos & Espirais</option>
                    <option value="outros">Outros</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Nome do Insumo</label>
                <input
                  type="text"
                  required
                  value={editingMaterial.name || ''}
                  onChange={(e) => setEditingMaterial({ ...editingMaterial, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none"
                  placeholder="Ex: Papel Couchê 250g A3+"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Fornecedor</label>
                  <input
                    type="text"
                    value={editingMaterial.supplier || ''}
                    onChange={(e) => setEditingMaterial({ ...editingMaterial, supplier: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none"
                    placeholder="Ex: Papirus / Suzano"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Estoque Disponível (unidade de consumo)</label>
                  <input
                    type="number"
                    value={editingMaterial.currentStock || 0}
                    onChange={(e) => setEditingMaterial({ ...editingMaterial, currentStock: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none"
                  />
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                <span className="font-bold text-slate-800 block text-xs">Conversão de Unidades:</span>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-500 block">Unidade Compra</label>
                    <input
                      type="text"
                      value={editingMaterial.purchaseUnit || 'pacote'}
                      onChange={(e) => setEditingMaterial({ ...editingMaterial, purchaseUnit: e.target.value as PurchaseUnit })}
                      className="w-full px-2 py-1.5 border border-slate-200 rounded-lg bg-white"
                      placeholder="resma / pacote"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 block">Fator Conversão</label>
                    <input
                      type="number"
                      step="any"
                      value={editingMaterial.conversionFactor || 1}
                      onChange={(e) => setEditingMaterial({ ...editingMaterial, conversionFactor: Number(e.target.value) })}
                      className="w-full px-2 py-1.5 border border-slate-200 rounded-lg bg-white"
                      placeholder="Ex: 500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 block">Unidade Consumo</label>
                    <input
                      type="text"
                      value={editingMaterial.consumptionUnit || 'folha'}
                      onChange={(e) => setEditingMaterial({ ...editingMaterial, consumptionUnit: e.target.value as ConsumptionUnit })}
                      className="w-full px-2 py-1.5 border border-slate-200 rounded-lg bg-white"
                      placeholder="folha / m2 / un"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Preço Compra (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={editingMaterial.purchasePrice || 0}
                    onChange={(e) => setEditingMaterial({ ...editingMaterial, purchasePrice: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Frete / Aquisição (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editingMaterial.shippingCost || 0}
                    onChange={(e) => setEditingMaterial({ ...editingMaterial, shippingCost: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Perdas Estimadas (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={editingMaterial.estimatedWastePercent || 0}
                    onChange={(e) => setEditingMaterial({ ...editingMaterial, estimatedWastePercent: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setMaterialModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl font-bold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-slate-900 hover:bg-[#E6007E] text-white rounded-xl font-bold cursor-pointer transition"
                >
                  Salvar Insumo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 2: REAVALIAÇÃO DE MÁQUINA */}
      {/* ==================================================================== */}
      {revalueModalOpen && revaluingMachine && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="font-black text-base text-slate-900">
              Reavaliação Gerencial de Vida Útil
            </h3>
            <p className="text-xs text-slate-500">
              Equipamento: <strong>{revaluingMachine.name}</strong>. Adicione meses de vida útil produtiva para recalcular o custo operacional sem duplicar custos contábeis.
            </p>

            <form onSubmit={handleRevalueMachineSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Adicionar Meses de Vida Útil</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={revalueMonths}
                  onChange={(e) => setRevalueMonths(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Novo Valor Residual Estimado (R$)</label>
                <input
                  type="number"
                  min="0"
                  value={revalueResidual}
                  onChange={(e) => setRevalueResidual(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Justificativa Gerencial da Reavaliação</label>
                <textarea
                  required
                  rows={2}
                  value={revalueReason}
                  onChange={(e) => setRevalueReason(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none"
                  placeholder="Ex: Reforma preventiva e substituição de cilindros estenderam a vida útil do equipamento."
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRevalueModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl font-bold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold cursor-pointer transition"
                >
                  Confirmar Reavaliação
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 3: FICHA TÉCNICA (COMPOSIÇÃO COMPLETA) */}
      {/* ==================================================================== */}
      {sheetModalOpen && editingSheet && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-3xl w-full p-6 space-y-4 shadow-2xl overflow-y-auto max-h-[92vh]">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-black text-base text-slate-900">
                  {editingSheet.id ? 'Editar Ficha Técnica' : 'Criar Nova Ficha Técnica'}
                </h3>
                <span className="text-xs text-slate-500">Composição detalhada de materiais, maquinário e mão de obra</span>
              </div>
              <button
                type="button"
                onClick={() => setSheetModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveSheet} className="space-y-4 text-xs">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Código da Ficha</label>
                  <input
                    type="text"
                    value={editingSheet.code || ''}
                    onChange={(e) => setEditingSheet({ ...editingSheet, code: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none"
                    placeholder="FT-001"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Categoria</label>
                  <input
                    type="text"
                    required
                    value={editingSheet.category || 'Canecas'}
                    onChange={(e) => setEditingSheet({ ...editingSheet, category: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none"
                    placeholder="Canecas, Papelaria, Banners"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Margem Alvo (%)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={editingSheet.targetMarginPercent || 35}
                    onChange={(e) => setEditingSheet({ ...editingSheet, targetMarginPercent: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Nome do Produto</label>
                <input
                  type="text"
                  required
                  value={editingSheet.productName || ''}
                  onChange={(e) => setEditingSheet({ ...editingSheet, productName: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none"
                  placeholder="Ex: Caneca de Cerâmica Sublimada 325ml"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Descrição do Processo & Especificação</label>
                <textarea
                  rows={2}
                  value={editingSheet.description || ''}
                  onChange={(e) => setEditingSheet({ ...editingSheet, description: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none"
                  placeholder="Detalhes dos materiais, acabamentos e instruções de produção..."
                />
              </div>

              {/* Insumos */}
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 text-xs">Matérias-Primas Utilizadas:</span>
                  <button
                    type="button"
                    onClick={() => {
                      if (materials.length === 0) return;
                      const firstMat = materials[0];
                      const newItems = [...(editingSheet.materials || [])];
                      newItems.push({
                        materialId: firstMat.id,
                        materialName: firstMat.name,
                        category: firstMat.category,
                        quantityNeeded: 1,
                        consumptionUnit: firstMat.consumptionUnit,
                        unitCost: firstMat.costWithWaste,
                        wastePercent: firstMat.estimatedWastePercent,
                        totalCost: firstMat.costWithWaste,
                      });
                      setEditingSheet({ ...editingSheet, materials: newItems });
                    }}
                    className="px-2.5 py-1 bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 rounded-lg font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Adicionar Insumo
                  </button>
                </div>

                <div className="space-y-2">
                  {(editingSheet.materials || []).map((mItem, idx) => (
                    <div key={idx} className="flex items-center gap-2 bg-white p-2 rounded-xl border border-slate-200">
                      <select
                        value={mItem.materialId}
                        onChange={(e) => {
                          const mat = materials.find((m) => m.id === e.target.value);
                          if (!mat) return;
                          const updated = [...(editingSheet.materials || [])];
                          updated[idx] = {
                            ...mItem,
                            materialId: mat.id,
                            materialName: mat.name,
                            category: mat.category,
                            consumptionUnit: mat.consumptionUnit,
                            unitCost: mat.costWithWaste,
                            wastePercent: mat.estimatedWastePercent,
                            totalCost: Number((mItem.quantityNeeded * mat.costWithWaste).toFixed(4)),
                          };
                          setEditingSheet({ ...editingSheet, materials: updated });
                        }}
                        className="flex-1 px-2 py-1 border border-slate-200 rounded-lg font-medium"
                      >
                        {materials.map((mat) => (
                          <option key={mat.id} value={mat.id}>
                            {mat.name} (R$ {mat.costWithWaste.toFixed(4)}/{mat.consumptionUnit})
                          </option>
                        ))}
                      </select>

                      <div className="w-24">
                        <input
                          type="number"
                          step="any"
                          min="0.0001"
                          value={mItem.quantityNeeded}
                          onChange={(e) => {
                            const qty = Number(e.target.value);
                            const updated = [...(editingSheet.materials || [])];
                            updated[idx] = {
                              ...mItem,
                              quantityNeeded: qty,
                              totalCost: Number((qty * mItem.unitCost).toFixed(4)),
                            };
                            setEditingSheet({ ...editingSheet, materials: updated });
                          }}
                          className="w-full px-2 py-1 border border-slate-200 rounded-lg text-right"
                          placeholder="Qtd"
                        />
                      </div>

                      <span className="text-[11px] font-bold text-slate-800 w-24 text-right">
                        R$ {mItem.totalCost.toFixed(2)}
                      </span>

                      <button
                        type="button"
                        onClick={() => {
                          const updated = (editingSheet.materials || []).filter((_, i) => i !== idx);
                          setEditingSheet({ ...editingSheet, materials: updated });
                        }}
                        className="text-rose-500 hover:text-rose-700 p-1 cursor-pointer"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Maquinário */}
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 text-xs">Máquinas Utilizadas (Setup & Processamento):</span>
                  <button
                    type="button"
                    onClick={() => {
                      if (machines.length === 0) return;
                      const firstM = machines[0];
                      const newItems = [...(editingSheet.machines || [])];
                      newItems.push({
                        machineId: firstM.id,
                        machineName: firstM.name,
                        setupMinutes: 5,
                        unitMinutes: 2,
                        hourlyRate: firstM.totalMachineCostPerHour,
                        totalCost: Number(((5 / 60 + 2 / 60) * firstM.totalMachineCostPerHour).toFixed(4)),
                      });
                      setEditingSheet({ ...editingSheet, machines: newItems });
                    }}
                    className="px-2.5 py-1 bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 rounded-lg font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Adicionar Máquina
                  </button>
                </div>

                <div className="space-y-2">
                  {(editingSheet.machines || []).map((mItem, idx) => (
                    <div key={idx} className="flex items-center gap-2 bg-white p-2 rounded-xl border border-slate-200">
                      <select
                        value={mItem.machineId}
                        onChange={(e) => {
                          const maq = machines.find((m) => m.id === e.target.value);
                          if (!maq) return;
                          const updated = [...(editingSheet.machines || [])];
                          const cost = Number(
                            (
                              ((mItem.setupMinutes / 60) + (mItem.unitMinutes / 60)) *
                              maq.totalMachineCostPerHour
                            ).toFixed(4)
                          );
                          updated[idx] = {
                            ...mItem,
                            machineId: maq.id,
                            machineName: maq.name,
                            hourlyRate: maq.totalMachineCostPerHour,
                            totalCost: cost,
                          };
                          setEditingSheet({ ...editingSheet, machines: updated });
                        }}
                        className="flex-1 px-2 py-1 border border-slate-200 rounded-lg font-medium"
                      >
                        {machines.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name} (R$ {m.totalMachineCostPerHour.toFixed(2)}/h)
                          </option>
                        ))}
                      </select>

                      <div className="w-20">
                        <label className="text-[9px] text-slate-400 block">Setup (min)</label>
                        <input
                          type="number"
                          value={mItem.setupMinutes}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            const updated = [...(editingSheet.machines || [])];
                            const cost = Number(
                              (((val / 60) + (mItem.unitMinutes / 60)) * mItem.hourlyRate).toFixed(4)
                            );
                            updated[idx] = { ...mItem, setupMinutes: val, totalCost: cost };
                            setEditingSheet({ ...editingSheet, machines: updated });
                          }}
                          className="w-full px-2 py-1 border border-slate-200 rounded-lg text-right"
                        />
                      </div>

                      <div className="w-20">
                        <label className="text-[9px] text-slate-400 block">Unit. (min)</label>
                        <input
                          type="number"
                          value={mItem.unitMinutes}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            const updated = [...(editingSheet.machines || [])];
                            const cost = Number(
                              (((mItem.setupMinutes / 60) + (val / 60)) * mItem.hourlyRate).toFixed(4)
                            );
                            updated[idx] = { ...mItem, unitMinutes: val, totalCost: cost };
                            setEditingSheet({ ...editingSheet, machines: updated });
                          }}
                          className="w-full px-2 py-1 border border-slate-200 rounded-lg text-right"
                        />
                      </div>

                      <span className="text-[11px] font-bold text-slate-800 w-20 text-right">
                        R$ {mItem.totalCost.toFixed(2)}
                      </span>

                      <button
                        type="button"
                        onClick={() => {
                          const updated = (editingSheet.machines || []).filter((_, i) => i !== idx);
                          setEditingSheet({ ...editingSheet, machines: updated });
                        }}
                        className="text-rose-500 hover:text-rose-700 p-1 cursor-pointer"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSheetModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl font-bold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-slate-900 hover:bg-[#E6007E] text-white rounded-xl font-bold cursor-pointer transition"
                >
                  Salvar Ficha Técnica
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 4: PROPOSTA COMERCIAL LIMPA (CLIENT FACING - IMPRIMIR/PDF) */}
      {/* ==================================================================== */}
      {proposalModalOpen && viewingProposalQuote && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-8 space-y-6 shadow-2xl overflow-y-auto max-h-[92vh] print:p-0 print:shadow-none">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <div>
                <span className="text-xl font-black tracking-tight text-[#E6007E] block">
                  MB PERSONALIZA
                </span>
                <span className="text-xs text-slate-500">
                  Papelaria Personalizada, Brindes e Gráfica Rápida
                </span>
              </div>
              <div className="text-right">
                <span className="text-xs font-mono font-bold text-slate-700 block">
                  PROPOSTA: {viewingProposalQuote.code}
                </span>
                <span className="text-[11px] text-slate-400">
                  Data: {new Date(viewingProposalQuote.createdAt).toLocaleDateString('pt-BR')}
                </span>
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-1 text-xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Cliente / Faturamento
              </span>
              <h4 className="font-bold text-sm text-slate-900">{viewingProposalQuote.clientName}</h4>
              <p className="text-slate-600">
                {viewingProposalQuote.clientEmail} • {viewingProposalQuote.clientPhone}
                {viewingProposalQuote.clientCpfCnpj && ` • Doc: ${viewingProposalQuote.clientCpfCnpj}`}
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px]">
                  <tr>
                    <th className="py-2.5 px-3">Item / Descrição</th>
                    <th className="py-2.5 px-3 text-center">Qtd</th>
                    <th className="py-2.5 px-3 text-right">Preço Unitário</th>
                    <th className="py-2.5 px-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {viewingProposalQuote.items.map((it, idx) => (
                    <tr key={idx}>
                      <td className="py-2.5 px-3">
                        <strong className="text-slate-900 block">{it.productName}</strong>
                        <span className="text-[11px] text-slate-500">{it.description}</span>
                      </td>
                      <td className="py-2.5 px-3 text-center font-bold text-slate-800">
                        {it.quantity}
                      </td>
                      <td className="py-2.5 px-3 text-right font-medium text-slate-700">
                        R$ {it.unitPrice.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-black text-slate-900">
                        R$ {it.totalPrice.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="border-t border-slate-200 pt-3 space-y-1 text-xs text-right">
              <div className="flex justify-end gap-6 text-slate-600">
                <span>Subtotal:</span>
                <strong className="text-slate-900">R$ {viewingProposalQuote.subtotal.toFixed(2)}</strong>
              </div>
              {viewingProposalQuote.discount > 0 && (
                <div className="flex justify-end gap-6 text-emerald-600 font-bold">
                  <span>Desconto Especial:</span>
                  <span>- R$ {viewingProposalQuote.discount.toFixed(2)}</span>
                </div>
              )}
              {viewingProposalQuote.shippingCost > 0 && (
                <div className="flex justify-end gap-6 text-slate-600">
                  <span>Frete / Envio:</span>
                  <strong className="text-slate-900">R$ {viewingProposalQuote.shippingCost.toFixed(2)}</strong>
                </div>
              )}
              <div className="flex justify-end gap-6 text-base font-black text-slate-950 pt-2 border-t border-slate-100">
                <span>VALOR TOTAL:</span>
                <span className="text-emerald-600">
                  R$ {viewingProposalQuote.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-2 text-xs">
              <span className="font-bold text-slate-800 block">Condições Gerais:</span>
              <ul className="space-y-1 text-slate-600 list-disc list-inside">
                <li>Prazo de produção estimado: <strong>{viewingProposalQuote.productionDays} dias úteis</strong> após aprovação da arte.</li>
                <li>Condições de pagamento: <strong>{viewingProposalQuote.paymentTerms}</strong>.</li>
                <li>Proposta válida até: <strong>{new Date(viewingProposalQuote.validityDate).toLocaleDateString('pt-BR')}</strong>.</li>
              </ul>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between print:hidden">
              <button
                type="button"
                onClick={() => setProposalModalOpen(false)}
                className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-bold cursor-pointer"
              >
                Fechar
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="px-5 py-2.5 bg-slate-900 hover:bg-[#E6007E] text-white rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer transition shadow-md"
              >
                <Printer className="w-4 h-4" /> Imprimir / Salvar PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 5: APROVAÇÃO DE ORÇAMENTO COM ALÇADA */}
      {/* ==================================================================== */}
      {approveModalOpen && approvingQuote && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="font-black text-base text-slate-900">
              Aprovação de Orçamento Comercial
            </h3>
            <p className="text-xs text-slate-500">
              Proposta <strong>{approvingQuote.code}</strong> para o cliente <strong>{approvingQuote.clientName}</strong>.
            </p>

            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span>Valor Total da Proposta:</span>
                <strong className="text-slate-900">R$ {approvingQuote.total.toFixed(2)}</strong>
              </div>
              <div className="flex justify-between">
                <span>Margem Interna Projetada:</span>
                <strong className={approvingQuote.internalSummary.isBelowMinMargin ? 'text-rose-600' : 'text-emerald-600'}>
                  {approvingQuote.internalSummary.overallEstimatedMarginPercent}%
                </strong>
              </div>
              <div className="flex justify-between">
                <span>Lucro Bruto Estimado:</span>
                <strong className="text-slate-900">
                  R$ {approvingQuote.internalSummary.totalEstimatedGrossProfit.toFixed(2)}
                </strong>
              </div>
            </div>

            <form onSubmit={handleApproveQuoteSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Parecer da Aprovação / Notas do Supervisor
                </label>
                <textarea
                  rows={2}
                  value={approvalNotes}
                  onChange={(e) => setApprovalNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none"
                  placeholder="Preço e margem autorizados para fechamento..."
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setApproveModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl font-bold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold cursor-pointer transition"
                >
                  Aprovar Proposta
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
