import React, { useState, useMemo } from 'react';
import { Product, ProductVariant, Quote, QuoteItem, UserProfile, Category } from '../types';
import { StorageService } from '../services/storage';
import { ArtworkUpload } from '../components/ArtworkUpload';
import { SEOHead } from '../components/SEOHead';
import { QuoteProductPickerModal } from '../components/QuoteProductPickerModal';
import {
  FileSpreadsheet,
  CheckCircle2,
  Plus,
  Minus,
  Trash2,
  Send,
  Calendar,
  Building,
  User,
  Phone,
  Mail,
  MapPin,
  Sparkles,
  ArrowRight,
  Info,
  Search,
  X,
  Eye,
  Copy,
  Layers,
  Package,
  Tag,
  Check,
  RotateCcw,
  LayoutGrid,
  List,
  SlidersHorizontal,
  Zap,
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface QuoteViewProps {
  products: Product[];
  categories?: Category[];
  currentUser: UserProfile;
  initialItem?: { product: Product; variant?: ProductVariant; quantity: number };
  onNavigate: (view: string, param?: string) => void;
}

export const QuoteView: React.FC<QuoteViewProps> = ({
  products,
  categories = [],
  currentUser,
  initialItem,
  onNavigate,
}) => {
  const [clientName, setClientName] = useState(currentUser.name || '');
  const [clientEmail, setClientEmail] = useState(currentUser.email || '');
  const [clientPhone, setClientPhone] = useState(currentUser.phone || '');
  const [clientCompany, setClientCompany] = useState(currentUser.company || '');
  const [clientCpfCnpj, setClientCpfCnpj] = useState(currentUser.cpfCnpj || '');
  const [deliveryDeadline, setDeliveryDeadline] = useState('');
  const [deliveryCityState, setDeliveryCityState] = useState('São Paulo - SP');
  const [notes, setNotes] = useState('');
  const [uploadedArtwork, setUploadedArtwork] = useState<{ name: string; url: string; size: string } | null>(null);

  // Quick product search state in QuoteView
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchViewMode, setSearchViewMode] = useState<'grid' | 'list'>('grid');
  const [searchSortBy, setSearchSortBy] = useState<'popular' | 'price_asc' | 'price_desc' | 'name'>('popular');
  const [searchItemQuantities, setSearchItemQuantities] = useState<Record<string, number>>({});
  const [quickToast, setQuickToast] = useState<string | null>(null);
  const [previewModalImage, setPreviewModalImage] = useState<{
    url: string;
    title: string;
    product?: Product;
  } | null>(null);

  // Modal Product Picker state
  const [isPickerModalOpen, setIsPickerModalOpen] = useState(false);
  const [pickerMode, setPickerMode] = useState<'add' | 'replace'>('add');
  const [replacingItemIndex, setReplacingItemIndex] = useState<number | null>(null);

  // Categories fallback
  const allCategories = useMemo(() => {
    if (categories && categories.length > 0) return categories;
    return StorageService.getCategories();
  }, [categories]);

  // Category map for fast lookup
  const categoryMap = useMemo(() => {
    const map = new Map<string, string>();
    allCategories.forEach((c) => map.set(c.id, c.name));
    return map;
  }, [allCategories]);

  // Active catalog products
  const activeProducts = useMemo(() => {
    return products.filter((p) => p.is_active);
  }, [products]);

  // Quantity helper for search cards
  const getSearchItemQuantity = (product: Product): number => {
    return searchItemQuantities[product.id] || product.min_order_qty || 50;
  };

  const updateSearchItemQuantity = (product: Product, deltaOrDirect: number, isDirect = false) => {
    const minQty = product.min_order_qty || 1;
    setSearchItemQuantities((prev) => {
      const current = prev[product.id] || product.min_order_qty || 50;
      const next = isDirect ? Math.max(minQty, deltaOrDirect) : Math.max(minQty, current + deltaOrDirect);
      return { ...prev, [product.id]: next };
    });
  };

  // Filtered & Sorted products for the inline visual search catalog
  const inlineFilteredProducts = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    const list = activeProducts.filter((p) => {
      // Category filter
      if (selectedCategory !== 'all') {
        const matchesCat =
          p.categoryId === selectedCategory || (p as any).category_id === selectedCategory;
        if (!matchesCat) return false;
      }

      // Text search
      if (q) {
        const matchName = p.name.toLowerCase().includes(q);
        const matchCode = p.code.toLowerCase().includes(q);
        const matchDesc = (p.description || '').toLowerCase().includes(q);
        const catName = (categoryMap.get(p.categoryId) || '').toLowerCase();
        const matchCat = catName.includes(q);
        const matchTech = p.details.customTechniques.some((t) => t.toLowerCase().includes(q));
        const matchVariant = p.variants?.some((v) =>
          v.name.toLowerCase().includes(q) || (v.sku && v.sku.toLowerCase().includes(q))
        );
        return matchName || matchCode || matchDesc || matchCat || matchTech || matchVariant;
      }

      return true;
    });

    // Sorting
    return list.sort((a, b) => {
      if (searchSortBy === 'price_asc') {
        const priceA = a.promo_price || a.base_price;
        const priceB = b.promo_price || b.base_price;
        return priceA - priceB;
      }
      if (searchSortBy === 'price_desc') {
        const priceA = a.promo_price || a.base_price;
        const priceB = b.promo_price || b.base_price;
        return priceB - priceA;
      }
      if (searchSortBy === 'name') {
        return a.name.localeCompare(b.name);
      }
      // 'popular'
      return (b.is_featured ? 1 : 0) - (a.is_featured ? 1 : 0);
    });
  }, [activeProducts, selectedCategory, searchQuery, searchSortBy, categoryMap]);

  // Quote items
  const [items, setItems] = useState<QuoteItem[]>(() => {
    if (initialItem) {
      const price = initialItem.product.promo_price || initialItem.product.base_price;
      return [
        {
          id: `qi-${Date.now()}`,
          productId: initialItem.product.id,
          productName: initialItem.product.name,
          productSku: initialItem.product.code,
          productImage: initialItem.product.images[0],
          variantName: initialItem.variant?.name,
          quantity: initialItem.quantity || initialItem.product.min_order_qty || 50,
          customTechnique: initialItem.product.details.customTechniques[0] || 'Gravação a Laser',
          unit_price_estimated: price,
          subtotal: Number(((price || 0) * (initialItem.quantity || 50)).toFixed(2)),
        },
      ];
    }
    const defaultProd = products[0];
    if (!defaultProd) return [];
    const defaultPrice = defaultProd.promo_price || defaultProd.base_price;
    const defaultQty = defaultProd.min_order_qty || 50;

    return [
      {
        id: `qi-${Date.now()}`,
        productId: defaultProd.id,
        productName: defaultProd.name,
        productSku: defaultProd.code,
        productImage: defaultProd.images[0],
        quantity: defaultQty,
        customTechnique: defaultProd.details.customTechniques[0] || 'Gravação a Laser',
        unit_price_estimated: defaultPrice,
        subtotal: Number(((defaultPrice || 0) * defaultQty).toFixed(2)),
      },
    ];
  });

  const [submittedQuote, setSubmittedQuote] = useState<Quote | null>(null);

  // Helper to show animated temporary toast
  const showToast = (message: string) => {
    setQuickToast(message);
    setTimeout(() => {
      setQuickToast(null);
    }, 2800);
  };

  // Add Item to quote directly from product
  const handleAddItemFromProduct = (product: Product, quantity?: number, technique?: string) => {
    const qty = quantity || searchItemQuantities[product.id] || product.min_order_qty || 50;
    const tech = technique || product.details.customTechniques[0] || 'Gravação a Laser';
    const price = product.promo_price || product.base_price;

    const newItem: QuoteItem = {
      id: `qi-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      productId: product.id,
      productName: product.name,
      productSku: product.code,
      productImage: product.images[0],
      quantity: qty,
      customTechnique: tech,
      unit_price_estimated: price,
      subtotal: Number(((price || 0) * qty).toFixed(2)),
    };

    setItems((prev) => [...prev, newItem]);
    showToast(`✓ "${product.name}" (${qty} un) adicionado ao orçamento!`);
  };

  // Replace existing item's product
  const handleReplaceItemProduct = (index: number, product: Product) => {
    setItems((prev) => {
      const next = [...prev];
      const price = product.promo_price || product.base_price;
      const currentQty = next[index]?.quantity || product.min_order_qty || 50;
      next[index] = {
        ...next[index],
        productId: product.id,
        productName: product.name,
        productSku: product.code,
        productImage: product.images[0],
        customTechnique: product.details.customTechniques[0] || 'Gravação a Laser',
        variantName: undefined,
        unit_price_estimated: price,
        subtotal: Number(((price || 0) * currentQty).toFixed(2)),
      };
      return next;
    });
    showToast(`Item #${index + 1} alterado para "${product.name}"!`);
  };

  // Duplicate an item in quote
  const handleDuplicateItem = (index: number) => {
    const itemToDup = items[index];
    const duplicated: QuoteItem = {
      ...itemToDup,
      id: `qi-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    };
    setItems((prev) => [...prev, duplicated]);
    showToast(`"${itemToDup.productName}" duplicado com sucesso!`);
  };

  // Remove an item from quote
  const handleRemoveItem = (id: string) => {
    if (items.length <= 1) {
      showToast('O orçamento deve conter pelo menos 1 item.');
      return;
    }
    setItems(items.filter((item) => item.id !== id));
    showToast('Item removido do orçamento.');
  };

  // Update item quantity
  const handleItemQtyChange = (index: number, qty: number) => {
    const newItems = [...items];
    const newQty = Math.max(1, qty);
    newItems[index].quantity = newQty;
    const unitPrice = newItems[index].unit_price_estimated || 0;
    newItems[index].subtotal = Number((unitPrice * newQty).toFixed(2));
    setItems(newItems);
  };

  // Update item technique
  const handleItemTechniqueChange = (index: number, tech: string) => {
    const newItems = [...items];
    newItems[index].customTechnique = tech;
    setItems(newItems);
  };

  // Total items quantity and estimated price
  const totalUnits = useMemo(() => {
    return items.reduce((acc, it) => acc + (it.quantity || 0), 0);
  }, [items]);

  const totalEstimated = useMemo(() => {
    return items.reduce((acc, it) => acc + (it.subtotal || 0), 0);
  }, [items]);

  // Already added product IDs for badge indicators
  const alreadyAddedProductIds = useMemo(() => {
    return items.map((it) => it.productId);
  }, [items]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!clientName || !clientEmail || !clientPhone) {
      alert('Por favor preencha nome, e-mail e telefone de contato.');
      return;
    }

    if (items.length === 0) {
      alert('Por favor adicione pelo menos um produto ao orçamento.');
      return;
    }

    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const quoteCode = `ORC-2026-${randomNum}`;

    const newQuote: Quote = {
      id: `orc-${Date.now()}`,
      code: quoteCode,
      clientId: currentUser.id,
      clientName,
      clientEmail,
      clientPhone,
      clientCompany,
      clientCpfCnpj,
      deliveryDeadline,
      deliveryCityState,
      items,
      notes,
      artworkName: uploadedArtwork?.name,
      artworkUrl: uploadedArtwork?.url,
      status: 'pendente',
      totalEstimated,
      createdAt: new Date().toISOString(),
    };

    StorageService.addQuote(newQuote);
    setSubmittedQuote(newQuote);

    // Trigger celebration confetti
    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#E6007E', '#00AEEF', '#FFDD00'],
      });
    } catch {}
  };

  if (submittedQuote) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center space-y-6">
        <div className="w-16 h-16 rounded-3xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-sm animate-in zoom-in-95">
          <CheckCircle2 className="w-9 h-9" />
        </div>

        <div className="space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-[#E6007E]">
            Solicitação Recebida com Sucesso!
          </span>
          <h1 className="text-3xl font-extrabold uppercase font-heading text-slate-900">
            Cotação {submittedQuote.code} Registrada
          </h1>
          <p className="text-sm text-slate-600 max-w-lg mx-auto">
            Obrigado, <strong>{submittedQuote.clientName}</strong>. Nossa equipe comercial já recebeu os detalhes e enviará a proposta formal com valores, prazos e simulação virtual para seu e-mail <strong>{submittedQuote.clientEmail}</strong> e WhatsApp.
          </p>
        </div>

        <div className="p-6 bg-white rounded-2xl border border-slate-200 text-left max-w-md mx-auto space-y-3 shadow-xs">
          <div className="flex justify-between text-xs border-b border-slate-100 pb-2">
            <span className="text-slate-500">Protocolo:</span>
            <span className="font-mono font-bold text-slate-900">{submittedQuote.code}</span>
          </div>
          <div className="flex justify-between text-xs border-b border-slate-100 pb-2">
            <span className="text-slate-500">Total de Itens:</span>
            <span className="font-bold text-slate-900">
              {(submittedQuote.items || []).reduce((a, b) => a + (b?.quantity || 0), 0)} unidades em {(submittedQuote.items || []).length} produto(s)
            </span>
          </div>
          {submittedQuote.totalEstimated && submittedQuote.totalEstimated > 0 && (
            <div className="flex justify-between text-xs border-b border-slate-100 pb-2">
              <span className="text-slate-500">Valor Estimado Base:</span>
              <span className="font-bold text-emerald-700 font-heading">
                R$ {submittedQuote.totalEstimated.toFixed(2)}
              </span>
            </div>
          )}
          <div className="flex justify-between text-xs border-b border-slate-100 pb-2">
            <span className="text-slate-500">Status Atual:</span>
            <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-bold uppercase">
              Em Análise Comercial
            </span>
          </div>
          {submittedQuote.artworkName && (
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Arte Anexada:</span>
              <span className="font-medium text-emerald-700">{submittedQuote.artworkName}</span>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3 pt-4">
          <button
            onClick={() => onNavigate('customer-portal')}
            className="px-6 py-3 bg-slate-900 hover:bg-[#E6007E] text-white font-bold rounded-xl text-xs sm:text-sm transition-all shadow-md flex items-center gap-2 cursor-pointer"
          >
            <span>Ver Meus Orçamentos (Minha Conta)</span>
            <ArrowRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => onNavigate('home')}
            className="px-6 py-3 bg-white hover:bg-slate-50 text-slate-700 font-bold rounded-xl text-xs sm:text-sm border border-slate-200 cursor-pointer"
          >
            Voltar para o Início
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8" id="quote-request-page">
      <SEOHead
        title="Solicitar Orçamento Rápido de Brindes e Personalizados"
        description="Receba uma proposta comercial detalhada e sem compromisso para brindes corporativos, presentes e papelaria personalizada. Condições especiais para empresas e atacado."
        canonicalPath="/orcamento"
        breadcrumbs={[
          { name: 'Início', path: '/' },
          { name: 'Solicitar Orçamento', path: '/orcamento' },
        ]}
        keywords={[
          'orçamento brindes personalizados',
          'cotação presentes corporativos',
          'brindes atacado orçamento',
          'simulador de brindes',
          'MB Personaliza',
        ]}
      />

      {/* Floating Success Feedback Toast */}
      {quickToast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-2xl bg-emerald-600 text-white shadow-xl flex items-center gap-2 text-xs font-bold animate-in fade-in slide-in-from-top-3 duration-200 border border-emerald-400">
          <CheckCircle2 className="w-4 h-4 text-white shrink-0" />
          <span>{quickToast}</span>
        </div>
      )}

      {/* Header */}
      <div className="text-center max-w-2xl mx-auto space-y-2">
        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-pink-50 text-[#E6007E] text-xs font-bold uppercase tracking-wider">
          <Sparkles className="w-3.5 h-3.5" />
          Cotação Rápida B2B & Personalizados
        </span>
        <h1 className="text-3xl sm:text-4xl font-extrabold uppercase font-heading text-slate-900">
          Solicite seu Orçamento Personalizado
        </h1>
        <p className="text-xs sm:text-sm text-slate-600">
          Pesquise e visualize os brindes desejados com foto, defina quantidades e personalize a gravação. Nossa equipe formulará a melhor proposta com descontos progressivos por volume.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-8 shadow-sm space-y-8">
        {/* Section 1: Customer Info */}
        <div className="space-y-4">
          <h3 className="font-heading text-lg font-bold text-slate-900 uppercase flex items-center gap-2 border-b border-slate-100 pb-2">
            <User className="w-4 h-4 text-[#00AEEF]" />
            1. Dados de Contato e Faturamento
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Nome Completo *</label>
              <input
                type="text"
                required
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Ex: João Silva"
                className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#00AEEF] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">E-mail Corporativo *</label>
              <input
                type="email"
                required
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
                placeholder="Ex: joao@empresa.com.br"
                className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#00AEEF] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">WhatsApp / Telefone *</label>
              <input
                type="tel"
                required
                value={clientPhone}
                onChange={(e) => setClientPhone(e.target.value)}
                placeholder="(11) 98765-4321"
                className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#00AEEF] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Nome da Empresa / Razão Social</label>
              <input
                type="text"
                value={clientCompany}
                onChange={(e) => setClientCompany(e.target.value)}
                placeholder="Ex: Minha Empresa Ltda"
                className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#00AEEF] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">CNPJ ou CPF (Opcional p/ faturamento)</label>
              <input
                type="text"
                value={clientCpfCnpj}
                onChange={(e) => setClientCpfCnpj(e.target.value)}
                placeholder="00.000.000/0001-00"
                className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#00AEEF] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Cidade / Estado de Entrega</label>
              <input
                type="text"
                value={deliveryCityState}
                onChange={(e) => setDeliveryCityState(e.target.value)}
                placeholder="Ex: São Paulo - SP"
                className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#00AEEF] focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* Section 2: Products & Customization (With Photo Search & Catalog Picker)   */}
        {/* ========================================================================= */}
        <div className="space-y-5">
          {/* Section Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-heading text-lg font-bold text-slate-900 uppercase flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-[#E6007E]" />
                <span>2. Itens do Orçamento</span>
                <span className="text-xs font-mono font-bold bg-pink-50 text-[#E6007E] px-2 py-0.5 rounded-full">
                  {items.length} {items.length === 1 ? 'item' : 'itens'}
                </span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Utilize o campo de pesquisa abaixo com fotos para encontrar e adicionar produtos facilmente.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setPickerMode('add');
                setIsPickerModalOpen(true);
              }}
              className="px-4 py-2.5 rounded-2xl bg-slate-900 hover:bg-[#00AEEF] text-white text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer shrink-0"
              title="Abrir catálogo completo com fotos e filtros"
            >
              <Package className="w-4 h-4 text-[#FFDD00]" />
              <span>Catálogo com Fotos ({activeProducts.length})</span>
            </button>
          </div>

          {/* ========================================================================= */}
          {/* QUICK SEARCH & PHOTO BROWSER BOX (CAMPO DE PESQUISA COM FOTOS VISUAIS)     */}
          {/* ========================================================================= */}
          <div className="p-4 sm:p-6 rounded-3xl bg-slate-50 border border-slate-200/90 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#00AEEF] to-[#E6007E] flex items-center justify-center text-white shadow-xs shrink-0">
                  <Search className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-extrabold uppercase font-heading text-slate-900 flex items-center gap-1.5">
                    <span>Encontrar Produtos com Foto para Adicionar ao Orçamento</span>
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Pesquise por nome, foto ou categoria. Defina a quantidade e adicione em 1 clique.
                  </p>
                </div>
              </div>

              {/* View Mode Toggle & Sort Controls */}
              <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
                {/* View Mode: Grid with Large Photos vs List */}
                <div className="flex items-center bg-white p-0.5 rounded-xl border border-slate-200 shadow-2xs">
                  <button
                    type="button"
                    onClick={() => setSearchViewMode('grid')}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                      searchViewMode === 'grid'
                        ? 'bg-slate-900 text-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                    title="Exibir em Grade com Fotos Grandes"
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Fotos Grandes</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSearchViewMode('list')}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                      searchViewMode === 'list'
                        ? 'bg-slate-900 text-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                    title="Exibir em Lista Detalhada com Fotos"
                  >
                    <List className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Lista</span>
                  </button>
                </div>

                {/* Sort selector */}
                <select
                  value={searchSortBy}
                  onChange={(e) => setSearchSortBy(e.target.value as any)}
                  className="px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-xl text-slate-700 font-bold outline-none cursor-pointer shadow-2xs"
                  title="Ordenar produtos"
                >
                  <option value="popular">Mais Populares</option>
                  <option value="price_asc">Menor Preço</option>
                  <option value="price_desc">Maior Preço</option>
                  <option value="name">Nome (A-Z)</option>
                </select>

                {(searchQuery || selectedCategory !== 'all') && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedCategory('all');
                    }}
                    className="text-[11px] font-bold text-slate-500 hover:text-slate-800 flex items-center gap-1 bg-white px-2.5 py-1.5 rounded-xl border border-slate-200 shadow-2xs cursor-pointer"
                    title="Limpar filtros"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Limpar</span>
                  </button>
                )}
              </div>
            </div>

            {/* Live Search Input with Clear Button */}
            <div className="relative">
              <Search className="w-4.5 h-4.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Digite para buscar produtos por foto e nome (ex: Caneca Térmica, Garrafa, Mochila, Caderno, Copo Stanley)..."
                className="w-full pl-10 pr-10 py-3 text-xs sm:text-sm bg-white border border-slate-200 rounded-2xl outline-none focus:border-[#00AEEF] focus:ring-2 focus:ring-sky-100 font-medium text-slate-900 placeholder:text-slate-400 shadow-2xs transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1 text-xs cursor-pointer"
                  title="Limpar pesquisa"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Quick Category Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-0.5 text-xs pdv-scroll">
              <button
                type="button"
                onClick={() => setSelectedCategory('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                  selectedCategory === 'all'
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                Todas as Categorias ({activeProducts.length})
              </button>

              {allCategories.map((cat) => {
                const count = activeProducts.filter(
                  (p) => p.categoryId === cat.id || (p as any).category_id === cat.id
                ).length;
                if (count === 0) return null;

                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                      selectedCategory === cat.id
                        ? 'bg-slate-900 text-white shadow-2xs'
                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <span>{cat.name}</span>
                    <span className="text-[10px] opacity-75">({count})</span>
                  </button>
                );
              })}
            </div>

            {/* Products Counter & Info */}
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 px-1 pt-1">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>{inlineFilteredProducts.length} brindes encontrados com fotos</span>
              </span>
              <span className="text-slate-400 font-normal hidden sm:inline">
                Clique na foto para ampliar • Ajuste a quantidade antes de adicionar
              </span>
            </div>

            {/* Quick Search Results Preview with HIGH-FIDELITY PHOTOS */}
            <div className="pt-1">
              {inlineFilteredProducts.length === 0 ? (
                <div className="p-8 bg-white rounded-3xl border border-slate-200 text-center space-y-2">
                  <Search className="w-10 h-10 text-slate-300 mx-auto stroke-1" />
                  <p className="text-xs font-bold text-slate-700">
                    Nenhum brinde encontrado com "{searchQuery}"
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Tente buscar por termos mais simples como "copo", "chaveiro" ou limpe a busca.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedCategory('all');
                    }}
                    className="px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-xl hover:bg-[#00AEEF] transition-colors"
                  >
                    Ver Todos os Produtos
                  </button>
                </div>
              ) : searchViewMode === 'grid' ? (
                /* GRID VIEW MODE WITH LARGE HIGH-RES PRODUCT PHOTOS */
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5 max-h-[560px] overflow-y-auto pr-1.5 pdv-scroll">
                  {inlineFilteredProducts.map((p) => {
                    const price = p.promo_price || p.base_price;
                    const isAlreadyAdded = alreadyAddedProductIds.includes(p.id);
                    const currentQty = getSearchItemQuantity(p);
                    const catName = categoryMap.get(p.categoryId) || 'Brindes';

                    return (
                      <div
                        key={p.id}
                        className={`p-3 rounded-2xl bg-white border flex flex-col justify-between transition-all hover:shadow-md group relative ${
                          isAlreadyAdded
                            ? 'border-emerald-300 bg-emerald-50/15 ring-1 ring-emerald-200'
                            : 'border-slate-200 hover:border-[#00AEEF]'
                        }`}
                      >
                        <div>
                          {/* Large Product Photo with Hover Preview & Zoom Lightbox */}
                          <div
                            className="relative aspect-square w-full rounded-xl overflow-hidden bg-slate-100 mb-2.5 border border-slate-100 cursor-pointer group"
                            onClick={() =>
                              setPreviewModalImage({ url: p.images[0], title: p.name, product: p })
                            }
                            title="Clique para ver foto ampliada em detalhes"
                          >
                            <img
                              src={p.images[0]}
                              alt={p.name}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              loading="lazy"
                            />

                            {/* Floating Action / Zoom Indicator */}
                            <div className="absolute inset-0 bg-black/35 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white gap-1.5 text-xs font-bold">
                              <Eye className="w-4 h-4" />
                              <span>Ampliar Foto</span>
                            </div>

                            {/* Top Badges */}
                            <div className="absolute top-2 left-2 flex flex-col gap-1 items-start pointer-events-none">
                              {p.badge && (
                                <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-md bg-[#E6007E] text-white shadow-xs">
                                  {p.badge}
                                </span>
                              )}
                              {isAlreadyAdded && (
                                <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-md bg-emerald-600 text-white shadow-xs flex items-center gap-1">
                                  <Check className="w-2.5 h-2.5" />
                                  <span>No Orçamento</span>
                                </span>
                              )}
                            </div>

                            {/* Min order tag */}
                            <span className="absolute top-2 right-2 text-[9px] font-bold px-1.5 py-0.5 rounded-md uppercase bg-white/95 text-slate-700 shadow-xs backdrop-blur-2xs pointer-events-none">
                              Mín: {p.min_order_qty || 50} un
                            </span>
                          </div>

                          {/* Product Details */}
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                              <span className="truncate">{p.code}</span>
                              <span className="text-slate-500 font-semibold truncate max-w-[100px]">
                                {catName}
                              </span>
                            </div>

                            <h5
                              className="text-xs font-extrabold text-slate-900 line-clamp-2 leading-tight group-hover:text-[#00AEEF] transition-colors"
                              title={p.name}
                            >
                              {p.name}
                            </h5>

                            {/* Price preview */}
                            <div className="flex items-baseline gap-1.5 pt-0.5">
                              <span className="text-[10px] text-slate-400 uppercase font-bold">
                                A partir de:
                              </span>
                              <span className="text-xs font-black text-slate-900 font-heading">
                                R$ {price.toFixed(2)}
                              </span>
                              <span className="text-[10px] text-slate-400 font-sans">/un</span>
                            </div>

                            {/* Custom Techniques Tags */}
                            {p.details.customTechniques && p.details.customTechniques.length > 0 && (
                              <div className="flex items-center gap-1 flex-wrap pt-0.5">
                                {p.details.customTechniques.slice(0, 2).map((t) => (
                                  <span
                                    key={t}
                                    className="text-[9px] font-semibold px-1.5 py-0.2 rounded bg-slate-100 text-slate-600"
                                  >
                                    {t}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Quantity selection & Add button */}
                        <div className="mt-3 pt-2.5 border-t border-slate-100 space-y-2">
                          {/* Quantity stepper */}
                          <div className="flex items-center justify-between gap-1 text-xs">
                            <span className="text-[10px] font-bold text-slate-500 uppercase">
                              Qtd:
                            </span>
                            <div className="flex items-center border border-slate-200 rounded-lg bg-slate-50 overflow-hidden">
                              <button
                                type="button"
                                onClick={() => updateSearchItemQuantity(p, -10)}
                                className="px-2 py-0.5 text-slate-600 hover:bg-slate-200 text-xs font-bold cursor-pointer"
                                title="Diminuir 10"
                              >
                                -
                              </button>
                              <input
                                type="number"
                                min={p.min_order_qty || 1}
                                value={currentQty}
                                onChange={(e) =>
                                  updateSearchItemQuantity(p, parseInt(e.target.value) || 1, true)
                                }
                                className="w-14 px-1 py-0.5 text-[11px] text-center font-extrabold text-slate-900 bg-white outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => updateSearchItemQuantity(p, 10)}
                                className="px-2 py-0.5 text-slate-600 hover:bg-slate-200 text-xs font-bold cursor-pointer"
                                title="Aumentar 10"
                              >
                                +
                              </button>
                            </div>
                          </div>

                          {/* Quick presets */}
                          <div className="flex items-center justify-between gap-1">
                            {[50, 100, 250].map((preset) => (
                              <button
                                key={`preset-${p.id}-${preset}`}
                                type="button"
                                onClick={() => updateSearchItemQuantity(p, preset, true)}
                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold cursor-pointer transition-colors flex-1 text-center ${
                                  currentQty === preset
                                    ? 'bg-[#00AEEF] text-white'
                                    : 'bg-slate-100 text-slate-600 hover:bg-sky-50'
                                }`}
                              >
                                {preset} un
                              </button>
                            ))}
                          </div>

                          {/* Action Button: Add to Quote */}
                          <button
                            type="button"
                            onClick={() => handleAddItemFromProduct(p, currentQty)}
                            className={`w-full py-2 px-3 rounded-xl text-xs font-extrabold uppercase transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs ${
                              isAlreadyAdded
                                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                : 'bg-slate-900 hover:bg-[#00AEEF] text-white'
                            }`}
                            title={`Adicionar ${currentQty} un de ${p.name} ao orçamento`}
                          >
                            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                            <span>
                              {isAlreadyAdded ? `+ Adicionar Mais (${currentQty} un)` : `Adicionar ao Orçamento`}
                            </span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* LIST VIEW MODE WITH PHOTO THUMBNAILS */
                <div className="divide-y divide-slate-100 bg-white rounded-2xl border border-slate-200 max-h-[560px] overflow-y-auto pr-1 pdv-scroll">
                  {inlineFilteredProducts.map((p) => {
                    const price = p.promo_price || p.base_price;
                    const isAlreadyAdded = alreadyAddedProductIds.includes(p.id);
                    const currentQty = getSearchItemQuantity(p);
                    const catName = categoryMap.get(p.categoryId) || 'Brindes';

                    return (
                      <div
                        key={p.id}
                        className={`p-3 sm:p-4 flex flex-col sm:flex-row items-center gap-3 sm:gap-4 hover:bg-slate-50 transition-colors ${
                          isAlreadyAdded ? 'bg-emerald-50/20' : ''
                        }`}
                      >
                        {/* Photo */}
                        <div
                          className="relative w-18 h-18 sm:w-20 sm:h-20 rounded-xl overflow-hidden bg-slate-100 shrink-0 border border-slate-200 cursor-pointer group"
                          onClick={() =>
                            setPreviewModalImage({ url: p.images[0], title: p.name, product: p })
                          }
                          title="Clique para ver foto ampliada"
                        >
                          <img
                            src={p.images[0]}
                            alt={p.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                            loading="lazy"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white">
                            <Eye className="w-4 h-4" />
                          </div>
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0 text-center sm:text-left">
                          <div className="flex items-center justify-center sm:justify-start gap-2 text-[10px] text-slate-400 font-mono">
                            <span>{p.code}</span>
                            <span>•</span>
                            <span>{catName}</span>
                            <span>•</span>
                            <span>Mín. {p.min_order_qty || 50} un</span>
                            {isAlreadyAdded && (
                              <span className="text-emerald-700 font-bold bg-emerald-100 px-1.5 py-0.2 rounded">
                                No Orçamento
                              </span>
                            )}
                          </div>

                          <h5 className="text-xs sm:text-sm font-extrabold text-slate-900 truncate mt-0.5">
                            {p.name}
                          </h5>

                          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-1 pt-1">
                            {p.details.customTechniques.map((t) => (
                              <span
                                key={t}
                                className="text-[9px] font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-600"
                              >
                                {t}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Price & Quantity & Action */}
                        <div className="flex flex-col sm:flex-row items-center gap-3 shrink-0">
                          <div className="text-center sm:text-right">
                            <div className="text-[10px] text-slate-400">A partir de</div>
                            <div className="text-sm font-black text-slate-900 font-heading">
                              R$ {price.toFixed(2)}
                              <span className="text-[10px] font-normal text-slate-500"> /un</span>
                            </div>
                          </div>

                          {/* Quantity Stepper */}
                          <div className="flex items-center border border-slate-200 rounded-lg bg-slate-50 overflow-hidden">
                            <button
                              type="button"
                              onClick={() => updateSearchItemQuantity(p, -10)}
                              className="px-2 py-1 text-slate-600 hover:bg-slate-200 text-xs font-bold cursor-pointer"
                            >
                              -
                            </button>
                            <input
                              type="number"
                              min={p.min_order_qty || 1}
                              value={currentQty}
                              onChange={(e) =>
                                updateSearchItemQuantity(p, parseInt(e.target.value) || 1, true)
                              }
                              className="w-14 px-1 py-1 text-xs text-center font-extrabold text-slate-900 bg-white outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => updateSearchItemQuantity(p, 10)}
                              className="px-2 py-1 text-slate-600 hover:bg-slate-200 text-xs font-bold cursor-pointer"
                            >
                              +
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleAddItemFromProduct(p, currentQty)}
                            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs ${
                              isAlreadyAdded
                                ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                                : 'bg-slate-900 hover:bg-[#00AEEF] text-white'
                            }`}
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>{isAlreadyAdded ? `+ Adicionar (${currentQty})` : `Adicionar`}</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Full Catalog Button */}
              <div className="pt-3 flex flex-col sm:flex-row items-center justify-between gap-2 border-t border-slate-200/60">
                <span className="text-[11px] text-slate-500">
                  Quer ver o catálogo visual completo com mais filtros e fotos?
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setPickerMode('add');
                    setIsPickerModalOpen(true);
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-800 text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer"
                >
                  <Package className="w-3.5 h-3.5 text-[#00AEEF]" />
                  <span>Abrir Catálogo Completo em Tela Cheia</span>
                </button>
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* CURRENT ITEMS ALREADY ON THE QUOTE (LISTA COM FOTOS GRANDES E DETALHES)   */}
          {/* ========================================================================= */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-500 font-bold px-1">
              <span>Itens Selecionados para Cotação ({items.length}):</span>
              <span className="text-[11px] text-slate-400 font-normal">
                Total de unidades: <strong>{totalUnits} un</strong>
              </span>
            </div>

            {items.map((item, index) => {
              const currentProd = products.find((p) => p.id === item.productId) || products[0];
              const unitPrice = item.unit_price_estimated || (currentProd ? currentProd.promo_price || currentProd.base_price : 0);
              const subtotalItem = Number((unitPrice * item.quantity).toFixed(2));

              return (
                <div
                  key={item.id}
                  className="p-4 sm:p-5 rounded-2xl border border-slate-200 bg-white hover:border-slate-300 shadow-2xs transition-all space-y-3.5"
                >
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    {/* Left: Product Picture + Name + Code */}
                    <div className="flex items-center gap-3.5 flex-1 min-w-0">
                      {/* Product Photo with click-to-enlarge */}
                      <div
                        className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden bg-slate-100 border border-slate-200 shrink-0 cursor-pointer group shadow-2xs"
                        onClick={() =>
                          setPreviewModalImage({
                            url: item.productImage || currentProd?.images[0] || '',
                            title: item.productName,
                          })
                        }
                        title="Clique para ver foto ampliada"
                      >
                        <img
                          src={item.productImage || currentProd?.images[0]}
                          alt={item.productName}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white">
                          <Eye className="w-4 h-4" />
                        </div>
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                            ITEM #{index + 1}
                          </span>
                          <span className="text-[10px] font-mono text-slate-400">
                            {item.productSku}
                          </span>
                        </div>

                        <h4 className="text-sm font-extrabold text-slate-900 truncate mt-0.5">
                          {item.productName}
                        </h4>

                        <div className="flex items-center gap-2 mt-1">
                          <button
                            type="button"
                            onClick={() => {
                              setPickerMode('replace');
                              setReplacingItemIndex(index);
                              setIsPickerModalOpen(true);
                            }}
                            className="text-[11px] font-bold text-[#00AEEF] hover:text-sky-700 hover:underline flex items-center gap-1 cursor-pointer"
                            title="Trocar este produto por outro do catálogo com fotos"
                          >
                            <Layers className="w-3 h-3" />
                            <span>Trocar Produto (com fotos)</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Right: Estimated reference value */}
                    <div className="text-left sm:text-right shrink-0">
                      <div className="text-[10px] text-slate-400 uppercase font-bold">
                        Valor Unit. Estimado:
                      </div>
                      <div className="text-xs font-bold text-slate-600">
                        R$ {unitPrice.toFixed(2)} / un
                      </div>
                      <div className="text-sm font-black text-slate-900 font-heading mt-0.5">
                        Subtotal: R$ {subtotalItem.toFixed(2)}
                      </div>
                    </div>
                  </div>

                  {/* Quantity and Custom Technique Controls */}
                  <div className="pt-3 border-t border-slate-100 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                    {/* Quantity with Steppers & Quick Chips */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <label className="text-[10px] font-bold uppercase text-slate-500">
                        Quantidade:
                      </label>
                      <div className="flex items-center border border-slate-200 rounded-xl bg-slate-50 overflow-hidden">
                        <button
                          type="button"
                          onClick={() => handleItemQtyChange(index, item.quantity - 10)}
                          className="px-2.5 py-1.5 text-slate-600 hover:bg-slate-200 text-xs font-bold cursor-pointer"
                          title="Diminuir 10 unidades"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => handleItemQtyChange(index, parseInt(e.target.value) || 1)}
                          className="w-16 px-1 py-1 text-xs text-center font-extrabold text-slate-900 bg-white outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => handleItemQtyChange(index, item.quantity + 10)}
                          className="px-2.5 py-1.5 text-slate-600 hover:bg-slate-200 text-xs font-bold cursor-pointer"
                          title="Adicionar 10 unidades"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      {/* Quick preset chips */}
                      <div className="flex items-center gap-1">
                        {[+25, +50, +100].map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => handleItemQtyChange(index, item.quantity + preset)}
                            className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-sky-50 hover:text-sky-700 text-slate-600 text-[10px] font-bold cursor-pointer transition-colors"
                          >
                            +{preset}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Technique Selector */}
                    <div className="flex items-center gap-2 flex-1 max-w-xs">
                      <label className="text-[10px] font-bold uppercase text-slate-500 shrink-0">
                        Gravação:
                      </label>
                      <select
                        value={item.customTechnique || ''}
                        onChange={(e) => handleItemTechniqueChange(index, e.target.value)}
                        className="w-full px-3 py-1.5 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-[#00AEEF] cursor-pointer"
                      >
                        {currentProd?.details.customTechniques.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Item Actions: Duplicate & Remove */}
                    <div className="flex items-center gap-1 self-end md:self-center">
                      <button
                        type="button"
                        onClick={() => handleDuplicateItem(index)}
                        className="p-2 rounded-xl text-slate-400 hover:text-sky-600 hover:bg-sky-50 transition-colors cursor-pointer"
                        title="Duplicar este item no orçamento"
                      >
                        <Copy className="w-4 h-4" />
                      </button>

                      {items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(item.id)}
                          className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                          title="Remover este item do orçamento"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Quote Totals Summary Card */}
          <div className="p-4 sm:p-5 rounded-3xl bg-slate-900 text-white flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 shadow-md">
            <div>
              <span className="text-[10px] font-extrabold uppercase text-[#00AEEF] tracking-wider block">
                Estimativa Prévia do Orçamento
              </span>
              <div className="text-xl sm:text-2xl font-black font-heading text-white mt-0.5">
                R$ {totalEstimated.toFixed(2)}
              </div>
              <span className="text-[11px] text-slate-400 block mt-0.5">
                Total de <strong>{totalUnits} unidades</strong> em <strong>{items.length} produto(s)</strong>.
              </span>
            </div>

            <div className="text-xs text-slate-400 max-w-sm sm:text-right border-t sm:border-t-0 sm:border-l border-slate-800 pt-3 sm:pt-0 sm:pl-4">
              <p className="text-[11px] leading-relaxed">
                *Valores de referência para simulação. Descontos progressivos por volume e frete serão calculados por nossa equipe na proposta oficial.
              </p>
            </div>
          </div>
        </div>

        {/* Section 3: Artwork & Deadline */}
        <div className="space-y-4">
          <h3 className="font-heading text-lg font-bold text-slate-900 uppercase flex items-center gap-2 border-b border-slate-100 pb-2">
            <Sparkles className="w-4 h-4 text-[#FFDD00]" />
            3. Logomarca e Prazo Desejado
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <ArtworkUpload
                onArtworkUploaded={setUploadedArtwork}
                label="Envie seu Logotipo / Manual da Marca (Opcional)"
                helperText="Formatos: PDF, AI, CDR, PNG ou JPG. Usaremos para montar a simulação virtual 3D."
              />
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Data Limite Desejada para Entrega (Opcional)
                </label>
                <div className="relative">
                  <input
                    type="date"
                    value={deliveryDeadline}
                    onChange={(e) => setDeliveryDeadline(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#00AEEF] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Observações Adicionais ou Detalhes Especiais
                </label>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ex: Gravação a laser em ambos os lados, embalagem de presente individual, faturamento para 28 dias..."
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#00AEEF] focus:outline-none resize-none"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Submit action */}
        <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-xs text-slate-500 flex items-center gap-1.5">
            <Info className="w-4 h-4 text-[#00AEEF]" />
            <span>Resposta formal por e-mail e WhatsApp em até 2 horas úteis.</span>
          </div>

          <button
            type="submit"
            className="w-full sm:w-auto px-8 py-3.5 bg-gradient-to-r from-[#00AEEF] to-[#E6007E] hover:opacity-95 text-white font-extrabold text-sm uppercase rounded-2xl transition-all shadow-lg hover:shadow-pink-500/25 flex items-center justify-center gap-2 cursor-pointer"
            id="btn-submit-quote"
          >
            <Send className="w-4 h-4" />
            <span>Enviar Solicitação de Orçamento</span>
          </button>
        </div>
      </form>

      {/* ========================================================================= */}
      {/* MODAL CATALOG PICKER (WITH SEARCH, PHOTOS, AND FILTERS)                   */}
      {/* ========================================================================= */}
      <QuoteProductPickerModal
        isOpen={isPickerModalOpen}
        onClose={() => {
          setIsPickerModalOpen(false);
          setReplacingItemIndex(null);
        }}
        products={products}
        categories={allCategories}
        mode={pickerMode}
        currentProductId={
          replacingItemIndex !== null ? items[replacingItemIndex]?.productId : undefined
        }
        alreadyAddedProductIds={alreadyAddedProductIds}
        onSelectProduct={(chosenProduct, quantity, technique) => {
          if (pickerMode === 'replace' && replacingItemIndex !== null) {
            handleReplaceItemProduct(replacingItemIndex, chosenProduct);
          } else {
            handleAddItemFromProduct(chosenProduct, quantity, technique);
          }
        }}
      />

      {/* ========================================================================= */}
      {/* MODAL ZOOM PHOTO PREVIEW LIGHTBOX (COM DETALHES E ADIÇÃO DIRETA)          */}
      {/* ========================================================================= */}
      {previewModalImage && (
        <div
          className="fixed inset-0 z-60 bg-black/85 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setPreviewModalImage(null)}
        >
          <div
            className="bg-white rounded-3xl overflow-hidden max-w-lg w-full shadow-2xl p-5 text-left space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="min-w-0 pr-3">
                <span className="text-[10px] font-extrabold uppercase text-[#00AEEF] tracking-wider block">
                  Foto Ampliada do Brinde
                </span>
                <h4 className="text-sm font-extrabold text-slate-900 truncate">
                  {previewModalImage.title}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setPreviewModalImage(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
                title="Fechar (Esc)"
              >
                ✕
              </button>
            </div>

            {/* Enlarged Image Display */}
            <div className="relative aspect-square max-h-[50vh] w-full rounded-2xl overflow-hidden bg-slate-100 border border-slate-200/80">
              <img
                src={previewModalImage.url}
                alt={previewModalImage.title}
                className="w-full h-full object-contain mx-auto"
              />
            </div>

            {/* Optional Thumbnail Gallery if product has multiple images */}
            {previewModalImage.product && previewModalImage.product.images.length > 1 && (
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {previewModalImage.product.images.map((imgUrl, imgIdx) => (
                  <button
                    key={`thumb-${imgIdx}`}
                    type="button"
                    onClick={() =>
                      setPreviewModalImage((prev) =>
                        prev ? { ...prev, url: imgUrl } : null
                      )
                    }
                    className={`w-14 h-14 rounded-xl overflow-hidden border-2 transition-all shrink-0 cursor-pointer ${
                      previewModalImage.url === imgUrl
                        ? 'border-[#00AEEF] ring-2 ring-sky-200 scale-105'
                        : 'border-slate-200 hover:border-slate-400'
                    }`}
                  >
                    <img
                      src={imgUrl}
                      alt={`Foto ${imgIdx + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}

            {/* Product Meta & Direct Add Button */}
            {previewModalImage.product && (
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="text-[10px] text-slate-400 font-mono">
                    Código: <strong>{previewModalImage.product.code}</strong> • Mín.{' '}
                    {previewModalImage.product.min_order_qty || 50} un
                  </div>
                  <div className="text-sm font-black text-slate-900 font-heading mt-0.5">
                    R${' '}
                    {(
                      previewModalImage.product.promo_price ||
                      previewModalImage.product.base_price
                    ).toFixed(2)}{' '}
                    <span className="text-xs font-normal text-slate-500">/un</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (previewModalImage.product) {
                      handleAddItemFromProduct(previewModalImage.product);
                      setPreviewModalImage(null);
                    }
                  }}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#00AEEF] to-[#E6007E] hover:opacity-95 text-white font-extrabold text-xs uppercase shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4 stroke-[2.5]" />
                  <span>Adicionar ao Orçamento</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
