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
  HelpCircle,
  Info,
  CornerDownLeft,
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

  // Spotlight State: Exibir apenas a foto do produto que foi bipado
  interface LastScannedInfo {
    product: Product;
    quantity: number;
    unitPrice: number;
    total: number;
    scannedAt: number;
    scanMethod: string;
  }
  const [lastScannedProduct, setLastScannedProduct] = useState<LastScannedInfo | null>(null);
  const [scanPulse, setScanPulse] = useState(false);

  // New Modals for Full Keyboard Operations
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false); // F1
  const [isPriceCheckModalOpen, setIsPriceCheckModalOpen] = useState(false); // F5
  const [priceCheckQuery, setPriceCheckQuery] = useState('');
  const [priceCheckResult, setPriceCheckResult] = useState<Product | null>(null);
  const [isDiscountModalOpen, setIsDiscountModalOpen] = useState(false); // F6
  const [discountModalValue, setDiscountModalValue] = useState<string>('');
  const [discountModalType, setDiscountModalType] = useState<'percent' | 'fixed'>('percent');
  const customerNameInputRef = useRef<HTMLInputElement>(null);
  const customerCpfInputRef = useRef<HTMLInputElement>(null);
  const priceCheckInputRef = useRef<HTMLInputElement>(null);
  const discountModalInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus and clear modal inputs when opened
  useEffect(() => {
    if (isPriceCheckModalOpen) {
      setTimeout(() => {
        priceCheckInputRef.current?.focus();
        priceCheckInputRef.current?.select();
      }, 50);
    }
  }, [isPriceCheckModalOpen]);

  useEffect(() => {
    if (isDiscountModalOpen) {
      setTimeout(() => {
        discountModalInputRef.current?.focus();
        discountModalInputRef.current?.select();
      }, 50);
    }
  }, [isDiscountModalOpen]);

  // Live lookup in price check modal (F5)
  useEffect(() => {
    if (!priceCheckQuery.trim()) {
      setPriceCheckResult(null);
      return;
    }
    const match = findProductByScanCode(priceCheckQuery.trim(), products);
    if (match) {
      setPriceCheckResult(match.product);
    } else {
      const q = priceCheckQuery.toLowerCase().trim();
      const found = products.find(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.code.toLowerCase().includes(q) ||
          getProductBarcode(p).toLowerCase().includes(q)
      );
      setPriceCheckResult(found || null);
    }
  }, [priceCheckQuery, products]);

  // Catalog Filters & Modern Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchMode, setSearchMode] = useState<'all' | 'name' | 'barcode' | 'qrCode'>('all');
  const [viewMode, setViewMode] = useState<'scanner' | 'grid'>('scanner');
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
  const handleAddToCart = (product: Product, quantity = 1, scanMethod = 'BIPADO'): boolean => {
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

    if (success) {
      // Spotlight do Produto: na tela de PDV exibir apenas a foto do produto que foi bipado!
      setLastScannedProduct({
        product,
        quantity,
        unitPrice: price,
        total: Number((price * quantity).toFixed(2)),
        scannedAt: Date.now(),
        scanMethod,
      });
      setScanPulse(true);
      setTimeout(() => setScanPulse(false), 700);
    }

    return success;
  };

  // Direct Barcode / QR Code scan handler (from physical scanner or Camera modal)
  const handleDirectScan = (scannedCode: string, customQty?: number) => {
    if (!scannedCode || !scannedCode.trim()) return;
    const qtyToApply = customQty || activeQuantity || 1;
    const match = findProductByScanCode(scannedCode, products);
    if (match) {
      const ok = handleAddToCart(match.product, qtyToApply, `BIPADO VIA ${match.matchedBy.toUpperCase()}`);
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
    setCartItems([]);
    setPayments([]);
    setGeneralDiscountValue(0);
    setCustomerName('Consumidor Final');
    setCustomerCpfCnpj('');
    setCustomerPhone('');
    setIsPaymentModalOpen(false);
    setLastScannedProduct(null);
    setSearchQuery('');
    setActiveQuantity(1);
    searchInputRef.current?.focus();
    showScanToast('Nova Venda iniciada (Cupom limpo - F2)', 'success');
  };

  // Add a payment split (e.g. R$ 50 cash + R$ 100 card)
  const handleAddPaymentSplit = async () => {
    if (currentAmountToPay <= 0) return;

    if (activePaymentMethod === 'dinheiro' && cashReceivedInput < currentAmountToPay) {
      showScanToast('O valor recebido em dinheiro não pode ser menor que o valor a pagar.', 'error');
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
          showScanToast(`Falha no pagamento: ${processResult.statusDetail}`, 'error');
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
        showScanToast(`Pagamento parcial de R$ ${split.amount.toFixed(2)} registrado!`, 'success');
      }
    } catch (err: any) {
      showScanToast(`Erro ao processar pagamento: ${err.message}`, 'error');
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

  // Cancel / Remove Last Scanned Item (F12 or Delete)
  const handleCancelLastItem = () => {
    if (cartItems.length === 0) {
      if (soundEnabled) playScannerErrorBeep();
      showScanToast('Nenhum item no cupom para cancelar (F12).', 'error');
      return;
    }
    const itemToRemove = cartItems[cartItems.length - 1];
    handleRemoveItem(itemToRemove.id);
    if (soundEnabled) playScannerErrorBeep();
    showScanToast(`Item "${itemToRemove.productName}" cancelado do cupom (F12).`, 'error');

    // Update last scanned product spotlight
    const remainingItems = cartItems.slice(0, -1);
    if (remainingItems.length > 0) {
      const prevItem = remainingItems[remainingItems.length - 1];
      const prevProd = products.find((p) => p.id === prevItem.productId);
      if (prevProd) {
        setLastScannedProduct({
          product: prevProd,
          quantity: prevItem.quantity,
          unitPrice: prevItem.unitPrice,
          total: prevItem.total,
          scannedAt: Date.now(),
          scanMethod: 'ITEM ANTERIOR',
        });
      } else {
        setLastScannedProduct(null);
      }
    } else {
      setLastScannedProduct(null);
    }
  };

  // Apply Discount from Modal (F6)
  const handleApplyDiscountModal = () => {
    const parsed = parseFloat(discountModalValue.replace(',', '.'));
    if (isNaN(parsed) || parsed < 0) {
      showScanToast('Informe um valor de desconto válido.', 'error');
      return;
    }
    setGeneralDiscountType(discountModalType);
    setGeneralDiscountValue(parsed);
    setIsDiscountModalOpen(false);
    showScanToast(
      `Desconto de ${discountModalType === 'percent' ? `${parsed}%` : `R$ ${parsed.toFixed(2)}`} aplicado (F6)`,
      'success'
    );
  };

  // Comprehensive Global Keyboard Shortcuts for 100% Keyboard Operation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 1. Prevent default browser function key behaviors so browser help, reload, caret, devtools don't hijack POS
      if (['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12'].includes(e.key)) {
        e.preventDefault();
      }

      const target = e.target as HTMLElement | null;
      const isInputFocused =
        target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);

      // Hardware USB Barcode Gun Reader (active when not typing in explicit text fields or sub-modals)
      if (!isInputFocused && !isPriceCheckModalOpen && !isDiscountModalOpen) {
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

      // SHORTCUTS INSIDE PAYMENT MODAL (F10)
      if (isPaymentModalOpen) {
        if (e.key === 'Escape') {
          e.preventDefault();
          setIsPaymentModalOpen(false);
          return;
        }
        if (e.key === 'F10' || (e.key === 'Enter' && (!isInputFocused || (target && target.id === 'pdv-cash-received-input')))) {
          e.preventDefault();
          handleAddPaymentSplit();
          return;
        }
        if (!isInputFocused) {
          if (e.key === '1' || e.key === 'd' || e.key === 'D') {
            setActivePaymentMethod('dinheiro');
            return;
          }
          if (e.key === '2' || e.key === 'c' || e.key === 'C') {
            setActivePaymentMethod('cartao_credito');
            return;
          }
          if (e.key === '3' || e.key === 'b' || e.key === 'B') {
            setActivePaymentMethod('cartao_debito');
            return;
          }
          if (e.key === '4' || e.key === 'p' || e.key === 'P') {
            setActivePaymentMethod('pix');
            return;
          }
        }
        if (e.key === 'F1') { setActivePaymentMethod('dinheiro'); return; }
        if (e.key === 'F2') { setActivePaymentMethod('cartao_credito'); return; }
        if (e.key === 'F3') { setActivePaymentMethod('cartao_debito'); return; }
        if (e.key === 'F4') { setActivePaymentMethod('pix'); return; }
        if (e.key === 'F8') {
          setCashReceivedInput(currentAmountToPay);
          showScanToast(`Valor exato preenchido: R$ ${currentAmountToPay.toFixed(2)} (F8)`, 'success');
          return;
        }
      }

      // SHORTCUTS INSIDE PRICE CHECK MODAL (F5)
      if (isPriceCheckModalOpen) {
        if (e.key === 'Escape') {
          e.preventDefault();
          setIsPriceCheckModalOpen(false);
          setPriceCheckQuery('');
          setPriceCheckResult(null);
          return;
        }
        if (e.key === 'Enter' && priceCheckResult) {
          e.preventDefault();
          handleAddToCart(priceCheckResult, 1, 'CONSULTA F5');
          setIsPriceCheckModalOpen(false);
          setPriceCheckQuery('');
          setPriceCheckResult(null);
          showScanToast(`+1 ${priceCheckResult.name} adicionado ao cupom`, 'success');
          return;
        }
      }

      // SHORTCUTS INSIDE DISCOUNT MODAL (F6)
      if (isDiscountModalOpen) {
        if (e.key === 'Escape') {
          e.preventDefault();
          setIsDiscountModalOpen(false);
          return;
        }
        if (e.key === 'Enter') {
          e.preventDefault();
          handleApplyDiscountModal();
          return;
        }
      }

      // GLOBAL SCREEN SHORTCUTS (F1 through F12, Escape, Delete)
      if (e.key === 'F1') {
        setIsHelpModalOpen((prev) => !prev);
      } else if (e.key === 'F2') {
        handleNewSale();
      } else if (e.key === 'F3') {
        quantityInputRef.current?.focus();
        quantityInputRef.current?.select();
      } else if (e.key === 'F4') {
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      } else if (e.key === 'F5') {
        setPriceCheckQuery('');
        setPriceCheckResult(null);
        setIsPriceCheckModalOpen(true);
      } else if (e.key === 'F6') {
        setDiscountModalValue(generalDiscountValue > 0 ? String(generalDiscountValue) : '');
        setDiscountModalType(generalDiscountType);
        setIsDiscountModalOpen(true);
      } else if (e.key === 'F7') {
        setIsCameraScannerOpen((prev) => !prev);
      } else if (e.key === 'F8' && !isPaymentModalOpen) {
        handleOpenPreSalePrint();
      } else if (e.key === 'F9') {
        setIsSalesHistoryOpen((prev) => !prev);
      } else if (e.key === 'F10' && !isPaymentModalOpen) {
        if (cartItems.length > 0) {
          setIsPaymentModalOpen(true);
        } else {
          showScanToast('Adicione ao menos um produto antes de finalizar a venda (F10)', 'error');
        }
      } else if (e.key === 'F11') {
        customerNameInputRef.current?.focus();
        customerNameInputRef.current?.select();
        showScanToast('Identificação de Cliente focada (F11)', 'success');
      } else if (e.key === 'F12' || (e.key === 'Delete' && !isInputFocused)) {
        handleCancelLastItem();
      } else if (e.key === 'Escape') {
        if (isHelpModalOpen) setIsHelpModalOpen(false);
        else if (isPriceCheckModalOpen) setIsPriceCheckModalOpen(false);
        else if (isDiscountModalOpen) setIsDiscountModalOpen(false);
        else if (isCameraScannerOpen) setIsCameraScannerOpen(false);
        else if (productForCodeModal) setProductForCodeModal(null);
        else if (isPaymentModalOpen) setIsPaymentModalOpen(false);
        else if (isPrintModalOpen) setIsPrintModalOpen(false);
        else if (isSalesHistoryOpen) setIsSalesHistoryOpen(false);
        else if (isReceiptModalOpen) setIsReceiptModalOpen(false);
        else {
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
    isHelpModalOpen,
    isPriceCheckModalOpen,
    priceCheckResult,
    isDiscountModalOpen,
    discountModalValue,
    discountModalType,
    productForCodeModal,
    subtotal,
    discountAmount,
    total,
    customerName,
    customerCpfCnpj,
    currentAmountToPay,
    cashReceivedInput,
    activePaymentMethod,
    generalDiscountValue,
    generalDiscountType,
    soundEnabled,
    pdvSettings,
    products,
  ]);

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

          {/* PDV Shortcuts Toolbar (F1 to F12) */}
          <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1 shrink-0 no-scrollbar">
            <div className="flex items-center gap-1.5 shrink-0 overflow-x-auto">
              <button
                type="button"
                onClick={() => setIsHelpModalOpen(true)}
                className="px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs shrink-0"
                title="Ver Todos os Atalhos do Teclado (F1)"
              >
                <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[#00AEEF] font-mono text-[9px] font-black">
                  F1
                </span>
                <span>Ajuda</span>
              </button>

              <button
                type="button"
                onClick={handleNewSale}
                className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-[11px] font-bold flex items-center gap-1.5 transition-colors cursor-pointer border border-slate-200 shrink-0"
                title="Iniciar Nova Venda / Limpar Cupom (F2)"
              >
                <span className="px-1.5 py-0.5 rounded bg-white text-amber-600 font-mono text-[9px] font-black border border-slate-200">
                  F2
                </span>
                <span>Nova Venda</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  quantityInputRef.current?.focus();
                  quantityInputRef.current?.select();
                }}
                className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-[11px] font-bold flex items-center gap-1.5 transition-colors cursor-pointer border border-slate-200 shrink-0"
                title="Alterar Quantidade Multiplicadora (F3)"
              >
                <span className="px-1.5 py-0.5 rounded bg-white text-sky-600 font-mono text-[9px] font-black border border-slate-200">
                  F3
                </span>
                <span>Qtd ({activeQuantity}x)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  searchInputRef.current?.focus();
                  searchInputRef.current?.select();
                }}
                className="px-2.5 py-1.5 rounded-xl bg-sky-50 hover:bg-sky-100 text-[#00AEEF] text-[11px] font-bold flex items-center gap-1.5 transition-colors cursor-pointer border border-sky-200 shrink-0"
                title="Focar Campo de Bipagem e Busca (F4)"
              >
                <span className="px-1.5 py-0.5 rounded bg-[#00AEEF] text-white font-mono text-[9px] font-black">
                  F4
                </span>
                <span>Bipar / Buscar</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setPriceCheckQuery('');
                  setPriceCheckResult(null);
                  setIsPriceCheckModalOpen(true);
                }}
                className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-[11px] font-bold flex items-center gap-1.5 transition-colors cursor-pointer border border-slate-200 shrink-0"
                title="Consultar Preço e Estoque sem alterar o cupom (F5)"
              >
                <span className="px-1.5 py-0.5 rounded bg-white text-indigo-600 font-mono text-[9px] font-black border border-slate-200">
                  F5
                </span>
                <span>Consulta Preço</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setDiscountModalValue(generalDiscountValue > 0 ? String(generalDiscountValue) : '');
                  setDiscountModalType(generalDiscountType);
                  setIsDiscountModalOpen(true);
                }}
                className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-[11px] font-bold flex items-center gap-1.5 transition-colors cursor-pointer border border-slate-200 shrink-0"
                title="Lançar Desconto na Venda (F6)"
              >
                <span className="px-1.5 py-0.5 rounded bg-white text-emerald-600 font-mono text-[9px] font-black border border-slate-200">
                  F6
                </span>
                <span>Desconto</span>
              </button>

              <button
                type="button"
                onClick={() => setIsCameraScannerOpen(true)}
                className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-[11px] font-bold flex items-center gap-1.5 transition-colors cursor-pointer border border-slate-200 shrink-0"
                title="Abrir Scanner de Câmera (F7)"
              >
                <span className="px-1.5 py-0.5 rounded bg-white text-pink-600 font-mono text-[9px] font-black border border-slate-200">
                  F7
                </span>
                <span>Câmera</span>
              </button>

              <button
                type="button"
                onClick={handleOpenPreSalePrint}
                className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-[11px] font-bold flex items-center gap-1.5 transition-colors cursor-pointer border border-slate-200 shrink-0"
                title="Imprimir Pré-Venda / Orçamento (F8)"
              >
                <span className="px-1.5 py-0.5 rounded bg-white text-purple-600 font-mono text-[9px] font-black border border-slate-200">
                  F8
                </span>
                <span>Pré-Venda</span>
              </button>

              <button
                type="button"
                onClick={() => setIsSalesHistoryOpen(true)}
                className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-[11px] font-bold flex items-center gap-1.5 transition-colors cursor-pointer border border-slate-200 shrink-0"
                title="Histórico de Vendas e 2ª Via do Cupom (F9)"
              >
                <span className="px-1.5 py-0.5 rounded bg-white text-cyan-600 font-mono text-[9px] font-black border border-slate-200">
                  F9
                </span>
                <span>2ª Via</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (cartItems.length > 0) {
                    setIsPaymentModalOpen(true);
                  } else {
                    showScanToast('Adicione ao menos um item ao cupom antes de finalizar (F10)', 'error');
                  }
                }}
                className="px-3 py-1.5 rounded-xl bg-[#E6007E] hover:bg-pink-600 text-white text-[11px] font-black flex items-center gap-1.5 transition-all cursor-pointer shadow-sm shrink-0"
                title="Concluir Venda e Abrir Pagamento (F10)"
              >
                <span className="px-1.5 py-0.5 rounded bg-white/20 font-mono text-[9px]">
                  F10
                </span>
                <span>Finalizar</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  customerNameInputRef.current?.focus();
                  customerNameInputRef.current?.select();
                  showScanToast('Identificação de Cliente focada (F11)', 'success');
                }}
                className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-[11px] font-bold flex items-center gap-1.5 transition-colors cursor-pointer border border-slate-200 shrink-0"
                title="Identificar Nome / CPF do Cliente (F11)"
              >
                <span className="px-1.5 py-0.5 rounded bg-white text-teal-600 font-mono text-[9px] font-black border border-slate-200">
                  F11
                </span>
                <span>Cliente</span>
              </button>

              <button
                type="button"
                onClick={handleCancelLastItem}
                className="px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-[11px] font-bold flex items-center gap-1.5 transition-colors cursor-pointer border border-rose-200 shrink-0"
                title="Cancelar / Remover Último Item Bipado (F12)"
              >
                <span className="px-1.5 py-0.5 rounded bg-rose-200 text-rose-900 font-mono text-[9px] font-black">
                  F12
                </span>
                <span>Cancelar Item</span>
              </button>
            </div>

            {/* View Mode Toggle: Modo Bipagem (Padrão) vs Modo Grade Catálogo */}
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => setViewMode(viewMode === 'scanner' ? 'grid' : 'scanner')}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-colors cursor-pointer flex items-center gap-1 ${
                  viewMode === 'scanner'
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                }`}
                title="Alternar entre Display do Bip e Grade de Catálogo"
              >
                {viewMode === 'scanner' ? (
                  <>
                    <Zap className="w-3 h-3 text-[#FFDD00]" />
                    <span>Modo Bipagem (Padrão)</span>
                  </>
                ) : (
                  <>
                    <LayoutGrid className="w-3 h-3 text-[#00AEEF]" />
                    <span>Ver Catálogo</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Products List / Grid Container with visible scrollbar */}
          <div className="flex-1 min-h-0 overflow-y-auto pr-1.5 sm:pr-2 pdv-scroll overscroll-contain">
            {viewMode === 'grid' ? (
              /* MODO GRADE CATÁLOGO COMPLETO */
              filteredProducts.length === 0 ? (
                <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 space-y-3">
                  <Search className="w-10 h-10 text-slate-300 mx-auto" />
                  <h4 className="text-sm font-bold text-slate-700">Nenhum produto encontrado</h4>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto">
                    Tente alterar o termo de pesquisa, o modo de filtro ou limpe a busca.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedCategory('all');
                    }}
                    className="px-3.5 py-1.5 bg-slate-900 text-white text-xs font-bold rounded-xl cursor-pointer"
                  >
                    Ver Todos os Produtos
                  </button>
                </div>
              ) : (
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
                          <div className="relative aspect-square w-full rounded-xl overflow-hidden bg-slate-100 mb-2">
                            <img
                              src={p.images[0]}
                              alt={p.name}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              loading="lazy"
                            />
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
                          <h4 className="text-xs font-bold text-slate-800 line-clamp-2 leading-tight">
                            {p.name}
                          </h4>
                          <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-mono mt-0.5">
                            <span>{p.code}</span>
                            <span>•</span>
                            <span className="truncate">{barcode}</span>
                          </div>
                        </div>
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
              )
            ) : (
              /* MODO BIPAGEM (PADRÃO): EXIBIR APENAS A FOTO DO PRODUTO QUE FOI BIPADO */
              <div className="h-full flex flex-col justify-between gap-3">
                {lastScannedProduct ? (
                  <div
                    className={`bg-white rounded-3xl border-2 transition-all duration-300 p-4 sm:p-6 shadow-xl flex flex-col items-center justify-between flex-1 relative overflow-hidden ${
                      scanPulse
                        ? 'border-[#00AEEF] ring-4 ring-sky-300 shadow-2xl scale-[1.01]'
                        : 'border-slate-200'
                    }`}
                  >
                    {/* Top Status Header */}
                    <div className="w-full flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
                      <div className="flex items-center gap-2">
                        <span className="relative flex h-3 w-3">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                        </span>
                        <span className="text-xs font-black uppercase text-emerald-700 tracking-wider">
                          Último Produto Bipado
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-100 text-[#00AEEF] border border-sky-200">
                          {lastScannedProduct.scanMethod}
                        </span>
                      </div>

                      <div className="text-[11px] font-mono font-bold text-slate-400">
                        {new Date(lastScannedProduct.scannedAt).toLocaleTimeString('pt-BR')}
                      </div>
                    </div>

                    {/* FOTO DO PRODUTO QUE FOI BIPADO (DESTAQUE MÁXIMO) */}
                    <div className="flex-1 flex flex-col items-center justify-center my-2 sm:my-3 w-full min-h-0">
                      <div className="relative group max-h-[46vh] aspect-square w-auto max-w-full rounded-3xl overflow-hidden bg-slate-50 border-2 border-slate-200/80 shadow-inner flex items-center justify-center p-2">
                        <img
                          src={lastScannedProduct.product.images[0]}
                          alt={lastScannedProduct.product.name}
                          className="w-full h-full object-contain drop-shadow-md group-hover:scale-105 transition-transform duration-300"
                        />

                        {/* Stock pill */}
                        <div className="absolute top-3 right-3">
                          <span
                            className={`text-xs font-black px-2.5 py-1 rounded-xl uppercase shadow-md ${
                              lastScannedProduct.product.stock_qty <= 0
                                ? 'bg-rose-600 text-white'
                                : lastScannedProduct.product.stock_qty < 15
                                ? 'bg-amber-500 text-white'
                                : 'bg-slate-900 text-white'
                            }`}
                          >
                            {lastScannedProduct.product.stock_qty} un em estoque
                          </span>
                        </div>

                        {/* Barcode & Label inspection trigger */}
                        <button
                          type="button"
                          onClick={() => setProductForCodeModal(lastScannedProduct.product)}
                          className="absolute bottom-3 right-3 p-2 rounded-xl bg-white/90 hover:bg-white text-slate-800 shadow-md backdrop-blur-xs transition-colors flex items-center gap-1.5 text-xs font-bold cursor-pointer"
                          title="Ver Código de Barras & Etiqueta"
                        >
                          <Barcode className="w-4 h-4 text-slate-800" />
                          <span className="hidden sm:inline">Etiqueta EAN</span>
                        </button>
                      </div>

                      {/* Product Name & SKU / EAN Identification */}
                      <div className="text-center mt-3 max-w-lg px-2">
                        <h3 className="text-base sm:text-xl font-black text-slate-900 leading-snug font-heading line-clamp-2">
                          {lastScannedProduct.product.name}
                        </h3>

                        <div className="flex items-center justify-center gap-2 sm:gap-3 text-xs text-slate-500 font-mono mt-1 flex-wrap">
                          <span className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 font-bold">
                            SKU: {lastScannedProduct.product.code}
                          </span>
                          <span>•</span>
                          <span className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 font-bold">
                            EAN: {getProductBarcode(lastScannedProduct.product)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Price, Quantity & Subtotal Highlight Bar */}
                    <div className="w-full bg-slate-50 border border-slate-200/90 rounded-2xl p-3 sm:p-4 grid grid-cols-3 gap-2 text-center shrink-0">
                      <div>
                        <span className="text-[10px] font-extrabold uppercase text-slate-400 block tracking-wider">
                          Preço Unitário
                        </span>
                        <div className="text-sm sm:text-base font-extrabold text-slate-800 font-mono">
                          R$ {lastScannedProduct.unitPrice.toFixed(2)}
                        </div>
                      </div>

                      <div className="border-x border-slate-200 px-2">
                        <span className="text-[10px] font-extrabold uppercase text-slate-400 block tracking-wider">
                          Qtd Bipada
                        </span>
                        <div className="text-base sm:text-xl font-black text-[#00AEEF] font-mono">
                          {lastScannedProduct.quantity}x
                        </div>
                      </div>

                      <div>
                        <span className="text-[10px] font-extrabold uppercase text-slate-400 block tracking-wider">
                          Subtotal do Item
                        </span>
                        <div className="text-base sm:text-xl font-black text-[#E6007E] font-mono">
                          R$ {lastScannedProduct.total.toFixed(2)}
                        </div>
                      </div>
                    </div>

                    {/* Direct Quick Shortcuts for this item */}
                    <div className="w-full pt-3 flex items-center justify-between gap-2 shrink-0 border-t border-slate-100">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            quantityInputRef.current?.focus();
                            quantityInputRef.current?.select();
                          }}
                          className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer border border-slate-200"
                          title="Alterar Quantidade para o próximo bip (F3)"
                        >
                          <span className="px-1.5 py-0.5 rounded bg-white text-sky-600 font-mono text-[9px] font-black border border-slate-200">
                            F3
                          </span>
                          <span>Alterar Qtd</span>
                        </button>

                        <button
                          type="button"
                          onClick={handleCancelLastItem}
                          className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer border border-rose-200"
                          title="Cancelar este item do cupom (F12)"
                        >
                          <span className="px-1.5 py-0.5 rounded bg-rose-200 text-rose-900 font-mono text-[9px] font-black">
                            F12
                          </span>
                          <span>Cancelar Este Item</span>
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          if (cartItems.length > 0) setIsPaymentModalOpen(true);
                        }}
                        className="px-4 py-1.5 rounded-xl bg-[#E6007E] hover:bg-pink-600 text-white text-xs font-black uppercase flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
                        title="Finalizar Venda (F10)"
                      >
                        <span className="px-1.5 py-0.5 rounded bg-white/20 font-mono text-[9px]">
                          F10
                        </span>
                        <span>Finalizar (R$ {total.toFixed(2)})</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  /* TELA DE ESPERA / PRONTO PARA BIPAR (AGUARDANDO PRODUTO) */
                  <div className="bg-white rounded-3xl border-2 border-dashed border-slate-300 p-8 sm:p-12 text-center flex flex-col items-center justify-center flex-1 space-y-5">
                    {/* Glowing Barcode Scanner Visual */}
                    <div className="relative">
                      <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-sky-50 border-2 border-sky-200 flex items-center justify-center shadow-lg text-[#00AEEF]">
                        <Barcode className="w-14 h-14" />
                      </div>
                      <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.9)] animate-pulse" />
                    </div>

                    <div className="space-y-1.5 max-w-md">
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                        <span>Leitor Óptico USB Pronto & Conectado</span>
                      </div>
                      <h3 className="text-lg sm:text-2xl font-black text-slate-800 font-heading">
                        Aguardando Bipagem de Produto
                      </h3>
                      <p className="text-xs text-slate-500 leading-relaxed">
                        Aproxime o código de barras (EAN-13) ou QR Code do leitor óptico, ou digite o código/nome do produto no campo de pesquisa acima <strong>(F4)</strong>.
                      </p>
                    </div>

                    {/* Quick Operation Cards */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 max-w-xl w-full text-left pt-2">
                      <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                        <span className="text-[10px] font-bold font-mono text-sky-600 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                          F4
                        </span>
                        <p className="text-xs font-bold text-slate-800 mt-1.5">Bipar / Buscar</p>
                        <p className="text-[10px] text-slate-400">Foca campo de busca</p>
                      </div>

                      <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                        <span className="text-[10px] font-bold font-mono text-indigo-600 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                          F3
                        </span>
                        <p className="text-xs font-bold text-slate-800 mt-1.5">Multiplicador</p>
                        <p className="text-[10px] text-slate-400">Ex: 5* ou 10x</p>
                      </div>

                      <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                        <span className="text-[10px] font-bold font-mono text-purple-600 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                          F5
                        </span>
                        <p className="text-xs font-bold text-slate-800 mt-1.5">Consultar Preço</p>
                        <p className="text-[10px] text-slate-400">Sem alterar o cupom</p>
                      </div>

                      <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                        <span className="text-[10px] font-bold font-mono text-pink-600 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                          F7
                        </span>
                        <p className="text-xs font-bold text-slate-800 mt-1.5">Câmera Scanner</p>
                        <p className="text-[10px] text-slate-400">Leitor via webcam</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setViewMode('grid')}
                        className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer border border-slate-200 flex items-center gap-1.5"
                      >
                        <LayoutGrid className="w-3.5 h-3.5 text-[#00AEEF]" />
                        <span>Ou ver catálogo completo em grade</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Compact Recent Scans Ticker below the spotlight */}
                {cartItems.length > 0 && (
                  <div className="bg-white border border-slate-200 rounded-2xl p-2.5 shadow-2xs shrink-0 flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider shrink-0 flex items-center gap-1">
                        <ShoppingCart className="w-3.5 h-3.5 text-[#E6007E]" />
                        <span>Itens no Cupom ({cartItems.length}):</span>
                      </span>
                      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                        {cartItems.slice(-4).reverse().map((it) => (
                          <span
                            key={it.id}
                            className="px-2 py-0.5 bg-slate-100 rounded-lg text-[11px] font-semibold text-slate-700 whitespace-nowrap border border-slate-200"
                          >
                            {it.quantity}x {it.productName.split(' ')[0]} (R$ {it.total.toFixed(2)})
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="shrink-0 font-black text-slate-900 font-mono">
                      Subtotal: R$ {subtotal.toFixed(2)}
                    </div>
                  </div>
                )}
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
                  ref={customerNameInputRef}
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      customerCpfInputRef.current?.focus();
                      customerCpfInputRef.current?.select();
                    }
                  }}
                  placeholder="Nome do Cliente / Consumidor Final (F11)"
                  className="w-full text-xs font-bold text-slate-900 bg-transparent outline-none truncate"
                  title="Pressione F11 para identificar cliente, Enter para avançar para CPF"
                />
                <input
                  ref={customerCpfInputRef}
                  type="text"
                  value={customerCpfCnpj}
                  onChange={(e) => setCustomerCpfCnpj(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      searchInputRef.current?.focus();
                      searchInputRef.current?.select();
                      showScanToast('Cliente identificado! Retornado à bipagem (F4)', 'success');
                    }
                  }}
                  placeholder="CPF / CNPJ na nota (Enter para voltar à busca)"
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
                    className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all cursor-pointer relative ${
                      activePaymentMethod === 'dinheiro'
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-900 ring-2 ring-emerald-200 font-bold'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <span className="absolute top-1.5 right-1.5 text-[9px] font-mono font-black px-1.5 py-0.2 rounded bg-slate-200 text-slate-700">
                      1 / F1
                    </span>
                    <DollarSign className="w-5 h-5 text-emerald-600" />
                    <span className="text-xs">Dinheiro</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActivePaymentMethod('cartao_credito')}
                    className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all cursor-pointer relative ${
                      activePaymentMethod === 'cartao_credito'
                        ? 'border-[#00AEEF] bg-sky-50 text-sky-900 ring-2 ring-sky-200 font-bold'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <span className="absolute top-1.5 right-1.5 text-[9px] font-mono font-black px-1.5 py-0.2 rounded bg-slate-200 text-slate-700">
                      2 / F2
                    </span>
                    <CreditCard className="w-5 h-5 text-[#00AEEF]" />
                    <span className="text-xs">Cartão Crédito</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActivePaymentMethod('cartao_debito')}
                    className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all cursor-pointer relative ${
                      activePaymentMethod === 'cartao_debito'
                        ? 'border-[#E6007E] bg-pink-50 text-pink-900 ring-2 ring-pink-200 font-bold'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <span className="absolute top-1.5 right-1.5 text-[9px] font-mono font-black px-1.5 py-0.2 rounded bg-slate-200 text-slate-700">
                      3 / F3
                    </span>
                    <CreditCard className="w-5 h-5 text-[#E6007E]" />
                    <span className="text-xs">Cartão Débito</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActivePaymentMethod('pix')}
                    className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all cursor-pointer relative ${
                      activePaymentMethod === 'pix'
                        ? 'border-amber-500 bg-amber-50 text-amber-900 ring-2 ring-amber-200 font-bold'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <span className="absolute top-1.5 right-1.5 text-[9px] font-mono font-black px-1.5 py-0.2 rounded bg-slate-200 text-slate-700">
                      4 / F4
                    </span>
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
                    id="pdv-amount-to-pay-input"
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={remainingToPay}
                    value={currentAmountToPay || ''}
                    onChange={(e) => setCurrentAmountToPay(Number(e.target.value))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddPaymentSplit();
                      }
                    }}
                    className="w-32 px-3 py-1.5 text-base font-extrabold text-slate-900 bg-white rounded-xl border border-slate-300 text-right outline-none focus:border-[#00AEEF]"
                  />
                </div>

                {/* Dinheiro: Troco */}
                {activePaymentMethod === 'dinheiro' && (
                  <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-200">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-bold text-slate-700">
                          Valor Recebido em Espécie:
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            setCashReceivedInput(currentAmountToPay);
                            showScanToast(`Valor exato preenchido: R$ ${currentAmountToPay.toFixed(2)} (F8)`, 'success');
                          }}
                          className="text-[10px] text-sky-600 hover:text-sky-800 font-bold cursor-pointer"
                        >
                          Valor Exato (F8)
                        </button>
                      </div>
                      <input
                        id="pdv-cash-received-input"
                        type="number"
                        step="0.01"
                        autoFocus
                        value={cashReceivedInput || ''}
                        onChange={(e) => setCashReceivedInput(Number(e.target.value))}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddPaymentSplit();
                          }
                        }}
                        className="w-full px-3 py-2 text-base font-bold bg-white rounded-xl border border-slate-300 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
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
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <span>Voltar</span>
                <span className="px-1.5 py-0.5 rounded bg-white text-slate-600 font-mono text-[9px] font-black border border-slate-200">
                  Esc
                </span>
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
                <span className="px-1.5 py-0.5 rounded bg-white/20 font-mono text-[9px]">
                  Enter / F10
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

      {/* ========================================================= */}
      {/* MODAL DE AJUDA & GUIA DE ATALHOS DO TECLADO (F1)           */}
      {/* ========================================================= */}
      {isHelpModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 flex flex-col max-h-[90vh]">
            <div className="p-5 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center text-[#FFDD00]">
                  <Keyboard className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black uppercase font-heading">
                    Atalhos do Teclado - Frente de Caixa (PDV)
                  </h3>
                  <p className="text-xs text-slate-400">
                    Controle 100% da operação do caixa pelo teclado sem tocar no mouse
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsHelpModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 flex-1">
              <div>
                <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider mb-2">
                  Teclas de Função Principais (F1 a F12)
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {[
                    { key: 'F1', label: 'Ajuda de Atalhos', desc: 'Abre este guia rápido' },
                    { key: 'F2', label: 'Nova Venda', desc: 'Limpa o cupom atual e inicia nova venda' },
                    { key: 'F3', label: 'Multiplicador', desc: 'Foca quantidade (ou digite 5* na busca)' },
                    { key: 'F4', label: 'Bipar / Buscar', desc: 'Foca campo de busca ou código de barras' },
                    { key: 'F5', label: 'Consulta de Preço', desc: 'Consulta preço e estoque sem alterar cupom' },
                    { key: 'F6', label: 'Lançar Desconto', desc: 'Lança desconto em % ou R$ no cupom' },
                    { key: 'F7', label: 'Câmera Scanner', desc: 'Abre scanner óptico via webcam' },
                    { key: 'F8', label: 'Pré-Venda / Orç.', desc: 'Imprime orçamento (ou valor exato no pagamento)' },
                    { key: 'F9', label: 'Histórico / 2ª Via', desc: 'Consulta vendas e reimprime cupom fiscal' },
                    { key: 'F10', label: 'Finalizar Venda', desc: 'Abre tela de pagamento / conclui a venda' },
                    { key: 'F11', label: 'Identificar Cliente', desc: 'Foca nome e CPF/CNPJ do cliente' },
                    { key: 'F12 / Del', label: 'Cancelar Último Item', desc: 'Remove o último produto bipado' },
                  ].map((sc) => (
                    <div
                      key={sc.key}
                      className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-2.5"
                    >
                      <span className="px-2 py-0.5 rounded-md bg-slate-900 text-[#00AEEF] font-mono text-[10px] font-black shrink-0">
                        {sc.key}
                      </span>
                      <div className="min-w-0">
                        <strong className="block text-slate-800 font-bold">{sc.label}</strong>
                        <span className="text-[11px] text-slate-500 leading-tight block">{sc.desc}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100">
                <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider mb-2">
                  Atalhos na Tela de Pagamento (F10)
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="p-2 rounded-xl bg-slate-50 border border-slate-200 text-center">
                    <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 font-mono text-[10px] font-bold rounded">1 / D / F1</span>
                    <span className="block font-bold text-slate-800 mt-1">Dinheiro</span>
                  </div>
                  <div className="p-2 rounded-xl bg-slate-50 border border-slate-200 text-center">
                    <span className="px-1.5 py-0.5 bg-sky-100 text-sky-800 font-mono text-[10px] font-bold rounded">2 / C / F2</span>
                    <span className="block font-bold text-slate-800 mt-1">Cartão Crédito</span>
                  </div>
                  <div className="p-2 rounded-xl bg-slate-50 border border-slate-200 text-center">
                    <span className="px-1.5 py-0.5 bg-pink-100 text-pink-800 font-mono text-[10px] font-bold rounded">3 / B / F3</span>
                    <span className="block font-bold text-slate-800 mt-1">Cartão Débito</span>
                  </div>
                  <div className="p-2 rounded-xl bg-slate-50 border border-slate-200 text-center">
                    <span className="px-1.5 py-0.5 bg-amber-100 text-amber-800 font-mono text-[10px] font-bold rounded">4 / P / F4</span>
                    <span className="block font-bold text-slate-800 mt-1">PIX Balcão</span>
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100">
                <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider mb-2">
                  Navegação Geral e Impressão
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div className="p-2 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                    <span className="text-slate-600 font-medium">Confirmar / Concluir / Imprimir:</span>
                    <span className="px-2 py-0.5 bg-white text-slate-900 font-mono font-bold rounded border border-slate-200">Enter</span>
                  </div>
                  <div className="p-2 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                    <span className="text-slate-600 font-medium">Fechar Modais / Cancelar / Voltar:</span>
                    <span className="px-2 py-0.5 bg-white text-slate-900 font-mono font-bold rounded border border-slate-200">Esc</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setIsHelpModalOpen(false)}
                className="px-5 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Entendido (Esc)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL DE CONSULTA RÁPIDA DE PREÇO E ESTOQUE (F5)          */}
      {/* ========================================================= */}
      {isPriceCheckModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 flex flex-col max-h-[90vh]">
            <div className="p-5 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-950 text-indigo-400 flex items-center justify-center">
                  <Search className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black uppercase font-heading">
                    Consulta Rápida de Preço (F5)
                  </h3>
                  <p className="text-xs text-slate-400">
                    Consulte preço e estoque sem alterar o cupom atual
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsPriceCheckModalOpen(false);
                  setPriceCheckQuery('');
                  setPriceCheckResult(null);
                }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 flex-1 overflow-y-auto">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Bipe o código de barras ou digite o nome/código:
                </label>
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    ref={priceCheckInputRef}
                    type="text"
                    value={priceCheckQuery}
                    onChange={(e) => setPriceCheckQuery(e.target.value)}
                    placeholder="Bipe com o leitor óptico ou digite (Enter para adicionar)..."
                    className="w-full pl-10 pr-4 py-3 text-sm bg-slate-50 border border-slate-300 rounded-xl outline-none font-medium focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  />
                </div>
              </div>

              {priceCheckResult ? (
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-center gap-4 animate-in fade-in">
                  <div className="w-32 h-32 rounded-2xl bg-white border border-slate-200 overflow-hidden shrink-0 p-1 flex items-center justify-center shadow-xs">
                    <img
                      src={priceCheckResult.images[0]}
                      alt={priceCheckResult.name}
                      className="w-full h-full object-contain"
                    />
                  </div>

                  <div className="flex-1 min-w-0 text-center sm:text-left space-y-1.5">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-800 uppercase">
                      Localizado
                    </span>
                    <h4 className="text-base font-black text-slate-900 leading-snug">
                      {priceCheckResult.name}
                    </h4>
                    <div className="flex items-center justify-center sm:justify-start gap-2 text-xs text-slate-500 font-mono">
                      <span>SKU: {priceCheckResult.code}</span>
                      <span>•</span>
                      <span>EAN: {getProductBarcode(priceCheckResult)}</span>
                    </div>

                    <div className="pt-2 flex items-baseline justify-center sm:justify-start gap-3">
                      <span className="text-2xl font-black text-[#E6007E] font-mono">
                        R$ {(priceCheckResult.promo_price || priceCheckResult.base_price).toFixed(2)}
                      </span>
                      {priceCheckResult.promo_price && (
                        <span className="text-xs text-slate-400 line-through">
                          R$ {priceCheckResult.base_price.toFixed(2)}
                        </span>
                      )}
                    </div>

                    <div className="text-xs font-bold">
                      <span
                        className={
                          priceCheckResult.stock_qty <= 0
                            ? 'text-rose-600'
                            : priceCheckResult.stock_qty < 15
                            ? 'text-amber-600'
                            : 'text-emerald-700'
                        }
                      >
                        Estoque Atual: {priceCheckResult.stock_qty} unidades disponíveis
                      </span>
                    </div>
                  </div>
                </div>
              ) : priceCheckQuery.trim() ? (
                <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200 text-slate-500 text-xs">
                  Nenhum produto encontrado para &quot;{priceCheckQuery}&quot;.
                </div>
              ) : (
                <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-300 text-slate-400 space-y-2">
                  <Barcode className="w-10 h-10 text-slate-300 mx-auto" />
                  <p className="text-xs font-medium">
                    Aproxime o produto do leitor de código de barras para ver o preço na tela.
                  </p>
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
              <button
                type="button"
                onClick={() => {
                  setIsPriceCheckModalOpen(false);
                  setPriceCheckQuery('');
                  setPriceCheckResult(null);
                }}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                Fechar (Esc)
              </button>

              {priceCheckResult && (
                <button
                  type="button"
                  onClick={() => {
                    handleAddToCart(priceCheckResult, 1, 'CONSULTA F5');
                    setIsPriceCheckModalOpen(false);
                    setPriceCheckQuery('');
                    setPriceCheckResult(null);
                    showScanToast(`+1 ${priceCheckResult.name} adicionado ao cupom`, 'success');
                  }}
                  className="px-5 py-2.5 bg-[#00AEEF] hover:bg-sky-600 text-white text-xs font-black uppercase rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer"
                >
                  <Plus className="w-4 h-4 stroke-[2.5]" />
                  <span>Adicionar ao Cupom (Enter)</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL DE DESCONTO NA VENDA (F6)                           */}
      {/* ========================================================= */}
      {isDiscountModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 flex flex-col">
            <div className="p-5 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-950 text-emerald-400 flex items-center justify-center">
                  <Tag className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black uppercase font-heading">
                    Lançar Desconto na Venda (F6)
                  </h3>
                  <p className="text-xs text-slate-400">
                    Subtotal atual: R$ {subtotal.toFixed(2)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsDiscountModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Tipo de Desconto:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setDiscountModalType('percent')}
                    className={`py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                      discountModalType === 'percent'
                        ? 'bg-[#00AEEF] text-white border-[#00AEEF] shadow-sm'
                        : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                    }`}
                  >
                    Porcentagem (%)
                  </button>
                  <button
                    type="button"
                    onClick={() => setDiscountModalType('fixed')}
                    className={`py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                      discountModalType === 'fixed'
                        ? 'bg-[#00AEEF] text-white border-[#00AEEF] shadow-sm'
                        : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                    }`}
                  >
                    Valor Fixo (R$)
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Valor do Desconto {discountModalType === 'percent' ? '(%)' : '(R$)'}:
                </label>
                <input
                  ref={discountModalInputRef}
                  type="text"
                  value={discountModalValue}
                  onChange={(e) => setDiscountModalValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleApplyDiscountModal();
                    }
                  }}
                  placeholder={discountModalType === 'percent' ? 'Ex: 10' : 'Ex: 25,00'}
                  className="w-full px-4 py-3 text-lg font-black text-slate-900 bg-slate-50 border border-slate-300 rounded-xl outline-none focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                />
              </div>

              {/* Dynamic Preview */}
              {(() => {
                const parsed = parseFloat(discountModalValue.replace(',', '.'));
                if (!isNaN(parsed) && parsed > 0) {
                  const simulatedDiscount =
                    discountModalType === 'percent'
                      ? Number(((subtotal * parsed) / 100).toFixed(2))
                      : Number(Math.min(subtotal, parsed).toFixed(2));
                  const simulatedTotal = Math.max(0, subtotal - simulatedDiscount);
                  return (
                    <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 space-y-1 text-xs">
                      <div className="flex justify-between text-emerald-800">
                        <span>Desconto a aplicar:</span>
                        <strong className="font-mono font-black text-emerald-700">
                          - R$ {simulatedDiscount.toFixed(2)}
                        </strong>
                      </div>
                      <div className="flex justify-between pt-1 border-t border-emerald-200/60 font-bold text-slate-900">
                        <span>Novo Total da Venda:</span>
                        <span className="font-mono text-sm font-black text-[#E6007E]">
                          R$ {simulatedTotal.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  );
                }
                return null;
              })()}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
              <button
                type="button"
                onClick={() => {
                  setGeneralDiscountValue(0);
                  setIsDiscountModalOpen(false);
                  showScanToast('Desconto removido do cupom', 'success');
                }}
                className="px-3 py-2 text-rose-600 hover:text-rose-700 text-xs font-bold cursor-pointer"
              >
                Zerar Desconto
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsDiscountModalOpen(false)}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                >
                  Cancelar (Esc)
                </button>
                <button
                  type="button"
                  onClick={handleApplyDiscountModal}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase rounded-xl transition-all shadow-md cursor-pointer"
                >
                  Aplicar (Enter)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
