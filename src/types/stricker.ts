export type StrickerEnvironment = 'sandbox' | 'production';
export type StrickerLanguage = 'PT' | 'EN' | 'ES';
export type StrickerFormat = 'JSON' | 'XML' | 'CSV';
export type StrickerProductStatus = 'importado' | 'em_analise' | 'ativo' | 'inativo' | 'bloqueado';
export type StrickerCatalogType = 'SPOT' | 'Stockout' | 'OnlineExclusive';

export type StrickerOrderStatus =
  | 'WAITING_ART_WORK'
  | 'PROCESSING'
  | 'WAITING_STOCK'
  | 'PROCESSED'
  | 'PENDING_MOCKUP_APPROVAL'
  | 'INVOICED'
  | 'SHIPPED'
  | 'CANCELED';

export interface StrickerConfig {
  accessKey: string;
  sessionToken?: string;
  tokenExpiresAt?: string;
  environment: StrickerEnvironment;
  apiUrl: string;
  soapWsdlUrl: string;
  language: StrickerLanguage;
  format: StrickerFormat;
  isEnabled: boolean;
  autoSyncEnabled: boolean;
  syncIntervalHours: number;
  defaultProfitMarginPct: number; // e.g. 50%
  additionalHandlingCost: number; // R$
  defaultProductStatus: StrickerProductStatus;
  autoPublishToStore: boolean;
  rateLimitPerMinute: number;
  lastConnectionStatus: 'connected' | 'disconnected' | 'auth_error' | 'testing';
  lastConnectionMessage?: string;
  lastConnectionDate?: string;
  lastProductsSyncDate?: string;
  lastStockSyncDate?: string;
  lastPricesSyncDate?: string;
  lastCustomizationsSyncDate?: string;
  lastOrdersSyncDate?: string;
  isEnvKeyConfigured?: boolean;
  maskedAccessKey?: string;
  nextAutoSyncDate?: string;
  updatedAt: string;
}

export interface StrickerColor {
  code: string;
  name: string;
  hex?: string;
}

export interface StrickerProductType {
  code: string;
  name: string;
  description?: string;
}

export interface StrickerStockEntry {
  sku: string;
  stockAvailable: number;
  webSku?: string;
  nextQuantities: {
    quantity: number;
    expectedDate: string; // ISO date
  }[];
  syncedAt: string;
}

export interface StrickerPriceTier {
  minQty: number;
  maxQty?: number;
  unitPrice: number;
}

export interface StrickerOptional {
  id: string;
  productReference: string;
  sku: string;
  webSku?: string;
  colorCode: string;
  colorName: string;
  colorHex?: string;
  size?: string;
  capacity?: string;
  priceOriginal: number;
  priceSale: number;
  priceTiers: StrickerPriceTier[];
  stockAvailable: number;
  nextQuantities: {
    quantity: number;
    expectedDate: string;
  }[];
  image?: string;
  weightGrams?: number;
  createdAt: string;
  updatedAt: string;
  rawData?: any;
}

export interface StrickerCustomizationArea {
  component: string; // e.g. 'Corpo', 'Tampa', 'Clip'
  location: string; // e.g. 'Frente', 'Verso', 'Lateral'
  areaCm2: number;
  maxWidthCm: number;
  maxHeightCm: number;
  techniqueCode: string; // e.g. 'TRS1', 'LSR1', 'SCR1', 'UV1'
  techniqueName: string; // e.g. 'Transfer Serigráfico', 'Laser', 'Silk Screen', 'Impressão UV'
  maxColors: number;
  tableCode: string; // e.g. 'TRS1-01-02'
  basePrice: number;
  setupCost: number;
  handlingCost: number;
  areaImageUrl?: string;
  locationImageUrl?: string;
}

export interface StrickerCustomizationTableTier {
  minQty: number;
  maxQty?: number;
  unitPrice: number;
}

export interface StrickerCustomizationTable {
  tableCode: string; // e.g. 'TRS1-01-02'
  techniqueCode: string;
  techniqueName: string;
  areaCode: string;
  areaDesc: string;
  colorCount: number;
  setupPrice: number;
  handlingPrice: number;
  tiers: StrickerCustomizationTableTier[];
}

export interface StrickerProduct {
  id: string;
  reference: string;
  name: string;
  description: string;
  brand: string; // 'Branve', 'Ekston', 'Suco', etc.
  catalog: StrickerCatalogType;
  isStockout: boolean;
  onlineExclusive: boolean;
  category: string;
  productTypeCode?: string;
  materials?: string;
  dimensions?: string;
  capacity?: string;
  packaging?: string;
  mainImage: string;
  allImages: string[];
  optionals: StrickerOptional[];
  customizationOptions: StrickerCustomizationArea[];
  costPriceMin: number;
  costPriceMax: number;
  profitMarginPct: number;
  salePriceMin: number;
  salePriceMax: number;
  totalStockAvailable: number;
  totalNextQuantities: number;
  status: StrickerProductStatus;
  publishedToCatalog: boolean;
  mbProductId?: string; // Linked MB Personaliza Product ID
  lastSyncedAt: string;
  createdAt: string;
  updatedAt: string;
  rawData?: any;
}

export interface StrickerOrderLine {
  lineStamp: string;
  productReference: string;
  sku: string;
  quantity: number;
  lineType: 'standard' | 'print' | 'sample';
  sample: boolean;
  waitArtwork: boolean;
  unitPrice: number;
  totalPrice: number;
}

export interface StrickerServiceLine {
  lineStamp: string;
  serviceCode: string;
  colors: number;
  logoSize: string;
  group: string;
  approved: boolean;
  artworkUrl?: string;
  artworkFilename?: string;
  artworkUploadedAt?: string;
  artworkUploadedBy?: string;
  mockupUrl?: string;
}

export interface StrickerOrderHistory {
  previousStatus?: StrickerOrderStatus;
  newStatus: StrickerOrderStatus;
  date: string;
  source: 'automatic_sync' | 'manual_update' | 'api_webhook' | 'user_action';
  user?: string;
  notes?: string;
}

export interface StrickerOrder {
  id: string;
  internalReference: string; // Unique internal reference (Idempotency key)
  orderStamp?: string; // Stricker official identifier
  relatedOrderStamp?: string;
  status: StrickerOrderStatus;
  trackingCode?: string;
  courier?: string;
  shippingDate?: string;
  orderTotal: number;
  waitArtwork: boolean;
  notes?: string;
  deliveryAddress: {
    recipientName: string;
    street: string;
    number: string;
    complement?: string;
    neighborhood: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  };
  lines: StrickerOrderLine[];
  serviceLines: StrickerServiceLine[];
  history: StrickerOrderHistory[];
  rawRequest?: any;
  rawResponse?: any;
  createdAt: string;
  updatedAt: string;
}

export interface StrickerSyncLog {
  id: string;
  syncType: 'all' | 'products' | 'prices' | 'stocks' | 'customizations' | 'orders';
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  processedCount: number;
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  errorCount: number;
  status: 'success' | 'warning' | 'error';
  errorMessage?: string;
  details?: string;
}

export interface StrickerRequestLog {
  id: string;
  timestamp: string;
  endpoint: string;
  operation: string;
  method: 'GET' | 'POST';
  statusCode: number;
  durationMs: number;
  errorCode?: number;
  errorMessage?: string;
  safePayload?: any;
  safeResponse?: any;
}
