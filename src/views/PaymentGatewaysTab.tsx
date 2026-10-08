import React, { useState } from 'react';
import { PaymentGatewayConfig, PaymentGatewayProvider } from '../types';
import { StorageService } from '../services/storage';
import { PaymentService } from '../services/paymentService';
import {
  CreditCard,
  QrCode,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Zap,
  RefreshCw,
  Save,
  Server,
  Key,
  Sliders,
  DollarSign,
  HelpCircle,
  Lock,
} from 'lucide-react';

export const PaymentGatewaysTab: React.FC = () => {
  const [gateways, setGateways] = useState<PaymentGatewayConfig[]>(() =>
    StorageService.getPaymentGateways()
  );
  const [selectedProvider, setSelectedProvider] = useState<PaymentGatewayProvider>('mercadopago');
  const [showTokens, setShowTokens] = useState<{ [key: string]: boolean }>({});
  const [testResults, setTestResults] = useState<{
    [key: string]: { loading?: boolean; success?: boolean; message?: string; latency?: number };
  }>({});
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);

  const activeGateway =
    gateways.find((g) => g.provider === selectedProvider) || gateways[0];

  const handleToggleShowToken = (key: string) => {
    setShowTokens((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleUpdateActiveGateway = (updates: Partial<PaymentGatewayConfig>) => {
    setGateways((prev) =>
      prev.map((g) => (g.provider === activeGateway.provider ? { ...g, ...updates } : g))
    );
  };

  const handleSaveAll = (e: React.FormEvent) => {
    e.preventDefault();
    StorageService.savePaymentGateways(gateways);
    setSaveSuccessMessage('Configurações dos Gateways salvas com sucesso!');
    setTimeout(() => setSaveSuccessMessage(null), 3000);
  };

  const handleTestConnection = async (provider: PaymentGatewayProvider) => {
    setTestResults((prev) => ({
      ...prev,
      [provider]: { loading: true },
    }));

    try {
      const res = await PaymentService.testGatewayConnection(provider);
      setTestResults((prev) => ({
        ...prev,
        [provider]: {
          loading: false,
          success: res.success,
          message: res.message,
          latency: res.latencyMs,
        },
      }));
    } catch {
      setTestResults((prev) => ({
        ...prev,
        [provider]: {
          loading: false,
          success: false,
          message: 'Falha ao testar conectividade com o gateway.',
        },
      }));
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-[#E6007E] uppercase tracking-wider">
            <CreditCard className="w-4 h-4" />
            <span>Configurações & Integrações</span>
          </div>
          <h2 className="text-2xl font-extrabold uppercase font-heading text-slate-900 mt-1">
            Gateways de Pagamento
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure credenciais de API, chaves públicas, taxas e métodos de recebimento para o
            Mercado Pago e PagBank.
          </p>
        </div>

        <button
          onClick={handleSaveAll}
          className="px-5 py-2.5 bg-[#E6007E] hover:bg-[#c9006e] text-white text-xs font-bold rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer shrink-0"
        >
          <Save className="w-4 h-4" />
          <span>Salvar Alterações</span>
        </button>
      </div>

      {saveSuccessMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{saveSuccessMessage}</span>
        </div>
      )}

      {/* Gateway Selector Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {gateways.map((gw) => {
          const isSelected = gw.provider === selectedProvider;
          return (
            <div
              key={gw.id}
              onClick={() => setSelectedProvider(gw.provider)}
              className={`p-5 rounded-2xl border transition-all cursor-pointer relative overflow-hidden ${
                isSelected
                  ? 'bg-white border-[#00AEEF] ring-2 ring-sky-100 shadow-md'
                  : 'bg-white/80 border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center font-extrabold text-sm ${
                      gw.provider === 'mercadopago'
                        ? 'bg-sky-50 text-[#00AEEF] border border-sky-200'
                        : 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                    }`}
                  >
                    {gw.provider === 'mercadopago' ? 'MP' : 'PB'}
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">{gw.name}</h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                          gw.enabled
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {gw.enabled ? 'Ativo' : 'Desativado'}
                      </span>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                          gw.environment === 'production'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-sky-100 text-sky-800'
                        }`}
                      >
                        {gw.environment === 'production' ? 'Produção' : 'Sandbox (Testes)'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleTestConnection(gw.provider);
                    }}
                    className="p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer text-xs flex items-center gap-1 font-semibold"
                    title="Testar Conexão"
                  >
                    <Zap className="w-3.5 h-3.5 text-amber-500" />
                    <span className="hidden sm:inline">Testar</span>
                  </button>
                </div>
              </div>

              {testResults[gw.provider] && (
                <div
                  className={`mt-3 p-2.5 rounded-lg text-xs flex items-center justify-between ${
                    testResults[gw.provider].loading
                      ? 'bg-slate-50 text-slate-600'
                      : testResults[gw.provider].success
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-rose-50 text-rose-800 border border-rose-200'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {testResults[gw.provider].loading ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-slate-500" />
                    ) : testResults[gw.provider].success ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                    )}
                    <span className="text-[11px] font-semibold">
                      {testResults[gw.provider].loading
                        ? 'Validando conexão com a API...'
                        : testResults[gw.provider].message}
                    </span>
                  </div>
                  {testResults[gw.provider].latency && (
                    <span className="text-[10px] font-mono text-slate-500">
                      {testResults[gw.provider].latency}ms
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Gateway Configuration Form */}
      <form
        onSubmit={handleSaveAll}
        className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Sliders className="w-5 h-5 text-[#00AEEF]" />
              <span>Configurações do {activeGateway.name}</span>
            </h3>
            <p className="text-xs text-slate-500">
              Gerencie credenciais, parcelamento e meios aceitos neste provedor.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={activeGateway.enabled}
                onChange={(e) => handleUpdateActiveGateway({ enabled: e.target.checked })}
                className="w-4 h-4 text-[#E6007E] rounded focus:ring-[#E6007E]"
              />
              <span className="text-xs font-bold text-slate-800">Habilitar Gateway</span>
            </label>

            <select
              value={activeGateway.environment}
              onChange={(e) =>
                handleUpdateActiveGateway({
                  environment: e.target.value as 'sandbox' | 'production',
                })
              }
              className="text-xs font-semibold px-3 py-1.5 bg-slate-100 border border-slate-200 rounded-lg outline-none focus:border-[#00AEEF]"
            >
              <option value="sandbox">Ambiente Sandbox (Testes)</option>
              <option value="production">Ambiente de Produção (Real)</option>
            </select>
          </div>
        </div>

        {/* Credentials Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
            <Key className="w-4 h-4 text-slate-500" />
            <span>Credenciais de API ({activeGateway.name})</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeGateway.provider === 'mercadopago' ? (
              <>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Public Key (Chave Pública)
                  </label>
                  <input
                    type="text"
                    value={activeGateway.mpPublicKey || ''}
                    onChange={(e) => handleUpdateActiveGateway({ mpPublicKey: e.target.value })}
                    placeholder="TEST-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                    className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-[#00AEEF]"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    Utilizada no checkout transparente frontend para tokenização de cartão.
                  </span>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-700">
                      Access Token (Token de Acesso Secreto)
                    </label>
                    <button
                      type="button"
                      onClick={() => handleToggleShowToken('mp_token')}
                      className="text-[10px] text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer"
                    >
                      {showTokens['mp_token'] ? (
                        <>
                          <EyeOff className="w-3 h-3" /> Ocultar
                        </>
                      ) : (
                        <>
                          <Eye className="w-3 h-3" /> Exibir
                        </>
                      )}
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type={showTokens['mp_token'] ? 'text' : 'password'}
                      value={activeGateway.mpAccessToken || ''}
                      onChange={(e) => handleUpdateActiveGateway({ mpAccessToken: e.target.value })}
                      placeholder="TEST-xxxxxxxxxxxxxxxxxxxx-xxxxxx-xxxxxxxxxxxxxxxxxxxxxxxx"
                      className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-[#00AEEF]"
                    />
                    <Lock className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-2.5" />
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    Utilizado no backend para processamento seguro e geração de cobranças.
                  </span>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Webhook Secret (Chave de Validação de Notificações)
                  </label>
                  <input
                    type="text"
                    value={activeGateway.mpWebhookSecret || ''}
                    onChange={(e) =>
                      handleUpdateActiveGateway({ mpWebhookSecret: e.target.value })
                    }
                    placeholder="whsec_xxxxxxxxxxxxxxxxxxxxxx"
                    className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-[#00AEEF]"
                  />
                  <div className="mt-1 text-[11px] text-slate-500 flex items-center gap-1">
                    <span>URL do Webhook no servidor:</span>
                    <code className="bg-slate-100 px-1.5 py-0.5 rounded text-[10px] font-mono text-slate-700">
                      https://seu-dominio.com.br/api/payments/webhook/mercadopago
                    </code>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Public Key PagBank
                  </label>
                  <input
                    type="text"
                    value={activeGateway.pbPublicKey || ''}
                    onChange={(e) => handleUpdateActiveGateway({ pbPublicKey: e.target.value })}
                    placeholder="PUBKEY-PAGBANK-xxxxxxxxx"
                    className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-[#00AEEF]"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    Chave pública de criptografia de cartão do PagBank (SDK Javascript).
                  </span>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-700">
                      Token de Autenticação PagBank (Bearer Token)
                    </label>
                    <button
                      type="button"
                      onClick={() => handleToggleShowToken('pb_token')}
                      className="text-[10px] text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer"
                    >
                      {showTokens['pb_token'] ? (
                        <>
                          <EyeOff className="w-3 h-3" /> Ocultar
                        </>
                      ) : (
                        <>
                          <Eye className="w-3 h-3" /> Exibir
                        </>
                      )}
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type={showTokens['pb_token'] ? 'text' : 'password'}
                      value={activeGateway.pbToken || ''}
                      onChange={(e) => handleUpdateActiveGateway({ pbToken: e.target.value })}
                      placeholder="PB-TOKEN-xxxxxxxxxxxxxxxxxxxxxxxx"
                      className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-[#00AEEF]"
                    />
                    <Lock className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-2.5" />
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    Token emitido no painel de desenvolvedor PagBank.
                  </span>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Webhook Secret PagBank
                  </label>
                  <input
                    type="text"
                    value={activeGateway.pbWebhookSecret || ''}
                    onChange={(e) =>
                      handleUpdateActiveGateway({ pbWebhookSecret: e.target.value })
                    }
                    placeholder="whsec_pb_xxxxxxxxxxxxxxxxxx"
                    className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-[#00AEEF]"
                  />
                  <div className="mt-1 text-[11px] text-slate-500 flex items-center gap-1">
                    <span>URL do Webhook PagBank:</span>
                    <code className="bg-slate-100 px-1.5 py-0.5 rounded text-[10px] font-mono text-slate-700">
                      https://seu-dominio.com.br/api/payments/webhook/pagbank
                    </code>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Accepted Methods */}
        <div className="space-y-4 pt-4 border-t border-slate-100">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Métodos Aceitos por este Gateway</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <label className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-white cursor-pointer transition-all">
              <input
                type="checkbox"
                checked={activeGateway.acceptedMethods.creditCard}
                onChange={(e) =>
                  handleUpdateActiveGateway({
                    acceptedMethods: {
                      ...activeGateway.acceptedMethods,
                      creditCard: e.target.checked,
                    },
                  })
                }
                className="w-4 h-4 text-[#E6007E] rounded"
              />
              <span className="text-xs font-bold text-slate-800">Cartão de Crédito</span>
            </label>

            <label className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-white cursor-pointer transition-all">
              <input
                type="checkbox"
                checked={activeGateway.acceptedMethods.pix}
                onChange={(e) =>
                  handleUpdateActiveGateway({
                    acceptedMethods: {
                      ...activeGateway.acceptedMethods,
                      pix: e.target.checked,
                    },
                  })
                }
                className="w-4 h-4 text-[#00AEEF] rounded"
              />
              <span className="text-xs font-bold text-slate-800">PIX Instantâneo</span>
            </label>

            <label className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-white cursor-pointer transition-all">
              <input
                type="checkbox"
                checked={activeGateway.acceptedMethods.debitCard}
                onChange={(e) =>
                  handleUpdateActiveGateway({
                    acceptedMethods: {
                      ...activeGateway.acceptedMethods,
                      debitCard: e.target.checked,
                    },
                  })
                }
                className="w-4 h-4 text-emerald-600 rounded"
              />
              <span className="text-xs font-bold text-slate-800">Cartão de Débito</span>
            </label>

            <label className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-white cursor-pointer transition-all">
              <input
                type="checkbox"
                checked={activeGateway.acceptedMethods.boleto}
                onChange={(e) =>
                  handleUpdateActiveGateway({
                    acceptedMethods: {
                      ...activeGateway.acceptedMethods,
                      boleto: e.target.checked,
                    },
                  })
                }
                className="w-4 h-4 text-slate-600 rounded"
              />
              <span className="text-xs font-bold text-slate-800">Boleto Bancário</span>
            </label>
          </div>
        </div>

        {/* Installments & Fees */}
        <div className="space-y-4 pt-4 border-t border-slate-100">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
            <DollarSign className="w-4 h-4 text-[#E6007E]" />
            <span>Regras de Parcelamento e Taxas Previstas</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Máximo de Parcelas
              </label>
              <select
                value={activeGateway.maxInstallments}
                onChange={(e) =>
                  handleUpdateActiveGateway({ maxInstallments: Number(e.target.value) })
                }
                className="w-full px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white"
              >
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => (
                  <option key={n} value={n}>
                    Até {n}x {n === 1 ? '(À vista)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Parcelas Sem Juros
              </label>
              <select
                value={activeGateway.interestFreeInstallments}
                onChange={(e) =>
                  handleUpdateActiveGateway({
                    interestFreeInstallments: Number(e.target.value),
                  })
                }
                className="w-full px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white"
              >
                {[1, 2, 3, 4, 5, 6, 10, 12].map((n) => (
                  <option key={n} value={n}>
                    Até {n}x sem juros
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Taxa Cartão de Crédito (%)
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  value={activeGateway.feePercentageCredit}
                  onChange={(e) =>
                    handleUpdateActiveGateway({
                      feePercentageCredit: Number(e.target.value),
                    })
                  }
                  className="w-full pl-3 pr-8 py-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white"
                />
                <span className="text-xs text-slate-500 absolute right-3 top-2 font-bold">%</span>
              </div>
              <span className="text-[10px] text-slate-400 mt-1 block">
                Custo de intermediação descontado no valor líquido.
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Taxa PIX (%)</label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  value={activeGateway.feePercentagePix}
                  onChange={(e) =>
                    handleUpdateActiveGateway({
                      feePercentagePix: Number(e.target.value),
                    })
                  }
                  className="w-full pl-3 pr-8 py-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white"
                />
                <span className="text-xs text-slate-500 absolute right-3 top-2 font-bold">%</span>
              </div>
              <span className="text-[10px] text-slate-400 mt-1 block">
                Geralmente entre 0,89% e 0,99% nas adquirentes.
              </span>
            </div>
          </div>
        </div>

        {/* Sandbox Auto-approval */}
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-800 block">
              Auto-aprovação em Ambiente Sandbox
            </span>
            <span className="text-[11px] text-slate-500 block">
              Em modo de teste, simula aprovação automática imediata das transações para agilidade
              no PDV e checkout.
            </span>
          </div>
          <input
            type="checkbox"
            checked={activeGateway.autoApproveSandbox}
            onChange={(e) =>
              handleUpdateActiveGateway({ autoApproveSandbox: e.target.checked })
            }
            className="w-5 h-5 text-[#00AEEF] rounded focus:ring-[#00AEEF] cursor-pointer"
          />
        </div>

        {/* Footer actions */}
        <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
          <button
            type="button"
            onClick={() => handleTestConnection(activeGateway.provider)}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer"
          >
            <Zap className="w-4 h-4 text-amber-500" />
            <span>Testar Conexão com {activeGateway.name}</span>
          </button>

          <button
            type="submit"
            className="px-6 py-2.5 bg-[#E6007E] hover:bg-[#c9006e] text-white text-xs font-bold rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>Salvar Configurações</span>
          </button>
        </div>
      </form>
    </div>
  );
};
