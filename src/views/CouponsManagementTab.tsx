import React, { useState, useEffect, useMemo } from 'react';
import {
  DiscountCoupon,
  CouponUsageEntry,
  CouponSendHistoryEntry,
  CouponAuditLog,
  UserProfile,
  Category,
  Product,
} from '../types';
import { StorageService } from '../services/storage';
import {
  Ticket,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Send,
  Copy,
  Check,
  ExternalLink,
  MessageCircle,
  Mail,
  Edit2,
  Trash2,
  Play,
  Pause,
  Ban,
  TrendingUp,
  DollarSign,
  Users,
  ShoppingBag,
  ShieldAlert,
  Calendar,
  Sparkles,
  Tag,
  RefreshCw,
  Eye,
  X,
  FileSpreadsheet,
  CheckSquare,
  AlertCircle,
} from 'lucide-react';

interface CouponsManagementTabProps {
  currentUser: UserProfile;
}

export const CouponsManagementTab: React.FC<CouponsManagementTabProps> = ({ currentUser }) => {
  // Tabs: 'coupons' | 'usages' | 'sends' | 'reports' | 'audit' | 'test_runner'
  const [activeTab, setActiveTab] = useState<
    'coupons' | 'usages' | 'sends' | 'reports' | 'audit' | 'test_runner'
  >('coupons');

  // Permissões
  const perms = currentUser.permissions || {};
  const isAdminOrGerente = currentUser.role === 'admin' || currentUser.role === 'gerente';
  const canView = isAdminOrGerente || perms.canViewCoupons;
  const canCreate = isAdminOrGerente || perms.canCreateCoupons;
  const canEdit = isAdminOrGerente || perms.canEditCoupons;
  const canToggle = isAdminOrGerente || perms.canToggleCoupons;
  const canCancel = isAdminOrGerente || perms.canCancelCoupons;
  const canViewUsage = isAdminOrGerente || perms.canViewCouponUsageHistory;
  const canViewReports = isAdminOrGerente || perms.canViewCouponReports;
  const canSend = isAdminOrGerente || perms.canSendCouponsToCustomers;

  // Estados principais
  const [coupons, setCoupons] = useState<DiscountCoupon[]>(() => StorageService.getCoupons());
  const [usages, setUsages] = useState<CouponUsageEntry[]>(() => StorageService.getCouponUsages());
  const [sendHistory, setSendHistory] = useState<CouponSendHistoryEntry[]>(() =>
    StorageService.getCouponSendHistory()
  );
  const [auditLogs, setAuditLogs] = useState<CouponAuditLog[]>(() => StorageService.getCouponAuditLogs());
  const [metrics, setMetrics] = useState(() => StorageService.getCouponMetrics());

  // Dados auxiliares para filtros e alvos
  const [categories] = useState<Category[]>(() => StorageService.getCategories());
  const [products] = useState<Product[]>(() => StorageService.getProducts());
  const [users] = useState<UserProfile[]>(() => StorageService.getUsers());

  // Filtros de listagem de cupons
  const [filterSearch, setFilterSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');

  // Feedback Toast / Banner
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastMessage({ type, text });
    setTimeout(() => setToastMessage(null), 4500);
  };

  // Recarregar dados locais e disparar sincronização
  const refreshAllData = () => {
    setCoupons(StorageService.getCoupons());
    setUsages(StorageService.getCouponUsages());
    setSendHistory(StorageService.getCouponSendHistory());
    setAuditLogs(StorageService.getCouponAuditLogs());
    setMetrics(StorageService.getCouponMetrics());
  };

  useEffect(() => {
    const handleStorage = () => refreshAllData();
    window.addEventListener('mb_storage_updated', handleStorage);
    return () => window.removeEventListener('mb_storage_updated', handleStorage);
  }, []);

  // Modal de Criação / Edição
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<DiscountCoupon | null>(null);
  const [formData, setFormData] = useState({
    code: '',
    campaignName: '',
    discountType: 'percentage' as 'percentage' | 'fixed',
    discountValue: 10,
    startDate: '',
    endDate: '',
    minPurchaseAmount: '',
    maxDiscountAmount: '',
    maxUsageTotal: '',
    maxUsagePerCustomer: '1',
    targetType: 'all_store' as 'all_store' | 'categories' | 'products',
    targetCategoryIds: [] as string[],
    targetProductIds: [] as string[],
    customerRestriction: 'general' as 'general' | 'specific_customers',
    specificCustomerEmails: '',
    canCombineWithPromotions: true,
    status: 'active' as DiscountCoupon['status'],
    internalNotes: '',
  });

  // Modal de Envio ao Cliente
  const [isSendModalOpen, setIsSendModalOpen] = useState(false);
  const [selectedCouponToSend, setSelectedCouponToSend] = useState<DiscountCoupon | null>(null);
  const [sendForm, setSendForm] = useState({
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    channel: 'whatsapp' as 'whatsapp' | 'email' | 'clipboard',
    customMessage: '',
  });
  const [copiedSuccess, setCopiedSuccess] = useState(false);

  // Modal / Bateria de Testes
  const [testResults, setTestResults] = useState<any[]>([]);
  const [isRunningTests, setIsRunningTests] = useState(false);
  const [testSummary, setTestSummary] = useState<{ total: number; passed: number; failed: number } | null>(null);

  // Gerador automático de código amigável
  const generateRandomCode = () => {
    const prefix = 'MB';
    const randomChars = Math.random().toString(36).substring(2, 6).toUpperCase();
    const valueStr = formData.discountValue ? `${Math.round(formData.discountValue)}` : '10';
    setFormData((prev) => ({
      ...prev,
      code: `${prefix}-${randomChars}${valueStr}`,
    }));
  };

  // Abrir Modal de Criação
  const handleOpenCreateModal = () => {
    setEditingCoupon(null);
    const now = new Date();
    const in30Days = new Date(Date.now() + 30 * 24 * 3600 * 1000);
    setFormData({
      code: '',
      campaignName: '',
      discountType: 'percentage',
      discountValue: 10,
      startDate: now.toISOString().substring(0, 16),
      endDate: in30Days.toISOString().substring(0, 16),
      minPurchaseAmount: '',
      maxDiscountAmount: '',
      maxUsageTotal: '',
      maxUsagePerCustomer: '1',
      targetType: 'all_store',
      targetCategoryIds: [],
      targetProductIds: [],
      customerRestriction: 'general',
      specificCustomerEmails: '',
      canCombineWithPromotions: true,
      status: 'active',
      internalNotes: '',
    });
    setIsModalOpen(true);
  };

  // Abrir Modal de Edição
  const handleOpenEditModal = (coupon: DiscountCoupon) => {
    setEditingCoupon(coupon);
    setFormData({
      code: coupon.code,
      campaignName: coupon.campaignName,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      startDate: coupon.startDate ? coupon.startDate.substring(0, 16) : '',
      endDate: coupon.endDate ? coupon.endDate.substring(0, 16) : '',
      minPurchaseAmount: coupon.minPurchaseAmount ? String(coupon.minPurchaseAmount) : '',
      maxDiscountAmount: coupon.maxDiscountAmount ? String(coupon.maxDiscountAmount) : '',
      maxUsageTotal: coupon.maxUsageTotal ? String(coupon.maxUsageTotal) : '',
      maxUsagePerCustomer: coupon.maxUsagePerCustomer ? String(coupon.maxUsagePerCustomer) : '1',
      targetType: coupon.targetType,
      targetCategoryIds: coupon.targetCategoryIds || [],
      targetProductIds: coupon.targetProductIds || [],
      customerRestriction: coupon.customerRestriction,
      specificCustomerEmails: (coupon.specificCustomerEmails || []).join(', '),
      canCombineWithPromotions: coupon.canCombineWithPromotions,
      status: coupon.status,
      internalNotes: coupon.internalNotes || '',
    });
    setIsModalOpen(true);
  };

  // Salvar Cupom
  const handleSaveCoupon = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.code.trim()) {
      showToast('O código do cupom é obrigatório.', 'error');
      return;
    }
    if (!formData.campaignName.trim()) {
      showToast('O nome da campanha é obrigatório.', 'error');
      return;
    }
    if (formData.discountValue <= 0) {
      showToast('O valor do desconto deve ser maior que zero.', 'error');
      return;
    }

    const emailsArray = formData.specificCustomerEmails
      ? formData.specificCustomerEmails
          .split(',')
          .map((e) => e.trim().toLowerCase())
          .filter((e) => e.length > 0)
      : [];

    const payload: any = {
      id: editingCoupon?.id,
      code: formData.code.trim().toUpperCase(),
      campaignName: formData.campaignName.trim(),
      discountType: formData.discountType,
      discountValue: Number(formData.discountValue),
      startDate: formData.startDate || new Date().toISOString(),
      endDate: formData.endDate || new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
      minPurchaseAmount: formData.minPurchaseAmount ? Number(formData.minPurchaseAmount) : undefined,
      maxDiscountAmount: formData.maxDiscountAmount ? Number(formData.maxDiscountAmount) : undefined,
      maxUsageTotal: formData.maxUsageTotal ? Number(formData.maxUsageTotal) : undefined,
      maxUsagePerCustomer: formData.maxUsagePerCustomer ? Number(formData.maxUsagePerCustomer) : 1,
      targetType: formData.targetType,
      targetCategoryIds: formData.targetCategoryIds,
      targetProductIds: formData.targetProductIds,
      customerRestriction: formData.customerRestriction,
      specificCustomerEmails: emailsArray,
      canCombineWithPromotions: formData.canCombineWithPromotions,
      status: formData.status,
      internalNotes: formData.internalNotes.trim(),
    };

    const actor = {
      id: currentUser.id,
      name: currentUser.name,
      role: currentUser.role,
    };

    const res = StorageService.saveCoupon(payload, actor);
    if (!res.success) {
      showToast(res.error || 'Erro ao salvar cupom.', 'error');
      return;
    }

    showToast(
      editingCoupon
        ? `Cupom "${res.coupon?.code}" atualizado com sucesso!`
        : `Cupom "${res.coupon?.code}" criado com sucesso!`,
      'success'
    );
    setIsModalOpen(false);
    refreshAllData();
  };

  // Alterar Status (Ativar / Pausar / Cancelar)
  const handleToggleStatus = (coupon: DiscountCoupon, newStatus: 'active' | 'paused' | 'cancelled') => {
    const actor = {
      id: currentUser.id,
      name: currentUser.name,
      role: currentUser.role,
    };
    const res = StorageService.toggleCouponStatus(coupon.id, newStatus, actor);
    if (!res.success) {
      showToast(res.error || 'Erro ao alterar status.', 'error');
      return;
    }
    const statusLabels: Record<string, string> = {
      active: 'ativado',
      paused: 'pausado',
      cancelled: 'cancelado',
    };
    showToast(`Cupom "${coupon.code}" ${statusLabels[newStatus]} com sucesso!`, 'info');
    refreshAllData();
  };

  // Excluir Cupom
  const handleDeleteCoupon = (coupon: DiscountCoupon) => {
    const actor = {
      id: currentUser.id,
      name: currentUser.name,
      role: currentUser.role,
    };
    const res = StorageService.deleteCoupon(coupon.id, actor);
    if (!res.success) {
      showToast(res.error || 'Erro ao excluir cupom.', 'error');
      return;
    }
    showToast(`Cupom "${coupon.code}" removido/cancelado com sucesso.`, 'info');
    refreshAllData();
  };

  // Abrir Modal de Envio
  const handleOpenSendModal = (coupon: DiscountCoupon) => {
    setSelectedCouponToSend(coupon);
    const discountFormatted =
      coupon.discountType === 'percentage'
        ? `${coupon.discountValue}% OFF`
        : `R$ ${coupon.discountValue.toFixed(2).replace('.', ',')} de desconto`;
    const endDateFormatted = coupon.endDate
      ? new Date(coupon.endDate).toLocaleDateString('pt-BR')
      : 'tempo indeterminado';

    const defaultMsg =
      `Olá, [Nome do Cliente]! Temos um desconto especial para você na MB PERSONALIZA.\n\n` +
      `Utilize o cupom *${coupon.code}* e ganhe ${discountFormatted} em sua compra.\n\n` +
      `Validade: ${endDateFormatted}.\n\n` +
      `Acesse nossa loja, escolha seus produtos e informe o cupom no momento da compra.\n\n` +
      `Aproveite essa oferta especial!`;

    setSendForm({
      customerName: '',
      customerPhone: '',
      customerEmail: '',
      channel: 'whatsapp',
      customMessage: defaultMsg,
    });
    setCopiedSuccess(false);
    setIsSendModalOpen(true);
  };

  // Preencher mensagem com o nome real
  const preparedMessage = useMemo(() => {
    const name = sendForm.customerName.trim() || '[Nome do Cliente]';
    return sendForm.customMessage.replace(/\[Nome do Cliente\]/g, name);
  }, [sendForm.customerName, sendForm.customMessage]);

  // Copiar código do cupom
  const handleCopyCodeOnly = () => {
    if (!selectedCouponToSend) return;
    navigator.clipboard.writeText(selectedCouponToSend.code);
    setCopiedSuccess(true);
    setTimeout(() => setCopiedSuccess(false), 2000);
    showToast(`Código ${selectedCouponToSend.code} copiado para a área de transferência!`, 'success');
  };

  // Copiar mensagem completa do WhatsApp
  const handleCopyMessage = () => {
    navigator.clipboard.writeText(preparedMessage);
    setCopiedSuccess(true);
    setTimeout(() => setCopiedSuccess(false), 2500);

    // Registrar no histórico de envios
    if (selectedCouponToSend) {
      StorageService.recordCouponSend({
        id: `csend-${Date.now()}`,
        couponId: selectedCouponToSend.id,
        couponCode: selectedCouponToSend.code,
        customerName: sendForm.customerName || 'Cliente (Cópia Manual)',
        customerPhone: sendForm.customerPhone || undefined,
        customerEmail: sendForm.customerEmail || undefined,
        channel: 'clipboard',
        sentAt: new Date().toISOString(),
        sentByUserId: currentUser.id,
        sentByUserName: currentUser.name,
        messagePreview: preparedMessage,
        status: 'copied',
      });
      refreshAllData();
    }
    showToast('Mensagem promocional copiada com sucesso!', 'success');
  };

  // Enviar via WhatsApp Web
  const handleSendWhatsAppWeb = () => {
    if (!selectedCouponToSend) return;
    if (!sendForm.customerName.trim()) {
      showToast('Por favor, informe o nome do cliente destinatário.', 'error');
      return;
    }
    if (!sendForm.customerPhone.trim()) {
      showToast('Informe o número de WhatsApp com DDD para abrir o chat.', 'error');
      return;
    }

    const cleanPhone = sendForm.customerPhone.replace(/\D/g, '');
    const fullPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
    const url = `https://api.whatsapp.com/send?phone=${fullPhone}&text=${encodeURIComponent(preparedMessage)}`;

    StorageService.recordCouponSend({
      id: `csend-${Date.now()}`,
      couponId: selectedCouponToSend.id,
      couponCode: selectedCouponToSend.code,
      customerName: sendForm.customerName.trim(),
      customerPhone: sendForm.customerPhone.trim(),
      customerEmail: sendForm.customerEmail.trim() || undefined,
      channel: 'whatsapp',
      sentAt: new Date().toISOString(),
      sentByUserId: currentUser.id,
      sentByUserName: currentUser.name,
      messagePreview: preparedMessage,
      status: 'shared_whatsapp',
    });

    window.open(url, '_blank');
    setIsSendModalOpen(false);
    refreshAllData();
    showToast(`WhatsApp aberto para ${sendForm.customerName}! Envio registrado no histórico.`, 'success');
  };

  // Simular Envio por E-mail Corporativo
  const handleSendCorporateEmail = () => {
    if (!selectedCouponToSend) return;
    if (!sendForm.customerName.trim()) {
      showToast('Por favor, informe o nome do cliente destinatário.', 'error');
      return;
    }
    if (!sendForm.customerEmail.trim() || !sendForm.customerEmail.includes('@')) {
      showToast('Por favor, informe um endereço de e-mail válido.', 'error');
      return;
    }

    StorageService.recordCouponSend({
      id: `csend-${Date.now()}`,
      couponId: selectedCouponToSend.id,
      couponCode: selectedCouponToSend.code,
      customerName: sendForm.customerName.trim(),
      customerPhone: sendForm.customerPhone.trim() || undefined,
      customerEmail: sendForm.customerEmail.trim(),
      channel: 'email',
      sentAt: new Date().toISOString(),
      sentByUserId: currentUser.id,
      sentByUserName: currentUser.name,
      messagePreview: preparedMessage,
      status: 'sent_email',
    });

    setIsSendModalOpen(false);
    refreshAllData();
    showToast(`E-mail com o cupom ${selectedCouponToSend.code} despachado com sucesso para ${sendForm.customerEmail}!`, 'success');
  };

  // Executar a Bateria Completa de 16 Testes
  const handleRunTestScenarios = async () => {
    setIsRunningTests(true);
    try {
      const res = await fetch('/api/coupons/run-test-scenarios', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser.id,
          'x-user-name': currentUser.name,
          'x-user-role': currentUser.role,
        },
      });

      if (res.ok) {
        const data = await res.json();
        setTestResults(data.results || []);
        setTestSummary({
          total: data.totalTests,
          passed: data.passedCount,
          failed: data.failedCount,
        });
        showToast(
          data.allPassed
            ? `Todos os ${data.totalTests} testes de regras de negócio passaram com sucesso!`
            : `Testes finalizados: ${data.passedCount} aprovados, ${data.failedCount} com falhas.`,
          data.allPassed ? 'success' : 'error'
        );
      } else {
        showToast('Não foi possível executar os testes no servidor.', 'error');
      }
    } catch {
      showToast('Erro ao se conectar ao endpoint de testes.', 'error');
    } finally {
      setIsRunningTests(false);
    }
  };

  // Lista filtrada de cupons
  const filteredCoupons = useMemo(() => {
    return coupons.filter((c) => {
      if (filterStatus !== 'all' && c.status !== filterStatus) return false;
      if (filterType !== 'all' && c.discountType !== filterType) return false;
      if (filterSearch.trim()) {
        const term = filterSearch.toLowerCase().trim();
        const matchCode = c.code.toLowerCase().includes(term);
        const matchName = c.campaignName.toLowerCase().includes(term);
        const matchNotes = c.internalNotes?.toLowerCase().includes(term);
        if (!matchCode && !matchName && !matchNotes) return false;
      }
      return true;
    });
  }, [coupons, filterStatus, filterType, filterSearch]);

  if (!canView) {
    return (
      <div className="p-8 text-center bg-white rounded-2xl border border-slate-200">
        <ShieldAlert className="w-12 h-12 text-rose-500 mx-auto mb-3" />
        <h3 className="text-base font-bold text-slate-800">Acesso Restrito ao Módulo de Cupons</h3>
        <p className="text-xs text-slate-500 mt-1">
          Seu perfil de usuário não possui permissão para visualizar o gerenciamento de cupons. Contate o administrador.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Toast Alert */}
      {toastMessage && (
        <div
          className={`fixed bottom-6 right-6 z-50 p-4 rounded-xl shadow-2xl flex items-center gap-3 border text-xs font-semibold animate-in slide-in-from-bottom duration-200 ${
            toastMessage.type === 'success'
              ? 'bg-emerald-900 text-emerald-100 border-emerald-700'
              : toastMessage.type === 'error'
              ? 'bg-rose-900 text-rose-100 border-rose-700'
              : 'bg-slate-900 text-white border-slate-700'
          }`}
        >
          {toastMessage.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
          {toastMessage.type === 'error' && <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />}
          {toastMessage.type === 'info' && <Tag className="w-4 h-4 text-indigo-400 shrink-0" />}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Header & Main Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#E6007E] text-white flex items-center justify-center shadow-xs">
              <Ticket className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 font-heading">Cupons de Desconto & Promoções</h2>
              <p className="text-xs text-slate-500">
                Criação, regras de elegibilidade, disparo pelo WhatsApp e rastreamento de conversão
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {canCreate && (
            <button
              onClick={handleOpenCreateModal}
              className="px-4 py-2.5 bg-slate-900 hover:bg-[#E6007E] text-white text-xs font-bold rounded-xl flex items-center gap-2 shadow-sm transition-all cursor-pointer"
              id="btn-create-coupon"
            >
              <Plus className="w-4 h-4" />
              <span>Criar Novo Cupom</span>
            </button>
          )}

          <button
            onClick={refreshAllData}
            className="p-2.5 bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-xl transition-colors cursor-pointer"
            title="Atualizar dados"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Cupons Ativos</div>
          <div className="text-xl font-black text-slate-900 mt-1 font-heading">
            {metrics.activeCoupons} <span className="text-xs text-slate-400 font-normal">/ {metrics.totalCoupons}</span>
          </div>
          <div className="text-[10px] text-emerald-600 font-semibold mt-1">Disponíveis na loja</div>
        </div>

        <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Utilizações</div>
          <div className="text-xl font-black text-slate-900 mt-1 font-heading">
            {metrics.totalUsageCount}
          </div>
          <div className="text-[10px] text-blue-600 font-semibold mt-1">Pedidos confirmados</div>
        </div>

        <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Descontos Concedidos</div>
          <div className="text-xl font-black text-[#E6007E] mt-1 font-heading">
            R$ {metrics.totalDiscountGranted.toFixed(2)}
          </div>
          <div className="text-[10px] text-slate-500 mt-1">Benefício aos clientes</div>
        </div>

        <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Vendas Geradas</div>
          <div className="text-xl font-black text-emerald-700 mt-1 font-heading">
            R$ {metrics.totalSalesVolume.toFixed(2)}
          </div>
          <div className="text-[10px] text-emerald-600 font-semibold mt-1">Faturamento bruto</div>
        </div>

        <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Envios a Clientes</div>
          <div className="text-xl font-black text-slate-900 mt-1 font-heading">
            {metrics.totalSent}
          </div>
          <div className="text-[10px] text-purple-600 font-semibold mt-1">WhatsApp & E-mail</div>
        </div>

        <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Taxa de Conversão</div>
          <div className="text-xl font-black text-indigo-700 mt-1 font-heading">
            {metrics.conversionRatePercent}%
          </div>
          <div className="text-[10px] text-indigo-600 font-semibold mt-1">Utilizações / Disparos</div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-slate-200 overflow-x-auto gap-2">
        <button
          onClick={() => setActiveTab('coupons')}
          className={`pb-3 px-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
            activeTab === 'coupons'
              ? 'border-[#E6007E] text-[#E6007E]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Ticket className="w-3.5 h-3.5" />
          <span>Cupons Cadastrados ({coupons.length})</span>
        </button>

        {canViewUsage && (
          <button
            onClick={() => setActiveTab('usages')}
            className={`pb-3 px-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'usages'
                ? 'border-[#E6007E] text-[#E6007E]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>Histórico de Utilização ({usages.length})</span>
          </button>
        )}

        <button
          onClick={() => setActiveTab('sends')}
          className={`pb-3 px-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
            activeTab === 'sends'
              ? 'border-[#E6007E] text-[#E6007E]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Send className="w-3.5 h-3.5" />
          <span>Histórico de Envios ({sendHistory.length})</span>
        </button>

        {canViewReports && (
          <button
            onClick={() => setActiveTab('reports')}
            className={`pb-3 px-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'reports'
                ? 'border-[#E6007E] text-[#E6007E]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Relatórios & Performance</span>
          </button>
        )}

        <button
          onClick={() => setActiveTab('audit')}
          className={`pb-3 px-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
            activeTab === 'audit'
              ? 'border-[#E6007E] text-[#E6007E]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <ShieldAlert className="w-3.5 h-3.5" />
          <span>Auditoria & Segurança ({auditLogs.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('test_runner')}
          className={`pb-3 px-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
            activeTab === 'test_runner'
              ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50 rounded-t-lg'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <CheckSquare className="w-3.5 h-3.5 text-indigo-600" />
          <span>Bateria de Testes (16 Cenários)</span>
        </button>
      </div>

      {/* ========================================================= */}
      {/* ABA 1: CUPONS CADASTRADOS */}
      {/* ========================================================= */}
      {activeTab === 'coupons' && (
        <div className="space-y-4">
          {/* Barra de Filtros */}
          <div className="p-3 bg-white rounded-xl border border-slate-200 flex flex-col sm:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Buscar por código, campanha ou observação..."
                value={filterSearch}
                onChange={(e) => setFilterSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-slate-800"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none"
              >
                <option value="all">Todos os Status</option>
                <option value="active">Ativos</option>
                <option value="paused">Pausados</option>
                <option value="draft">Rascunhos</option>
                <option value="expired">Expirados</option>
                <option value="cancelled">Cancelados</option>
              </select>

              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none"
              >
                <option value="all">Todos os Tipos</option>
                <option value="percentage">Percentual (%)</option>
                <option value="fixed">Valor Fixo (R$)</option>
              </select>
            </div>
          </div>

          {/* Tabela de Cupons */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3 px-4">Código / Campanha</th>
                    <th className="py-3 px-4">Desconto</th>
                    <th className="py-3 px-4">Validade</th>
                    <th className="py-3 px-4">Regras & Alvo</th>
                    <th className="py-3 px-4">Usos / Cota</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredCoupons.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        Nenhum cupom encontrado com os filtros selecionados.
                      </td>
                    </tr>
                  ) : (
                    filteredCoupons.map((coupon) => {
                      const isExpired =
                        coupon.endDate && new Date(coupon.endDate).getTime() < Date.now();

                      return (
                        <tr key={coupon.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 text-xs">
                                {coupon.code}
                              </span>
                              {coupon.customerRestriction === 'specific_customers' && (
                                <span className="text-[10px] bg-purple-100 text-purple-800 px-1.5 py-0.5 rounded font-semibold">
                                  Exclusivo
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-600 mt-0.5 font-medium">
                              {coupon.campaignName}
                            </div>
                          </td>

                          <td className="py-3 px-4">
                            <div className="font-bold text-slate-900">
                              {coupon.discountType === 'percentage'
                                ? `${coupon.discountValue}% OFF`
                                : `R$ ${coupon.discountValue.toFixed(2)}`}
                            </div>
                            {coupon.maxDiscountAmount && coupon.discountType === 'percentage' && (
                              <div className="text-[10px] text-slate-400">
                                Teto: R$ {coupon.maxDiscountAmount.toFixed(2)}
                              </div>
                            )}
                          </td>

                          <td className="py-3 px-4">
                            <div className="text-[11px] text-slate-700">
                              Até {new Date(coupon.endDate).toLocaleDateString('pt-BR')}
                            </div>
                            {isExpired && (
                              <span className="text-[9px] text-rose-600 font-bold uppercase">
                                Expirado
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-4">
                            <div className="text-[11px] text-slate-700">
                              {coupon.minPurchaseAmount
                                ? `Mín: R$ ${coupon.minPurchaseAmount.toFixed(2)}`
                                : 'Sem valor mín.'}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              {coupon.targetType === 'all_store'
                                ? 'Toda a loja'
                                : coupon.targetType === 'categories'
                                ? `${coupon.targetCategoryIds?.length || 0} categorias`
                                : `${coupon.targetProductIds?.length || 0} produtos`}
                              {!coupon.canCombineWithPromotions && ' • Não acumula'}
                            </div>
                          </td>

                          <td className="py-3 px-4">
                            <div className="font-bold text-slate-800">
                              {coupon.currentUsageCount}
                              <span className="font-normal text-slate-400">
                                {coupon.maxUsageTotal ? ` / ${coupon.maxUsageTotal}` : ' (Ilimitado)'}
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-400">
                              {coupon.maxUsagePerCustomer || 1} por cliente
                            </div>
                          </td>

                          <td className="py-3 px-4">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                coupon.status === 'active'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : coupon.status === 'paused'
                                  ? 'bg-amber-100 text-amber-800'
                                  : coupon.status === 'cancelled'
                                  ? 'bg-rose-100 text-rose-800'
                                  : coupon.status === 'draft'
                                  ? 'bg-slate-100 text-slate-800'
                                  : 'bg-zinc-100 text-zinc-800'
                              }`}
                            >
                              {coupon.status === 'active'
                                ? 'Ativo'
                                : coupon.status === 'paused'
                                ? 'Pausado'
                                : coupon.status === 'cancelled'
                                ? 'Cancelado'
                                : coupon.status === 'draft'
                                ? 'Rascunho'
                                : 'Expirado'}
                            </span>
                          </td>

                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              {canSend && coupon.status === 'active' && (
                                <button
                                  onClick={() => handleOpenSendModal(coupon)}
                                  className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                                  title="Enviar para cliente (WhatsApp / E-mail)"
                                >
                                  <Send className="w-3.5 h-3.5" />
                                </button>
                              )}

                              {canToggle && (
                                <>
                                  {coupon.status === 'active' ? (
                                    <button
                                      onClick={() => handleToggleStatus(coupon, 'paused')}
                                      className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                                      title="Pausar cupom temporariamente"
                                    >
                                      <Pause className="w-3.5 h-3.5" />
                                    </button>
                                  ) : coupon.status === 'paused' || coupon.status === 'draft' ? (
                                    <button
                                      onClick={() => handleToggleStatus(coupon, 'active')}
                                      className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                                      title="Ativar cupom"
                                    >
                                      <Play className="w-3.5 h-3.5" />
                                    </button>
                                  ) : null}
                                </>
                              )}

                              {canEdit && (
                                <button
                                  onClick={() => handleOpenEditModal(coupon)}
                                  className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                                  title="Editar cupom"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                              )}

                              {canCancel && coupon.status !== 'cancelled' && (
                                <button
                                  onClick={() => handleDeleteCoupon(coupon)}
                                  className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                  title="Cancelar ou excluir cupom"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
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
        </div>
      )}

      {/* ========================================================= */}
      {/* ABA 2: HISTÓRICO DE UTILIZAÇÃO */}
      {/* ========================================================= */}
      {activeTab === 'usages' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Registros de Utilização em Pedidos</h3>
              <p className="text-xs text-slate-500">
                Auditoria de pedidos com cupons aplicados, descontos calculados e totais
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">Data / Hora</th>
                  <th className="py-3 px-4">Cupom</th>
                  <th className="py-3 px-4">Pedido</th>
                  <th className="py-3 px-4">Cliente</th>
                  <th className="py-3 px-4">Subtotal Original</th>
                  <th className="py-3 px-4">Desconto</th>
                  <th className="py-3 px-4">Total Pedido</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {usages.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400">
                      Nenhuma utilização de cupom registrada até o momento.
                    </td>
                  </tr>
                ) : (
                  usages.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 text-slate-600 text-[11px]">
                        {new Date(u.usedAt).toLocaleString('pt-BR')}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-mono font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded text-xs">
                          {u.couponCode}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-900">{u.orderCode}</td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-900">{u.customerName}</div>
                        <div className="text-[10px] text-slate-400">{u.customerEmail}</div>
                      </td>
                      <td className="py-3 px-4 text-slate-600">R$ {u.subtotalOriginal.toFixed(2)}</td>
                      <td className="py-3 px-4 font-bold text-[#E6007E]">
                        - R$ {u.discountApplied.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 font-extrabold text-slate-900">
                        R$ {u.finalTotal.toFixed(2)}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            u.status === 'confirmed'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {u.status === 'confirmed' ? 'Confirmado' : 'Estornado / Cancelado'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* ABA 3: HISTÓRICO DE ENVIOS */}
      {/* ========================================================= */}
      {activeTab === 'sends' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
          <div className="p-4 border-b border-slate-200">
            <h3 className="font-bold text-slate-900 text-sm">Disparos de Cupons Realizados</h3>
            <p className="text-xs text-slate-500">
              Rastreamento de mensagens e códigos compartilhados com clientes
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">Data de Envio</th>
                  <th className="py-3 px-4">Cupom</th>
                  <th className="py-3 px-4">Destinatário</th>
                  <th className="py-3 px-4">Canal</th>
                  <th className="py-3 px-4">Operador Responsável</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sendHistory.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      Nenhum envio registrado.
                    </td>
                  </tr>
                ) : (
                  sendHistory.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 text-slate-600 text-[11px]">
                        {new Date(s.sentAt).toLocaleString('pt-BR')}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-mono font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded text-xs">
                          {s.couponCode}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{s.customerName}</div>
                        <div className="text-[10px] text-slate-400">
                          {s.customerPhone || s.customerEmail || 'Cópia rápida'}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="uppercase text-[10px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                          {s.channel}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-700">{s.sentByUserName}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            s.status === 'shared_whatsapp'
                              ? 'bg-emerald-100 text-emerald-800'
                              : s.status === 'sent_email'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-zinc-100 text-zinc-800'
                          }`}
                        >
                          {s.status === 'shared_whatsapp'
                            ? 'WhatsApp Aberto'
                            : s.status === 'sent_email'
                            ? 'E-mail Enviado'
                            : 'Código Copiado'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* ABA 4: RELATÓRIOS & PERFORMANCE */}
      {/* ========================================================= */}
      {activeTab === 'reports' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Top Cupons por Faturamento */}
            <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
              <h3 className="font-bold text-slate-900 text-sm mb-1 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
                <span>Ranking de Faturamento por Cupom</span>
              </h3>
              <p className="text-xs text-slate-500 mb-3">
                Cupons com maior volume financeiro convertido na loja virtual
              </p>

              <div className="space-y-2">
                {coupons
                  .filter((c) => (c.totalSalesVolume || 0) > 0)
                  .sort((a, b) => (b.totalSalesVolume || 0) - (a.totalSalesVolume || 0))
                  .slice(0, 5)
                  .map((c, i) => (
                    <div
                      key={c.id}
                      className="p-2.5 bg-slate-50 rounded-lg border border-slate-100 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-[10px]">
                          {i + 1}
                        </span>
                        <div>
                          <span className="font-mono font-bold text-slate-900">{c.code}</span>
                          <span className="text-[10px] text-slate-500 block">{c.campaignName}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-emerald-700">
                          R$ {(c.totalSalesVolume || 0).toFixed(2)}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {c.currentUsageCount} pedidos • Desconto R$ {(c.totalDiscountGranted || 0).toFixed(2)}
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            {/* Performance de Disparos e Conversão */}
            <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
              <h3 className="font-bold text-slate-900 text-sm mb-1 flex items-center gap-2">
                <Send className="w-4 h-4 text-indigo-600" />
                <span>Eficiência de Disparos Promocionais</span>
              </h3>
              <p className="text-xs text-slate-500 mb-3">
                Relação entre envios realizados e compras efetivamente concluídas
              </p>

              <div className="space-y-3">
                <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl text-xs">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-semibold text-indigo-900">Taxa Geral de Conversão:</span>
                    <span className="font-extrabold text-base text-indigo-700">
                      {metrics.conversionRatePercent}%
                    </span>
                  </div>
                  <div className="w-full bg-indigo-200 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-indigo-600 h-full rounded-full"
                      style={{ width: `${Math.min(100, metrics.conversionRatePercent)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-indigo-600 mt-1">
                    <span>{metrics.totalSent} mensagens enviadas</span>
                    <span>{metrics.totalUsageCount} pedidos concluídos</span>
                  </div>
                </div>

                <div className="text-xs text-slate-600 space-y-1">
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span>Retorno Médio por Cupom Utilizado:</span>
                    <span className="font-bold text-slate-800">
                      R${' '}
                      {metrics.totalUsageCount > 0
                        ? (metrics.totalSalesVolume / metrics.totalUsageCount).toFixed(2)
                        : '0,00'}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span>Custo Médio de Desconto Concedido:</span>
                    <span className="font-bold text-[#E6007E]">
                      R${' '}
                      {metrics.totalUsageCount > 0
                        ? (metrics.totalDiscountGranted / metrics.totalUsageCount).toFixed(2)
                        : '0,00'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* ABA 5: AUDITORIA & SEGURANÇA */}
      {/* ========================================================= */}
      {activeTab === 'audit' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Trilha de Auditoria & Segurança</h3>
              <p className="text-xs text-slate-500">
                Log imutável de todas as ações de criação, alteração, envio e validação
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">Data / Hora</th>
                  <th className="py-3 px-4">Ação</th>
                  <th className="py-3 px-4">Cupom</th>
                  <th className="py-3 px-4">Usuário Responsável</th>
                  <th className="py-3 px-4">Detalhes da Operação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400">
                      Nenhum registro de auditoria encontrado.
                    </td>
                  </tr>
                ) : (
                  auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 text-slate-600 text-[11px] whitespace-nowrap">
                        {new Date(log.timestamp).toLocaleString('pt-BR')}
                      </td>
                      <td className="py-3 px-4">
                        <span className="uppercase text-[9px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-800">
                          {log.action}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">
                        {log.couponCode || '—'}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-800">{log.userName}</div>
                        <div className="text-[10px] text-slate-400 uppercase">{log.userRole}</div>
                      </td>
                      <td className="py-3 px-4 text-slate-600 text-[11px]">{log.details}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* ABA 6: BATERIA DE TESTES AUTOMATIZADOS (16 CENÁRIOS) */}
      {/* ========================================================= */}
      {activeTab === 'test_runner' && (
        <div className="space-y-4">
          <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-indigo-950 text-sm flex items-center gap-2">
                <CheckSquare className="w-4 h-4 text-indigo-600" />
                <span>Bateria Oficial de Testes — Validação das 12 Regras de Negócio</span>
              </h3>
              <p className="text-xs text-indigo-700 mt-0.5">
                Executa instantaneamente 16 cenários cobrindo validade temporal, limites, acúmulos, clientes exclusivos e integridade financeira
              </p>
            </div>

            <button
              onClick={handleRunTestScenarios}
              disabled={isRunningTests}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 shrink-0"
              id="btn-run-tests"
            >
              {isRunningTests ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Executando Testes...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  <span>Executar 16 Testes Agora</span>
                </>
              )}
            </button>
          </div>

          {testSummary && (
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 bg-white border border-slate-200 rounded-xl text-center">
                <div className="text-[10px] uppercase font-bold text-slate-400">Total de Cenários</div>
                <div className="text-xl font-black text-slate-800">{testSummary.total}</div>
              </div>
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
                <div className="text-[10px] uppercase font-bold text-emerald-700">Aprovados</div>
                <div className="text-xl font-black text-emerald-800">{testSummary.passed}</div>
              </div>
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-center">
                <div className="text-[10px] uppercase font-bold text-rose-700">Falhas</div>
                <div className="text-xl font-black text-rose-800">{testSummary.failed}</div>
              </div>
            </div>
          )}

          {testResults.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="py-3 px-4">#</th>
                      <th className="py-3 px-4">Categoria</th>
                      <th className="py-3 px-4">Nome do Cenário</th>
                      <th className="py-3 px-4">Comportamento Esperado</th>
                      <th className="py-3 px-4">Resultado Obtido</th>
                      <th className="py-3 px-4 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {testResults.map((t) => (
                      <tr key={t.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-slate-400">{t.id}</td>
                        <td className="py-3 px-4 font-medium text-slate-600">{t.category}</td>
                        <td className="py-3 px-4 font-bold text-slate-900">{t.name}</td>
                        <td className="py-3 px-4 text-slate-600">{t.expectedBehavior}</td>
                        <td className="py-3 px-4 font-mono text-[11px] text-slate-700">{t.actualResult}</td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                              t.passed
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {t.passed ? (
                              <>
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                <span>PASS</span>
                              </>
                            ) : (
                              <>
                                <AlertCircle className="w-3 h-3 text-rose-600" />
                                <span>FAIL</span>
                              </>
                            )}
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

      {/* ========================================================= */}
      {/* MODAL: CRIAR / EDITAR CUPOM */}
      {/* ========================================================= */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl relative animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#E6007E] text-white flex items-center justify-center font-bold">
                  <Ticket className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">
                    {editingCoupon ? `Editar Cupom "${editingCoupon.code}"` : 'Cadastrar Novo Cupom'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Defina regras comerciais, validade e limites de utilização
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCoupon} className="space-y-4 pt-4 text-xs">
              {/* Código & Campanha */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-bold text-slate-700">Código do Cupom *</label>
                    <button
                      type="button"
                      onClick={generateRandomCode}
                      className="text-[10px] text-[#E6007E] font-bold hover:underline cursor-pointer flex items-center gap-0.5"
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>Gerar Auto</span>
                    </button>
                  </div>
                  <input
                    type="text"
                    required
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    placeholder="Ex: PRIMEIRACOMPRA"
                    className="w-full px-3 py-2 font-mono uppercase font-bold bg-slate-50 border border-slate-300 rounded-xl focus:border-slate-900 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Nome da Campanha *</label>
                  <input
                    type="text"
                    required
                    value={formData.campaignName}
                    onChange={(e) => setFormData({ ...formData, campaignName: e.target.value })}
                    placeholder="Ex: Boas-vindas para novos clientes"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:border-slate-900 focus:outline-none"
                  />
                </div>
              </div>

              {/* Tipo de Desconto & Valor */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Tipo de Desconto *</label>
                  <select
                    value={formData.discountType}
                    onChange={(e) =>
                      setFormData({ ...formData, discountType: e.target.value as 'percentage' | 'fixed' })
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none"
                  >
                    <option value="percentage">Percentual (%)</option>
                    <option value="fixed">Valor Fixo (R$)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {formData.discountType === 'percentage' ? 'Percentual (%) *' : 'Valor em Reais (R$) *'}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={formData.discountType === 'percentage' ? '100' : undefined}
                    required
                    value={formData.discountValue}
                    onChange={(e) => setFormData({ ...formData, discountValue: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 font-bold bg-slate-50 border border-slate-300 rounded-xl focus:border-slate-900 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Teto Máximo (R$) {formData.discountType === 'percentage' && '(Opcional)'}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Ex: 150.00"
                    value={formData.maxDiscountAmount}
                    onChange={(e) => setFormData({ ...formData, maxDiscountAmount: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:border-slate-900 focus:outline-none"
                  />
                </div>
              </div>

              {/* Datas de Validade */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Início da Validade</label>
                  <input
                    type="datetime-local"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Encerramento da Validade</label>
                  <input
                    type="datetime-local"
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none"
                  />
                </div>
              </div>

              {/* Regras Financeiras & Limites */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Valor Mínimo Compra (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Ex: 100.00"
                    value={formData.minPurchaseAmount}
                    onChange={(e) => setFormData({ ...formData, minPurchaseAmount: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Usos Globais Máximos</label>
                  <input
                    type="number"
                    placeholder="Ex: 1000 (Vazio = Ilimitado)"
                    value={formData.maxUsageTotal}
                    onChange={(e) => setFormData({ ...formData, maxUsageTotal: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Limite Por Cliente</label>
                  <input
                    type="number"
                    min="1"
                    placeholder="Padrão: 1"
                    value={formData.maxUsagePerCustomer}
                    onChange={(e) => setFormData({ ...formData, maxUsagePerCustomer: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none"
                  />
                </div>
              </div>

              {/* Restrição de Cliente */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <div className="flex items-center gap-4">
                  <label className="font-bold text-slate-800">Restrição de Cliente:</label>
                  <label className="flex items-center gap-1.5 text-slate-700 cursor-pointer">
                    <input
                      type="radio"
                      name="customerRestriction"
                      value="general"
                      checked={formData.customerRestriction === 'general'}
                      onChange={() => setFormData({ ...formData, customerRestriction: 'general' })}
                    />
                    <span>Geral (Qualquer cliente)</span>
                  </label>
                  <label className="flex items-center gap-1.5 text-slate-700 cursor-pointer">
                    <input
                      type="radio"
                      name="customerRestriction"
                      value="specific_customers"
                      checked={formData.customerRestriction === 'specific_customers'}
                      onChange={() => setFormData({ ...formData, customerRestriction: 'specific_customers' })}
                    />
                    <span>Clientes Específicos</span>
                  </label>
                </div>

                {formData.customerRestriction === 'specific_customers' && (
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      E-mails autorizados (separados por vírgula):
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: contato@cliente.com.br, compras@empresa.com"
                      value={formData.specificCustomerEmails}
                      onChange={(e) => setFormData({ ...formData, specificCustomerEmails: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs focus:outline-none"
                    />
                  </div>
                )}
              </div>

              {/* Acúmulo com promoções & Status */}
              <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-800">
                  <input
                    type="checkbox"
                    checked={formData.canCombineWithPromotions}
                    onChange={(e) => setFormData({ ...formData, canCombineWithPromotions: e.target.checked })}
                    className="w-4 h-4 text-[#E6007E] rounded cursor-pointer"
                  />
                  <span>Permitir acumular com produtos em promoção / oferta</span>
                </label>

                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-700">Status:</span>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                    className="px-2.5 py-1 bg-white border border-slate-300 rounded-lg font-bold"
                  >
                    <option value="active">Ativo</option>
                    <option value="paused">Pausado</option>
                    <option value="draft">Rascunho</option>
                    <option value="cancelled">Cancelado</option>
                  </select>
                </div>
              </div>

              {/* Observações internas */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Observações Internas</label>
                <textarea
                  rows={2}
                  value={formData.internalNotes}
                  onChange={(e) => setFormData({ ...formData, internalNotes: e.target.value })}
                  placeholder="Anotações para a equipe comercial ou justificativa da campanha..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none"
                />
              </div>

              {/* Botões do Rodapé */}
              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 font-bold rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-slate-900 hover:bg-[#E6007E] text-white font-bold rounded-xl transition-colors cursor-pointer shadow-sm"
                >
                  {editingCoupon ? 'Salvar Alterações' : 'Criar Cupom'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: ENVIAR CUPOM AO CLIENTE */}
      {/* ========================================================= */}
      {isSendModalOpen && selectedCouponToSend && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl relative animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold">
                  <Send className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">
                    Enviar Cupom "{selectedCouponToSend.code}"
                  </h3>
                  <p className="text-xs text-slate-500">
                    Selecione o destinatário e o canal de envio com mensagem oficial preenchida
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsSendModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 pt-4 text-xs">
              {/* Destinatário */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Nome do Cliente *</label>
                  <input
                    type="text"
                    required
                    value={sendForm.customerName}
                    onChange={(e) => setSendForm({ ...sendForm, customerName: e.target.value })}
                    placeholder="Ex: Carlos Eduardo Silva"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">WhatsApp com DDD</label>
                  <input
                    type="text"
                    value={sendForm.customerPhone}
                    onChange={(e) => setSendForm({ ...sendForm, customerPhone: e.target.value })}
                    placeholder="Ex: (11) 98765-4321"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">E-mail do Cliente</label>
                <input
                  type="email"
                  value={sendForm.customerEmail}
                  onChange={(e) => setSendForm({ ...sendForm, customerEmail: e.target.value })}
                  placeholder="Ex: carlos@empresa.com.br"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none"
                />
              </div>

              {/* Pré-visualização da Mensagem */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-bold text-slate-700">Prévia da Mensagem Formatada:</label>
                  <button
                    type="button"
                    onClick={handleCopyCodeOnly}
                    className="text-[10px] text-slate-600 hover:text-slate-900 font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Copy className="w-3 h-3" />
                    <span>Copiar só o código</span>
                  </button>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl font-mono text-[11px] leading-relaxed whitespace-pre-line text-slate-800">
                  {preparedMessage}
                </div>
              </div>

              {/* Botões de Ação por Canal */}
              <div className="pt-2 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={handleSendWhatsAppWeb}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-xs"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>Abrir e Enviar no WhatsApp Web</span>
                </button>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={handleCopyMessage}
                    className="py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    {copiedSuccess ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    <span>{copiedSuccess ? 'Copiado!' : 'Copiar Mensagem'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleSendCorporateEmail}
                    className="py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Mail className="w-4 h-4" />
                    <span>Enviar por E-mail</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
