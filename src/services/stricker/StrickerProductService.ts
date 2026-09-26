import {
  StrickerProduct,
  StrickerOptional,
  StrickerColor,
  StrickerProductType,
  StrickerProductStatus,
} from '../../types/stricker';
import {
  INITIAL_STRICKER_PRODUCTS,
  INITIAL_STRICKER_COLORS,
  INITIAL_STRICKER_TYPES,
} from '../../data/strickerInitialData';
import { Product } from '../../types';
import { StorageService } from '../storage';
import { StrickerAuthService } from './StrickerAuthService';

const STORAGE_KEYS = {
  PRODUCTS: 'mb_stricker_products_v1',
  COLORS: 'mb_stricker_colors_v1',
  TYPES: 'mb_stricker_types_v1',
};

export function mapStrickerCategoryToStore(
  categoryName?: string,
  typeCode?: string,
  productName?: string
): { categoryId: string; subcategoryId?: string } {
  const cat = (categoryName || '').toLowerCase();
  const code = (typeCode || '').toUpperCase();
  const name = (productName || '').toLowerCase();

  // 1. Drinkware & Térmicos
  if (code === 'DRK' || cat.includes('drink') || cat.includes('térmic') || cat.includes('termic') || name.includes('garrafa') || name.includes('copo') || name.includes('caneca')) {
    if (name.includes('garrafa') || name.includes('squeeze')) return { categoryId: 'cat-termicos', subcategoryId: 'sub-garrafas' };
    if (name.includes('caneca')) return { categoryId: 'cat-termicos', subcategoryId: 'sub-canecas' };
    return { categoryId: 'cat-termicos', subcategoryId: 'sub-copos' };
  }

  // 2. Tecnologia & Eletrônicos
  if (code === 'TEC' || cat.includes('tecno') || cat.includes('eletr') || name.includes('power') || name.includes('bank') || name.includes('fone') || name.includes('som')) {
    if (name.includes('mouse') || name.includes('deskmat')) return { categoryId: 'cat-tecnologia', subcategoryId: 'sub-mousepad' };
    return { categoryId: 'cat-tecnologia', subcategoryId: 'sub-powerbank' };
  }

  // 3. Mochilas & Bolsas
  if (code === 'BAG' || cat.includes('bolsa') || cat.includes('mochila') || cat.includes('viagem') || name.includes('mochila') || name.includes('pasta')) {
    return { categoryId: 'cat-tecnologia', subcategoryId: 'sub-powerbank' };
  }

  // 4. Escrita & Papelaria
  if (code === 'ESC' || cat.includes('escrita') || cat.includes('papel') || name.includes('caderno') || name.includes('moleskine') || name.includes('caneta') || name.includes('bloco')) {
    if (name.includes('caneta') || name.includes('rollerball') || name.includes('esferográfica')) return { categoryId: 'cat-papelaria', subcategoryId: 'sub-canetas' };
    return { categoryId: 'cat-papelaria', subcategoryId: 'sub-cadernos' };
  }

  // 5. Linha Ecológica
  if (code === 'ECO' || cat.includes('eco') || cat.includes('sustent') || name.includes('bambu') || name.includes('cortiça') || name.includes('algodão') || name.includes('ecobag')) {
    return { categoryId: 'cat-ecologicos', subcategoryId: 'sub-ecobags' };
  }

  // 6. Casa, Bar & Lazer
  if (code === 'HOM' || cat.includes('casa') || cat.includes('bar') || cat.includes('lazer') || name.includes('queijo') || name.includes('vinho') || name.includes('churrasco')) {
    return { categoryId: 'cat-ecologicos', subcategoryId: 'sub-ecobags' };
  }

  // 7. Têxtil
  if (cat.includes('textil') || cat.includes('têxtil') || cat.includes('uniform') || name.includes('camisa') || name.includes('camiseta') || name.includes('polo') || name.includes('boné')) {
    if (name.includes('polo')) return { categoryId: 'cat-textil', subcategoryId: 'sub-polos' };
    if (name.includes('boné') || name.includes('bone')) return { categoryId: 'cat-textil', subcategoryId: 'sub-bones' };
    return { categoryId: 'cat-textil', subcategoryId: 'sub-camisetas' };
  }

  return { categoryId: 'cat-termicos', subcategoryId: 'sub-garrafas' };
}

export class StrickerProductService {
  /**
   * Sanitiza e normaliza campos de produto, optionals e nextQuantities contra valores nulos ou propriedades em maiúsculo (API Stricker)
   */
  public static sanitizeProduct(p: any): StrickerProduct {
    const optionals = Array.isArray(p.optionals)
      ? p.optionals.map((opt: any) => {
          const rawNq = opt.nextQuantities || opt.NextQuantities || [];
          const normalizedNq = Array.isArray(rawNq)
            ? rawNq.map((nq: any) => ({
                quantity: Number(nq.quantity ?? nq.Quantity ?? 0),
                expectedDate: String(nq.expectedDate ?? nq.ExpectedDate ?? ''),
              }))
            : [];

          const stockAvail = Number(opt.stockAvailable ?? opt.StockAvailable ?? 0);
          return {
            ...opt,
            stockAvailable: isNaN(stockAvail) ? 0 : stockAvail,
            nextQuantities: normalizedNq,
          };
        })
      : [];

    const totalStock = optionals.reduce((sum: number, opt: any) => sum + (opt.stockAvailable || 0), 0);
    const totalNext = optionals.reduce(
      (sum: number, opt: any) =>
        sum + (opt.nextQuantities || []).reduce((s: number, nq: any) => s + (nq.quantity || 0), 0),
      0
    );

    return {
      ...p,
      optionals,
      totalStockAvailable:
        typeof p.totalStockAvailable === 'number' && !isNaN(p.totalStockAvailable)
          ? p.totalStockAvailable
          : totalStock,
      totalNextQuantities:
        typeof p.totalNextQuantities === 'number' && !isNaN(p.totalNextQuantities)
          ? p.totalNextQuantities
          : totalNext,
    };
  }

  /**
   * Obtém todos os produtos importados da Stricker
   */
  public static getProducts(): StrickerProduct[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.PRODUCTS);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((p) => this.sanitizeProduct(p));
        }
      }
    } catch (e) {
      console.error('Erro ao ler produtos Stricker:', e);
    }
    return INITIAL_STRICKER_PRODUCTS.map((p) => this.sanitizeProduct(p));
  }

  /**
   * Salva lista de produtos Stricker
   */
  public static saveProducts(products: StrickerProduct[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(products));
      window.dispatchEvent(new Event('mb_stricker_products_updated'));
    } catch (e) {
      console.error('Erro ao salvar produtos Stricker:', e);
    }
  }

  /**
   * Busca um produto por referência ou ID
   */
  public static getProductByRef(referenceOrId: string): StrickerProduct | undefined {
    return this.getProducts().find(
      (p) => p.reference === referenceOrId || p.id === referenceOrId
    );
  }

  /**
   * Atualiza ou insere um produto
   */
  public static saveProduct(product: StrickerProduct): void {
    const products = this.getProducts();
    const index = products.findIndex((p) => p.reference === product.reference || p.id === product.id);
    if (index >= 0) {
      products[index] = { ...product, updatedAt: new Date().toISOString() };
    } else {
      products.unshift({
        ...product,
        createdAt: product.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
    this.saveProducts(products);
  }

  /**
   * Atualiza status de aprovação de um produto Stricker
   */
  public static updateProductStatus(productId: string, status: StrickerProductStatus): void {
    const products = this.getProducts();
    const prod = products.find((p) => p.id === productId || p.reference === productId);
    if (prod) {
      prod.status = status;
      prod.updatedAt = new Date().toISOString();
      this.saveProducts(products);
    }
  }

  /**
   * Atualiza margem de lucro de um produto Stricker e recalcula os preços de venda de todos os SKUs
   */
  public static updateProductMargin(productId: string, profitMarginPct: number): void {
    const products = this.getProducts();
    const prod = products.find((p) => p.id === productId || p.reference === productId);
    if (prod) {
      prod.profitMarginPct = profitMarginPct;
      prod.salePriceMin = Number((prod.costPriceMin * (1 + profitMarginPct / 100)).toFixed(2));
      prod.salePriceMax = Number((prod.costPriceMax * (1 + profitMarginPct / 100)).toFixed(2));
      
      // Atualiza preços de todos os optionals
      prod.optionals = prod.optionals.map((opt) => ({
        ...opt,
        priceSale: Number((opt.priceOriginal * (1 + profitMarginPct / 100)).toFixed(2)),
        updatedAt: new Date().toISOString(),
      }));

      prod.updatedAt = new Date().toISOString();
      this.saveProducts(products);

      // Se já está publicado no catálogo da loja, atualiza em tempo real
      if (prod.publishedToCatalog) {
        const mbProduct = this.convertToStoreProduct(prod);
        StorageService.saveProduct(mbProduct);
        window.dispatchEvent(new Event('mb_products_updated'));
        window.dispatchEvent(new Event('mb_storage_updated'));
      }
    }
  }

  /**
   * Converte um produto Stricker para a estrutura de produto oficial da MB Personaliza
   */
  public static convertToStoreProduct(strickerProduct: StrickerProduct): Product {
    const config = StrickerAuthService.getConfig();
    const margin = strickerProduct.profitMarginPct || config.defaultProfitMarginPct || 50;
    const basePrice = Number((strickerProduct.costPriceMin * (1 + margin / 100)).toFixed(2));
    const { categoryId, subcategoryId } = mapStrickerCategoryToStore(
      strickerProduct.category,
      strickerProduct.productTypeCode,
      strickerProduct.name
    );

    // Mapeia os optionals para variantes da MB Personaliza
    const variants = strickerProduct.optionals.map((opt) => ({
      id: `var-${opt.sku}`,
      name: `${opt.colorName}${opt.size ? ` - ${opt.size}` : ''}${opt.capacity ? ` - ${opt.capacity}` : ''}`,
      sku: opt.sku,
      colorHex: opt.colorHex || '#111111',
      size: opt.size,
      stock_qty: opt.stockAvailable,
      additional_price: 0,
    }));

    // Mapeia técnicas de personalização
    const customTechs = Array.from(
      new Set(strickerProduct.customizationOptions.map((c) => c.techniqueName))
    );

    // Mapeia faixas de preço por quantidade
    const firstOpt = strickerProduct.optionals[0];
    const priceTiers =
      firstOpt?.priceTiers && firstOpt.priceTiers.length > 0
        ? firstOpt.priceTiers.map((tier, idx) => ({
            id: `pt-stk-${tier.minQty}-${idx}`,
            min_qty: tier.minQty,
            max_qty: tier.maxQty,
            unit_price: Number((tier.unitPrice * (1 + margin / 100)).toFixed(2)),
            discount_pct: Math.max(
              0,
              Math.round(((basePrice - Number((tier.unitPrice * (1 + margin / 100)).toFixed(2))) / basePrice) * 100)
            ),
          }))
        : [
            { id: 'pt-1', min_qty: 10, max_qty: 24, unit_price: basePrice, discount_pct: 0 },
            { id: 'pt-2', min_qty: 25, max_qty: 99, unit_price: Number((basePrice * 0.94).toFixed(2)), discount_pct: 6 },
            { id: 'pt-3', min_qty: 100, max_qty: 249, unit_price: Number((basePrice * 0.86).toFixed(2)), discount_pct: 14 },
            { id: 'pt-4', min_qty: 250, max_qty: 9999, unit_price: Number((basePrice * 0.76).toFixed(2)), discount_pct: 24 },
          ];

    const slug = `${strickerProduct.name}-${strickerProduct.reference}`
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '');

    const badge = strickerProduct.isStockout
      ? 'Esgotado na Fábrica'
      : strickerProduct.brand
      ? `Linha ${strickerProduct.brand} VIP`
      : 'Stricker SPOT';

    const mbProduct: Product = {
      id: strickerProduct.mbProductId || `mb-stk-${strickerProduct.reference}`,
      code: `STK-${strickerProduct.reference}`,
      name: strickerProduct.name,
      slug,
      categoryId,
      subcategoryId,
      description: strickerProduct.description,
      details: {
        materials: strickerProduct.materials,
        dimensions: strickerProduct.dimensions,
        capacity: strickerProduct.capacity,
        packaging: strickerProduct.packaging,
        customTechniques: customTechs.length > 0 ? customTechs : ['Gravação a Laser', 'Silk Screen', 'Transfer'],
        printAreas: strickerProduct.customizationOptions.map((c) => `${c.component} (${c.location}): ${c.areaCm2}cm²`).join('; '),
      },
      images: strickerProduct.allImages.length > 0 ? strickerProduct.allImages : [strickerProduct.mainImage],
      show_price: true,
      cost_price: strickerProduct.costPriceMin,
      profit_margin: margin,
      base_price: basePrice,
      min_order_qty: 10,
      stock_qty: strickerProduct.totalStockAvailable,
      min_stock_alert: 30,
      is_active: strickerProduct.status === 'ativo',
      is_featured: strickerProduct.brand === 'Branve',
      badge,
      variants,
      price_tiers: priceTiers,
      createdAt: strickerProduct.createdAt || new Date().toISOString(),
    };

    return mbProduct;
  }

  /**
   * Publica ou sincroniza um produto Stricker diretamente no catálogo público da MB Personaliza
   */
  public static publishToStoreCatalog(strickerProduct: StrickerProduct): Product {
    const mbProduct = this.convertToStoreProduct(strickerProduct);

    // Salva no catálogo principal do sistema MB Personaliza
    StorageService.saveProduct(mbProduct);

    // Marca como publicado no registro Stricker
    strickerProduct.publishedToCatalog = true;
    strickerProduct.mbProductId = mbProduct.id;
    this.saveProduct(strickerProduct);

    window.dispatchEvent(new Event('mb_products_updated'));
    window.dispatchEvent(new Event('mb_storage_updated'));

    return mbProduct;
  }

  /**
   * Sincroniza todos os produtos Stricker publicados com o catálogo da loja MB Personaliza
   */
  public static syncAllPublishedProductsToStore(forceAll: boolean = false): { syncedCount: number } {
    const products = this.getProducts();
    let syncedCount = 0;

    const modifiedProducts = products.map((sp) => {
      if (sp.status === 'ativo' && (sp.publishedToCatalog || forceAll)) {
        sp.publishedToCatalog = true;
        const mbProduct = this.convertToStoreProduct(sp);
        sp.mbProductId = mbProduct.id;
        StorageService.saveProduct(mbProduct);
        syncedCount++;
      }
      return sp;
    });

    if (syncedCount > 0) {
      this.saveProducts(modifiedProducts);
      window.dispatchEvent(new Event('mb_products_updated'));
      window.dispatchEvent(new Event('mb_storage_updated'));
    }

    return { syncedCount };
  }

  /**
   * Obtém todas as cores da Stricker
   */
  public static getColors(): StrickerColor[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.COLORS);
      if (data) return JSON.parse(data);
    } catch (e) {
      console.error('Erro ao ler cores:', e);
    }
    return INITIAL_STRICKER_COLORS;
  }

  /**
   * Salva cores da Stricker
   */
  public static saveColors(colors: StrickerColor[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.COLORS, JSON.stringify(colors));
    } catch (e) {
      console.error('Erro ao salvar cores:', e);
    }
  }

  /**
   * Obtém tipos de produtos
   */
  public static getProductTypes(): StrickerProductType[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.TYPES);
      if (data) return JSON.parse(data);
    } catch (e) {
      console.error('Erro ao ler tipos de produto:', e);
    }
    return INITIAL_STRICKER_TYPES;
  }

  /**
   * Salva tipos de produto
   */
  public static saveProductTypes(types: StrickerProductType[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.TYPES, JSON.stringify(types));
    } catch (e) {
      console.error('Erro ao salvar tipos de produto:', e);
    }
  }
}
