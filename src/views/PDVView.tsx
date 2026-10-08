import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Product,
  Category,
  UserProfile,
  PDVSale,
  PDVSaleItem,
  PDVPaymentSplit,
  PaymentGatewayProvider,
  CashRegisterSession,
  CompanySettings,
} from '../types';
import { StorageService } from '../services/storage';
import { PaymentService } from '../services/paymentService';
import { SEOHead } from '../components/SEOHead';
import { PDVCameraScannerModal } from '../components/PDVCameraScannerModal';
import { PDVProductCodeModal } from '../components/PDVProductCodeModal';
import { PDVReceiptPrintModal } from '../components/PDVReceiptPrintModal';
import { PDVSalesHistoryModal } from '../components/PDVSalesHistoryModal';
import {
  findProductByScanCode,
  getProductBarcode,
  getProductQrCodePayload,
  playScannerSuccessBeep,
  playScannerErrorBeep,
} from '../utils/barcodeService';
import {
  Search,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  DollarSign,
  CreditCard,
  QrCode,
  Barcode,
  Camera,
  Printer,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  User,
  Tag,
  Percent,
  RotateCcw,
  Sparkles,
  Lock,
  Unlock,
  Receipt,
  Share2,
  Maximize2,
  RefreshCw,
  Sliders,
  Send,
  X,
  Keyboard,
  Store,
  LayoutGrid,
  List,
  Volume2,
  VolumeX,
  Eye,
  Check,
  Flame,
  ArrowUpDown,
  Zap,
  History,
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface PDVViewProps {
  currentUser: UserProfile;
  products: Product[];
  categories: Category[];
  onNavigate: (view: string, param?: string) => void;
}

interface CartItemQuantityInputProps {
  itemId: string;
  quantity: number;
  productName: string;
  maxStock: number;
  allowNegativeStock: boolean;
  onUpdate: (itemId: string, newQty: number) => void;
}

const CartItemQuantityInput: React.FC<CartItemQuantityInputProps> = ({
  itemId,
  quantity,
  productName,
  maxStock,
  allowNegativeStock,
  onUpdate,
}) => {
  const [localVal, setLocalVal] = useState<string>(String(quantity));

  useEffect(() => {
    setLocalVal(String(quantity));
  }, [quantity]);

  const commitValue = () => {
    const parsed = parseInt(localVal, 10);
    if (isNaN(parsed) || parsed <= 0) {
      setLocalVal(String(quantity));
      return;
    }
    if (!allowNegativeStock && parsed > maxStock) {
      onUpdate(itemId, Math.max(1, maxStock));
      setLocalVal(String(Math.max(1, maxStock)));
      return;
    }
    if (parsed !== quantity) {
      onUpdate(itemId, parsed);
    }
  };

  return (
    <div className="flex items-center gap-1 shrink-0 bg-slate-50 border border-slate-200 rounded-xl p-0.5 shadow-2xs">
      <button
        type="button"
        onClick={() => onUpdate(itemId, Math.max(1, quantity - 1))}
        className="w-6 h-6 rounded-lg bg-white hover:bg-slate-200 text-slate-700 flex items-center justify-center cursor-pointer transition-colors shadow-2xs"
        title="Diminuir 1 un"
      >
        <Minus className="w-3 h-3" />
      </button>

      <input
        type="number"
        min="1"
        value={localVal}
        onChange={(e) => setLocalVal(e.target.value)}
        onBlur={commitValue}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.currentTarget.blur();
          }
        }}
        onFocus={(e) => e.target.select()}
        className="w-12 text-center text-xs font-black text-slate-900 bg-transparent outline-none py-0.5"
        title={`Clique para digitar a quantidade vendida de ${productName}`}
      />

      <button
        type="button"
        onClick={() => {
          if (!allowNegativeStock && quantity >= maxStock) return;
          onUpdate(itemId, quantity + 1);
        }}
        className="w-6 h-6 rounded-lg bg-white hover:bg-slate-200 text-slate-700 flex items-center justify-center cursor-pointer transition-colors shadow-2xs"
        title="Aumentar 1 un"
      >
        <Plus className="w-3 h-3" />
      </button>
    </div>
  );
};

export const PDVView: React.FC<PDVViewProps> = ({
  currentUser,
  products,
  categories,
  onNavigate,
}) => {
  // Settings & Storage
  const [pdvSettings, setPdvSettings] = useState(() => StorageService.getPDVSettings());
  const [companySettings, setCompanySettings] = useState<CompanySettings>(() =>
    StorageService.getCompanySettings()
  );
  const [gateways, setGateways] = useState(() => StorageService.getPaymentGateways());

  // Cash Register State
  const [currentSession, setCurrentSession] = useState<CashRegisterSession | null>(() =>
    StorageService.getCurrentCashRegisterSession()
  );
  const [isCashOpenModalVisible, setIsCashOpenModalVisible] = useState(false);
  const [isCashCloseModalVisible, setIsCashCloseModalVisible] = useState(false);
  const [isSangriaModalVisible, setIsSangriaModalVisible] = useState(false);
  const [initialFundInput, setInitialFundInput] = useState(200);
  const [sangriaAmountInput, setSangriaAmountInput] = useState(50);
  const [sangriaTypeInput, setSangriaTypeInput] = useState<'sangria' | 'suprimento'>('sangria');
  const [sangriaReasonInput, setSangriaReasonInput] = useState('Sangria para cofre central');
  const [actualCashInput, setActualCashInput] = useState(0);

  // Cart / Sale in progress
  const [cartItems, setCartItems] = useState<PDVSaleItem[]>([]);
  const [generalDiscountType, setGeneralDiscountType] = useState<'percent' | 'fixed'>('fixed');
  const [generalDiscountValue, setGeneralDiscountValue] = useState<number>(0);

  // Customer identification
  const [customerName, setCustomerName] = useState('Consumidor Final');
  const [customerCpfCnpj, setCustomerCpfCnpj] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');

  // Catalog Filters & Modern Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchMode, setSearchMode] = useState<'all' | 'name' | 'barcode' | 'qrCode'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<'popularity' | 'price_asc' | 'price_desc' | 'stock' | 'name'>('popularity');
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const [isCameraScannerOpen, setIsCameraScannerOpen] = useState(false);
  const [productForCodeModal, setProductForCodeModal] = useState<Product | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [scanToast, setScanToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [activeQuantity, setActiveQuantity] = useState<number>(1);
  const [lockQuantity, setLockQuantity] = useState<boolean>(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const quantityInputRef = useRef<HTMLInputElement>(null);
  const cartListRef = useRef<HTMLDivElement>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const scannerBufferRef = useRef<string>('');
  const scannerLastKeyTimeRef = useRef<number>(0);
  const handleDirectScanRef = useRef<(code: string, customQty?: number) => void>(() => {});

  // Auto-scroll cart ticket list to latest bipado item
  useEffect(() => {
    if (cartListRef.current) {
      cartListRef.current.scrollTop = cartListRef.current.scrollHeight;
    }
  }, [cartItems.length]);

  const showScanToast = (message: string, type: 'success' | 'error' = 'success') => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setScanToast({ message, type });
    toastTimeoutRef.current = setTimeout(() => {
      setScanToast(null);
    }, 2800);
  };

  // Payment Modal State
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [payments, setPayments] = useState<PDVPaymentSplit[]>([]);
  const [activePaymentMethod, setActivePaymentMethod] = useState<
    'dinheiro' | 'cartao_credito' | 'cartao_debito' | 'pix'
  >('dinheiro');
  const [currentAmountToPay, setCurrentAmountToPay] = useState<number>(0);
  const [cashReceivedInput, setCashReceivedInput] = useState<number>(0);
  const [creditInstallments, setCreditInstallments] = useState<number>(1);
  const [selectedGateway, setSelectedGateway] = useState<PaymentGatewayProvider>(
    pdvSettings.defaultGateway || 'mercadopago'
  );
  const [cardBrand, setCardBrand] = useState('Mastercard');
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  // Completed Sale / Receipt Print Modal & Sales History
  const [completedSale, setCompletedSale] = useState<PDVSale | null>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [saleToPrint, setSaleToPrint] = useState<PDVSale | null>(null);
  const [isPreSalePrint, setIsPreSalePrint] = useState(false);
  const [isSalesHistoryOpen, setIsSalesHistoryOpen] = useState(false);

  // Totals Calculation
  const subtotal = useMemo(() => {
    return cartItems.reduce((acc, item) => acc + item.total, 0);
  }, [cartItems]);

  const discountAmount = useMemo(() => {
    if (generalDiscountType === 'percent') {
      return Number(((subtotal * generalDiscountValue) / 100).toFixed(2));
    }
    return Number(Math.min(subtotal, generalDiscountValue).toFixed(2));
  }, [subtotal, generalDiscountType, generalDiscountValue]);

  const total = useMemo(() => {
    return Math.max(0, subtotal - discountAmount);
  }, [subtotal, discountAmount]);

  const paidAmount = useMemo(() => {
    return payments.reduce((acc, p) => acc + p.amount, 0);
  }, [payments]);

  const remainingToPay = useMemo(() => {
    return Math.max(0, Number((total - paidAmount).toFixed(2)));
  }, [total, paidAmount]);

  const cashChange = useMemo(() => {
    if (activePaymentMethod === 'dinheiro' && cashReceivedInput > currentAmountToPay) {
      return Number((cashReceivedInput - currentAmountToPay).toFixed(2));
    }
    return 0;
  }, [activePaymentMethod, cashReceivedInput, currentAmountToPay]);

  // Sync remaining to current input when modal opens or total changes
  useEffect(() => {
    if (isPaymentModalOpen) {
      setCurrentAmountToPay(remainingToPay);
      setCashReceivedInput(remainingToPay);
    }
  }, [isPaymentModalOpen, remainingToPay]);

  // Keyboard Shortcuts (F2: Nova Venda, F4: Focar Busca, F7: Câmera Scanner, F10: Finalizar, ESC: Fechar)
  // and USB Barcode Scanner gun global interceptor
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInputFocused =
        target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);

      // Global Hardware Barcode Gun Reader (when not typing in an explicit text field)
      if (!isInputFocused) {
        const now = Date.now();
        if (e.key === 'Enter') {
          if (scannerBufferRef.current.length >= 3 && now - scannerLastKeyTimeRef.current < 450) {
            e.preventDefault();
            const scanned = scannerBufferRef.current.trim();
            scannerBufferRef.current = '';
            handleDirectScanRef.current(scanned);
            return;
          }
          scannerBufferRef.current = '';
        } else if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
          if (now - scannerLastKeyTimeRef.current > 250) {
            scannerBufferRef.current = '';
          }
          scannerBufferRef.current += e.key;
          scannerLastKeyTimeRef.current = now;
        }
      }

      if (e.key === 'F2') {
        e.preventDefault();
        handleNewSale();
      } else if (e.key === 'F3') {
        e.preventDefault();
        quantityInputRef.current?.focus();
        quantityInputRef.current?.select();
      } else if (e.key === 'F4') {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      } else if (e.key === 'F7') {
        e.preventDefault();
        setIsCameraScannerOpen((prev) => !prev);
      } else if (e.key === 'F8') {
        e.preventDefault();
        handleOpenPreSalePrint();
      } else if (e.key === 'F9') {
        e.preventDefault();
        setIsSalesHistoryOpen((prev) => !prev);
      } else if (e.key === 'F10') {
        e.preventDefault();
        if (cartItems.length > 0 && !isPaymentModalOpen) {
          setIsPaymentModalOpen(true);
        }
      } else if (e.key === 'Escape') {
        if (isCameraScannerOpen) {
          setIsCameraScannerOpen(false);
        } else if (productForCodeModal) {
          setProductForCodeModal(null);
        } else if (isPaymentModalOpen) {
          setIsPaymentModalOpen(false);
        } else if (isPrintModalOpen) {
          setIsPrintModalOpen(false);
        } else if (isSalesHistoryOpen) {
          setIsSalesHistoryOpen(false);
        } else if (isReceiptModalOpen) {
          setIsReceiptModalOpen(false);
        } else {
          setSearchQuery('');
          setHighlightedIndex(-1);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    cartItems,
    isPaymentModalOpen,
    isReceiptModalOpen,
    isPrintModalOpen,
    isSalesHistoryOpen,
    isCameraScannerOpen,
    productForCodeModal,
    subtotal,
    discountAmount,
    total,
    customerName,
    customerCpfCnpj,
  ]);

  // Filtered & Sorted Products
  const filteredProducts = useMemo(() => {
    const list = products.filter((p) => {
      // Category filter check (support categoryId and category_id)
      const matchesCategory =
        selectedCategory === 'all' ||
        p.categoryId === selectedCategory ||
        (p as any).category_id === selectedCategory;

      if (!matchesCategory) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const barcode = getProductBarcode(p).toLowerCase();
        const qrPayload = getProductQrCodePayload(p).toLowerCase();

        if (searchMode === 'barcode') {
          return barcode.includes(q) || (p.barcode && p.barcode.toLowerCase().includes(q));
        }
        if (searchMode === 'qrCode') {
          return qrPayload.includes(q) || (p.qrCode && p.qrCode.toLowerCase().includes(q));
        }
        if (searchMode === 'name') {
          return p.name.toLowerCase().includes(q);
        }

        // Search mode 'all': match across Name, Code, Barcode, QR Code, and Variant SKUs
        const matchesName = p.name.toLowerCase().includes(q);
        const matchesCode = p.code.toLowerCase().includes(q);
        const matchesBarcode = barcode.includes(q) || (p.barcode && p.barcode.toLowerCase().includes(q));
        const matchesQr = qrPayload.includes(q) || (p.qrCode && p.qrCode.toLowerCase().includes(q));
        const matchesVariants = p.variants?.some(
          (v) =>
            v.sku?.toLowerCase().includes(q) ||
            v.name?.toLowerCase().includes(q) ||
            v.barcode?.toLowerCase().includes(q)
        );

        return matchesName || matchesCode || matchesBarcode || matchesQr || matchesVariants;
      }

      return true;
    });

    // Apply sorting
    return list.sort((a, b) => {
      if (sortBy === 'price_asc') {
        const priceA = a.promo_price || a.base_price;
        const priceB = b.promo_price || b.base_price;
        return priceA - priceB;
      }
      if (sortBy === 'price_desc') {
        const priceA = a.promo_price || a.base_price;
        const priceB = b.promo_price || b.base_price;
        return priceB - priceA;
      }
      if (sortBy === 'stock') {
        return b.stock_qty - a.stock_qty;
      }
      if (sortBy === 'name') {
        return a.name.localeCompare(b.name);
      }
      // Popularity default: featured or highest stock
      return (b.is_featured ? 1 : 0) - (a.is_featured ? 1 : 0);
    });
  }, [products, selectedCategory, searchQuery, searchMode, sortBy]);

  // Autocomplete suggestions (top 6 results when search is active)
  const autocompleteSuggestions = useMemo(() => {
    if (!searchQuery.trim()) return [];
    return filteredProducts.slice(0, 6);
  }, [filteredProducts, searchQuery]);

  // Add Item to Cart with Sound and Visual feedback
  const handleAddToCart = (product: Product, quantity = 1): boolean => {
    // Check stock if negative stock is disallowed
    if (!pdvSettings.allowNegativeStock && product.stock_qty <= 0) {
      if (soundEnabled) playScannerErrorBeep();
      showScanToast(`Produto "${product.name}" sem estoque disponível no momento.`, 'error');
      return false;
    }

    const price = product.promo_price || product.base_price;
    let success = true;

    setCartItems((prev) => {
      const existingIdx = prev.findIndex((item) => item.productId === product.id);
      if (existingIdx >= 0) {
        const updated = [...prev];
        const currentItem = updated[existingIdx];
        const newQty = currentItem.quantity + quantity;

        if (!pdvSettings.allowNegativeStock && newQty > product.stock_qty) {
          if (soundEnabled) playScannerErrorBeep();
          showScanToast(`Estoque máximo disponível atingido (${product.stock_qty} un).`, 'error');
          success = false;
          return prev;
        }

        updated[existingIdx] = {
          ...currentItem,
          quantity: newQty,
          total: Number((newQty * currentItem.unitPrice - currentItem.discount).toFixed(2)),
        };
        return updated;
      } else {
        const newItem: PDVSaleItem = {
          id: `item-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          productId: product.id,
          productName: product.name,
          productSku: product.code,
          productImage: product.images[0],
          quantity: quantity,
          unitPrice: price,
          discount: 0,
          total: Number((price * quantity).toFixed(2)),
        };
        return [...prev, newItem];
      }
    });

    return success;
  };

  // Direct Barcode / QR Code scan handler (from physical scanner or Camera modal)
  const handleDirectScan = (scannedCode: string, customQty?: number) => {
    if (!scannedCode || !scannedCode.trim()) return;
    const qtyToApply = customQty || activeQuantity || 1;
    const match = findProductByScanCode(scannedCode, products);
    if (match) {
      const ok = handleAddToCart(match.product, qtyToApply);
      if (ok) {
        if (soundEnabled) playScannerSuccessBeep();
        showScanToast(
          `+${qtyToApply} ${match.product.name} (Bipado via ${match.matchedBy.toUpperCase()})`,
          'success'
        );
        if (!lockQuantity && !customQty) {
          setActiveQuantity(1);
        }
      }
    } else {
      if (soundEnabled) playScannerErrorBeep();
      showScanToast(`Código "${scannedCode}" não localizado no catálogo.`, 'error');
    }
  };
  handleDirectScanRef.current = handleDirectScan;

  // KeyDown handler for fast keyboard search and USB Barcode scanner input
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (autocompleteSuggestions.length > 0) {
        setHighlightedIndex((prev) => (prev + 1) % autocompleteSuggestions.length);
      }
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (autocompleteSuggestions.length > 0) {
        setHighlightedIndex((prev) =>
          (prev - 1 + autocompleteSuggestions.length) % autocompleteSuggestions.length
        );
      }
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const raw = searchQuery.trim();
      if (!raw) return;

      // Check if multiplier was entered: e.g. "5*" or "5x" or "10*789..." or "3*copo"
      const multMatch = raw.match(/^(\d+)[*xX]\s*(.*)$/);
      let queryToUse = raw;
      let qtyToUse = activeQuantity || 1;

      if (multMatch) {
        const parsed = parseInt(multMatch[1], 10);
        if (parsed > 0) {
          qtyToUse = parsed;
          queryToUse = multMatch[2].trim();
        }
        if (!queryToUse) {
          setActiveQuantity(qtyToUse);
          setSearchQuery('');
          showScanToast(`Quantidade definida para ${qtyToUse} un (Atalho F3)`, 'success');
          return;
        }
      }

      // 1. If highlighted in autocomplete dropdown
      if (highlightedIndex >= 0 && autocompleteSuggestions[highlightedIndex]) {
        const item = autocompleteSuggestions[highlightedIndex];
        const ok = handleAddToCart(item, qtyToUse);
        if (ok) {
          if (soundEnabled) playScannerSuccessBeep();
          showScanToast(`+${qtyToUse} ${item.name} adicionado ao cupom`, 'success');
          if (!lockQuantity) setActiveQuantity(1);
          setSearchQuery('');
          setHighlightedIndex(-1);
        }
        return;
      }

      // 2. Direct exact Barcode / QR Code / SKU match
      const match = findProductByScanCode(queryToUse, products);
      if (match) {
        const ok = handleAddToCart(match.product, qtyToUse);
        if (ok) {
          if (soundEnabled) playScannerSuccessBeep();
          showScanToast(`+${qtyToUse} ${match.product.name} (Bipado via ${match.matchedBy.toUpperCase()})`, 'success');
          if (!lockQuantity) setActiveQuantity(1);
          setSearchQuery('');
          setHighlightedIndex(-1);
        }
        return;
      }

      // 3. If there is a matching filtered list
      const matchingList = products.filter((p) => {
        const q = queryToUse.toLowerCase();
        return (
          p.name.toLowerCase().includes(q) ||
          p.code.toLowerCase().includes(q) ||
          getProductBarcode(p).toLowerCase().includes(q)
        );
      });

      if (matchingList.length === 1) {
        const item = matchingList[0];
        const ok = handleAddToCart(item, qtyToUse);
        if (ok) {
          if (soundEnabled) playScannerSuccessBeep();
          showScanToast(`+${qtyToUse} ${item.name} adicionado ao cupom`, 'success');
          if (!lockQuantity) setActiveQuantity(1);
          setSearchQuery('');
          setHighlightedIndex(-1);
        }
        return;
      }

      if (matchingList.length === 0) {
        if (soundEnabled) playScannerErrorBeep();
        showScanToast(`Nenhum produto encontrado para "${queryToUse}"`, 'error');
      }
    }
    if (e.key === 'Escape') {
      setSearchQuery('');
      setHighlightedIndex(-1);
    }
  };

  const handleUpdateItemQty = (itemId: string, newQty: number) => {
    if (newQty <= 0) {
      handleRemoveItem(itemId);
      return;
    }
    const targetItem = cartItems.find((i) => i.id === itemId);
    if (!targetItem) return;

    if (!pdvSettings.allowNegativeStock) {
      const prod = products.find((p) => p.id === targetItem.productId);
      if (prod && newQty > prod.stock_qty) {
        if (soundEnabled) playScannerErrorBeep();
        showScanToast(`Estoque máximo disponível atingido (${prod.stock_qty} un).`, 'error');
        newQty = Math.max(1, prod.stock_qty);
      }
    }

    setCartItems((prev) =>
      prev.map((item) => {
        if (item.id === itemId) {
          return {
            ...item,
            quantity: newQty,
            total: Number((newQty * item.unitPrice - item.discount).toFixed(2)),
          };
        }
        return item;
      })
    );
  };

  const handleSelectProduct = (product: Product, customQty?: number) => {
    const qty = customQty || activeQuantity || 1;
    const ok = handleAddToCart(product, qty);
    if (ok) {
      if (soundEnabled) playScannerSuccessBeep();
      showScanToast(`+${qty} ${product.name} adicionado ao cupom`, 'success');
      if (!lockQuantity && !customQty) {
        setActiveQuantity(1);
      }
    }
  };

  const handleRemoveItem = (itemId: string) => {
    setCartItems((prev) => prev.filter((i) => i.id !== itemId));
  };

  const handleNewSale = () => {
    if (cartItems.length > 0) {
      if (!confirm('Deseja cancelar os itens da venda atual e iniciar uma nova?')) return;
    }
    setCartItems([]);
    setPayments([]);
    setGeneralDiscountValue(0);
    setCustomerName('Consumidor Final');
    setCustomerCpfCnpj('');
    setCustomerPhone('');
    setIsPaymentModalOpen(false);
    searchInputRef.current?.focus();
  };

  // Add a payment split (e.g. R$ 50 cash + R$ 100 card)
  const handleAddPaymentSplit = async () => {
    if (currentAmountToPay <= 0) return;

    if (activePaymentMethod === 'dinheiro' && cashReceivedInput < currentAmountToPay) {
      alert('O valor em dinheiro recebido não pode ser menor que o valor a pagar.');
      return;
    }

    setIsProcessingPayment(true);

    try {
      let gwTransactionId: string | undefined;

      // If credit card or pix via gateway, call processPayment
      if (activePaymentMethod === 'cartao_credito' || activePaymentMethod === 'pix') {
        const processResult = await PaymentService.processPayment({
          gateway: selectedGateway,
          method: activePaymentMethod,
          amount: currentAmountToPay,
          installments: creditInstallments,
          card: { brand: cardBrand, number: '•••• •••• •••• 4242' },
          saleCode: `PDV-${Date.now().toString().slice(-4)}`,
          origin: 'pdv',
          operatorId: currentUser.id,
          operatorName: currentUser.name,
        });

        if (!processResult.success) {
          alert(`Falha no pagamento: ${processResult.statusDetail}`);
          setIsProcessingPayment(false);
          return;
        }
        gwTransactionId = processResult.transactionId;
      }

      const split: PDVPaymentSplit = {
        method: activePaymentMethod,
        amount: currentAmountToPay,
        gateway:
          activePaymentMethod === 'cartao_credito' || activePaymentMethod === 'pix'
            ? selectedGateway
            : 'manual',
        installments: activePaymentMethod === 'cartao_credito' ? creditInstallments : 1,
        gatewayTransactionId: gwTransactionId,
        cardBrand: activePaymentMethod === 'cartao_credito' ? cardBrand : undefined,
        receivedAmount: activePaymentMethod === 'dinheiro' ? cashReceivedInput : currentAmountToPay,
        changeAmount: activePaymentMethod === 'dinheiro' ? cashChange : 0,
      };

      const newPayments = [...payments, split];
      setPayments(newPayments);

      const totalPaidSoFar = newPayments.reduce((acc, p) => acc + p.amount, 0);
      const remaining = Math.max(0, Number((total - totalPaidSoFar).toFixed(2)));

      if (remaining <= 0) {
        // Full payment completed! Finalize sale
        await handleFinalizeSale(newPayments);
      } else {
        // Next split
        setCurrentAmountToPay(remaining);
        setCashReceivedInput(remaining);
      }
    } catch (err: any) {
      alert(`Erro ao processar split de pagamento: ${err.message}`);
    } finally {
      setIsProcessingPayment(false);
    }
  };

  // Finalize Sale
  const handleFinalizeSale = async (finalPayments: PDVPaymentSplit[]) => {
    const saleNum = Math.floor(1000 + Math.random() * 9000);
    const newSale: PDVSale = {
      id: `pdv-sale-${Date.now()}`,
      code: `PDV-2026-${saleNum}`,
      cashRegisterId: currentSession?.id || 'cash-default',
      cashRegisterNumber: currentSession?.registerNumber || 1,
      operatorId: currentUser.id,
      operatorName: currentUser.name,
      customerName: customerName.trim() || 'Consumidor Final',
      customerCpfCnpj: customerCpfCnpj.trim() || undefined,
      customerPhone: customerPhone.trim() || undefined,
      items: cartItems,
      subtotal,
      discount: discountAmount,
      additions: 0,
      total,
      payments: finalPayments,
      status: 'concluida',
      isCustomized: false,
      productionStatus: 'entregue',
      createdAt: new Date().toISOString(),
    };

    StorageService.addPDVSale(newSale);
    setCurrentSession(StorageService.getCurrentCashRegisterSession());
    setCompletedSale(newSale);
    setSaleToPrint(newSale);
    setIsPreSalePrint(false);
    setIsPaymentModalOpen(false);
    setIsPrintModalOpen(true);

    try {
      confetti({
        particleCount: 120,
        spread: 90,
        origin: { y: 0.6 },
        colors: ['#00AEEF', '#E6007E', '#FFDD00'],
      });
    } catch {}
  };

  // Open Pre-Sale / Budget Quote Print for items in cart
  const handleOpenPreSalePrint = () => {
    if (cartItems.length === 0) {
      showScanToast('Adicione produtos ao cupom para imprimir recibo/orçamento.', 'error');
      return;
    }
    const preSale: PDVSale = {
      id: `pre-sale-${Date.now()}`,
      code: `ORC-${Math.floor(1000 + Math.random() * 9000)}`,
      cashRegisterId: currentSession?.id || 'cash-default',
      cashRegisterNumber: currentSession?.registerNumber || 1,
      operatorId: currentUser.id,
      operatorName: currentUser.name,
      customerName: customerName.trim() || 'Consumidor Final',
      customerCpfCnpj: customerCpfCnpj.trim() || undefined,
      customerPhone: customerPhone.trim() || undefined,
      items: cartItems,
      subtotal,
      discount: discountAmount,
      additions: 0,
      total,
      payments: [{ method: 'outro', amount: total }],
      status: 'concluida',
      isCustomized: false,
      productionStatus: 'entregue',
      createdAt: new Date().toISOString(),
    };
    setSaleToPrint(preSale);
    setIsPreSalePrint(true);
    setIsPrintModalOpen(true);
  };

  // Open Reprint for past sale from history
  const handleSelectSaleForReprint = (sale: PDVSale) => {
    setSaleToPrint(sale);
    setIsPreSalePrint(false);
    setIsSalesHistoryOpen(false);
    setIsPrintModalOpen(true);
  };

  // Cash Register Actions
  const handleOpenCash = (e: React.FormEvent) => {
    e.preventDefault();
    const session = StorageService.openCashRegister(
      initialFundInput,
      pdvSettings.registerNumber,
      pdvSettings.registerName,
      currentUser
    );
    setCurrentSession(session);
    setIsCashOpenModalVisible(false);
  };

  const handleCloseCash = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentSession) return;
    const closed = StorageService.closeCashRegister(currentSession.id, actualCashInput);
    setCurrentSession(null);
    setIsCashCloseModalVisible(false);
    showScanToast(
      `Caixa fechado! Total Esperado: R$ ${closed.expectedCash.toFixed(2)} | Informado: R$ ${closed.actualCash?.toFixed(2)}`,
      'success'
    );
  };

  const handleAddSangria = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentSession) return;
    StorageService.addCashRegisterMovement(currentSession.id, {
      registerId: currentSession.id,
      type: sangriaTypeInput,
      amount: sangriaAmountInput,
      reason: sangriaReasonInput,
      operatorId: currentUser.id,
      operatorName: currentUser.name,
    });
    setCurrentSession(StorageService.getCurrentCashRegisterSession());
    setIsSangriaModalVisible(false);
    showScanToast(`${sangriaTypeInput.toUpperCase()} lançada com sucesso!`, 'success');
  };

  // Print Receipt Helper
  const handlePrintReceipt = () => {
    if (completedSale) {
      setSaleToPrint(completedSale);
      setIsPreSalePrint(false);
      setIsPrintModalOpen(true);
    } else {
      handleOpenPreSalePrint();
    }
  };

  return (
    <div className="w-full h-full max-h-full flex-1 min-h-0 bg-slate-100 flex flex-col font-sans select-none text-slate-800 overflow-hidden">
      <SEOHead
        title="PDV - Frente de Caixa (Loja Física)"
        description="Ponto de Venda ágil para atendimento e faturamento balcão na loja física MB Personaliza."
        canonicalPath="/pdv"
        noIndex={true}
      />

      {/* PDV Header Bar */}
      <header className="bg-slate-900 text-white px-3 sm:px-4 py-2 sm:py-2.5 flex items-center justify-between border-b border-slate-800 shadow-md no-print shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigate('admin')}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors flex items-center gap-1 text-xs font-semibold cursor-pointer"
            title="Voltar ao Painel Admin"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Admin</span>
          </button>

          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#E6007E] flex items-center justify-center font-black text-white text-xs">
              PDV
            </div>
            <div>
              <div className="text-sm font-extrabold uppercase font-heading flex items-center gap-1.5">
                <span>MB Personaliza • Caixa {pdvSettings.registerNumber}</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#00AEEF] text-white font-bold">
                  {currentSession?.status === 'aberto' ? 'ABERTO' : 'FECHADO'}
                </span>
              </div>
              <div className="text-[10px] text-slate-400">
                Operador: <strong>{currentUser.name}</strong>
              </div>
            </div>
          </div>
        </div>

        {/* Shortcuts Legend */}
        <div className="hidden xl:flex items-center gap-2 text-[11px] text-slate-300">
          <span className="px-2 py-0.5 rounded-md bg-slate-800/90 border border-slate-700/80 font-mono text-[10px] text-[#FFDD00]">
            F2 Nova Venda
          </span>
          <span className="px-2 py-0.5 rounded-md bg-slate-800/90 border border-slate-700/80 font-mono text-[10px] text-[#00AEEF]">
            F4 Buscar / EAN
          </span>
          <span className="px-2 py-0.5 rounded-md bg-slate-800/90 border border-slate-700/80 font-mono text-[10px] text-pink-400">
            F7 Câmera
          </span>
          <span className="px-2 py-0.5 rounded-md bg-slate-800/90 border border-slate-700/80 font-mono text-[10px] text-sky-300">
            F8 Imprimir
          </span>
          <span className="px-2 py-0.5 rounded-md bg-slate-800/90 border border-slate-700/80 font-mono text-[10px] text-amber-300">
            F9 Histórico
          </span>
          <span className="px-2 py-0.5 rounded-md bg-slate-800/90 border border-slate-700/80 font-mono text-[10px] text-emerald-400">
            F10 Pagamento
          </span>
        </div>

        {/* Cash Register Control Buttons & Printing / History */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Quick Print Pre-Sale / Quote Button */}
          <button
            type="button"
            onClick={handleOpenPreSalePrint}
            disabled={cartItems.length === 0}
            className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 cursor-pointer border border-slate-700/80 disabled:opacity-40 disabled:cursor-not-allowed"
            title="Imprimir Cupom / Recibo de Orçamento dos itens atuais (F8)"
          >
            <Printer className="w-3.5 h-3.5 text-[#00AEEF]" />
            <span className="hidden md:inline">Imprimir Recibo (F8)</span>
          </button>

          {/* Sales History & Reprint Modal Button */}
          <button
            type="button"
            onClick={() => setIsSalesHistoryOpen(true)}
            className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 cursor-pointer border border-slate-700/80"
            title="Ver Histórico de Vendas e Reimprimir 2ª Via de Cupom Fiscal (F9)"
          >
            <History className="w-3.5 h-3.5 text-[#E6007E]" />
            <span className="hidden md:inline">Histórico / 2ª Via (F9)</span>
          </button>

          {/* Sound Toggle */}
          <button
            type="button"
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
            title={soundEnabled ? 'Bip de Leitura Ativado (Clique para desativar)' : 'Bip Silenciado (Clique para ativar)'}
          >
            {soundEnabled ? (
              <Volume2 className="w-4 h-4 text-emerald-400" />
            ) : (
              <VolumeX className="w-4 h-4 text-slate-500" />
            )}
          </button>

          {currentSession?.status === 'aberto' ? (
            <>
              <button
                onClick={() => setIsSangriaModalVisible(true)}
                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                title="Sangria ou Suprimento de Caixa"
              >
                <DollarSign className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden md:inline">Sangria / Suprimento</span>
              </button>

              <button
                onClick={() => {
                  setActualCashInput(currentSession.expectedCash);
                  setIsCashCloseModalVisible(true);
                }}
                className="px-2.5 py-1.5 rounded-lg bg-rose-900/60 hover:bg-rose-900 text-rose-200 border border-rose-700 text-xs font-bold flex items-center gap-1 cursor-pointer"
                title="Fechar Turno de Caixa"
              >
                <Lock className="w-3.5 h-3.5 text-rose-400" />
                <span>Fechar Caixa</span>
              </button>
            </>
          ) : (
            <button
              onClick={() => setIsCashOpenModalVisible(true)}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-sm animate-pulse"
            >
              <Unlock className="w-4 h-4" />
              <span>Abrir Caixa</span>
            </button>
          )}

          <button
            onClick={() => onNavigate('home')}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
            title="Ver Loja Pública"
          >
            <Store className="w-4 h-4 text-[#00AEEF]" />
          </button>
        </div>
      </header>

      {/* Floating Scan Toast Banner */}
      {scanToast && (
        <div
          className={`fixed top-14 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-2xl shadow-2xl flex items-center gap-2.5 text-xs font-black animate-in fade-in slide-in-from-top-3 duration-200 ${
            scanToast.type === 'success'
              ? 'bg-emerald-500 text-slate-950 border border-emerald-400 shadow-emerald-500/20'
              : 'bg-rose-600 text-white border border-rose-500 shadow-rose-600/20'
          }`}
        >
          {scanToast.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-slate-950 font-black" />
          ) : (
            <AlertTriangle className="w-4 h-4 shrink-0 text-white font-black" />
          )}
          <span>{scanToast.message}</span>
        </div>
      )}

      {/* Main PDV Workspace (2 Columns: Left = Product Catalog, Right = Sale Register) */}
      <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden no-print">
        {/* LEFT COLUMN: Product Search & Quick Catalog (60% width) */}
        <div className="w-full md:w-7/12 xl:w-8/12 p-2 sm:p-2.5 flex flex-col gap-2 overflow-hidden border-b md:border-b-0 md:border-r border-slate-200 h-full max-h-full min-h-0">
          {/* Modern Search bar & Scanner Controls Container */}
          <div className="bg-white p-2.5 sm:p-3 rounded-2xl border border-slate-200 shadow-xs space-y-2 shrink-0">
            {/* Top Row: Quantity Selector + Search Input + Camera Scanner + Scanner Status */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              {/* Next Item Quantity Selector (Atalho F3) */}
              <div
                className={`flex items-center gap-1.5 border rounded-xl px-2.5 py-1.5 shrink-0 transition-all ${
                  activeQuantity > 1
                    ? 'bg-sky-50/90 border-[#00AEEF] ring-2 ring-sky-100 shadow-2xs'
                    : 'bg-slate-50 border-slate-200'
                } focus-within:bg-white focus-within:border-[#00AEEF] focus-within:ring-2 focus-within:ring-sky-100`}
              >
                <label
                  htmlFor="pdv-active-quantity"
                  className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 select-none cursor-pointer"
                >
                  Qtd:
                </label>
                <input
                  id="pdv-active-quantity"
                  ref={quantityInputRef}
                  type="number"
                  min="1"
                  step="1"
                  value={activeQuantity}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    setActiveQuantity(isNaN(val) || val <= 0 ? 1 : val);
                  }}
                  onFocus={(e) => e.target.select()}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      searchInputRef.current?.focus();
                      searchInputRef.current?.select();
                    }
                  }}
                  className="w-12 text-center text-xs font-black text-slate-900 bg-transparent outline-none"
                  title="Digite a quantidade para o próximo produto vendido ou bipado (Atalho F3)"
                />
                <button
                  type="button"
                  onClick={() => setLockQuantity((prev) => !prev)}
                  className={`p-1 rounded-md text-[10px] font-bold cursor-pointer transition-colors ${
                    lockQuantity
                      ? 'bg-amber-100 text-amber-900 border border-amber-300'
                      : 'text-slate-400 hover:text-slate-600 hover:bg-slate-200'
                  }`}
                  title={
                    lockQuantity
                      ? 'Quantidade Fixada: manterá este valor para múltiplos bips consecutivos'
                      : 'Quantidade Automática: voltará para 1 un após o próximo bip'
                  }
                >
                  {lockQuantity ? <Lock className="w-3.5 h-3.5 text-amber-600" /> : <Unlock className="w-3.5 h-3.5" />}
                </button>
                <span className="text-[9px] font-bold text-slate-400 bg-slate-200 px-1 py-0.5 rounded select-none">
                  F3
                </span>
              </div>

              <div className="relative flex-1">
                {/* Search / Barcode Status Icon */}
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5 pointer-events-none text-slate-400">
                  <Search className="w-4 h-4" />
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" title="Leitor Ativo" />
                </div>

                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setHighlightedIndex(-1);
                  }}
                  onKeyDown={handleSearchKeyDown}
                  placeholder={
                    activeQuantity > 1
                      ? `Multiplicador ativo (${activeQuantity}x): digite nome, EAN, QR Code ou SKU (F4)...`
                      : 'Pesquisar por Nome, EAN-13, QR Code ou digite 5* para multiplicar (F4)...'
                  }
                  className="w-full pl-12 pr-10 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none text-slate-900 placeholder:text-slate-400 font-medium focus:bg-white focus:border-[#00AEEF] focus:ring-2 focus:ring-sky-100 transition-all"
                />

                {/* Clear button if text exists */}
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setHighlightedIndex(-1);
                      searchInputRef.current?.focus();
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
                    title="Limpar pesquisa (Esc)"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}

                {/* Floating Autocomplete Dropdown Overlay */}
                {autocompleteSuggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-xl z-40 overflow-hidden divide-y divide-slate-100 animate-in fade-in slide-in-from-top-2">
                    <div className="px-3 py-1.5 bg-slate-50 flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      <span>Produtos encontrados ({filteredProducts.length})</span>
                      <span>Enter para adicionar • ↑ ↓ para navegar</span>
                    </div>

                    <div className="max-h-64 overflow-y-auto">
                      {autocompleteSuggestions.map((item, idx) => {
                        const isHighlighted = idx === highlightedIndex;
                        const itemBarcode = getProductBarcode(item);
                        const itemPrice = item.promo_price || item.base_price;
                        return (
                          <div
                            key={`suggest-${item.id}`}
                            onClick={() => {
                              handleSelectProduct(item);
                              setSearchQuery('');
                              setHighlightedIndex(-1);
                              searchInputRef.current?.focus();
                            }}
                            className={`p-2.5 flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                              isHighlighted
                                ? 'bg-sky-50 text-slate-900 border-l-4 border-l-[#00AEEF]'
                                : 'hover:bg-slate-50 text-slate-700'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-10 h-10 rounded-lg bg-slate-100 overflow-hidden shrink-0 border border-slate-200">
                                <img
                                  src={item.images[0]}
                                  alt={item.name}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                              <div className="min-w-0">
                                <h5 className="text-xs font-bold text-slate-900 truncate">
                                  {item.name}
                                </h5>
                                <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono">
                                  <span>SKU: {item.code}</span>
                                  <span>•</span>
                                  <span>EAN: {itemBarcode}</span>
                                </div>
                              </div>
                            </div>

                            <div className="text-right shrink-0">
                              <div className="text-xs font-black text-[#E6007E]">
                                R$ {itemPrice.toFixed(2)}
                              </div>
                              <span
                                className={`text-[9px] font-bold ${
                                  item.stock_qty <= 0
                                    ? 'text-rose-500'
                                    : item.stock_qty < 15
                                    ? 'text-amber-500'
                                    : 'text-emerald-600'
                                }`}
                              >
                                {item.stock_qty > 0 ? `${item.stock_qty} un em estoque` : 'Esgotado'}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Camera Scanner Trigger Button */}
              <button
                type="button"
                onClick={() => setIsCameraScannerOpen(true)}
                className="px-3.5 py-2.5 rounded-xl bg-slate-900 hover:bg-[#00AEEF] text-white text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer shrink-0"
                title="Abrir Scanner de Câmera (F7)"
              >
                <Camera className="w-4 h-4 text-[#FFDD00]" />
                <span>Câmera Scanner</span>
                <span className="font-mono text-[10px] text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">
                  F7
                </span>
              </button>
            </div>

            {/* Filter Modes & Quick Simulation Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-1 border-t border-slate-100">
              {/* Search Mode Chips */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1">
                  Filtrar por:
                </span>
                {[
                  { id: 'all', label: 'Todos os Campos' },
                  { id: 'barcode', label: 'Código de Barras (EAN)' },
                  { id: 'qrCode', label: 'QR Code' },
                  { id: 'name', label: 'Nome / SKU' },
                ].map((mode) => (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => setSearchMode(mode.id as any)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                      searchMode === mode.id
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>

              {/* View Mode & Sorting */}
              <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                {/* Sort selector */}
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="px-2 py-1 text-[11px] bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-semibold outline-none cursor-pointer"
                >
                  <option value="popularity">Mais Vendidos</option>
                  <option value="price_asc">Menor Preço</option>
                  <option value="price_desc">Maior Preço</option>
                  <option value="stock">Maior Estoque</option>
                  <option value="name">Nome (A-Z)</option>
                </select>

                {/* View Mode Toggle: Grid vs List */}
                <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setViewMode('grid')}
                    className={`p-1 rounded-md transition-colors cursor-pointer ${
                      viewMode === 'grid'
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                    title="Exibição em Grade de Fotos"
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('list')}
                    className={`p-1 rounded-md transition-colors cursor-pointer ${
                      viewMode === 'list'
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                    title="Exibição em Tabela Compacta (PDV Rápido)"
                  >
                    <List className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Quick Multipliers & Test Simulator Ribbon */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 overflow-x-auto pb-0.5 pt-0.5 text-xs text-slate-500">
              <div className="flex items-center gap-1 shrink-0">
                <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider mr-1">
                  Multiplicador:
                </span>
                {[1, 2, 5, 10, 20, 50].map((qtyPreset) => (
                  <button
                    key={`qty-preset-${qtyPreset}`}
                    type="button"
                    onClick={() => {
                      setActiveQuantity(qtyPreset);
                      showScanToast(`Quantidade definida para ${qtyPreset} un`, 'success');
                    }}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold transition-colors cursor-pointer ${
                      activeQuantity === qtyPreset
                        ? 'bg-[#00AEEF] text-white shadow-2xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {qtyPreset}x
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1.5 shrink-0 overflow-x-auto">
                <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider whitespace-nowrap flex items-center gap-1">
                  <Zap className="w-3 h-3 text-[#FFDD00]" />
                  <span>Testar Bip:</span>
                </span>

                {products.slice(0, 3).map((p) => {
                  const barcode = getProductBarcode(p);
                  return (
                    <button
                      key={`sim-btn-${p.id}`}
                      type="button"
                      onClick={() => handleDirectScan(barcode)}
                      className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-sky-50 hover:text-sky-700 hover:border-sky-200 border border-slate-200 text-[10px] font-bold text-slate-700 whitespace-nowrap transition-colors flex items-center gap-1 cursor-pointer"
                      title={`Simular bip com quantidade atual (${activeQuantity}x): ${barcode}`}
                    >
                      <Barcode className="w-3 h-3 text-slate-400" />
                      <span>
                        {p.name.split(' ')[0]} ({barcode.slice(-4)})
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Categories Tab Filter Bar */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 shrink-0">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
                selectedCategory === 'all'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              <span>Todos os Produtos</span>
              <span className="text-[10px] opacity-75">({products.length})</span>
            </button>

            {categories.map((c) => {
              const count = products.filter(
                (p) => p.categoryId === c.id || (p as any).category_id === c.id
              ).length;
              return (
                <button
                  key={c.id}
                  onClick={() => setSelectedCategory(c.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
                    selectedCategory === c.id
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <span>{c.name}</span>
                  <span className="text-[10px] opacity-75">({count})</span>
                </button>
              );
            })}
          </div>

          {/* Products Header Bar with Scroll indicator */}
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 px-1 shrink-0">
            <span className="flex items-center gap-1.5">
              <LayoutGrid className="w-3.5 h-3.5 text-[#00AEEF]" />
              <span className="text-slate-800 font-extrabold">Grade de Produtos</span>
              <span className="text-[10px] text-slate-400 font-normal">
                ({filteredProducts.length} itens)
              </span>
            </span>
            <span className="text-[10px] text-slate-400 font-medium">
              ↕ Barra de rolagem ativa
            </span>
          </div>

          {/* Products List / Grid Container with visible scrollbar */}
          <div className="flex-1 min-h-0 overflow-y-auto pr-1.5 sm:pr-2 pdv-scroll overscroll-contain">
            {filteredProducts.length === 0 ? (
              <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 space-y-3">
                <Search className="w-10 h-10 text-slate-300 mx-auto" />
                <h4 className="text-sm font-bold text-slate-700">Nenhum produto encontrado</h4>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  Tente alterar o termo de pesquisa, o modo de filtro ou limpe a busca para visualizar o catálogo completo.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedCategory('all');
                  }}
                  className="px-3.5 py-1.5 bg-slate-900 text-white text-xs font-bold rounded-xl"
                >
                  Ver Todos os Produtos
                </button>
              </div>
            ) : viewMode === 'grid' ? (
              /* GRID VIEW MODE */
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2.5">
                {filteredProducts.map((p) => {
                  const price = p.promo_price || p.base_price;
                  const isOutOfStock = p.stock_qty <= 0;
                  const barcode = getProductBarcode(p);
                  return (
                    <div
                      key={p.id}
                      onClick={() => handleSelectProduct(p)}
                      className={`bg-white rounded-2xl border p-2.5 flex flex-col justify-between transition-all cursor-pointer group shadow-2xs hover:shadow-md hover:border-[#00AEEF] relative ${
                        isOutOfStock ? 'border-rose-200 bg-rose-50/20' : 'border-slate-200'
                      }`}
                    >
                      <div>
                        {/* Image + Stock Badge */}
                        <div className="relative aspect-square w-full rounded-xl overflow-hidden bg-slate-100 mb-2">
                          <img
                            src={p.images[0]}
                            alt={p.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            loading="lazy"
                          />

                          {/* Stock pill */}
                          <span
                            className={`absolute top-1.5 right-1.5 text-[9px] font-black px-1.5 py-0.5 rounded-md uppercase shadow-xs ${
                              isOutOfStock
                                ? 'bg-rose-600 text-white'
                                : p.stock_qty < 15
                                ? 'bg-amber-500 text-white'
                                : 'bg-slate-900/80 text-white backdrop-blur-xs'
                            }`}
                          >
                            {p.stock_qty} un
                          </span>

                          {/* Barcode & QR Code viewer button */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setProductForCodeModal(p);
                            }}
                            className="absolute top-1.5 left-1.5 p-1 rounded-md bg-white/90 hover:bg-white text-slate-700 shadow-xs backdrop-blur-xs transition-colors"
                            title="Ver Código de Barras e QR Code"
                          >
                            <Barcode className="w-3.5 h-3.5 text-slate-800" />
                          </button>
                        </div>

                        {/* Title & SKU info */}
                        <h4 className="text-xs font-bold text-slate-800 line-clamp-2 leading-tight">
                          {p.name}
                        </h4>

                        <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-mono mt-0.5">
                          <span>{p.code}</span>
                          <span>•</span>
                          <span className="truncate">{barcode}</span>
                        </div>
                      </div>

                      {/* Bottom price and add button */}
                      <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between">
                        <div>
                          {p.promo_price && (
                            <span className="text-[9px] text-slate-400 line-through block leading-none">
                              R$ {p.base_price.toFixed(2)}
                            </span>
                          )}
                          <span className="text-xs font-black text-[#E6007E]">
                            R$ {price.toFixed(2)}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectProduct(p);
                          }}
                          className="h-7 px-2.5 rounded-xl bg-sky-50 text-[#00AEEF] hover:bg-[#00AEEF] hover:text-white flex items-center justify-center gap-1 transition-colors font-bold shadow-2xs group-hover:bg-[#00AEEF] group-hover:text-white cursor-pointer"
                          title={`Adicionar ${activeQuantity} unidade(s) ao Cupom`}
                        >
                          <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                          {activeQuantity > 1 && (
                            <span className="text-[10px] font-black">{activeQuantity}x</span>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* COMPACT TABLE / LIST VIEW MODE */
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden divide-y divide-slate-100 shadow-2xs">
                {filteredProducts.map((p) => {
                  const price = p.promo_price || p.base_price;
                  const isOutOfStock = p.stock_qty <= 0;
                  const barcode = getProductBarcode(p);
                  return (
                    <div
                      key={`list-${p.id}`}
                      onClick={() => handleSelectProduct(p)}
                      className="p-2.5 flex items-center justify-between gap-3 hover:bg-slate-50 transition-colors cursor-pointer group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-lg bg-slate-100 overflow-hidden shrink-0 border border-slate-200">
                          <img src={p.images[0]} alt={p.name} className="w-full h-full object-cover" />
                        </div>

                        <div className="min-w-0">
                          <h5 className="text-xs font-bold text-slate-900 truncate max-w-xs sm:max-w-md">
                            {p.name}
                          </h5>
                          <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono mt-0.5">
                            <span className="font-semibold text-slate-600">{p.code}</span>
                            <span>•</span>
                            <span>EAN: {barcode}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 shrink-0">
                        {/* Stock status */}
                        <span
                          className={`text-[10px] font-bold ${
                            isOutOfStock
                              ? 'text-rose-600'
                              : p.stock_qty < 15
                              ? 'text-amber-600'
                              : 'text-slate-500'
                          }`}
                        >
                          {p.stock_qty} un
                        </span>

                        {/* Price */}
                        <div className="text-right min-w-16">
                          <div className="text-xs font-black text-[#E6007E]">
                            R$ {price.toFixed(2)}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setProductForCodeModal(p);
                            }}
                            className="p-1.5 rounded-lg border border-slate-200 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                            title="Ver Código de Barras"
                          >
                            <Barcode className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelectProduct(p);
                            }}
                            className="h-7 px-2.5 rounded-lg bg-sky-50 text-[#00AEEF] hover:bg-[#00AEEF] hover:text-white flex items-center justify-center gap-1 transition-colors font-bold cursor-pointer"
                            title={`Adicionar ${activeQuantity} unidade(s) ao Cupom`}
                          >
                            <Plus className="w-3.5 h-3.5" />
                            {activeQuantity > 1 && (
                              <span className="text-[10px] font-black">{activeQuantity}x</span>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Sale Ticket / Cart & Checkout Action (40% width) */}
        <div className="w-full md:w-5/12 xl:w-4/12 p-2 sm:p-2.5 flex flex-col gap-2 bg-white shadow-lg overflow-hidden h-full max-h-full min-h-0 border-l border-slate-200">
          {/* Customer Bar */}
          <div className="p-2.5 sm:p-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2 flex-1 min-w-0 mr-2">
              <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 shrink-0">
                <User className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Nome do Cliente / Consumidor Final"
                  className="w-full text-xs font-bold text-slate-900 bg-transparent outline-none truncate"
                />
                <input
                  type="text"
                  value={customerCpfCnpj}
                  onChange={(e) => setCustomerCpfCnpj(e.target.value)}
                  placeholder="CPF / CNPJ na nota (opcional)"
                  className="w-full text-[10px] text-slate-500 font-mono bg-transparent outline-none truncate"
                />
              </div>
            </div>

            <button
              onClick={handleNewSale}
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
              title="Nova Venda / Limpar (F2)"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>

          {/* Cart Header with Scroll Indicator */}
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 px-1 shrink-0">
            <span className="flex items-center gap-1.5 text-slate-800">
              <ShoppingCart className="w-3.5 h-3.5 text-[#E6007E]" />
              <span>Itens Bipados no Cupom</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-slate-100 font-mono text-slate-600">
                {cartItems.reduce((a, b) => a + b.quantity, 0)} un
              </span>
            </span>
            <span className="text-[10px] text-slate-400 font-medium">
              {cartItems.length > 0 ? '↕ Barra de rolagem ativa' : 'Vazio'}
            </span>
          </div>

          {/* Cart Items List with prominent dedicated scrollbar */}
          <div
            ref={cartListRef}
            className="flex-1 min-h-0 overflow-y-auto space-y-1.5 pr-1.5 sm:pr-2 border border-slate-200/90 rounded-xl p-2 bg-slate-50/80 pdv-scroll overscroll-contain"
          >
            {cartItems.length > 0 ? (
              cartItems.map((item) => (
                <div
                  key={item.id}
                  className="p-2 sm:p-2.5 rounded-xl bg-white border border-slate-200 shadow-2xs flex items-center justify-between gap-2"
                >
                  <div className="flex-1 min-w-0">
                    <h5 className="text-xs font-bold text-slate-900 truncate">
                      {item.productName}
                    </h5>
                    <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono">
                      <span>{item.productSku}</span>
                      <span>•</span>
                      <span>R$ {item.unitPrice.toFixed(2)} / un</span>
                    </div>
                  </div>

                  {/* Quantity Controller (Permite digitar quantidade ou usar botões) */}
                  {(() => {
                    const prod = products.find((p) => p.id === item.productId);
                    const maxStock = prod ? prod.stock_qty : 99999;
                    return (
                      <CartItemQuantityInput
                        itemId={item.id}
                        quantity={item.quantity}
                        productName={item.productName}
                        maxStock={maxStock}
                        allowNegativeStock={Boolean(pdvSettings.allowNegativeStock)}
                        onUpdate={handleUpdateItemQty}
                      />
                    );
                  })()}

                  <div className="text-right shrink-0 min-w-16">
                    <div className="text-xs font-extrabold text-slate-900">
                      R$ {item.total.toFixed(2)}
                    </div>
                    <button
                      onClick={() => handleRemoveItem(item.id)}
                      className="text-[10px] text-rose-500 hover:text-rose-700 cursor-pointer"
                    >
                      Remover
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
                <ShoppingCart className="w-10 h-10 mb-2 stroke-1 text-slate-300" />
                <p className="text-xs font-semibold">Nenhum item adicionado no cupom.</p>
                <span className="text-[10px] mt-1 text-slate-400">
                  Clique nos produtos ao lado ou use o leitor de código de barras.
                </span>
              </div>
            )}
          </div>

          {/* Subtotal & Discount Section */}
          <div className="p-2.5 sm:p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5 shrink-0">
            <div className="flex items-center justify-between text-xs text-slate-600">
              <span>Subtotal ({cartItems.reduce((a, b) => a + b.quantity, 0)} itens)</span>
              <span className="font-semibold text-slate-900">R$ {subtotal.toFixed(2)}</span>
            </div>

            <div className="flex items-center justify-between text-xs text-slate-600">
              <div className="flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-amber-500" />
                <span>Desconto</span>
                <div className="flex items-center border border-slate-200 rounded-md overflow-hidden bg-white text-[10px]">
                  <button
                    type="button"
                    onClick={() => setGeneralDiscountType('fixed')}
                    className={`px-1.5 py-0.5 font-bold ${
                      generalDiscountType === 'fixed'
                        ? 'bg-[#00AEEF] text-white'
                        : 'text-slate-500 hover:bg-slate-100'
                    }`}
                  >
                    R$
                  </button>
                  <button
                    type="button"
                    onClick={() => setGeneralDiscountType('percent')}
                    className={`px-1.5 py-0.5 font-bold ${
                      generalDiscountType === 'percent'
                        ? 'bg-[#00AEEF] text-white'
                        : 'text-slate-500 hover:bg-slate-100'
                    }`}
                  >
                    %
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={generalDiscountValue || ''}
                  onChange={(e) => setGeneralDiscountValue(Math.max(0, Number(e.target.value)))}
                  placeholder="0,00"
                  className="w-16 px-1.5 py-0.5 text-xs text-right font-bold bg-white rounded border border-slate-200 outline-none"
                />
                <span className="font-semibold text-rose-600 text-xs">
                  - R$ {discountAmount.toFixed(2)}
                </span>
              </div>
            </div>

            <div className="pt-1.5 border-t border-slate-200 flex items-center justify-between">
              <span className="text-xs sm:text-sm font-extrabold uppercase font-heading text-slate-900">
                Total a Pagar
              </span>
              <span className="text-xl sm:text-2xl font-black text-[#E6007E] font-heading">
                R$ {total.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Action Button: Finalizar Venda / Pagamento */}
          <button
            onClick={() => {
              if (cartItems.length === 0) {
                showScanToast('Adicione pelo menos um item para prosseguir com o pagamento.', 'error');
                return;
              }
              setIsPaymentModalOpen(true);
            }}
            disabled={cartItems.length === 0}
            className="w-full py-3 bg-gradient-to-r from-[#00AEEF] to-[#E6007E] hover:opacity-95 text-white font-extrabold uppercase rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed text-xs sm:text-sm shrink-0"
          >
            <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5" />
            <span>Finalizar Venda (F10)</span>
          </button>

          {/* Quick Auxiliary Action Buttons: Print Pre-Sale / Quote & Sales History */}
          <div className="grid grid-cols-2 gap-2 shrink-0">
            <button
              type="button"
              onClick={handleOpenPreSalePrint}
              disabled={cartItems.length === 0}
              className="py-1.5 px-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs"
              title="Imprimir cupom de orçamento ou recibo dos itens no carrinho (F8)"
            >
              <Printer className="w-3.5 h-3.5 text-[#00AEEF]" />
              <span>Recibo / Orç. (F8)</span>
            </button>

            <button
              type="button"
              onClick={() => setIsSalesHistoryOpen(true)}
              className="py-1.5 px-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
              title="Consultar histórico de vendas do PDV e reimprimir 2ª via de cupons (F9)"
            >
              <History className="w-3.5 h-3.5 text-[#E6007E]" />
              <span>Histórico / 2ª Via (F9)</span>
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* MODAL DE PAGAMENTO & SPLIT                                */}
      {/* ========================================================= */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-3xl w-full border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 flex flex-col max-h-[92vh]">
            <div className="p-5 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase text-[#00AEEF]">
                  Frente de Caixa MB
                </span>
                <h3 className="text-xl font-black uppercase font-heading">
                  Pagamento da Venda
                </h3>
              </div>
              <button
                onClick={() => setIsPaymentModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              {/* Payment Summary Bar */}
              <div className="grid grid-cols-3 gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-200 text-center">
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400">Total Venda</span>
                  <div className="text-lg font-black text-slate-900">R$ {total.toFixed(2)}</div>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400">Já Pago</span>
                  <div className="text-lg font-black text-emerald-600">
                    R$ {paidAmount.toFixed(2)}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400">Restante</span>
                  <div className="text-lg font-black text-[#E6007E]">
                    R$ {remainingToPay.toFixed(2)}
                  </div>
                </div>
              </div>

              {/* Payment Methods Tabs */}
              <div className="space-y-3">
                <span className="text-xs font-bold text-slate-700 block">
                  Selecione a Forma de Pagamento para este valor:
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setActivePaymentMethod('dinheiro')}
                    className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                      activePaymentMethod === 'dinheiro'
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-900 ring-2 ring-emerald-200 font-bold'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <DollarSign className="w-5 h-5 text-emerald-600" />
                    <span className="text-xs">Dinheiro</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActivePaymentMethod('cartao_credito')}
                    className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                      activePaymentMethod === 'cartao_credito'
                        ? 'border-[#00AEEF] bg-sky-50 text-sky-900 ring-2 ring-sky-200 font-bold'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <CreditCard className="w-5 h-5 text-[#00AEEF]" />
                    <span className="text-xs">Cartão Crédito</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActivePaymentMethod('cartao_debito')}
                    className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                      activePaymentMethod === 'cartao_debito'
                        ? 'border-[#E6007E] bg-pink-50 text-pink-900 ring-2 ring-pink-200 font-bold'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <CreditCard className="w-5 h-5 text-[#E6007E]" />
                    <span className="text-xs">Cartão Débito</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActivePaymentMethod('pix')}
                    className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                      activePaymentMethod === 'pix'
                        ? 'border-amber-500 bg-amber-50 text-amber-900 ring-2 ring-amber-200 font-bold'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <QrCode className="w-5 h-5 text-amber-500" />
                    <span className="text-xs">PIX Balcão</span>
                  </button>
                </div>
              </div>

              {/* Dynamic Payment Controls */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700">
                    Valor a Lançar nesta forma (R$):
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={remainingToPay}
                    value={currentAmountToPay || ''}
                    onChange={(e) => setCurrentAmountToPay(Number(e.target.value))}
                    className="w-32 px-3 py-1.5 text-base font-extrabold text-slate-900 bg-white rounded-xl border border-slate-300 text-right outline-none focus:border-[#00AEEF]"
                  />
                </div>

                {/* Dinheiro: Troco */}
                {activePaymentMethod === 'dinheiro' && (
                  <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-200">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Valor Recebido em Espécie:
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={cashReceivedInput || ''}
                        onChange={(e) => setCashReceivedInput(Number(e.target.value))}
                        className="w-full px-3 py-2 text-base font-bold bg-white rounded-xl border border-slate-300 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Troco a Devolver:
                      </label>
                      <div className="w-full px-3 py-2 text-base font-black text-emerald-700 bg-emerald-50 rounded-xl border border-emerald-200">
                        R$ {cashChange.toFixed(2)}
                      </div>
                    </div>
                  </div>
                )}

                {/* Cartão de Crédito: Gateway & Parcelamento */}
                {activePaymentMethod === 'cartao_credito' && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-slate-200">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Gateway de Processamento:
                      </label>
                      <select
                        value={selectedGateway}
                        onChange={(e) => setSelectedGateway(e.target.value as any)}
                        className="w-full px-3 py-2 text-xs font-bold bg-white rounded-xl border border-slate-300 outline-none"
                      >
                        <option value="mercadopago">Mercado Pago</option>
                        <option value="pagbank">PagBank (PagSeguro)</option>
                        <option value="manual">Maquininha Física POS</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Bandeira do Cartão:
                      </label>
                      <select
                        value={cardBrand}
                        onChange={(e) => setCardBrand(e.target.value)}
                        className="w-full px-3 py-2 text-xs font-bold bg-white rounded-xl border border-slate-300 outline-none"
                      >
                        <option value="Mastercard">Mastercard</option>
                        <option value="Visa">Visa</option>
                        <option value="Elo">Elo</option>
                        <option value="Hipercard">Hipercard</option>
                        <option value="Amex">American Express</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Parcelamento:
                      </label>
                      <select
                        value={creditInstallments}
                        onChange={(e) => setCreditInstallments(Number(e.target.value))}
                        className="w-full px-3 py-2 text-xs font-bold bg-white rounded-xl border border-slate-300 outline-none"
                      >
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => (
                          <option key={n} value={n}>
                            {n}x de R$ {(currentAmountToPay / n).toFixed(2)}{' '}
                            {n <= 3 ? '(Sem juros)' : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                {/* PIX: QR Code instantâneo */}
                {activePaymentMethod === 'pix' && (
                  <div className="pt-3 border-t border-slate-200 flex flex-col items-center text-center space-y-2">
                    <span className="text-xs font-bold text-slate-800">
                      PIX Chave CNPJ: {companySettings.cnpj}
                    </span>
                    <div className="w-36 h-36 bg-white p-2 rounded-xl border border-slate-300 shadow-sm flex items-center justify-center">
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(
                          `00020126580014br.gov.bcb.pix0136${companySettings.pixKey || '34567890000112'}520400005303986540${currentAmountToPay.toFixed(
                            2
                          )}5802BR5914MB PERSONALIZA6009SAO PAULO62070503***6304`
                        )}`}
                        alt="QR Code PIX"
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <span className="text-[10px] text-slate-500">
                      Apresente ao cliente para leitura direta no app do banco.
                    </span>
                  </div>
                )}
              </div>

              {/* Already Registered Splits */}
              {payments.length > 0 && (
                <div className="space-y-2">
                  <span className="text-xs font-bold text-slate-700 block">
                    Pagamentos Registrados Nesta Venda:
                  </span>
                  <div className="space-y-1.5">
                    {payments.map((p, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 rounded-xl bg-slate-100 flex items-center justify-between text-xs font-semibold"
                      >
                        <span className="capitalize">
                          {p.method.replace('_', ' ')}{' '}
                          {p.installments && p.installments > 1 ? `(${p.installments}x)` : ''}
                          {p.gateway ? ` • ${p.gateway.toUpperCase()}` : ''}
                        </span>
                        <span className="font-extrabold text-emerald-700">
                          R$ {p.amount.toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setIsPaymentModalOpen(false)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                Voltar
              </button>

              <button
                type="button"
                disabled={isProcessingPayment || currentAmountToPay <= 0}
                onClick={handleAddPaymentSplit}
                className="px-6 py-3 bg-[#E6007E] hover:bg-[#c9006e] text-white text-xs font-black uppercase rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isProcessingPayment ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                <span>
                  {isProcessingPayment
                    ? 'Processando Gateway...'
                    : remainingToPay - currentAmountToPay <= 0
                    ? 'Confirmar & Concluir Venda'
                    : `Lançar Parcial (R$ ${currentAmountToPay.toFixed(2)})`}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL DE IMPRESSÃO DE CUPOM FISCAL / RECIBO DE PEDIDO     */}
      {/* ========================================================= */}
      <PDVReceiptPrintModal
        isOpen={isPrintModalOpen}
        onClose={() => {
          setIsPrintModalOpen(false);
          if (completedSale) {
            handleNewSale();
          }
        }}
        sale={saleToPrint}
        companySettings={companySettings}
        currentUser={currentUser}
        isPreSale={isPreSalePrint}
        onNewSale={completedSale ? handleNewSale : undefined}
      />

      {/* ========================================================= */}
      {/* MODAL DE HISTÓRICO DE VENDAS DO PDV & REIMPRESSÃO (2ª VIA)*/}
      {/* ========================================================= */}
      <PDVSalesHistoryModal
        isOpen={isSalesHistoryOpen}
        onClose={() => setIsSalesHistoryOpen(false)}
        onSelectSaleForReprint={handleSelectSaleForReprint}
        currentUser={currentUser}
      />

      {/* ========================================================= */}
      {/* MODAL ABERTURA DE CAIXA                                   */}
      {/* ========================================================= */}
      {isCashOpenModalVisible && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleOpenCash}
            className="bg-white rounded-3xl max-w-md w-full border border-slate-200 shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95"
          >
            <div className="flex items-center gap-2 text-emerald-600 font-extrabold text-sm uppercase">
              <Unlock className="w-5 h-5" />
              <span>Abertura de Turno de Caixa</span>
            </div>
            <p className="text-xs text-slate-500">
              Informe o valor do fundo de troco inicial em notas e moedas para iniciar as vendas
              neste caixa.
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Fundo de Troco Inicial (R$):
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={initialFundInput}
                onChange={(e) => setInitialFundInput(Number(e.target.value))}
                className="w-full px-3 py-2 text-base font-extrabold bg-slate-50 border border-slate-300 rounded-xl outline-none focus:bg-white"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsCashOpenModalVisible(false)}
                className="px-4 py-2 bg-slate-200 text-slate-700 text-xs font-bold rounded-xl"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md cursor-pointer"
              >
                Confirmar Abertura
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL FECHAMENTO DE CAIXA                                 */}
      {/* ========================================================= */}
      {isCashCloseModalVisible && currentSession && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleCloseCash}
            className="bg-white rounded-3xl max-w-md w-full border border-slate-200 shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95"
          >
            <div className="flex items-center gap-2 text-rose-600 font-extrabold text-sm uppercase">
              <Lock className="w-5 h-5" />
              <span>Fechamento do Turno de Caixa</span>
            </div>
            <p className="text-xs text-slate-500">
              Conferência de valores do operador <strong>{currentSession.operatorName}</strong>.
            </p>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1 text-xs">
              <div className="flex justify-between">
                <span>Vendas Totais:</span>
                <span className="font-bold">R$ {currentSession.totalSalesAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Vendas Dinheiro:</span>
                <span className="font-bold text-emerald-700">
                  R$ {currentSession.totalCashSales.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Vendas Cartão / PIX:</span>
                <span className="font-bold text-[#00AEEF]">
                  R${' '}
                  {(
                    currentSession.totalCreditSales +
                    currentSession.totalDebitSales +
                    currentSession.totalPixSales
                  ).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between pt-1 border-t border-slate-200 font-bold">
                <span>Dinheiro Esperado na Gaveta:</span>
                <span className="text-slate-900">
                  R$ {currentSession.expectedCash.toFixed(2)}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Dinheiro Contado na Gaveta (R$):
              </label>
              <input
                type="number"
                step="0.01"
                required
                value={actualCashInput}
                onChange={(e) => setActualCashInput(Number(e.target.value))}
                className="w-full px-3 py-2 text-base font-extrabold bg-slate-50 border border-slate-300 rounded-xl outline-none focus:bg-white"
              />
              <span
                className={`text-[11px] font-bold block mt-1 ${
                  actualCashInput - currentSession.expectedCash >= 0
                    ? 'text-emerald-700'
                    : 'text-rose-600'
                }`}
              >
                Diferença de Caixa: R${' '}
                {(actualCashInput - currentSession.expectedCash).toFixed(2)}
              </span>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsCashCloseModalVisible(false)}
                className="px-4 py-2 bg-slate-200 text-slate-700 text-xs font-bold rounded-xl"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-md cursor-pointer"
              >
                Finalizar e Fechar Caixa
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL SANGRIA & SUPRIMENTO                                */}
      {/* ========================================================= */}
      {isSangriaModalVisible && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleAddSangria}
            className="bg-white rounded-3xl max-w-md w-full border border-slate-200 shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95"
          >
            <div className="flex items-center gap-2 text-amber-600 font-extrabold text-sm uppercase">
              <DollarSign className="w-5 h-5" />
              <span>Lançamento de Sangria ou Suprimento</span>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setSangriaTypeInput('sangria')}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  sangriaTypeInput === 'sangria'
                    ? 'bg-rose-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-700'
                }`}
              >
                Sangria (Retirada)
              </button>
              <button
                type="button"
                onClick={() => setSangriaTypeInput('suprimento')}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  sangriaTypeInput === 'suprimento'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-700'
                }`}
              >
                Suprimento (Entrada)
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Valor (R$):</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={sangriaAmountInput}
                onChange={(e) => setSangriaAmountInput(Number(e.target.value))}
                className="w-full px-3 py-2 text-base font-extrabold bg-slate-50 border border-slate-300 rounded-xl outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Justificativa / Motivo:
              </label>
              <input
                type="text"
                required
                value={sangriaReasonInput}
                onChange={(e) => setSangriaReasonInput(e.target.value)}
                placeholder="Ex: Retirada para pagamento de motoboy / Depósito cofre"
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsSangriaModalVisible(false)}
                className="px-4 py-2 bg-slate-200 text-slate-700 text-xs font-bold rounded-xl"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-[#00AEEF] hover:bg-sky-600 text-white text-xs font-bold rounded-xl shadow-md cursor-pointer"
              >
                Lançar Movimentação
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL SCANNER DE CÂMERA (BARCODE & QR CODE)               */}
      {/* ========================================================= */}
      <PDVCameraScannerModal
        isOpen={isCameraScannerOpen}
        onClose={() => setIsCameraScannerOpen(false)}
        products={products}
        onProductScanned={(scannedProduct) => {
          handleSelectProduct(scannedProduct);
        }}
      />

      {/* ========================================================= */}
      {/* MODAL DE CÓDIGO DE BARRAS & QR CODE DO PRODUTO (ETIQUETA) */}
      {/* ========================================================= */}
      <PDVProductCodeModal
        product={productForCodeModal}
        isOpen={Boolean(productForCodeModal)}
        onClose={() => setProductForCodeModal(null)}
        onSimulateScan={(code, modalQty) => {
          handleDirectScan(code, modalQty);
        }}
      />
    </div>
  );
};
