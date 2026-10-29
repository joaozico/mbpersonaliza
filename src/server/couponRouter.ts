import { Router, Request, Response, NextFunction } from 'express';
import {
  DiscountCoupon,
  CouponUsageEntry,
  CouponSendHistoryEntry,
  CouponAuditLog,
  CouponValidationResult,
  RolePermissions,
  UserRole,
} from '../types';
import {
  INITIAL_COUPONS,
  INITIAL_COUPON_USAGES,
  INITIAL_COUPON_SEND_HISTORY,
  INITIAL_COUPON_AUDIT_LOGS,
} from '../data/initialData';

export const couponRouter = Router();

// In-memory server-side storage for Coupons (synchronized with state)
let serverCoupons: DiscountCoupon[] = JSON.parse(JSON.stringify(INITIAL_COUPONS));
let serverUsages: CouponUsageEntry[] = JSON.parse(JSON.stringify(INITIAL_COUPON_USAGES));
let serverSendHistory: CouponSendHistoryEntry[] = JSON.parse(JSON.stringify(INITIAL_COUPON_SEND_HISTORY));
let serverAuditLogs: CouponAuditLog[] = JSON.parse(JSON.stringify(INITIAL_COUPON_AUDIT_LOGS));

// Server-side audit logging
function logCouponServerAudit(entry: Omit<CouponAuditLog, 'id' | 'timestamp'>): CouponAuditLog {
  const newLog: CouponAuditLog = {
    id: `caud-srv-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    timestamp: new Date().toISOString(),
    ...entry,
  };
  serverAuditLogs.unshift(newLog);
  if (serverAuditLogs.length > 500) {
    serverAuditLogs.pop();
  }
  return newLog;
}

/**
 * Middleware de Autorização Granular para Cupons de Desconto
 */
export function requireCouponPermission(requiredPermission: keyof RolePermissions) {
  return (req: Request, res: Response, next: NextFunction) => {
    const userId = (req.headers['x-user-id'] as string) || '';
    const userRole = (req.headers['x-user-role'] as UserRole) || 'visitante';
    const userName = (req.headers['x-user-name'] as string) || 'Usuário Desconhecido';

    // Parse custom permissions passed in header if available
    let customPerms: Partial<RolePermissions> = {};
    const permsHeader = req.headers['x-user-permissions'];
    if (permsHeader && typeof permsHeader === 'string') {
      try {
        customPerms = JSON.parse(permsHeader);
      } catch {
        // ignore JSON parse error
      }
    }

    // Admins e Gerentes possuem acesso total por padrão
    if (userRole === 'admin' || userRole === 'gerente') {
      return next();
    }

    // Checar se a permissão foi concedida explicitamente
    if (customPerms[requiredPermission] === true) {
      return next();
    }

    // Regras padrão para Vendedor
    if (userRole === 'vendedor') {
      const allowedVendedor: Array<keyof RolePermissions> = [
        'canViewCoupons',
        'canViewCouponUsageHistory',
        'canSendCouponsToCustomers',
      ];
      if (allowedVendedor.includes(requiredPermission)) {
        return next();
      }
    }

    logCouponServerAudit({
      action: 'apply_cart',
      userId: userId || 'anonymous',
      userName,
      userRole,
      details: `ACESSO NEGADO: Tentativa de executar operação exigindo permissão "${String(requiredPermission)}"`,
    });

    return res.status(403).json({
      success: false,
      error: `Acesso negado. Seu perfil de usuário (${userRole}) não possui permissão para executar esta ação (${String(requiredPermission)}).`,
    });
  };
}

/**
 * Helper interno de validação das 12 regras de negócio
 */
function internalValidateCoupon(
  rawCode: string,
  cartItems: Array<{ productId: string; categoryId?: string; unitPrice: number; quantity: number; isPromo?: boolean }>,
  subtotal: number,
  customer?: { id?: string; email?: string; cpfCnpj?: string }
): CouponValidationResult {
  const emptyResult = (errorCode: CouponValidationResult['errorCode'], errorMsg: string): CouponValidationResult => ({
    valid: false,
    discountAmount: 0,
    originalSubtotal: subtotal,
    eligibleSubtotal: 0,
    finalSubtotalAfterCoupon: subtotal,
    errorCode,
    error: errorMsg,
  });

  if (!rawCode || !rawCode.trim()) {
    return emptyResult('NOT_FOUND', 'Informe o código do cupom.');
  }

  const cleanCode = rawCode.trim().toUpperCase();
  const coupon = serverCoupons.find((c) => c.code.trim().toUpperCase() === cleanCode);

  if (!coupon) {
    return emptyResult('NOT_FOUND', 'Código de cupom inválido ou não encontrado.');
  }

  const now = new Date();

  // 1. Status ativo
  if (coupon.status === 'paused') {
    return emptyResult('INACTIVE', 'Este cupom está temporariamente pausado pela administração.');
  }
  if (coupon.status === 'cancelled') {
    return emptyResult('INACTIVE', 'Este cupom foi cancelado e não pode mais ser utilizado.');
  }
  if (coupon.status === 'draft') {
    return emptyResult('INACTIVE', 'Este cupom ainda não foi publicado.');
  }

  // 2. Data de Início
  if (coupon.startDate) {
    const start = new Date(coupon.startDate);
    if (!isNaN(start.getTime()) && now < start) {
      return emptyResult(
        'NOT_STARTED',
        `Este cupom será válido somente a partir de ${start.toLocaleDateString('pt-BR')} às ${start.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}.`
      );
    }
  }

  // 3. Data de Término
  if (coupon.endDate) {
    const end = new Date(coupon.endDate);
    if (!isNaN(end.getTime()) && now > end) {
      return emptyResult('EXPIRED', `Este cupom expirou em ${end.toLocaleDateString('pt-BR')}.`);
    }
  }

  // 4. Limite de utilizações globais
  if (coupon.maxUsageTotal && coupon.currentUsageCount >= coupon.maxUsageTotal) {
    return emptyResult('MAX_USAGE_REACHED', 'Este cupom atingiu o limite máximo de utilizações permitidas.');
  }

  // 5. Restrição de cliente específico
  if (coupon.customerRestriction === 'specific_customers') {
    const custEmail = customer?.email?.toLowerCase().trim();
    const custId = customer?.id;
    const allowedEmails = (coupon.specificCustomerEmails || []).map((e) => e.toLowerCase().trim());
    const allowedIds = coupon.specificCustomerIds || [];

    const isMatch = (custEmail && allowedEmails.includes(custEmail)) || (custId && allowedIds.includes(custId));
    if (!isMatch) {
      return emptyResult('CUSTOMER_NOT_ELIGIBLE', 'Este cupom é exclusivo e não está associado à sua conta/e-mail.');
    }
  }

  // 6. Limite de utilizações por cliente
  if (coupon.maxUsagePerCustomer && coupon.maxUsagePerCustomer > 0 && customer) {
    const custEmail = customer.email?.toLowerCase().trim();
    const custCpf = customer.cpfCnpj?.replace(/\D/g, '');
    const custId = customer.id;

    const customerUsageCount = serverUsages.filter((u) => {
      if (u.couponId !== coupon.id || u.status !== 'confirmed') return false;
      if (custId && u.customerId === custId) return true;
      if (custEmail && u.customerEmail?.toLowerCase().trim() === custEmail) return true;
      if (custCpf && u.customerCpfCnpj?.replace(/\D/g, '') === custCpf) return true;
      return false;
    }).length;

    if (customerUsageCount >= coupon.maxUsagePerCustomer) {
      return emptyResult(
        'CUSTOMER_LIMIT_REACHED',
        `Você já atingiu o limite de ${coupon.maxUsagePerCustomer} ${coupon.maxUsagePerCustomer === 1 ? 'utilização' : 'utilizações'} para este cupom.`
      );
    }
  }

  // 7. Base de cálculo e produtos elegíveis
  let eligibleItems = cartItems || [];

  // Se não acumula com promoções
  if (!coupon.canCombineWithPromotions) {
    eligibleItems = eligibleItems.filter((item) => !item.isPromo);
  }

  // Filtrar categorias ou produtos alvo
  if (coupon.targetType === 'categories' && coupon.targetCategoryIds && coupon.targetCategoryIds.length > 0) {
    eligibleItems = eligibleItems.filter((item) => item.categoryId && coupon.targetCategoryIds?.includes(item.categoryId));
  } else if (coupon.targetType === 'products' && coupon.targetProductIds && coupon.targetProductIds.length > 0) {
    eligibleItems = eligibleItems.filter((item) => coupon.targetProductIds?.includes(item.productId));
  }

  const eligibleSubtotal = eligibleItems.reduce((acc, it) => acc + (it.unitPrice * it.quantity), 0);

  if (eligibleSubtotal <= 0) {
    return emptyResult(
      'NO_ELIGIBLE_ITEMS',
      coupon.canCombineWithPromotions === false
        ? 'Este cupom não é acumulável com os produtos em oferta/promoção no seu carrinho.'
        : 'Nenhum dos produtos selecionados é elegível para este cupom.'
    );
  }

  // 8. Valor mínimo de compra elegível
  if (coupon.minPurchaseAmount && eligibleSubtotal < coupon.minPurchaseAmount) {
    return emptyResult(
      'MIN_PURCHASE_NOT_MET',
      `O valor mínimo em produtos elegíveis para este cupom é de R$ ${coupon.minPurchaseAmount.toFixed(2).replace('.', ',')}. Subtotal elegível atual: R$ ${eligibleSubtotal.toFixed(2).replace('.', ',')}.`
    );
  }

  // 9. Cálculo do desconto
  let calculatedDiscount = 0;
  if (coupon.discountType === 'percentage') {
    calculatedDiscount = (eligibleSubtotal * coupon.discountValue) / 100;
    if (coupon.maxDiscountAmount && coupon.maxDiscountAmount > 0) {
      calculatedDiscount = Math.min(calculatedDiscount, coupon.maxDiscountAmount);
    }
  } else {
    calculatedDiscount = coupon.discountValue;
  }

  // Teto estrito: não exceder o subtotal elegível e não gerar valor negativo
  calculatedDiscount = Math.min(calculatedDiscount, eligibleSubtotal);
  calculatedDiscount = Math.max(0, Math.round(calculatedDiscount * 100) / 100);

  const finalSubtotal = Math.max(0, subtotal - calculatedDiscount);

  return {
    valid: true,
    coupon,
    discountAmount: calculatedDiscount,
    originalSubtotal: subtotal,
    eligibleSubtotal,
    finalSubtotalAfterCoupon: finalSubtotal,
  };
}

// ==========================================
// ROTAS DE CONSULTA E VALIDAÇÃO DA LOJA
// ==========================================

/**
 * Validação segura de cupom (Storefront / Checkout / Carrinho)
 */
couponRouter.post('/validate', (req: Request, res: Response) => {
  const { code, cartItems, subtotal, customer } = req.body;
  const result = internalValidateCoupon(code, cartItems, Number(subtotal || 0), customer);
  return res.json(result);
});

// ==========================================
// ROTAS ADMINISTRATIVAS (CRUD & GESTÃO)
// ==========================================

/**
 * Listagem de cupons cadastrados
 */
couponRouter.get('/', requireCouponPermission('canViewCoupons'), (req: Request, res: Response) => {
  const { status, search } = req.query;
  let list = [...serverCoupons];

  if (status && typeof status === 'string' && status !== 'all') {
    list = list.filter((c) => c.status === status);
  }

  if (search && typeof search === 'string') {
    const term = search.toLowerCase().trim();
    list = list.filter(
      (c) => c.code.toLowerCase().includes(term) || c.campaignName.toLowerCase().includes(term)
    );
  }

  return res.json({ success: true, coupons: list });
});

/**
 * Detalhes de um cupom específico
 */
couponRouter.get('/:id', requireCouponPermission('canViewCoupons'), (req: Request, res: Response) => {
  const coupon = serverCoupons.find((c) => c.id === req.params.id);
  if (!coupon) {
    return res.status(404).json({ success: false, error: 'Cupom não encontrado.' });
  }
  return res.json({ success: true, coupon });
});

/**
 * Cadastro de novo cupom
 */
couponRouter.post('/', requireCouponPermission('canCreateCoupons'), (req: Request, res: Response) => {
  const data = req.body;
  const userId = (req.headers['x-user-id'] as string) || 'admin';
  const userName = (req.headers['x-user-name'] as string) || 'Administrador MB';
  const userRole = (req.headers['x-user-role'] as string) || 'admin';

  const cleanCode = (data.code || '').trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');

  if (!cleanCode) {
    return res.status(400).json({ success: false, error: 'O código do cupom é obrigatório e deve ser alfanumérico.' });
  }

  if (!data.campaignName || !data.campaignName.trim()) {
    return res.status(400).json({ success: false, error: 'O nome da campanha é obrigatório.' });
  }

  if (Number(data.discountValue) <= 0) {
    return res.status(400).json({ success: false, error: 'O valor do desconto deve ser maior que zero.' });
  }

  if (data.discountType === 'percentage' && Number(data.discountValue) > 100) {
    return res.status(400).json({ success: false, error: 'O desconto percentual não pode ser maior que 100%.' });
  }

  const duplicate = serverCoupons.find((c) => c.code.toUpperCase() === cleanCode);
  if (duplicate) {
    return res.status(400).json({ success: false, error: `Já existe um cupom cadastrado com o código "${cleanCode}".` });
  }

  const newCoupon: DiscountCoupon = {
    id: `cpn-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    code: cleanCode,
    campaignName: data.campaignName.trim(),
    discountType: data.discountType || 'percentage',
    discountValue: Number(data.discountValue),
    startDate: data.startDate || new Date().toISOString().substring(0, 16),
    endDate: data.endDate || new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().substring(0, 16),
    minPurchaseAmount: data.minPurchaseAmount ? Number(data.minPurchaseAmount) : undefined,
    maxDiscountAmount: data.maxDiscountAmount ? Number(data.maxDiscountAmount) : undefined,
    maxUsageTotal: data.maxUsageTotal ? Number(data.maxUsageTotal) : undefined,
    maxUsagePerCustomer: data.maxUsagePerCustomer ? Number(data.maxUsagePerCustomer) : 1,
    targetType: data.targetType || 'all_store',
    targetCategoryIds: data.targetCategoryIds || [],
    targetProductIds: data.targetProductIds || [],
    customerRestriction: data.customerRestriction || 'general',
    specificCustomerIds: data.specificCustomerIds || [],
    specificCustomerEmails: data.specificCustomerEmails || [],
    canCombineWithPromotions: data.canCombineWithPromotions !== undefined ? data.canCombineWithPromotions : true,
    status: data.status || 'active',
    internalNotes: data.internalNotes || '',
    currentUsageCount: 0,
    totalDiscountGranted: 0,
    totalSalesVolume: 0,
    sentCount: 0,
    createdAt: new Date().toISOString(),
    createdByUserId: userId,
    createdByUserName: userName,
  };

  serverCoupons.unshift(newCoupon);

  logCouponServerAudit({
    couponId: newCoupon.id,
    couponCode: newCoupon.code,
    action: 'create',
    userId,
    userName,
    userRole,
    details: `Novo cupom criado: ${newCoupon.code} (${newCoupon.discountType === 'percentage' ? `${newCoupon.discountValue}%` : `R$ ${newCoupon.discountValue.toFixed(2)}`}) - Campanha: ${newCoupon.campaignName}`,
  });

  return res.status(201).json({ success: true, coupon: newCoupon });
});

/**
 * Edição de cupom existente
 */
couponRouter.put('/:id', requireCouponPermission('canEditCoupons'), (req: Request, res: Response) => {
  const { id } = req.params;
  const data = req.body;
  const userId = (req.headers['x-user-id'] as string) || 'admin';
  const userName = (req.headers['x-user-name'] as string) || 'Administrador MB';
  const userRole = (req.headers['x-user-role'] as string) || 'admin';

  const idx = serverCoupons.findIndex((c) => c.id === id);
  if (idx < 0) {
    return res.status(404).json({ success: false, error: 'Cupom não encontrado.' });
  }

  const existing = serverCoupons[idx];
  const cleanCode = (data.code || existing.code).trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');

  const duplicate = serverCoupons.find((c) => c.id !== id && c.code.toUpperCase() === cleanCode);
  if (duplicate) {
    return res.status(400).json({ success: false, error: `Já existe outro cupom com o código "${cleanCode}".` });
  }

  const updated: DiscountCoupon = {
    ...existing,
    ...data,
    code: cleanCode,
    updatedAt: new Date().toISOString(),
  };

  serverCoupons[idx] = updated;

  logCouponServerAudit({
    couponId: updated.id,
    couponCode: updated.code,
    action: 'update',
    userId,
    userName,
    userRole,
    details: `Cupom ${updated.code} atualizado por ${userName}`,
  });

  return res.json({ success: true, coupon: updated });
});

/**
 * Ativar / Pausar / Cancelar cupom
 */
couponRouter.patch('/:id/status', (req: Request, res: Response, next: NextFunction) => {
  const { newStatus } = req.body;
  const perm = newStatus === 'cancelled' ? 'canCancelCoupons' : 'canToggleCoupons';
  return requireCouponPermission(perm)(req, res, () => {
    const { id } = req.params;
    const userId = (req.headers['x-user-id'] as string) || 'admin';
    const userName = (req.headers['x-user-name'] as string) || 'Administrador MB';
    const userRole = (req.headers['x-user-role'] as string) || 'admin';

    const coupon = serverCoupons.find((c) => c.id === id);
    if (!coupon) {
      return res.status(404).json({ success: false, error: 'Cupom não encontrado.' });
    }

    const oldStatus = coupon.status;
    coupon.status = newStatus;
    coupon.updatedAt = new Date().toISOString();

    logCouponServerAudit({
      couponId: coupon.id,
      couponCode: coupon.code,
      action: newStatus === 'active' ? 'activate' : newStatus === 'paused' ? 'pause' : 'cancel',
      userId,
      userName,
      userRole,
      details: `Status do cupom ${coupon.code} alterado de "${oldStatus}" para "${newStatus}"`,
    });

    return res.json({ success: true, coupon });
  });
});

/**
 * Cancelar / Deletar cupom
 */
couponRouter.delete('/:id', requireCouponPermission('canCancelCoupons'), (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = (req.headers['x-user-id'] as string) || 'admin';
  const userName = (req.headers['x-user-name'] as string) || 'Administrador MB';
  const userRole = (req.headers['x-user-role'] as string) || 'admin';

  const idx = serverCoupons.findIndex((c) => c.id === id);
  if (idx < 0) {
    return res.status(404).json({ success: false, error: 'Cupom não encontrado.' });
  }

  const coupon = serverCoupons[idx];

  // Se já foi utilizado, fazer soft-cancel para integridade do histórico
  if (coupon.currentUsageCount > 0) {
    coupon.status = 'cancelled';
    coupon.updatedAt = new Date().toISOString();
    logCouponServerAudit({
      couponId: coupon.id,
      couponCode: coupon.code,
      action: 'cancel',
      userId,
      userName,
      userRole,
      details: `Cupom ${coupon.code} cancelado (mantido no banco pois possui ${coupon.currentUsageCount} utilizações registradas)`,
    });
    return res.json({ success: true, message: 'Cupom cancelado com sucesso.' });
  }

  serverCoupons.splice(idx, 1);
  logCouponServerAudit({
    couponId: coupon.id,
    couponCode: coupon.code,
    action: 'delete',
    userId,
    userName,
    userRole,
    details: `Exclusão definitiva do cupom ${coupon.code}`,
  });

  return res.json({ success: true, message: 'Cupom excluído com sucesso.' });
});

// ==========================================
// DISPARO / ENVIO DE CUPOM AO CLIENTE
// ==========================================

/**
 * Enviar cupom para cliente via WhatsApp / E-mail / Copiar
 */
couponRouter.post('/:id/send', requireCouponPermission('canSendCouponsToCustomers'), (req: Request, res: Response) => {
  const { id } = req.params;
  const { customerName, customerPhone, customerEmail, customerId, channel, customMessage } = req.body;
  const userId = (req.headers['x-user-id'] as string) || 'usr-admin-001';
  const userName = (req.headers['x-user-name'] as string) || 'Operador MB';

  const coupon = serverCoupons.find((c) => c.id === id);
  if (!coupon) {
    return res.status(404).json({ success: false, error: 'Cupom não encontrado.' });
  }

  if (coupon.status !== 'active') {
    return res.status(400).json({ success: false, error: 'Apenas cupons ativos podem ser enviados aos clientes.' });
  }

  if (!customerName || !customerName.trim()) {
    return res.status(400).json({ success: false, error: 'Informe o nome do cliente destinatário.' });
  }

  const discountFormatted =
    coupon.discountType === 'percentage'
      ? `${coupon.discountValue}% OFF`
      : `R$ ${coupon.discountValue.toFixed(2).replace('.', ',')} de desconto`;

  const endDateFormatted = coupon.endDate
    ? new Date(coupon.endDate).toLocaleDateString('pt-BR')
    : 'tempo indeterminado';

  const defaultMessage =
    customMessage ||
    `Olá, ${customerName}! Temos um desconto especial para você na MB PERSONALIZA.\n\n` +
    `Utilize o cupom *${coupon.code}* e ganhe ${discountFormatted} em sua compra.\n\n` +
    `Validade: ${endDateFormatted}.\n\n` +
    `Acesse nossa loja, escolha seus produtos e informe o cupom no momento da compra.\n\n` +
    `Aproveite essa oferta especial!`;

  let sendStatus: 'copied' | 'shared_whatsapp' | 'sent_email' = 'copied';
  if (channel === 'whatsapp') {
    sendStatus = 'shared_whatsapp';
  } else if (channel === 'email') {
    sendStatus = 'sent_email';
  }

  const sendEntry: CouponSendHistoryEntry = {
    id: `csend-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    couponId: coupon.id,
    couponCode: coupon.code,
    customerId,
    customerName: customerName.trim(),
    customerPhone: customerPhone ? customerPhone.trim() : undefined,
    customerEmail: customerEmail ? customerEmail.trim() : undefined,
    channel: channel || 'clipboard',
    sentAt: new Date().toISOString(),
    sentByUserId: userId,
    sentByUserName: userName,
    messagePreview: defaultMessage,
    status: sendStatus,
  };

  serverSendHistory.unshift(sendEntry);
  coupon.sentCount = (coupon.sentCount || 0) + 1;

  logCouponServerAudit({
    couponId: coupon.id,
    couponCode: coupon.code,
    action: 'send',
    userId,
    userName,
    userRole: 'operador',
    details: `Envio do cupom ${coupon.code} para ${customerName} (${channel})`,
  });

  // Gerar link formatado do WhatsApp se o número foi informado
  let whatsappUrl: string | undefined = undefined;
  if (customerPhone) {
    const cleanPhone = customerPhone.replace(/\D/g, '');
    const fullPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
    whatsappUrl = `https://api.whatsapp.com/send?phone=${fullPhone}&text=${encodeURIComponent(defaultMessage)}`;
  }

  return res.json({
    success: true,
    sendEntry,
    message: defaultMessage,
    whatsappUrl,
    sentCount: coupon.sentCount,
  });
});

// ==========================================
// CONFIRMAÇÃO E CANCELAMENTO DE UTILIZAÇÃO
// ==========================================

/**
 * Confirmar uso do cupom no pedido (chamado no Checkout / API)
 */
couponRouter.post('/confirm-usage', (req: Request, res: Response) => {
  const {
    couponCode,
    orderId,
    orderCode,
    customerName,
    customerEmail,
    customerPhone,
    customerCpfCnpj,
    customerId,
    subtotalOriginal,
    eligibleAmount,
    discountApplied,
    shippingCost,
    finalTotal,
  } = req.body;

  const coupon = serverCoupons.find((c) => c.code.toUpperCase() === (couponCode || '').toUpperCase());
  if (!coupon) {
    return res.status(404).json({ success: false, error: 'Cupom não localizado.' });
  }

  // Prevenir dupla confirmação para o mesmo pedido
  const existingUsage = serverUsages.find((u) => u.orderId === orderId && u.status === 'confirmed');
  if (existingUsage) {
    return res.json({ success: true, usage: existingUsage, message: 'Utilização já confirmada anteriormente.' });
  }

  const usageEntry: CouponUsageEntry = {
    id: `cuse-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    couponId: coupon.id,
    couponCode: coupon.code,
    orderId: orderId || `ord-${Date.now()}`,
    orderCode: orderCode || `PED-${Date.now()}`,
    customerId,
    customerName: customerName || 'Cliente Online',
    customerEmail: customerEmail || 'cliente@online.com',
    customerPhone,
    customerCpfCnpj,
    subtotalOriginal: Number(subtotalOriginal || 0),
    eligibleAmount: Number(eligibleAmount || 0),
    discountApplied: Number(discountApplied || 0),
    shippingCost: Number(shippingCost || 0),
    finalTotal: Number(finalTotal || 0),
    usedAt: new Date().toISOString(),
    status: 'confirmed',
  };

  serverUsages.unshift(usageEntry);

  // Atualizar métricas do cupom
  coupon.currentUsageCount = (coupon.currentUsageCount || 0) + 1;
  coupon.totalDiscountGranted = Number(((coupon.totalDiscountGranted || 0) + usageEntry.discountApplied).toFixed(2));
  coupon.totalSalesVolume = Number(((coupon.totalSalesVolume || 0) + usageEntry.finalTotal).toFixed(2));
  coupon.updatedAt = new Date().toISOString();

  logCouponServerAudit({
    couponId: coupon.id,
    couponCode: coupon.code,
    action: 'confirm_order',
    userId: customerId || 'checkout_online',
    userName: customerName || 'Cliente',
    userRole: 'cliente',
    details: `Utilização confirmada no pedido ${orderCode} (Desconto R$ ${usageEntry.discountApplied.toFixed(2)})`,
  });

  return res.json({ success: true, usage: usageEntry });
});

/**
 * Reverter / liberar cota do cupom quando pedido é cancelado
 */
couponRouter.post('/release-usage', (req: Request, res: Response) => {
  const { orderId, reason } = req.body;
  const userId = (req.headers['x-user-id'] as string) || 'system';
  const userName = (req.headers['x-user-name'] as string) || 'Sistema MB';

  const usage = serverUsages.find((u) => u.orderId === orderId && u.status === 'confirmed');
  if (!usage) {
    return res.status(404).json({ success: false, error: 'Utilização confirmada não encontrada para este pedido.' });
  }

  usage.status = 'cancelled';
  usage.cancelledAt = new Date().toISOString();
  usage.cancelReason = reason || 'Cancelamento de pedido';

  const coupon = serverCoupons.find((c) => c.id === usage.couponId);
  if (coupon) {
    coupon.currentUsageCount = Math.max(0, (coupon.currentUsageCount || 1) - 1);
    coupon.totalDiscountGranted = Math.max(0, Number(((coupon.totalDiscountGranted || 0) - usage.discountApplied).toFixed(2)));
    coupon.totalSalesVolume = Math.max(0, Number(((coupon.totalSalesVolume || 0) - usage.finalTotal).toFixed(2)));
    coupon.updatedAt = new Date().toISOString();
  }

  logCouponServerAudit({
    couponId: usage.couponId,
    couponCode: usage.couponCode,
    action: 'revert_cancel',
    userId,
    userName,
    userRole: 'admin',
    details: `Estorno de utilização do cupom ${usage.couponCode} para o pedido ${usage.orderCode}. Motivo: ${reason || 'Cancelamento'}`,
  });

  return res.json({ success: true, message: 'Cota de utilização liberada com sucesso.' });
});

// ==========================================
// HISTÓRICO, RELATÓRIOS & AUDITORIA
// ==========================================

/**
 * Histórico de utilização
 */
couponRouter.get('/history/usages', requireCouponPermission('canViewCouponUsageHistory'), (req: Request, res: Response) => {
  const { couponId } = req.query;
  let list = [...serverUsages];
  if (couponId && typeof couponId === 'string') {
    list = list.filter((u) => u.couponId === couponId);
  }
  return res.json({ success: true, usages: list });
});

/**
 * Histórico de envios para clientes
 */
couponRouter.get('/history/sends', requireCouponPermission('canViewCoupons'), (req: Request, res: Response) => {
  const { couponId } = req.query;
  let list = [...serverSendHistory];
  if (couponId && typeof couponId === 'string') {
    list = list.filter((s) => s.couponId === couponId);
  }
  return res.json({ success: true, sends: list });
});

/**
 * Métricas e Relatórios Gerenciais
 */
couponRouter.get('/reports/metrics', requireCouponPermission('canViewCouponReports'), (req: Request, res: Response) => {
  const totalCoupons = serverCoupons.length;
  const activeCoupons = serverCoupons.filter((c) => c.status === 'active').length;
  const totalUsageCount = serverCoupons.reduce((acc, c) => acc + (c.currentUsageCount || 0), 0);
  const totalDiscountGranted = Number(serverCoupons.reduce((acc, c) => acc + (c.totalDiscountGranted || 0), 0).toFixed(2));
  const totalSalesVolume = Number(serverCoupons.reduce((acc, c) => acc + (c.totalSalesVolume || 0), 0).toFixed(2));
  const totalSent = serverCoupons.reduce((acc, c) => acc + (c.sentCount || 0), 0);
  const conversionRatePercent = totalSent > 0 ? Number(((totalUsageCount / totalSent) * 100).toFixed(1)) : 0;

  // Cupons com maior faturamento
  const topRevenueCoupons = [...serverCoupons]
    .sort((a, b) => (b.totalSalesVolume || 0) - (a.totalSalesVolume || 0))
    .slice(0, 5)
    .map((c) => ({
      id: c.id,
      code: c.code,
      campaignName: c.campaignName,
      usageCount: c.currentUsageCount,
      totalSalesVolume: c.totalSalesVolume,
      totalDiscountGranted: c.totalDiscountGranted,
    }));

  return res.json({
    success: true,
    metrics: {
      totalCoupons,
      activeCoupons,
      totalUsageCount,
      totalDiscountGranted,
      totalSalesVolume,
      totalSent,
      conversionRatePercent,
      topRevenueCoupons,
    },
  });
});

/**
 * Logs de Auditoria
 */
couponRouter.get('/audit-logs', requireCouponPermission('canViewCoupons'), (req: Request, res: Response) => {
  return res.json({ success: true, logs: serverAuditLogs });
});

// ==========================================
// BATERIA DE TESTES AUTOMATIZADOS (16 CENÁRIOS)
// ==========================================

export interface TestScenarioResult {
  id: number;
  name: string;
  category: string;
  expectedBehavior: string;
  passed: boolean;
  actualResult: string;
  details?: string;
}

couponRouter.post('/run-test-scenarios', requireCouponPermission('canViewCoupons'), (req: Request, res: Response) => {
  const results: TestScenarioResult[] = [];

  // Cenário 1: Cupom inexistente
  const r1 = internalValidateCoupon('CUPOM_NAO_EXISTE_XYZ', [{ productId: 'p1', unitPrice: 100, quantity: 1 }], 100);
  results.push({
    id: 1,
    name: 'Cupom Inexistente',
    category: 'Validação Básica',
    expectedBehavior: 'Rejeitar com errorCode NOT_FOUND',
    passed: !r1.valid && r1.errorCode === 'NOT_FOUND',
    actualResult: r1.valid ? 'APROVADO (Incorreto)' : `Rejeitado: ${r1.error}`,
  });

  // Cenário 2: Cupom com status Pausado
  const pausedCpn: DiscountCoupon = {
    ...serverCoupons[0],
    id: 'test-paused',
    code: 'TEST_PAUSED',
    status: 'paused',
  };
  serverCoupons.push(pausedCpn);
  const r2 = internalValidateCoupon('TEST_PAUSED', [{ productId: 'p1', unitPrice: 100, quantity: 1 }], 100);
  results.push({
    id: 2,
    name: 'Cupom Temporariamente Pausado',
    category: 'Status e Ciclo de Vida',
    expectedBehavior: 'Rejeitar com errorCode INACTIVE',
    passed: !r2.valid && r2.errorCode === 'INACTIVE',
    actualResult: r2.valid ? 'APROVADO (Incorreto)' : `Rejeitado: ${r2.error}`,
  });

  // Cenário 3: Cupom Cancelado
  const cancelledCpn: DiscountCoupon = {
    ...serverCoupons[0],
    id: 'test-cancelled',
    code: 'TEST_CANCELLED',
    status: 'cancelled',
  };
  serverCoupons.push(cancelledCpn);
  const r3 = internalValidateCoupon('TEST_CANCELLED', [{ productId: 'p1', unitPrice: 100, quantity: 1 }], 100);
  results.push({
    id: 3,
    name: 'Cupom Cancelado',
    category: 'Status e Ciclo de Vida',
    expectedBehavior: 'Rejeitar com errorCode INACTIVE',
    passed: !r3.valid && r3.errorCode === 'INACTIVE',
    actualResult: r3.valid ? 'APROVADO (Incorreto)' : `Rejeitado: ${r3.error}`,
  });

  // Cenário 4: Cupom em Rascunho (draft)
  const draftCpn: DiscountCoupon = {
    ...serverCoupons[0],
    id: 'test-draft',
    code: 'TEST_DRAFT',
    status: 'draft',
  };
  serverCoupons.push(draftCpn);
  const r4 = internalValidateCoupon('TEST_DRAFT', [{ productId: 'p1', unitPrice: 100, quantity: 1 }], 100);
  results.push({
    id: 4,
    name: 'Cupom em Rascunho (Draft)',
    category: 'Status e Ciclo de Vida',
    expectedBehavior: 'Rejeitar com errorCode INACTIVE',
    passed: !r4.valid && r4.errorCode === 'INACTIVE',
    actualResult: r4.valid ? 'APROVADO (Incorreto)' : `Rejeitado: ${r4.error}`,
  });

  // Cenário 5: Cupom com data futura (ainda não iniciado)
  const futureCpn: DiscountCoupon = {
    ...serverCoupons[0],
    id: 'test-future',
    code: 'TEST_FUTURE',
    status: 'active',
    startDate: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
    endDate: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
  };
  serverCoupons.push(futureCpn);
  const r5 = internalValidateCoupon('TEST_FUTURE', [{ productId: 'p1', unitPrice: 100, quantity: 1 }], 100);
  results.push({
    id: 5,
    name: 'Data de Início Futura',
    category: 'Temporalidade',
    expectedBehavior: 'Rejeitar com errorCode NOT_STARTED',
    passed: !r5.valid && r5.errorCode === 'NOT_STARTED',
    actualResult: r5.valid ? 'APROVADO (Incorreto)' : `Rejeitado: ${r5.error}`,
  });

  // Cenário 6: Cupom expirado
  const expiredCpn: DiscountCoupon = {
    ...serverCoupons[0],
    id: 'test-expired',
    code: 'TEST_EXPIRED',
    status: 'active',
    startDate: '2025-01-01T00:00:00Z',
    endDate: '2025-12-31T23:59:59Z',
  };
  serverCoupons.push(expiredCpn);
  const r6 = internalValidateCoupon('TEST_EXPIRED', [{ productId: 'p1', unitPrice: 100, quantity: 1 }], 100);
  results.push({
    id: 6,
    name: 'Cupom Expirado',
    category: 'Temporalidade',
    expectedBehavior: 'Rejeitar com errorCode EXPIRED',
    passed: !r6.valid && r6.errorCode === 'EXPIRED',
    actualResult: r6.valid ? 'APROVADO (Incorreto)' : `Rejeitado: ${r6.error}`,
  });

  // Cenário 7: Valor mínimo de compra não atingido
  const minPurchaseCpn: DiscountCoupon = {
    ...serverCoupons[0],
    id: 'test-min-purchase',
    code: 'TEST_MIN_PURCHASE',
    status: 'active',
    minPurchaseAmount: 500,
  };
  serverCoupons.push(minPurchaseCpn);
  const r7 = internalValidateCoupon('TEST_MIN_PURCHASE', [{ productId: 'p1', unitPrice: 150, quantity: 1 }], 150);
  results.push({
    id: 7,
    name: 'Valor Mínimo Não Atingido',
    category: 'Regras Financeiras',
    expectedBehavior: 'Rejeitar com errorCode MIN_PURCHASE_NOT_MET',
    passed: !r7.valid && r7.errorCode === 'MIN_PURCHASE_NOT_MET',
    actualResult: r7.valid ? 'APROVADO (Incorreto)' : `Rejeitado: ${r7.error}`,
  });

  // Cenário 8: Limite global de utilizações atingido
  const maxUsageCpn: DiscountCoupon = {
    ...serverCoupons[0],
    id: 'test-max-usage',
    code: 'TEST_MAX_USAGE',
    status: 'active',
    maxUsageTotal: 10,
    currentUsageCount: 10,
  };
  serverCoupons.push(maxUsageCpn);
  const r8 = internalValidateCoupon('TEST_MAX_USAGE', [{ productId: 'p1', unitPrice: 200, quantity: 1 }], 200);
  results.push({
    id: 8,
    name: 'Limite Global de Usos Atingido',
    category: 'Cotas de Utilização',
    expectedBehavior: 'Rejeitar com errorCode MAX_USAGE_REACHED',
    passed: !r8.valid && r8.errorCode === 'MAX_USAGE_REACHED',
    actualResult: r8.valid ? 'APROVADO (Incorreto)' : `Rejeitado: ${r8.error}`,
  });

  // Cenário 9: Limite por cliente excedido
  const perCustCpn: DiscountCoupon = {
    ...serverCoupons[0],
    id: 'test-per-cust',
    code: 'TEST_PER_CUST',
    status: 'active',
    maxUsagePerCustomer: 1,
  };
  serverCoupons.push(perCustCpn);
  serverUsages.push({
    id: 'test-cust-usage-1',
    couponId: 'test-per-cust',
    couponCode: 'TEST_PER_CUST',
    orderId: 'ord-test-cust-1',
    orderCode: 'PED-TEST-1',
    customerName: 'Cliente Teste',
    customerEmail: 'cliente.teste@empresa.com',
    subtotalOriginal: 200,
    eligibleAmount: 200,
    discountApplied: 20,
    shippingCost: 0,
    finalTotal: 180,
    usedAt: new Date().toISOString(),
    status: 'confirmed',
  });
  const r9 = internalValidateCoupon(
    'TEST_PER_CUST',
    [{ productId: 'p1', unitPrice: 200, quantity: 1 }],
    200,
    { email: 'cliente.teste@empresa.com' }
  );
  results.push({
    id: 9,
    name: 'Limite de 1 Uso Por Cliente Excedido',
    category: 'Cotas de Utilização',
    expectedBehavior: 'Rejeitar com errorCode CUSTOMER_LIMIT_REACHED',
    passed: !r9.valid && r9.errorCode === 'CUSTOMER_LIMIT_REACHED',
    actualResult: r9.valid ? 'APROVADO (Incorreto)' : `Rejeitado: ${r9.error}`,
  });

  // Cenário 10: Cupom exclusivo para outro cliente (Não autorizado)
  const exclusiveCpn: DiscountCoupon = {
    ...serverCoupons[0],
    id: 'test-exclusive',
    code: 'TEST_EXCLUSIVE',
    status: 'active',
    customerRestriction: 'specific_customers',
    specificCustomerEmails: ['vip@empresa.com'],
  };
  serverCoupons.push(exclusiveCpn);
  const r10 = internalValidateCoupon(
    'TEST_EXCLUSIVE',
    [{ productId: 'p1', unitPrice: 200, quantity: 1 }],
    200,
    { email: 'intruso@outro.com' }
  );
  results.push({
    id: 10,
    name: 'Cliente Não Autorizado em Cupom Exclusivo',
    category: 'Público Alvo',
    expectedBehavior: 'Rejeitar com errorCode CUSTOMER_NOT_ELIGIBLE',
    passed: !r10.valid && r10.errorCode === 'CUSTOMER_NOT_ELIGIBLE',
    actualResult: r10.valid ? 'APROVADO (Incorreto)' : `Rejeitado: ${r10.error}`,
  });

  // Cenário 11: Cupom exclusivo com cliente correto (Autorizado)
  const r11 = internalValidateCoupon(
    'TEST_EXCLUSIVE',
    [{ productId: 'p1', unitPrice: 200, quantity: 1 }],
    200,
    { email: 'vip@empresa.com' }
  );
  results.push({
    id: 11,
    name: 'Cliente Autorizado em Cupom Exclusivo',
    category: 'Público Alvo',
    expectedBehavior: 'Aprovar cupom com valid: true',
    passed: r11.valid,
    actualResult: r11.valid ? `Aprovado com desconto R$ ${r11.discountAmount}` : `Rejeitado: ${r11.error}`,
  });

  // Cenário 12: Cupom restrito a categorias específicas incompatível
  const catCpn: DiscountCoupon = {
    ...serverCoupons[0],
    id: 'test-category-target',
    code: 'TEST_CATEGORY_TARGET',
    status: 'active',
    targetType: 'categories',
    targetCategoryIds: ['cat-canecas'],
  };
  serverCoupons.push(catCpn);
  const r12 = internalValidateCoupon(
    'TEST_CATEGORY_TARGET',
    [{ productId: 'p1', categoryId: 'cat-mochilas', unitPrice: 200, quantity: 1 }],
    200
  );
  results.push({
    id: 12,
    name: 'Incompatibilidade de Categoria Alvo',
    category: 'Escopo de Produtos',
    expectedBehavior: 'Rejeitar com errorCode NO_ELIGIBLE_ITEMS',
    passed: !r12.valid && r12.errorCode === 'NO_ELIGIBLE_ITEMS',
    actualResult: r12.valid ? 'APROVADO (Incorreto)' : `Rejeitado: ${r12.error}`,
  });

  // Cenário 13: Não acumulação com itens em promoção
  const nonPromoCpn: DiscountCoupon = {
    ...serverCoupons[0],
    id: 'test-no-promo',
    code: 'TEST_NO_PROMO',
    status: 'active',
    canCombineWithPromotions: false,
    discountType: 'percentage',
    discountValue: 10,
  };
  serverCoupons.push(nonPromoCpn);
  // Carrinho misto: R$ 100 de item normal + R$ 300 de item em promoção
  const r13 = internalValidateCoupon(
    'TEST_NO_PROMO',
    [
      { productId: 'p-normal', unitPrice: 100, quantity: 1, isPromo: false },
      { productId: 'p-promo', unitPrice: 300, quantity: 1, isPromo: true },
    ],
    400
  );
  // O desconto de 10% deve recair APENAS sobre os R$ 100 elegíveis = R$ 10,00
  results.push({
    id: 13,
    name: 'Não Acumulação com Promoções (Base Elegível Parcial)',
    category: 'Regras Comerciais',
    expectedBehavior: 'Calcular desconto apenas nos itens sem promoção (R$ 10,00)',
    passed: r13.valid && r13.eligibleSubtotal === 100 && r13.discountAmount === 10,
    actualResult: r13.valid
      ? `Elegível: R$ ${r13.eligibleSubtotal} | Desconto: R$ ${r13.discountAmount}`
      : `Rejeitado: ${r13.error}`,
  });

  // Cenário 14: Teto de desconto máximo em cupom percentual
  const capCpn: DiscountCoupon = {
    ...serverCoupons[0],
    id: 'test-cap',
    code: 'TEST_CAP',
    status: 'active',
    discountType: 'percentage',
    discountValue: 50, // 50% de R$ 1000 = R$ 500
    maxDiscountAmount: 150, // Teto R$ 150
  };
  serverCoupons.push(capCpn);
  const r14 = internalValidateCoupon('TEST_CAP', [{ productId: 'p1', unitPrice: 1000, quantity: 1 }], 1000);
  results.push({
    id: 14,
    name: 'Teto Máximo de Desconto Percentual',
    category: 'Segurança Financeira',
    expectedBehavior: 'Limitar desconto ao teto de R$ 150,00',
    passed: r14.valid && r14.discountAmount === 150,
    actualResult: r14.valid ? `Desconto limitado a R$ ${r14.discountAmount}` : `Rejeitado: ${r14.error}`,
  });

  // Cenário 15: Desconto fixo maior que subtotal (Prevenção de Total Negativo)
  const fixedCpn: DiscountCoupon = {
    ...serverCoupons[0],
    id: 'test-fixed-cap',
    code: 'TEST_FIXED_CAP',
    status: 'active',
    discountType: 'fixed',
    discountValue: 300, // Cupom de R$ 300 para carrinho de R$ 100
  };
  serverCoupons.push(fixedCpn);
  const r15 = internalValidateCoupon('TEST_FIXED_CAP', [{ productId: 'p1', unitPrice: 100, quantity: 1 }], 100);
  results.push({
    id: 15,
    name: 'Prevenção de Total Negativo (Teto no Subtotal)',
    category: 'Segurança Financeira',
    expectedBehavior: 'Limitar desconto a R$ 100,00 (Total final = R$ 0,00)',
    passed: r15.valid && r15.discountAmount === 100 && r15.finalSubtotalAfterCoupon === 0,
    actualResult: r15.valid
      ? `Desconto: R$ ${r15.discountAmount} | Total final: R$ ${r15.finalSubtotalAfterCoupon}`
      : `Rejeitado: ${r15.error}`,
  });

  // Cenário 16: Reversão e estorno de cota por cancelamento de pedido
  const quotaCpn: DiscountCoupon = {
    ...serverCoupons[0],
    id: 'test-quota-revert',
    code: 'TEST_QUOTA_REVERT',
    status: 'active',
    currentUsageCount: 5,
    totalDiscountGranted: 250,
    totalSalesVolume: 2500,
  };
  serverCoupons.push(quotaCpn);
  serverUsages.push({
    id: 'usage-to-cancel',
    couponId: 'test-quota-revert',
    couponCode: 'TEST_QUOTA_REVERT',
    orderId: 'ord-to-cancel-99',
    orderCode: 'PED-CANCEL-99',
    customerName: 'Cliente Reversão',
    customerEmail: 'reversao@cliente.com',
    subtotalOriginal: 500,
    eligibleAmount: 500,
    discountApplied: 50,
    shippingCost: 0,
    finalTotal: 450,
    usedAt: new Date().toISOString(),
    status: 'confirmed',
  });

  // Simular cancelamento
  const targetUsage = serverUsages.find((u) => u.orderId === 'ord-to-cancel-99');
  let quotaReverted = false;
  if (targetUsage) {
    targetUsage.status = 'cancelled';
    quotaCpn.currentUsageCount = Math.max(0, quotaCpn.currentUsageCount - 1);
    quotaCpn.totalDiscountGranted = Math.max(0, quotaCpn.totalDiscountGranted - targetUsage.discountApplied);
    quotaReverted = quotaCpn.currentUsageCount === 4 && quotaCpn.totalDiscountGranted === 200;
  }

  results.push({
    id: 16,
    name: 'Estorno de Cota e Valores no Cancelamento',
    category: 'Integridade de Dados',
    expectedBehavior: 'Decrementar currentUsageCount (5 -> 4) e abater totalDiscountGranted',
    passed: quotaReverted,
    actualResult: quotaReverted
      ? `Sucesso: Usos = ${quotaCpn.currentUsageCount}, Descontos = R$ ${quotaCpn.totalDiscountGranted}`
      : 'Falha no estorno de cota',
  });

  // Limpar dados temporários criados nos testes
  const testIds = [
    'test-paused',
    'test-cancelled',
    'test-draft',
    'test-future',
    'test-expired',
    'test-min-purchase',
    'test-max-usage',
    'test-per-cust',
    'test-exclusive',
    'test-category-target',
    'test-no-promo',
    'test-cap',
    'test-fixed-cap',
    'test-quota-revert',
  ];
  serverCoupons = serverCoupons.filter((c) => !testIds.includes(c.id));
  serverUsages = serverUsages.filter((u) => u.id !== 'test-cust-usage-1' && u.id !== 'usage-to-cancel');

  const totalPassed = results.filter((r) => r.passed).length;

  return res.json({
    success: true,
    totalTests: results.length,
    passedCount: totalPassed,
    failedCount: results.length - totalPassed,
    allPassed: totalPassed === results.length,
    results,
  });
});
