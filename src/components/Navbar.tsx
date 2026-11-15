import React, { useState, useEffect, useRef } from 'react';
import { Logo } from './Logo';
import { RoleSwitcher } from './RoleSwitcher';
import { UserProfile, Product, Category, CompanySettings } from '../types';
import { StorageService } from '../services/storage';
import { WhatsAppContactModal } from './WhatsAppContactModal';
import {
  Search,
  ShoppingCart,
  FileText,
  User,
  LayoutDashboard,
  Menu,
  X,
  Phone,
  MessageSquare,
  Printer,
  ChevronRight,
  Sparkles,
  ShieldCheck,
  Shield,
  KeyRound,
  LogOut,
  Store,
  DollarSign,
} from 'lucide-react';

interface NavbarProps {
  currentView: string;
  onNavigate: (view: string, param?: string) => void;
  currentUser: UserProfile;
  onUserChange: (user: UserProfile) => void;
  cartCount: number;
  onOpenCart: () => void;
  products: Product[];
  categories: Category[];
  onOpenGlobalSearch?: (initialQuery?: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentView,
  onNavigate,
  currentUser,
  onUserChange,
  cartCount,
  onOpenCart,
  products,
  categories,
  onOpenGlobalSearch,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const [companySettings, setCompanySettings] = useState<CompanySettings>(() => StorageService.getCompanySettings());
  const [layoutSettings, setLayoutSettings] = useState(() => StorageService.getLayoutSettings());

  const activeWhatsAppContacts = (companySettings.whatsappContacts || []).filter(
    (c) => c.active !== false
  );
  const hasMultipleWhatsApp = activeWhatsAppContacts.length > 1;

  useEffect(() => {
    const handleUpdate = () => {
      setCompanySettings(StorageService.getCompanySettings());
      setLayoutSettings(StorageService.getLayoutSettings());
    };
    window.addEventListener('mb_storage_updated', handleUpdate);
    window.addEventListener('mb_company_settings_updated', handleUpdate);
    window.addEventListener('mb_layout_updated', handleUpdate);
    return () => {
      window.removeEventListener('mb_storage_updated', handleUpdate);
      window.removeEventListener('mb_company_settings_updated', handleUpdate);
      window.removeEventListener('mb_layout_updated', handleUpdate);
    };
  }, []);

  const cleanWhatsapp = (companySettings.whatsapp || '(11) 98765-4321').replace(/\D/g, '');

  const isAdminRole = ['admin', 'gerente', 'vendedor', 'estoquista'].includes(currentUser.role);
  const canViewFinancial = StorageService.hasUserPermission(currentUser, 'canViewFinancialModule');

  // Search autocomplete
  const filteredProducts = searchQuery.trim().length > 1
    ? products.filter(
        (p) =>
          p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.description.toLowerCase().includes(searchQuery.toLowerCase())
      ).slice(0, 5)
    : [];

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsSearchOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectProduct = (productId: string) => {
    onNavigate('product-detail', productId);
    setSearchQuery('');
    setIsSearchOpen(false);
  };

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-xs no-print">
      {/* Top Banner */}
      {layoutSettings?.header?.showTopBanner && (
        <div
          className="text-xs py-1.5 px-4 transition-colors"
          style={{
            backgroundColor: layoutSettings?.colors?.topBannerBg || '#0F172A',
            color: layoutSettings?.colors?.topBannerText || '#FFFFFF',
          }}
        >
          <div className="w-full max-w-[1440px] mx-auto flex items-center justify-between gap-2 min-w-0">
            <div className="flex items-center gap-4 shrink min-w-0">
              <span className="flex items-center gap-1.5 text-xs font-medium truncate">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                <span className="truncate">{layoutSettings?.header?.topBannerText || 'MB Personaliza • Brindes Corporativos'}</span>
              </span>
            </div>

            <div className="flex items-center gap-2 sm:gap-4 ml-auto shrink-0">
              <button
                type="button"
                onClick={() => {
                  if (hasMultipleWhatsApp) {
                    setIsWhatsAppModalOpen(true);
                  } else {
                    window.open(
                      `https://wa.me/55${cleanWhatsapp}?text=${encodeURIComponent(
                        'Olá, gostaria de solicitar um orçamento de brindes personalizados na MB Personaliza.'
                      )}`,
                      '_blank',
                      'noopener,noreferrer'
                    );
                  }
                }}
                className="flex items-center gap-1.5 text-emerald-400 hover:text-emerald-300 font-semibold transition-colors text-xs cursor-pointer group"
                title={hasMultipleWhatsApp ? `Ver todos os ${activeWhatsAppContacts.length} canais de WhatsApp` : "Falar no WhatsApp"}
              >
                <MessageSquare className="w-3.5 h-3.5 group-hover:scale-110 transition-transform text-[#25D366]" />
                <span className="hidden sm:inline">WhatsApp:</span> {companySettings.whatsapp || '(11) 98765-4321'}
                {hasMultipleWhatsApp && (
                  <span className="px-1.5 py-0.2 rounded-full text-[9px] font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    +{activeWhatsAppContacts.length - 1} {activeWhatsAppContacts.length - 1 === 1 ? 'canal' : 'canais'}
                  </span>
                )}
              </button>

              {isAdminRole ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onNavigate('admin')}
                  className="flex items-center gap-1 text-[#FFDD00] hover:text-amber-300 text-xs font-bold transition-colors cursor-pointer"
                  title="Acessar Painel Administrativo"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Painel Admin</span>
                </button>
                <button
                  onClick={() => {
                    const client = StorageService.switchRole('cliente');
                    onUserChange(client);
                    onNavigate('home');
                  }}
                  className="text-[10px] text-slate-400 hover:text-rose-400 font-semibold transition-colors cursor-pointer"
                  title="Sair do modo administrativo"
                >
                  (Sair)
                </button>
              </div>
            ) : (
              <button
                onClick={() => onNavigate('admin-login')}
                className="flex items-center gap-1 text-slate-300 hover:text-[#FFDD00] text-xs font-semibold transition-colors cursor-pointer"
                title="Acesso Restrito para Colaboradores e Administradores"
              >
                <Shield className="w-3.5 h-3.5 text-[#00AEEF]" />
                <span className="hidden sm:inline">Acesso Admin</span>
              </button>
            )}

            <RoleSwitcher currentUser={currentUser} onUserChange={onUserChange} />
          </div>
        </div>
      </div>
    )}

      {/* Main Navbar */}
      <div className="w-full max-w-[1440px] mx-auto px-3 sm:px-5 2xl:px-6 py-2.5 sm:py-3">
        <div className="flex items-center justify-between gap-2 sm:gap-3 2xl:gap-4 min-w-0">
          {/* Logo */}
          <button
            onClick={() => onNavigate('home')}
            className="focus:outline-none text-left shrink-0 cursor-pointer"
            id="nav-logo-btn"
          >
            <Logo size="md" showSubtitle={false} />
          </button>

          {/* Global Search Command Bar Trigger (Desktop & Large Screens) */}
          <button
            type="button"
            onClick={() => onOpenGlobalSearch?.()}
            className="hidden lg:flex items-center justify-between lg:w-60 xl:w-auto xl:flex-1 xl:min-w-[120px] xl:max-w-[165px] 2xl:max-w-[210px] px-2.5 py-1.5 text-xs bg-slate-100 hover:bg-slate-200/70 text-slate-500 hover:text-slate-800 rounded-xl border border-slate-200/80 transition-all cursor-pointer group shadow-2xs"
            title="Abrir Pesquisa Global (Ctrl + K)"
            id="nav-global-search-btn"
          >
            <span className="flex items-center gap-1.5 min-w-0 truncate">
              <Search className="w-3.5 h-3.5 text-slate-400 group-hover:text-[#00AEEF] transition-colors shrink-0" />
              <span className="truncate xl:hidden 2xl:inline">Pesquisar produtos, páginas...</span>
              <span className="truncate hidden xl:inline 2xl:hidden">Pesquisar...</span>
            </span>
            <kbd className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono font-bold bg-white text-slate-400 rounded-md border border-slate-200 shadow-2xs group-hover:border-slate-300 shrink-0 ml-1.5">
              <span className="text-[9px]">⌘</span>K
            </kbd>
          </button>

          {/* Desktop Nav Links (Visible on >= 1280px without shrinking or overlapping CTAs) */}
          <nav className="hidden xl:flex items-center gap-0.5 2xl:gap-1.5 text-[12.5px] 2xl:text-sm font-semibold text-slate-700 shrink-0">
            <button
              onClick={() => onNavigate('home')}
              className={`px-2 py-1.5 2xl:px-2.5 rounded-lg hover:text-[#E6007E] hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                currentView === 'home' ? 'text-[#E6007E] font-bold bg-pink-50/50' : ''
              }`}
            >
              Início
            </button>
            <button
              onClick={() => onNavigate('catalog')}
              className={`px-2 py-1.5 2xl:px-2.5 rounded-lg hover:text-[#E6007E] hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                currentView === 'catalog' ? 'text-[#E6007E] font-bold bg-pink-50/50' : ''
              }`}
            >
              Catálogo
            </button>
            {layoutSettings?.header?.showCatalogPdfLink && (
              <button
                onClick={() => onNavigate('digital-catalog')}
                className={`flex items-center gap-1.5 px-2 py-1 2xl:px-2.5 rounded-md text-xs font-semibold bg-sky-50 text-[#00AEEF] hover:bg-sky-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  currentView === 'digital-catalog' ? 'ring-1 ring-[#00AEEF]' : ''
                }`}
                title="Catálogo PDF / Impressão pronto para clientes"
              >
                <Printer className="w-3.5 h-3.5 shrink-0" />
                <span>Catálogo PDF</span>
              </button>
            )}
            <button
              onClick={() => onNavigate('quote')}
              className={`px-2 py-1.5 2xl:px-2.5 rounded-lg hover:text-[#E6007E] hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                currentView === 'quote' ? 'text-[#E6007E] font-bold bg-pink-50/50' : ''
              }`}
            >
              Solicitar Orçamento
            </button>
            {layoutSettings?.header?.showAboutLink && (
              <button
                onClick={() => onNavigate('about')}
                className={`px-2 py-1.5 2xl:px-2.5 rounded-lg hover:text-[#E6007E] hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  currentView === 'about' ? 'text-[#E6007E] font-bold bg-pink-50/50' : ''
                }`}
              >
                Sobre
              </button>
            )}
            <button
              onClick={() => onNavigate('contact')}
              className={`px-2 py-1.5 2xl:px-2.5 rounded-lg hover:text-[#E6007E] hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                currentView === 'contact' ? 'text-[#E6007E] font-bold bg-pink-50/50' : ''
              }`}
            >
              Contato
            </button>
          </nav>

          {/* Action CTAs (Always visible and never clipped) */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Quick PDV Button for Employees */}
            {isAdminRole && (
              <button
                onClick={() => onNavigate('pdv')}
                className={`hidden sm:flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-xs shrink-0 whitespace-nowrap cursor-pointer ${
                  currentView === 'pdv'
                    ? 'bg-[#E6007E] text-white ring-2 ring-pink-300'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                }`}
                id="btn-nav-pdv"
                title="Abrir PDV (Ponto de Venda Loja Física)"
              >
                <Store className="w-3.5 h-3.5 text-white shrink-0" />
                <span>PDV Caixa</span>
              </button>
            )}

            {/* Módulo Financeiro Restrito (Visível apenas se possuir permissão canViewFinancialModule) */}
            {canViewFinancial && (
              <button
                onClick={() => onNavigate('financial')}
                className={`hidden md:flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-xs shrink-0 whitespace-nowrap cursor-pointer ${
                  currentView === 'financial' || currentView === 'financeiro'
                    ? 'bg-gradient-to-r from-[#E6007E] to-rose-600 text-white shadow-md ring-2 ring-pink-300'
                    : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200/90'
                }`}
                id="btn-nav-financial"
                title="Módulo Financeiro (Acesso Restrito)"
              >
                <DollarSign className={`w-3.5 h-3.5 ${currentView === 'financial' || currentView === 'financeiro' ? 'text-[#FFDD00]' : 'text-rose-600'} shrink-0`} />
                <span className="hidden xl:inline">Financeiro</span>
                <span className="hidden 2xl:inline-block px-1.5 py-0.2 rounded text-[9px] font-black uppercase bg-rose-500 text-white tracking-wider">
                  Restrito
                </span>
              </button>
            )}

            {/* Admin or Customer Portal button */}
            {isAdminRole ? (
              <button
                onClick={() => onNavigate('admin')}
                className={`flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-xs shrink-0 whitespace-nowrap cursor-pointer ${
                  currentView === 'admin'
                    ? 'bg-slate-900 text-white ring-2 ring-[#FFDD00]'
                    : 'bg-slate-900 text-white hover:bg-slate-800'
                }`}
                id="btn-nav-admin"
                title="Acessar Painel de Gestão"
              >
                <LayoutDashboard className="w-3.5 h-3.5 text-[#FFDD00] shrink-0" />
                <span className="hidden lg:inline">Painel Gestão</span>
                <span className="lg:hidden">Painel</span>
              </button>
            ) : (
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => onNavigate('customer-portal')}
                  className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold border transition-all shrink-0 whitespace-nowrap cursor-pointer ${
                    currentView === 'customer-portal'
                      ? 'bg-pink-50 border-[#E6007E] text-[#E6007E]'
                      : 'border-slate-300 text-slate-700 hover:bg-slate-50'
                  }`}
                  id="btn-nav-customer-portal"
                  title="Minha Conta"
                >
                  <User className="w-4 h-4 text-slate-500 shrink-0" />
                  <span className="hidden sm:inline">Minha Conta</span>
                </button>

                <button
                  onClick={() => onNavigate('admin-login')}
                  className="hidden 2xl:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors border border-transparent hover:border-slate-200 shrink-0 whitespace-nowrap cursor-pointer"
                  title="Acesso Administrativo MB"
                  id="btn-nav-admin-login-quick"
                >
                  <KeyRound className="w-3.5 h-3.5 text-[#00AEEF] shrink-0" />
                  <span>Admin</span>
                </button>
              </div>
            )}

            {/* Global Search Icon Button (Mobile & Tablet Screens < 1024px) */}
            <button
              type="button"
              onClick={() => onOpenGlobalSearch?.()}
              className="lg:hidden p-2 rounded-lg text-slate-700 hover:bg-slate-100 transition-colors focus:outline-none cursor-pointer shrink-0"
              title="Pesquisa Global (Ctrl+K)"
              aria-label="Abrir Pesquisa Global"
              id="btn-mobile-global-search"
            >
              <Search className="w-5 h-5 shrink-0" />
            </button>

            {/* Shopping Cart Button */}
            <button
              onClick={onOpenCart}
              className="relative p-2 rounded-lg text-slate-700 hover:bg-slate-100 transition-colors focus:outline-none cursor-pointer shrink-0"
              id="btn-open-cart"
              aria-label="Carrinho de Compras"
              title="Abrir Carrinho"
            >
              <ShoppingCart className="w-5 h-5 shrink-0" />
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-5 h-5 px-1 rounded-full bg-[#E6007E] text-white text-[11px] font-bold shadow-xs">
                  {cartCount}
                </span>
              )}
            </button>

            {/* Mobile / Tablet / Laptop Hamburger Toggle */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="xl:hidden p-2 text-slate-700 hover:bg-slate-100 rounded-lg focus:outline-none shrink-0 cursor-pointer"
              id="btn-mobile-menu"
              aria-label="Menu de Navegação"
            >
              {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile & Tablet & Laptop Drawer Menu */}
      {isMobileMenuOpen && (
        <div className="xl:hidden bg-white border-b border-slate-200 px-4 py-4 space-y-3 animate-in slide-in-from-top-2 max-h-[calc(100vh-4rem)] overflow-y-auto shadow-xl">
          <button
            type="button"
            onClick={() => {
              setIsMobileMenuOpen(false);
              onOpenGlobalSearch?.();
            }}
            className="w-full flex items-center justify-between px-3.5 py-2.5 text-xs bg-slate-100 text-slate-600 rounded-xl border border-slate-200 hover:bg-slate-200/70 transition-colors cursor-pointer mb-2"
          >
            <span className="flex items-center gap-2">
              <Search className="w-4 h-4 text-slate-400" />
              <span>Pesquisa global (produtos, pedidos, páginas)...</span>
            </span>
            <span className="px-1.5 py-0.5 rounded bg-white text-[10px] font-bold text-slate-500 border border-slate-200 shadow-2xs">
              Buscar
            </span>
          </button>

          <div className="flex flex-col space-y-2 text-sm font-semibold text-slate-800">
            {/* PDV Quick Action for Employees in Mobile Drawer */}
            {isAdminRole && (
              <button
                onClick={() => {
                  onNavigate('pdv');
                  setIsMobileMenuOpen(false);
                }}
                className="text-left py-2.5 px-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 text-white font-bold flex items-center justify-between shadow-xs"
              >
                <span className="flex items-center gap-2">
                  <Store className="w-4 h-4 text-white" />
                  PDV - Frente de Caixa (Loja Física)
                </span>
                <span className="text-[10px] bg-emerald-800/80 px-2 py-0.5 rounded font-extrabold">
                  Acessar
                </span>
              </button>
            )}

            <button
              onClick={() => {
                onNavigate('home');
                setIsMobileMenuOpen(false);
              }}
              className="text-left py-2 px-3 rounded-lg hover:bg-slate-50"
            >
              Início
            </button>
            <button
              onClick={() => {
                onNavigate('catalog');
                setIsMobileMenuOpen(false);
              }}
              className="text-left py-2 px-3 rounded-lg hover:bg-slate-50"
            >
              Catálogo de Produtos
            </button>
            <button
              onClick={() => {
                onNavigate('digital-catalog');
                setIsMobileMenuOpen(false);
              }}
              className="text-left py-2 px-3 rounded-lg bg-sky-50 text-[#00AEEF] flex items-center justify-between"
            >
              <span>Catálogo PDF / Impressão</span>
              <Printer className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                onNavigate('quote');
                setIsMobileMenuOpen(false);
              }}
              className="text-left py-2 px-3 rounded-lg hover:bg-slate-50 text-[#E6007E]"
            >
              Solicitar Orçamento
            </button>
            <button
              onClick={() => {
                onOpenCart();
                setIsMobileMenuOpen(false);
              }}
              className="text-left py-2 px-3 rounded-lg hover:bg-slate-50 flex items-center justify-between text-slate-800 font-bold"
            >
              <span className="flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-[#00AEEF]" />
                Ver Carrinho
              </span>
              {cartCount > 0 && (
                <span className="bg-[#E6007E] text-white text-[11px] font-bold px-2 py-0.5 rounded-full">
                  {cartCount}
                </span>
              )}
            </button>
            <button
              onClick={() => {
                onNavigate('customer-portal');
                setIsMobileMenuOpen(false);
              }}
              className="text-left py-2 px-3 rounded-lg hover:bg-slate-50 flex items-center justify-between"
            >
              <span>Minha Conta (Cliente)</span>
              <User className="w-4 h-4 text-slate-400" />
            </button>

            {isAdminRole ? (
              <button
                onClick={() => {
                  onNavigate('admin');
                  setIsMobileMenuOpen(false);
                }}
                className="text-left py-2 px-3 rounded-lg bg-slate-900 text-white font-bold flex items-center justify-between"
              >
                <span className="flex items-center gap-2">
                  <LayoutDashboard className="w-4 h-4 text-[#FFDD00]" />
                  Painel de Gestão ({currentUser.role})
                </span>
                <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded">Logado</span>
              </button>
            ) : (
              <button
                onClick={() => {
                  onNavigate('admin-login');
                  setIsMobileMenuOpen(false);
                }}
                className="text-left py-2 px-3 rounded-lg bg-slate-900 text-white font-bold flex items-center justify-between"
              >
                <span className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#FFDD00]" />
                  Acesso Administrativo (Login)
                </span>
                <KeyRound className="w-4 h-4 text-slate-400" />
              </button>
            )}

            {/* Módulo Financeiro Restrito no Menu Mobile */}
            {canViewFinancial && (
              <button
                onClick={() => {
                  onNavigate('financial');
                  setIsMobileMenuOpen(false);
                }}
                className="text-left py-2 px-3 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-900 border border-rose-200 font-bold flex items-center justify-between"
              >
                <span className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-rose-600" />
                  Módulo Financeiro (Restrito)
                </span>
                <span className="text-[10px] bg-rose-600 text-white px-2 py-0.5 rounded font-extrabold uppercase">
                  Acesso Autorizado
                </span>
              </button>
            )}
            <button
              onClick={() => {
                onNavigate('about');
                setIsMobileMenuOpen(false);
              }}
              className="text-left py-2 px-3 rounded-lg hover:bg-slate-50 text-slate-600"
            >
              Sobre Nós
            </button>
            <button
              onClick={() => {
                setIsWhatsAppModalOpen(true);
                setIsMobileMenuOpen(false);
              }}
              className="text-left py-2 px-3 rounded-lg bg-emerald-50 text-emerald-800 font-bold flex items-center justify-between border border-emerald-200"
            >
              <span className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-[#25D366]" />
                Falar pelo WhatsApp
              </span>
              <span className="text-[10px] bg-emerald-200/70 text-emerald-900 px-2 py-0.5 rounded-full font-bold">
                {activeWhatsAppContacts.length} {activeWhatsAppContacts.length === 1 ? 'Canal' : 'Canais'}
              </span>
            </button>
            <button
              onClick={() => {
                onNavigate('contact');
                setIsMobileMenuOpen(false);
              }}
              className="text-left py-2 px-3 rounded-lg hover:bg-slate-50 text-slate-600"
            >
              Fale Conosco
            </button>
          </div>
        </div>
      )}

      {/* WhatsApp Multi-Channel Contact Modal */}
      <WhatsAppContactModal
        isOpen={isWhatsAppModalOpen}
        onClose={() => setIsWhatsAppModalOpen(false)}
        companySettings={companySettings}
      />
    </header>
  );
};
