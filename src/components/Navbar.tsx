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
      {layoutSettings.header.showTopBanner && (
        <div
          className="text-xs py-1.5 px-4 transition-colors"
          style={{
            backgroundColor: layoutSettings.colors.topBannerBg,
            color: layoutSettings.colors.topBannerText,
          }}
        >
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5 text-xs font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                {layoutSettings.header.topBannerText}
              </span>
            </div>

            <div className="flex items-center gap-3 sm:gap-4 ml-auto">
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
        <div className="flex items-center justify-between gap-4">
          {/* Logo */}
          <button
            onClick={() => onNavigate('home')}
            className="focus:outline-none text-left flex-shrink-0 cursor-pointer"
            id="nav-logo-btn"
          >
            <Logo size="md" />
          </button>

          {/* Desktop Search Bar */}
          <div className="hidden lg:flex flex-1 max-w-md mx-6 relative" ref={searchRef}>
            <div className="relative w-full">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setIsSearchOpen(true);
                }}
                onFocus={() => setIsSearchOpen(true)}
                placeholder="Buscar por copos, canecas, camisetas, brindes..."
                className="w-full pl-9 pr-4 py-2 text-sm bg-slate-100/80 hover:bg-slate-100 focus:bg-white text-slate-800 placeholder-slate-400 rounded-lg border border-transparent focus:border-[#00AEEF] focus:ring-2 focus:ring-sky-100 transition-all outline-none"
                id="search-input"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            </div>

            {/* Instant Search Results Dropdown */}
            {isSearchOpen && searchQuery.trim().length > 1 && (
              <div className="absolute top-full left-0 right-0 mt-1.5 bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden z-50 animate-in fade-in">
                <div className="p-2 border-b border-slate-100 flex items-center justify-between text-xs text-slate-500">
                  <span>Produtos encontrados ({filteredProducts.length})</span>
                  <span className="text-[10px] text-slate-400">Pressione Enter para ver todos</span>
                </div>
                {filteredProducts.length > 0 ? (
                  <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
                    {filteredProducts.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => handleSelectProduct(p.id)}
                        className="w-full flex items-center gap-3 p-2.5 hover:bg-slate-50 text-left transition-colors cursor-pointer"
                      >
                        <img
                          src={p.images[0]}
                          alt={p.name}
                          className="w-10 h-10 object-cover rounded-md border border-slate-200"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-slate-800 truncate">{p.name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] text-slate-400 font-mono">{p.code}</span>
                            {p.show_price ? (
                              <span className="text-xs font-bold text-slate-900">
                                R$ {p.promo_price ? p.promo_price.toFixed(2) : p.base_price.toFixed(2)}
                              </span>
                            ) : (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 font-semibold">
                                Sob Orçamento
                              </span>
                            )}
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-400" />
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="p-6 text-center text-xs text-slate-500">
                    Nenhum produto encontrado para "{searchQuery}".
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Desktop Nav Links */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-700">
            <button
              onClick={() => onNavigate('home')}
              className={`hover:text-[#E6007E] transition-colors ${currentView === 'home' ? 'text-[#E6007E] font-bold' : ''}`}
            >
              Início
            </button>
            <button
              onClick={() => onNavigate('catalog')}
              className={`hover:text-[#E6007E] transition-colors ${currentView === 'catalog' ? 'text-[#E6007E] font-bold' : ''}`}
            >
              Catálogo Completo
            </button>
            {layoutSettings.header.showCatalogPdfLink && (
              <button
                onClick={() => onNavigate('digital-catalog')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-sky-50 text-[#00AEEF] hover:bg-sky-100 transition-colors ${
                  currentView === 'digital-catalog' ? 'ring-2 ring-[#00AEEF]' : ''
                }`}
                title="Catálogo PDF / Impressão pronto para clientes"
              >
                <Printer className="w-3.5 h-3.5" />
                Catálogo PDF
              </button>
            )}
            <button
              onClick={() => onNavigate('quote')}
              className={`hover:text-[#E6007E] transition-colors ${currentView === 'quote' ? 'text-[#E6007E] font-bold' : ''}`}
            >
              Solicitar Orçamento
            </button>
            {layoutSettings.header.showAboutLink && (
              <button
                onClick={() => onNavigate('about')}
                className={`hover:text-[#E6007E] transition-colors ${currentView === 'about' ? 'text-[#E6007E] font-bold' : ''}`}
              >
                Sobre
              </button>
            )}
            <button
              onClick={() => onNavigate('contact')}
              className={`hover:text-[#E6007E] transition-colors ${currentView === 'contact' ? 'text-[#E6007E] font-bold' : ''}`}
            >
              Contato
            </button>
          </nav>

          {/* Action CTAs */}
          <div className="flex items-center gap-2 sm:gap-2.5">
            {/* Admin or Customer Portal button */}
            {isAdminRole ? (
              <button
                onClick={() => onNavigate('admin')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-xs ${
                  currentView === 'admin'
                    ? 'bg-slate-900 text-white ring-2 ring-[#FFDD00]'
                    : 'bg-slate-900 text-white hover:bg-slate-800'
                }`}
                id="btn-nav-admin"
              >
                <LayoutDashboard className="w-4 h-4 text-[#FFDD00]" />
                <span className="hidden sm:inline">Painel Gestão</span>
              </button>
            ) : (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => onNavigate('customer-portal')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                    currentView === 'customer-portal'
                      ? 'bg-pink-50 border-[#E6007E] text-[#E6007E]'
                      : 'border-slate-300 text-slate-700 hover:bg-slate-50'
                  }`}
                  id="btn-nav-customer-portal"
                >
                  <User className="w-4 h-4 text-slate-500" />
                  <span className="hidden sm:inline">Minha Conta</span>
                </button>

                <button
                  onClick={() => onNavigate('admin-login')}
                  className="hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors border border-transparent hover:border-slate-200"
                  title="Acesso Administrativo MB"
                  id="btn-nav-admin-login-quick"
                >
                  <KeyRound className="w-3.5 h-3.5 text-[#00AEEF]" />
                  <span>Admin</span>
                </button>
              </div>
            )}

            {/* Shopping Cart Button */}
            <button
              onClick={onOpenCart}
              className="relative p-2 rounded-lg text-slate-700 hover:bg-slate-100 transition-colors focus:outline-none cursor-pointer"
              id="btn-open-cart"
              aria-label="Carrinho de Compras"
            >
              <ShoppingCart className="w-5 h-5" />
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-5 h-5 px-1 rounded-full bg-[#E6007E] text-white text-[11px] font-bold shadow-xs">
                  {cartCount}
                </span>
              )}
            </button>

            {/* Mobile Hamburger Toggle */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 text-slate-700 hover:bg-slate-100 rounded-lg focus:outline-none"
              id="btn-mobile-menu"
            >
              {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden bg-white border-b border-slate-200 px-4 py-4 space-y-3 animate-in slide-in-from-top-2">
          <div className="relative w-full mb-3">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar produtos..."
              className="w-full pl-9 pr-4 py-2 text-sm bg-slate-100 text-slate-800 rounded-lg border border-slate-200"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          </div>

          <div className="flex flex-col space-y-2 text-sm font-semibold text-slate-800">
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
