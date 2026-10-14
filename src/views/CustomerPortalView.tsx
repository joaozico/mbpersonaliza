import React, { useState } from 'react';
import { UserProfile, Order, Quote, BoletoTitulo } from '../types';
import { StorageService } from '../services/storage';
import { SEOHead } from '../components/SEOHead';
import { BoletoModal } from '../components/BoletoModal';
import {
  User,
  Package,
  FileSpreadsheet,
  Settings,
  Clock,
  CheckCircle2,
  AlertCircle,
  Truck,
  ArrowRight,
  ChevronRight,
  Check,
  CreditCard,
  QrCode,
  Calendar,
  Building,
  MapPin,
  Sparkles,
  FileText,
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface CustomerPortalViewProps {
  currentUser: UserProfile;
  onUserUpdate: (user: UserProfile) => void;
  onNavigate: (view: string, param?: string) => void;
}

export const CustomerPortalView: React.FC<CustomerPortalViewProps> = ({
  currentUser,
  onUserUpdate,
  onNavigate,
}) => {
  const [activeTab, setActiveTab] = useState<'orders' | 'quotes' | 'profile'>('orders');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);
  const [activeBoletosModal, setActiveBoletosModal] = useState<BoletoTitulo[] | null>(null);

  // Profile form state
  const [name, setName] = useState(currentUser.name);
  const [email, setEmail] = useState(currentUser.email);
  const [phone, setPhone] = useState(currentUser.phone);
  const [company, setCompany] = useState(currentUser.company || '');
  const [cpfCnpj, setCpfCnpj] = useState(currentUser.cpfCnpj || '');
  const [stateRegistration, setStateRegistration] = useState(currentUser.stateRegistration || '');
  const [street, setStreet] = useState(currentUser.address?.street || '');
  const [number, setNumber] = useState(currentUser.address?.number || '');
  const [neighborhood, setNeighborhood] = useState(currentUser.address?.neighborhood || '');
  const [city, setCity] = useState(currentUser.address?.city || '');
  const [state, setState] = useState(currentUser.address?.state || '');
  const [zip, setZip] = useState(currentUser.address?.zip || '');
  const [savedSuccess, setSavedSuccess] = useState(false);

  const [orders, setOrders] = useState<Order[]>(() =>
    StorageService.getOrders().filter(
      (o) => o.clientId === currentUser.id || o.clientEmail === currentUser.email
    )
  );
  const [quotes, setQuotes] = useState<Quote[]>(() =>
    StorageService.getQuotes().filter(
      (q) => q.clientId === currentUser.id || q.clientEmail === currentUser.email
    )
  );

  const refreshOrders = () => {
    setOrders(
      StorageService.getOrders().filter(
        (o) => o.clientId === currentUser.id || o.clientEmail === currentUser.email
      )
    );
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    const updated: UserProfile = {
      ...currentUser,
      name,
      email,
      phone,
      company,
      cpfCnpj,
      stateRegistration,
      address: {
        street,
        number,
        neighborhood,
        city,
        state,
        zip,
      },
    };
    StorageService.saveUser(updated);
    StorageService.setCurrentUser(updated);
    onUserUpdate(updated);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleApproveQuote = (quoteId: string) => {
    if (confirm('Deseja aprovar este orçamento e enviá-lo para a fila de produção?')) {
      const order = StorageService.convertQuoteToOrder(quoteId, 'faturado_pj');
      if (order) {
        try {
          confetti({
            particleCount: 70,
            spread: 60,
            colors: ['#E6007E', '#00AEEF', '#FFDD00'],
          });
        } catch {}
        alert(`Orçamento aprovado com sucesso! Foi gerado o Pedido ${order.code}.`);
        setActiveTab('orders');
      }
    }
  };

  const getOrderStatusBadge = (status: Order['orderStatus']) => {
    switch (status) {
      case 'novo':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-sky-100 text-sky-800">Novo Pedido</span>;
      case 'em_producao':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 flex items-center gap-1"><Clock className="w-3 h-3" /> Em Produção</span>;
      case 'pronto':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-800">Pronto p/ Envio</span>;
      case 'entregue':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Entregue</span>;
      case 'cancelado':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800">Cancelado</span>;
    }
  };

  const getQuoteStatusBadge = (status: Quote['status']) => {
    switch (status) {
      case 'pendente':
      case 'em_analise':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800">Em Análise Comercial</span>;
      case 'respondido':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-sky-100 text-sky-800">Proposta com Preço Enviada</span>;
      case 'aprovado':
      case 'convertido':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">Aprovado / Em Pedido</span>;
      case 'recusado':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-200 text-slate-700">Recusado</span>;
    }
  };

  return (
    <div className="w-full min-w-0 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8" id="customer-portal-page">
      <SEOHead
        title="Área do Cliente & Meus Pedidos"
        description="Portal de autoatendimento para acompanhamento de pedidos, aprovação de orçamentos e layouts virtuais de personalização."
        canonicalPath="/minha-conta"
        noIndex={true}
      />
      {/* Top Banner Profile Summary */}
      <div className="bg-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#E6007E] to-[#00AEEF] flex items-center justify-center text-white font-extrabold text-2xl font-heading shadow-md">
            {currentUser.name.charAt(0)}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-white/20 text-white">
                Conta do Cliente
              </span>
              {currentUser.company && (
                <span className="text-xs text-slate-300 font-medium flex items-center gap-1">
                  <Building className="w-3.5 h-3.5" /> {currentUser.company}
                </span>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold uppercase font-heading text-white mt-1">
              Olá, {currentUser.name}
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">{currentUser.email} • {currentUser.phone}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onNavigate('quote')}
            className="px-4 py-2.5 bg-[#E6007E] hover:bg-[#c9006e] text-white text-xs font-bold rounded-xl transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Novo Orçamento</span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-3 border-b border-slate-200 pb-2">
        <button
          onClick={() => {
            setActiveTab('orders');
            setSelectedOrder(null);
          }}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'orders'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Package className="w-4 h-4" />
          <span>Meus Pedidos ({orders.length})</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('quotes');
            setSelectedQuote(null);
          }}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'quotes'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Meus Orçamentos ({quotes.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('profile')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'profile'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <User className="w-4 h-4" />
          <span>Dados Cadastrais</span>
        </button>
      </div>

      {/* TAB 1: MEUS PEDIDOS */}
      {activeTab === 'orders' && (
        <div className="space-y-4">
          {orders.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 space-y-3">
              <Package className="w-12 h-12 text-slate-300 mx-auto" />
              <h3 className="font-bold text-slate-800 text-base">Nenhum pedido registrado até o momento</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Assim que você concluir uma compra online ou aprovar uma cotação comercial, seu pedido aparecerá aqui com rastreamento da produção.
              </p>
              <button
                onClick={() => onNavigate('catalog')}
                className="px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-xl hover:bg-[#E6007E] transition-colors"
              >
                Explorar Catálogo
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {orders.map((order) => (
                <div
                  key={order.id}
                  className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:border-slate-300 transition-all space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-3">
                      <span className="font-mono font-bold text-sm text-slate-900">{order.code}</span>
                      <span className="text-xs text-slate-400">
                        {new Date(order.createdAt).toLocaleDateString('pt-BR')}
                      </span>
                      {order.sourceQuoteId && (
                        <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded font-medium text-slate-600">
                          Origem: Cotação
                        </span>
                      )}
                    </div>
                    <div>{getOrderStatusBadge(order.orderStatus)}</div>
                  </div>

                  {/* Items summary */}
                  <div className="space-y-2">
                    {order.items.map((item) => (
                      <div key={item.id} className="flex items-center justify-between text-xs py-1">
                        <div className="flex items-center gap-3">
                          {item.productImage && (
                            <img
                              src={item.productImage}
                              alt={item.productName}
                              className="w-10 h-10 object-cover rounded-lg border border-slate-100"
                            />
                          )}
                          <div>
                            <p className="font-semibold text-slate-900">{item.productName}</p>
                            <p className="text-[11px] text-slate-500">
                              {item.quantity} unidades • {item.customTechnique || 'Personalizado'}
                            </p>
                          </div>
                        </div>
                        <span className="font-bold text-slate-900 font-heading">
                          R$ {item.total.toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Shipping Info & Freight Proposal Response Banner */}
                  {order.shippingInfo && (
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 font-bold text-slate-800">
                          <Truck className="w-4 h-4 text-[#00AEEF]" />
                          <span>Entrega: {order.shippingInfo.methodName}</span>
                          {order.shippingInfo.carrierName && (
                            <span className="text-[11px] font-normal text-slate-500">
                              ({order.shippingInfo.carrierName})
                            </span>
                          )}
                        </div>

                        <div>
                          {order.shippingInfo.freightStatus === 'aguardando_cotacao' && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-blue-100 text-blue-800">
                              Aguardando Cotação de Frete
                            </span>
                          )}
                          {order.shippingInfo.freightStatus === 'proposta_enviada' && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-100 text-amber-800">
                              Proposta de Frete Disponível para Aprovação
                            </span>
                          )}
                          {order.shippingInfo.freightStatus === 'aprovado' && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800">
                              Frete Aprovado
                            </span>
                          )}
                          {order.shippingInfo.freightStatus === 'recusado' && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-rose-100 text-rose-800">
                              Proposta Recusada
                            </span>
                          )}
                        </div>
                      </div>

                      {order.shippingInfo.freightStatus === 'proposta_enviada' && (
                        <div className="p-3 bg-white rounded-lg border border-amber-200 space-y-2 mt-2">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div>
                              <p className="font-bold text-slate-900 text-xs">
                                Proposta de Transporte: R$ {(order.shippingInfo.negotiatedCost || 0).toFixed(2)}
                              </p>
                              <p className="text-[11px] text-slate-500">
                                Transportadora: {order.shippingInfo.negotiatedCarrier || 'Parceira'} • Prazo estimado: {order.shippingInfo.negotiatedDeadlineDays || 3} dias úteis
                              </p>
                              {order.shippingInfo.proposalNotes && (
                                <p className="text-[11px] text-slate-600 mt-1 italic">
                                  "{order.shippingInfo.proposalNotes}"
                                </p>
                              )}
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                type="button"
                                onClick={() => {
                                  StorageService.updateOrderShipping(order.id, {
                                    freightStatus: 'aprovado',
                                    actorName: currentUser.name,
                                    actionDescription: 'Cliente aprovou a proposta de frete diretamente na área do cliente.',
                                  });
                                  setOrders(StorageService.getOrders().filter((o) => o.clientId === currentUser.id));
                                  alert('Frete aprovado com sucesso! A expedição foi comunicada.');
                                }}
                                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
                              >
                                Aprovar Frete
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  const reason = prompt('Informe o motivo da recusa da cotação:');
                                  if (reason) {
                                    StorageService.updateOrderShipping(order.id, {
                                      freightStatus: 'recusado',
                                      customerResponseNotes: reason,
                                      actorName: currentUser.name,
                                      actionDescription: `Cliente recusou o frete: ${reason}`,
                                    });
                                    setOrders(StorageService.getOrders().filter((o) => o.clientId === currentUser.id));
                                    alert('Recusa registrada. Nossa equipe entrará em contato para negociar nova alternativa.');
                                  }
                                }}
                                className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                              >
                                Recusar
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Footer with totals & Tracking code */}
                  <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-4 text-slate-600">
                      {order.trackingCode && (
                        <div className="flex items-center gap-1 font-semibold text-slate-800">
                          <Truck className="w-3.5 h-3.5 text-[#00AEEF]" />
                          <span>Rastreio: <strong className="font-mono text-slate-900">{order.trackingCode}</strong></span>
                        </div>
                      )}
                      <div>
                        Pagamento: <strong className="uppercase text-slate-800">{order.paymentMethod.replace('_', ' ')}</strong> ({order.paymentStatus})
                      </div>
                    </div>

                    <div className="text-right">
                      {order.shippingCost > 0 && (
                        <div className="text-[11px] text-slate-500">
                          Frete: R$ {order.shippingCost.toFixed(2)}
                        </div>
                      )}
                      <span className="text-slate-500 mr-2">Valor Total:</span>
                      <span className="text-base font-extrabold text-slate-900 font-heading">
                        R$ {order.total.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {(order.paymentMethod === 'boleto' || order.paymentMethod === 'boleto_faturado') && (
                    <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-indigo-50/50 -mx-5 -mb-5 p-4 rounded-b-2xl border-t">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-indigo-700" />
                        <div>
                          <span className="font-bold text-xs text-indigo-950 block">
                            {order.paymentMethod === 'boleto_faturado'
                              ? `Boleto Faturado a Prazo (${order.billingTerms?.conditionName || 'Faturado'})`
                              : 'Boleto Bancário à Vista'}
                          </span>
                          <span className="text-[11px] text-indigo-700">
                            {order.paymentStatus === 'pago'
                              ? 'Título quitado com confirmação bancária.'
                              : 'Aguardando pagamento / conciliação bancária.'}
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          const orderBoletos = StorageService.getBoletosByOrderId(order.id);
                          if (orderBoletos.length > 0) {
                            setActiveBoletosModal(orderBoletos);
                          } else if (order.boletos && order.boletos.length > 0) {
                            setActiveBoletosModal(order.boletos);
                          } else {
                            alert('Boleto bancário em processamento no sistema financeiro.');
                          }
                        }}
                        className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer w-fit"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>Visualizar Boleto(s)</span>
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: MEUS ORÇAMENTOS */}
      {activeTab === 'quotes' && (
        <div className="space-y-4">
          {quotes.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 space-y-3">
              <FileSpreadsheet className="w-12 h-12 text-slate-300 mx-auto" />
              <h3 className="font-bold text-slate-800 text-base">Nenhum orçamento solicitado ainda</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Precisa de cotações para grandes volumes, kits onboarding ou comunicação visual? Envie uma solicitação em minutos.
              </p>
              <button
                onClick={() => onNavigate('quote')}
                className="px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-xl hover:bg-[#E6007E] transition-colors"
              >
                Solicitar Orçamento Agora
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {quotes.map((quote) => (
                <div
                  key={quote.id}
                  className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:border-slate-300 transition-all space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-3">
                      <span className="font-mono font-bold text-sm text-slate-900">{quote.code}</span>
                      <span className="text-xs text-slate-400">
                        {new Date(quote.createdAt).toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                    <div>{getQuoteStatusBadge(quote.status)}</div>
                  </div>

                  {/* Items */}
                  <div className="space-y-2">
                    {quote.items.map((item) => (
                      <div key={item.id} className="flex items-center justify-between text-xs py-1">
                        <div className="flex items-center gap-3">
                          {item.productImage && (
                            <img
                              src={item.productImage}
                              alt={item.productName}
                              className="w-10 h-10 object-cover rounded-lg border border-slate-100"
                            />
                          )}
                          <div>
                            <p className="font-semibold text-slate-900">{item.productName}</p>
                            <p className="text-[11px] text-slate-500">
                              {item.quantity} un • {item.customTechnique || 'Personalização sob medida'}
                            </p>
                          </div>
                        </div>

                        {item.unit_price_estimated ? (
                          <div className="text-right">
                            <span className="text-[10px] text-slate-400">{item.quantity}x R$ {item.unit_price_estimated.toFixed(2)}</span>
                            <div className="font-bold text-slate-900 font-heading">
                              R$ {(item.unit_price_estimated * item.quantity).toFixed(2)}
                            </div>
                          </div>
                        ) : (
                          <span className="text-amber-600 text-xs font-semibold">Calculando proposta...</span>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Admin notes if answered */}
                  {quote.adminNotes && (
                    <div className="p-3 bg-sky-50 rounded-xl border border-sky-200 text-xs space-y-1">
                      <span className="font-bold text-sky-950 flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5 text-[#00AEEF]" /> Resposta da Equipe Comercial MB Personaliza:
                      </span>
                      <p className="text-sky-900 leading-relaxed">{quote.adminNotes}</p>
                      {quote.productionDaysEstimate && (
                        <p className="text-[11px] text-sky-800 font-medium pt-1">
                          ⏱️ Prazo estimado de produção: <strong>{quote.productionDaysEstimate} dias úteis</strong> • Validade da proposta: <strong>{quote.validityDate || '15 dias'}</strong>
                        </p>
                      )}
                    </div>
                  )}

                  {/* Condições de Pagamento Negociadas */}
                  {quote.billingTerms && (
                    <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-xl text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-indigo-700 shrink-0" />
                        <div>
                          <span className="font-bold text-indigo-950 block">
                            Condição Comercial: {quote.billingTerms.conditionName}
                          </span>
                          <span className="text-[11px] text-indigo-700">
                            {quote.billingTerms.type === 'faturado_prazo' && quote.billingTerms.isDeferredAuthorized
                              ? `Faturamento a Prazo Autorizado (${quote.billingTerms.installmentsCount}x parcela(s))`
                              : 'Boleto Bancário à Vista (Vencimento padrão em 2 dias úteis)'}
                          </span>
                        </div>
                      </div>
                      {quote.billingTerms.isDeferredAuthorized && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-purple-100 text-purple-800 border border-purple-200 w-fit">
                          Prazo Autorizado
                        </span>
                      )}
                    </div>
                  )}

                  {/* Actions & Totals */}
                  <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div>
                      {quote.totalEstimated ? (
                        <div className="flex items-baseline gap-2">
                          <span className="text-slate-500">Valor Total Proposto:</span>
                          <span className="text-lg font-black text-[#E6007E] font-heading">
                            R$ {quote.totalEstimated.toFixed(2)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-500">Aguardando precificação final</span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {quote.status === 'respondido' && (
                        <button
                          onClick={() => handleApproveQuote(quote.id)}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
                        >
                          <Check className="w-4 h-4" />
                          <span>Aprovar Proposta e Gerar Pedido</span>
                        </button>
                      )}

                      <a
                        href={`https://wa.me/5511987654321?text=Ol%C3%A1%2C%20gostaria%20de%20falar%20sobre%20meu%20or%C3%A7amento%20${quote.code}`}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition-colors"
                      >
                        Tirar Dúvidas no WhatsApp
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: DADOS CADASTRAIS */}
      {activeTab === 'profile' && (
        <form onSubmit={handleSaveProfile} className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-heading text-lg font-bold text-slate-900 uppercase">Informações Pessoais & Corporativas</h3>
              <p className="text-xs text-slate-500">Mantenha seus dados atualizados para faturamento e entregas</p>
            </div>
            {savedSuccess && (
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-lg flex items-center gap-1">
                <Check className="w-3.5 h-3.5" /> Dados salvos com sucesso!
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Nome Completo</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#00AEEF] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">E-mail</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#00AEEF] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Telefone / WhatsApp</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#00AEEF] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Empresa / Razão Social</label>
              <input
                type="text"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#00AEEF] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">CNPJ ou CPF</label>
              <input
                type="text"
                value={cpfCnpj}
                onChange={(e) => setCpfCnpj(e.target.value)}
                placeholder="00.000.000/0001-00"
                className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#00AEEF] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Inscrição Estadual (IE)</label>
              <input
                type="text"
                value={stateRegistration}
                onChange={(e) => setStateRegistration(e.target.value)}
                placeholder="123.456.789.000 ou Isento"
                className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#00AEEF] focus:outline-none"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100">
            <h4 className="text-xs font-bold uppercase text-slate-800 tracking-wider mb-3">
              Endereço Principal de Entrega
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="lg:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">Logradouro / Rua</label>
                <input
                  type="text"
                  value={street}
                  onChange={(e) => setStreet(e.target.value)}
                  placeholder="Ex: Av. Paulista"
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#00AEEF] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Número</label>
                <input
                  type="text"
                  value={number}
                  onChange={(e) => setNumber(e.target.value)}
                  placeholder="1842"
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#00AEEF] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Bairro</label>
                <input
                  type="text"
                  value={neighborhood}
                  onChange={(e) => setNeighborhood(e.target.value)}
                  placeholder="Bela Vista"
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#00AEEF] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Cidade</label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="São Paulo"
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#00AEEF] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Estado</label>
                <input
                  type="text"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  placeholder="SP"
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#00AEEF] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">CEP</label>
                <input
                  type="text"
                  value={zip}
                  onChange={(e) => setZip(e.target.value)}
                  placeholder="01310-200"
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#00AEEF] focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div className="pt-4 flex justify-end">
            <button
              type="submit"
              className="px-6 py-2.5 bg-slate-900 hover:bg-[#E6007E] text-white font-bold rounded-xl text-xs transition-colors cursor-pointer"
            >
              Salvar Alterações
            </button>
          </div>
        </form>
      )}

      {/* Modal Visual do Boleto Bancário */}
      {activeBoletosModal && (
        <BoletoModal
          boletos={activeBoletosModal}
          onClose={() => setActiveBoletosModal(null)}
          onBoletoSettled={(updated) => {
            setActiveBoletosModal([updated]);
            setOrders(
              StorageService.getOrders().filter(
                (o) => o.clientId === currentUser.id || o.clientEmail === currentUser.email
              )
            );
          }}
        />
      )}
    </div>
  );
};
