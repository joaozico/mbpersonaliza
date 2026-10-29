import React, { useState, useEffect, useMemo } from 'react';
import {
  CartItem,
  Order,
  UserProfile,
  CompanySettings,
  PaymentGatewayConfig,
  DeliveryAndShippingSettings,
  BoletoTitulo,
  Quote,
  DiscountCoupon,
  OrderCouponInfo,
  CouponValidationResult,
} from '../types';
import { StorageService } from '../services/storage';
import { PaymentService } from '../services/paymentService';
import { StrickerOrderService } from '../services/stricker/StrickerOrderService';
import {
  cleanCep,
  formatCep,
  lookupAddressByCep,
  getAvailableShippingOptions,
  CoverageValidationResult,
  CartShippingPackage,
  CalculatedShippingOption,
} from '../utils/shippingUtils';
import { SEOHead } from '../components/SEOHead';
import { BoletoModal } from '../components/BoletoModal';
import {
  CreditCard,
  QrCode,
  ShieldCheck,
  Truck,
  ArrowRight,
  CheckCircle2,
  Lock,
  Sparkles,
  Building,
  User,
  Phone,
  Mail,
  MapPin,
  FileText,
  Copy,
  Check,
  AlertTriangle,
  Clock,
  Search,
  Package,
  Ticket,
  Tag,
  X,
  Percent,
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface CheckoutViewProps {
  cart: CartItem[];
  currentUser: UserProfile;
  onClearCart: () => void;
  onNavigate: (view: string, param?: string) => void;
}

export const CheckoutView: React.FC<CheckoutViewProps> = ({
  cart,
  currentUser,
  onClearCart,
  onNavigate,
}) => {
  // Company settings
  const [companySettings, setCompanySettings] = useState<CompanySettings>(() =>
    StorageService.getCompanySettings()
  );

  useEffect(() => {
    const handleUpdate = () => {
      setCompanySettings(StorageService.getCompanySettings());
    };

    window.addEventListener('mb_company_settings_updated', handleUpdate);
    window.addEventListener('mb_storage_updated', handleUpdate);

    return () => {
      window.removeEventListener('mb_company_settings_updated', handleUpdate);
      window.removeEventListener('mb_storage_updated', handleUpdate);
    };
  }, []);

  // Customer info
  const [name, setName] = useState(currentUser.name);
  const [email, setEmail] = useState(currentUser.email);
  const [phone, setPhone] = useState(currentUser.phone);
  const [company, setCompany] = useState(currentUser.company || '');
  const [cpfCnpj, setCpfCnpj] = useState(currentUser.cpfCnpj || '');

  // Address
  const [street, setStreet] = useState(currentUser.address?.street || 'Av. Paulista');
  const [number, setNumber] = useState(currentUser.address?.number || '1842');
  const [complement, setComplement] = useState(currentUser.address?.complement || 'Conj. 1408');
  const [neighborhood, setNeighborhood] = useState(currentUser.address?.neighborhood || 'Bela Vista');
  const [city, setCity] = useState(currentUser.address?.city || 'São Paulo');
  const [state, setState] = useState(currentUser.address?.state || 'SP');
  const [zip, setZip] = useState(currentUser.address?.zip || '01310-200');

  // Regras de Pagamento por Boleto e Faturamento a Prazo
  const [paymentMethod, setPaymentMethod] = useState<'pix' | 'credit_card' | 'boleto' | 'boleto_faturado'>('pix');
  const [operationType, setOperationType] = useState<'loja_comum' | 'proposta_aprovada'>('loja_comum');
  const [selectedQuoteId, setSelectedQuoteId] = useState<string>('');
  const [showBoletoModal, setShowBoletoModal] = useState(false);
  const [activeBoletos, setActiveBoletos] = useState<BoletoTitulo[]>([]);
  const [boletoSettings, setBoletoSettings] = useState(() => StorageService.getBoletoSettings());
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const [cardNumber, setCardNumber] = useState('•••• •••• •••• 4242');
  const [cardHolder, setCardHolder] = useState(currentUser.name.toUpperCase());
  const [cardExpiry, setCardExpiry] = useState('12/28');
  const [cardCvv, setCardCvv] = useState('888');
  const [installments, setInstallments] = useState(1);

  // Quotes disponíveis para vínculo
  const availableQuotes = useMemo(() => {
    return StorageService.getQuotes().filter(
      (q) => q.status === 'aprovado' || q.status === 'respondido'
    );
  }, []);

  const selectedQuote = useMemo(() => {
    if (!selectedQuoteId) return null;
    return availableQuotes.find((q) => q.id === selectedQuoteId) || null;
  }, [availableQuotes, selectedQuoteId]);

  const isDeferredAuthorizedForSelectedQuote = useMemo(() => {
    return Boolean(
      operationType === 'proposta_aprovada' &&
      selectedQuote?.billingTerms?.isDeferredAuthorized &&
      selectedQuote?.billingTerms?.type === 'faturado_prazo'
    );
  }, [operationType, selectedQuote]);

  useEffect(() => {
    const handleBoletoUpdate = () => {
      setBoletoSettings(StorageService.getBoletoSettings());
    };
    window.addEventListener('mb_boleto_settings_updated', handleBoletoUpdate);
    return () => window.removeEventListener('mb_boleto_settings_updated', handleBoletoUpdate);
  }, []);

  // States
  const [isProcessing, setIsProcessing] = useState(false);
  const [completedOrder, setCompletedOrder] = useState<Order | null>(null);
  const [copiedPix, setCopiedPix] = useState(false);

  // Delivery and Shipping Settings
  const [deliverySettings, setDeliverySettings] = useState<DeliveryAndShippingSettings>(() =>
    StorageService.getDeliverySettings()
  );

  useEffect(() => {
    const handleDeliveryUpdate = () => {
      setDeliverySettings(StorageService.getDeliverySettings());
    };
    window.addEventListener('mb_delivery_settings_updated', handleDeliveryUpdate);
    window.addEventListener('mb_storage_updated', handleDeliveryUpdate);
    return () => {
      window.removeEventListener('mb_delivery_settings_updated', handleDeliveryUpdate);
      window.removeEventListener('mb_storage_updated', handleDeliveryUpdate);
    };
  }, []);

  // Shipping Selection & Calculation States
  const [isCepLoading, setIsCepLoading] = useState(false);
  const [cepError, setCepError] = useState<string | null>(null);
  const [selectedMethodId, setSelectedMethodId] = useState<string>('');

  const [gateways] = useState(() => StorageService.getPaymentGateways());
  const activeGateway = gateways.find((g) => g.enabled) || gateways[0];

  const pixDiscountRate = (companySettings.pixDiscountPercent ?? 5) / 100;
  const subtotal = (cart || []).reduce(
    (acc, item) => acc + (item?.calculatedUnitPrice || 0) * (item?.quantity || 0),
    0
  );

  // Estados de Cupom de Desconto
  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<DiscountCoupon | null>(null);
  const [couponDiscount, setCouponDiscount] = useState<number>(0);
  const [couponValidationResult, setCouponValidationResult] = useState<CouponValidationResult | null>(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponFeedback, setCouponFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Função para aplicar cupom com validação completa no backend (e fallback no Storage)
  const handleApplyCoupon = async (overrideCode?: string) => {
    const codeToTest = (overrideCode !== undefined ? overrideCode : couponInput).trim();
    if (!codeToTest) {
      setCouponFeedback({ type: 'error', text: 'Por favor, digite o código do cupom.' });
      return;
    }

    setCouponLoading(true);
    setCouponFeedback(null);

    const payloadCartItems = (cart || []).map((it) => ({
      productId: it.productId,
      categoryId: it.product?.categoryId,
      unitPrice: it.calculatedUnitPrice,
      quantity: it.quantity,
      isPromo: it.product?.promo_price !== undefined && it.product.promo_price > 0,
    }));

    const customerData = {
      id: currentUser?.id,
      email: email || currentUser?.email,
      cpfCnpj: cpfCnpj || currentUser?.cpfCnpj,
    };

    try {
      // Tentar validação no backend
      const res = await fetch('/api/coupons/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: codeToTest,
          cartItems: payloadCartItems,
          subtotal,
          customer: customerData,
        }),
      });

      let data: CouponValidationResult;
      if (res.ok) {
        data = await res.json();
      } else {
        // Fallback local caso dev server temporário
        data = StorageService.validateCoupon(codeToTest, payloadCartItems, subtotal, customerData);
      }

      if (data.valid && data.coupon) {
        setAppliedCoupon(data.coupon);
        setCouponDiscount(data.discountAmount);
        setCouponValidationResult(data);
        setCouponFeedback({
          type: 'success',
          text: `Cupom "${data.coupon.code}" aplicado! Desconto de ${
            data.coupon.discountType === 'percentage'
              ? `${data.coupon.discountValue}% (R$ ${data.discountAmount.toFixed(2).replace('.', ',')})`
              : `R$ ${data.discountAmount.toFixed(2).replace('.', ',')}`
          }`,
        });
      } else {
        setAppliedCoupon(null);
        setCouponDiscount(0);
        setCouponValidationResult(null);
        setCouponFeedback({
          type: 'error',
          text: data.error || 'Código de cupom inválido ou expirado.',
        });
      }
    } catch {
      // Fallback para StorageService local
      const localResult = StorageService.validateCoupon(codeToTest, payloadCartItems, subtotal, customerData);
      if (localResult.valid && localResult.coupon) {
        setAppliedCoupon(localResult.coupon);
        setCouponDiscount(localResult.discountAmount);
        setCouponValidationResult(localResult);
        setCouponFeedback({
          type: 'success',
          text: `Cupom "${localResult.coupon.code}" aplicado com sucesso!`,
        });
      } else {
        setAppliedCoupon(null);
        setCouponDiscount(0);
        setCouponValidationResult(null);
        setCouponFeedback({
          type: 'error',
          text: localResult.error || 'Código de cupom inválido.',
        });
      }
    } finally {
      setCouponLoading(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponDiscount(0);
    setCouponValidationResult(null);
    setCouponInput('');
    setCouponFeedback(null);
  };

  // Calcula opções de frete disponíveis para o endereço e carrinho atual
  const shippingCalculation = useMemo(() => {
    const cleaned = cleanCep(zip);
    if (cleaned.length !== 8) {
      return {
        coverage: {
          allowed: true,
          coverageType: deliverySettings.serviceRegion.coverageType,
          city,
          state,
          cep: zip,
          allowPickup: true,
        } as CoverageValidationResult,
        packageInfo: null,
        options: [] as CalculatedShippingOption[],
      };
    }

    return getAvailableShippingOptions({
      destination: { city, state, cep: zip },
      cart,
      subtotal,
      deliverySettings,
    });
  }, [zip, city, state, cart, subtotal, deliverySettings]);

  // Define modalidade selecionada por padrão (NUNCA auto-seleciona 'retirada')
  useEffect(() => {
    if (shippingCalculation.options.length > 0) {
      const stillValid = shippingCalculation.options.some((o) => o.methodId === selectedMethodId);
      
      // Se o comprador já selecionou conscientemente uma opção e ela continua válida, mantém a escolha
      if (stillValid && selectedMethodId) {
        return;
      }

      // Se precisa definir uma opção padrão:
      // REGRA: NUNCA selecionar 'retirada no estabelecimento' de forma automática.
      // O comprador que deve selecionar a opção caso tenha interesse.
      const firstDeliveryOption = shippingCalculation.options.find((o) => o.type !== 'retirada');
      if (firstDeliveryOption) {
        setSelectedMethodId(firstDeliveryOption.methodId);
      } else {
        // Se só houver retirada disponível (ex: endereço fora da área de entrega), deixa desmarcado
        setSelectedMethodId('');
      }
    } else {
      setSelectedMethodId('');
    }
  }, [shippingCalculation.options, selectedMethodId]);

  const selectedShippingOption = useMemo(() => {
    return shippingCalculation.options.find((o) => o.methodId === selectedMethodId) || null;
  }, [shippingCalculation.options, selectedMethodId]);

  // Custo de frete dinâmico: se transportadora 'a combinar', custo é 0 no checkout imediato
  const shippingCost = selectedShippingOption ? selectedShippingOption.cost : 0;
  // Subtotal com desconto de cupom
  const subtotalAfterCoupon = Math.max(0, subtotal - couponDiscount);
  const pixDiscount = paymentMethod === 'pix' ? subtotalAfterCoupon * pixDiscountRate : 0;
  const total = Math.max(0, subtotalAfterCoupon + shippingCost - pixDiscount);
  const installmentOptions = PaymentService.calculateInstallments(total, activeGateway);

  // Consulta automática de CEP via ViaCEP oficial
  const handleLookupCep = async (rawInput: string) => {
    const cleaned = cleanCep(rawInput);
    setZip(formatCep(rawInput));
    setCepError(null);

    if (cleaned.length === 8) {
      setIsCepLoading(true);
      // Limpa seleção para que as novas opções do endereço sejam avaliadas
      setSelectedMethodId('');
      try {
        const addr = await lookupAddressByCep(cleaned);
        if (addr.valid) {
          if (addr.street) setStreet(addr.street);
          if (addr.neighborhood) setNeighborhood(addr.neighborhood);
          if (addr.city) setCity(addr.city);
          if (addr.state) setState(addr.state);
        } else {
          setCepError(addr.error || 'CEP não encontrado.');
        }
      } catch (err: any) {
        setCepError('Não foi possível consultar o CEP no momento.');
      } finally {
        setIsCepLoading(false);
      }
    }
  };

  const handleCopyPixKey = () => {
    const customPixKey = companySettings.pixKey || 'mbpersonaliza-pix-key-2026';
    const pixPayload = `00020126580014br.gov.bcb.pix0136${customPixKey}520400005303986540${total.toFixed(2)}5802BR5914${(companySettings.tradeName || 'MB PERSONALIZA').toUpperCase().slice(0, 25)}6009SAO PAULO62070503***6304`;
    navigator.clipboard.writeText(pixPayload);
    setCopiedPix(true);
    setTimeout(() => setCopiedPix(false), 2500);
  };

  const handlePlaceOrder = (e: React.FormEvent) => {
    e.preventDefault();
    setCheckoutError(null);

    if (cart.length === 0) {
      setCheckoutError('Seu carrinho está vazio.');
      return;
    }

    // Validação de Integridade: Impedir finalização sem selecionar modalidade
    if (!selectedShippingOption) {
      if (!shippingCalculation.coverage.allowed && shippingCalculation.coverage.allowPickup) {
        setCheckoutError(
          'Por favor, selecione uma forma de envio para o seu pedido. Como o endereço informado está fora da nossa área de entrega direta, você pode optar pela modalidade "Retirada no Estabelecimento" caso tenha interesse em retirar na loja.'
        );
      } else {
        setCheckoutError('Por favor, selecione uma modalidade de entrega válida para prosseguir com o pedido.');
      }
      return;
    }

    // Validação de Integridade: Impedir finalização se fora da área atendida e não for retirada
    if (!shippingCalculation.coverage.allowed && selectedShippingOption.type !== 'retirada') {
      setCheckoutError(
        shippingCalculation.coverage.reason ||
        'Não foi possível concluir o pedido: o CEP e endereço de entrega informado estão fora da nossa área geográfica de atendimento.'
      );
      return;
    }

    setIsProcessing(true);

    setTimeout(() => {
      const randomOrderNum = Math.floor(1000 + Math.random() * 9000);
      const newOrder: Order = {
        id: `ord-${Date.now()}`,
        code: `PED-2026-${randomOrderNum}`,
        clientId: currentUser.id,
        clientName: name,
        clientEmail: email,
        clientPhone: phone,
        clientCompany: company,
        shippingAddress: {
          street,
          number,
          complement,
          neighborhood,
          city,
          state,
          zip,
        },
        items: cart.map((item) => ({
          id: `oi-${Date.now()}-${item.id}`,
          productId: item.product?.id || item.productId || '',
          productName: item.product?.name || 'Produto Personalizado',
          productSku: item.product?.code || 'SKU',
          productImage: item.product?.images?.[0] || '',
          variantName: item.variant?.name,
          unitPrice: item.calculatedUnitPrice || 0,
          quantity: item.quantity || 1,
          total: (item.calculatedUnitPrice || 0) * (item.quantity || 1),
          customTechnique: item.customTechnique,
          customArtworkName: item.customArtworkName,
        })),
        subtotal,
        discount: Number((pixDiscount + couponDiscount).toFixed(2)),
        couponCode: appliedCoupon?.code,
        couponId: appliedCoupon?.id,
        couponDiscount: couponDiscount > 0 ? couponDiscount : undefined,
        couponInfo: appliedCoupon
          ? {
              couponId: appliedCoupon.id,
              code: appliedCoupon.code,
              campaignName: appliedCoupon.campaignName,
              discountType: appliedCoupon.discountType,
              discountValue: appliedCoupon.discountValue,
              discountApplied: couponDiscount,
              originalSubtotal: subtotal,
              eligibleSubtotal: couponValidationResult?.eligibleSubtotal ?? subtotal,
              appliedAt: new Date().toISOString(),
              customerIdentified: email || name,
            }
          : undefined,
        shippingCost,
        shippingInfo: {
          methodId: selectedShippingOption.methodId,
          methodName: selectedShippingOption.name,
          methodType: selectedShippingOption.type,
          carrierName: selectedShippingOption.carrierName,
          originZip: deliverySettings.correiosConfig.originZip,
          destinationZip: zip,
          cost: shippingCost,
          estimatedDeliveryDays: selectedShippingOption.estimatedDays,
          freightStatus: selectedShippingOption.isQuoteRequired ? 'aguardando_cotacao' : 'definido',
          history: [
            {
              id: `hist-${Date.now()}`,
              date: new Date().toISOString(),
              action: selectedShippingOption.isQuoteRequired ? 'aguardando_cotacao' : 'criado',
              actor: name,
              details: selectedShippingOption.isQuoteRequired
                ? 'Pedido criado aguardando cotação de transportadora.'
                : `Modalidade de frete selecionada: ${selectedShippingOption.name} (R$ ${shippingCost.toFixed(2)}).`,
            },
          ],
        },
        total,
        paymentMethod,
        paymentStatus: (paymentMethod === 'boleto' || paymentMethod === 'boleto_faturado') ? 'pendente' : 'pago',
        orderStatus: 'novo',
        sourceQuoteId: operationType === 'proposta_aprovada' ? selectedQuote?.id : undefined,
        billingTerms: operationType === 'proposta_aprovada' ? selectedQuote?.billingTerms : undefined,
        notes: `Pedido realizado via loja online. ${
          paymentMethod === 'boleto_faturado'
            ? `Boleto Faturado a Prazo (Autorizado: ${selectedQuote?.billingTerms?.conditionName || 'Proposta'}).`
            : paymentMethod === 'boleto'
            ? 'Boleto Bancário à Vista.'
            : 'Pagamento Imediato.'
        } Frete: ${selectedShippingOption.name} (${selectedShippingOption.type}).`,
        createdAt: new Date().toISOString(),
      };

      StorageService.addOrder(newOrder);

      // Se for boleto (à vista ou faturado a prazo), gera os boletos bancários oficiais e integra com Contas a Receber
      if (paymentMethod === 'boleto' || paymentMethod === 'boleto_faturado') {
        const boletoRes = StorageService.generateBoletosForOrder({
          order: newOrder,
          quote: selectedQuote || undefined,
          tipoCobranca: paymentMethod === 'boleto_faturado' ? 'faturado_prazo' : 'a_vista',
          operatorName: 'Loja Virtual MB (Checkout)',
        });

        if (boletoRes.success) {
          newOrder.boletos = boletoRes.boletos;
          setActiveBoletos(boletoRes.boletos);
          setShowBoletoModal(true);
        }
      }

      // Baixa de estoque imediata para os produtos vendidos online
      cart.forEach((item) => {
        StorageService.adjustStock(
          item.product.id,
          item.quantity,
          'saida',
          `Venda Loja Online #${newOrder.code}`,
          'Loja Virtual MB'
        );
      });

      // Registra transação financeira no módulo de pagamentos
      const activeGateways = StorageService.getPaymentGateways();
      const activeGw = activeGateways.find((g) => g.enabled)?.provider || 'mercadopago';
      const gwConfig = StorageService.getPaymentGateway(activeGw);
      const feeRate = paymentMethod === 'credit_card' ? (gwConfig?.feePercentageCredit ?? 3.49) / 100 : paymentMethod === 'pix' ? (gwConfig?.feePercentagePix ?? 0.99) / 100 : 0;
      const feeAmount = Number((total * feeRate).toFixed(2));
      const netAmount = Number((total - feeAmount).toFixed(2));

      StorageService.addPaymentTransaction({
        id: `tx-web-${newOrder.code}`,
        saleId: newOrder.id,
        saleCode: newOrder.code,
        origin: 'loja_online',
        customerName: name,
        customerCpfCnpj: cpfCnpj || undefined,
        gateway: activeGw,
        gatewayTransactionId: `${activeGw === 'mercadopago' ? 'mp' : 'pb'}_tx_${Date.now()}`,
        method: paymentMethod === 'credit_card' ? 'credit_card' : paymentMethod === 'pix' ? 'pix' : 'boleto',
        installments: paymentMethod === 'credit_card' ? installments : 1,
        installmentValue: paymentMethod === 'credit_card' && installments > 1 ? Number((total / installments).toFixed(2)) : total,
        grossAmount: total,
        feeAmount,
        netAmount,
        status: (paymentMethod === 'boleto' || paymentMethod === 'boleto_faturado') ? 'aguardando' : 'aprovado',
        statusDetail: `Pedido recebido via checkout online (${paymentMethod === 'boleto_faturado' ? 'Boleto Faturado a Prazo' : paymentMethod === 'boleto' ? 'Boleto à Vista' : paymentMethod}).`,
        cardBrand: paymentMethod === 'credit_card' ? 'Mastercard' : undefined,
        cardLastFour: paymentMethod === 'credit_card' ? cardNumber.replace(/\D/g, '').slice(-4) || '4242' : undefined,
        operatorName: 'Loja Virtual MB',
        metadata: {
          shippingCost,
          subtotal,
          couponDiscount,
          couponCode: appliedCoupon?.code,
          pixDiscount,
        },
        history: [
          {
            timestamp: new Date().toISOString(),
            status: (paymentMethod === 'boleto' || paymentMethod === 'boleto_faturado') ? 'aguardando' : 'aprovado',
            note: (paymentMethod === 'boleto' || paymentMethod === 'boleto_faturado')
              ? 'Boleto bancário emitido. Aguardando conciliação ou liquidação bancária.'
              : 'Cobrança aprovada no checkout transparente.',
            operator: 'Loja Virtual MB',
          },
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      // Sincroniza pedido no WebService da Stricker para produtos importados/integrados
      const strickerCartItems = cart.filter(
        (item) =>
          item.product.code.startsWith('STK-') ||
          item.product.id.startsWith('mb-stk-') ||
          ['prod-garrafa-inox-650', 'prod-mochila-antifurto', 'prod-powerbank-10000', 'prod-caderno-a5-branve', 'prod-caneta-metal-ekston'].includes(item.product.id)
      );

      if (strickerCartItems.length > 0) {
        try {
          const lines = strickerCartItems.map((item) => {
            const cleanRef = item.product.code.replace('STK-', '');
            const optSku = item.variant?.sku || cleanRef;
            return {
              productReference: cleanRef,
              sku: optSku,
              quantity: item.quantity,
              unitPrice: item.product.cost_price || Number((item.calculatedUnitPrice * 0.65).toFixed(2)),
              customization: item.customTechnique
                ? {
                    techniqueName: item.customTechnique,
                    description: `Gravação MB Personaliza (${item.customArtworkName || 'Arte do Cliente'})`,
                  }
                : undefined,
            };
          });

          StrickerOrderService.createOrder({
            internalReference: newOrder.code,
            waitArtwork: true, // Garante maquete técnica antes da gravação na fábrica
            deliveryAddress: {
              recipientName: name,
              street,
              number,
              neighborhood,
              city,
              state,
              zip,
              country: 'Brasil',
            },
            lines,
          }).catch((err) => console.warn('Aviso integração pedido Stricker:', err));
        } catch (stkErr) {
          console.warn('Erro ao disparar pedido para Stricker:', stkErr);
        }
      }

      onClearCart();
      setCompletedOrder(newOrder);
      setIsProcessing(false);

      // Trigger confetti
      try {
        confetti({
          particleCount: 100,
          spread: 80,
          origin: { y: 0.6 },
          colors: ['#E6007E', '#00AEEF', '#FFDD00'],
        });
      } catch {}
    }, 1200);
  };

  if (completedOrder) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center space-y-6" id="order-success-screen">
        <div className="w-20 h-20 rounded-3xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-md">
          <CheckCircle2 className="w-12 h-12" />
        </div>

        <div className="space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-[#E6007E]">
            Pedido Confirmado!
          </span>
          <h1 className="text-3xl sm:text-4xl font-extrabold uppercase font-heading text-slate-900">
            Pedido {completedOrder.code} Gerado com Sucesso
          </h1>
          <p className="text-sm text-slate-600 max-w-lg mx-auto">
            Obrigado pela confiança, <strong>{completedOrder.clientName}</strong>. Enviamos todos os detalhes para <strong>{completedOrder.clientEmail}</strong>.
          </p>
        </div>

        <div className="p-6 bg-white rounded-3xl border border-slate-200 text-left max-w-lg mx-auto space-y-4 shadow-sm">
          <div className="flex justify-between text-xs border-b border-slate-100 pb-2">
            <span className="text-slate-500">Número do Pedido:</span>
            <span className="font-mono font-bold text-slate-900">{completedOrder.code}</span>
          </div>

          <div className="flex justify-between text-xs border-b border-slate-100 pb-2">
            <span className="text-slate-500">Status da Produção:</span>
            <span className="px-2 py-0.5 rounded bg-sky-100 text-sky-800 text-[10px] font-bold uppercase">
              Novo Pedido • Fila de Gravação
            </span>
          </div>

          <div className="flex justify-between text-xs border-b border-slate-100 pb-2">
            <span className="text-slate-500">Forma de Pagamento:</span>
            <span className="font-bold text-slate-900 uppercase">
              {completedOrder.paymentMethod.replace('_', ' ')} ({completedOrder.paymentStatus})
            </span>
          </div>

          <div className="flex justify-between text-sm font-bold text-slate-900 pt-1">
            <span>Total {completedOrder.paymentStatus === 'pago' ? 'Pago' : 'do Pedido'}:</span>
            <span className="text-base text-[#E6007E] font-heading">
              R$ {completedOrder.total.toFixed(2)}
            </span>
          </div>

          {/* Se o pedido foi gerado com Boleto Bancário */}
          {(completedOrder.paymentMethod === 'boleto' || completedOrder.paymentMethod === 'boleto_faturado') && (
            <div className="p-4 bg-indigo-50/80 border border-indigo-200 rounded-2xl text-left space-y-3 mt-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-indigo-700" />
                  <div>
                    <h4 className="font-extrabold text-xs text-indigo-950 uppercase">
                      Boleto Bancário Registrado
                    </h4>
                    <p className="text-[11px] text-indigo-700">
                      {completedOrder.paymentMethod === 'boleto_faturado'
                        ? 'Faturamento a Prazo Autorizado'
                        : `Pagamento à Vista (Vencimento em ${boletoSettings.cashBoletoDueDays} dias úteis)`}
                    </p>
                  </div>
                </div>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                    completedOrder.paymentStatus === 'pago'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {completedOrder.paymentStatus === 'pago' ? 'Quitado' : 'Aguardando Pagamento'}
                </span>
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    const bl = completedOrder.boletos || StorageService.getBoletosByOrderId(completedOrder.id);
                    if (bl.length > 0) {
                      setActiveBoletos(bl);
                      setShowBoletoModal(true);
                    } else {
                      // Attempt to fetch all boletos as fallback
                      const allB = StorageService.getBoletos();
                      if (allB.length > 0) {
                        setActiveBoletos([allB[0]]);
                        setShowBoletoModal(true);
                      }
                    }
                  }}
                  className="px-4 py-2 bg-indigo-700 hover:bg-indigo-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                >
                  <FileText className="w-4 h-4 text-[#FFDD00]" />
                  <span>Visualizar / Imprimir Boleto</span>
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3 pt-4">
          <button
            onClick={() => onNavigate('customer-portal')}
            className="px-6 py-3 bg-slate-900 hover:bg-[#E6007E] text-white font-bold rounded-xl text-xs sm:text-sm transition-all shadow-md flex items-center gap-2"
          >
            <span>Acompanhar na Minha Conta</span>
            <ArrowRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => onNavigate('home')}
            className="px-6 py-3 bg-white hover:bg-slate-50 text-slate-700 font-bold rounded-xl text-xs sm:text-sm border border-slate-200"
          >
            Voltar à Loja
          </button>
        </div>
      </div>
    );
  }

  if (cart.length === 0) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 font-heading uppercase">Seu Carrinho está Vazio</h2>
        <p className="text-xs text-slate-500">Adicione produtos antes de prosseguir para o checkout.</p>
        <button
          onClick={() => onNavigate('catalog')}
          className="px-6 py-3 bg-slate-900 text-white font-bold text-xs rounded-xl hover:bg-[#E6007E] transition-colors"
        >
          Ir para o Catálogo
        </button>
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8" id="checkout-page">
      <SEOHead
        title="Checkout Seguro & Finalização de Pedido"
        description="Finalização segura de pedido de brindes corporativos e produtos personalizados na MB Personaliza."
        canonicalPath="/checkout"
        noIndex={true}
      />
      <div className="border-b border-slate-200 pb-4">
        <span className="text-xs font-bold uppercase tracking-wider text-[#E6007E]">Finalização de Compra</span>
        <h1 className="text-3xl font-extrabold uppercase font-heading text-slate-900">
          Checkout Seguro & Pagamento
        </h1>
      </div>

      <form onSubmit={handlePlaceOrder} className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Client & Address & Payment (8 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Step 1: Customer Info */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
            <h3 className="font-heading text-base font-bold text-slate-900 uppercase flex items-center gap-2 border-b border-slate-100 pb-2">
              <User className="w-4 h-4 text-[#00AEEF]" />
              1. Identificação do Comprador
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Nome Completo *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#00AEEF] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">E-mail para Confirmação *</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#00AEEF] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Telefone / WhatsApp *</label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#00AEEF] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">CNPJ / CPF para Emissão da NF-e *</label>
                <input
                  type="text"
                  required
                  value={cpfCnpj}
                  onChange={(e) => setCpfCnpj(e.target.value)}
                  placeholder="00.000.000/0001-00"
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#00AEEF] focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Step 2: Shipping Address & Coverage Validation */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="font-heading text-base font-bold text-slate-900 uppercase flex items-center gap-2">
                <MapPin className="w-4 h-4 text-[#E6007E]" />
                2. Endereço de Entrega & Validação de Região
              </h3>
              {isCepLoading && (
                <div className="flex items-center gap-1.5 text-[11px] text-[#00AEEF] font-bold">
                  <div className="w-3.5 h-3.5 border-2 border-[#00AEEF] border-t-transparent rounded-full animate-spin" />
                  <span>Consultando CEP...</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  CEP *
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={zip}
                    maxLength={9}
                    onChange={(e) => handleLookupCep(e.target.value)}
                    placeholder="00000-000"
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#00AEEF] focus:outline-none font-bold font-mono"
                  />
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              <div className="lg:col-span-3">
                <label className="block text-xs font-bold text-slate-700 mb-1">Rua / Logradouro *</label>
                <input
                  type="text"
                  required
                  value={street}
                  onChange={(e) => setStreet(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#00AEEF] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Número *</label>
                <input
                  type="text"
                  required
                  value={number}
                  onChange={(e) => setNumber(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#00AEEF] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Complemento</label>
                <input
                  type="text"
                  value={complement}
                  onChange={(e) => setComplement(e.target.value)}
                  placeholder="Apto, Sala, Bloco..."
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#00AEEF] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Bairro *</label>
                <input
                  type="text"
                  required
                  value={neighborhood}
                  onChange={(e) => setNeighborhood(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#00AEEF] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Cidade / UF *</label>
                <div className="grid grid-cols-3 gap-2">
                  <input
                    type="text"
                    required
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="col-span-2 px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#00AEEF] focus:outline-none font-bold"
                  />
                  <input
                    type="text"
                    required
                    maxLength={2}
                    value={state}
                    onChange={(e) => setState(e.target.value.toUpperCase())}
                    className="px-2 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#00AEEF] focus:outline-none font-bold text-center uppercase"
                  />
                </div>
              </div>
            </div>

            {cepError && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>{cepError}</span>
              </div>
            )}

            {/* Diagnóstico de Cobertura Geográfica */}
            {!shippingCalculation.coverage.allowed && (
              <div className="p-4 bg-rose-50 border-2 border-rose-200 rounded-2xl space-y-2">
                <div className="flex items-center gap-2 text-rose-900 font-bold text-xs">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>Atenção: Endereço fora da região de atendimento para entrega</span>
                </div>
                <p className="text-xs text-rose-800">
                  {shippingCalculation.coverage.reason ||
                    'A MB Personaliza não realiza entregas para o endereço informado com a configuração logística atual.'}
                </p>
                {shippingCalculation.coverage.allowPickup && (
                  <div className="text-[11px] font-bold text-emerald-800 bg-white/70 p-2.5 rounded-xl border border-rose-200">
                    💡 Você ainda pode finalizar seu pedido escolhendo a modalidade <strong>"Retirada no Estabelecimento"</strong> abaixo.
                  </div>
                )}
              </div>
            )}

            {/* SELEÇÃO DA FORMA DE ENTREGA */}
            <div className="pt-3 border-t border-slate-100 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-900 uppercase flex items-center gap-1.5">
                    <Truck className="w-4 h-4 text-[#00AEEF]" />
                    Modalidades de Entrega Disponíveis
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Selecione a forma de envio desejada para o seu pedido
                  </p>
                </div>
              </div>

              {shippingCalculation.options.length > 0 ? (
                <div className="space-y-2.5">
                  {shippingCalculation.options.map((opt) => {
                    const isSelected = selectedMethodId === opt.methodId;

                    return (
                      <div
                        key={opt.methodId}
                        onClick={() => setSelectedMethodId(opt.methodId)}
                        className={`p-4 rounded-2xl border-2 transition-all cursor-pointer ${
                          isSelected
                            ? 'border-[#00AEEF] bg-sky-50/50 shadow-sm'
                            : 'border-slate-200 hover:border-slate-300 bg-white'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3">
                            <input
                              type="radio"
                              name="shippingMethodOption"
                              checked={isSelected}
                              onChange={() => setSelectedMethodId(opt.methodId)}
                              className="w-4 h-4 text-[#00AEEF] mt-0.5 cursor-pointer"
                            />
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-xs text-slate-900">{opt.name}</span>
                                <span
                                  className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded ${
                                    opt.type === 'correios'
                                      ? 'bg-amber-100 text-amber-800'
                                      : opt.type === 'transportadora'
                                      ? 'bg-blue-100 text-blue-800'
                                      : opt.type === 'retirada'
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : 'bg-purple-100 text-purple-800'
                                  }`}
                                >
                                  {opt.type === 'transportadora' ? 'Frete a Combinar' : opt.type}
                                </span>
                              </div>
                              <p className="text-xs text-slate-600 mt-0.5">{opt.description}</p>

                              {opt.pickupAddress && (
                                <p className="text-[11px] text-emerald-700 font-semibold mt-1">
                                  Endereço: {opt.pickupAddress}
                                </p>
                              )}

                              {opt.rulesNotes && (
                                <p className="text-[10px] text-slate-400 mt-1 italic">
                                  {opt.rulesNotes}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            {opt.isQuoteRequired ? (
                              <div>
                                <span className="text-xs font-bold text-blue-700 block">
                                  A Combinar
                                </span>
                                <span className="text-[10px] text-slate-400 block">
                                  Negociado pós-pedido
                                </span>
                              </div>
                            ) : (
                              <div>
                                <span className="text-sm font-bold text-slate-900 font-heading block">
                                  {opt.cost === 0 ? (
                                    <span className="text-emerald-600">Grátis</span>
                                  ) : (
                                    `R$ ${opt.cost.toFixed(2)}`
                                  )}
                                </span>
                                <span className="text-[10px] text-slate-500 block">
                                  Prazo: ~{opt.estimatedDays} {opt.estimatedDays === 1 ? 'dia útil' : 'dias úteis'}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-6 text-center bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                  <Package className="w-8 h-8 text-slate-400 mx-auto" />
                  <p className="text-xs font-bold text-slate-700">
                    Nenhuma modalidade de entrega disponível para este CEP no momento.
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Verifique se o CEP foi digitado corretamente ou contate nossa equipe pelo WhatsApp.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Step 3: Payment Method */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
            <h3 className="font-heading text-base font-bold text-slate-900 uppercase flex items-center gap-2 border-b border-slate-100 pb-2">
              <CreditCard className="w-4 h-4 text-[#FFDD00]" />
              3. Forma de Pagamento
            </h3>

            {/* Modalidade de Operação: Compra Comum vs. Proposta Aprovada */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                  Modalidade da Operação:
                </span>
                <span className="text-[10px] text-slate-500 font-semibold bg-white px-2 py-0.5 rounded-full border border-slate-200">
                  Política Comercial MB Personaliza
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setOperationType('loja_comum');
                    if (paymentMethod === 'boleto_faturado') setPaymentMethod('boleto');
                  }}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    operationType === 'loja_comum'
                      ? 'bg-white border-slate-900 shadow-xs ring-2 ring-slate-900'
                      : 'bg-slate-100/70 border-slate-200 text-slate-600 hover:bg-white'
                  }`}
                >
                  <div className="font-bold text-xs text-slate-900 flex items-center justify-between">
                    <span>Compra Comum da Loja</span>
                    <span className="text-[9px] bg-slate-200 px-1.5 py-0.5 rounded font-mono text-slate-700">Padrão</span>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1">
                    Boleto exclusivamente à vista (PF e PJ)
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setOperationType('proposta_aprovada');
                    if (availableQuotes.length > 0 && !selectedQuoteId) {
                      setSelectedQuoteId(availableQuotes[0].id);
                      if (availableQuotes[0].billingTerms?.isDeferredAuthorized) {
                        setPaymentMethod('boleto_faturado');
                      }
                    }
                  }}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    operationType === 'proposta_aprovada'
                      ? 'bg-white border-[#E6007E] shadow-xs ring-2 ring-[#E6007E]'
                      : 'bg-slate-100/70 border-slate-200 text-slate-600 hover:bg-white'
                  }`}
                >
                  <div className="font-bold text-xs text-slate-900 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Building className="w-3.5 h-3.5 text-[#E6007E]" />
                      Proposta / Orçamento Aprovado
                    </span>
                    <span className="text-[9px] bg-pink-100 text-[#E6007E] px-1.5 py-0.5 rounded font-bold">B2B / VIP</span>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1">
                    Faturamento a prazo sob autorização formal
                  </div>
                </button>
              </div>

              {/* Se selecionou Proposta / Orçamento Aprovado */}
              {operationType === 'proposta_aprovada' && (
                <div className="pt-2.5 border-t border-slate-200 space-y-2">
                  <label className="block text-xs font-bold text-slate-700">
                    Vincular a Proposta Comercial / Orçamento Aprovado:
                  </label>
                  {availableQuotes.length > 0 ? (
                    <select
                      value={selectedQuoteId}
                      onChange={(e) => {
                        const qId = e.target.value;
                        setSelectedQuoteId(qId);
                        const q = availableQuotes.find((x) => x.id === qId);
                        if (q?.billingTerms?.isDeferredAuthorized && q.billingTerms.type === 'faturado_prazo') {
                          setPaymentMethod('boleto_faturado');
                        } else {
                          setPaymentMethod('boleto');
                        }
                      }}
                      className="w-full px-3 py-2 text-xs font-semibold bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-[#E6007E]"
                    >
                      <option value="">-- Selecione uma proposta comercial ou orçamento aprovado --</option>
                      {availableQuotes.map((q) => (
                        <option key={q.id} value={q.id}>
                          {q.code} • {q.clientName} ({q.clientCompany || 'Pessoa Física'}) — Condição:{' '}
                          {q.billingTerms?.isDeferredAuthorized
                            ? `${q.billingTerms.conditionName} [Prazo Autorizado]`
                            : 'À Vista (Sem prazo autorizado)'}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p className="text-xs text-amber-800 bg-amber-50 p-2.5 rounded-xl border border-amber-200">
                      Nenhuma proposta comercial aprovada localizada para este usuário.
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Payment Tabs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <button
                type="button"
                onClick={() => setPaymentMethod('pix')}
                className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                  paymentMethod === 'pix'
                    ? 'border-emerald-600 bg-emerald-50/50 ring-2 ring-emerald-500'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <QrCode className="w-5 h-5 text-emerald-600" />
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-600 text-white">
                    {companySettings.pixDiscountPercent ?? 5}% OFF
                  </span>
                </div>
                <div className="font-bold text-xs text-slate-900 mt-2">PIX Instantâneo</div>
                <div className="text-[10px] text-slate-500">Aprovação imediata</div>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('credit_card')}
                className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                  paymentMethod === 'credit_card'
                    ? 'border-[#00AEEF] bg-sky-50/50 ring-2 ring-[#00AEEF]'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <CreditCard className="w-5 h-5 text-[#00AEEF]" />
                <div className="font-bold text-xs text-slate-900 mt-2">Cartão de Crédito</div>
                <div className="text-[10px] text-slate-500">Até 12x no cartão</div>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('boleto')}
                className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                  paymentMethod === 'boleto'
                    ? 'border-indigo-600 bg-indigo-50/50 ring-2 ring-indigo-500'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <FileText className="w-5 h-5 text-indigo-600" />
                <div className="font-bold text-xs text-slate-900 mt-2">Boleto à Vista</div>
                <div className="text-[10px] text-slate-500">
                  Venc. {boletoSettings.cashBoletoDueDays} dias úteis
                </div>
              </button>

              {operationType === 'proposta_aprovada' && isDeferredAuthorizedForSelectedQuote && (
                <button
                  type="button"
                  onClick={() => setPaymentMethod('boleto_faturado')}
                  className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                    paymentMethod === 'boleto_faturado'
                      ? 'border-[#E6007E] bg-pink-50/50 ring-2 ring-[#E6007E]'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <Building className="w-5 h-5 text-[#E6007E]" />
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-600 text-white">
                      AUTORIZADO
                    </span>
                  </div>
                  <div className="font-bold text-xs text-slate-900 mt-2">Boleto a Prazo</div>
                  <div className="text-[10px] text-[#E6007E] font-bold truncate">
                    {selectedQuote?.billingTerms?.conditionName || 'Faturado'}
                  </div>
                </button>
              )}
            </div>

            {/* AVISO OBRIGATÓRIO DE POLÍTICA COMERCIAL PARA COMPRAS COMUNS */}
            {operationType === 'loja_comum' && (
              <div className="p-3.5 bg-slate-100 rounded-2xl border border-slate-200 text-slate-700 space-y-1">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-slate-700 shrink-0 mt-0.5" />
                  <div className="text-xs space-y-1">
                    <p className="font-bold text-slate-900 leading-snug">
                      “O pagamento por boleto a prazo está disponível exclusivamente para propostas comerciais ou orçamentos personalizados aprovados e autorizados. Para compras comuns, o boleto é somente à vista.”
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Regra comercial obrigatória aplicável tanto para <strong>Pessoa Física (CPF)</strong> quanto para <strong>Pessoa Jurídica (CNPJ)</strong>. O cadastro de CNPJ não concede liberação automática de prazo de pagamento.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Method Details */}
            {paymentMethod === 'pix' && (
              <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-2xl space-y-3">
                <div className="flex items-center justify-between text-xs text-emerald-950 font-bold">
                  <span>Chave PIX Copia e Cola</span>
                  <span className="text-emerald-700 font-semibold">
                    Desconto de {companySettings.pixDiscountPercent ?? 5}% aplicado no total
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={`00020126580014br.gov.bcb.pix0136${companySettings.pixKey || 'mbpersonaliza-pix-key-2026'}520400005303986540${total.toFixed(2)}5802BR5914${(companySettings.tradeName || 'MB PERSONALIZA').toUpperCase().slice(0, 25)}6009SAO PAULO62070503***6304`}
                    className="flex-1 px-3 py-2 text-[11px] font-mono bg-white border border-emerald-300 rounded-xl text-slate-600 select-all"
                  />
                  <button
                    type="button"
                    onClick={handleCopyPixKey}
                    className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 transition-colors"
                  >
                    {copiedPix ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedPix ? 'Copiado' : 'Copiar'}</span>
                  </button>
                </div>
                <p className="text-[11px] text-emerald-800">
                  O QR Code oficial será exibido e a confirmação é automática após clicar em "Finalizar Pedido".
                </p>
              </div>
            )}

            {paymentMethod === 'credit_card' && (
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Número do Cartão</label>
                  <input
                    type="text"
                    value={cardNumber}
                    onChange={(e) => setCardNumber(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-[#00AEEF]"
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Titular</label>
                    <input
                      type="text"
                      value={cardHolder}
                      onChange={(e) => setCardHolder(e.target.value)}
                      className="w-full px-3.5 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-[#00AEEF]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Validade</label>
                    <input
                      type="text"
                      value={cardExpiry}
                      onChange={(e) => setCardExpiry(e.target.value)}
                      className="w-full px-3.5 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-[#00AEEF]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">CVV</label>
                    <input
                      type="text"
                      value={cardCvv}
                      onChange={(e) => setCardCvv(e.target.value)}
                      className="w-full px-3.5 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-[#00AEEF]"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-700">Parcelamento no Cartão</label>
                    <span className="text-[10px] text-[#00AEEF] font-bold">
                      Processado via {activeGateway.name}
                    </span>
                  </div>
                  <select
                    value={installments}
                    onChange={(e) => setInstallments(parseInt(e.target.value))}
                    className="w-full px-3.5 py-2 text-xs font-semibold bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-[#00AEEF]"
                  >
                    {installmentOptions.map((opt) => (
                      <option key={opt.installment} value={opt.installment}>
                        {opt.installment}x de R$ {opt.value.toFixed(2)}{' '}
                        {!opt.hasInterest ? '(Sem juros)' : `(Total: R$ ${opt.total.toFixed(2)})`}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {paymentMethod === 'boleto' && (
              <div className="p-4 bg-indigo-50/70 border border-indigo-200 rounded-2xl space-y-2 text-xs text-indigo-950">
                <div className="flex items-center justify-between font-bold">
                  <span className="flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-indigo-700" />
                    Boleto Bancário — Pagamento Exclusivamente à Vista
                  </span>
                  <span className="text-indigo-700 font-mono text-[11px]">
                    Vencimento: {boletoSettings.cashBoletoDueDays} dias úteis
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Boleto bancário oficial gerado à vista no valor de <strong>R$ {total.toFixed(2)}</strong>. Ao finalizar o pedido, o documento completo com código de barras, linha digitável e botão de impressão será exibido na tela e integrado ao módulo financeiro.
                </p>
                <div className="flex items-center gap-2 pt-1 text-[10px] text-slate-500 font-medium">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Emissor Oficial: {boletoSettings.defaultBankName} • Registrado conforme normas BACEN/FEBRABAN</span>
                </div>
              </div>
            )}

            {paymentMethod === 'boleto_faturado' && (
              <div className="p-4 bg-emerald-50/80 border border-emerald-300 rounded-2xl space-y-3 text-xs text-emerald-950">
                <div className="flex items-center justify-between font-bold">
                  <span className="flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-700" />
                    Faturamento a Prazo Autorizado ({selectedQuote?.billingTerms?.conditionName || 'Boleto'})
                  </span>
                  <span className="bg-emerald-600 text-white text-[10px] px-2 py-0.5 rounded-full uppercase">
                    Aprovação Confirmada
                  </span>
                </div>
                <p className="text-[11px] text-emerald-900 leading-relaxed">
                  Operação vinculada à <strong>Proposta Comercial #{selectedQuote?.code}</strong>.
                  {selectedQuote?.billingTerms?.commercialApprovedBy && (
                    <> Aprovado comercialmente por {selectedQuote.billingTerms.commercialApprovedBy}.</>
                  )}
                  {selectedQuote?.billingTerms?.financialApprovedBy && (
                    <> Alçada financeira confirmada por {selectedQuote.billingTerms.financialApprovedBy}.</>
                  )}
                </p>
                <div className="p-3 bg-white rounded-xl border border-emerald-200 space-y-1">
                  <div className="font-bold text-[11px] text-slate-800">Condições de Faturamento Registradas:</div>
                  <div className="text-[11px] text-slate-600">
                    • Parcelas autorizadas: <strong>{selectedQuote?.billingTerms?.installmentsCount || 1}x</strong>
                  </div>
                  <div className="text-[11px] text-slate-600">
                    • Prazos de vencimento: <strong>{selectedQuote?.billingTerms?.daysInterval?.join(', ') || '28'} dias após faturamento</strong>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1 italic">
                    *Títulos integrados automaticamente ao Contas a Receber da empresa com controle de liquidação individual.
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Order Summary (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-5 sticky top-24">
            <h3 className="font-heading text-base font-bold text-slate-900 uppercase border-b border-slate-100 pb-2">
              Resumo do Pedido ({cart.length} itens)
            </h3>

            {/* Items list */}
            <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto pr-1 space-y-3">
              {cart.map((item) => (
                <div key={item.id} className="pt-3 flex items-center justify-between text-xs gap-3">
                  <img
                    src={item.product?.images?.[0] || 'https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&w=400&q=80'}
                    alt={item.product?.name || 'Produto'}
                    className="w-12 h-12 object-cover rounded-lg border border-slate-100 flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-900 truncate">{item.product?.name || 'Produto'}</p>
                    <p className="text-[11px] text-slate-500">
                      {item.quantity || 1} un x R$ {(item.calculatedUnitPrice || 0).toFixed(2)}
                    </p>
                    {item.variant && (
                      <span className="text-[10px] text-slate-400">{item.variant.name}</span>
                    )}
                  </div>
                  <span className="font-bold text-slate-900 font-heading">
                    R$ {((item.calculatedUnitPrice || 0) * (item.quantity || 1)).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>

            {/* Calculations */}
            <div className="pt-4 border-t border-slate-200 space-y-2 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal dos Produtos:</span>
                <span className="font-semibold text-slate-900">R$ {subtotal.toFixed(2)}</span>
              </div>

              <div className="flex justify-between items-center text-slate-600">
                <div>
                  <span>Frete ({selectedShippingOption ? selectedShippingOption.name : 'A calcular'}):</span>
                  {selectedShippingOption?.type === 'transportadora' && (
                    <span className="block text-[10px] text-blue-600 font-bold">
                      A negociar após pedido
                    </span>
                  )}
                  {selectedShippingOption?.type === 'retirada' && (
                    <span className="block text-[10px] text-emerald-600 font-bold">
                      Retirada na sede (Sem frete)
                    </span>
                  )}
                </div>
                <span className="font-semibold text-slate-900 text-right">
                  {!selectedShippingOption ? (
                    <span className="text-amber-600 font-bold text-xs">A selecionar</span>
                  ) : selectedShippingOption?.isQuoteRequired ? (
                    <span className="text-blue-700 font-bold">A Combinar</span>
                  ) : shippingCost === 0 ? (
                    <span className="text-emerald-600 font-bold">Grátis (R$ 0,00)</span>
                  ) : (
                    `R$ ${shippingCost.toFixed(2)}`
                  )}
                </span>
              </div>

              {/* Cupom de Desconto */}
              <div className="pt-3 pb-2 border-t border-slate-200">
                <label className="block text-xs font-bold text-slate-800 mb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Ticket className="w-3.5 h-3.5 text-[#E6007E]" />
                    <span>Cupom de desconto</span>
                  </span>
                  {appliedCoupon && (
                    <span className="text-[10px] text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full font-semibold border border-emerald-200">
                      Cupom Ativo
                    </span>
                  )}
                </label>

                {!appliedCoupon ? (
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input
                        type="text"
                        value={couponInput}
                        onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleApplyCoupon())}
                        placeholder="Ex: PRIMEIRACOMPRA"
                        className="w-full px-3 py-2 text-xs font-mono font-semibold uppercase bg-white border border-slate-300 rounded-xl focus:border-slate-900 focus:outline-none"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => handleApplyCoupon()}
                      disabled={couponLoading || !couponInput.trim()}
                      className="px-3.5 py-2 bg-slate-900 hover:bg-[#E6007E] text-white text-xs font-bold rounded-xl transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5 shrink-0"
                    >
                      {couponLoading ? (
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <span>Aplicar</span>
                      )}
                    </button>
                  </div>
                ) : (
                  <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-xs">
                        <Tag className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-emerald-950 font-mono">
                          {appliedCoupon.code}
                        </div>
                        <div className="text-[10px] text-emerald-700">
                          {appliedCoupon.campaignName}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleRemoveCoupon}
                      className="p-1 text-emerald-700 hover:text-rose-600 hover:bg-emerald-100 rounded-lg transition-colors cursor-pointer"
                      title="Remover cupom"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {couponFeedback && (
                  <div
                    className={`mt-2 p-2 rounded-lg text-[11px] leading-tight flex items-start gap-1.5 ${
                      couponFeedback.type === 'success'
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : 'bg-rose-50 text-rose-800 border border-rose-200'
                    }`}
                  >
                    {couponFeedback.type === 'success' ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                    )}
                    <span>{couponFeedback.text}</span>
                  </div>
                )}
              </div>

              {couponDiscount > 0 && (
                <div className="flex justify-between text-[#E6007E] bg-pink-50 px-2.5 py-1.5 rounded-lg font-bold border border-pink-100">
                  <span className="flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5" />
                    <span>Desconto do Cupom ({appliedCoupon?.code}):</span>
                  </span>
                  <span>- R$ {couponDiscount.toFixed(2)}</span>
                </div>
              )}

              {pixDiscount > 0 && (
                <div className="flex justify-between text-emerald-700 bg-emerald-50 px-2.5 py-1.5 rounded-lg font-bold">
                  <span>Desconto {companySettings.pixDiscountPercent ?? 5}% PIX:</span>
                  <span>- R$ {pixDiscount.toFixed(2)}</span>
                </div>
              )}

              <div className="flex justify-between text-base font-black text-slate-900 pt-2 border-t border-slate-200">
                <span>Total Final:</span>
                <span className="text-xl text-[#E6007E] font-heading">
                  R$ {total.toFixed(2)}
                </span>
              </div>
            </div>

            {checkoutError && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2 animate-fadeIn">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span className="font-semibold">{checkoutError}</span>
              </div>
            )}

            {/* Place Order CTA */}
            <button
              type="submit"
              disabled={isProcessing}
              className="w-full py-4 bg-slate-900 hover:bg-[#E6007E] text-white font-extrabold text-sm rounded-2xl transition-all shadow-lg hover:shadow-pink-500/25 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-75"
              id="btn-place-order"
            >
              {isProcessing ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Processando Pedido...</span>
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4 text-[#FFDD00]" />
                  <span>Confirmar & Finalizar Pedido</span>
                </>
              )}
            </button>

            <div className="flex items-center justify-center gap-2 text-[11px] text-slate-500">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Ambiente criptografado com certificação SSL</span>
            </div>
          </div>
        </div>
      </form>

      {/* Visualizador de Boleto Bancário Registrado */}
      {showBoletoModal && activeBoletos.length > 0 && (
        <BoletoModal
          boletos={activeBoletos}
          onClose={() => setShowBoletoModal(false)}
          onBoletoSettled={(updated) => {
            setActiveBoletos((prev) =>
              prev.map((b) => (b.id === updated.id ? updated : b))
            );
            if (completedOrder) {
              const updatedOrders = StorageService.getOrders();
              const found = updatedOrders.find((o) => o.id === completedOrder.id);
              if (found) setCompletedOrder(found);
            }
          }}
        />
      )}
    </div>
  );
};
