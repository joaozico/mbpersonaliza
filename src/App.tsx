import React, { useState, useEffect } from 'react';
import { Product, Category, Subcategory, CartItem, UserProfile, ProductVariant, CompanySettings } from './types';
import { StorageService } from './services/storage';
import { RoleSwitcher } from './components/RoleSwitcher';
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

  useEffect(() => {
    const handleSettingsUpdate = () => {
      setCompanySettings(StorageService.getCompanySettings());
    };
    const handleOpenWhatsApp = () => {
      setIsGlobalWhatsAppModalOpen(true);
    };

    window.addEventListener('mb_storage_updated', refreshData);
    window.addEventListener('mb_products_updated', refreshData);
    window.addEventListener('mb_stricker_products_updated', refreshData);
    window.addEventListener('mb_company_settings_updated', handleSettingsUpdate);
    window.addEventListener('mb_open_whatsapp_modal', handleOpenWhatsApp);
    return () => {
      window.removeEventListener('mb_storage_updated', refreshData);
      window.removeEventListener('mb_products_updated', refreshData);
      window.removeEventListener('mb_stricker_products_updated', refreshData);
      window.removeEventListener('mb_company_settings_updated', handleSettingsUpdate);
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
    }

    AnalyticsService.trackPageView(path, title);
  }, [currentView, viewParam]);

  // Navigation Handler
  const handleNavigate = (view: string, param?: string) => {
    setCurrentView(view);
    setViewParam(param);
  };

  // Cart Handlers
  const handleAddToCart = (item: CartItem) => {
    StorageService.addToCart(item);
    setCart(StorageService.getCart());
    setIsCartOpen(true);
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

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF9F6] text-slate-900 font-sans selection:bg-[#E6007E] selection:text-white">
      {/* Role Switcher Toolbar (Top Bar for RBAC Testing) */}
      <RoleSwitcher
        currentUser={currentUser}
        onRoleChange={(newRole) => {
          const updatedUser: UserProfile = {
            ...currentUser,
            role: newRole,
          };
          StorageService.setCurrentUser(updatedUser);
          setCurrentUser(updatedUser);
        }}
      />

      {/* Main Header / Navigation */}
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
      />

      {/* Main View Renderer */}
      <main className="flex-1">
        {currentView === 'home' && (
          <HomeView
            products={products}
            categories={categories}
            onNavigate={handleNavigate}
          />
        )}

        {currentView === 'catalog' && (
          <CatalogView
            products={products}
            categories={categories}
            subcategories={subcategories}
            selectedCategoryId={viewParam}
            onNavigate={handleNavigate}
          />
        )}

        {currentView === 'product-detail' && (
          <ProductDetailView
            productId={viewParam || products[0].id}
            products={products}
            onNavigate={handleNavigate}
            onAddToCart={handleAddToCart}
            onOpenQuoteModal={handleOpenQuoteModal}
          />
        )}

        {currentView === 'quote' && (
          <QuoteView
            products={products}
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
      </main>

      {/* Footer */}
      <Footer onNavigate={handleNavigate} />

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
      {currentView !== 'admin' && (
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
