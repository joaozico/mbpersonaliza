import React, { useState } from 'react';
import { UserProfile, UserRole } from '../types';
import { StorageService } from '../services/storage';
import { Logo } from '../components/Logo';
import { SEOHead } from '../components/SEOHead';
import {
  ShieldCheck,
  Lock,
  Mail,
  ArrowRight,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  Building2,
  ArrowLeft,
  KeyRound,
  Shield,
  ShieldAlert,
  Sparkles,
  HelpCircle,
} from 'lucide-react';

interface AdminLoginViewProps {
  onLoginSuccess: (user: UserProfile) => void;
  onNavigate: (view: string, param?: string) => void;
}

export const AdminLoginView: React.FC<AdminLoginViewProps> = ({
  onLoginSuccess,
  onNavigate,
}) => {
  const [email, setEmail] = useState('admin@mbpersonaliza.com.br');
  const [password, setPassword] = useState('123');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [showForgotNotice, setShowForgotNotice] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');
    setIsLoading(true);

    setTimeout(() => {
      const res = StorageService.loginEmployee(email, password);
      setIsLoading(false);

      if (res.success && res.user) {
        setSuccessMessage(`Acesso autorizado! Bem-vindo(a), ${res.user.name}.`);
        setTimeout(() => {
          onLoginSuccess(res.user!);
          onNavigate('admin');
        }, 600);
      } else {
        setErrorMessage(
          res.message || 'Credenciais inválidas. Verifique seu e-mail corporativo e senha.'
        );
      }
    }, 400);
  };

  const handleQuickLogin = (role: UserRole) => {
    setIsLoading(true);
    setTimeout(() => {
      const user = StorageService.switchRole(role);
      setIsLoading(false);
      setSuccessMessage(`Acesso rápido autenticado como ${user.name} (${user.role.toUpperCase()})`);
      setTimeout(() => {
        onLoginSuccess(user);
        onNavigate('admin');
      }, 500);
    }, 300);
  };

  return (
    <div className="min-h-[85vh] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 text-slate-100">
      <SEOHead
        title="Acesso Administrativo & Gestão de Catálogo"
        description="Área restrita para autenticação de administradores da MB Personaliza."
        canonicalPath="/admin/login"
        noIndex={true}
      />
      {/* Back button */}
      <div className="max-w-md w-full mx-auto mb-6 flex items-center justify-between">
        <button
          type="button"
          onClick={() => onNavigate('home')}
          className="inline-flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-800 px-3.5 py-2 rounded-xl border border-slate-700 transition-all cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Voltar para a Loja Virtual</span>
        </button>

        <span className="text-[11px] font-mono text-slate-500 flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          SSL 256-Bit Seguro
        </span>
      </div>

      <div className="max-w-md w-full mx-auto space-y-6">
        {/* Main Login Card */}
        <div className="bg-slate-900/90 backdrop-blur-md rounded-3xl border border-slate-800 p-6 sm:p-8 shadow-2xl space-y-6">
          {/* Logo & Header */}
          <div className="text-center space-y-3">
            <div className="flex justify-center">
              <Logo variant="dark" size="lg" />
            </div>

            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-pink-500/10 border border-[#E6007E]/30 text-[#E6007E] text-[10px] font-extrabold tracking-wider uppercase">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Área Restrita / Painel Administrativo</span>
              </div>
              <h2 className="text-xl font-heading font-black uppercase text-white tracking-tight">
                Acesso ao Sistema de Gestão
              </h2>
              <p className="text-xs text-slate-400">
                Insira suas credenciais corporativas da MB Personaliza para acessar o painel de controle.
              </p>
            </div>
          </div>

          {/* Feedback alerts */}
          {errorMessage && (
            <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-semibold flex items-center gap-2.5 animate-fadeIn">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center gap-2.5 animate-fadeIn">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                E-mail Corporativo
              </label>
              <div className="relative">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@mbpersonaliza.com.br"
                  className="w-full pl-10 pr-4 py-2.5 text-xs bg-slate-800/80 border border-slate-700 text-white placeholder-slate-500 rounded-xl focus:bg-slate-800 focus:outline-none focus:border-[#00AEEF] focus:ring-1 focus:ring-[#00AEEF] transition-all"
                />
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-300">
                  Senha de Acesso
                </label>
                <span className="text-[10px] text-slate-500">Padrão demo: 123</span>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-10 py-2.5 text-xs bg-slate-800/80 border border-slate-700 text-white placeholder-slate-500 rounded-xl focus:bg-slate-800 focus:outline-none focus:border-[#00AEEF] focus:ring-1 focus:ring-[#00AEEF] transition-all font-mono"
                />
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 p-1 text-slate-400 hover:text-white transition-colors cursor-pointer"
                  title={showPassword ? 'Ocultar senha' : 'Exibir senha'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs">
              <label className="flex items-center gap-2 cursor-pointer select-none text-slate-300">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-3.5 h-3.5 rounded text-[#E6007E] focus:ring-0 bg-slate-800 border-slate-700"
                />
                <span>Lembrar neste navegador</span>
              </label>

              <button
                type="button"
                onClick={() => setShowForgotNotice((prev) => !prev)}
                className="text-xs text-[#00AEEF] hover:underline cursor-pointer"
              >
                Esqueceu a senha?
              </button>
            </div>

            {showForgotNotice && (
              <div className="p-3.5 bg-slate-800/90 border border-slate-700 rounded-xl text-xs text-slate-300 space-y-1 animate-fadeIn">
                <p className="font-bold text-white flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-[#FFDD00]" />
                  Recuperação de Senha Corporativa
                </p>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Entre em contato com o suporte interno pelo e-mail{' '}
                  <span className="text-[#00AEEF] font-mono font-bold">contato@mbpersonaliza.com.br</span> ou solicite a redefinição direta a um Administrador no módulo de Usuários & Permissões.
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-4 rounded-xl font-extrabold text-xs text-white bg-gradient-to-r from-[#E6007E] to-[#c9006e] hover:from-[#c9006e] hover:to-[#990054] shadow-lg shadow-pink-900/30 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70"
            >
              {isLoading ? (
                <span className="inline-flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Validando Credenciais...
                </span>
              ) : (
                <>
                  <KeyRound className="w-4 h-4 text-[#FFDD00]" />
                  <span>Acessar Painel de Controle</span>
                  <ArrowRight className="w-4 h-4 ml-1" />
                </>
              )}
            </button>
          </form>

          {/* Quick Access Shortcuts for testing */}
          <div className="pt-4 border-t border-slate-800 space-y-3">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#FFDD00]" />
              <span>Acesso Rápido por Perfil (Ambiente de Teste)</span>
            </p>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleQuickLogin('admin')}
                className="p-2.5 text-left bg-slate-800/60 hover:bg-rose-950/40 border border-slate-700 hover:border-rose-500/50 rounded-xl transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-extrabold text-white group-hover:text-rose-300">
                    Marcos Braga
                  </span>
                  <span className="text-[9px] px-1.5 py-0.2 bg-rose-500/20 text-rose-300 rounded font-bold">
                    Admin
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">Diretoria Executiva (Total)</p>
              </button>

              <button
                type="button"
                onClick={() => handleQuickLogin('gerente')}
                className="p-2.5 text-left bg-slate-800/60 hover:bg-purple-950/40 border border-slate-700 hover:border-purple-500/50 rounded-xl transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-extrabold text-white group-hover:text-purple-300">
                    Renata V.
                  </span>
                  <span className="text-[9px] px-1.5 py-0.2 bg-purple-500/20 text-purple-300 rounded font-bold">
                    Gerente
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">Operações & Produção</p>
              </button>

              <button
                type="button"
                onClick={() => handleQuickLogin('vendedor')}
                className="p-2.5 text-left bg-slate-800/60 hover:bg-blue-950/40 border border-slate-700 hover:border-blue-500/50 rounded-xl transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-extrabold text-white group-hover:text-blue-300">
                    Carlos Alberto
                  </span>
                  <span className="text-[9px] px-1.5 py-0.2 bg-blue-500/20 text-blue-300 rounded font-bold">
                    Vendas
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">Comercial & Orçamentos</p>
              </button>

              <button
                type="button"
                onClick={() => handleQuickLogin('estoquista')}
                className="p-2.5 text-left bg-slate-800/60 hover:bg-amber-950/40 border border-slate-700 hover:border-amber-500/50 rounded-xl transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-extrabold text-white group-hover:text-amber-300">
                    Diego Ribeiro
                  </span>
                  <span className="text-[9px] px-1.5 py-0.2 bg-amber-500/20 text-amber-300 rounded font-bold">
                    Estoque
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">Almoxarifado & Entradas</p>
              </button>
            </div>
          </div>
        </div>

        {/* Security and Support info */}
        <div className="p-4 rounded-2xl bg-slate-800/40 border border-slate-800 text-slate-400 text-xs flex items-start gap-3">
          <Shield className="w-5 h-5 text-[#00AEEF] shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold text-slate-300">Controle de Segurança de Acesso RBAC</p>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              O acesso a este ambiente é restrito e monitorado. Todas as ações em produtos, precificações, orçamentos e pedidos são registradas no log de auditoria.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
