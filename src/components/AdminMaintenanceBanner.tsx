import React, { useState } from 'react';
import { CompanySettings, UserProfile } from '../types';
import { StorageService } from '../services/storage';
import { AlertTriangle, Power, Settings, Eye, CheckCircle2 } from 'lucide-react';

interface AdminMaintenanceBannerProps {
  companySettings: CompanySettings;
  currentUser: UserProfile;
  onNavigate: (view: string, param?: string) => void;
  onRefreshSettings?: () => void;
}

export const AdminMaintenanceBanner: React.FC<AdminMaintenanceBannerProps> = ({
  companySettings,
  currentUser,
  onNavigate,
  onRefreshSettings,
}) => {
  const [isDeactivating, setIsDeactivating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const maintenance = companySettings.maintenance;

  if (!maintenance || !maintenance.enabled) {
    return null;
  }

  const handleDeactivate = () => {
    setIsDeactivating(true);
    const res = StorageService.toggleMaintenanceMode(false, currentUser);
    setIsDeactivating(false);

    if (res.success) {
      if (onRefreshSettings) onRefreshSettings();
    } else {
      setErrorMsg(res.error || 'Erro ao desativar o modo de manutenção.');
      setTimeout(() => setErrorMsg(null), 5000);
    }
  };

  return (
    <aside
      aria-label="Aviso de Modo de Manutenção Ativo"
      className="bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 text-white px-3 py-2 sm:px-4 shadow-lg sticky top-0 z-50 transition-all border-b border-amber-500/50"
    >
      <div className="w-full max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2.5 min-w-0">
        <div className="flex items-center gap-2.5 text-center sm:text-left">
          <span className="p-1 rounded-lg bg-black/20 text-amber-200 shrink-0 animate-pulse">
            <AlertTriangle className="w-4 h-4 text-[#FFDD00]" />
          </span>
          <div className="text-xs">
            <span className="font-extrabold tracking-wide uppercase mr-2 bg-black/25 px-2 py-0.5 rounded-full text-[10px] text-amber-100 border border-white/20">
              Modo de Manutenção Ativo
            </span>
            <span className="font-medium text-amber-50">
              Clientes e visitantes veem a tela de manutenção.{' '}
              {maintenance.returnAt && (
                <span className="underline decoration-amber-300 decoration-2 font-bold">
                  Previsão: {maintenance.returnAt}
                </span>
              )}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => onNavigate('maintenance')}
            className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-black/20 hover:bg-black/35 text-white transition-colors flex items-center gap-1.5 cursor-pointer border border-white/20"
            title="Visualizar a página de manutenção como cliente"
          >
            <Eye className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Ver Tela</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('admin')}
            className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-black/20 hover:bg-black/35 text-white transition-colors flex items-center gap-1.5 cursor-pointer border border-white/20"
            title="Acessar painel de configurações de manutenção"
          >
            <Settings className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Configurar</span>
          </button>

          <button
            type="button"
            disabled={isDeactivating}
            onClick={handleDeactivate}
            className="px-3 py-1 text-[11px] font-black rounded-lg bg-white text-slate-900 hover:bg-emerald-500 hover:text-white shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <Power className="w-3.5 h-3.5 text-emerald-600" />
            <span>Desativar Manutenção</span>
          </button>
        </div>
      </div>
      {errorMsg && (
        <div className="bg-rose-900/90 text-white text-[11px] font-bold px-4 py-1 text-center border-t border-rose-700 animate-fadeIn">
          {errorMsg}
        </div>
      )}
    </aside>
  );
};
