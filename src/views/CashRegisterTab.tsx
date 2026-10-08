import React, { useState } from 'react';
import { CashRegisterSession } from '../types';
import { StorageService } from '../services/storage';
import {
  Lock,
  Unlock,
  DollarSign,
  TrendingUp,
  Store,
  Clock,
  User,
  ArrowDownLeft,
  ArrowUpRight,
  Receipt,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';

export const CashRegisterTab: React.FC = () => {
  const [sessions, setSessions] = useState<CashRegisterSession[]>(() =>
    StorageService.getCashRegisterSessions()
  );
  const currentSession = StorageService.getCurrentCashRegisterSession();

  return (
    <div className="space-y-6">
      {/* Current Active Register Banner */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase text-[#00AEEF]">Turno em Andamento</span>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                  currentSession?.status === 'aberto'
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-slate-100 text-slate-700'
                }`}
              >
                {currentSession?.status === 'aberto' ? 'Caixa Aberto' : 'Caixa Fechado'}
              </span>
            </div>
            <h3 className="text-xl font-extrabold uppercase font-heading text-slate-900 mt-1">
              {currentSession ? currentSession.registerName : 'Nenhum Caixa Aberto no Momento'}
            </h3>
            {currentSession && (
              <p className="text-xs text-slate-500">
                Operador: <strong>{currentSession.operatorName}</strong> • Aberto em:{' '}
                {new Date(currentSession.openedAt).toLocaleString('pt-BR')}
              </p>
            )}
          </div>
        </div>

        {currentSession ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-slate-50">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Fundo Inicial</span>
              <div className="text-base font-extrabold text-slate-900 mt-0.5">
                R$ {currentSession.initialFund.toFixed(2)}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Vendas Dinheiro</span>
              <div className="text-base font-extrabold text-emerald-700 mt-0.5">
                R$ {currentSession.totalCashSales.toFixed(2)}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Cartão & PIX</span>
              <div className="text-base font-extrabold text-[#00AEEF] mt-0.5">
                R${' '}
                {(
                  currentSession.totalCreditSales +
                  currentSession.totalDebitSales +
                  currentSession.totalPixSales
                ).toFixed(2)}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Dinheiro em Caixa</span>
              <div className="text-base font-extrabold text-slate-900 mt-0.5">
                R$ {currentSession.expectedCash.toFixed(2)}
              </div>
            </div>
          </div>
        ) : (
          <p className="text-xs text-slate-500">
            Abra um turno diretamente na tela do PDV para iniciar registros.
          </p>
        )}
      </div>

      {/* Sessions History */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Store className="w-4 h-4 text-[#E6007E]" />
            <span>Histórico de Sessões e Turnos de Caixa</span>
          </h4>
          <span className="text-xs text-slate-400">{sessions.length} turnos registrados</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 text-[10px] font-extrabold uppercase text-slate-500 border-b border-slate-200">
                <th className="py-3 px-4">Caixa / ID</th>
                <th className="py-3 px-4">Operador</th>
                <th className="py-3 px-4">Abertura</th>
                <th className="py-3 px-4">Fechamento</th>
                <th className="py-3 px-4 text-right">Fundo Inicial</th>
                <th className="py-3 px-4 text-right">Vendas Totais</th>
                <th className="py-3 px-4 text-right">Esperado</th>
                <th className="py-3 px-4 text-right">Diferença</th>
                <th className="py-3 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800">
              {sessions.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 px-4 font-bold text-slate-900">
                    <div>{s.registerName}</div>
                    <span className="text-[10px] text-slate-400 font-mono">Caixa #{s.registerNumber}</span>
                  </td>
                  <td className="py-3 px-4 font-semibold">{s.operatorName}</td>
                  <td className="py-3 px-4 text-slate-500">
                    {new Date(s.openedAt).toLocaleDateString('pt-BR')} às{' '}
                    {new Date(s.openedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="py-3 px-4 text-slate-500">
                    {s.closedAt
                      ? `${new Date(s.closedAt).toLocaleDateString('pt-BR')} às ${new Date(s.closedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
                      : 'Em andamento'}
                  </td>
                  <td className="py-3 px-4 text-right">R$ {s.initialFund.toFixed(2)}</td>
                  <td className="py-3 px-4 text-right font-bold text-slate-900">
                    R$ {s.totalSalesAmount.toFixed(2)} ({s.totalSalesCount} vendas)
                  </td>
                  <td className="py-3 px-4 text-right font-semibold">
                    R$ {s.expectedCash.toFixed(2)}
                  </td>
                  <td className="py-3 px-4 text-right font-bold">
                    {s.cashDifference !== undefined ? (
                      <span className={s.cashDifference >= 0 ? 'text-emerald-700' : 'text-rose-600'}>
                        R$ {s.cashDifference.toFixed(2)}
                      </span>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        s.status === 'aberto'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {s.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
