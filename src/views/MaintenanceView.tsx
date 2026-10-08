import React, { useState, useEffect } from 'react';
import { CompanySettings, UserProfile } from '../types';
import { StorageService } from '../services/storage';
import { Logo } from '../components/Logo';
import { SEOHead } from '../components/SEOHead';
import {
  Wrench,
  Cog,
  Server,
  Sparkles,
  Rocket,
  Clock,
  Phone,
  Mail,
  RefreshCw,
  ShieldCheck,
  CheckCircle2,
  ExternalLink,
  Lock,
  ArrowRight,
} from 'lucide-react';

interface MaintenanceViewProps {
  companySettings: CompanySettings;
  currentUser?: UserProfile;
  onNavigate: (view: string, param?: string) => void;
  onDeactivateMaintenance?: () => void;
}

export const MaintenanceView: React.FC<MaintenanceViewProps> = ({
  companySettings,
  currentUser,
  onNavigate,
  onDeactivateMaintenance,
}) => {
  const [isChecking, setIsChecking] = useState(false);
  const [checkMessage, setCheckMessage] = useState<string | null>(null);

  const maintenance = companySettings.maintenance || {
    enabled: true,
    title: 'Sistema em Manutenção',
    headline: 'Estamos realizando algumas melhorias no sistema.',
    message:
      'Nosso sistema está temporariamente indisponível para manutenção e atualização. Em breve estaremos de volta.',
    returnAt: '',
    showCompanyLogo: true,
    showContacts: true,
    themeStyle: 'brand_gradient',
    iconType: 'tools',
  };

  const isAdmin =
    currentUser &&
    (currentUser.role === 'admin' ||
      currentUser.role === 'gerente' ||
      Boolean(currentUser.customPermissions?.canManageCompanySettings));

  // Render configured icon
  const renderIcon = () => {
    const iconClass = 'w-10 h-10 text-white animate-pulse';
    switch (maintenance.iconType) {
      case 'cog':
        return <Cog className="w-10 h-10 text-white animate-spin" style={{ animationDuration: '8s' }} />;
      case 'server':
        return <Server className={iconClass} />;
      case 'sparkles':
        return <Sparkles className={iconClass} />;
      case 'rocket':
        return <Rocket className={iconClass} />;
      case 'tools':
      default:
        return <Wrench className={iconClass} />;
    }
  };

  // Re-check if maintenance ended
  const handleCheckStatus = async () => {
    setIsChecking(true);
    setCheckMessage(null);

    try {
      // 1. Check local storage
      const localSettings = StorageService.getMaintenanceSettings();
      
      // 2. Query backend API directly without cache
      let remoteEnabled = localSettings.enabled;
      try {
        const res = await fetch('/api/system/maintenance?t=' + Date.now(), {
          cache: 'no-store',
        });
        if (res.ok) {
          const data = await res.json();
          if (data && data.maintenance) {
            remoteEnabled = Boolean(data.maintenance.enabled);
          }
        }
      } catch {
        // Fallback to local
      }

      setIsChecking(false);

      if (!remoteEnabled) {
        setCheckMessage('O sistema já está liberado! Redirecionando...');
        setTimeout(() => {
          onNavigate('home');
        }, 1000);
      } else {
        setCheckMessage('O sistema continua em manutenção. Por favor, tente novamente em alguns instantes.');
        setTimeout(() => setCheckMessage(null), 4500);
      }
    } catch {
      setIsChecking(false);
      setCheckMessage('Ainda em manutenção. Aguarde a conclusão.');
      setTimeout(() => setCheckMessage(null), 3000);
    }
  };

  // WhatsApp click handler
  const handleWhatsAppContact = () => {
    const cleanNumber = (companySettings.whatsapp || '').replace(/\D/g, '');
    if (!cleanNumber) return;
    const msg = encodeURIComponent(
      `Olá! Estou tentando acessar o site da ${companySettings.name} que está em manutenção temporária. Gostaria de atendimento.`
    );
    window.open(`https://wa.me/55${cleanNumber}?text=${msg}`, '_blank');
  };

  // Theme wrapper styling
  const getThemeWrapperClass = () => {
    switch (maintenance.themeStyle) {
      case 'modern_dark':
        return 'bg-slate-950 text-slate-100';
      case 'clean_light':
        return 'bg-gradient-to-b from-slate-50 via-white to-slate-100 text-slate-900';
      case 'brand_gradient':
      default:
        return 'bg-gradient-to-b from-slate-950 via-[#0d1527] to-slate-950 text-slate-100';
    }
  };

  const isLight = maintenance.themeStyle === 'clean_light';

  return (
    <div className={`min-h-screen flex flex-col justify-between relative overflow-hidden ${getThemeWrapperClass()}`}>
      <SEOHead
        title={`${maintenance.title || 'Sistema em Manutenção'} | ${companySettings.name}`}
        description={maintenance.headline || 'Sistema temporariamente indisponível para manutenção.'}
        noIndex={true}
      />

      {/* Background Decorative Ambient Glows */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-96 bg-gradient-to-b from-[#E6007E]/20 via-[#00AEEF]/10 to-transparent blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-80 h-80 bg-[#FFDD00]/10 blur-3xl pointer-events-none" />

      {/* Admin Quick Notification Pill if Admin is viewing */}
      {isAdmin && (
        <div className="relative z-20 bg-amber-500 text-slate-950 text-xs font-bold py-1.5 px-4 text-center flex items-center justify-center gap-3 shadow-md">
          <span>👁️ Você está visualizando a tela de manutenção com privilégios de Administrador.</span>
          <button
            type="button"
            onClick={() => onNavigate('admin')}
            className="underline hover:text-white transition-colors cursor-pointer"
          >
            Voltar ao Painel Admin
          </button>
          {onDeactivateMaintenance && (
            <button
              type="button"
              onClick={onDeactivateMaintenance}
              className="ml-2 px-2.5 py-0.5 rounded bg-slate-950 text-amber-300 hover:text-white transition-colors cursor-pointer text-[11px] font-black"
            >
              Desativar Agora
            </button>
          )}
        </div>
      )}

      {/* Header with Company Logo */}
      <header className="relative z-10 w-full max-w-5xl mx-auto pt-8 px-4 flex items-center justify-center">
        {maintenance.showCompanyLogo !== false ? (
          <div className="flex flex-col items-center cursor-pointer" onClick={() => onNavigate('home')}>
            <Logo
              companySettings={companySettings}
              variant={isLight ? 'navbar' : 'dark'}
              size="lg"
            />
            {companySettings.tagline && (
              <p
                className={`text-[11px] font-medium tracking-wide mt-2 text-center max-w-sm ${
                  isLight ? 'text-slate-500' : 'text-slate-400'
                }`}
              >
                {companySettings.tagline}
              </p>
            )}
          </div>
        ) : (
          <span className="text-sm font-black uppercase tracking-widest text-[#E6007E]">
            {companySettings.name}
          </span>
        )}
      </header>

      {/* Main Center Stage */}
      <main className="relative z-10 flex-1 max-w-2xl mx-auto px-4 py-8 sm:py-12 flex flex-col items-center justify-center text-center">
        {/* Animated Icon Badge */}
        <div className="relative mb-6">
          <div className="w-24 h-24 rounded-3xl bg-gradient-to-tr from-[#E6007E] via-purple-600 to-[#00AEEF] p-0.5 shadow-2xl shadow-[#E6007E]/20 flex items-center justify-center animate-bounce duration-1000">
            <div className="w-full h-full rounded-[22px] bg-slate-900/90 flex items-center justify-center backdrop-blur-xs">
              {renderIcon()}
            </div>
          </div>
          <span className="absolute -bottom-2 -right-2 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-amber-400 text-slate-950 shadow-md flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-950 animate-ping" />
            Manutenção
          </span>
        </div>

        {/* Title */}
        <h1
          className={`text-2xl sm:text-4xl font-black font-heading tracking-tight uppercase leading-tight mb-3 ${
            isLight ? 'text-slate-900' : 'text-white'
          }`}
        >
          {maintenance.title || 'Sistema em Manutenção'}
        </h1>

        {/* Headline */}
        <h2 className="text-base sm:text-lg font-bold text-[#00AEEF] mb-4 max-w-lg leading-relaxed">
          {maintenance.headline || 'Estamos realizando melhorias no sistema.'}
        </h2>

        {/* Detailed Message */}
        <p
          className={`text-xs sm:text-sm leading-relaxed max-w-md mb-6 ${
            isLight ? 'text-slate-600' : 'text-slate-300'
          }`}
        >
          {maintenance.message ||
            'Nosso sistema está temporariamente indisponível para manutenção e atualização. Em breve estaremos de volta.'}
        </p>

        {/* Return Estimate Highlight Pill (only shown if configured) */}
        {maintenance.returnAt && maintenance.returnAt.trim() && (
          <div
            className={`w-full max-w-md mx-auto mb-6 p-4 rounded-2xl border flex items-center justify-center gap-3 shadow-lg ${
              isLight
                ? 'bg-amber-50/80 border-amber-200 text-amber-900'
                : 'bg-amber-950/40 border-amber-600/40 text-amber-200 backdrop-blur-xs'
            }`}
          >
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-500 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5 text-amber-400" />
            </div>
            <div className="text-left min-w-0">
              <div className="text-[10px] font-black uppercase tracking-wider text-amber-500">
                Previsão de Retorno
              </div>
              <div className="text-sm font-black truncate">{maintenance.returnAt}</div>
            </div>
          </div>
        )}

        {/* Closing gratitude */}
        <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[#E6007E] mb-6">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Agradecemos pela sua compreensão e paciência!</span>
        </div>

        {/* Check Status Action Button */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 w-full max-w-md mb-6">
          <button
            type="button"
            disabled={isChecking}
            onClick={handleCheckStatus}
            className={`w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-extrabold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md ${
              isLight
                ? 'bg-slate-900 text-white hover:bg-[#E6007E]'
                : 'bg-white text-slate-900 hover:bg-[#00AEEF] hover:text-white'
            } disabled:opacity-50`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin' : ''}`} />
            <span>{isChecking ? 'Verificando status...' : 'Verificar se já voltou'}</span>
          </button>

          {maintenance.showContacts !== false && companySettings.whatsapp && (
            <button
              type="button"
              onClick={handleWhatsAppContact}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-extrabold bg-emerald-600 hover:bg-emerald-500 text-white transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md"
            >
              <Phone className="w-3.5 h-3.5" />
              <span>Plantão no WhatsApp</span>
            </button>
          )}
        </div>

        {/* Feedback message for check status */}
        {checkMessage && (
          <div className="p-3 rounded-xl bg-slate-800 text-slate-200 text-xs font-bold animate-in fade-in">
            {checkMessage}
          </div>
        )}

        {/* Contact channels card */}
        {maintenance.showContacts !== false && (
          <div
            className={`mt-4 w-full max-w-md p-4 rounded-2xl border text-xs text-left space-y-2 ${
              isLight
                ? 'bg-white border-slate-200 text-slate-700 shadow-xs'
                : 'bg-slate-900/60 border-slate-800 text-slate-300 backdrop-blur-xs'
            }`}
          >
            <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1.5">
              <span>Canais de Atendimento Direto</span>
            </div>

            {companySettings.whatsapp && (
              <div className="flex items-center justify-between">
                <span className="text-slate-400">WhatsApp:</span>
                <button
                  type="button"
                  onClick={handleWhatsAppContact}
                  className="font-bold text-emerald-500 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <span>{companySettings.whatsapp}</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
              </div>
            )}

            {companySettings.salesEmail && (
              <div className="flex items-center justify-between">
                <span className="text-slate-400">E-mail:</span>
                <a
                  href={`mailto:${companySettings.salesEmail}`}
                  className="font-bold text-[#00AEEF] hover:underline truncate max-w-xs"
                >
                  {companySettings.salesEmail}
                </a>
              </div>
            )}

            {companySettings.phone && (
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Telefone:</span>
                <span className="font-bold text-slate-200">{companySettings.phone}</span>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer with Discreet Admin Link */}
      <footer className="relative z-10 w-full max-w-5xl mx-auto pb-6 px-4 pt-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-slate-500 border-t border-slate-800/40">
        <div>
          © {new Date().getFullYear()} {companySettings.name}. Todos os direitos reservados.
        </div>

        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1 text-slate-500">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>Dados & Pedidos Preservados com Segurança</span>
          </span>

          {/* Discreet link for Administrator sign-in */}
          <button
            type="button"
            onClick={() => onNavigate('admin-login')}
            className="hover:text-slate-300 text-slate-500 transition-colors flex items-center gap-1 cursor-pointer"
            title="Acesso exclusivo para administradores da equipe"
          >
            <Lock className="w-3 h-3" />
            <span>Acesso Administrativo</span>
          </button>
        </div>
      </footer>
    </div>
  );
};
