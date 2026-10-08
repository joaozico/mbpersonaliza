import React, { useState, useEffect } from 'react';
import { PDVSale, CompanySettings, UserProfile } from '../types';
import { generateQrCodeSvg } from '../utils/barcodeService';
import {
  Printer,
  X,
  FileText,
  Receipt,
  Copy,
  Check,
  Share2,
  Calendar,
  Building,
  User,
  CreditCard,
  QrCode,
  ShieldCheck,
  RotateCcw,
} from 'lucide-react';

interface PDVReceiptPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  sale: PDVSale | null;
  companySettings: CompanySettings;
  currentUser: UserProfile;
  isPreSale?: boolean;
  onNewSale?: () => void;
}

export const PDVReceiptPrintModal: React.FC<PDVReceiptPrintModalProps> = ({
  isOpen,
  onClose,
  sale,
  companySettings,
  currentUser,
  isPreSale = false,
  onNewSale,
}) => {
  const [printType, setPrintType] = useState<'cupom_fiscal' | 'recibo_pedido'>('cupom_fiscal');
  const [paperFormat, setPaperFormat] = useState<'termica_80mm' | 'a4_documento'>('termica_80mm');
  const [copied, setCopied] = useState(false);

  // Keyboard shortcut listener: Ctrl+P or Enter to print, Esc to close
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        handleTriggerPrint();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, sale, printType, paperFormat]);

  if (!isOpen || !sale) return null;

  const saleDate = new Date(sale.createdAt || Date.now());
  const formattedDate = saleDate.toLocaleDateString('pt-BR');
  const formattedTime = saleDate.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  // Deterministic 44-digit NFC-e access key generator
  const generateAccessKey = (saleCode: string, date: Date, cnpj: string) => {
    const rawCnpj = cnpj.replace(/\D/g, '').padEnd(14, '0').slice(0, 14);
    const year = date.getFullYear().toString().slice(-2);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const model = '65'; // NFC-e
    const series = '001';
    const numberOnly = saleCode.replace(/\D/g, '').padStart(9, '0').slice(-9);
    const emissionType = '1'; // Normal
    const numericCode = '12345678';
    const base43 = `35${year}${month}${rawCnpj}${model}${series}${numberOnly}${emissionType}${numericCode}`;
    
    // Checksum modulo 11
    let sum = 0;
    let weight = 2;
    for (let i = base43.length - 1; i >= 0; i--) {
      sum += parseInt(base43[i], 10) * weight;
      weight = weight === 9 ? 2 : weight + 1;
    }
    const remainder = sum % 11;
    const cd = remainder < 2 ? 0 : 11 - remainder;
    return `${base43}${cd}`;
  };

  const accessKey = generateAccessKey(sale.code, saleDate, companySettings.cnpj || '12345678000190');
  
  // Format access key in blocks of 4 digits: 3526 1012 3456...
  const formattedAccessKey = accessKey.match(/.{1,4}/g)?.join(' ') || accessKey;

  // Authorization protocol
  const authProtocol = `13526${accessKey.slice(10, 22)}`;

  // Total Approximate Taxes (Lei Federal 12.741/2012) ~ 18.25%
  const approxTaxes = Number((sale.total * 0.1825).toFixed(2));

  // QR Code payload for consumer verification
  const qrCodeUrl = `https://www.fazenda.sp.gov.br/nfce/qrcode?p=${accessKey}|2|1|1|${sale.total.toFixed(2)}`;
  const qrCodeSvg = generateQrCodeSvg(qrCodeUrl, 160);

  const handleTriggerPrint = () => {
    window.print();
  };

  const handleCopyText = () => {
    let text = `========================================\n`;
    text += `${companySettings.name.toUpperCase()}\n`;
    text += `CNPJ: ${companySettings.cnpj} - TEL: ${companySettings.phone}\n`;
    text += `========================================\n`;
    text += `${printType === 'cupom_fiscal' ? 'CUPOM FISCAL SIMPLIFICADO (NFC-e)' : 'RECIBO DE PEDIDO BALCAO'}\n`;
    text += `VENDA: ${sale.code} | DATA: ${formattedDate} ${formattedTime}\n`;
    text += `CAIXA: ${sale.cashRegisterNumber} | OPERADOR: ${sale.operatorName}\n`;
    text += `CLIENTE: ${sale.customerName}${sale.customerCpfCnpj ? ` (CPF/CNPJ: ${sale.customerCpfCnpj})` : ''}\n`;
    text += `----------------------------------------\n`;
    text += `ITENS:\n`;
    sale.items.forEach((it, idx) => {
      text += `${idx + 1}. ${it.productName}\n   ${it.quantity} un x R$ ${it.unitPrice.toFixed(2)} = R$ ${it.total.toFixed(2)}\n`;
    });
    text += `----------------------------------------\n`;
    text += `SUBTOTAL: R$ ${sale.subtotal.toFixed(2)}\n`;
    if (sale.discount > 0) {
      text += `DESCONTO: - R$ ${sale.discount.toFixed(2)}\n`;
    }
    text += `TOTAL: R$ ${sale.total.toFixed(2)}\n`;
    text += `PAGAMENTO:\n`;
    sale.payments.forEach((p) => {
      text += `  • ${p.method.toUpperCase().replace('_', ' ')}: R$ ${p.amount.toFixed(2)}\n`;
    });
    const totalChange = sale.payments.reduce((s, p) => s + (p.changeAmount || 0), 0);
    if (totalChange > 0) {
      text += `TROCO: R$ ${totalChange.toFixed(2)}\n`;
    }
    text += `========================================\n`;
    text += `${companySettings.pdvSettings?.receiptFooterCustomText || 'Agradecemos a preferencia!'}\n`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShareWhatsApp = () => {
    let msg = `*Recibo de Compra - ${companySettings.name}*\n`;
    msg += `Venda: ${sale.code}\n`;
    msg += `Data: ${formattedDate} ${formattedTime}\n`;
    msg += `Total: R$ ${sale.total.toFixed(2)}\n`;
    msg += `Cliente: ${sale.customerName}\n\n`;
    msg += `*Itens:*\n`;
    sale.items.forEach((it) => {
      msg += `• ${it.quantity}x ${it.productName} - R$ ${it.total.toFixed(2)}\n`;
    });
    msg += `\nObrigado pela preferência!`;

    const encoded = encodeURIComponent(msg);
    const cleanPhone = sale.customerPhone?.replace(/\D/g, '') || '';
    const url = cleanPhone
      ? `https://wa.me/55${cleanPhone}?text=${encoded}`
      : `https://wa.me/?text=${encoded}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <>
      {/* SCREEN MODAL (Hidden in @media print) */}
      <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 no-print overflow-y-auto">
        <div className="bg-white rounded-3xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 flex flex-col max-h-[95vh] my-auto">
          {/* Header */}
          <div className="p-4 sm:p-5 bg-slate-900 text-white flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[#00AEEF] flex items-center justify-center text-white shadow-md">
                <Printer className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-extrabold uppercase text-[#00AEEF] tracking-wider">
                  {isPreSale ? 'Pré-Venda & Orçamento PDV' : 'Central de Impressão de Venda'}
                </span>
                <h3 className="text-base sm:text-lg font-black uppercase font-heading flex items-center gap-2">
                  <span>Imprimir Cupom / Recibo</span>
                  <span className="text-xs font-mono font-normal text-slate-400">
                    ({sale.code})
                  </span>
                </h3>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              title="Fechar (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Config Bar: Print Type & Paper Format */}
          <div className="p-3 sm:p-4 bg-slate-100 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
            {/* Type selector */}
            <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-2xs">
              <button
                type="button"
                onClick={() => setPrintType('cupom_fiscal')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  printType === 'cupom_fiscal'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Receipt className="w-3.5 h-3.5 text-[#FFDD00]" />
                <span>Cupom Fiscal Simplificado</span>
              </button>

              <button
                type="button"
                onClick={() => setPrintType('recibo_pedido')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  printType === 'recibo_pedido'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <FileText className="w-3.5 h-3.5 text-[#00AEEF]" />
                <span>Recibo de Pedido Balcão</span>
              </button>
            </div>

            {/* Paper format selector */}
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-[11px] font-bold text-slate-500 hidden sm:inline">Formato:</span>
              <button
                type="button"
                onClick={() => setPaperFormat('termica_80mm')}
                className={`px-2.5 py-1 rounded-lg font-bold border transition-colors cursor-pointer ${
                  paperFormat === 'termica_80mm'
                    ? 'bg-[#00AEEF] text-white border-[#00AEEF]'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                Térmico 80mm
              </button>
              <button
                type="button"
                onClick={() => setPaperFormat('a4_documento')}
                className={`px-2.5 py-1 rounded-lg font-bold border transition-colors cursor-pointer ${
                  paperFormat === 'a4_documento'
                    ? 'bg-[#00AEEF] text-white border-[#00AEEF]'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                Folha A4
              </button>
            </div>
          </div>

          {/* Interactive Thermal Paper Preview on Screen */}
          <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 bg-slate-200/70 flex justify-center pdv-scroll">
            <div
              className={`bg-white text-slate-900 shadow-xl transition-all border border-slate-300 ${
                paperFormat === 'termica_80mm'
                  ? 'w-full max-w-[340px] p-5 font-mono text-[11px] leading-tight rounded-t-lg border-b-8 border-dashed border-b-slate-400 relative'
                  : 'w-full max-w-xl p-8 font-sans text-xs leading-normal rounded-2xl'
              }`}
            >
              {/* Paper roll notch effect for thermal receipt */}
              {paperFormat === 'termica_80mm' && (
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-100/50 via-slate-100 to-amber-100/50" />
              )}

              {printType === 'cupom_fiscal' ? (
                /* ======================================================= */
                /* CUPOM FISCAL SIMPLIFICADO (NFC-e / SAT SIMULADO)        */
                /* ======================================================= */
                <div className="space-y-3">
                  {/* Header */}
                  <div className="text-center pb-2.5 border-b border-dashed border-slate-400 space-y-0.5">
                    <div className="font-black text-sm uppercase tracking-wide">
                      {companySettings.name}
                    </div>
                    <div className="text-[10px] text-slate-700 uppercase font-semibold">
                      {companySettings.corporateName || 'MB PERSONALIZA BRINDES LTDA'}
                    </div>
                    <div className="text-[10px] text-slate-600">
                      CNPJ: {companySettings.cnpj || '12.345.678/0001-90'} • IE: 123.456.789.110
                    </div>
                    <div className="text-[10px] text-slate-600">
                      {companySettings.address.street}, {companySettings.address.number} -{' '}
                      {companySettings.address.city}/{companySettings.address.state}
                    </div>
                    <div className="text-[10px] text-slate-600">
                      Fone: {companySettings.phone || '(11) 99999-9999'}
                    </div>
                    <div className="pt-2 text-xs font-black uppercase text-slate-900">
                      DANFE NFC-e - Documento Auxiliar da Nota Fiscal de Consumidor Eletrônica
                    </div>
                    <div className="text-[9px] text-slate-500 uppercase">
                      Não permite aproveitamento de crédito de ICMS
                    </div>
                  </div>

                  {/* Identification */}
                  <div className="py-2 border-b border-dashed border-slate-400 text-[10px] space-y-0.5">
                    <div className="flex justify-between font-bold">
                      <span>CÓDIGO: {sale.code}</span>
                      <span>
                        {formattedDate} {formattedTime}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>CAIXA: {String(sale.cashRegisterNumber).padStart(2, '0')}</span>
                      <span>OPERADOR: {sale.operatorName}</span>
                    </div>
                    <div className="pt-1 text-slate-800">
                      CONSUMIDOR:{' '}
                      <span className="font-bold">
                        {sale.customerName ? sale.customerName.toUpperCase() : 'CONSUMIDOR FINAL'}
                      </span>
                    </div>
                    {sale.customerCpfCnpj ? (
                      <div className="text-slate-800">
                        CPF/CNPJ:{' '}
                        <span className="font-bold">{sale.customerCpfCnpj}</span>
                      </div>
                    ) : (
                      <div className="text-slate-500">CPF/CNPJ: NÃO INFORMADO</div>
                    )}
                  </div>

                  {/* Items Table */}
                  <div className="py-2 border-b border-dashed border-slate-400">
                    <div className="flex justify-between font-extrabold text-[10px] pb-1 border-b border-slate-200">
                      <span># CÓD | DESCRIÇÃO</span>
                      <span>QTD x VL.UN = TOTAL</span>
                    </div>
                    <div className="divide-y divide-dotted divide-slate-200 pt-1">
                      {sale.items.map((item, idx) => (
                        <div key={idx} className="py-1 text-[10px] flex justify-between items-start gap-1">
                          <div className="min-w-0 pr-1">
                            <span className="font-bold">{String(idx + 1).padStart(2, '0')}</span>{' '}
                            <span className="text-slate-500 font-semibold">{item.productSku}</span>{' '}
                            <span className="font-bold text-slate-900 truncate block">
                              {item.productName}
                            </span>
                          </div>
                          <div className="whitespace-nowrap text-right font-mono font-bold shrink-0">
                            <span>
                              {item.quantity} un x {item.unitPrice.toFixed(2)}
                            </span>
                            <div className="text-slate-950 font-black">
                              R$ {item.total.toFixed(2)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Totals & Taxes */}
                  <div className="py-2 border-b border-dashed border-slate-400 space-y-1 text-[11px]">
                    <div className="flex justify-between">
                      <span>Qtd. Total de Itens:</span>
                      <span className="font-bold">
                        {sale.items.reduce((s, it) => s + it.quantity, 0)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Valor dos Produtos:</span>
                      <span>R$ {sale.subtotal.toFixed(2)}</span>
                    </div>
                    {sale.discount > 0 && (
                      <div className="flex justify-between text-rose-700 font-bold">
                        <span>Desconto Comercial:</span>
                        <span>- R$ {sale.discount.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm font-black pt-1.5 border-t border-slate-300">
                      <span>VALOR TOTAL A PAGAR:</span>
                      <span>R$ {sale.total.toFixed(2)}</span>
                    </div>

                    {/* Payment methods */}
                    <div className="pt-2 text-[10px] space-y-0.5">
                      <div className="font-bold uppercase text-slate-600">FORMA DE PAGAMENTO:</div>
                      {sale.payments.map((p, idx) => (
                        <div key={idx} className="flex justify-between">
                          <span className="capitalize">
                            {p.method.replace('_', ' ')}
                            {p.installments && p.installments > 1 ? ` (${p.installments}x)` : ''}
                          </span>
                          <span className="font-bold">R$ {p.amount.toFixed(2)}</span>
                        </div>
                      ))}
                      {sale.payments.some((p) => (p.changeAmount || 0) > 0) && (
                        <div className="flex justify-between font-bold text-emerald-800 pt-0.5">
                          <span>TROCO:</span>
                          <span>
                            R${' '}
                            {sale.payments
                              .reduce((s, p) => s + (p.changeAmount || 0), 0)
                              .toFixed(2)}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Approximate Taxes */}
                    <div className="pt-2 text-[9px] text-slate-500 leading-tight">
                      Valor aproximado dos tributos incidentes (Lei Federal 12.741/2012): R${' '}
                      {approxTaxes.toFixed(2)} (18,25%)
                    </div>
                  </div>

                  {/* Access Key & Protocol */}
                  <div className="py-2 border-b border-dashed border-slate-400 text-center space-y-1">
                    <div className="text-[9px] font-bold uppercase text-slate-500">
                      CHAVE DE ACESSO DA NFC-e
                    </div>
                    <div className="text-[10px] font-mono font-bold tracking-wider text-slate-900 break-all select-all">
                      {formattedAccessKey}
                    </div>
                    <div className="text-[9px] text-slate-600">
                      Protocolo de Autorização: <strong>{authProtocol}</strong>
                    </div>
                  </div>

                  {/* QR Code */}
                  <div className="text-center py-2 flex flex-col items-center justify-center space-y-1">
                    <div className="text-[9px] font-bold uppercase text-slate-600">
                      Consulta via Leitor de QR Code
                    </div>
                    <div className="p-2 bg-white border border-slate-300 rounded-lg inline-block">
                      <img
                        src={qrCodeSvg}
                        alt="QR Code NFC-e"
                        className="w-24 h-24 sm:w-28 sm:h-28 mx-auto"
                      />
                    </div>
                    <div className="text-[8px] text-slate-400 font-mono">
                      Emissão em Ambiente de Homologação / Produção PDV
                    </div>
                  </div>

                  {/* Custom Footer */}
                  <div className="pt-2 text-center text-[10px] text-slate-600 whitespace-pre-line border-t border-dashed border-slate-300">
                    {companySettings.pdvSettings?.receiptFooterCustomText ||
                      'Obrigado pela preferência!\nConsulte novidades e brindes personalizados em nosso site.'}
                  </div>
                </div>
              ) : (
                /* ======================================================= */
                /* RECIBO DE PEDIDO BALCÃO (A4 / DOCUMENTO FORMAL)         */
                /* ======================================================= */
                <div className="space-y-4">
                  {/* Header */}
                  <div className="flex justify-between items-start border-b border-slate-300 pb-3">
                    <div>
                      <h4 className="text-base font-black uppercase text-slate-900">
                        {companySettings.name}
                      </h4>
                      <p className="text-xs text-slate-600">
                        {companySettings.corporateName || 'MB PERSONALIZA LTDA'}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        CNPJ: {companySettings.cnpj} • Telefone: {companySettings.phone}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {companySettings.address.street}, {companySettings.address.number} -{' '}
                        {companySettings.address.city}/{companySettings.address.state}
                      </p>
                    </div>

                    <div className="text-right">
                      <span className="px-2.5 py-1 bg-slate-900 text-white text-[10px] font-black uppercase rounded-lg">
                        {isPreSale ? 'ORÇAMENTO' : 'RECIBO DE VENDA'}
                      </span>
                      <div className="text-sm font-black text-slate-900 mt-1">{sale.code}</div>
                      <div className="text-[11px] text-slate-500">
                        {formattedDate} {formattedTime}
                      </div>
                    </div>
                  </div>

                  {/* Customer Info Card */}
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">
                        Cliente / Solicitante:
                      </span>
                      <span className="font-bold text-slate-800">
                        {sale.customerName || 'Consumidor Final'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">
                        Documento (CPF / CNPJ):
                      </span>
                      <span className="font-mono text-slate-700">
                        {sale.customerCpfCnpj || 'Não Informado'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">
                        Caixa / Operador:
                      </span>
                      <span className="text-slate-700">
                        Caixa {sale.cashRegisterNumber} • {sale.operatorName}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">
                        Status do Pagamento:
                      </span>
                      <span className="font-bold text-emerald-700">
                        {isPreSale ? 'Orçamento Balcão' : 'PAGO / CONCLUÍDO'}
                      </span>
                    </div>
                  </div>

                  {/* Items List */}
                  <div>
                    <h5 className="text-[11px] font-bold uppercase text-slate-700 mb-1.5">
                      Discriminação dos Produtos
                    </h5>
                    <table className="w-full text-xs text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-300 text-[10px] text-slate-500 uppercase">
                          <th className="py-1">Item</th>
                          <th className="py-1">Código</th>
                          <th className="py-1">Descrição</th>
                          <th className="py-1 text-center">Qtd</th>
                          <th className="py-1 text-right">Unitário</th>
                          <th className="py-1 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {sale.items.map((it, idx) => (
                          <tr key={idx} className="py-1.5">
                            <td className="py-1 text-slate-400 font-mono">{idx + 1}</td>
                            <td className="py-1 font-mono text-[11px] text-slate-600">
                              {it.productSku}
                            </td>
                            <td className="py-1 font-bold text-slate-900">{it.productName}</td>
                            <td className="py-1 text-center font-bold">{it.quantity} un</td>
                            <td className="py-1 text-right">R$ {it.unitPrice.toFixed(2)}</td>
                            <td className="py-1 text-right font-black text-slate-900">
                              R$ {it.total.toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Values Summary */}
                  <div className="pt-2 border-t border-slate-300 flex justify-end">
                    <div className="w-64 space-y-1 text-xs">
                      <div className="flex justify-between text-slate-600">
                        <span>Subtotal:</span>
                        <span>R$ {sale.subtotal.toFixed(2)}</span>
                      </div>
                      {sale.discount > 0 && (
                        <div className="flex justify-between text-rose-600 font-semibold">
                          <span>Desconto:</span>
                          <span>- R$ {sale.discount.toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-sm font-black text-slate-900 pt-1 border-t border-slate-200">
                        <span>Total:</span>
                        <span>R$ {sale.total.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Delivery / Signature Term */}
                  <div className="pt-6 border-t border-dashed border-slate-300 text-[11px] text-slate-600 space-y-4">
                    <p className="italic">
                      "Declaro que conferi e recebi as mercadorias discriminadas neste recibo em
                      perfeito estado e concordo com os valores e condições expressas."
                    </p>
                    <div className="grid grid-cols-2 gap-8 pt-4">
                      <div className="border-t border-slate-400 pt-1 text-center text-[10px] text-slate-500">
                        Assinatura do Recebedor / Cliente
                      </div>
                      <div className="border-t border-slate-400 pt-1 text-center text-[10px] text-slate-500">
                        Responsável MB Personaliza
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopyText}
                className="px-3 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
                title="Copiar texto formatado do cupom"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-slate-500" />
                    <span>Copiar Texto</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleShareWhatsApp}
                className="px-3 py-2 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
                title="Compartilhar resumo via WhatsApp"
              >
                <Share2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>WhatsApp</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              {onNewSale && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onNewSale();
                  }}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                  <span>Nova Venda</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleTriggerPrint}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#00AEEF] to-[#E6007E] hover:opacity-95 text-white text-xs font-extrabold uppercase shadow-lg transition-all flex items-center gap-2 cursor-pointer"
                title="Imprimir com a API nativa do navegador (Ctrl+P ou Enter)"
              >
                <Printer className="w-4 h-4 text-white" />
                <span>Imprimir Cupom (Enter)</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* DEDICATED PRINTABLE ELEMENT (Rendered in DOM, visible ONLY during @media print) */}
      <div
        id="pdv-printable-receipt"
        className={`print-only receipt-printable-root ${
          paperFormat === 'a4_documento' ? 'format-a4' : ''
        }`}
        style={{ display: 'none' }}
      >
        {printType === 'cupom_fiscal' ? (
          <div>
            <div style={{ textAlign: 'center', borderBottom: '1px dashed #000', paddingBottom: '3mm' }}>
              <div style={{ fontSize: '13pt', fontWeight: 'bold' }}>{companySettings.name}</div>
              <div style={{ fontSize: '9pt' }}>{companySettings.corporateName || 'MB PERSONALIZA BRINDES LTDA'}</div>
              <div style={{ fontSize: '8pt' }}>CNPJ: {companySettings.cnpj} • IE: 123.456.789.110</div>
              <div style={{ fontSize: '8pt' }}>
                {companySettings.address.street}, {companySettings.address.number} - {companySettings.address.city}/{companySettings.address.state}
              </div>
              <div style={{ fontSize: '8pt' }}>Tel: {companySettings.phone}</div>
              <div style={{ fontSize: '10pt', fontWeight: 'bold', marginTop: '2mm' }}>
                DANFE NFC-e - Documento Auxiliar da Nota Fiscal de Consumidor Eletrônica
              </div>
              <div style={{ fontSize: '8pt' }}>Não permite aproveitamento de crédito de ICMS</div>
            </div>

            <div style={{ padding: '2mm 0', borderBottom: '1px dashed #000', fontSize: '9pt' }}>
              <div>VENDA: {sale.code} • DATA: {formattedDate} {formattedTime}</div>
              <div>CAIXA: {sale.cashRegisterNumber} • OPERADOR: {sale.operatorName}</div>
              <div>CONSUMIDOR: {sale.customerName ? sale.customerName.toUpperCase() : 'CONSUMIDOR FINAL'}</div>
              {sale.customerCpfCnpj && <div>CPF/CNPJ: {sale.customerCpfCnpj}</div>}
            </div>

            <div style={{ padding: '2mm 0', borderBottom: '1px dashed #000', fontSize: '9pt' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', borderBottom: '1px solid #ccc', paddingBottom: '1mm' }}>
                <span>ITEM | DESCRIÇÃO</span>
                <span>QTD x UNIT = TOTAL</span>
              </div>
              {sale.items.map((it, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '1mm 0' }}>
                  <span style={{ maxWidth: '55%' }}>
                    {idx + 1}. {it.productSku} {it.productName}
                  </span>
                  <span style={{ fontWeight: 'bold', textAlign: 'right' }}>
                    {it.quantity}x {it.unitPrice.toFixed(2)} = R$ {it.total.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>

            <div style={{ padding: '2mm 0', borderBottom: '1px dashed #000', fontSize: '9pt' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>QTD TOTAL DE ITENS:</span>
                <span>{sale.items.reduce((s, it) => s + it.quantity, 0)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>SUBTOTAL:</span>
                <span>R$ {sale.subtotal.toFixed(2)}</span>
              </div>
              {sale.discount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#000' }}>
                  <span>DESCONTO:</span>
                  <span>- R$ {sale.discount.toFixed(2)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11pt', fontWeight: 'bold', borderTop: '1px solid #000', paddingTop: '1mm', marginTop: '1mm' }}>
                <span>VALOR TOTAL A PAGAR:</span>
                <span>R$ {sale.total.toFixed(2)}</span>
              </div>

              <div style={{ marginTop: '2mm' }}>
                <div style={{ fontWeight: 'bold' }}>FORMA DE PAGAMENTO:</div>
                {sale.payments.map((p, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>{p.method.toUpperCase().replace('_', ' ')}:</span>
                    <span>R$ {p.amount.toFixed(2)}</span>
                  </div>
                ))}
                {sale.payments.some((p) => (p.changeAmount || 0) > 0) && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
                    <span>TROCO:</span>
                    <span>
                      R$ {sale.payments.reduce((s, p) => s + (p.changeAmount || 0), 0).toFixed(2)}
                    </span>
                  </div>
                )}
              </div>

              <div style={{ fontSize: '7.5pt', marginTop: '2mm' }}>
                Tributos incidentes (Lei 12.741/2012): R$ {approxTaxes.toFixed(2)} (18,25%)
              </div>
            </div>

            <div style={{ padding: '2mm 0', textAlign: 'center', borderBottom: '1px dashed #000' }}>
              <div style={{ fontSize: '7.5pt', fontWeight: 'bold' }}>CHAVE DE ACESSO DA NFC-e</div>
              <div style={{ fontSize: '8.5pt', fontWeight: 'bold', letterSpacing: '1px' }}>
                {formattedAccessKey}
              </div>
              <div style={{ fontSize: '8pt', marginTop: '1mm' }}>
                Protocolo: {authProtocol}
              </div>
            </div>

            <div style={{ textAlign: 'center', padding: '3mm 0' }}>
              <div style={{ fontSize: '8pt', marginBottom: '1mm' }}>Consulta via Leitor QR Code</div>
              <img src={qrCodeSvg} alt="QR Code" style={{ width: '30mm', height: '30mm', margin: '0 auto' }} />
            </div>

            <div style={{ textAlign: 'center', fontSize: '8pt', paddingTop: '2mm', borderTop: '1px dashed #000' }}>
              {companySettings.pdvSettings?.receiptFooterCustomText ||
                'Obrigado pela preferência!\nConsulte novidades em nosso site.'}
            </div>
          </div>
        ) : (
          <div>
            <div style={{ borderBottom: '1px solid #000', paddingBottom: '3mm', display: 'flex', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: '13pt', fontWeight: 'bold' }}>{companySettings.name}</div>
                <div style={{ fontSize: '9pt' }}>{companySettings.corporateName || 'MB PERSONALIZA LTDA'}</div>
                <div style={{ fontSize: '8pt' }}>CNPJ: {companySettings.cnpj} • Tel: {companySettings.phone}</div>
                <div style={{ fontSize: '8pt' }}>
                  {companySettings.address.street}, {companySettings.address.number} - {companySettings.address.city}/{companySettings.address.state}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '12pt', fontWeight: 'bold' }}>RECIBO DE VENDA</div>
                <div style={{ fontSize: '10pt', fontWeight: 'bold' }}>{sale.code}</div>
                <div style={{ fontSize: '8pt' }}>{formattedDate} {formattedTime}</div>
              </div>
            </div>

            <div style={{ padding: '3mm 0', fontSize: '9pt', borderBottom: '1px solid #000' }}>
              <div>CLIENTE: <strong>{sale.customerName || 'Consumidor Final'}</strong></div>
              <div>CPF/CNPJ: {sale.customerCpfCnpj || 'Não Informado'}</div>
              <div>CAIXA: {sale.cashRegisterNumber} • OPERADOR: {sale.operatorName}</div>
            </div>

            <div style={{ padding: '3mm 0', fontSize: '9pt', borderBottom: '1px solid #000' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #000', fontSize: '8pt' }}>
                    <th style={{ padding: '1mm' }}>#</th>
                    <th style={{ padding: '1mm' }}>Código</th>
                    <th style={{ padding: '1mm' }}>Descrição</th>
                    <th style={{ padding: '1mm', textAlign: 'center' }}>Qtd</th>
                    <th style={{ padding: '1mm', textAlign: 'right' }}>Unitário</th>
                    <th style={{ padding: '1mm', textAlign: 'right' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {sale.items.map((it, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px dotted #ccc' }}>
                      <td style={{ padding: '1mm' }}>{idx + 1}</td>
                      <td style={{ padding: '1mm' }}>{it.productSku}</td>
                      <td style={{ padding: '1mm' }}>{it.productName}</td>
                      <td style={{ padding: '1mm', textAlign: 'center' }}>{it.quantity}</td>
                      <td style={{ padding: '1mm', textAlign: 'right' }}>R$ {it.unitPrice.toFixed(2)}</td>
                      <td style={{ padding: '1mm', textAlign: 'right', fontWeight: 'bold' }}>
                        R$ {it.total.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div style={{ textAlign: 'right', marginTop: '3mm', fontSize: '10pt' }}>
                <div>Subtotal: R$ {sale.subtotal.toFixed(2)}</div>
                {sale.discount > 0 && <div>Desconto: - R$ {sale.discount.toFixed(2)}</div>}
                <div style={{ fontSize: '12pt', fontWeight: 'bold', marginTop: '1mm' }}>
                  TOTAL: R$ {sale.total.toFixed(2)}
                </div>
              </div>
            </div>

            <div style={{ marginTop: '8mm', fontSize: '8pt' }}>
              <p style={{ fontStyle: 'italic', marginBottom: '8mm' }}>
                "Declaro que recebi os produtos constantes neste recibo em perfeitas condições."
              </p>
              <div style={{ display: 'flex', justifyContent: 'space-around', textAlign: 'center' }}>
                <div style={{ borderTop: '1px solid #000', width: '40%', paddingTop: '1mm' }}>
                  Assinatura do Cliente
                </div>
                <div style={{ borderTop: '1px solid #000', width: '40%', paddingTop: '1mm' }}>
                  Responsável MB Personaliza
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};
