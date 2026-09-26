import React, { useEffect } from 'react';
import { CartItem } from '../types';
import { StorageService } from '../services/storage';
import {
  X,
  Trash2,
  Plus,
  Minus,
  ArrowRight,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  QrCode,
  FileSpreadsheet,
  Package,
} from 'lucide-react';

export interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  cart?: CartItem[];
  items?: CartItem[];
  onCartChange?: () => void;
  onUpdateQuantity?: (itemId: string, newQty: number) => void;
  onRemoveItem?: (itemId: string) => void;
  onNavigate?: (view: string, param?: string) => void;
  onCheckout?: () => void;
  onRequestQuote?: () => void;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({
  isOpen,
  onClose,
  cart,
  items,
  onCartChange,
  onUpdateQuantity,
  onRemoveItem,
  onNavigate,
  onCheckout,
  onRequestQuote,
}) => {
  // Listen for Escape key to close
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Unify cart items from either 'cart' or 'items' prop, fallback to empty array
  const cartList: CartItem[] = Array.isArray(cart)
    ? cart
    : Array.isArray(items)
    ? items
    : [];

  const handleUpdateQty = (itemId: string, newQty: number) => {
    const safeQty = Math.max(1, newQty);
    if (onUpdateQuantity) {
      onUpdateQuantity(itemId, safeQty);
    } else {
      StorageService.updateCartQty(itemId, safeQty);
    }
    if (onCartChange) {
      onCartChange();
    }
  };

  const handleRemove = (itemId: string) => {
    if (onRemoveItem) {
      onRemoveItem(itemId);
    } else {
      StorageService.removeFromCart(itemId);
    }
    if (onCartChange) {
      onCartChange();
    }
  };

  const handleClear = () => {
    if (window.confirm('Deseja realmente limpar todos os itens do carrinho?')) {
      StorageService.clearCart();
      if (onCartChange) {
        onCartChange();
      }
    }
  };

  const getUnitPrice = (item: CartItem): number => {
    if (typeof item?.calculatedUnitPrice === 'number' && !isNaN(item.calculatedUnitPrice)) {
      return item.calculatedUnitPrice;
    }
    if (typeof item?.product?.base_price === 'number' && !isNaN(item.product.base_price)) {
      return item.product.base_price;
    }
    return 0;
  };

  const getItemQuantity = (item: CartItem): number => {
    return Math.max(1, Number(item?.quantity) || 1);
  };

  const subtotal = cartList.reduce((acc, item) => {
    return acc + getUnitPrice(item) * getItemQuantity(item);
  }, 0);

  const totalItemCount = cartList.reduce((acc, item) => {
    return acc + getItemQuantity(item);
  }, 0);

  const pixDiscount = subtotal * 0.05; // 5% discount for PIX
  const totalWithPix = Math.max(0, subtotal - pixDiscount);

  const handleGoToCheckout = () => {
    onClose();
    if (onCheckout) {
      onCheckout();
    } else if (onNavigate) {
      onNavigate('checkout');
    }
  };

  const handleGoToQuote = () => {
    onClose();
    if (onRequestQuote) {
      onRequestQuote();
    } else if (onNavigate) {
      onNavigate('quote');
    }
  };

  const handleExploreCatalog = () => {
    onClose();
    if (onNavigate) {
      onNavigate('catalog');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden no-print"
      id="cart-drawer-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cart-drawer-title"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
        title="Clique para fechar o carrinho"
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-6 sm:pl-10">
        <div className="w-screen max-w-md bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-300 relative z-10">
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-xs">
                <ShoppingBag className="w-5 h-5 text-[#FFDD00]" />
              </div>
              <div>
                <h3
                  id="cart-drawer-title"
                  className="font-heading text-base sm:text-lg font-bold text-slate-900 uppercase tracking-tight"
                >
                  Seu Carrinho ({totalItemCount} {totalItemCount === 1 ? 'item' : 'itens'})
                </h3>
                <p className="text-[11px] text-slate-500">Tabela de preço progressiva aplicada</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors focus:outline-none"
              title="Fechar carrinho (ESC)"
              aria-label="Fechar carrinho"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body / Items list */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
            {cartList.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-4">
                <div className="w-20 h-20 rounded-3xl bg-slate-100 flex items-center justify-center text-slate-300">
                  <ShoppingBag className="w-10 h-10" />
                </div>
                <div className="space-y-1">
                  <h4 className="font-bold text-slate-900 text-lg">Seu carrinho está vazio</h4>
                  <p className="text-xs text-slate-500 max-w-xs leading-relaxed">
                    Navegue pelo nosso catálogo de brindes corporativos, selecione as quantidades e personalize com a sua marca.
                  </p>
                </div>
                <button
                  onClick={handleExploreCatalog}
                  className="mt-2 px-5 py-2.5 bg-slate-900 hover:bg-[#E6007E] text-white text-xs font-bold rounded-xl shadow-md transition-colors flex items-center gap-2 cursor-pointer"
                >
                  <span>Explorar Catálogo</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 text-xs text-slate-500">
                  <span>Itens adicionados ({cartList.length})</span>
                  <button
                    onClick={handleClear}
                    className="text-rose-600 hover:text-rose-700 hover:underline text-[11px] flex items-center gap-1 font-medium cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" /> Limpar tudo
                  </button>
                </div>

                {cartList.map((item, index) => {
                  const unitPrice = getUnitPrice(item);
                  const quantity = getItemQuantity(item);
                  const itemTotal = unitPrice * quantity;
                  const minQty = item?.product?.min_order_qty || 1;
                  const imageUrl =
                    item?.product?.images && item.product.images.length > 0 && item.product.images[0]
                      ? item.product.images[0]
                      : 'https://images.unsplash.com/photo-1541807084-5c52b6b3adef?w=400&q=80';
                  const productName = item?.product?.name || 'Brinde Corporativo Personalizado';

                  return (
                    <div
                      key={item.id || `cart-item-${index}`}
                      className="p-3.5 rounded-xl border border-slate-200 bg-white hover:border-slate-300 shadow-xs transition-all space-y-3"
                    >
                      <div className="flex gap-3">
                        <img
                          src={imageUrl}
                          alt={productName}
                          className="w-16 h-16 object-cover rounded-lg border border-slate-100 flex-shrink-0 bg-slate-50"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).src =
                              'https://images.unsplash.com/photo-1541807084-5c52b6b3adef?w=400&q=80';
                          }}
                        />
                        <div className="flex-1 min-w-0">
                          <h4 className="text-xs font-bold text-slate-900 line-clamp-2 leading-snug">
                            {productName}
                          </h4>
                          {item?.product?.code && (
                            <span className="text-[10px] text-slate-400 block font-mono">
                              CÓD: {item.product.code}
                            </span>
                          )}
                          <div className="flex flex-wrap items-center gap-1.5 mt-1.5 text-[11px] text-slate-500">
                            {item.variant && (
                              <span className="font-medium bg-slate-100 px-1.5 py-0.5 rounded text-slate-700 text-[10px]">
                                {item.variant.name}
                              </span>
                            )}
                            {item.customTechnique && (
                              <span className="bg-sky-50 text-[#00AEEF] px-1.5 py-0.5 rounded font-medium text-[10px]">
                                {item.customTechnique}
                              </span>
                            )}
                            {item.customArtworkName && (
                              <span className="bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded text-[10px] truncate max-w-[120px]">
                                Logo anexada
                              </span>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => handleRemove(item.id)}
                          className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition-colors self-start cursor-pointer"
                          title="Remover produto do carrinho"
                          aria-label={`Remover ${productName}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                        {/* Qty controller */}
                        <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden bg-slate-50">
                          <button
                            onClick={() => {
                              const step = quantity > 50 ? 10 : 5;
                              handleUpdateQty(item.id, Math.max(minQty, quantity - step));
                            }}
                            className="px-2 py-1.5 text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
                            title="Diminuir quantidade"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <input
                            type="number"
                            min={minQty}
                            value={quantity}
                            onChange={(e) =>
                              handleUpdateQty(item.id, Math.max(minQty, parseInt(e.target.value) || minQty))
                            }
                            className="w-14 text-center text-xs font-bold bg-transparent border-x border-slate-200 py-1 focus:outline-none"
                          />
                          <button
                            onClick={() => {
                              const step = quantity >= 50 ? 10 : 5;
                              handleUpdateQty(item.id, quantity + step);
                            }}
                            className="px-2 py-1.5 text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
                            title="Aumentar quantidade"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>

                        {/* Price calc */}
                        <div className="text-right">
                          <div className="text-[11px] text-slate-400">
                            {quantity} un × R$ {unitPrice.toFixed(2)}
                          </div>
                          <div className="text-sm font-black text-slate-900 font-heading">
                            R$ {itemTotal.toFixed(2)}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>

          {/* Footer with totals & Action buttons */}
          {cartList.length > 0 && (
            <div className="p-4 sm:p-5 border-t border-slate-200 bg-slate-50 space-y-3">
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal ({totalItemCount} itens):</span>
                  <span className="font-semibold text-slate-800">R$ {subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-emerald-700 bg-emerald-50 px-2.5 py-1.5 rounded-lg font-medium border border-emerald-100">
                  <span className="flex items-center gap-1.5">
                    <QrCode className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Desconto de 5% no PIX:</span>
                  </span>
                  <span className="font-bold">- R$ {pixDiscount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm font-bold text-slate-900 pt-1.5 border-t border-slate-200">
                  <span>Total à vista no PIX:</span>
                  <span className="font-extrabold text-base text-[#E6007E] font-heading">
                    R$ {totalWithPix.toFixed(2)}
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 text-center">
                  Ou R$ {subtotal.toFixed(2)} em até 12x no cartão de crédito / Faturado PJ
                </p>
              </div>

              <div className="space-y-2 pt-1">
                <button
                  onClick={handleGoToCheckout}
                  className="w-full py-3 bg-slate-900 hover:bg-[#E6007E] text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer group"
                  id="btn-drawer-checkout"
                >
                  <span>Finalizar Pedido Online</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>

                <button
                  onClick={handleGoToQuote}
                  className="w-full py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  id="btn-drawer-quote"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-[#00AEEF]" />
                  <span>Gerar Orçamento Formal em PDF</span>
                </button>
              </div>

              <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-500 pt-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Compra Segura • Nota Fiscal • Garantia de Qualidade</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
