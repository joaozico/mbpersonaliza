import React, { useEffect, useState } from 'react';
import { UserProfile } from '../types';
import { StorageService } from '../services/storage';
import { loginWithCredentials, registerCustomer } from '../services/authClient';
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
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
} from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: UserProfile) => void;
  initialPortal?: 'customer' | 'employee';
  initialCustomerMode?: 'login' | 'signup';
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
  initialPortal = 'customer',
  initialCustomerMode = 'login',
}) => {
  const [portalType, setPortalType] = useState<'customer' | 'employee'>(initialPortal);
  const [customerMode, setCustomerMode] = useState<'login' | 'signup'>(initialCustomerMode);

  // Customer form fields
  const [custEmail, setCustEmail] = useState('');
  const [custPassword, setCustPassword] = useState('');
  const [custConfirmPassword, setCustConfirmPassword] = useState('');
  const [custName, setCustName] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [custCompany, setCustCompany] = useState('');
  const [custCpfCnpj, setCustCpfCnpj] = useState('');

  // Employee form fields
  const [empEmail, setEmpEmail] = useState('');
  const [empPassword, setEmpPassword] = useState('');

  const [showCustPassword, setShowCustPassword] = useState(false);
  const [showEmpPassword, setShowEmpPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    if (isOpen) {
      setPortalType(initialPortal);
      setCustomerMode(initialCustomerMode);
      setErrorMessage('');
      setSuccessMessage('');
      setCustPassword('');
      setCustConfirmPassword('');
      setEmpPassword('');
    }
  }, [isOpen, initialPortal, initialCustomerMode]);

  if (!isOpen) return null;

  const hydrateAfterAuth = async (result: {
    user?: UserProfile | null;
    rolePermissions?: any;
    priceVisibility?: any;
  }) => {
    if (!result.user) return;
    StorageService.setCurrentUser(result.user);
    if (result.rolePermissions) {
      StorageService.setPermissionsMatrixMemory(result.rolePermissions);
    }
    if (result.priceVisibility) {
      StorageService.setPriceVisibilityModeMemory(result.priceVisibility);
    }
    await StorageService.initPostgresSync();
    onLoginSuccess(result.user);
    onClose();
  };

  // Handle customer login or registration
  const handleCustomerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (customerMode === 'login') {
      if (!custEmail.trim() || !custPassword) {
        setErrorMessage('Informe seu e-mail cadastrado e senha.');
        return;
      }

      setIsSubmitting(true);
      try {
        const res = await loginWithCredentials({
          email: custEmail.trim(),
          password: custPassword,
          portal: 'customer',
        });

        if (res.success && res.user) {
          setSuccessMessage(`Bem-vindo(a), ${res.user.name}!`);
          await hydrateAfterAuth(res);
        } else {
          setErrorMessage(res.error || res.message || 'E-mail ou senha inválidos.');
        }
      } catch (err: any) {
        setErrorMessage(err?.message || 'Erro de comunicação ao efetuar login.');
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    // Customer registration validation
    if (!custName.trim()) {
      setErrorMessage('Informe seu nome completo ou razão social.');
      return;
    }
    if (!custEmail.trim()) {
      setErrorMessage('Informe um endereço de e-mail válido.');
      return;
    }
    if (!custPhone.trim() || custPhone.replace(/\D/g, '').length < 8) {
      setErrorMessage('Informe um telefone/WhatsApp válido.');
      return;
    }
    if (custPassword.length < 6) {
      setErrorMessage('A senha deve conter pelo menos 6 caracteres.');
      return;
    }
    if (custPassword !== custConfirmPassword) {
      setErrorMessage('A confirmação de senha não confere.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await registerCustomer({
        name: custName.trim(),
        email: custEmail.trim().toLowerCase(),
        phone: custPhone.trim(),
        cpfCnpj: custCpfCnpj.trim() || undefined,
        company: custCompany.trim() || undefined,
        password: custPassword,
        confirmPassword: custConfirmPassword,
      });

      if (res.success && res.user) {
        setSuccessMessage('Conta criada com sucesso! Entrando...');
        await hydrateAfterAuth(res);
      } else {
        setErrorMessage(
          res.error || res.message || 'Não foi possível concluir seu cadastro. Verifique os dados.'
        );
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Erro de comunicação ao concluir cadastro.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle employee login
  const handleEmployeeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!empEmail.trim() || !empPassword) {
      setErrorMessage('Informe seu e-mail corporativo e senha.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await loginWithCredentials({
        email: empEmail.trim(),
        password: empPassword,
        portal: 'staff',
      });

      if (res.success && res.user) {
        setSuccessMessage(`Acesso corporativo validado como ${res.user.role.toUpperCase()}!`);
        await hydrateAfterAuth(res);
      } else {
        setErrorMessage(res.error || res.message || 'Credenciais corporativas inválidas.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Erro de comunicação ao validar acesso corporativo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl border border-slate-200 max-w-lg w-full p-6 sm:p-8 space-y-5 shadow-2xl relative max-h-[90vh] overflow-y-auto">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
          aria-label="Fechar janela de autenticação"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Logo & Header */}
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <Logo size="md" />
          </div>
          <h3 className="font-heading text-xl font-extrabold uppercase text-slate-900">
            {portalType === 'customer'
              ? customerMode === 'login'
                ? 'Entrar na Sua Conta'
                : 'Cadastre-se na Loja'
              : 'Acesso Corporativo'}
          </h3>
          <p className="text-xs text-slate-500">
            {portalType === 'customer'
              ? customerMode === 'login'
                ? 'Acesse sua conta para consultar preços, acompanhar pedidos e orçamentos'
                : 'Crie seu cadastro para visualizar todos os preços e solicitar pedidos'
              : 'Portal exclusivo para colaboradores e administradores da MB Personaliza'}
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
            <form onSubmit={handleCustomerSubmit} className="space-y-3.5">
              {customerMode === 'signup' && (
                <>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Nome Completo ou Razão Social *
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        required
                        value={custName}
                        onChange={(e) => setCustName(e.target.value)}
                        placeholder="Ex: Juliana Mendes ou Empresa Ltda"
                        className="w-full pl-9 pr-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-[#00AEEF]"
                      />
                      <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        CPF ou CNPJ
                      </label>
                      <input
                        type="text"
                        value={custCpfCnpj}
                        onChange={(e) => setCustCpfCnpj(e.target.value)}
                        placeholder="000.000.000-00 ou CNPJ"
                        className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-[#00AEEF]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Telefone / WhatsApp *
                      </label>
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
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Empresa / Nome Fantasia (Opcional)
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={custCompany}
                        onChange={(e) => setCustCompany(e.target.value)}
                        placeholder="Ex: TechSolutions Brasil"
                        className="w-full pl-9 pr-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-[#00AEEF]"
                      />
                      <Building className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    </div>
                  </div>
                </>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">E-mail *</label>
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
                <label className="block text-xs font-bold text-slate-700 mb-1">Senha *</label>
                <div className="relative">
                  <input
                    type={showCustPassword ? 'text' : 'password'}
                    required
                    minLength={customerMode === 'signup' ? 6 : undefined}
                    value={custPassword}
                    onChange={(e) => setCustPassword(e.target.value)}
                    placeholder={customerMode === 'signup' ? 'Mínimo 6 caracteres' : '••••••••'}
                    className="w-full pl-9 pr-9 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-[#00AEEF]"
                  />
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <button
                    type="button"
                    onClick={() => setShowCustPassword((v) => !v)}
                    className="absolute right-2.5 top-2 p-0.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showCustPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {customerMode === 'signup' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Confirmação de Senha *
                  </label>
                  <div className="relative">
                    <input
                      type={showCustPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      value={custConfirmPassword}
                      onChange={(e) => setCustConfirmPassword(e.target.value)}
                      placeholder="Repita sua senha"
                      className="w-full pl-9 pr-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-[#00AEEF]"
                    />
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 bg-[#E6007E] hover:bg-[#c9006e] text-white font-extrabold text-xs uppercase rounded-xl shadow-md transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
              >
                <span>
                  {isSubmitting
                    ? 'Processando...'
                    : customerMode === 'login'
                    ? 'ENTRAR'
                    : 'CONCLUIR CADASTRO'}
                </span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>

            <div className="pt-3 border-t border-slate-100 text-center">
              <button
                type="button"
                onClick={() => {
                  setCustomerMode(customerMode === 'login' ? 'signup' : 'login');
                  setErrorMessage('');
                  setSuccessMessage('');
                }}
                className="text-xs font-extrabold text-[#E6007E] hover:underline cursor-pointer uppercase tracking-wide"
              >
                {customerMode === 'login'
                  ? 'NÃO TEM UMA CONTA? CADASTRE-SE'
                  : 'Já possui uma conta? Entrar'}
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
                <p className="text-xs font-bold text-white uppercase tracking-wider">
                  Acesso Corporativo MB Personaliza
                </p>
                <p className="text-[11px] text-slate-400">
                  Área exclusiva para diretoria, gerência, vendas e estoque
                </p>
              </div>
            </div>

            <form onSubmit={handleEmployeeSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  E-mail Corporativo
                </label>
                <div className="relative">
                  <input
                    type="email"
                    required
                    value={empEmail}
                    onChange={(e) => setEmpEmail(e.target.value)}
                    placeholder="seu.email@mbpersonaliza.com.br"
                    className="w-full pl-9 pr-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-slate-900"
                  />
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Senha Corporativa
                </label>
                <div className="relative">
                  <input
                    type={showEmpPassword ? 'text' : 'password'}
                    required
                    value={empPassword}
                    onChange={(e) => setEmpPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-9 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-slate-900"
                  />
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <button
                    type="button"
                    onClick={() => setShowEmpPassword((v) => !v)}
                    className="absolute right-2.5 top-2 p-0.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showEmpPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs rounded-xl shadow-md transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
              >
                <span>
                  {isSubmitting ? 'Validando Credenciais...' : 'Validar Acesso da Empresa'}
                </span>
                <ArrowRight className="w-4 h-4 text-[#FFDD00]" />
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

