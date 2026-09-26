import { StrickerAuthService } from './StrickerAuthService';
import { StrickerProductService } from './StrickerProductService';
import { StrickerPriceService } from './StrickerPriceService';
import { StrickerStockService } from './StrickerStockService';
import { StrickerCustomizationService } from './StrickerCustomizationService';
import { StrickerOrderService } from './StrickerOrderService';
import { StrickerSyncService } from './StrickerSyncService';

export class StrickerService {
  public static auth = StrickerAuthService;
  public static products = StrickerProductService;
  public static prices = StrickerPriceService;
  public static stock = StrickerStockService;
  public static stocks = StrickerStockService;
  public static customization = StrickerCustomizationService;
  public static orders = StrickerOrderService;
  public static sync = StrickerSyncService;

  /**
   * Exporta catálogo da Stricker em formatos de Download Direto (JSON, CSV ou XML)
   */
  public static exportDirectDownload(format: 'json' | 'csv' | 'xml'): void {
    const products = StrickerProductService.getProducts();

    let content = '';
    let mimeType = 'text/plain';
    let filename = `stricker_catalog_${new Date().toISOString().split('T')[0]}`;

    if (format === 'json') {
      content = JSON.stringify(products, null, 2);
      mimeType = 'application/json';
      filename += '.json';
    } else if (format === 'csv') {
      mimeType = 'text/csv;charset=utf-8;';
      filename += '.csv';
      const headers = [
        'Referencia',
        'Nome',
        'Marca',
        'Catalogo',
        'Categoria',
        'Preco_Custo_Min',
        'Margem_Lucro_Pct',
        'Preco_Venda_Min',
        'Estoque_Disponivel',
        'Next_Quantities',
        'Status',
        'Publicado_Loja',
        'SKUs_Count',
      ];
      const rows = products.map((p) => [
        `"${p.reference}"`,
        `"${p.name.replace(/"/g, '""')}"`,
        `"${p.brand}"`,
        `"${p.catalog}"`,
        `"${p.category}"`,
        p.costPriceMin,
        p.profitMarginPct,
        p.salePriceMin,
        p.totalStockAvailable,
        p.totalNextQuantities,
        p.status,
        p.publishedToCatalog ? 'SIM' : 'NAO',
        p.optionals.length,
      ]);
      content = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    } else if (format === 'xml') {
      mimeType = 'application/xml';
      filename += '.xml';
      const xmlItems = products
        .map(
          (p) => `  <Product>
    <Reference>${p.reference}</Reference>
    <Name><![CDATA[${p.name}]]></Name>
    <Brand>${p.brand}</Brand>
    <Catalog>${p.catalog}</Catalog>
    <CostPriceMin>${p.costPriceMin}</CostPriceMin>
    <SalePriceMin>${p.salePriceMin}</SalePriceMin>
    <TotalStock>${p.totalStockAvailable}</TotalStock>
    <TotalNextQuantities>${p.totalNextQuantities}</TotalNextQuantities>
    <Status>${p.status}</Status>
    <PublishedToStore>${p.publishedToCatalog}</PublishedToStore>
    <OptionalsCount>${p.optionals.length}</OptionalsCount>
  </Product>`
        )
        .join('\n');
      content = `<?xml version="1.0" encoding="UTF-8"?>\n<StrickerCatalog generatedAt="${new Date().toISOString()}">\n${xmlItems}\n</StrickerCatalog>`;
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}
