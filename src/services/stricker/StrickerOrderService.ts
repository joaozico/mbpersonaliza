import { StrickerOrder, StrickerOrderStatus } from '../../types/stricker';
import { INITIAL_STRICKER_ORDERS } from '../../data/strickerInitialData';
import { authFetch } from '../authClient';

let memoryOrders: StrickerOrder[] | null = null;

export class StrickerOrderService {
  /**
   * Atualiza cache em memória com os pedidos carregados do PostgreSQL
   */
  public static setOrdersFromServer(orders: StrickerOrder[]): void {
    if (Array.isArray(orders)) {
      memoryOrders = orders;
      window.dispatchEvent(new Event('mb_stricker_orders_updated'));
    }
  }

  /**
   * Obtém todos os pedidos da Stricker em memória (hidratados do PostgreSQL)
   */
  public static getOrders(): StrickerOrder[] {
    if (memoryOrders !== null) {
      return [...memoryOrders];
    }
    return [...INITIAL_STRICKER_ORDERS];
  }

  /**
   * Atualiza cache em memória dos pedidos da Stricker
   */
  public static saveOrders(orders: StrickerOrder[]): void {
    memoryOrders = [...orders];
    window.dispatchEvent(new Event('mb_stricker_orders_updated'));
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
  public static checkIdempotency(internalReference: string): {
    exists: boolean;
    existingOrder?: StrickerOrder;
  } {
    const existing = this.getOrders().find((o) => o.internalReference === internalReference);
    return { exists: !!existing, existingOrder: existing };
  }

  /**
   * Envia um novo pedido para a Stricker (OrderV1 + opcional ServiceOrderV1) persistido no PostgreSQL
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
    const idempotency = this.checkIdempotency(orderPayload.internalReference);
    if (idempotency.exists && idempotency.existingOrder) {
      return {
        success: false,
        error: `Internal Reference ${orderPayload.internalReference} já foi utilizada no pedido ${
          idempotency.existingOrder.orderStamp || idempotency.existingOrder.id
        }. Evitando duplicação.`,
        code: 70,
        order: idempotency.existingOrder,
      };
    }

    try {
      const response = await authFetch('/api/stricker/orders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderPayload),
      });

      const data = await response.json();

      if (response.ok && data.success && data.order) {
        const orders = this.getOrders().filter((o) => o.id !== data.order.id);
        orders.unshift(data.order);
        this.saveOrders(orders);
        return { success: true, order: data.order };
      }

      return {
        success: false,
        error: data.error || data.ErrorMessage || 'Erro ao emitir pedido para a Stricker no PostgreSQL.',
        code: data.code || data.ErrorCode,
      };
    } catch (e: any) {
      return {
        success: false,
        error: e?.message || 'Falha de comunicação com o servidor/PostgreSQL ao emitir pedido Stricker.',
      };
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
    const existing = orders.find((o) => o.id === orderId || o.orderStamp === orderId);
    if (!existing) {
      return { success: false, error: 'Pedido não encontrado.' };
    }

    try {
      const response = await authFetch('/api/stricker/ServiceOrderV1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderStamp: existing.orderStamp || existing.id,
          orderId: existing.id,
          ...artworkData,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success || !data.order) {
        return {
          success: false,
          error: data.ErrorMessage || data.error || 'Falha ao anexar arte no PostgreSQL.',
        };
      }

      const updatedOrders = orders.map((o) =>
        o.id === existing.id || o.orderStamp === existing.orderStamp ? data.order : o
      );
      this.saveOrders(updatedOrders);
      return { success: true, order: data.order };
    } catch (e: any) {
      return {
        success: false,
        error: e?.message || 'Erro de comunicação ao enviar arte para o PostgreSQL.',
      };
    }
  }

  /**
   * Aprova maquete digital do pedido no PostgreSQL
   */
  public static async approveMockup(
    orderId: string,
    operatorName?: string
  ): Promise<{ success: boolean; order?: StrickerOrder; error?: string }> {
    try {
      const response = await authFetch(
        `/api/stricker/orders/${encodeURIComponent(orderId)}/approve-mockup`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ operatorName }),
        }
      );
      const data = await response.json();
      if (!response.ok || !data.success || !data.order) {
        return {
          success: false,
          error: data.error || 'Erro ao aprovar maquete no PostgreSQL.',
        };
      }
      const orders = this.getOrders().map((o) =>
        o.id === data.order.id || o.orderStamp === data.order.orderStamp ? data.order : o
      );
      this.saveOrders(orders);
      return { success: true, order: data.order };
    } catch (e: any) {
      return {
        success: false,
        error: e?.message || 'Erro de comunicação ao aprovar maquete no PostgreSQL.',
      };
    }
  }

  /**
   * Cancela um pedido na Stricker (CancelOrderV1) no PostgreSQL
   */
  public static async cancelOrder(
    orderId: string,
    reason: string,
    operatorName?: string
  ): Promise<{ success: boolean; order?: StrickerOrder; error?: string }> {
    const orders = this.getOrders();
    const existing = orders.find((o) => o.id === orderId || o.orderStamp === orderId);
    if (!existing) {
      return { success: false, error: 'Pedido não encontrado.' };
    }

    if (existing.status === 'INVOICED' || existing.status === 'SHIPPED') {
      return {
        success: false,
        error: 'Não é possível cancelar um pedido que já foi faturado ou despachado.',
      };
    }

    try {
      const response = await authFetch('/api/stricker/CancelOrderV1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderStamp: existing.orderStamp || existing.id,
          orderId: existing.id,
          reason,
          operatorName,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success || !data.order) {
        return {
          success: false,
          error: data.ErrorMessage || data.error || 'Falha ao cancelar pedido no PostgreSQL.',
        };
      }

      const updatedOrders = orders.map((o) =>
        o.id === existing.id || o.orderStamp === existing.orderStamp ? data.order : o
      );
      this.saveOrders(updatedOrders);
      return { success: true, order: data.order };
    } catch (e: any) {
      return {
        success: false,
        error: e?.message || 'Erro de comunicação ao cancelar pedido no PostgreSQL.',
      };
    }
  }

  /**
   * Atualiza status do pedido em memória com base em sincronização periódica
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
        notes: 'Status atualizado automaticamente via WebService Stricker / OrdersV1.',
      });

      this.saveOrders(orders);
    }
  }
}
