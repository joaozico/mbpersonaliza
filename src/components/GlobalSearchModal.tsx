import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Product, Category, Subcategory, UserProfile, Order, Quote, DiscountCoupon } from '../types';
import { StorageService } from '../services/storage';
import {
  Search,
  X,
  ChevronRight,
  Package,
  FolderTree,
  FileSpreadsheet,
  FileText,
  Sparkles,
  Clock,
  Compass,
  ShoppingCart,
  MessageSquare,
  Store,
  DollarSign,
  Calculator,
  Sliders,
  Database,
  BarChart3,
  Tag,
  User,
  CornerDownLeft,
  Command,
  ArrowUp,
  ArrowDown,
  Layers,
  CheckCircle2,
  Trash2,
  Zap,
} from 'lucide-react';

export interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  categories: Category[];
  subcategories?: Subcategory[];
  currentUser: UserProfile;
  onNavigate: (view: string, param?: string) => void;
  onOpenCart?: () => void;
  onOpenQuoteModal?: (initialItem?: any) => void;
  initialQuery?: string;
}

type SearchCategoryFilter = 'all' | 'products' | 'categories' | 'navigation' | 'admin';

interface SearchResultItem {
  id: string;
  type: 'product' | 'category' | 'navigation' | 'action' | 'order' | 'quote' | 'user' | 'coupon';
  title: string;
  subtitle?: string;
  badge?: string;
  badgeColor?: string;
  imageUrl?: string;
  icon?: any;
  action: () => void;
  score?: number;
}

const RECENT_SEARCHES_KEY = 'mb_recent_global_searches';
const MAX_RECENT_SEARCHES = 6;

// Helper to highlight matching text
function HighlightMatch({ text, query }: { text: string; query: string }) {
  if (!query || !query.trim()) return <span>{text}</span>;

  const parts = text.split(new RegExp(`(${query.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')})`, 'gi'));
  return (
    <span>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <mark key={i} className="bg-amber-100 text-amber-950 font-bold px-0.5 rounded">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </span>
  );
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({
  isOpen,
  onClose,
  products = [],
  categories = [],
  subcategories = [],
  currentUser,
  onNavigate,
  onOpenCart,
  onOpenQuoteModal,
  initialQuery = '',
}) => {
  const [query, setQuery] = useState(initialQuery);
  const [activeFilter, setActiveFilter] = useState<SearchCategoryFilter>('all');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const inputRef = useRef<HTMLInputElement>(null);
  const resultsContainerRef = useRef<HTMLDivElement>(null);

  // Check admin role & permissions
  const isStaffUser = Boolean(
    currentUser &&
    currentUser.role &&
    currentUser.role !== 'cliente' &&
    currentUser.role !== 'visitante'
  );
  const canViewPrices = StorageService.canViewPrices(currentUser);
  const canAccessCatalogPdf = StorageService.hasUserPermission(currentUser, 'canAccessCatalogPdf');

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      if (initialQuery) setQuery(initialQuery);
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 50);
      setSelectedIndex(0);
    }
  }, [isOpen, initialQuery]);

  // Lock body scroll while modal is active
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  // Save query to recents
  const saveRecentSearch = (term: string) => {
    const cleaned = term.trim();
    if (!cleaned || cleaned.length < 2) return;
    try {
      const updated = [cleaned, ...recentSearches.filter((s) => s.toLowerCase() !== cleaned.toLowerCase())].slice(
        0,
        MAX_RECENT_SEARCHES
      );
      setRecentSearches(updated);
      localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
    } catch {
      // ignore
    }
  };

  const removeRecentSearch = (e: React.MouseEvent, term: string) => {
    e.stopPropagation();
    const updated = recentSearches.filter((s) => s !== term);
    setRecentSearches(updated);
    try {
      localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
    } catch {}
  };

  const clearAllRecents = () => {
    setRecentSearches([]);
    try {
      localStorage.removeItem(RECENT_SEARCHES_KEY);
    } catch {}
  };

  // Perform Global Search across all models
  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];

    const items: SearchResultItem[] = [];

    // 1. PRODUCTS SEARCH
    if (activeFilter === 'all' || activeFilter === 'products') {
      products.forEach((p) => {
        if (!p.is_active && !isStaffUser) return;

        const nameMatch = (p.name || '').toLowerCase().includes(q);
        const codeMatch = (p.code || '').toLowerCase().includes(q);
        const slugMatch = (p.slug || '').toLowerCase().includes(q);
        const barcodeMatch = (p.barcode || '').toLowerCase().includes(q);
        const descMatch = (p.description || '').toLowerCase().includes(q) || (p.short_description || '').toLowerCase().includes(q);
        const techniquesMatch = (p.details?.customTechniques || []).some((t) => t.toLowerCase().includes(q));
        const materialsMatch = (p.details?.materials || '').toLowerCase().includes(q);

        if (nameMatch || codeMatch || slugMatch || barcodeMatch || descMatch || techniquesMatch || materialsMatch) {
          let score = 10;
          if (codeMatch) score += 40;
          if (nameMatch) score += 30;
          if (p.is_featured) score += 5;

          const priceText = !canViewPrices
            ? 'Entre para consultar'
            : p.show_price
            ? `R$ ${(p.promo_price || p.base_price || 0).toFixed(2).replace('.', ',')}`
            : 'Sob Consulta';

          const minQtyText = p.min_order_qty ? `Mín: ${p.min_order_qty} un` : '';
          const techniquesText = (p.details?.customTechniques || []).slice(0, 2).join(' • ');

          items.push({
            id: `prod-${p.id}`,
            type: 'product',
            title: p.name,
            subtitle: `${p.code} • ${priceText} ${minQtyText ? `• ${minQtyText}` : ''} ${techniquesText ? `• [${techniquesText}]` : ''}`,
            imageUrl: p.images?.[0] || '',
            badge: p.badge || (p.stock_qty <= 0 ? 'Sem Estoque' : undefined),
            badgeColor: p.stock_qty <= 0 ? 'bg-slate-200 text-slate-700' : 'bg-slate-900 text-white',
            action: () => {
              saveRecentSearch(query);
              onClose();
              onNavigate('product-detail', p.id);
            },
            score,
          });
        }
      });
    }

    // 2. CATEGORIES & SUBCATEGORIES SEARCH
    if (activeFilter === 'all' || activeFilter === 'categories') {
      categories.forEach((c) => {
        if ((c.name || '').toLowerCase().includes(q) || (c.slug || '').toLowerCase().includes(q) || (c.description || '').toLowerCase().includes(q)) {
          const productCount = products.filter((p) => p.categoryId === c.id && p.is_active).length;
          items.push({
            id: `cat-${c.id}`,
            type: 'category',
            title: c.name,
            subtitle: `Categoria de Produtos • ${productCount} ${productCount === 1 ? 'item ativo' : 'itens ativos'}`,
            icon: FolderTree,
            badge: 'Categoria',
            badgeColor: 'bg-sky-100 text-sky-800',
            action: () => {
              saveRecentSearch(query);
              onClose();
              onNavigate('catalog', c.id);
            },
            score: 25,
          });
        }
      });

      subcategories.forEach((sub) => {
        if ((sub.name || '').toLowerCase().includes(q) || (sub.slug || '').toLowerCase().includes(q)) {
          const parentCat = categories.find((c) => c.id === sub.categoryId);
          items.push({
            id: `sub-${sub.id}`,
            type: 'category',
            title: sub.name,
            subtitle: `Subcategoria em ${parentCat?.name || 'Catálogo Geral'}`,
            icon: FolderTree,
            badge: 'Subcategoria',
            badgeColor: 'bg-slate-100 text-slate-700',
            action: () => {
              saveRecentSearch(query);
              onClose();
              onNavigate('catalog', sub.categoryId);
            },
            score: 20,
          });
        }
      });
    }

    // 3. PAGES & STORE ACTIONS
    if (activeFilter === 'all' || activeFilter === 'navigation') {
      const staticNavItems = [
        {
          id: 'nav-home',
          title: 'Início / Loja Virtual MB Personaliza',
          subtitle: 'Página inicial, lançamentos e campanhas',
          keywords: ['inicio', 'home', 'loja', 'principal', 'vitrine', 'destaques'],
          icon: Compass,
          view: 'home',
        },
        {
          id: 'nav-catalog',
          title: 'Catálogo Geral de Brindes',
          subtitle: 'Explorar todos os brindes corporativos e produtos personalizáveis',
          keywords: ['catalogo', 'produtos', 'todos', 'lista', 'itens', 'brindes', 'loja'],
          icon: Package,
          view: 'catalog',
        },
        {
          id: 'nav-quote',
          title: 'Solicitar Orçamento Formal (PDF)',
          subtitle: 'Gerar cotação corporativa personalizada para aprovação em empresa',
          keywords: ['orcamento', 'cotacao', 'pdf', 'proposta', 'faturamento', 'solicitar'],
          icon: FileSpreadsheet,
          view: 'quote',
        },
        ...(canAccessCatalogPdf
          ? [
              {
                id: 'nav-digital-catalog',
                title: 'Catálogo Digital Interativo',
                subtitle: 'Visualizar revista digital e baixar catálogo completo em PDF',
                keywords: ['catalogo digital', 'revista', 'pdf download', 'apresentacao', 'portfolio'],
                icon: FileText,
                view: 'digital-catalog',
              },
            ]
          : []),
        {
          id: 'nav-customer-portal',
          title: 'Minha Conta & Acompanhamento de Pedidos',
          subtitle: 'Consultar histórico de pedidos, boletos emitidos e status de produção',
          keywords: ['minha conta', 'meus pedidos', 'rastreio', 'login', 'cliente', 'acompanhar'],
          icon: User,
          view: 'customer-portal',
        },
      ];

      staticNavItems.forEach((item) => {
        const matchTitle = item.title.toLowerCase().includes(q);
        const matchKeywords = item.keywords.some((k) => k.includes(q) || q.includes(k));
        if (matchTitle || matchKeywords) {
          items.push({
            id: item.id,
            type: 'navigation',
            title: item.title,
            subtitle: item.subtitle,
            icon: item.icon,
            badge: 'Navegação',
            badgeColor: 'bg-slate-100 text-slate-800',
            action: () => {
              saveRecentSearch(query);
              onClose();
              onNavigate(item.view);
            },
            score: 15,
          });
        }
      });

      // Quick Actions
      if ('carrinho'.includes(q) || 'comprar'.includes(q) || 'sacola'.includes(q) || 'checkout'.includes(q)) {
        items.push({
          id: 'act-cart',
          type: 'action',
          title: 'Abrir Carrinho de Compras',
          subtitle: 'Ver itens adicionados e prosseguir para finalização',
          icon: ShoppingCart,
          badge: 'Ação Rápida',
          badgeColor: 'bg-pink-100 text-pink-800',
          action: () => {
            onClose();
            if (onOpenCart) onOpenCart();
          },
          score: 18,
        });
      }

      if ('whatsapp'.includes(q) || 'falar'.includes(q) || 'atendente'.includes(q) || 'contato'.includes(q) || 'telefone'.includes(q)) {
        items.push({
          id: 'act-whatsapp',
          type: 'action',
          title: 'Falar com Consultor no WhatsApp',
          subtitle: 'Atendimento corporativo direto com nossa equipe de especialistas',
          icon: MessageSquare,
          badge: 'Contato',
          badgeColor: 'bg-emerald-100 text-emerald-800',
          action: () => {
            onClose();
            const companySettings = StorageService.getCompanySettings();
            const cleanWhatsapp = (companySettings.whatsapp || '11987654321').replace(/\D/g, '');
            window.open(
              `https://wa.me/55${cleanWhatsapp}?text=${encodeURIComponent(
                'Olá! Estava buscando no site da MB Personaliza e gostaria de um atendimento personalizado.'
              )}`,
              '_blank',
              'noopener,noreferrer'
            );
          },
          score: 18,
        });
      }
    }

    // 4. ADMIN & MANAGEMENT SCOPE (If staff member)
    if (isStaffUser && (activeFilter === 'all' || activeFilter === 'admin')) {
      const hasAdminPanelPerm =
        StorageService.hasUserPermission(currentUser, 'canViewDashboard') ||
        StorageService.hasUserPermission(currentUser, 'canManageProducts') ||
        StorageService.hasUserPermission(currentUser, 'canManageQuotes') ||
        StorageService.hasUserPermission(currentUser, 'canManageOrders') ||
        StorageService.hasUserPermission(currentUser, 'canManageStock') ||
        StorageService.hasUserPermission(currentUser, 'canManageUsers') ||
        StorageService.hasUserPermission(currentUser, 'canManageCompanySettings') ||
        StorageService.hasUserPermission(currentUser, 'canManageDeliverySettings') ||
        StorageService.hasUserPermission(currentUser, 'canCustomizeLayout') ||
        StorageService.hasUserPermission(currentUser, 'canViewFinancialTransactions') ||
        StorageService.hasUserPermission(currentUser, 'canManagePaymentGateways') ||
        StorageService.hasUserPermission(currentUser, 'canOpenCloseCashRegister') ||
        StorageService.hasUserPermission(currentUser, 'canConfigureBoletoRules') ||
        StorageService.hasUserPermission(currentUser, 'canViewCoupons') ||
        StorageService.hasUserPermission(currentUser, 'canManageMaintenanceMode');

      // Management tabs
      const adminModules = [
        ...(hasAdminPanelPerm
          ? [{ id: 'adm-panel', title: 'Painel Administrativo Completo', view: 'admin', keywords: ['admin', 'painel', 'gestao', 'configuracoes'] }]
          : []),
        ...(StorageService.hasUserPermission(currentUser, 'canAccessPDV')
          ? [{ id: 'adm-pdv', title: 'PDV - Frente de Caixa (Loja Física)', view: 'pdv', keywords: ['pdv', 'caixa', 'frente de caixa', 'balcao', 'venda rapida'] }]
          : []),
        ...(StorageService.hasUserPermission(currentUser, 'canViewFinancialModule')
          ? [{ id: 'adm-fin', title: 'Módulo Financeiro & Fluxo de Caixa', view: 'financial', keywords: ['financeiro', 'dre', 'contas a pagar', 'receber', 'banco'] }]
          : []),
        ...(StorageService.hasUserPermission(currentUser, 'canViewCostPricingModule')
          ? [{ id: 'adm-cost', title: 'Orçamento de Custos & Precificação de Produtos', view: 'cost_pricing', keywords: ['custos', 'precificacao', 'margem', 'markup', 'lucro'] }]
          : []),
        ...(StorageService.hasUserPermission(currentUser, 'canViewSiteMetrics')
          ? [{ id: 'adm-metrics', title: 'Métricas de Acessos & Visualizações do Site', view: 'metrics', keywords: ['metricas', 'analytics', 'visitas', 'graficos', 'estatisticas'] }]
          : []),
      ];

      adminModules.forEach((m) => {
        if (m.title.toLowerCase().includes(q) || m.keywords.some((k) => k.includes(q))) {
          items.push({
            id: m.id,
            type: 'navigation',
            title: m.title,
            subtitle: 'Módulo do Sistema Administrativo',
            icon: m.view === 'pdv' ? Store : m.view === 'financial' ? DollarSign : m.view === 'cost_pricing' ? Calculator : BarChart3,
            badge: 'Admin',
            badgeColor: 'bg-amber-100 text-amber-900',
            action: () => {
              saveRecentSearch(query);
              onClose();
              onNavigate(m.view);
            },
            score: 22,
          });
        }
      });

      // Search Orders (only if permitted)
      if (StorageService.hasUserPermission(currentUser, 'canManageOrders')) {
        try {
          const orders = StorageService.getOrders();
          orders.forEach((ord) => {
            if (
              (ord.code || '').toLowerCase().includes(q) ||
              (ord.clientName || '').toLowerCase().includes(q) ||
              (ord.clientEmail || '').toLowerCase().includes(q) ||
              (ord.clientCompany || '').toLowerCase().includes(q)
            ) {
              items.push({
                id: `ord-${ord.id}`,
                type: 'order',
                title: `Pedido ${ord.code} - ${ord.clientName}`,
                subtitle: `Total: R$ ${ord.total.toFixed(2)} • ${ord.paymentStatus} • ${ord.items.length} itens`,
                icon: FileText,
                badge: `Pedido (${ord.orderStatus || ord.paymentStatus})`,
                badgeColor: 'bg-blue-100 text-blue-900',
                action: () => {
                  saveRecentSearch(query);
                  onClose();
                  onNavigate('admin');
                },
                score: 28,
              });
            }
          });
        } catch {}
      }

      // Search Quotes (only if permitted)
      if (StorageService.hasUserPermission(currentUser, 'canManageQuotes')) {
        try {
          const quotes = StorageService.getQuotes();
          quotes.forEach((qt) => {
            if (
              (qt.code || '').toLowerCase().includes(q) ||
              (qt.clientName || '').toLowerCase().includes(q) ||
              (qt.clientEmail || '').toLowerCase().includes(q) ||
              (qt.clientCompany || '').toLowerCase().includes(q)
            ) {
              items.push({
                id: `qt-${qt.id}`,
                type: 'quote',
                title: `Orçamento ${qt.code} - ${qt.clientName}`,
                subtitle: `Total Est.: R$ ${(qt.totalEstimated || 0).toFixed(2)} • ${qt.status} • ${qt.clientCompany || qt.clientEmail}`,
                icon: FileSpreadsheet,
                badge: `Orçamento (${qt.status})`,
                badgeColor: 'bg-purple-100 text-purple-900',
                action: () => {
                  saveRecentSearch(query);
                  onClose();
                  onNavigate('admin');
                },
                score: 27,
              });
            }
          });
        } catch {}
      }

      // Search Coupons (only if permitted)
      if (StorageService.hasUserPermission(currentUser, 'canViewCoupons')) {
        try {
          const coupons = StorageService.getCoupons();
          coupons.forEach((cpn) => {
            if (
              (cpn.code || '').toLowerCase().includes(q) ||
              (cpn.campaignName || '').toLowerCase().includes(q)
            ) {
              items.push({
                id: `cpn-${cpn.id}`,
                type: 'coupon',
                title: `Cupom ${cpn.code}: ${cpn.campaignName}`,
                subtitle: `Desconto: ${cpn.discountType === 'percentage' ? `${cpn.discountValue}%` : `R$ ${cpn.discountValue.toFixed(2)}`} • Status: ${cpn.status}`,
                icon: Tag,
                badge: 'Cupom',
                badgeColor: 'bg-pink-100 text-pink-900',
                action: () => {
                  saveRecentSearch(query);
                  onClose();
                  onNavigate('admin');
                },
                score: 26,
              });
            }
          });
        } catch {}
      }
    }

    // Sort by score descending
    return items.sort((a, b) => (b.score || 0) - (a.score || 0));
  }, [query, activeFilter, products, categories, subcategories, isStaffUser, canViewPrices, canAccessCatalogPdf, currentUser, onNavigate, onClose, onOpenCart]);

  // Adjust selectedIndex when result length changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [searchResults.length, activeFilter]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (searchResults.length > 0 ? (prev + 1) % searchResults.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) =>
        searchResults.length > 0 ? (prev - 1 + searchResults.length) % searchResults.length : 0
      );
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (searchResults.length > 0 && searchResults[selectedIndex]) {
        searchResults[selectedIndex].action();
      } else if (query.trim()) {
        // Fallback: go to catalog with search
        saveRecentSearch(query);
        onClose();
        onNavigate('catalog');
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  // Popular search tags for quick suggestions
  const popularKeywords = [
    'Copo Térmico',
    'Garrafa Squeeze',
    'Caneta Metal',
    'Mochila Executiva',
    'Kit Boas-vindas',
    'Caderno Ecológico',
    'Gravação a Laser',
  ];

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-12 sm:pt-20 px-3 sm:px-4 bg-slate-950/60 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      id="global-search-modal"
    >
      <div
        className="w-full max-w-3xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh] text-slate-900 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Search Header Input */}
        <div className="relative flex items-center px-4 sm:px-6 py-4 border-b border-slate-100 bg-white">
          <Search className="w-5 h-5 text-slate-400 shrink-0 mr-3" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por produto, código, categoria, pedido ou comando..."
            className="w-full text-sm sm:text-base font-semibold text-slate-900 placeholder-slate-400 bg-transparent outline-none pr-10"
            id="global-search-input"
          />
          {query ? (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                inputRef.current?.focus();
              }}
              className="p-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors mr-2 cursor-pointer"
              title="Limpar busca"
            >
              <X className="w-4 h-4" />
            </button>
          ) : null}
          <div className="hidden sm:flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 text-slate-500 font-mono text-[10px] font-bold border border-slate-200 shrink-0">
            <span>ESC</span>
          </div>
        </div>

        {/* Filter Segmented Control */}
        <div className="flex items-center gap-1.5 px-4 sm:px-6 py-2.5 bg-slate-50 border-b border-slate-100 overflow-x-auto text-xs font-semibold scrollbar-none">
          <button
            type="button"
            onClick={() => setActiveFilter('all')}
            className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer shrink-0 ${
              activeFilter === 'all'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            Tudo
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter('products')}
            className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer shrink-0 ${
              activeFilter === 'products'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            Produtos ({products.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter('categories')}
            className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer shrink-0 ${
              activeFilter === 'categories'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            Categorias ({categories.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter('navigation')}
            className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer shrink-0 ${
              activeFilter === 'navigation'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            Páginas & Ações
          </button>
          {isStaffUser && (
            <button
              type="button"
              onClick={() => setActiveFilter('admin')}
              className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer shrink-0 ${
                activeFilter === 'admin'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-amber-800 hover:bg-amber-100/60'
              }`}
            >
              Administrativo
            </button>
          )}
        </div>

        {/* Search Content Body */}
        <div
          ref={resultsContainerRef}
          className="flex-1 overflow-y-auto p-3 sm:p-4 divide-y divide-slate-100 max-h-[60vh]"
        >
          {/* STATE 1: Empty Query - Show Recents & Suggestions */}
          {!query.trim() && (
            <div className="space-y-5 py-2">
              {/* Recent Searches */}
              {recentSearches.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-wider px-2">
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      Buscas Recentes
                    </span>
                    <button
                      type="button"
                      onClick={clearAllRecents}
                      className="text-[11px] text-slate-400 hover:text-rose-600 transition-colors font-medium cursor-pointer"
                    >
                      Limpar histórico
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {recentSearches.map((term) => (
                      <div
                        key={term}
                        onClick={() => {
                          setQuery(term);
                          inputRef.current?.focus();
                        }}
                        className="flex items-center justify-between p-2.5 rounded-2xl hover:bg-slate-100 transition-colors cursor-pointer group text-xs text-slate-700 font-semibold"
                      >
                        <span className="flex items-center gap-2 truncate">
                          <Search className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-700" />
                          <span className="truncate">{term}</span>
                        </span>
                        <button
                          type="button"
                          onClick={(e) => removeRecentSearch(e, term)}
                          className="text-slate-300 hover:text-rose-500 p-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Remover termo"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Popular Searches */}
              <div className="space-y-2">
                <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider px-2 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  Termos Mais Procurados
                </span>
                <div className="flex flex-wrap gap-1.5 px-2">
                  {popularKeywords.map((kw) => (
                    <button
                      key={kw}
                      type="button"
                      onClick={() => {
                        setQuery(kw);
                        inputRef.current?.focus();
                      }}
                      className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-[#00AEEF] hover:text-white text-xs font-medium text-slate-700 transition-all cursor-pointer"
                    >
                      {kw}
                    </button>
                  ))}
                </div>
              </div>

              {/* Quick Navigation Shortcuts */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider px-2">
                  Acessos Diretos
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onNavigate('catalog');
                    }}
                    className="p-3 rounded-2xl border border-slate-200 hover:border-[#00AEEF] hover:bg-sky-50/50 text-left transition-all cursor-pointer group"
                  >
                    <Package className="w-4 h-4 text-[#00AEEF] mb-1 group-hover:scale-110 transition-transform" />
                    <div className="font-bold text-xs text-slate-900">Catálogo Completo</div>
                    <div className="text-[11px] text-slate-500">Mais de {products.length} itens</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onNavigate('quote');
                    }}
                    className="p-3 rounded-2xl border border-slate-200 hover:border-[#E6007E] hover:bg-pink-50/50 text-left transition-all cursor-pointer group"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-[#E6007E] mb-1 group-hover:scale-110 transition-transform" />
                    <div className="font-bold text-xs text-slate-900">Orçamento Formal</div>
                    <div className="text-[11px] text-slate-500">Proposta em PDF imediata</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onNavigate('customer-portal');
                    }}
                    className="p-3 rounded-2xl border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/50 text-left transition-all cursor-pointer group"
                  >
                    <User className="w-4 h-4 text-emerald-600 mb-1 group-hover:scale-110 transition-transform" />
                    <div className="font-bold text-xs text-slate-900">Minha Conta</div>
                    <div className="text-[11px] text-slate-500">Pedidos e 2ª via boletos</div>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STATE 2: Active Results List */}
          {query.trim().length > 0 && searchResults.length > 0 && (
            <div className="space-y-1">
              <div className="px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                <span>{searchResults.length} {searchResults.length === 1 ? 'resultado encontrado' : 'resultados encontrados'}</span>
                <span>Use as setas ↑↓ para navegar</span>
              </div>

              {searchResults.map((item, idx) => {
                const isSelected = idx === selectedIndex;
                const IconComponent = item.icon || Package;

                return (
                  <div
                    key={item.id}
                    onClick={item.action}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={`flex items-center gap-3 p-3 rounded-2xl transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-slate-100/90 text-slate-900 shadow-2xs pl-3.5 border-l-4 border-[#00AEEF]'
                        : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    {/* Thumbnail or Icon */}
                    {item.imageUrl ? (
                      <img
                        src={item.imageUrl}
                        alt={item.title}
                        className="w-10 h-10 object-cover rounded-xl border border-slate-200 shrink-0 bg-white"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 shrink-0">
                        <IconComponent className="w-5 h-5" />
                      </div>
                    )}

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-xs sm:text-sm text-slate-900 truncate">
                          <HighlightMatch text={item.title} query={query} />
                        </span>
                        {item.badge && (
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase shrink-0 ${
                              item.badgeColor || 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {item.badge}
                          </span>
                        )}
                      </div>

                      {item.subtitle && (
                        <p className="text-[11px] text-slate-500 truncate mt-0.5">
                          <HighlightMatch text={item.subtitle} query={query} />
                        </p>
                      )}
                    </div>

                    {/* Select indicator */}
                    <div className="shrink-0 flex items-center text-slate-400">
                      {isSelected ? (
                        <div className="flex items-center gap-1 text-[11px] font-bold text-[#00AEEF]">
                          <span className="hidden sm:inline">Acessar</span>
                          <CornerDownLeft className="w-3.5 h-3.5" />
                        </div>
                      ) : (
                        <ChevronRight className="w-4 h-4 opacity-40" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* STATE 3: No Results */}
          {query.trim().length > 0 && searchResults.length === 0 && (
            <div className="py-12 px-4 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                <Search className="w-6 h-6" />
              </div>
              <h3 className="font-heading font-bold text-sm sm:text-base text-slate-800">
                Nenhum resultado para "{query}"
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Tente buscar por termos mais genéricos como "caneta", "copo", "garrafa", "laser" ou verifique a ortografia digitada.
              </p>
              <div className="pt-2 flex flex-wrap justify-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    saveRecentSearch(query);
                    onClose();
                    onNavigate('catalog');
                  }}
                  className="px-4 py-2 bg-slate-900 hover:bg-[#E6007E] text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
                >
                  Ver Catálogo Geral
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onNavigate('quote');
                  }}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                >
                  Solicitar Cotação Formal
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer with Keyboard Shortcuts */}
        <div className="px-4 sm:px-6 py-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-medium">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded text-[10px] font-mono shadow-2xs">
                ↑
              </kbd>
              <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded text-[10px] font-mono shadow-2xs">
                ↓
              </kbd>
              <span className="hidden sm:inline">Navegar</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded text-[10px] font-mono shadow-2xs">
                ↵
              </kbd>
              <span>Selecionar</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded text-[10px] font-mono shadow-2xs">
                ESC
              </kbd>
              <span>Fechar</span>
            </span>
          </div>

          <div className="hidden sm:flex items-center gap-1.5 text-slate-400">
            <Zap className="w-3 h-3 text-amber-500" />
            <span>MB Personaliza • Busca Global</span>
          </div>
        </div>
      </div>
    </div>
  );
};
