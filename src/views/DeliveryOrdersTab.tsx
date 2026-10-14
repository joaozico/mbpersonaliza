import React, { useState } from 'react';
import { Order, OrderShippingInfo } from '../types';
import { StorageService } from '../services/storage';
import { formatCep } from '../utils/shippingUtils';
import {
  Truck,
  Package,
  MapPin,
  Clock,
  DollarSign,
  Send,
  CheckCircle2,
  XCircle,
  FileText,
  Search,
  Filter,
  Eye,
  Edit3,
  Calendar,
  AlertCircle,
  History,
  X,
  Sparkles,
} from 'lucide-react';

interface DeliveryOrdersTabProps {
  orders: Order[];
  onRefreshData: () => void;
  onNotify?: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export const DeliveryOrdersTab: React.FC<DeliveryOrdersTabProps> = ({
  orders,
  onRefreshData,
  onNotify,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [methodFilter, setMethodFilter] = useState<'all' | 'correios' | 'transportadora' | 'retirada'>('all');
  const [freightStatusFilter, setFreightStatusFilter] = useState<string>('all');

  // Modal para Negociação de Frete (Transportadora a Combinar)
  const [managingOrder, setManagingOrder] = useState<Order | null>(null);
  const [carrierInput, setCarrierInput] = useState('');
  const [costInput, setCostInput] = useState<number>(0);
  const [deadlineDaysInput, setDeadlineDaysInput] = useState<number>(3);
  const [proposalNotesInput, setProposalNotesInput] = useState('');
  const [trackingCodeInput, setTrackingCodeInput] = useState('');
  const [historyDetailModalOrder, setHistoryDetailModalOrder] = useState<Order | null>(null);

  const deliverySettings = StorageService.getDeliverySettings();

  // Filtragem dos pedidos com entrega
  const filteredOrders = orders.filter((order) => {
    const matchesSearch =
      order.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (order.shippingAddress?.city || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (order.trackingCode || '').toLowerCase().includes(searchTerm.toLowerCase());

    const type = order.shippingInfo?.methodType || (order.shippingCost === 0 ? 'retirada' : 'correios');
    const matchesMethod = methodFilter === 'all' ? true : type === methodFilter;

    const freightStatus = order.shippingInfo?.freightStatus || 'definido';
    const matchesStatus = freightStatusFilter === 'all' ? true : freightStatus === freightStatusFilter;

    return matchesSearch && matchesMethod && matchesStatus;
  });

  const handleOpenFreightNegotiation = (order: Order) => {
    setManagingOrder(order);
    setCarrierInput(order.shippingInfo?.carrierName || order.shippingInfo?.negotiatedCarrier || deliverySettings.carriersList[0] || 'Braspress');
    setCostInput(order.shippingInfo?.negotiatedCost ?? order.shippingCost ?? 85.0);
    setDeadlineDaysInput(order.shippingInfo?.negotiatedDeadlineDays ?? order.shippingInfo?.estimatedDeliveryDays ?? 4);
    setProposalNotesInput(order.shippingInfo?.proposalNotes || 'Orçamento cotado para carga protegida com seguro.');
    setTrackingCodeInput(order.trackingCode || '');
  };

  const handleSendFreightProposal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!managingOrder) return;

    const res = StorageService.updateOrderShipping(managingOrder.id, {
      freightStatus: 'proposta_enviada',
      negotiatedCost: Number(costInput),
      negotiatedCarrier: carrierInput,
      negotiatedDeadlineDays: Number(deadlineDaysInput),
      proposalNotes: proposalNotesInput,
      trackingCode: trackingCodeInput || undefined,
      actorName: 'Administrador MB',
      actionDescription: `Proposta de frete enviada ao cliente: R$ ${costInput.toFixed(2)} via ${carrierInput} (Prazo: ${deadlineDaysInput} dias úteis).`,
    });

    if (res.success) {
      if (onNotify) onNotify(`Proposta de frete do pedido ${managingOrder.code} registrada e enviada!`, 'success');
      setManagingOrder(null);
      onRefreshData();
    } else {
      alert(res.error || 'Erro ao registrar proposta.');
    }
  };

  const handleRegisterCustomerResponse = (status: 'aprovado' | 'recusado', reason?: string) => {
    if (!managingOrder) return;

    const res = StorageService.updateOrderShipping(managingOrder.id, {
      freightStatus: status,
      customerResponseNotes: reason || (status === 'aprovado' ? 'Cliente aprovou o valor por WhatsApp/E-mail.' : 'Cliente recusou a cotação.'),
      actorName: 'Atendimento MB',
      actionDescription: `Resposta do cliente registrada: Frete ${status.toUpperCase()} (${reason || 'Confirmação direta'}).`,
    });

    if (res.success) {
      if (onNotify) onNotify(`Status do frete do pedido ${managingOrder.code} atualizado para ${status}!`, 'success');
      setManagingOrder(null);
      onRefreshData();
    } else {
      alert(res.error || 'Erro ao atualizar resposta.');
    }
  };

  const handleDirectApproveFreight = (order: Order) => {
    const cost = prompt('Informe o valor do frete negociado (R$):', String(order.shippingInfo?.negotiatedCost || 90));
    if (cost === null) return;
    const numCost = parseFloat(cost) || 0;

    const carrier = prompt('Informe a transportadora contratada:', order.shippingInfo?.carrierName || 'Braspress');
    if (!carrier) return;

    const res = StorageService.updateOrderShipping(order.id, {
      freightStatus: 'aprovado',
      negotiatedCost: numCost,
      negotiatedCarrier: carrier,
      actorName: 'Administrador MB',
      actionDescription: `Frete aprovado diretamente: R$ ${numCost.toFixed(2)} (${carrier}).`,
    });

    if (res.success) {
      if (onNotify) onNotify(`Frete do pedido ${order.code} aprovado com sucesso!`, 'success');
      onRefreshData();
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-linear-to-br from-emerald-600 to-sky-600 flex items-center justify-center text-white shadow-md">
            <Truck className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-heading text-xl font-bold text-slate-900 uppercase tracking-tight">
                Gestão e Acompanhamento de Entregas
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800">
                Logística Operacional
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Monitore endereços, prazos, cotações de transportadoras a combinar, aprovação de orçamentos e códigos de rastreamento.
            </p>
          </div>
        </div>

        {/* Counter cards */}
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-2xl text-center min-w-28">
            <span className="text-[10px] font-bold text-blue-700 uppercase block">Aguardando Frete</span>
            <span className="text-lg font-black text-blue-900 font-heading">
              {orders.filter((o) => o.shippingInfo?.freightStatus === 'aguardando_cotacao').length}
            </span>
          </div>

          <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-center min-w-28">
            <span className="text-[10px] font-bold text-amber-700 uppercase block">Proposta Enviada</span>
            <span className="text-lg font-black text-amber-900 font-heading">
              {orders.filter((o) => o.shippingInfo?.freightStatus === 'proposta_enviada').length}
            </span>
          </div>

          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-center min-w-28">
            <span className="text-[10px] font-bold text-emerald-700 uppercase block">Frete Definido</span>
            <span className="text-lg font-black text-emerald-900 font-heading">
              {orders.filter((o) => o.shippingInfo?.freightStatus === 'aprovado' || o.shippingInfo?.freightStatus === 'definido' || !o.shippingInfo).length}
            </span>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por pedido, cliente, cidade ou rastreio..."
            className="w-full pl-9 pr-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-[#00AEEF]"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={methodFilter}
            onChange={(e) => setMethodFilter(e.target.value as any)}
            className="px-3 py-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
          >
            <option value="all">Todas as Modalidades</option>
            <option value="correios">Correios (SEDEX / PAC)</option>
            <option value="transportadora">Transportadora a Combinar</option>
            <option value="retirada">Retirada no Estabelecimento</option>
          </select>

          <select
            value={freightStatusFilter}
            onChange={(e) => setFreightStatusFilter(e.target.value)}
            className="px-3 py-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
          >
            <option value="all">Todos os Status de Frete</option>
            <option value="aguardando_cotacao">Aguardando Cotação</option>
            <option value="proposta_enviada">Proposta Enviada</option>
            <option value="aprovado">Frete Aprovado</option>
            <option value="recusado">Frete Recusado</option>
            <option value="definido">Frete Definido</option>
          </select>
        </div>
      </div>

      {/* Orders Deliveries Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
              <tr>
                <th className="px-4 py-3">Pedido / Data</th>
                <th className="px-4 py-3">Destinatário & Destino</th>
                <th className="px-4 py-3">Modalidade</th>
                <th className="px-4 py-3">Valor do Frete</th>
                <th className="px-4 py-3">Prazo Estimado</th>
                <th className="px-4 py-3">Status do Frete</th>
                <th className="px-4 py-3">Rastreamento</th>
                <th className="px-4 py-3 text-right">Ações Logísticas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredOrders.map((order) => {
                const info = order.shippingInfo;
                const isWaitingFreight = info?.freightStatus === 'aguardando_cotacao';
                const isProposalSent = info?.freightStatus === 'proposta_enviada';
                const isApproved = info?.freightStatus === 'aprovado' || info?.freightStatus === 'definido' || !info;
                const isRejected = info?.freightStatus === 'recusado';

                return (
                  <tr key={order.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-slate-900">
                      {order.code}
                      <div className="text-[10px] text-slate-400 font-sans">
                        {new Date(order.createdAt).toLocaleDateString('pt-BR')}
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <p className="font-bold text-slate-900">{order.clientName}</p>
                      <p className="text-[11px] text-slate-500">
                        {order.shippingAddress?.city} - {order.shippingAddress?.state} ({formatCep(order.shippingAddress?.zip || '')})
                      </p>
                      <p className="text-[10px] text-slate-400">
                        {order.shippingAddress?.street}, {order.shippingAddress?.number}
                      </p>
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 font-bold text-slate-900">
                        <Truck className="w-3.5 h-3.5 text-slate-400" />
                        <span>{info?.methodName || 'Padrão da Loja'}</span>
                      </div>
                      {info?.carrierName && (
                        <div className="text-[10px] text-slate-500">
                          Transportadora: {info.carrierName}
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      {isWaitingFreight ? (
                        <span className="text-[11px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                          A definir
                        </span>
                      ) : isProposalSent ? (
                        <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded">
                          R$ {(info?.negotiatedCost || 0).toFixed(2)} (Em aprovação)
                        </span>
                      ) : (
                        <span className="font-heading font-bold text-slate-900">
                          {order.shippingCost === 0 ? 'Grátis' : `R$ ${order.shippingCost.toFixed(2)}`}
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3 text-slate-700">
                      {info?.estimatedDeliveryDays ? (
                        `${info.estimatedDeliveryDays} dias úteis`
                      ) : (
                        <span className="text-slate-400">A definir</span>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      {isWaitingFreight && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-blue-100 text-blue-800">
                          Aguardando Cotação
                        </span>
                      )}
                      {isProposalSent && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-100 text-amber-800">
                          Proposta Enviada
                        </span>
                      )}
                      {isApproved && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800">
                          Definido / Aprovado
                        </span>
                      )}
                      {isRejected && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-rose-100 text-rose-800">
                          Proposta Recusada
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      {order.trackingCode ? (
                        <span className="font-mono font-bold text-slate-900 text-[11px] bg-slate-100 px-2 py-0.5 rounded">
                          {order.trackingCode}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[11px]">—</span>
                      )}
                    </td>

                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {info?.methodType === 'transportadora' && (
                          <button
                            type="button"
                            onClick={() => handleOpenFreightNegotiation(order)}
                            className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[11px] font-bold transition-colors cursor-pointer"
                          >
                            {isWaitingFreight ? 'Cotar Frete' : 'Gerenciar Frete'}
                          </button>
                        )}

                        {info?.history && info.history.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setHistoryDetailModalOrder(order)}
                            className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 cursor-pointer"
                            title="Ver histórico de negociações"
                          >
                            <History className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredOrders.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400 text-xs">
                    Nenhum pedido localizado com os filtros selecionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Negociação do Frete da Transportadora */}
      {managingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div>
                <h3 className="font-heading text-base font-bold text-slate-900 uppercase">
                  Gestão do Frete — Pedido {managingOrder.code}
                </h3>
                <p className="text-xs text-slate-500">
                  Cliente: {managingOrder.clientName} ({managingOrder.shippingAddress?.city} - {managingOrder.shippingAddress?.state})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setManagingOrder(null)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSendFreightProposal} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Transportadora Selecionada *
                </label>
                <select
                  value={carrierInput}
                  onChange={(e) => setCarrierInput(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-bold"
                >
                  {deliverySettings.carriersList.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                  <option value="Outra Transportadora">Outra Transportadora</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Valor Cotado do Frete (R$) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={costInput}
                    onChange={(e) => setCostInput(parseFloat(e.target.value) || 0)}
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-bold font-heading text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Prazo Estimado (Dias Úteis) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={deadlineDaysInput}
                    onChange={(e) => setDeadlineDaysInput(parseInt(e.target.value) || 1)}
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Código de Rastreamento (Opcional)
                </label>
                <input
                  type="text"
                  value={trackingCodeInput}
                  onChange={(e) => setTrackingCodeInput(e.target.value)}
                  placeholder="Ex: JAD12345678BR"
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Observações da Proposta ao Cliente
                </label>
                <textarea
                  rows={2}
                  value={proposalNotesInput}
                  onChange={(e) => setProposalNotesInput(e.target.value)}
                  placeholder="Detalhes sobre a carga, seguro ou instruções..."
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-2 border-t border-slate-100 space-y-2">
                <button
                  type="submit"
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" /> Enviar Proposta de Frete para Aprovação do Cliente
                </button>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => handleRegisterCustomerResponse('aprovado')}
                    className="py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> Registrar Aprovação
                  </button>

                  <button
                    type="button"
                    onClick={() => handleRegisterCustomerResponse('recusado')}
                    className="py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <XCircle className="w-3.5 h-3.5" /> Registrar Recusa
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Histórico de Alterações */}
      {historyDetailModalOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h3 className="font-heading text-base font-bold text-slate-900 uppercase">
                Histórico do Frete — {historyDetailModalOrder.code}
              </h3>
              <button
                type="button"
                onClick={() => setHistoryDetailModalOrder(null)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 max-h-96 overflow-y-auto">
              {historyDetailModalOrder.shippingInfo?.history?.map((h) => (
                <div key={h.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
                  <div className="flex items-center justify-between text-slate-500 text-[10px]">
                    <span className="font-bold text-slate-700">{h.actor}</span>
                    <span>{new Date(h.date).toLocaleString('pt-BR')}</span>
                  </div>
                  <p className="text-slate-800">{h.details}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
