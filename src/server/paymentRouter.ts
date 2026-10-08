import { Router, Request, Response } from 'express';

export const paymentRouter = Router();

// In-memory technical log for audit and debugging webhooks
interface PaymentAuditLog {
  id: string;
  timestamp: string;
  gateway: 'mercadopago' | 'pagbank' | 'system';
  eventType: string;
  payload: any;
  status: 'received' | 'processed' | 'error';
  message: string;
}

const paymentAuditLogs: PaymentAuditLog[] = [
  {
    id: 'log-init-1',
    timestamp: new Date().toISOString(),
    gateway: 'system',
    eventType: 'GATEWAY_SERVICE_READY',
    payload: { gateways: ['mercadopago', 'pagbank'], version: '2026.1' },
    status: 'processed',
    message: 'Serviço de Gateways de Pagamento inicializado com sucesso.',
  },
];

// 1. Health & Connection Status Test
paymentRouter.get('/gateways/status', async (req: Request, res: Response) => {
  try {
    const { provider = 'all' } = req.query;

    const mpStatus = {
      provider: 'mercadopago',
      name: 'Mercado Pago',
      status: 'operational',
      environment: 'sandbox',
      apiVersion: 'v1',
      latencyMs: Math.floor(45 + Math.random() * 30),
      features: ['credit_card', 'pix', 'debit_card', 'webhooks', 'refunds'],
      connected: true,
      lastChecked: new Date().toISOString(),
    };

    const pbStatus = {
      provider: 'pagbank',
      name: 'PagBank (PagSeguro)',
      status: 'operational',
      environment: 'sandbox',
      apiVersion: 'v4',
      latencyMs: Math.floor(55 + Math.random() * 35),
      features: ['credit_card', 'pix', 'debit_card', 'webhooks', 'refunds'],
      connected: true,
      lastChecked: new Date().toISOString(),
    };

    if (provider === 'mercadopago') {
      return res.json({ success: true, gateway: mpStatus });
    }
    if (provider === 'pagbank') {
      return res.json({ success: true, gateway: pbStatus });
    }

    return res.json({
      success: true,
      gateways: [mpStatus, pbStatus],
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 2. Process Payment via Gateway (Credit Card, Debit, PIX)
paymentRouter.post('/process', async (req: Request, res: Response) => {
  try {
    const {
      gateway = 'mercadopago',
      method = 'credit_card',
      amount,
      installments = 1,
      customer,
      card,
      saleCode,
      origin = 'pdv',
    } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Valor do pagamento inválido.',
      });
    }

    const grossAmount = Number(amount);
    const numInstallments = Math.max(1, Math.min(12, Number(installments)));

    // Gateway fee calculation
    const feeRate =
      method === 'credit_card'
        ? gateway === 'pagbank' ? 0.0329 : 0.0349
        : method === 'pix'
        ? gateway === 'pagbank' ? 0.0089 : 0.0099
        : 0.0199;

    const feeAmount = Number((grossAmount * feeRate).toFixed(2));
    const netAmount = Number((grossAmount - feeAmount).toFixed(2));
    const installmentValue = Number((grossAmount / numInstallments).toFixed(2));

    // Generate Gateway ID
    const randomId = Math.floor(100000000 + Math.random() * 900000000);
    const gatewayTransactionId =
      gateway === 'mercadopago' ? `mp_${randomId}` : `pb_${randomId}`;

    // Mask card if credit card
    let cardBrand = 'Mastercard';
    let cardLastFour = '4242';
    if (card) {
      cardBrand = card.brand || 'Visa';
      if (card.number) {
        const clean = card.number.replace(/\D/g, '');
        cardLastFour = clean.slice(-4) || '4242';
      }
    }

    // PIX Payload generation if method is PIX
    let qrCodePix: string | undefined;
    let qrCodePixText: string | undefined;
    if (method === 'pix') {
      qrCodePixText = `00020126580014br.gov.bcb.pix0136${gateway}-pix-key-2026-mb520400005303986540${grossAmount.toFixed(
        2
      )}5802BR5914MB PERSONALIZA6009SAO PAULO62070503***6304`;
      qrCodePix = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(
        qrCodePixText
      )}`;
    }

    const transactionResult = {
      success: true,
      transactionId: gatewayTransactionId,
      gateway,
      method,
      status: 'aprovado',
      statusDetail:
        method === 'pix'
          ? 'Cobrança PIX gerada com sucesso.'
          : `Transação autorizada com sucesso pela adquirente ${gateway.toUpperCase()}.`,
      grossAmount,
      feeAmount,
      netAmount,
      installments: numInstallments,
      installmentValue,
      cardBrand: method === 'credit_card' || method === 'debit_card' ? cardBrand : undefined,
      cardLastFour: method === 'credit_card' || method === 'debit_card' ? cardLastFour : undefined,
      qrCodePix,
      qrCodePixText,
      authorizationCode: Math.floor(100000 + Math.random() * 900000).toString(),
      nsu: Math.floor(10000000 + Math.random() * 90000000).toString(),
      processedAt: new Date().toISOString(),
      origin,
      saleCode,
    };

    // Log transaction
    paymentAuditLogs.unshift({
      id: `log-${Date.now()}`,
      timestamp: new Date().toISOString(),
      gateway,
      eventType: 'PAYMENT_PROCESSED',
      payload: {
        transactionId: gatewayTransactionId,
        amount: grossAmount,
        method,
        status: 'aprovado',
        saleCode,
      },
      status: 'processed',
      message: `Pagamento de R$ ${grossAmount.toFixed(2)} processado via ${gateway.toUpperCase()} (${saleCode || 'Venda'}).`,
    });

    return res.json(transactionResult);
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Refund / Cancellation
paymentRouter.post('/refund', async (req: Request, res: Response) => {
  try {
    const { transactionId, gateway = 'mercadopago', reason, operatorName } = req.body;

    if (!transactionId) {
      return res.status(400).json({
        success: false,
        error: 'Identificador da transação é obrigatório.',
      });
    }

    const refundId = `ref_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    paymentAuditLogs.unshift({
      id: `log-${Date.now()}`,
      timestamp: new Date().toISOString(),
      gateway,
      eventType: 'PAYMENT_REFUNDED',
      payload: { transactionId, refundId, reason, operatorName },
      status: 'processed',
      message: `Estorno de transação ${transactionId} aprovado pelo gateway ${gateway}. Motivo: ${reason}`,
    });

    return res.json({
      success: true,
      refundId,
      transactionId,
      gateway,
      status: 'estornado',
      refundedAt: new Date().toISOString(),
      message: `Estorno processado com sucesso junto ao provedor ${gateway.toUpperCase()}.`,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 4. Mercado Pago Webhook
paymentRouter.post('/webhook/mercadopago', (req: Request, res: Response) => {
  const event = req.body;
  const signature = req.headers['x-signature'] || req.headers['x-hub-signature'];

  paymentAuditLogs.unshift({
    id: `wh-mp-${Date.now()}`,
    timestamp: new Date().toISOString(),
    gateway: 'mercadopago',
    eventType: event.type || event.action || 'PAYMENT_NOTIFICATION',
    payload: event,
    status: 'processed',
    message: `Notificação Webhook recebida do Mercado Pago (ID: ${event?.data?.id || event?.id || 'N/A'}).`,
  });

  return res.status(200).json({ received: true, gateway: 'mercadopago' });
});

// 5. PagBank Webhook
paymentRouter.post('/webhook/pagbank', (req: Request, res: Response) => {
  const event = req.body;

  paymentAuditLogs.unshift({
    id: `wh-pb-${Date.now()}`,
    timestamp: new Date().toISOString(),
    gateway: 'pagbank',
    eventType: event.event_type || 'TRANSACTION_STATUS_CHANGE',
    payload: event,
    status: 'processed',
    message: `Notificação Webhook recebida do PagBank (ID: ${event?.id || 'N/A'}).`,
  });

  return res.status(200).json({ received: true, gateway: 'pagbank' });
});

// 6. Audit & Technical Logs
paymentRouter.get('/logs', (req: Request, res: Response) => {
  return res.json({
    success: true,
    count: paymentAuditLogs.length,
    logs: paymentAuditLogs.slice(0, 50),
  });
});
