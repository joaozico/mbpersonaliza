import React, { useState } from 'react';
import { UserProfile, UserRole } from '../types';
import { StorageService } from '../services/storage';
import { Logo } from './Logo';
import {
  X,
  Mail,
  Lock,
  User,
  Phone,
  Building,
  ArrowRight,
  ShieldCheck,
  Briefcase,
  ShoppingBag,
  Sparkles,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: UserProfile) => void;
  initialPortal?: 'customer' | 'employee';
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
  initialPortal = 'customer',
}) => {
  const [portalType, setPortalType] = useState<'customer' | 'employee'>(initialPortal);
  const [customerMode, setCustomerMode] = useState<'login' | 'signup'>('login');

  // Customer form fields
  const [custEmail, setCustEmail] = useState('');
  const [custPassword, setCustPassword] = useState('');
  const [custName, setCustName] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [custCompany, setCustCompany] = useState('');
  const [custCpfCnpj, setCustCpfCnpj] = useState('');

  // Employee form fields
  const [empEmail, setEmpEmail] = useState('admin@mbpersonaliza.com.br');
  const [empPassword, setEmpPassword] = useState('123');

  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  if (!isOpen) return null;

  // Handle customer login or registration
  const handleCustomerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (customerMode === 'login') {
      const res = StorageService.loginCustomer(custEmail, custPassword);
      if (res.success && res.user) {
        setSuccessMessage(`Bem-vindo(a), ${res.user.name}!`);
        setTimeout(() => {
          onLoginSuccess(res.user!);
          onClose();
        }, 500);
      } else {
        setErrorMessage(res.message || 'Erro ao efetuar login de cliente.');
      }
    } else {
      // Register new customer
      const newCustomer: UserProfile = {
        id: `cust-${Date.now()}`,
        name: custName.trim() || 'Cliente Corporativo',
        email: custEmail.trim().toLowerCase(),
        phone: custPhone.trim() || '(11) 98888-7777',
        company: custCompany.trim(),
        cpfCnpj: custCpfCnpj.trim(),
        role: 'cliente',
        status: 'ativo',
        createdAt: new Date().toISOString(),
        lastLogin: new Date().toISOString(),
      };
      StorageService.saveUser(newCustomer);
      StorageService.setCurrentUser(newCustomer);
      setSuccessMessage('Conta de cliente criada com sucesso!');
      setTimeout(() => {
        onLoginSuccess(newCustomer);
        onClose();
      }, 500);
    }
  };

  // Handle employee login
  const handleEmployeeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    const res = StorageService.loginEmployee(empEmail, empPassword);
    if (res.success && res.user) {
      setSuccessMessage(`Acesso corporativo validado como ${res.user.role.toUpperCase()}!`);
      setTimeout(() => {
        onLoginSuccess(res.user!);
        onClose();
      }, 500);
    } else {
      setErrorMessage(res.message || 'Credenciais corporativas inválidas.');
    }
  };

  // Quick Switch for testing roles
  const handleQuickEmployeeLogin = (role: UserRole) => {
    const user = StorageService.switchRole(role);
    onLoginSuccess(user);
    onClose();
  };

  const handleQuickCustomerDemo = () => {
    const res = StorageService.loginCustomer('juliana.mendes@techsolutions.com.br');
    if (res.user) {
      onLoginSuccess(res.user);
      onClose();
    }
  };

  const handleGoogleLogin = () => {
    const googleUser: UserProfile = {
      id: 'usr-google-demo',
      name: 'Camila Rodrigues (Google)',
      email: 'camila.rodrigues@empresa.com.br',
      phone: '(11) 97777-6666',
      company: 'Tech Inovações Ltda',
      cpfCnpj: '45.123.890/0001-55',
      role: 'cliente',
      status: 'ativo',
      createdAt: new Date().toISOString(),
      lastLogin: new Date().toISOString(),
    };
    StorageService.saveUser(googleUser);
    StorageService.setCurrentUser(googleUser);
    onLoginSuccess(googleUser);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl border border-slate-200 max-w-lg w-full p-6 sm:p-8 space-y-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Logo & Header */}
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <Logo size="md" />
          </div>
          <h3 className="font-heading text-xl font-extrabold uppercase text-slate-900">
            Acesso ao Sistema
          </h3>
          <p className="text-xs text-slate-500">
            Selecione seu perfil de acesso para continuar
          </p>
        </div>

        {/* Portal Switcher Tabs */}
        <div className="grid grid-cols-2 p-1.5 bg-slate-100 rounded-2xl border border-slate-200 gap-1">
          <button
            type="button"
            onClick={() => {
              setPortalType('customer');
              setErrorMessage('');
              setSuccessMessage('');
            }}
            className={`py-2.5 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              portalType === 'customer'
                ? 'bg-white text-[#E6007E] shadow-sm ring-1 ring-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ShoppingBag className="w-4 h-4 text-[#E6007E]" />
            <span>Sou Cliente (B2B/PF)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setPortalType('employee');
              setErrorMessage('');
              setSuccessMessage('');
            }}
            className={`py-2.5 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              portalType === 'employee'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Briefcase className="w-4 h-4 text-[#00AEEF]" />
            <span>Equipe MB / Empresa</span>
          </button>
        </div>

        {/* Feedback Messages */}
        {errorMessage && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}
        {successMessage && (
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* TAB 1: CUSTOMER LOGIN & REGISTER */}
        {portalType === 'customer' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <span className="text-xs font-bold text-slate-700">
                {customerMode === 'login' ? 'Acessar com E-mail' : 'Cadastro de Novo Cliente'}
              </span>
              <button
                type="button"
                onClick={() => setCustomerMode(customerMode === 'login' ? 'signup' : 'login')}
                className="text-xs font-bold text-[#E6007E] hover:underline"
              >
                {customerMode === 'login' ? 'Criar Conta Grátis' : 'Já possuo conta'}
              </button>
            </div>

            {/* Google One-Click mockup for customer */}
            <button
              onClick={handleGoogleLogin}
              type="button"
              className="w-full py-2.5 px-4 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-xs"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Entrar com Conta Google</span>
            </button>

            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-slate-200" />
              <span className="text-[10px] text-slate-400 uppercase font-semibold">ou com formulário</span>
              <div className="flex-1 h-px bg-slate-200" />
            </div>

            <form onSubmit={handleCustomerSubmit} className="space-y-3.5">
              {customerMode === 'signup' && (
                <>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Nome Completo / Contato</label>
                    <div className="relative">
                      <input
                        type="text"
                        required
                        value={custName}
                        onChange={(e) => setCustName(e.target.value)}
                        placeholder="Ex: Juliana Mendes"
                        className="w-full pl-9 pr-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-[#00AEEF]"
                      />
                      <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Empresa / Razão Social</label>
                      <div className="relative">
                        <input
                          type="text"
                          value={custCompany}
                          onChange={(e) => setCustCompany(e.target.value)}
                          placeholder="TechSolutions Ltda"
                          className="w-full pl-9 pr-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-[#00AEEF]"
                        />
                        <Building className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">CNPJ / CPF</label>
                      <input
                        type="text"
                        value={custCpfCnpj}
                        onChange={(e) => setCustCpfCnpj(e.target.value)}
                        placeholder="00.000.000/0001-00"
                        className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-[#00AEEF]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Telefone / WhatsApp</label>
                    <div className="relative">
                      <input
                        type="tel"
                        required
                        value={custPhone}
                        onChange={(e) => setCustPhone(e.target.value)}
                        placeholder="(11) 99888-7766"
                        className="w-full pl-9 pr-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-[#00AEEF]"
                      />
                      <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    </div>
                  </div>
                </>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">E-mail de Acesso</label>
                <div className="relative">
                  <input
                    type="email"
                    required
                    value={custEmail}
                    onChange={(e) => setCustEmail(e.target.value)}
                    placeholder="seu.email@empresa.com.br"
                    className="w-full pl-9 pr-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-[#00AEEF]"
                  />
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Senha</label>
                <div className="relative">
                  <input
                    type="password"
                    required
                    value={custPassword}
                    onChange={(e) => setCustPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-[#00AEEF]"
                  />
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-[#E6007E] hover:bg-[#c9006e] text-white font-extrabold text-xs rounded-xl shadow-md transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>{customerMode === 'login' ? 'Entrar na Minha Conta' : 'Concluir Cadastro'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>

            {/* Quick Demo Customer Button */}
            <div className="p-3 bg-pink-50/60 rounded-xl border border-pink-100 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold text-slate-800">Conta Demo: Juliana Mendes</p>
                <p className="text-[10px] text-slate-500">TechSolutions Brasil Ltda (Histórico e Orçamentos)</p>
              </div>
              <button
                type="button"
                onClick={handleQuickCustomerDemo}
                className="px-3 py-1.5 bg-white hover:bg-pink-100 text-[#E6007E] border border-pink-200 text-xs font-extrabold rounded-lg shadow-xs transition-colors cursor-pointer"
              >
                Acessar Demo
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: EMPLOYEE / COMPANY LOGIN */}
        {portalType === 'employee' && (
          <div className="space-y-4">
            <div className="p-3 rounded-2xl bg-slate-900 text-white flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-6 h-6 text-[#FFDD00]" />
              </div>
              <div>
                <p className="text-xs font-bold text-white uppercase tracking-wider">Acesso Corporativo MB Personaliza</p>
                <p className="text-[11px] text-slate-400">Área exclusiva para diretoria, gerência, vendas e estoque</p>
              </div>
            </div>

            <form onSubmit={handleEmployeeSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">E-mail Corporativo</label>
                <div className="relative">
                  <input
                    type="email"
                    required
                    value={empEmail}
                    onChange={(e) => setEmpEmail(e.target.value)}
                    placeholder="admin@mbpersonaliza.com.br"
                    className="w-full pl-9 pr-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-slate-900"
                  />
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Senha Corporativa</label>
                <div className="relative">
                  <input
                    type="password"
                    required
                    value={empPassword}
                    onChange={(e) => setEmpPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-slate-900"
                  />
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs rounded-xl shadow-md transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>Validar Acesso da Empresa</span>
                <ArrowRight className="w-4 h-4 text-[#FFDD00]" />
              </button>
            </form>

            {/* Quick Employee Profiles Shortcuts */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <p className="text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-[#E6007E]" />
                Atalhos Rápidos de Equipe (Ambiente de Teste)
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleQuickEmployeeLogin('admin')}
                  className="p-2 text-left bg-slate-50 hover:bg-rose-50 border border-slate-200 hover:border-rose-300 rounded-xl transition-all cursor-pointer"
                >
                  <p className="text-[11px] font-bold text-slate-900">Marcos Braga</p>
                  <p className="text-[10px] text-rose-600 font-semibold">Diretor / Admin</p>
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickEmployeeLogin('gerente')}
                  className="p-2 text-left bg-slate-50 hover:bg-purple-50 border border-slate-200 hover:border-purple-300 rounded-xl transition-all cursor-pointer"
                >
                  <p className="text-[11px] font-bold text-slate-900">Renata Vasconcelos</p>
                  <p className="text-[10px] text-purple-600 font-semibold">Gerente Geral</p>
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickEmployeeLogin('vendedor')}
                  className="p-2 text-left bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 rounded-xl transition-all cursor-pointer"
                >
                  <p className="text-[11px] font-bold text-slate-900">Carlos Alberto</p>
                  <p className="text-[10px] text-blue-600 font-semibold">Comercial / Vendas</p>
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickEmployeeLogin('estoquista')}
                  className="p-2 text-left bg-slate-50 hover:bg-amber-50 border border-slate-200 hover:border-amber-300 rounded-xl transition-all cursor-pointer"
                >
                  <p className="text-[11px] font-bold text-slate-900">Diego Ribeiro</p>
                  <p className="text-[10px] text-amber-600 font-semibold">Almoxarifado / Estoque</p>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
