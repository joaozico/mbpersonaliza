import React from 'react';
import { Product } from '../types';
import {
  getProductBarcode,
  getProductQrCodePayload,
  generateQrCodeSvg,
} from '../utils/barcodeService';
import { X, Printer, QrCode, Barcode, Check, Copy, Plus, Minus } from 'lucide-react';

interface PDVProductCodeModalProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
  onSimulateScan: (code: string, quantity?: number) => void;
}

export const PDVProductCodeModal: React.FC<PDVProductCodeModalProps> = ({
  product,
  isOpen,
  onClose,
  onSimulateScan,
}) => {
  const [copied, setCopied] = React.useState(false);
  const [quantity, setQuantity] = React.useState<number>(1);

  if (!isOpen || !product) return null;

  const barcode = getProductBarcode(product);
  const qrPayload = getProductQrCodePayload(product);
  const qrImageUrl = generateQrCodeSvg(qrPayload, 200);
  const price = product.promo_price || product.base_price;

  const handleCopyBarcode = () => {
    navigator.clipboard.writeText(barcode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrintLabel = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Etiqueta de Produto - ${product.name}</title>
          <style>
            @page { size: 60mm 40mm; margin: 2mm; }
            body { font-family: sans-serif; margin: 0; padding: 4mm; text-align: center; }
            .title { font-size: 11px; font-weight: bold; margin-bottom: 2mm; }
            .sku { font-size: 9px; color: #555; font-family: monospace; }
            .price { font-size: 16px; font-weight: 900; color: #000; margin: 2mm 0; }
            .barcode-box { margin-top: 3mm; }
            .barcode-num { font-size: 11px; font-family: monospace; letter-spacing: 2px; }
            .qr-img { width: 50px; height: 50px; margin: 2mm auto; }
          </style>
        </head>
        <body onload="window.print(); window.close();">
          <div class="title">${product.name}</div>
          <div class="sku">REF: ${product.code}</div>
          <div class="price">R$ ${price.toFixed(2)}</div>
          <img class="qr-img" src="${qrImageUrl}" alt="QR Code" />
          <div class="barcode-box">
            <div class="barcode-num">${barcode}</div>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs">
      <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl border border-slate-200 overflow-hidden flex flex-col text-slate-800 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center">
              <Barcode className="w-4 h-4 text-[#FFDD00]" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold uppercase font-heading text-slate-900">
                Código de Barras & QR Code
              </h3>
              <p className="text-[10px] text-slate-500">Identificação oficial do item no PDV</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {/* Product Mini Header */}
          <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100">
            <div className="w-12 h-12 rounded-xl bg-white border border-slate-200 overflow-hidden shrink-0">
              <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover" />
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="text-xs font-bold text-slate-900 line-clamp-1">{product.name}</h4>
              <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono mt-0.5">
                <span>SKU: {product.code}</span>
                <span>•</span>
                <span className="font-bold text-[#E6007E]">R$ {price.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Barcode & QR Code Cards */}
          <div className="grid grid-cols-2 gap-3">
            {/* Barcode representation */}
            <div className="p-3.5 rounded-2xl bg-white border-2 border-slate-200 flex flex-col items-center justify-between text-center space-y-2">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                Código de Barras EAN-13
              </span>

              {/* Graphic Barcode Mock Pattern */}
              <div className="w-full flex items-center justify-center gap-[2px] h-14 px-2 py-1 bg-slate-50 rounded-lg">
                {[3, 1, 2, 4, 1, 3, 2, 1, 3, 4, 2, 1, 2, 3, 1, 4, 2, 1, 3, 2, 1, 4, 2].map(
                  (width, idx) => (
                    <div
                      key={idx}
                      className="bg-slate-900 h-full"
                      style={{ width: `${width * 1.5}px` }}
                    />
                  )
                )}
              </div>

              <div className="font-mono text-xs font-black tracking-widest text-slate-900">
                {barcode}
              </div>

              <button
                type="button"
                onClick={handleCopyBarcode}
                className="w-full py-1 text-[10px] font-bold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors flex items-center justify-center gap-1 cursor-pointer"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                <span>{copied ? 'Copiado!' : 'Copiar Código'}</span>
              </button>
            </div>

            {/* QR Code preview */}
            <div className="p-3.5 rounded-2xl bg-white border-2 border-slate-200 flex flex-col items-center justify-between text-center space-y-2">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                QR Code de Acesso Rápido
              </span>

              <div className="w-24 h-24 bg-white p-1 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-center">
                <img src={qrImageUrl} alt="QR Code do Produto" className="w-full h-full object-contain" />
              </div>

              <div className="font-mono text-[9px] text-slate-500 truncate max-w-full">
                {qrPayload}
              </div>

              <span className="text-[9px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-md">
                Pronto p/ Leitura
              </span>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-4 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <button
            type="button"
            onClick={handlePrintLabel}
            className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Imprimir Etiqueta</span>
          </button>

          <div className="flex items-center justify-end gap-2.5">
            {/* Quantity Stepper */}
            <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-1 shadow-2xs">
              <span className="text-[10px] font-extrabold uppercase text-slate-400 pl-1.5 select-none">
                Qtd:
              </span>
              <button
                type="button"
                onClick={() => setQuantity((prev) => Math.max(1, prev - 1))}
                className="w-6 h-6 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center cursor-pointer transition-colors"
                title="Diminuir quantidade"
              >
                <Minus className="w-3 h-3" />
              </button>
              <input
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  setQuantity(isNaN(val) || val <= 0 ? 1 : val);
                }}
                onFocus={(e) => e.target.select()}
                className="w-10 text-center text-xs font-black text-slate-900 bg-transparent outline-none"
                title="Digite a quantidade a ser bipada"
              />
              <button
                type="button"
                onClick={() => setQuantity((prev) => prev + 1)}
                className="w-6 h-6 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center cursor-pointer transition-colors"
                title="Aumentar quantidade"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                onSimulateScan(barcode, quantity);
                onClose();
              }}
              className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-[#E6007E] text-white text-xs font-extrabold transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
            >
              <Barcode className="w-4 h-4 text-[#FFDD00]" />
              <span>Bipar {quantity > 1 ? `(${quantity} un)` : 'Agora'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
