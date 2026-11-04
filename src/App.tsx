import React, { useState, useEffect } from 'react';
import { Product, Category, Subcategory, CartItem, UserProfile, ProductVariant, CompanySettings, BackupHistoryEntry } from './types';
import { StorageService } from './services/storage';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { CartDrawer } from './components/CartDrawer';
import { AuthModal } from './components/AuthModal';
import { WhatsAppFloatingWidget } from './components/WhatsAppFloatingWidget';
import { WhatsAppContactModal } from './components/WhatsAppContactModal';

// Views
import { HomeView } from './views/HomeView';
import { CatalogView } from './views/CatalogView';
import { ProductDetailView } from './views/ProductDetailView';
import { QuoteView } from './views/QuoteView';
import { DigitalCatalogView } from './views/DigitalCatalogView';
import { CheckoutView } from './views/CheckoutView';
import { CustomerPortalView } from './views/CustomerPortalView';
import { AdminPanel } from './views/AdminPanel';
import { AdminLoginView } from './views/AdminLoginView';
import { SiteMetricsView } from './views/SiteMetricsView';
import { PDVView } from './views/PDVView';
import { MaintenanceView } from './views/MaintenanceView';
import { FinancialModuleView } from './views/FinancialModuleView';
import { CostPricingModuleView } from './views/CostPricingModuleView';
import { AboutView } from './views/AboutView';
import { ContactView } from './views/ContactView';
import { AdminMaintenanceBanner } from './components/AdminMaintenanceBanner';
import { GlobalSearchModal } from './components/GlobalSearchModal';
import { AnalyticsService } from './services/analytics';

export default function App() {
  // Current Navigation View & optional parameter (e.g. productId or categoryId)
  const [currentView, setCurrentView] = useState<string>('home');
  const [viewParam, setViewParam] = useState<string | undefined>(undefined);

  // App Data State (synced from StorageService)
  const [products, setProducts] = useState<Product[]>(() => StorageService.getProducts());
  const [categories, setCategories] = useState<Category[]>(() => StorageService.getCategories());
  const [subcategories, setSubcategories] = useState<Subcategory[]>(() => StorageService.getSubcategories());
  const [currentUser, setCurrentUser] = useState<UserProfile>(() => StorageService.getCurrentUser());

  // Cart State
  const [cart, setCart] = useState<CartItem[]>(() => StorageService.getCart());
  const [isCartOpen, setIsCartOpen] = useState<boolean>(false);

  // Auth Modal State
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);

  // Global Search / Spotlight State
  const [isGlobalSearchOpen, setIsGlobalSearchOpen] = useState<boolean>(false);
  const [globalSearchInitialQuery, setGlobalSearchInitialQuery] = useState<string>('');

  // Company Settings & Multi-WhatsApp Contact State
  const [companySettings, setCompanySettings] = useState<CompanySettings>(() => StorageService.getCompanySettings());
  const [isGlobalWhatsAppModalOpen, setIsGlobalWhatsAppModalOpen] = useState<boolean>(false);

  // Quote Pre-fill state
  const [quoteInitialItem, setQuoteInitialItem] = useState<
    { product: Product; variant?: ProductVariant; quantity: number } | undefined
  >(undefined);

  // Sync state when storage changes
  const refreshData = () => {
    setProducts(StorageService.getProducts());
    setCategories(StorageService.getCategories());
    setSubcategories(StorageService.getSubcategories());
    setCart(StorageService.getCart());
    setCurrentUser(StorageService.getCurrentUser());
    setCompanySettings(StorageService.getCompanySettings());
  };

  // Maintenance Mode Status & Admin Privileges
  const isMaintenanceActive = Boolean(companySettings.maintenance?.enabled);
  const isAuthorizedAdmin =
    currentUser &&
    (currentUser.role === 'admin' ||
      currentUser.role === 'gerente' ||
      Boolean(currentUser.customPermissions?.canManageCompanySettings));

  // Sync official data from PostgreSQL (Cloud SQL) on application start
  useEffect(() => {
    StorageService.initPostgresSync()
      .then((synced) => {
        if (synced) {
          refreshData();
        }
      })
      .catch((err) => {
        console.warn('PostgreSQL initial sync notice:', err);
      });

    fetch('/api/system/maintenance', { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => {
        if (data && data.maintenance) {
          const localSettings = StorageService.getMaintenanceSettings();
          if (Boolean(localSettings.enabled) !== Boolean(data.maintenance.enabled)) {
            StorageService.saveMaintenanceSettings(data.maintenance);
            setCompanySettings(StorageService.getCompanySettings());
          }
        }
      })
      .catch((err) => {
        console.warn('Backend maintenance status sync notice:', err);
      });
  }, []);

  useEffect(() => {
    const handleSettingsUpdate = () => {
      setCompanySettings(StorageService.getCompanySettings());
    };
    const handleMaintenanceUpdate = () => {
      setCompanySettings(StorageService.getCompanySettings());
    };
    const handleOpenWhatsApp = () => {
      setIsGlobalWhatsAppModalOpen(true);
    };

    window.addEventListener('mb_storage_updated', refreshData);
    window.addEventListener('mb_products_updated', refreshData);
    window.addEventListener('mb_stricker_products_updated', refreshData);
    window.addEventListener('mb_company_settings_updated', handleSettingsUpdate);
    window.addEventListener('mb_maintenance_updated', handleMaintenanceUpdate);
    window.addEventListener('mb_open_whatsapp_modal', handleOpenWhatsApp);
    return () => {
      window.removeEventListener('mb_storage_updated', refreshData);
      window.removeEventListener('mb_products_updated', refreshData);
      window.removeEventListener('mb_stricker_products_updated', refreshData);
      window.removeEventListener('mb_company_settings_updated', handleSettingsUpdate);
      window.removeEventListener('mb_maintenance_updated', handleMaintenanceUpdate);
      window.removeEventListener('mb_open_whatsapp_modal', handleOpenWhatsApp);
    };
  }, []);

  // Scroll to top on route change & track analytics pageviews
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });

    let title = 'MB Personaliza - Brindes Corporativos & Comunicação Visual';
    let path = `/${currentView}`;
    if (currentView === 'home') {
      title = 'Início | MB Personaliza';
      path = '/';
    } else if (currentView === 'maintenance') {
      title = `${companySettings.maintenance?.title || 'Sistema em Manutenção'} | MB Personaliza`;
      path = '/manutencao';
    } else if (currentView === 'catalog') {
      title = 'Catálogo de Produtos | MB Personaliza';
      path = '/catalogo';
    } else if (currentView === 'product-detail') {
      const prod = products.find((p) => p.id === viewParam || p.slug === viewParam);
      title = prod ? `${prod.name} | MB Personaliza` : 'Detalhes do Produto';
      path = prod ? `/produtos/${prod.slug || prod.id}` : `/produtos/${viewParam}`;
    } else if (currentView === 'quote') {
      title = 'Solicitar Orçamento | MB Personaliza';
      path = '/orcamento';
    } else if (currentView === 'digital-catalog') {
      title = 'Catálogo Digital PDF | MB Personaliza';
      path = '/catalogo-digital';
    } else if (currentView === 'checkout') {
      title = 'Finalizar Pedido | MB Personaliza';
      path = '/checkout';
    } else if (currentView === 'metrics') {
      title = 'Métricas do Site & Insights | MB Personaliza';
      path = '/admin/metricas';
    } else if (currentView === 'pdv') {
      title = 'PDV - Frente de Caixa (Loja Física) | MB Personaliza';
      path = '/pdv';
    } else if (currentView === 'financial' || currentView === 'financeiro') {
      title = 'Módulo Financeiro | MB Personaliza';
      path = '/financeiro';
    } else if (currentView === 'cost_pricing' || currentView === 'precificacao' || currentView === 'custos') {
      title = 'Orçamento de Custos & Precificação de Produtos | MB Personaliza';
      path = '/precificacao';
    }

    AnalyticsService.trackPageView(path, title);
  }, [currentView, viewParam, companySettings.maintenance]);

  // Rotina em segundo plano para verificação de exportação agendada de recuperação de desastres
  useEffect(() => {
    const checkScheduledBackup = async () => {
      try {
        const cfg = StorageService.getBackupScheduleConfig();
        if (!cfg.enabled || !cfg.nextRunAt) return;

        const now = new Date().getTime();
        const nextRun = new Date(cfg.nextRunAt).getTime();

        if (now >= nextRun) {
          const backup = StorageService.generateSecureBackupJson({ trigger: 'scheduled' });
          const newEntry: BackupHistoryEntry = {
            id: `bkp-sch-${Date.now()}`,
            filename: backup.filename,
            timestamp: new Date().toISOString(),
            sizeBytes: backup.sizeBytes,
            sizeFormatted: backup.sizeFormatted,
            checksum: backup.checksum,
            trigger: 'scheduled',
            status: 'success',
            counts: {
              products: backup.payload.metadata.counts.products,
              quotes: backup.payload.metadata.counts.quotes,
              orders: backup.payload.metadata.counts.orders,
            },
            storedOnServer: true,
          };
          StorageService.addBackupHistoryEntry(newEntry);
          cfg.lastRunAt = new Date().toISOString();
          cfg.lastRunStatus = 'success';
          cfg.lastRunMessage = 'Backup agendado executado automaticamente.';
          cfg.nextRunAt = StorageService.calculateNextBackupRun(cfg);
          StorageService.saveBackupScheduleConfig(cfg);

          if (cfg.autoDownloadBrowser) {
            const blob = new Blob([backup.jsonString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = backup.filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
          }

          try {
            await fetch('/api/backup/export', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ trigger: 'scheduled', clientPayload: backup.payload }),
            });
          } catch {
            // Ignora erro de rede
          }
        }
      } catch (err) {
        console.warn('Verificação de backup agendado:', err);
      }
    };

    checkScheduledBackup();
    const intervalTimer = setInterval(checkScheduledBackup, 60000);
    return () => clearInterval(intervalTimer);
  }, []);

  // Global Keyboard Shortcuts (Ctrl+K, Cmd+K, '/') and Event Handler for Global Search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+K or Cmd+K
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsGlobalSearchOpen((prev) => !prev);
        return;
      }

      // '/' when not inside an input, textarea or select
      if (
        e.key === '/' &&
        !['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)
      ) {
        e.preventDefault();
        setIsGlobalSearchOpen(true);
      }
    };

    const handleCustomOpen = (e: any) => {
      const q = e?.detail?.query || '';
      setGlobalSearchInitialQuery(q);
      setIsGlobalSearchOpen(true);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('mb_open_global_search', handleCustomOpen);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mb_open_global_search', handleCustomOpen);
    };
  }, []);

  // Navigation Handler
  const handleNavigate = (view: string, param?: string) => {
    // If maintenance is active and user is NOT an authorized admin:
    // Only allow admin-login so an administrator can authenticate
    if (isMaintenanceActive && !isAuthorizedAdmin) {
      if (view === 'admin-login') {
        setCurrentView('admin-login');
        setViewParam(undefined);
      } else {
        setCurrentView('maintenance');
        setViewParam(undefined);
      }
      return;
    }

    if (view === 'checkout') {
      setIsCartOpen(false);
    }

    setCurrentView(view);
    setViewParam(param);
  };

  // Cart Handlers
  const handleAddToCart = (item: CartItem, openDrawer: boolean = true) => {
    StorageService.addToCart(item);
    setCart(StorageService.getCart());
    if (openDrawer) {
      setIsCartOpen(true);
    }
  };

  const handleUpdateCartQty = (itemId: string, qty: number) => {
    StorageService.updateCartItemQuantity(itemId, qty);
    setCart(StorageService.getCart());
  };

  const handleRemoveCartItem = (itemId: string) => {
    StorageService.removeFromCart(itemId);
    setCart(StorageService.getCart());
  };

  const handleClearCart = () => {
    StorageService.clearCart();
    setCart([]);
  };

  const handleOpenQuoteModal = (initial?: { product: Product; variant?: ProductVariant; quantity: number }) => {
    setQuoteInitialItem(initial);
    setCurrentView('quote');
  };

  // Maintenance Mode Interception:
  // If maintenance is active and user is NOT an authorized admin, restrict entire system
  if (isMaintenanceActive && !isAuthorizedAdmin) {
    if (currentView === 'admin-login') {
      return (
        <div className="min-h-screen flex flex-col bg-slate-900 text-slate-100 font-sans">
          <AdminLoginView
            onLoginSuccess={(user) => {
              setCurrentUser(user);
              refreshData();
              setCurrentView('admin');
            }}
            onNavigate={(view) => {
              if (view === 'home' || view === 'maintenance') {
                setCurrentView('maintenance');
              } else {
                handleNavigate(view);
              }
            }}
          />
        </div>
      );
    }

    return (
      <MaintenanceView
        companySettings={companySettings}
        currentUser={currentUser}
        onNavigate={handleNavigate}
      />
    );
  }

  return (
    <div
      className={`flex flex-col bg-[#FAF9F6] text-slate-900 font-sans selection:bg-[#E6007E] selection:text-white w-full max-w-full overflow-x-clip ${
        currentView === 'pdv'
          ? 'h-screen max-h-screen h-[100dvh] max-h-[100dvh] overflow-hidden'
          : 'min-h-screen'
      }`}
    >
      {/* Admin Maintenance Alert Banner (Always visible to admin when maintenance mode is active) */}
      {isMaintenanceActive && isAuthorizedAdmin && (
        <AdminMaintenanceBanner
          companySettings={companySettings}
          currentUser={currentUser}
          onNavigate={handleNavigate}
          onRefreshSettings={refreshData}
        />
      )}

      {/* Main Header / Navigation (Hidden in PDV fullscreen mode or preview maintenance) */}
      {currentView !== 'pdv' && currentView !== 'maintenance' && (
        <Navbar
          currentUser={currentUser}
          onUserChange={(user) => {
            setCurrentUser(user);
            refreshData();
          }}
          cartCount={(cart || []).reduce((a, b) => a + (b?.quantity || 0), 0)}
          currentView={currentView}
          onNavigate={handleNavigate}
          onOpenCart={() => setIsCartOpen(true)}
          products={products}
          categories={categories}
          onOpenGlobalSearch={(initialQuery) => {
            setGlobalSearchInitialQuery(initialQuery || '');
            setIsGlobalSearchOpen(true);
          }}
        />
      )}

      {/* Main View Renderer */}
      <main
        className={`flex-1 w-full max-w-full min-w-0 ${
          currentView === 'pdv'
            ? 'h-full max-h-full overflow-hidden flex flex-col min-h-0'
            : 'overflow-x-clip'
        }`}
      >
        {currentView === 'home' && (
          <HomeView
            products={products}
            categories={categories}
            currentUser={currentUser}
            onNavigate={handleNavigate}
          />
        )}

        {currentView === 'catalog' && (
          <CatalogView
            products={products}
            categories={categories}
            subcategories={subcategories}
            selectedCategoryId={viewParam}
            currentUser={currentUser}
            onNavigate={handleNavigate}
            onOpenQuoteModal={handleOpenQuoteModal}
          />
        )}

        {currentView === 'product-detail' && (
          <ProductDetailView
            productId={viewParam || products[0]?.id || ''}
            products={products}
            currentUser={currentUser}
            onNavigate={handleNavigate}
            onAddToCart={handleAddToCart}
            onOpenQuoteModal={handleOpenQuoteModal}
          />
        )}

        {currentView === 'quote' && (
          <QuoteView
            products={products}
            categories={categories}
            currentUser={currentUser}
            initialItem={quoteInitialItem}
            onNavigate={handleNavigate}
          />
        )}

        {currentView === 'digital-catalog' && (
          <DigitalCatalogView
            products={products}
            categories={categories}
            onNavigate={handleNavigate}
          />
        )}

        {currentView === 'checkout' && (
          <CheckoutView
            cart={cart}
            currentUser={currentUser}
            onClearCart={handleClearCart}
            onNavigate={handleNavigate}
          />
        )}

        {currentView === 'customer-portal' && (
          <CustomerPortalView
            currentUser={currentUser}
            onUserUpdate={(u) => {
              setCurrentUser(u);
              refreshData();
            }}
            onNavigate={handleNavigate}
          />
        )}

        {currentView === 'admin-login' && (
          <AdminLoginView
            onLoginSuccess={(user) => {
              setCurrentUser(user);
              refreshData();
            }}
            onNavigate={handleNavigate}
          />
        )}

        {currentView === 'admin' && (
          currentUser.role === 'cliente' || currentUser.role === 'visitante' ? (
            <AdminLoginView
              onLoginSuccess={(user) => {
                setCurrentUser(user);
                refreshData();
              }}
              onNavigate={handleNavigate}
            />
          ) : (
            <AdminPanel
              currentUser={currentUser}
              products={products}
              categories={categories}
              subcategories={subcategories}
              onRefreshData={refreshData}
              onNavigate={handleNavigate}
            />
          )
        )}

        {currentView === 'metrics' && (
          <SiteMetricsView
            currentUser={currentUser}
            onNavigate={handleNavigate}
          />
        )}

        {currentView === 'pdv' && (
          currentUser.role === 'cliente' || currentUser.role === 'visitante' ? (
            <AdminLoginView
              onLoginSuccess={(user) => {
                setCurrentUser(user);
                refreshData();
                setCurrentView('pdv');
              }}
              onNavigate={handleNavigate}
            />
          ) : (
            <PDVView
              currentUser={currentUser}
              products={products}
              categories={categories}
              onNavigate={handleNavigate}
            />
          )
        )}

        {(currentView === 'financial' || currentView === 'financeiro') && (
          <FinancialModuleView
            currentUser={currentUser}
            onNavigate={handleNavigate}
            onUserChange={(user) => {
              setCurrentUser(user);
              refreshData();
            }}
          />
        )}

        {/* Módulo de Orçamento de Custos & Precificação (Acesso Direto com Proteção de Permissões) */}
        {(currentView === 'cost_pricing' || currentView === 'precificacao' || currentView === 'custos') && (
          currentUser.role === 'admin' || StorageService.hasUserPermission(currentUser, 'canViewCostPricingModule') ? (
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
              <CostPricingModuleView currentUser={currentUser} />
            </div>
          ) : (
            <AdminLoginView
              onLoginSuccess={(user) => {
                setCurrentUser(user);
                refreshData();
                setCurrentView('cost_pricing');
              }}
              onNavigate={handleNavigate}
            />
          )
        )}

        {/* About View */}
        {currentView === 'about' && (
          <AboutView onNavigate={handleNavigate} />
        )}

        {/* Contact View */}
        {currentView === 'contact' && (
          <ContactView onNavigate={handleNavigate} />
        )}

        {/* Maintenance View (Direct route or Admin preview) */}
        {currentView === 'maintenance' && (
          <MaintenanceView
            companySettings={companySettings}
            currentUser={currentUser}
            onNavigate={handleNavigate}
            onDeactivateMaintenance={() => {
              StorageService.toggleMaintenanceMode(false, currentUser);
              refreshData();
              handleNavigate('admin');
            }}
          />
        )}
      </main>

      {/* Footer (Hidden in PDV fullscreen mode or Maintenance mode) */}
      {currentView !== 'pdv' && currentView !== 'maintenance' && (
        <Footer onNavigate={handleNavigate} />
      )}

      {/* Shopping Cart Drawer */}
      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        cart={cart}
        items={cart}
        onCartChange={refreshData}
        onUpdateQuantity={handleUpdateCartQty}
        onRemoveItem={handleRemoveCartItem}
        onNavigate={handleNavigate}
        onCheckout={() => {
          setIsCartOpen(false);
          handleNavigate('checkout');
        }}
        onRequestQuote={() => {
          setIsCartOpen(false);
          handleNavigate('quote');
        }}
      />

      {/* Pesquisa Global / Spotlight Command Palette */}
      <GlobalSearchModal
        isOpen={isGlobalSearchOpen}
        onClose={() => {
          setIsGlobalSearchOpen(false);
          setGlobalSearchInitialQuery('');
        }}
        products={products}
        categories={categories}
        subcategories={subcategories}
        currentUser={currentUser}
        onNavigate={handleNavigate}
        onOpenCart={() => setIsCartOpen(true)}
        onOpenQuoteModal={handleOpenQuoteModal}
        initialQuery={globalSearchInitialQuery}
      />

      {/* Auth Modal (Login / Sign Up) */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onLoginSuccess={(user) => {
          setCurrentUser(user);
          refreshData();
        }}
      />

      {/* Floating WhatsApp Quick Action Widget */}
      {currentView !== 'admin' && currentView !== 'pdv' && currentView !== 'maintenance' && (
        <WhatsAppFloatingWidget
          companySettings={companySettings}
          onOpenFullModal={() => setIsGlobalWhatsAppModalOpen(true)}
        />
      )}

      {/* Global WhatsApp Contact Modal */}
      <WhatsAppContactModal
        isOpen={isGlobalWhatsAppModalOpen}
        onClose={() => setIsGlobalWhatsAppModalOpen(false)}
        companySettings={companySettings}
      />
    </div>
  );
}
