import React, { useState, useEffect } from 'react';
import { PDVSale, CompanySettings } from '../types';
import { printPDVReceipt, ReceiptFormat } from '../utils/receiptPrintService';
import {
  Printer,
  CheckCircle2,
  X,
  Plus,
  Share2,
  MessageSquare,
  FileText,
  Clock,
  User,
  Barcode,
  Layers,
  Sparkles,
} from 'lucide-react';

interface PDVReceiptModalProps {
  isOpen: boolean;
  sale: PDVSale | null;
  companySettings: CompanySettings;
  customFooterText?: string;
  onClose: () => void;
  onNewSale: () => void;
}

export const PDVReceiptModal: React.FC<PDVReceiptModalProps> = ({
  isOpen,
  sale,
  companySettings,
  customFooterText,
  onClose,
  onNewSale,
}) => {
  const [selectedFormat, setSelectedFormat] = useState<ReceiptFormat>('80mm');
  const [isPrinting, setIsPrinting] = useState(false);
  const [printSuccessToast, setPrintSuccessToast] = useState(false);

  // Close on ESC or Print on Enter
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'F2') {
        e.preventDefault();
        onNewSale();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, onNewSale]);

  if (!isOpen || !sale) return null;

  const totalItemsCount = sale.items.reduce((acc, it) => acc + it.quantity, 0);

  const handleExecutePrint = () => {
    setIsPrinting(true);
    const ok = printPDVReceipt({
      sale,
      companySettings,
      format: selectedFormat,
      customFooter: customFooterText,
    });

    setIsPrinting(false);
    if (ok) {
      setPrintSuccessToast(true);
      setTimeout(() => setPrintSuccessToast(false), 3000);
    }
  };

  const handleShareWhatsApp = () => {
    let text = `*COMPROVANTE DE VENDA - ${companySettings.name}*\n`;
    text += `Venda: #${sale.code}\n`;
    text += `Data: ${new Date(sale.createdAt).toLocaleDateString('pt-BR')} às ${new Date(sale.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}\n`;
    text += `Cliente: ${sale.customerName}\n`;
    text += `--------------------------------\n`;
    sale.items.forEach((it, idx) => {
      text += `${idx + 1}. ${it.quantity}x ${it.productName} = R$ ${it.total.toFixed(2)}\n`;
    });
    text += `--------------------------------\n`;
    text += `*TOTAL PAGO: R$ ${sale.total.toFixed(2)}*\n`;
    if (sale.payments.length > 0) {
      text += `Forma(s): ${sale.payments.map((p) => p.method.toUpperCase()).join(', ')}\n`;
    }
    text += `\nAgradecemos pela preferência!`;

    const cleanPhone = (sale.customerPhone || '').replace(/\D/g, '');
    const url = cleanPhone
      ? `https://wa.me/55${cleanPhone}?text=${encodeURIComponent(text)}`
      : `https://wa.me/?text=${encodeURIComponent(text)}`;

    window.open(url, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[94vh] animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between no-print shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 font-black" />
            </div>
            <div>
              <div className="text-sm font-black uppercase font-heading flex items-center gap-2">
                <span>Venda Concluída com Sucesso!</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500 text-slate-950 font-black">
                  #{sale.code}
                </span>
              </div>
              <p className="text-[10px] text-slate-400">
                Pronto para impressão térmica de cupom fiscal simplificado ou recibo de pedido
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            title="Fechar (ESC)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Format Selector Bar */}
        <div className="px-4 py-2.5 bg-slate-100 border-b border-slate-200 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-black uppercase text-slate-500">
              Formato:
            </span>
            <div className="flex bg-white rounded-xl p-0.5 border border-slate-200 shadow-2xs">
              <button
                type="button"
                onClick={() => setSelectedFormat('80mm')}
                className={`px-3 py-1 rounded-lg text-[11px] font-black transition-all cursor-pointer ${
                  selectedFormat === '80mm'
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Térmica 80mm
              </button>
              <button
                type="button"
                onClick={() => setSelectedFormat('58mm')}
                className={`px-3 py-1 rounded-lg text-[11px] font-black transition-all cursor-pointer ${
                  selectedFormat === '58mm'
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Mini 58mm
              </button>
              <button
                type="button"
                onClick={() => setSelectedFormat('a4')}
                className={`px-3 py-1 rounded-lg text-[11px] font-black transition-all cursor-pointer ${
                  selectedFormat === 'a4'
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Folha A4
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={handleShareWhatsApp}
            className="px-2.5 py-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg flex items-center gap-1 cursor-pointer transition-colors"
            title="Enviar comprovante pelo WhatsApp do cliente"
          >
            <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
            <span className="hidden sm:inline">WhatsApp</span>
          </button>
        </div>

        {/* Live Visual Thermal Receipt Container (Scrollable) */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-200/60 flex justify-center pdv-scroll">
          <div
            className={`bg-white shadow-md p-4 sm:p-5 text-slate-900 font-mono transition-all border border-slate-300 relative ${
              selectedFormat === '58mm'
                ? 'w-[230px] text-[10px] leading-tight'
                : selectedFormat === 'a4'
                ? 'w-full text-xs font-sans shadow-lg'
                : 'w-[310px] text-xs leading-snug'
            }`}
          >
            {/* Top jagged thermal paper edge visual simulation */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-slate-200 via-white to-slate-200 border-b border-dotted border-slate-300" />

            {/* Receipt Header */}
            <div className="text-center space-y-0.5 pb-2.5 border-b border-dashed border-slate-400">
              <h3 className="font-black uppercase text-sm tracking-wide">
                {companySettings.name}
              </h3>
              {companySettings.corporateName && (
                <p className="text-[10px] text-slate-600">
                  {companySettings.corporateName}
                </p>
              )}
              <p className="text-[10px] text-slate-600 font-bold">
                CNPJ: {companySettings.cnpj}
              </p>
              <p className="text-[10px] text-slate-600">
                {companySettings.address.street}, {companySettings.address.number} -{' '}
                {companySettings.address.city}/{companySettings.address.state}
              </p>
              <p className="text-[10px] text-slate-600">
                Tel / WhatsApp: {companySettings.phone || companySettings.whatsapp}
              </p>
              <div className="pt-1.5">
                <span className="inline-block px-2 py-0.5 border border-slate-900 text-[10px] font-black uppercase">
                  *** CUPOM NÃO FISCAL ***
                </span>
                <p className="text-[9px] text-slate-500 mt-0.5">
                  COMPROVANTE DE VENDA BALCÃO
                </p>
              </div>
            </div>

            {/* Sale metadata */}
            <div className="py-2 border-b border-dashed border-slate-400 space-y-0.5 text-[10px]">
              <div className="flex justify-between font-bold">
                <span>VENDA: #{sale.code}</span>
                <span>CAIXA: #{String(sale.cashRegisterNumber).padStart(2, '0')}</span>
              </div>
              <div className="flex justify-between">
                <span>DATA: {new Date(sale.createdAt).toLocaleDateString('pt-BR')}</span>
                <span>
                  HORA:{' '}
                  {new Date(sale.createdAt).toLocaleTimeString('pt-BR', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })}
                </span>
              </div>
              <div className="truncate">
                OPERADOR: <span className="uppercase">{sale.operatorName}</span>
              </div>
              <div className="truncate">
                CLIENTE: <span className="font-bold uppercase">{sale.customerName}</span>
              </div>
              {sale.customerCpfCnpj && (
                <div>CPF/CNPJ: {sale.customerCpfCnpj}</div>
              )}
            </div>

            {/* Items list */}
            <div className="py-2 border-b border-dashed border-slate-400 space-y-1.5 text-[10px]">
              <div className="flex justify-between font-bold border-b border-dotted border-slate-300 pb-1">
                <span>ITEM / DESCRIÇÃO</span>
                <span>TOTAL</span>
              </div>
              {sale.items.map((it, idx) => (
                <div key={idx} className="flex justify-between items-start gap-1">
                  <div className="min-w-0 pr-1">
                    <div className="font-bold truncate">
                      {idx + 1}. {it.productName}
                    </div>
                    <div className="text-[9px] text-slate-500">
                      {it.quantity} un x R$ {it.unitPrice.toFixed(2)}
                    </div>
                  </div>
                  <div className="font-black shrink-0 whitespace-nowrap">
                    R$ {it.total.toFixed(2)}
                  </div>
                </div>
              ))}
            </div>

            {/* Financial summary */}
            <div className="py-2 border-b border-dashed border-slate-400 space-y-1 text-[10px]">
              <div className="flex justify-between">
                <span>QTD. TOTAL DE ITENS:</span>
                <span className="font-bold">{totalItemsCount} un</span>
              </div>
              <div className="flex justify-between">
                <span>SUBTOTAL:</span>
                <span>R$ {sale.subtotal.toFixed(2)}</span>
              </div>
              {sale.discount > 0 && (
                <div className="flex justify-between text-rose-700 font-bold">
                  <span>DESCONTO CONCEDIDO:</span>
                  <span>- R$ {sale.discount.toFixed(2)}</span>
                </div>
              )}

              <div className="flex justify-between font-black text-xs pt-1.5 border-t border-dotted border-slate-400">
                <span>VALOR TOTAL:</span>
                <span>R$ {sale.total.toFixed(2)}</span>
              </div>

              {/* Payment methods */}
              <div className="pt-1.5 space-y-0.5 border-t border-dotted border-slate-300">
                <div className="font-bold uppercase text-[9px] text-slate-600">
                  PAGAMENTO:
                </div>
                {sale.payments.map((p, idx) => (
                  <div key={idx} className="flex justify-between">
                    <span className="uppercase">
                      • {p.method.replace('_', ' ')}
                      {p.installments && p.installments > 1 ? ` (${p.installments}x)` : ''}
                    </span>
                    <span className="font-bold">R$ {p.amount.toFixed(2)}</span>
                  </div>
                ))}
                {sale.payments.some((p) => p.changeAmount && p.changeAmount > 0) && (
                  <div className="flex justify-between font-black text-emerald-800 pt-0.5">
                    <span>TROCO EM DINHEIRO:</span>
                    <span>
                      R${' '}
                      {sale.payments
                        .reduce((s, p) => s + (p.changeAmount || 0), 0)
                        .toFixed(2)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Barcode visual preview */}
            <div className="pt-3 pb-2 text-center">
              <div className="inline-block bg-white p-1">
                <Barcode className="w-32 h-7 mx-auto text-slate-800" />
                <div className="text-[9px] tracking-widest font-mono font-bold">
                  {sale.code}
                </div>
              </div>
            </div>

            {/* Footer custom message */}
            <div className="text-center text-[9px] text-slate-500 whitespace-pre-line pt-1">
              {customFooterText ||
                'Obrigado pela preferência!\nConsulte garantia e orçamentos em nosso site.'}
            </div>

            <div className="mt-3 pt-1 text-center text-[8px] text-slate-400 border-t border-dotted border-slate-300">
              Impresso via API do Navegador • MB Personaliza PDV
            </div>
          </div>
        </div>

        {/* Action Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 no-print shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isPrinting}
              onClick={handleExecutePrint}
              className="px-5 py-3 bg-slate-900 hover:bg-slate-800 text-white text-xs font-black rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50"
            >
              <Printer className="w-4 h-4 text-[#00AEEF]" />
              <span>{isPrinting ? 'Preparando...' : 'Imprimir Cupom'}</span>
            </button>

            {printSuccessToast && (
              <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-lg animate-in fade-in flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Impressão enviada!</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-3 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer"
            >
              Fechar
            </button>

            <button
              type="button"
              onClick={() => {
                onClose();
                onNewSale();
              }}
              className="px-5 py-3 bg-gradient-to-r from-[#E6007E] to-[#c9006e] hover:opacity-95 text-white text-xs font-black rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Nova Venda (F2)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
