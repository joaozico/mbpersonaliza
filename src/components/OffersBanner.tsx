import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Product, OffersBannerSettings, OffersBannerBackgroundTheme, CartItem, UserProfile } from '../types';
import { StorageService } from '../services/storage';
import { optimizeImageUrl, generateSrcSet } from '../utils/imageOptimizer';
import {
  ChevronLeft,
  ChevronRight,
  Zap,
  Truck,
  ArrowRight,
  Sparkles,
  Tag,
  Clock,
  CheckCircle2,
  Pause,
  Play,
  Percent,
} from 'lucide-react';

interface OffersBannerProps {
  products: Product[];
  settings?: OffersBannerSettings;
  currentUser?: UserProfile;
  onNavigate: (view: string, param?: string) => void;
  onQuickAddToCart?: (item: CartItem) => void;
  className?: string;
  isLivePreview?: boolean;
}

export interface ResolvedOfferSlide {
  id: string;
  product: Product;
  title: string;
  subtitle?: string;
  description?: string;
  image: string;
  secondaryImage?: string;
  backgroundTheme: OffersBannerBackgroundTheme;
  customBgColor?: string;
  customBgImage?: string;
  customTextColor?: string;
  imagePositionHorizontal?: 'left' | 'center' | 'right';
  imagePositionVertical?: 'top' | 'center' | 'bottom';
  imageFit?: 'contain' | 'cover';
  originalPrice: number;
  promoPrice?: number;
  discountPct: number;
  hasPromo: boolean;
  badge?: string;
  badgeColor?: 'black' | 'yellow' | 'green' | 'blue' | 'pink';
  benefitBadge?: string;
  benefitBadge2?: string;
  validityText?: string;
  ctaText?: string;
  targetLink?: string;
  isExpired: boolean;
  order: number;
  isCustomBannerImage?: boolean;
}

export const OffersBanner: React.FC<OffersBannerProps> = ({
  products,
  settings,
  currentUser,
  onNavigate,
  onQuickAddToCart,
  className = '',
  isLivePreview = false,
}) => {
  const canViewPrices = StorageService.canViewPrices(currentUser);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState<'next' | 'prev'>('next');
  const [isHovered, setIsHovered] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(0);

  // Touch gesture state for mobile swipe
  const touchStartXRef = useRef<number | null>(null);
  const touchEndXRef = useRef<number | null>(null);

  // Settings fallbacks
  const enabled = settings?.enabled ?? true;
  const autoplay = settings?.autoplay ?? true;
  const intervalMs = Math.max(2500, settings?.intervalMs ?? 5000);
  const showArrows = settings?.showArrows ?? true;
  const showDots = settings?.showDots ?? true;
  const showProgressBar = settings?.showProgressBar ?? false;
  const showCtaButton = settings?.showCtaButton ?? true;
  const globalCtaButtonText = settings?.ctaButtonText || 'VER OFERTA';
  const bannerHeight = settings?.height || 'panoramic';
  const fullWidth = settings?.fullWidth ?? false;
  const autoOrderCriteria = settings?.autoOrderCriteria || 'custom';

  // 1. Resolve offer slides from registered products and settings
  const slides: ResolvedOfferSlide[] = React.useMemo(() => {
    const now = new Date();
    const resolved: ResolvedOfferSlide[] = [];

    const isOfferActive = (startDate?: string, endDate?: string): boolean => {
      if (startDate) {
        const start = new Date(startDate);
        if (now < start) return false;
      }
      if (endDate) {
        const end = new Date(endDate);
        if (endDate.length <= 10) end.setHours(23, 59, 59, 999);
        if (now > end) return false;
      }
      return true;
    };

    const fallbackSvg =
      'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600" fill="%230f172a"><rect width="600" height="600" fill="%230f172a"/><circle cx="300" cy="270" r="120" fill="%231e293b"/><path d="M260 270h80M300 230v80" stroke="%23E6007E" stroke-width="8" stroke-linecap="round"/><text x="300" y="440" fill="%2394a3b8" font-family="sans-serif" font-size="22" font-weight="bold" text-anchor="middle">Foto do Produto</text></svg>';

    // Mode A: Use configured items in settings if present
    if (settings?.items && settings.items.length > 0) {
      settings.items
        .filter((item) => item.active)
        .forEach((item, idx) => {
          const product = products.find((p) => p.id === item.productId);
          if (!product || !product.is_active) return;

          const offerActive = isOfferActive(item.startDate, item.endDate);
          const basePrice = product.base_price || 0;
          const promoPriceCandidate =
            item.promoPrice !== undefined ? item.promoPrice : product.promo_price;
          const hasPromo =
            offerActive &&
            typeof promoPriceCandidate === 'number' &&
            promoPriceCandidate > 0 &&
            promoPriceCandidate < basePrice;

          const effectivePromoPrice = hasPromo ? promoPriceCandidate : undefined;
          const discountPct =
            hasPromo && effectivePromoPrice
              ? Math.round(((basePrice - effectivePromoPrice) / basePrice) * 100)
              : 0;

          const image =
            item.customImage ||
            (product.images && product.images.length > 0 ? product.images[0] : '') ||
            fallbackSvg;

          // Theme fallback rotation if not set
          const themePresets: OffersBannerBackgroundTheme[] = [
            'industrial_light',
            'holiday_festive',
            'dark_tech',
            'modern_lavender',
            'vibrant_green',
          ];
          const assignedTheme = item.backgroundTheme || themePresets[idx % themePresets.length];

          resolved.push({
            id: item.id || `slide-${item.productId}-${idx}`,
            product,
            title: item.customTitle || product.name,
            subtitle: item.customSubtitle || product.description,
            description: item.customDescription || product.description,
            image,
            secondaryImage: item.secondaryImage,
            backgroundTheme: assignedTheme,
            customBgColor: item.customBgColor,
            customBgImage: item.customBgImage,
            customTextColor: item.customTextColor,
            imagePositionHorizontal: item.imagePositionHorizontal || (item.imagePosition === 'left' ? 'left' : item.imagePosition === 'right' ? 'right' : 'center'),
            imagePositionVertical: item.imagePositionVertical || (item.imagePosition === 'bottom' ? 'bottom' : 'center'),
            imageFit: item.imageFit || 'contain',
            originalPrice: basePrice,
            promoPrice: effectivePromoPrice,
            discountPct,
            hasPromo,
            badge:
              item.badge ||
              (hasPromo ? `ATÉ ${discountPct}% OFF` : product.badge || 'DESTAQUE'),
            badgeColor: item.badgeColor || 'black',
            benefitBadge: item.benefitBadge || '⚡ FULL ENVIOS RÁPIDOS',
            benefitBadge2: item.benefitBadge2 || 'ENVIO MAIS RÁPIDO DO BRASIL',
            validityText:
              item.validityText ||
              `Válido até 30/09/2026. Ver mais em ${item.customTitle || product.name} ›`,
            ctaText: item.ctaText || globalCtaButtonText,
            targetLink: item.targetLink,
            isExpired: !offerActive,
            order: item.order ?? idx + 1,
            isCustomBannerImage: Boolean(item.customImage && item.customImage.length > 100 && !item.secondaryImage),
          });
        });
    }

    // Mode B: If no resolved items, fallback to products flagged with showInOffersBanner or on promo
    if (resolved.length === 0) {
      const candidates = products.filter(
        (p) =>
          p.is_active &&
          (p.showInOffersBanner || (p.promo_price && p.promo_price < p.base_price) || p.is_featured)
      );

      const themePresets: OffersBannerBackgroundTheme[] = [
        'industrial_light',
        'holiday_festive',
        'dark_tech',
        'modern_lavender',
        'vibrant_green',
      ];

      candidates.forEach((product, idx) => {
        const offerActive = isOfferActive(product.offerStartDate, product.offerEndDate);
        const basePrice = product.base_price || 0;
        const hasPromo =
          offerActive &&
          typeof product.promo_price === 'number' &&
          product.promo_price > 0 &&
          product.promo_price < basePrice;

        const effectivePromoPrice = hasPromo ? product.promo_price : undefined;
        const discountPct =
          hasPromo && effectivePromoPrice
            ? Math.round(((basePrice - effectivePromoPrice) / basePrice) * 100)
            : 0;

        const image =
          product.offersBannerImage ||
          (product.images && product.images.length > 0 ? product.images[0] : '') ||
          fallbackSvg;

        resolved.push({
          id: `slide-auto-${product.id}-${idx}`,
          product,
          title: product.name,
          subtitle: product.description,
          description: product.description,
          image,
          backgroundTheme: themePresets[idx % themePresets.length],
          originalPrice: basePrice,
          promoPrice: effectivePromoPrice,
          discountPct,
          hasPromo,
          badge:
            product.offersBannerBadge ||
            (hasPromo ? `ATÉ ${discountPct}% OFF` : product.badge || 'DESTAQUE'),
          badgeColor: 'black',
          benefitBadge: '⚡ FULL ENVIOS RÁPIDOS',
          benefitBadge2: 'ENVIO MAIS RÁPIDO DO BRASIL',
          validityText: `Válido até 30/09/2026. Ver mais em ${product.name} ›`,
          ctaText: globalCtaButtonText,
          isExpired: !offerActive,
          order: product.offersBannerOrder ?? idx + 1,
        });
      });
    }

    // Sort slides according to criterion
    if (autoOrderCriteria === 'discount_desc') {
      resolved.sort((a, b) => b.discountPct - a.discountPct);
    } else if (autoOrderCriteria === 'featured') {
      resolved.sort((a, b) => (b.product.is_featured ? 1 : 0) - (a.product.is_featured ? 1 : 0));
    } else if (autoOrderCriteria === 'newest') {
      resolved.sort(
        (a, b) =>
          new Date(b.product.createdAt || 0).getTime() - new Date(a.product.createdAt || 0).getTime()
      );
    } else {
      resolved.sort((a, b) => a.order - b.order);
    }

    if (settings?.maxSlides && settings.maxSlides > 0) {
      return resolved.slice(0, settings.maxSlides);
    }

    return resolved;
  }, [products, settings, autoOrderCriteria, globalCtaButtonText]);

  // Keep currentIndex bounded
  useEffect(() => {
    if (currentIndex >= slides.length && slides.length > 0) {
      setCurrentIndex(0);
    }
  }, [slides.length, currentIndex]);

  // Next / Previous Navigation Handlers
  const handleNext = useCallback(() => {
    if (slides.length <= 1) return;
    setDirection('next');
    setCurrentIndex((prev) => (prev + 1) % slides.length);
    setProgress(0);
  }, [slides.length]);

  const handlePrev = useCallback(() => {
    if (slides.length <= 1) return;
    setDirection('prev');
    setCurrentIndex((prev) => (prev - 1 + slides.length) % slides.length);
    setProgress(0);
  }, [slides.length]);

  const handleGoTo = (index: number) => {
    if (index === currentIndex || index < 0 || index >= slides.length) return;
    setDirection(index > currentIndex ? 'next' : 'prev');
    setCurrentIndex(index);
    setProgress(0);
  };

  // Autoplay and Progress Bar Timer
  useEffect(() => {
    if (!autoplay || slides.length <= 1 || isHovered || isPaused) return;

    const tickInterval = 50;
    const step = (tickInterval / intervalMs) * 100;

    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          handleNext();
          return 0;
        }
        return prev + step;
      });
    }, tickInterval);

    return () => clearInterval(timer);
  }, [autoplay, slides.length, isHovered, isPaused, intervalMs, handleNext]);

  // Mobile Touch Gestures
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndXRef.current = e.touches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (!touchStartXRef.current || !touchEndXRef.current) return;
    const diff = touchStartXRef.current - touchEndXRef.current;
    const threshold = 50;
    if (diff > threshold) {
      handleNext();
    } else if (diff < -threshold) {
      handlePrev();
    }
    touchStartXRef.current = null;
    touchEndXRef.current = null;
  };

  // Keyboard navigation when user is focusing on the banner
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') {
      handlePrev();
    } else if (e.key === 'ArrowRight') {
      handleNext();
    }
  };

  // Action Click Handler: routes to targetLink or product detail
  const handleSlideClick = (slide: ResolvedOfferSlide) => {
    if (isLivePreview) return;
    if (slide.targetLink) {
      if (slide.targetLink.startsWith('http')) {
        window.open(slide.targetLink, '_blank', 'noopener,noreferrer');
      } else {
        // Internal route (e.g. 'catalog', 'quote', or 'product-detail')
        if (slide.targetLink.startsWith('/produtos/')) {
          const slugOrId = slide.targetLink.replace('/produtos/', '');
          onNavigate('product-detail', slugOrId);
        } else if (slide.targetLink.startsWith('/catalogo')) {
          onNavigate('catalog');
        } else {
          onNavigate(slide.targetLink.replace('/', ''));
        }
      }
      return;
    }
    onNavigate('product-detail', slide.product.slug || slide.product.id);
  };

  if (!enabled && !isLivePreview) {
    return null;
  }

  if (slides.length === 0) {
    if (isLivePreview) {
      return (
        <div className="p-8 rounded-none !rounded-none bg-slate-900 border-0 text-center text-white space-y-2" style={{ borderRadius: 0 }}>
          <Sparkles className="w-8 h-8 text-[#FFDD00] mx-auto animate-pulse" />
          <h4 className="font-bold text-sm">Banner de Ofertas Ativo (Sem Produtos Selecionados)</h4>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Vincule produtos na aba "Banner de Ofertas" para ativar os slides com estilo moderno de e-commerce.
          </p>
        </div>
      );
    }
    return null;
  }

  const currentSlide = slides[currentIndex] || slides[0];

  // Proportions: ~4:1 to 4.5:1 on desktop, perfectly proportioned horizontal strip (~240-300px)
  const heightClasses =
    bannerHeight === 'compact'
      ? 'h-[200px] sm:h-[230px] md:h-[250px] lg:h-[270px]'
      : bannerHeight === 'tall'
      ? 'h-[260px] sm:h-[310px] md:h-[360px] lg:h-[400px]'
      : bannerHeight === 'normal'
      ? 'h-[230px] sm:h-[270px] md:h-[300px] lg:h-[330px]'
      : 'h-[220px] sm:h-[250px] md:h-[280px] lg:h-[300px]'; // Default panoramic

  // Helper for Theme Background Styling
  const getThemeStyles = (theme: OffersBannerBackgroundTheme, slide: ResolvedOfferSlide) => {
    switch (theme) {
      case 'industrial_light':
        return {
          wrapper: 'bg-gradient-to-r from-[#EAEAEA] via-[#F2F2F2] to-[#DFDFDF] text-slate-900',
          titleColor: 'text-slate-950',
          subtitleColor: 'text-slate-600',
          validityColor: 'text-slate-500',
          discountBadge: 'bg-black text-white border border-slate-900',
          discountBadgeText: 'text-white',
          benefitBadge: 'bg-[#FFDD00] text-slate-950 border border-amber-300 font-extrabold',
          ambientLight: 'from-white/60 via-transparent to-black/5',
          floorShadow: 'rgba(0,0,0,0.18)',
          isDarkTheme: false,
        };
      case 'holiday_festive':
        return {
          wrapper: 'bg-gradient-to-r from-[#142A1F] via-[#1D3A2B] to-[#102219] text-white',
          titleColor: 'text-white',
          subtitleColor: 'text-emerald-100/80',
          validityColor: 'text-emerald-200/70',
          discountBadge: 'bg-[#FFDD00] text-slate-950 border border-amber-400',
          discountBadgeText: 'text-slate-950',
          benefitBadge: 'bg-[#0E2017] text-emerald-300 border border-emerald-500/40',
          ambientLight: 'from-emerald-500/10 via-amber-400/5 to-transparent',
          floorShadow: 'rgba(0,0,0,0.5)',
          isDarkTheme: true,
        };
      case 'dark_tech':
        return {
          wrapper: 'bg-gradient-to-r from-[#1C1E23] via-[#262930] to-[#17181C] text-white',
          titleColor: 'text-white',
          subtitleColor: 'text-slate-300',
          validityColor: 'text-slate-400',
          discountBadge: 'bg-[#121316] text-[#FFDD00] border border-slate-700',
          discountBadgeText: 'text-[#FFDD00]',
          benefitBadge: 'bg-[#2E333D] text-white border border-slate-600',
          ambientLight: 'from-sky-500/10 via-transparent to-red-500/5',
          floorShadow: 'rgba(0,0,0,0.6)',
          isDarkTheme: true,
        };
      case 'modern_lavender':
        return {
          wrapper: 'bg-gradient-to-r from-[#ECEEFB] via-[#E2E6F7] to-[#DCE1F5] text-slate-900',
          titleColor: 'text-[#182142]',
          subtitleColor: 'text-[#3E4A70]',
          validityColor: 'text-[#64748B]',
          discountBadge: 'bg-[#182142] text-[#00AEEF] border border-[#182142]',
          discountBadgeText: 'text-[#00AEEF]',
          benefitBadge: 'bg-white text-[#182142] border border-slate-200 shadow-2xs',
          ambientLight: 'from-blue-400/10 via-purple-300/10 to-transparent',
          floorShadow: 'rgba(24,33,66,0.18)',
          isDarkTheme: false,
        };
      case 'vibrant_green':
        return {
          wrapper: 'bg-gradient-to-r from-[#00A650] via-[#00B557] to-[#009341] text-white',
          titleColor: 'text-white',
          subtitleColor: 'text-emerald-50',
          validityColor: 'text-white/80',
          discountBadge: 'bg-[#FFDD00] text-slate-950 border border-amber-400',
          discountBadgeText: 'text-slate-950',
          benefitBadge: 'bg-white/20 backdrop-blur-xs text-white border border-white/30',
          ambientLight: 'from-yellow-300/15 via-transparent to-emerald-900/20',
          floorShadow: 'rgba(0,0,0,0.3)',
          isDarkTheme: true,
        };
      case 'corporate_pink':
        return {
          wrapper: 'bg-gradient-to-r from-[#1C0824] via-[#2F0B3D] to-[#120419] text-white',
          titleColor: 'text-white',
          subtitleColor: 'text-pink-100/80',
          validityColor: 'text-pink-200/70',
          discountBadge: 'bg-[#E6007E] text-white border border-pink-400',
          discountBadgeText: 'text-white',
          benefitBadge: 'bg-[#00AEEF] text-slate-950 border border-cyan-300 font-extrabold',
          ambientLight: 'from-pink-500/20 via-transparent to-cyan-500/10',
          floorShadow: 'rgba(0,0,0,0.5)',
          isDarkTheme: true,
        };
      case 'custom':
      default:
        return {
          wrapper: slide.customBgColor
            ? ''
            : 'bg-gradient-to-r from-[#EAEAEA] via-[#F2F2F2] to-[#DFDFDF] text-slate-900',
          titleColor: slide.customTextColor ? '' : 'text-slate-950',
          subtitleColor: 'text-slate-600',
          validityColor: 'text-slate-500',
          discountBadge: 'bg-black text-white border border-slate-900',
          discountBadgeText: 'text-white',
          benefitBadge: 'bg-[#FFDD00] text-slate-950 border border-amber-300 font-extrabold',
          ambientLight: 'from-white/40 via-transparent to-black/5',
          floorShadow: 'rgba(0,0,0,0.2)',
          isDarkTheme: false,
        };
    }
  };

  const themeStyle = getThemeStyles(currentSlide.backgroundTheme, currentSlide);

  return (
    <section
      className={`relative w-full max-w-full m-0 p-0 border-0 ${className}`}
      style={{ margin: 0, padding: 0, border: 'none', borderRadius: 0 }}
      aria-label="Carrossel de Campanhas Promocionais"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      id="offers-banner-section"
    >
      {/* Main Panoramic Carousel Card Container with completely square corners (90-degree angles) and zero gap */}
      <div
        className={`relative w-full max-w-full overflow-hidden rounded-none !rounded-none m-0 p-0 border-0 shadow-none ${heightClasses} select-none transition-all duration-500`}
        style={{
          borderRadius: 0,
          margin: 0,
          border: 'none',
          boxShadow: 'none',
          ...(currentSlide.backgroundTheme === 'custom' && currentSlide.customBgColor
            ? { backgroundColor: currentSlide.customBgColor }
            : {}),
        }}
      >
        {/* Dynamic Background Texture & Studio Lighting Overlay */}
        <div
          className={`absolute inset-0 transition-colors duration-700 pointer-events-none banner-elem-bg rounded-none !rounded-none ${themeStyle.wrapper}`}
          style={{
            borderRadius: 0,
            ...(currentSlide.customBgImage
              ? {
                  backgroundImage: `url(${optimizeImageUrl(currentSlide.customBgImage, { width: 1600, quality: 80, format: 'webp' })})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }
              : {}),
          }}
        >
          {/* Subtle Studio Floor / Depth Vignette */}
          <div
            className="absolute inset-0 bg-gradient-to-t from-black/10 via-transparent to-white/10 pointer-events-none rounded-none !rounded-none"
            style={{ borderRadius: 0 }}
          />

          {/* Atmospheric Ambient Glow */}
          <div
            className={`absolute inset-0 bg-gradient-to-r ${themeStyle.ambientLight} pointer-events-none rounded-none !rounded-none`}
            style={{ borderRadius: 0 }}
          />

          {/* Decorative Modern Diagonal Line Accent */}
          <div
            className="absolute right-0 top-0 bottom-0 w-1/2 opacity-20 pointer-events-none overflow-hidden rounded-none !rounded-none"
            style={{ borderRadius: 0 }}
          >
            <svg
              viewBox="0 0 400 300"
              className="w-full h-full object-cover text-current"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <circle cx="350" cy="150" r="180" stroke="currentColor" strokeWidth="1" strokeDasharray="6 6" />
              <circle cx="350" cy="150" r="230" stroke="currentColor" strokeWidth="0.5" />
            </svg>
          </div>
        </div>

        {/* Slide Content with Smooth Entrance Transition */}
        <div
          key={`slide-${currentSlide.id}-${currentIndex}`}
          className="relative z-10 w-full h-full flex items-center rounded-none !rounded-none"
          style={{ borderRadius: 0 }}
        >
          {/* Full Custom Image Mode (If uploaded as an entire banner graphic) */}
          {currentSlide.isCustomBannerImage ? (
            <div
              onClick={() => handleSlideClick(currentSlide)}
              className="relative w-full h-full cursor-pointer flex items-center justify-center overflow-hidden banner-elem-img rounded-none !rounded-none"
              style={{ borderRadius: 0 }}
            >
              <img
                src={optimizeImageUrl(currentSlide.image, { width: 1400, quality: 85, format: 'webp' })}
                srcSet={generateSrcSet(currentSlide.image, [640, 960, 1400])}
                sizes="100vw"
                alt={currentSlide.title}
                className={`w-full h-full rounded-none !rounded-none ${
                  currentSlide.imageFit === 'contain' ? 'object-contain' : 'object-cover'
                } object-center`}
                style={{ borderRadius: 0 }}
                loading={currentIndex === 0 ? 'eager' : 'lazy'}
                decoding="async"
              />
            </div>
          ) : (
            /* Standard E-Commerce Campaign Layout (Exact match to Reference Video) */
            <div
              onClick={() => handleSlideClick(currentSlide)}
              className="w-full h-full px-4 sm:px-8 md:px-12 lg:px-14 flex items-center justify-between gap-3 sm:gap-6 cursor-pointer rounded-none !rounded-none"
              style={{ borderRadius: 0 }}
            >
              {/* ======================================================== */}
              {/* LEFT ZONE: Impactful Campaign Typography, Badges & CTA  */}
              {/* ======================================================== */}
              <div className="w-[60%] sm:w-[56%] md:w-[54%] flex flex-col justify-center items-start space-y-2 sm:space-y-3 z-10">
                {/* 1. High-Impact Campaign Headline */}
                <h2
                  className={`font-heading font-black text-xl sm:text-2xl md:text-3xl lg:text-[40px] leading-[1.08] tracking-tight uppercase line-clamp-2 drop-shadow-xs transition-colors banner-elem-title ${
                    slideCustomTextColor(currentSlide, themeStyle.titleColor)
                  }`}
                  style={currentSlide.customTextColor ? { color: currentSlide.customTextColor } : {}}
                >
                  {currentSlide.title}
                </h2>

                {/* 2. Campaign Badges Row (Discount Pill + Fast Shipping Pill) */}
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2.5 pt-0.5 banner-elem-badges">
                  {/* Discount Badge Pill (e.g. "ATÉ 50% OFF") */}
                  {currentSlide.badge && (
                    <div
                      className={`inline-flex items-center justify-center px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-full text-[10px] sm:text-xs md:text-sm font-black tracking-wide uppercase shadow-sm transition-transform hover:scale-105 ${themeStyle.discountBadge}`}
                    >
                      <span className={themeStyle.discountBadgeText}>
                        {currentSlide.badge}
                      </span>
                    </div>
                  )}

                  {/* Fast Shipping / Benefit Badge Pill (e.g. "⚡ FULL ENVIOS RÁPIDOS") */}
                  {currentSlide.benefitBadge && (
                    <div
                      className={`inline-flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-full text-[10px] sm:text-xs md:text-sm font-black tracking-wide uppercase shadow-sm transition-transform hover:scale-105 ${themeStyle.benefitBadge}`}
                    >
                      <Zap className="w-3 h-3 sm:w-3.5 sm:h-3.5 fill-current shrink-0" />
                      <span className="truncate max-w-[140px] sm:max-w-none">
                        {currentSlide.benefitBadge}
                      </span>
                    </div>
                  )}

                  {/* Optional Second Benefit Badge (e.g. "ENVIO MAIS RÁPIDO DO BRASIL") */}
                  {currentSlide.benefitBadge2 && (
                    <div
                      className="hidden md:inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-bold tracking-wide uppercase shadow-2xs opacity-90 border border-current/20"
                    >
                      <Truck className="w-3 h-3 shrink-0" />
                      <span>{currentSlide.benefitBadge2}</span>
                    </div>
                  )}
                </div>

                {/* 3. Subtitle / Expiration & "Ver Mais" Link / CTA */}
                <div className="pt-0.5 space-y-1 banner-elem-subtitle">
                  {/* Validity / Disclaimer Text with link arrow */}
                  {currentSlide.validityText && (
                    <p
                      className={`text-[9px] sm:text-[11px] font-medium leading-tight flex items-center gap-1 hover:underline ${themeStyle.validityColor}`}
                    >
                      <span>{currentSlide.validityText}</span>
                    </p>
                  )}

                  {/* Prominent CTA Button (When enabled) */}
                  {showCtaButton && (
                    <div className="pt-1 banner-elem-cta">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSlideClick(currentSlide);
                        }}
                        className={`inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full font-heading font-black text-[10px] sm:text-xs uppercase tracking-wider transition-all duration-300 shadow-md hover:scale-105 active:scale-95 cursor-pointer ${
                          themeStyle.isDarkTheme
                            ? 'bg-[#FFDD00] text-slate-950 hover:bg-amber-300'
                            : 'bg-slate-900 text-white hover:bg-slate-800'
                        }`}
                      >
                        <span>{currentSlide.ctaText || globalCtaButtonText}</span>
                        <ArrowRight className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* ======================================================== */}
              {/* RIGHT ZONE: Hero Cutout Products with Realistic Shadow   */}
              {/* ======================================================== */}
              <div
                className={`w-[40%] sm:w-[44%] md:w-[46%] h-full flex ${
                  currentSlide.imagePositionHorizontal === 'left'
                    ? 'justify-start'
                    : currentSlide.imagePositionHorizontal === 'right'
                    ? 'justify-end'
                    : 'justify-center'
                } ${
                  currentSlide.imagePositionVertical === 'top'
                    ? 'items-start'
                    : currentSlide.imagePositionVertical === 'bottom'
                    ? 'items-end'
                    : 'items-center'
                } relative shrink-0 banner-elem-img`}
              >
                {/* Contact Floor Shadow under products */}
                <div
                  className="absolute bottom-4 sm:bottom-6 w-[80%] h-4 sm:h-6 rounded-[100%] blur-[10px] sm:blur-[14px] pointer-events-none"
                  style={{ backgroundColor: themeStyle.floorShadow }}
                />

                {/* Combo Composition (Primary + Secondary Product) or Single Hero Product */}
                <div
                  className={`relative w-full h-[88%] flex ${
                    currentSlide.imagePositionVertical === 'top'
                      ? 'items-start'
                      : currentSlide.imagePositionVertical === 'bottom'
                      ? 'items-end'
                      : 'items-center'
                  } ${
                    currentSlide.imagePositionHorizontal === 'left'
                      ? 'justify-start'
                      : currentSlide.imagePositionHorizontal === 'right'
                      ? 'justify-end'
                      : 'justify-center'
                  }`}
                >
                  {currentSlide.secondaryImage ? (
                    /* Two-product hero combo (e.g. Pressure washer + drill, or PC + smartphone) */
                    <div className="relative w-full h-full flex items-end justify-center">
                      {/* Secondary product (slightly behind on the right) */}
                      <div className="relative z-10 w-[50%] h-[75%] max-h-[170px] sm:max-h-[220px] -mr-4 mb-2 flex items-center justify-center">
                        <img
                          src={optimizeImageUrl(currentSlide.secondaryImage, { width: 600, quality: 85, format: 'webp' })}
                          alt="Produto complementar"
                          className={`w-auto h-full max-w-full ${
                            currentSlide.imageFit === 'cover' ? 'object-cover' : 'object-contain'
                          } filter drop-shadow-[0_12px_12px_rgba(0,0,0,0.35)]`}
                          loading="lazy"
                          decoding="async"
                        />
                      </div>

                      {/* Primary product (in front, prominent - distortion-free contain) */}
                      <div className="relative z-20 w-[60%] h-[92%] max-h-[195px] sm:max-h-[250px] flex items-center justify-center transform hover:scale-105 transition-transform duration-500">
                        <img
                          src={optimizeImageUrl(currentSlide.image, { width: 900, quality: 85, format: 'webp' })}
                          srcSet={generateSrcSet(currentSlide.image, [400, 600, 900])}
                          sizes="(max-width: 640px) 160px, (max-width: 1024px) 240px, 320px"
                          alt={currentSlide.title}
                          className={`w-auto h-full max-w-full ${
                            currentSlide.imageFit === 'cover' ? 'object-cover' : 'object-contain'
                          } filter drop-shadow-[0_15px_15px_rgba(0,0,0,0.4)]`}
                          loading={currentIndex === 0 ? 'eager' : 'lazy'}
                          decoding="async"
                        />
                      </div>
                    </div>
                  ) : (
                    /* Single Prominent Hero Product (Guaranteed No Distortion) */
                    <div className="relative z-10 w-full h-full flex items-center justify-center p-2 transform hover:scale-105 transition-transform duration-500">
                      <img
                        src={optimizeImageUrl(currentSlide.image, { width: 900, quality: 85, format: 'webp' })}
                        srcSet={generateSrcSet(currentSlide.image, [400, 600, 900])}
                        sizes="(max-width: 640px) 180px, (max-width: 1024px) 260px, 350px"
                        alt={currentSlide.title}
                        className={`w-auto h-full max-h-[185px] sm:max-h-[225px] md:max-h-[260px] ${
                          currentSlide.imageFit === 'cover' ? 'object-cover' : 'object-contain'
                        } filter drop-shadow-[0_16px_16px_rgba(0,0,0,0.35)]`}
                        loading={currentIndex === 0 ? 'eager' : 'lazy'}
                        decoding="async"
                      />
                    </div>
                  )}

                  {/* Price Tag Bubble Overlay (Optional, if promo price exists and user can view prices) */}
                  {canViewPrices && currentSlide.hasPromo && currentSlide.promoPrice && (
                    <div className="absolute top-2 sm:top-4 right-1 sm:right-3 z-30 bg-white/95 text-slate-900 border border-slate-200/80 px-2 sm:px-2.5 py-1 rounded-xl shadow-lg flex flex-col items-center backdrop-blur-xs transform rotate-2 hover:rotate-0 transition-transform">
                      <span className="text-[8px] sm:text-[9px] text-slate-400 font-bold uppercase line-through leading-none">
                        R$ {currentSlide.originalPrice.toFixed(2)}
                      </span>
                      <span className="text-[11px] sm:text-xs md:text-sm font-black text-[#E6007E] leading-tight">
                        R$ {currentSlide.promoPrice.toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ======================================================== */}
        {/* CAROUSEL SIDE NAVIGATION ARROWS (Prev / Next)             */}
        {/* ======================================================== */}
        {showArrows && slides.length > 1 && (
          <>
            {/* Left Prev Arrow */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handlePrev();
              }}
              className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 z-30 w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-white text-slate-700 hover:text-slate-950 shadow-md hover:shadow-lg border border-slate-200/80 flex items-center justify-center transition-all hover:scale-110 active:scale-95 cursor-pointer focus:outline-none"
              title="Campanha anterior"
              aria-label="Campanha anterior"
            >
              <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.5]" />
            </button>

            {/* Right Next Arrow */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleNext();
              }}
              className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 z-30 w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-white text-slate-700 hover:text-slate-950 shadow-md hover:shadow-lg border border-slate-200/80 flex items-center justify-center transition-all hover:scale-110 active:scale-95 cursor-pointer focus:outline-none"
              title="Próxima campanha"
              aria-label="Próxima campanha"
            >
              <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.5]" />
            </button>
          </>
        )}

        {/* Discreet Autoplay Pause/Play button (top-right corner) */}
        {slides.length > 1 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsPaused(!isPaused);
            }}
            className="absolute top-2 right-2 sm:top-3 sm:right-3 z-30 p-1.5 rounded-full bg-black/25 hover:bg-black/50 text-white/70 hover:text-white transition-colors backdrop-blur-xs"
            title={isPaused ? 'Retomar reprodução automática' : 'Pausar carrossel'}
            aria-label={isPaused ? 'Play' : 'Pause'}
          >
            {isPaused ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
          </button>
        )}

        {/* Carousel Pagination Dots Centered at the Bottom (Like Video) */}
        {showDots && slides.length > 1 && (
          <div className="absolute bottom-2.5 sm:bottom-3 inset-x-0 z-30 flex items-center justify-center gap-1.5 sm:gap-2 pointer-events-auto">
            {slides.map((slide, idx) => {
              const isActive = idx === currentIndex;
              return (
                <button
                  key={`dot-${slide.id}-${idx}`}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleGoTo(idx);
                  }}
                  className={`transition-all duration-300 rounded-full cursor-pointer ${
                    isActive
                      ? themeStyle.isDarkTheme
                        ? 'w-6 sm:w-7 h-2 bg-white shadow-xs'
                        : 'w-6 sm:w-7 h-2 bg-slate-900 shadow-xs'
                      : themeStyle.isDarkTheme
                      ? 'w-2 h-2 bg-white/40 hover:bg-white/70'
                      : 'w-2 h-2 bg-slate-400/50 hover:bg-slate-600'
                  }`}
                  title={`Ir para o slide ${idx + 1}: ${slide.title}`}
                  aria-label={`Ir para o slide ${idx + 1}`}
                />
              );
            })}
          </div>
        )}

        {/* Subtle Autoplay Progress Bar */}
        {showProgressBar && autoplay && slides.length > 1 && !isPaused && (
          <div className="absolute top-0 inset-x-0 h-0.5 bg-black/10 z-30">
            <div
              className="h-full bg-gradient-to-r from-[#E6007E] via-[#00AEEF] to-[#FFDD00] transition-all duration-75 ease-linear"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </div>
    </section>
  );
};

// Helper for custom text color
function slideCustomTextColor(slide: ResolvedOfferSlide, fallback: string): string {
  if (slide.customTextColor) return '';
  return fallback;
}
