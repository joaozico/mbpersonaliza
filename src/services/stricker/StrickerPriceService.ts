import { StrickerProduct, StrickerOptional, StrickerPriceTier } from '../../types/stricker';
import { StrickerProductService } from './StrickerProductService';
import { StrickerAuthService } from './StrickerAuthService';

export class StrickerPriceService {
  /**
   * Calcula o preço de venda baseado no preço de custo original da Stricker e na margem configurada
   */
  public static calculateSalePrice(costPrice: number, marginPct?: number, additionalHandlingCost: number = 0): number {
    const config = StrickerAuthService.getConfig();
    const margin = marginPct !== undefined ? marginPct : config.defaultProfitMarginPct || 50;
    const priceWithMargin = costPrice * (1 + margin / 100);
    return Number((priceWithMargin + additionalHandlingCost).toFixed(2));
  }

  /**
   * Obtém o preço unitário para determinada quantidade respeitando as faixas de preço (Price Tiers)
   */
  public static getUnitPriceForQuantity(
    optional: StrickerOptional,
    quantity: number,
    marginPct?: number
  ): number {
    const costPrice = this.getCostPriceForQuantity(optional, quantity);
    return this.calculateSalePrice(costPrice, marginPct);
  }

  /**
   * Obtém o preço de custo original fornecido pela Stricker para a quantidade especificada
   */
  public static getCostPriceForQuantity(optional: StrickerOptional, quantity: number): number {
    if (!optional.priceTiers || optional.priceTiers.length === 0) {
      return optional.priceOriginal;
    }

    // Busca faixa aplicável
    for (let i = optional.priceTiers.length - 1; i >= 0; i--) {
      const tier = optional.priceTiers[i];
      if (quantity >= tier.minQty) {
        if (tier.maxQty === undefined || quantity <= tier.maxQty) {
          return tier.unitPrice;
        }
      }
    }

    return optional.priceOriginal;
  }

  /**
   * Atualiza preços de um produto com base em resposta do WebService Stricker (OptionalsPrice)
   */
  public static updateProductPrices(
    productRef: string,
    pricesMap: { [sku: string]: { originalPrice: number; tiers?: StrickerPriceTier[] } }
  ): void {
    const product = StrickerProductService.getProductByRef(productRef);
    if (!product) return;

    let minCost = Infinity;
    let maxCost = -Infinity;

    product.optionals = product.optionals.map((opt) => {
      const newPriceData = pricesMap[opt.sku];
      if (newPriceData) {
        const cost = newPriceData.originalPrice;
        const tiers = newPriceData.tiers || opt.priceTiers;
        minCost = Math.min(minCost, cost);
        maxCost = Math.max(maxCost, cost);
        return {
          ...opt,
          priceOriginal: cost,
          priceSale: this.calculateSalePrice(cost, product.profitMarginPct),
          priceTiers: tiers,
          updatedAt: new Date().toISOString(),
        };
      }
      minCost = Math.min(minCost, opt.priceOriginal);
      maxCost = Math.max(maxCost, opt.priceOriginal);
      return opt;
    });

    if (minCost !== Infinity) {
      product.costPriceMin = minCost;
      product.costPriceMax = maxCost;
      product.salePriceMin = this.calculateSalePrice(minCost, product.profitMarginPct);
      product.salePriceMax = this.calculateSalePrice(maxCost, product.profitMarginPct);
    }

    product.updatedAt = new Date().toISOString();
    StrickerProductService.saveProduct(product);
  }
}
