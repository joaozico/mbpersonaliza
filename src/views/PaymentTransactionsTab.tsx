import React, { useState, useMemo } from 'react';
import {
  PaymentTransaction,
  PaymentTransactionStatus,
  PaymentGatewayProvider,
  UserProfile,
} from '../types';
import { StorageService } from '../services/storage';
import { PaymentService } from '../services/paymentService';
import {
  DollarSign,
  TrendingUp,
  CreditCard,
  QrCode,
  ShieldCheck,
  Search,
  Filter,
  ArrowUpRight,
  ArrowDownLeft,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ExternalLink,
  Receipt,
  Store,
  Globe2,
  Calendar,
  X,
  FileSpreadsheet,
} from 'lucide-react';

interface PaymentTransactionsTabProps {
  currentUser: UserProfile;
}

export const PaymentTransactionsTab: React.FC<PaymentTransactionsTabProps> = ({ currentUser }) => {
  const [transactions, setTransactions] = useState<PaymentTransaction[]>(() =>
    StorageService.getPaymentTransactions()
  );

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [gatewayFilter, setGatewayFilter] = useState<'all' | PaymentGatewayProvider>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | PaymentTransactionStatus>('all');
  const [originFilter, setOriginFilter] = useState<'all' | 'loja_online' | 'pdv' | 'orcamento'>(
    'all'
  );
  const [methodFilter, setMethodFilter] = useState<string>('all');
  const [periodFilter, setPeriodFilter] = useState<'all' | 'today' | '7days' | '30days'>('all');

  // Modal Detail / Refund
  const [selectedTx, setSelectedTx] = useState<PaymentTransaction | null>(null);
  const [refundReason, setRefundReason] = useState('Cancelamento a pedido do cliente');
  const [isRefunding, setIsRefunding] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const refreshList = () => {
    setTransactions(StorageService.getPaymentTransactions());
  };

  // Filtered transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      // Search by ID, saleCode, customerName, cpf
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesQuery =
          tx.id.toLowerCase().includes(q) ||
          tx.saleCode.toLowerCase().includes(q) ||
          tx.customerName.toLowerCase().includes(q) ||
          (tx.customerCpfCnpj && tx.customerCpfCnpj.includes(q)) ||
          (tx.gatewayTransactionId && tx.gatewayTransactionId.toLowerCase().includes(q));
        if (!matchesQuery) return false;
      }

      if (gatewayFilter !== 'all' && tx.gateway !== gatewayFilter) return false;
      if (statusFilter !== 'all' && tx.status !== statusFilter) return false;
      if (originFilter !== 'all' && tx.origin !== originFilter) return false;
      if (methodFilter !== 'all' && tx.method !== methodFilter) return false;

      if (periodFilter !== 'all') {
        const txDate = new Date(tx.createdAt);
        const now = new Date();
        const diffMs = now.getTime() - txDate.getTime();
        const diffDays = diffMs / (1000 * 3600 * 24);

        if (periodFilter === 'today' && diffDays > 1) return false;
        if (periodFilter === '7days' && diffDays > 7) return false;
        if (periodFilter === '30days' && diffDays > 30) return false;
      }

      return true;
    });
  }, [
    transactions,
    searchQuery,
    gatewayFilter,
    statusFilter,
    originFilter,
    methodFilter,
    periodFilter,
  ]);

  // Financial Metrics
  const metrics = useMemo(() => {
    const approved = transactions.filter((t) => t.status === 'aprovado');
    const grossTotal = approved.reduce((acc, t) => acc + t.grossAmount, 0);
    const feesTotal = approved.reduce((acc, t) => acc + t.feeAmount, 0);
    const netTotal = approved.reduce((acc, t) => acc + t.netAmount, 0);
    const onlineTotal = approved
      .filter((t) => t.origin === 'loja_online')
      .reduce((acc, t) => acc + t.grossAmount, 0);
    const pdvTotal = approved
      .filter((t) => t.origin === 'pdv')
      .reduce((acc, t) => acc + t.grossAmount, 0);

    return {
      grossTotal,
      feesTotal,
      netTotal,
      onlineTotal,
      pdvTotal,
      countApproved: approved.length,
      ticketAverage: approved.length > 0 ? grossTotal / approved.length : 0,
    };
  }, [transactions]);

  // Refund handler
  const handleExecuteRefund = async () => {
    if (!selectedTx) return;
    if (
      !confirm(
        `Confirma a solicitação de estorno da transação ${selectedTx.id} no valor de R$ ${selectedTx.grossAmount.toFixed(
          2
        )}?`
      )
    ) {
      return;
    }

    setIsRefunding(true);
    try {
      const res = await PaymentService.refundTransaction(
        selectedTx.id,
        selectedTx.gateway,
        refundReason,
        currentUser.name
      );
      if (res.success) {
        setFeedbackMessage({ type: 'success', text: res.message });
        refreshList();
        setSelectedTx((prev) => (prev ? { ...prev, status: 'estornado' } : null));
      } else {
        setFeedbackMessage({ type: 'error', text: res.message });
      }
    } catch (err: any) {
      setFeedbackMessage({
        type: 'error',
        text: `Erro ao comunicar com o gateway: ${err.message}`,
      });
    } finally {
      setIsRefunding(false);
      setTimeout(() => setFeedbackMessage(null), 5000);
    }
  };

  const getStatusBadge = (status: PaymentTransactionStatus) => {
    switch (status) {
      case 'aprovado':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> Aprovado
          </span>
        );
      case 'aguardando':
      case 'processando':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 flex items-center gap-1">
            <Clock className="w-3 h-3" /> Processando
          </span>
        );
      case 'estornado':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 flex items-center gap-1">
            <RotateCcw className="w-3 h-3" /> Estornado
          </span>
        );
      case 'cancelado':
      case 'recusado':
      case 'erro':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" /> {status.toUpperCase()}
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
            {status}
          </span>
        );
    }
  };

  const getGatewayBadge = (gateway: PaymentGatewayProvider) => {
    switch (gateway) {
      case 'mercadopago':
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-sky-50 text-[#00AEEF] border border-sky-200">
            Mercado Pago
          </span>
        );
      case 'pagbank':
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
            PagBank
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-slate-100 text-slate-700">
            Manual / POS
          </span>
        );
    }
  };

  const getOriginBadge = (origin: PaymentTransaction['origin']) => {
    switch (origin) {
      case 'pdv':
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1">
            <Store className="w-3 h-3" /> Loja Física (PDV)
          </span>
        );
      case 'loja_online':
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-pink-50 text-[#E6007E] border border-pink-200 flex items-center gap-1">
            <Globe2 className="w-3 h-3" /> Loja Online
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-50 text-slate-700 border border-slate-200">
            Orçamento
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Metrics Banner */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Faturamento Bruto</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 font-heading">
            R$ {metrics.grossTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
            <span>{metrics.countApproved} transações aprovadas</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Valor Líquido</span>
            <div className="w-8 h-8 rounded-xl bg-sky-50 text-[#00AEEF] flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 font-heading">
            R$ {metrics.netTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Taxas retidas: R$ {metrics.feesTotal.toFixed(2)}
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Faturamento PDV</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Store className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 font-heading">
            R$ {metrics.pdvTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Balcão da Loja Física</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Ticket Médio</span>
            <div className="w-8 h-8 rounded-xl bg-pink-50 text-[#E6007E] flex items-center justify-center">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 font-heading">
            R$ {metrics.ticketAverage.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Média por transação</div>
        </div>
      </div>

      {feedbackMessage && (
        <div
          className={`p-4 rounded-xl text-xs font-bold flex items-center gap-2 animate-in fade-in ${
            feedbackMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          {feedbackMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span>{feedbackMessage.text}</span>
        </div>
      )}

      {/* Filters Bar */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por código de venda, cliente, CPF ou ID do gateway..."
              className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 rounded-xl border border-slate-200 outline-none focus:bg-white focus:border-[#00AEEF]"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={periodFilter}
              onChange={(e) => setPeriodFilter(e.target.value as any)}
              className="text-xs font-semibold px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none"
            >
              <option value="all">Todo o período</option>
              <option value="today">Hoje</option>
              <option value="7days">Últimos 7 dias</option>
              <option value="30days">Últimos 30 dias</option>
            </select>

            <select
              value={originFilter}
              onChange={(e) => setOriginFilter(e.target.value as any)}
              className="text-xs font-semibold px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none"
            >
              <option value="all">Todas as origens</option>
              <option value="loja_online">Loja Online</option>
              <option value="pdv">PDV (Loja Física)</option>
              <option value="orcamento">Orçamento</option>
            </select>

            <select
              value={gatewayFilter}
              onChange={(e) => setGatewayFilter(e.target.value as any)}
              className="text-xs font-semibold px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none"
            >
              <option value="all">Todos Gateways</option>
              <option value="mercadopago">Mercado Pago</option>
              <option value="pagbank">PagBank</option>
              <option value="manual">Manual / Outros</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="text-xs font-semibold px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none"
            >
              <option value="all">Todos Status</option>
              <option value="aprovado">Aprovado</option>
              <option value="processando">Processando</option>
              <option value="estornado">Estornado</option>
              <option value="recusado">Recusado</option>
              <option value="cancelado">Cancelado</option>
            </select>
          </div>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-slate-50 text-[11px] font-extrabold uppercase text-slate-500 border-b border-slate-200">
                <th className="py-3 px-4">Venda / Pedido</th>
                <th className="py-3 px-4">Cliente</th>
                <th className="py-3 px-4">Origem</th>
                <th className="py-3 px-4">Gateway & Método</th>
                <th className="py-3 px-4 text-right">Valor Bruto</th>
                <th className="py-3 px-4 text-right">Taxa Prevista</th>
                <th className="py-3 px-4 text-right">Valor Líquido</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-800">
              {filteredTransactions.length > 0 ? (
                filteredTransactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold">
                      <div className="text-slate-900">{tx.saleCode}</div>
                      <span className="text-[10px] text-slate-400 font-normal">
                        {new Date(tx.createdAt).toLocaleDateString('pt-BR')} às{' '}
                        {new Date(tx.createdAt).toLocaleTimeString('pt-BR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900">{tx.customerName}</div>
                      {tx.customerCpfCnpj && (
                        <span className="text-[10px] text-slate-400 font-mono">
                          {tx.customerCpfCnpj}
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-4">{getOriginBadge(tx.origin)}</td>

                    <td className="py-3 px-4 space-y-1">
                      <div>{getGatewayBadge(tx.gateway)}</div>
                      <div className="text-[11px] text-slate-600 flex items-center gap-1">
                        {tx.method === 'credit_card' ? (
                          <>
                            <CreditCard className="w-3 h-3 text-[#00AEEF]" />
                            <span>
                              {tx.cardBrand || 'Cartão'} {tx.installments}x
                              {tx.cardLastFour ? ` (•••• ${tx.cardLastFour})` : ''}
                            </span>
                          </>
                        ) : tx.method === 'pix' ? (
                          <>
                            <QrCode className="w-3 h-3 text-[#00AEEF]" />
                            <span>PIX À Vista</span>
                          </>
                        ) : (
                          <span>{tx.method.replace('_', ' ').toUpperCase()}</span>
                        )}
                      </div>
                    </td>

                    <td className="py-3 px-4 text-right font-bold text-slate-900">
                      R$ {tx.grossAmount.toFixed(2)}
                    </td>

                    <td className="py-3 px-4 text-right text-rose-600 font-semibold text-[11px]">
                      - R$ {tx.feeAmount.toFixed(2)}
                    </td>

                    <td className="py-3 px-4 text-right font-extrabold text-emerald-700">
                      R$ {tx.netAmount.toFixed(2)}
                    </td>

                    <td className="py-3 px-4 text-center">{getStatusBadge(tx.status)}</td>

                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => setSelectedTx(tx)}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg transition-colors cursor-pointer text-xs"
                      >
                        Ver Detalhes
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400 text-xs">
                    Nenhuma transação encontrada com os filtros selecionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Transaction Details & Refund Modal */}
      {selectedTx && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 max-h-[90vh] flex flex-col">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <span className="text-[10px] font-bold uppercase text-[#00AEEF]">
                  Auditoria de Pagamento
                </span>
                <h3 className="text-lg font-bold text-slate-900">
                  Transação #{selectedTx.id} ({selectedTx.saleCode})
                </h3>
              </div>
              <button
                onClick={() => setSelectedTx(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6 text-xs">
              {/* Status Header */}
              <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400">
                    Status Atual
                  </span>
                  <div className="mt-1">{getStatusBadge(selectedTx.status)}</div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase font-bold text-slate-400">
                    Valor Bruto
                  </span>
                  <div className="text-lg font-black text-slate-900">
                    R$ {selectedTx.grossAmount.toFixed(2)}
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase font-bold text-slate-400">
                    Líquido Previsto
                  </span>
                  <div className="text-lg font-black text-emerald-600">
                    R$ {selectedTx.netAmount.toFixed(2)}
                  </div>
                </div>
              </div>

              {/* Data Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="p-3 rounded-xl bg-slate-50">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Gateway</span>
                  <div className="font-bold text-slate-800 mt-0.5">
                    {selectedTx.gateway.toUpperCase()}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-slate-50">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">
                    ID na Adquirente
                  </span>
                  <div className="font-mono font-bold text-slate-800 mt-0.5 truncate">
                    {selectedTx.gatewayTransactionId || 'N/A'}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-slate-50">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Origem</span>
                  <div className="font-bold text-slate-800 mt-0.5">{selectedTx.origin}</div>
                </div>
                <div className="p-3 rounded-xl bg-slate-50">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Parcelas</span>
                  <div className="font-bold text-slate-800 mt-0.5">
                    {selectedTx.installments}x de R${' '}
                    {(selectedTx.installmentValue || selectedTx.grossAmount).toFixed(2)}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-slate-50">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Operador</span>
                  <div className="font-bold text-slate-800 mt-0.5">
                    {selectedTx.operatorName || 'Sistema Automático'}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-slate-50">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Data/Hora</span>
                  <div className="font-bold text-slate-800 mt-0.5">
                    {new Date(selectedTx.createdAt).toLocaleString('pt-BR')}
                  </div>
                </div>
              </div>

              {/* Status History */}
              <div>
                <span className="text-xs font-bold text-slate-700 block mb-2">
                  Histórico de Alterações e Notificações (Webhook)
                </span>
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                  {selectedTx.history && selectedTx.history.length > 0 ? (
                    selectedTx.history.map((h, i) => (
                      <div key={i} className="p-3 flex items-start justify-between bg-white text-xs">
                        <div>
                          <div className="font-bold text-slate-800">{h.note}</div>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {new Date(h.timestamp).toLocaleString('pt-BR')}
                            {h.operator ? ` • Operador: ${h.operator}` : ''}
                          </span>
                        </div>
                        <div>{getStatusBadge(h.status)}</div>
                      </div>
                    ))
                  ) : (
                    <div className="p-3 text-slate-400 text-center">Nenhum evento registrado.</div>
                  )}
                </div>
              </div>

              {/* Estorno & Cancelamento */}
              {selectedTx.status === 'aprovado' && (
                <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 space-y-3">
                  <div className="flex items-center gap-2 text-rose-800 font-bold">
                    <RotateCcw className="w-4 h-4 text-rose-600" />
                    <span>Solicitar Estorno ou Cancelamento</span>
                  </div>
                  <p className="text-[11px] text-rose-700">
                    Ao confirmar o estorno, o gateway fará a devolução do saldo ao cliente e o
                    sistema registrará o cancelamento da venda com reposição de estoque.
                  </p>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Motivo do Estorno / Devolução:
                    </label>
                    <input
                      type="text"
                      value={refundReason}
                      onChange={(e) => setRefundReason(e.target.value)}
                      placeholder="Ex: Desistência do cliente antes da produção"
                      className="w-full px-3 py-2 text-xs bg-white rounded-lg border border-rose-300 outline-none"
                    />
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="button"
                      disabled={isRefunding}
                      onClick={handleExecuteRefund}
                      className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>{isRefunding ? 'Processando Estorno...' : 'Confirmar Estorno'}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedTx(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
