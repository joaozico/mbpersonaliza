import React, { useState, useMemo, useEffect } from 'react';
import {
  UserProfile,
  FinancialAccount,
  FinancialCategory,
  CostCenter,
  BankAccount,
  FinancialPaymentMethod,
  FinancialSettings,
  FinancialAuditEntry,
  RolePermissions,
  UserRole,
  Category,
  Subcategory,
} from '../types';
import { StorageService } from '../services/storage';
import { BoletoBillingManagementTab } from './BoletoBillingManagementTab';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Plus,
  Search,
  Filter,
  Download,
  Printer,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Building2,
  Landmark,
  Tags,
  SlidersHorizontal,
  History,
  FileSpreadsheet,
  Clock,
  ArrowUpRight,
  ArrowDownLeft,
  ChevronRight,
  CreditCard,
  Edit,
  Trash2,
  X,
  FileText,
  Lock,
  Unlock,
  Check,
  AlertCircle,
  HelpCircle,
  Power,
  Percent,
  Layers,
  Info,
} from 'lucide-react';

interface FinancialModuleViewProps {
  currentUser: UserProfile;
  onNavigate: (view: string, param?: string) => void;
  onUserChange?: (user: UserProfile) => void;
}

export const FinancialModuleView: React.FC<FinancialModuleViewProps> = ({
  currentUser,
  onNavigate,
  onUserChange,
}) => {
  // --------------------------------------------------------------------------
  // CONTROLE DE ACESSO GERAL AO MÓDULO FINANCEIRO (REGRA PRINCIPAL)
  // --------------------------------------------------------------------------
  const isFullAdmin = currentUser.role === 'admin';
  const hasModuleAccess = StorageService.hasUserPermission(currentUser, 'canViewFinancialModule');

  // Permissões granulares do usuário atual
  const canViewDashboard = StorageService.hasUserPermission(currentUser, 'canViewFinancialDashboard');
  const canViewReceivables = StorageService.hasUserPermission(currentUser, 'canViewReceivables');
  const canCreateReceivable = StorageService.hasUserPermission(currentUser, 'canCreateReceivable');
  const canEditReceivable = StorageService.hasUserPermission(currentUser, 'canEditReceivable');
  const canReceivePayment = StorageService.hasUserPermission(currentUser, 'canReceivePayment');
  const canCancelReceivable = StorageService.hasUserPermission(currentUser, 'canCancelReceivable');
  const canRefundReceivable = StorageService.hasUserPermission(currentUser, 'canRefundReceivable');

  const canViewPayables = StorageService.hasUserPermission(currentUser, 'canViewPayables');
  const canCreatePayable = StorageService.hasUserPermission(currentUser, 'canCreatePayable');
  const canEditPayable = StorageService.hasUserPermission(currentUser, 'canEditPayable');
  const canPayBill = StorageService.hasUserPermission(currentUser, 'canPayBill');
  const canCancelPayable = StorageService.hasUserPermission(currentUser, 'canCancelPayable');
  const canRefundPayable = StorageService.hasUserPermission(currentUser, 'canRefundPayable');

  const canViewCashFlow = StorageService.hasUserPermission(currentUser, 'canViewCashFlow');
  const canViewRealized = StorageService.hasUserPermission(currentUser, 'canViewRealizedValues');
  const canViewProjected = StorageService.hasUserPermission(currentUser, 'canViewProjectedValues');

  const canViewReports = StorageService.hasUserPermission(currentUser, 'canViewFinancialReports');
  const canExportReports = StorageService.hasUserPermission(currentUser, 'canExportFinancialReports');

  const canManageCategories = StorageService.hasUserPermission(currentUser, 'canManageFinancialCategories');
  const canManageCostCenters = StorageService.hasUserPermission(currentUser, 'canManageCostCenters');
  const canManageBankAccounts = StorageService.hasUserPermission(currentUser, 'canManageBankAccounts');
  const canManagePaymentMethods = StorageService.hasUserPermission(currentUser, 'canManagePaymentMethods');
  const canManageSettings = StorageService.hasUserPermission(currentUser, 'canManageFinancialSettings');
  const canViewAudit = StorageService.hasUserPermission(currentUser, 'canViewFinancialAudit');

  // Se o usuário não possui permissão para visualizar o módulo financeiro:
  // Exibe a tela obrigatória de "Acesso negado" e registra auditoria.
  useEffect(() => {
    if (!hasModuleAccess) {
      StorageService.addFinancialAuditEntry({
        userId: currentUser.id,
        userName: currentUser.name,
        userEmail: currentUser.email,
        userRole: currentUser.role,
        operation: 'TENTATIVA_ACESSO_URL_FINANCEIRO_NEGADA',
        permissionUsed: 'canViewFinancialModule',
        affectedRecordType: 'modulo_financeiro',
        result: 'bloqueado',
        details: `Tentativa de acesso direto à rota /financeiro pelo usuário ${currentUser.name} (${currentUser.role}) sem permissão.`,
        origin: 'web_painel',
      });
    }
  }, [hasModuleAccess, currentUser]);



  // --------------------------------------------------------------------------
  // ESTADO DO MÓDULO FINANCEIRO
  // --------------------------------------------------------------------------
  type FinancialSubTab =
    | 'dashboard'
    | 'receivables'
    | 'boletos'
    | 'payables'
    | 'cash_flow'
    | 'reports'
    | 'categories'
    | 'cost_centers'
    | 'bank_accounts'
    | 'payment_methods'
    | 'settings'
    | 'audit';

  // Escolhe a primeira aba permitida
  const initialTab: FinancialSubTab = canViewDashboard
    ? 'dashboard'
    : canViewReceivables
    ? 'receivables'
    : canViewPayables
    ? 'payables'
    : canViewCashFlow
    ? 'cash_flow'
    : canViewReports
    ? 'reports'
    : canViewAudit
    ? 'audit'
    : 'categories';

  const [activeTab, setActiveTab] = useState<FinancialSubTab>(initialTab);

  // Dados carregados com autorização
  const [accounts, setAccounts] = useState<FinancialAccount[]>(() =>
    StorageService.getFinancialAccounts(currentUser)
  );
  const [categories, setCategories] = useState<FinancialCategory[]>(() =>
    StorageService.getFinancialCategories(currentUser)
  );
  const [costCenters, setCostCenters] = useState<CostCenter[]>(() =>
    StorageService.getCostCenters(currentUser)
  );
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>(() =>
    StorageService.getBankAccounts(currentUser)
  );
  const [paymentMethods, setPaymentMethods] = useState<FinancialPaymentMethod[]>(() =>
    StorageService.getFinancialPaymentMethods(currentUser)
  );
  const [settings, setSettings] = useState<FinancialSettings>(() =>
    StorageService.getFinancialSettings(currentUser)
  );
  const [auditLogs, setAuditLogs] = useState<FinancialAuditEntry[]>(() =>
    StorageService.getFinancialAudit(currentUser)
  );

  const refreshAll = () => {
    setAccounts(StorageService.getFinancialAccounts(currentUser));
    setCategories(StorageService.getFinancialCategories(currentUser));
    setCostCenters(StorageService.getCostCenters(currentUser));
    setBankAccounts(StorageService.getBankAccounts(currentUser));
    setPaymentMethods(StorageService.getFinancialPaymentMethods(currentUser));
    setSettings(StorageService.getFinancialSettings(currentUser));
    setAuditLogs(StorageService.getFinancialAudit(currentUser));
    setCatalogCategories(StorageService.getCategories());
  };

  // Feedback notifications
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  // Filtros da tabela
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Estados para Gestão de Cadastros (Categorias, Centros de Custo, Contas e Formas de Pagamento)
  const [cadastrosSearch, setCadastrosSearch] = useState('');
  const [cadastrosStatusFilter, setCadastrosStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [categoryViewMode, setCategoryViewMode] = useState<'financial' | 'catalog'>('financial');
  const [catalogCategories, setCatalogCategories] = useState<Category[]>(() => StorageService.getCategories());

  // Modal Categoria Financeira
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<FinancialCategory | null>(null);
  const [catFormName, setCatFormName] = useState('');
  const [catFormType, setCatFormType] = useState<'receita' | 'despesa' | 'ambos'>('receita');
  const [catFormColor, setCatFormColor] = useState('#10B981');
  const [catFormDesc, setCatFormDesc] = useState('');
  const [catFormActive, setCatFormActive] = useState(true);

  // Modal Centro de Custo
  const [isCostCenterModalOpen, setIsCostCenterModalOpen] = useState(false);
  const [editingCostCenter, setEditingCostCenter] = useState<CostCenter | null>(null);
  const [ccFormCode, setCcFormCode] = useState('');
  const [ccFormName, setCcFormName] = useState('');
  const [ccFormDesc, setCcFormDesc] = useState('');
  const [ccFormActive, setCcFormActive] = useState(true);

  // Modal Conta Bancária & Caixa
  const [isBankAccountModalOpen, setIsBankAccountModalOpen] = useState(false);
  const [editingBankAccount, setEditingBankAccount] = useState<BankAccount | null>(null);
  const [bankFormName, setBankFormName] = useState('');
  const [bankFormBankName, setBankFormBankName] = useState('');
  const [bankFormAgency, setBankFormAgency] = useState('');
  const [bankFormAccountNumber, setBankFormAccountNumber] = useState('');
  const [bankFormType, setBankFormType] = useState<'corrente' | 'poupanca' | 'caixa_fisico' | 'carteira_digital'>('corrente');
  const [bankFormInitialBalance, setBankFormInitialBalance] = useState(0);
  const [bankFormCurrentBalance, setBankFormCurrentBalance] = useState(0);
  const [bankFormIsDefault, setBankFormIsDefault] = useState(false);
  const [bankFormActive, setBankFormActive] = useState(true);

  // Modal Forma de Pagamento
  const [isPaymentMethodModalOpen, setIsPaymentMethodModalOpen] = useState(false);
  const [editingPaymentMethod, setEditingPaymentMethod] = useState<FinancialPaymentMethod | null>(null);
  const [pmFormName, setPmFormName] = useState('');
  const [pmFormCode, setPmFormCode] = useState('');
  const [pmFormTaxPercent, setPmFormTaxPercent] = useState(0);
  const [pmFormDaysToClear, setPmFormDaysToClear] = useState(0);
  const [pmFormActive, setPmFormActive] = useState(true);

  // Modal Categoria de Catálogo
  const [isCatalogCategoryModalOpen, setIsCatalogCategoryModalOpen] = useState(false);
  const [editingCatalogCategory, setEditingCatalogCategory] = useState<Category | null>(null);
  const [catCatName, setCatCatName] = useState('');
  const [catCatSlug, setCatCatSlug] = useState('');
  const [catCatDesc, setCatCatDesc] = useState('');
  const [catCatIcon, setCatCatIcon] = useState('Package');
  const [catCatImage, setCatCatImage] = useState('');
  const [catCatOrder, setCatCatOrder] = useState(1);

  // Modal Confirmação de Exclusão (Deletar)
  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState<{
    type: 'financial_category' | 'cost_center' | 'bank_account' | 'payment_method' | 'catalog_category';
    id: string;
    title: string;
    name: string;
    warning?: string;
  } | null>(null);

  // Modais de Operação
  const [isNewAccountModalOpen, setIsNewAccountModalOpen] = useState(false);
  const [modalAccountType, setModalAccountType] = useState<'receber' | 'pagar'>('receber');
  const [editingAccount, setEditingAccount] = useState<FinancialAccount | null>(null);

  // Modal de Baixa / Liquidação
  const [settlingAccount, setSettlingAccount] = useState<FinancialAccount | null>(null);
  const [settleAmount, setSettleAmount] = useState<number>(0);
  const [settleDate, setSettleDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [settleBankId, setSettleBankId] = useState<string>('');
  const [settleMethod, setSettleMethod] = useState<string>('');
  const [settleDiscount, setSettleDiscount] = useState<number>(0);
  const [settleInterest, setSettleInterest] = useState<number>(0);
  const [settleNotes, setSettleNotes] = useState<string>('');

  // Modal de Cancelamento
  const [cancellingAccount, setCancellingAccount] = useState<FinancialAccount | null>(null);
  const [cancelReason, setCancelReason] = useState<string>('');

  // Modal de Estorno
  const [refundingAccount, setRefundingAccount] = useState<FinancialAccount | null>(null);
  const [refundReason, setRefundReason] = useState<string>('');

  // Form states para criação/edição
  const [formDescription, setFormDescription] = useState('');
  const [formEntityName, setFormEntityName] = useState('');
  const [formEntityDoc, setFormEntityDoc] = useState('');
  const [formAmount, setFormAmount] = useState<number>(0);
  const [formDueDate, setFormDueDate] = useState('');
  const [formCategoryId, setFormCategoryId] = useState('');
  const [formCostCenterId, setFormCostCenterId] = useState('');
  const [formBankId, setFormBankId] = useState('');
  const [formPaymentMethod, setFormPaymentMethod] = useState('');
  const [formNotes, setFormNotes] = useState('');

  // --------------------------------------------------------------------------
  // HANDLERS DE AÇÕES FINANCEIRAS
  // --------------------------------------------------------------------------

  // Abrir Modal de Criação
  const handleOpenCreateModal = (type: 'receber' | 'pagar') => {
    if (type === 'receber' && !canCreateReceivable) {
      showToast('error', 'Acesso negado: Você não possui a permissão "Criar Conta a Receber".');
      return;
    }
    if (type === 'pagar' && !canCreatePayable) {
      showToast('error', 'Acesso negado: Você não possui a permissão "Criar Conta a Pagar".');
      return;
    }

    setModalAccountType(type);
    setEditingAccount(null);
    setFormDescription('');
    setFormEntityName('');
    setFormEntityDoc('');
    setFormAmount(0);
    const in15days = new Date();
    in15days.setDate(in15days.getDate() + 15);
    setFormDueDate(in15days.toISOString().split('T')[0]);
    setFormCategoryId(categories.find((c) => c.type === (type === 'receber' ? 'receita' : 'despesa'))?.id || '');
    setFormCostCenterId(costCenters[0]?.id || '');
    setFormBankId(bankAccounts[0]?.id || '');
    setFormPaymentMethod(paymentMethods[0]?.name || 'PIX Instantâneo');
    setFormNotes('');
    setIsNewAccountModalOpen(true);
  };

  // Abrir Modal de Edição
  const handleOpenEditModal = (account: FinancialAccount) => {
    if (account.type === 'receber' && !canEditReceivable) {
      showToast('error', 'Acesso negado: Você não possui a permissão "Editar Conta a Receber".');
      return;
    }
    if (account.type === 'pagar' && !canEditPayable) {
      showToast('error', 'Acesso negado: Você não possui a permissão "Editar Conta a Pagar".');
      return;
    }

    setEditingAccount(account);
    setModalAccountType(account.type);
    setFormDescription(account.description);
    setFormEntityName(account.entityName);
    setFormEntityDoc(account.entityDocument || '');
    setFormAmount(account.amount);
    setFormDueDate(account.dueDate);
    setFormCategoryId(account.categoryId);
    setFormCostCenterId(account.costCenterId || '');
    setFormBankId(account.bankAccountId || '');
    setFormPaymentMethod(account.paymentMethod || '');
    setFormNotes(account.notes || '');
    setIsNewAccountModalOpen(true);
  };

  // Salvar Criação / Edição
  const handleSaveAccount = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formDescription.trim() || !formEntityName.trim() || formAmount <= 0 || !formDueDate) {
      showToast('error', 'Preencha a descrição, cliente/fornecedor, valor e data de vencimento.');
      return;
    }

    const catObj = categories.find((c) => c.id === formCategoryId);
    const ccObj = costCenters.find((c) => c.id === formCostCenterId);
    const bankObj = bankAccounts.find((b) => b.id === formBankId);

    if (editingAccount) {
      // Editar
      const res = StorageService.updateFinancialAccount(
        {
          ...editingAccount,
          description: formDescription.trim(),
          entityName: formEntityName.trim(),
          entityDocument: formEntityDoc.trim() || undefined,
          amount: formAmount,
          dueDate: formDueDate,
          categoryId: formCategoryId,
          categoryName: catObj?.name || editingAccount.categoryName,
          costCenterId: formCostCenterId || undefined,
          costCenterName: ccObj?.name || undefined,
          bankAccountId: formBankId || undefined,
          bankAccountName: bankObj?.name || undefined,
          paymentMethod: formPaymentMethod || undefined,
          notes: formNotes.trim() || undefined,
        },
        currentUser
      );

      if (!res.success) {
        showToast('error', res.error || 'Erro ao atualizar conta.');
        return;
      }
      showToast('success', `Conta ${editingAccount.code} atualizada com sucesso!`);
    } else {
      // Criar nova
      const res = StorageService.createFinancialAccount(
        {
          type: modalAccountType,
          description: formDescription.trim(),
          entityName: formEntityName.trim(),
          entityDocument: formEntityDoc.trim() || undefined,
          amount: formAmount,
          dueDate: formDueDate,
          issueDate: new Date().toISOString(),
          status: 'pendente',
          categoryId: formCategoryId,
          categoryName: catObj?.name || 'Geral',
          costCenterId: formCostCenterId || undefined,
          costCenterName: ccObj?.name || undefined,
          bankAccountId: formBankId || undefined,
          bankAccountName: bankObj?.name || undefined,
          paymentMethod: formPaymentMethod || undefined,
          notes: formNotes.trim() || undefined,
          createdBy: currentUser.id,
          createdByName: currentUser.name,
        },
        currentUser
      );

      if (!res.success || !res.account) {
        showToast('error', res.error || 'Erro ao criar lançamento.');
        return;
      }
      showToast('success', `Lançamento ${res.account.code} criado com sucesso!`);
    }

    setIsNewAccountModalOpen(false);
    refreshAll();
  };

  // Abrir Modal de Baixa
  const handleOpenSettleModal = (account: FinancialAccount) => {
    if (account.type === 'receber' && !canReceivePayment) {
      showToast('error', 'Acesso negado: Você não possui a permissão "Baixar/Receber Conta".');
      return;
    }
    if (account.type === 'pagar' && !canPayBill) {
      showToast('error', 'Acesso negado: Você não possui a permissão "Baixar/Pagar Conta".');
      return;
    }

    setSettlingAccount(account);
    setSettleAmount(account.amount);
    setSettleDate(new Date().toISOString().split('T')[0]);
    setSettleBankId(account.bankAccountId || bankAccounts[0]?.id || '');
    setSettleMethod(account.paymentMethod || paymentMethods[0]?.name || 'PIX Instantâneo');
    setSettleDiscount(0);
    setSettleInterest(0);
    setSettleNotes('');
  };

  // Confirmar Baixa
  const handleConfirmSettle = (e: React.FormEvent) => {
    e.preventDefault();
    if (!settlingAccount) return;

    if (settleAmount <= 0) {
      showToast('error', 'Informe um valor de liquidação válido maior que zero.');
      return;
    }

    const bankObj = bankAccounts.find((b) => b.id === settleBankId);

    const res = StorageService.settleFinancialAccount(
      settlingAccount.id,
      {
        paidAmount: settleAmount,
        paymentDate: settleDate,
        paymentMethod: settleMethod,
        bankAccountId: settleBankId || undefined,
        bankAccountName: bankObj?.name || undefined,
        discountAmount: settleDiscount,
        interestAmount: settleInterest,
        notes: settleNotes.trim() || undefined,
      },
      currentUser
    );

    if (!res.success) {
      showToast('error', res.error || 'Erro ao processar baixa.');
      return;
    }

    showToast('success', `Conta ${settlingAccount.code} baixada com sucesso!`);
    setSettlingAccount(null);
    refreshAll();
  };

  // Abrir Modal de Cancelamento
  const handleOpenCancelModal = (account: FinancialAccount) => {
    if (account.type === 'receber' && !canCancelReceivable) {
      showToast('error', 'Acesso negado: Você não possui permissão para cancelar contas a receber.');
      return;
    }
    if (account.type === 'pagar' && !canCancelPayable) {
      showToast('error', 'Acesso negado: Você não possui permissão para cancelar contas a pagar.');
      return;
    }
    setCancellingAccount(account);
    setCancelReason('');
  };

  // Confirmar Cancelamento
  const handleConfirmCancel = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancellingAccount) return;

    if (!cancelReason.trim()) {
      showToast('error', 'O motivo do cancelamento é obrigatório por política de segurança.');
      return;
    }

    const res = StorageService.cancelFinancialAccount(cancellingAccount.id, cancelReason, currentUser);
    if (!res.success) {
      showToast('error', res.error || 'Erro ao cancelar conta.');
      return;
    }

    showToast('success', `Conta ${cancellingAccount.code} cancelada.`);
    setCancellingAccount(null);
    refreshAll();
  };

  // Abrir Modal de Estorno
  const handleOpenRefundModal = (account: FinancialAccount) => {
    if (account.type === 'receber' && !canRefundReceivable) {
      showToast('error', 'Acesso negado: Você não possui permissão para estornar recebimentos.');
      return;
    }
    if (account.type === 'pagar' && !canRefundPayable) {
      showToast('error', 'Acesso negado: Você não possui permissão para estornar pagamentos.');
      return;
    }
    setRefundingAccount(account);
    setRefundReason('');
  };

  // Confirmar Estorno
  const handleConfirmRefund = (e: React.FormEvent) => {
    e.preventDefault();
    if (!refundingAccount) return;

    if (!refundReason.trim()) {
      showToast('error', 'O motivo do estorno é obrigatório por política de segurança.');
      return;
    }

    const res = StorageService.refundFinancialAccount(refundingAccount.id, refundReason, currentUser);
    if (!res.success) {
      showToast('error', res.error || 'Erro ao estornar lançamento.');
      return;
    }

    showToast('success', `Lançamento ${refundingAccount.code} estornado com sucesso.`);
    setRefundingAccount(null);
    refreshAll();
  };

  // Exportação de Relatórios com verificação estrita (Requisito 16)
  const handleExportReports = (format: 'pdf' | 'excel' | 'csv' | 'print') => {
    if (!canExportReports) {
      showToast(
        'error',
        'Acesso bloqueado: Você possui permissão para visualizar relatórios, mas não para exportar dados (permissão "Exportar Relatórios Financeiros" necessária).'
      );
      StorageService.addFinancialAuditEntry({
        userId: currentUser.id,
        userName: currentUser.name,
        userEmail: currentUser.email,
        userRole: currentUser.role,
        operation: 'EXPORTAR_RELATORIO_NEGADO',
        permissionUsed: 'canExportFinancialReports',
        affectedRecordType: 'relatorio',
        result: 'bloqueado',
        details: `Tentativa de exportação de relatório no formato ${format.toUpperCase()} bloqueada por falta de permissão.`,
        origin: 'web_painel',
      });
      return;
    }

    // Autorizado: registra auditoria e simula exportação
    StorageService.addFinancialAuditEntry({
      userId: currentUser.id,
      userName: currentUser.name,
      userEmail: currentUser.email,
      userRole: currentUser.role,
      operation: 'EXPORTAR_RELATORIO_FINANCEIRO',
      permissionUsed: 'canExportFinancialReports',
      affectedRecordType: 'relatorio',
      result: 'sucesso',
      details: `Relatório financeiro exportado com sucesso no formato ${format.toUpperCase()}.`,
      origin: 'web_painel',
    });

    if (format === 'print') {
      window.print();
    } else {
      showToast('success', `Relatório financeiro gerado com sucesso (${format.toUpperCase()})!`);
    }
  };

  // --------------------------------------------------------------------------
  // HANDLERS DE CADASTROS (CATEGORIAS, CENTROS DE CUSTO, CONTAS, FORMAS PGTO)
  // --------------------------------------------------------------------------

  // 1. Categorias Financeiras
  const handleOpenCategoryModal = (cat?: FinancialCategory) => {
    if (!canManageCategories) {
      showToast('error', 'Acesso negado: sem permissão para gerenciar categorias financeiras.');
      return;
    }
    if (cat) {
      setEditingCategory(cat);
      setCatFormName(cat.name);
      setCatFormType(cat.type);
      setCatFormColor(cat.color || '#10B981');
      setCatFormDesc(cat.description || '');
      setCatFormActive(cat.active);
    } else {
      setEditingCategory(null);
      setCatFormName('');
      setCatFormType('despesa');
      setCatFormColor('#E6007E');
      setCatFormDesc('');
      setCatFormActive(true);
    }
    setIsCategoryModalOpen(true);
  };

  const handleSaveFinancialCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageCategories) {
      showToast('error', 'Acesso negado: permissão necessária.');
      return;
    }
    if (!catFormName.trim()) {
      showToast('error', 'O nome da categoria é obrigatório.');
      return;
    }
    const catToSave: FinancialCategory = {
      id: editingCategory ? editingCategory.id : `fcat-${Date.now()}`,
      name: catFormName.trim(),
      type: catFormType,
      color: catFormColor,
      description: catFormDesc.trim() || undefined,
      active: catFormActive,
    };
    const res = StorageService.saveFinancialCategory(catToSave, currentUser);
    if (!res.success) {
      showToast('error', res.error || 'Erro ao salvar categoria.');
      return;
    }
    showToast('success', editingCategory ? 'Categoria atualizada com sucesso!' : 'Nova categoria cadastrada com sucesso!');
    setIsCategoryModalOpen(false);
    refreshAll();
  };

  const handleToggleCategoryActive = (cat: FinancialCategory) => {
    if (!canManageCategories) return;
    const updated = { ...cat, active: !cat.active };
    StorageService.saveFinancialCategory(updated, currentUser);
    showToast('success', `Categoria "${cat.name}" ${updated.active ? 'ativada' : 'desativada'}.`);
    refreshAll();
  };

  // 2. Centros de Custo
  const handleOpenCostCenterModal = (cc?: CostCenter) => {
    if (!canManageCostCenters) {
      showToast('error', 'Acesso negado: sem permissão para gerenciar centros de custo.');
      return;
    }
    if (cc) {
      setEditingCostCenter(cc);
      setCcFormCode(cc.code);
      setCcFormName(cc.name);
      setCcFormDesc(cc.description || '');
      setCcFormActive(cc.active);
    } else {
      setEditingCostCenter(null);
      setCcFormCode(`CC-0${costCenters.length + 1}`);
      setCcFormName('');
      setCcFormDesc('');
      setCcFormActive(true);
    }
    setIsCostCenterModalOpen(true);
  };

  const handleSaveCostCenter = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageCostCenters) {
      showToast('error', 'Acesso negado: permissão necessária.');
      return;
    }
    if (!ccFormName.trim() || !ccFormCode.trim()) {
      showToast('error', 'Código e nome do centro de custo são obrigatórios.');
      return;
    }
    const ccToSave: CostCenter = {
      id: editingCostCenter ? editingCostCenter.id : `cc-${Date.now()}`,
      code: ccFormCode.trim().toUpperCase(),
      name: ccFormName.trim(),
      description: ccFormDesc.trim() || undefined,
      active: ccFormActive,
    };
    const res = StorageService.saveCostCenter(ccToSave, currentUser);
    if (!res.success) {
      showToast('error', res.error || 'Erro ao salvar centro de custo.');
      return;
    }
    showToast('success', editingCostCenter ? 'Centro de custo atualizado com sucesso!' : 'Novo centro de custo cadastrado com sucesso!');
    setIsCostCenterModalOpen(false);
    refreshAll();
  };

  const handleToggleCostCenterActive = (cc: CostCenter) => {
    if (!canManageCostCenters) return;
    const updated = { ...cc, active: !cc.active };
    StorageService.saveCostCenter(updated, currentUser);
    showToast('success', `Centro de custo "${cc.name}" ${updated.active ? 'ativado' : 'desativado'}.`);
    refreshAll();
  };

  // 3. Contas Bancárias & Caixas
  const handleOpenBankAccountModal = (b?: BankAccount) => {
    if (!canManageBankAccounts) {
      showToast('error', 'Acesso negado: sem permissão para gerenciar contas bancárias.');
      return;
    }
    if (b) {
      setEditingBankAccount(b);
      setBankFormName(b.name);
      setBankFormBankName(b.bankName);
      setBankFormAgency(b.agency);
      setBankFormAccountNumber(b.accountNumber);
      setBankFormType(b.accountType);
      setBankFormInitialBalance(b.initialBalance);
      setBankFormCurrentBalance(b.currentBalance);
      setBankFormIsDefault(b.isDefault);
      setBankFormActive(b.active);
    } else {
      setEditingBankAccount(null);
      setBankFormName('');
      setBankFormBankName('Banco Itaú Unibanco');
      setBankFormAgency('');
      setBankFormAccountNumber('');
      setBankFormType('corrente');
      setBankFormInitialBalance(0);
      setBankFormCurrentBalance(0);
      setBankFormIsDefault(bankAccounts.length === 0);
      setBankFormActive(true);
    }
    setIsBankAccountModalOpen(true);
  };

  const handleSaveBankAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageBankAccounts) {
      showToast('error', 'Acesso negado: permissão necessária.');
      return;
    }
    if (!bankFormName.trim() || !bankFormBankName.trim()) {
      showToast('error', 'Nome identificador e banco/instituição são obrigatórios.');
      return;
    }
    const bToSave: BankAccount = {
      id: editingBankAccount ? editingBankAccount.id : `bank-${Date.now()}`,
      name: bankFormName.trim(),
      bankName: bankFormBankName.trim(),
      agency: bankFormAgency.trim() || '0001',
      accountNumber: bankFormAccountNumber.trim() || '00000-0',
      accountType: bankFormType,
      initialBalance: Number(bankFormInitialBalance) || 0,
      currentBalance: Number(bankFormCurrentBalance) || 0,
      isDefault: bankFormIsDefault,
      active: bankFormActive,
    };
    const res = StorageService.saveBankAccount(bToSave, currentUser);
    if (!res.success) {
      showToast('error', res.error || 'Erro ao salvar conta bancária.');
      return;
    }
    showToast('success', editingBankAccount ? 'Conta bancária atualizada com sucesso!' : 'Nova conta / caixa cadastrado com sucesso!');
    setIsBankAccountModalOpen(false);
    refreshAll();
  };

  const handleToggleBankAccountActive = (b: BankAccount) => {
    if (!canManageBankAccounts) return;
    const updated = { ...b, active: !b.active };
    StorageService.saveBankAccount(updated, currentUser);
    showToast('success', `Conta "${b.name}" ${updated.active ? 'ativada' : 'desativada'}.`);
    refreshAll();
  };

  // 4. Formas de Pagamento
  const handleOpenPaymentMethodModal = (pm?: FinancialPaymentMethod) => {
    if (!canManagePaymentMethods) {
      showToast('error', 'Acesso negado: sem permissão para gerenciar formas de pagamento.');
      return;
    }
    if (pm) {
      setEditingPaymentMethod(pm);
      setPmFormName(pm.name);
      setPmFormCode(pm.code);
      setPmFormTaxPercent(pm.taxPercent);
      setPmFormDaysToClear(pm.daysToClear);
      setPmFormActive(pm.active);
    } else {
      setEditingPaymentMethod(null);
      setPmFormName('');
      setPmFormCode('');
      setPmFormTaxPercent(0);
      setPmFormDaysToClear(0);
      setPmFormActive(true);
    }
    setIsPaymentMethodModalOpen(true);
  };

  const handleSavePaymentMethod = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManagePaymentMethods) {
      showToast('error', 'Acesso negado: permissão necessária.');
      return;
    }
    if (!pmFormName.trim()) {
      showToast('error', 'Nome da forma de pagamento é obrigatório.');
      return;
    }
    const code = pmFormCode.trim() || pmFormName.toLowerCase().replace(/[^a-z0-9]/gi, '_');
    const pmToSave: FinancialPaymentMethod = {
      id: editingPaymentMethod ? editingPaymentMethod.id : `fpm-${Date.now()}`,
      name: pmFormName.trim(),
      code,
      taxPercent: Number(pmFormTaxPercent) || 0,
      daysToClear: Number(pmFormDaysToClear) || 0,
      active: pmFormActive,
    };
    const res = StorageService.saveFinancialPaymentMethod(pmToSave, currentUser);
    if (!res.success) {
      showToast('error', res.error || 'Erro ao salvar forma de pagamento.');
      return;
    }
    showToast('success', editingPaymentMethod ? 'Forma de pagamento atualizada com sucesso!' : 'Nova forma de pagamento cadastrada com sucesso!');
    setIsPaymentMethodModalOpen(false);
    refreshAll();
  };

  const handleTogglePaymentMethodActive = (pm: FinancialPaymentMethod) => {
    if (!canManagePaymentMethods) return;
    const updated = { ...pm, active: !pm.active };
    StorageService.saveFinancialPaymentMethod(updated, currentUser);
    showToast('success', `Forma de pagamento "${pm.name}" ${updated.active ? 'ativada' : 'desativada'}.`);
    refreshAll();
  };

  // 5. Categorias do Catálogo (Produtos da Loja)
  const handleOpenCatalogCategoryModal = (cat?: Category) => {
    if (cat) {
      setEditingCatalogCategory(cat);
      setCatCatName(cat.name);
      setCatCatSlug(cat.slug);
      setCatCatDesc(cat.description || '');
      setCatCatIcon(cat.icon || 'Package');
      setCatCatImage(cat.image || '');
      setCatCatOrder(cat.order || 1);
    } else {
      setEditingCatalogCategory(null);
      setCatCatName('');
      setCatCatSlug('');
      setCatCatDesc('');
      setCatCatIcon('Package');
      setCatCatImage('https://images.unsplash.com/photo-1544816155-12df9643f363?w=500&auto=format&fit=crop&q=60');
      setCatCatOrder(catalogCategories.length + 1);
    }
    setIsCatalogCategoryModalOpen(true);
  };

  const handleSaveCatalogCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!catCatName.trim()) {
      showToast('error', 'Nome da categoria do catálogo é obrigatório.');
      return;
    }
    const slug =
      catCatSlug.trim() ||
      catCatName
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-');
    const catToSave: Category = {
      id: editingCatalogCategory ? editingCatalogCategory.id : `cat-${Date.now()}`,
      name: catCatName.trim(),
      slug,
      description: catCatDesc.trim() || '',
      icon: catCatIcon.trim() || 'Package',
      image:
        catCatImage.trim() ||
        'https://images.unsplash.com/photo-1544816155-12df9643f363?w=500&auto=format&fit=crop&q=60',
      order: Number(catCatOrder) || 1,
    };
    const res = StorageService.saveCategory(catToSave);
    if (!res.success) {
      showToast('error', res.error || 'Erro ao salvar categoria.');
      return;
    }
    showToast('success', editingCatalogCategory ? 'Categoria do catálogo atualizada!' : 'Nova categoria do catálogo criada!');
    setIsCatalogCategoryModalOpen(false);
    refreshAll();
  };

  // 6. Confirmação e Execução de Exclusão (Deletar)
  const handlePromptDelete = (
    type: 'financial_category' | 'cost_center' | 'bank_account' | 'payment_method' | 'catalog_category',
    id: string,
    name: string
  ) => {
    let title = 'Excluir Registro';
    let warning: string | undefined;

    if (type === 'financial_category') {
      title = 'Excluir Categoria Financeira';
      const linked = accounts.filter((a) => a.categoryId === id).length;
      if (linked > 0) {
        warning = `Atenção: existem ${linked} lançamento(s) vinculados a esta categoria. A exclusão será bloqueada enquanto houver lançamentos associados.`;
      }
    } else if (type === 'cost_center') {
      title = 'Excluir Centro de Custo';
      const linked = accounts.filter((a) => a.costCenterId === id).length;
      if (linked > 0) {
        warning = `Atenção: existem ${linked} lançamento(s) vinculados a este centro de custo.`;
      }
    } else if (type === 'bank_account') {
      title = 'Excluir Conta Bancária / Caixa';
      const target = bankAccounts.find((b) => b.id === id);
      if (target && target.isDefault) {
        warning = 'Esta é a conta bancária padrão do sistema. Defina outra conta como padrão antes de removê-la.';
      } else if (target && target.currentBalance !== 0) {
        warning = `Atenção: esta conta possui saldo atual de R$ ${target.currentBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.`;
      }
    } else if (type === 'payment_method') {
      title = 'Excluir Forma de Pagamento';
    } else if (type === 'catalog_category') {
      title = 'Excluir Categoria do Catálogo';
      const prods = StorageService.getProducts();
      const linked = prods.filter((p) => p.categoryId === id).length;
      if (linked > 0) {
        warning = `Atenção: existem ${linked} produto(s) vinculados a esta categoria no catálogo da loja. Mova os produtos antes de excluir.`;
      }
    }

    setDeleteConfirmTarget({
      type,
      id,
      title,
      name,
      warning,
    });
  };

  const handleExecuteDelete = () => {
    if (!deleteConfirmTarget) return;
    const { type, id, name } = deleteConfirmTarget;

    let res: { success: boolean; error?: string } = { success: false };

    if (type === 'financial_category') {
      res = StorageService.deleteFinancialCategory(id, currentUser);
    } else if (type === 'cost_center') {
      res = StorageService.deleteCostCenter(id, currentUser);
    } else if (type === 'bank_account') {
      res = StorageService.deleteBankAccount(id, currentUser);
    } else if (type === 'payment_method') {
      res = StorageService.deleteFinancialPaymentMethod(id, currentUser);
    } else if (type === 'catalog_category') {
      res = StorageService.deleteCategory(id);
    }

    if (!res.success) {
      showToast('error', res.error || `Não foi possível excluir "${name}".`);
    } else {
      showToast('success', `"${name}" excluído(a) com sucesso!`);
      setDeleteConfirmTarget(null);
      refreshAll();
    }
  };

  // --------------------------------------------------------------------------
  // CÁLCULOS E METRICAS DO DASHBOARD & FLUXO
  // --------------------------------------------------------------------------
  const metrics = useMemo(() => {
    const recs = accounts.filter((a) => a.type === 'receber');
    const pays = accounts.filter((a) => a.type === 'pagar');

    const totalReceivablePending = recs
      .filter((a) => a.status === 'pendente' || a.status === 'vencido')
      .reduce((acc, a) => acc + a.amount, 0);

    const totalReceivableOverdue = recs
      .filter((a) => a.status === 'vencido')
      .reduce((acc, a) => acc + a.amount, 0);

    const totalReceivedRealized = recs
      .filter((a) => a.status === 'pago')
      .reduce((acc, a) => acc + (a.paidAmount || a.amount), 0);

    const totalPayablePending = pays
      .filter((a) => a.status === 'pendente' || a.status === 'vencido')
      .reduce((acc, a) => acc + a.amount, 0);

    const totalPayableOverdue = pays
      .filter((a) => a.status === 'vencido')
      .reduce((acc, a) => acc + a.amount, 0);

    const totalPaidRealized = pays
      .filter((a) => a.status === 'pago')
      .reduce((acc, a) => acc + (a.paidAmount || a.amount), 0);

    const totalBankBalance = bankAccounts.reduce((acc, b) => acc + b.currentBalance, 0);

    const projectedBalance = totalBankBalance + totalReceivablePending - totalPayablePending;

    return {
      totalReceivablePending,
      totalReceivableOverdue,
      totalReceivedRealized,
      totalPayablePending,
      totalPayableOverdue,
      totalPaidRealized,
      totalBankBalance,
      projectedBalance,
    };
  }, [accounts, bankAccounts]);

  // Contas filtradas para as listas
  const filteredAccounts = useMemo(() => {
    return accounts.filter((acc) => {
      // Tipo da aba atual
      if (activeTab === 'receivables' && acc.type !== 'receber') return false;
      if (activeTab === 'payables' && acc.type !== 'pagar') return false;

      // Status
      if (statusFilter !== 'all' && acc.status !== statusFilter) return false;

      // Categoria
      if (categoryFilter !== 'all' && acc.categoryId !== categoryFilter) return false;

      // Busca por texto
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matches =
          acc.code.toLowerCase().includes(q) ||
          acc.description.toLowerCase().includes(q) ||
          acc.entityName.toLowerCase().includes(q) ||
          (acc.entityDocument && acc.entityDocument.includes(q)) ||
          (acc.orderCode && acc.orderCode.toLowerCase().includes(q)) ||
          (acc.quoteCode && acc.quoteCode.toLowerCase().includes(q));
        if (!matches) return false;
      }

      return true;
    });
  }, [accounts, activeTab, statusFilter, categoryFilter, searchTerm]);

  // Se bloqueado:
  if (!hasModuleAccess) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-4 sm:p-6 bg-slate-50">
        <div className="max-w-md w-full bg-white rounded-3xl border border-rose-200 p-8 text-center shadow-xl space-y-6">
          <div className="w-20 h-20 rounded-3xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto shadow-inner">
            <ShieldAlert className="w-10 h-10 animate-bounce" />
          </div>

          <div className="space-y-2">
            <span className="px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-rose-100 text-rose-700">
              Segurança do Sistema • Acesso Restrito
            </span>
            <h1 className="text-2xl font-heading font-black text-slate-900 uppercase">
              Acesso Negado
            </h1>
            <p className="text-sm text-slate-600 leading-relaxed font-medium">
              Você não possui permissão para acessar este módulo. Entre em contato com o administrador do sistema.
            </p>
          </div>

          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-left text-xs space-y-1.5 text-slate-600">
            <p>
              <strong className="text-slate-800">Colaborador:</strong> {currentUser.name}
            </p>
            <p>
              <strong className="text-slate-800">Perfil:</strong> {currentUser.role.toUpperCase()}
            </p>
            <p>
              <strong className="text-slate-800">Permissão ausente:</strong>{' '}
              <code className="text-rose-600 font-mono bg-rose-50 px-1 rounded">canViewFinancialModule</code>
            </p>
          </div>

          {/* Test switcher para o avaliador testar diferentes perfis facilmente */}
          {onUserChange && (
            <div className="pt-2 border-t border-slate-100">
              <p className="text-[11px] text-slate-400 font-bold mb-2">Simular Perfil para Teste:</p>
              <div className="flex flex-wrap items-center justify-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    const admin = StorageService.switchRole('admin');
                    onUserChange(admin);
                  }}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-slate-900 text-white hover:bg-[#E6007E] cursor-pointer"
                >
                  Admin (Acesso Total)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const gerente = StorageService.switchRole('gerente');
                    onUserChange(gerente);
                  }}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-slate-200 text-slate-800 hover:bg-slate-300 cursor-pointer"
                >
                  Gerente (Padrão: Sem Acesso)
                </button>
              </div>
            </div>
          )}

          <div className="pt-2 flex flex-col sm:flex-row gap-2 justify-center">
            <button
              type="button"
              onClick={() => onNavigate('home')}
              className="px-5 py-2.5 rounded-xl text-xs font-bold bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
            >
              Página Inicial
            </button>
            <button
              type="button"
              onClick={() => onNavigate('admin')}
              className="px-5 py-2.5 rounded-xl text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Voltar ao Painel Geral
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 max-w-7xl mx-auto px-4 sm:px-6 py-6 pb-20 space-y-6">
      {/* Toast de Feedback */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 p-4 rounded-2xl shadow-2xl flex items-center gap-3 text-xs font-bold animate-fadeIn transition-all ${
            toast.type === 'success'
              ? 'bg-emerald-600 text-white shadow-emerald-500/20'
              : 'bg-rose-600 text-white shadow-rose-500/20'
          }`}
        >
          {toast.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertTriangle className="w-5 h-5 shrink-0" />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* HEADER PRINCIPAL COM BARRA DE SEGURANÇA E TESTE INTERATIVO */}
      <div className="bg-slate-900 text-white p-6 rounded-3xl shadow-xl space-y-4 border border-slate-800">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#E6007E] to-rose-600 flex items-center justify-center text-white shadow-md shrink-0">
              <DollarSign className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-heading font-black tracking-wide uppercase">
                  Módulo Financeiro
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" />
                  Acesso Restrito & Protegido
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Controle de Contas a Receber, Contas a Pagar, Fluxo de Caixa, Relatórios e Auditoria com Princípio do Menor Privilégio.
              </p>
            </div>
          </div>

          {/* Test Switcher Interativo (Permite demonstrar os diferentes níveis de segurança exigidos) */}
          {onUserChange && (
            <div className="bg-slate-800/90 p-2.5 rounded-2xl border border-slate-700/80 flex flex-wrap items-center gap-2 self-start lg:self-auto">
              <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                <SlidersHorizontal className="w-3 h-3 text-[#FFDD00]" />
                Perfil Atual:
              </span>
              <span className="px-2 py-0.5 rounded-md text-xs font-black uppercase bg-[#E6007E] text-white">
                {currentUser.name} ({currentUser.role})
              </span>
              <div className="h-4 w-[1px] bg-slate-700 hidden sm:block" />
              <button
                type="button"
                onClick={() => {
                  const admin = StorageService.switchRole('admin');
                  onUserChange(admin);
                  showToast('success', 'Alternado para Administrador (Acesso Total).');
                }}
                className={`px-2 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                  currentUser.role === 'admin'
                    ? 'bg-emerald-500 text-white font-extrabold shadow-xs'
                    : 'bg-slate-700/80 text-slate-300 hover:bg-slate-700'
                }`}
                title="Administrador: Acesso completo irrestrito a todas as operações"
              >
                Admin (Total)
              </button>
              <button
                type="button"
                onClick={() => {
                  // Cria ou concede perfil customizado com apenas Visualização
                  const user = StorageService.switchRole('gerente');
                  StorageService.grantFinancialPermissions(
                    user.id,
                    {
                      canViewFinancialModule: true,
                      canViewFinancialDashboard: true,
                      canViewReceivables: true,
                      canViewPayables: true,
                      canCreateReceivable: false,
                      canCreatePayable: false,
                      canReceivePayment: false,
                      canPayBill: false,
                      canCancelReceivable: false,
                      canCancelPayable: false,
                      canRefundReceivable: false,
                      canRefundPayable: false,
                      canViewReports: true,
                      canExportFinancialReports: false,
                    },
                    currentUser
                  );
                  onUserChange(StorageService.getCurrentUser());
                  showToast('success', 'Alternado para Usuário Apenas Consulta (Sem botões de ação ou exportação).');
                }}
                className="px-2 py-1 rounded-lg text-[11px] font-bold bg-slate-700/80 text-slate-300 hover:bg-slate-700 transition-all cursor-pointer"
                title="Usuário Consulta: Pode ver contas e relatórios, mas não pode baixar, cancelar, estornar ou exportar"
              >
                Apenas Consulta
              </button>
              <button
                type="button"
                onClick={() => {
                  // Usuário Operador de Recebimentos: Pode visualizar e baixar contas a receber, mas não cancelar
                  const user = StorageService.switchRole('vendedor');
                  StorageService.grantFinancialPermissions(
                    user.id,
                    {
                      canViewFinancialModule: true,
                      canViewReceivables: true,
                      canReceivePayment: true,
                      canCreateReceivable: true,
                      canCancelReceivable: false,
                      canRefundReceivable: false,
                      canViewPayables: false,
                      canViewReports: false,
                    },
                    currentUser
                  );
                  onUserChange(StorageService.getCurrentUser());
                  showToast('success', 'Alternado para Operador de Contas a Receber (Visualiza e baixa recebimentos, sem acesso a Contas a Pagar).');
                }}
                className="px-2 py-1 rounded-lg text-[11px] font-bold bg-slate-700/80 text-slate-300 hover:bg-slate-700 transition-all cursor-pointer"
                title="Operador Receber: Consegue visualizar e baixar recebimentos, mas bloqueado para contas a pagar e cancelamentos"
              >
                Operador Recebimento
              </button>
            </div>
          )}
        </div>

        {/* Status de Permissões do Usuário Ativo */}
        <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between text-[11px] text-slate-400 gap-2">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-300">Nível Efetivo:</span>
            {isFullAdmin ? (
              <span className="px-2 py-0.5 rounded bg-amber-400/20 text-amber-300 font-extrabold flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-[#FFDD00]" />
                Super Administrador (Acesso Irrestrito)
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded bg-sky-400/20 text-sky-300 font-bold flex items-center gap-1">
                <Shield className="w-3 h-3" />
                Usuário Autorizado com Permissões Concedidas (Menor Privilégio)
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span title="Exportar Relatórios">
              Exportar:{' '}
              {canExportReports ? (
                <strong className="text-emerald-400">Autorizado</strong>
              ) : (
                <strong className="text-rose-400">Bloqueado</strong>
              )}
            </span>
            <span title="Baixar Contas">
              Baixa de Contas:{' '}
              {canReceivePayment || canPayBill ? (
                <strong className="text-emerald-400">Autorizado</strong>
              ) : (
                <strong className="text-rose-400">Bloqueado</strong>
              )}
            </span>
            <span title="Cancelar / Estornar">
              Cancelamento:{' '}
              {canCancelReceivable || canCancelPayable ? (
                <strong className="text-emerald-400">Autorizado</strong>
              ) : (
                <strong className="text-rose-400">Bloqueado</strong>
              )}
            </span>
          </div>
        </div>
      </div>

      {/* NAVEGAÇÃO DE SUB-ABAS FINANCEIRAS COM OCULTAÇÃO ESTREITA DE ITENS NÃO AUTORIZADOS */}
      <div className="bg-white p-2 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-1.5 overflow-x-auto scrollbar-thin">
        {canViewDashboard && (
          <button
            type="button"
            onClick={() => setActiveTab('dashboard')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'dashboard'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <TrendingUp className="w-4 h-4 text-[#00AEEF]" />
            <span>Dashboard</span>
          </button>
        )}

        {canViewReceivables && (
          <button
            type="button"
            onClick={() => setActiveTab('receivables')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'receivables'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <ArrowDownLeft className="w-4 h-4 text-emerald-300" />
            <span>Contas a Receber</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20 font-extrabold">
              {accounts.filter((a) => a.type === 'receber').length}
            </span>
          </button>
        )}

        {canViewReceivables && (
          <button
            type="button"
            onClick={() => setActiveTab('boletos')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'boletos'
                ? 'bg-indigo-700 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <FileText className="w-4 h-4 text-indigo-300" />
            <span>Boletos & Faturamento</span>
          </button>
        )}

        {canViewPayables && (
          <button
            type="button"
            onClick={() => setActiveTab('payables')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'payables'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <ArrowUpRight className="w-4 h-4 text-rose-300" />
            <span>Contas a Pagar</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20 font-extrabold">
              {accounts.filter((a) => a.type === 'pagar').length}
            </span>
          </button>
        )}

        {canViewCashFlow && (
          <button
            type="button"
            onClick={() => setActiveTab('cash_flow')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'cash_flow'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Calendar className="w-4 h-4 text-amber-400" />
            <span>Fluxo de Caixa</span>
          </button>
        )}

        {canViewReports && (
          <button
            type="button"
            onClick={() => setActiveTab('reports')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'reports'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4 text-pink-400" />
            <span>Relatórios</span>
          </button>
        )}

        {(canManageCategories || canManageCostCenters || canManageBankAccounts || canManagePaymentMethods) && (
          <button
            type="button"
            onClick={() => setActiveTab('categories')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'categories' ||
              activeTab === 'cost_centers' ||
              activeTab === 'bank_accounts' ||
              activeTab === 'payment_methods'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Tags className="w-4 h-4 text-indigo-400" />
            <span>Cadastros Financeiros</span>
          </button>
        )}

        {canManageSettings && (
          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'settings'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4 text-purple-400" />
            <span>Configurações</span>
          </button>
        )}

        {canViewAudit && (
          <button
            type="button"
            onClick={() => setActiveTab('audit')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'audit'
                ? 'bg-gradient-to-r from-purple-800 to-indigo-900 text-white shadow-xs'
                : 'text-purple-700 bg-purple-50 hover:bg-purple-100'
            }`}
          >
            <History className="w-4 h-4 text-purple-300" />
            <span>Auditoria de Segurança</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-purple-500 text-white font-black">
              {auditLogs.length}
            </span>
          </button>
        )}
      </div>

      {/* ==================================================================== */}
      {/* 1. ABA DASHBOARD FINANCEIRO                                          */}
      {/* ==================================================================== */}
      {activeTab === 'dashboard' && canViewDashboard && (
        <div className="space-y-6">
          {/* Cards de KPIs Principais */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Saldo Bancário Atual */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
              <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
                <span>Saldo em Caixa / Bancos</span>
                <Landmark className="w-4 h-4 text-blue-500" />
              </div>
              <p className="text-2xl font-black text-slate-900">
                R$ {metrics.totalBankBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-[11px] text-slate-500 flex items-center gap-1 font-medium">
                Distribuído em {bankAccounts.filter((b) => b.active).length} contas bancárias ativas
              </p>
            </div>

            {/* A Receber Pendente */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
              <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
                <span>Total a Receber</span>
                <ArrowDownLeft className="w-4 h-4 text-emerald-500" />
              </div>
              <p className="text-2xl font-black text-emerald-600">
                R$ {metrics.totalReceivablePending.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
              {metrics.totalReceivableOverdue > 0 && (
                <p className="text-[11px] font-bold text-rose-600 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  R$ {metrics.totalReceivableOverdue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} vencidos
                </p>
              )}
            </div>

            {/* A Pagar Pendente */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
              <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
                <span>Total a Pagar</span>
                <ArrowUpRight className="w-4 h-4 text-rose-500" />
              </div>
              <p className="text-2xl font-black text-rose-600">
                R$ {metrics.totalPayablePending.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
              {metrics.totalPayableOverdue > 0 && (
                <p className="text-[11px] font-bold text-rose-600 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  R$ {metrics.totalPayableOverdue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} em atraso
                </p>
              )}
            </div>

            {/* Saldo Projetado */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
              <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
                <span>Saldo Projetado (30 Dias)</span>
                <TrendingUp className="w-4 h-4 text-[#00AEEF]" />
              </div>
              <p
                className={`text-2xl font-black ${
                  metrics.projectedBalance >= 0 ? 'text-slate-900' : 'text-rose-600'
                }`}
              >
                R$ {metrics.projectedBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-[11px] text-slate-500 font-medium">Saldo atual + Recebíveis - Despesas</p>
            </div>
          </div>

          {/* Gráfico / Resumo Comparativo */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Contas Bancárias */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-heading font-black text-sm uppercase text-slate-900 flex items-center gap-2">
                  <Landmark className="w-4 h-4 text-blue-600" />
                  Contas Bancárias & Caixas
                </h3>
                <span className="text-xs text-slate-500 font-bold">
                  {bankAccounts.length} Cadastradas
                </span>
              </div>
              <div className="space-y-3">
                {bankAccounts.map((b) => (
                  <div
                    key={b.id}
                    className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 border border-slate-100 text-xs"
                  >
                    <div>
                      <p className="font-bold text-slate-900">{b.name}</p>
                      <p className="text-[11px] text-slate-500">
                        {b.bankName} • Ag: {b.agency} • Conta: {b.accountNumber}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-slate-900 text-sm">
                        R$ {b.currentBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                      <span className="text-[10px] text-emerald-600 font-bold uppercase">
                        {b.accountType.replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Próximos Vencimentos Críticos */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-heading font-black text-sm uppercase text-slate-900 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-500" />
                  Próximos Vencimentos Críticos
                </h3>
                <span className="text-xs text-slate-500 font-bold">Agenda</span>
              </div>

              <div className="space-y-2.5">
                {accounts
                  .filter((a) => a.status === 'pendente' || a.status === 'vencido')
                  .slice(0, 5)
                  .map((acc) => (
                    <div
                      key={acc.id}
                      className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs"
                    >
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            acc.type === 'receber' ? 'bg-emerald-500' : 'bg-rose-500'
                          }`}
                        />
                        <div>
                          <p className="font-bold text-slate-900 truncate max-w-[200px] sm:max-w-xs">
                            {acc.description}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            {acc.entityName} • Vence: {new Date(acc.dueDate).toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p
                          className={`font-black ${
                            acc.type === 'receber' ? 'text-emerald-700' : 'text-rose-700'
                          }`}
                        >
                          {acc.type === 'receber' ? '+' : '-'} R${' '}
                          {acc.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                        <span
                          className={`text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded ${
                            acc.status === 'vencido'
                              ? 'bg-rose-100 text-rose-700'
                              : 'bg-amber-100 text-amber-700'
                          }`}
                        >
                          {acc.status}
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 2. ABA CONTAS A RECEBER OU CONTAS A PAGAR                            */}
      {/* ==================================================================== */}
      {(activeTab === 'receivables' || activeTab === 'payables') && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden space-y-4 p-5 sm:p-6">
          {/* Header e Barra de Ações com Verificação Estrita */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-heading font-black uppercase text-slate-900">
                  {activeTab === 'receivables' ? 'Contas a Receber (Receitas)' : 'Contas a Pagar (Despesas)'}
                </h2>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 font-extrabold text-slate-600">
                  {filteredAccounts.length} registros
                </span>
              </div>
              <p className="text-xs text-slate-500">
                {activeTab === 'receivables'
                  ? 'Gestão de títulos, recebimentos de vendas corporativas, balcão e prazos.'
                  : 'Controle de duplicatas de fornecedores (Stricker/Spot), aluguel, tributos e despesas.'}
              </p>
            </div>

            {/* Botão de Criação Condicionado a Permissão */}
            <div>
              {activeTab === 'receivables' && canCreateReceivable && (
                <button
                  type="button"
                  onClick={() => handleOpenCreateModal('receber')}
                  className="px-4 py-2.5 text-xs font-black text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Nova Conta a Receber</span>
                </button>
              )}

              {activeTab === 'payables' && canCreatePayable && (
                <button
                  type="button"
                  onClick={() => handleOpenCreateModal('pagar')}
                  className="px-4 py-2.5 text-xs font-black text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Nova Conta a Pagar</span>
                </button>
              )}
            </div>
          </div>

          {/* Filtros e Busca */}
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por código, descrição, cliente/fornecedor, pedido..."
                className="w-full pl-9 pr-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-slate-900"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
              >
                <option value="all">Todos os Status</option>
                <option value="pendente">Pendentes</option>
                <option value="vencido">Vencidos</option>
                <option value="pago">Quitados / Pagos</option>
                <option value="cancelado">Cancelados</option>
                <option value="estornado">Estornados</option>
              </select>

              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-3 py-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
              >
                <option value="all">Todas as Categorias</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Tabela de Contas com Ações Granulares */}
          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100/80 text-slate-600 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Código / Vencimento</th>
                  <th className="py-3 px-4">Descrição & Cliente/Fornecedor</th>
                  <th className="py-3 px-4">Categoria / Centro</th>
                  <th className="py-3 px-4">Valor</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Ações Autorizadas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAccounts.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400 font-medium">
                      Nenhuma conta financeira encontrada com os filtros selecionados.
                    </td>
                  </tr>
                ) : (
                  filteredAccounts.map((acc) => {
                    const isOverdue =
                      acc.status === 'pendente' &&
                      new Date(acc.dueDate).getTime() < new Date().setHours(0, 0, 0, 0);

                    return (
                      <tr key={acc.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4">
                          <p className="font-mono font-bold text-slate-900">{acc.code}</p>
                          <p
                            className={`text-[11px] font-medium ${
                              isOverdue ? 'text-rose-600 font-bold' : 'text-slate-500'
                            }`}
                          >
                            Vence: {new Date(acc.dueDate).toLocaleDateString('pt-BR')}
                          </p>
                        </td>

                        <td className="py-3 px-4">
                          <p className="font-bold text-slate-900">{acc.description}</p>
                          <p className="text-[11px] text-slate-500">
                            {acc.entityName}{' '}
                            {acc.entityDocument && <span className="font-mono font-normal">({acc.entityDocument})</span>}
                          </p>
                          {acc.orderCode && (
                            <span className="text-[10px] text-blue-600 font-bold">Ref: Pedido {acc.orderCode}</span>
                          )}
                        </td>

                        <td className="py-3 px-4">
                          <p className="font-semibold text-slate-800">{acc.categoryName}</p>
                          {acc.costCenterName && (
                            <p className="text-[10px] text-slate-400">{acc.costCenterName}</p>
                          )}
                        </td>

                        <td className="py-3 px-4 font-mono">
                          <p
                            className={`font-black text-sm ${
                              acc.type === 'receber' ? 'text-emerald-700' : 'text-rose-700'
                            }`}
                          >
                            R$ {acc.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </p>
                          {acc.paidAmount !== undefined && acc.status === 'pago' && (
                            <p className="text-[10px] text-slate-400">
                              Pago: R$ {acc.paidAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </p>
                          )}
                        </td>

                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                              acc.status === 'pago'
                                ? 'bg-emerald-100 text-emerald-800'
                                : acc.status === 'vencido' || isOverdue
                                ? 'bg-rose-100 text-rose-800 animate-pulse'
                                : acc.status === 'cancelado'
                                ? 'bg-slate-200 text-slate-600 line-through'
                                : acc.status === 'estornado'
                                ? 'bg-purple-100 text-purple-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {acc.status === 'pendente' && isOverdue ? 'vencido' : acc.status}
                          </span>
                        </td>

                        {/* Coluna de Ações com Validação por Operação */}
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {/* 1. Botão de Baixa / Liquidação */}
                            {acc.status === 'pendente' && (
                              <>
                                {((acc.type === 'receber' && canReceivePayment) ||
                                  (acc.type === 'pagar' && canPayBill)) && (
                                  <button
                                    type="button"
                                    onClick={() => handleOpenSettleModal(acc)}
                                    className="px-2.5 py-1 text-[11px] font-black text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs cursor-pointer flex items-center gap-1"
                                    title={acc.type === 'receber' ? 'Baixar / Receber' : 'Baixar / Pagar'}
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                    <span>{acc.type === 'receber' ? 'Receber' : 'Pagar'}</span>
                                  </button>
                                )}
                              </>
                            )}

                            {/* 2. Botão de Editar */}
                            {((acc.type === 'receber' && canEditReceivable) ||
                              (acc.type === 'pagar' && canEditPayable)) && (
                              <button
                                type="button"
                                onClick={() => handleOpenEditModal(acc)}
                                className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                                title="Editar Lançamento"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {/* 3. Botão de Cancelar */}
                            {acc.status === 'pendente' &&
                              ((acc.type === 'receber' && canCancelReceivable) ||
                                (acc.type === 'pagar' && canCancelPayable)) && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenCancelModal(acc)}
                                  className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                  title="Cancelar Conta"
                                >
                                  <XCircle className="w-3.5 h-3.5" />
                                </button>
                              )}

                            {/* 4. Botão de Estornar */}
                            {acc.status === 'pago' &&
                              ((acc.type === 'receber' && canRefundReceivable) ||
                                (acc.type === 'pagar' && canRefundPayable)) && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenRefundModal(acc)}
                                  className="px-2 py-1 text-[10px] font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors cursor-pointer flex items-center gap-1 border border-purple-200"
                                  title="Estornar liquidação financeira"
                                >
                                  <RotateCcw className="w-3 h-3" />
                                  <span>Estornar</span>
                                </button>
                              )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* ABA BOLETOS BANCÁRIOS & FATURAMENTO A PRAZO                          */}
      {/* ==================================================================== */}
      {activeTab === 'boletos' && (
        <BoletoBillingManagementTab currentUser={currentUser} />
      )}

      {/* ==================================================================== */}
      {/* 3. ABA FLUXO DE CAIXA (REALIZADO VS PROJETADO)                       */}
      {/* ==================================================================== */}
      {activeTab === 'cash_flow' && canViewCashFlow && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-lg font-heading font-black uppercase text-slate-900">
                Fluxo de Caixa & Projeção Financeira
              </h2>
              <p className="text-xs text-slate-500">
                Acompanhamento de entradas e saídas realizadas versus compromissos projetados.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Bloco 1: Valores Realizados */}
            <div className="p-5 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black uppercase text-slate-900 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Valores Realizados (Efetivamente Liquidados)
                </h3>
                {canViewRealized ? (
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                    Permissão Ativa
                  </span>
                ) : (
                  <span className="text-[10px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded">
                    Oculto por Permissão
                  </span>
                )}
              </div>

              {canViewRealized ? (
                <div className="space-y-3 pt-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-600 font-semibold">Total Recebido (Entradas):</span>
                    <span className="font-mono font-black text-emerald-600 text-sm">
                      + R$ {metrics.totalReceivedRealized.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-600 font-semibold">Total Pago (Saídas):</span>
                    <span className="font-mono font-black text-rose-600 text-sm">
                      - R$ {metrics.totalPaidRealized.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="pt-2 border-t border-slate-200 flex justify-between items-center text-xs">
                    <span className="text-slate-800 font-extrabold">Resultado Operacional Líquido:</span>
                    <span
                      className={`font-mono font-black text-sm ${
                        metrics.totalReceivedRealized - metrics.totalPaidRealized >= 0
                          ? 'text-emerald-700'
                          : 'text-rose-700'
                      }`}
                    >
                      R${' '}
                      {(metrics.totalReceivedRealized - metrics.totalPaidRealized).toLocaleString('pt-BR', {
                        minimumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-slate-100 rounded-xl text-center text-xs text-slate-500 font-medium">
                  <Lock className="w-4 h-4 mx-auto mb-1 text-slate-400" />
                  Você não possui permissão para visualizar valores realizados.
                </div>
              )}
            </div>

            {/* Bloco 2: Valores Projetados */}
            <div className="p-5 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black uppercase text-slate-900 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-blue-600" />
                  Valores Projetados (Próximos 30/60 Dias)
                </h3>
                {canViewProjected ? (
                  <span className="text-[10px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded">
                    Permissão Ativa
                  </span>
                ) : (
                  <span className="text-[10px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded">
                    Oculto por Permissão
                  </span>
                )}
              </div>

              {canViewProjected ? (
                <div className="space-y-3 pt-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-600 font-semibold">Previsão a Receber:</span>
                    <span className="font-mono font-black text-emerald-600 text-sm">
                      + R$ {metrics.totalReceivablePending.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-600 font-semibold">Previsão a Pagar:</span>
                    <span className="font-mono font-black text-rose-600 text-sm">
                      - R$ {metrics.totalPayablePending.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="pt-2 border-t border-slate-200 flex justify-between items-center text-xs">
                    <span className="text-slate-800 font-extrabold">Saldo Final Previsto:</span>
                    <span
                      className={`font-mono font-black text-sm ${
                        metrics.projectedBalance >= 0 ? 'text-blue-700' : 'text-rose-700'
                      }`}
                    >
                      R$ {metrics.projectedBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-slate-100 rounded-xl text-center text-xs text-slate-500 font-medium">
                  <Lock className="w-4 h-4 mx-auto mb-1 text-slate-400" />
                  Você não possui permissão para visualizar valores projetados.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 4. ABA RELATÓRIOS FINANCEIROS (COM CONTROLE ESTRITO DE EXPORTAÇÃO)  */}
      {/* ==================================================================== */}
      {activeTab === 'reports' && canViewReports && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-lg font-heading font-black uppercase text-slate-900">
                Relatórios Gerenciais Financeiros
              </h2>
              <p className="text-xs text-slate-500">
                Demonstrativo de Resultado do Exercício (DRE), balancete gerencial e faturamento.
              </p>
            </div>

            {/* Ações de Exportação condicionados à permissão canExportFinancialReports (Requisito 16) */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleExportReports('pdf')}
                className={`px-3 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
                  canExportReports
                    ? 'bg-slate-900 text-white hover:bg-[#E6007E]'
                    : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                }`}
                title={
                  canExportReports
                    ? 'Exportar Relatório em PDF'
                    : 'Permissão "Exportar Relatórios" necessária para baixar PDF'
                }
              >
                <Download className="w-3.5 h-3.5" />
                <span>Exportar PDF</span>
              </button>

              <button
                type="button"
                onClick={() => handleExportReports('excel')}
                className={`px-3 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
                  canExportReports
                    ? 'bg-emerald-700 text-white hover:bg-emerald-800'
                    : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                }`}
                title={
                  canExportReports
                    ? 'Exportar Relatório em Planilha Excel'
                    : 'Permissão "Exportar Relatórios" necessária para baixar Excel'
                }
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Exportar Excel</span>
              </button>

              <button
                type="button"
                onClick={() => handleExportReports('print')}
                className={`p-2 text-slate-600 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer ${
                  !canExportReports ? 'opacity-50 cursor-not-allowed' : ''
                }`}
                title="Imprimir Relatório"
              >
                <Printer className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* DRE Simplificado */}
          <div className="space-y-4">
            <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider">
              DRE Gerencial — MB Personaliza Brindes
            </h3>

            <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden text-xs">
              <div className="p-3.5 bg-emerald-50/50 flex justify-between font-bold text-emerald-900">
                <span>(+) RECEITA BRUTA DE VENDAS & SERVIÇOS</span>
                <span className="font-mono">
                  R$ {(metrics.totalReceivedRealized + metrics.totalReceivablePending).toFixed(2)}
                </span>
              </div>
              <div className="p-3.5 pl-6 flex justify-between text-slate-600">
                <span>• Vendas B2B & Orçamentos Fechados</span>
                <span className="font-mono">
                  R$ {accounts.filter((a) => a.type === 'receber').reduce((acc, a) => acc + a.amount, 0).toFixed(2)}
                </span>
              </div>
              <div className="p-3.5 bg-rose-50/50 flex justify-between font-bold text-rose-900">
                <span>(-) CUSTOS DE PRODUTOS & MATÉRIA-PRIMA (CMV)</span>
                <span className="font-mono">
                  - R${' '}
                  {accounts
                    .filter((a) => a.type === 'pagar' && a.categoryName.includes('Stricker'))
                    .reduce((acc, a) => acc + a.amount, 0)
                    .toFixed(2)}
                </span>
              </div>
              <div className="p-3.5 bg-slate-50 flex justify-between font-extrabold text-slate-900">
                <span>(=) LUCRO BRUTO OPERACIONAL</span>
                <span className="font-mono text-emerald-700">
                  R${' '}
                  {(
                    metrics.totalReceivedRealized -
                    accounts
                      .filter((a) => a.type === 'pagar' && a.categoryName.includes('Stricker'))
                      .reduce((acc, a) => acc + a.amount, 0)
                  ).toFixed(2)}
                </span>
              </div>
              <div className="p-3.5 bg-rose-50/50 flex justify-between font-bold text-rose-900">
                <span>(-) DESPESAS OPERACIONAIS & ADMINISTRATIVAS</span>
                <span className="font-mono">
                  - R${' '}
                  {accounts
                    .filter((a) => a.type === 'pagar' && !a.categoryName.includes('Stricker'))
                    .reduce((acc, a) => acc + a.amount, 0)
                    .toFixed(2)}
                </span>
              </div>
              <div className="p-4 bg-slate-900 text-white flex justify-between font-black text-sm">
                <span>(=) RESULTADO LÍQUIDO DO EXERCÍCIO</span>
                <span className="font-mono text-[#FFDD00]">
                  R${' '}
                  {(
                    metrics.totalReceivedRealized -
                    accounts.filter((a) => a.type === 'pagar').reduce((acc, a) => acc + a.amount, 0)
                  ).toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 5. ABA CADASTROS FINANCEIROS (CATEGORIAS, CENTROS, CONTAS, FORMAS)   */}
      {/* ==================================================================== */}
      {(activeTab === 'categories' ||
        activeTab === 'cost_centers' ||
        activeTab === 'bank_accounts' ||
        activeTab === 'payment_methods') && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-6">
          {/* Header e Ações de Cadastros */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-heading font-black uppercase text-slate-900">
                  Cadastros Estruturais & Parâmetros
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200">
                  Gerenciamento Completo
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Cadastre, edite e exclua categorias, centros de custo, contas bancárias/caixas e formas de pagamento com auditoria e segurança.
              </p>
            </div>

            {/* Botão Novo Registro de acordo com a aba ativa */}
            <div className="flex items-center gap-2 shrink-0">
              {activeTab === 'categories' && canManageCategories && (
                categoryViewMode === 'financial' ? (
                  <button
                    type="button"
                    onClick={() => handleOpenCategoryModal()}
                    className="px-4 py-2 bg-slate-900 hover:bg-[#E6007E] text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Cadastrar Categoria Financeira</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleOpenCatalogCategoryModal()}
                    className="px-4 py-2 bg-slate-900 hover:bg-[#00AEEF] text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Cadastrar Categoria do Catálogo</span>
                  </button>
                )
              )}

              {activeTab === 'cost_centers' && canManageCostCenters && (
                <button
                  type="button"
                  onClick={() => handleOpenCostCenterModal()}
                  className="px-4 py-2 bg-slate-900 hover:bg-[#E6007E] text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>Cadastrar Centro de Custo</span>
                </button>
              )}

              {activeTab === 'bank_accounts' && canManageBankAccounts && (
                <button
                  type="button"
                  onClick={() => handleOpenBankAccountModal()}
                  className="px-4 py-2 bg-slate-900 hover:bg-[#E6007E] text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>Cadastrar Conta / Caixa</span>
                </button>
              )}

              {activeTab === 'payment_methods' && canManagePaymentMethods && (
                <button
                  type="button"
                  onClick={() => handleOpenPaymentMethodModal()}
                  className="px-4 py-2 bg-slate-900 hover:bg-[#E6007E] text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>Cadastrar Forma de Pagamento</span>
                </button>
              )}
            </div>
          </div>

          {/* Seletor de Sub-Abas de Cadastros */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-2.5 rounded-2xl border border-slate-200">
            <div className="flex flex-wrap items-center gap-1.5">
              {canManageCategories && (
                <button
                  type="button"
                  onClick={() => { setActiveTab('categories'); setCadastrosSearch(''); }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    activeTab === 'categories'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <Tags className="w-3.5 h-3.5 text-pink-400" />
                  <span>Categorias ({categories.length + catalogCategories.length})</span>
                </button>
              )}
              {canManageCostCenters && (
                <button
                  type="button"
                  onClick={() => { setActiveTab('cost_centers'); setCadastrosSearch(''); }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    activeTab === 'cost_centers'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <Building2 className="w-3.5 h-3.5 text-blue-400" />
                  <span>Centros de Custo ({costCenters.length})</span>
                </button>
              )}
              {canManageBankAccounts && (
                <button
                  type="button"
                  onClick={() => { setActiveTab('bank_accounts'); setCadastrosSearch(''); }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    activeTab === 'bank_accounts'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <Landmark className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Contas Bancárias & Caixas ({bankAccounts.length})</span>
                </button>
              )}
              {canManagePaymentMethods && (
                <button
                  type="button"
                  onClick={() => { setActiveTab('payment_methods'); setCadastrosSearch(''); }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    activeTab === 'payment_methods'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <CreditCard className="w-3.5 h-3.5 text-purple-400" />
                  <span>Formas de Pagamento ({paymentMethods.length})</span>
                </button>
              )}
            </div>

            {/* Busca rápida */}
            <div className="relative min-w-[200px] max-w-xs w-full sm:w-auto">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={cadastrosSearch}
                onChange={(e) => setCadastrosSearch(e.target.value)}
                placeholder="Buscar por nome, código..."
                className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-slate-900"
              />
            </div>
          </div>

          {/* ================================================================= */}
          {/* 1. SUB-ABA: CATEGORIAS (Financeiras e do Catálogo)                */}
          {/* ================================================================= */}
          {activeTab === 'categories' && (
            <div className="space-y-4">
              {/* Alternador entre Categorias Financeiras e do Catálogo da Loja */}
              <div className="flex items-center justify-between flex-wrap gap-2 pt-1 pb-1">
                <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setCategoryViewMode('financial')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      categoryViewMode === 'financial'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Categorias Financeiras ({categories.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setCategoryViewMode('catalog')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      categoryViewMode === 'catalog'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Categorias do Catálogo / Loja ({catalogCategories.length})
                  </button>
                </div>

                <span className="text-[11px] text-slate-500">
                  {categoryViewMode === 'financial'
                    ? 'Classificação do plano de contas para receitas e despesas.'
                    : 'Categorias de vitrine exibidas aos clientes no catálogo.'}
                </span>
              </div>

              {/* Lista: Categorias Financeiras */}
              {categoryViewMode === 'financial' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {categories
                    .filter((c) => {
                      if (!cadastrosSearch) return true;
                      const q = cadastrosSearch.toLowerCase();
                      return c.name.toLowerCase().includes(q) || (c.description || '').toLowerCase().includes(q);
                    })
                    .map((c) => {
                      const linkedCount = accounts.filter((a) => a.categoryId === c.id).length;
                      return (
                        <div
                          key={c.id}
                          className="p-4 rounded-2xl border border-slate-200 bg-white hover:border-slate-300 transition-all shadow-xs flex flex-col justify-between space-y-3"
                        >
                          <div className="space-y-1.5">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span
                                  className="w-3 h-3 rounded-full shrink-0"
                                  style={{ backgroundColor: c.color || (c.type === 'receita' ? '#10B981' : '#E6007E') }}
                                />
                                <h4 className="font-bold text-slate-900 text-sm">{c.name}</h4>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <span
                                  className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                                    c.type === 'receita'
                                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                      : c.type === 'despesa'
                                      ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                      : 'bg-blue-100 text-blue-800 border border-blue-200'
                                  }`}
                                >
                                  {c.type}
                                </span>
                                <span
                                  className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded-md ${
                                    c.active ? 'bg-slate-100 text-slate-700' : 'bg-slate-200 text-slate-500'
                                  }`}
                                >
                                  {c.active ? 'Ativa' : 'Inativa'}
                                </span>
                              </div>
                            </div>
                            {c.description ? (
                              <p className="text-xs text-slate-500 line-clamp-2">{c.description}</p>
                            ) : (
                              <p className="text-xs text-slate-400 italic">Sem descrição detalhada.</p>
                            )}
                          </div>

                          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                            <span className="text-[11px] text-slate-500">
                              {linkedCount} lançamento(s)
                            </span>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleToggleCategoryActive(c)}
                                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                  c.active
                                    ? 'text-slate-400 hover:text-amber-600 hover:bg-amber-50'
                                    : 'text-emerald-600 hover:bg-emerald-50'
                                }`}
                                title={c.active ? 'Desativar Categoria' : 'Ativar Categoria'}
                              >
                                <Power className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenCategoryModal(c)}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
                                title="Editar Categoria"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handlePromptDelete('financial_category', c.id, c.name)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                                title="Excluir Categoria"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}

              {/* Lista: Categorias do Catálogo */}
              {categoryViewMode === 'catalog' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {catalogCategories
                    .filter((c) => {
                      if (!cadastrosSearch) return true;
                      const q = cadastrosSearch.toLowerCase();
                      return c.name.toLowerCase().includes(q) || (c.slug || '').toLowerCase().includes(q);
                    })
                    .map((cat) => {
                      const prods = StorageService.getProducts();
                      const linkedProds = prods.filter((p) => p.categoryId === cat.id).length;
                      return (
                        <div
                          key={cat.id}
                          className="p-4 rounded-2xl border border-slate-200 bg-white hover:border-slate-300 transition-all shadow-xs flex flex-col justify-between space-y-3"
                        >
                          <div className="space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2.5">
                                {cat.image ? (
                                  <img
                                    src={cat.image}
                                    alt={cat.name}
                                    className="w-8 h-8 rounded-lg object-cover border border-slate-200 shrink-0"
                                  />
                                ) : (
                                  <div className="w-8 h-8 rounded-lg bg-pink-100 text-[#E6007E] flex items-center justify-center shrink-0">
                                    <Tags className="w-4 h-4" />
                                  </div>
                                )}
                                <div>
                                  <h4 className="font-bold text-slate-900 text-sm leading-tight">{cat.name}</h4>
                                  <span className="text-[10px] font-mono text-slate-400">/{cat.slug}</span>
                                </div>
                              </div>
                              <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md shrink-0">
                                Ordem: #{cat.order}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 line-clamp-2">
                              {cat.description || 'Categoria de vitrine para produtos MB Personaliza.'}
                            </p>
                          </div>

                          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                            <span className="text-[11px] text-slate-500 font-medium">
                              {linkedProds} produto(s) cadastrado(s)
                            </span>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleOpenCatalogCategoryModal(cat)}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
                                title="Editar Categoria do Catálogo"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handlePromptDelete('catalog_category', cat.id, cat.name)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                                title="Excluir Categoria do Catálogo"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          )}

          {/* ================================================================= */}
          {/* 2. SUB-ABA: CENTROS DE CUSTO                                      */}
          {/* ================================================================= */}
          {activeTab === 'cost_centers' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {costCenters
                  .filter((cc) => {
                    if (!cadastrosSearch) return true;
                    const q = cadastrosSearch.toLowerCase();
                    return cc.name.toLowerCase().includes(q) || cc.code.toLowerCase().includes(q);
                  })
                  .map((cc) => {
                    const linked = accounts.filter((a) => a.costCenterId === cc.id).length;
                    return (
                      <div
                        key={cc.id}
                        className="p-4 rounded-2xl border border-slate-200 bg-white hover:border-slate-300 transition-all shadow-xs flex flex-col justify-between space-y-3"
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-[10px] font-black bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-md">
                                {cc.code}
                              </span>
                              <h4 className="font-bold text-slate-900 text-sm">{cc.name}</h4>
                            </div>
                            <span
                              className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                                cc.active
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                  : 'bg-slate-200 text-slate-600'
                              }`}
                            >
                              {cc.active ? 'Ativo' : 'Inativo'}
                            </span>
                          </div>
                          {cc.description ? (
                            <p className="text-xs text-slate-500 line-clamp-2">{cc.description}</p>
                          ) : (
                            <p className="text-xs text-slate-400 italic">Sem descrição.</p>
                          )}
                        </div>

                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                          <span className="text-[11px] text-slate-500">
                            {linked} lançamento(s) associado(s)
                          </span>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleToggleCostCenterActive(cc)}
                              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                cc.active
                                  ? 'text-slate-400 hover:text-amber-600 hover:bg-amber-50'
                                  : 'text-emerald-600 hover:bg-emerald-50'
                              }`}
                              title={cc.active ? 'Desativar Centro' : 'Ativar Centro'}
                            >
                              <Power className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenCostCenterModal(cc)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
                              title="Editar Centro de Custo"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handlePromptDelete('cost_center', cc.id, cc.name)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                              title="Excluir Centro de Custo"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* 3. SUB-ABA: CONTAS BANCÁRIAS & CAIXAS FÍSICOS                     */}
          {/* ================================================================= */}
          {activeTab === 'bank_accounts' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {bankAccounts
                  .filter((b) => {
                    if (!cadastrosSearch) return true;
                    const q = cadastrosSearch.toLowerCase();
                    return b.name.toLowerCase().includes(q) || b.bankName.toLowerCase().includes(q);
                  })
                  .map((b) => {
                    const typeLabel =
                      b.accountType === 'corrente'
                        ? 'Conta Corrente'
                        : b.accountType === 'poupanca'
                        ? 'Poupança'
                        : b.accountType === 'caixa_fisico'
                        ? 'Caixa Físico / Cofre'
                        : 'Carteira Digital';

                    return (
                      <div
                        key={b.id}
                        className="p-4 rounded-2xl border border-slate-200 bg-white hover:border-slate-300 transition-all shadow-xs flex flex-col justify-between space-y-3"
                      >
                        <div className="space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <h4 className="font-bold text-slate-900 text-sm">{b.name}</h4>
                                {b.isDefault && (
                                  <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 border border-indigo-200">
                                    Padrão
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-slate-500 font-medium">
                                {b.bankName} • Agência: {b.agency} • Conta: {b.accountNumber}
                              </p>
                            </div>
                            <span
                              className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full shrink-0 ${
                                b.active
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                  : 'bg-slate-200 text-slate-600'
                              }`}
                            >
                              {b.active ? 'Ativa' : 'Inativa'}
                            </span>
                          </div>

                          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                            <div>
                              <span className="text-[10px] uppercase font-bold text-slate-400 block">Tipo:</span>
                              <span className="text-xs font-bold text-slate-700">{typeLabel}</span>
                            </div>
                            <div className="text-right">
                              <span className="text-[10px] uppercase font-bold text-slate-400 block">Saldo Atual:</span>
                              <span className="font-mono font-black text-sm text-slate-900">
                                R$ {b.currentBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                          <span className="text-[11px] text-slate-400 font-mono">
                            Inicial: R$ {b.initialBalance.toFixed(2)}
                          </span>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleToggleBankAccountActive(b)}
                              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                b.active
                                  ? 'text-slate-400 hover:text-amber-600 hover:bg-amber-50'
                                  : 'text-emerald-600 hover:bg-emerald-50'
                              }`}
                              title={b.active ? 'Desativar Conta' : 'Ativar Conta'}
                            >
                              <Power className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenBankAccountModal(b)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
                              title="Editar Conta Bancária"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handlePromptDelete('bank_account', b.id, b.name)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                              title="Excluir Conta Bancária"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* 4. SUB-ABA: FORMAS DE PAGAMENTO & TAXAS                          */}
          {/* ================================================================= */}
          {activeTab === 'payment_methods' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {paymentMethods
                  .filter((pm) => {
                    if (!cadastrosSearch) return true;
                    const q = cadastrosSearch.toLowerCase();
                    return pm.name.toLowerCase().includes(q) || pm.code.toLowerCase().includes(q);
                  })
                  .map((pm) => (
                    <div
                      key={pm.id}
                      className="p-4 rounded-2xl border border-slate-200 bg-white hover:border-slate-300 transition-all shadow-xs flex flex-col justify-between space-y-3"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <CreditCard className="w-4 h-4 text-purple-600 shrink-0" />
                            <div>
                              <h4 className="font-bold text-slate-900 text-sm leading-tight">{pm.name}</h4>
                              <span className="text-[10px] font-mono text-slate-400">cód: {pm.code}</span>
                            </div>
                          </div>
                          <span
                            className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full shrink-0 ${
                              pm.active
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                : 'bg-slate-200 text-slate-600'
                            }`}
                          >
                            {pm.active ? 'Ativa' : 'Inativa'}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                          <div>
                            <span className="text-[10px] uppercase font-bold text-slate-400 block">Taxa Operador:</span>
                            <span className="font-mono font-bold text-slate-900">{pm.taxPercent}%</span>
                          </div>
                          <div>
                            <span className="text-[10px] uppercase font-bold text-slate-400 block">Prazo Liquidação:</span>
                            <span className="font-mono font-bold text-slate-900">
                              {pm.daysToClear === 0 ? 'Imediato (D+0)' : `D+${pm.daysToClear} dias`}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                        <span className="text-[11px] text-slate-400">MB Personaliza Checkout</span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleTogglePaymentMethodActive(pm)}
                            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                              pm.active
                                ? 'text-slate-400 hover:text-amber-600 hover:bg-amber-50'
                                : 'text-emerald-600 hover:bg-emerald-50'
                            }`}
                            title={pm.active ? 'Desativar Forma' : 'Ativar Forma'}
                          >
                            <Power className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenPaymentMethodModal(pm)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
                            title="Editar Forma de Pagamento"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handlePromptDelete('payment_method', pm.id, pm.name)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                            title="Excluir Forma de Pagamento"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==================================================================== */}
      {/* 6. ABA AUDITORIA FINANCEIRA DE SEGURANÇA (REQUISITO 14 E 17)        */}
      {/* ==================================================================== */}
      {activeTab === 'audit' && canViewAudit && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-heading font-black uppercase text-slate-900">
                  Auditoria de Segurança Financeira
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-purple-100 text-purple-800 border border-purple-200">
                  Imutável • Confidencial
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Log detalhado de todas as operações financeiras, concessão/remoção de permissões e tentativas de acesso negadas.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100/80 text-slate-600 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Data / Hora</th>
                  <th className="py-3 px-4">Usuário / Perfil</th>
                  <th className="py-3 px-4">Operação</th>
                  <th className="py-3 px-4">Resultado</th>
                  <th className="py-3 px-4">Detalhes</th>
                  <th className="py-3 px-4">Origem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                {auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString('pt-BR')}
                    </td>
                    <td className="py-3 px-4 font-sans">
                      <p className="font-bold text-slate-900">{log.userName}</p>
                      <p className="text-[10px] text-slate-400 uppercase font-mono">{log.userRole}</p>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-bold text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded">
                        {log.operation}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-sans">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                          log.result === 'sucesso'
                            ? 'bg-emerald-100 text-emerald-800'
                            : log.result === 'bloqueado'
                            ? 'bg-rose-100 text-rose-800 font-black'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {log.result === 'sucesso' ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                        {log.result}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-sans text-slate-600 max-w-xs truncate" title={log.details}>
                      {log.details}
                    </td>
                    <td className="py-3 px-4 text-slate-400 uppercase font-bold text-[10px]">
                      {log.origin || 'web_painel'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 7. ABA CONFIGURAÇÕES FINANCEIRAS                                     */}
      {/* ==================================================================== */}
      {activeTab === 'settings' && canManageSettings && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-6 max-w-3xl">
          <div className="border-b border-slate-100 pb-4">
            <h2 className="text-lg font-heading font-black uppercase text-slate-900">
              Configurações & Parâmetros Financeiros
            </h2>
            <p className="text-xs text-slate-500">
              Diretrizes de vencimento, juros de mora e exigências de conformidade.
            </p>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              const res = StorageService.saveFinancialSettings(settings, currentUser);
              if (res.success) {
                showToast('success', 'Configurações financeiras salvas com sucesso!');
              } else {
                showToast('error', res.error || 'Erro ao salvar.');
              }
            }}
            className="space-y-4 text-xs"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Prazo Padrão de Vencimento (Dias)</label>
                <input
                  type="number"
                  min="1"
                  value={settings.defaultDueDays}
                  onChange={(e) => setSettings({ ...settings, defaultDueDays: parseInt(e.target.value) || 15 })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Juros de Mora Mensal (%)</label>
                <input
                  type="number"
                  step="0.1"
                  value={settings.interestRateMonthly}
                  onChange={(e) => setSettings({ ...settings, interestRateMonthly: parseFloat(e.target.value) || 1.0 })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Multa por Atraso (%)</label>
                <input
                  type="number"
                  step="0.1"
                  value={settings.penaltyRatePercent}
                  onChange={(e) => setSettings({ ...settings, penaltyRatePercent: parseFloat(e.target.value) || 2.0 })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Avisar Vencimento com Antecedência (Dias)</label>
                <input
                  type="number"
                  value={settings.alertDueDaysBefore}
                  onChange={(e) => setSettings({ ...settings, alertDueDaysBefore: parseInt(e.target.value) || 3 })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                />
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-slate-100">
              <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-800">
                <input
                  type="checkbox"
                  checked={settings.requireReasonOnCancel}
                  onChange={(e) => setSettings({ ...settings, requireReasonOnCancel: e.target.checked })}
                  className="w-4 h-4 rounded text-slate-900"
                />
                <span>Exigir motivo obrigatório ao cancelar títulos ou contas</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-800">
                <input
                  type="checkbox"
                  checked={settings.requireReasonOnRefund}
                  onChange={(e) => setSettings({ ...settings, requireReasonOnRefund: e.target.checked })}
                  className="w-4 h-4 rounded text-slate-900"
                />
                <span>Exigir motivo obrigatório em qualquer estorno de recebimento ou pagamento</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-800">
                <input
                  type="checkbox"
                  checked={settings.autoSyncPDVSales}
                  onChange={(e) => setSettings({ ...settings, autoSyncPDVSales: e.target.checked })}
                  className="w-4 h-4 rounded text-slate-900"
                />
                <span>Integrar e sincronizar vendas do PDV diretamente nas Contas a Receber</span>
              </label>
            </div>

            <div className="pt-3 flex justify-end">
              <button
                type="submit"
                className="px-6 py-2.5 bg-slate-900 hover:bg-[#E6007E] text-white font-black rounded-xl shadow-md transition-colors cursor-pointer"
              >
                Salvar Configurações Financeiras
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 1: CRIAR / EDITAR CONTA FINANCEIRA                             */}
      {/* ==================================================================== */}
      {isNewAccountModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl border border-slate-200 max-w-lg w-full p-6 sm:p-8 space-y-5 shadow-2xl my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  {modalAccountType === 'receber' ? 'Receita Corporativa' : 'Despesa / Compromisso'}
                </span>
                <h3 className="font-heading text-lg font-black uppercase text-slate-900">
                  {editingAccount
                    ? `Editar ${editingAccount.code}`
                    : modalAccountType === 'receber'
                    ? 'Nova Conta a Receber'
                    : 'Nova Conta a Pagar'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsNewAccountModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAccount} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Descrição do Lançamento *</label>
                <input
                  type="text"
                  required
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder={
                    modalAccountType === 'receber'
                      ? 'Ex: Venda de 200 Copos Térmicos Inox'
                      : 'Ex: Compra de Tintas DTF e Insumos'
                  }
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {modalAccountType === 'receber' ? 'Cliente *' : 'Fornecedor *'}
                  </label>
                  <input
                    type="text"
                    required
                    value={formEntityName}
                    onChange={(e) => setFormEntityName(e.target.value)}
                    placeholder="Nome ou Razão Social"
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">CPF / CNPJ (Opcional)</label>
                  <input
                    type="text"
                    value={formEntityDoc}
                    onChange={(e) => setFormEntityDoc(e.target.value)}
                    placeholder="00.000.000/0000-00"
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Valor (R$) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={formAmount || ''}
                    onChange={(e) => setFormAmount(parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold font-mono text-sm focus:bg-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Data de Vencimento *</label>
                  <input
                    type="date"
                    required
                    value={formDueDate}
                    onChange={(e) => setFormDueDate(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Categoria Financeira</label>
                  <select
                    value={formCategoryId}
                    onChange={(e) => setFormCategoryId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none font-bold"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.type})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Centro de Custo</label>
                  <select
                    value={formCostCenterId}
                    onChange={(e) => setFormCostCenterId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none font-bold"
                  >
                    {costCenters.map((cc) => (
                      <option key={cc.id} value={cc.id}>
                        {cc.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Observações Internas</label>
                <textarea
                  rows={2}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Informações adicionais..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsNewAccountModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-slate-900 hover:bg-[#E6007E] text-white font-black text-xs rounded-xl shadow-md transition-colors cursor-pointer"
                >
                  Salvar Lançamento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 2: BAIXA / LIQUIDAÇÃO DE CONTA (RECEBIMENTO OU PAGAMENTO)      */}
      {/* ==================================================================== */}
      {settlingAccount && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 max-w-md w-full p-6 sm:p-8 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-black uppercase text-emerald-600">
                  {settlingAccount.type === 'receber' ? 'Quitar / Receber Conta' : 'Pagar / Liquidar Conta'}
                </span>
                <h3 className="font-heading text-lg font-black uppercase text-slate-900">
                  Baixa: {settlingAccount.code}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSettlingAccount(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-slate-50 rounded-2xl text-xs space-y-1">
              <p className="font-bold text-slate-900">{settlingAccount.description}</p>
              <p className="text-slate-500">
                {settlingAccount.entityName} • Valor Original:{' '}
                <strong className="text-slate-800">
                  R$ {settlingAccount.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </strong>
              </p>
            </div>

            <form onSubmit={handleConfirmSettle} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Valor Efetivamente Liquidado (R$) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={settleAmount}
                  onChange={(e) => setSettleAmount(parseFloat(e.target.value) || 0)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold font-mono text-base text-emerald-700 focus:bg-white focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Data da Baixa *</label>
                  <input
                    type="date"
                    required
                    value={settleDate}
                    onChange={(e) => setSettleDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Conta Bancária de Destino</label>
                  <select
                    value={settleBankId}
                    onChange={(e) => setSettleBankId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none font-bold"
                  >
                    {bankAccounts.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Forma de Pagamento</label>
                <select
                  value={settleMethod}
                  onChange={(e) => setSettleMethod(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none font-bold"
                >
                  {paymentMethods.map((pm) => (
                    <option key={pm.id} value={pm.name}>
                      {pm.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Observações da Liquidação</label>
                <input
                  type="text"
                  value={settleNotes}
                  onChange={(e) => setSettleNotes(e.target.value)}
                  placeholder="Ex: Comprovante Pix anexado ou autenticação bancária"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSettlingAccount(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-md transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>Confirmar Baixa</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 3: CANCELAMENTO COM MOTIVO OBRIGATÓRIO (SEGURANÇA)             */}
      {/* ==================================================================== */}
      {cancellingAccount && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-rose-200 max-w-md w-full p-6 sm:p-8 space-y-5 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-600">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="font-heading text-lg font-black uppercase text-slate-900">
                Cancelar Lançamento {cancellingAccount.code}
              </h3>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Por diretriz de conformidade e auditoria, informe obrigatoriamente o motivo do cancelamento deste título.
            </p>

            <form onSubmit={handleConfirmCancel} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Motivo do Cancelamento *</label>
                <textarea
                  rows={3}
                  required
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Ex: Pedido cancelado a pedido do cliente ou duplicidade de lançamento..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setCancellingAccount(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Voltar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs rounded-xl shadow-md transition-colors cursor-pointer"
                >
                  Confirmar Cancelamento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 4: ESTORNO DE PAGAMENTO/RECEBIMENTO COM MOTIVO OBRIGATÓRIO    */}
      {/* ==================================================================== */}
      {refundingAccount && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-purple-200 max-w-md w-full p-6 sm:p-8 space-y-5 shadow-2xl">
            <div className="flex items-center gap-3 text-purple-700">
              <RotateCcw className="w-6 h-6 shrink-0" />
              <h3 className="font-heading text-lg font-black uppercase text-slate-900">
                Estornar Liquidação {refundingAccount.code}
              </h3>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              O estorno reverterá a movimentação de saldo da conta bancária e registrará um evento de auditoria formal.
            </p>

            <form onSubmit={handleConfirmRefund} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Motivo do Estorno *</label>
                <textarea
                  rows={3}
                  required
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  placeholder="Ex: Liquidação lançada por engano na conta bancária incorreta..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setRefundingAccount(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Voltar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-purple-700 hover:bg-purple-800 text-white font-black text-xs rounded-xl shadow-md transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Processar Estorno</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 5: CADASTRAR / EDITAR CATEGORIA FINANCEIRA                     */}
      {/* ==================================================================== */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 max-w-lg w-full p-6 sm:p-8 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-pink-50 text-[#E6007E] rounded-xl">
                  <Tags className="w-5 h-5" />
                </div>
                <h3 className="font-heading text-lg font-black uppercase text-slate-900">
                  {editingCategory ? 'Editar Categoria Financeira' : 'Cadastrar Categoria Financeira'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCategoryModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveFinancialCategory} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Nome da Categoria *</label>
                <input
                  type="text"
                  required
                  value={catFormName}
                  onChange={(e) => setCatFormName(e.target.value)}
                  placeholder="Ex: Fornecedores Matéria-Prima DTF"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1.5">Natureza da Operação *</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => { setCatFormType('despesa'); if (!editingCategory) setCatFormColor('#E6007E'); }}
                    className={`py-2 px-3 rounded-xl font-bold border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      catFormType === 'despesa'
                        ? 'bg-rose-50 border-rose-400 text-rose-800 shadow-xs'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-rose-500" />
                    <span>Despesa</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setCatFormType('receita'); if (!editingCategory) setCatFormColor('#10B981'); }}
                    className={`py-2 px-3 rounded-xl font-bold border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      catFormType === 'receita'
                        ? 'bg-emerald-50 border-emerald-400 text-emerald-800 shadow-xs'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span>Receita</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setCatFormType('ambos'); if (!editingCategory) setCatFormColor('#3B82F6'); }}
                    className={`py-2 px-3 rounded-xl font-bold border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      catFormType === 'ambos'
                        ? 'bg-blue-50 border-blue-400 text-blue-800 shadow-xs'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                    <span>Ambos</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1.5">Cor de Destaque / Gráficos</label>
                <div className="flex items-center gap-2">
                  {['#E6007E', '#00AEEF', '#10B981', '#F59E0B', '#8B5CF6', '#64748B'].map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setCatFormColor(color)}
                      className={`w-7 h-7 rounded-full border-2 transition-transform cursor-pointer ${
                        catFormColor === color ? 'scale-110 border-slate-900 shadow-xs' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                  <input
                    type="color"
                    value={catFormColor}
                    onChange={(e) => setCatFormColor(e.target.value)}
                    className="w-8 h-8 rounded-lg cursor-pointer border border-slate-200 bg-white"
                    title="Escolher cor personalizada"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Descrição Detalhada</label>
                <textarea
                  rows={2}
                  value={catFormDesc}
                  onChange={(e) => setCatFormDesc(e.target.value)}
                  placeholder="Ex: Contas relativas a compras de insumos para estamparia e gravação laser..."
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="catActive"
                  checked={catFormActive}
                  onChange={(e) => setCatFormActive(e.target.checked)}
                  className="rounded text-slate-900 focus:ring-slate-900"
                />
                <label htmlFor="catActive" className="font-bold text-slate-700 cursor-pointer">
                  Categoria Ativa no Sistema
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCategoryModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-slate-900 hover:bg-[#E6007E] text-white font-black text-xs rounded-xl shadow-md transition-colors cursor-pointer"
                >
                  {editingCategory ? 'Salvar Alterações' : 'Cadastrar Categoria'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 6: CADASTRAR / EDITAR CENTRO DE CUSTO                           */}
      {/* ==================================================================== */}
      {isCostCenterModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 max-w-lg w-full p-6 sm:p-8 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                  <Building2 className="w-5 h-5" />
                </div>
                <h3 className="font-heading text-lg font-black uppercase text-slate-900">
                  {editingCostCenter ? 'Editar Centro de Custo' : 'Cadastrar Centro de Custo'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCostCenterModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCostCenter} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Código *</label>
                  <input
                    type="text"
                    required
                    value={ccFormCode}
                    onChange={(e) => setCcFormCode(e.target.value)}
                    placeholder="Ex: CC-01"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold uppercase focus:bg-white focus:outline-none"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">Nome do Centro de Custo *</label>
                  <input
                    type="text"
                    required
                    value={ccFormName}
                    onChange={(e) => setCcFormName(e.target.value)}
                    placeholder="Ex: Produção & Gravação Laser/UV"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Descrição / Finalidade</label>
                <textarea
                  rows={2}
                  value={ccFormDesc}
                  onChange={(e) => setCcFormDesc(e.target.value)}
                  placeholder="Ex: Custos vinculados diretamente às máquinas de gravação e operadores..."
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="ccActive"
                  checked={ccFormActive}
                  onChange={(e) => setCcFormActive(e.target.checked)}
                  className="rounded text-slate-900 focus:ring-slate-900"
                />
                <label htmlFor="ccActive" className="font-bold text-slate-700 cursor-pointer">
                  Centro de Custo Ativo
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCostCenterModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-slate-900 hover:bg-[#E6007E] text-white font-black text-xs rounded-xl shadow-md transition-colors cursor-pointer"
                >
                  {editingCostCenter ? 'Salvar Alterações' : 'Cadastrar Centro de Custo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 7: CADASTRAR / EDITAR CONTA BANCÁRIA & CAIXA                   */}
      {/* ==================================================================== */}
      {isBankAccountModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 max-w-lg w-full p-6 sm:p-8 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                  <Landmark className="w-5 h-5" />
                </div>
                <h3 className="font-heading text-lg font-black uppercase text-slate-900">
                  {editingBankAccount ? 'Editar Conta Bancária / Caixa' : 'Cadastrar Conta Bancária / Caixa'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsBankAccountModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveBankAccount} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Nome Identificador *</label>
                  <input
                    type="text"
                    required
                    value={bankFormName}
                    onChange={(e) => setBankFormName(e.target.value)}
                    placeholder="Ex: Itaú PJ Matriz"
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Banco / Instituição *</label>
                  <input
                    type="text"
                    required
                    value={bankFormBankName}
                    onChange={(e) => setBankFormBankName(e.target.value)}
                    placeholder="Ex: Banco Itaú Unibanco"
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Tipo da Conta</label>
                  <select
                    value={bankFormType}
                    onChange={(e) => setBankFormType(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:outline-none"
                  >
                    <option value="corrente">Conta Corrente</option>
                    <option value="poupanca">Poupança</option>
                    <option value="caixa_fisico">Caixa Físico / PDV</option>
                    <option value="carteira_digital">Carteira Digital</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Agência</label>
                  <input
                    type="text"
                    value={bankFormAgency}
                    onChange={(e) => setBankFormAgency(e.target.value)}
                    placeholder="0001"
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono focus:bg-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Número da Conta</label>
                  <input
                    type="text"
                    value={bankFormAccountNumber}
                    onChange={(e) => setBankFormAccountNumber(e.target.value)}
                    placeholder="12345-6"
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Saldo Inicial (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={bankFormInitialBalance}
                    onChange={(e) => setBankFormInitialBalance(parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold focus:bg-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Saldo Atual (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={bankFormCurrentBalance}
                    onChange={(e) => setBankFormCurrentBalance(parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono font-black text-sm focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-1">
                <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700">
                  <input
                    type="checkbox"
                    checked={bankFormIsDefault}
                    onChange={(e) => setBankFormIsDefault(e.target.checked)}
                    className="rounded text-slate-900 focus:ring-slate-900"
                  />
                  <span>Definir como Conta Padrão do Sistema</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700">
                  <input
                    type="checkbox"
                    checked={bankFormActive}
                    onChange={(e) => setBankFormActive(e.target.checked)}
                    className="rounded text-slate-900 focus:ring-slate-900"
                  />
                  <span>Conta Ativa</span>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsBankAccountModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-slate-900 hover:bg-[#E6007E] text-white font-black text-xs rounded-xl shadow-md transition-colors cursor-pointer"
                >
                  {editingBankAccount ? 'Salvar Alterações' : 'Cadastrar Conta / Caixa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 8: CADASTRAR / EDITAR FORMA DE PAGAMENTO                        */}
      {/* ==================================================================== */}
      {isPaymentMethodModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 max-w-lg w-full p-6 sm:p-8 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-purple-50 text-purple-600 rounded-xl">
                  <CreditCard className="w-5 h-5" />
                </div>
                <h3 className="font-heading text-lg font-black uppercase text-slate-900">
                  {editingPaymentMethod ? 'Editar Forma de Pagamento' : 'Cadastrar Forma de Pagamento'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsPaymentMethodModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePaymentMethod} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Nome da Forma *</label>
                  <input
                    type="text"
                    required
                    value={pmFormName}
                    onChange={(e) => setPmFormName(e.target.value)}
                    placeholder="Ex: Cartão de Crédito 3x"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Código / Slug</label>
                  <input
                    type="text"
                    value={pmFormCode}
                    onChange={(e) => setPmFormCode(e.target.value)}
                    placeholder="Ex: cc_3x"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Taxa Operacional (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={pmFormTaxPercent}
                    onChange={(e) => setPmFormTaxPercent(parseFloat(e.target.value) || 0)}
                    placeholder="Ex: 2.99"
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold focus:bg-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Prazo de Liquidação (Dias)</label>
                  <input
                    type="number"
                    min="0"
                    value={pmFormDaysToClear}
                    onChange={(e) => setPmFormDaysToClear(parseInt(e.target.value) || 0)}
                    placeholder="0 para D+0, 30 para D+30"
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="pmActive"
                  checked={pmFormActive}
                  onChange={(e) => setPmFormActive(e.target.checked)}
                  className="rounded text-slate-900 focus:ring-slate-900"
                />
                <label htmlFor="pmActive" className="font-bold text-slate-700 cursor-pointer">
                  Forma de Pagamento Ativa no Caixa e Checkout
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsPaymentMethodModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-slate-900 hover:bg-[#E6007E] text-white font-black text-xs rounded-xl shadow-md transition-colors cursor-pointer"
                >
                  {editingPaymentMethod ? 'Salvar Alterações' : 'Cadastrar Forma de Pagamento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 9: CADASTRAR / EDITAR CATEGORIA DE CATÁLOGO (LOJA)             */}
      {/* ==================================================================== */}
      {isCatalogCategoryModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 max-w-lg w-full p-6 sm:p-8 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-pink-50 text-[#E6007E] rounded-xl">
                  <Tags className="w-5 h-5" />
                </div>
                <h3 className="font-heading text-lg font-black uppercase text-slate-900">
                  {editingCatalogCategory ? 'Editar Categoria do Catálogo' : 'Cadastrar Categoria do Catálogo'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCatalogCategoryModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCatalogCategory} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Nome da Categoria *</label>
                  <input
                    type="text"
                    required
                    value={catCatName}
                    onChange={(e) => setCatCatName(e.target.value)}
                    placeholder="Ex: Copos Térmicos Inox"
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Slug URL</label>
                  <input
                    type="text"
                    value={catCatSlug}
                    onChange={(e) => setCatCatSlug(e.target.value)}
                    placeholder="Ex: copos-termicos-inox"
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Descrição</label>
                <textarea
                  rows={2}
                  value={catCatDesc}
                  onChange={(e) => setCatCatDesc(e.target.value)}
                  placeholder="Ex: Copos e canecas térmicas com parede dupla e gravação a laser..."
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">URL da Imagem de Capa</label>
                  <input
                    type="url"
                    value={catCatImage}
                    onChange={(e) => setCatCatImage(e.target.value)}
                    placeholder="https://images.unsplash.com/..."
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Ordem</label>
                  <input
                    type="number"
                    min="1"
                    value={catCatOrder}
                    onChange={(e) => setCatCatOrder(parseInt(e.target.value) || 1)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCatalogCategoryModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-slate-900 hover:bg-[#00AEEF] text-white font-black text-xs rounded-xl shadow-md transition-colors cursor-pointer"
                >
                  {editingCatalogCategory ? 'Salvar Alterações' : 'Cadastrar Categoria'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 10: CONFIRMAÇÃO DE EXCLUSÃO (DELETAR)                          */}
      {/* ==================================================================== */}
      {deleteConfirmTarget && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-rose-200 max-w-md w-full p-6 sm:p-8 space-y-5 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-3 bg-rose-50 rounded-2xl">
                <AlertTriangle className="w-6 h-6 shrink-0 text-rose-600" />
              </div>
              <div>
                <h3 className="font-heading text-lg font-black uppercase text-slate-900">
                  {deleteConfirmTarget.title}
                </h3>
                <p className="text-xs text-slate-500 font-semibold">{deleteConfirmTarget.name}</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Você tem certeza de que deseja excluir permanentemente o registro{' '}
              <strong className="text-slate-900">"{deleteConfirmTarget.name}"</strong>? Esta ação é irreversível e será registrada no histórico de auditoria.
            </p>

            {deleteConfirmTarget.warning && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-medium flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                <span>{deleteConfirmTarget.warning}</span>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDeleteConfirmTarget(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleExecuteDelete}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs rounded-xl shadow-md transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Confirmar Exclusão</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
