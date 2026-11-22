import React, { useState, useEffect, useMemo } from 'react';
import { UserProfile, Order, Quote, BoletoTitulo, Product, CartItem } from '../types';
import { StorageService } from '../services/storage';
import { updateMyProfile } from '../services/authClient';
import { SEOHead } from '../components/SEOHead';
import { BoletoModal } from '../components/BoletoModal';
import { FavoriteButton } from '../components/FavoriteButton';
import {
  User,
  LogOut,
  Package,
  FileSpreadsheet,
  Settings,
  Clock,
  CheckCircle2,
  AlertCircle,
  Truck,
  ArrowRight,
  ChevronRight,
  Check,
  CreditCard,
  QrCode,
  Calendar,
  Building,
  MapPin,
  Sparkles,
  FileText,
  Heart,
  ShoppingCart,
  Trash2,
  RotateCcw,
  Repeat,
  Search,
  ChevronDown,
  ChevronUp,
  Copy,
  ExternalLink,
  ArrowUpRight,
  Box,
  Filter,
  X,
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface CustomerPortalViewProps {
  currentUser: UserProfile;
  onUserUpdate: (user: UserProfile) => void;
  onNavigate: (view: string, param?: string) => void;
}

export const CustomerPortalView: React.FC<CustomerPortalViewProps> = ({
  currentUser,
  onUserUpdate,
  onNavigate,
}) => {
  const [activeTab, setActiveTab] = useState<'orders' | 'quotes' | 'favorites' | 'profile'>('orders');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);
  const [activeBoletosModal, setActiveBoletosModal] = useState<BoletoTitulo[] | null>(null);

  // Favorites state synced in real-time
  const [favoriteIds, setFavoriteIds] = useState<string[]>(() =>
    StorageService.getUserFavorites(currentUser?.id)
  );

  useEffect(() => {
    const handleFavUpdate = () => {
      setFavoriteIds(StorageService.getUserFavorites(currentUser?.id));
    };
    window.addEventListener('mb_favorites_updated', handleFavUpdate);
    window.addEventListener('mb_storage_updated', handleFavUpdate);
    return () => {
      window.removeEventListener('mb_favorites_updated', handleFavUpdate);
      window.removeEventListener('mb_storage_updated', handleFavUpdate);
    };
  }, [currentUser?.id]);

  const favoriteProducts = useMemo(() => {
    const allProducts = StorageService.getProducts();
    return allProducts.filter((p) => favoriteIds.includes(p.id));
  }, [favoriteIds]);

  // Profile form state
  const [name, setName] = useState(currentUser.name);
  const [email, setEmail] = useState(currentUser.email);
  const [phone, setPhone] = useState(currentUser.phone);
  const [company, setCompany] = useState(currentUser.company || '');
  const [cpfCnpj, setCpfCnpj] = useState(currentUser.cpfCnpj || '');
  const [stateRegistration, setStateRegistration] = useState(currentUser.stateRegistration || '');
  const [street, setStreet] = useState(currentUser.address?.street || '');
  const [number, setNumber] = useState(currentUser.address?.number || '');
  const [neighborhood, setNeighborhood] = useState(currentUser.address?.neighborhood || '');
  const [city, setCity] = useState(currentUser.address?.city || '');
  const [state, setState] = useState(currentUser.address?.state || '');
  const [zip, setZip] = useState(currentUser.address?.zip || '');
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [portalNotification, setPortalNotification] = useState<{ type: 'success' | 'info' | 'error'; message: string } | null>(null);

  const showPortalNotification = (type: 'success' | 'info' | 'error', message: string) => {
    setPortalNotification({ type, message });
    setTimeout(() => setPortalNotification(null), 4000);
  };

  const [orders, setOrders] = useState<Order[]>(() =>
    StorageService.getOrders().filter(
      (o) => o.clientId === currentUser.id || o.clientEmail === currentUser.email
    )
  );
  const [quotes, setQuotes] = useState<Quote[]>(() =>
    StorageService.getQuotes().filter(
      (q) => q.clientId === currentUser.id || q.clientEmail === currentUser.email
    )
  );

  const refreshOrders = () => {
    setOrders(
      StorageService.getOrders().filter(
        (o) => o.clientId === currentUser.id || o.clientEmail === currentUser.email
      )
    );
    setQuotes(
      StorageService.getQuotes().filter(
        (q) => q.clientId === currentUser.id || q.clientEmail === currentUser.email
      )
    );
  };

  useEffect(() => {
    refreshOrders();
    const handler = () => refreshOrders();
    window.addEventListener('mb_storage_updated', handler);
    return () => window.removeEventListener('mb_storage_updated', handler);
  }, [currentUser.id, currentUser.email]);

  // Orders Search & Filter States
  const [orderSearch, setOrderSearch] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState<'all' | 'novo' | 'em_producao' | 'pronto' | 'entregue' | 'cancelado'>('all');
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [reorderingId, setReorderingId] = useState<string | null>(null);
  const [reQuotingOrder, setReQuotingOrder] = useState<Order | null>(null);
  const [reQuoteNotes, setReQuoteNotes] = useState('');
  const [isReQuoteModalOpen, setIsReQuoteModalOpen] = useState(false);
  const [isSubmittingReQuote, setIsSubmittingReQuote] = useState(false);
  const [copiedTrackingCode, setCopiedTrackingCode] = useState<string | null>(null);

  // Filtered orders list based on status & search
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      // Status filter
      if (orderStatusFilter !== 'all') {
        if (orderStatusFilter === 'em_producao') {
          if (o.orderStatus !== 'em_producao' && o.orderStatus !== 'pronto') return false;
        } else if (o.orderStatus !== orderStatusFilter) {
          return false;
        }
      }

      // Search filter
      if (orderSearch.trim()) {
        const q = orderSearch.toLowerCase().trim();
        const matchesCode = o.code.toLowerCase().includes(q);
        const matchesTracking = o.trackingCode ? o.trackingCode.toLowerCase().includes(q) : false;
        const matchesItem = o.items.some(
          (it) => it.productName.toLowerCase().includes(q) || (it.productSku && it.productSku.toLowerCase().includes(q))
        );
        return matchesCode || matchesTracking || matchesItem;
      }

      return true;
    });
  }, [orders, orderStatusFilter, orderSearch]);

  // Handler: Reenviar Pedido (Comprar Novamente os mesmos itens no carrinho)
  const handleReorder = (order: Order) => {
    setReorderingId(order.id);
    const catalogProducts = StorageService.getProducts();

    try {
      order.items.forEach((item) => {
        const foundProduct = catalogProducts.find((p) => p.id === item.productId || p.code === item.productSku);
        const productToUse: Product = foundProduct || ({
          id: item.productId,
          code: item.productSku,
          name: item.productName,
          slug: item.productId,
          base_price: item.unitPrice,
          images: [item.productImage],
          description: 'Item adicionado a partir de pedido anterior',
          stock_qty: 999,
          min_order_qty: 1,
          is_active: true,
          show_price: true,
          details: { customTechniques: [item.customTechnique || 'Personalizado'] },
        } as any);

        const cartItem: CartItem = {
          id: `cart-${item.productId}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          product: productToUse,
          quantity: Math.max(productToUse.min_order_qty || 1, item.quantity),
          customTechnique: item.customTechnique || 'Gravação a Laser',
          customArtworkName: item.customArtworkName,
          calculatedUnitPrice: item.unitPrice,
        };

        StorageService.addToCart(cartItem);
      });

      try {
        confetti({
          particleCount: 75,
          spread: 65,
          colors: ['#E6007E', '#00AEEF', '#FFDD00'],
        });
      } catch {}

      showPortalNotification(
        'success',
        `Itens do pedido ${order.code} carregados no carrinho com sucesso! Redirecionando para o checkout...`
      );

      setTimeout(() => {
        setReorderingId(null);
        onNavigate('checkout');
      }, 1000);
    } catch {
      setReorderingId(null);
      showPortalNotification('error', 'Ocorreu um erro ao carregar os itens no carrinho.');
    }
  };

  // Handler: Abrir modal para solicitar nova cotação baseada na compra anterior
  const handleOpenReQuoteModal = (order: Order) => {
    setReQuotingOrder(order);
    setReQuoteNotes(
      `Reposição corporativa com base no pedido anterior #${order.code}. Desejamos verificar condições para este lote.`
    );
    setIsReQuoteModalOpen(true);
  };

  // Handler: Confirmar criação da nova cotação
  const handleConfirmReQuote = () => {
    if (!reQuotingOrder) return;
    setIsSubmittingReQuote(true);

    try {
      const randomQuoteNum = Math.floor(1000 + Math.random() * 9000);
      const newQuoteCode = `ORC-2026-${randomQuoteNum}`;
      const newQuote: Quote = {
        id: `quote-reorder-${Date.now()}`,
        code: newQuoteCode,
        clientId: currentUser.id,
        clientName: currentUser.name,
        clientEmail: currentUser.email,
        clientPhone: currentUser.phone,
        clientCompany: currentUser.company,
        clientCpfCnpj: currentUser.cpfCnpj,
        items: reQuotingOrder.items.map((it, idx) => ({
          id: `qi-${Date.now()}-${idx}`,
          productId: it.productId,
          productName: it.productName,
          productImage: it.productImage,
          quantity: it.quantity,
          customTechnique: it.customTechnique,
          customArtworkName: it.customArtworkName,
          unit_price_estimated: it.unitPrice,
        })),
        notes:
          reQuoteNotes.trim() ||
          `Nova cotação baseada na compra anterior #${reQuotingOrder.code} para reposição/reajuste.`,
        status: 'pendente',
        totalEstimated: reQuotingOrder.subtotal,
        deliveryDeadline: 'A combinar com comercial',
        deliveryCityState: reQuotingOrder.shippingAddress
          ? `${reQuotingOrder.shippingAddress.city} - ${reQuotingOrder.shippingAddress.state}`
          : 'São Paulo - SP',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      StorageService.addQuote(newQuote);
      setQuotes(
        StorageService.getQuotes().filter(
          (q) => q.clientId === currentUser.id || q.clientEmail === currentUser.email
        )
      );

      try {
        confetti({
          particleCount: 80,
          spread: 70,
          colors: ['#00AEEF', '#FFDD00', '#E6007E'],
        });
      } catch {}

      showPortalNotification(
        'success',
        `Nova cotação comercial ${newQuoteCode} gerada com sucesso baseada no pedido ${reQuotingOrder.code}!`
      );

      setIsReQuoteModalOpen(false);
      setReQuotingOrder(null);
      setActiveTab('quotes');
    } catch {
      showPortalNotification('error', 'Erro ao registrar nova cotação comercial.');
    } finally {
      setIsSubmittingReQuote(false);
    }
  };

  const handleCopyTracking = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedTrackingCode(code);
    setTimeout(() => setCopiedTrackingCode(null), 2500);
  };

  const getOrderStepIndex = (status: Order['orderStatus']): number => {
    switch (status) {
      case 'novo':
        return 1;
      case 'em_producao':
        return 2;
      case 'pronto':
        return 3;
      case 'entregue':
        return 4;
      case 'cancelado':
        return -1;
      default:
        return 1;
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await updateMyProfile({
        name,
        phone,
        company,
        cpfCnpj,
        stateRegistration,
        address: {
          street,
          number,
          neighborhood,
          city,
          state,
          zip,
        },
      });
      if (res.success && res.user) {
        StorageService.setCurrentUser(res.user);
        onUserUpdate(res.user);
        setSavedSuccess(true);
        showPortalNotification('success', 'Dados cadastrais atualizados com sucesso!');
        setTimeout(() => setSavedSuccess(false), 3000);
      } else {
        showPortalNotification('error', res.error || 'Não foi possível salvar os dados cadastrais.');
      }
    } catch (err: any) {
      showPortalNotification('error', err?.message || 'Erro de comunicação ao atualizar perfil.');
    }
  };

  const handleLogout = async () => {
    await StorageService.logout();
    onUserUpdate(StorageService.getCurrentUser());
    onNavigate('home');
  };

  const handleApproveQuote = (quoteId: string) => {
    if (confirm('Deseja aprovar este orçamento e enviá-lo para a fila de produção?')) {
      const order = StorageService.convertQuoteToOrder(quoteId, 'faturado_pj');
      if (order) {
        try {
          confetti({
            particleCount: 70,
            spread: 60,
            colors: ['#E6007E', '#00AEEF', '#FFDD00'],
          });
        } catch {}
        showPortalNotification('success', `Orçamento aprovado com sucesso! Foi gerado o Pedido ${order.code}.`);
        setActiveTab('orders');
      }
    }
  };

  const getOrderStatusBadge = (status: Order['orderStatus']) => {
    switch (status) {
      case 'novo':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-sky-100 text-sky-800">Novo Pedido</span>;
      case 'em_producao':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 flex items-center gap-1"><Clock className="w-3 h-3" /> Em Produção</span>;
      case 'pronto':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-800 flex items-center gap-1"><Truck className="w-3 h-3" /> Pronto p/ Envio</span>;
      case 'entregue':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Entregue</span>;
      case 'cancelado':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800">Cancelado</span>;
      default:
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-800">Processando</span>;
    }
  };

  const getQuoteStatusBadge = (status: Quote['status']) => {
    switch (status) {
      case 'pendente':
      case 'em_analise':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800">Em Análise Comercial</span>;
      case 'respondido':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-sky-100 text-sky-800">Proposta com Preço Enviada</span>;
      case 'aprovado':
      case 'convertido':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">Aprovado / Em Pedido</span>;
      case 'recusado':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-200 text-slate-700">Recusado</span>;
    }
  };

  return (
    <div className="w-full min-w-0 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8" id="customer-portal-page">
      <SEOHead
        title="Área do Cliente & Meus Pedidos"
        description="Portal de autoatendimento para acompanhamento de pedidos, aprovação de orçamentos e layouts virtuais de personalização."
        canonicalPath="/minha-conta"
        noIndex={true}
      />
      {/* Top Banner Profile Summary */}
      <div className="bg-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#E6007E] to-[#00AEEF] flex items-center justify-center text-white font-extrabold text-2xl font-heading shadow-md">
            {currentUser.name.charAt(0)}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-white/20 text-white">
                Conta do Cliente
              </span>
              {currentUser.company && (
                <span className="text-xs text-slate-300 font-medium flex items-center gap-1">
                  <Building className="w-3.5 h-3.5" /> {currentUser.company}
                </span>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold uppercase font-heading text-white mt-1">
              Olá, {currentUser.name}
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">{currentUser.email} • {currentUser.phone}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onNavigate('quote')}
            className="px-4 py-2.5 bg-[#E6007E] hover:bg-[#c9006e] text-white text-xs font-bold rounded-xl transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Novo Orçamento</span>
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="px-4 py-2.5 bg-white/10 hover:bg-rose-600 text-white text-xs font-bold rounded-xl border border-white/20 transition-all flex items-center gap-1.5 cursor-pointer"
            id="btn-customer-portal-logout"
          >
            <LogOut className="w-4 h-4" />
            <span>Sair</span>
          </button>
        </div>
      </div>

      {/* Floating or Top Portal Notification Banner */}
      {portalNotification && (
        <div
          className={`p-4 rounded-2xl text-xs font-bold flex items-center gap-2.5 animate-fadeIn shadow-md border ${
            portalNotification.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : portalNotification.type === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-800'
              : 'bg-blue-50 border-blue-200 text-blue-800'
          }`}
        >
          {portalNotification.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : portalNotification.type === 'error' ? (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          ) : (
            <Sparkles className="w-4 h-4 text-blue-600 shrink-0" />
          )}
          <span>{portalNotification.message}</span>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex items-center gap-3 border-b border-slate-200 pb-2">
        <button
          onClick={() => {
            setActiveTab('orders');
            setSelectedOrder(null);
          }}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'orders'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Package className="w-4 h-4" />
          <span>Meus Pedidos ({orders.length})</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('quotes');
            setSelectedQuote(null);
          }}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'quotes'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Meus Orçamentos ({quotes.length})</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('favorites');
            setSelectedOrder(null);
            setSelectedQuote(null);
          }}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'favorites'
              ? 'bg-[#E6007E] text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
          id="btn-tab-favorites"
        >
          <Heart className={`w-4 h-4 ${activeTab === 'favorites' ? 'fill-white text-white' : 'text-[#E6007E]'}`} />
          <span>Meus Favoritos ({favoriteProducts.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('profile')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'profile'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <User className="w-4 h-4" />
          <span>Dados Cadastrais</span>
        </button>
      </div>

      {/* TAB 1: MEUS PEDIDOS */}
      {activeTab === 'orders' && (
        <div className="space-y-6" id="customer-orders-section">
          {/* Top Control Bar: Search & Status Filters */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="font-heading font-bold text-slate-900 text-base uppercase flex items-center gap-2">
                  <Package className="w-5 h-5 text-[#E6007E]" />
                  <span>Histórico de Compras & Produção ({orders.length})</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Acompanhe em tempo real o status de gravação, expedição e repita compras com um clique
                </p>
              </div>

              {/* Search input */}
              <div className="relative w-full md:w-72">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={orderSearch}
                  onChange={(e) => setOrderSearch(e.target.value)}
                  placeholder="Buscar por código, produto ou rastreio..."
                  className="w-full pl-9 pr-8 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#E6007E] focus:outline-none transition-all"
                />
                {orderSearch && (
                  <button
                    type="button"
                    onClick={() => setOrderSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Status Pills Filter */}
            <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1 flex items-center gap-1">
                <Filter className="w-3 h-3" /> Filtrar:
              </span>
              {[
                { key: 'all', label: `Todos (${orders.length})` },
                {
                  key: 'novo',
                  label: `Recebidos (${orders.filter((o) => o.orderStatus === 'novo').length})`,
                },
                {
                  key: 'em_producao',
                  label: `Em Produção (${orders.filter((o) => o.orderStatus === 'em_producao' || o.orderStatus === 'pronto').length})`,
                },
                {
                  key: 'pronto',
                  label: `Pronto p/ Envio (${orders.filter((o) => o.orderStatus === 'pronto').length})`,
                },
                {
                  key: 'entregue',
                  label: `Entregues (${orders.filter((o) => o.orderStatus === 'entregue').length})`,
                },
                {
                  key: 'cancelado',
                  label: `Cancelados (${orders.filter((o) => o.orderStatus === 'cancelado').length})`,
                },
              ].map((tab) => {
                const isActive = orderStatusFilter === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setOrderStatusFilter(tab.key as any)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      isActive
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Orders Listing */}
          {filteredOrders.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 space-y-3">
              <Package className="w-12 h-12 text-slate-300 mx-auto" />
              <h3 className="font-bold text-slate-800 text-base">
                {orders.length === 0
                  ? 'Nenhum pedido registrado até o momento'
                  : 'Nenhum pedido corresponde aos filtros aplicados'}
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                {orders.length === 0
                  ? 'Assim que você concluir uma compra online ou aprovar uma cotação comercial, seu pedido aparecerá aqui com rastreamento da produção.'
                  : 'Tente alterar os termos de busca ou selecionar outro status no menu acima.'}
              </p>
              {orders.length === 0 ? (
                <button
                  type="button"
                  onClick={() => onNavigate('catalog')}
                  className="px-5 py-2.5 bg-slate-900 text-white text-xs font-bold rounded-xl hover:bg-[#E6007E] transition-colors cursor-pointer shadow-xs inline-flex items-center gap-1.5"
                >
                  <ShoppingCart className="w-3.5 h-3.5" />
                  <span>Explorar Catálogo</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setOrderSearch('');
                    setOrderStatusFilter('all');
                  }}
                  className="px-4 py-2 bg-slate-100 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  Limpar Filtros
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5">
              {filteredOrders.map((order) => {
                const stepIdx = getOrderStepIndex(order.orderStatus);
                const isExpanded = expandedOrderId === order.id;
                const isReordering = reorderingId === order.id;

                return (
                  <div
                    key={order.id}
                    className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-xs hover:border-slate-300 transition-all space-y-5"
                  >
                    {/* Header: Code, Date, Origin, Status, Payment */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <span className="font-mono font-black text-base text-slate-900 tracking-tight">
                          {order.code}
                        </span>
                        <span className="text-xs text-slate-400">
                          {new Date(order.createdAt).toLocaleDateString('pt-BR', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                        {order.sourceQuoteId && (
                          <span className="text-[10px] bg-sky-50 text-sky-800 border border-sky-200 px-2 py-0.5 rounded-full font-bold uppercase">
                            Origem: Cotação Comercial
                          </span>
                        )}
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                            order.paymentStatus === 'pago'
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              : 'bg-amber-50 text-amber-800 border border-amber-200'
                          }`}
                        >
                          {order.paymentStatus === 'pago' ? '✓ Pago' : 'Aguardando Pagamento'}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {getOrderStatusBadge(order.orderStatus)}
                      </div>
                    </div>

                    {/* Visual Progress Stepper (Timeline) */}
                    {order.orderStatus !== 'cancelado' ? (
                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-2">
                        <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                          <span className="text-[11px] uppercase tracking-wider text-slate-500 font-extrabold flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-[#00AEEF]" />
                            Evolução do Pedido
                          </span>
                          <span className="text-[11px] text-[#E6007E] font-bold">
                            {order.orderStatus === 'novo' && 'Etapa 1 de 4: Pedido Recebido'}
                            {order.orderStatus === 'em_producao' && 'Etapa 2 de 4: Em Produção'}
                            {(order.orderStatus === 'pronto' || order.orderStatus === 'enviado') &&
                              'Etapa 3 de 4: Expedição & Trânsito'}
                            {order.orderStatus === 'entregue' && 'Etapa 4 de 4: Entregue ao Destinatário'}
                          </span>
                        </div>

                        {/* Progress Bar & Icons */}
                        <div className="relative pt-2 pb-1">
                          {/* Background Track */}
                          <div className="absolute top-1/2 left-4 right-4 -translate-y-1/2 h-1.5 bg-slate-200 rounded-full z-0" />
                          {/* Active Filled Bar */}
                          <div
                            className="absolute top-1/2 left-4 -translate-y-1/2 h-1.5 bg-gradient-to-r from-[#E6007E] to-[#00AEEF] rounded-full transition-all duration-500 z-0"
                            style={{
                              width:
                                stepIdx === 1
                                  ? '10%'
                                  : stepIdx === 2
                                  ? '40%'
                                  : stepIdx === 3
                                  ? '72%'
                                  : stepIdx === 4
                                  ? 'calc(100% - 2rem)'
                                  : '0%',
                            }}
                          />

                          {/* 4 Step Nodes */}
                          <div className="relative flex items-center justify-between z-10">
                            {[
                              { step: 1, title: 'Recebido', desc: 'Confirmado' },
                              { step: 2, title: 'Produção', desc: 'Gravação & Laser' },
                              { step: 3, title: 'Expedição', desc: 'Em Trânsito' },
                              { step: 4, title: 'Entregue', desc: 'Concluído' },
                            ].map((node) => {
                              const isCompleted = stepIdx >= node.step;
                              const isCurrent = stepIdx === node.step;
                              return (
                                <div key={node.step} className="flex flex-col items-center text-center">
                                  <div
                                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all shadow-xs ${
                                      isCompleted
                                        ? 'bg-[#E6007E] text-white ring-4 ring-pink-100'
                                        : 'bg-white text-slate-400 border-2 border-slate-300'
                                    } ${isCurrent ? 'scale-110 ring-4 ring-[#00AEEF]/30' : ''}`}
                                  >
                                    {isCompleted ? <Check className="w-3.5 h-3.5" /> : node.step}
                                  </div>
                                  <span
                                    className={`text-[11px] font-bold mt-1.5 ${
                                      isCompleted ? 'text-slate-900' : 'text-slate-400'
                                    }`}
                                  >
                                    {node.title}
                                  </span>
                                  <span className="text-[9px] text-slate-400 hidden sm:inline">
                                    {node.desc}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-rose-800">
                        <div className="flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                          <span>Este pedido foi cancelado. Para reativação ou dúvidas, contate nossa equipe.</span>
                        </div>
                        <a
                          href={`https://wa.me/5511987654321?text=Ol%C3%A1%2C%20gostaria%20de%20falar%20sobre%20meu%20pedido%20${order.code}`}
                          target="_blank"
                          rel="noreferrer"
                          className="font-bold underline text-rose-900 hover:text-rose-700 w-fit"
                        >
                          Falar com Suporte no WhatsApp
                        </a>
                      </div>
                    )}

                    {/* Items List */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-xs text-slate-500 font-bold border-b border-slate-100 pb-2">
                        <span>Itens do Pedido ({order.items.length})</span>
                        <span>Subtotal</span>
                      </div>

                      <div className="divide-y divide-slate-100">
                        {order.items.map((item) => (
                          <div
                            key={item.id}
                            className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                          >
                            <div className="flex items-start sm:items-center gap-3">
                              {item.productImage ? (
                                <img
                                  src={item.productImage}
                                  alt={item.productName}
                                  className="w-14 h-14 object-cover rounded-xl border border-slate-200 shrink-0 bg-slate-50"
                                />
                              ) : (
                                <div className="w-14 h-14 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 shrink-0">
                                  <Box className="w-6 h-6" />
                                </div>
                              )}
                              <div className="space-y-1">
                                <h4
                                  onClick={() => onNavigate('product-detail', item.productId)}
                                  className="font-bold text-slate-900 text-sm hover:text-[#E6007E] cursor-pointer transition-colors"
                                  title="Ver no catálogo"
                                >
                                  {item.productName}
                                </h4>
                                <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                                  {item.productSku && (
                                    <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">
                                      SKU: {item.productSku}
                                    </span>
                                  )}
                                  {item.variantName && (
                                    <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">
                                      Cor/Variação: <strong>{item.variantName}</strong>
                                    </span>
                                  )}
                                  <span className="bg-sky-50 text-sky-800 px-1.5 py-0.5 rounded font-medium border border-sky-100">
                                    {item.customTechnique || 'Personalização sob medida'}
                                  </span>
                                  {item.customArtworkName && (
                                    <span className="bg-pink-50 text-pink-800 px-1.5 py-0.5 rounded font-medium border border-pink-100">
                                      Arte: {item.customArtworkName}
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-slate-400">
                                  Quantidade: <strong>{item.quantity} unidades</strong> • Unitário:{' '}
                                  <strong>R$ {item.unitPrice.toFixed(2)}</strong>
                                </div>
                              </div>
                            </div>

                            <div className="text-right sm:shrink-0">
                              <span className="text-[10px] text-slate-400 block sm:hidden">Total do item:</span>
                              <span className="font-black text-slate-900 font-heading text-sm sm:text-base">
                                R$ {item.total.toFixed(2)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Logistics, Tracking & Freight Approval Banner */}
                    {order.shippingInfo && (
                      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2 font-bold text-slate-800">
                            <Truck className="w-4 h-4 text-[#00AEEF]" />
                            <span>Modalidade de Envio: {order.shippingInfo.methodName}</span>
                            {order.shippingInfo.carrierName && (
                              <span className="text-[11px] font-normal text-slate-500">
                                ({order.shippingInfo.carrierName})
                              </span>
                            )}
                          </div>

                          {/* Freight Status Badges */}
                          <div>
                            {order.shippingInfo.freightStatus === 'aguardando_cotacao' && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-blue-100 text-blue-800">
                                Aguardando Cotação de Frete
                              </span>
                            )}
                            {order.shippingInfo.freightStatus === 'proposta_enviada' && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-100 text-amber-800 animate-pulse">
                                Proposta de Frete Disponível para Aprovação
                              </span>
                            )}
                            {order.shippingInfo.freightStatus === 'aprovado' && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800">
                                Frete Aprovado
                              </span>
                            )}
                            {order.shippingInfo.freightStatus === 'recusado' && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-rose-100 text-rose-800">
                                Proposta Recusada
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Tracking Code with Copy Action */}
                        {order.trackingCode && (
                          <div className="flex items-center justify-between bg-white p-3 rounded-xl border border-slate-200">
                            <div className="flex items-center gap-2">
                              <Package className="w-4 h-4 text-emerald-600" />
                              <span className="text-slate-600">Código de Rastreamento:</span>
                              <strong className="font-mono text-slate-900 text-xs bg-slate-100 px-2 py-0.5 rounded">
                                {order.trackingCode}
                              </strong>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleCopyTracking(order.trackingCode || '')}
                              className="px-2.5 py-1 text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                            >
                              {copiedTrackingCode === order.trackingCode ? (
                                <>
                                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                                  <span className="text-emerald-700">Copiado</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3.5 h-3.5" />
                                  <span>Copiar</span>
                                </>
                              )}
                            </button>
                          </div>
                        )}

                        {/* Interactive Freight Proposal Actions */}
                        {order.shippingInfo.freightStatus === 'proposta_enviada' && (
                          <div className="p-3.5 bg-white rounded-xl border border-amber-200 space-y-2 mt-2">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                              <div>
                                <p className="font-bold text-slate-900 text-xs">
                                  Valor Cotado: R$ {(order.shippingInfo.negotiatedCost || 0).toFixed(2)}
                                </p>
                                <p className="text-[11px] text-slate-500">
                                  Transportadora: {order.shippingInfo.negotiatedCarrier || 'Parceira'} • Prazo:{' '}
                                  {order.shippingInfo.negotiatedDeadlineDays || 3} dias úteis
                                </p>
                                {order.shippingInfo.proposalNotes && (
                                  <p className="text-[11px] text-slate-600 mt-1 italic">
                                    "{order.shippingInfo.proposalNotes}"
                                  </p>
                                )}
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => {
                                    StorageService.updateOrderShipping(order.id, {
                                      freightStatus: 'aprovado',
                                      actorName: currentUser.name,
                                      actionDescription:
                                        'Cliente aprovou a proposta de frete diretamente na área do cliente.',
                                    });
                                    setOrders(
                                      StorageService.getOrders().filter(
                                        (o) => o.clientId === currentUser.id || o.clientEmail === currentUser.email
                                      )
                                    );
                                    showPortalNotification(
                                      'success',
                                      'Frete aprovado com sucesso! A expedição foi comunicada.'
                                    );
                                  }}
                                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs"
                                >
                                  Aprovar Frete
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const reason = prompt('Informe o motivo da recusa da cotação:');
                                    if (reason) {
                                      StorageService.updateOrderShipping(order.id, {
                                        freightStatus: 'recusado',
                                        customerResponseNotes: reason,
                                        actorName: currentUser.name,
                                        actionDescription: `Cliente recusou o frete: ${reason}`,
                                      });
                                      setOrders(
                                        StorageService.getOrders().filter(
                                          (o) => o.clientId === currentUser.id || o.clientEmail === currentUser.email
                                        )
                                      );
                                      showPortalNotification(
                                        'info',
                                        'Recusa registrada. Nossa equipe entrará em contato para negociar nova alternativa.'
                                      );
                                    }
                                  }}
                                  className="px-3.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                                >
                                  Recusar
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Collapsible Order Full Details (Address, Invoicing breakdown) */}
                    {isExpanded && (
                      <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200 text-xs space-y-3 animate-in fade-in duration-200">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {/* Shipping Address */}
                          <div>
                            <span className="font-bold text-slate-800 uppercase tracking-wider text-[10px] flex items-center gap-1 mb-1">
                              <MapPin className="w-3.5 h-3.5 text-[#E6007E]" /> Endereço de Entrega:
                            </span>
                            <p className="text-slate-700">
                              {order.shippingAddress.street}, {order.shippingAddress.number}
                              {order.shippingAddress.complement ? ` - ${order.shippingAddress.complement}` : ''}
                            </p>
                            <p className="text-slate-500">
                              {order.shippingAddress.neighborhood} • {order.shippingAddress.city} - {order.shippingAddress.state}
                            </p>
                            <p className="text-slate-400 font-mono mt-0.5">CEP: {order.shippingAddress.zip}</p>
                          </div>

                          {/* Payment Summary */}
                          <div>
                            <span className="font-bold text-slate-800 uppercase tracking-wider text-[10px] flex items-center gap-1 mb-1">
                              <CreditCard className="w-3.5 h-3.5 text-[#00AEEF]" /> Informações de Faturamento:
                            </span>
                            <p className="text-slate-700">
                              Método:{' '}
                              <strong>
                                {order.paymentMethod === 'pix'
                                  ? 'PIX (Pagamento Instantâneo)'
                                  : order.paymentMethod === 'credit_card'
                                  ? 'Cartão de Crédito Online'
                                  : order.paymentMethod === 'boleto_faturado'
                                  ? `Boleto Faturado PJ (${order.billingTerms?.conditionName || 'Faturado'})`
                                  : 'Boleto Bancário à Vista'}
                              </strong>
                            </p>
                            <p className="text-slate-500">
                              Status da Cobrança:{' '}
                              <strong className="uppercase">{order.paymentStatus}</strong>
                            </p>
                            {order.notes && (
                              <p className="text-slate-500 text-[11px] mt-1 italic">
                                Nota: {order.notes}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Financial Totals Breakdown */}
                        <div className="border-t border-slate-200 pt-3 space-y-1">
                          <div className="flex justify-between text-slate-600">
                            <span>Subtotal dos Itens:</span>
                            <span>R$ {order.subtotal.toFixed(2)}</span>
                          </div>
                          {order.discount > 0 && (
                            <div className="flex justify-between text-[#E6007E]">
                              <span>Descontos Aplicados (Cupom / PIX):</span>
                              <span>- R$ {order.discount.toFixed(2)}</span>
                            </div>
                          )}
                          <div className="flex justify-between text-slate-600">
                            <span>Frete:</span>
                            <span>
                              {order.shippingCost > 0 ? `R$ ${order.shippingCost.toFixed(2)}` : 'Grátis / A combinar'}
                            </span>
                          </div>
                          <div className="flex justify-between font-extrabold text-slate-900 text-sm pt-1 border-t border-slate-200">
                            <span>Total Geral:</span>
                            <span className="text-[#E6007E] font-heading">
                              R$ {order.total.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Footer Actions: Reenviar Pedido, Solicitar Nova Cotação, Boleto, Expandir */}
                    <div className="pt-3 border-t border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
                      {/* Price summary */}
                      <div>
                        <span className="text-xs text-slate-500 mr-2">Valor Total do Pedido:</span>
                        <span className="text-lg font-black text-slate-900 font-heading">
                          R$ {order.total.toFixed(2)}
                        </span>
                      </div>

                      {/* Action buttons */}
                      <div className="flex flex-wrap items-center gap-2">
                        {/* Botão 1: Reenviar Pedido / Comprar Novamente */}
                        <button
                          type="button"
                          onClick={() => handleReorder(order)}
                          disabled={isReordering}
                          className="px-4 py-2.5 bg-slate-900 hover:bg-[#E6007E] text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center gap-2 cursor-pointer disabled:opacity-50"
                          title="Adiciona todos os itens deste pedido ao carrinho para comprar novamente"
                        >
                          <RotateCcw className={`w-3.5 h-3.5 ${isReordering ? 'animate-spin' : ''}`} />
                          <span>{isReordering ? 'Adicionando ao Carrinho...' : 'Reenviar Pedido'}</span>
                        </button>

                        {/* Botão 2: Solicitar Nova Cotação baseada nesta compra */}
                        <button
                          type="button"
                          onClick={() => handleOpenReQuoteModal(order)}
                          className="px-4 py-2.5 bg-white hover:bg-sky-50 text-[#00AEEF] border border-[#00AEEF] text-xs font-bold rounded-xl transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
                          title="Cria uma solicitação de cotação formal com os mesmos itens deste pedido"
                        >
                          <FileSpreadsheet className="w-3.5 h-3.5" />
                          <span>Solicitar Nova Cotação</span>
                        </button>

                        {/* Botão Boleto Bancário se for boleto */}
                        {(order.paymentMethod === 'boleto' || order.paymentMethod === 'boleto_faturado') && (
                          <button
                            type="button"
                            onClick={() => {
                              const orderBoletos = StorageService.getBoletosByOrderId(order.id);
                              if (orderBoletos.length > 0) {
                                setActiveBoletosModal(orderBoletos);
                              } else if (order.boletos && order.boletos.length > 0) {
                                setActiveBoletosModal(order.boletos);
                              } else {
                                showPortalNotification(
                                  'info',
                                  'Boleto bancário em processamento no sistema financeiro.'
                                );
                              }
                            }}
                            className="px-3.5 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span>Boleto(s)</span>
                          </button>
                        )}

                        {/* Botão Expandir / Recolher Detalhes */}
                        <button
                          type="button"
                          onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                          className="px-3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer flex items-center gap-1"
                        >
                          <span>{isExpanded ? 'Menos Detalhes' : 'Detalhes'}</span>
                          {isExpanded ? (
                            <ChevronUp className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5" />
                          )}
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

      {/* TAB 2: MEUS ORÇAMENTOS */}
      {activeTab === 'quotes' && (
        <div className="space-y-4">
          {quotes.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 space-y-3">
              <FileSpreadsheet className="w-12 h-12 text-slate-300 mx-auto" />
              <h3 className="font-bold text-slate-800 text-base">Nenhum orçamento solicitado ainda</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Precisa de cotações para grandes volumes, kits onboarding ou comunicação visual? Envie uma solicitação em minutos.
              </p>
              <button
                onClick={() => onNavigate('quote')}
                className="px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-xl hover:bg-[#E6007E] transition-colors"
              >
                Solicitar Orçamento Agora
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {quotes.map((quote) => (
                <div
                  key={quote.id}
                  className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:border-slate-300 transition-all space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-3">
                      <span className="font-mono font-bold text-sm text-slate-900">{quote.code}</span>
                      <span className="text-xs text-slate-400">
                        {new Date(quote.createdAt).toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                    <div>{getQuoteStatusBadge(quote.status)}</div>
                  </div>

                  {/* Items */}
                  <div className="space-y-2">
                    {quote.items.map((item) => (
                      <div key={item.id} className="flex items-center justify-between text-xs py-1">
                        <div className="flex items-center gap-3">
                          {item.productImage && (
                            <img
                              src={item.productImage}
                              alt={item.productName}
                              className="w-10 h-10 object-cover rounded-lg border border-slate-100"
                            />
                          )}
                          <div>
                            <p className="font-semibold text-slate-900">{item.productName}</p>
                            <p className="text-[11px] text-slate-500">
                              {item.quantity} un • {item.customTechnique || 'Personalização sob medida'}
                            </p>
                          </div>
                        </div>

                        {item.unit_price_estimated ? (
                          <div className="text-right">
                            <span className="text-[10px] text-slate-400">{item.quantity}x R$ {item.unit_price_estimated.toFixed(2)}</span>
                            <div className="font-bold text-slate-900 font-heading">
                              R$ {(item.unit_price_estimated * item.quantity).toFixed(2)}
                            </div>
                          </div>
                        ) : (
                          <span className="text-amber-600 text-xs font-semibold">Calculando proposta...</span>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Admin notes if answered */}
                  {quote.adminNotes && (
                    <div className="p-3 bg-sky-50 rounded-xl border border-sky-200 text-xs space-y-1">
                      <span className="font-bold text-sky-950 flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5 text-[#00AEEF]" /> Resposta da Equipe Comercial MB Personaliza:
                      </span>
                      <p className="text-sky-900 leading-relaxed">{quote.adminNotes}</p>
                      {quote.productionDaysEstimate && (
                        <p className="text-[11px] text-sky-800 font-medium pt-1">
                          ⏱️ Prazo estimado de produção: <strong>{quote.productionDaysEstimate} dias úteis</strong> • Validade da proposta: <strong>{quote.validityDate || '15 dias'}</strong>
                        </p>
                      )}
                    </div>
                  )}

                  {/* Condições de Pagamento Negociadas */}
                  {quote.billingTerms && (
                    <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-xl text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-indigo-700 shrink-0" />
                        <div>
                          <span className="font-bold text-indigo-950 block">
                            Condição Comercial: {quote.billingTerms.conditionName}
                          </span>
                          <span className="text-[11px] text-indigo-700">
                            {quote.billingTerms.type === 'faturado_prazo' && quote.billingTerms.isDeferredAuthorized
                              ? `Faturamento a Prazo Autorizado (${quote.billingTerms.installmentsCount}x parcela(s))`
                              : 'Boleto Bancário à Vista (Vencimento padrão em 2 dias úteis)'}
                          </span>
                        </div>
                      </div>
                      {quote.billingTerms.isDeferredAuthorized && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-purple-100 text-purple-800 border border-purple-200 w-fit">
                          Prazo Autorizado
                        </span>
                      )}
                    </div>
                  )}

                  {/* Actions & Totals */}
                  <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div>
                      {quote.totalEstimated ? (
                        <div className="flex items-baseline gap-2">
                          <span className="text-slate-500">Valor Total Proposto:</span>
                          <span className="text-lg font-black text-[#E6007E] font-heading">
                            R$ {quote.totalEstimated.toFixed(2)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-500">Aguardando precificação final</span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {quote.status === 'respondido' && (
                        <button
                          onClick={() => handleApproveQuote(quote.id)}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
                        >
                          <Check className="w-4 h-4" />
                          <span>Aprovar Proposta e Gerar Pedido</span>
                        </button>
                      )}

                      <a
                        href={`https://wa.me/5511987654321?text=Ol%C3%A1%2C%20gostaria%20de%20falar%20sobre%20meu%20or%C3%A7amento%20${quote.code}`}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition-colors"
                      >
                        Tirar Dúvidas no WhatsApp
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB: MEUS FAVORITOS */}
      {activeTab === 'favorites' && (
        <div className="space-y-5" id="customer-favorites-section">
          {favoriteProducts.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 space-y-3">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-pink-50 text-[#E6007E] flex items-center justify-center">
                <Heart className="w-7 h-7" />
              </div>
              <h3 className="font-bold text-slate-800 text-base">Sua lista de favoritos está vazia</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Explore nosso catálogo e clique no ícone de coração nos produtos para salvá-los e acessá-los rapidamente a qualquer momento.
              </p>
              <button
                type="button"
                onClick={() => onNavigate('catalog')}
                className="px-5 py-2.5 bg-slate-900 text-white text-xs font-bold rounded-xl hover:bg-[#E6007E] transition-colors cursor-pointer shadow-xs inline-flex items-center gap-2"
              >
                <span>Explorar Catálogo</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200">
                <div>
                  <h3 className="font-heading font-bold text-slate-900 text-base uppercase">
                    Produtos Salvos ({favoriteProducts.length})
                  </h3>
                  <p className="text-xs text-slate-500">
                    Acompanhe preços, variações e monte sua solicitação de orçamento com seus itens prediletos
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onNavigate('quote')}
                    className="px-4 py-2 bg-[#00AEEF] hover:bg-[#0098d1] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    <span>Orçar Itens</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigate('catalog')}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                  >
                    Ver Mais Produtos
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {favoriteProducts.map((prod) => {
                  const imageUrl =
                    prod.images && prod.images.length > 0
                      ? prod.images[0]
                      : 'https://images.unsplash.com/photo-1541807084-5c52b6b3adef?w=400&q=80';
                  return (
                    <div
                      key={prod.id}
                      className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs hover:border-slate-300 hover:shadow-md transition-all flex flex-col justify-between group"
                    >
                      <div className="relative aspect-square overflow-hidden bg-slate-50">
                        <img
                          src={imageUrl}
                          alt={prod.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        <div className="absolute top-3 right-3 z-10">
                          <FavoriteButton
                            productId={prod.id}
                            productName={prod.name}
                            currentUser={currentUser}
                            size="sm"
                          />
                        </div>
                        {prod.badge && (
                          <span className="absolute top-3 left-3 px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-slate-900 text-white shadow-xs">
                            {prod.badge}
                          </span>
                        )}
                        {!prod.show_price && (
                          <span className="absolute bottom-3 left-3 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-white shadow-xs">
                            Sob Orçamento
                          </span>
                        )}
                      </div>

                      <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                        <div>
                          <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono mb-1">
                            <span>{prod.code}</span>
                            <span>Mín. {prod.min_order_qty} un</span>
                          </div>
                          <h4
                            onClick={() => onNavigate('product-detail', prod.id)}
                            className="font-bold text-slate-900 text-sm line-clamp-2 hover:text-[#E6007E] cursor-pointer transition-colors"
                          >
                            {prod.name}
                          </h4>
                          <p className="text-xs text-slate-500 line-clamp-2 mt-1">
                            {prod.short_description || prod.description}
                          </p>
                        </div>

                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                          <div>
                            {prod.show_price ? (
                              <div className="flex flex-col">
                                <span className="text-[10px] text-slate-400">A partir de</span>
                                <span className="font-extrabold text-base text-slate-900 font-heading">
                                  R$ {(prod.promo_price || prod.base_price).toFixed(2)}
                                </span>
                              </div>
                            ) : (
                              <span className="text-xs font-bold text-amber-600">Sob Consulta</span>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => onNavigate('product-detail', prod.id)}
                              className="px-3 py-1.5 bg-slate-900 hover:bg-[#E6007E] text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
                            >
                              Ver Detalhes
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: DADOS CADASTRAIS */}
      {activeTab === 'profile' && (
        <form onSubmit={handleSaveProfile} className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-heading text-lg font-bold text-slate-900 uppercase">Informações Pessoais & Corporativas</h3>
              <p className="text-xs text-slate-500">Mantenha seus dados atualizados para faturamento e entregas</p>
            </div>
            {savedSuccess && (
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-lg flex items-center gap-1">
                <Check className="w-3.5 h-3.5" /> Dados salvos com sucesso!
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Nome Completo</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#00AEEF] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">E-mail</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#00AEEF] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Telefone / WhatsApp</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#00AEEF] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Empresa / Razão Social</label>
              <input
                type="text"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#00AEEF] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">CNPJ ou CPF</label>
              <input
                type="text"
                value={cpfCnpj}
                onChange={(e) => setCpfCnpj(e.target.value)}
                placeholder="00.000.000/0001-00"
                className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#00AEEF] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Inscrição Estadual (IE)</label>
              <input
                type="text"
                value={stateRegistration}
                onChange={(e) => setStateRegistration(e.target.value)}
                placeholder="123.456.789.000 ou Isento"
                className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#00AEEF] focus:outline-none"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100">
            <h4 className="text-xs font-bold uppercase text-slate-800 tracking-wider mb-3">
              Endereço Principal de Entrega
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="lg:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">Logradouro / Rua</label>
                <input
                  type="text"
                  value={street}
                  onChange={(e) => setStreet(e.target.value)}
                  placeholder="Ex: Av. Paulista"
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#00AEEF] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Número</label>
                <input
                  type="text"
                  value={number}
                  onChange={(e) => setNumber(e.target.value)}
                  placeholder="1842"
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#00AEEF] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Bairro</label>
                <input
                  type="text"
                  value={neighborhood}
                  onChange={(e) => setNeighborhood(e.target.value)}
                  placeholder="Bela Vista"
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#00AEEF] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Cidade</label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="São Paulo"
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#00AEEF] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Estado</label>
                <input
                  type="text"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  placeholder="SP"
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#00AEEF] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">CEP</label>
                <input
                  type="text"
                  value={zip}
                  onChange={(e) => setZip(e.target.value)}
                  placeholder="01310-200"
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#00AEEF] focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div className="pt-4 flex justify-end">
            <button
              type="submit"
              className="px-6 py-2.5 bg-slate-900 hover:bg-[#E6007E] text-white font-bold rounded-xl text-xs transition-colors cursor-pointer"
            >
              Salvar Alterações
            </button>
          </div>
        </form>
      )}

      {/* Modal Visual do Boleto Bancário */}
      {activeBoletosModal && (
        <BoletoModal
          boletos={activeBoletosModal}
          onClose={() => setActiveBoletosModal(null)}
          onBoletoSettled={(updated) => {
            setActiveBoletosModal([updated]);
            setOrders(
              StorageService.getOrders().filter(
                (o) => o.clientId === currentUser.id || o.clientEmail === currentUser.email
              )
            );
          }}
        />
      )}

      {/* Modal: Solicitar Nova Cotação Baseada na Compra Anterior */}
      {isReQuoteModalOpen && reQuotingOrder && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200"
          id="re-quote-modal"
          role="dialog"
          aria-modal="true"
        >
          <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-sky-500/20 text-[#00AEEF] flex items-center justify-center">
                  <FileSpreadsheet className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm uppercase tracking-wide">
                    Solicitar Nova Cotação
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Baseada na compra anterior #{reQuotingOrder.code}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setIsReQuoteModalOpen(false);
                  setReQuotingOrder(null);
                }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-5 text-xs text-slate-700">
              {/* Info banner */}
              <div className="p-3.5 bg-sky-50 rounded-2xl border border-sky-200 flex items-start gap-2.5 text-sky-900">
                <Sparkles className="w-4 h-4 text-[#00AEEF] shrink-0 mt-0.5" />
                <p className="text-xs leading-relaxed">
                  Os itens e especificações do pedido <strong>#{reQuotingOrder.code}</strong> serão utilizados como referência para formulação de uma nova proposta comercial exclusiva pela nossa equipe de vendas.
                </p>
              </div>

              {/* Items Preview */}
              <div className="space-y-2">
                <span className="font-bold text-slate-900 text-xs uppercase tracking-wider block">
                  Itens Incluídos na Nova Cotação ({reQuotingOrder.items.length}):
                </span>
                <div className="max-h-48 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-2xl p-2 bg-slate-50/50">
                  {reQuotingOrder.items.map((item) => (
                    <div key={item.id} className="py-2 px-2 flex items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-2.5">
                        {item.productImage && (
                          <img
                            src={item.productImage}
                            alt={item.productName}
                            className="w-10 h-10 object-cover rounded-lg border border-slate-200 shrink-0"
                          />
                        )}
                        <div>
                          <p className="font-bold text-slate-900">{item.productName}</p>
                          <p className="text-[11px] text-slate-500">
                            {item.quantity} un • {item.customTechnique || 'Personalizado'}
                            {item.variantName ? ` • ${item.variantName}` : ''}
                          </p>
                        </div>
                      </div>
                      <span className="font-semibold text-slate-700">
                        R$ {item.total.toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Notes Input */}
              <div className="space-y-1.5">
                <label className="block font-bold text-slate-800 text-xs uppercase tracking-wider">
                  Observações & Ajustes para a Equipe Comercial:
                </label>
                <textarea
                  rows={4}
                  value={reQuoteNotes}
                  onChange={(e) => setReQuoteNotes(e.target.value)}
                  placeholder="Ex: Gostaríamos de cotar este mesmo pedido com aumento para 300 unidades ou verificar prazo mais rápido para entrega corporativa..."
                  className="w-full p-3 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#00AEEF] focus:outline-none transition-all leading-relaxed"
                />
                <p className="text-[11px] text-slate-400">
                  Você pode sugerir novas quantidades, outro prazo ou solicitar inclusão de embalagens especiais.
                </p>
              </div>

              {/* Customer Contact Confirmation */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-slate-600 space-y-1">
                <span className="font-bold text-slate-800 block text-[11px] uppercase tracking-wider">
                  Dados do Solicitante:
                </span>
                <p className="text-xs">
                  {currentUser.name} ({currentUser.email}) • {currentUser.phone}
                  {currentUser.company ? ` • ${currentUser.company}` : ''}
                </p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setIsReQuoteModalOpen(false);
                  setReQuotingOrder(null);
                }}
                className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isSubmittingReQuote}
                onClick={handleConfirmReQuote}
                className="px-5 py-2.5 text-xs font-bold text-white bg-[#00AEEF] hover:bg-[#0098d1] rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>{isSubmittingReQuote ? 'Registrando Cotação...' : 'Confirmar Solicitação de Orçamento'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
