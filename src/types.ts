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
  // PDV e Pagamentos
  canAccessPDV: boolean;
  canOpenCloseCashRegister: boolean;
  canApplyDiscountPDV: boolean;
  canCancelPDVSale: boolean;
  canPerformSangriaSuprimento: boolean;
  canManagePaymentGateways: boolean;
  canViewFinancialTransactions: boolean;
  canManageMaintenanceMode: boolean;
  // Módulo Financeiro — Controle de Acesso e Segurança (Restrito)
  canViewFinancialModule: boolean;
  canViewFinancialDashboard: boolean;
  canViewReceivables: boolean;
  canCreateReceivable: boolean;
  canEditReceivable: boolean;
  canReceivePayment: boolean;
  canCancelReceivable: boolean;
  canRefundReceivable: boolean;
  canViewPayables: boolean;
  canCreatePayable: boolean;
  canEditPayable: boolean;
  canPayBill: boolean;
  canCancelPayable: boolean;
  canRefundPayable: boolean;
  canViewCashFlow: boolean;
  canViewRealizedValues: boolean;
  canViewProjectedValues: boolean;
  canViewFinancialReports: boolean;
  canExportFinancialReports: boolean;
  canManageFinancialCategories: boolean;
  canManageCostCenters: boolean;
  canManageBankAccounts: boolean;
  canManagePaymentMethods: boolean;
  canManageRecurringTransactions: boolean;
  canManageFinancialSettings: boolean;
  canViewFinancialAudit: boolean;
  // Configurações de Atendimento e Entrega
  canManageDeliverySettings?: boolean;
  // Regras de Faturamento e Boletos
  canConfigureBoletoRules?: boolean;
  canAuthorizeDeferredBoleto?: boolean;
  // Módulo de Orçamento de Custos e Precificação de Produtos
  canViewCostPricingModule?: boolean;
  canViewCostsAndCompositions?: boolean;
  canManageCosts?: boolean;
  canManageMachines?: boolean;
  canConfigureDepreciation?: boolean;
  canConfigurePricingParameters?: boolean;
  canCreateEditCostQuotes?: boolean;
  canApprovePricesAndDiscounts?: boolean;
  canViewPricingReports?: boolean;
  canExportPricingReports?: boolean;
  // Módulo de Cupons de Desconto & Promoções
  canViewCoupons?: boolean;
  canCreateCoupons?: boolean;
  canEditCoupons?: boolean;
  canToggleCoupons?: boolean;
  canCancelCoupons?: boolean;
  canViewCouponUsageHistory?: boolean;
  canViewCouponReports?: boolean;
  canSendCouponsToCustomers?: boolean;
  // Catálogo Digital em PDF (Acesso restrito a Admin/autorizados)
  canAccessCatalogPdf?: boolean;
}

export type PermissionKey = keyof RolePermissions;
export type PriceVisibilityMode = 'registered_only' | 'all';

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

// ==========================================
// CONFIGURAÇÕES DE ATENDIMENTO E FORMAS DE ENTREGA
// ==========================================
export type ServiceCoverageType = 'municipal' | 'estadual' | 'nacional';

export interface CoverageExceptionItem {
  id: string;
  type: 'allow_city' | 'allow_zip_range' | 'block_city';
  name: string;
  state: string;
  city?: string;
  startZip?: string;
  endZip?: string;
}

export interface MunicipalCoverageConfig {
  state: string; // ex: 'SP'
  city: string; // ex: 'São Paulo'
  exceptions: CoverageExceptionItem[];
}

export interface StateCoverageConfig {
  state: string; // ex: 'SP'
  exceptions: CoverageExceptionItem[];
}

export interface ServiceRegionSettings {
  coverageType: ServiceCoverageType;
  municipalConfig: MunicipalCoverageConfig;
  stateConfig: StateCoverageConfig;
  allowPickupOutOfCoverage: boolean; // Permitir que cliente fora da área escolha 'Retirada no estabelecimento'
  blockedMessageCustom?: string;
  updatedAt: string;
}

export type ShippingMethodType = 'correios' | 'transportadora' | 'retirada' | 'personalizado';

export interface ShippingMethodItem {
  id: string;
  name: string; // ex: 'Correios SEDEX', 'Transportadora — Frete a Combinar', 'Retirada no Estabelecimento'
  description: string;
  type: ShippingMethodType;
  enabled: boolean;
  order: number; // Ordem de exibição na finalização da compra
  coverageScope: 'inherit' | 'municipal' | 'estadual' | 'nacional' | 'custom_states';
  allowedStates?: string[]; // Quando coverageScope === 'custom_states'
  fixedPrice?: number;
  estimatedDays?: number;
  freeShippingAbove?: number;
  correiosServiceCode?: '04014' | '04510' | '04782' | '04790' | '38202' | string;
  correiosAdditionalDays?: number;
  carrierOptions?: string[]; // e.g. ['Braspress', 'Jadlog', 'Total Express', 'Rodonaves']
  pickupAddress?: string;
  pickupInstructions?: string;
  pickupHours?: string;
  pickupReadyCondition?: string;
  rulesNotes?: string;
}

export interface CorreiosIntegrationConfig {
  enabled: boolean;
  originZip: string; // CEP de origem da MB Personaliza (ex: '05303-000')
  useContract: boolean;
  user?: string; // Usuário CWS / Meu Correios
  passwordOrToken?: string; // Token CWS / Chave de Acesso
  contractNumber?: string;
  postageCard?: string;
  serviceSedexCode?: string; // 04014 ou código contratual
  servicePacCode?: string; // 04510 ou código contratual
  additionalHandlingDays?: number;
  insuranceDeclaredValue?: boolean;
  statusNotes?: string;
}

export interface DeliveryAndShippingSettings {
  serviceRegion: ServiceRegionSettings;
  correiosConfig: CorreiosIntegrationConfig;
  methods: ShippingMethodItem[];
  carriersList: string[]; // Lista de transportadoras parceiras cadastradas
  updatedAt: string;
}

export interface ProductShippingDimensions {
  weightKg: number; // Peso líquido com embalagem em kg (mínimo 0.05kg)
  heightCm: number; // Altura em cm (mínimo 2cm)
  widthCm: number; // Largura em cm (mínimo 11cm)
  lengthCm: number; // Comprimento em cm (mínimo 16cm)
  unitsPerPackage?: number;
  specialPackaging?: boolean;
  shippingRestrictions?: 'none' | 'only_local' | 'no_correios';
}

export interface OrderShippingHistoryEntry {
  id: string;
  date: string;
  action: string;
  actor: string;
  details: string;
}

export interface OrderShippingInfo {
  methodId: string;
  methodName: string;
  methodType: ShippingMethodType;
  carrierName?: string;
  originZip?: string;
  destinationZip?: string;
  cost: number;
  estimatedDeliveryDays?: number;
  estimatedDeliveryDate?: string;
  freightStatus?: 'aguardando_cotacao' | 'proposta_enviada' | 'aprovado' | 'recusado' | 'definido';
  negotiatedCost?: number;
  negotiatedCarrier?: string;
  negotiatedDeadlineDays?: number;
  proposalNotes?: string;
  customerResponseNotes?: string;
  proposalSentAt?: string;
  customerRespondedAt?: string;
  history?: OrderShippingHistoryEntry[];
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
  deliverySettings?: DeliveryAndShippingSettings;
  maintenance?: MaintenanceSettings;
  updatedAt: string;
}

export interface MaintenanceModeAuditEntry {
  id: string;
  action: 'activated' | 'deactivated' | 'config_updated';
  timestamp: string;
  performedBy: {
    id: string;
    name: string;
    email: string;
    role: UserRole;
  };
  details?: string;
}

export interface MaintenanceSettings {
  enabled: boolean;
  title: string;
  headline: string;
  message: string;
  returnAt?: string;
  showCompanyLogo?: boolean;
  showContacts?: boolean;
  themeStyle?: 'brand_gradient' | 'modern_dark' | 'clean_light';
  iconType?: 'tools' | 'cog' | 'server' | 'sparkles' | 'rocket';
  customBgColor?: string;
  customTextColor?: string;
  allowedRoles?: UserRole[];
  auditLog?: MaintenanceModeAuditEntry[];
  updatedAt?: string;
  updatedBy?: {
    id: string;
    name: string;
    email: string;
    role?: UserRole;
  };
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
  favoriteProductIds?: string[];
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
  barcode?: string;
  colorHex?: string;
  size?: string;
  material?: string;
  stock_qty: number;
  additional_price?: number;
}

export interface Product {
  id: string;
  code: string;
  barcode?: string; // Código de barras EAN-13, GTIN ou Code-128
  qrCode?: string; // Identificador ou payload do QR Code
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

  // Banner de Ofertas
  showInOffersBanner?: boolean;
  offersBannerOrder?: number;
  offersBannerImage?: string;
  offersBannerBadge?: string;
  offerStartDate?: string;
  offerEndDate?: string;
  shippingDimensions?: ProductShippingDimensions;
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
  billingTerms?: QuoteBillingTerms;
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
  couponCode?: string;
  couponId?: string;
  couponDiscount?: number;
  couponInfo?: OrderCouponInfo;
  shippingCost: number;
  shippingInfo?: OrderShippingInfo;
  total: number;
  paymentMethod: 'pix' | 'credit_card' | 'boleto' | 'boleto_faturado' | 'faturado_pj';
  paymentStatus: 'pago' | 'pendente' | 'aprovado' | 'cancelado';
  orderStatus: 'novo' | 'em_producao' | 'pronto' | 'entregue' | 'cancelado';
  sourceQuoteId?: string;
  trackingCode?: string;
  notes?: string;
  billingTerms?: QuoteBillingTerms;
  boletos?: BoletoTitulo[];
  createdAt: string;
  updatedAt?: string;
}

// ==========================================
// MÓDULO DE CUPONS DE DESCONTO & PROMOÇÕES
// ==========================================

export type CouponDiscountType = 'percentage' | 'fixed';
export type CouponStatus = 'draft' | 'active' | 'paused' | 'expired' | 'cancelled';
export type CouponTargetType = 'all_store' | 'categories' | 'products';
export type CouponCustomerRestriction = 'general' | 'specific_customers';

export interface OrderCouponInfo {
  couponId: string;
  code: string;
  campaignName: string;
  discountType: CouponDiscountType;
  discountValue: number;
  discountApplied: number;
  originalSubtotal: number;
  eligibleSubtotal: number;
  appliedAt: string;
  customerIdentified?: string;
}

export interface DiscountCoupon {
  id: string;
  code: string; // Ex: PRIMEIRACOMPRA, MBVIP10, DESCONTO50
  campaignName: string; // Nome da campanha ou descrição
  discountType: CouponDiscountType; // 'percentage' | 'fixed'
  discountValue: number; // e.g. 10 (%) ou 50.00 (R$)
  startDate: string; // ISO ou YYYY-MM-DDTHH:mm
  endDate: string; // ISO ou YYYY-MM-DDTHH:mm
  minPurchaseAmount?: number; // Valor mínimo de compra elegível
  maxDiscountAmount?: number; // Teto de desconto em R$ (ex: 15% até R$ 150)
  maxUsageTotal?: number; // Quantidade máxima de utilizações globais
  maxUsagePerCustomer?: number; // Limite de utilizações por cliente (e-mail/CPF)
  targetType: CouponTargetType; // 'all_store' | 'categories' | 'products'
  targetCategoryIds?: string[];
  targetProductIds?: string[];
  customerRestriction: CouponCustomerRestriction; // 'general' | 'specific_customers'
  specificCustomerIds?: string[];
  specificCustomerEmails?: string[];
  canCombineWithPromotions: boolean; // Se acumula com produtos em promoção (promo_price)
  status: CouponStatus;
  internalNotes?: string;
  currentUsageCount: number; // Quantidade de vezes que já foi utilizado
  totalDiscountGranted: number; // R$ total concedido em descontos
  totalSalesVolume: number; // R$ total faturado em pedidos com este cupom
  sentCount: number; // Quantidade de envios para clientes
  createdAt: string;
  createdByUserId: string;
  createdByUserName: string;
  updatedAt?: string;
}

export interface CouponUsageEntry {
  id: string;
  couponId: string;
  couponCode: string;
  orderId: string;
  orderCode: string;
  customerId?: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  customerCpfCnpj?: string;
  subtotalOriginal: number;
  eligibleAmount: number;
  discountApplied: number;
  shippingCost: number;
  finalTotal: number;
  usedAt: string;
  status: 'confirmed' | 'cancelled' | 'refunded';
  cancelledAt?: string;
  cancelReason?: string;
}

export interface CouponSendHistoryEntry {
  id: string;
  couponId: string;
  couponCode: string;
  customerId?: string;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  channel: 'whatsapp' | 'email' | 'clipboard';
  sentAt: string;
  sentByUserId: string;
  sentByUserName: string;
  messagePreview: string;
  status: 'copied' | 'shared_whatsapp' | 'sent_email';
}

export interface CouponAuditLog {
  id: string;
  timestamp: string;
  couponId?: string;
  couponCode?: string;
  action:
    | 'create'
    | 'update'
    | 'activate'
    | 'pause'
    | 'cancel'
    | 'delete'
    | 'send'
    | 'apply_cart'
    | 'confirm_order'
    | 'revert_cancel';
  userId: string;
  userName: string;
  userRole: string;
  details: string;
  ip?: string;
}

export interface CouponValidationResult {
  valid: boolean;
  coupon?: DiscountCoupon;
  discountAmount: number;
  originalSubtotal: number;
  eligibleSubtotal: number;
  finalSubtotalAfterCoupon: number;
  error?: string;
  errorCode?:
    | 'NOT_FOUND'
    | 'INACTIVE'
    | 'EXPIRED'
    | 'NOT_STARTED'
    | 'MIN_PURCHASE_NOT_MET'
    | 'MAX_USAGE_REACHED'
    | 'CUSTOMER_LIMIT_REACHED'
    | 'CUSTOMER_NOT_AUTHORIZED'
    | 'CUSTOMER_NOT_ELIGIBLE'
    | 'NO_ELIGIBLE_PRODUCTS'
    | 'NO_ELIGIBLE_ITEMS'
    | 'CANNOT_COMBINE_PROMO';
  message?: string;
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
  | 'offers_banner'
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

export type OffersBannerTransition = 'fade' | 'slide_horizontal' | 'slide_vertical' | 'zoom';

export type OffersBannerBackgroundTheme =
  | 'industrial_light'   // Studio concreto claro (Campeões da Obra / Ferramentas / Loja)
  | 'holiday_festive'    // Verde e dourado festivo (Então já é Natal / Fim de ano)
  | 'dark_tech'          // Studio grafite escuro (Upgrade na sua Jornada / Linha Dark)
  | 'modern_lavender'    // Lavanda e azul tech suave (Tech que Cabe no seu Bolso)
  | 'vibrant_green'      // Verde vibrante de e-commerce (Frete Grátis)
  | 'corporate_pink'     // Rosa magenta MB Personaliza
  | 'custom';            // Cor ou gradiente personalizado

export interface OffersBannerProductConfig {
  id?: string;
  productId: string;
  order: number;
  active: boolean;
  customTitle?: string;
  customSubtitle?: string;
  customDescription?: string;
  customImage?: string;
  secondaryImage?: string;
  backgroundTheme?: OffersBannerBackgroundTheme;
  customBgColor?: string;
  customBgImage?: string;
  customTextColor?: string;
  imagePosition?: 'center' | 'left' | 'right' | 'bottom';
  imagePositionHorizontal?: 'left' | 'center' | 'right';
  imagePositionVertical?: 'top' | 'center' | 'bottom';
  imageFit?: 'contain' | 'cover';
  promoPrice?: number;
  startDate?: string;
  endDate?: string;
  badge?: string;
  badgeColor?: 'black' | 'yellow' | 'green' | 'blue' | 'pink';
  benefitBadge?: string;
  benefitBadge2?: string;
  validityText?: string;
  ctaText?: string;
  targetLink?: string;
}

export interface OffersBannerSettings {
  enabled: boolean;
  title: string;
  subtitle: string;
  badgeText: string;
  autoplay: boolean;
  intervalMs: number;
  transitionSpeedMs: number;
  transitionType: OffersBannerTransition;
  showArrows: boolean;
  showDots: boolean;
  showProgressBar: boolean;
  showCtaButton: boolean;
  ctaButtonText: string;
  disclaimerText?: string;
  height: 'panoramic' | 'compact' | 'normal' | 'tall';
  fullWidth: boolean;
  autoOrderCriteria: 'custom' | 'discount_desc' | 'featured' | 'newest';
  maxSlides?: number;
  items: OffersBannerProductConfig[];
}

export interface SystemLayoutSettings {
  version: number;
  updatedAt: string;
  publishedAt?: string;
  colors: LayoutColorSettings;
  header: LayoutHeaderSettings;
  hero: LayoutHeroSettings;
  offersBanner: OffersBannerSettings;
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

// ==========================================
// GATEWAYS DE PAGAMENTO & TRANSAÇÕES
// ==========================================

export type PaymentGatewayProvider = 'mercadopago' | 'pagbank' | 'manual';
export type PaymentEnvironment = 'sandbox' | 'production';
export type PaymentTransactionStatus =
  | 'aguardando'
  | 'processando'
  | 'aprovado'
  | 'recusado'
  | 'cancelado'
  | 'estornado'
  | 'erro'
  | 'expirado';

export interface PaymentGatewayConfig {
  id: string;
  provider: PaymentGatewayProvider;
  name: string;
  enabled: boolean;
  environment: PaymentEnvironment;
  // Credenciais Mercado Pago
  mpPublicKey?: string;
  mpAccessToken?: string;
  mpWebhookSecret?: string;
  // Credenciais PagBank
  pbPublicKey?: string;
  pbToken?: string;
  pbWebhookSecret?: string;
  // Meios Aceitos
  acceptedMethods: {
    creditCard: boolean;
    pix: boolean;
    debitCard: boolean;
    boleto: boolean;
  };
  maxInstallments: number;
  interestFreeInstallments: number;
  feePercentageCredit: number; // ex: 3.99%
  feePercentagePix: number; // ex: 0.99%
  autoApproveSandbox: boolean;
  updatedAt: string;
}

export interface PaymentTransaction {
  id: string;
  saleId: string; // ID do pedido ou venda PDV
  saleCode: string; // PED-2026-XXXX ou PDV-2026-XXXX
  origin: 'loja_online' | 'pdv' | 'orcamento';
  customerName: string;
  customerCpfCnpj?: string;
  gateway: PaymentGatewayProvider;
  gatewayTransactionId?: string;
  method: 'credit_card' | 'debit_card' | 'pix' | 'dinheiro' | 'boleto' | 'multiplo';
  installments: number;
  installmentValue?: number;
  grossAmount: number;
  feeAmount: number;
  netAmount: number;
  status: PaymentTransactionStatus;
  statusDetail?: string;
  qrCodePix?: string;
  qrCodePixText?: string;
  operatorId?: string;
  operatorName?: string;
  cardLastFour?: string;
  cardBrand?: string;
  metadata?: Record<string, any>;
  history: {
    timestamp: string;
    status: PaymentTransactionStatus;
    note: string;
    operator?: string;
  }[];
  createdAt: string;
  updatedAt: string;
}

// ==========================================
// MÓDULO PDV (PONTO DE VENDA LOJA FÍSICA)
// ==========================================

export interface PDVSaleItem {
  id: string;
  productId: string;
  productName: string;
  productSku: string;
  productImage?: string;
  variantId?: string;
  variantName?: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  total: number;
  customizationNote?: string;
  customArtworkName?: string;
}

export interface PDVPaymentSplit {
  method: 'dinheiro' | 'pix' | 'cartao_credito' | 'cartao_debito' | 'outro';
  amount: number;
  gateway?: PaymentGatewayProvider;
  installments?: number;
  gatewayTransactionId?: string;
  cardBrand?: string;
  receivedAmount?: number;
  changeAmount?: number;
}

export interface PDVSale {
  id: string;
  code: string; // PDV-2026-0001
  cashRegisterId: string;
  cashRegisterNumber: number;
  operatorId: string;
  operatorName: string;
  customerId?: string;
  customerName: string;
  customerCpfCnpj?: string;
  customerPhone?: string;
  customerEmail?: string;
  items: PDVSaleItem[];
  subtotal: number;
  discount: number;
  additions: number;
  total: number;
  payments: PDVPaymentSplit[];
  status: 'concluida' | 'cancelada' | 'pendente';
  cancellationReason?: string;
  cancelledAt?: string;
  cancelledBy?: string;
  isCustomized: boolean;
  productionDays?: number;
  productionStatus?: 'aguardando_arte' | 'em_producao' | 'pronto' | 'entregue';
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface CashRegisterMovement {
  id: string;
  registerId: string;
  type: 'abertura' | 'fechamento' | 'venda' | 'sangria' | 'suprimento' | 'estorno';
  amount: number;
  paymentMethod?: string;
  reason: string;
  saleId?: string;
  operatorId: string;
  operatorName: string;
  createdAt: string;
}

export interface CashRegisterSession {
  id: string;
  registerNumber: number;
  registerName: string;
  operatorId: string;
  operatorName: string;
  openedAt: string;
  closedAt?: string;
  initialFund: number;
  status: 'aberto' | 'fechado';
  totalSalesCount: number;
  totalSalesAmount: number;
  totalCashSales: number;
  totalPixSales: number;
  totalDebitSales: number;
  totalCreditSales: number;
  totalSangrias: number;
  totalSuprimentos: number;
  expectedCash: number;
  actualCash?: number;
  cashDifference?: number;
  closingNotes?: string;
  movements: CashRegisterMovement[];
}

export interface PDVSettings {
  registerNumber: number;
  registerName: string;
  defaultOperatorId?: string;
  allowNegativeStock: boolean;
  maxDiscountPercent: number;
  mandatoryCashOpening: boolean;
  autoPrintReceipt: boolean;
  defaultGateway: PaymentGatewayProvider;
  receiptHeaderCustomText?: string;
  receiptFooterCustomText?: string;
}

// ============================================================================
// MÓDULO FINANCEIRO (CONTAS A RECEBER, PAGAR, FLUXO DE CAIXA, AUDITORIA)
// ============================================================================

export type FinancialAccountType = 'receber' | 'pagar';
export type FinancialAccountStatus = 'pendente' | 'pago' | 'vencido' | 'cancelado' | 'estornado';

export interface FinancialAccount {
  id: string;
  code: string; // ex: REC-2026-001 ou PAG-2026-001
  type: FinancialAccountType;
  description: string;
  entityName: string; // Nome do Cliente ou Fornecedor
  entityDocument?: string; // CPF / CNPJ
  amount: number;
  dueDate: string; // ISO string YYYY-MM-DD
  issueDate: string; // ISO string
  paymentDate?: string; // Data da liquidação/baixa
  status: FinancialAccountStatus;
  categoryId: string;
  categoryName: string;
  costCenterId?: string;
  costCenterName?: string;
  bankAccountId?: string;
  bankAccountName?: string;
  paymentMethod?: string;
  orderCode?: string; // Vínculo com Pedido de Venda / Compra
  quoteCode?: string; // Vínculo com Orçamento
  paidAmount?: number;
  interestAmount?: number;
  discountAmount?: number;
  notes?: string;
  // Campos de controle de cancelamento e estorno
  cancelledAt?: string;
  cancelledBy?: string;
  cancelledByName?: string;
  cancellationReason?: string;
  refundedAt?: string;
  refundedBy?: string;
  refundedByName?: string;
  refundReason?: string;
  createdBy: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
}

export interface FinancialCategory {
  id: string;
  name: string;
  type: 'receita' | 'despesa' | 'ambos';
  color?: string;
  active: boolean;
  description?: string;
}

export interface CostCenter {
  id: string;
  code: string;
  name: string;
  active: boolean;
  description?: string;
}

export interface BankAccount {
  id: string;
  name: string;
  bankName: string;
  agency: string;
  accountNumber: string;
  accountType: 'corrente' | 'poupanca' | 'caixa_fisico' | 'carteira_digital';
  initialBalance: number;
  currentBalance: number;
  isDefault: boolean;
  active: boolean;
}

export interface FinancialPaymentMethod {
  id: string;
  name: string;
  code: string;
  taxPercent: number;
  daysToClear: number;
  active: boolean;
}

export interface FinancialRecurringTransaction {
  id: string;
  type: FinancialAccountType;
  description: string;
  entityName: string;
  amount: number;
  frequency: 'mensal' | 'semanal' | 'quinzenal' | 'anual';
  dueDay: number;
  categoryId: string;
  costCenterId?: string;
  active: boolean;
  nextDueDate: string;
}

export interface FinancialSettings {
  defaultDueDays: number;
  interestRateMonthly: number;
  penaltyRatePercent: number;
  alertDueDaysBefore: number;
  lockPastTransactions: boolean;
  requireReasonOnCancel: boolean;
  requireReasonOnRefund: boolean;
  allowPartialSettlement: boolean;
  autoSyncPDVSales: boolean;
  updatedAt: string;
  updatedBy?: string;
}

export interface FinancialAuditEntry {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  userEmail: string;
  userRole: UserRole;
  operation: string; // e.g. 'ACESSO_MODULO', 'CRIAR_CONTA', 'BAIXAR_CONTA', 'CANCELAR_CONTA', 'ESTORNAR_PAGAMENTO', 'EXPORTAR_RELATORIO', 'CONCEDER_PERMISSAO', 'REMOVER_PERMISSAO', 'ACESSO_NEGADO'
  permissionUsed?: string;
  affectedRecordId?: string;
  affectedRecordType?: string; // 'conta_receber' | 'conta_pagar' | 'permissao' | 'configuracao' | 'relatorio'
  result: 'sucesso' | 'bloqueado' | 'erro';
  details: string;
  origin?: string; // 'web_painel' | 'api' | 'pdv'
  ip?: string;
  previousValues?: any;
  newValues?: any;
}

// ==========================================
// BACKUP E RECUPERAÇÃO DE DESASTRES (JSON SEGURO)
// ==========================================

export type BackupFrequency = 'hourly' | 'daily' | 'weekly' | 'custom_interval';

export interface BackupScheduleConfig {
  enabled: boolean;
  frequency: BackupFrequency;
  intervalHours: number; // Ex: a cada 6, 12, 24 horas
  scheduledTime: string; // Ex: "03:00" (madrugada para menor impacto)
  daysOfWeek: number[]; // [0=Dom, 1=Seg, ..., 6=Sáb]
  retentionCount: number; // Ex: manter os últimos 15 ou 30 backups
  retentionDays: number; // Ex: 30 dias
  // Entidades cobertas
  includeProducts: boolean; // Produtos, variações, categorias, subcategorias
  includeQuotes: boolean; // Orçamentos
  includeOrders: boolean; // Pedidos e itens
  includeStock: boolean; // Movimentações de estoque
  includeCustomers: boolean; // Clientes cadastrados
  includeSettings: boolean; // Configurações da empresa e layout
  // Camada de segurança
  encryptPayload: boolean; // Criptografia/assinatura estendida
  securitySalt?: string;
  autoDownloadBrowser: boolean; // Baixar automaticamente no navegador quando disparado
  saveOnServer: boolean; // Salvar cópia no servidor Express
  lastRunAt?: string;
  lastRunStatus?: 'success' | 'warning' | 'error';
  lastRunMessage?: string;
  nextRunAt?: string;
  updatedAt: string;
}

export interface BackupMetadata {
  system: string; // "MB Personaliza"
  appletId: string;
  version: string;
  exportTimestamp: string;
  exportType: 'scheduled' | 'manual' | 'disaster_recovery_preflight';
  schemaVersion: '1.0.0';
  counts: {
    products: number;
    categories: number;
    subcategories: number;
    quotes: number;
    orders: number;
    stockMovements: number;
    customers: number;
  };
  security: {
    algorithm: 'SHA-256';
    checksumSha256: string;
    signature: string;
    encrypted: boolean;
    integrityVerified: boolean;
  };
  disasterRecoveryNote: string;
}

export interface SecureBackupPayload {
  metadata: BackupMetadata;
  data: {
    products: Product[];
    categories: Category[];
    subcategories?: Subcategory[];
    quotes: Quote[];
    orders: Order[];
    stockMovements?: StockMovement[];
    customers?: UserProfile[];
    companySettings?: CompanySettings;
  };
}

export interface BackupHistoryEntry {
  id: string;
  filename: string;
  timestamp: string;
  sizeBytes: number;
  sizeFormatted: string;
  checksum: string;
  trigger: 'scheduled' | 'manual' | 'disaster_recovery_preflight';
  status: 'success' | 'failed' | 'verified';
  counts: {
    products: number;
    quotes: number;
    orders: number;
  };
  downloadUrl?: string;
  storedOnServer?: boolean;
  error?: string;
}

export interface BackupVerificationResult {
  valid: boolean;
  checksumMatches: boolean;
  calculatedChecksum: string;
  statedChecksum: string;
  metadata?: BackupMetadata;
  counts?: {
    products: number;
    quotes: number;
    orders: number;
    categories: number;
  };
  errors: string[];
  warnings: string[];
}

// ==========================================
// REGRAS DE BOLETO BANCÁRIO & FATURAMENTO A PRAZO
// ==========================================

export type BoletoStatus = 'pendente' | 'pago' | 'vencido' | 'cancelado';
export type BoletoTipoCobranca = 'a_vista' | 'faturado_prazo';

export interface BoletoTitulo {
  id: string; // ex: bol-2026-0001
  nossoNumero: string; // ex: 109/98234123-5
  linhaDigitavel: string; // 34191.79001 01043.510047 91020.150008 8 98450000015000
  codigoBarras: string; // 44 dígitos FEBRABAN
  bancoEmissor: string; // "341 - Banco Itaú S.A."
  bancoCodigo: string; // "341"
  carteira: string; // "109"
  especieDoc: string; // "DM" (Duplicata Mercantil)
  aceite: string; // "N"
  dataEmissao: string; // ISO
  dataVencimento: string; // YYYY-MM-DD
  dataProcessamento: string; // ISO
  valorOriginal: number;
  valorPago?: number;
  saldoAberto: number;
  dataLiquidacao?: string;
  status: BoletoStatus;
  tipoCobranca: BoletoTipoCobranca;
  parcelaNumero: number;
  totalParcelas: number;
  condicaoPagamento: string; // "À Vista" | "28 DDL" | "30/60 DDL" | etc.
  
  // Vínculos com o ecossistema comercial e financeiro
  orderId: string;
  orderCode: string;
  quoteId?: string;
  quoteCode?: string;
  financialAccountId?: string; // ID do título correspondente no Contas a Receber
  
  // Dados do Sacado (Cliente)
  sacadoNome: string;
  sacadoCpfCnpj: string;
  sacadoTipo: 'PF' | 'PJ';
  sacadoEndereco?: string;
  sacadoEmail?: string;
  
  // Dados do Beneficiário (MB Personaliza)
  beneficiarioNome: string;
  beneficiarioCnpj: string;
  beneficiarioEndereco: string;
  
  // Encargos & Instruções
  multaPercentual: number;
  jurosMensalPercentual: number;
  instrucoes: string[];
  
  // Auditoria
  createdAt: string;
  updatedAt: string;
}

export interface QuoteBillingInstallment {
  installmentNumber: number;
  amount: number;
  dueDate: string; // YYYY-MM-DD
  daysFromApproval?: number;
  notes?: string;
}

export interface QuoteBillingTerms {
  type: BoletoTipoCobranca;
  isDeferredAuthorized: boolean; // Autorizado pelo gestor comercial/financeiro
  conditionName: string; // ex: "28 DDL", "30/60 DDL", "À Vista"
  daysInterval: number[]; // ex: [28] ou [30, 60] ou [30, 60, 90]
  installmentsCount: number; // 1, 2, 3, etc.
  customInstallments?: QuoteBillingInstallment[];
  
  // Alçada e Aprovações
  commercialApprovalStatus: 'pendente' | 'aprovado' | 'rejeitado';
  commercialApprovedBy?: string;
  commercialApprovedAt?: string;
  financialApprovalStatus: 'pendente' | 'aprovado' | 'rejeitado' | 'dispensado';
  financialApprovedBy?: string;
  financialApprovedAt?: string;
  notes?: string;
}

export interface BoletoBillingSettings {
  cashBoletoDueDays: number; // Dias padrão de vencimento para boleto à vista (ex: 2)
  allowDeferredForCommercialProposals: boolean; // Habilitar prazo para propostas comerciais
  allowDeferredForCustomQuotes: boolean; // Habilitar prazo para orçamentos personalizados
  maxDeferredDays: number; // Prazo máximo de vencimento (ex: 90 dias)
  maxInstallments: number; // Quantidade máxima de parcelas (ex: 6)
  requireFinancialApprovalOverAmount: number; // Valor limite para aprovação financeira obrigatória (ex: 5000)
  requireFinancialApprovalForDeferred: boolean; // Exigir aprovação financeira sempre que houver faturamento a prazo
  standardPaymentTerms: string[]; // ["À Vista", "14 DDL", "28 DDL", "30/60 DDL", "30/60/90 DDL", "Personalizado"]
  defaultBankName: string; // "341 - Banco Itaú Unibanco S.A."
  defaultBankCode: string; // "341"
  carteira: string; // "109"
  finePercent: number; // 2.0%
  monthlyInterestPercent: number; // 1.0%
  commonPurchaseNoticeText: string;
  updatedAt: string;
  updatedBy?: string;
}

// ============================================================================
// MÓDULO DE ORÇAMENTO DE CUSTOS E PRECIFICAÇÃO DE PRODUTOS
// ============================================================================

export type RawMaterialCategory =
  | 'papeis'
  | 'vinis_lonas'
  | 'tintas_toners'
  | 'sublimacao_transfer'
  | 'produtos_base'
  | 'embalagens'
  | 'acabamentos'
  | 'outros';

export type PurchaseUnit =
  | 'resma'
  | 'pacote'
  | 'caixa'
  | 'rolo'
  | 'litro'
  | 'kg'
  | 'unidade'
  | 'm2'
  | 'cento'
  | 'milheiro';

export type ConsumptionUnit =
  | 'folha'
  | 'unidade'
  | 'm2'
  | 'ml'
  | 'g'
  | 'metro'
  | 'cm';

export interface RawMaterial {
  id: string;
  code: string; // ex: MP-001
  name: string; // ex: Papel Couchê 250g A4
  category: RawMaterialCategory;
  supplier: string; // ex: Papirus / Suzano / Distribuidor ABC
  purchaseUnit: PurchaseUnit; // ex: resma
  consumptionUnit: ConsumptionUnit; // ex: folha
  conversionFactor: number; // ex: 500 (folhas por resma)
  purchasePrice: number; // Preço de compra (R$)
  shippingCost: number; // Frete e custos de aquisição adicionais (R$)
  nonRecoverableTaxes: number; // Impostos não recuperáveis (R$)
  estimatedWastePercent: number; // Perdas estimadas (%)
  currentStock: number; // Quantidade atual em estoque na unidade de consumo
  stockReferenceId?: string; // ID do produto do catálogo geral, caso vinculado
  
  // Custos calculados
  effectivePurchaseCost: number; // purchasePrice + shippingCost + nonRecoverableTaxes
  costPerConsumptionUnit: number; // effectivePurchaseCost / conversionFactor
  costWithWaste: number; // costPerConsumptionUnit * (1 + estimatedWastePercent/100)
  
  lastCostUpdate: string; // Data ISO
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export type MachineStatus = 'ativo' | 'manutencao' | 'inativo';
export type DepreciationMethod = 'linear' | 'horas_uso';

export interface MachineEquipment {
  id: string;
  code: string; // ex: MAQ-001
  name: string; // ex: Impressora Laser de Produção A3+
  brandModel: string; // ex: Konica Minolta AccurioPrint C4065
  assetNumber: string; // Patrimônio: PAT-2024-08
  acquisitionDate: string; // YYYY-MM-DD
  acquisitionValue: number; // R$
  capitalizedCosts: number; // Frete, instalação, transformador (R$)
  depreciableValue: number; // acquisitionValue + capitalizedCosts - residualValue
  residualValue: number; // Valor residual estimado ao fim da vida útil (R$)
  usefulLifeMonths: number; // Vida útil em meses (ex: 60 meses = 5 anos)
  depreciationMethod: DepreciationMethod; // Linear padrão
  monthlyProductiveHours: number; // Horas disponíveis por mês (ex: 176h)
  
  // Depreciação calculada
  monthlyDepreciation: number; // (depreciableValue) / usefulLifeMonths
  depreciationPerHour: number; // monthlyDepreciation / monthlyProductiveHours
  depreciationPerMinute: number; // depreciationPerHour / 60
  
  // Custos Operacionais
  energyPowerWatts: number; // Potência em Watts (ex: 2200W)
  energyConsumptionKwh: number; // energyPowerWatts / 1000 = 2.2 kWh
  energyTariffKwh: number; // R$ por kWh (ex: R$ 0.85)
  energyCostPerHour: number; // energyConsumptionKwh * energyTariffKwh
  
  monthlyMaintenanceCost: number; // Contrato ou provisão de manutenção mensal (R$)
  maintenanceCostPerHour: number; // monthlyMaintenanceCost / monthlyProductiveHours
  monthlyReplacementPartsCost: number; // Peças e cilindros mensais (R$)
  replacementPartsCostPerHour: number; // monthlyReplacementPartsCost / monthlyProductiveHours
  otherOperationalCostPerHour: number; // Outros custos operacionais por hora
  
  totalOperationalCostPerHour: number; // energyCostPerHour + maintenanceCostPerHour + replacementPartsCostPerHour + otherOperationalCostPerHour
  totalMachineCostPerHour: number; // depreciationPerHour + totalOperationalCostPerHour
  totalMachineCostPerMinute: number; // totalMachineCostPerHour / 60
  
  maintenanceFrequencyMonths: number; // a cada quantos meses
  status: MachineStatus;
  lastRevaluationDate?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LaborOperation {
  id: string;
  code: string; // ex: MO-001
  name: string; // ex: Prensagem Térmica de Canecas
  roleCategory: string; // ex: Operador Especializado
  hourlyRate: number; // Salário base / hora (R$)
  chargesBenefitsPercent: number; // Encargos sociais e benefícios (ex: 70%)
  effectiveHourlyRate: number; // hourlyRate * (1 + chargesBenefitsPercent/100)
  effectiveMinuteRate: number; // effectiveHourlyRate / 60
  defaultSetupTimeMinutes: number; // Tempo de preparação por lote (min)
  defaultUnitTimeMinutes: number; // Tempo por peça (min)
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export type IndirectExpenseAllocationMethod =
  | 'percentual_custo_direto'
  | 'hora_produtiva'
  | 'hora_mao_de_obra'
  | 'volume_producao';

export interface IndirectExpense {
  id: string;
  code: string;
  name: string; // ex: Aluguel do Galpão / Luz Administrativa / Software Adobe
  category: string; // ex: Ocupação, Tecnologia, Administrativo, Manutenção Predial
  monthlyAmount: number; // R$
  allocationMethod: IndirectExpenseAllocationMethod;
  notes?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SheetMaterialItem {
  materialId: string;
  materialName: string;
  category: RawMaterialCategory;
  quantityNeeded: number;
  consumptionUnit: ConsumptionUnit;
  unitCost: number; // Custo com perda embutida
  wastePercent: number;
  totalCost: number; // quantityNeeded * unitCost
}

export interface SheetMachineItem {
  machineId: string;
  machineName: string;
  setupMinutes: number; // Tempo de setup no equipamento
  unitMinutes: number; // Tempo de processamento por peça
  hourlyRate: number; // totalMachineCostPerHour
  totalCost: number; // ((setupMinutes/60) + (unitMinutes/60)) * hourlyRate
}

export interface SheetLaborItem {
  operationId: string;
  operationName: string;
  roleCategory: string;
  setupMinutes: number;
  unitMinutes: number;
  hourlyRate: number;
  totalCost: number;
}

export interface SheetThirdPartyServiceItem {
  id: string;
  description: string; // ex: Gravação a Laser Especial Externa / Costura de Reforço
  provider: string;
  unitCost: number;
  totalCost: number;
}

export interface SheetFinishingItem {
  id: string;
  description: string; // ex: Laminação BOPP Fosco / Verniz Localizado
  costPerUnit: number;
  totalCost: number;
}

export interface SheetPackagingItem {
  id: string;
  description: string; // ex: Caixa Kraft com visor + fita cetim
  costPerUnit: number;
  totalCost: number;
}

export interface CostCompositionSheet {
  id: string;
  code: string; // ex: FT-CAN-001
  productId?: string; // Vínculo com produto do catálogo geral MB Personaliza
  productName: string; // ex: Caneca Cerâmica Personalizada Sublimação
  category: string; // ex: Canecas, Brindes, Papelaria, Banners, Adesivos
  description: string;
  dimensions?: {
    widthCm: number;
    heightCm: number;
    areaM2: number;
  };
  
  // Itens da composição
  materials: SheetMaterialItem[];
  machines: SheetMachineItem[];
  labor: SheetLaborItem[];
  thirdPartyServices: SheetThirdPartyServiceItem[];
  finishings: SheetFinishingItem[];
  packaging: SheetPackagingItem[];
  otherDirectCosts: number;
  
  // Custos Diretos
  totalMaterialsCost: number;
  totalMachinesCost: number;
  totalLaborCost: number;
  totalThirdPartyCost: number;
  totalFinishingsCost: number;
  totalPackagingCost: number;
  totalDirectCostPerUnit: number;
  totalSetupCost: number; // Custos fixos de preparação diluídos
  
  // Custos Indiretos
  allocatedIndirectCostPerUnit: number;
  
  // Custo Total Unitário
  totalUnitCost: number;
  
  // Precificação Sugerida
  pricingMethod: 'margem_sobre_venda' | 'markup';
  targetMarginPercent: number; // ex: 35%
  salesExpensesPercent: number; // Impostos + taxas + comissões (ex: 15%)
  markupMultiplier: number; // ex: 2.0
  suggestedUnitPrice: number;
  
  isTemplate: boolean;
  version: number;
  lastCostRecalculationDate: string;
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
}

export interface QuantityTierPricing {
  quantity: number;
  setupCostDilutedUnit: number;
  directCostUnit: number;
  indirectCostUnit: number;
  totalUnitCost: number;
  totalBatchCost: number;
  
  // Venda & Margem
  taxesPercent: number;
  paymentFeePercent: number;
  commissionPercent: number;
  marketplaceFeePercent: number;
  totalSalesExpensesPercent: number;
  targetMarginPercent: number;
  
  suggestedUnitPrice: number;
  suggestedTotalPrice: number;
  minAllowedUnitPrice: number;
  maxDiscountPercent: number;
  grossProfitAmount: number;
  effectiveMarginPercent: number;
  
  customUnitPriceEntered?: number;
  customTotalPriceEntered?: number;
  customEffectiveMarginPercent?: number;
}

export interface CostQuoteItem {
  id: string;
  sheetId?: string;
  productId?: string;
  productName: string;
  description: string;
  dimensions?: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  
  // DADOS ESTRITAMENTE INTERNOS (NUNCA VAZAR PARA O CLIENTE)
  internalEstimatedUnitCost: number;
  internalTotalCost: number;
  internalGrossProfit: number;
  internalMarginPercent: number;
}

export interface CostQuote {
  id: string;
  code: string; // ex: ORC-CUSTO-2026-1042
  clientId?: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  clientCompany?: string;
  clientCpfCnpj?: string;
  
  items: CostQuoteItem[];
  subtotal: number;
  discount: number;
  discountPercent?: number;
  shippingCost: number;
  total: number;
  
  productionDays: number;
  validityDays: number;
  validityDate: string;
  paymentTerms: string;
  
  status: 'pendente' | 'aprovado' | 'recusado' | 'convertido';
  
  commercialNotes: string; // Exibido ao cliente
  internalNotes?: string; // ESTRITAMENTE INTERNO
  
  // Resumo de Rentabilidade Interna (ESTRITAMENTE INTERNO)
  internalSummary: {
    totalDirectCost: number;
    totalIndirectCost: number;
    totalProductionCost: number;
    totalEstimatedTaxesAndFees: number;
    totalEstimatedGrossProfit: number;
    overallEstimatedMarginPercent: number;
    isBelowMinMargin: boolean;
  };
  
  approvalInfo?: {
    approvedBy: string;
    approvedAt: string;
    discountAuthorizedBy?: string;
    notes?: string;
  };
  
  convertedOrderId?: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface CostPricingAuditLog {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  entityType: 'material' | 'machine' | 'labor' | 'expense' | 'sheet' | 'quote' | 'settings';
  entityId: string;
  entityName: string;
  operation: 'CRIAR' | 'EDITAR' | 'EXCLUIR' | 'REAVALIAR' | 'APROVAR_PRECO' | 'APROVAR_DESCONTO' | 'RECALCULAR';
  previousData?: any;
  newData?: any;
  details: string;
}

export interface CostPricingSettings {
  currency: 'BRL';
  decimalPlaces: number; // 2 ou 4 para micro-insumos
  roundingMode: 'arredondar_cima' | 'matematico';
  defaultTargetMarginPercent: number; // ex: 35%
  minimumAllowedMarginPercent: number; // ex: 20% (abaixo disso bloqueia ou exige alçada)
  defaultSalesTaxPercent: number; // ex: 8.5% (Simples Nacional)
  defaultPaymentGatewayFeePercent: number; // ex: 3.99% (Cartão/Gateway)
  defaultSalesCommissionPercent: number; // ex: 3.0%
  defaultMarketplaceFeePercent: number; // ex: 0% ou 14%
  defaultEnergyTariffKwh: number; // R$ 0.85 / kWh
  monthlyProductiveHoursDefault: number; // 176h (22 dias x 8h)
  indirectExpenseAllocationMethod: IndirectExpenseAllocationMethod;
  defaultQuoteValidityDays: number; // ex: 15 dias
  outdatedCostDaysThreshold: number; // ex: 60 dias para alertar que o custo está antigo
  requireApprovalForDiscountOverPercent: number; // ex: 10%
  requireApprovalBelowMinMargin: boolean;
  autoRecalculateSheetsOnCostChange: boolean;
  updatedAt: string;
  updatedBy: string;
}

// Seção 15: Regras Obrigatórias de Segurança, Testes e Validação com Evidências
export interface CostPricingTestResult {
  id: string;
  moduleName: string;
  targetObjective: string;
  procedureExecuted: string;
  expectedResult: string;
  obtainedResult: string;
  status: 'aprovado' | 'reprovado' | 'bloqueado' | 'nao_executado';
  errorsFound?: string;
  correctionsApplied?: string;
  evidenceData: any;
  timestamp: string;
}
