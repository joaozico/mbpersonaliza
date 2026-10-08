import React, { useState, useEffect } from 'react';
import { Product, Category, SystemLayoutSettings } from '../types';
import { StorageService } from '../services/storage';
import { SEOHead } from '../components/SEOHead';
import { OffersBanner } from '../components/OffersBanner';
import {
  ArrowRight,
  Sparkles,
  Zap,
  ShieldCheck,
  Truck,
  CheckCircle,
  MessageSquare,
  FileSpreadsheet,
  Award,
  Layers,
  ChevronRight,
  Eye,
  ShoppingCart,
  Send,
} from 'lucide-react';

interface HomeViewProps {
  products: Product[];
  categories: Category[];
  onNavigate: (view: string, param?: string) => void;
  onQuickAddToCart?: (product: Product) => void;
}

export const HomeView: React.FC<HomeViewProps> = ({
  products,
  categories,
  onNavigate,
  onQuickAddToCart,
}) => {
  const [layout, setLayout] = useState<SystemLayoutSettings>(() => StorageService.getLayoutSettings());

  useEffect(() => {
    const handleLayoutUpdate = () => {
      setLayout(StorageService.getLayoutSettings());
    };
    window.addEventListener('mb_storage_updated', handleLayoutUpdate);
    window.addEventListener('mb_layout_updated', handleLayoutUpdate);
    return () => {
      window.removeEventListener('mb_storage_updated', handleLayoutUpdate);
      window.removeEventListener('mb_layout_updated', handleLayoutUpdate);
    };
  }, []);

  const featuredLimit = layout.featuredSection.limit || 6;
  const categoriesLimit = layout.categoriesSection.limit || 6;

  const featuredProducts = products
    .filter((p) => p.is_active && p.is_featured)
    .slice(0, featuredLimit);

  const displayCategories = categories.slice(0, categoriesLimit);

  // Sort blocks by order and only visible
  const visibleBlocks = [...layout.blocks]
    .filter((b) => b.isVisible)
    .sort((a, b) => a.order - b.order);

  // Filter other blocks so offers_banner is not duplicated in the map
  const contentBlocks = visibleBlocks.filter((b) => b.type !== 'offers_banner');

  const isBannerEnabled = layout.offersBanner?.enabled ?? true;

  return (
    <div className="w-full min-w-0 max-w-full pb-16 overflow-x-hidden">
      <SEOHead
        title="Brindes Personalizados, Presentes Corporativos & Comunicação Visual"
        description="Especialistas em brindes corporativos, presentes personalizados, papelaria e comunicação visual. Orçamentos rápidos, personalização a laser, silk e DTF com entrega para todo o Brasil."
        canonicalPath="/"
        keywords={[
          'brindes personalizados',
          'brindes corporativos sp',
          'presentes corporativos',
          'copos térmicos personalizados',
          'canecas personalizadas atacado',
          'brindes fim de ano empresas',
          'gravação a laser em brindes',
          'comunicação visual',
          'MB Personaliza',
        ]}
      />

      {/* ========================================================================= */}
      {/* 1. PRIMEIRA PARTE DA PÁGINA: BANNER DE OFERTAS (CARROSSEL DINÂMICO MB) */}
      {/* ========================================================================= */}
      {isBannerEnabled && (
        <section className="w-full pt-2 pb-2 sm:pt-4 sm:pb-3 bg-gradient-to-b from-slate-900/5 via-transparent to-transparent">
          <OffersBanner
            products={products}
            settings={layout.offersBanner}
            onNavigate={onNavigate}
            className=""
          />
        </section>
      )}

      {/* DEMAIS SEÇÕES DA HOME COM ESPAÇAMENTO RESPONSIVO E HARMONIOSO */}
      <div className="space-y-12 sm:space-y-16">
        {contentBlocks.map((block) => {
        // ==========================================
        // 1. HERO SECTION
        // ==========================================
        if (block.type === 'hero') {
          return (
            <section
              key={block.id}
              className="relative overflow-hidden bg-slate-950 text-white pt-12 pb-20 lg:py-24 border-b border-slate-800"
            >
              {/* Subtle geometric background glows */}
              <div className="absolute top-0 right-1/4 w-96 h-96 bg-[#00AEEF]/15 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-[#E6007E]/15 rounded-full blur-3xl pointer-events-none" />

              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
                  {/* Left Content */}
                  <div className="lg:col-span-7 space-y-6">
                    {layout.hero.badgeText && (
                      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-700 text-xs font-semibold">
                        <span className="w-2 h-2 rounded-full bg-[#E6007E]" />
                        <span className="text-[#FFDD00]">{layout.hero.badgeText}</span>
                      </div>
                    )}

                    <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black uppercase font-heading tracking-tight leading-none text-white">
                      {layout.hero.titleParts && layout.hero.titleParts.length > 0 ? (
                        layout.hero.titleParts.map((part, idx) => (
                          <React.Fragment key={part.id || idx}>
                            <span style={{ color: part.color || '#FFFFFF' }}>
                              {part.text}
                            </span>
                            {idx < (layout.hero.titleParts?.length || 0) - 1 ? ' ' : ''}
                          </React.Fragment>
                        ))
                      ) : (
                        <>
                          <span style={{ color: layout.hero.titlePart1Color || '#FFFFFF' }}>
                            {layout.hero.titlePart1}
                          </span>{' '}
                          <span
                            style={{
                              color:
                                layout.hero.titleHighlightColor ||
                                layout.colors.primary ||
                                '#E6007E',
                            }}
                          >
                            {layout.hero.titleHighlight}
                          </span>{' '}
                          <span style={{ color: layout.hero.titlePart2Color || '#FFFFFF' }}>
                            {layout.hero.titlePart2}
                          </span>
                        </>
                      )}
                    </h1>

                    <p className="text-base sm:text-lg text-slate-300 max-w-xl font-normal leading-relaxed">
                      {layout.hero.description}
                    </p>

                    {/* Action Buttons */}
                    <div className="flex flex-wrap items-center gap-3.5 pt-2">
                      {layout.hero.primaryCtaVisible && (
                        <button
                          onClick={() => onNavigate('catalog')}
                          style={{ backgroundColor: layout.colors.buttonPrimaryBg }}
                          className="px-6 py-3.5 hover:opacity-90 text-white font-bold rounded-xl text-sm transition-all shadow-lg hover:shadow-pink-500/25 flex items-center gap-2 group cursor-pointer"
                          id="btn-hero-catalog"
                        >
                          <span>{layout.hero.primaryCtaText}</span>
                          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                        </button>
                      )}

                      {layout.hero.secondaryCtaVisible && (
                        <button
                          onClick={() => onNavigate('quote')}
                          className="px-6 py-3.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-sm border border-slate-700 hover:border-slate-500 transition-all flex items-center gap-2 cursor-pointer"
                          id="btn-hero-quote"
                        >
                          <FileSpreadsheet className="w-4 h-4 text-[#FFDD00]" />
                          <span>{layout.hero.secondaryCtaText}</span>
                        </button>
                      )}

                      {layout.hero.tertiaryCtaVisible && (
                        <button
                          onClick={() => onNavigate('digital-catalog')}
                          className="px-4 py-3.5 bg-sky-950/60 hover:bg-sky-900/60 text-[#00AEEF] font-bold rounded-xl text-sm border border-sky-800/80 transition-all flex items-center gap-1.5 cursor-pointer"
                          title="Acessar catálogo diagramado pronto para envio"
                        >
                          <span>{layout.hero.tertiaryCtaText}</span>
                        </button>
                      )}
                    </div>

                    {/* Trust Badges */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-6 border-t border-slate-800/80 text-xs">
                      {layout.hero.trustBadges.map((badge, idx) => (
                        <div key={badge.id} className="flex items-center gap-2 text-slate-300">
                          {idx === 0 && <Zap className="w-4 h-4 text-[#FFDD00] flex-shrink-0" />}
                          {idx === 1 && <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />}
                          {idx === 2 && <Truck className="w-4 h-4 text-[#00AEEF] flex-shrink-0" />}
                          {idx === 3 && <Award className="w-4 h-4 text-[#E6007E] flex-shrink-0" />}
                          <div>
                            <span className="font-bold block text-white">{badge.title}</span>
                            <span className="text-[10px] text-slate-400 block">{badge.description}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Right Card Mockup / Showcase */}
                  <div className="lg:col-span-5 relative">
                    <div className="relative mx-auto max-w-md bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 rounded-2xl p-6 border border-slate-800 shadow-2xl">
                      {layout.hero.showcaseBadge && (
                        <div className="absolute -top-3 -right-3 bg-gradient-to-r from-[#E6007E] to-[#00AEEF] text-white text-[11px] font-extrabold px-3 py-1 rounded-full shadow-lg">
                          {layout.hero.showcaseBadge}
                        </div>
                      )}

                      <div className="relative rounded-xl overflow-hidden mb-4 aspect-4/3 bg-slate-800">
                        <img
                          src={layout.hero.showcaseImageUrl}
                          alt={layout.hero.showcaseTitle}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent flex items-end p-4">
                          <div>
                            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-white/20 text-white backdrop-blur-xs">
                              Linha Premium MB
                            </span>
                            <h3 className="text-lg font-bold text-white font-heading mt-1">
                              {layout.hero.showcaseTitle}
                            </h3>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center justify-between text-xs border-b border-slate-800 pb-3">
                          <span className="text-slate-400">Condição Comercial:</span>
                          <span className="text-lg font-extrabold text-emerald-400 font-heading">
                            {layout.hero.showcasePriceText}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-xs text-slate-400">
                          <span>Personalização inclusa:</span>
                          <span className="text-white font-medium">{layout.hero.showcaseDescription}</span>
                        </div>

                        <button
                          onClick={() => onNavigate('catalog')}
                          className="w-full py-2.5 bg-white text-slate-950 hover:bg-slate-100 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <span>Configurar e Simular Quantidade</span>
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          );
        }

        // ==========================================
        // 2. OFFERS BANNER CAROUSEL
        // ==========================================
        if (block.type === 'offers_banner') {
          const isFirst = visibleBlocks[0]?.id === block.id;
          return (
            <OffersBanner
              key={block.id}
              products={products}
              settings={layout.offersBanner}
              onNavigate={onNavigate}
              className={isFirst ? 'pt-4 sm:pt-6' : ''}
            />
          );
        }

        // ==========================================
        // 3. CATEGORIES GRID
        // ==========================================
        if (block.type === 'categories') {
          return (
            <section key={block.id} className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
                <div>
                  <div
                    className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider"
                    style={{ color: layout.colors.primary }}
                  >
                    <Layers className="w-3.5 h-3.5" />
                    Departamentos
                  </div>
                  <h2 className="text-3xl font-extrabold uppercase font-heading text-slate-900 mt-1">
                    {layout.categoriesSection.title}
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">{layout.categoriesSection.subtitle}</p>
                </div>
                <button
                  onClick={() => onNavigate('catalog')}
                  className="text-xs font-bold text-slate-700 hover:text-[#E6007E] flex items-center gap-1 group self-start sm:self-auto"
                >
                  <span>Ver todo o catálogo ({products.length} itens)</span>
                  <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {displayCategories.map((cat) => {
                  const count = products.filter((p) => p.categoryId === cat.id).length;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => onNavigate('catalog', cat.id)}
                      className="group p-4 bg-white hover:bg-slate-900 border border-slate-200 hover:border-slate-800 rounded-2xl text-left transition-all duration-300 shadow-xs hover:shadow-xl flex flex-col justify-between cursor-pointer"
                      id={`cat-card-${cat.slug}`}
                    >
                      <div className="w-full aspect-square rounded-xl overflow-hidden mb-3 bg-slate-100 relative">
                        <img
                          src={cat.image}
                          alt={cat.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        <div className="absolute inset-0 bg-slate-900/10 group-hover:bg-transparent transition-colors" />
                      </div>
                      <div>
                        <h3 className="font-heading font-bold text-sm text-slate-900 group-hover:text-white uppercase transition-colors line-clamp-1">
                          {cat.name}
                        </h3>
                        <p className="text-[11px] text-slate-500 group-hover:text-slate-400 mt-0.5">
                          {count} {count === 1 ? 'produto' : 'produtos'}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          );
        }

        // ==========================================
        // 3. FEATURED PRODUCTS
        // ==========================================
        if (block.type === 'featured_products') {
          return (
            <section key={block.id} className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
                <div>
                  <div
                    className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider"
                    style={{ color: layout.colors.secondary }}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Mais Procurados
                  </div>
                  <h2 className="text-3xl font-extrabold uppercase font-heading text-slate-900 mt-1">
                    {layout.featuredSection.title}
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">{layout.featuredSection.subtitle}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">Descontos progressivos por quantidade</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {featuredProducts.map((product) => {
                  const minTier =
                    product.price_tiers && product.price_tiers.length > 0
                      ? product.price_tiers[product.price_tiers.length - 1]
                      : null;

                  return (
                    <div
                      key={product.id}
                      className="bg-white rounded-2xl border border-slate-200 hover:border-slate-300 hover:shadow-lg transition-all duration-300 flex flex-col overflow-hidden group"
                    >
                      {/* Image & Badges */}
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
                          <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wide bg-slate-900 text-white shadow-xs">
                            {product.badge}
                          </span>
                        )}
                        {!product.show_price && (
                          <span className="absolute top-3 right-3 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500 text-white shadow-xs">
                            Sob Orçamento
                          </span>
                        )}
                      </div>

                      {/* Content */}
                      <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                        <div>
                          <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono mb-1">
                            <span>{product.code}</span>
                            <span>Mín. {product.min_order_qty} un</span>
                          </div>
                          <h3
                            onClick={() => onNavigate('product-detail', product.id)}
                            className="font-bold text-slate-900 text-base line-clamp-2 hover:text-[#E6007E] cursor-pointer transition-colors"
                          >
                            {product.name}
                          </h3>
                          <p className="text-xs text-slate-500 line-clamp-2 mt-1.5 leading-relaxed">
                            {product.description}
                          </p>
                        </div>

                        {/* Techniques Tags */}
                        <div className="flex flex-wrap gap-1">
                          {product.details.customTechniques.slice(0, 2).map((t, idx) => (
                            <span
                              key={idx}
                              className="text-[10px] font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-700"
                            >
                              {t}
                            </span>
                          ))}
                        </div>

                        {/* Pricing & Actions */}
                        <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                          <div>
                            {product.show_price ? (
                              <>
                                <div className="text-[11px] text-slate-400">A partir de</div>
                                <div
                                  className="text-lg font-black font-heading"
                                  style={{ color: layout.colors.priceColor }}
                                >
                                  R${' '}
                                  {minTier
                                    ? minTier.unit_price.toFixed(2)
                                    : (product.promo_price || product.base_price).toFixed(2)}
                                  <span className="text-xs font-normal text-slate-500 font-sans"> /un</span>
                                </div>
                              </>
                            ) : (
                              <div className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded">
                                Cotação personalizada
                              </div>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => onNavigate('product-detail', product.id)}
                              className="px-3 py-2 bg-slate-900 hover:bg-[#E6007E] text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
                            >
                              {product.show_price ? 'Ver Tabela' : 'Orçar'}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        }

        // ==========================================
        // 4. B2B PROMOTIONAL BANNER
        // ==========================================
        if (block.type === 'b2b_banner') {
          return (
            <section key={block.id} className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div
                className="rounded-3xl p-8 sm:p-12 text-white border border-slate-800 relative overflow-hidden shadow-2xl"
                style={{ backgroundColor: layout.colors.topBannerBg }}
              >
                <div className="absolute -right-10 -bottom-10 w-80 h-80 bg-[#FFDD00]/10 rounded-full blur-3xl pointer-events-none" />
                <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                  <div className="lg:col-span-8 space-y-4">
                    <span
                      className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border"
                      style={{
                        backgroundColor: `${layout.colors.primary}20`,
                        color: layout.colors.primary,
                        borderColor: `${layout.colors.primary}40`,
                      }}
                    >
                      {layout.b2bBanner.badge}
                    </span>
                    <h2 className="text-3xl sm:text-4xl font-black font-heading uppercase text-white leading-tight">
                      {layout.b2bBanner.title}
                    </h2>
                    <p className="text-slate-300 text-sm sm:text-base max-w-2xl leading-relaxed">
                      {layout.b2bBanner.description}
                    </p>
                    <div className="flex flex-wrap gap-4 pt-2 text-xs text-slate-300">
                      {layout.b2bBanner.benefits.map((benefit, bIdx) => (
                        <span key={bIdx} className="flex items-center gap-1.5">
                          <CheckCircle className="w-4 h-4 text-emerald-400" /> {benefit}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="lg:col-span-4 flex flex-col gap-3">
                    <button
                      onClick={() => onNavigate('quote')}
                      style={{ backgroundColor: layout.colors.buttonPrimaryBg }}
                      className="w-full py-4 hover:opacity-90 text-white font-extrabold text-sm rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer"
                      id="btn-home-quote-cta"
                    >
                      <FileSpreadsheet className="w-4 h-4" />
                      <span>{layout.b2bBanner.buttonText}</span>
                    </button>

                    <a
                      href="https://wa.me/5511987654321?text=Ol%C3%A1%2C%20gostaria%20de%20um%20or%C3%A7amento%20para%20minha%20empresa"
                      target="_blank"
                      rel="noreferrer"
                      className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm rounded-xl transition-all flex items-center justify-center gap-2"
                    >
                      <MessageSquare className="w-4 h-4" />
                      <span>{layout.b2bBanner.secondaryButtonText}</span>
                    </a>
                  </div>
                </div>
              </div>
            </section>
          );
        }

        // ==========================================
        // 5. WHY CHOOSE MB PERSONALIZA
        // ==========================================
        if (block.type === 'why_choose') {
          return (
            <section key={block.id} className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="text-center max-w-2xl mx-auto mb-12">
                <span
                  className="text-xs font-bold uppercase tracking-wider"
                  style={{ color: layout.colors.primary }}
                >
                  Excelência Gráfica
                </span>
                <h2 className="text-3xl font-extrabold uppercase font-heading text-slate-900 mt-1">
                  {layout.whyChoose.title}
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 mt-2">
                  {layout.whyChoose.subtitle}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {layout.whyChoose.items.map((item, idx) => (
                  <div key={item.id} className="p-6 bg-white rounded-2xl border border-slate-200 space-y-3">
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center"
                      style={{
                        backgroundColor: idx === 0 ? '#FDF2F8' : idx === 1 ? '#F0F9FF' : '#FFFBEB',
                        color: idx === 0 ? layout.colors.primary : idx === 1 ? layout.colors.secondary : '#D97706',
                      }}
                    >
                      {idx === 0 && <Zap className="w-6 h-6" />}
                      {idx === 1 && <ShieldCheck className="w-6 h-6" />}
                      {idx === 2 && <Truck className="w-6 h-6" />}
                    </div>
                    <h3 className="font-bold text-base text-slate-900 font-heading uppercase">
                      {item.title}
                    </h3>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      {item.description}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          );
        }

        // ==========================================
        // 6. CUSTOM BANNER BLOCK
        // ==========================================
        if (block.type === 'custom_banner' && block.customData) {
          return (
            <section key={block.id} className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div
                className="rounded-3xl p-8 sm:p-12 text-white border border-slate-800 relative overflow-hidden shadow-xl"
                style={{ backgroundColor: block.customData.backgroundColor || layout.colors.topBannerBg }}
              >
                <div className="relative z-10 max-w-3xl space-y-4">
                  <h2 className="text-3xl sm:text-4xl font-black font-heading uppercase text-white leading-tight">
                    {block.title}
                  </h2>
                  {block.customData.description && (
                    <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
                      {block.customData.description}
                    </p>
                  )}
                  {block.customData.buttonText && (
                    <div className="pt-2">
                      <button
                        onClick={() => onNavigate(block.customData?.bannerLink || 'quote')}
                        style={{ backgroundColor: layout.colors.buttonPrimaryBg }}
                        className="px-6 py-3.5 hover:opacity-90 text-white font-bold rounded-xl text-sm transition-all shadow-md cursor-pointer inline-flex items-center gap-2"
                      >
                        <span>{block.customData.buttonText}</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </section>
          );
        }

        return null;
      })}
      </div>
    </div>
  );
};
