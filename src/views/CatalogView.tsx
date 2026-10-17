import React, { useState, useMemo } from 'react';
import { Product, ProductVariant, Category, Subcategory } from '../types';
import { SEOHead } from '../components/SEOHead';
import {
  Search,
  Filter,
  SlidersHorizontal,
  Grid3X3,
  LayoutList,
  Sparkles,
  ArrowUpDown,
  Tag,
  Check,
  X,
  Share2,
  ChevronRight,
  Eye,
  FileSpreadsheet,
} from 'lucide-react';

interface CatalogViewProps {
  products: Product[];
  categories: Category[];
  subcategories: Subcategory[];
  selectedCategoryId?: string;
  onNavigate: (view: string, param?: string) => void;
  onOpenQuoteModal?: (initial?: { product: Product; variant?: ProductVariant; quantity: number }) => void;
}

export const CatalogView: React.FC<CatalogViewProps> = ({
  products,
  categories,
  subcategories,
  selectedCategoryId,
  onNavigate,
  onOpenQuoteModal,
}) => {
  const [selectedCat, setSelectedCat] = useState<string>(selectedCategoryId || 'all');
  const [selectedSubcat, setSelectedSubcat] = useState<string>('all');
  const [search, setSearch] = useState<string>('');
  const [priceFilter, setPriceFilter] = useState<'all' | 'priced' | 'quote'>('all');
  const [sortBy, setSortBy] = useState<'relevant' | 'price_asc' | 'price_desc' | 'name_asc'>('relevant');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showMobileFilters, setShowMobileFilters] = useState<boolean>(false);
  const [isCopiedToast, setIsCopiedToast] = useState<boolean>(false);

  // Filtered subcategories based on category
  const availableSubcategories = useMemo(() => {
    if (selectedCat === 'all') return [];
    return subcategories.filter((s) => s.categoryId === selectedCat);
  }, [selectedCat, subcategories]);

  // Filtered and sorted products
  const filteredProducts = useMemo(() => {
    let result = products.filter((p) => p.is_active);

    if (selectedCat !== 'all') {
      result = result.filter((p) => p.categoryId === selectedCat);
    }

    if (selectedSubcat !== 'all') {
      result = result.filter((p) => p.subcategoryId === selectedSubcat);
    }

    if (priceFilter === 'priced') {
      result = result.filter((p) => p.show_price);
    } else if (priceFilter === 'quote') {
      result = result.filter((p) => !p.show_price);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.code.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q)
      );
    }

    // Sort
    result.sort((a, b) => {
      if (sortBy === 'price_asc') {
        const pA = a.promo_price || a.base_price;
        const pB = b.promo_price || b.base_price;
        return pA - pB;
      }
      if (sortBy === 'price_desc') {
        const pA = a.promo_price || a.base_price;
        const pB = b.promo_price || b.base_price;
        return pB - pA;
      }
      if (sortBy === 'name_asc') {
        return a.name.localeCompare(b.name);
      }
      return 0; // relevance / default order
    });

    return result;
  }, [products, selectedCat, selectedSubcat, priceFilter, search, sortBy]);

  // Compute dynamic SEO for Catalog page
  const currentCategoryObj = useMemo(() => {
    if (selectedCat === 'all') return null;
    return categories.find((c) => c.id === selectedCat || c.slug === selectedCat) || null;
  }, [selectedCat, categories]);

  const seoTitle = currentCategoryObj
    ? `${currentCategoryObj.name} Personalizados | Catálogo de Brindes`
    : 'Catálogo Geral de Brindes Corporativos & Produtos Personalizados';

  const seoDescription = currentCategoryObj
    ? `Explore nossa seleção completa de ${currentCategoryObj.name.toLowerCase()} para empresas e eventos. ${currentCategoryObj.description || 'Personalização sob medida com preços de atacado e entrega rápida.'}`
    : 'Catálogo online de brindes personalizados, presentes corporativos, papelaria e materiais promocionais. Simule quantidades e faça orçamentos online.';

  const seoBreadcrumbs = [
    { name: 'Início', path: '/' },
    { name: 'Catálogo', path: '/catalogo' },
    ...(currentCategoryObj ? [{ name: currentCategoryObj.name, path: `/catalogo?categoria=${currentCategoryObj.slug}` }] : []),
  ];

  const handleResetFilters = () => {
    setSelectedCat('all');
    setSelectedSubcat('all');
    setPriceFilter('all');
    setSearch('');
    setSortBy('relevant');
  };

  const handleShareCatalog = () => {
    const url = window.location.href;
    if (navigator.share) {
      navigator.share({
        title: 'MB Personaliza - Catálogo Oficial',
        text: 'Confira nosso catálogo de brindes corporativos e produtos personalizados:',
        url,
      }).catch(() => {});
    } else {
      try {
        navigator.clipboard.writeText(url);
      } catch {}
      setIsCopiedToast(true);
      setTimeout(() => setIsCopiedToast(false), 3500);
    }
  };

  return (
    <div className="w-full min-w-0 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 relative">
      {/* Copied Link Toast */}
      {isCopiedToast && (
        <div className="fixed top-20 right-6 z-50 bg-slate-900 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-2xl border border-slate-700 flex items-center gap-2 animate-fadeIn">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>Link do catálogo copiado para a área de transferência!</span>
        </div>
      )}
      <SEOHead
        title={seoTitle}
        description={seoDescription}
        canonicalPath={currentCategoryObj ? `/catalogo?categoria=${currentCategoryObj.slug}` : '/catalogo'}
        breadcrumbs={seoBreadcrumbs}
        keywords={[
          currentCategoryObj ? `${currentCategoryObj.name.toLowerCase()} personalizados` : 'catálogo brindes',
          'brindes corporativos',
          'presentes promocionais',
          'gravação a laser',
          'MB Personaliza',
        ]}
      />

      {/* Header & Breadcrumb */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
            <button onClick={() => onNavigate('home')} className="hover:text-slate-900">
              Início
            </button>
            <span>/</span>
            <span className="font-semibold text-slate-900">Catálogo de Produtos</span>
          </div>
          <h1 className="text-3xl font-extrabold uppercase font-heading text-slate-900">
            Catálogo Geral de Brindes & Personalizados
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Exibindo {filteredProducts.length} itens prontos para personalização da sua marca
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start md:self-auto">
          <button
            onClick={() => onNavigate('quote')}
            className="px-4 py-2 bg-slate-900 hover:bg-[#E6007E] text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-[#FFDD00]" />
            <span>Cotação Express</span>
          </button>

          <button
            onClick={handleShareCatalog}
            className="px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 transition-all flex items-center gap-1.5"
            title="Compartilhar catálogo"
          >
            <Share2 className="w-4 h-4 text-slate-500" />
            <span className="hidden sm:inline">Compartilhar</span>
          </button>
        </div>
      </div>

      {/* Category Pills Bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        <button
          onClick={() => {
            setSelectedCat('all');
            setSelectedSubcat('all');
          }}
          className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
            selectedCat === 'all'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          Todos os Departamentos ({products.length})
        </button>

        {categories.map((c) => {
          const isSelected = selectedCat === c.id;
          const count = products.filter((p) => p.categoryId === c.id).length;
          return (
            <button
              key={c.id}
              onClick={() => {
                setSelectedCat(c.id);
                setSelectedSubcat('all');
              }}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                isSelected
                  ? 'bg-[#E6007E] text-white shadow-xs'
                  : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              {c.name} ({count})
            </button>
          );
        })}
      </div>

      {/* Subcategory Pills if any */}
      {availableSubcategories.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          <span className="text-slate-400 font-medium mr-1">Subcategorias:</span>
          <button
            onClick={() => setSelectedSubcat('all')}
            className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors ${
              selectedSubcat === 'all'
                ? 'bg-sky-100 text-[#00AEEF]'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Todas
          </button>
          {availableSubcategories.map((s) => (
            <button
              key={s.id}
              onClick={() => setSelectedSubcat(s.id)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                selectedSubcat === s.id
                  ? 'bg-sky-100 text-[#00AEEF]'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}

      {/* Filter and Sort Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs">
        {/* Search in catalog */}
        <div className="relative flex-1 max-w-md">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filtrar por nome, SKU, técnica..."
            className="w-full pl-9 pr-8 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#00AEEF] focus:outline-none"
          />
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filters Group */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Price availability filter */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-semibold text-slate-600">
            <button
              onClick={() => setPriceFilter('all')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                priceFilter === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'hover:text-slate-900'
              }`}
            >
              Todos
            </button>
            <button
              onClick={() => setPriceFilter('priced')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                priceFilter === 'priced' ? 'bg-white text-slate-900 shadow-xs' : 'hover:text-slate-900'
              }`}
            >
              Com Preço
            </button>
            <button
              onClick={() => setPriceFilter('quote')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                priceFilter === 'quote' ? 'bg-white text-amber-700 shadow-xs' : 'hover:text-slate-900'
              }`}
            >
              Sob Orçamento
            </button>
          </div>

          {/* Sort Select */}
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={sortBy}
              onChange={(e: any) => setSortBy(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-semibold focus:outline-none focus:border-[#00AEEF]"
            >
              <option value="relevant">Mais Relevantes</option>
              <option value="price_asc">Menor Preço</option>
              <option value="price_desc">Maior Preço</option>
              <option value="name_asc">Nome (A - Z)</option>
            </select>
          </div>

          {/* View mode toggle */}
          <div className="hidden sm:flex items-center bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg transition-all ${
                viewMode === 'grid' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'
              }`}
              title="Visualização em Grade"
            >
              <Grid3X3 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-lg transition-all ${
                viewMode === 'list' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'
              }`}
              title="Visualização em Lista"
            >
              <LayoutList className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Active filters notice if any */}
      {(selectedCat !== 'all' || selectedSubcat !== 'all' || priceFilter !== 'all' || search) && (
        <div className="flex items-center gap-2 text-xs flex-wrap">
          <span className="text-slate-500">Filtros ativos:</span>
          {selectedCat !== 'all' && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 text-slate-800 font-medium">
              Categoria: {categories.find((c) => c.id === selectedCat)?.name}
              <button onClick={() => setSelectedCat('all')}>
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          {priceFilter !== 'all' && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 text-slate-800 font-medium">
              Tipo: {priceFilter === 'priced' ? 'Com Preço' : 'Sob Orçamento'}
              <button onClick={() => setPriceFilter('all')}>
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          {search && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 text-slate-800 font-medium">
              Busca: "{search}"
              <button onClick={() => setSearch('')}>
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          <button
            onClick={handleResetFilters}
            className="text-[#E6007E] font-bold hover:underline ml-2"
          >
            Limpar todos
          </button>
        </div>
      )}

      {/* PRODUCTS DISPLAY */}
      {filteredProducts.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 space-y-3">
          <p className="text-slate-700 font-bold text-base">Nenhum produto encontrado com os filtros selecionados.</p>
          <p className="text-xs text-slate-500">Tente ajustar seus termos de busca ou selecionar outra categoria.</p>
          <button
            onClick={handleResetFilters}
            className="px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-xl hover:bg-[#E6007E] transition-colors"
          >
            Ver Todos os Produtos
          </button>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {filteredProducts.map((product) => {
            const minTier = product.price_tiers && product.price_tiers.length > 0
              ? product.price_tiers[product.price_tiers.length - 1]
              : null;

            return (
              <div
                key={product.id}
                className="bg-white rounded-2xl border border-slate-200 hover:border-slate-300 hover:shadow-lg transition-all duration-300 flex flex-col overflow-hidden group"
              >
                {/* Image */}
                <div
                  className="relative aspect-4/3 bg-slate-100 overflow-hidden cursor-pointer"
                  onClick={() => onNavigate('product-detail', product.id)}
                >
                  <img
                    src={product.images[0]}
                    alt={product.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  {product.badge && (
                    <span className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wide bg-slate-900 text-white shadow-xs">
                      {product.badge}
                    </span>
                  )}
                  {!product.show_price && (
                    <span className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-500 text-white shadow-xs">
                      Sob Orçamento
                    </span>
                  )}
                </div>

                {/* Details */}
                <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                  <div>
                    <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono mb-1">
                      <span>{product.code}</span>
                      <span>Mín. {product.min_order_qty} un</span>
                    </div>
                    <h3
                      onClick={() => onNavigate('product-detail', product.id)}
                      className="font-bold text-slate-900 text-sm line-clamp-2 hover:text-[#E6007E] cursor-pointer transition-colors"
                    >
                      {product.name}
                    </h3>
                  </div>

                  {/* Pricing and Action */}
                  <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2">
                    <div>
                      {product.show_price ? (
                        <>
                          <div className="text-[10px] text-slate-400">A partir de</div>
                          <div className="text-base font-black text-slate-900 font-heading">
                            R$ {minTier ? minTier.unit_price.toFixed(2) : (product.promo_price || product.base_price).toFixed(2)}
                            <span className="text-[10px] font-normal text-slate-500 font-sans"> /un</span>
                          </div>
                        </>
                      ) : (
                        <div className="text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded">
                          Cotação
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => {
                          if (onOpenQuoteModal) {
                            onOpenQuoteModal({ product, quantity: product.min_order_qty || 50 });
                          } else {
                            onNavigate('quote');
                          }
                        }}
                        className="px-2.5 py-1.5 bg-[#E6007E] hover:bg-[#d0006e] text-white text-xs font-bold rounded-xl transition-all shadow-2xs flex items-center gap-1 cursor-pointer"
                        title="Adicionar ao Orçamento com foto"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5 text-[#FFDD00]" />
                        <span>+ Orçamento</span>
                      </button>

                      <button
                        onClick={() => onNavigate('product-detail', product.id)}
                        className="px-2.5 py-1.5 bg-slate-900 hover:bg-[#00AEEF] text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
                      >
                        Detalhes
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* List View */
        <div className="divide-y divide-slate-200 bg-white rounded-2xl border border-slate-200 overflow-hidden">
          {filteredProducts.map((product) => (
            <div
              key={product.id}
              className="p-4 sm:p-5 flex flex-col sm:flex-row items-center gap-4 hover:bg-slate-50/70 transition-colors"
            >
              <img
                src={product.images[0]}
                alt={product.name}
                className="w-24 h-24 object-cover rounded-xl border border-slate-100 flex-shrink-0 cursor-pointer"
                onClick={() => onNavigate('product-detail', product.id)}
              />
              <div className="flex-1 min-w-0 space-y-1 text-center sm:text-left">
                <div className="flex items-center justify-center sm:justify-start gap-2 text-xs text-slate-400 font-mono">
                  <span>{product.code}</span>
                  <span>•</span>
                  <span>Pedido mínimo: {product.min_order_qty} un</span>
                  {product.badge && (
                    <span className="px-2 py-0.5 rounded bg-slate-900 text-white text-[10px] font-bold uppercase font-sans">
                      {product.badge}
                    </span>
                  )}
                </div>
                <h3
                  onClick={() => onNavigate('product-detail', product.id)}
                  className="font-bold text-base text-slate-900 hover:text-[#E6007E] cursor-pointer transition-colors"
                >
                  {product.name}
                </h3>
                <p className="text-xs text-slate-500 line-clamp-1">{product.description}</p>
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-1 pt-1">
                  {product.details.customTechniques.map((t, idx) => (
                    <span
                      key={idx}
                      className="text-[10px] font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-700"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex flex-col items-end gap-2 flex-shrink-0 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                {product.show_price ? (
                  <div className="text-right w-full sm:w-auto">
                    <div className="text-[11px] text-slate-400">Preço unitário padrão:</div>
                    <div className="text-xl font-black text-slate-900 font-heading">
                      R$ {(product.promo_price || product.base_price).toFixed(2)}
                    </div>
                  </div>
                ) : (
                  <div className="text-xs font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded">
                    Produto Sob Cotação
                  </div>
                )}
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    onClick={() => {
                      if (onOpenQuoteModal) {
                        onOpenQuoteModal({ product, quantity: product.min_order_qty || 50 });
                      } else {
                        onNavigate('quote');
                      }
                    }}
                    className="flex-1 sm:flex-none px-3.5 py-2 bg-[#E6007E] hover:bg-[#d0006e] text-white text-xs font-bold rounded-xl transition-all shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer"
                    title="Adicionar ao Orçamento"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-[#FFDD00]" />
                    <span>+ Orçamento</span>
                  </button>

                  <button
                    onClick={() => onNavigate('product-detail', product.id)}
                    className="flex-1 sm:flex-none px-4 py-2 bg-slate-900 hover:bg-[#00AEEF] text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
                  >
                    Ver Detalhes
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
