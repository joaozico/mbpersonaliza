import {
  StrickerCustomizationTable,
  StrickerCustomizationArea,
} from '../../types/stricker';
import { INITIAL_STRICKER_CUSTOMIZATION_TABLES } from '../../data/strickerInitialData';

const STORAGE_KEYS = {
  TABLES: 'mb_stricker_customization_tables_v1',
};

export class StrickerCustomizationService {
  /**
   * Obtém todas as tabelas de personalização importadas da Stricker
   */
  public static getCustomizationTables(): StrickerCustomizationTable[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.TABLES);
      if (data) return JSON.parse(data);
    } catch (e) {
      console.error('Erro ao ler tabelas de personalização:', e);
    }
    return INITIAL_STRICKER_CUSTOMIZATION_TABLES;
  }

  /**
   * Salva tabelas de personalização
   */
  public static saveCustomizationTables(tables: StrickerCustomizationTable[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.TABLES, JSON.stringify(tables));
      window.dispatchEvent(new Event('mb_stricker_customizations_updated'));
    } catch (e) {
      console.error('Erro ao salvar tabelas de personalização:', e);
    }
  }

  /**
   * Obtém tabela pelo código técnico (Ex: 'TRS1-01-02')
   */
  public static getTableByCode(tableCode: string): StrickerCustomizationTable | undefined {
    return this.getCustomizationTables().find((t) => t.tableCode === tableCode);
  }

  /**
   * Calcula o custo unitário e total de personalização para uma área e quantidade
   * Fórmula Oficial Stricker:
   * Preço do produto + preço da personalização + manuseio = preço base
   * Preço final = preço calculado × quantidade (+ Custo de Setup/Preparação amortizado ou fixo)
   */
  public static calculateCustomizationCost(
    area: StrickerCustomizationArea,
    quantity: number,
    colorsCount: number = 1
  ): {
    unitCustomizationPrice: number;
    unitHandlingPrice: number;
    setupCost: number;
    unitTotalCustomization: number;
    totalCustomization: number;
  } {
    const table = this.getTableByCode(area.tableCode);
    let unitCustomization = area.basePrice || 4.5;
    let unitHandling = area.handlingCost || 0.3;
    let setup = area.setupCost || 35.0;

    if (table) {
      unitHandling = table.handlingPrice;
      setup = table.setupPrice;

      // Busca faixa de quantidade na tabela técnica
      for (let i = table.tiers.length - 1; i >= 0; i--) {
        const tier = table.tiers[i];
        if (quantity >= tier.minQty) {
          if (tier.maxQty === undefined || quantity <= tier.maxQty) {
            unitCustomization = tier.unitPrice;
            break;
          }
        }
      }
    }

    // Se houver mais de 1 cor na técnica aplicável (ex: Transfer ou Silk), adiciona fator de repetição de cor
    if (colorsCount > 1 && area.techniqueCode !== 'LSR1' && area.techniqueCode !== 'UV1') {
      unitCustomization = unitCustomization * (1 + (colorsCount - 1) * 0.45);
      setup = setup * (1 + (colorsCount - 1) * 0.5);
    }

    const unitTotalCustomization = Number((unitCustomization + unitHandling).toFixed(2));
    const totalCustomization = Number((unitTotalCustomization * quantity + setup).toFixed(2));

    return {
      unitCustomizationPrice: Number(unitCustomization.toFixed(2)),
      unitHandlingPrice: Number(unitHandling.toFixed(2)),
      setupCost: Number(setup.toFixed(2)),
      unitTotalCustomization,
      totalCustomization,
    };
  }

  /**
   * Calcula o preço final consolidado do produto com personalização
   * Preço do produto + preço da personalização + manuseio = preço base
   * Preço final = preço calculado × quantidade (+ setup)
   */
  public static calculateCombinedItemTotal(
    productUnitPrice: number,
    customizationArea: StrickerCustomizationArea | null,
    quantity: number,
    colorsCount: number = 1
  ): {
    productUnitPrice: number;
    customizationUnitPrice: number;
    handlingUnitPrice: number;
    setupTotalCost: number;
    combinedUnitPrice: number;
    finalTotal: number;
  } {
    if (!customizationArea) {
      return {
        productUnitPrice,
        customizationUnitPrice: 0,
        handlingUnitPrice: 0,
        setupTotalCost: 0,
        combinedUnitPrice: productUnitPrice,
        finalTotal: Number((productUnitPrice * quantity).toFixed(2)),
      };
    }

    const cust = this.calculateCustomizationCost(customizationArea, quantity, colorsCount);
    const combinedUnit = Number((productUnitPrice + cust.unitCustomizationPrice + cust.unitHandlingPrice).toFixed(2));
    const finalTotal = Number((combinedUnit * quantity + cust.setupCost).toFixed(2));

    return {
      productUnitPrice,
      customizationUnitPrice: cust.unitCustomizationPrice,
      handlingUnitPrice: cust.unitHandlingPrice,
      setupTotalCost: cust.setupCost,
      combinedUnitPrice: combinedUnit,
      finalTotal,
    };
  }
}
