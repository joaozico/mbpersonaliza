import React, { ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home, RotateCcw, ChevronDown, ChevronUp, Bug } from 'lucide-react';
import { StorageService } from '../services/storage';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: any;
  showDetails: boolean;
}

export class ErrorBoundary extends (React.Component as any) {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
    };
  }

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: any) {
    console.error('[MB Personaliza] Erro capturado pelo ErrorBoundary:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = '/';
  };

  private handleReload = () => {
    window.location.reload();
  };

  private handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  private handleRestoreDefaults = () => {
    try {
      StorageService.resetAllData();
    } catch {
      localStorage.clear();
      window.location.href = '/';
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
          <div className="max-w-lg w-full bg-white rounded-2xl p-6 shadow-xl border border-slate-200 text-center space-y-4">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shadow-inner">
              <AlertTriangle className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <h2 className="text-xl font-bold text-slate-900">Ops! Algo inesperado aconteceu</h2>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Ocorreu uma pequena instabilidade na visualização. Você pode tentar novamente, recarregar a página ou restaurar os dados padrão se houver cache corrompido no navegador.
              </p>
            </div>

            {/* Error Message summary */}
            {this.state.error?.message && (
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-left">
                <div className="flex items-center gap-1.5 text-rose-700 text-xs font-bold mb-1">
                  <Bug className="w-3.5 h-3.5" />
                  <span>Mensagem de erro:</span>
                </div>
                <div className="text-[11px] text-rose-800 font-mono break-all line-clamp-3">
                  {this.state.error.message}
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="pt-2 flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={this.handleReload}
                className="flex-1 py-2.5 px-3 bg-slate-900 hover:bg-[#E6007E] text-white text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Recarregar Página</span>
              </button>
              <button
                type="button"
                onClick={this.handleRetry}
                className="flex-1 py-2.5 px-3 bg-[#E6007E] hover:bg-[#c2006a] text-white text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Tentar Novamente</span>
              </button>
              <button
                type="button"
                onClick={this.handleReset}
                className="flex-1 py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Home className="w-3.5 h-3.5" />
                <span>Início</span>
              </button>
            </div>

            {/* Restore defaults button */}
            <div className="pt-1">
              <button
                type="button"
                onClick={this.handleRestoreDefaults}
                className="w-full py-2 px-3 text-[11px] font-semibold text-slate-500 hover:text-rose-600 bg-slate-50 hover:bg-rose-50 rounded-lg border border-slate-200 hover:border-rose-200 transition-colors cursor-pointer"
                title="Limpa caches corrompidos e restabelece a estrutura inicial de dados"
              >
                Restaurar Dados Padrão / Limpar Cache Corrompido
              </button>
            </div>

            {/* Optional Technical Details Collapsible */}
            {this.state.error && (
              <div className="border-t border-slate-100 pt-3 text-left">
                <button
                  type="button"
                  onClick={() => this.setState({ showDetails: !this.state.showDetails })}
                  className="flex items-center justify-between w-full text-[11px] text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <span>Detalhes técnicos do erro</span>
                  {this.state.showDetails ? (
                    <ChevronUp className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5" />
                  )}
                </button>
                {this.state.showDetails && (
                  <pre className="mt-2 p-2.5 bg-slate-900 text-slate-200 rounded-lg text-[10px] font-mono overflow-auto max-h-40 whitespace-pre-wrap break-all leading-tight">
                    {this.state.error.stack || this.state.error.message}
                  </pre>
                )}
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

