/**
 * Receipt Print Service for PDV (Ponto de Venda)
 * Generates thermal receipt layout (80mm / 58mm / A4) and triggers
 * native browser printing API via isolated hidden iframe.
 */

import { PDVSale, CompanySettings } from '../types';

export type ReceiptFormat = '80mm' | '58mm' | 'a4';

export interface PrintReceiptOptions {
  sale: PDVSale;
  companySettings: CompanySettings;
  format?: ReceiptFormat;
  title?: string;
  customFooter?: string;
}

/**
 * Format currency to Brazilian Real (BRL)
 */
function formatCurrency(val: number): string {
  return val.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

/**
 * Format date to Brazilian locale
 */
function formatDate(isoString: string): string {
  try {
    const d = new Date(isoString);
    return d.toLocaleDateString('pt-BR') + ' às ' + d.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return isoString;
  }
}

/**
 * Generates an inline SVG Code-128 pseudo-barcode for thermal printing
 */
function generateBarcodeSvg(code: string, width = 240, height = 48): string {
  const bars: number[] = [];
  let seed = 0;
  for (let i = 0; i < code.length; i++) {
    seed += code.charCodeAt(i);
  }

  // Generate alternating bar widths based on code
  for (let i = 0; i < 45; i++) {
    const pseudo = (seed * (i + 1) * 17) % 10;
    bars.push(pseudo > 5 ? 3 : pseudo > 2 ? 2 : 1);
  }

  let x = 10;
  let rects = '';
  for (let i = 0; i < bars.length; i++) {
    const barWidth = bars[i];
    if (i % 2 === 0) {
      rects += `<rect x="${x}" y="0" width="${barWidth}" height="${height}" fill="#000000" />`;
    }
    x += barWidth + 1;
  }

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${x + 10} ${height}">
      ${rects}
    </svg>
  `;
}

/**
 * Generates the full HTML markup for the receipt
 */
export function generateReceiptHtml(options: PrintReceiptOptions): string {
  const { sale, companySettings, format = '80mm', title = 'CUPOM NÃO FISCAL' } = options;
  const is58mm = format === '58mm';
  const isA4 = format === 'a4';

  const totalItemsCount = sale.items.reduce((acc, it) => acc + it.quantity, 0);
  const footerMessage =
    options.customFooter ||
    'Obrigado pela preferência! Volte sempre!\nConsulte termos de garantia e orçamentos em nosso site.';

  // Width and typography configuration per format
  const containerWidth = is58mm ? '50mm' : isA4 ? '180mm' : '72mm';
  const fontSize = is58mm ? '9.5px' : isA4 ? '12px' : '11px';
  const titleSize = is58mm ? '12px' : isA4 ? '18px' : '14px';

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Comprovante de Venda - ${sale.code}</title>
  <style>
    @page {
      size: ${isA4 ? 'A4 portrait' : is58mm ? '58mm auto' : '80mm auto'};
      margin: ${isA4 ? '10mm' : '0'};
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    body {
      margin: 0;
      padding: ${isA4 ? '10mm' : is58mm ? '2mm 1mm' : '3mm 2mm'};
      background: #ffffff;
      color: #000000;
      font-family: ${isA4 ? "'Helvetica Neue', Arial, sans-serif" : "'Courier New', Courier, monospace"};
      font-size: ${fontSize};
      line-height: 1.25;
      text-align: left;
    }
    .receipt-container {
      width: ${containerWidth};
      max-width: 100%;
      margin: 0 auto;
      padding: ${isA4 ? '20px' : '2px 0'};
      ${isA4 ? 'border: 1px solid #e2e8f0; border-radius: 8px;' : ''}
    }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .text-left { text-align: left; }
    .font-bold { font-weight: bold; }
    .font-black { font-weight: 900; }
    .uppercase { text-transform: uppercase; }
    .divider {
      border-top: 1px dashed #000000;
      margin: 6px 0;
    }
    .divider-double {
      border-top: 1px dashed #000000;
      border-bottom: 1px dashed #000000;
      height: 2px;
      margin: 6px 0;
    }
    .header-title {
      font-size: ${titleSize};
      font-weight: 900;
      margin-bottom: 2px;
      letter-spacing: 0.5px;
    }
    .sub-info {
      font-size: 0.9em;
      margin-bottom: 1px;
    }
    .tag-badge {
      display: inline-block;
      border: 1px solid #000000;
      padding: 1px 4px;
      font-weight: bold;
      font-size: 0.85em;
      margin: 4px 0;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 2px;
    }
    table.items-table {
      width: 100%;
      border-collapse: collapse;
      margin: 4px 0;
    }
    table.items-table th {
      border-bottom: 1px dashed #000000;
      padding: 3px 0;
      font-size: 0.9em;
    }
    table.items-table td {
      padding: 3px 0;
      vertical-align: top;
    }
    .item-desc {
      word-break: break-word;
      font-weight: bold;
    }
    .item-calc {
      font-size: 0.9em;
      color: #111111;
    }
    .total-highlight {
      font-size: 1.25em;
      font-weight: 900;
      padding: 4px 0;
      display: flex;
      justify-content: space-between;
      border-top: 1px dashed #000000;
      border-bottom: 1px dashed #000000;
      margin: 4px 0;
    }
    .barcode-area {
      text-align: center;
      margin: 8px 0;
    }
    .barcode-num {
      letter-spacing: 2px;
      font-size: 0.85em;
      margin-top: 2px;
    }
    .footer-note {
      font-size: 0.85em;
      text-align: center;
      white-space: pre-line;
      margin: 8px 0;
    }
    .cut-line {
      text-align: center;
      font-size: 0.75em;
      margin-top: 12px;
      letter-spacing: 2px;
    }
  </style>
</head>
<body>
  <div class="receipt-container">
    <!-- Header -->
    <div class="text-center">
      <div class="header-title">${companySettings.name}</div>
      ${companySettings.corporateName ? `<div class="sub-info">${companySettings.corporateName}</div>` : ''}
      <div class="sub-info">CNPJ: ${companySettings.cnpj} ${companySettings.stateRegistration ? `• IE: ${companySettings.stateRegistration}` : ''}</div>
      <div class="sub-info">
        ${companySettings.address.street}, ${companySettings.address.number}
        ${companySettings.address.complement ? `(${companySettings.address.complement})` : ''} - ${companySettings.address.neighborhood}
      </div>
      <div class="sub-info">${companySettings.address.city}/${companySettings.address.state} • CEP ${companySettings.address.zip}</div>
      <div class="sub-info">Tel / WhatsApp: ${companySettings.phone || companySettings.whatsapp || ''}</div>
      
      <div class="tag-badge">*** ${title.toUpperCase()} ***</div>
      <div style="font-size: 0.8em; margin-bottom: 4px;">NÃO É DOCUMENTO FISCAL • COMPROVANTE DE VENDA BALCÃO</div>
    </div>

    <div class="divider"></div>

    <!-- Sale & Customer Data -->
    <div class="info-row">
      <span>VENDA N°: <strong>${sale.code}</strong></span>
      <span>CAIXA: <strong>#${String(sale.cashRegisterNumber).padStart(2, '0')}</strong></span>
    </div>
    <div class="info-row">
      <span>DATA/HORA:</span>
      <span>${formatDate(sale.createdAt)}</span>
    </div>
    <div class="info-row">
      <span>OPERADOR:</span>
      <span class="uppercase">${sale.operatorName}</span>
    </div>
    
    <div class="divider"></div>

    <div class="info-row">
      <span>CONSUMIDOR:</span>
      <span class="uppercase font-bold">${sale.customerName || 'CONSUMIDOR FINAL'}</span>
    </div>
    ${sale.customerCpfCnpj ? `
    <div class="info-row">
      <span>CPF/CNPJ:</span>
      <span>${sale.customerCpfCnpj}</span>
    </div>` : ''}
    ${sale.customerPhone ? `
    <div class="info-row">
      <span>TELEFONE:</span>
      <span>${sale.customerPhone}</span>
    </div>` : ''}

    <div class="divider"></div>

    <!-- Items Table -->
    <table class="items-table">
      <thead>
        <tr>
          <th class="text-left" style="width: 15%;">REF/QTD</th>
          <th class="text-left" style="width: 55%;">DESCRIÇÃO</th>
          <th class="text-right" style="width: 30%;">TOTAL</th>
        </tr>
      </thead>
      <tbody>
        ${sale.items.map((it, idx) => `
          <tr>
            <td class="text-left">
              <div>#${idx + 1}</div>
              <div class="item-calc font-bold">${it.quantity}x</div>
            </td>
            <td class="text-left">
              <div class="item-desc">${it.productName}</div>
              <div class="item-calc">SKU: ${it.productSku || '—'} • ${formatCurrency(it.unitPrice)} un</div>
            </td>
            <td class="text-right font-bold">
              ${formatCurrency(it.total)}
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <div class="divider"></div>

    <!-- Totals Breakdown -->
    <div class="info-row">
      <span>QTD. TOTAL DE VOLUMES:</span>
      <span class="font-bold">${totalItemsCount} un</span>
    </div>
    <div class="info-row">
      <span>SUBTOTAL DOS ITENS:</span>
      <span>${formatCurrency(sale.subtotal)}</span>
    </div>
    ${sale.discount > 0 ? `
    <div class="info-row">
      <span>DESCONTO CONCEDIDO:</span>
      <span>- ${formatCurrency(sale.discount)}</span>
    </div>` : ''}
    ${sale.additions && sale.additions > 0 ? `
    <div class="info-row">
      <span>ACRÉSCIMOS / TAXAS:</span>
      <span>+ ${formatCurrency(sale.additions)}</span>
    </div>` : ''}

    <div class="total-highlight">
      <span>VALOR A PAGAR:</span>
      <span>${formatCurrency(sale.total)}</span>
    </div>

    <!-- Payment Split Details -->
    <div class="font-bold uppercase" style="font-size: 0.9em; margin-top: 4px;">FORMA(S) DE PAGAMENTO:</div>
    ${sale.payments.map((p) => `
      <div class="info-row">
        <span class="uppercase">
          • ${p.method.replace('_', ' ')}
          ${p.installments && p.installments > 1 ? `(${p.installments}x)` : ''}
        </span>
        <span class="font-bold">${formatCurrency(p.amount)}</span>
      </div>
    `).join('')}

    ${sale.payments.some((p) => p.changeAmount && p.changeAmount > 0) ? `
    <div class="info-row" style="font-weight: bold; margin-top: 2px;">
      <span>TROCO EM DINHEIRO:</span>
      <span>${formatCurrency(sale.payments.reduce((acc, p) => acc + (p.changeAmount || 0), 0))}</span>
    </div>` : ''}

    <div class="divider"></div>

    <!-- Barcode for verification -->
    <div class="barcode-area">
      ${generateBarcodeSvg(sale.code, is58mm ? 180 : 230, is58mm ? 36 : 44)}
      <div class="barcode-num">${sale.code}</div>
    </div>

    <!-- Footer Note -->
    <div class="footer-note">${footerMessage}</div>
    <div class="text-center" style="font-size: 0.75em; color: #555555;">
      Emissão: ${new Date().toLocaleString('pt-BR')} • Sistema MB Personaliza PDV
    </div>

    ${!isA4 ? `
    <div class="cut-line">
      ---------------- TEAR / CORTE AQUI ----------------
    </div>` : ''}
  </div>
</body>
</html>`;
}

/**
 * Triggers native browser print using a hidden, dedicated iframe.
 * Avoids window.open popup blockers and does not affect host page layout.
 */
export function printPDVReceipt(options: PrintReceiptOptions): boolean {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return false;
  }

  try {
    const htmlContent = generateReceiptHtml(options);

    // Reuse or create hidden print iframe
    let iframe = document.getElementById('pdv-receipt-hidden-iframe') as HTMLIFrameElement;
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.id = 'pdv-receipt-hidden-iframe';
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      iframe.style.visibility = 'hidden';
      document.body.appendChild(iframe);
    }

    const doc = iframe.contentWindow?.document;
    if (!doc) {
      // Fallback to window.print directly if iframe document is not accessible
      window.print();
      return true;
    }

    doc.open();
    doc.write(htmlContent);
    doc.close();

    // Give browser renderer 200ms to parse and layout before invoking print API
    setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch (printErr) {
        console.warn('Iframe print failed, falling back to window.print()', printErr);
        window.print();
      }
    }, 200);

    return true;
  } catch (err) {
    console.error('Error invoking browser print API for PDV receipt:', err);
    try {
      window.print();
      return true;
    } catch {
      return false;
    }
  }
}
