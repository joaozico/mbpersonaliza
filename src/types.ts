export type UserRole = 'admin' | 'gerente' | 'vendedor' | 'estoquista' | 'cliente' | 'visitante';

export interface RolePermissions {
  canViewDashboard: boolean;
  canViewSiteMetrics: boolean;
  canManageProducts: boolean;
  canManageCategories: boolean;
  canManageStock: boolean;
  canManageQuotes: boolean;
  canManageOrders: boolean;
  canManageUsers: boolean;
  canManageCompanySettings: boolean;
  canCustomizeLayout: boolean;
  canViewReports: boolean;
  canEditPrices: boolean;
  canDeleteData: boolean;
}

export type PermissionKey = keyof RolePermissions;

export interface WhatsAppContact {
  id: string;
  name: string; // ex: 'Vendas & Orçamentos', 'Suporte Técnico', 'Grandes Contas PJ'
  number: string; // ex: '(11) 98765-4321'
  department?: string; // ex: 'Comercial', 'Suporte', 'Financeiro', 'Produção'
  hours?: string; // ex: 'Seg a Sex: 08:30 às 18:30'
  customMessage?: string; // ex: 'Olá! Gostaria de falar sobre orçamentos de brindes.'
  isDefault?: boolean; // Número principal
  active?: boolean;
}

export interface CompanySettings {
  name: string; // Nome Fantasia: MB Personaliza
  corporateName: string; // Razão Social
  cnpj: string;
  stateRegistration?: string; // Inscrição Estadual
  phone: string;
  whatsapp: string;
  whatsappContacts?: WhatsAppContact[]; // Múltiplos números de WhatsApp configuráveis
  email: string;
  financeEmail?: string;
  salesEmail?: string;
  website?: string;
  tagline: string;
  logoUrl?: string; // Imagem customizada principal ou base64 do dispositivo
  logoFileName?: string; // Nome original do arquivo anexado
  logoFileSize?: string; // Tamanho do arquivo (ex: 245 KB)
  logoDarkUrl?: string; // Logo customizada para fundos escuros
  logoDarkFileName?: string;
  faviconUrl?: string; // Ícone / Favicon
  logoType: 'default_svg' | 'custom_image';
  primaryColor?: string; // Cor principal (#E6007E)
  secondaryColor?: string; // Cor secundária (#00AEEF)
  accentColor?: string; // Cor destaque (#FFDD00)
  showLogoSubtitle?: boolean;
  address: {
    street: string;
    number: string;
    complement?: string;
    neighborhood: string;
    city: string;
    state: string;
    zip: string;
  };
  pixKey: string;
  pixKeyType: 'cnpj' | 'email' | 'phone' | 'random';
  bankInfo: {
    bank: string;
    agency: string;
    account: string;
    holder: string;
  };
  socialLinks: {
    instagram?: string;
    facebook?: string;
    linkedin?: string;
  };
  standardProductionDays: number;
  minOrderValue: number;
  pixDiscountPercent?: number;
  tradeName?: string;
  shippingNotes?: string;
  updatedAt: string;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  company?: string;
  role: UserRole;
  password?: string;
  department?: string;
  status?: 'ativo' | 'inativo';
  avatarUrl?: string;
  cpfCnpj?: string;
  stateRegistration?: string;
  customPermissions?: Partial<RolePermissions>;
  lastLogin?: string;
  address?: {
    street: string;
    number: string;
    complement?: string;
    neighborhood: string;
    city: string;
    state: string;
    zip: string;
  };
  createdAt: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
  image: string;
  order: number;
}

export interface Subcategory {
  id: string;
  categoryId: string;
  name: string;
  slug: string;
}

export interface PriceTier {
  id: string;
  min_qty: number;
  max_qty?: number;
  unit_price: number;
  discount_pct?: number;
}

export interface ProductVariant {
  id: string;
  name: string;
  sku: string;
  colorHex?: string;
  size?: string;
  material?: string;
  stock_qty: number;
  additional_price?: number;
}

export interface Product {
  id: string;
  code: string;
  name: string;
  slug: string;
  categoryId: string;
  subcategoryId?: string;
  description: string;
  details: {
    materials?: string;
    dimensions?: string;
    capacity?: string;
    customTechniques: string[]; // e.g. ['Gravação a Laser', 'Sublimação', 'Silk Screen', 'Bordado', 'Impressão UV', 'DTF']
    printAreas?: string;
    packaging?: string;
  };
  images: string[];
  show_price: boolean; // true = tem preço e vai ao checkout; false = somente orçamento
  cost_price: number;
  profit_margin: number; // percentage, e.g. 60
  base_price: number; // calculated or fixed sell price
  promo_price?: number;
  min_order_qty: number;
  stock_qty: number;
  min_stock_alert: number;
  is_active: boolean;
  is_featured: boolean;
  badge?: string; // 'Mais Vendido', 'Lançamento', 'Destaque', 'Ecológico'
  variants: ProductVariant[];
  price_tiers: PriceTier[];
  createdAt: string;
}

export interface StockMovement {
  id: string;
  productId: string;
  productName: string;
  productSku: string;
  variantId?: string;
  variantName?: string;
  type: 'entrada' | 'saida' | 'ajuste' | 'perda';
  quantity: number;
  previous_stock: number;
  new_stock: number;
  reason: string;
  operator_name: string;
  created_at: string;
}

export interface QuoteItem {
  id: string;
  productId: string;
  productName: string;
  productSku: string;
  productImage?: string;
  variantName?: string;
  quantity: number;
  customTechnique?: string;
  customPosition?: string;
  unit_price_estimated?: number;
  subtotal?: number;
}

export interface Quote {
  id: string;
  code: string; // e.g. ORC-2026-0042
  clientId?: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  clientCompany?: string;
  clientCpfCnpj?: string;
  deliveryDeadline?: string;
  deliveryCityState?: string;
  items: QuoteItem[];
  notes: string;
  artworkUrl?: string;
  artworkName?: string;
  status: 'pendente' | 'em_analise' | 'respondido' | 'aprovado' | 'convertido' | 'recusado';
  totalEstimated?: number;
  adminNotes?: string;
  productionDaysEstimate?: number;
  validityDate?: string;
  paymentTerms?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface OrderItem {
  id: string;
  productId: string;
  productName: string;
  productSku: string;
  productImage?: string;
  variantName?: string;
  unitPrice: number;
  quantity: number;
  total: number;
  customTechnique?: string;
  customArtworkName?: string;
}

export interface Order {
  id: string;
  code: string; // e.g. PED-2026-0189
  clientId?: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  clientCompany?: string;
  shippingAddress: {
    street: string;
    number: string;
    complement?: string;
    neighborhood: string;
    city: string;
    state: string;
    zip: string;
  };
  items: OrderItem[];
  subtotal: number;
  discount: number;
  shippingCost: number;
  total: number;
  paymentMethod: 'pix' | 'credit_card' | 'boleto' | 'faturado_pj';
  paymentStatus: 'pago' | 'pendente' | 'aprovado' | 'cancelado';
  orderStatus: 'novo' | 'em_producao' | 'pronto' | 'entregue' | 'cancelado';
  sourceQuoteId?: string;
  trackingCode?: string;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface CartItem {
  id: string;
  product: Product;
  variant?: ProductVariant;
  quantity: number;
  customTechnique?: string;
  customArtworkName?: string;
  calculatedUnitPrice: number;
}

// ==========================================
// SITE ANALYTICS TYPES (Métricas do Site)
// ==========================================

export type AnalyticsPeriod =
  | 'hoje'
  | 'ontem'
  | '7d'
  | '30d'
  | '90d'
  | 'este_mes'
  | 'mes_anterior'
  | 'este_ano'
  | 'personalizado';

export interface PageViewRecord {
  id: string;
  timestamp: string; // ISO string
  sessionId: string;
  visitorId: string;
  path: string;
  title: string;
  referrer: string;
  source: 'google' | 'instagram' | 'facebook' | 'whatsapp' | 'direto' | 'outros_sites' | 'outros';
  device: 'celular' | 'computador' | 'tablet';
  browser: 'Chrome' | 'Edge' | 'Safari' | 'Firefox' | 'Opera' | 'Outros';
  os: 'Android' | 'Windows' | 'iOS' | 'macOS' | 'Linux' | 'Outros';
  country: string;
  state: string; // e.g. 'SP', 'RJ', 'MG'
  city: string; // e.g. 'São Paulo', 'Campinas'
  durationSeconds: number;
  isNewVisitor: boolean;
}

export interface AnalyticsEventRecord {
  id: string;
  timestamp: string;
  sessionId: string;
  visitorId: string;
  eventName:
    | 'clique_whatsapp'
    | 'clique_telefone'
    | 'clique_instagram'
    | 'envio_formulario'
    | 'solicitacao_orcamento'
    | 'cadastro_cliente'
    | 'login_usuario'
    | 'download_catalogo'
    | 'visualizacao_produto'
    | 'adicionar_carrinho'
    | 'checkout_iniciado'
    | 'pedido_concluido';
  category: string;
  label?: string;
  value?: number;
  path: string;
  metadata?: Record<string, any>;
}

export interface RealtimeVisitor {
  id: string;
  visitorId: string;
  sessionId: string;
  lastActive: string; // ISO string
  currentPath: string;
  pageTitle: string;
  device: 'celular' | 'computador' | 'tablet';
  browser: string;
  location: string; // e.g. 'São Paulo - SP'
  source: string;
}

export interface MetricComparison {
  current: number;
  previous: number;
  deltaPercent: number; // e.g. +12.5 or -8.3
  isPositive: boolean;
}

export interface TopPageStat {
  path: string;
  title: string;
  views: number;
  uniques: number;
  avgTimeSeconds: number;
  bounceRate: number; // percentage
  exitRate: number; // percentage
}

export interface TrafficSourceStat {
  source: string;
  label: string;
  accessCount: number;
  visitors: number;
  sessions: number;
  conversionRate: number; // percentage
  percentage: number;
  color: string;
}

export interface GeoLocationStat {
  country: string;
  state: string;
  city: string;
  accessCount: number;
  percentage: number;
}

export interface EventSummaryStat {
  eventType: string;
  label: string;
  count: number;
  uniqueUsers: number;
  conversionRate: number;
  comparisonDelta: number; // % vs previous period
}

export interface DailyEvolutionPoint {
  date: string; // '2026-08-01' or '01/08'
  label: string;
  accessCount: number;
  uniqueVisitors: number;
  pageViews: number;
  newVisitors: number;
  returningVisitors: number;
}

export interface AgeGroupStat {
  range: string; // e.g. '18-24', '25-34', '35-44', '45-54', '55-64', '65+'
  accessPercentage: number;
  buyersPercentage: number;
  accessCount: number;
  buyersCount: number;
  conversionRate: number;
}

export interface GenderDemographicStat {
  gender: 'Feminino' | 'Masculino' | 'Outros / Não informado';
  accessPercentage: number;
  buyersPercentage: number;
  accessCount: number;
  buyersCount: number;
  conversionRate: number;
  color: string;
}

export interface CustomerSegmentStat {
  segment: string; // 'Empresas B2B / Corporativo', 'Agências / Eventos', 'Comércio / Varejo', 'Profissionais Liberais / MEI', 'Pessoa Física / Presentes'
  iconName: string;
  sharePercentage: number;
  ordersSharePercentage: number;
  avgTicket: number;
  favoriteCategories: string[];
  topProduct: string;
  conversionRate: number;
}

export interface PurchaseIntentStat {
  timeWindow: string; // 'Manhã (06h-12h)', 'Tarde (12h-18h)', 'Noite (18h-00h)', 'Madrugada (00h-06h)'
  accessShare: number;
  ordersShare: number;
  peakHour: string;
}

export interface ClientProfileReport {
  // Demographic breakdowns
  genders: GenderDemographicStat[];
  ageGroups: AgeGroupStat[];
  segments: CustomerSegmentStat[];
  peakTimes: PurchaseIntentStat[];
  
  // High-level insights & target audience recommendation
  topTargetAudience: {
    primaryGender: string;
    primaryAgeRange: string;
    primarySegment: string;
    highestConversionAge: string;
    highestTicketSegment: string;
    keyRecommendation: string;
    actionPlan: string[];
  };
}

export interface SiteMetricsReport {
  period: AnalyticsPeriod;
  periodLabel: string;
  startDate: string;
  endDate: string;
  comparisonPeriodLabel: string;
  lastUpdated: string;
  
  // KPI Cards
  totalAccesses: MetricComparison;
  uniqueVisitors: MetricComparison;
  pageViews: MetricComparison;
  avgPagesPerVisitor: number;
  totalSessions: MetricComparison;
  avgSessionDurationSeconds: number;
  bounceRate: MetricComparison;
  newVisitors: { count: number; percentage: number; comparison: MetricComparison };
  returningVisitors: { count: number; percentage: number; comparison: MetricComparison };
  
  // Charts & Distributions
  evolution: DailyEvolutionPoint[];
  trafficSources: TrafficSourceStat[];
  devices: { name: string; count: number; percentage: number; color: string }[];
  browsers: { name: string; count: number; percentage: number }[];
  operatingSystems: { name: string; count: number; percentage: number }[];
  
  // Demographics & Customer Profiling (Audience Intelligence)
  audienceProfile: ClientProfileReport;

  // Tables
  topPages: TopPageStat[];
  locations: GeoLocationStat[];
  topEvents: EventSummaryStat[];
  
  // Real-time snapshot
  activeVisitorsNow: number;
  realtimeList: RealtimeVisitor[];
}

// ==========================================
// SYSTEM LAYOUT & CUSTOMIZATION TYPES
// ==========================================

export type LayoutSectionType =
  | 'hero'
  | 'categories'
  | 'featured_products'
  | 'b2b_banner'
  | 'why_choose'
  | 'custom_banner';

export interface LayoutBlockConfig {
  id: string;
  type: LayoutSectionType;
  title: string;
  subtitle?: string;
  badge?: string;
  isVisible: boolean;
  order: number;
  customData?: {
    bannerImageUrl?: string;
    bannerLink?: string;
    buttonText?: string;
    description?: string;
    backgroundColor?: string;
  };
}

export interface LayoutColorSettings {
  primary: string; // ex: '#E6007E'
  secondary: string; // ex: '#00AEEF'
  accent: string; // ex: '#FFDD00'
  bodyBg: string; // ex: '#F8FAFC'
  topBannerBg: string; // ex: '#0F172A'
  topBannerText: string;
  headerBg: string; // ex: '#FFFFFF'
  headerText: string;
  footerBg: string; // ex: '#0B0F17'
  footerText: string;
  buttonPrimaryBg: string;
  buttonPrimaryText: string;
  priceColor: string; // ex: '#E6007E'
}

export interface HeroTitlePart {
  id: string;
  text: string;
  color: string;
  isHighlight?: boolean;
}

export interface LayoutHeroSettings {
  badgeText: string;
  titlePart1: string;
  titlePart1Color?: string; // Cor do texto Parte 1
  titleHighlight: string;
  titleHighlightColor?: string; // Cor do texto Palavra em Destaque
  titlePart2: string;
  titlePart2Color?: string; // Cor do texto Parte 2
  titleParts?: HeroTitlePart[]; // Lista dinâmica de múltiplas partes
  description: string;
  primaryCtaText: string;
  primaryCtaLink: string;
  primaryCtaVisible: boolean;
  secondaryCtaText: string;
  secondaryCtaLink: string;
  secondaryCtaVisible: boolean;
  tertiaryCtaText: string;
  tertiaryCtaLink: string;
  tertiaryCtaVisible: boolean;
  showcaseBadge: string;
  showcaseTitle: string;
  showcaseDescription: string;
  showcasePriceText: string;
  showcaseImageUrl: string;
  showcaseProductRef?: string;
  trustBadges: Array<{
    id: string;
    title: string;
    description: string;
    icon: string;
  }>;
}

export interface LayoutB2BBannerSettings {
  badge: string;
  title: string;
  description: string;
  benefits: string[];
  buttonText: string;
  buttonLink: string;
  secondaryButtonText: string;
  secondaryButtonLink: string;
  bgImageUrl?: string;
}

export interface LayoutWhyChooseSettings {
  title: string;
  subtitle: string;
  items: Array<{
    id: string;
    title: string;
    description: string;
    icon: string;
  }>;
}

export interface LayoutHeaderSettings {
  showTopBanner: boolean;
  topBannerText: string;
  topBannerWhatsappText: string;
  showCatalogPdfLink: boolean;
  showAboutLink: boolean;
  showContactLink: boolean;
  showSearchAutocomplete: boolean;
}

export interface LayoutFooterSettings {
  aboutText: string;
  copyrightText: string;
  showSocialLinks: boolean;
  showPaymentBadges: boolean;
  showSecurityBadge: boolean;
}

export interface SystemLayoutSettings {
  version: number;
  updatedAt: string;
  publishedAt?: string;
  colors: LayoutColorSettings;
  header: LayoutHeaderSettings;
  hero: LayoutHeroSettings;
  categoriesSection: {
    title: string;
    subtitle: string;
    limit: number;
  };
  featuredSection: {
    title: string;
    subtitle: string;
    limit: number;
  };
  b2bBanner: LayoutB2BBannerSettings;
  whyChoose: LayoutWhyChooseSettings;
  footer: LayoutFooterSettings;
  blocks: LayoutBlockConfig[];
}

