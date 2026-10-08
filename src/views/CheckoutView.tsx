import React, { useState, useEffect } from 'react';
import { CartItem, Order, UserProfile, CompanySettings, PaymentGatewayConfig } from '../types';
import { StorageService } from '../services/storage';
import { PaymentService } from '../services/paymentService';
import { StrickerOrderService } from '../services/stricker/StrickerOrderService';
import { SEOHead } from '../components/SEOHead';
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

  // Payment
  const [paymentMethod, setPaymentMethod] = useState<'pix' | 'credit_card' | 'faturado_pj'>('pix');
  const [cardNumber, setCardNumber] = useState('•••• •••• •••• 4242');
  const [cardHolder, setCardHolder] = useState(currentUser.name.toUpperCase());
  const [cardExpiry, setCardExpiry] = useState('12/28');
  const [cardCvv, setCardCvv] = useState('888');
  const [installments, setInstallments] = useState(1);

  // States
  const [isProcessing, setIsProcessing] = useState(false);
  const [completedOrder, setCompletedOrder] = useState<Order | null>(null);
  const [copiedPix, setCopiedPix] = useState(false);

  const [gateways] = useState(() => StorageService.getPaymentGateways());
  const activeGateway = gateways.find((g) => g.enabled) || gateways[0];

  const pixDiscountRate = (companySettings.pixDiscountPercent ?? 5) / 100;
  const subtotal = (cart || []).reduce(
    (acc, item) => acc + (item?.calculatedUnitPrice || 0) * (item?.quantity || 0),
    0
  );
  const shippingCost = subtotal > 500 ? 0 : 45.00;
  const pixDiscount = paymentMethod === 'pix' ? subtotal * pixDiscountRate : 0;
  const total = subtotal + shippingCost - pixDiscount;
  const installmentOptions = PaymentService.calculateInstallments(total, activeGateway);

  const handleCopyPixKey = () => {
    const customPixKey = companySettings.pixKey || 'mbpersonaliza-pix-key-2026';
    const pixPayload = `00020126580014br.gov.bcb.pix0136${customPixKey}520400005303986540${total.toFixed(2)}5802BR5914${(companySettings.tradeName || 'MB PERSONALIZA').toUpperCase().slice(0, 25)}6009SAO PAULO62070503***6304`;
    navigator.clipboard.writeText(pixPayload);
    setCopiedPix(true);
    setTimeout(() => setCopiedPix(false), 2500);
  };

  const handlePlaceOrder = (e: React.FormEvent) => {
    e.preventDefault();

    if (cart.length === 0) {
      alert('Seu carrinho está vazio.');
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
          productId: item.product.id,
          productName: item.product.name,
          productSku: item.product.code,
          productImage: item.product.images[0],
          variantName: item.variant?.name,
          unitPrice: item.calculatedUnitPrice,
          quantity: item.quantity,
          total: item.calculatedUnitPrice * item.quantity,
          customTechnique: item.customTechnique,
          customArtworkName: item.customArtworkName,
        })),
        subtotal,
        discount: pixDiscount,
        shippingCost,
        total,
        paymentMethod,
        paymentStatus: paymentMethod === 'faturado_pj' ? 'pendente' : 'pago',
        orderStatus: 'novo',
        notes: `Pedido realizado via loja online. Pagamento: ${paymentMethod}.`,
        createdAt: new Date().toISOString(),
      };

      StorageService.addOrder(newOrder);

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
        status: paymentMethod === 'faturado_pj' ? 'aguardando' : 'aprovado',
        statusDetail: `Pedido recebido via checkout online (${paymentMethod}).`,
        cardBrand: paymentMethod === 'credit_card' ? 'Mastercard' : undefined,
        cardLastFour: paymentMethod === 'credit_card' ? cardNumber.replace(/\D/g, '').slice(-4) || '4242' : undefined,
        operatorName: 'Loja Virtual MB',
        metadata: {
          shippingCost,
          subtotal,
          pixDiscount,
        },
        history: [
          {
            timestamp: new Date().toISOString(),
            status: paymentMethod === 'faturado_pj' ? 'aguardando' : 'aprovado',
            note: 'Cobrança gerada e aprovada no checkout transparente.',
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
            <span>Total Pago:</span>
            <span className="text-base text-[#E6007E] font-heading">
              R$ {completedOrder.total.toFixed(2)}
            </span>
          </div>
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

          {/* Step 2: Shipping Address */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
            <h3 className="font-heading text-base font-bold text-slate-900 uppercase flex items-center gap-2 border-b border-slate-100 pb-2">
              <MapPin className="w-4 h-4 text-[#E6007E]" />
              2. Endereço de Entrega
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="lg:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">Rua / Logradouro</label>
                <input
                  type="text"
                  required
                  value={street}
                  onChange={(e) => setStreet(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#00AEEF] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Número</label>
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
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#00AEEF] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Bairro</label>
                <input
                  type="text"
                  required
                  value={neighborhood}
                  onChange={(e) => setNeighborhood(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#00AEEF] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Cidade</label>
                <input
                  type="text"
                  required
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#00AEEF] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Estado</label>
                <input
                  type="text"
                  required
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#00AEEF] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">CEP</label>
                <input
                  type="text"
                  required
                  value={zip}
                  onChange={(e) => setZip(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#00AEEF] focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Step 3: Payment Method */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
            <h3 className="font-heading text-base font-bold text-slate-900 uppercase flex items-center gap-2 border-b border-slate-100 pb-2">
              <CreditCard className="w-4 h-4 text-[#FFDD00]" />
              3. Forma de Pagamento
            </h3>

            {/* Payment Tabs */}
            <div className="grid grid-cols-3 gap-3">
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
                <div className="text-[10px] text-slate-500">Até 12x sem juros</div>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('faturado_pj')}
                className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                  paymentMethod === 'faturado_pj'
                    ? 'border-slate-900 bg-slate-100 ring-2 ring-slate-900'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <Building className="w-5 h-5 text-slate-700" />
                <div className="font-bold text-xs text-slate-900 mt-2">Faturamento PJ</div>
                <div className="text-[10px] text-slate-500">Boleto 28 dias</div>
              </button>
            </div>

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

            {paymentMethod === 'faturado_pj' && (
              <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-2xl text-xs text-amber-900 space-y-1">
                <p className="font-bold">Condição Especial para Pessoas Jurídicas:</p>
                <p>
                  Faturamento em 28 dias após a entrega dos produtos com envio de boleto bancário e Nota Fiscal eletrônica no e-mail cadastrado. Sujeito à análise cadastral de crédito.
                </p>
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
                    src={item.product.images[0]}
                    alt={item.product.name}
                    className="w-12 h-12 object-cover rounded-lg border border-slate-100 flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-900 truncate">{item.product.name}</p>
                    <p className="text-[11px] text-slate-500">
                      {item.quantity} un x R$ {item.calculatedUnitPrice.toFixed(2)}
                    </p>
                    {item.variant && (
                      <span className="text-[10px] text-slate-400">{item.variant.name}</span>
                    )}
                  </div>
                  <span className="font-bold text-slate-900 font-heading">
                    R$ {(item.calculatedUnitPrice * item.quantity).toFixed(2)}
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

              <div className="flex justify-between text-slate-600">
                <span>Frete com Seguro:</span>
                <span className="font-semibold text-slate-900">
                  {shippingCost === 0 ? (
                    <span className="text-emerald-600 font-bold">Grátis (Acima R$ 500)</span>
                  ) : (
                    `R$ ${shippingCost.toFixed(2)}`
                  )}
                </span>
              </div>

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
    </div>
  );
};
