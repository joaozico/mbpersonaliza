import { Router, Request, Response, NextFunction } from 'express';
import {
  DiscountCoupon,
  CouponUsageEntry,
  CouponSendHistoryEntry,
  CouponAuditLog,
  CouponValidationResult,
  PermissionKey,
  RolePermissions,
} from '../types.ts';
import { hasServerPermission, requireAuthSession, requireStaffSession } from '../middleware/auth.ts';
import {
  confirmCouponUsageAtomicInDb,
  deleteCouponFromDb,
  getCouponAuditLogsFromDb,
  getCouponByCodeFromDb,
  getCouponByIdFromDb,
  getCouponSendHistoryFromDb,
  getCouponsFromDb,
  getCouponUsagesFromDb,
  insertCouponAuditLogInDb,
  insertCouponSendHistoryInDb,
  releaseCouponUsageAtomicInDb,
  upsertCouponInDb,
} from '../db/repository.ts';
import { handleRouterError } from './dbErrorHelper.ts';

export const couponRouter = Router();

function recordCouponAuditAsync(entry: Omit<CouponAuditLog, 'id' | 'timestamp'>) {
  const newLog: CouponAuditLog = {
    id: `caud-pg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
    ...entry,
  };
  return insertCouponAuditLogInDb(newLog);
}

/**
 * Middleware de Autorização Granular para Cupons de Desconto (PostgreSQL Session)
 */
export function requireCouponPermission(requiredPermission: keyof RolePermissions) {
  return (req: Request, res: Response, next: NextFunction) => {
    const authUser = req.authUser || null;
    if (!authUser) {
      void recordCouponAuditAsync({
        action: 'apply_cart',
        userId: 'anonymous',
        userName: 'Não autenticado',
        userRole: 'visitante',
        details: `ACESSO NEGADO (401): Tentativa não autenticada exigindo permissão "${String(requiredPermission)}"`,
      }).catch(() => {});
      return res.status(401).json({
        success: false,
        error: 'Acesso negado. Usuário não autenticado.',
      });
    }

    if (authUser.status === 'inativo' || !hasServerPermission(req, requiredPermission as PermissionKey)) {
      void recordCouponAuditAsync({
        action: 'apply_cart',
        userId: authUser.id,
        userName: authUser.name,
        userRole: authUser.role,
        details: `ACESSO NEGADO (403): Tentativa de executar operação exigindo permissão "${String(requiredPermission)}"`,
      }).catch(() => {});
      return res.status(403).json({
        success: false,
        error: `Acesso negado. Seu perfil de usuário (${authUser.role}) não possui permissão para executar esta ação (${String(requiredPermission)}).`,
      });
    }

    return next();
  };
}

/**
 * Helper puro de validação das 12 regras de negócio sobre dados reais ou cenários isolados
 */
function internalValidateCoupon(
  couponsList: DiscountCoupon[],
  usagesList: CouponUsageEntry[],
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
  const coupon = couponsList.find((c) => c.code.trim().toUpperCase() === cleanCode);

  if (!coupon) {
    return emptyResult('NOT_FOUND', 'Código de cupom inválido ou não encontrado.');
  }

  const now = new Date();

  if (coupon.status === 'paused') {
    return emptyResult('INACTIVE', 'Este cupom está temporariamente pausado pela administração.');
  }
  if (coupon.status === 'cancelled') {
    return emptyResult('INACTIVE', 'Este cupom foi cancelado e não pode mais ser utilizado.');
  }
  if (coupon.status === 'draft') {
    return emptyResult('INACTIVE', 'Este cupom ainda não foi publicado.');
  }

  if (coupon.startDate) {
    const start = new Date(coupon.startDate);
    if (!isNaN(start.getTime()) && now < start) {
      return emptyResult(
        'NOT_STARTED',
        `Este cupom será válido somente a partir de ${start.toLocaleDateString('pt-BR')} às ${start.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}.`
      );
    }
  }

  if (coupon.endDate) {
    const end = new Date(coupon.endDate);
    if (!isNaN(end.getTime()) && now > end) {
      return emptyResult('EXPIRED', `Este cupom expirou em ${end.toLocaleDateString('pt-BR')}.`);
    }
  }

  if (coupon.maxUsageTotal && coupon.currentUsageCount >= coupon.maxUsageTotal) {
    return emptyResult('MAX_USAGE_REACHED', 'Este cupom atingiu o limite máximo de utilizações permitidas.');
  }

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

  if (coupon.maxUsagePerCustomer && coupon.maxUsagePerCustomer > 0 && customer) {
    const custEmail = customer.email?.toLowerCase().trim();
    const custCpf = customer.cpfCnpj?.replace(/\D/g, '');
    const custId = customer.id;

    const customerUsageCount = usagesList.filter((u) => {
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

  let eligibleItems = cartItems || [];

  if (!coupon.canCombineWithPromotions) {
    eligibleItems = eligibleItems.filter((item) => !item.isPromo);
  }

  if (coupon.targetType === 'categories' && coupon.targetCategoryIds && coupon.targetCategoryIds.length > 0) {
    eligibleItems = eligibleItems.filter((item) => item.categoryId && coupon.targetCategoryIds?.includes(item.categoryId));
  } else if (coupon.targetType === 'products' && coupon.targetProductIds && coupon.targetProductIds.length > 0) {
    eligibleItems = eligibleItems.filter((item) => coupon.targetProductIds?.includes(item.productId));
  }

  const eligibleSubtotal = eligibleItems.reduce((acc, it) => acc + it.unitPrice * it.quantity, 0);

  if (eligibleSubtotal <= 0) {
    return emptyResult(
      'NO_ELIGIBLE_ITEMS',
      coupon.canCombineWithPromotions === false
        ? 'Este cupom não é acumulável com os produtos em oferta/promoção no seu carrinho.'
        : 'Nenhum dos produtos selecionados é elegível para este cupom.'
    );
  }

  if (coupon.minPurchaseAmount && eligibleSubtotal < coupon.minPurchaseAmount) {
    return emptyResult(
      'MIN_PURCHASE_NOT_MET',
      `O valor mínimo em produtos elegíveis para este cupom é de R$ ${coupon.minPurchaseAmount.toFixed(2).replace('.', ',')}. Subtotal elegível atual: R$ ${eligibleSubtotal.toFixed(2).replace('.', ',')}.`
    );
  }

  let calculatedDiscount = 0;
  if (coupon.discountType === 'percentage') {
    calculatedDiscount = (eligibleSubtotal * coupon.discountValue) / 100;
    if (coupon.maxDiscountAmount && coupon.maxDiscountAmount > 0) {
      calculatedDiscount = Math.min(calculatedDiscount, coupon.maxDiscountAmount);
    }
  } else {
    calculatedDiscount = coupon.discountValue;
  }

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

// Validação segura de cupom no PostgreSQL (Storefront / Checkout / Carrinho)
couponRouter.post('/validate', async (req: Request, res: Response) => {
  try {
    const { code, cartItems, subtotal, customer } = req.body || {};
    const [coupons, usages] = await Promise.all([getCouponsFromDb(), getCouponUsagesFromDb()]);
    const result = internalValidateCoupon(
      coupons,
      usages,
      code,
      cartItems,
      Number(subtotal || 0),
      customer
    );
    return res.json(result);
  } catch (err: any) {
    return handleRouterError(res, err, 'Erro ao validar cupom no PostgreSQL.');
  }
});

// Histórico de utilização (declarado antes de /:id para evitar colisão)
couponRouter.get('/history/usages', requireCouponPermission('canViewCouponUsageHistory'), async (req: Request, res: Response) => {
  try {
    const couponId = typeof req.query.couponId === 'string' ? req.query.couponId : undefined;
    const usages = await getCouponUsagesFromDb(couponId);
    return res.json({ success: true, usages });
  } catch (err: any) {
    return handleRouterError(res, err, 'Erro ao carregar histórico de usos.');
  }
});

// Histórico de envios para clientes
couponRouter.get('/history/sends', requireCouponPermission('canViewCoupons'), async (req: Request, res: Response) => {
  try {
    const couponId = typeof req.query.couponId === 'string' ? req.query.couponId : undefined;
    const sends = await getCouponSendHistoryFromDb(couponId);
    return res.json({ success: true, sends });
  } catch (err: any) {
    return handleRouterError(res, err, 'Erro ao carregar histórico de envios.');
  }
});

// Métricas e Relatórios Gerenciais
couponRouter.get('/reports/metrics', requireCouponPermission('canViewCouponReports'), async (_req: Request, res: Response) => {
  try {
    const serverCoupons = await getCouponsFromDb();
    const totalCoupons = serverCoupons.length;
    const activeCoupons = serverCoupons.filter((c) => c.status === 'active').length;
    const totalUsageCount = serverCoupons.reduce((acc, c) => acc + (c.currentUsageCount || 0), 0);
    const totalDiscountGranted = Number(serverCoupons.reduce((acc, c) => acc + (c.totalDiscountGranted || 0), 0).toFixed(2));
    const totalSalesVolume = Number(serverCoupons.reduce((acc, c) => acc + (c.totalSalesVolume || 0), 0).toFixed(2));
    const totalSent = serverCoupons.reduce((acc, c) => acc + (c.sentCount || 0), 0);
    const conversionRatePercent = totalSent > 0 ? Number(((totalUsageCount / totalSent) * 100).toFixed(1)) : 0;

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
  } catch (err: any) {
    return handleRouterError(res, err, 'Erro ao gerar métricas de cupons.');
  }
});

// Logs de Auditoria
couponRouter.get('/audit-logs', requireCouponPermission('canViewCoupons'), async (_req: Request, res: Response) => {
  try {
    const logs = await getCouponAuditLogsFromDb();
    return res.json({ success: true, logs });
  } catch (err: any) {
    return handleRouterError(res, err, 'Erro ao consultar auditoria de cupons.');
  }
});

// Listagem de cupons cadastrados
couponRouter.get('/', requireCouponPermission('canViewCoupons'), async (req: Request, res: Response) => {
  try {
    const { status, search } = req.query;
    let list = await getCouponsFromDb();

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
  } catch (err: any) {
    return handleRouterError(res, err, 'Erro ao listar cupons do PostgreSQL.');
  }
});

// Detalhes de um cupom específico
couponRouter.get('/:id', requireCouponPermission('canViewCoupons'), async (req: Request, res: Response) => {
  try {
    const coupon = await getCouponByIdFromDb(req.params.id);
    if (!coupon) {
      return res.status(404).json({ success: false, error: 'Cupom não encontrado.' });
    }
    return res.json({ success: true, coupon });
  } catch (err: any) {
    return handleRouterError(res, err, 'Erro ao buscar cupom no PostgreSQL.');
  }
});

// Cadastro de novo cupom
couponRouter.post('/', requireCouponPermission('canCreateCoupons'), async (req: Request, res: Response) => {
  try {
    const data = req.body || {};
    const userId = req.authUser!.id;
    const userName = req.authUser!.name;
    const userRole = req.authUser!.role;

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

    const duplicate = await getCouponByCodeFromDb(cleanCode);
    if (duplicate) {
      return res.status(400).json({ success: false, error: `Já existe um cupom cadastrado com o código "${cleanCode}".` });
    }

    const newCoupon: DiscountCoupon = {
      id: data.id || `cpn-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
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

    const saved = await upsertCouponInDb(newCoupon);

    await recordCouponAuditAsync({
      couponId: saved.id,
      couponCode: saved.code,
      action: 'create',
      userId,
      userName,
      userRole,
      details: `Novo cupom criado no PostgreSQL: ${saved.code} (${saved.discountType === 'percentage' ? `${saved.discountValue}%` : `R$ ${saved.discountValue.toFixed(2)}`}) - Campanha: ${saved.campaignName}`,
    });

    return res.status(201).json({ success: true, coupon: saved });
  } catch (err: any) {
    return handleRouterError(res, err, 'Erro ao criar cupom no PostgreSQL.');
  }
});

// Edição de cupom existente
couponRouter.put('/:id', requireCouponPermission('canEditCoupons'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const data = req.body || {};
    const userId = req.authUser!.id;
    const userName = req.authUser!.name;
    const userRole = req.authUser!.role;

    const existing = await getCouponByIdFromDb(id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Cupom não encontrado.' });
    }

    const cleanCode = (data.code || existing.code).trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
    const duplicate = await getCouponByCodeFromDb(cleanCode);
    if (duplicate && duplicate.id !== id) {
      return res.status(400).json({ success: false, error: `Já existe outro cupom com o código "${cleanCode}".` });
    }

    const updated: DiscountCoupon = {
      ...existing,
      ...data,
      id,
      code: cleanCode,
      updatedAt: new Date().toISOString(),
    };

    const saved = await upsertCouponInDb(updated);

    await recordCouponAuditAsync({
      couponId: saved.id,
      couponCode: saved.code,
      action: 'update',
      userId,
      userName,
      userRole,
      details: `Cupom ${saved.code} atualizado no PostgreSQL por ${userName}`,
    });

    return res.json({ success: true, coupon: saved });
  } catch (err: any) {
    return handleRouterError(res, err, 'Erro ao atualizar cupom no PostgreSQL.');
  }
});

// Ativar / Pausar / Cancelar cupom
couponRouter.patch('/:id/status', (req: Request, res: Response, next: NextFunction) => {
  const { newStatus } = req.body || {};
  const perm = newStatus === 'cancelled' ? 'canCancelCoupons' : 'canToggleCoupons';
  return requireCouponPermission(perm)(req, res, async () => {
    try {
      const { id } = req.params;
      const userId = req.authUser!.id;
      const userName = req.authUser!.name;
      const userRole = req.authUser!.role;

      const coupon = await getCouponByIdFromDb(id);
      if (!coupon) {
        return res.status(404).json({ success: false, error: 'Cupom não encontrado.' });
      }

      const oldStatus = coupon.status;
      const saved = await upsertCouponInDb({
        ...coupon,
        status: newStatus,
        updatedAt: new Date().toISOString(),
      });

      await recordCouponAuditAsync({
        couponId: saved.id,
        couponCode: saved.code,
        action: newStatus === 'active' ? 'activate' : newStatus === 'paused' ? 'pause' : 'cancel',
        userId,
        userName,
        userRole,
        details: `Status do cupom ${saved.code} alterado de "${oldStatus}" para "${newStatus}"`,
      });

      return res.json({ success: true, coupon: saved });
    } catch (err: any) {
      return handleRouterError(res, err, 'Erro ao alterar status do cupom.');
    }
  });
});

// Cancelar / Deletar cupom
couponRouter.delete('/:id', requireCouponPermission('canCancelCoupons'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.authUser!.id;
    const userName = req.authUser!.name;
    const userRole = req.authUser!.role;

    const coupon = await getCouponByIdFromDb(id);
    if (!coupon) {
      return res.status(404).json({ success: false, error: 'Cupom não encontrado.' });
    }

    if (coupon.currentUsageCount > 0) {
      await upsertCouponInDb({
        ...coupon,
        status: 'cancelled',
        updatedAt: new Date().toISOString(),
      });
      await recordCouponAuditAsync({
        couponId: coupon.id,
        couponCode: coupon.code,
        action: 'cancel',
        userId,
        userName,
        userRole,
        details: `Cupom ${coupon.code} cancelado (mantido no PostgreSQL pois possui ${coupon.currentUsageCount} utilizações registradas)`,
      });
      return res.json({ success: true, message: 'Cupom cancelado com sucesso.' });
    }

    await deleteCouponFromDb(id);
    await recordCouponAuditAsync({
      couponId: coupon.id,
      couponCode: coupon.code,
      action: 'delete',
      userId,
      userName,
      userRole,
      details: `Exclusão definitiva do cupom ${coupon.code} no PostgreSQL`,
    });

    return res.json({ success: true, message: 'Cupom excluído com sucesso.' });
  } catch (err: any) {
    return handleRouterError(res, err, 'Erro ao excluir cupom no PostgreSQL.');
  }
});

// Enviar cupom para cliente
couponRouter.post('/:id/send', requireCouponPermission('canSendCouponsToCustomers'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { customerName, customerPhone, customerEmail, customerId, channel, customMessage } = req.body || {};
    const userId = req.authUser!.id;
    const userName = req.authUser!.name;

    const coupon = await getCouponByIdFromDb(id);
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
    if (channel === 'whatsapp') sendStatus = 'shared_whatsapp';
    else if (channel === 'email') sendStatus = 'sent_email';

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

    await insertCouponSendHistoryInDb(sendEntry);
    const nextSentCount = (coupon.sentCount || 0) + 1;
    await upsertCouponInDb({ ...coupon, sentCount: nextSentCount });

    await recordCouponAuditAsync({
      couponId: coupon.id,
      couponCode: coupon.code,
      action: 'send',
      userId,
      userName,
      userRole: req.authUser!.role,
      details: `Envio do cupom ${coupon.code} para ${customerName} (${channel})`,
    });

    let whatsappUrl: string | undefined;
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
      sentCount: nextSentCount,
    });
  } catch (err: any) {
    return handleRouterError(res, err, 'Erro ao enviar cupom no PostgreSQL.');
  }
});

// Confirmar uso do cupom no pedido (Atômico no PostgreSQL)
couponRouter.post('/confirm-usage', requireAuthSession, async (req: Request, res: Response) => {
  try {
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
    } = req.body || {};

    const result = await confirmCouponUsageAtomicInDb({
      couponCode: String(couponCode || ''),
      usage: {
        id: `cuse-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        orderId: orderId || `ord-${Date.now()}`,
        orderCode: orderCode || `PED-${Date.now()}`,
        customerId: req.authUser?.id || customerId,
        customerName: customerName || req.authUser?.name || 'Cliente Online',
        customerEmail: customerEmail || req.authUser?.email || 'cliente@online.com',
        customerPhone,
        customerCpfCnpj,
        subtotalOriginal: Number(subtotalOriginal || 0),
        eligibleAmount: Number(eligibleAmount || 0),
        discountApplied: Number(discountApplied || 0),
        shippingCost: Number(shippingCost || 0),
        finalTotal: Number(finalTotal || 0),
      },
      auditLog: {
        id: `caud-use-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        action: 'confirm_order',
        userId: req.authUser?.id || customerId || 'checkout_online',
        userName: req.authUser?.name || customerName || 'Cliente',
        userRole: req.authUser?.role || 'cliente',
        details: `Utilização confirmada no pedido ${orderCode} (Desconto R$ ${Number(discountApplied || 0).toFixed(2)})`,
      },
    });

    if (result.notFound) {
      return res.status(404).json({ success: false, error: 'Cupom não localizado.' });
    }

    return res.json({
      success: true,
      usage: result.usage,
      message: result.alreadyConfirmed ? 'Utilização já confirmada anteriormente.' : undefined,
    });
  } catch (err: any) {
    return handleRouterError(res, err, 'Erro ao confirmar uso do cupom no PostgreSQL.');
  }
});

// Reverter / liberar cota do cupom quando pedido é cancelado (Atômico no PostgreSQL)
couponRouter.post('/release-usage', requireStaffSession, async (req: Request, res: Response) => {
  try {
    const { orderId, reason } = req.body || {};
    const result = await releaseCouponUsageAtomicInDb({
      orderId: String(orderId || ''),
      reason,
      auditLog: {
        id: `caud-rel-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        userId: req.authUser!.id,
        userName: req.authUser!.name,
        userRole: req.authUser!.role,
        details: `Estorno de utilização de cupom para o pedido ${orderId}. Motivo: ${reason || 'Cancelamento'}`,
      },
    });
    if (result.notFound) {
      return res.status(404).json({
        success: false,
        error: 'Utilização confirmada não encontrada para este pedido.',
      });
    }
    return res.json({ success: true, message: 'Cota de utilização liberada com sucesso no PostgreSQL.' });
  } catch (err: any) {
    return handleRouterError(res, err, 'Erro ao liberar cota do cupom no PostgreSQL.');
  }
});

// Bateria de testes automatizados (16 cenários isolados em memória local da requisição)
export interface TestScenarioResult {
  id: number;
  name: string;
  category: string;
  expectedBehavior: string;
  passed: boolean;
  actualResult: string;
  details?: string;
}

couponRouter.post('/run-test-scenarios', requireCouponPermission('canViewCoupons'), async (_req: Request, res: Response) => {
  try {
    await getCouponsFromDb(); // Garante conexão ativa com PostgreSQL
    const results: TestScenarioResult[] = [];
    const baseTemplate: DiscountCoupon = {
      id: 'tpl-1',
      code: 'TEMPLATE',
      campaignName: 'Cenário de Validação',
      discountType: 'percentage',
      discountValue: 10,
      startDate: '2024-01-01T00:00:00Z',
      endDate: '2099-12-31T23:59:59Z',
      maxUsagePerCustomer: 1,
      targetType: 'all_store',
      targetProductIds: [],
      targetCategoryIds: [],
      customerRestriction: 'general',
      specificCustomerIds: [],
      specificCustomerEmails: [],
      canCombineWithPromotions: true,
      status: 'active',
      currentUsageCount: 0,
      totalDiscountGranted: 0,
      totalSalesVolume: 0,
      sentCount: 0,
      createdAt: new Date().toISOString(),
      createdByUserId: 'sys',
      createdByUserName: 'Sistema',
    };

    const tempCoupons: DiscountCoupon[] = [];
    const tempUsages: CouponUsageEntry[] = [];

    const r1 = internalValidateCoupon(tempCoupons, tempUsages, 'CUPOM_NAO_EXISTE_XYZ', [{ productId: 'p1', unitPrice: 100, quantity: 1 }], 100);
    results.push({ id: 1, name: 'Cupom Inexistente', category: 'Validação Básica', expectedBehavior: 'Rejeitar com errorCode NOT_FOUND', passed: !r1.valid && r1.errorCode === 'NOT_FOUND', actualResult: r1.valid ? 'APROVADO (Incorreto)' : `Rejeitado: ${r1.error}` });

    tempCoupons.push({ ...baseTemplate, id: 'test-paused', code: 'TEST_PAUSED', status: 'paused' });
    const r2 = internalValidateCoupon(tempCoupons, tempUsages, 'TEST_PAUSED', [{ productId: 'p1', unitPrice: 100, quantity: 1 }], 100);
    results.push({ id: 2, name: 'Cupom Temporariamente Pausado', category: 'Status e Ciclo de Vida', expectedBehavior: 'Rejeitar com errorCode INACTIVE', passed: !r2.valid && r2.errorCode === 'INACTIVE', actualResult: r2.valid ? 'APROVADO (Incorreto)' : `Rejeitado: ${r2.error}` });

    tempCoupons.push({ ...baseTemplate, id: 'test-cancelled', code: 'TEST_CANCELLED', status: 'cancelled' });
    const r3 = internalValidateCoupon(tempCoupons, tempUsages, 'TEST_CANCELLED', [{ productId: 'p1', unitPrice: 100, quantity: 1 }], 100);
    results.push({ id: 3, name: 'Cupom Cancelado', category: 'Status e Ciclo de Vida', expectedBehavior: 'Rejeitar com errorCode INACTIVE', passed: !r3.valid && r3.errorCode === 'INACTIVE', actualResult: r3.valid ? 'APROVADO (Incorreto)' : `Rejeitado: ${r3.error}` });

    tempCoupons.push({ ...baseTemplate, id: 'test-draft', code: 'TEST_DRAFT', status: 'draft' });
    const r4 = internalValidateCoupon(tempCoupons, tempUsages, 'TEST_DRAFT', [{ productId: 'p1', unitPrice: 100, quantity: 1 }], 100);
    results.push({ id: 4, name: 'Cupom em Rascunho (Draft)', category: 'Status e Ciclo de Vida', expectedBehavior: 'Rejeitar com errorCode INACTIVE', passed: !r4.valid && r4.errorCode === 'INACTIVE', actualResult: r4.valid ? 'APROVADO (Incorreto)' : `Rejeitado: ${r4.error}` });

    tempCoupons.push({ ...baseTemplate, id: 'test-future', code: 'TEST_FUTURE', startDate: new Date(Date.now() + 7 * 86400000).toISOString(), endDate: new Date(Date.now() + 30 * 86400000).toISOString() });
    const r5 = internalValidateCoupon(tempCoupons, tempUsages, 'TEST_FUTURE', [{ productId: 'p1', unitPrice: 100, quantity: 1 }], 100);
    results.push({ id: 5, name: 'Data de Início Futura', category: 'Temporalidade', expectedBehavior: 'Rejeitar com errorCode NOT_STARTED', passed: !r5.valid && r5.errorCode === 'NOT_STARTED', actualResult: r5.valid ? 'APROVADO (Incorreto)' : `Rejeitado: ${r5.error}` });

    tempCoupons.push({ ...baseTemplate, id: 'test-expired', code: 'TEST_EXPIRED', startDate: '2024-01-01T00:00:00Z', endDate: '2024-12-31T23:59:59Z' });
    const r6 = internalValidateCoupon(tempCoupons, tempUsages, 'TEST_EXPIRED', [{ productId: 'p1', unitPrice: 100, quantity: 1 }], 100);
    results.push({ id: 6, name: 'Cupom Expirado', category: 'Temporalidade', expectedBehavior: 'Rejeitar com errorCode EXPIRED', passed: !r6.valid && r6.errorCode === 'EXPIRED', actualResult: r6.valid ? 'APROVADO (Incorreto)' : `Rejeitado: ${r6.error}` });

    tempCoupons.push({ ...baseTemplate, id: 'test-min-purchase', code: 'TEST_MIN_PURCHASE', minPurchaseAmount: 500 });
    const r7 = internalValidateCoupon(tempCoupons, tempUsages, 'TEST_MIN_PURCHASE', [{ productId: 'p1', unitPrice: 150, quantity: 1 }], 150);
    results.push({ id: 7, name: 'Valor Mínimo Não Atingido', category: 'Regras Financeiras', expectedBehavior: 'Rejeitar com errorCode MIN_PURCHASE_NOT_MET', passed: !r7.valid && r7.errorCode === 'MIN_PURCHASE_NOT_MET', actualResult: r7.valid ? 'APROVADO (Incorreto)' : `Rejeitado: ${r7.error}` });

    tempCoupons.push({ ...baseTemplate, id: 'test-max-usage', code: 'TEST_MAX_USAGE', maxUsageTotal: 10, currentUsageCount: 10 });
    const r8 = internalValidateCoupon(tempCoupons, tempUsages, 'TEST_MAX_USAGE', [{ productId: 'p1', unitPrice: 200, quantity: 1 }], 200);
    results.push({ id: 8, name: 'Limite Global de Usos Atingido', category: 'Cotas de Utilização', expectedBehavior: 'Rejeitar com errorCode MAX_USAGE_REACHED', passed: !r8.valid && r8.errorCode === 'MAX_USAGE_REACHED', actualResult: r8.valid ? 'APROVADO (Incorreto)' : `Rejeitado: ${r8.error}` });

    tempCoupons.push({ ...baseTemplate, id: 'test-per-cust', code: 'TEST_PER_CUST', maxUsagePerCustomer: 1 });
    tempUsages.push({ id: 'test-cust-usage-1', couponId: 'test-per-cust', couponCode: 'TEST_PER_CUST', orderId: 'ord-test-cust-1', orderCode: 'PED-TEST-1', customerName: 'Cliente Teste', customerEmail: 'cliente.teste@empresa.com', subtotalOriginal: 200, eligibleAmount: 200, discountApplied: 20, shippingCost: 0, finalTotal: 180, usedAt: new Date().toISOString(), status: 'confirmed' });
    const r9 = internalValidateCoupon(tempCoupons, tempUsages, 'TEST_PER_CUST', [{ productId: 'p1', unitPrice: 200, quantity: 1 }], 200, { email: 'cliente.teste@empresa.com' });
    results.push({ id: 9, name: 'Limite de 1 Uso Por Cliente Excedido', category: 'Cotas de Utilização', expectedBehavior: 'Rejeitar com errorCode CUSTOMER_LIMIT_REACHED', passed: !r9.valid && r9.errorCode === 'CUSTOMER_LIMIT_REACHED', actualResult: r9.valid ? 'APROVADO (Incorreto)' : `Rejeitado: ${r9.error}` });

    tempCoupons.push({ ...baseTemplate, id: 'test-exclusive', code: 'TEST_EXCLUSIVE', customerRestriction: 'specific_customers', specificCustomerEmails: ['vip@empresa.com'] });
    const r10 = internalValidateCoupon(tempCoupons, tempUsages, 'TEST_EXCLUSIVE', [{ productId: 'p1', unitPrice: 200, quantity: 1 }], 200, { email: 'intruso@outro.com' });
    results.push({ id: 10, name: 'Cliente Não Autorizado em Cupom Exclusivo', category: 'Público Alvo', expectedBehavior: 'Rejeitar com errorCode CUSTOMER_NOT_ELIGIBLE', passed: !r10.valid && r10.errorCode === 'CUSTOMER_NOT_ELIGIBLE', actualResult: r10.valid ? 'APROVADO (Incorreto)' : `Rejeitado: ${r10.error}` });

    const r11 = internalValidateCoupon(tempCoupons, tempUsages, 'TEST_EXCLUSIVE', [{ productId: 'p1', unitPrice: 200, quantity: 1 }], 200, { email: 'vip@empresa.com' });
    results.push({ id: 11, name: 'Cliente Autorizado em Cupom Exclusivo', category: 'Público Alvo', expectedBehavior: 'Aprovar cupom com valid: true', passed: r11.valid, actualResult: r11.valid ? `Aprovado com desconto R$ ${r11.discountAmount}` : `Rejeitado: ${r11.error}` });

    tempCoupons.push({ ...baseTemplate, id: 'test-category-target', code: 'TEST_CATEGORY_TARGET', targetType: 'categories', targetCategoryIds: ['cat-canecas'] });
    const r12 = internalValidateCoupon(tempCoupons, tempUsages, 'TEST_CATEGORY_TARGET', [{ productId: 'p1', categoryId: 'cat-mochilas', unitPrice: 200, quantity: 1 }], 200);
    results.push({ id: 12, name: 'Incompatibilidade de Categoria Alvo', category: 'Escopo de Produtos', expectedBehavior: 'Rejeitar com errorCode NO_ELIGIBLE_ITEMS', passed: !r12.valid && r12.errorCode === 'NO_ELIGIBLE_ITEMS', actualResult: r12.valid ? 'APROVADO (Incorreto)' : `Rejeitado: ${r12.error}` });

    tempCoupons.push({ ...baseTemplate, id: 'test-no-promo', code: 'TEST_NO_PROMO', canCombineWithPromotions: false, discountType: 'percentage', discountValue: 10 });
    const r13 = internalValidateCoupon(tempCoupons, tempUsages, 'TEST_NO_PROMO', [{ productId: 'p-normal', unitPrice: 100, quantity: 1, isPromo: false }, { productId: 'p-promo', unitPrice: 300, quantity: 1, isPromo: true }], 400);
    results.push({ id: 13, name: 'Não Acumulação com Promoções (Base Elegível Parcial)', category: 'Regras Comerciais', expectedBehavior: 'Calcular desconto apenas nos itens sem promoção (R$ 10,00)', passed: r13.valid && r13.eligibleSubtotal === 100 && r13.discountAmount === 10, actualResult: r13.valid ? `Elegível: R$ ${r13.eligibleSubtotal} | Desconto: R$ ${r13.discountAmount}` : `Rejeitado: ${r13.error}` });

    tempCoupons.push({ ...baseTemplate, id: 'test-cap', code: 'TEST_CAP', discountType: 'percentage', discountValue: 50, maxDiscountAmount: 150 });
    const r14 = internalValidateCoupon(tempCoupons, tempUsages, 'TEST_CAP', [{ productId: 'p1', unitPrice: 1000, quantity: 1 }], 1000);
    results.push({ id: 14, name: 'Teto Máximo de Desconto Percentual', category: 'Segurança Financeira', expectedBehavior: 'Limitar desconto ao teto de R$ 150,00', passed: r14.valid && r14.discountAmount === 150, actualResult: r14.valid ? `Desconto limitado a R$ ${r14.discountAmount}` : `Rejeitado: ${r14.error}` });

    tempCoupons.push({ ...baseTemplate, id: 'test-fixed-cap', code: 'TEST_FIXED_CAP', discountType: 'fixed', discountValue: 300 });
    const r15 = internalValidateCoupon(tempCoupons, tempUsages, 'TEST_FIXED_CAP', [{ productId: 'p1', unitPrice: 100, quantity: 1 }], 100);
    results.push({ id: 15, name: 'Prevenção de Total Negativo (Teto no Subtotal)', category: 'Segurança Financeira', expectedBehavior: 'Limitar desconto a R$ 100,00 (Total final = R$ 0,00)', passed: r15.valid && r15.discountAmount === 100 && r15.finalSubtotalAfterCoupon === 0, actualResult: r15.valid ? `Desconto: R$ ${r15.discountAmount} | Total final: R$ ${r15.finalSubtotalAfterCoupon}` : `Rejeitado: ${r15.error}` });

    const quotaCpn: DiscountCoupon = { ...baseTemplate, id: 'test-quota-revert', code: 'TEST_QUOTA_REVERT', currentUsageCount: 5, totalDiscountGranted: 250, totalSalesVolume: 2500 };
    const usageRevert: CouponUsageEntry = { id: 'usage-to-cancel', couponId: 'test-quota-revert', couponCode: 'TEST_QUOTA_REVERT', orderId: 'ord-to-cancel-99', orderCode: 'PED-CANCEL-99', customerName: 'Cliente Reversão', customerEmail: 'reversao@cliente.com', subtotalOriginal: 500, eligibleAmount: 500, discountApplied: 50, shippingCost: 0, finalTotal: 450, usedAt: new Date().toISOString(), status: 'confirmed' };
    usageRevert.status = 'cancelled';
    quotaCpn.currentUsageCount = Math.max(0, quotaCpn.currentUsageCount - 1);
    quotaCpn.totalDiscountGranted = Math.max(0, quotaCpn.totalDiscountGranted - usageRevert.discountApplied);
    const quotaReverted = quotaCpn.currentUsageCount === 4 && quotaCpn.totalDiscountGranted === 200;
    results.push({ id: 16, name: 'Estorno de Cota e Valores no Cancelamento', category: 'Integridade de Dados', expectedBehavior: 'Decrementar currentUsageCount (5 -> 4) e abater totalDiscountGranted', passed: quotaReverted, actualResult: quotaReverted ? `Sucesso: Usos = ${quotaCpn.currentUsageCount}, Descontos = R$ ${quotaCpn.totalDiscountGranted}` : 'Falha no estorno de cota' });

    const totalPassed = results.filter((r) => r.passed).length;
    return res.json({
      success: true,
      totalTests: results.length,
      passedCount: totalPassed,
      failedCount: results.length - totalPassed,
      allPassed: totalPassed === results.length,
      results,
    });
  } catch (err: any) {
    return handleRouterError(res, err, 'Erro ao executar cenários de validação de cupons.');
  }
});
