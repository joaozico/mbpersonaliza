import {
  Product,
  Category,
  Subcategory,
  Quote,
  Order,
  StockMovement,
  UserProfile,
  UserRole,
  CartItem,
  CompanySettings,
  RolePermissions,
  SystemLayoutSettings,
} from '../types';
import {
  INITIAL_PRODUCTS,
  INITIAL_CATEGORIES,
  INITIAL_SUBCATEGORIES,
  INITIAL_QUOTES,
  INITIAL_ORDERS,
  INITIAL_STOCK_MOVEMENTS,
  INITIAL_USERS,
  INITIAL_COMPANY_SETTINGS,
  INITIAL_PERMISSIONS_MATRIX,
  INITIAL_LAYOUT_SETTINGS,
} from '../data/initialData';

const STORAGE_KEYS = {
  PRODUCTS: 'mb_personaliza_products_v1',
  CATEGORIES: 'mb_personaliza_categories_v1',
  SUBCATEGORIES: 'mb_personaliza_subcategories_v1',
  QUOTES: 'mb_personaliza_quotes_v1',
  ORDERS: 'mb_personaliza_orders_v1',
  STOCK_MOVEMENTS: 'mb_personaliza_stock_movements_v1',
  USERS: 'mb_personaliza_users_v1',
  CURRENT_USER: 'mb_personaliza_current_user_v1',
  CART: 'mb_personaliza_cart_v1',
  COMPANY_SETTINGS: 'mb_personaliza_company_settings_v1',
  PERMISSIONS_MATRIX: 'mb_personaliza_permissions_matrix_v1',
  LAYOUT_SETTINGS: 'mb_personaliza_layout_settings_v1',
  LAYOUT_DRAFT: 'mb_personaliza_layout_draft_v1',
};

function getStored<T>(key: string, fallback: T): T {
  try {
    const item = localStorage.getItem(key);
    if (!item || item === 'undefined' || item === 'null') return fallback;
    const parsed = JSON.parse(item);
    if (parsed === null || parsed === undefined) return fallback;
    return parsed;
  } catch {
    return fallback;
  }
}

function setStored<T>(key: string, data: T): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(data));
    if (typeof window !== 'undefined') {
      setTimeout(() => {
        window.dispatchEvent(new Event('mb_storage_updated'));
      }, 0);
    }
    return true;
  } catch (err) {
    console.error(`Error saving key ${key} to localStorage:`, err);
    return false;
  }
}

export const StorageService = {
  // Products
  getProducts(): Product[] {
    const p = getStored<Product[]>(STORAGE_KEYS.PRODUCTS, INITIAL_PRODUCTS);
    const list = Array.isArray(p) ? p : INITIAL_PRODUCTS;
    // Garante que novos produtos do sistema e da Stricker sejam incorporados se ainda não constarem
    const existingIds = new Set(list.map((item) => item.id));
    const missing = INITIAL_PRODUCTS.filter((initProd) => !existingIds.has(initProd.id));
    if (missing.length > 0) {
      const merged = [...list, ...missing];
      setStored(STORAGE_KEYS.PRODUCTS, merged);
      return merged;
    }
    return list;
  },
  saveProducts(products: Product[]): void {
    setStored(STORAGE_KEYS.PRODUCTS, products);
  },
  getProductById(id: string): Product | undefined {
    return this.getProducts().find((p) => p.id === id || p.slug === id);
  },
  saveProduct(product: Product): void {
    const products = this.getProducts();
    const index = products.findIndex((p) => p.id === product.id);
    if (index >= 0) {
      products[index] = product;
    } else {
      products.unshift(product);
    }
    this.saveProducts(products);
  },
  deleteProduct(id: string): void {
    const products = this.getProducts().filter((p) => p.id !== id);
    this.saveProducts(products);
  },

  // Categories
  getCategories(): Category[] {
    const c = getStored<Category[]>(STORAGE_KEYS.CATEGORIES, INITIAL_CATEGORIES);
    return Array.isArray(c) ? c : INITIAL_CATEGORIES;
  },
  getSubcategories(): Subcategory[] {
    const s = getStored<Subcategory[]>(STORAGE_KEYS.SUBCATEGORIES, INITIAL_SUBCATEGORIES);
    return Array.isArray(s) ? s : INITIAL_SUBCATEGORIES;
  },

  // Quotes
  getQuotes(): Quote[] {
    const q = getStored<Quote[]>(STORAGE_KEYS.QUOTES, INITIAL_QUOTES);
    return Array.isArray(q) ? q : INITIAL_QUOTES;
  },
  saveQuotes(quotes: Quote[]): void {
    setStored(STORAGE_KEYS.QUOTES, quotes);
  },
  addQuote(quote: Quote): Quote {
    const quotes = this.getQuotes();
    quotes.unshift(quote);
    this.saveQuotes(quotes);
    return quote;
  },
  updateQuote(quote: Quote): void {
    const quotes = this.getQuotes();
    const index = quotes.findIndex((q) => q.id === quote.id);
    if (index >= 0) {
      quotes[index] = { ...quote, updatedAt: new Date().toISOString() };
      this.saveQuotes(quotes);
    }
  },

  // Orders
  getOrders(): Order[] {
    const o = getStored<Order[]>(STORAGE_KEYS.ORDERS, INITIAL_ORDERS);
    return Array.isArray(o) ? o : INITIAL_ORDERS;
  },
  saveOrders(orders: Order[]): void {
    setStored(STORAGE_KEYS.ORDERS, orders);
  },
  addOrder(order: Order): Order {
    const orders = this.getOrders();
    orders.unshift(order);
    this.saveOrders(orders);

    // Record stock deduction for products
    order.items.forEach((item) => {
      this.recordStockMovement({
        productId: item.productId,
        productName: item.productName,
        productSku: item.productSku,
        variantName: item.variantName,
        type: 'saida',
        quantity: item.quantity,
        reason: `Venda gerada no Pedido ${order.code}`,
        operator_name: 'Sistema Automático de Vendas',
      });
    });

    return order;
  },
  updateOrderStatus(
    orderId: string,
    status: Order['orderStatus'],
    trackingCode?: string,
    notes?: string
  ): void {
    const orders = this.getOrders();
    const index = orders.findIndex((o) => o.id === orderId);
    if (index >= 0) {
      orders[index].orderStatus = status;
      if (trackingCode !== undefined) orders[index].trackingCode = trackingCode;
      if (notes !== undefined) orders[index].notes = notes;
      orders[index].updatedAt = new Date().toISOString();
      this.saveOrders(orders);
    }
  },

  // Convert Quote to Order
  convertQuoteToOrder(quoteId: string, paymentMethod: Order['paymentMethod'] = 'faturado_pj'): Order | null {
    const quotes = this.getQuotes();
    const quote = quotes.find((q) => q.id === quoteId);
    if (!quote) return null;

    const orderNumber = Math.floor(1000 + Math.random() * 9000);
    const newOrder: Order = {
      id: `ord-converted-${Date.now()}`,
      code: `PED-2026-${orderNumber}`,
      clientId: quote.clientId || 'user_cliente',
      clientName: quote.clientName,
      clientEmail: quote.clientEmail,
      clientPhone: quote.clientPhone,
      clientCompany: quote.clientCompany,
      shippingAddress: {
        street: 'Endereço Comercial da Empresa',
        number: 'S/N',
        neighborhood: 'Centro',
        city: quote.deliveryCityState ? quote.deliveryCityState.split('-')[0].trim() : 'São Paulo',
        state: quote.deliveryCityState && quote.deliveryCityState.includes('-') ? quote.deliveryCityState.split('-')[1].trim() : 'SP',
        zip: '01000-000',
      },
      items: quote.items.map((qi, idx) => ({
        id: `oi-${Date.now()}-${idx}`,
        productId: qi.productId,
        productName: qi.productName,
        productSku: qi.productSku,
        productImage: qi.productImage,
        variantName: qi.variantName,
        unitPrice: qi.unit_price_estimated || 0,
        quantity: qi.quantity,
        total: (qi.unit_price_estimated || 0) * qi.quantity,
        customTechnique: qi.customTechnique,
        customArtworkName: quote.artworkName,
      })),
      subtotal: quote.totalEstimated || 0,
      discount: 0,
      shippingCost: 0,
      total: quote.totalEstimated || 0,
      paymentMethod,
      paymentStatus: 'aprovado',
      orderStatus: 'novo',
      sourceQuoteId: quote.id,
      notes: `Convertido a partir do Orçamento ${quote.code}. ${quote.adminNotes || ''}`,
      createdAt: new Date().toISOString(),
    };

    // Mark quote as converted
    quote.status = 'convertido';
    this.updateQuote(quote);

    // Save order & trigger stock movement
    return this.addOrder(newOrder);
  },

  // Stock movements
  getStockMovements(): StockMovement[] {
    const s = getStored<StockMovement[]>(STORAGE_KEYS.STOCK_MOVEMENTS, INITIAL_STOCK_MOVEMENTS);
    return Array.isArray(s) ? s : INITIAL_STOCK_MOVEMENTS;
  },
  recordStockMovement(params: {
    productId: string;
    productName: string;
    productSku: string;
    variantId?: string;
    variantName?: string;
    type: 'entrada' | 'saida' | 'ajuste' | 'perda';
    quantity: number;
    reason: string;
    operator_name: string;
  }): void {
    const products = this.getProducts();
    const product = products.find((p) => p.id === params.productId);
    const prevStock = product ? product.stock_qty : 0;
    let newStock = prevStock;

    if (params.type === 'entrada') newStock += params.quantity;
    else if (params.type === 'saida' || params.type === 'perda') newStock = Math.max(0, newStock - params.quantity);
    else if (params.type === 'ajuste') newStock = params.quantity;

    if (product) {
      product.stock_qty = newStock;
      // Also update variant stock if specified
      if (params.variantId && product.variants) {
        const variant = product.variants.find((v) => v.id === params.variantId);
        if (variant) {
          if (params.type === 'entrada') variant.stock_qty += params.quantity;
          else if (params.type === 'saida' || params.type === 'perda') variant.stock_qty = Math.max(0, variant.stock_qty - params.quantity);
          else if (params.type === 'ajuste') variant.stock_qty = params.quantity;
        }
      }
      this.saveProducts(products);
    }

    const movements = this.getStockMovements();
    const movement: StockMovement = {
      id: `mov-${Date.now()}`,
      productId: params.productId,
      productName: params.productName,
      productSku: params.productSku,
      variantId: params.variantId,
      variantName: params.variantName,
      type: params.type,
      quantity: params.quantity,
      previous_stock: prevStock,
      new_stock: newStock,
      reason: params.reason,
      operator_name: params.operator_name,
      created_at: new Date().toISOString(),
    };
    movements.unshift(movement);
    setStored(STORAGE_KEYS.STOCK_MOVEMENTS, movements);
  },

  // Company Settings
  getCompanySettings(): CompanySettings {
    const stored = getStored<Partial<CompanySettings>>(STORAGE_KEYS.COMPANY_SETTINGS, INITIAL_COMPANY_SETTINGS);
    const contacts =
      Array.isArray(stored.whatsappContacts) && stored.whatsappContacts.length > 0
        ? stored.whatsappContacts
        : INITIAL_COMPANY_SETTINGS.whatsappContacts;

    const defaultContact = contacts?.find((c) => c.isDefault) || contacts?.[0];
    const primaryNumber = defaultContact?.number || stored.whatsapp || INITIAL_COMPANY_SETTINGS.whatsapp;

    return {
      ...INITIAL_COMPANY_SETTINGS,
      ...stored,
      whatsapp: primaryNumber,
      whatsappContacts: contacts,
      address: {
        ...INITIAL_COMPANY_SETTINGS.address,
        ...(stored.address || {}),
      },
      bankInfo: {
        ...INITIAL_COMPANY_SETTINGS.bankInfo,
        ...(stored.bankInfo || {}),
      },
      socialLinks: {
        ...INITIAL_COMPANY_SETTINGS.socialLinks,
        ...(stored.socialLinks || {}),
      },
    };
  },
  saveCompanySettings(settings: CompanySettings): { success: boolean; error?: string } {
    try {
      settings.updatedAt = new Date().toISOString();
      if (settings.whatsappContacts && settings.whatsappContacts.length > 0) {
        const def = settings.whatsappContacts.find((c) => c.isDefault) || settings.whatsappContacts[0];
        if (def && def.number) {
          settings.whatsapp = def.number;
        }
      }
      const saved = setStored(STORAGE_KEYS.COMPANY_SETTINGS, settings);
      
      if (!saved) {
        return {
          success: false,
          error: 'Limite de armazenamento do navegador atingido. Tente usar imagens menores.',
        };
      }

      // Update favicon in browser head if provided
      if (settings.faviconUrl && typeof document !== 'undefined') {
        let link = document.querySelector<HTMLLinkElement>("link[rel*='icon']");
        if (!link) {
          link = document.createElement('link');
          link.rel = 'shortcut icon';
          document.getElementsByTagName('head')[0]?.appendChild(link);
        }
        link.href = settings.faviconUrl;
      }

      // Notify application of company settings change asynchronously to avoid setState during render
      if (typeof window !== 'undefined') {
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('mb_company_settings_updated', { detail: settings }));
          window.dispatchEvent(new Event('mb_storage_updated'));
        }, 0);
      }

      return { success: true };
    } catch (err: any) {
      console.error('Error saving company settings:', err);
      return { success: false, error: err?.message || 'Erro inesperado ao salvar.' };
    }
  },
  resetCompanySettings(): { success: boolean } {
    setStored(STORAGE_KEYS.COMPANY_SETTINGS, INITIAL_COMPANY_SETTINGS);
    if (typeof window !== 'undefined') {
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('mb_company_settings_updated', { detail: INITIAL_COMPANY_SETTINGS }));
        window.dispatchEvent(new Event('mb_storage_updated'));
      }, 0);
    }
    return { success: true };
  },

  // ==========================================
  // SYSTEM LAYOUT & CUSTOMIZATION STORAGE
  // ==========================================

  getLayoutSettings(): SystemLayoutSettings {
    const stored = getStored<SystemLayoutSettings | null>(STORAGE_KEYS.LAYOUT_SETTINGS, null);
    if (!stored) {
      return { ...INITIAL_LAYOUT_SETTINGS };
    }
    // Deep merge to guarantee all keys exist and prevent undefined errors
    return {
      ...INITIAL_LAYOUT_SETTINGS,
      ...stored,
      colors: { ...INITIAL_LAYOUT_SETTINGS.colors, ...(stored.colors || {}) },
      header: { ...INITIAL_LAYOUT_SETTINGS.header, ...(stored.header || {}) },
      hero: {
        ...INITIAL_LAYOUT_SETTINGS.hero,
        ...(stored.hero || {}),
        titleParts:
          stored.hero?.titleParts && stored.hero.titleParts.length > 0
            ? stored.hero.titleParts
            : [
                {
                  id: 'part-1',
                  text: stored.hero?.titlePart1 || INITIAL_LAYOUT_SETTINGS.hero.titlePart1,
                  color: stored.hero?.titlePart1Color || '#FFFFFF',
                  isHighlight: false,
                },
                {
                  id: 'part-2',
                  text: stored.hero?.titleHighlight || INITIAL_LAYOUT_SETTINGS.hero.titleHighlight,
                  color: stored.hero?.titleHighlightColor || '#E6007E',
                  isHighlight: true,
                },
                {
                  id: 'part-3',
                  text: stored.hero?.titlePart2 || INITIAL_LAYOUT_SETTINGS.hero.titlePart2,
                  color: stored.hero?.titlePart2Color || '#FFFFFF',
                  isHighlight: false,
                },
              ],
        trustBadges:
          stored.hero?.trustBadges && stored.hero.trustBadges.length > 0
            ? stored.hero.trustBadges
            : INITIAL_LAYOUT_SETTINGS.hero.trustBadges,
      },
      categoriesSection: { ...INITIAL_LAYOUT_SETTINGS.categoriesSection, ...(stored.categoriesSection || {}) },
      featuredSection: { ...INITIAL_LAYOUT_SETTINGS.featuredSection, ...(stored.featuredSection || {}) },
      b2bBanner: {
        ...INITIAL_LAYOUT_SETTINGS.b2bBanner,
        ...(stored.b2bBanner || {}),
        benefits:
          stored.b2bBanner?.benefits && stored.b2bBanner.benefits.length > 0
            ? stored.b2bBanner.benefits
            : INITIAL_LAYOUT_SETTINGS.b2bBanner.benefits,
      },
      whyChoose: {
        ...INITIAL_LAYOUT_SETTINGS.whyChoose,
        ...(stored.whyChoose || {}),
        items:
          stored.whyChoose?.items && stored.whyChoose.items.length > 0
            ? stored.whyChoose.items
            : INITIAL_LAYOUT_SETTINGS.whyChoose.items,
      },
      footer: { ...INITIAL_LAYOUT_SETTINGS.footer, ...(stored.footer || {}) },
      blocks:
        stored.blocks && stored.blocks.length > 0
          ? [...stored.blocks].sort((a, b) => a.order - b.order)
          : INITIAL_LAYOUT_SETTINGS.blocks,
    };
  },

  saveLayoutSettings(settings: SystemLayoutSettings): { success: boolean; error?: string } {
    try {
      settings.updatedAt = new Date().toISOString();
      settings.publishedAt = new Date().toISOString();
      const saved = setStored(STORAGE_KEYS.LAYOUT_SETTINGS, settings);
      if (!saved) {
        return {
          success: false,
          error: 'Limite de armazenamento do navegador atingido. Tente reduzir o tamanho das imagens customizadas.',
        };
      }
      // Clean draft upon publish
      localStorage.removeItem(STORAGE_KEYS.LAYOUT_DRAFT);

      if (typeof window !== 'undefined') {
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('mb_layout_updated', { detail: settings }));
          window.dispatchEvent(new Event('mb_storage_updated'));
        }, 0);
      }
      return { success: true };
    } catch (err: any) {
      console.error('Error saving layout settings:', err);
      return { success: false, error: err?.message || 'Erro inesperado ao salvar o layout.' };
    }
  },

  getLayoutDraft(): SystemLayoutSettings | null {
    const draft = getStored<SystemLayoutSettings | null>(STORAGE_KEYS.LAYOUT_DRAFT, null);
    return draft;
  },

  saveLayoutDraft(draft: SystemLayoutSettings): boolean {
    draft.updatedAt = new Date().toISOString();
    try {
      localStorage.setItem(STORAGE_KEYS.LAYOUT_DRAFT, JSON.stringify(draft));
      return true;
    } catch (err) {
      console.error('Error saving layout draft:', err);
      return false;
    }
  },

  discardLayoutDraft(): void {
    localStorage.removeItem(STORAGE_KEYS.LAYOUT_DRAFT);
  },

  publishLayout(settings?: SystemLayoutSettings): { success: boolean; error?: string } {
    const target = settings || this.getLayoutDraft() || this.getLayoutSettings();
    return this.saveLayoutSettings(target);
  },

  resetLayoutSettings(): { success: boolean } {
    setStored(STORAGE_KEYS.LAYOUT_SETTINGS, INITIAL_LAYOUT_SETTINGS);
    localStorage.removeItem(STORAGE_KEYS.LAYOUT_DRAFT);
    if (typeof window !== 'undefined') {
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('mb_layout_updated', { detail: INITIAL_LAYOUT_SETTINGS }));
        window.dispatchEvent(new Event('mb_storage_updated'));
      }, 0);
    }
    return { success: true };
  },

  // Permissions Matrix
  getPermissionsMatrix(): Record<UserRole, RolePermissions> {
    const stored = getStored<Record<UserRole, RolePermissions>>(
      STORAGE_KEYS.PERMISSIONS_MATRIX,
      INITIAL_PERMISSIONS_MATRIX
    );
    // Ensure all roles and keys exist even if older version was stored
    const merged = { ...INITIAL_PERMISSIONS_MATRIX };
    for (const r of Object.keys(INITIAL_PERMISSIONS_MATRIX) as UserRole[]) {
      if (stored && stored[r]) {
        merged[r] = { ...INITIAL_PERMISSIONS_MATRIX[r], ...stored[r] };
      }
    }
    return merged;
  },
  savePermissionsMatrix(matrix: Record<UserRole, RolePermissions>): void {
    setStored(STORAGE_KEYS.PERMISSIONS_MATRIX, matrix);
  },
  getRolePermissions(role: UserRole): RolePermissions {
    const matrix = this.getPermissionsMatrix();
    return matrix[role] || INITIAL_PERMISSIONS_MATRIX[role];
  },
  hasUserPermission(user: UserProfile, permission: keyof RolePermissions): boolean {
    if (user.role === 'admin') return true;
    if (user.customPermissions && user.customPermissions[permission] !== undefined) {
      return Boolean(user.customPermissions[permission]);
    }
    const rolePerms = this.getRolePermissions(user.role);
    return Boolean(rolePerms[permission]);
  },

  // Auth / Users
  getUsers(): UserProfile[] {
    const u = getStored<UserProfile[]>(STORAGE_KEYS.USERS, INITIAL_USERS);
    return Array.isArray(u) ? u : INITIAL_USERS;
  },
  getEmployees(): UserProfile[] {
    return this.getUsers().filter((u) => u.role !== 'cliente');
  },
  getCustomers(): UserProfile[] {
    return this.getUsers().filter((u) => u.role === 'cliente');
  },
  saveUser(user: UserProfile): void {
    const users = this.getUsers();
    const idx = users.findIndex((u) => u.id === user.id);
    if (idx >= 0) {
      users[idx] = user;
    } else {
      users.push(user);
    }
    setStored(STORAGE_KEYS.USERS, users);
    
    // If saving the currently logged in user, update current user too
    const current = this.getCurrentUser();
    if (current && current.id === user.id) {
      this.setCurrentUser(user);
    }
  },
  deleteUser(userId: string): void {
    const users = this.getUsers().filter((u) => u.id !== userId);
    setStored(STORAGE_KEYS.USERS, users);
  },
  toggleUserStatus(userId: string): UserProfile | undefined {
    const users = this.getUsers();
    const target = users.find((u) => u.id === userId);
    if (target) {
      target.status = target.status === 'inativo' ? 'ativo' : 'inativo';
      setStored(STORAGE_KEYS.USERS, users);
      return target;
    }
    return undefined;
  },
  getCurrentUser(): UserProfile {
    return getStored<UserProfile>(STORAGE_KEYS.CURRENT_USER, INITIAL_USERS[0]); // Default admin for smooth testing
  },
  setCurrentUser(user: UserProfile): void {
    setStored(STORAGE_KEYS.CURRENT_USER, user);
  },
  switchRole(role: UserRole): UserProfile {
    const users = this.getUsers();
    let target = users.find((u) => u.role === role);
    if (!target) {
      target = {
        id: `user_${role}`,
        name: `Usuário ${role.toUpperCase()}`,
        email: `${role}@mbpersonaliza.com.br`,
        phone: '(11) 98000-0000',
        company: 'MB Personaliza',
        role,
        department: role === 'admin' ? 'Diretoria' : role === 'gerente' ? 'Gerência' : role === 'vendedor' ? 'Vendas' : 'Almoxarifado',
        status: 'ativo',
        createdAt: new Date().toISOString(),
      };
    }
    this.setCurrentUser(target);
    return target;
  },

  // Specialized Login & Register
  loginEmployee(email: string, password?: string): { success: boolean; user?: UserProfile; message?: string } {
    const users = this.getUsers();
    const cleanEmail = email.trim().toLowerCase();
    const found = users.find(
      (u) => u.email.toLowerCase() === cleanEmail && u.role !== 'cliente'
    );

    if (!found) {
      return {
        success: false,
        message: 'E-mail corporativo não encontrado ou usuário não é colaborador da empresa.',
      };
    }

    if (found.status === 'inativo') {
      return {
        success: false,
        message: 'Este acesso corporativo está desativado. Entre em contato com a Diretoria.',
      };
    }

    // In demo environment, if password provided check or accept
    if (password && found.password && found.password !== password) {
      return {
        success: false,
        message: 'Senha incorreta para esta conta corporativa.',
      };
    }

    found.lastLogin = new Date().toISOString();
    this.saveUser(found);
    this.setCurrentUser(found);
    return { success: true, user: found };
  },

  loginCustomer(email: string, _password?: string): { success: boolean; user?: UserProfile; message?: string } {
    const users = this.getUsers();
    const cleanEmail = email.trim().toLowerCase();
    let found = users.find((u) => u.email.toLowerCase() === cleanEmail);

    if (!found) {
      // Auto register demo customer if not found
      const newCustomer: UserProfile = {
        id: `cust-${Date.now()}`,
        name: cleanEmail.split('@')[0].toUpperCase(),
        email: cleanEmail,
        phone: '(11) 98888-7777',
        role: 'cliente',
        status: 'ativo',
        createdAt: new Date().toISOString(),
        lastLogin: new Date().toISOString(),
      };
      this.saveUser(newCustomer);
      this.setCurrentUser(newCustomer);
      return { success: true, user: newCustomer };
    }

    if (found.status === 'inativo') {
      return {
        success: false,
        message: 'Esta conta de cliente está suspensa temporariamente.',
      };
    }

    found.lastLogin = new Date().toISOString();
    this.saveUser(found);
    this.setCurrentUser(found);
    return { success: true, user: found };
  },

  // Auth / Login fallback helper
  login(email: string, password?: string): UserProfile | null {
    const users = this.getUsers();
    const found = users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
    if (found) {
      found.lastLogin = new Date().toISOString();
      this.saveUser(found);
      this.setCurrentUser(found);
      return found;
    }
    return null;
  },

  // Cart
  getCart(): CartItem[] {
    const c = getStored<CartItem[]>(STORAGE_KEYS.CART, []);
    return Array.isArray(c) ? c : [];
  },
  saveCart(cart: CartItem[]): void {
    setStored(STORAGE_KEYS.CART, cart);
  },
  addToCart(item: CartItem): void {
    const cart = this.getCart();
    const existingIndex = cart.findIndex(
      (c) =>
        c.product.id === item.product.id &&
        c.variant?.id === item.variant?.id &&
        c.customTechnique === item.customTechnique
    );
    if (existingIndex >= 0) {
      cart[existingIndex].quantity += item.quantity;
      cart[existingIndex].calculatedUnitPrice = this.calculateUnitPrice(
        cart[existingIndex].product,
        cart[existingIndex].quantity
      );
    } else {
      cart.push(item);
    }
    this.saveCart(cart);
  },
  removeFromCart(id: string): void {
    const cart = this.getCart().filter((c) => c.id !== id);
    this.saveCart(cart);
  },
  updateCartQty(id: string, qty: number): void {
    const cart = this.getCart();
    const item = cart.find((c) => c.id === id);
    if (item) {
      item.quantity = Math.max(item.product.min_order_qty || 1, qty);
      item.calculatedUnitPrice = this.calculateUnitPrice(item.product, item.quantity);
      this.saveCart(cart);
    }
  },
  updateCartItemQuantity(id: string, qty: number): void {
    this.updateCartQty(id, qty);
  },
  clearCart(): void {
    this.saveCart([]);
  },

  // Update order tracking code
  updateOrderTracking(orderId: string, trackingCode: string): void {
    this.updateOrderStatus(orderId, undefined as any, trackingCode);
  },

  // Stock adjustment helper
  adjustStock(
    productId: string,
    quantity: number,
    type: 'entrada' | 'saida' | 'ajuste' = 'entrada',
    reason = 'Ajuste manual de estoque',
    operator_name = 'Administrador'
  ): void {
    const product = this.getProducts().find((p) => p.id === productId);
    if (!product) return;
    this.recordStockMovement({
      productId,
      productName: product.name,
      productSku: product.code,
      type,
      quantity,
      reason,
      operator_name,
    });
  },

  // Pricing Helpers
  calculateUnitPrice(product: Product, quantity: number): number {
    if (!product.show_price) return 0;
    if (product.price_tiers && product.price_tiers.length > 0) {
      // Find tier that matches
      const sortedTiers = [...product.price_tiers].sort((a, b) => b.min_qty - a.min_qty);
      const matchingTier = sortedTiers.find(
        (t) => quantity >= t.min_qty && (t.max_qty === undefined || quantity <= t.max_qty)
      );
      if (matchingTier) {
        return matchingTier.unit_price;
      }
    }
    return product.promo_price || product.base_price;
  },

  // Reset to initial demo data
  resetAllData(): void {
    localStorage.clear();
    setStored(STORAGE_KEYS.PRODUCTS, INITIAL_PRODUCTS);
    setStored(STORAGE_KEYS.CATEGORIES, INITIAL_CATEGORIES);
    setStored(STORAGE_KEYS.SUBCATEGORIES, INITIAL_SUBCATEGORIES);
    setStored(STORAGE_KEYS.QUOTES, INITIAL_QUOTES);
    setStored(STORAGE_KEYS.ORDERS, INITIAL_ORDERS);
    setStored(STORAGE_KEYS.STOCK_MOVEMENTS, INITIAL_STOCK_MOVEMENTS);
    setStored(STORAGE_KEYS.USERS, INITIAL_USERS);
    setStored(STORAGE_KEYS.CURRENT_USER, INITIAL_USERS[0]);
    setStored(STORAGE_KEYS.CART, []);
    window.location.reload();
  },
};

export function hasPermission(
  role: UserRole,
  permission:
    | 'view_admin'
    | 'manage_products'
    | 'manage_pricing'
    | 'manage_stock'
    | 'manage_quotes'
    | 'manage_orders'
    | 'manage_users'
): boolean {
  switch (role) {
    case 'admin':
      return true;
    case 'gerente':
      return permission !== 'manage_users';
    case 'vendedor':
      return ['view_admin', 'manage_quotes', 'manage_orders'].includes(permission);
    case 'estoquista':
      return ['view_admin', 'manage_stock', 'manage_orders'].includes(permission);
    case 'cliente':
      return false;
    default:
      return false;
  }
}
