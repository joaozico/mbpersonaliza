import React, { useState, useMemo } from 'react';
import { PDVSale, CompanySettings, UserProfile } from '../types';
import { StorageService } from '../services/storage';
import {
  History,
  X,
  Search,
  Printer,
  Calendar,
  DollarSign,
  User,
  ShoppingBag,
  CreditCard,
  QrCode,
  CheckCircle2,
  AlertCircle,
  FileText,
} from 'lucide-react';

interface PDVSalesHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSaleForReprint: (sale: PDVSale) => void;
  currentUser: UserProfile;
}

export const PDVSalesHistoryModal: React.FC<PDVSalesHistoryModalProps> = ({
  isOpen,
  onClose,
  onSelectSaleForReprint,
  currentUser,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPeriod, setFilterPeriod] = useState<'today' | 'all'>('today');

  const allSales = useMemo(() => {
    if (!isOpen) return [];
    return StorageService.getPDVSales();
  }, [isOpen]);

  const filteredSales = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    return allSales.filter((sale) => {
      // Period filter
      if (filterPeriod === 'today') {
        const saleDateStr = (sale.createdAt || '').slice(0, 10);
        if (saleDateStr !== todayStr) return false;
      }

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchCode = sale.code.toLowerCase().includes(q);
        const matchCustomer = (sale.customerName || '').toLowerCase().includes(q);
        const matchDoc = (sale.customerCpfCnpj || '').replace(/\D/g, '').includes(q.replace(/\D/g, ''));
        const matchItem = sale.items.some((it) => it.productName.toLowerCase().includes(q));
        return matchCode || matchCustomer || matchDoc || matchItem;
      }

      return true;
    });
  }, [allSales, filterPeriod, searchQuery]);

  const totalSalesAmount = useMemo(() => {
    return filteredSales
      .filter((s) => s.status !== 'cancelada')
      .reduce((sum, s) => sum + s.total, 0);
  }, [filteredSales]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 no-print overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-4xl w-full border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 flex flex-col max-h-[90vh] my-auto">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#E6007E] flex items-center justify-center text-white shadow-md">
              <History className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-extrabold uppercase text-[#00AEEF] tracking-wider">
                Consultas & 2ª Via do Cupom
              </span>
              <h3 className="text-base sm:text-lg font-black uppercase font-heading flex items-center gap-2">
                <span>Histórico de Vendas do PDV</span>
                <span className="text-xs font-mono font-normal text-slate-400">
                  ({filteredSales.length} {filteredSales.length === 1 ? 'venda' : 'vendas'})
                </span>
              </h3>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            title="Fechar (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter and Search Bar */}
        <div className="p-3 sm:p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por código (PDV-...), cliente, CPF/CNPJ ou produto..."
              className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-xl outline-none focus:border-[#00AEEF] focus:ring-2 focus:ring-sky-100"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
              >
                ✕
              </button>
            )}
          </div>

          {/* Period selector */}
          <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-slate-200 shrink-0">
            <button
              type="button"
              onClick={() => setFilterPeriod('today')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                filterPeriod === 'today'
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Vendas de Hoje
            </button>
            <button
              type="button"
              onClick={() => setFilterPeriod('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                filterPeriod === 'all'
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Todas as Vendas ({allSales.length})
            </button>
          </div>

          {/* Summary badge */}
          <div className="px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 shrink-0">
            <span className="text-[10px] font-extrabold uppercase text-emerald-700">Total Faturado:</span>
            <span className="text-xs font-black text-emerald-950 font-heading">
              R$ {totalSalesAmount.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Sales List Container with Scrollbar */}
        <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-4 divide-y divide-slate-100 pdv-scroll">
          {filteredSales.length === 0 ? (
            <div className="py-16 text-center text-slate-400 space-y-2">
              <ShoppingBag className="w-12 h-12 mx-auto stroke-1 text-slate-300" />
              <p className="text-sm font-bold text-slate-600">Nenhuma venda encontrada</p>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                {searchQuery
                  ? 'Não há vendas que correspondam aos filtros de busca informados.'
                  : filterPeriod === 'today'
                  ? 'Nenhuma venda foi realizada hoje ainda neste caixa.'
                  : 'O histórico de vendas do PDV está vazio.'}
              </p>
            </div>
          ) : (
            filteredSales.map((sale) => {
              const saleDate = new Date(sale.createdAt || Date.now());
              const isToday =
                saleDate.toISOString().slice(0, 10) === new Date().toISOString().slice(0, 10);
              const itemsCount = sale.items.reduce((s, it) => s + it.quantity, 0);

              return (
                <div
                  key={sale.id}
                  className="py-3 sm:py-3.5 px-2 hover:bg-slate-50/80 rounded-2xl transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-black text-xs text-slate-900 bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200">
                        {sale.code}
                      </span>
                      <span className="text-xs font-bold text-slate-700 truncate">
                        {sale.customerName || 'Consumidor Final'}
                      </span>
                      {sale.customerCpfCnpj && (
                        <span className="text-[10px] text-slate-400 font-mono">
                          • {sale.customerCpfCnpj}
                        </span>
                      )}
                      {sale.status === 'cancelada' && (
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-rose-100 text-rose-700 border border-rose-200">
                          Cancelada
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-1 flex-wrap">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        <span>
                          {saleDate.toLocaleDateString('pt-BR')}{' '}
                          {saleDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </span>
                      <span>•</span>
                      <span>Caixa {sale.cashRegisterNumber}</span>
                      <span>•</span>
                      <span>Operador: {sale.operatorName}</span>
                      <span>•</span>
                      <span className="text-slate-700 font-medium">
                        {itemsCount} {itemsCount === 1 ? 'item' : 'itens'} (
                        {sale.items.slice(0, 2).map((it) => it.productName.split(' ')[0]).join(', ')}
                        {sale.items.length > 2 ? '...' : ''})
                      </span>
                    </div>

                    {/* Payment methods chips */}
                    <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                      {sale.payments.map((p, pIdx) => (
                        <span
                          key={pIdx}
                          className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-sky-50 text-sky-800 border border-sky-100 flex items-center gap-1"
                        >
                          <CreditCard className="w-2.5 h-2.5 text-sky-500" />
                          <span>
                            {p.method.replace('_', ' ')}: R$ {p.amount.toFixed(2)}
                          </span>
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Total & Action */}
                  <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                    <div className="text-right">
                      <div className="text-xs text-slate-400">Total Venda</div>
                      <div className="text-base font-black text-slate-900 font-heading">
                        R$ {sale.total.toFixed(2)}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => onSelectSaleForReprint(sale)}
                      className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-[#00AEEF] text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                      title="Reimprimir Cupom Fiscal Simplificado ou Recibo desta venda"
                    >
                      <Printer className="w-3.5 h-3.5 text-[#FFDD00]" />
                      <span>Reimprimir Cupom</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-3 sm:p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <span>
            Dica: você pode reimprimir qualquer cupom a qualquer momento selecionando a venda acima.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl cursor-pointer"
          >
            Fechar (Esc)
          </button>
        </div>
      </div>
    </div>
  );
};
