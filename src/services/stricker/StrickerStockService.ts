import { StrickerProduct, StrickerOptional, StrickerStockEntry } from '../../types/stricker';
import { StrickerProductService } from './StrickerProductService';

export class StrickerStockService {
  /**
   * Atualiza estoques dos produtos a partir de uma lista retornada pelo endpoint /stocks
   */
  public static updateStocks(stockEntries: StrickerStockEntry[]): { updatedSkus: number; updatedProducts: number } {
    const products = StrickerProductService.getProducts();
    const stockMap = new Map<string, StrickerStockEntry>();

    stockEntries.forEach((entry) => {
      stockMap.set(entry.sku, entry);
    });

    let updatedSkus = 0;
    let updatedProducts = 0;

    const modifiedProducts = products.map((prod) => {
      let productChanged = false;
      let totalStock = 0;
      let totalNext = 0;

      const updatedOptionals = (prod.optionals || []).map((opt) => {
        const stockData = stockMap.get(opt.sku);
        if (stockData) {
          productChanged = true;
          updatedSkus++;
          const rawNq = stockData.nextQuantities || (stockData as any).NextQuantities || [];
          const normalizedNq = Array.isArray(rawNq)
            ? rawNq.map((nq: any) => ({
                quantity: Number(nq.quantity ?? nq.Quantity ?? 0),
                expectedDate: String(nq.expectedDate ?? nq.ExpectedDate ?? ''),
              }))
            : [];

          const newStockAvailable = Number(stockData.stockAvailable ?? (stockData as any).StockAvailable ?? 0);
          const newOpt: StrickerOptional = {
            ...opt,
            stockAvailable: isNaN(newStockAvailable) ? 0 : newStockAvailable,
            nextQuantities: normalizedNq,
            updatedAt: new Date().toISOString(),
          };
          totalStock += newOpt.stockAvailable;
          totalNext += newOpt.nextQuantities.reduce((a, b) => a + Number(b.quantity || 0), 0);
          return newOpt;
        }

        const rawNq = opt.nextQuantities || (opt as any).NextQuantities || [];
        const normalizedNq = Array.isArray(rawNq)
          ? rawNq.map((nq: any) => ({
              quantity: Number(nq.quantity ?? nq.Quantity ?? 0),
              expectedDate: String(nq.expectedDate ?? nq.ExpectedDate ?? ''),
            }))
          : [];

        const optStock = Number(opt.stockAvailable ?? 0);
        const validStock = isNaN(optStock) ? 0 : optStock;
        totalStock += validStock;
        totalNext += normalizedNq.reduce((a, b) => a + Number(b.quantity || 0), 0);
        return {
          ...opt,
          stockAvailable: validStock,
          nextQuantities: normalizedNq,
        };
      });

      if (productChanged) {
        updatedProducts++;
        return {
          ...prod,
          optionals: updatedOptionals,
          totalStockAvailable: totalStock,
          totalNextQuantities: totalNext,
          isStockout: totalStock === 0,
          updatedAt: new Date().toISOString(),
        };
      }

      return prod;
    });

    if (updatedProducts > 0) {
      StrickerProductService.saveProducts(modifiedProducts);
      StrickerProductService.syncAllPublishedProductsToStore();
    }

    return { updatedSkus, updatedProducts };
  }

  /**
   * Obtém produtos com estoque zerado
   */
  public static getOutOfStockProducts(): StrickerProduct[] {
    return StrickerProductService.getProducts().filter((p) => Number(p.totalStockAvailable || 0) === 0);
  }

  /**
   * Obtém produtos com estoque baixo (menor que o limite configurado)
   */
  public static getLowStockProducts(threshold: number = 50): StrickerProduct[] {
    return StrickerProductService.getProducts().filter(
      (p) => Number(p.totalStockAvailable || 0) > 0 && Number(p.totalStockAvailable || 0) <= threshold
    );
  }

  /**
   * Obtém previsão das próximas entradas (Next Quantities)
   */
  public static getNextDeliveries(): {
    productName: string;
    productRef: string;
    sku: string;
    colorName: string;
    quantity: number;
    expectedDate: string;
  }[] {
    const list: {
      productName: string;
      productRef: string;
      sku: string;
      colorName: string;
      quantity: number;
      expectedDate: string;
    }[] = [];

    StrickerProductService.getProducts().forEach((prod) => {
      (prod.optionals || []).forEach((opt) => {
        (opt.nextQuantities || []).forEach((nq: any) => {
          const qty = Number(nq.quantity ?? nq.Quantity ?? 0);
          const dateStr = String(nq.expectedDate ?? nq.ExpectedDate ?? '');
          if (qty > 0) {
            list.push({
              productName: prod.name,
              productRef: prod.reference,
              sku: opt.sku,
              colorName: opt.colorName,
              quantity: qty,
              expectedDate: dateStr,
            });
          }
        });
      });
    });

    return list.sort((a, b) => {
      const timeA = new Date(a.expectedDate).getTime() || 0;
      const timeB = new Date(b.expectedDate).getTime() || 0;
      return timeA - timeB;
    });
  }
}
