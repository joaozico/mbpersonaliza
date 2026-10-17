import React, { useState } from 'react';
import { UserProfile, UserRole, RolePermissions } from '../types';
import { StorageService } from '../services/storage';
import { INITIAL_PERMISSIONS_MATRIX } from '../data/initialData';
import {
  Users,
  Shield,
  UserPlus,
  Edit2,
  Trash2,
  CheckCircle2,
  SlidersHorizontal,
  Search,
  Check,
  X,
  AlertCircle,
  ShoppingBag,
  DollarSign,
  Lock,
  Unlock,
  ShieldCheck,
  ShieldAlert,
  ArrowDownLeft,
  ArrowUpRight,
  TrendingUp,
  FileSpreadsheet,
  Key,
  Calculator,
  RefreshCw,
} from 'lucide-react';

interface UserManagementTabProps {
  currentUser: UserProfile;
}

export const UserManagementTab: React.FC<UserManagementTabProps> = ({ currentUser }) => {
  const [activeSubTab, setActiveSubTab] = useState<
    'employees' | 'financial_access' | 'cost_pricing_access' | 'permissions' | 'customers'
  >('employees');

  const [employees, setEmployees] = useState<UserProfile[]>(() => StorageService.getEmployees());
  const [customers, setCustomers] = useState<UserProfile[]>(() => StorageService.getCustomers());
  const [permissionsMatrix, setPermissionsMatrix] = useState<Record<UserRole, RolePermissions>>(() =>
    StorageService.getPermissionsMatrix()
  );

  // Modal State para Permissões Financeiras Individuais (Requisitos 6, 7 e 8)
  const [selectedUserForFinancial, setSelectedUserForFinancial] = useState<UserProfile | null>(null);
  const [individualPermsDraft, setIndividualPermsDraft] = useState<Partial<RolePermissions>>({});

  // Modal State para Permissões de Custos e Precificação Individuais (Prompt Seção 2)
  const [selectedUserForCostPricing, setSelectedUserForCostPricing] = useState<UserProfile | null>(null);
  const [costPricingPermsDraft, setCostPricingPermsDraft] = useState<Partial<RolePermissions>>({});

  // Search filters
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');

  // Modal State for New/Edit Employee
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);

  // Form fields
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formRole, setFormRole] = useState<UserRole>('vendedor');
  const [formDepartment, setFormDepartment] = useState('Comercial');
  const [formStatus, setFormStatus] = useState<'ativo' | 'inativo'>('ativo');

  // Feedback notifications
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3500);
  };

  const refreshData = () => {
    setEmployees(StorageService.getEmployees());
    setCustomers(StorageService.getCustomers());
    setPermissionsMatrix(StorageService.getPermissionsMatrix());
  };

  // Open modal for new employee
  const handleOpenCreateModal = () => {
    setEditingUser(null);
    setFormName('');
    setFormEmail('');
    setFormPassword('123456');
    setFormPhone('(11) 98888-7777');
    setFormRole('vendedor');
    setFormDepartment('Comercial');
    setFormStatus('ativo');
    setIsModalOpen(true);
  };

  // Open modal for editing employee
  const handleOpenEditModal = (user: UserProfile) => {
    setEditingUser(user);
    setFormName(user.name);
    setFormEmail(user.email);
    setFormPassword(user.password || '');
    setFormPhone(user.phone || '');
    setFormRole(user.role);
    setFormDepartment(user.department || '');
    setFormStatus(user.status || 'ativo');
    setIsModalOpen(true);
  };

  // Save employee
  const handleSaveEmployee = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formName.trim() || !formEmail.trim()) {
      showNotification('error', 'Nome e e-mail são obrigatórios.');
      return;
    }

    const userData: UserProfile = {
      id: editingUser ? editingUser.id : `emp-${Date.now()}`,
      name: formName.trim(),
      email: formEmail.trim().toLowerCase(),
      password: formPassword.trim() || '123456',
      phone: formPhone.trim(),
      role: formRole,
      department: formDepartment.trim(),
      status: formStatus,
      createdAt: editingUser ? editingUser.createdAt : new Date().toISOString(),
      lastLogin: editingUser ? editingUser.lastLogin : undefined,
      customPermissions: editingUser?.customPermissions,
    };

    StorageService.saveUser(userData);
    refreshData();
    setIsModalOpen(false);
    showNotification('success', `Colaborador ${userData.name} salvo com sucesso!`);
  };

  // Toggle status
  const handleToggleStatus = (userId: string) => {
    const updated = StorageService.toggleUserStatus(userId);
    if (updated) {
      refreshData();
      showNotification('success', `Status de ${updated.name} alterado para ${updated.status?.toUpperCase()}.`);
    }
  };

  // Delete user
  const handleDeleteUser = (user: UserProfile) => {
    if (user.id === currentUser.id) {
      showNotification('error', 'Você não pode excluir o usuário atualmente logado.');
      return;
    }
    if (window.confirm(`Tem certeza que deseja excluir o usuário ${user.name}?`)) {
      StorageService.deleteUser(user.id);
      refreshData();
      showNotification('success', `Usuário ${user.name} removido com sucesso.`);
    }
  };

  // Permission matrix toggle
  const handleTogglePermission = (role: UserRole, permissionKey: keyof RolePermissions) => {
    const currentPerms =
      (permissionsMatrix && permissionsMatrix[role]) ||
      StorageService.getRolePermissions(role) ||
      INITIAL_PERMISSIONS_MATRIX[role] ||
      ({} as any);

    const updatedMatrix: Record<UserRole, RolePermissions> = {
      ...(permissionsMatrix || {}),
      [role]: {
        ...currentPerms,
        [permissionKey]: !currentPerms[permissionKey],
      },
    };

    setPermissionsMatrix(updatedMatrix);
  };

  const handleSavePermissionsMatrix = () => {
    StorageService.savePermissionsMatrix(permissionsMatrix);
    showNotification('success', 'Matriz de permissões salva com sucesso!');
  };

  // Abrir Modal de Permissões Financeiras Individuais (Requisitos 6, 7 e 8)
  const handleOpenFinancialPermissionsModal = (user: UserProfile) => {
    setSelectedUserForFinancial(user);
    const custom = user.customPermissions || {};
    const rolePerms = StorageService.getRolePermissions(user.role) || INITIAL_PERMISSIONS_MATRIX[user.role] || (INITIAL_PERMISSIONS_MATRIX.visitante as RolePermissions);
    setIndividualPermsDraft({
      canViewFinancialModule:
        custom.canViewFinancialModule !== undefined
          ? custom.canViewFinancialModule
          : rolePerms.canViewFinancialModule,
      canViewFinancialDashboard:
        custom.canViewFinancialDashboard !== undefined
          ? custom.canViewFinancialDashboard
          : rolePerms.canViewFinancialDashboard,
      canViewReceivables:
        custom.canViewReceivables !== undefined
          ? custom.canViewReceivables
          : rolePerms.canViewReceivables,
      canCreateReceivable:
        custom.canCreateReceivable !== undefined
          ? custom.canCreateReceivable
          : rolePerms.canCreateReceivable,
      canEditReceivable:
        custom.canEditReceivable !== undefined
          ? custom.canEditReceivable
          : rolePerms.canEditReceivable,
      canReceivePayment:
        custom.canReceivePayment !== undefined
          ? custom.canReceivePayment
          : rolePerms.canReceivePayment,
      canCancelReceivable:
        custom.canCancelReceivable !== undefined
          ? custom.canCancelReceivable
          : rolePerms.canCancelReceivable,
      canRefundReceivable:
        custom.canRefundReceivable !== undefined
          ? custom.canRefundReceivable
          : rolePerms.canRefundReceivable,
      canViewPayables:
        custom.canViewPayables !== undefined
          ? custom.canViewPayables
          : rolePerms.canViewPayables,
      canCreatePayable:
        custom.canCreatePayable !== undefined
          ? custom.canCreatePayable
          : rolePerms.canCreatePayable,
      canEditPayable:
        custom.canEditPayable !== undefined
          ? custom.canEditPayable
          : rolePerms.canEditPayable,
      canPayBill:
        custom.canPayBill !== undefined
          ? custom.canPayBill
          : rolePerms.canPayBill,
      canCancelPayable:
        custom.canCancelPayable !== undefined
          ? custom.canCancelPayable
          : rolePerms.canCancelPayable,
      canRefundPayable:
        custom.canRefundPayable !== undefined
          ? custom.canRefundPayable
          : rolePerms.canRefundPayable,
      canViewCashFlow:
        custom.canViewCashFlow !== undefined
          ? custom.canViewCashFlow
          : rolePerms.canViewCashFlow,
      canViewRealizedValues:
        custom.canViewRealizedValues !== undefined
          ? custom.canViewRealizedValues
          : rolePerms.canViewRealizedValues,
      canViewProjectedValues:
        custom.canViewProjectedValues !== undefined
          ? custom.canViewProjectedValues
          : rolePerms.canViewProjectedValues,
      canViewFinancialReports:
        custom.canViewFinancialReports !== undefined
          ? custom.canViewFinancialReports
          : rolePerms.canViewFinancialReports,
      canExportFinancialReports:
        custom.canExportFinancialReports !== undefined
          ? custom.canExportFinancialReports
          : rolePerms.canExportFinancialReports,
      canManageFinancialCategories:
        custom.canManageFinancialCategories !== undefined
          ? custom.canManageFinancialCategories
          : rolePerms.canManageFinancialCategories,
      canManageCostCenters:
        custom.canManageCostCenters !== undefined
          ? custom.canManageCostCenters
          : rolePerms.canManageCostCenters,
      canManageBankAccounts:
        custom.canManageBankAccounts !== undefined
          ? custom.canManageBankAccounts
          : rolePerms.canManageBankAccounts,
      canManagePaymentMethods:
        custom.canManagePaymentMethods !== undefined
          ? custom.canManagePaymentMethods
          : rolePerms.canManagePaymentMethods,
      canManageRecurringTransactions:
        custom.canManageRecurringTransactions !== undefined
          ? custom.canManageRecurringTransactions
          : rolePerms.canManageRecurringTransactions,
      canManageFinancialSettings:
        custom.canManageFinancialSettings !== undefined
          ? custom.canManageFinancialSettings
          : rolePerms.canManageFinancialSettings,
      canViewFinancialAudit:
        custom.canViewFinancialAudit !== undefined
          ? custom.canViewFinancialAudit
          : rolePerms.canViewFinancialAudit,
    });
  };

  const handleSaveIndividualFinancialPermissions = () => {
    if (!selectedUserForFinancial) return;

    const res = StorageService.grantFinancialPermissions(
      selectedUserForFinancial.id,
      individualPermsDraft,
      currentUser
    );

    if (res.success) {
      refreshData();
      setSelectedUserForFinancial(null);
      showNotification(
        'success',
        `Permissões financeiras de ${selectedUserForFinancial.name} atualizadas e registradas na auditoria de segurança!`
      );
    } else {
      showNotification('error', res.error || 'Erro ao conceder permissões.');
    }
  };

  // Abrir Modal de Permissões de Custos e Precificação (Prompt Seção 2)
  const handleOpenCostPricingPermissionsModal = (user: UserProfile) => {
    setSelectedUserForCostPricing(user);
    const custom = user.customPermissions || {};
    const rolePerms = StorageService.getRolePermissions(user.role) || INITIAL_PERMISSIONS_MATRIX[user.role] || (INITIAL_PERMISSIONS_MATRIX.visitante as RolePermissions);
    setCostPricingPermsDraft({
      canViewCostPricingModule:
        custom.canViewCostPricingModule !== undefined
          ? custom.canViewCostPricingModule
          : rolePerms.canViewCostPricingModule,
      canViewCostsAndCompositions:
        custom.canViewCostsAndCompositions !== undefined
          ? custom.canViewCostsAndCompositions
          : rolePerms.canViewCostsAndCompositions,
      canManageCosts:
        custom.canManageCosts !== undefined
          ? custom.canManageCosts
          : rolePerms.canManageCosts,
      canManageMachines:
        custom.canManageMachines !== undefined
          ? custom.canManageMachines
          : rolePerms.canManageMachines,
      canConfigureDepreciation:
        custom.canConfigureDepreciation !== undefined
          ? custom.canConfigureDepreciation
          : rolePerms.canConfigureDepreciation,
      canConfigurePricingParameters:
        custom.canConfigurePricingParameters !== undefined
          ? custom.canConfigurePricingParameters
          : rolePerms.canConfigurePricingParameters,
      canCreateEditCostQuotes:
        custom.canCreateEditCostQuotes !== undefined
          ? custom.canCreateEditCostQuotes
          : rolePerms.canCreateEditCostQuotes,
      canApprovePricesAndDiscounts:
        custom.canApprovePricesAndDiscounts !== undefined
          ? custom.canApprovePricesAndDiscounts
          : rolePerms.canApprovePricesAndDiscounts,
      canViewPricingReports:
        custom.canViewPricingReports !== undefined
          ? custom.canViewPricingReports
          : rolePerms.canViewPricingReports,
      canExportPricingReports:
        custom.canExportPricingReports !== undefined
          ? custom.canExportPricingReports
          : rolePerms.canExportPricingReports,
    });
  };

  const handleSaveIndividualCostPricingPermissions = () => {
    if (!selectedUserForCostPricing) return;

    const res = StorageService.grantCostPricingPermissions(
      selectedUserForCostPricing.id,
      costPricingPermsDraft,
      currentUser
    );

    if (res.success) {
      refreshData();
      setSelectedUserForCostPricing(null);
      showNotification(
        'success',
        `Permissões de custos e precificação de ${selectedUserForCostPricing.name} atualizadas e registradas na auditoria!`
      );
    } else {
      showNotification('error', res.error || 'Erro ao conceder permissões.');
    }
  };

  // Filtered employees
  const filteredEmployees = employees.filter((emp) => {
    if (!emp) return false;
    const name = emp.name || '';
    const email = emp.email || '';
    const dept = emp.department || '';
    const s = (searchTerm || '').toLowerCase();
    const matchesSearch =
      name.toLowerCase().includes(s) ||
      email.toLowerCase().includes(s) ||
      dept.toLowerCase().includes(s);
    const matchesRole = roleFilter === 'all' || emp.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  // Filtered customers
  const filteredCustomers = customers.filter((cust) => {
    if (!cust) return false;
    const name = cust.name || '';
    const email = cust.email || '';
    const comp = cust.company || '';
    const doc = cust.cpfCnpj || '';
    const s = (searchTerm || '').toLowerCase();
    return (
      name.toLowerCase().includes(s) ||
      email.toLowerCase().includes(s) ||
      comp.toLowerCase().includes(s) ||
      doc.includes(s)
    );
  });

  const rolesToDisplay: { role: UserRole; name: string }[] = [
    { role: 'admin', name: 'Administrador' },
    { role: 'gerente', name: 'Gerente Geral' },
    { role: 'vendedor', name: 'Vendedor / Comercial' },
    { role: 'estoquista', name: 'Almoxarife / Estoque' },
  ];

  const permissionsList: { key: keyof RolePermissions; label: string; desc: string; category: string }[] = [
    // Operacional & Catálogo
    { key: 'canViewDashboard', label: 'Acesso ao Painel Admin', desc: 'Acessar a área de gestão interna', category: 'Operacional & Catálogo' },
    { key: 'canViewSiteMetrics', label: 'Visualizar Métricas do Site', desc: 'Acessar painel analítico de tráfego e acessos', category: 'Operacional & Catálogo' },
    { key: 'canManageProducts', label: 'Produtos & Catálogo', desc: 'Criar, editar e excluir itens do catálogo', category: 'Operacional & Catálogo' },
    { key: 'canManageCategories', label: 'Categorias & Subcategorias', desc: 'Estruturação do catálogo e departamentos', category: 'Operacional & Catálogo' },
    { key: 'canEditPrices', label: 'Preços & Faixas de Desconto', desc: 'Alterar tabelas e promoções de venda', category: 'Operacional & Catálogo' },
    { key: 'canManageStock', label: 'Controle de Estoque', desc: 'Lançamentos de entrada, saída e inventário', category: 'Operacional & Catálogo' },
    { key: 'canManageQuotes', label: 'Gestão de Orçamentos', desc: 'Precificar e responder cotações comerciais', category: 'Operacional & Catálogo' },
    { key: 'canManageOrders', label: 'Gestão de Pedidos', desc: 'Alterar status de produção, separação e envio', category: 'Operacional & Catálogo' },
    { key: 'canViewReports', label: 'Relatórios & Exportações', desc: 'Exportar dados analíticos e pedidos', category: 'Operacional & Catálogo' },
    { key: 'canDeleteData', label: 'Exclusão de Registros', desc: 'Apagar pedidos, orçamentos ou itens', category: 'Operacional & Catálogo' },

    // Vendas, PDV & Caixa
    { key: 'canAccessPDV', label: 'Acesso ao PDV Frente de Caixa', desc: 'Operar o terminal de vendas balcão', category: 'Vendas, PDV & Caixa' },
    { key: 'canOpenCloseCashRegister', label: 'Abertura e Fechamento de Caixa', desc: 'Abrir turno e encerrar conferência de caixa', category: 'Vendas, PDV & Caixa' },
    { key: 'canApplyDiscountPDV', label: 'Conceder Descontos no PDV', desc: 'Aplicar abatimentos pontuais no caixa', category: 'Vendas, PDV & Caixa' },
    { key: 'canCancelPDVSale', label: 'Cancelar Vendas no PDV', desc: 'Cancelar cupons e operações de venda', category: 'Vendas, PDV & Caixa' },
    { key: 'canPerformSangriaSuprimento', label: 'Sangria & Suprimento', desc: 'Lançar retiradas e reforços no caixa', category: 'Vendas, PDV & Caixa' },
    { key: 'canViewFinancialTransactions', label: 'Histórico de Transações de Venda', desc: 'Consultar comprovantes e pagamentos recebidos', category: 'Vendas, PDV & Caixa' },

    // Módulo Financeiro & Boletos (Restrito)
    { key: 'canViewFinancialModule', label: 'Acesso ao Módulo Financeiro', desc: 'Acesso central ao menu e dashboard financeiro', category: 'Módulo Financeiro & Boletos' },
    { key: 'canViewFinancialDashboard', label: 'Dashboard Financeiro', desc: 'Gráficos e KPIs de receitas e despesas', category: 'Módulo Financeiro & Boletos' },
    { key: 'canViewReceivables', label: 'Contas a Receber', desc: 'Consultar títulos e faturas a receber', category: 'Módulo Financeiro & Boletos' },
    { key: 'canCreateReceivable', label: 'Cadastrar Contas a Receber', desc: 'Lançar novos títulos manuais a receber', category: 'Módulo Financeiro & Boletos' },
    { key: 'canReceivePayment', label: 'Baixar / Quitar Recebíveis', desc: 'Registrar pagamentos de clientes', category: 'Módulo Financeiro & Boletos' },
    { key: 'canViewPayables', label: 'Contas a Pagar', desc: 'Consultar despesas e títulos a pagar', category: 'Módulo Financeiro & Boletos' },
    { key: 'canCreatePayable', label: 'Cadastrar Contas a Pagar', desc: 'Lançar novas contas de fornecedores', category: 'Módulo Financeiro & Boletos' },
    { key: 'canPayBill', label: 'Baixar / Pagar Contas', desc: 'Dar baixa de quitação em contas a pagar', category: 'Módulo Financeiro & Boletos' },
    { key: 'canViewCashFlow', label: 'Fluxo de Caixa (Realizado / Projetado)', desc: 'Demonstrativo diário e mensal de liquidez', category: 'Módulo Financeiro & Boletos' },
    { key: 'canViewFinancialReports', label: 'Relatórios Financeiros & DRE', desc: 'Consultar DRE e relatórios contábeis', category: 'Módulo Financeiro & Boletos' },
    { key: 'canExportFinancialReports', label: 'Exportar Relatórios Financeiros', desc: 'Exportar arquivos CSV e relatórios PDF', category: 'Módulo Financeiro & Boletos' },
    { key: 'canManageFinancialCategories', label: 'Plano de Contas & Centros de Custo', desc: 'Configurar categorias e centros de custo', category: 'Módulo Financeiro & Boletos' },
    { key: 'canManageBankAccounts', label: 'Contas Bancárias & Métodos', desc: 'Gerenciar contas correntes e carteiras', category: 'Módulo Financeiro & Boletos' },
    { key: 'canManageFinancialSettings', label: 'Configurações Financeiras', desc: 'Parâmetros de juros, multas e regras', category: 'Módulo Financeiro & Boletos' },
    { key: 'canViewFinancialAudit', label: 'Trilha de Auditoria Financeira', desc: 'Log imutável de operações financeiras sensíveis', category: 'Módulo Financeiro & Boletos' },
    { key: 'canConfigureBoletoRules', label: 'Regras de Boleto Bancário', desc: 'Configurar instruções, juros e multas de boletos', category: 'Módulo Financeiro & Boletos' },
    { key: 'canAuthorizeDeferredBoleto', label: 'Autorizar Faturamento a Prazo', desc: 'Liberar vendas a prazo para clientes corporativos', category: 'Módulo Financeiro & Boletos' },

    // Módulo de Custos & Precificação
    { key: 'canViewCostPricingModule', label: 'Acesso ao Módulo de Custos & Precificação', desc: 'Visualizar a aba de engenharia de custos', category: 'Custos & Precificação' },
    { key: 'canViewCostsAndCompositions', label: 'Consultar Custos & Fichas Técnicas', desc: 'Ver composição de custos unitários e insumos', category: 'Custos & Precificação' },
    { key: 'canManageCosts', label: 'Cadastrar e Editar Custos', desc: 'Gerenciar insumos, matérias-primas e custos fixos', category: 'Custos & Precificação' },
    { key: 'canManageMachines', label: 'Gestão de Máquinas & Equipamentos', desc: 'Cadastrar máquinas de personalização', category: 'Custos & Precificação' },
    { key: 'canConfigureDepreciation', label: 'Configurar Depreciação & Manutenção', desc: 'Ajustar vida útil, potência e depreciação/hora', category: 'Custos & Precificação' },
    { key: 'canConfigurePricingParameters', label: 'Configurar Parâmetros de Precificação', desc: 'Alterar margens de lucro, impostos e markups', category: 'Custos & Precificação' },
    { key: 'canCreateEditCostQuotes', label: 'Criar e Editar Orçamentos de Custo', desc: 'Elaborar cotações com cálculo automatizado', category: 'Custos & Precificação' },
    { key: 'canApprovePricesAndDiscounts', label: 'Aprovar Preços & Descontos Especiais', desc: 'Autorizar margens abaixo da tabela mínima', category: 'Custos & Precificação' },
    { key: 'canViewPricingReports', label: 'Relatórios de Precificação & Ponto de Equilíbrio', desc: 'Visualizar análise de lucratividade e breakeven', category: 'Custos & Precificação' },
    { key: 'canExportPricingReports', label: 'Exportar Relatórios de Custos', desc: 'Exportar dados para Excel e PDF', category: 'Custos & Precificação' },

    // Configurações & Sistema
    { key: 'canManageUsers', label: 'Gestão de Usuários & Equipe', desc: 'Cadastrar colaboradores e conceder acessos', category: 'Configurações & Sistema' },
    { key: 'canManageCompanySettings', label: 'Dados & Logo da MB Personaliza', desc: 'Alterar dados cadastrais e WhatsApps da empresa', category: 'Configurações & Sistema' },
    { key: 'canManageDeliverySettings', label: 'Regiões de Atendimento & Frete', desc: 'Configurar CEPs atendidos, taxas e Sedex/PAC', category: 'Configurações & Sistema' },
    { key: 'canCustomizeLayout', label: 'Personalização de Layout & Banners', desc: 'Configurar cores, temas, banners e loja virtual', category: 'Configurações & Sistema' },
    { key: 'canManagePaymentGateways', label: 'Gateways de Pagamento (Mercado Pago / PagBank)', desc: 'Credenciais de checkout transparente e PIX', category: 'Configurações & Sistema' },
    { key: 'canManageMaintenanceMode', label: 'Gerenciar Modo Manutenção', desc: 'Ativar/desativar tela de manutenção do sistema', category: 'Configurações & Sistema' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-slate-900 to-slate-700 flex items-center justify-center text-[#FFDD00] shadow-sm">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-heading font-black uppercase text-slate-900">
              Gestão de Usuários & Controle de Acessos
            </h2>
            <p className="text-xs text-slate-500">
              Controle de colaboradores internos da MB Personaliza, clientes cadastrados e matriz de permissões.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
          <button
            type="button"
            onClick={() => {
              refreshData();
              showNotification('success', 'Dados de colaboradores e matriz de permissões recarregados com sucesso!');
            }}
            className="px-3.5 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
            title="Recarregar dados de usuários e permissões"
          >
            <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
            <span>Recarregar</span>
          </button>

          {activeSubTab === 'employees' && (
            <button
              type="button"
              onClick={handleOpenCreateModal}
              className="px-4 py-2 text-xs font-extrabold text-white bg-[#E6007E] hover:bg-[#c9006e] rounded-xl shadow-sm transition-all flex items-center gap-2 cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>Novo Colaborador</span>
            </button>
          )}

          {activeSubTab === 'permissions' && (
            <button
              type="button"
              onClick={handleSavePermissionsMatrix}
              className="px-4 py-2 text-xs font-extrabold text-white bg-slate-900 hover:bg-[#E6007E] rounded-xl shadow-sm transition-all flex items-center gap-2 cursor-pointer"
            >
              <Check className="w-4 h-4 text-[#FFDD00]" />
              <span>Salvar Matriz de Permissões</span>
            </button>
          )}
        </div>
      </div>

      {/* Notification banner */}
      {notification && (
        <div
          className={`p-4 rounded-2xl text-xs font-bold flex items-center gap-2.5 animate-fadeIn ${
            notification.type === 'success'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border border-rose-200 text-rose-800'
          }`}
        >
          {notification.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span>{notification.message}</span>
        </div>
      )}

      {/* Navigation Subtabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveSubTab('employees')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 ${
            activeSubTab === 'employees'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Equipe & Colaboradores ({employees.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('financial_access')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 ${
            activeSubTab === 'financial_access'
              ? 'bg-gradient-to-r from-[#E6007E] to-rose-600 text-white shadow-xs ring-2 ring-pink-300'
              : 'bg-white text-rose-700 hover:bg-rose-50 border border-rose-200/70'
          }`}
        >
          <DollarSign className="w-4 h-4 text-[#FFDD00]" />
          <span>Acesso Módulo Financeiro</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('cost_pricing_access')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 ${
            activeSubTab === 'cost_pricing_access'
              ? 'bg-gradient-to-r from-blue-600 to-indigo-700 text-white shadow-xs ring-2 ring-blue-300'
              : 'bg-white text-blue-700 hover:bg-blue-50 border border-blue-200/70'
          }`}
        >
          <Calculator className="w-4 h-4 text-[#FFDD00]" />
          <span>Acesso Custos & Precificação</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('permissions')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 ${
            activeSubTab === 'permissions'
              ? 'bg-[#E6007E] text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100'
          }`}
        >
          <SlidersHorizontal className="w-4 h-4" />
          <span>Matriz de Permissões por Cargo</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('customers')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 ${
            activeSubTab === 'customers'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100'
          }`}
        >
          <ShoppingBag className="w-4 h-4 text-[#00AEEF]" />
          <span>Clientes Cadastrados ({customers.length})</span>
        </button>
      </div>

      {/* SUBTAB 1: EMPLOYEES LIST */}
      {activeSubTab === 'employees' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          {/* Filter toolbar */}
          <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50/50">
            <div className="relative w-full sm:w-80">
              <input
                type="text"
                placeholder="Buscar por nome, e-mail ou setor..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-slate-900"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <span className="text-xs font-bold text-slate-500 whitespace-nowrap">Filtrar Função:</span>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-slate-900 font-medium"
              >
                <option value="all">Todas as Funções</option>
                <option value="admin">Administrador</option>
                <option value="gerente">Gerente</option>
                <option value="vendedor">Vendedor / Comercial</option>
                <option value="estoquista">Almoxarife / Estoque</option>
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100/75 text-slate-600 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200">
                <tr>
                  <th className="py-3.5 px-4">Colaborador / Contato</th>
                  <th className="py-3.5 px-4">Função / Nível</th>
                  <th className="py-3.5 px-4">Departamento</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Último Login</th>
                  <th className="py-3.5 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredEmployees.map((emp) => {
                  const roleBadgeConfig: Record<string, { bg: string; label: string }> = {
                    admin: { bg: 'bg-rose-50 text-rose-700 border-rose-200', label: 'Administrador' },
                    gerente: { bg: 'bg-purple-50 text-purple-700 border-purple-200', label: 'Gerente Geral' },
                    vendedor: { bg: 'bg-blue-50 text-blue-700 border-blue-200', label: 'Comercial / Vendas' },
                    estoquista: { bg: 'bg-amber-50 text-amber-700 border-amber-200', label: 'Almoxarife / Estoque' },
                    cliente: { bg: 'bg-slate-100 text-slate-700 border-slate-200', label: 'Cliente' },
                    visitante: { bg: 'bg-slate-100 text-slate-600 border-slate-200', label: 'Visitante' },
                  };
                  const badge = roleBadgeConfig[emp.role] || {
                    bg: 'bg-slate-100 text-slate-700 border-slate-200',
                    label: emp.role || 'Colaborador',
                  };

                  return (
                    <tr key={emp.id} className="hover:bg-slate-50/75 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-slate-900 text-white font-extrabold text-xs flex items-center justify-center shrink-0">
                            {(emp.name || emp.email || 'CO').substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-extrabold text-slate-900 flex items-center gap-1.5">
                              {emp.name}
                              {emp.id === currentUser.id && (
                                <span className="text-[9px] font-extrabold px-1.5 py-0.5 bg-slate-200 text-slate-700 rounded-md">
                                  Você
                                </span>
                              )}
                            </p>
                            <p className="text-[11px] text-slate-500">{emp.email}</p>
                            {emp.phone && <p className="text-[10px] text-slate-400">{emp.phone}</p>}
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-extrabold border ${badge.bg}`}
                        >
                          {badge.label}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="text-slate-700 font-medium">{emp.department || 'Geral'}</span>
                      </td>

                      <td className="py-3.5 px-4">
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(emp.id)}
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border cursor-pointer transition-colors ${
                            emp.status === 'ativo'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                              : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              emp.status === 'ativo' ? 'bg-emerald-500' : 'bg-rose-500'
                            }`}
                          />
                          {emp.status === 'ativo' ? 'Ativo' : 'Inativo'}
                        </button>
                      </td>

                      <td className="py-3.5 px-4 text-slate-500 text-[11px]">
                        {emp.lastLogin ? new Date(emp.lastLogin).toLocaleDateString('pt-BR') : 'Sem registro'}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenFinancialPermissionsModal(emp)}
                            className="p-1.5 text-rose-600 hover:text-white hover:bg-rose-600 rounded-lg transition-colors cursor-pointer"
                            title="Conceder / Configurar Acesso ao Módulo Financeiro"
                          >
                            <DollarSign className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenCostPricingPermissionsModal(emp)}
                            className="p-1.5 text-blue-600 hover:text-white hover:bg-blue-600 rounded-lg transition-colors cursor-pointer"
                            title="Conceder / Configurar Permissões de Custos e Precificação"
                          >
                            <Calculator className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(emp)}
                            className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                            title="Editar Colaborador"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          {emp.id !== currentUser.id && (
                            <button
                              type="button"
                              onClick={() => handleDeleteUser(emp)}
                              className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title="Excluir Colaborador"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUBTAB: FINANCIAL ACCESS MANAGEMENT (REQUISITOS 6, 7 E 8) */}
      {activeSubTab === 'financial_access' && (
        <div className="space-y-6">
          {/* Card de Princípio do Menor Privilégio e Regra de Acesso */}
          <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white p-6 rounded-3xl shadow-lg border border-slate-700/80 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-[#E6007E] text-white flex items-center justify-center shadow-md shrink-0">
                  <ShieldCheck className="w-6 h-6 stroke-[2.5]" />
                </div>
                <div>
                  <h3 className="font-heading text-lg font-black uppercase text-white tracking-wide">
                    Controle de Acesso ao Módulo Financeiro
                  </h3>
                  <p className="text-xs text-slate-300">
                    Acesso restrito sob o Princípio do Menor Privilégio. Apenas Administradores possuem acesso total automático.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Admin → Acesso Total
                </span>
                <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase bg-sky-500/20 text-sky-300 border border-sky-500/30">
                  Autorizado → Somente Permissões
                </span>
                <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase bg-rose-500/20 text-rose-300 border border-rose-500/30">
                  Sem Permissão → Sem Acesso
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-400 bg-slate-800/80 p-3 rounded-2xl border border-slate-700">
              💡 <strong>Regra Obrigatória:</strong> Usuários sem a permissão{' '}
              <code className="text-pink-400 font-mono">canViewFinancialModule</code> não visualizam o menu Financeiro
              e têm acesso impedido tanto na URL quanto no backend/APIs. A concessão individual é feita abaixo pelo Administrador.
            </p>
          </div>

          {/* KPI Cards de Controle */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-bold text-slate-500 uppercase">Total de Colaboradores</span>
              <p className="text-2xl font-black text-slate-900 mt-1">{employees.length}</p>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-bold text-slate-500 uppercase">Com Acesso Financeiro</span>
              <p className="text-2xl font-black text-emerald-600 mt-1">
                {StorageService.getUsersWithFinancialAccess().length}
              </p>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-bold text-slate-500 uppercase">Administradores (Total)</span>
              <p className="text-2xl font-black text-blue-600 mt-1">
                {employees.filter((e) => e.role === 'admin').length}
              </p>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-bold text-slate-500 uppercase">Acesso Bloqueado</span>
              <p className="text-2xl font-black text-rose-600 mt-1">
                {employees.length - StorageService.getUsersWithFinancialAccess().length}
              </p>
            </div>
          </div>

          {/* Tabela de Usuários e Gestão de Permissões Financeiras */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50/50">
              <div className="relative w-full sm:w-80">
                <input
                  type="text"
                  placeholder="Buscar colaborador por nome ou e-mail..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-slate-900"
                />
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              </div>

              <span className="text-xs font-bold text-slate-500">
                Visualizando colaboradores e suas concessões financeiras
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100/75 text-slate-600 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200">
                  <tr>
                    <th className="py-3.5 px-4">Colaborador</th>
                    <th className="py-3.5 px-4">Cargo / Nível</th>
                    <th className="py-3.5 px-4">Acesso Financeiro</th>
                    <th className="py-3.5 px-4">Permissões Efetivas</th>
                    <th className="py-3.5 px-4 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredEmployees.map((emp) => {
                    const isEmpAdmin = emp.role === 'admin';
                    const hasModule = StorageService.hasUserPermission(emp, 'canViewFinancialModule');
                    const hasReceivables = StorageService.hasUserPermission(emp, 'canViewReceivables');
                    const hasPayables = StorageService.hasUserPermission(emp, 'canViewPayables');
                    const hasCashFlow = StorageService.hasUserPermission(emp, 'canViewCashFlow');
                    const hasReports = StorageService.hasUserPermission(emp, 'canViewFinancialReports');
                    const hasAudit = StorageService.hasUserPermission(emp, 'canViewFinancialAudit');

                    return (
                      <tr key={emp.id} className="hover:bg-slate-50/75 transition-colors">
                        <td className="py-3.5 px-4">
                          <p className="font-extrabold text-slate-900">{emp.name}</p>
                          <p className="text-[11px] text-slate-500">{emp.email}</p>
                        </td>

                        <td className="py-3.5 px-4">
                          <span className="font-bold text-slate-700 capitalize">{emp.role}</span>
                        </td>

                        <td className="py-3.5 px-4">
                          {isEmpAdmin ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-emerald-100 text-emerald-800 border border-emerald-200">
                              <ShieldCheck className="w-3.5 h-3.5" />
                              Total (Admin)
                            </span>
                          ) : hasModule ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-sky-100 text-sky-800 border border-sky-200">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Autorizado (Parcial)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-slate-100 text-slate-500 border border-slate-200">
                              <Lock className="w-3.5 h-3.5" />
                              Sem Acesso (Bloqueado)
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="flex flex-wrap items-center gap-1 max-w-md">
                            {isEmpAdmin ? (
                              <span className="text-[11px] font-bold text-emerald-700">
                                Todas as 26 permissões concedidas por padrão
                              </span>
                            ) : hasModule ? (
                              <>
                                {hasReceivables && (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    Contas a Receber
                                  </span>
                                )}
                                {hasPayables && (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                    Contas a Pagar
                                  </span>
                                )}
                                {hasCashFlow && (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                    Fluxo de Caixa
                                  </span>
                                )}
                                {hasReports && (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                    Relatórios
                                  </span>
                                )}
                                {hasAudit && (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                                    Auditoria
                                  </span>
                                )}
                              </>
                            ) : (
                              <span className="text-[11px] text-slate-400 italic">Nenhuma permissão concedida</span>
                            )}
                          </div>
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => handleOpenFinancialPermissionsModal(emp)}
                            className="px-3 py-1.5 text-xs font-black rounded-xl bg-slate-900 text-white hover:bg-[#E6007E] transition-all cursor-pointer shadow-xs"
                            title="Conceder, editar ou revogar permissões financeiras deste colaborador"
                          >
                            Definir Permissões
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB: COST PRICING ACCESS MANAGEMENT */}
      {activeSubTab === 'cost_pricing_access' && (
        <div className="space-y-6">
          {/* Card Informativo do Módulo de Custos & Precificação */}
          <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 rounded-3xl shadow-lg border border-indigo-900/50 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md shrink-0">
                  <Calculator className="w-6 h-6 stroke-[2.5]" />
                </div>
                <div>
                  <h3 className="font-heading text-lg font-black uppercase text-white tracking-wide">
                    Controle de Acesso: Módulo de Custos & Precificação
                  </h3>
                  <p className="text-xs text-indigo-200">
                    Gerencie quem na equipe pode visualizar composições de custos, cadastrar insumos e máquinas, e configurar margens de lucro.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Admin → Acesso Total
                </span>
                <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  Colaborador → Concessão Granular
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-300 bg-slate-800/80 p-3 rounded-2xl border border-slate-700">
              💡 <strong>Regra de Acesso:</strong> Colaboradores precisam da permissão{' '}
              <code className="text-blue-400 font-mono">canViewCostPricingModule</code> para acessar o módulo. Permissões de edição de insumos, máquinas, margens e relatórios são configuradas individualmente pelo Administrador.
            </p>
          </div>

          {/* Tabela de Colaboradores e Permissões de Custos */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50/50">
              <div className="relative w-full sm:w-80">
                <input
                  type="text"
                  placeholder="Buscar colaborador..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-slate-900"
                />
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              </div>

              <span className="text-xs font-bold text-slate-500">
                Colaboradores e permissões de custos / orçamentos
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100/75 text-slate-600 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200">
                  <tr>
                    <th className="py-3.5 px-4">Colaborador</th>
                    <th className="py-3.5 px-4">Cargo / Setor</th>
                    <th className="py-3.5 px-4">Acesso ao Módulo</th>
                    <th className="py-3.5 px-4">Permissões de Custo Ativas</th>
                    <th className="py-3.5 px-4 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredEmployees.map((emp) => {
                    const isEmpAdmin = emp.role === 'admin';
                    const hasCostModule = StorageService.hasUserPermission(emp, 'canViewCostPricingModule');
                    const hasCosts = StorageService.hasUserPermission(emp, 'canViewCostsAndCompositions');
                    const hasManageCosts = StorageService.hasUserPermission(emp, 'canManageCosts');
                    const hasMachines = StorageService.hasUserPermission(emp, 'canManageMachines');
                    const hasPricingParams = StorageService.hasUserPermission(emp, 'canConfigurePricingParameters');
                    const hasQuotes = StorageService.hasUserPermission(emp, 'canCreateEditCostQuotes');

                    return (
                      <tr key={emp.id} className="hover:bg-slate-50/75 transition-colors">
                        <td className="py-3.5 px-4">
                          <p className="font-extrabold text-slate-900">{emp.name}</p>
                          <p className="text-[11px] text-slate-500">{emp.email}</p>
                        </td>

                        <td className="py-3.5 px-4">
                          <span className="font-bold text-slate-700 capitalize">{emp.role}</span>
                          <span className="block text-[11px] text-slate-400">{emp.department || 'Geral'}</span>
                        </td>

                        <td className="py-3.5 px-4">
                          {isEmpAdmin ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-emerald-100 text-emerald-800 border border-emerald-200">
                              <ShieldCheck className="w-3.5 h-3.5" />
                              Total (Admin)
                            </span>
                          ) : hasCostModule ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-blue-100 text-blue-800 border border-blue-200">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Autorizado
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-slate-100 text-slate-500 border border-slate-200">
                              <Lock className="w-3.5 h-3.5" />
                              Bloqueado
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="flex flex-wrap items-center gap-1 max-w-md">
                            {isEmpAdmin ? (
                              <span className="text-[11px] font-bold text-emerald-700">
                                Acesso total a fichas, máquinas, margens e orçamentos
                              </span>
                            ) : hasCostModule ? (
                              <>
                                {hasCosts && (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                    Fichas e Insumos
                                  </span>
                                )}
                                {hasManageCosts && (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                    Editar Custos
                                  </span>
                                )}
                                {hasMachines && (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                                    Máquinas
                                  </span>
                                )}
                                {hasPricingParams && (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                    Parâmetros
                                  </span>
                                )}
                                {hasQuotes && (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    Orçamentos
                                  </span>
                                )}
                              </>
                            ) : (
                              <span className="text-[11px] text-slate-400 italic">Sem permissões ativas</span>
                            )}
                          </div>
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => handleOpenCostPricingPermissionsModal(emp)}
                            className="px-3 py-1.5 text-xs font-black rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-all cursor-pointer shadow-xs flex items-center gap-1.5 ml-auto"
                            title="Configurar permissões de custos deste colaborador"
                          >
                            <Calculator className="w-3.5 h-3.5" />
                            <span>Definir Permissões</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 2: PERMISSIONS MATRIX */}
      {activeSubTab === 'permissions' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden p-6 space-y-6">
          <div>
            <h3 className="text-base font-extrabold uppercase text-slate-900">
              Matriz Global de Permissões de Acesso
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Defina o que cada cargo interno pode visualizar e executar no painel administrativo da MB Personaliza.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border border-slate-200 rounded-2xl">
              <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[11px] border-b border-slate-200">
                <tr>
                  <th className="py-3.5 px-4">Módulo / Permissão</th>
                  {rolesToDisplay.map((r) => (
                    <th key={r.role} className="py-3.5 px-4 text-center">
                      <span className="block font-black text-slate-900">{r.name}</span>
                      <span className="text-[10px] text-slate-500 normal-case font-normal">
                        ({r.role})
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {Object.entries(
                  permissionsList.reduce<Record<string, typeof permissionsList>>((acc, perm) => {
                    acc[perm.category] = acc[perm.category] || [];
                    acc[perm.category].push(perm);
                    return acc;
                  }, {})
                ).map(([catName, items]) => (
                  <React.Fragment key={catName}>
                    <tr className="bg-slate-100/90 border-y border-slate-200">
                      <td
                        colSpan={rolesToDisplay.length + 1}
                        className="py-2.5 px-4 text-[11px] font-black uppercase tracking-wider text-slate-800"
                      >
                        📂 {catName}
                      </td>
                    </tr>
                    {items.map((row) => (
                      <tr key={row.key} className="hover:bg-slate-50/75 transition-colors">
                        <td className="py-3 px-4">
                          <p className="font-bold text-slate-900">{row.label}</p>
                          <p className="text-[11px] text-slate-400">{row.desc}</p>
                        </td>

                        {rolesToDisplay.map((r) => {
                          const rolePerms =
                            (permissionsMatrix && permissionsMatrix[r.role]) ||
                            StorageService.getRolePermissions(r.role) ||
                            INITIAL_PERMISSIONS_MATRIX[r.role] ||
                            ({} as any);
                          const isAllowed = rolePerms ? Boolean(rolePerms[row.key]) : false;
                          const isAdminRole = r.role === 'admin';

                          return (
                            <td key={r.role} className="py-3 px-4 text-center">
                              <button
                                type="button"
                                disabled={isAdminRole}
                                onClick={() => handleTogglePermission(r.role, row.key)}
                                className={`w-9 h-9 rounded-xl inline-flex items-center justify-center transition-all ${
                                  isAllowed
                                    ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                                    : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                                } ${isAdminRole ? 'opacity-90 cursor-not-allowed' : 'cursor-pointer shadow-xs'}`}
                                title={
                                  isAdminRole
                                    ? 'Administrador possui acesso total fixo'
                                    : isAllowed
                                    ? 'Permitido (Clique para bloquear)'
                                    : 'Bloqueado (Clique para permitir)'
                                }
                              >
                                {isAllowed ? (
                                  <Check className="w-5 h-5 font-black stroke-[3]" />
                                ) : (
                                  <X className="w-4 h-4 font-bold" />
                                )}
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end pt-3">
            <button
              type="button"
              onClick={handleSavePermissionsMatrix}
              className="px-6 py-3 text-xs font-extrabold text-white bg-slate-900 hover:bg-[#E6007E] rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer"
            >
              <Check className="w-4 h-4 text-[#FFDD00]" />
              <span>Salvar Alterações de Permissões</span>
            </button>
          </div>
        </div>
      )}

      {/* SUBTAB 3: CUSTOMERS LIST */}
      {activeSubTab === 'customers' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          {/* Toolbar */}
          <div className="p-4 border-b border-slate-100 flex items-center justify-between gap-3 bg-slate-50/50">
            <div className="relative w-full sm:w-80">
              <input
                type="text"
                placeholder="Buscar cliente por razão social, nome, CPF/CNPJ..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-slate-900"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            </div>

            <span className="text-xs font-bold text-slate-500">
              {filteredCustomers.length} clientes encontrados
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100/75 text-slate-600 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200">
                <tr>
                  <th className="py-3.5 px-4">Cliente / Razão Social</th>
                  <th className="py-3.5 px-4">CPF / CNPJ</th>
                  <th className="py-3.5 px-4">Contato / WhatsApp</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Cadastrado em</th>
                  <th className="py-3.5 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCustomers.map((cust) => (
                  <tr key={cust.id} className="hover:bg-slate-50/75 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-pink-100 text-[#E6007E] font-extrabold text-xs flex items-center justify-center shrink-0">
                          {(cust.name || cust.email || 'CL').substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-extrabold text-slate-900">{cust.company || cust.name}</p>
                          <p className="text-[11px] text-slate-500">{cust.email}</p>
                          {cust.company && <p className="text-[10px] text-slate-400">Contato: {cust.name}</p>}
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="font-mono text-slate-700">{cust.cpfCnpj || 'Não informado'}</span>
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="text-slate-700">{cust.phone || '-'}</span>
                    </td>

                    <td className="py-3.5 px-4">
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(cust.id)}
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border cursor-pointer transition-colors ${
                          cust.status === 'ativo'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                            : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            cust.status === 'ativo' ? 'bg-emerald-500' : 'bg-rose-500'
                          }`}
                        />
                        {cust.status === 'ativo' ? 'Ativo' : 'Inativo'}
                      </button>
                    </td>

                    <td className="py-3.5 px-4 text-slate-500 text-[11px]">
                      {new Date(cust.createdAt).toLocaleDateString('pt-BR')}
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => handleOpenEditModal(cust)}
                        className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                        title="Editar Cliente"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CREATE / EDIT EMPLOYEE MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 max-w-lg w-full p-6 sm:p-8 space-y-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-5 right-5 p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-1">
              <h3 className="font-heading text-lg font-black uppercase text-slate-900">
                {editingUser ? 'Editar Colaborador' : 'Cadastrar Novo Colaborador'}
              </h3>
              <p className="text-xs text-slate-500">
                Preencha os dados e perfil de acesso do funcionário na MB Personaliza.
              </p>
            </div>

            <form onSubmit={handleSaveEmployee} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Nome Completo</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-[#E6007E]"
                  placeholder="Ex: Carlos Alberto"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">E-mail de Login</label>
                  <input
                    type="email"
                    required
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-[#E6007E]"
                    placeholder="carlos@mbpersonaliza.com.br"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Senha de Acesso</label>
                  <input
                    type="text"
                    required
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-[#E6007E] font-mono"
                    placeholder="••••••"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Cargo / Função</label>
                  <select
                    value={formRole}
                    onChange={(e) => setFormRole(e.target.value as UserRole)}
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-[#E6007E] font-bold"
                  >
                    <option value="admin">Administrador (Total)</option>
                    <option value="gerente">Gerente Geral</option>
                    <option value="vendedor">Vendedor / Comercial</option>
                    <option value="estoquista">Almoxarife / Estoquista</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Departamento / Setor</label>
                  <input
                    type="text"
                    value={formDepartment}
                    onChange={(e) => setFormDepartment(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-[#E6007E]"
                    placeholder="Comercial, Diretoria, Logística..."
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Telefone / Ramal</label>
                  <input
                    type="text"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-[#E6007E]"
                    placeholder="(11) 98888-7777"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Status da Conta</label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as 'ativo' | 'inativo')}
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-[#E6007E]"
                  >
                    <option value="ativo">Ativo (Pode logar)</option>
                    <option value="inativo">Inativo (Bloqueado)</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 text-xs font-extrabold text-white bg-[#E6007E] hover:bg-[#c9006e] rounded-xl shadow-md transition-all cursor-pointer"
                >
                  Salvar Colaborador
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE PERMISSÕES FINANCEIRAS INDIVIDUAIS (REQUISITOS 6, 7 E 8) */}
      {selectedUserForFinancial && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl border border-slate-200 max-w-2xl w-full p-6 sm:p-8 space-y-5 shadow-2xl relative max-h-[90vh] overflow-y-auto my-8">
            <button
              onClick={() => setSelectedUserForFinancial(null)}
              className="absolute top-5 right-5 p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-1 border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-[#E6007E] text-white">
                  Menor Privilégio
                </span>
                <span className="text-xs text-slate-400 font-bold">
                  {selectedUserForFinancial.role.toUpperCase()}
                </span>
              </div>
              <h3 className="font-heading text-lg font-black uppercase text-slate-900">
                Permissões Financeiras: {selectedUserForFinancial.name}
              </h3>
              <p className="text-xs text-slate-500">
                Conceda ou revogue acessos específicos para este colaborador. Usuários sem a permissão correspondente terão o acesso bloqueado imediatamente na interface e nas APIs.
              </p>
            </div>

            {/* Presets Rápidos de Segurança */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
              <span className="text-[11px] font-black uppercase text-slate-700 block">
                Modelos Rápidos (Princípio do Menor Privilégio):
              </span>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIndividualPermsDraft({
                      canViewFinancialModule: true,
                      canViewFinancialDashboard: false,
                      canViewReceivables: true,
                      canCreateReceivable: true,
                      canEditReceivable: false,
                      canReceivePayment: true,
                      canCancelReceivable: false,
                      canRefundReceivable: false,
                      canViewPayables: false,
                      canCreatePayable: false,
                      canEditPayable: false,
                      canPayBill: false,
                      canCancelPayable: false,
                      canRefundPayable: false,
                      canViewCashFlow: false,
                      canViewRealizedValues: false,
                      canViewProjectedValues: false,
                      canViewFinancialReports: false,
                      canExportFinancialReports: false,
                      canManageFinancialCategories: false,
                      canManageCostCenters: false,
                      canManageBankAccounts: false,
                      canManagePaymentMethods: false,
                      canManageRecurringTransactions: false,
                      canManageFinancialSettings: false,
                      canViewFinancialAudit: false,
                    });
                  }}
                  className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-emerald-100 text-emerald-800 hover:bg-emerald-200 cursor-pointer"
                >
                  🟢 Operador Recebimento (Ver + Baixar)
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIndividualPermsDraft({
                      canViewFinancialModule: true,
                      canViewFinancialDashboard: false,
                      canViewReceivables: false,
                      canCreateReceivable: false,
                      canEditReceivable: false,
                      canReceivePayment: false,
                      canCancelReceivable: false,
                      canRefundReceivable: false,
                      canViewPayables: true,
                      canCreatePayable: true,
                      canEditPayable: true,
                      canPayBill: true,
                      canCancelPayable: false,
                      canRefundPayable: false,
                      canViewCashFlow: false,
                      canViewRealizedValues: false,
                      canViewProjectedValues: false,
                      canViewFinancialReports: false,
                      canExportFinancialReports: false,
                      canManageFinancialCategories: false,
                      canManageCostCenters: false,
                      canManageBankAccounts: false,
                      canManagePaymentMethods: false,
                      canManageRecurringTransactions: false,
                      canManageFinancialSettings: false,
                      canViewFinancialAudit: false,
                    });
                  }}
                  className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-rose-100 text-rose-800 hover:bg-rose-200 cursor-pointer"
                >
                  🔴 Operador Pagamentos (Ver + Pagar)
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIndividualPermsDraft({
                      canViewFinancialModule: true,
                      canViewFinancialDashboard: true,
                      canViewReceivables: true,
                      canCreateReceivable: false,
                      canEditReceivable: false,
                      canReceivePayment: false,
                      canCancelReceivable: false,
                      canRefundReceivable: false,
                      canViewPayables: true,
                      canCreatePayable: false,
                      canEditPayable: false,
                      canPayBill: false,
                      canCancelPayable: false,
                      canRefundPayable: false,
                      canViewCashFlow: true,
                      canViewRealizedValues: true,
                      canViewProjectedValues: true,
                      canViewFinancialReports: true,
                      canExportFinancialReports: false,
                      canManageFinancialCategories: false,
                      canManageCostCenters: false,
                      canManageBankAccounts: false,
                      canManagePaymentMethods: false,
                      canManageRecurringTransactions: false,
                      canManageFinancialSettings: false,
                      canViewFinancialAudit: false,
                    });
                  }}
                  className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-sky-100 text-sky-800 hover:bg-sky-200 cursor-pointer"
                >
                  🔵 Analista Consulta (Sem Baixas/Ações)
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIndividualPermsDraft({
                      canViewFinancialModule: false,
                      canViewFinancialDashboard: false,
                      canViewReceivables: false,
                      canCreateReceivable: false,
                      canEditReceivable: false,
                      canReceivePayment: false,
                      canCancelReceivable: false,
                      canRefundReceivable: false,
                      canViewPayables: false,
                      canCreatePayable: false,
                      canEditPayable: false,
                      canPayBill: false,
                      canCancelPayable: false,
                      canRefundPayable: false,
                      canViewCashFlow: false,
                      canViewRealizedValues: false,
                      canViewProjectedValues: false,
                      canViewFinancialReports: false,
                      canExportFinancialReports: false,
                      canManageFinancialCategories: false,
                      canManageCostCenters: false,
                      canManageBankAccounts: false,
                      canManagePaymentMethods: false,
                      canManageRecurringTransactions: false,
                      canManageFinancialSettings: false,
                      canViewFinancialAudit: false,
                    });
                  }}
                  className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-slate-200 text-slate-700 hover:bg-slate-300 cursor-pointer"
                >
                  ⚪ Bloquear / Revogar Tudo
                </button>
              </div>
            </div>

            {/* Checkboxes Granulares Organizados por Grupo */}
            <div className="space-y-4 text-xs">
              {/* Grupo: Acesso Geral & Dashboard */}
              <div className="p-3.5 rounded-2xl border border-slate-200 space-y-2 bg-slate-50/50">
                <span className="font-black uppercase text-slate-900 tracking-wider text-[11px] block">
                  Acesso Geral & Dashboard
                </span>
                <label className="flex items-center gap-2.5 cursor-pointer font-bold text-slate-800">
                  <input
                    type="checkbox"
                    checked={Boolean(individualPermsDraft.canViewFinancialModule)}
                    onChange={(e) =>
                      setIndividualPermsDraft({
                        ...individualPermsDraft,
                        canViewFinancialModule: e.target.checked,
                      })
                    }
                    className="w-4 h-4 rounded text-slate-900"
                  />
                  <span>Visualizar Módulo Financeiro (Acesso ao Menu e Rota /financeiro)</span>
                </label>
                <label className="flex items-center gap-2.5 cursor-pointer text-slate-700 font-medium pl-6">
                  <input
                    type="checkbox"
                    checked={Boolean(individualPermsDraft.canViewFinancialDashboard)}
                    onChange={(e) =>
                      setIndividualPermsDraft({
                        ...individualPermsDraft,
                        canViewFinancialDashboard: e.target.checked,
                      })
                    }
                    className="w-4 h-4 rounded text-slate-900"
                  />
                  <span>Visualizar Dashboard Financeiro (Saldos e Indicadores)</span>
                </label>
              </div>

              {/* Grupo: Contas a Receber */}
              <div className="p-3.5 rounded-2xl border border-emerald-200/80 bg-emerald-50/30 space-y-2">
                <span className="font-black uppercase text-emerald-900 tracking-wider text-[11px] block">
                  Contas a Receber (Receitas)
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-800">
                    <input
                      type="checkbox"
                      checked={Boolean(individualPermsDraft.canViewReceivables)}
                      onChange={(e) =>
                        setIndividualPermsDraft({
                          ...individualPermsDraft,
                          canViewReceivables: e.target.checked,
                        })
                      }
                      className="w-4 h-4 rounded text-emerald-600"
                    />
                    <span>Visualizar Contas a Receber</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-slate-700">
                    <input
                      type="checkbox"
                      checked={Boolean(individualPermsDraft.canCreateReceivable)}
                      onChange={(e) =>
                        setIndividualPermsDraft({
                          ...individualPermsDraft,
                          canCreateReceivable: e.target.checked,
                        })
                      }
                      className="w-4 h-4 rounded text-emerald-600"
                    />
                    <span>Criar Conta a Receber</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-slate-700">
                    <input
                      type="checkbox"
                      checked={Boolean(individualPermsDraft.canEditReceivable)}
                      onChange={(e) =>
                        setIndividualPermsDraft({
                          ...individualPermsDraft,
                          canEditReceivable: e.target.checked,
                        })
                      }
                      className="w-4 h-4 rounded text-emerald-600"
                    />
                    <span>Editar Conta a Receber</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-emerald-700">
                    <input
                      type="checkbox"
                      checked={Boolean(individualPermsDraft.canReceivePayment)}
                      onChange={(e) =>
                        setIndividualPermsDraft({
                          ...individualPermsDraft,
                          canReceivePayment: e.target.checked,
                        })
                      }
                      className="w-4 h-4 rounded text-emerald-600"
                    />
                    <span>Baixar / Receber Conta</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-rose-700">
                    <input
                      type="checkbox"
                      checked={Boolean(individualPermsDraft.canCancelReceivable)}
                      onChange={(e) =>
                        setIndividualPermsDraft({
                          ...individualPermsDraft,
                          canCancelReceivable: e.target.checked,
                        })
                      }
                      className="w-4 h-4 rounded text-rose-600"
                    />
                    <span>Cancelar Conta a Receber</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-purple-700">
                    <input
                      type="checkbox"
                      checked={Boolean(individualPermsDraft.canRefundReceivable)}
                      onChange={(e) =>
                        setIndividualPermsDraft({
                          ...individualPermsDraft,
                          canRefundReceivable: e.target.checked,
                        })
                      }
                      className="w-4 h-4 rounded text-purple-600"
                    />
                    <span>Estornar Recebimento</span>
                  </label>
                </div>
              </div>

              {/* Grupo: Contas a Pagar */}
              <div className="p-3.5 rounded-2xl border border-rose-200/80 bg-rose-50/30 space-y-2">
                <span className="font-black uppercase text-rose-900 tracking-wider text-[11px] block">
                  Contas a Pagar (Despesas)
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-800">
                    <input
                      type="checkbox"
                      checked={Boolean(individualPermsDraft.canViewPayables)}
                      onChange={(e) =>
                        setIndividualPermsDraft({
                          ...individualPermsDraft,
                          canViewPayables: e.target.checked,
                        })
                      }
                      className="w-4 h-4 rounded text-rose-600"
                    />
                    <span>Visualizar Contas a Pagar</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-slate-700">
                    <input
                      type="checkbox"
                      checked={Boolean(individualPermsDraft.canCreatePayable)}
                      onChange={(e) =>
                        setIndividualPermsDraft({
                          ...individualPermsDraft,
                          canCreatePayable: e.target.checked,
                        })
                      }
                      className="w-4 h-4 rounded text-rose-600"
                    />
                    <span>Criar Conta a Pagar</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-slate-700">
                    <input
                      type="checkbox"
                      checked={Boolean(individualPermsDraft.canEditPayable)}
                      onChange={(e) =>
                        setIndividualPermsDraft({
                          ...individualPermsDraft,
                          canEditPayable: e.target.checked,
                        })
                      }
                      className="w-4 h-4 rounded text-rose-600"
                    />
                    <span>Editar Conta a Pagar</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-rose-700">
                    <input
                      type="checkbox"
                      checked={Boolean(individualPermsDraft.canPayBill)}
                      onChange={(e) =>
                        setIndividualPermsDraft({
                          ...individualPermsDraft,
                          canPayBill: e.target.checked,
                        })
                      }
                      className="w-4 h-4 rounded text-rose-600"
                    />
                    <span>Baixar / Pagar Conta</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-rose-700">
                    <input
                      type="checkbox"
                      checked={Boolean(individualPermsDraft.canCancelPayable)}
                      onChange={(e) =>
                        setIndividualPermsDraft({
                          ...individualPermsDraft,
                          canCancelPayable: e.target.checked,
                        })
                      }
                      className="w-4 h-4 rounded text-rose-600"
                    />
                    <span>Cancelar Conta a Pagar</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-purple-700">
                    <input
                      type="checkbox"
                      checked={Boolean(individualPermsDraft.canRefundPayable)}
                      onChange={(e) =>
                        setIndividualPermsDraft({
                          ...individualPermsDraft,
                          canRefundPayable: e.target.checked,
                        })
                      }
                      className="w-4 h-4 rounded text-purple-600"
                    />
                    <span>Estornar Pagamento</span>
                  </label>
                </div>
              </div>

              {/* Grupo: Fluxo & Relatórios */}
              <div className="p-3.5 rounded-2xl border border-slate-200 space-y-2 bg-slate-50/50">
                <span className="font-black uppercase text-slate-900 tracking-wider text-[11px] block">
                  Fluxo Financeiro & Relatórios
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-800">
                    <input
                      type="checkbox"
                      checked={Boolean(individualPermsDraft.canViewCashFlow)}
                      onChange={(e) =>
                        setIndividualPermsDraft({
                          ...individualPermsDraft,
                          canViewCashFlow: e.target.checked,
                        })
                      }
                      className="w-4 h-4 rounded text-slate-900"
                    />
                    <span>Visualizar Fluxo de Caixa</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-slate-700">
                    <input
                      type="checkbox"
                      checked={Boolean(individualPermsDraft.canViewRealizedValues)}
                      onChange={(e) =>
                        setIndividualPermsDraft({
                          ...individualPermsDraft,
                          canViewRealizedValues: e.target.checked,
                        })
                      }
                      className="w-4 h-4 rounded text-slate-900"
                    />
                    <span>Visualizar Valores Realizados</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-slate-700">
                    <input
                      type="checkbox"
                      checked={Boolean(individualPermsDraft.canViewProjectedValues)}
                      onChange={(e) =>
                        setIndividualPermsDraft({
                          ...individualPermsDraft,
                          canViewProjectedValues: e.target.checked,
                        })
                      }
                      className="w-4 h-4 rounded text-slate-900"
                    />
                    <span>Visualizar Valores Projetados</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-800">
                    <input
                      type="checkbox"
                      checked={Boolean(individualPermsDraft.canViewFinancialReports)}
                      onChange={(e) =>
                        setIndividualPermsDraft({
                          ...individualPermsDraft,
                          canViewFinancialReports: e.target.checked,
                        })
                      }
                      className="w-4 h-4 rounded text-slate-900"
                    />
                    <span>Visualizar Relatórios Financeiros</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-indigo-700 sm:col-span-2">
                    <input
                      type="checkbox"
                      checked={Boolean(individualPermsDraft.canExportFinancialReports)}
                      onChange={(e) =>
                        setIndividualPermsDraft({
                          ...individualPermsDraft,
                          canExportFinancialReports: e.target.checked,
                        })
                      }
                      className="w-4 h-4 rounded text-indigo-600"
                    />
                    <span>Exportar Relatórios Financeiros (PDF, Excel, CSV)</span>
                  </label>
                </div>
              </div>

              {/* Grupo: Cadastros, Configurações e Auditoria */}
              <div className="p-3.5 rounded-2xl border border-slate-200 space-y-2 bg-slate-50/50">
                <span className="font-black uppercase text-slate-900 tracking-wider text-[11px] block">
                  Cadastros, Configurações & Auditoria
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <label className="flex items-center gap-2 cursor-pointer text-slate-700">
                    <input
                      type="checkbox"
                      checked={Boolean(individualPermsDraft.canManageFinancialCategories)}
                      onChange={(e) =>
                        setIndividualPermsDraft({
                          ...individualPermsDraft,
                          canManageFinancialCategories: e.target.checked,
                        })
                      }
                      className="w-4 h-4 rounded text-slate-900"
                    />
                    <span>Gerenciar Categorias Financeiras</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-slate-700">
                    <input
                      type="checkbox"
                      checked={Boolean(individualPermsDraft.canManageCostCenters)}
                      onChange={(e) =>
                        setIndividualPermsDraft({
                          ...individualPermsDraft,
                          canManageCostCenters: e.target.checked,
                        })
                      }
                      className="w-4 h-4 rounded text-slate-900"
                    />
                    <span>Gerenciar Centros de Custo</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-slate-700">
                    <input
                      type="checkbox"
                      checked={Boolean(individualPermsDraft.canManageBankAccounts)}
                      onChange={(e) =>
                        setIndividualPermsDraft({
                          ...individualPermsDraft,
                          canManageBankAccounts: e.target.checked,
                        })
                      }
                      className="w-4 h-4 rounded text-slate-900"
                    />
                    <span>Gerenciar Contas Bancárias / Caixas</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-slate-700">
                    <input
                      type="checkbox"
                      checked={Boolean(individualPermsDraft.canManagePaymentMethods)}
                      onChange={(e) =>
                        setIndividualPermsDraft({
                          ...individualPermsDraft,
                          canManagePaymentMethods: e.target.checked,
                        })
                      }
                      className="w-4 h-4 rounded text-slate-900"
                    />
                    <span>Gerenciar Formas de Pagamento</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-slate-700">
                    <input
                      type="checkbox"
                      checked={Boolean(individualPermsDraft.canManageFinancialSettings)}
                      onChange={(e) =>
                        setIndividualPermsDraft({
                          ...individualPermsDraft,
                          canManageFinancialSettings: e.target.checked,
                        })
                      }
                      className="w-4 h-4 rounded text-slate-900"
                    />
                    <span>Gerenciar Configurações Financeiras</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-purple-700">
                    <input
                      type="checkbox"
                      checked={Boolean(individualPermsDraft.canViewFinancialAudit)}
                      onChange={(e) =>
                        setIndividualPermsDraft({
                          ...individualPermsDraft,
                          canViewFinancialAudit: e.target.checked,
                        })
                      }
                      className="w-4 h-4 rounded text-purple-600"
                    />
                    <span>Visualizar Auditoria Financeira</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSelectedUserForFinancial(null)}
                className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveIndividualFinancialPermissions}
                className="px-6 py-2.5 text-xs font-extrabold text-white bg-slate-900 hover:bg-[#E6007E] rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-2"
              >
                <Check className="w-4 h-4 text-[#FFDD00]" />
                <span>Salvar Permissões do Usuário</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE PERMISSÕES INDIVIDUAIS DE CUSTOS & PRECIFICAÇÃO (Prompt Seção 2) */}
      {selectedUserForCostPricing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-100 my-8 space-y-6">
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-100 text-blue-700 rounded-2xl">
                  <Calculator className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">
                    Permissões de Custos & Precificação
                  </h3>
                  <p className="text-xs text-slate-500">
                    Colaborador:{' '}
                    <strong className="text-slate-800">{selectedUserForCostPricing.name}</strong> • Cargo:{' '}
                    <span className="uppercase text-[11px] font-extrabold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                      {selectedUserForCostPricing.role}
                    </span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedUserForCostPricing(null)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Aviso informativo de auditoria */}
            <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200/80 flex items-start gap-2.5 text-xs text-amber-900">
              <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong>Acesso Restrito & Controle de Auditoria:</strong> Por padrão apenas o perfil
                Administrador possui acesso total. Qualquer alteração de permissão individual concedida
                aqui é registrada na trilha de auditoria com data, hora e responsável.
              </div>
            </div>

            {/* Atalhos Rápidos de Seleção */}
            <div className="flex items-center justify-between gap-2 p-3 bg-slate-50 rounded-2xl border border-slate-200">
              <span className="text-xs font-bold text-slate-600">Ações Rápidas:</span>
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    setCostPricingPermsDraft({
                      canViewCostPricingModule: true,
                      canViewCostsAndCompositions: true,
                      canManageCosts: true,
                      canManageMachines: true,
                      canConfigureDepreciation: true,
                      canConfigurePricingParameters: true,
                      canCreateEditCostQuotes: true,
                      canApprovePricesAndDiscounts: true,
                      canViewPricingReports: true,
                      canExportPricingReports: true,
                    });
                  }}
                  className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 cursor-pointer"
                >
                  🟢 Conceder Todos
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCostPricingPermsDraft({
                      canViewCostPricingModule: true,
                      canViewCostsAndCompositions: true,
                      canManageCosts: false,
                      canManageMachines: false,
                      canConfigureDepreciation: false,
                      canConfigurePricingParameters: false,
                      canCreateEditCostQuotes: true,
                      canApprovePricesAndDiscounts: false,
                      canViewPricingReports: true,
                      canExportPricingReports: true,
                    });
                  }}
                  className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-blue-100 text-blue-800 hover:bg-blue-200 cursor-pointer"
                >
                  🔵 Operador / Orçamentista
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCostPricingPermsDraft({
                      canViewCostPricingModule: false,
                      canViewCostsAndCompositions: false,
                      canManageCosts: false,
                      canManageMachines: false,
                      canConfigureDepreciation: false,
                      canConfigurePricingParameters: false,
                      canCreateEditCostQuotes: false,
                      canApprovePricesAndDiscounts: false,
                      canViewPricingReports: false,
                      canExportPricingReports: false,
                    });
                  }}
                  className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-slate-200 text-slate-700 hover:bg-slate-300 cursor-pointer"
                >
                  ⚪ Revogar Todos
                </button>
              </div>
            </div>

            {/* Checkboxes Granulares Organizados */}
            <div className="space-y-4 text-xs max-h-[50vh] overflow-y-auto pr-1">
              {/* Grupo: Acesso ao Módulo */}
              <div className="p-3.5 rounded-2xl border border-blue-200/80 bg-blue-50/30 space-y-2">
                <span className="font-black uppercase text-blue-900 tracking-wider text-[11px] block">
                  1. Acesso ao Módulo
                </span>
                <label className="flex items-center gap-2.5 cursor-pointer font-bold text-slate-800">
                  <input
                    type="checkbox"
                    checked={Boolean(costPricingPermsDraft.canViewCostPricingModule)}
                    onChange={(e) =>
                      setCostPricingPermsDraft({
                        ...costPricingPermsDraft,
                        canViewCostPricingModule: e.target.checked,
                      })
                    }
                    className="w-4 h-4 rounded text-blue-600"
                  />
                  <span>Visualizar o Módulo de Custos & Precificação (Aba no Painel Admin)</span>
                </label>
              </div>

              {/* Grupo: Gestão de Custos & Máquinas */}
              <div className="p-3.5 rounded-2xl border border-slate-200 space-y-2 bg-slate-50/50">
                <span className="font-black uppercase text-slate-900 tracking-wider text-[11px] block">
                  2. Custos, Insumos & Equipamentos
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-800">
                    <input
                      type="checkbox"
                      checked={Boolean(costPricingPermsDraft.canViewCostsAndCompositions)}
                      onChange={(e) =>
                        setCostPricingPermsDraft({
                          ...costPricingPermsDraft,
                          canViewCostsAndCompositions: e.target.checked,
                        })
                      }
                      className="w-4 h-4 rounded text-slate-900"
                    />
                    <span>Consultar custos e composições</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-slate-700">
                    <input
                      type="checkbox"
                      checked={Boolean(costPricingPermsDraft.canManageCosts)}
                      onChange={(e) =>
                        setCostPricingPermsDraft({
                          ...costPricingPermsDraft,
                          canManageCosts: e.target.checked,
                        })
                      }
                      className="w-4 h-4 rounded text-slate-900"
                    />
                    <span>Cadastrar e editar custos (Insumos, Mão de Obra, Fixos)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-slate-700">
                    <input
                      type="checkbox"
                      checked={Boolean(costPricingPermsDraft.canManageMachines)}
                      onChange={(e) =>
                        setCostPricingPermsDraft({
                          ...costPricingPermsDraft,
                          canManageMachines: e.target.checked,
                        })
                      }
                      className="w-4 h-4 rounded text-slate-900"
                    />
                    <span>Cadastrar máquinas e equipamentos</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-slate-700">
                    <input
                      type="checkbox"
                      checked={Boolean(costPricingPermsDraft.canConfigureDepreciation)}
                      onChange={(e) =>
                        setCostPricingPermsDraft({
                          ...costPricingPermsDraft,
                          canConfigureDepreciation: e.target.checked,
                        })
                      }
                      className="w-4 h-4 rounded text-slate-900"
                    />
                    <span>Configurar depreciação e custo operacional</span>
                  </label>
                </div>
              </div>

              {/* Grupo: Precificação & Parâmetros */}
              <div className="p-3.5 rounded-2xl border border-slate-200 space-y-2 bg-slate-50/50">
                <span className="font-black uppercase text-slate-900 tracking-wider text-[11px] block">
                  3. Parâmetros de Precificação & Orçamentos
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <label className="flex items-center gap-2 cursor-pointer text-slate-700">
                    <input
                      type="checkbox"
                      checked={Boolean(costPricingPermsDraft.canConfigurePricingParameters)}
                      onChange={(e) =>
                        setCostPricingPermsDraft({
                          ...costPricingPermsDraft,
                          canConfigurePricingParameters: e.target.checked,
                        })
                      }
                      className="w-4 h-4 rounded text-slate-900"
                    />
                    <span>Alterar impostos, taxas, margens e parâmetros</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-800">
                    <input
                      type="checkbox"
                      checked={Boolean(costPricingPermsDraft.canCreateEditCostQuotes)}
                      onChange={(e) =>
                        setCostPricingPermsDraft({
                          ...costPricingPermsDraft,
                          canCreateEditCostQuotes: e.target.checked,
                        })
                      }
                      className="w-4 h-4 rounded text-slate-900"
                    />
                    <span>Criar e editar orçamentos personalizados</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-amber-700">
                    <input
                      type="checkbox"
                      checked={Boolean(costPricingPermsDraft.canApprovePricesAndDiscounts)}
                      onChange={(e) =>
                        setCostPricingPermsDraft({
                          ...costPricingPermsDraft,
                          canApprovePricesAndDiscounts: e.target.checked,
                        })
                      }
                      className="w-4 h-4 rounded text-amber-600"
                    />
                    <span>Aprovar preços e descontos especiais</span>
                  </label>
                </div>
              </div>

              {/* Grupo: Relatórios */}
              <div className="p-3.5 rounded-2xl border border-slate-200 space-y-2 bg-slate-50/50">
                <span className="font-black uppercase text-slate-900 tracking-wider text-[11px] block">
                  4. Relatórios & Exportação
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <label className="flex items-center gap-2 cursor-pointer text-slate-700">
                    <input
                      type="checkbox"
                      checked={Boolean(costPricingPermsDraft.canViewPricingReports)}
                      onChange={(e) =>
                        setCostPricingPermsDraft({
                          ...costPricingPermsDraft,
                          canViewPricingReports: e.target.checked,
                        })
                      }
                      className="w-4 h-4 rounded text-slate-900"
                    />
                    <span>Visualizar relatórios gerenciais e ponto de equilíbrio</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-slate-700">
                    <input
                      type="checkbox"
                      checked={Boolean(costPricingPermsDraft.canExportPricingReports)}
                      onChange={(e) =>
                        setCostPricingPermsDraft({
                          ...costPricingPermsDraft,
                          canExportPricingReports: e.target.checked,
                        })
                      }
                      className="w-4 h-4 rounded text-slate-900"
                    />
                    <span>Exportar ou imprimir relatórios e propostas</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSelectedUserForCostPricing(null)}
                className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveIndividualCostPricingPermissions}
                className="px-6 py-2.5 text-xs font-extrabold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-2"
              >
                <Check className="w-4 h-4 text-white" />
                <span>Salvar Permissões de Custos</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
