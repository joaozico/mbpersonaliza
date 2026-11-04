import React, { useState, useMemo } from 'react';
import { Product, ProductVariant, CartItem, UserProfile } from '../types';
import { StorageService } from '../services/storage';
import { ArtworkUpload } from '../components/ArtworkUpload';
import { SEOHead } from '../components/SEOHead';
import {
  Check,
  ShieldCheck,
  Truck,
  Sparkles,
  Share2,
  MessageSquare,
  Facebook,
  Link,
  Plus,
  Minus,
  ShoppingCart,
  Zap,
  Layers,
  FileSpreadsheet,
  AlertCircle,
  Clock,
  Printer,
  ChevronRight,
  Info,
} from 'lucide-react';

import { FavoriteButton } from '../components/FavoriteButton';

interface ProductDetailViewProps {
  productId: string;
  products: Product[];
  currentUser?: UserProfile;
  onNavigate: (view: string, param?: string) => void;
  onAddToCart: (item: CartItem, openDrawer?: boolean) => void;
  onOpenQuoteModal: (initialItem?: { product: Product; variant?: ProductVariant; quantity: number }) => void;
}

export const ProductDetailView: React.FC<ProductDetailViewProps> = ({
  productId,
  products,
  currentUser,
  onNavigate,
  onAddToCart,
  onOpenQuoteModal,
}) => {
  const product = (products || []).find((p) => p.id === productId || p.slug === productId) || products?.[0];

  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | undefined>(
    product?.variants && product.variants.length > 0 ? product.variants[0] : undefined
  );
  const [selectedTechnique, setSelectedTechnique] = useState<string>(
    product?.details?.customTechniques?.[0] || 'Gravação a Laser'
  );
  const [quantity, setQuantity] = useState<number>(product?.min_order_qty || 10);
  const [uploadedArtwork, setUploadedArtwork] = useState<{ name: string; url: string; size: string } | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Dynamic price calculation based on quantity and tiers
  const currentUnitPrice = useMemo(() => {
    if (!product) return 0;
    return StorageService.calculateUnitPrice(product, quantity);
  }, [product, quantity]);

  const baseStandardPrice = product?.promo_price || product?.base_price || 0;
  const totalPrice = currentUnitPrice * quantity;
  const standardTotal = baseStandardPrice * quantity;
  const savings = Math.max(0, standardTotal - totalPrice);

  // Related products
  const relatedProducts = (products || [])
    .filter((p) => product && p.id !== product.id && p.categoryId === product.categoryId)
    .slice(0, 3);

  if (!product) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center space-y-4">
        <h2 className="text-2xl font-bold text-slate-800 font-heading">Produto não encontrado</h2>
        <p className="text-slate-500 text-sm max-w-md mx-auto">
          O produto que você tentou acessar não foi localizado ou não está mais ativo em nossa base.
        </p>
        <button
          onClick={() => onNavigate('catalog')}
          className="px-6 py-2.5 bg-slate-900 hover:bg-[#E6007E] text-white font-bold rounded-xl text-sm transition-colors cursor-pointer"
        >
          Voltar ao Catálogo
        </button>
      </div>
    );
  }

  const handleQuantityChange = (newQty: number) => {
    setQuantity(Math.max(product.min_order_qty || 1, newQty));
  };

  const handleAddToCart = (openDrawer: boolean = true) => {
    const item: CartItem = {
      id: `cart-${product.id}-${selectedVariant?.id || 'default'}-${Date.now()}`,
      product,
      variant: selectedVariant,
      quantity,
      customTechnique: selectedTechnique,
      customArtworkName: uploadedArtwork?.name,
      calculatedUnitPrice: currentUnitPrice,
    };
    onAddToCart(item, openDrawer);
  };

  const handleBuyNow = () => {
    handleAddToCart(false);
    onNavigate('checkout');
  };

  const handleQuoteClick = () => {
    onOpenQuoteModal({
      product,
      variant: selectedVariant,
      quantity,
    });
  };

  // Share handlers
  const currentUrl = typeof window !== 'undefined' ? window.location.href : '';
  const shareText = `Confira ${product.name} na MB Personaliza: ${currentUrl}`;

  const handleShareWhatsApp = () => {
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`, '_blank');
  };

  const handleShareFacebook = () => {
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(currentUrl)}`, '_blank');
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(currentUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  return (
    <div className="w-full min-w-0 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-12" id="product-detail-page">
      <SEOHead
        title={`${product.name} Personalizado`}
        description={`${product.name}: ${product.short_description || product.description.substring(0, 155)}... Opções de personalização via ${(product.details?.customTechniques || []).join(', ')}. Quantidade mínima: ${product.min_order_qty} un.`}
        canonicalPath={`/produto/${product.slug || product.id}`}
        ogType="product"
        ogImage={product.images?.[0] || ''}
        twitterImage={product.images?.[0] || ''}
        keywords={[
          product.name.toLowerCase(),
          `${product.name.toLowerCase()} personalizado`,
          `${product.name.toLowerCase()} corporativo`,
          ...(product.details?.customTechniques || []).map((t) => t.toLowerCase()),
          'brindes personalizados sp',
          'MB Personaliza',
        ]}
        breadcrumbs={[
          { name: 'Início', path: '/' },
          { name: 'Catálogo', path: '/catalogo' },
          { name: product.name, path: `/produto/${product.slug || product.id}` },
        ]}
        productData={{
          name: product.name,
          description: product.description,
          image: product.images?.[0] || '',
          sku: product.code,
          price: currentUnitPrice,
          currency: 'BRL',
          inStock: product.is_active && product.stock_qty > 0,
          category: product.categoryId,
        }}
      />

      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-xs text-slate-500">
        <button onClick={() => onNavigate('home')} className="hover:text-slate-900">
          Início
        </button>
        <span>/</span>
        <button onClick={() => onNavigate('catalog')} className="hover:text-slate-900">
          Catálogo
        </button>
        <span>/</span>
        <span className="font-semibold text-slate-900 truncate max-w-xs">{product.name}</span>
      </nav>

      {/* Main Product Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* Left Column: Image Gallery */}
        <div className="lg:col-span-6 space-y-4">
          {/* Main big image */}
          <div className="relative aspect-4/3 rounded-2xl overflow-hidden bg-slate-100 border border-slate-200 shadow-xs">
            <img
              src={product.images[activeImageIndex] || product.images[0]}
              alt={product.name}
              className="w-full h-full object-cover transition-all duration-300"
            />
            {product.badge && (
              <span className="absolute top-4 left-4 px-3 py-1 rounded-full text-xs font-extrabold uppercase bg-slate-900 text-white shadow-md">
                {product.badge}
              </span>
            )}
            {!product.show_price && (
              <span className="absolute bottom-4 left-4 px-3 py-1 rounded-full text-xs font-bold bg-amber-500 text-white shadow-md">
                Produto Sob Cotação
              </span>
            )}
            <div className="absolute top-4 right-4 z-10">
              <FavoriteButton
                productId={product.id}
                productName={product.name}
                currentUser={currentUser}
                size="md"
              />
            </div>
          </div>

          {/* Thumbnails */}
          {product.images.length > 1 && (
            <div className="flex items-center gap-3 overflow-x-auto pb-1">
              {product.images.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => setActiveImageIndex(idx)}
                  className={`w-20 h-20 rounded-xl overflow-hidden border-2 transition-all flex-shrink-0 ${
                    activeImageIndex === idx
                      ? 'border-[#E6007E] ring-2 ring-pink-100'
                      : 'border-slate-200 hover:border-slate-300 opacity-70 hover:opacity-100'
                  }`}
                >
                  <img src={img} alt={`Thumb ${idx}`} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}

          {/* Share Box */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Share2 className="w-4 h-4 text-slate-500" /> Compartilhar este produto:
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={handleShareWhatsApp}
                className="p-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white transition-colors"
                title="Compartilhar no WhatsApp"
              >
                <MessageSquare className="w-4 h-4" />
              </button>
              <button
                onClick={handleShareFacebook}
                className="p-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors"
                title="Compartilhar no Facebook"
              >
                <Facebook className="w-4 h-4" />
              </button>
              <button
                onClick={handleCopyLink}
                className="px-3 py-2 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                title="Copiar Link"
              >
                <Link className="w-3.5 h-3.5" />
                <span>{copiedLink ? 'Copiado!' : 'Copiar'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Configuration & Purchase */}
        <div className="lg:col-span-6 space-y-6">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-400 font-mono mb-1.5">
              <span>SKU: {product.code}</span>
              <span>•</span>
              <span className="text-emerald-600 font-semibold flex items-center gap-1">
                <Check className="w-3.5 h-3.5" /> Em Estoque ({product.stock_qty} un disponíveis)
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 uppercase font-heading leading-tight">
              {product.name}
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 mt-2 leading-relaxed">
              {product.description}
            </p>
          </div>

          {/* PRICING & PRICE TIERS TABLE */}
          {product.show_price ? (
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4">
              <div className="flex items-end justify-between">
                <div>
                  <span className="text-xs text-slate-500 font-medium">Preço Unitário Aplicado:</span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-black text-slate-900 font-heading">
                      R$ {currentUnitPrice.toFixed(2)}
                    </span>
                    <span className="text-xs text-slate-500 font-normal">/unidade</span>
                    {product.promo_price && product.base_price > product.promo_price && (
                      <span className="text-xs text-slate-400 line-through">
                        R$ {product.base_price.toFixed(2)}
                      </span>
                    )}
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-xs text-slate-500">Valor Total ({quantity} un):</span>
                  <div className="text-xl font-extrabold text-[#E6007E] font-heading">
                    R$ {totalPrice.toFixed(2)}
                  </div>
                  {savings > 0 && (
                    <span className="text-[11px] text-emerald-700 font-bold bg-emerald-100 px-2 py-0.5 rounded">
                      Economia de R$ {savings.toFixed(2)}
                    </span>
                  )}
                </div>
              </div>

              {/* Price Tiers Matrix */}
              {product.price_tiers && product.price_tiers.length > 0 && (
                <div className="space-y-1.5 pt-2 border-t border-slate-200">
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-[#00AEEF]" />
                    Tabela de Preços por Quantidade
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                    {product.price_tiers.map((tier) => {
                      const isActiveTier =
                        quantity >= tier.min_qty &&
                        (tier.max_qty === undefined || quantity <= tier.max_qty);
                      return (
                        <div
                          key={tier.id}
                          onClick={() => handleQuantityChange(tier.min_qty)}
                          className={`p-2 rounded-xl border transition-all cursor-pointer ${
                            isActiveTier
                              ? 'bg-slate-900 text-white border-slate-900 shadow-md ring-2 ring-[#00AEEF]'
                              : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <div className={`text-[10px] font-bold ${isActiveTier ? 'text-slate-300' : 'text-slate-500'}`}>
                            {tier.max_qty && tier.max_qty < 9000
                              ? `${tier.min_qty} a ${tier.max_qty} un`
                              : `${tier.min_qty}+ un`}
                          </div>
                          <div className="font-extrabold text-sm font-heading mt-0.5">
                            R$ {tier.unit_price.toFixed(2)}
                          </div>
                          {tier.discount_pct && tier.discount_pct > 0 ? (
                            <span
                              className={`text-[9px] font-bold px-1.5 py-0.2 rounded mt-1 inline-block ${
                                isActiveTier ? 'bg-[#E6007E] text-white' : 'bg-emerald-50 text-emerald-700'
                              }`}
                            >
                              -{tier.discount_pct}% OFF
                            </span>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-amber-50/80 p-5 rounded-2xl border border-amber-200 space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center text-amber-700 flex-shrink-0">
                  <Info className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-amber-950 text-sm">Produto Sob Cotação Especial</h4>
                  <p className="text-xs text-amber-800 mt-1 leading-relaxed">
                    Este item exige cálculo técnico específico conforme quantidade, acabamento e tipo de personalização. Nossa equipe formula proposta formal com valores e prazos em instantes.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* VARIATIONS SELECTOR */}
          {product.variants && product.variants.length > 0 && (
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                Cor / Variação:
                {selectedVariant && <span className="ml-2 font-normal text-slate-600">{selectedVariant.name}</span>}
              </label>
              <div className="flex flex-wrap gap-2">
                {product.variants.map((v) => {
                  const isSelected = selectedVariant?.id === v.id;
                  return (
                    <button
                      key={v.id}
                      onClick={() => setSelectedVariant(v)}
                      className={`px-3 py-2 rounded-xl text-xs font-semibold border flex items-center gap-2 transition-all cursor-pointer ${
                        isSelected
                          ? 'border-slate-900 bg-slate-900 text-white shadow-xs'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                      }`}
                    >
                      {v.colorHex && (
                        <span
                          className="w-3.5 h-3.5 rounded-full border border-slate-300 shadow-xs"
                          style={{ backgroundColor: v.colorHex }}
                        />
                      )}
                      <span>{v.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* CUSTOMIZATION TECHNIQUE */}
          {product.details.customTechniques && product.details.customTechniques.length > 0 && (
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                Técnica de Gravação / Personalização:
              </label>
              <div className="flex flex-wrap gap-2">
                {product.details.customTechniques.map((tech) => {
                  const isSelected = selectedTechnique === tech;
                  return (
                    <button
                      key={tech}
                      onClick={() => setSelectedTechnique(tech)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                        isSelected
                          ? 'border-[#00AEEF] bg-sky-50 text-[#00AEEF] ring-1 ring-[#00AEEF]'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                      }`}
                    >
                      {tech}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ARTWORK UPLOAD SIMULATOR */}
          <div className="pt-2">
            <ArtworkUpload
              onArtworkUploaded={setUploadedArtwork}
              compact={true}
              helperText="Envie seu logo para receber a simulação 3D no layout antes da gravação."
            />
          </div>

          {/* QUANTITY AND ACTION BUTTONS */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center gap-4">
              {/* Quantity selector */}
              <div className="flex flex-col">
                <span className="text-[11px] font-bold text-slate-600 mb-1">Quantidade (Mín: {product.min_order_qty})</span>
                <div className="flex items-center border border-slate-300 rounded-xl bg-white overflow-hidden shadow-xs h-11">
                  <button
                    onClick={() => handleQuantityChange(quantity - 5)}
                    className="px-3 text-slate-600 hover:bg-slate-100 transition-colors h-full flex items-center justify-center cursor-pointer"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <input
                    type="number"
                    value={quantity}
                    onChange={(e) => handleQuantityChange(parseInt(e.target.value) || product.min_order_qty)}
                    className="w-16 text-center text-sm font-extrabold text-slate-900 border-x border-slate-200 h-full focus:outline-none"
                  />
                  <button
                    onClick={() => handleQuantityChange(quantity + 5)}
                    className="px-3 text-slate-600 hover:bg-slate-100 transition-colors h-full flex items-center justify-center cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex-1 flex gap-2 pt-5">
                {product.show_price ? (
                  <>
                    <button
                      onClick={handleAddToCart}
                      className="flex-1 py-3 bg-white hover:bg-slate-50 text-slate-900 font-bold rounded-xl border border-slate-300 hover:border-slate-400 text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-xs cursor-pointer"
                      id="btn-add-to-cart"
                    >
                      <ShoppingCart className="w-4 h-4" />
                      <span>Carrinho</span>
                    </button>
                    <button
                      onClick={handleBuyNow}
                      className="flex-1 py-3 bg-slate-900 hover:bg-[#E6007E] text-white font-bold rounded-xl text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer"
                      id="btn-buy-now"
                    >
                      <Zap className="w-4 h-4 text-[#FFDD00]" />
                      <span>Comprar Agora</span>
                    </button>
                  </>
                ) : (
                  <button
                    onClick={handleQuoteClick}
                    className="w-full py-3.5 bg-[#00AEEF] hover:bg-[#0098d1] text-white font-extrabold text-sm rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-sky-500/25 cursor-pointer"
                    id="btn-request-quote"
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    <span>Solicitar Orçamento Deste Item</span>
                  </button>
                )}
              </div>
            </div>

            {/* Direct quote link even for priced items */}
            {product.show_price && (
              <div className="text-center">
                <button
                  onClick={handleQuoteClick}
                  className="text-xs font-semibold text-slate-500 hover:text-[#00AEEF] underline cursor-pointer"
                >
                  Deseja uma cotação formal em PDF para aprovação na sua empresa? Clique aqui.
                </button>
              </div>
            )}
          </div>

          {/* Technical Specs Accordion / Card */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-2">
            <h4 className="font-bold text-slate-900 uppercase font-heading text-sm">Ficha Técnica & Dimensões</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-600">
              {product.details.materials && (
                <div>
                  <span className="font-semibold text-slate-800">Materiais:</span> {product.details.materials}
                </div>
              )}
              {product.details.dimensions && (
                <div>
                  <span className="font-semibold text-slate-800">Dimensões:</span> {product.details.dimensions}
                </div>
              )}
              {product.details.capacity && (
                <div>
                  <span className="font-semibold text-slate-800">Capacidade:</span> {product.details.capacity}
                </div>
              )}
              {product.details.printAreas && (
                <div>
                  <span className="font-semibold text-slate-800">Área de Gravação:</span> {product.details.printAreas}
                </div>
              )}
              {product.details.packaging && (
                <div>
                  <span className="font-semibold text-slate-800">Embalagem:</span> {product.details.packaging}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* RELATED PRODUCTS */}
      {relatedProducts.length > 0 && (
        <div className="pt-8 border-t border-slate-200">
          <h3 className="text-2xl font-extrabold uppercase font-heading text-slate-900 mb-6">
            Produtos Relacionados
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {relatedProducts.map((rel) => (
              <div
                key={rel.id}
                onClick={() => onNavigate('product-detail', rel.id)}
                className="p-4 bg-white rounded-2xl border border-slate-200 hover:border-slate-300 hover:shadow-md transition-all cursor-pointer group"
              >
                <div className="aspect-4/3 rounded-xl overflow-hidden bg-slate-100 mb-3">
                  <img
                    src={rel.images[0]}
                    alt={rel.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  />
                </div>
                <h4 className="font-bold text-xs text-slate-900 group-hover:text-[#E6007E] line-clamp-1">
                  {rel.name}
                </h4>
                <div className="mt-1 flex items-center justify-between text-xs">
                  {rel.show_price ? (
                    <span className="font-bold text-slate-900">
                      R$ {(rel.promo_price || rel.base_price).toFixed(2)}
                    </span>
                  ) : (
                    <span className="text-[11px] text-amber-600 font-semibold">Sob Orçamento</span>
                  )}
                  <span className="text-slate-400 font-mono text-[10px]">{rel.code}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
