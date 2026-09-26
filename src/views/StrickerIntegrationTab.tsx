import React, { useState, useEffect, useMemo } from 'react';
import {
  StrickerConfig,
  StrickerProduct,
  StrickerOptional,
  StrickerOrder,
  StrickerSyncLog,
  StrickerRequestLog,
  StrickerCustomizationTable,
} from '../types/stricker';
import { StrickerService } from '../services/stricker/StrickerService';
import { StrickerTestSuiteSection } from '../components/stricker/StrickerTestSuiteSection';
import {
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Clock,
  Shield,
  Layers,
  Package,
  TrendingUp,
  Sliders,
  FileText,
  Download,
  Upload,
  Plus,
  Search,
  Filter,
  Eye,
  Send,
  XCircle,
  ExternalLink,
  ChevronRight,
  Sparkles,
  Server,
  Zap,
  Tag,
  Boxes,
  HelpCircle,
  AlertTriangle,
  ArrowUpDown,
  Lock,
  Calendar,
} from 'lucide-react';

interface StrickerIntegrationTabProps {
  onRefreshData?: () => void;
}

export const StrickerIntegrationTab: React.FC<StrickerIntegrationTabProps> = ({ onRefreshData }) => {
  const [activeSubTab, setActiveSubTab] = useState<
    'overview' | 'testsuite' | 'catalog' | 'stock' | 'customizations' | 'orders' | 'settings' | 'logs'
  >('overview');

  const [config, setConfig] = useState<StrickerConfig>(() => StrickerService.auth.getConfig());
  const [products, setProducts] = useState<StrickerProduct[]>(() => StrickerService.products.getProducts());
  const [orders, setOrders] = useState<StrickerOrder[]>(() => StrickerService.orders.getOrders());
  const [customTables, setCustomTables] = useState<StrickerCustomizationTable[]>(() =>
    StrickerService.customization.getCustomizationTables()
  );
  const [syncLogs, setSyncLogs] = useState<StrickerSyncLog[]>(() => StrickerService.sync.getSyncLogs());
  const [requestLogs, setRequestLogs] = useState<StrickerRequestLog[]>(() => StrickerService.sync.getRequestLogs());

  // Connection & Sync States
  const [isTestingConn, setIsTestingConn] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; durationMs?: number } | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgressMsg, setSyncProgressMsg] = useState<string | null>(null);
  const [activeNotification, setActiveNotification] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [brandFilter, setBrandFilter] = useState('ALL');
  const [catalogFilter, setCatalogFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Stock Sub-tab Specific State
  const [stockSearchTerm, setStockSearchTerm] = useState('');
  const [stockStatusFilter, setStockStatusFilter] = useState<'all' | 'in_stock' | 'next_quantities' | 'out_of_stock'>('all');
  const [showNextDeliveriesTable, setShowNextDeliveriesTable] = useState(false);

  // Modals & Drawers
  const [selectedProduct, setSelectedProduct] = useState<StrickerProduct | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<StrickerOrder | null>(null);
  const [isNewOrderModalOpen, setIsNewOrderModalOpen] = useState(false);
  const [isArtworkModalOpen, setIsArtworkModalOpen] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  // Simulator State
  const [simProductRef, setSimProductRef] = useState<string>(products[0]?.reference || '94682');
  const [simAreaIdx, setSimAreaIdx] = useState<number>(0);
  const [simQty, setSimQty] = useState<number>(100);
  const [simColors, setSimColors] = useState<number>(1);

  // New Order Form State
  const [newOrderForm, setNewOrderForm] = useState({
    internalReference: `MB-INT-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
    productReference: products[0]?.reference || '94682',
    sku: products[0]?.optionals[0]?.sku || '94682-03',
    quantity: 50,
    lineType: 'print' as 'standard' | 'print' | 'sample',
    waitArtwork: true,
    serviceCode: 'LSR1-02-01',
    colors: 1,
    logoSize: '40x70mm',
    notes: '',
    recipientName: 'MB Personaliza - Almoxarifado',
    street: 'Av. Paulista',
    number: '1000',
    neighborhood: 'Bela Vista',
    city: 'São Paulo',
    state: 'SP',
    zip: '01310-100',
  });

  // Artwork Upload Form State
  const [artworkForm, setArtworkForm] = useState({
    artworkFilename: '',
    serviceCode: 'LSR1-02-01',
    colors: 1,
    logoSize: 'Padrão',
    operatorName: 'Administrador MB',
  });

  // Reload data on events and sync with server on mount
  useEffect(() => {
    const reload = () => {
      setConfig(StrickerService.auth.getConfig());
      setProducts(StrickerService.products.getProducts());
      setOrders(StrickerService.orders.getOrders());
      setCustomTables(StrickerService.customization.getCustomizationTables());
      setSyncLogs(StrickerService.sync.getSyncLogs());
      setRequestLogs(StrickerService.sync.getRequestLogs());
    };

    // Sincroniza status do servidor (.env e worker de sincronização)
    StrickerService.auth.syncWithServerConfig().then(() => {
      reload();
    });

    window.addEventListener('mb_stricker_config_updated', reload);
    window.addEventListener('mb_stricker_products_updated', reload);
    window.addEventListener('mb_stricker_orders_updated', reload);
    window.addEventListener('mb_stricker_customizations_updated', reload);
    window.addEventListener('mb_stricker_logs_updated', reload);
    return () => {
      window.removeEventListener('mb_stricker_config_updated', reload);
      window.removeEventListener('mb_stricker_products_updated', reload);
      window.removeEventListener('mb_stricker_orders_updated', reload);
      window.removeEventListener('mb_stricker_customizations_updated', reload);
      window.removeEventListener('mb_stricker_logs_updated', reload);
    };
  }, []);

  const showNotify = (type: 'success' | 'error' | 'info', message: string) => {
    setActiveNotification({ type, message });
    setTimeout(() => setActiveNotification(null), 5000);
  };

  // Test Connection
  const handleTestConnection = async () => {
    setIsTestingConn(true);
    setTestResult(null);
    try {
      const res = await StrickerService.auth.testConnection();
      setTestResult(res);
      setConfig(StrickerService.auth.getConfig());
      if (res.success) {
        showNotify('success', res.message);
      } else {
        showNotify('error', res.message);
      }
    } catch (e: any) {
      setTestResult({ success: false, message: e.message || 'Erro de conexão' });
      showNotify('error', e.message || 'Erro de conexão');
    } finally {
      setIsTestingConn(false);
    }
  };

  // Execute Sync
  const handleRunSync = async (type: 'all' | 'products' | 'stocks' | 'prices' | 'customizations' | 'orders') => {
    setIsSyncing(true);
    setSyncProgressMsg(`Sincronizando ${type}...`);
    try {
      const log = await StrickerService.sync.executeSync(type);
      setProducts(StrickerService.products.getProducts());
      setOrders(StrickerService.orders.getOrders());
      setSyncLogs(StrickerService.sync.getSyncLogs());
      setConfig(StrickerService.auth.getConfig());
      if (log.status === 'success') {
        showNotify('success', `Sincronização de ${type} concluída com sucesso!`);
      } else {
        showNotify('error', `Aviso na sincronização: ${log.errorMessage || log.details}`);
      }
      if (onRefreshData) onRefreshData();
    } catch (e: any) {
      showNotify('error', e.message || 'Falha ao sincronizar');
    } finally {
      setIsSyncing(false);
      setSyncProgressMsg(null);
    }
  };

  // Publish to Store
  const handlePublishToStore = (product: StrickerProduct) => {
    try {
      StrickerService.products.publishToStoreCatalog(product);
      setProducts(StrickerService.products.getProducts());
      showNotify('success', `Produto "${product.name}" publicado/atualizado com sucesso no catálogo da loja!`);
      if (onRefreshData) onRefreshData();
    } catch (e: any) {
      showNotify('error', e.message || 'Erro ao publicar produto');
    }
  };

  // Publish All to Store
  const handlePublishAllToStore = () => {
    try {
      const res = StrickerService.products.syncAllPublishedProductsToStore(true);
      setProducts(StrickerService.products.getProducts());
      showNotify('success', `${res.syncedCount} produtos Stricker publicados / sincronizados no catálogo da loja!`);
      if (onRefreshData) onRefreshData();
    } catch (e: any) {
      showNotify('error', e.message || 'Erro ao publicar produtos');
    }
  };

  // Update Margin
  const handleUpdateMargin = (productId: string, margin: number) => {
    StrickerService.products.updateProductMargin(productId, margin);
    setProducts(StrickerService.products.getProducts());
    showNotify('info', `Margem de lucro atualizada para ${margin}% com novos preços calculados.`);
  };

  // Create Order
  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    const prod = products.find((p) => p.reference === newOrderForm.productReference);
    const opt = prod?.optionals.find((o) => o.sku === newOrderForm.sku);
    const unitPrice = opt?.priceOriginal || 38.5;

    const res = await StrickerService.orders.createOrder({
      internalReference: newOrderForm.internalReference,
      waitArtwork: newOrderForm.waitArtwork,
      deliveryAddress: {
        recipientName: newOrderForm.recipientName,
        street: newOrderForm.street,
        number: newOrderForm.number,
        neighborhood: newOrderForm.neighborhood,
        city: newOrderForm.city,
        state: newOrderForm.state,
        zip: newOrderForm.zip,
        country: 'Brasil',
      },
      lines: [
        {
          productReference: newOrderForm.productReference,
          sku: newOrderForm.sku,
          quantity: Number(newOrderForm.quantity),
          lineType: newOrderForm.lineType,
          sample: newOrderForm.lineType === 'sample',
          unitPrice,
        },
      ],
      serviceLines:
        newOrderForm.lineType === 'print'
          ? [
              {
                serviceCode: newOrderForm.serviceCode,
                colors: Number(newOrderForm.colors),
                logoSize: newOrderForm.logoSize,
                group: `LOGO-${newOrderForm.internalReference}`,
              },
            ]
          : undefined,
      notes: newOrderForm.notes,
      operatorName: 'Administrador MB',
    });

    if (res.success && res.order) {
      setOrders(StrickerService.orders.getOrders());
      setIsNewOrderModalOpen(false);
      showNotify('success', `Pedido ${res.order.orderStamp || res.order.internalReference} enviado com sucesso para a Stricker!`);
      // Reset form
      setNewOrderForm({
        ...newOrderForm,
        internalReference: `MB-INT-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
        quantity: 50,
        notes: '',
      });
    } else {
      showNotify('error', res.error || 'Erro ao enviar pedido para a Stricker.');
    }
  };

  // Attach Artwork
  const handleAttachArtwork = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;

    if (!artworkForm.artworkFilename.trim()) {
      showNotify('error', 'Por favor informe o nome ou selecione o arquivo de arte.');
      return;
    }

    const res = await StrickerService.orders.attachArtworkToOrder(selectedOrder.id, {
      artworkFilename: artworkForm.artworkFilename,
      serviceCode: artworkForm.serviceCode,
      colors: artworkForm.colors,
      logoSize: artworkForm.logoSize,
      operatorName: artworkForm.operatorName,
    });

    if (res.success && res.order) {
      setOrders(StrickerService.orders.getOrders());
      setSelectedOrder(res.order);
      setIsArtworkModalOpen(false);
      showNotify('success', 'Arquivo de arte anexado e enviado com sucesso! Status alterado para PENDING_MOCKUP_APPROVAL.');
    } else {
      showNotify('error', res.error || 'Erro ao anexar arte.');
    }
  };

  // Approve Mockup
  const handleApproveMockup = async (orderId: string) => {
    const res = await StrickerService.orders.approveMockup(orderId, 'Administrador MB');
    if (res.success && res.order) {
      setOrders(StrickerService.orders.getOrders());
      if (selectedOrder?.id === orderId) setSelectedOrder(res.order);
      showNotify('success', 'Maquete aprovada com sucesso! Pedido liberado para produção.');
    }
  };

  // Cancel Order
  const handleCancelOrder = async () => {
    if (!selectedOrder) return;
    if (!cancelReason.trim()) {
      showNotify('error', 'Por favor informe a justificativa do cancelamento.');
      return;
    }

    const res = await StrickerService.orders.cancelOrder(selectedOrder.id, cancelReason, 'Administrador MB');
    if (res.success && res.order) {
      setOrders(StrickerService.orders.getOrders());
      setSelectedOrder(res.order);
      setIsCancelModalOpen(false);
      setCancelReason('');
      showNotify('success', 'Pedido cancelado com sucesso no WebService da Stricker (CancelOrderV1).');
    } else {
      showNotify('error', res.error || 'Erro ao cancelar pedido.');
    }
  };

  // Filtered Products
  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      searchTerm === '' ||
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.reference.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.brand.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesBrand = brandFilter === 'ALL' || p.brand === brandFilter;
    const matchesCatalog = catalogFilter === 'ALL' || p.catalog === catalogFilter;
    const matchesStatus = statusFilter === 'ALL' || p.status === statusFilter;
    return matchesSearch && matchesBrand && matchesCatalog && matchesStatus;
  });

  // Filtered Products for Stock Sub-Tab
  const filteredStockProducts = useMemo(() => {
    return products.filter((p) => {
      const totalStock = Number(p.totalStockAvailable ?? 0);
      const totalNext = Number(p.totalNextQuantities ?? 0);

      // Search match
      const term = stockSearchTerm.toLowerCase().trim();
      const matchesSearch =
        term === '' ||
        (p.name || '').toLowerCase().includes(term) ||
        (p.reference || '').toLowerCase().includes(term) ||
        (p.optionals || []).some(
          (opt) =>
            (opt.sku || '').toLowerCase().includes(term) ||
            (opt.colorName || '').toLowerCase().includes(term)
        );

      // Status filter
      let matchesStatus = true;
      if (stockStatusFilter === 'in_stock') {
        matchesStatus = totalStock > 0;
      } else if (stockStatusFilter === 'next_quantities') {
        matchesStatus = totalNext > 0;
      } else if (stockStatusFilter === 'out_of_stock') {
        matchesStatus = totalStock === 0;
      }

      return matchesSearch && matchesStatus;
    });
  }, [products, stockSearchTerm, stockStatusFilter]);

  // Consolidate Real-time Stock Statistics
  const stockStats = useMemo(() => {
    let totalImmediateStock = 0;
    let totalNextQuantitiesCount = 0;
    let inStockSkus = 0;
    let outOfStockSkus = 0;
    let totalSkus = 0;

    products.forEach((p) => {
      totalImmediateStock += Number(p.totalStockAvailable ?? 0);
      totalNextQuantitiesCount += Number(p.totalNextQuantities ?? 0);

      (p.optionals || []).forEach((opt) => {
        totalSkus++;
        const optStock = Number(opt.stockAvailable ?? 0);
        if (optStock > 0) {
          inStockSkus++;
        } else {
          outOfStockSkus++;
        }
      });
    });

    const nextDeliveries = StrickerService.stocks.getNextDeliveries();

    return {
      totalImmediateStock,
      totalNextQuantitiesCount,
      inStockSkus,
      outOfStockSkus,
      totalSkus,
      nextDeliveries,
    };
  }, [products]);

  // Brands List
  const brands = Array.from(new Set(products.map((p) => p.brand))).filter(Boolean);

  // Selected Simulation Product & Area
  const simProd = products.find((p) => p.reference === simProductRef) || products[0];
  const simArea = simProd?.customizationOptions?.[simAreaIdx] || simProd?.customizationOptions?.[0] || null;
  const simCalculation = simProd
    ? StrickerService.customization.calculateCombinedItemTotal(
        simProd.salePriceMin,
        simArea,
        simQty,
        simColors
      )
    : null;

  return (
    <div className="space-y-6" id="stricker-integration-panel">
      {/* Toast Notification */}
      {activeNotification && (
        <div
          id="stricker-notification-toast"
          className={`fixed bottom-6 right-6 z-50 p-4 rounded-xl shadow-lg border flex items-center gap-3 transition-all transform animate-in slide-in-from-bottom-5 ${
            activeNotification.type === 'success'
              ? 'bg-emerald-900/90 text-emerald-100 border-emerald-700 backdrop-blur-md'
              : activeNotification.type === 'error'
              ? 'bg-rose-900/90 text-rose-100 border-rose-700 backdrop-blur-md'
              : 'bg-slate-900/90 text-slate-100 border-slate-700 backdrop-blur-md'
          }`}
        >
          {activeNotification.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />}
          {activeNotification.type === 'error' && <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />}
          {activeNotification.type === 'info' && <Zap className="w-5 h-5 text-amber-400 shrink-0" />}
          <span className="text-sm font-medium">{activeNotification.message}</span>
        </div>
      )}

      {/* Main Connection Status Header Card */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-6 text-white shadow-xl border border-indigo-900/50">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="px-3 py-1 bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 rounded-full text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5">
                <Server className="w-3.5 h-3.5" />
                Webservice v1.0 Oficial
              </span>
              <span className="px-3 py-1 bg-amber-500/20 text-amber-300 border border-amber-400/30 rounded-full text-xs font-medium">
                {config.environment === 'production' ? '🚀 Modo Produção' : '🧪 Modo Sandbox / Homologação'}
              </span>
              {config.lastConnectionStatus === 'connected' ? (
                <span className="px-3 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 rounded-full text-xs font-medium flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  Conexão Ativa & Validada
                </span>
              ) : (
                <span className="px-3 py-1 bg-rose-500/20 text-rose-300 border border-rose-400/30 rounded-full text-xs font-medium flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-rose-400"></span>
                  Desconectado / Erro
                </span>
              )}
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              Integração Stricker Brasil / SPOT Gifts
            </h2>
            <p className="text-slate-300 text-sm max-w-3xl leading-relaxed">
              Sincronização em tempo real de produtos, opções de cores, faixas de preços, tabelas de personalização,
              estoque com <strong className="text-white">Next Quantities</strong> e emissão de pedidos diretos com suporte a fluxo de arte e maquete.
            </p>
          </div>

          {/* Quick Header Actions */}
          <div className="flex items-center gap-3 flex-wrap">
            <button
              id="btn-test-stricker-conn"
              onClick={handleTestConnection}
              disabled={isTestingConn}
              className="px-4 py-2.5 bg-slate-800/80 hover:bg-slate-700 text-white rounded-xl text-sm font-medium border border-slate-700 flex items-center gap-2 transition shadow-sm disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 text-indigo-400 ${isTestingConn ? 'animate-spin' : ''}`} />
              {isTestingConn ? 'Testando...' : 'Testar Conexão'}
            </button>

            <button
              id="btn-sync-all-stricker"
              onClick={() => handleRunSync('all')}
              disabled={isSyncing}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold flex items-center gap-2 transition shadow-md shadow-indigo-600/30 disabled:opacity-50 cursor-pointer"
            >
              <Zap className={`w-4 h-4 text-amber-300 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'Sincronizando...' : 'Sincronizar Tudo'}
            </button>

            <div className="relative group">
              <button
                id="btn-export-stricker-catalog"
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-sm font-medium border border-slate-700 flex items-center gap-2 transition cursor-pointer"
              >
                <Download className="w-4 h-4 text-emerald-400" />
                Exportar
              </button>
              <div className="absolute right-0 mt-2 w-48 bg-white text-slate-900 rounded-xl shadow-xl border border-slate-200 py-2 hidden group-hover:block z-40">
                <button
                  onClick={() => StrickerService.exportDirectDownload('json')}
                  className="w-full text-left px-4 py-2 text-sm hover:bg-indigo-50 text-slate-700 flex items-center gap-2"
                >
                  <FileText className="w-4 h-4 text-indigo-600" /> JSON Format
                </button>
                <button
                  onClick={() => StrickerService.exportDirectDownload('csv')}
                  className="w-full text-left px-4 py-2 text-sm hover:bg-indigo-50 text-slate-700 flex items-center gap-2"
                >
                  <FileText className="w-4 h-4 text-emerald-600" /> Planilha CSV
                </button>
                <button
                  onClick={() => StrickerService.exportDirectDownload('xml')}
                  className="w-full text-left px-4 py-2 text-sm hover:bg-indigo-50 text-slate-700 flex items-center gap-2"
                >
                  <FileText className="w-4 h-4 text-amber-600" /> XML Stricker
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Sync Progress Bar if Active */}
        {isSyncing && (
          <div className="mt-5 p-3 bg-indigo-900/40 rounded-xl border border-indigo-500/30 flex items-center justify-between gap-4 animate-pulse">
            <div className="flex items-center gap-3">
              <RefreshCw className="w-4 h-4 text-indigo-300 animate-spin" />
              <span className="text-sm font-medium text-indigo-200">{syncProgressMsg || 'Processando integração com o servidor Stricker...'}</span>
            </div>
            <span className="text-xs text-indigo-300 font-mono">REST HTTPS SSL / v1.0</span>
          </div>
        )}

        {/* Test Result Message Box */}
        {testResult && (
          <div
            className={`mt-4 p-3 rounded-xl border text-sm flex items-center justify-between gap-3 ${
              testResult.success
                ? 'bg-emerald-950/60 border-emerald-700/50 text-emerald-200'
                : 'bg-rose-950/60 border-rose-700/50 text-rose-200'
            }`}
          >
            <div className="flex items-center gap-2">
              {testResult.success ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertCircle className="w-4 h-4 text-rose-400" />}
              <span>{testResult.message}</span>
            </div>
            {testResult.durationMs !== undefined && (
              <span className="text-xs font-mono opacity-80">{testResult.durationMs} ms de resposta</span>
            )}
          </div>
        )}
      </div>

      {/* Environmental Key & Background Sync Status Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4" id="stricker-env-status-banner">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Chave WebService:</span>
            {config.isEnvKeyConfigured ? (
              <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-medium flex items-center gap-1.5 shadow-2xs">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Ativa via .env</span>
                <span className="font-mono text-[11px] bg-emerald-100/70 px-1.5 py-0.5 rounded text-emerald-900 font-semibold">
                  {config.maskedAccessKey || 'STRK-****-9821'}
                </span>
              </span>
            ) : (
              <span className="px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg text-xs font-medium flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                <span>Modo Local / Sandbox (STRICKER_ACCESS_KEY no .env)</span>
              </span>
            )}
          </div>

          <div className="h-4 w-px bg-slate-200 hidden sm:block" />

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Sincronização em Background:</span>
            {config.autoSyncEnabled ? (
              <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-medium flex items-center gap-1.5 shadow-2xs">
                <Clock className="w-3.5 h-3.5 text-indigo-600 animate-pulse" />
                <span>Ativa ({config.syncIntervalHours || 4}h)</span>
                {config.nextAutoSyncDate && (
                  <span className="text-[11px] text-indigo-500">
                    • Próxima: {new Date(config.nextAutoSyncDate).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </span>
            ) : (
              <span className="px-2.5 py-1 bg-slate-100 text-slate-600 border border-slate-200 rounded-lg text-xs font-medium">
                Desativada
              </span>
            )}
          </div>
        </div>

        {/* Quick Sync Direct Buttons */}
        <div className="flex items-center gap-2 w-full md:w-auto justify-end">
          <button
            id="btn-quick-sync-products"
            onClick={() => handleRunSync('products')}
            disabled={isSyncing}
            className="px-3 py-1.5 bg-slate-50 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 border border-slate-200 hover:border-indigo-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition disabled:opacity-50 cursor-pointer shadow-2xs"
            title="Sincronizar produtos, descrições e SKUs da API Stricker"
          >
            <Package className="w-3.5 h-3.5 text-indigo-600" />
            <span>Sincronizar Produtos</span>
          </button>

          <button
            id="btn-quick-sync-stocks"
            onClick={() => handleRunSync('stocks')}
            disabled={isSyncing}
            className="px-3 py-1.5 bg-slate-50 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 border border-slate-200 hover:border-emerald-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition disabled:opacity-50 cursor-pointer shadow-2xs"
            title="Sincronizar estoques disponíveis e Next Quantities da Stricker"
          >
            <Boxes className="w-3.5 h-3.5 text-emerald-600" />
            <span>Sincronizar Estoques</span>
          </button>
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="flex items-center gap-1 border-b border-slate-200 overflow-x-auto pb-px" id="stricker-subnav">
        {[
          { id: 'overview', label: 'Visão Geral & Sincronização', icon: Layers },
          { id: 'testsuite', label: 'Validação & Testes da Documentação', icon: CheckCircle2 },
          { id: 'catalog', label: 'Catálogo Stricker & SKUs', icon: Package, count: products.length },
          { id: 'stock', label: 'Estoque & Next Quantities', icon: Boxes },
          { id: 'customizations', label: 'Personalizações & Tabelas', icon: Sliders, count: customTables.length },
          { id: 'orders', label: 'Pedidos WebService (OrderV1)', icon: Send, count: orders.length },
          { id: 'settings', label: 'Configurações da API', icon: Shield },
          { id: 'logs', label: 'Histórico & Logs de Auditoria', icon: FileText, count: syncLogs.length },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              id={`tab-stricker-${tab.id}`}
              onClick={() => setActiveSubTab(tab.id as any)}
              className={`px-4 py-3 text-sm font-medium border-b-2 flex items-center gap-2 whitespace-nowrap transition cursor-pointer ${
                isActive
                  ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50'
                  : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                    isActive ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* SUB-TAB 1: VISÃO GERAL & SINCRONIZAÇÃO */}
      {activeSubTab === 'overview' && (
        <div className="space-y-6 animate-in fade-in-50">
          {/* Metric Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs hover:border-indigo-200 transition">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Produtos Stricker</span>
                <Package className="w-5 h-5 text-indigo-600" />
              </div>
              <div className="text-2xl font-bold text-slate-900">{products.length}</div>
              <div className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                <span className="text-emerald-600 font-medium">{products.filter((p) => p.publishedToCatalog).length} na vitrine</span>
                <span>• {products.reduce((a, b) => a + b.optionals.length, 0)} SKUs totais</span>
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs hover:border-indigo-200 transition">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Estoque Disponível</span>
                <Boxes className="w-5 h-5 text-emerald-600" />
              </div>
              <div className="text-2xl font-bold text-slate-900">
                {products.reduce((a, b) => a + b.totalStockAvailable, 0).toLocaleString('pt-BR')} un
              </div>
              <div className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                <span className="text-indigo-600 font-medium">
                  +{products.reduce((a, b) => a + b.totalNextQuantities, 0).toLocaleString('pt-BR')} em Next Quantities
                </span>
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs hover:border-indigo-200 transition">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Tabelas de Gravação</span>
                <Sliders className="w-5 h-5 text-amber-600" />
              </div>
              <div className="text-2xl font-bold text-slate-900">{customTables.length} técnicas</div>
              <div className="text-xs text-slate-500 mt-1">Laser, Silk Screen, Transfer, UV</div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs hover:border-indigo-200 transition">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Pedidos no WebService</span>
                <Send className="w-5 h-5 text-purple-600" />
              </div>
              <div className="text-2xl font-bold text-slate-900">{orders.length}</div>
              <div className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                <span className="text-amber-600 font-medium">
                  {orders.filter((o) => o.status === 'WAITING_ART_WORK' || o.status === 'PENDING_MOCKUP_APPROVAL').length} pendentes arte/maquete
                </span>
              </div>
            </div>
          </div>

          {/* Granular Synchronization Action Cards */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <RefreshCw className="w-5 h-5 text-indigo-600" />
                  Ações de Sincronização Granular
                </h3>
                <p className="text-sm text-slate-500">
                  Execute atualizações sob demanda para módulos específicos sem sobrecarregar a quota de requisições.
                </p>
              </div>
              <div className="text-xs text-slate-400 font-mono">
                Último sync geral: {config.lastProductsSyncDate ? new Date(config.lastProductsSyncDate).toLocaleTimeString('pt-BR') : 'Nunca'}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Products Sync */}
              <div className="p-4 rounded-xl border border-slate-200 hover:border-indigo-300 bg-slate-50/50 flex flex-col justify-between gap-4 transition">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-slate-900 flex items-center gap-2 text-sm">
                      <Package className="w-4 h-4 text-indigo-600" /> Produtos & SKUs
                    </h4>
                    <span className="text-xs text-slate-400">productsTree</span>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Sincroniza referências, descrições, marcas (Branve, Ekston, Suco), catálogo SPOT e imagens.
                  </p>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                  <span className="text-[11px] text-slate-400">
                    {config.lastProductsSyncDate ? new Date(config.lastProductsSyncDate).toLocaleDateString('pt-BR') : 'Pendente'}
                  </span>
                  <button
                    onClick={() => handleRunSync('products')}
                    disabled={isSyncing}
                    className="px-3 py-1.5 bg-white hover:bg-indigo-50 text-indigo-700 border border-slate-300 hover:border-indigo-400 rounded-lg text-xs font-semibold transition cursor-pointer"
                  >
                    Sincronizar
                  </button>
                </div>
              </div>

              {/* Stocks Sync */}
              <div className="p-4 rounded-xl border border-slate-200 hover:border-emerald-300 bg-slate-50/50 flex flex-col justify-between gap-4 transition">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-slate-900 flex items-center gap-2 text-sm">
                      <Boxes className="w-4 h-4 text-emerald-600" /> Estoque & Next Quantities
                    </h4>
                    <span className="text-xs text-slate-400">stocks</span>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Consulta saldos disponíveis imediatos e previsões de remessas com datas futuras estimadas.
                  </p>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                  <span className="text-[11px] text-slate-400">
                    {config.lastStockSyncDate ? new Date(config.lastStockSyncDate).toLocaleDateString('pt-BR') : 'Pendente'}
                  </span>
                  <button
                    onClick={() => handleRunSync('stocks')}
                    disabled={isSyncing}
                    className="px-3 py-1.5 bg-white hover:bg-emerald-50 text-emerald-700 border border-slate-300 hover:border-emerald-400 rounded-lg text-xs font-semibold transition cursor-pointer"
                  >
                    Sincronizar
                  </button>
                </div>
              </div>

              {/* Prices Sync */}
              <div className="p-4 rounded-xl border border-slate-200 hover:border-amber-300 bg-slate-50/50 flex flex-col justify-between gap-4 transition">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-slate-900 flex items-center gap-2 text-sm">
                      <TrendingUp className="w-4 h-4 text-amber-600" /> Preços & Faixas
                    </h4>
                    <span className="text-xs text-slate-400">optionalsPrice</span>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Atualiza tabelas de custos do fornecedor e recalcula preços de venda com base na margem de lucro.
                  </p>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                  <span className="text-[11px] text-slate-400">
                    {config.lastPricesSyncDate ? new Date(config.lastPricesSyncDate).toLocaleDateString('pt-BR') : 'Pendente'}
                  </span>
                  <button
                    onClick={() => handleRunSync('prices')}
                    disabled={isSyncing}
                    className="px-3 py-1.5 bg-white hover:bg-amber-50 text-amber-700 border border-slate-300 hover:border-amber-400 rounded-lg text-xs font-semibold transition cursor-pointer"
                  >
                    Sincronizar
                  </button>
                </div>
              </div>

              {/* Customizations Sync */}
              <div className="p-4 rounded-xl border border-slate-200 hover:border-purple-300 bg-slate-50/50 flex flex-col justify-between gap-4 transition">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-slate-900 flex items-center gap-2 text-sm">
                      <Sliders className="w-4 h-4 text-purple-600" /> Técnicas & Tabelas
                    </h4>
                    <span className="text-xs text-slate-400">customizationTables</span>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Importa custos de impressão, setup fixo, custos de manuseio e áreas técnicas por técnica.
                  </p>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                  <span className="text-[11px] text-slate-400">
                    {config.lastCustomizationsSyncDate ? new Date(config.lastCustomizationsSyncDate).toLocaleDateString('pt-BR') : 'Pendente'}
                  </span>
                  <button
                    onClick={() => handleRunSync('customizations')}
                    disabled={isSyncing}
                    className="px-3 py-1.5 bg-white hover:bg-purple-50 text-purple-700 border border-slate-300 hover:border-purple-400 rounded-lg text-xs font-semibold transition cursor-pointer"
                  >
                    Sincronizar
                  </button>
                </div>
              </div>

              {/* Orders Sync */}
              <div className="p-4 rounded-xl border border-slate-200 hover:border-indigo-300 bg-slate-50/50 flex flex-col justify-between gap-4 transition">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-slate-900 flex items-center gap-2 text-sm">
                      <Send className="w-4 h-4 text-indigo-600" /> Status de Pedidos
                    </h4>
                    <span className="text-xs text-slate-400">ordersV1 / details</span>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Acompanha alterações de status (WAITING_ART_WORK, PROCESSING, SHIPPED) e códigos de rastreio.
                  </p>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                  <span className="text-[11px] text-slate-400">
                    {config.lastOrdersSyncDate ? new Date(config.lastOrdersSyncDate).toLocaleDateString('pt-BR') : 'Pendente'}
                  </span>
                  <button
                    onClick={() => handleRunSync('orders')}
                    disabled={isSyncing}
                    className="px-3 py-1.5 bg-white hover:bg-indigo-50 text-indigo-700 border border-slate-300 hover:border-indigo-400 rounded-lg text-xs font-semibold transition cursor-pointer"
                  >
                    Sincronizar
                  </button>
                </div>
              </div>

              {/* Direct Download Exports */}
              <div className="p-4 rounded-xl border border-slate-200 hover:border-cyan-300 bg-slate-50/50 flex flex-col justify-between gap-4 transition">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-slate-900 flex items-center gap-2 text-sm">
                      <Download className="w-4 h-4 text-cyan-600" /> Download Direto
                    </h4>
                    <span className="text-xs text-slate-400">XML / JSON / CSV</span>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Exportação em alta velocidade para cargas massivas de dados e reconciliação contábil.
                  </p>
                </div>
                <div className="flex items-center gap-2 pt-2 border-t border-slate-200">
                  <button
                    onClick={() => StrickerService.exportDirectDownload('json')}
                    className="flex-1 px-2 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-medium text-center"
                  >
                    JSON
                  </button>
                  <button
                    onClick={() => StrickerService.exportDirectDownload('csv')}
                    className="flex-1 px-2 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-medium text-center"
                  >
                    CSV
                  </button>
                  <button
                    onClick={() => StrickerService.exportDirectDownload('xml')}
                    className="flex-1 px-2 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-medium text-center"
                  >
                    XML
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* WebService Architecture & Security Overview */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Shield className="w-5 h-5 text-indigo-600" />
                Arquitetura e Segurança de Dados (Stricker v1.0)
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                A integração é executada estritamente através da camada de serviço backend (<code className="bg-slate-100 px-1.5 py-0.5 rounded text-indigo-700 font-mono text-xs">/api/stricker/*</code>),
                garantindo que sua <strong className="text-slate-900">Access Key</strong> e tokens de autenticação nunca sejam expostos ao navegador do cliente.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-xs text-slate-500 font-medium">Ciclo de Vida do Token:</span>
                  <p className="text-sm font-semibold text-slate-800 mt-0.5">Renovação automática (24h)</p>
                  <p className="text-xs text-slate-500 mt-1">Reutilização eficiente sem chamadas redundantes.</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-xs text-slate-500 font-medium">Proteção de Idempotência:</span>
                  <p className="text-sm font-semibold text-slate-800 mt-0.5">Internal Reference Tracker</p>
                  <p className="text-xs text-slate-500 mt-1">Evita duplicação de pedidos (Código de Erro 70).</p>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl border border-indigo-100 p-6 space-y-4">
              <h3 className="text-base font-bold text-indigo-950 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-600" />
                Destaques da Integração
              </h3>
              <ul className="space-y-2.5 text-xs text-indigo-900">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span><strong>Marcas Oficiais:</strong> Branve, Ekston, Suco e linha SPOT.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span><strong>Next Quantities:</strong> Previsões de reposição com datas futuras.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span><strong>WaitArtwork:</strong> Reserva imediata de estoque com envio posterior da arte.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span><strong>Publicação Controlada:</strong> 1-click para publicar na vitrine da loja.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 2: CATÁLOGO STRICKER & SKUS */}
      {activeSubTab === 'catalog' && (
        <div className="space-y-6 animate-in fade-in-50">
          {/* Filter Bar */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3 w-full md:w-auto flex-1">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 transform -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar por referência, nome ou marca..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                />
              </div>

              {/* Brand Filter */}
              <select
                value={brandFilter}
                onChange={(e) => setBrandFilter(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium text-slate-700"
              >
                <option value="ALL">Todas as Marcas</option>
                {brands.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>

              {/* Catalog Filter */}
              <select
                value={catalogFilter}
                onChange={(e) => setCatalogFilter(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium text-slate-700"
              >
                <option value="ALL">Todos os Catálogos</option>
                <option value="SPOT">Catálogo SPOT</option>
                <option value="Stockout">Stockout</option>
                <option value="OnlineExclusive">Exclusivo Online</option>
              </select>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium text-slate-700"
              >
                <option value="ALL">Todos os Status</option>
                <option value="ativo">Ativo</option>
                <option value="importado">Importado (Pendente)</option>
                <option value="em_analise">Em Análise</option>
                <option value="bloqueado">Bloqueado</option>
              </select>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handlePublishAllToStore}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                title="Publica todos os produtos ativos da Stricker diretamente no catálogo da loja"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Publicar Todos na Loja</span>
              </button>
              <div className="text-xs text-slate-500 whitespace-nowrap">
                Mostrando <strong>{filteredProducts.length}</strong> de <strong>{products.length}</strong> produtos
              </div>
            </div>
          </div>

          {/* Products Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    <th className="py-3.5 px-4">Produto & Referência</th>
                    <th className="py-3.5 px-4">Marca & Catálogo</th>
                    <th className="py-3.5 px-4">SKUs / Cores</th>
                    <th className="py-3.5 px-4">Estoque / Next</th>
                    <th className="py-3.5 px-4">Preço Custo</th>
                    <th className="py-3.5 px-4">Margem %</th>
                    <th className="py-3.5 px-4">Preço Venda</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredProducts.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={p.mainImage}
                            alt={p.name}
                            className="w-12 h-12 rounded-lg object-cover border border-slate-200 shrink-0 bg-slate-50"
                            referrerPolicy="no-referrer"
                          />
                          <div>
                            <div className="font-semibold text-slate-900 line-clamp-1">{p.name}</div>
                            <div className="text-xs text-slate-500 font-mono">Ref: {p.reference}</div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex flex-col gap-1">
                          <span className="font-medium text-slate-800 text-xs">{p.brand}</span>
                          <span
                            className={`inline-flex px-2 py-0.5 rounded text-[11px] font-medium w-fit ${
                              p.catalog === 'SPOT'
                                ? 'bg-indigo-100 text-indigo-700'
                                : p.catalog === 'Stockout'
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-purple-100 text-purple-700'
                            }`}
                          >
                            {p.catalog}
                          </span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5 flex-wrap max-w-[140px]">
                          {p.optionals.map((opt) => (
                            <span
                              key={opt.id}
                              title={`${opt.colorName} (${opt.sku})`}
                              className="w-4 h-4 rounded-full border border-slate-300 shrink-0 shadow-2xs"
                              style={{ backgroundColor: opt.colorHex || '#CBD5E1' }}
                            />
                          ))}
                          <span className="text-xs text-slate-500 font-medium">({p.optionals.length})</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div>
                          <div
                            className={`font-semibold text-xs ${
                              p.totalStockAvailable === 0 ? 'text-rose-600' : 'text-slate-900'
                            }`}
                          >
                            {p.totalStockAvailable.toLocaleString('pt-BR')} un
                          </div>
                          {p.totalNextQuantities > 0 && (
                            <div className="text-[11px] text-indigo-600 font-medium">
                              +{p.totalNextQuantities.toLocaleString('pt-BR')} previstos
                            </div>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 font-mono text-xs text-slate-700">
                        R$ {p.costPriceMin.toFixed(2)}
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min="0"
                            max="500"
                            defaultValue={p.profitMarginPct}
                            onBlur={(e) => handleUpdateMargin(p.id, Number(e.target.value))}
                            className="w-16 px-2 py-1 text-xs border border-slate-300 rounded-md font-medium text-slate-800 text-center"
                          />
                          <span className="text-xs text-slate-500">%</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 font-mono text-xs font-semibold text-emerald-700">
                        R$ {p.salePriceMin.toFixed(2)}
                      </td>

                      <td className="py-3.5 px-4">
                        <select
                          value={p.status}
                          onChange={(e) => {
                            StrickerService.products.updateProductStatus(p.id, e.target.value as any);
                            setProducts(StrickerService.products.getProducts());
                          }}
                          className={`text-xs font-medium px-2 py-1 rounded-md border ${
                            p.status === 'ativo'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : p.status === 'importado'
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : 'bg-slate-50 text-slate-600 border-slate-200'
                          }`}
                        >
                          <option value="importado">Importado</option>
                          <option value="em_analise">Em Análise</option>
                          <option value="ativo">Ativo</option>
                          <option value="inativo">Inativo</option>
                          <option value="bloqueado">Bloqueado</option>
                        </select>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setSelectedProduct(p)}
                            title="Ver Detalhes do Produto"
                            className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => handlePublishToStore(p)}
                            title={p.publishedToCatalog ? 'Clique para atualizar dados no catálogo da loja' : 'Publicar na Loja MB Personaliza'}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition cursor-pointer ${
                              p.publishedToCatalog
                                ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-2xs'
                                : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs'
                            }`}
                          >
                            {p.publishedToCatalog ? (
                              <>
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Na Loja
                              </>
                            ) : (
                              <>
                                <Upload className="w-3.5 h-3.5" /> Publicar
                              </>
                            )}
                          </button>
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

      {/* SUB-TAB 3: ESTOQUE & NEXT QUANTITIES */}
      {activeSubTab === 'stock' && (
        <div className="space-y-6 animate-in fade-in-50">
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-6">
            {/* Header & Actions */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Boxes className="w-5 h-5 text-indigo-600" />
                  Saldos Imediatos & Próximas Entradas (Next Quantities)
                </h3>
                <p className="text-sm text-slate-500">
                  Visão consolidada de disponibilidade em tempo real no armazém da Stricker Brasil e previsão de lotes de importação.
                </p>
              </div>

              <div className="flex items-center gap-2.5 flex-wrap">
                <button
                  type="button"
                  id="btn-toggle-next-deliveries"
                  onClick={() => setShowNextDeliveriesTable(!showNextDeliveriesTable)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-semibold border flex items-center gap-1.5 transition cursor-pointer ${
                    showNextDeliveriesTable
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                  }`}
                >
                  <Calendar className="w-3.5 h-3.5" />
                  {showNextDeliveriesTable ? 'Ocultar Cronograma' : 'Ver Cronograma de Entradas'}
                  <span
                    className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                      showNextDeliveriesTable ? 'bg-indigo-700 text-white' : 'bg-indigo-100 text-indigo-800'
                    }`}
                  >
                    {stockStats.nextDeliveries.length}
                  </span>
                </button>

                <button
                  type="button"
                  id="btn-sync-stocks-now"
                  onClick={() => handleRunSync('stocks')}
                  disabled={isSyncing}
                  className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-sm font-semibold flex items-center gap-2 transition cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                  {isSyncing ? 'Atualizando...' : 'Atualizar Estoque Agora'}
                </button>
              </div>
            </div>

            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 block mb-1">
                  Estoque Imediato
                </span>
                <span className="text-xl font-bold text-slate-900 font-mono">
                  {stockStats.totalImmediateStock.toLocaleString('pt-BR')}{' '}
                  <span className="text-xs font-normal text-slate-500">un</span>
                </span>
              </div>

              <div className="bg-indigo-50/60 p-3.5 rounded-xl border border-indigo-100">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-indigo-700 block mb-1">
                  Next Quantities
                </span>
                <span className="text-xl font-bold text-indigo-900 font-mono">
                  +{stockStats.totalNextQuantitiesCount.toLocaleString('pt-BR')}{' '}
                  <span className="text-xs font-normal text-indigo-600">un</span>
                </span>
              </div>

              <div className="bg-emerald-50/60 p-3.5 rounded-xl border border-emerald-100">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700 block mb-1">
                  SKUs Disponíveis
                </span>
                <span className="text-xl font-bold text-emerald-800 font-mono">
                  {stockStats.inStockSkus}{' '}
                  <span className="text-xs font-normal text-emerald-600">/ {stockStats.totalSkus}</span>
                </span>
              </div>

              <div className="bg-amber-50/60 p-3.5 rounded-xl border border-amber-100">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-700 block mb-1">
                  SKUs em Ruptura
                </span>
                <span className="text-xl font-bold text-amber-900 font-mono">
                  {stockStats.outOfStockSkus}{' '}
                  <span className="text-xs font-normal text-amber-600">zerados</span>
                </span>
              </div>
            </div>

            {/* Next Deliveries Scheduled Timeline (if toggled) */}
            {showNextDeliveriesTable && (
              <div className="p-4 bg-slate-900 text-white rounded-xl border border-slate-800 space-y-3 shadow-md animate-in fade-in-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-indigo-400" />
                    <h4 className="font-bold text-sm text-white">
                      Cronograma Oficial de Entradas de Lotes (Next Quantities)
                    </h4>
                  </div>
                  <span className="text-xs text-indigo-300 font-mono">
                    {stockStats.nextDeliveries.length} lote(s) confirmado(s)
                  </span>
                </div>

                {stockStats.nextDeliveries.length === 0 ? (
                  <p className="text-xs text-slate-400 py-2">
                    Nenhum lote com previsão futura de entrada registrado no momento.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-800 text-slate-400">
                          <th className="py-2.5 px-3 font-semibold">Previsão</th>
                          <th className="py-2.5 px-3 font-semibold">Produto / Ref</th>
                          <th className="py-2.5 px-3 font-semibold">SKU & Cor</th>
                          <th className="py-2.5 px-3 font-semibold text-right">Quantidade Prevista</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/80 font-mono">
                        {stockStats.nextDeliveries.map((del, idx) => {
                          const dateObj = new Date(del.expectedDate);
                          const dateStr = !isNaN(dateObj.getTime())
                            ? dateObj.toLocaleDateString('pt-BR')
                            : del.expectedDate || 'A confirmar';
                          return (
                            <tr key={idx} className="hover:bg-slate-800/50 transition">
                              <td className="py-2 px-3 font-bold text-amber-300">{dateStr}</td>
                              <td className="py-2 px-3 font-sans text-slate-200">
                                {del.productName}{' '}
                                <span className="text-indigo-400 font-mono">({del.productRef})</span>
                              </td>
                              <td className="py-2 px-3 text-slate-300">
                                {del.sku} •{' '}
                                <span className="text-indigo-200 font-sans">{del.colorName}</span>
                              </td>
                              <td className="py-2 px-3 text-right font-bold text-emerald-300">
                                +{del.quantity.toLocaleString('pt-BR')} un
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Filter & Search Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2 border-t border-slate-100">
              {/* Search */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  id="input-search-stock"
                  value={stockSearchTerm}
                  onChange={(e) => setStockSearchTerm(e.target.value)}
                  placeholder="Filtrar por produto, referência (ex: 94682), SKU ou cor..."
                  className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-hidden transition"
                />
                {stockSearchTerm && (
                  <button
                    type="button"
                    onClick={() => setStockSearchTerm('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs cursor-pointer"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Status Filter Buttons */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {[
                  { id: 'all', label: `Todos (${products.length})` },
                  { id: 'in_stock', label: 'Com Estoque' },
                  { id: 'next_quantities', label: 'Com Next Quantities' },
                  { id: 'out_of_stock', label: 'Sem Estoque' },
                ].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setStockStatusFilter(f.id as any)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                      stockStatusFilter === f.id
                        ? 'bg-indigo-600 text-white shadow-2xs'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Products Stock List */}
            {filteredStockProducts.length === 0 ? (
              <div className="p-12 text-center border-2 border-dashed border-slate-200 rounded-xl space-y-3">
                <Boxes className="w-10 h-10 text-slate-300 mx-auto" />
                <h4 className="font-bold text-slate-700 text-base">Nenhum produto encontrado</h4>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  {stockSearchTerm || stockStatusFilter !== 'all'
                    ? 'Nenhum produto corresponde aos filtros aplicados. Tente ajustar os termos de busca.'
                    : 'Ainda não existem produtos com registros de estoque importados da Stricker.'}
                </p>
                <div className="flex items-center justify-center gap-2 pt-2">
                  {(stockSearchTerm || stockStatusFilter !== 'all') && (
                    <button
                      type="button"
                      onClick={() => {
                        setStockSearchTerm('');
                        setStockStatusFilter('all');
                      }}
                      className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition cursor-pointer"
                    >
                      Limpar Filtros
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleRunSync('stocks')}
                    disabled={isSyncing}
                    className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                    Sincronizar Estoques da Stricker
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {filteredStockProducts.map((prod) => {
                  const totalStock = Number(prod.totalStockAvailable ?? 0);
                  const totalNext = Number(prod.totalNextQuantities ?? 0);
                  const optionals = Array.isArray(prod.optionals) ? prod.optionals : [];

                  return (
                    <div
                      key={prod.id || prod.reference}
                      className="border border-slate-200 rounded-xl p-4 bg-slate-50/40 hover:border-slate-300 transition"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3 pb-3 border-b border-slate-200">
                        <div className="flex items-center gap-3">
                          <img
                            src={
                              prod.mainImage ||
                              'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=800&auto=format&fit=crop&q=80'
                            }
                            alt={prod.name}
                            className="w-11 h-11 rounded-lg object-cover border border-slate-200 shrink-0 bg-white"
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src =
                                'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=800&auto=format&fit=crop&q=80';
                            }}
                          />
                          <div>
                            <div className="font-bold text-slate-900 text-sm leading-tight">{prod.name}</div>
                            <div className="text-xs text-slate-500 font-mono mt-0.5">
                              Ref: <strong className="text-slate-700">{prod.reference}</strong> • Marca:{' '}
                              {prod.brand || 'SPOT'} • {optionals.length} cores/SKUs
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-4 text-xs font-mono shrink-0">
                          <div className="text-right">
                            <span className="text-slate-500 block text-[10px] uppercase font-sans">
                              Estoque Imediato
                            </span>
                            <strong className={`text-sm ${totalStock > 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                              {totalStock.toLocaleString('pt-BR')} un
                            </strong>
                          </div>
                          {totalNext > 0 && (
                            <div className="text-right pl-3 border-l border-slate-200">
                              <span className="text-indigo-600 block text-[10px] uppercase font-sans">
                                Next Quantities
                              </span>
                              <strong className="text-sm text-indigo-700">
                                +{totalNext.toLocaleString('pt-BR')} un
                              </strong>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Optionals SKU Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {optionals.map((opt) => {
                          const optStock = Number(opt.stockAvailable ?? 0);
                          const rawNq = opt.nextQuantities || (opt as any).NextQuantities || [];
                          const nqList = Array.isArray(rawNq) ? rawNq : [];

                          return (
                            <div
                              key={opt.id || opt.sku}
                              className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs space-y-2 hover:border-indigo-200 transition"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span
                                    className="w-3.5 h-3.5 rounded-full border border-slate-300 shrink-0 shadow-2xs"
                                    style={{ backgroundColor: opt.colorHex || '#CBD5E1' }}
                                  />
                                  <span className="text-xs font-semibold text-slate-800 truncate" title={opt.colorName}>
                                    {opt.colorName || 'Cor Padrão'}
                                  </span>
                                </div>
                                <span className="text-[11px] font-mono text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">
                                  {opt.sku}
                                </span>
                              </div>

                              <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-xs">
                                <span className="text-slate-500">Estoque Imediato:</span>
                                <span
                                  className={`font-bold font-mono ${
                                    optStock === 0
                                      ? 'text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded'
                                      : 'text-slate-900'
                                  }`}
                                >
                                  {optStock === 0 ? '0 un (Ruptura)' : `${optStock.toLocaleString('pt-BR')} un`}
                                </span>
                              </div>

                              {nqList.length > 0 && (
                                <div className="pt-2 border-t border-slate-100 space-y-1">
                                  <span className="text-[10px] font-semibold text-indigo-700 uppercase tracking-wider block">
                                    Próximas Entradas (Next Quantities):
                                  </span>
                                  <div className="space-y-1">
                                    {nqList.map((nq: any, idx) => {
                                      const qty = Number(nq.quantity ?? nq.Quantity ?? 0);
                                      const rawDate = nq.expectedDate ?? nq.ExpectedDate ?? '';
                                      const parsedDate = rawDate ? new Date(rawDate) : null;
                                      const isValidDate = parsedDate && !isNaN(parsedDate.getTime());
                                      const displayDate = isValidDate
                                        ? parsedDate.toLocaleDateString('pt-BR')
                                        : rawDate || 'A confirmar';
                                      return (
                                        <div
                                          key={idx}
                                          className="flex items-center justify-between text-[11px] text-slate-600 bg-indigo-50/60 border border-indigo-100/50 px-2 py-1 rounded"
                                        >
                                          <span className="flex items-center gap-1 text-[10px]">
                                            <Calendar className="w-3 h-3 text-indigo-500 shrink-0" />
                                            <span>
                                              Previsão: <strong className="text-slate-800">{displayDate}</strong>
                                            </span>
                                          </span>
                                          <span className="font-bold text-indigo-900 font-mono text-xs">
                                            +{qty.toLocaleString('pt-BR')} un
                                          </span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUB-TAB 4: PERSONALIZAÇÕES & TABELAS TÉCNICAS */}
      {activeSubTab === 'customizations' && (
        <div className="space-y-6 animate-in fade-in-50">
          {/* Interactive Pricing Simulator */}
          <div className="bg-gradient-to-r from-indigo-900 to-slate-900 text-white p-6 rounded-2xl shadow-lg">
            <h3 className="text-lg font-bold flex items-center gap-2 mb-2 text-white">
              <Sliders className="w-5 h-5 text-indigo-400" />
              Simulador Oficial de Cálculo de Personalização Stricker
            </h3>
            <p className="text-sm text-indigo-200 max-w-2xl mb-6">
              Fórmula documentada: <code className="bg-indigo-950 px-2 py-0.5 rounded text-amber-300 font-mono text-xs">Preço do Produto + Preço da Personalização + Manuseio = Preço Base</code> multiplicada pela quantidade.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold text-indigo-200 mb-1">Produto Base</label>
                <select
                  value={simProductRef}
                  onChange={(e) => {
                    setSimProductRef(e.target.value);
                    setSimAreaIdx(0);
                  }}
                  className="w-full px-3 py-2 bg-indigo-950 border border-indigo-700 rounded-xl text-sm text-white focus:ring-2 focus:ring-indigo-400"
                >
                  {products.map((p) => (
                    <option key={p.reference} value={p.reference}>
                      {p.reference} - {p.name.substring(0, 30)}...
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-indigo-200 mb-1">Área / Técnica de Gravação</label>
                <select
                  value={simAreaIdx}
                  onChange={(e) => setSimAreaIdx(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-indigo-950 border border-indigo-700 rounded-xl text-sm text-white focus:ring-2 focus:ring-indigo-400"
                >
                  {simProd?.customizationOptions.map((area, idx) => (
                    <option key={idx} value={idx}>
                      {area.component} - {area.techniqueName} ({area.areaCm2}cm²)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-indigo-200 mb-1">Quantidade Desejada</label>
                <input
                  type="number"
                  min="1"
                  max="10000"
                  value={simQty}
                  onChange={(e) => setSimQty(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-indigo-950 border border-indigo-700 rounded-xl text-sm text-white focus:ring-2 focus:ring-indigo-400 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-indigo-200 mb-1">Número de Cores</label>
                <select
                  value={simColors}
                  onChange={(e) => setSimColors(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-indigo-950 border border-indigo-700 rounded-xl text-sm text-white focus:ring-2 focus:ring-indigo-400"
                >
                  <option value={1}>1 Cor (Padrão)</option>
                  <option value={2}>2 Cores</option>
                  <option value={3}>3 Cores</option>
                  <option value={4}>4 Cores / Full Color</option>
                </select>
              </div>
            </div>

            {/* Simulation Results Breakdown */}
            {simCalculation && (
              <div className="mt-6 pt-6 border-t border-indigo-800 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 text-center">
                <div className="bg-indigo-950/60 p-3 rounded-xl border border-indigo-800">
                  <span className="text-[11px] text-indigo-300 block">Produto Unitário</span>
                  <span className="text-base font-bold text-white font-mono">R$ {simCalculation.productUnitPrice.toFixed(2)}</span>
                </div>
                <div className="bg-indigo-950/60 p-3 rounded-xl border border-indigo-800">
                  <span className="text-[11px] text-indigo-300 block">Personalização Unit.</span>
                  <span className="text-base font-bold text-white font-mono">R$ {simCalculation.customizationUnitPrice.toFixed(2)}</span>
                </div>
                <div className="bg-indigo-950/60 p-3 rounded-xl border border-indigo-800">
                  <span className="text-[11px] text-indigo-300 block">Manuseio Unit.</span>
                  <span className="text-base font-bold text-white font-mono">R$ {simCalculation.handlingUnitPrice.toFixed(2)}</span>
                </div>
                <div className="bg-indigo-950/60 p-3 rounded-xl border border-indigo-800">
                  <span className="text-[11px] text-indigo-300 block">Setup / Matriz Fixo</span>
                  <span className="text-base font-bold text-amber-300 font-mono">R$ {simCalculation.setupTotalCost.toFixed(2)}</span>
                </div>
                <div className="bg-indigo-950/60 p-3 rounded-xl border border-indigo-800">
                  <span className="text-[11px] text-indigo-300 block">Unitário Final Total</span>
                  <span className="text-base font-bold text-emerald-300 font-mono">R$ {simCalculation.combinedUnitPrice.toFixed(2)}</span>
                </div>
                <div className="bg-emerald-950/80 p-3 rounded-xl border border-emerald-600">
                  <span className="text-[11px] text-emerald-200 block">Total Geral ({simQty} un)</span>
                  <span className="text-lg font-bold text-emerald-300 font-mono">R$ {simCalculation.finalTotal.toFixed(2)}</span>
                </div>
              </div>
            )}
          </div>

          {/* Customization Tables List */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Sliders className="w-5 h-5 text-indigo-600" />
              Tabelas Técnicas de Gravação Importadas
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {customTables.map((t) => (
                <div key={t.tableCode} className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-mono text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                        {t.tableCode}
                      </span>
                      <h4 className="font-bold text-slate-900 text-sm mt-1">{t.techniqueName}</h4>
                    </div>
                    <span className="text-xs text-slate-500 font-medium">{t.areaDesc}</span>
                  </div>

                  <div className="flex items-center gap-4 text-xs text-slate-600 pt-2 border-t border-slate-200">
                    <span>Setup Base: <strong>R$ {t.setupPrice.toFixed(2)}</strong></span>
                    <span>Manuseio: <strong>R$ {t.handlingPrice.toFixed(2)}</strong></span>
                    <span>Cores: <strong>{t.colorCount}</strong></span>
                  </div>

                  {/* Tiers list */}
                  <div className="pt-2 border-t border-slate-200">
                    <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">
                      Faixas de Preço por Quantidade:
                    </span>
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-1 text-center font-mono">
                      {t.tiers.map((tier, idx) => (
                        <div key={idx} className="bg-white p-1.5 rounded border border-slate-200">
                          <span className="text-[10px] text-slate-400 block">{tier.minQty}{tier.maxQty ? `-${tier.maxQty}` : '+'} un</span>
                          <span className="text-xs font-bold text-slate-800">R$ {tier.unitPrice.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 5: PEDIDOS & INTEGRAÇÃO STRICKER (OrderV1 / ServiceOrderV1) */}
      {activeSubTab === 'orders' && (
        <div className="space-y-6 animate-in fade-in-50">
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Send className="w-5 h-5 text-indigo-600" />
                  Gestão de Pedidos Stricker (OrderV1 & ServiceOrderV1)
                </h3>
                <p className="text-sm text-slate-500">
                  Emissão de pedidos diretos, reserva com <code>WaitArtwork=true</code>, envio de arte vetorizada e tracking.
                </p>
              </div>

              <button
                id="btn-open-new-order-modal"
                onClick={() => setIsNewOrderModalOpen(true)}
                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold flex items-center gap-2 transition shadow-xs cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Novo Pedido WebService
              </button>
            </div>

            {/* Orders Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    <th className="py-3 px-4">Internal Ref / Order Stamp</th>
                    <th className="py-3 px-4">Itens & SKUs</th>
                    <th className="py-3 px-4">Valor Total</th>
                    <th className="py-3 px-4">Fluxo de Arte / Maquete</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Rastreamento</th>
                    <th className="py-3 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {orders.map((ord) => (
                    <tr key={ord.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3.5 px-4">
                        <div className="font-mono font-bold text-slate-900 text-xs">{ord.internalReference}</div>
                        {ord.orderStamp && (
                          <div className="text-[11px] font-mono text-indigo-600 font-semibold">{ord.orderStamp}</div>
                        )}
                        <div className="text-[11px] text-slate-400">{new Date(ord.createdAt).toLocaleDateString('pt-BR')}</div>
                      </td>

                      <td className="py-3.5 px-4">
                        {ord.lines.map((l, idx) => (
                          <div key={idx} className="text-xs text-slate-800 font-medium">
                            {l.quantity}x {l.sku} ({l.lineType})
                          </div>
                        ))}
                      </td>

                      <td className="py-3.5 px-4 font-mono text-xs font-bold text-slate-900">
                        R$ {ord.orderTotal.toFixed(2)}
                      </td>

                      <td className="py-3.5 px-4">
                        {ord.waitArtwork ? (
                          <span className="inline-flex items-center gap-1 text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 font-medium">
                            <Clock className="w-3 h-3" /> Aguardando Arte
                          </span>
                        ) : ord.serviceLines?.[0]?.approved ? (
                          <span className="inline-flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-medium">
                            <CheckCircle2 className="w-3 h-3" /> Maquete Aprovada
                          </span>
                        ) : ord.serviceLines?.length ? (
                          <span className="inline-flex items-center gap-1 text-xs text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200 font-medium">
                            <Sparkles className="w-3 h-3" /> Validando Maquete
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">Sem Impressão</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${
                            ord.status === 'PROCESSED' || ord.status === 'SHIPPED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : ord.status === 'WAITING_ART_WORK'
                              ? 'bg-amber-100 text-amber-800'
                              : ord.status === 'PENDING_MOCKUP_APPROVAL'
                              ? 'bg-purple-100 text-purple-800'
                              : ord.status === 'CANCELED'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-slate-100 text-slate-800'
                          }`}
                        >
                          {ord.status}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        {ord.trackingCode ? (
                          <div className="text-xs font-mono font-semibold text-indigo-700">
                            {ord.trackingCode}
                            <span className="block text-[10px] text-slate-400 font-sans">{ord.courier}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">Pendente</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {ord.status === 'WAITING_ART_WORK' && (
                            <button
                              onClick={() => {
                                setSelectedOrder(ord);
                                setIsArtworkModalOpen(true);
                              }}
                              className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-medium flex items-center gap-1 transition"
                            >
                              <Upload className="w-3.5 h-3.5" /> Enviar Arte
                            </button>
                          )}

                          {ord.status === 'PENDING_MOCKUP_APPROVAL' && (
                            <button
                              onClick={() => handleApproveMockup(ord.id)}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-medium flex items-center gap-1 transition"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" /> Aprovar
                            </button>
                          )}

                          {ord.status !== 'CANCELED' && ord.status !== 'SHIPPED' && (
                            <button
                              onClick={() => {
                                setSelectedOrder(ord);
                                setIsCancelModalOpen(true);
                              }}
                              title="Cancelar Pedido (CancelOrderV1)"
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                            >
                              <XCircle className="w-4 h-4" />
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

      {/* SUB-TAB 6: CONFIGURAÇÕES DA API & CREDENCIAIS */}
      {activeSubTab === 'settings' && (
        <div className="space-y-6 animate-in fade-in-50">
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-6">
            <div>
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Shield className="w-5 h-5 text-indigo-600" />
                Configurações da Chave e Parâmetros da Stricker Brasil / SPOT
              </h3>
              <p className="text-sm text-slate-500">
                Gerencie sua chave de acesso (Access Key), URLs da API e regras de precificação automática.
              </p>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                StrickerService.auth.saveConfig(config);
                showNotify('success', 'Configurações da Stricker salvas com sucesso!');
              }}
              className="space-y-5"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Integration Toggle */}
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-sm text-slate-900 block">Ativar Integração WebService</span>
                    <span className="text-xs text-slate-500">Habilita consultas e sincronização contínua com a Stricker.</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={config.isEnabled}
                    onChange={(e) => setConfig({ ...config, isEnabled: e.target.checked })}
                    className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500"
                  />
                </div>

                {/* Auto Sync Toggle & Interval */}
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-0.5">
                    <span className="font-semibold text-sm text-slate-900 block flex items-center gap-2">
                      <Clock className="w-4 h-4 text-indigo-600" />
                      Sincronização Periódica Automática
                    </span>
                    <span className="text-xs text-slate-500">Executada em segundo plano pelo servidor para atualizar produtos e estoques.</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <select
                      value={config.syncIntervalHours || 4}
                      onChange={(e) => setConfig({ ...config, syncIntervalHours: Number(e.target.value) })}
                      disabled={!config.autoSyncEnabled}
                      className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-700 disabled:opacity-50"
                    >
                      <option value={1}>A cada 1 hora</option>
                      <option value={2}>A cada 2 horas</option>
                      <option value={4}>A cada 4 horas (Recomendado)</option>
                      <option value={8}>A cada 8 horas</option>
                      <option value={12}>A cada 12 horas</option>
                      <option value={24}>A cada 24 horas</option>
                    </select>
                    <input
                      type="checkbox"
                      checked={config.autoSyncEnabled}
                      onChange={(e) => setConfig({ ...config, autoSyncEnabled: e.target.checked })}
                      className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500"
                    />
                  </div>
                </div>
              </div>

              {/* Environment Variable Notice */}
              {config.isEnvKeyConfigured && (
                <div className="p-3.5 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-800 flex items-start gap-3">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <span className="font-semibold">Chave de acesso detectada no arquivo .env (STRICKER_ACCESS_KEY)</span>
                    <p className="text-emerald-700 leading-relaxed">
                      O servidor está pronto para se comunicar diretamente com o WebService da Stricker usando a credencial do ambiente: <strong className="font-mono">{config.maskedAccessKey || 'STRK-****-9821'}</strong>. Não é necessário digitar a chave manualmente.
                    </p>
                  </div>
                </div>
              )}

              {/* Access Key & Environment */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Access Key (Stricker / SPOT)
                    {config.isEnvKeyConfigured && (
                      <span className="ml-2 text-[11px] font-normal text-emerald-600 font-sans">(Chave ativa via .env)</span>
                    )}
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={config.accessKey}
                      onChange={(e) => setConfig({ ...config, accessKey: e.target.value })}
                      placeholder={config.isEnvKeyConfigured ? `Chave ativa: ${config.maskedAccessKey || 'STRK-****-9821'}` : "Ex: SPOT_WS_BR_KEY_..."}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500"
                    />
                    <Lock className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 transform -translate-y-1/2" />
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">Armazenada de forma segura no servidor backend e nunca exposta em chamadas públicas no navegador.</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Ambiente de Operação</label>
                  <select
                    value={config.environment}
                    onChange={(e) => setConfig({ ...config, environment: e.target.value as any })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium text-slate-800"
                  >
                    <option value="sandbox">🧪 Sandbox / Homologação</option>
                    <option value="production">🚀 Produção Real</option>
                  </select>
                </div>
              </div>

              {/* URLs and Language */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">URL Base REST HTTPS</label>
                  <input
                    type="text"
                    value={config.apiUrl}
                    onChange={(e) => setConfig({ ...config, apiUrl: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">URL WSDL SOAP (Opcional)</label>
                  <input
                    type="text"
                    value={config.soapWsdlUrl}
                    onChange={(e) => setConfig({ ...config, soapWsdlUrl: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Idioma das Descrições</label>
                  <select
                    value={config.language}
                    onChange={(e) => setConfig({ ...config, language: e.target.value as any })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm"
                  >
                    <option value="PT">Português (PT)</option>
                    <option value="EN">Inglês (EN)</option>
                    <option value="ES">Espanhol (ES)</option>
                  </select>
                </div>
              </div>

              {/* Default Margins & Commercial Policies */}
              <div className="pt-4 border-t border-slate-200">
                <h4 className="text-sm font-bold text-slate-900 mb-3">Políticas Comerciais Padrão</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Margem de Venda Padrão (%)</label>
                    <input
                      type="number"
                      value={config.defaultProfitMarginPct}
                      onChange={(e) => setConfig({ ...config, defaultProfitMarginPct: Number(e.target.value) })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Custo Adicional de Manuseio (R$)</label>
                    <input
                      type="number"
                      step="0.10"
                      value={config.additionalHandlingCost}
                      onChange={(e) => setConfig({ ...config, additionalHandlingCost: Number(e.target.value) })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Status Inicial de Novos Produtos</label>
                    <select
                      value={config.defaultProductStatus}
                      onChange={(e) => setConfig({ ...config, defaultProductStatus: e.target.value as any })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm"
                    >
                      <option value="importado">Importado (Requer Aprovação)</option>
                      <option value="em_analise">Em Análise</option>
                      <option value="ativo">Ativo Imediato</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition shadow-sm cursor-pointer"
                >
                  Salvar Configurações
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SUB-TAB 7: HISTÓRICO & LOGS DE AUDITORIA */}
      {activeSubTab === 'logs' && (
        <div className="space-y-6 animate-in fade-in-50">
          {/* Sync Logs */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
            <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-600" />
              Histórico de Sincronizações
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    <th className="py-2.5 px-3">Data / Hora</th>
                    <th className="py-2.5 px-3">Tipo de Sync</th>
                    <th className="py-2.5 px-3">Duração</th>
                    <th className="py-2.5 px-3">Processados</th>
                    <th className="py-2.5 px-3">Atualizados</th>
                    <th className="py-2.5 px-3">Erros</th>
                    <th className="py-2.5 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono text-xs">
                  {syncLogs.map((l) => (
                    <tr key={l.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3">{new Date(l.startedAt).toLocaleString('pt-BR')}</td>
                      <td className="py-2.5 px-3 font-sans font-semibold text-indigo-700 uppercase">{l.syncType}</td>
                      <td className="py-2.5 px-3">{(l.durationMs / 1000).toFixed(1)}s</td>
                      <td className="py-2.5 px-3">{l.processedCount}</td>
                      <td className="py-2.5 px-3 text-emerald-600">{l.updatedCount}</td>
                      <td className="py-2.5 px-3 text-rose-600">{l.errorCount}</td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-sans font-semibold uppercase ${
                            l.status === 'success' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {l.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* API Request Logs */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
            <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Server className="w-5 h-5 text-indigo-600" />
              Auditoria de Requisições HTTPS (Payloads Sanitizados)
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs font-mono">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
                    <th className="py-2.5 px-3">Data / Hora</th>
                    <th className="py-2.5 px-3">Operação</th>
                    <th className="py-2.5 px-3">Endpoint</th>
                    <th className="py-2.5 px-3">Método</th>
                    <th className="py-2.5 px-3">HTTP Status</th>
                    <th className="py-2.5 px-3">Latência</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {requestLogs.map((req) => (
                    <tr key={req.id} className="hover:bg-slate-50">
                      <td className="py-2 px-3">{new Date(req.timestamp).toLocaleTimeString('pt-BR')}</td>
                      <td className="py-2 px-3 font-semibold text-slate-900 font-sans">{req.operation}</td>
                      <td className="py-2 px-3 text-indigo-600">{req.endpoint}</td>
                      <td className="py-2 px-3">{req.method}</td>
                      <td className="py-2 px-3">
                        <span className="text-emerald-700 font-bold">{req.statusCode} OK</span>
                      </td>
                      <td className="py-2 px-3 text-slate-500">{req.durationMs}ms</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB: VALIDAÇÃO & SUÍTE DE TESTES DA DOCUMENTAÇÃO OFICIAL */}
      {activeSubTab === 'testsuite' && (
        <StrickerTestSuiteSection config={config} />
      )}

      {/* MODAL 1: DETALHES DO PRODUTO STRICKER */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl space-y-6 animate-in zoom-in-95">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
              <div>
                <span className="text-xs font-mono text-indigo-600 font-semibold">Ref: {selectedProduct.reference}</span>
                <h3 className="text-xl font-bold text-slate-900">{selectedProduct.name}</h3>
                <span className="text-xs text-slate-500">Marca: {selectedProduct.brand} • Linha {selectedProduct.catalog}</span>
              </div>
              <button
                onClick={() => setSelectedProduct(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <img
                src={selectedProduct.mainImage}
                alt={selectedProduct.name}
                className="w-full h-48 object-cover rounded-xl border border-slate-200 col-span-1"
                referrerPolicy="no-referrer"
              />
              <div className="col-span-2 space-y-2 text-sm text-slate-600">
                <p className="text-xs leading-relaxed">{selectedProduct.description}</p>
                <div className="grid grid-cols-2 gap-2 text-xs pt-2 font-mono">
                  <div><strong>Dimensões:</strong> {selectedProduct.dimensions || 'N/A'}</div>
                  <div><strong>Materiais:</strong> {selectedProduct.materials || 'N/A'}</div>
                  <div><strong>Capacidade:</strong> {selectedProduct.capacity || 'N/A'}</div>
                  <div><strong>Embalagem:</strong> {selectedProduct.packaging || 'N/A'}</div>
                </div>
              </div>
            </div>

            {/* Optionals SKU List */}
            <div>
              <h4 className="text-sm font-bold text-slate-900 mb-2">Variações & SKUs ({selectedProduct.optionals.length})</h4>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {selectedProduct.optionals.map((opt) => (
                  <div key={opt.id} className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-3.5 h-3.5 rounded-full border border-slate-300" style={{ backgroundColor: opt.colorHex || '#111' }} />
                      <span className="font-semibold text-slate-800">{opt.colorName}</span>
                      <span className="font-mono text-slate-400">({opt.sku})</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span>Estoque: <strong>{opt.stockAvailable} un</strong></span>
                      <span className="font-mono font-bold text-emerald-700">R$ {opt.priceSale.toFixed(2)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Customization Areas */}
            <div>
              <h4 className="text-sm font-bold text-slate-900 mb-2">Áreas de Personalização Homologadas</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {selectedProduct.customizationOptions.map((area, idx) => (
                  <div key={idx} className="p-2.5 bg-indigo-50/50 rounded-lg border border-indigo-100 text-xs space-y-1">
                    <div className="font-bold text-indigo-900">{area.component} - {area.location}</div>
                    <div className="text-indigo-700">Técnica: {area.techniqueName} ({area.areaCm2} cm²)</div>
                    <div className="text-slate-500 font-mono">Tabela: {area.tableCode} • Setup: R$ {area.setupCost.toFixed(2)}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
              <button
                onClick={() => setSelectedProduct(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-medium"
              >
                Fechar
              </button>
              <button
                onClick={() => {
                  handlePublishToStore(selectedProduct);
                  setSelectedProduct(null);
                }}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold"
              >
                Publicar no Catálogo Geral MB
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: NOVO PEDIDO STRICKER */}
      {isNewOrderModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl space-y-5 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Send className="w-5 h-5 text-indigo-600" />
                Emitir Pedido no WebService Stricker (OrderV1)
              </h3>
              <button onClick={() => setIsNewOrderModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateOrder} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Internal Reference (Chave de Idempotência)</label>
                  <input
                    type="text"
                    required
                    value={newOrderForm.internalReference}
                    onChange={(e) => setNewOrderForm({ ...newOrderForm, internalReference: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Produto Stricker</label>
                  <select
                    value={newOrderForm.productReference}
                    onChange={(e) => {
                      const ref = e.target.value;
                      const prod = products.find((p) => p.reference === ref);
                      setNewOrderForm({
                        ...newOrderForm,
                        productReference: ref,
                        sku: prod?.optionals[0]?.sku || '',
                      });
                    }}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm"
                  >
                    {products.map((p) => (
                      <option key={p.reference} value={p.reference}>
                        {p.reference} - {p.name.substring(0, 30)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">SKU / Cor</label>
                  <select
                    value={newOrderForm.sku}
                    onChange={(e) => setNewOrderForm({ ...newOrderForm, sku: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono"
                  >
                    {products
                      .find((p) => p.reference === newOrderForm.productReference)
                      ?.optionals.map((opt) => (
                        <option key={opt.sku} value={opt.sku}>
                          {opt.sku} ({opt.colorName})
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Quantidade</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={newOrderForm.quantity}
                    onChange={(e) => setNewOrderForm({ ...newOrderForm, quantity: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Tipo de Linha</label>
                  <select
                    value={newOrderForm.lineType}
                    onChange={(e) => setNewOrderForm({ ...newOrderForm, lineType: e.target.value as any })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm"
                  >
                    <option value="print">Com Gravação (Print)</option>
                    <option value="standard">Sem Gravação (Standard)</option>
                    <option value="sample">Amostra (Sample)</option>
                  </select>
                </div>
              </div>

              {/* WaitArtwork checkbox */}
              {newOrderForm.lineType === 'print' && (
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-amber-900 block">Reservar Estoque Imediato (WaitArtwork = True)</span>
                    <span className="text-[11px] text-amber-700">Garante a reserva dos produtos enquanto o cliente aprova o arquivo de arte final.</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={newOrderForm.waitArtwork}
                    onChange={(e) => setNewOrderForm({ ...newOrderForm, waitArtwork: e.target.checked })}
                    className="w-4 h-4 text-amber-600 rounded"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Observações do Pedido</label>
                <textarea
                  rows={2}
                  value={newOrderForm.notes}
                  onChange={(e) => setNewOrderForm({ ...newOrderForm, notes: e.target.value })}
                  placeholder="Ex: Pedido corporativo Santander - Entrega prioritária"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsNewOrderModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold shadow-xs"
                >
                  Enviar ao WebService Stricker
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: UPLOAD DE ARTE (ServiceOrderV1) */}
      {isArtworkModalOpen && selectedOrder && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Upload className="w-5 h-5 text-amber-600" />
                Enviar Arquivo de Arte (ServiceOrderV1)
              </h3>
              <button onClick={() => setIsArtworkModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Pedido: <strong>{selectedOrder.orderStamp || selectedOrder.internalReference}</strong>.
              O envio da arte atualizará o status para <code>PENDING_MOCKUP_APPROVAL</code>.
            </p>

            <form onSubmit={handleAttachArtwork} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Nome do Arquivo de Arte (PDF / AI / CDR)</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: logo_santander_vetor.pdf"
                  value={artworkForm.artworkFilename}
                  onChange={(e) => setArtworkForm({ ...artworkForm, artworkFilename: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Tamanho da Logo</label>
                  <input
                    type="text"
                    value={artworkForm.logoSize}
                    onChange={(e) => setArtworkForm({ ...artworkForm, logoSize: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Qtd de Cores</label>
                  <input
                    type="number"
                    min="1"
                    max="4"
                    value={artworkForm.colors}
                    onChange={(e) => setArtworkForm({ ...artworkForm, colors: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsArtworkModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-medium"
                >
                  Voltar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-sm font-semibold"
                >
                  Enviar Arte Final
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: CANCELAR PEDIDO (CancelOrderV1) */}
      {isCancelModalOpen && selectedOrder && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95">
            <h3 className="text-base font-bold text-rose-600 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Confirmar Cancelamento (CancelOrderV1)
            </h3>
            <p className="text-xs text-slate-600">
              Deseja cancelar o pedido <strong>{selectedOrder.orderStamp || selectedOrder.internalReference}</strong> junto ao WebService da Stricker?
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Motivo do Cancelamento</label>
              <textarea
                required
                rows={3}
                placeholder="Informe a justificativa..."
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm"
              />
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setIsCancelModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-medium"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={handleCancelOrder}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-sm font-semibold"
              >
                Confirmar Cancelamento
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
