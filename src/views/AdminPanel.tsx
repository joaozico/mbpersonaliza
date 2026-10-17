import React, { useState, useRef, useMemo, useEffect } from 'react';
import {
  Product,
  Category,
  Subcategory,
  Quote,
  Order,
  StockMovement,
  PriceTier,
  UserProfile,
} from '../types';
import { StorageService } from '../services/storage';
import { CompanySettingsTab } from './CompanySettingsTab';
import { UserManagementTab } from './UserManagementTab';
import { SiteMetricsView } from './SiteMetricsView';
import { StrickerIntegrationTab } from './StrickerIntegrationTab';
import { LayoutCustomizationTab } from './LayoutCustomizationTab';
import { PaymentGatewaysTab } from './PaymentGatewaysTab';
import { PaymentTransactionsTab } from './PaymentTransactionsTab';
import { CashRegisterTab } from './CashRegisterTab';
import { FinancialModuleView } from './FinancialModuleView';
import { DisasterRecoveryBackupTab } from './DisasterRecoveryBackupTab';
import { DeliverySettingsTab } from './DeliverySettingsTab';
import { DeliveryOrdersTab } from './DeliveryOrdersTab';
import { BoletoBillingManagementTab } from './BoletoBillingManagementTab';
import { CostPricingModuleView } from './CostPricingModuleView';
import { SEOHead } from '../components/SEOHead';
import {
  Calculator,
  FileText,
  LayoutDashboard,
  Package,
  FileSpreadsheet,
  ShoppingBag,
  Boxes,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  Clock,
  Search,
  ArrowUpRight,
  TrendingUp,
  AlertTriangle,
  Eye,
  EyeOff,
  Filter,
  Truck,
  DollarSign,
  Send,
  Sparkles,
  Layers,
  X,
  Check,
  Users,
  Building2,
  Shield,
  SlidersHorizontal,
  LogOut,
  Store,
  CreditCard,
  BarChart3,
  Globe2,
  Palette,
  Flame,
  Tags,
  ChevronLeft,
  ChevronRight,
  HardDriveDownload,
  Info,
  AlertCircle,
} from 'lucide-react';

interface AdminPanelProps {
  currentUser: UserProfile;
  products: Product[];
  categories: Category[];
  subcategories: Subcategory[];
  onRefreshData: () => void;
  onNavigate: (view: string, param?: string) => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  currentUser,
  products,
  categories,
  subcategories,
  onRefreshData,
  onNavigate,
}) => {
  const [activeTab, setActiveTab] = useState<
    | 'dashboard'
    | 'products'
    | 'quotes'
    | 'orders'
    | 'delivery_orders'
    | 'stock'
    | 'users'
    | 'company'
    | 'delivery_settings'
    | 'layout'
    | 'offers_banner'
    | 'metrics'
    | 'stricker'
    | 'gateways'
    | 'transactions'
    | 'cash_register'
    | 'financial'
    | 'boletos'
    | 'cost_pricing'
    | 'backup'
  >('dashboard');

  // Category filter and scroll ref for tabs
  const [tabCategoryFilter, setTabCategoryFilter] = useState<'all' | 'operacional' | 'vendas_caixa' | 'configuracoes'>('all');
  const tabsContainerRef = useRef<HTMLDivElement>(null);

  // In-app Action Feedback Toast (replaces blocked iframe alerts)
  const [actionToast, setActionToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const showActionToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setActionToast({ message, type });
    setTimeout(() => setActionToast(null), 4000);
  };

  const handleSelectTab = (newTab: typeof activeTab) => {
    setActiveTab(newTab);
    if (['dashboard', 'products', 'quotes', 'orders', 'stock', 'deliveries', 'delivery_orders'].includes(newTab)) {
      if (tabCategoryFilter !== 'all') setTabCategoryFilter('operacional');
    } else if (['financial', 'transactions', 'gateways', 'cash_register', 'boletos', 'cost_pricing'].includes(newTab)) {
      if (tabCategoryFilter !== 'all') setTabCategoryFilter('vendas_caixa');
    } else if (['stricker', 'offers_banner', 'layout', 'metrics', 'users', 'company', 'delivery_settings', 'backup'].includes(newTab)) {
      if (tabCategoryFilter !== 'all') setTabCategoryFilter('configuracoes');
    }
  };

  const scrollTabs = (direction: 'left' | 'right') => {
    if (tabsContainerRef.current) {
      const scrollAmount = direction === 'left' ? -300 : 300;
      tabsContainerRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  // Quotes and Orders from storage
  const [quotes, setQuotes] = useState<Quote[]>(() => StorageService.getQuotes());
  const [orders, setOrders] = useState<Order[]>(() => StorageService.getOrders());
  const [stockMovements, setStockMovements] = useState<StockMovement[]>(() => StorageService.getStockMovements());

  // Permissions checks for current logged in employee
  const canViewFinancialModule = StorageService.hasUserPermission(currentUser, 'canViewFinancialModule');
  const canViewCostPricingModule =
    currentUser.role === 'admin' ||
    StorageService.hasUserPermission(currentUser, 'canViewCostPricingModule');
  const canViewSiteMetrics = StorageService.hasUserPermission(currentUser, 'canViewSiteMetrics');
  const canManageUsers =
    currentUser.role === 'admin' ||
    currentUser.role === 'gerente' ||
    StorageService.hasUserPermission(currentUser, 'canManageUsers');
  const canManageCompany = StorageService.hasUserPermission(currentUser, 'canManageCompanySettings');
  const canManageDelivery = StorageService.hasUserPermission(currentUser, 'canManageDeliverySettings') || StorageService.hasUserPermission(currentUser, 'canManageCompanySettings');
  const canCustomizeLayout = StorageService.hasUserPermission(currentUser, 'canCustomizeLayout');
  const canManageProducts = StorageService.hasUserPermission(currentUser, 'canManageProducts');
  const canManageQuotes = StorageService.hasUserPermission(currentUser, 'canManageQuotes');
  const canManageOrders = StorageService.hasUserPermission(currentUser, 'canManageOrders');
  const canManageStock = StorageService.hasUserPermission(currentUser, 'canManageStock');
  const canManageGateways = StorageService.hasUserPermission(currentUser, 'canManagePaymentGateways');
  const canViewTransactions = StorageService.hasUserPermission(currentUser, 'canViewFinancialTransactions');
  const canAccessPDV = StorageService.hasUserPermission(currentUser, 'canAccessPDV');

  // Product Modal State
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);

  // Quote Response Modal State
  const [answeringQuote, setAnsweringQuote] = useState<Quote | null>(null);
  const [quoteAdminNotes, setQuoteAdminNotes] = useState('');
  const [quoteProductionDays, setQuoteProductionDays] = useState(10);
  const [quoteItemPrices, setQuoteItemPrices] = useState<{ [itemId: string]: number }>({});
  // Quote Billing Configuration State
  const [quoteBillingType, setQuoteBillingType] = useState<'a_vista' | 'faturado_prazo'>('a_vista');
  const [quoteIsDeferredAuthorized, setQuoteIsDeferredAuthorized] = useState(false);
  const [quoteConditionName, setQuoteConditionName] = useState('28 DDL');
  const [quoteInstallmentsCount, setQuoteInstallmentsCount] = useState(1);
  const [quoteDaysInterval, setQuoteDaysInterval] = useState<number[]>([28]);
  const [quoteCreditApprovalNotes, setQuoteCreditApprovalNotes] = useState('');

  // Quick Stock Adjustment Modal State
  const [isStockModalOpen, setIsStockModalOpen] = useState(false);
  const [stockAdjustProductId, setStockAdjustProductId] = useState(products[0]?.id || '');
  const [stockAdjustQty, setStockAdjustQty] = useState(50);
  const [stockAdjustType, setStockAdjustType] = useState<'entrada' | 'saida' | 'ajuste'>('entrada');
  const [stockAdjustReason, setStockAdjustReason] = useState('Reposição de fornecedor');

  // Search and filters
  const [productSearch, setProductSearch] = useState('');
  const [productStockFilter, setProductStockFilter] = useState<
    'all' | 'low_stock' | 'out_of_stock' | 'normal' | 'active' | 'inactive' | 'banner'
  >('all');
  const [stockTableFilter, setStockTableFilter] = useState<'all' | 'low_stock'>('all');
  const [dismissLowStockBanner, setDismissLowStockBanner] = useState(false);
  const [quoteFilterStatus, setQuoteFilterStatus] = useState<string>('all');
  const [orderFilterStatus, setOrderFilterStatus] = useState<string>('all');

  const refreshAll = () => {
    setQuotes(StorageService.getQuotes());
    setOrders(StorageService.getOrders());
    setStockMovements(StorageService.getStockMovements());
    onRefreshData();
  };

  // Automatic Low Stock Calculations
  const lowStockProducts = React.useMemo(() => {
    return products.filter((p) => (p.stock_qty <= (p.min_stock_alert ?? 0) || p.stock_qty === 0));
  }, [products]);

  const outOfStockProducts = React.useMemo(() => {
    return products.filter((p) => p.stock_qty <= 0);
  }, [products]);

  // Quick Restock helper
  const handleQuickRestock = (productId: string, suggestedQty?: number) => {
    setStockAdjustProductId(productId);
    const prod = products.find((p) => p.id === productId);
    const deficit = prod ? Math.max(10, (prod.min_stock_alert || 20) - prod.stock_qty + 20) : 50;
    setStockAdjustQty(suggestedQty || deficit);
    setStockAdjustType('entrada');
    setStockAdjustReason('Reposição automática - Alerta de estoque mínimo atingido');
    setIsStockModalOpen(true);
  };

  // Metrics
  const totalProducts = (products || []).length;
  const activeProducts = (products || []).filter((p) => p?.is_active).length;
  const pendingQuotes = (quotes || []).filter((q) => q?.status === 'pendente' || q?.status === 'em_analise').length;
  const inProductionOrders = (orders || []).filter((o) => o?.orderStatus === 'em_producao' || o?.orderStatus === 'novo').length;
  const totalRevenue = (orders || [])
    .filter((o) => o?.paymentStatus === 'pago')
    .reduce((acc, o) => acc + (o?.total || 0), 0);

  // Product CRUD
  const handleOpenNewProduct = () => {
    const newProd: Product = {
      id: `prod-${Date.now()}`,
      name: '',
      code: `MB-${Math.floor(100 + Math.random() * 900)}`,
      slug: '',
      description: '',
      categoryId: categories[0]?.id || 'cat-1',
      subcategoryId: subcategories[0]?.id || 'sub-1',
      images: ['https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?w=800&auto=format&fit=crop&q=80'],
      base_price: 29.9,
      cost_price: 15.0,
      profit_margin: 50,
      promo_price: undefined,
      show_price: true,
      min_order_qty: 10,
      stock_qty: 100,
      min_stock_alert: 20,
      is_active: true,
      is_featured: false,
      badge: 'NOVO',
      details: {
        materials: 'Aço Inox / Polímero',
        dimensions: '20cm x 7cm',
        customTechniques: ['Laser', 'Silk Screen'],
      },
      price_tiers: [
        { id: 'pt-1', min_qty: 10, max_qty: 49, unit_price: 29.9 },
        { id: 'pt-2', min_qty: 50, max_qty: 99, unit_price: 26.9, discount_pct: 10 },
        { id: 'pt-3', min_qty: 100, max_qty: 499, unit_price: 23.9, discount_pct: 20 },
      ],
      variants: [],
      createdAt: new Date().toISOString(),
    };
    setEditingProduct(newProd);
    setIsProductModalOpen(true);
  };

  const handleEditProduct = (prod: Product) => {
    setEditingProduct({ ...prod });
    setIsProductModalOpen(true);
  };

  const handleSaveProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;

    // Generate slug if empty
    const slug = editingProduct.name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '');

    const finalProduct: Product = {
      ...editingProduct,
      slug: editingProduct.slug || slug,
    };

    StorageService.saveProduct(finalProduct);

    if (finalProduct.showInOffersBanner !== undefined) {
      StorageService.toggleProductInOffersBanner(
        finalProduct.id,
        Boolean(finalProduct.showInOffersBanner),
        finalProduct.promo_price,
        finalProduct.offersBannerBadge,
        finalProduct.offersBannerOrder,
        finalProduct.offersBannerImage,
        finalProduct.offerStartDate,
        finalProduct.offerEndDate
      );
    }

    setIsProductModalOpen(false);
    setEditingProduct(null);
    refreshAll();
  };

  const handleDeleteProduct = (id: string) => {
    if (confirm('Tem certeza que deseja desativar/excluir este produto?')) {
      StorageService.deleteProduct(id);
      refreshAll();
    }
  };

  const handleToggleProductStatus = (prod: Product) => {
    const updated = { ...prod, is_active: !prod.is_active };
    StorageService.saveProduct(updated);
    refreshAll();
  };

  const handleToggleShowPrice = (prod: Product) => {
    const updated = { ...prod, show_price: !prod.show_price };
    StorageService.saveProduct(updated);
    refreshAll();
  };

  // Quote Answering
  const handleOpenAnswerQuote = (quote: Quote) => {
    setAnsweringQuote(quote);
    setQuoteAdminNotes(quote.adminNotes || 'Proposta formulada com personalização a laser inclusa e embalagem padrão.');
    setQuoteProductionDays(quote.productionDaysEstimate || 8);
    const initialPrices: { [itemId: string]: number } = {};
    quote.items.forEach((item) => {
      initialPrices[item.id] = item.unit_price_estimated || 25.0;
    });
    setQuoteItemPrices(initialPrices);

    // Inicializa condições de pagamento / faturamento
    const terms = quote.billingTerms;
    if (terms) {
      setQuoteBillingType(terms.type || 'a_vista');
      setQuoteIsDeferredAuthorized(Boolean(terms.isDeferredAuthorized));
      setQuoteConditionName(terms.conditionName || '28 DDL');
      setQuoteInstallmentsCount(terms.installmentsCount || 1);
      setQuoteDaysInterval(terms.daysInterval || [28]);
      setQuoteCreditApprovalNotes(terms.notes || '');
    } else {
      setQuoteBillingType('a_vista');
      setQuoteIsDeferredAuthorized(false);
      setQuoteConditionName('À Vista (2 dias úteis)');
      setQuoteInstallmentsCount(1);
      setQuoteDaysInterval([2]);
      setQuoteCreditApprovalNotes('');
    }
  };

  const handleSaveQuoteResponse = (e: React.FormEvent) => {
    e.preventDefault();
    if (!answeringQuote) return;

    let total = 0;
    const updatedItems = answeringQuote.items.map((item) => {
      const unit = quoteItemPrices[item.id] || 25.0;
      total += unit * item.quantity;
      return {
        ...item,
        unit_price_estimated: unit,
      };
    });

    const isDeferred = quoteBillingType === 'faturado_prazo';
    const isAuthorized = isDeferred ? quoteIsDeferredAuthorized : false;

    const billingTerms = {
      type: quoteBillingType,
      isDeferredAuthorized: isAuthorized,
      conditionName: isDeferred ? quoteConditionName : 'À Vista (2 dias úteis)',
      daysInterval: isDeferred ? quoteDaysInterval : [2],
      installmentsCount: isDeferred ? quoteInstallmentsCount : 1,
      commercialApprovalStatus: 'aprovado' as const,
      commercialApprovedBy: currentUser.name,
      commercialApprovedAt: new Date().toISOString(),
      financialApprovalStatus: (isAuthorized ? 'aprovado' : 'dispensado') as 'aprovado' | 'dispensado',
      financialApprovedBy: isAuthorized ? currentUser.name : undefined,
      financialApprovedAt: isAuthorized ? new Date().toISOString() : undefined,
      notes: quoteCreditApprovalNotes,
    };

    const updatedQuote: Quote = {
      ...answeringQuote,
      items: updatedItems,
      totalEstimated: total,
      adminNotes: quoteAdminNotes,
      productionDaysEstimate: quoteProductionDays,
      validityDate: '15 dias corridos',
      status: 'respondido',
      billingTerms,
    };

    StorageService.updateQuote(updatedQuote);
    setAnsweringQuote(null);
    refreshAll();
    showActionToast(`Proposta comercial do orçamento ${updatedQuote.code} gravada com sucesso!`, 'success');
  };

  const handleConvertQuoteToOrder = (quoteId: string) => {
    const q = quotes.find((item) => item.id === quoteId);
    if (!q) return;

    if (q.status === 'recusado' || q.status === 'cancelado') {
      showActionToast('Esta proposta está cancelada ou recusada e não pode ser convertida em pedido.', 'error');
      return;
    }

    const isDeferred = Boolean(q.billingTerms?.isDeferredAuthorized && q.billingTerms?.type === 'faturado_prazo');

    const order = StorageService.convertQuoteToOrder(quoteId, isDeferred ? 'boleto_faturado' : 'boleto');
    if (order) {
      refreshAll();
      showActionToast(`Pedido ${order.code} gerado com sucesso com integração financeira concluída!`, 'success');
    }
  };

  // Order status changes
  const handleUpdateOrderStatus = (orderId: string, status: Order['orderStatus']) => {
    StorageService.updateOrderStatus(orderId, status);
    refreshAll();
    showActionToast(`Status do pedido atualizado para "${status}".`, 'info');
  };

  const handleUpdateTracking = (orderId: string) => {
    const code = prompt('Insira o código de rastreamento dos Correios / Transportadora:');
    if (code) {
      StorageService.updateOrderTracking(orderId, code);
      refreshAll();
      showActionToast(`Código de rastreamento ${code} registrado.`, 'success');
    }
  };

  // Stock adjustments
  const handleSaveStockAdjustment = (e: React.FormEvent) => {
    e.preventDefault();
    StorageService.adjustStock(
      stockAdjustProductId,
      stockAdjustQty,
      stockAdjustType,
      stockAdjustReason,
      currentUser.name
    );
    setIsStockModalOpen(false);
    refreshAll();
    showActionToast('Movimentação de estoque lançada com sucesso!', 'success');
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 min-w-0" id="admin-panel-page">
      <SEOHead
        title="Painel de Controle & Gestão (ERP)"
        description="Painel de controle do catálogo de brindes, orçamentos, pedidos, estoque e configurações da MB Personaliza."
        canonicalPath="/admin"
        noIndex={true}
      />

      {/* Floating or Top Action Toast Banner */}
      {actionToast && (
        <div
          className={`p-4 rounded-2xl text-xs font-bold flex items-center gap-2.5 animate-fadeIn shadow-md border ${
            actionToast.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : actionToast.type === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-800'
              : 'bg-blue-50 border-blue-200 text-blue-800'
          }`}
        >
          {actionToast.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : actionToast.type === 'error' ? (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          ) : (
            <Info className="w-4 h-4 text-blue-600 shrink-0" />
          )}
          <span>{actionToast.message}</span>
        </div>
      )}
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-[#00AEEF] text-white">
              Painel de Gestão
            </span>
            <span className="text-xs text-slate-500 font-mono">MB Personaliza OS</span>
          </div>
          <h1 className="text-3xl font-extrabold uppercase font-heading text-slate-900 mt-1">
            Administração do Sistema
          </h1>
          <p className="text-xs text-slate-500">
            Acessando como: <strong>{currentUser.name}</strong> ({currentUser.role.toUpperCase()})
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => onNavigate('home')}
            className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer border border-slate-200"
            title="Ir para a loja pública"
          >
            <Store className="w-4 h-4 text-[#00AEEF]" />
            <span>Ver Loja</span>
          </button>

          {canAccessPDV && (
            <button
              onClick={() => onNavigate('pdv')}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
              title="Abrir Ponto de Venda (Frente de Caixa Balcão)"
            >
              <Store className="w-4 h-4 text-white" />
              <span>Abrir PDV (Caixa)</span>
            </button>
          )}

          <button
            onClick={handleOpenNewProduct}
            className="px-4 py-2.5 bg-[#E6007E] hover:bg-[#c9006e] text-white text-xs font-bold rounded-xl transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Cadastrar Produto</span>
          </button>

          <button
            onClick={() => setIsStockModalOpen(true)}
            className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
          >
            <Boxes className="w-4 h-4 text-[#FFDD00]" />
            <span>Movimentar Estoque</span>
          </button>

          <button
            onClick={() => {
              const client = StorageService.switchRole('cliente');
              onNavigate('admin-login');
            }}
            className="p-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-xl transition-all border border-rose-200 flex items-center gap-1.5 cursor-pointer"
            title="Encerrar sessão de administrador"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Sair Admin</span>
          </button>
        </div>
      </div>

      {/* Navigation Category Filter & Tab Navigation */}
      <div className="space-y-2.5 border-b border-slate-200 pb-3 w-full min-w-0 max-w-full">
        {/* Top Control Bar: Category Filters & Scroll Controls */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          {/* Category Chips */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1 hidden md:inline">
              Módulos:
            </span>
            <button
              onClick={() => setTabCategoryFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                tabCategoryFilter === 'all'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Todas as Abas (15)
            </button>
            <button
              onClick={() => {
                setTabCategoryFilter('operacional');
                if (!['dashboard', 'products', 'quotes', 'orders', 'stock', 'deliveries'].includes(activeTab)) {
                  setActiveTab('dashboard');
                }
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                tabCategoryFilter === 'operacional'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Package className="w-3.5 h-3.5 text-blue-500" />
              <span>Operacional & Estoque</span>
            </button>
            <button
              onClick={() => {
                setTabCategoryFilter('vendas_caixa');
                if (!['financial', 'transactions', 'gateways', 'cash_register', 'boletos', 'cost_pricing'].includes(activeTab)) {
                  setActiveTab('transactions');
                }
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                tabCategoryFilter === 'vendas_caixa'
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200/60'
              }`}
            >
              <Store className="w-3.5 h-3.5 text-emerald-500" />
              <span>Vendas, PDV & Caixa</span>
            </button>
            <button
              onClick={() => {
                setTabCategoryFilter('configuracoes');
                if (!['stricker', 'metrics', 'users', 'company', 'offers_banner', 'layout', 'delivery_settings', 'backup'].includes(activeTab)) {
                  setActiveTab('stricker');
                }
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                tabCategoryFilter === 'configuracoes'
                  ? 'bg-[#E6007E] text-white shadow-xs'
                  : 'bg-pink-50 text-[#E6007E] hover:bg-pink-100 border border-pink-200/60'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-pink-500" />
              <span>Configurações & Loja</span>
            </button>
          </div>

          {/* Scroll Navigation Arrows for Horizontal Tab Bar */}
          <div className="flex items-center gap-1 ml-auto">
            <span className="text-[11px] text-slate-400 hidden xl:inline">Navegar abas:</span>
            <button
              onClick={() => scrollTabs('left')}
              className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer border border-slate-200"
              title="Rolar abas para a esquerda"
              aria-label="Rolar para esquerda"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => scrollTabs('right')}
              className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer border border-slate-200"
              title="Rolar abas para a direita"
              aria-label="Rolar para direita"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Mobile Quick Select Dropdown */}
        <div className="sm:hidden">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
            Selecione a aba:
          </label>
          <select
            value={activeTab}
            onChange={(e) => {
              const newTab = e.target.value as any;
              setActiveTab(newTab);
              if (['dashboard', 'products', 'quotes', 'orders', 'stock', 'deliveries'].includes(newTab)) {
                setTabCategoryFilter('operacional');
              } else if (['financial', 'transactions', 'gateways', 'cash_register', 'boletos', 'cost_pricing'].includes(newTab)) {
                setTabCategoryFilter('vendas_caixa');
              } else if (['stricker', 'offers_banner', 'layout', 'metrics', 'users', 'company', 'delivery_settings', 'backup'].includes(newTab)) {
                setTabCategoryFilter('configuracoes');
              }
            }}
            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#00AEEF]"
          >
            <optgroup label="Operacional & Estoque">
              <option value="dashboard">Visão Geral</option>
              <option value="products">Produtos ({products.length})</option>
              <option value="quotes">Orçamentos ({quotes.length})</option>
              <option value="orders">Pedidos & Produção ({orders.length})</option>
              <option value="stock">Estoque & Inventário</option>
              <option value="deliveries">Expedição & Entregas</option>
            </optgroup>
            <optgroup label="Vendas & Caixa">
              {canViewFinancialModule && (
                <option value="financial">Módulo Financeiro (Restrito)</option>
              )}
              {canViewCostPricingModule && (
                <option value="cost_pricing">Custos & Precificação (Novo)</option>
              )}
              <option value="transactions">Transações & Pagamentos</option>
              <option value="gateways">Gateways de Pagamento (Mercado Pago / PagBank)</option>
              <option value="cash_register">Controle de Caixa</option>
              <option value="boletos">Boletos & Faturamento a Prazo (FEBRABAN)</option>
            </optgroup>
            <optgroup label="Configurações & Integrações">
              <option value="stricker">Integração Stricker / SPOT</option>
              <option value="offers_banner">Banner de Ofertas</option>
              <option value="layout">Personalização do Layout</option>
              <option value="metrics">Métricas do Site</option>
              <option value="users">Usuários & Permissões</option>
              <option value="company">Dados da Empresa</option>
              <option value="delivery_settings">Região & Fretes</option>
              <option value="backup">Backup & Recuperação (DRP)</option>
            </optgroup>
          </select>
        </div>

        {/* Horizontal Scrollable Tabs Bar */}
        <div
          ref={tabsContainerRef}
          className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent scroll-smooth w-full min-w-0 max-w-full"
        >
          {/* Operacional Tabs */}
          {(tabCategoryFilter === 'all' || tabCategoryFilter === 'operacional') && (
            <>
              <button
                onClick={() => setActiveTab('dashboard')}
                className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all shrink-0 cursor-pointer ${
                  activeTab === 'dashboard' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <LayoutDashboard className="w-4 h-4 text-[#00AEEF]" />
                <span>Visão Geral</span>
              </button>

              <button
                onClick={() => setActiveTab('products')}
                className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all shrink-0 cursor-pointer ${
                  activeTab === 'products' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Package className="w-4 h-4 text-emerald-400" />
                <span>Produtos ({products.length})</span>
                {lowStockProducts.length > 0 && (
                  <span
                    className="px-1.5 py-0.5 rounded-full bg-rose-600 text-white text-[10px] flex items-center gap-0.5 font-bold animate-pulse"
                    title={`${lowStockProducts.length} produto(s) abaixo do estoque mínimo`}
                  >
                    <AlertTriangle className="w-2.5 h-2.5" />
                    <span>{lowStockProducts.length}</span>
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveTab('quotes')}
                className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all shrink-0 cursor-pointer ${
                  activeTab === 'quotes' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <FileSpreadsheet className="w-4 h-4 text-pink-400" />
                <span>Orçamentos ({quotes.length})</span>
                {pendingQuotes > 0 && (
                  <span className="w-5 h-5 rounded-full bg-[#E6007E] text-white text-[10px] flex items-center justify-center font-bold">
                    {pendingQuotes}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveTab('orders')}
                className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all shrink-0 cursor-pointer ${
                  activeTab === 'orders' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <ShoppingBag className="w-4 h-4 text-blue-400" />
                <span>Pedidos ({orders.length})</span>
                {inProductionOrders > 0 && (
                  <span className="w-5 h-5 rounded-full bg-[#00AEEF] text-white text-[10px] flex items-center justify-center font-bold">
                    {inProductionOrders}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveTab('delivery_orders')}
                className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all shrink-0 cursor-pointer ${
                  activeTab === 'delivery_orders'
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-700 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Truck className="w-4 h-4 text-emerald-400" />
                <span>Entregas & Fretes</span>
                {orders.filter((o) => o.shippingInfo?.freightStatus === 'aguardando_cotacao').length > 0 && (
                  <span className="w-5 h-5 rounded-full bg-blue-500 text-white text-[10px] flex items-center justify-center font-bold">
                    {orders.filter((o) => o.shippingInfo?.freightStatus === 'aguardando_cotacao').length}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveTab('stock')}
                className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all shrink-0 cursor-pointer ${
                  activeTab === 'stock' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Boxes className="w-4 h-4 text-amber-400" />
                <span>Estoque & Inventário</span>
                {lowStockProducts.length > 0 && (
                  <span
                    className="px-2 py-0.5 rounded-full bg-rose-600 text-white text-[10px] flex items-center gap-1 font-bold shadow-xs"
                    title={`${lowStockProducts.length} produto(s) com estoque baixo ou zerado`}
                  >
                    <AlertTriangle className="w-3 h-3" />
                    <span>{lowStockProducts.length}</span>
                  </span>
                )}
              </button>
            </>
          )}

          {/* Vendas & Caixa Tabs */}
          {(tabCategoryFilter === 'all' || tabCategoryFilter === 'vendas_caixa') && (
            <>
              {canViewFinancialModule && (
                <button
                  onClick={() => setActiveTab('financial')}
                  className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all shrink-0 cursor-pointer ${
                    activeTab === 'financial'
                      ? 'bg-gradient-to-r from-[#E6007E] to-rose-600 text-white shadow-md ring-2 ring-pink-300'
                      : 'text-slate-800 bg-rose-50/80 hover:bg-rose-100 border border-rose-200/80'
                  }`}
                  title="Módulo Financeiro (Acesso Restrito)"
                >
                  <DollarSign className={`w-4 h-4 ${activeTab === 'financial' ? 'text-[#FFDD00]' : 'text-rose-600'}`} />
                  <span>Módulo Financeiro</span>
                  <span className="px-1.5 py-0.2 rounded text-[9px] font-black uppercase bg-rose-500 text-white tracking-wider">
                    Restrito
                  </span>
                </button>
              )}

              {canViewTransactions && (
                <button
                  onClick={() => setActiveTab('transactions')}
                  className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all shrink-0 cursor-pointer ${
                    activeTab === 'transactions'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <DollarSign className="w-4 h-4 text-emerald-400" />
                  <span>Transações & Pagamentos</span>
                </button>
              )}

              {canManageGateways && (
                <button
                  onClick={() => setActiveTab('gateways')}
                  className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all shrink-0 cursor-pointer ${
                    activeTab === 'gateways'
                      ? 'bg-gradient-to-r from-[#00AEEF] to-sky-700 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <CreditCard className="w-4 h-4 text-sky-400" />
                  <span>Gateways de Pagamento</span>
                </button>
              )}

              <button
                onClick={() => setActiveTab('cash_register')}
                className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all shrink-0 cursor-pointer ${
                  activeTab === 'cash_register'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Store className="w-4 h-4 text-amber-500" />
                <span>Controle de Caixa</span>
              </button>

              <button
                onClick={() => setActiveTab('boletos')}
                className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all shrink-0 cursor-pointer ${
                  activeTab === 'boletos'
                    ? 'bg-gradient-to-r from-indigo-700 to-indigo-900 text-white shadow-sm ring-2 ring-indigo-400/40'
                    : 'text-indigo-950 bg-indigo-50/70 hover:bg-indigo-100 border border-indigo-200/70'
                }`}
                title="Boletos Bancários & Faturamento a Prazo (Regras FEBRABAN)"
              >
                <FileText className={`w-4 h-4 ${activeTab === 'boletos' ? 'text-[#FFDD00]' : 'text-indigo-600'}`} />
                <span>Boletos & Faturamento</span>
                <span className="px-1.5 py-0.2 rounded text-[9px] font-black uppercase bg-indigo-600 text-white tracking-wider">
                  FEBRABAN
                </span>
              </button>

              {canViewCostPricingModule && (
                <button
                  onClick={() => setActiveTab('cost_pricing')}
                  className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all shrink-0 cursor-pointer ${
                    activeTab === 'cost_pricing'
                      ? 'bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white shadow-md ring-2 ring-pink-400/50'
                      : 'text-slate-900 bg-pink-50/70 hover:bg-pink-100 border border-pink-200/80'
                  }`}
                  title="Módulo de Orçamento de Custos & Precificação (Engenharia de Custos)"
                >
                  <Calculator className={`w-4 h-4 ${activeTab === 'cost_pricing' ? 'text-[#FFDD00]' : 'text-[#E6007E]'}`} />
                  <span>Custos & Precificação</span>
                  <span className="px-1.5 py-0.2 rounded text-[9px] font-black uppercase bg-[#E6007E] text-white tracking-wider">
                    Novo
                  </span>
                </button>
              )}
            </>
          )}

          {/* Configurações & Loja Tabs */}
          {(tabCategoryFilter === 'all' || tabCategoryFilter === 'configuracoes') && (
            <>
              <button
                onClick={() => setActiveTab('stricker')}
                className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all shrink-0 cursor-pointer ${
                  activeTab === 'stricker'
                    ? 'bg-gradient-to-r from-blue-700 to-indigo-700 text-white shadow-sm ring-2 ring-blue-400/30'
                    : 'text-slate-700 bg-blue-50/50 hover:bg-blue-100/70 border border-blue-200/60'
                }`}
              >
                <Globe2 className={`w-4 h-4 ${activeTab === 'stricker' ? 'text-white' : 'text-blue-600'}`} />
                <span>Integração Stricker</span>
                <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold uppercase bg-blue-500 text-white tracking-wider">
                  API
                </span>
              </button>

              {canCustomizeLayout && (
                <button
                  onClick={() => setActiveTab('offers_banner')}
                  className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all shrink-0 cursor-pointer ${
                    activeTab === 'offers_banner'
                      ? 'bg-gradient-to-r from-[#E6007E] to-rose-600 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <Flame className="w-4 h-4 text-[#FFDD00]" />
                  <span>Banner de Ofertas</span>
                </button>
              )}

              {canCustomizeLayout && (
                <button
                  onClick={() => setActiveTab('layout')}
                  className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all shrink-0 cursor-pointer ${
                    activeTab === 'layout'
                      ? 'bg-gradient-to-r from-[#E6007E] to-[#00AEEF] text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <Palette className="w-4 h-4 text-[#FFDD00]" />
                  <span>Layout da Loja</span>
                </button>
              )}

              {canViewSiteMetrics && (
                <button
                  onClick={() => setActiveTab('metrics')}
                  className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all shrink-0 cursor-pointer ${
                    activeTab === 'metrics'
                      ? 'bg-gradient-to-r from-[#E6007E] to-[#00AEEF] text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <BarChart3 className="w-4 h-4 text-[#00AEEF]" />
                  <span>Métricas</span>
                </button>
              )}

              <button
                onClick={() => handleSelectTab('users')}
                className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all shrink-0 cursor-pointer ${
                  activeTab === 'users' ? 'bg-[#E6007E] text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Users className="w-4 h-4 text-purple-400" />
                <span>Usuários & Permissões</span>
              </button>

              {canManageCompany && (
                <button
                  onClick={() => setActiveTab('company')}
                  className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all shrink-0 cursor-pointer ${
                    activeTab === 'company' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <Building2 className="w-4 h-4 text-[#00AEEF]" />
                  <span>Dados da Empresa</span>
                </button>
              )}

              {canManageDelivery && (
                <button
                  onClick={() => setActiveTab('delivery_settings')}
                  className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all shrink-0 cursor-pointer ${
                    activeTab === 'delivery_settings'
                      ? 'bg-gradient-to-r from-sky-600 to-blue-700 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <Truck className="w-4 h-4 text-[#FFDD00]" />
                  <span>Região & Fretes</span>
                </button>
              )}

              <button
                onClick={() => setActiveTab('backup')}
                className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all shrink-0 cursor-pointer ${
                  activeTab === 'backup'
                    ? 'bg-gradient-to-r from-slate-900 via-indigo-950 to-indigo-900 text-white shadow-sm ring-2 ring-indigo-400/30'
                    : 'text-indigo-950 bg-indigo-50/70 hover:bg-indigo-100 border border-indigo-200/70'
                }`}
                title="Backup Agendado & Recuperação de Desastres (JSON Seguro)"
              >
                <HardDriveDownload className={`w-4 h-4 ${activeTab === 'backup' ? 'text-[#FFDD00]' : 'text-indigo-600'}`} />
                <span>Backup & Recuperação</span>
                <span className="px-1.5 py-0.2 rounded text-[9px] font-black uppercase bg-indigo-600 text-white tracking-wider">
                  DRP
                </span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* AUTOMATIC LOW STOCK AUDIT ALERT BANNER */}
      {lowStockProducts.length > 0 && !dismissLowStockBanner && (
        <div className="bg-gradient-to-r from-rose-50 via-amber-50 to-rose-50 border border-rose-200 rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-sm">
              <AlertTriangle className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2 py-0.5 rounded-md bg-rose-600 text-white text-[10px] font-extrabold uppercase tracking-wide">
                  Verificação Automática de Estoque Mínimo
                </span>
                <span className="text-xs font-bold text-rose-900">
                  {lowStockProducts.length} {lowStockProducts.length === 1 ? 'produto atingiu' : 'produtos atingiram'} o nível crítico de reposição
                </span>
              </div>
              <p className="text-xs text-rose-700 mt-1">
                O saldo físico em estoque desses itens está menor ou igual ao <strong>estoque mínimo</strong> configurado no cadastro ({outOfStockProducts.length > 0 ? `${outOfStockProducts.length} item(ns) totalmente zerado(s)` : 'necessidade urgente de reposição com fornecedores'}).
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-auto">
            <button
              onClick={() => {
                setActiveTab('products');
                setProductStockFilter('low_stock');
              }}
              className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Filter className="w-3.5 h-3.5" />
              <span>Ver Produtos em Alerta ({lowStockProducts.length})</span>
            </button>
            <button
              onClick={() => {
                setActiveTab('stock');
                setStockTableFilter('low_stock');
              }}
              className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 text-xs font-bold rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Boxes className="w-3.5 h-3.5 text-rose-600" />
              <span>Painel de Reposição</span>
            </button>
            <button
              onClick={() => setDismissLowStockBanner(true)}
              className="p-2 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              title="Ocultar aviso temporariamente"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* TAB 1: DASHBOARD OVERVIEW */}
      {activeTab === 'dashboard' && (
        <div className="space-y-8">
          {/* Quick Stat Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase">Produtos Ativos</span>
                <Package className="w-5 h-5 text-[#00AEEF]" />
              </div>
              <div className="text-3xl font-extrabold text-slate-900 font-heading">
                {activeProducts} <span className="text-xs text-slate-400 font-normal font-sans">/ {totalProducts} cadastrados</span>
              </div>
              <p className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Catálogo online sincronizado
              </p>
            </div>

            <div className={`p-5 rounded-2xl border shadow-xs space-y-2 transition-all ${
              lowStockProducts.length > 0
                ? 'bg-rose-50/70 border-rose-200 hover:border-rose-300'
                : 'bg-white border-slate-200'
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-600 uppercase">Abaixo do Mínimo</span>
                <AlertTriangle className={`w-5 h-5 ${lowStockProducts.length > 0 ? 'text-rose-600 animate-pulse' : 'text-slate-400'}`} />
              </div>
              <div className="text-3xl font-extrabold font-heading text-rose-600 flex items-baseline gap-2">
                {lowStockProducts.length}
                {outOfStockProducts.length > 0 && (
                  <span className="text-xs text-rose-800 font-bold font-sans bg-rose-200/80 px-2 py-0.5 rounded-full">
                    {outOfStockProducts.length} zerado(s)
                  </span>
                )}
              </div>
              <button
                onClick={() => {
                  setActiveTab('products');
                  setProductStockFilter('low_stock');
                }}
                className="text-[11px] text-rose-700 font-bold hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>{lowStockProducts.length > 0 ? 'Ver produtos em risco' : 'Níveis de estoque normais'}</span>
                <ArrowUpRight className="w-3 h-3" />
              </button>
            </div>

            <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase">Orçamentos Pendentes</span>
                <FileSpreadsheet className="w-5 h-5 text-[#E6007E]" />
              </div>
              <div className="text-3xl font-extrabold text-[#E6007E] font-heading">
                {pendingQuotes}
              </div>
              <p className="text-[11px] text-slate-500">Aguardando análise comercial</p>
            </div>

            <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase">Pedidos em Produção</span>
                <ShoppingBag className="w-5 h-5 text-[#FFDD00]" />
              </div>
              <div className="text-3xl font-extrabold text-slate-900 font-heading">
                {inProductionOrders}
              </div>
              <p className="text-[11px] text-slate-500">Na fila de gravação e montagem</p>
            </div>

            <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase">Faturamento</span>
                <TrendingUp className="w-5 h-5 text-emerald-600" />
              </div>
              <div className="text-3xl font-extrabold text-slate-900 font-heading">
                R$ {totalRevenue.toFixed(2)}
              </div>
              <p className="text-[11px] text-emerald-600 font-semibold">Pedidos faturados e pagos</p>
            </div>
          </div>

          {/* DEDICATED AUTOMATIC VERIFICATION SECTION FOR LOW STOCK ITEMS */}
          {lowStockProducts.length > 0 && (
            <div className="bg-white rounded-3xl border border-rose-200 shadow-xs p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center font-bold">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-heading text-base font-bold text-slate-900 uppercase">
                      Produtos com Saldo Abaixo do Estoque Mínimo
                    </h3>
                    <p className="text-xs text-slate-500">
                      Itens identificados automaticamente pelo sistema que necessitam de pedido de compra ou reposição fabril
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setActiveTab('products');
                      setProductStockFilter('low_stock');
                    }}
                    className="text-xs font-bold text-rose-600 hover:text-rose-700 px-3 py-1.5 rounded-lg border border-rose-200 hover:bg-rose-50 transition-colors flex items-center gap-1"
                  >
                    <Filter className="w-3.5 h-3.5" />
                    <span>Filtrar na Tabela ({lowStockProducts.length})</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {lowStockProducts.map((p) => {
                  const minAlert = p.min_stock_alert || 0;
                  const deficit = Math.max(0, minAlert - p.stock_qty);
                  const healthPct = minAlert > 0 ? Math.min(100, Math.round((p.stock_qty / minAlert) * 100)) : 0;

                  return (
                    <div
                      key={p.id}
                      className="p-4 rounded-2xl border border-rose-200 bg-gradient-to-b from-rose-50/40 to-white flex flex-col justify-between gap-3 hover:shadow-sm transition-all"
                    >
                      <div className="flex items-start gap-3">
                        <img
                          src={p.images[0]}
                          alt={p.name}
                          className="w-14 h-14 object-cover rounded-xl border border-slate-200 shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-mono text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                              {p.code}
                            </span>
                            {p.stock_qty === 0 ? (
                              <span className="px-2 py-0.5 rounded bg-rose-600 text-white text-[9px] font-extrabold uppercase">
                                Zerado
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 text-[9px] font-bold">
                                -{deficit} un do Mín.
                              </span>
                            )}
                          </div>
                          <h4 className="font-bold text-xs text-slate-900 truncate mt-1" title={p.name}>
                            {p.name}
                          </h4>
                          <p className="text-[10px] text-slate-400">
                            {categories.find((c) => c.id === p.categoryId)?.name}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-1.5 bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-xs">
                        <div className="flex justify-between items-center text-[11px]">
                          <span className="text-slate-500">Saldo Físico Atual:</span>
                          <span className="font-extrabold text-rose-600 font-mono text-sm">{p.stock_qty} un</span>
                        </div>
                        <div className="flex justify-between items-center text-[11px]">
                          <span className="text-slate-500">Estoque Mínimo Definido:</span>
                          <span className="font-bold text-slate-700 font-mono">{minAlert} un</span>
                        </div>
                        <div className="flex justify-between items-center text-[11px]">
                          <span className="text-slate-500">Sugestão de Reposição:</span>
                          <span className="font-bold text-amber-700 font-mono">+{deficit + 20} un</span>
                        </div>

                        {/* Health bar */}
                        <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden mt-1">
                          <div
                            className={`h-full ${p.stock_qty === 0 ? 'bg-rose-600' : 'bg-amber-500'}`}
                            style={{ width: `${healthPct}%` }}
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        <button
                          onClick={() => handleQuickRestock(p.id, deficit + 50)}
                          className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Boxes className="w-3.5 h-3.5" />
                          <span>Repor Estoque</span>
                        </button>
                        <button
                          onClick={() => handleEditProduct(p)}
                          className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors"
                          title="Editar cadastro deste produto"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Quick Overview Tables: Recent Quotes & Recent Orders */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Quotes */}
            <div className="p-6 bg-white rounded-3xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-heading text-base font-bold text-slate-900 uppercase">
                  Últimos Orçamentos Recebidos
                </h3>
                <button
                  onClick={() => setActiveTab('quotes')}
                  className="text-xs font-bold text-[#E6007E] hover:underline"
                >
                  Ver Todos
                </button>
              </div>

              <div className="divide-y divide-slate-100">
                {quotes.slice(0, 4).map((q) => (
                  <div key={q.id} className="py-3 flex items-center justify-between text-xs">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-900">{q.code}</span>
                        <span className="text-slate-400 font-normal">
                          {new Date(q.createdAt).toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                      <p className="font-semibold text-slate-700 mt-0.5">{q.clientName} ({q.clientCompany || 'PF'})</p>
                      <p className="text-[11px] text-slate-500">
                        {(q.items || []).length} item(ns) • {(q.items || []).reduce((a, b) => a + (b?.quantity || 0), 0)} unidades
                      </p>
                    </div>

                    <div className="text-right space-y-1">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        q.status === 'pendente' ? 'bg-amber-100 text-amber-800' : 'bg-sky-100 text-sky-800'
                      }`}>
                        {q.status}
                      </span>
                      <div>
                        <button
                          onClick={() => handleOpenAnswerQuote(q)}
                          className="text-[11px] text-[#00AEEF] font-bold hover:underline"
                        >
                          Responder
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Orders */}
            <div className="p-6 bg-white rounded-3xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-heading text-base font-bold text-slate-900 uppercase">
                  Últimos Pedidos em Andamento
                </h3>
                <button
                  onClick={() => setActiveTab('orders')}
                  className="text-xs font-bold text-[#00AEEF] hover:underline"
                >
                  Ver Todos
                </button>
              </div>

              <div className="divide-y divide-slate-100">
                {orders.slice(0, 4).map((o) => (
                  <div key={o.id} className="py-3 flex items-center justify-between text-xs">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-900">{o.code}</span>
                        <span className="text-slate-400 font-normal">
                          {new Date(o.createdAt).toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                      <p className="font-semibold text-slate-700 mt-0.5">{o.clientName}</p>
                      <p className="text-[11px] text-slate-500">
                        {o.items.length} item(ns) • {o.paymentMethod}
                      </p>
                    </div>

                    <div className="text-right space-y-1">
                      <span className="font-bold text-slate-900 font-heading block">
                        R$ {o.total.toFixed(2)}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase inline-block ${
                        o.orderStatus === 'novo' ? 'bg-sky-100 text-sky-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {o.orderStatus.replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: PRODUCTS MANAGEMENT */}
      {activeTab === 'products' && (
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <div className="relative flex-1 max-w-md w-full">
              <input
                type="text"
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                placeholder="Buscar por nome, código SKU..."
                className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-[#00AEEF]"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            </div>

            {/* Quick stock and status filter pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              <button
                onClick={() => setProductStockFilter('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  productStockFilter === 'all'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Todos ({products.length})
              </button>

              <button
                onClick={() => setProductStockFilter('low_stock')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1 cursor-pointer ${
                  productStockFilter === 'low_stock'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : lowStockProducts.length > 0
                    ? 'bg-rose-100 text-rose-800 hover:bg-rose-200 border border-rose-200'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <AlertTriangle className="w-3 h-3" />
                <span>Abaixo do Mínimo ({lowStockProducts.length})</span>
              </button>

              <button
                onClick={() => setProductStockFilter('out_of_stock')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  productStockFilter === 'out_of_stock'
                    ? 'bg-rose-700 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Zerados ({outOfStockProducts.length})
              </button>

              <button
                onClick={() => setProductStockFilter('normal')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  productStockFilter === 'normal'
                    ? 'bg-emerald-700 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Saldo OK ({products.length - lowStockProducts.length})
              </button>

              <button
                onClick={() => setProductStockFilter('active')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  productStockFilter === 'active'
                    ? 'bg-slate-800 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Ativos ({activeProducts})
              </button>

              <button
                onClick={() => setProductStockFilter('banner')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                  productStockFilter === 'banner'
                    ? 'bg-[#E6007E] text-white shadow-xs'
                    : 'bg-pink-50 text-[#E6007E] hover:bg-pink-100 border border-pink-200'
                }`}
              >
                <Flame className="w-3.5 h-3.5 text-[#E6007E]" />
                <span>No Banner ({products.filter((p) => p.showInOffersBanner).length})</span>
              </button>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setActiveTab('financial')}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer border border-slate-200"
                title="Cadastrar, editar e excluir categorias, centros de custo e parâmetros"
              >
                <Tags className="w-3.5 h-3.5 text-pink-500" />
                <span>Gerenciar Categorias & Cadastros</span>
              </button>
              <button
                onClick={handleOpenNewProduct}
                className="px-4 py-2 bg-slate-900 hover:bg-[#E6007E] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Adicionar Novo Produto</span>
              </button>
            </div>
          </div>

          {/* Products Table */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                  <tr>
                    <th className="px-4 py-3">Produto</th>
                    <th className="px-4 py-3">Código SKU</th>
                    <th className="px-4 py-3">Preço Base</th>
                    <th className="px-4 py-3">Faixas de Preço</th>
                    <th className="px-4 py-3">Estoque Físico / Mínimo</th>
                    <th className="px-4 py-3">Modo Loja</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {products
                    .filter((p) => {
                      const matchesSearch = productSearch
                        ? p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
                          p.code.toLowerCase().includes(productSearch.toLowerCase())
                        : true;

                      if (!matchesSearch) return false;

                      if (productStockFilter === 'low_stock') {
                        return p.stock_qty <= (p.min_stock_alert ?? 0) || p.stock_qty === 0;
                      }
                      if (productStockFilter === 'out_of_stock') {
                        return p.stock_qty <= 0;
                      }
                      if (productStockFilter === 'normal') {
                        return p.stock_qty > (p.min_stock_alert ?? 0);
                      }
                      if (productStockFilter === 'active') {
                        return p.is_active;
                      }
                      if (productStockFilter === 'inactive') {
                        return !p.is_active;
                      }
                      if (productStockFilter === 'banner') {
                        return Boolean(p.showInOffersBanner);
                      }
                      return true;
                    })
                    .map((prod) => {
                      const isLow = prod.stock_qty <= (prod.min_stock_alert ?? 0);
                      const isOut = prod.stock_qty <= 0;
                      const deficit = Math.max(0, (prod.min_stock_alert ?? 0) - prod.stock_qty);

                      return (
                        <tr
                          key={prod.id}
                          className={`transition-colors ${
                            isLow
                              ? 'bg-rose-50/50 hover:bg-rose-50/80 border-l-4 border-l-rose-500'
                              : 'hover:bg-slate-50/70'
                          }`}
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <img
                                src={prod.images[0]}
                                alt={prod.name}
                                className="w-10 h-10 object-cover rounded-lg border border-slate-200 shrink-0"
                              />
                              <div>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <p className="font-bold text-slate-900">{prod.name}</p>
                                  {prod.showInOffersBanner && (
                                    <span
                                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-black bg-pink-100 text-[#E6007E] border border-pink-200 shrink-0"
                                      title={`No Banner de Ofertas (Ordem #${prod.offersBannerOrder ?? 1})`}
                                    >
                                      <Flame className="w-2.5 h-2.5 text-[#E6007E]" />
                                      <span>Banner Ofertas #{prod.offersBannerOrder ?? 1}</span>
                                    </span>
                                  )}
                                  {prod.promo_price && prod.promo_price < prod.base_price && (
                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-100 text-emerald-800 shrink-0">
                                      {Math.round(((prod.base_price - prod.promo_price) / prod.base_price) * 100)}% OFF
                                    </span>
                                  )}
                                </div>
                                <p className="text-[10px] text-slate-400">
                                  {categories.find((c) => c.id === prod.categoryId)?.name}
                                </p>
                              </div>
                            </div>
                          </td>

                          <td className="px-4 py-3 font-mono font-semibold text-slate-700">{prod.code}</td>

                          <td className="px-4 py-3 font-bold text-slate-900 font-heading">
                            R$ {prod.base_price.toFixed(2)}
                          </td>

                          <td className="px-4 py-3">
                            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-semibold">
                              {prod.price_tiers?.length || 0} faixas ativas
                            </span>
                          </td>

                          <td className="px-4 py-3">
                            <div>
                              <div className="flex items-baseline gap-1.5">
                                <span
                                  className={`text-sm font-heading ${
                                    isLow ? 'text-rose-600 font-extrabold' : 'text-slate-900 font-bold'
                                  }`}
                                >
                                  {prod.stock_qty} un
                                </span>
                                <span className="text-[10px] text-slate-500 font-normal">
                                  / Mín: {prod.min_stock_alert ?? 0} un
                                </span>
                              </div>

                              {isOut ? (
                                <span className="px-2 py-0.5 rounded bg-rose-600 text-white text-[9px] font-extrabold uppercase flex items-center gap-1 w-fit mt-0.5 shadow-2xs">
                                  <AlertTriangle className="w-2.5 h-2.5" />
                                  <span>Esgotado</span>
                                </span>
                              ) : isLow ? (
                                <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-200 text-[9px] font-bold flex items-center gap-1 w-fit mt-0.5">
                                  <AlertTriangle className="w-2.5 h-2.5 text-rose-600" />
                                  <span>Abaixo do Mínimo (-{deficit} un)</span>
                                </span>
                              ) : (
                                <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[9px] font-semibold flex items-center gap-0.5 w-fit mt-0.5">
                                  <CheckCircle2 className="w-2.5 h-2.5" />
                                  <span>Saldo Normal</span>
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="px-4 py-3">
                            <button
                              onClick={() => handleToggleShowPrice(prod)}
                              className={`px-2.5 py-1 rounded-full text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-all ${
                                prod.show_price
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-amber-50 text-amber-700 border border-amber-200'
                              }`}
                            >
                              {prod.show_price ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                              <span>{prod.show_price ? 'Preço Visível' : 'Sob Orçamento'}</span>
                            </button>
                          </td>

                          <td className="px-4 py-3">
                            <button
                              onClick={() => handleToggleProductStatus(prod)}
                              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase transition-all ${
                                prod.is_active
                                  ? 'bg-slate-900 text-white'
                                  : 'bg-slate-200 text-slate-500'
                              }`}
                            >
                              {prod.is_active ? 'Ativo' : 'Inativo'}
                            </button>
                          </td>

                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {isLow && (
                                <button
                                  onClick={() => handleQuickRestock(prod.id, deficit + 50)}
                                  className="p-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white transition-colors shadow-2xs"
                                  title="Repor estoque agora (Alerta de Mínimo)"
                                >
                                  <Boxes className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button
                                onClick={() => handleEditProduct(prod)}
                                className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                                title="Editar produto e faixas"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteProduct(prod.id)}
                                className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 transition-colors"
                                title="Excluir"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
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

      {/* TAB 3: QUOTES MANAGEMENT */}
      {activeTab === 'quotes' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <h3 className="font-heading text-base font-bold text-slate-900 uppercase">
              Gerenciamento de Cotações Recebidas ({quotes.length})
            </h3>
            <select
              value={quoteFilterStatus}
              onChange={(e) => setQuoteFilterStatus(e.target.value)}
              className="px-3 py-1.5 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
            >
              <option value="all">Todos os Status</option>
              <option value="pendente">Pendentes</option>
              <option value="respondido">Respondidos</option>
              <option value="convertido">Convertidos em Pedido</option>
            </select>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                  <tr>
                    <th className="px-4 py-3">Protocolo</th>
                    <th className="px-4 py-3">Cliente / Empresa</th>
                    <th className="px-4 py-3">Itens Solicitados</th>
                    <th className="px-4 py-3">Prazo Desejado</th>
                    <th className="px-4 py-3">Valor Proposto</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Ações Comerciais</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {quotes
                    .filter((q) => (quoteFilterStatus === 'all' ? true : q.status === quoteFilterStatus))
                    .map((quote) => (
                      <tr key={quote.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-4 py-3 font-mono font-bold text-slate-900">
                          {quote.code}
                          <div className="text-[10px] text-slate-400 font-sans">
                            {new Date(quote.createdAt).toLocaleDateString('pt-BR')}
                          </div>
                        </td>

                        <td className="px-4 py-3">
                          <p className="font-bold text-slate-900">{quote.clientName}</p>
                          <p className="text-[10px] text-slate-500">{quote.clientEmail} • {quote.clientPhone}</p>
                          {quote.clientCompany && (
                            <p className="text-[10px] text-[#00AEEF] font-semibold">{quote.clientCompany}</p>
                          )}
                        </td>

                        <td className="px-4 py-3">
                          <div className="space-y-0.5">
                            {quote.items.map((i) => (
                              <div key={i.id} className="text-[11px] text-slate-700">
                                • {i.quantity} un de <strong>{i.productName}</strong> ({i.customTechnique || 'Laser'})
                              </div>
                            ))}
                          </div>
                        </td>

                        <td className="px-4 py-3 text-slate-600">
                          {quote.deliveryDeadline || 'Não especificado'}
                        </td>

                        <td className="px-4 py-3">
                          {quote.totalEstimated ? (
                            <span className="font-bold text-slate-900 font-heading text-sm">
                              R$ {quote.totalEstimated.toFixed(2)}
                            </span>
                          ) : (
                            <span className="text-amber-600 font-semibold text-[11px]">Aguardando Preço</span>
                          )}
                        </td>

                        <td className="px-4 py-3">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                              quote.status === 'pendente'
                                ? 'bg-amber-100 text-amber-800'
                                : quote.status === 'respondido'
                                ? 'bg-sky-100 text-sky-800'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {quote.status}
                          </span>
                        </td>

                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleOpenAnswerQuote(quote)}
                              className="px-2.5 py-1.5 bg-[#00AEEF] hover:bg-[#0098d1] text-white rounded-lg text-[11px] font-bold transition-colors"
                            >
                              Responder / Precificar
                            </button>

                            {quote.status === 'respondido' && (
                              <button
                                onClick={() => handleConvertQuoteToOrder(quote.id)}
                                className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[11px] font-bold transition-colors"
                                title="Converter em Pedido de Produção"
                              >
                                Gerar Pedido
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: ORDERS & PRODUCTION MANAGEMENT */}
      {activeTab === 'orders' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <h3 className="font-heading text-base font-bold text-slate-900 uppercase">
              Fila de Produção e Pedidos ({orders.length})
            </h3>
            <select
              value={orderFilterStatus}
              onChange={(e) => setOrderFilterStatus(e.target.value)}
              className="px-3 py-1.5 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
            >
              <option value="all">Todos os Pedidos</option>
              <option value="novo">Novos</option>
              <option value="em_producao">Em Produção</option>
              <option value="pronto">Prontos p/ Envio</option>
              <option value="entregue">Entregues</option>
            </select>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                  <tr>
                    <th className="px-4 py-3">Pedido</th>
                    <th className="px-4 py-3">Cliente</th>
                    <th className="px-4 py-3">Itens</th>
                    <th className="px-4 py-3">Valor Total</th>
                    <th className="px-4 py-3">Pagamento</th>
                    <th className="px-4 py-3">Status da Produção</th>
                    <th className="px-4 py-3">Rastreamento</th>
                    <th className="px-4 py-3 text-right">Avançar Etapa</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {orders
                    .filter((o) => (orderFilterStatus === 'all' ? true : o.orderStatus === orderFilterStatus))
                    .map((order) => (
                      <tr key={order.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-4 py-3 font-mono font-bold text-slate-900">
                          {order.code}
                          <div className="text-[10px] text-slate-400 font-sans">
                            {new Date(order.createdAt).toLocaleDateString('pt-BR')}
                          </div>
                        </td>

                        <td className="px-4 py-3">
                          <p className="font-bold text-slate-900">{order.clientName}</p>
                          <p className="text-[10px] text-slate-500">{order.clientEmail}</p>
                        </td>

                        <td className="px-4 py-3">
                          <div className="space-y-0.5">
                            {order.items.map((i) => (
                              <div key={i.id} className="text-[11px] text-slate-700">
                                • {i.quantity} un de {i.productName}
                              </div>
                            ))}
                          </div>
                        </td>

                        <td className="px-4 py-3 font-bold text-slate-900 font-heading text-sm">
                          R$ {order.total.toFixed(2)}
                        </td>

                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              order.paymentStatus === 'pago'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {order.paymentStatus} ({order.paymentMethod})
                          </span>
                        </td>

                        <td className="px-4 py-3">
                          <select
                            value={order.orderStatus}
                            onChange={(e) => handleUpdateOrderStatus(order.id, e.target.value as any)}
                            className="px-2 py-1 bg-slate-100 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-none"
                          >
                            <option value="novo">Novo Pedido</option>
                            <option value="em_producao">Em Produção</option>
                            <option value="pronto">Pronto p/ Envio</option>
                            <option value="entregue">Entregue</option>
                            <option value="cancelado">Cancelado</option>
                          </select>
                        </td>

                        <td className="px-4 py-3">
                          {order.trackingCode ? (
                            <span className="font-mono font-semibold text-slate-900">{order.trackingCode}</span>
                          ) : (
                            <button
                              onClick={() => handleUpdateTracking(order.id)}
                              className="text-[11px] text-[#00AEEF] font-bold hover:underline"
                            >
                              + Inserir Rastreio
                            </button>
                          )}
                        </td>

                        <td className="px-4 py-3 text-right">
                          {order.orderStatus === 'novo' && (
                            <button
                              onClick={() => handleUpdateOrderStatus(order.id, 'em_producao')}
                              className="px-2.5 py-1 bg-slate-900 hover:bg-[#E6007E] text-white rounded-lg text-[11px] font-bold transition-colors"
                            >
                              Iniciar Produção
                            </button>
                          )}
                          {order.orderStatus === 'em_producao' && (
                            <button
                              onClick={() => handleUpdateOrderStatus(order.id, 'pronto')}
                              className="px-2.5 py-1 bg-[#00AEEF] hover:bg-[#0098d1] text-white rounded-lg text-[11px] font-bold transition-colors"
                            >
                              Marcar Pronto
                            </button>
                          )}
                          {order.orderStatus === 'pronto' && (
                            <button
                              onClick={() => handleUpdateOrderStatus(order.id, 'entregue')}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[11px] font-bold transition-colors"
                            >
                              Concluir Entrega
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: STOCK & INVENTORY */}
      {activeTab === 'stock' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-heading text-base font-bold text-slate-900 uppercase">
                  Controle de Estoque Físico & Matérias-Primas
                </h3>
                {lowStockProducts.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-rose-600 text-white text-[10px] font-extrabold uppercase animate-pulse">
                    {lowStockProducts.length} em alerta
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">Saldo atualizado em tempo real por vendas e movimentações manuais</p>
            </div>
            <button
              onClick={() => setIsStockModalOpen(true)}
              className="px-4 py-2 bg-slate-900 hover:bg-[#E6007E] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Lançar Entrada / Saída</span>
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Products Stock Balance Table (8 cols) */}
            <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between gap-2 flex-wrap">
                <span className="font-bold text-xs uppercase text-slate-700">Saldo Atual por Produto</span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setStockTableFilter('all')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      stockTableFilter === 'all'
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Todos ({products.length})
                  </button>
                  <button
                    onClick={() => setStockTableFilter('low_stock')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                      stockTableFilter === 'low_stock'
                        ? 'bg-rose-600 text-white'
                        : lowStockProducts.length > 0
                        ? 'bg-rose-100 text-rose-800 hover:bg-rose-200'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    <AlertTriangle className="w-3 h-3" />
                    <span>Em Alerta ({lowStockProducts.length})</span>
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                    <tr>
                      <th className="px-4 py-3">Produto</th>
                      <th className="px-4 py-3">SKU</th>
                      <th className="px-4 py-3">Estoque Físico</th>
                      <th className="px-4 py-3">Estoque Mínimo</th>
                      <th className="px-4 py-3">Déficit / Compras</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {products
                      .filter((p) => {
                        if (stockTableFilter === 'low_stock') {
                          return p.stock_qty <= (p.min_stock_alert ?? 0) || p.stock_qty === 0;
                        }
                        return true;
                      })
                      .map((p) => {
                        const isLow = p.stock_qty <= (p.min_stock_alert ?? 0);
                        const isOut = p.stock_qty <= 0;
                        const deficit = Math.max(0, (p.min_stock_alert ?? 0) - p.stock_qty);

                        return (
                          <tr
                            key={p.id}
                            className={`transition-colors ${
                              isLow
                                ? 'bg-rose-50/50 hover:bg-rose-50/80 border-l-4 border-l-rose-500'
                                : 'hover:bg-slate-50'
                            }`}
                          >
                            <td className="px-4 py-3 font-semibold text-slate-900">
                              <div className="flex items-center gap-2.5">
                                <img
                                  src={p.images[0]}
                                  alt={p.name}
                                  className="w-8 h-8 rounded-lg object-cover border border-slate-200 shrink-0"
                                />
                                <span className="truncate max-w-[200px]" title={p.name}>
                                  {p.name}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-3 font-mono text-slate-600">{p.code}</td>
                            <td className="px-4 py-3">
                              <span className={`font-bold font-heading text-sm ${isLow ? 'text-rose-600 font-extrabold' : 'text-slate-900'}`}>
                                {p.stock_qty} un
                              </span>
                            </td>
                            <td className="px-4 py-3 text-slate-500 font-mono">{p.min_stock_alert ?? 0} un</td>
                            <td className="px-4 py-3 font-mono">
                              {deficit > 0 ? (
                                <span className="font-bold text-rose-600">-{deficit} un</span>
                              ) : (
                                <span className="text-emerald-700 text-[11px] font-semibold">+{p.stock_qty - (p.min_stock_alert ?? 0)} un</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {isOut ? (
                                <span className="px-2 py-0.5 rounded bg-rose-600 text-white text-[9px] font-extrabold uppercase flex items-center gap-1 w-fit">
                                  <AlertTriangle className="w-2.5 h-2.5" /> Zerado
                                </span>
                              ) : isLow ? (
                                <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 text-[9px] font-bold uppercase flex items-center gap-1 w-fit border border-rose-200">
                                  <AlertTriangle className="w-2.5 h-2.5" /> Abaixo Mínimo
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[9px] font-bold uppercase">
                                  Normal
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <button
                                onClick={() => handleQuickRestock(p.id, deficit > 0 ? deficit + 50 : 50)}
                                className="px-2 py-1 bg-slate-900 hover:bg-[#E6007E] text-white rounded-lg text-[10px] font-bold transition-colors inline-flex items-center gap-1 cursor-pointer"
                                title="Lançar entrada no estoque"
                              >
                                <Boxes className="w-3 h-3" />
                                <span>+ Repor</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Recent Stock Audit History (4 cols) */}
            <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3">
              <h4 className="font-bold text-xs uppercase text-slate-800 border-b border-slate-100 pb-2">
                Histórico de Movimentações
              </h4>
              <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto space-y-2">
                {stockMovements.map((mov) => (
                  <div key={mov.id} className="pt-2 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-900">{mov.productName}</span>
                      <span
                        className={`font-bold font-mono ${
                          mov.type === 'entrada' ? 'text-emerald-600' : 'text-rose-600'
                        }`}
                      >
                        {mov.type === 'entrada' ? `+${mov.quantity}` : `-${mov.quantity}`} un
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500">{mov.reason}</p>
                    <div className="flex items-center justify-between text-[9px] text-slate-400">
                      <span>{mov.user}</span>
                      <span>{new Date(mov.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB: GESTÃO DE ENTREGAS & FRETES */}
      {activeTab === 'delivery_orders' && (
        <DeliveryOrdersTab
          orders={orders}
          onRefreshData={refreshAll}
        />
      )}

      {/* TAB 6: USER MANAGEMENT & PERMISSIONS MATRIX */}
      {activeTab === 'users' && canManageUsers && (
        <UserManagementTab currentUser={currentUser} />
      )}
      {activeTab === 'users' && !canManageUsers && (
        <div className="bg-white rounded-3xl border border-rose-200 p-8 sm:p-12 text-center max-w-2xl mx-auto my-8 shadow-xs space-y-4">
          <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-2xl mx-auto flex items-center justify-center shadow-xs">
            <Lock className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-xl font-heading font-black uppercase text-slate-900">
              Acesso Restrito: Usuários & Permissões
            </h3>
            <p className="text-xs text-slate-600 mt-2 leading-relaxed">
              O seu perfil atual (<strong className="capitalize text-slate-900">{currentUser.role}</strong>) não possui permissão de gestão de usuários (<code className="text-rose-600 font-mono font-bold">canManageUsers</code>).
            </p>
            <p className="text-xs text-slate-500 mt-2">
              Para acessar esta área, solicite permissão a um Administrador ou alterne para a conta de Administrador no seletor de perfil (RoleSwitcher).
            </p>
            <div className="pt-3">
              <button
                type="button"
                onClick={() => {
                  StorageService.switchRole('admin');
                  window.dispatchEvent(new CustomEvent('mb_storage_updated'));
                  refreshAll();
                }}
                className="px-5 py-2.5 bg-slate-900 hover:bg-[#E6007E] text-white text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer inline-flex items-center gap-2"
              >
                <Shield className="w-4 h-4 text-[#FFDD00]" />
                <span>Alternar para Administrador Geral</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 7: COMPANY SETTINGS & LOGO */}
      {activeTab === 'company' && canManageCompany && (
        <CompanySettingsTab currentUser={currentUser} onNavigate={onNavigate} />
      )}

      {/* TAB: CONFIGURAÇÕES DE ATENDIMENTO E ENTREGA */}
      {activeTab === 'delivery_settings' && canManageDelivery && (
        <DeliverySettingsTab />
      )}

      {/* TAB: SYSTEM LAYOUT CUSTOMIZATION */}
      {activeTab === 'layout' && canCustomizeLayout && (
        <LayoutCustomizationTab onRefreshData={refreshAll} />
      )}

      {/* TAB: OFFERS BANNER DEDICATED MANAGEMENT */}
      {activeTab === 'offers_banner' && canCustomizeLayout && (
        <LayoutCustomizationTab onRefreshData={refreshAll} initialTab="offers_banner" />
      )}

      {/* TAB 8: SITE METRICS & ANALYTICS (INSTAGRAM INSIGHTS STYLE) */}
      {activeTab === 'metrics' && canViewSiteMetrics && (
        <SiteMetricsView currentUser={currentUser} onNavigate={onNavigate} />
      )}

      {/* TAB 9: STRICKER BRASIL / SPOT WEBSERVICE INTEGRATION */}
      {activeTab === 'stricker' && (
        <StrickerIntegrationTab onRefreshData={refreshAll} />
      )}

      {/* TAB 10: FINANCIAL TRANSACTIONS & PAYMENTS */}
      {activeTab === 'transactions' && canViewTransactions && (
        <PaymentTransactionsTab currentUser={currentUser} />
      )}

      {/* TAB 11: PAYMENT GATEWAYS (MERCADO PAGO & PAGBANK) */}
      {activeTab === 'gateways' && canManageGateways && (
        <PaymentGatewaysTab />
      )}

      {/* TAB 12: CASH REGISTER SESSIONS & CONTROL */}
      {activeTab === 'cash_register' && (
        <CashRegisterTab />
      )}

      {/* TAB 13: MÓDULO FINANCEIRO (CONTROLE DE ACESSO RESTRITO) */}
      {activeTab === 'financial' && (
        <FinancialModuleView
          currentUser={currentUser}
          onNavigate={onNavigate}
        />
      )}

      {/* TAB: BOLETOS BANCÁRIOS & FATURAMENTO A PRAZO (FEBRABAN) */}
      {activeTab === 'boletos' && (
        <BoletoBillingManagementTab currentUser={currentUser} />
      )}

      {/* TAB: MÓDULO DE ORÇAMENTO DE CUSTOS & PRECIFICAÇÃO (14 SUBMÓDULOS) */}
      {activeTab === 'cost_pricing' && (
        <CostPricingModuleView currentUser={currentUser} />
      )}

      {/* TAB 14: BACKUP AGENDADO & RECUPERAÇÃO DE DESASTRES (JSON SEGURO) */}
      {activeTab === 'backup' && (
        <DisasterRecoveryBackupTab
          currentUser={currentUser}
          onNavigate={onNavigate}
          onRefreshData={refreshAll}
        />
      )}

      {/* MODAL: CREATE / EDIT PRODUCT WITH PRICE TIERS */}
      {isProductModalOpen && editingProduct && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl border border-slate-200 max-w-3xl w-full p-6 sm:p-8 space-y-6 shadow-2xl my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h3 className="font-heading text-xl font-extrabold uppercase text-slate-900">
                {editingProduct.id.startsWith('prod-') && !products.some((p) => p.id === editingProduct.id)
                  ? 'Cadastrar Novo Produto'
                  : `Editar Produto: ${editingProduct.name}`}
              </h3>
              <button
                onClick={() => setIsProductModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Nome do Produto *</label>
                  <input
                    type="text"
                    required
                    value={editingProduct.name}
                    onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })}
                    placeholder="Ex: Copo Térmico Personalizado 473ml"
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-[#00AEEF]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Código / SKU *</label>
                  <input
                    type="text"
                    required
                    value={editingProduct.code}
                    onChange={(e) => setEditingProduct({ ...editingProduct, code: e.target.value })}
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-[#00AEEF]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Categoria Principal</label>
                  <select
                    value={editingProduct.categoryId}
                    onChange={(e) => setEditingProduct({ ...editingProduct, categoryId: e.target.value })}
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Preço Base Unitário (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editingProduct.base_price}
                    onChange={(e) =>
                      setEditingProduct({ ...editingProduct, base_price: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Preço Promo (Opcional)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editingProduct.promo_price || ''}
                    onChange={(e) =>
                      setEditingProduct({
                        ...editingProduct,
                        promo_price: e.target.value ? parseFloat(e.target.value) : undefined,
                      })
                    }
                    placeholder="Deixe em branco se não houver"
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Pedido Mínimo (un)</label>
                  <input
                    type="number"
                    value={editingProduct.min_order_qty}
                    onChange={(e) =>
                      setEditingProduct({ ...editingProduct, min_order_qty: parseInt(e.target.value) || 1 })
                    }
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Estoque Físico Atual (un) *</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={editingProduct.stock_qty}
                    onChange={(e) =>
                      setEditingProduct({ ...editingProduct, stock_qty: parseInt(e.target.value) || 0 })
                    }
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-[#00AEEF]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Estoque Mínimo para Alerta (un) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={editingProduct.min_stock_alert ?? 0}
                    onChange={(e) =>
                      setEditingProduct({ ...editingProduct, min_stock_alert: parseInt(e.target.value) || 0 })
                    }
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-[#00AEEF]"
                  />
                </div>

                {/* Real-time Stock Status Preview Banner */}
                <div className="sm:col-span-2">
                  {editingProduct.stock_qty <= (editingProduct.min_stock_alert ?? 0) ? (
                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2.5 text-xs text-rose-800">
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                      <div>
                        <span className="font-bold">Atenção:</span> O saldo configurado ({editingProduct.stock_qty} un) está abaixo ou igual ao estoque mínimo ({editingProduct.min_stock_alert ?? 0} un). Este produto acionará o alerta automático de compras.
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2.5 text-xs text-emerald-800">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <div>
                        <span className="font-bold">Estoque Regular:</span> O saldo ({editingProduct.stock_qty} un) está acima da margem de segurança ({editingProduct.min_stock_alert ?? 0} un).
                      </div>
                    </div>
                  )}
                </div>

                <div className="sm:col-span-2 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-slate-700">Imagem Principal do Produto</label>
                    <label className="text-[11px] font-bold text-[#00AEEF] hover:text-[#009bd6] cursor-pointer flex items-center gap-1">
                      <span>Anexar do Dispositivo</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = (ev) => {
                              const dataUrl = ev.target?.result as string;
                              setEditingProduct({
                                ...editingProduct,
                                images: [dataUrl, ...editingProduct.images.slice(1)],
                              });
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                    </label>
                  </div>
                  <div className="flex items-center gap-3">
                    {editingProduct.images[0] && (
                      <img
                        src={editingProduct.images[0]}
                        alt="Preview"
                        className="w-10 h-10 rounded-lg object-cover border border-slate-200 shrink-0 bg-white"
                      />
                    )}
                    <input
                      type="url"
                      placeholder="https://... ou anexe um arquivo do dispositivo acima"
                      value={editingProduct.images[0] || ''}
                      onChange={(e) =>
                        setEditingProduct({
                          ...editingProduct,
                          images: [e.target.value, ...editingProduct.images.slice(1)],
                        })
                      }
                      className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                    />
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Descrição Comercial</label>
                  <textarea
                    rows={2}
                    value={editingProduct.description}
                    onChange={(e) => setEditingProduct({ ...editingProduct, description: e.target.value })}
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                  />
                </div>
              </div>

              {/* Price Tiers Manager */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-xs text-slate-900 uppercase">Faixas de Preço por Quantidade</h4>
                    <p className="text-[10px] text-slate-500">Configure descontos automáticos por volume</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const newTiers = [...(editingProduct.price_tiers || [])];
                      newTiers.push({
                        id: `pt-${Date.now()}`,
                        min_qty: 100,
                        max_qty: 299,
                        unit_price: editingProduct.base_price * 0.9,
                        discount_pct: 10,
                      });
                      setEditingProduct({ ...editingProduct, price_tiers: newTiers });
                    }}
                    className="text-xs font-bold text-[#00AEEF] hover:underline flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" /> Adicionar Faixa
                  </button>
                </div>

                <div className="space-y-2">
                  {editingProduct.price_tiers?.map((tier, idx) => (
                    <div key={tier.id} className="flex items-center gap-2 text-xs">
                      <span className="text-[11px] font-bold text-slate-500 w-14">Faixa {idx + 1}:</span>
                      <input
                        type="number"
                        placeholder="Mín"
                        value={tier.min_qty}
                        onChange={(e) => {
                          const newTiers = [...(editingProduct.price_tiers || [])];
                          newTiers[idx].min_qty = parseInt(e.target.value) || 1;
                          setEditingProduct({ ...editingProduct, price_tiers: newTiers });
                        }}
                        className="w-20 px-2 py-1 bg-white border border-slate-200 rounded-lg text-center"
                      />
                      <span>a</span>
                      <input
                        type="number"
                        placeholder="Máx (vazio = +)"
                        value={tier.max_qty || ''}
                        onChange={(e) => {
                          const newTiers = [...(editingProduct.price_tiers || [])];
                          newTiers[idx].max_qty = e.target.value ? parseInt(e.target.value) : undefined;
                          setEditingProduct({ ...editingProduct, price_tiers: newTiers });
                        }}
                        className="w-24 px-2 py-1 bg-white border border-slate-200 rounded-lg text-center"
                      />
                      <span>= R$</span>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="Preço Unit"
                        value={tier.unit_price}
                        onChange={(e) => {
                          const newTiers = [...(editingProduct.price_tiers || [])];
                          newTiers[idx].unit_price = parseFloat(e.target.value) || 0;
                          setEditingProduct({ ...editingProduct, price_tiers: newTiers });
                        }}
                        className="w-24 px-2 py-1 bg-white border border-slate-200 rounded-lg text-center font-bold text-slate-900"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const newTiers = editingProduct.price_tiers?.filter((_, i) => i !== idx);
                          setEditingProduct({ ...editingProduct, price_tiers: newTiers });
                        }}
                        className="p-1 text-slate-400 hover:text-rose-600"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* CONFIGURAÇÃO PARA O BANNER DE OFERTAS */}
              <div className="p-4 sm:p-5 rounded-2xl border border-pink-200 bg-pink-50/50 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span className="p-2 rounded-xl bg-[#E6007E] text-white shadow-xs">
                      <Flame className="w-4 h-4 text-[#FFDD00]" />
                    </span>
                    <div>
                      <h4 className="text-xs font-black uppercase text-slate-900 tracking-wider">
                        Exibir no Banner de Ofertas
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        Destacar este produto no carrossel de ofertas com transição na página inicial da loja
                      </p>
                    </div>
                  </div>

                  {/* Radio / Select Sim / Não */}
                  <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-pink-200 shadow-2xs self-start sm:self-auto">
                    <button
                      type="button"
                      onClick={() => setEditingProduct({ ...editingProduct, showInOffersBanner: true })}
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                        editingProduct.showInOffersBanner
                          ? 'bg-[#E6007E] text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                      }`}
                    >
                      Sim
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingProduct({ ...editingProduct, showInOffersBanner: false })}
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                        !editingProduct.showInOffersBanner
                          ? 'bg-slate-800 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                      }`}
                    >
                      Não
                    </button>
                  </div>
                </div>

                {editingProduct.showInOffersBanner && (
                  <div className="pt-3 border-t border-pink-200/80 space-y-3.5">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          Ordem de Exibição no Banner
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={editingProduct.offersBannerOrder ?? 1}
                          onChange={(e) =>
                            setEditingProduct({
                              ...editingProduct,
                              offersBannerOrder: parseInt(e.target.value) || 1,
                            })
                          }
                          className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl font-bold"
                          placeholder="Ex: 1"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          Preço Promocional (R$)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={editingProduct.promo_price ?? ''}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            setEditingProduct({
                              ...editingProduct,
                              promo_price: !isNaN(val) && val > 0 ? val : undefined,
                            });
                          }}
                          className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl font-bold text-pink-600"
                          placeholder="Ex: 39.90"
                        />
                        {editingProduct.promo_price && editingProduct.base_price > 0 && editingProduct.promo_price < editingProduct.base_price && (
                          <span className="text-[10px] font-bold text-emerald-600 mt-1 block">
                            Desconto de {Math.round(((editingProduct.base_price - editingProduct.promo_price) / editingProduct.base_price) * 100)}% (Economia: R$ {(editingProduct.base_price - editingProduct.promo_price).toFixed(2)})
                          </span>
                        )}
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          Selo de Destaque / Badge
                        </label>
                        <input
                          type="text"
                          value={editingProduct.offersBannerBadge || ''}
                          onChange={(e) =>
                            setEditingProduct({
                              ...editingProduct,
                              offersBannerBadge: e.target.value,
                            })
                          }
                          placeholder="Ex: OFERTA ESPECIAL"
                          className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl uppercase font-bold text-slate-800"
                        />
                      </div>
                    </div>

                    {/* Periodo da Oferta */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          Início da Oferta (Data/Hora)
                        </label>
                        <input
                          type="date"
                          value={editingProduct.offerStartDate || ''}
                          onChange={(e) =>
                            setEditingProduct({
                              ...editingProduct,
                              offerStartDate: e.target.value,
                            })
                          }
                          className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          Término da Oferta (Data/Hora)
                        </label>
                        <input
                          type="date"
                          value={editingProduct.offerEndDate || ''}
                          onChange={(e) =>
                            setEditingProduct({
                              ...editingProduct,
                              offerEndDate: e.target.value,
                            })
                          }
                          className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl"
                        />
                      </div>
                    </div>

                    {/* Imagem específica para o banner */}
                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-bold text-slate-700">
                        Imagem Específica para o Banner (Opcional)
                      </label>
                      <p className="text-[10px] text-slate-500">
                        Se não definida, o banner exibirá automaticamente a foto principal já cadastrada do produto.
                      </p>
                      <div className="flex items-center gap-3">
                        {editingProduct.offersBannerImage ? (
                          <img
                            src={editingProduct.offersBannerImage}
                            alt="Banner Preview"
                            className="w-12 h-12 rounded-xl object-cover border border-slate-300 shadow-2xs shrink-0"
                          />
                        ) : (
                          editingProduct.images && editingProduct.images[0] && (
                            <img
                              src={editingProduct.images[0]}
                              alt="Foto Principal"
                              className="w-12 h-12 rounded-xl object-cover border border-slate-200 opacity-60 shrink-0"
                              title="Foto principal atual"
                            />
                          )
                        )}
                        <input
                          type="text"
                          value={editingProduct.offersBannerImage || ''}
                          onChange={(e) =>
                            setEditingProduct({
                              ...editingProduct,
                              offersBannerImage: e.target.value,
                            })
                          }
                          placeholder="URL da imagem específica ou cole imagem base64"
                          className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl font-mono text-slate-700"
                        />
                        {editingProduct.offersBannerImage && (
                          <button
                            type="button"
                            onClick={() =>
                              setEditingProduct({ ...editingProduct, offersBannerImage: undefined })
                            }
                            className="text-xs text-rose-500 hover:text-rose-700 font-bold whitespace-nowrap cursor-pointer"
                          >
                            Usar Principal
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* DADOS LOGÍSTICOS E DIMENSÕES PARA CÁLCULO DE FRETE */}
              <div className="p-4 sm:p-5 rounded-2xl border border-sky-200 bg-sky-50/50 space-y-4">
                <div className="flex items-center gap-2.5">
                  <span className="p-2 rounded-xl bg-[#00AEEF] text-white shadow-xs">
                    <Truck className="w-4 h-4" />
                  </span>
                  <div>
                    <h4 className="text-xs font-black uppercase text-slate-900 tracking-wider">
                      Dimensões & Logística para Cálculo de Frete (Correios e Transportadoras)
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Peso e medidas com embalagem necessários para cotação real por CEP e consolidação de frete
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Peso Embalado (kg) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={editingProduct.shippingDimensions?.weightKg ?? 0.35}
                      onChange={(e) =>
                        setEditingProduct({
                          ...editingProduct,
                          shippingDimensions: {
                            ...(editingProduct.shippingDimensions || {
                              heightCm: 10,
                              widthCm: 15,
                              lengthCm: 20,
                            }),
                            weightKg: parseFloat(e.target.value) || 0.05,
                          },
                        })
                      }
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl font-bold font-mono text-slate-900"
                      placeholder="Ex: 0.35"
                    />
                    <span className="text-[10px] text-slate-400 mt-0.5 block">Ex: 0.35 = 350g</span>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Comprimento (cm) *
                    </label>
                    <input
                      type="number"
                      min="2"
                      value={editingProduct.shippingDimensions?.lengthCm ?? 20}
                      onChange={(e) =>
                        setEditingProduct({
                          ...editingProduct,
                          shippingDimensions: {
                            ...(editingProduct.shippingDimensions || {
                              weightKg: 0.35,
                              heightCm: 10,
                              widthCm: 15,
                            }),
                            lengthCm: parseInt(e.target.value) || 16,
                          },
                        })
                      }
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl font-bold font-mono text-slate-900"
                      placeholder="Ex: 20"
                    />
                    <span className="text-[10px] text-slate-400 mt-0.5 block">Mínimo 16 cm</span>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Largura (cm) *
                    </label>
                    <input
                      type="number"
                      min="2"
                      value={editingProduct.shippingDimensions?.widthCm ?? 15}
                      onChange={(e) =>
                        setEditingProduct({
                          ...editingProduct,
                          shippingDimensions: {
                            ...(editingProduct.shippingDimensions || {
                              weightKg: 0.35,
                              heightCm: 10,
                              lengthCm: 20,
                            }),
                            widthCm: parseInt(e.target.value) || 11,
                          },
                        })
                      }
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl font-bold font-mono text-slate-900"
                      placeholder="Ex: 15"
                    />
                    <span className="text-[10px] text-slate-400 mt-0.5 block">Mínimo 11 cm</span>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Altura (cm) *
                    </label>
                    <input
                      type="number"
                      min="2"
                      value={editingProduct.shippingDimensions?.heightCm ?? 10}
                      onChange={(e) =>
                        setEditingProduct({
                          ...editingProduct,
                          shippingDimensions: {
                            ...(editingProduct.shippingDimensions || {
                              weightKg: 0.35,
                              widthCm: 15,
                              lengthCm: 20,
                            }),
                            heightCm: parseInt(e.target.value) || 2,
                          },
                        })
                      }
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl font-bold font-mono text-slate-900"
                      placeholder="Ex: 10"
                    />
                    <span className="text-[10px] text-slate-400 mt-0.5 block">Mínimo 2 cm</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-sky-200/80">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-800">
                    <input
                      type="checkbox"
                      checked={Boolean(editingProduct.shippingDimensions?.specialPackaging)}
                      onChange={(e) =>
                        setEditingProduct({
                          ...editingProduct,
                          shippingDimensions: {
                            ...(editingProduct.shippingDimensions || {
                              weightKg: 0.35,
                              lengthCm: 20,
                              widthCm: 15,
                              heightCm: 10,
                            }),
                            specialPackaging: e.target.checked,
                          },
                        })
                      }
                      className="w-4 h-4 rounded text-[#00AEEF]"
                    />
                    <span>Requer embalagem reforçada / especial (frágil)</span>
                  </label>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Restrição de Envio Logístico
                    </label>
                    <select
                      value={editingProduct.shippingDimensions?.shippingRestrictions || 'none'}
                      onChange={(e) =>
                        setEditingProduct({
                          ...editingProduct,
                          shippingDimensions: {
                            ...(editingProduct.shippingDimensions || {
                              weightKg: 0.35,
                              lengthCm: 20,
                              widthCm: 15,
                              heightCm: 10,
                            }),
                            shippingRestrictions: e.target.value as any,
                          },
                        })
                      }
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-xl"
                    >
                      <option value="none">Sem restrições (Correios e Transportadora)</option>
                      <option value="only_local">Somente Retirada Local / Frota Própria</option>
                      <option value="no_correios">Apenas Transportadora (Não enviar via Correios)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Toggles */}
              <div className="flex items-center gap-6 pt-2">
                <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingProduct.show_price}
                    onChange={(e) => setEditingProduct({ ...editingProduct, show_price: e.target.checked })}
                    className="w-4 h-4 rounded text-[#00AEEF]"
                  />
                  <span>Exibir Preço no Site (Desmarque para 'Sob Orçamento')</span>
                </label>

                <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingProduct.is_active}
                    onChange={(e) => setEditingProduct({ ...editingProduct, is_active: e.target.checked })}
                    className="w-4 h-4 rounded text-slate-900"
                  />
                  <span>Produto Ativo no Catálogo</span>
                </label>
              </div>

              {/* Footer */}
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsProductModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-slate-900 hover:bg-[#E6007E] text-white font-bold text-xs rounded-xl shadow-md transition-colors"
                >
                  Salvar Produto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ANSWER QUOTE PROPOSAL */}
      {answeringQuote && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl border border-slate-200 max-w-2xl w-full p-6 sm:p-8 space-y-6 shadow-2xl my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <span className="text-xs font-bold uppercase text-[#00AEEF]">Resposta Comercial</span>
                <h3 className="font-heading text-xl font-extrabold uppercase text-slate-900">
                  Precificar Orçamento {answeringQuote.code}
                </h3>
              </div>
              <button
                onClick={() => setAnsweringQuote(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveQuoteResponse} className="space-y-6">
              <div className="p-4 bg-slate-50 rounded-2xl space-y-2 text-xs">
                <p><strong>Cliente:</strong> {answeringQuote.clientName} ({answeringQuote.clientCompany || 'PF'})</p>
                <p><strong>Contato:</strong> {answeringQuote.clientEmail} • {answeringQuote.clientPhone}</p>
                {answeringQuote.notes && <p><strong>Obs do Cliente:</strong> {answeringQuote.notes}</p>}
                {answeringQuote.artworkName && (
                  <p className="text-emerald-700 font-semibold">
                    📎 Arquivo de Logo Anexo: {answeringQuote.artworkName}
                  </p>
                )}
              </div>

              {/* Items pricing inputs */}
              <div className="space-y-3">
                <h4 className="font-bold text-xs text-slate-900 uppercase">Valores Unitários por Item</h4>
                {answeringQuote.items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-4 p-3 bg-slate-50/70 rounded-xl border border-slate-200 text-xs">
                    <div className="flex-1">
                      <p className="font-bold text-slate-900">{item.productName}</p>
                      <p className="text-[10px] text-slate-500">{item.quantity} unidades • {item.customTechnique || 'Personalizado'}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-slate-500 font-bold">R$</span>
                      <input
                        type="number"
                        step="0.01"
                        required
                        value={quoteItemPrices[item.id] || ''}
                        onChange={(e) =>
                          setQuoteItemPrices({
                            ...quoteItemPrices,
                            [item.id]: parseFloat(e.target.value) || 0,
                          })
                        }
                        placeholder="0.00"
                        className="w-24 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-center font-bold text-slate-900 focus:outline-none"
                      />
                      <span className="text-[10px] text-slate-400">/un</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Prazo de Produção (Dias Úteis)</label>
                  <input
                    type="number"
                    value={quoteProductionDays}
                    onChange={(e) => setQuoteProductionDays(parseInt(e.target.value) || 1)}
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Validade da Proposta</label>
                  <input
                    type="text"
                    readOnly
                    value="15 dias corridos"
                    className="w-full px-3.5 py-2 text-xs bg-slate-100 border border-slate-200 rounded-xl text-slate-500 select-none"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Mensagem Comercial / Observações Técnicas</label>
                  <textarea
                    rows={3}
                    value={quoteAdminNotes}
                    onChange={(e) => setQuoteAdminNotes(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                  />
                </div>
              </div>

              {/* Condições de Pagamento e Faturamento por Boleto (Seção 3 do Regulamento) */}
              <div className="p-4 bg-indigo-50/60 rounded-2xl border border-indigo-200/80 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-indigo-700" />
                    <h4 className="font-bold text-xs text-indigo-950 uppercase">
                      Condição de Pagamento & Faturamento por Boleto
                    </h4>
                  </div>
                  <span className="text-[10px] font-bold text-indigo-700 px-2 py-0.5 rounded bg-white border border-indigo-200">
                    Regras Comerciais
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setQuoteBillingType('a_vista');
                      setQuoteIsDeferredAuthorized(false);
                      setQuoteConditionName('À Vista (2 dias úteis)');
                    }}
                    className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                      quoteBillingType === 'a_vista'
                        ? 'bg-white border-indigo-600 ring-2 ring-indigo-400'
                        : 'bg-white/60 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="font-bold text-xs text-slate-900">Boleto à Vista</div>
                    <div className="text-[11px] text-slate-500">
                      Vencimento padrão em 2 dias úteis (Sem parcelamento)
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setQuoteBillingType('faturado_prazo');
                      setQuoteIsDeferredAuthorized(true);
                      setQuoteConditionName('28 DDL');
                    }}
                    className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                      quoteBillingType === 'faturado_prazo'
                        ? 'bg-white border-[#E6007E] ring-2 ring-[#E6007E]'
                        : 'bg-white/60 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-slate-900">Faturamento a Prazo</span>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-purple-100 text-purple-800">
                        EXCEÇÃO NEGOCIADA
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Boleto faturado com prazo e parcelas autorizadas
                    </div>
                  </button>
                </div>

                {quoteBillingType === 'faturado_prazo' && (
                  <div className="p-3 bg-white rounded-xl border border-indigo-200 space-y-3">
                    <label className="flex items-start gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={quoteIsDeferredAuthorized}
                        onChange={(e) => setQuoteIsDeferredAuthorized(e.target.checked)}
                        className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500"
                      />
                      <div className="text-xs">
                        <span className="font-bold text-slate-900 block">
                          Autorizar Expressamente Faturamento a Prazo nesta Proposta
                        </span>
                        <span className="text-[11px] text-slate-500">
                          O cliente poderá emitir boletos a prazo no aceite ou na conversão comercial.
                        </span>
                      </div>
                    </label>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          Condição de Pagamento Negociada
                        </label>
                        <select
                          value={quoteConditionName}
                          onChange={(e) => {
                            const val = e.target.value;
                            setQuoteConditionName(val);
                            if (val === '28 DDL') {
                              setQuoteInstallmentsCount(1);
                              setQuoteDaysInterval([28]);
                            } else if (val === '30/60 DDL') {
                              setQuoteInstallmentsCount(2);
                              setQuoteDaysInterval([30, 60]);
                            } else if (val === '30/60/90 DDL') {
                              setQuoteInstallmentsCount(3);
                              setQuoteDaysInterval([30, 60, 90]);
                            } else if (val === '15/30/45/60 DDL') {
                              setQuoteInstallmentsCount(4);
                              setQuoteDaysInterval([15, 30, 45, 60]);
                            }
                          }}
                          className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                        >
                          <option value="28 DDL">28 DDL (1x em 28 dias)</option>
                          <option value="30/60 DDL">30/60 DDL (2 parcelas)</option>
                          <option value="30/60/90 DDL">30/60/90 DDL (3 parcelas)</option>
                          <option value="15/30/45/60 DDL">15/30/45/60 DDL (4 parcelas)</option>
                          <option value="Personalizado">Personalizado</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          Quantidade de Parcelas
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="12"
                          value={quoteInstallmentsCount}
                          onChange={(e) => {
                            const count = Math.max(1, parseInt(e.target.value) || 1);
                            setQuoteInstallmentsCount(count);
                            const intervals = [];
                            for (let i = 1; i <= count; i++) intervals.push(i * 30);
                            setQuoteDaysInterval(intervals);
                          }}
                          className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none font-bold"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          Justificativa / Parecer de Alçada Comercial e Financeira
                        </label>
                        <input
                          type="text"
                          placeholder="Ex: Cliente com cadastro e limite de crédito aprovado na Serasa / análise PJ"
                          value={quoteCreditApprovalNotes}
                          onChange={(e) => setQuoteCreditApprovalNotes(e.target.value)}
                          className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setAnsweringQuote(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-slate-900 hover:bg-[#00AEEF] text-white font-bold text-xs rounded-xl shadow-md transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Enviar Proposta ao Cliente</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: STOCK ADJUSTMENT */}
      {isStockModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 max-w-md w-full p-6 space-y-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-heading text-lg font-bold uppercase text-slate-900">
                Lançamento de Estoque
              </h3>
              <button
                onClick={() => setIsStockModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveStockAdjustment} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Produto</label>
                <select
                  value={stockAdjustProductId}
                  onChange={(e) => setStockAdjustProductId(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} (Atual: {p.stock_qty} un)
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Tipo</label>
                  <select
                    value={stockAdjustType}
                    onChange={(e) => setStockAdjustType(e.target.value as any)}
                    className="w-full px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                  >
                    <option value="entrada">Entrada (+)</option>
                    <option value="saida">Saída (-)</option>
                    <option value="ajuste">Ajuste de Balanço</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Quantidade</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={stockAdjustQty}
                    onChange={(e) => setStockAdjustQty(parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-2 text-xs font-bold text-slate-900 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Motivo / Documento</label>
                <input
                  type="text"
                  required
                  value={stockAdjustReason}
                  onChange={(e) => setStockAdjustReason(e.target.value)}
                  placeholder="Ex: NF 4082 / Reposição de Fornecedor"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsStockModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-slate-900 hover:bg-[#E6007E] text-white font-bold text-xs rounded-xl shadow-md transition-colors"
                >
                  Confirmar Lançamento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
