import React, { useState } from 'react';
import { BoletoTitulo } from '../types';
import { StorageService } from '../services/storage';
import {
  FileText,
  Printer,
  Copy,
  CheckCircle2,
  X,
  Calendar,
  DollarSign,
  Building,
  User,
  ShieldCheck,
  AlertTriangle,
  AlertCircle,
  ExternalLink,
  Barcode,
} from 'lucide-react';

interface BoletoModalProps {
  boletos: BoletoTitulo[];
  onClose: () => void;
  onBoletoSettled?: (updatedBoleto: BoletoTitulo) => void;
}

export const BoletoModal: React.FC<BoletoModalProps> = ({
  boletos,
  onClose,
  onBoletoSettled,
}) => {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [copied, setCopied] = useState(false);
  const [settling, setSettling] = useState(false);
  const [settledSuccess, setSettledSuccess] = useState<string | null>(null);
  const [settleError, setSettleError] = useState<string | null>(null);

  const currentBoleto = boletos[selectedIdx] || boletos[0];
  if (!currentBoleto) return null;

  const handleCopyLinha = () => {
    navigator.clipboard.writeText(currentBoleto.linhaDigitavel.replace(/\s+/g, ' '));
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleSimularBaixa = async () => {
    setSettling(true);
    try {
      const res = StorageService.settleBoleto(
        currentBoleto.id,
        currentBoleto.valorOriginal,
        'Simulador de Retorno Bancário (Demonstração)'
      );

      if (res.success && res.boleto) {
        setSettledSuccess(res.message);
        if (onBoletoSettled) {
          onBoletoSettled(res.boleto);
        }
        setTimeout(() => setSettledSuccess(null), 4000);
      } else {
        setSettleError(res.error || res.message || 'Erro ao processar baixa.');
        setTimeout(() => setSettleError(null), 4000);
      }
    } finally {
      setSettling(false);
    }
  };

  const isPago = currentBoleto.status === 'pago';

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4 print:p-0 print:bg-white print:static print:inset-auto">
      <div className="relative w-full max-w-3xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] print:max-h-none print:shadow-none print:border-none print:rounded-none">
        {/* Top Modal Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-[#FFDD00]" />
            <div>
              <h3 className="font-extrabold text-sm uppercase tracking-wide">
                Boleto Bancário Registrado
              </h3>
              <p className="text-[11px] text-slate-400">
                {currentBoleto.tipoCobranca === 'faturado_prazo'
                  ? `Faturamento a Prazo Autorizado (${currentBoleto.condicaoPagamento})`
                  : 'Boleto Bancário — Pagamento à Vista'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Seletor de parcelas se houver mais de uma */}
            {boletos.length > 1 && (
              <div className="flex items-center bg-slate-800 rounded-xl p-1 gap-1">
                {boletos.map((b, idx) => (
                  <button
                    key={b.id}
                    onClick={() => setSelectedIdx(idx)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                      selectedIdx === idx
                        ? 'bg-[#E6007E] text-white shadow-xs'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    Parc. {b.parcelaNumero}/{b.totalParcelas}
                  </button>
                ))}
              </div>
            )}

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Status Banner */}
        {isPago && (
          <div className="bg-emerald-500 text-white px-6 py-2 flex items-center justify-between text-xs font-bold print:hidden">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              <span>
                Boleto Liquidado & Pago em{' '}
                {new Date(currentBoleto.dataLiquidacao || '').toLocaleDateString('pt-BR')} (Baixa
                financeira no Contas a Receber confirmada)
              </span>
            </div>
            <span className="bg-emerald-700/60 px-2 py-0.5 rounded-full text-[10px] uppercase">
              Quitado
            </span>
          </div>
        )}

        {settledSuccess && (
          <div className="bg-emerald-600 text-white px-6 py-2.5 text-xs font-bold flex items-center gap-2 animate-pulse print:hidden">
            <CheckCircle2 className="w-4 h-4" />
            <span>{settledSuccess}</span>
          </div>
        )}

        {settleError && (
          <div className="bg-rose-600 text-white px-6 py-2.5 text-xs font-bold flex items-center gap-2 animate-pulse print:hidden">
            <AlertCircle className="w-4 h-4" />
            <span>{settleError}</span>
          </div>
        )}

        {/* Scrollable Printable Boleto Sheet */}
        <div className="p-6 overflow-y-auto space-y-6 text-slate-900 bg-slate-50 print:bg-white print:p-0">
          {/* Caixa de Cópia da Linha Digitável */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs print:hidden space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold uppercase text-slate-500 tracking-wider">
                Linha Digitável (Código de Barras)
              </span>
              <button
                onClick={handleCopyLinha}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition-all cursor-pointer"
              >
                {copied ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-[#FFDD00]" />
                    <span>Copiar Linha Digitável</span>
                  </>
                )}
              </button>
            </div>
            <div className="p-3 bg-slate-100 rounded-xl font-mono text-xs sm:text-sm font-bold text-slate-800 tracking-wider break-all select-all">
              {currentBoleto.linhaDigitavel}
            </div>
          </div>

          {/* DOCUMENTO OFICIAL DO BOLETO (FORMATO FEBRABAN) */}
          <div className="bg-white border-2 border-slate-900 rounded-lg p-5 font-sans text-xs space-y-4 print:border-slate-900 print:m-0">
            {/* Header do Banco */}
            <div className="flex items-center border-b-2 border-slate-900 pb-2">
              <div className="font-extrabold text-lg text-slate-900 pr-4 border-r-2 border-slate-900 flex items-center gap-2">
                <span className="text-[#E6007E]">MB</span> Personaliza
              </div>
              <div className="font-black text-xl text-slate-900 px-4 border-r-2 border-slate-900">
                {currentBoleto.bancoCodigo}-7
              </div>
              <div className="font-mono font-bold text-xs sm:text-sm text-slate-900 pl-4 tracking-wider flex-1 text-right sm:text-left break-all">
                {currentBoleto.linhaDigitavel}
              </div>
            </div>

            {/* Grid de Informações Financeiras */}
            <div className="grid grid-cols-1 md:grid-cols-4 border border-slate-300 divide-y md:divide-y-0 md:divide-x divide-slate-300">
              <div className="md:col-span-3 p-2.5">
                <div className="text-[10px] text-slate-500 font-bold uppercase">Local de Pagamento</div>
                <div className="font-medium text-slate-800">
                  Pagável em qualquer agência bancária ou internet banking até o vencimento.
                </div>
              </div>
              <div className="p-2.5 bg-slate-50">
                <div className="text-[10px] text-slate-500 font-bold uppercase">Vencimento</div>
                <div className="font-extrabold text-base text-[#E6007E]">
                  {currentBoleto.dataVencimento.split('-').reverse().join('/')}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 border border-slate-300 divide-y md:divide-y-0 md:divide-x divide-slate-300">
              <div className="md:col-span-3 p-2.5">
                <div className="text-[10px] text-slate-500 font-bold uppercase">Beneficiário (Cedente)</div>
                <div className="font-bold text-slate-900">{currentBoleto.beneficiarioNome}</div>
                <div className="text-[10px] text-slate-500">
                  CNPJ: {currentBoleto.beneficiarioCnpj} | {currentBoleto.beneficiarioEndereco}
                </div>
              </div>
              <div className="p-2.5 bg-slate-50">
                <div className="text-[10px] text-slate-500 font-bold uppercase">Agência / Código Beneficiário</div>
                <div className="font-bold text-slate-800">0104 / 35100-8</div>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 border border-slate-300 divide-x divide-slate-300 text-center md:text-left">
              <div className="p-2">
                <div className="text-[9px] text-slate-500 font-bold uppercase">Data Documento</div>
                <div className="font-semibold text-slate-800">
                  {new Date(currentBoleto.dataEmissao).toLocaleDateString('pt-BR')}
                </div>
              </div>
              <div className="p-2">
                <div className="text-[9px] text-slate-500 font-bold uppercase">Nº do Documento</div>
                <div className="font-semibold text-slate-800">{currentBoleto.orderCode}</div>
              </div>
              <div className="p-2">
                <div className="text-[9px] text-slate-500 font-bold uppercase">Espécie Doc.</div>
                <div className="font-semibold text-slate-800">{currentBoleto.especieDoc}</div>
              </div>
              <div className="p-2">
                <div className="text-[9px] text-slate-500 font-bold uppercase">Aceite</div>
                <div className="font-semibold text-slate-800">{currentBoleto.aceite}</div>
              </div>
              <div className="p-2 bg-slate-50 col-span-2 md:col-span-1">
                <div className="text-[9px] text-slate-500 font-bold uppercase">Nosso Número</div>
                <div className="font-extrabold text-slate-900">{currentBoleto.nossoNumero}</div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 border border-slate-300 divide-y md:divide-y-0 md:divide-x divide-slate-300">
              <div className="md:col-span-3 p-3 space-y-1">
                <div className="text-[10px] text-slate-500 font-bold uppercase">
                  Instruções de Responsabilidade do Beneficiário
                </div>
                {currentBoleto.instrucoes.map((inst, i) => (
                  <div key={i} className="text-[11px] text-slate-700 font-medium">
                    • {inst}
                  </div>
                ))}
                {currentBoleto.quoteCode && (
                  <div className="mt-2 text-[10px] text-slate-500 italic">
                    Vínculo Comercial: Proposta / Orçamento #{currentBoleto.quoteCode} (Condição:{' '}
                    {currentBoleto.condicaoPagamento})
                  </div>
                )}
              </div>
              <div className="p-3 bg-slate-50 space-y-2">
                <div>
                  <div className="text-[9px] text-slate-500 font-bold uppercase">(=) Valor do Documento</div>
                  <div className="font-black text-lg text-slate-900">
                    R$ {currentBoleto.valorOriginal.toFixed(2).replace('.', ',')}
                  </div>
                </div>
                <div className="border-t border-slate-200 pt-1">
                  <div className="text-[9px] text-slate-500 font-bold uppercase">(-) Desconto / Abatimentos</div>
                  <div className="text-xs text-slate-600">R$ 0,00</div>
                </div>
                <div className="border-t border-slate-200 pt-1">
                  <div className="text-[9px] text-slate-500 font-bold uppercase">(+) Juros / Multa</div>
                  <div className="text-xs text-slate-600">R$ 0,00</div>
                </div>
              </div>
            </div>

            {/* Pagador (Sacado) */}
            <div className="border border-slate-300 p-3 space-y-1">
              <div className="text-[10px] text-slate-500 font-bold uppercase">Pagador (Sacado)</div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <span className="font-bold text-slate-900 text-xs">
                  {currentBoleto.sacadoNome}
                </span>
                <span className="font-mono text-xs text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                  CPF/CNPJ: {currentBoleto.sacadoCpfCnpj} ({currentBoleto.sacadoTipo})
                </span>
              </div>
              <div className="text-[11px] text-slate-600">{currentBoleto.sacadoEndereco}</div>
            </div>

            {/* Código de Barras Gráfico FEBRABAN */}
            <div className="pt-3 pb-1 flex flex-col items-center justify-center space-y-1 bg-white">
              {/* Representação visual do código de barras Febraban */}
              <div className="h-14 w-full max-w-lg flex items-center justify-between px-2 bg-white">
                {/* Linhas de barras simuladas de alta precisão */}
                <div className="flex items-center w-full h-full gap-[2px]">
                  {Array.from({ length: 65 }).map((_, i) => {
                    const isThick = (i * 7) % 3 === 0;
                    return (
                      <div
                        key={i}
                        className={`h-full bg-slate-950 ${
                          isThick ? 'w-[4px]' : 'w-[1.5px]'
                        }`}
                      />
                    );
                  })}
                </div>
              </div>
              <div className="font-mono text-[10px] text-slate-500 tracking-widest text-center">
                {currentBoleto.codigoBarras}
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 bg-white border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 print:hidden">
          <div className="flex items-center gap-2">
            {!isPago && (
              <button
                type="button"
                onClick={handleSimularBaixa}
                disabled={settling}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50"
                title="Simula o arquivo de retorno bancário ou webhook de pagamento confirmando a liquidação deste título"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-200" />
                <span>{settling ? 'Processando baixa...' : 'Simular Baixa Bancária'}</span>
              </button>
            )}

            {isPago && (
              <span className="flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200">
                <CheckCircle2 className="w-4 h-4" />
                Título Baixado no Contas a Receber
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-all cursor-pointer"
            >
              <Printer className="w-4 h-4 text-slate-600" />
              <span>Imprimir Boleto / Salvar PDF</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all cursor-pointer"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
