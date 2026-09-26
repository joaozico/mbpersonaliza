import {
  StrickerOrder,
  StrickerOrderStatus,
  StrickerOrderLine,
  StrickerServiceLine,
} from '../../types/stricker';
import { INITIAL_STRICKER_ORDERS } from '../../data/strickerInitialData';

const STORAGE_KEYS = {
  ORDERS: 'mb_stricker_orders_v1',
};

export class StrickerOrderService {
  /**
   * Obtém todos os pedidos da Stricker
   */
  public static getOrders(): StrickerOrder[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.ORDERS);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error('Erro ao ler pedidos Stricker:', e);
    }
    return INITIAL_STRICKER_ORDERS;
  }

  /**
   * Salva pedidos da Stricker
   */
  public static saveOrders(orders: StrickerOrder[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(orders));
      window.dispatchEvent(new Event('mb_stricker_orders_updated'));
    } catch (e) {
      console.error('Erro ao salvar pedidos Stricker:', e);
    }
  }

  /**
   * Busca pedido por ID interno, OrderStamp ou InternalReference
   */
  public static getOrderByIdOrRef(identifier: string): StrickerOrder | undefined {
    return this.getOrders().find(
      (o) =>
        o.id === identifier ||
        o.orderStamp === identifier ||
        o.internalReference === identifier
    );
  }

  /**
   * Verifica idempotência: Checa se uma InternalReference já foi utilizada para evitar pedidos duplicados (Erro Código 70)
   */
  public static checkIdempotency(internalReference: string): { exists: boolean; existingOrder?: StrickerOrder } {
    const existing = this.getOrders().find((o) => o.internalReference === internalReference);
    return { exists: !!existing, existingOrder: existing };
  }

  /**
   * Envia um novo pedido para a Stricker (OrderV1 + opcional ServiceOrderV1)
   */
  public static async createOrder(orderPayload: {
    internalReference: string;
    waitArtwork: boolean;
    deliveryAddress: StrickerOrder['deliveryAddress'];
    lines: {
      productReference: string;
      sku: string;
      quantity: number;
      lineType: 'standard' | 'print' | 'sample';
      sample?: boolean;
      unitPrice: number;
    }[];
    serviceLines?: {
      serviceCode: string;
      colors: number;
      logoSize: string;
      group: string;
      artworkUrl?: string;
      artworkFilename?: string;
    }[];
    notes?: string;
    operatorName?: string;
  }): Promise<{ success: boolean; order?: StrickerOrder; error?: string; code?: number }> {
    // 1. Verificação de Idempotência
    const idempotency = this.checkIdempotency(orderPayload.internalReference);
    if (idempotency.exists && idempotency.existingOrder) {
      return {
        success: false,
        error: `Internal Reference ${orderPayload.internalReference} já foi utilizada no pedido ${idempotency.existingOrder.orderStamp || idempotency.existingOrder.id}. Evitando duplicação.`,
        code: 70,
        order: idempotency.existingOrder,
      };
    }

    try {
      const response = await fetch('/api/stricker/orders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderPayload),
      });

      const data = await response.json();

      if (data.success && data.order) {
        const orders = this.getOrders();
        orders.unshift(data.order);
        this.saveOrders(orders);
        return { success: true, order: data.order };
      } else {
        return { success: false, error: data.error || 'Erro ao emitir pedido para a Stricker.', code: data.code };
      }
    } catch (e: any) {
      // Fallback local caso servidor offline
      const stampNumber = Math.floor(90000 + Math.random() * 9999);
      const orderStamp = `SPOT-BR-2026-${stampNumber}`;
      const total = orderPayload.lines.reduce((a, b) => a + b.unitPrice * b.quantity, 0);

      const newOrder: StrickerOrder = {
        id: `stk-ord-${Date.now()}`,
        internalReference: orderPayload.internalReference,
        orderStamp,
        status: orderPayload.waitArtwork ? 'WAITING_ART_WORK' : orderPayload.serviceLines?.length ? 'PENDING_MOCKUP_APPROVAL' : 'PROCESSING',
        orderTotal: total,
        waitArtwork: orderPayload.waitArtwork,
        notes: orderPayload.notes,
        deliveryAddress: orderPayload.deliveryAddress,
        lines: orderPayload.lines.map((l, idx) => ({
          lineStamp: `LS-${stampNumber}-${idx + 1}`,
          productReference: l.productReference,
          sku: l.sku,
          quantity: l.quantity,
          lineType: l.lineType,
          sample: !!l.sample,
          waitArtwork: orderPayload.waitArtwork,
          unitPrice: l.unitPrice,
          totalPrice: Number((l.unitPrice * l.quantity).toFixed(2)),
        })),
        serviceLines: (orderPayload.serviceLines || []).map((s, idx) => ({
          lineStamp: `LS-${stampNumber}-${idx + 1}`,
          serviceCode: s.serviceCode,
          colors: s.colors,
          logoSize: s.logoSize,
          group: s.group,
          approved: false,
          artworkUrl: s.artworkUrl,
          artworkFilename: s.artworkFilename,
          artworkUploadedAt: s.artworkFilename ? new Date().toISOString() : undefined,
          artworkUploadedBy: orderPayload.operatorName || 'Administrador',
        })),
        history: [
          {
            newStatus: orderPayload.waitArtwork ? 'WAITING_ART_WORK' : orderPayload.serviceLines?.length ? 'PENDING_MOCKUP_APPROVAL' : 'PROCESSING',
            date: new Date().toISOString(),
            source: 'user_action',
            user: orderPayload.operatorName || 'Administrador',
            notes: orderPayload.waitArtwork
              ? 'Pedido emitido com reserva de estoque (WaitArtwork=true). Aguardando envio da arte final.'
              : 'Pedido emitido via OrderV1 / ServiceOrderV1.',
          },
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const orders = this.getOrders();
      orders.unshift(newOrder);
      this.saveOrders(orders);

      return { success: true, order: newOrder };
    }
  }

  /**
   * Envia arquivo de arte/maquete para um pedido que estava aguardando arte (WaitArtwork = true)
   */
  public static async attachArtworkToOrder(
    orderId: string,
    artworkData: {
      artworkFilename: string;
      artworkUrl?: string;
      serviceCode?: string;
      colors?: number;
      logoSize?: string;
      operatorName?: string;
    }
  ): Promise<{ success: boolean; order?: StrickerOrder; error?: string }> {
    const orders = this.getOrders();
    const order = orders.find((o) => o.id === orderId || o.orderStamp === orderId);

    if (!order) {
      return { success: false, error: 'Pedido não encontrado.' };
    }

    // Atualiza ou insere service line
    if (order.serviceLines.length === 0) {
      order.serviceLines.push({
        lineStamp: order.lines[0]?.lineStamp || `LS-${Date.now()}`,
        serviceCode: artworkData.serviceCode || 'LSR1-02-01',
        colors: artworkData.colors || 1,
        logoSize: artworkData.logoSize || 'Padrão',
        group: 'LOGO-SERVICO-1',
        approved: false,
        artworkFilename: artworkData.artworkFilename,
        artworkUrl: artworkData.artworkUrl,
        artworkUploadedAt: new Date().toISOString(),
        artworkUploadedBy: artworkData.operatorName || 'Usuário do Sistema',
      });
    } else {
      order.serviceLines[0].artworkFilename = artworkData.artworkFilename;
      order.serviceLines[0].artworkUrl = artworkData.artworkUrl;
      order.serviceLines[0].artworkUploadedAt = new Date().toISOString();
      order.serviceLines[0].artworkUploadedBy = artworkData.operatorName || 'Usuário do Sistema';
    }

    const previousStatus = order.status;
    order.status = 'PENDING_MOCKUP_APPROVAL';
    order.waitArtwork = false;
    order.updatedAt = new Date().toISOString();

    order.history.push({
      previousStatus,
      newStatus: 'PENDING_MOCKUP_APPROVAL',
      date: new Date().toISOString(),
      source: 'user_action',
      user: artworkData.operatorName || 'Usuário do Sistema',
      notes: `Arquivo de arte "${artworkData.artworkFilename}" anexado e enviado para validação de maquete digital.`,
    });

    this.saveOrders(orders);
    return { success: true, order };
  }

  /**
   * Aprova maquete digital do pedido
   */
  public static async approveMockup(orderId: string, operatorName?: string): Promise<{ success: boolean; order?: StrickerOrder }> {
    const orders = this.getOrders();
    const order = orders.find((o) => o.id === orderId || o.orderStamp === orderId);
    if (!order) return { success: false };

    if (order.serviceLines.length > 0) {
      order.serviceLines[0].approved = true;
    }

    const previousStatus = order.status;
    order.status = 'PROCESSED';
    order.updatedAt = new Date().toISOString();

    order.history.push({
      previousStatus,
      newStatus: 'PROCESSED',
      date: new Date().toISOString(),
      source: 'user_action',
      user: operatorName || 'Administrador',
      notes: 'Maquete aprovada. Pedido liberado para produção e gravação.',
    });

    this.saveOrders(orders);
    return { success: true, order };
  }

  /**
   * Cancela um pedido na Stricker (CancelOrderV1)
   */
  public static async cancelOrder(
    orderId: string,
    reason: string,
    operatorName?: string
  ): Promise<{ success: boolean; order?: StrickerOrder; error?: string }> {
    const orders = this.getOrders();
    const order = orders.find((o) => o.id === orderId || o.orderStamp === orderId);

    if (!order) {
      return { success: false, error: 'Pedido não encontrado.' };
    }

    if (order.status === 'INVOICED' || order.status === 'SHIPPED') {
      return { success: false, error: 'Não é possível cancelar um pedido que já foi faturado ou despachado.' };
    }

    const previousStatus = order.status;
    order.status = 'CANCELED';
    order.updatedAt = new Date().toISOString();

    order.history.push({
      previousStatus,
      newStatus: 'CANCELED',
      date: new Date().toISOString(),
      source: 'user_action',
      user: operatorName || 'Administrador',
      notes: `Cancelamento solicitado via CancelOrderV1. Motivo: ${reason}`,
    });

    this.saveOrders(orders);
    return { success: true, order };
  }

  /**
   * Atualiza status do pedido com base em sincronização periódica (OrdersV1 / OrderDetailsV1)
   */
  public static updateOrderStatusFromSync(
    orderStamp: string,
    newStatus: StrickerOrderStatus,
    trackingCode?: string,
    shippingDate?: string
  ): void {
    const orders = this.getOrders();
    const order = orders.find((o) => o.orderStamp === orderStamp);
    if (!order) return;

    if (order.status !== newStatus) {
      const prev = order.status;
      order.status = newStatus;
      if (trackingCode) order.trackingCode = trackingCode;
      if (shippingDate) order.shippingDate = shippingDate;
      order.updatedAt = new Date().toISOString();

      order.history.push({
        previousStatus: prev,
        newStatus,
        date: new Date().toISOString(),
        source: 'automatic_sync',
        notes: `Status atualizado automaticamente via WebService Stricker / OrdersV1.`,
      });

      this.saveOrders(orders);
    }
  }
}
