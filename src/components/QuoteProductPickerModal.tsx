import React, { useState, useMemo, useEffect } from 'react';
import { Product, Category, UserProfile } from '../types';
import { StorageService } from '../services/storage';
import {
  Search,
  X,
  Plus,
  Check,
  Tag,
  Sparkles,
  Eye,
  SlidersHorizontal,
  Package,
  Layers,
  ArrowRight,
} from 'lucide-react';

interface QuoteProductPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  categories?: Category[];
  currentUser?: UserProfile;
  mode?: 'add' | 'replace';
  currentProductId?: string;
  alreadyAddedProductIds?: string[];
  onSelectProduct: (product: Product, quantity?: number, technique?: string) => void;
}

export const QuoteProductPickerModal: React.FC<QuoteProductPickerModalProps> = ({
  isOpen,
  onClose,
  products,
  categories = [],
  currentUser,
  mode = 'add',
  currentProductId,
  alreadyAddedProductIds = [],
  onSelectProduct,
}) => {
  const canViewPrices = StorageService.canViewPrices(currentUser);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'popular' | 'price_asc' | 'price_desc' | 'name'>('popular');
  const [previewImage, setPreviewImage] = useState<{ url: string; title: string } | null>(null);
  const [justAddedId, setJustAddedId] = useState<string | null>(null);

  // Reset search when opened
  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      setSelectedCategory('all');
      setJustAddedId(null);
    }
  }, [isOpen]);

  // Keyboard close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (previewImage) {
          setPreviewImage(null);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, previewImage, onClose]);

  // Category map for fast lookup
  const categoryMap = useMemo(() => {
    const map = new Map<string, string>();
    categories.forEach((c) => map.set(c.id, c.name));
    return map;
  }, [categories]);

  // Active products filter
  const activeProducts = useMemo(() => {
    return products.filter((p) => p.is_active);
  }, [products]);

  // Filtered & Sorted products
  const filteredProducts = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    const list = activeProducts.filter((p) => {
      // Category check
      if (selectedCategory !== 'all') {
        const matchesCat =
          p.categoryId === selectedCategory || (p as any).category_id === selectedCategory;
        if (!matchesCat) return false;
      }

      // Text search check
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
      if (canViewPrices && sortBy === 'price_asc') {
        const priceA = a.promo_price || a.base_price;
        const priceB = b.promo_price || b.base_price;
        return priceA - priceB;
      }
      if (canViewPrices && sortBy === 'price_desc') {
        const priceA = a.promo_price || a.base_price;
        const priceB = b.promo_price || b.base_price;
        return priceB - priceA;
      }
      if (sortBy === 'name') {
        return a.name.localeCompare(b.name);
      }
      // 'popular'
      return (b.is_featured ? 1 : 0) - (a.is_featured ? 1 : 0);
    });
  }, [activeProducts, selectedCategory, searchQuery, sortBy, categoryMap, canViewPrices]);

  if (!isOpen) return null;

  const handlePickProduct = (product: Product) => {
    const defaultQty = product.min_order_qty || 50;
    const defaultTech = product.details?.customTechniques?.[0] || 'Gravação a Laser';
    onSelectProduct(product, defaultQty, defaultTech);

    setJustAddedId(product.id);
    setTimeout(() => {
      setJustAddedId(null);
    }, 1500);

    if (mode === 'replace') {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-5xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[92vh] my-auto">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#00AEEF] to-[#E6007E] flex items-center justify-center text-white shadow-md">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-extrabold uppercase text-[#00AEEF] tracking-wider">
                {mode === 'replace' ? 'Alterar Produto do Item' : 'Catálogo Visual de Brindes'}
              </span>
              <h3 className="text-base sm:text-lg font-black uppercase font-heading flex items-center gap-2">
                <span>
                  {mode === 'replace'
                    ? 'Selecione o Novo Produto'
                    : 'Adicionar Produtos com Foto ao Orçamento'}
                </span>
                <span className="text-xs font-mono font-normal text-slate-400">
                  ({filteredProducts.length} disponíveis)
                </span>
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            title="Fechar (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search & Category Filter Bar */}
        <div className="p-3 sm:p-4 bg-slate-50 border-b border-slate-200 space-y-3 shrink-0">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Pesquise por nome (Caneca, Mochila, Garrafa...), código SKU ou gravação..."
                className="w-full pl-10 pr-9 py-2.5 text-xs sm:text-sm bg-white border border-slate-200 rounded-2xl outline-none focus:border-[#00AEEF] focus:ring-2 focus:ring-sky-100 font-medium text-slate-800 placeholder:text-slate-400 transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs p-1"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Sort selector */}
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-[11px] font-bold text-slate-500 hidden sm:inline">Ordenar:</span>
              <select
                value={!canViewPrices && (sortBy === 'price_asc' || sortBy === 'price_desc') ? 'popular' : sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl text-slate-700 font-bold outline-none cursor-pointer"
              >
                <option value="popular">Destaques / Populares</option>
                {canViewPrices && <option value="price_asc">Menor Preço</option>}
                {canViewPrices && <option value="price_desc">Maior Preço</option>}
                <option value="name">Nome (A-Z)</option>
              </select>
            </div>
          </div>

          {/* Category Chips Bar */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-0.5 text-xs">
            <button
              type="button"
              onClick={() => setSelectedCategory('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                selectedCategory === 'all'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              Todos ({activeProducts.length})
            </button>

            {categories.map((cat) => {
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
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <span>{cat.name}</span>
                  <span className="text-[10px] opacity-75">({count})</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Products Grid Content Area with visible scrollbar */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 bg-slate-100/70 pdv-scroll">
          {filteredProducts.length === 0 ? (
            <div className="py-16 text-center bg-white rounded-3xl border border-slate-200 space-y-3 max-w-md mx-auto my-6 p-8">
              <Search className="w-12 h-12 text-slate-300 mx-auto stroke-1" />
              <h4 className="text-base font-bold text-slate-800">Nenhum produto encontrado</h4>
              <p className="text-xs text-slate-500">
                Não encontramos produtos com o termo "{searchQuery}". Tente buscar por termos mais
                gerais como "copo", "caneca", "mochila" ou limpe a busca.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('all');
                }}
                className="px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-xl hover:bg-slate-800"
              >
                Limpar Busca & Ver Todos
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
              {filteredProducts.map((p) => {
                const price = p.promo_price || p.base_price;
                const isCurrent = p.id === currentProductId;
                const isAlreadyInQuote = alreadyAddedProductIds.includes(p.id);
                const wasJustAdded = justAddedId === p.id;
                const categoryName = categoryMap.get(p.categoryId) || 'Brindes';

                return (
                  <div
                    key={p.id}
                    className={`bg-white rounded-2xl border p-3 flex flex-col justify-between transition-all hover:shadow-md hover:border-[#00AEEF] relative group ${
                      isCurrent
                        ? 'border-[#00AEEF] ring-2 ring-sky-200 bg-sky-50/20'
                        : isAlreadyInQuote
                        ? 'border-emerald-300 bg-emerald-50/10'
                        : 'border-slate-200'
                    }`}
                  >
                    <div>
                      {/* Product Photo with Hover Preview */}
                      <div className="relative aspect-square w-full rounded-xl overflow-hidden bg-slate-100 mb-2.5">
                        <img
                          src={p.images[0]}
                          alt={p.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          loading="lazy"
                        />

                        {/* Zoom button on image */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPreviewImage({ url: p.images[0], title: p.name });
                          }}
                          className="absolute bottom-2 right-2 p-1.5 rounded-lg bg-black/60 hover:bg-black/80 text-white transition-opacity opacity-0 group-hover:opacity-100 shadow-md cursor-pointer"
                          title="Ampliar foto do produto"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>

                        {/* Badges on top */}
                        <div className="absolute top-2 left-2 flex flex-col gap-1 items-start">
                          {p.badge && (
                            <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-md bg-[#E6007E] text-white shadow-xs">
                              {p.badge}
                            </span>
                          )}
                          {isAlreadyInQuote && (
                            <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-md bg-emerald-600 text-white shadow-xs flex items-center gap-1">
                              <Check className="w-2.5 h-2.5" />
                              <span>No Orçamento</span>
                            </span>
                          )}
                        </div>

                        {/* Stock pill */}
                        <span className="absolute top-2 right-2 text-[9px] font-bold px-1.5 py-0.5 rounded-md uppercase bg-white/90 text-slate-700 shadow-xs backdrop-blur-2xs">
                          Mín: {p.min_order_qty || 50} un
                        </span>
                      </div>

                      {/* Product Information */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                          <span className="truncate">{p.code}</span>
                          <span className="text-slate-500 font-semibold truncate max-w-[100px]">
                            {categoryName}
                          </span>
                        </div>

                        <h4
                          className="text-xs font-bold text-slate-900 line-clamp-2 leading-snug group-hover:text-[#00AEEF] transition-colors"
                          title={p.name}
                        >
                          {p.name}
                        </h4>

                        {/* Techniques tags */}
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
                            {p.details.customTechniques.length > 2 && (
                              <span className="text-[9px] text-slate-400 font-mono">
                                +{p.details.customTechniques.length - 2}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Bottom: Price Reference & Action Button */}
                    <div className="pt-2.5 mt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                      <div>
                        {canViewPrices && p.show_price ? (
                          <>
                            <div className="text-[9px] uppercase font-bold text-slate-400">A partir de</div>
                            <div className="text-xs font-black text-slate-900 font-heading">
                              R$ {price.toFixed(2)}
                            </div>
                          </>
                        ) : !canViewPrices ? (
                          <div className="text-[10px] font-bold text-slate-500 leading-tight">
                            Entre para consultar
                          </div>
                        ) : (
                          <div className="text-[10px] font-bold text-amber-700">
                            Sob Orçamento
                          </div>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => handlePickProduct(p)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-extrabold uppercase transition-all flex items-center gap-1 cursor-pointer shadow-xs ${
                          wasJustAdded
                            ? 'bg-emerald-600 text-white scale-105'
                            : mode === 'replace'
                            ? isCurrent
                              ? 'bg-slate-200 text-slate-600 cursor-default'
                              : 'bg-slate-900 hover:bg-[#00AEEF] text-white'
                            : isAlreadyInQuote
                            ? 'bg-emerald-50 hover:bg-emerald-600 text-emerald-800 hover:text-white border border-emerald-300'
                            : 'bg-slate-900 hover:bg-[#00AEEF] text-white'
                        }`}
                      >
                        {wasJustAdded ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span>Adicionado!</span>
                          </>
                        ) : mode === 'replace' ? (
                          isCurrent ? (
                            <span>Atual</span>
                          ) : (
                            <span>Selecionar</span>
                          )
                        ) : isAlreadyInQuote ? (
                          <>
                            <Plus className="w-3.5 h-3.5" />
                            <span>+ 1 Item</span>
                          </>
                        ) : (
                          <>
                            <Plus className="w-3.5 h-3.5" />
                            <span>Adicionar</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3 sm:p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600 shrink-0">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-800">
              {alreadyAddedProductIds.length} {alreadyAddedProductIds.length === 1 ? 'produto já no orçamento' : 'produtos já no orçamento'}
            </span>
            <span className="text-slate-400">•</span>
            <span className="text-[11px] text-slate-500">
              Clique em "+ Adicionar" em quantos produtos desejar.
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition-colors cursor-pointer"
          >
            Concluir & Voltar ao Orçamento
          </button>
        </div>
      </div>

      {/* Lightbox Photo Preview Modal */}
      {previewImage && (
        <div
          className="fixed inset-0 z-60 bg-black/85 flex items-center justify-center p-4"
          onClick={() => setPreviewImage(null)}
        >
          <div
            className="bg-white rounded-3xl overflow-hidden max-w-lg w-full shadow-2xl p-4 text-center space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h5 className="text-xs font-bold text-slate-800 truncate pr-2">
                {previewImage.title}
              </h5>
              <button
                type="button"
                onClick={() => setPreviewImage(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-800"
              >
                ✕
              </button>
            </div>
            <img
              src={previewImage.url}
              alt={previewImage.title}
              className="w-full max-h-[70vh] object-contain rounded-2xl mx-auto"
            />
          </div>
        </div>
      )}
    </div>
  );
};
