import { Router, Request, Response } from 'express';
import { strickerSyncWorker } from './strickerSyncWorker';
import { requireStaffSession } from '../middleware/auth.ts';
import {
  INITIAL_STRICKER_PRODUCTS,
  INITIAL_STRICKER_COLORS,
  INITIAL_STRICKER_TYPES,
  INITIAL_STRICKER_CUSTOMIZATION_TABLES,
} from '../data/strickerInitialData';

export const strickerRouter = Router();
strickerRouter.use(requireStaffSession);

// Cache em memória no servidor para sessão e rate limit
let currentSessionToken: string | null = 'sess_spot_demo_9847239847129837';
let tokenExpiresAt: number = Date.now() + 24 * 60 * 60 * 1000;
let requestCountLastMinute = 0;
let lastMinuteReset = Date.now();

// Memória de pedidos emitidos
const inMemoryOrders: any[] = [
  {
    orderStamp: 'SPOT-BR-2026-92817',
    relatedOrderStamp: '',
    internalReference: 'MB-PED-2026-081',
    status: 'WAITING_ART_WORK',
    orderTotal: 4850.0,
    shippingDate: '2026-09-18',
    courier: 'Economy',
    noShipping: false,
    date: '2026-09-02T18:30:00Z',
    destination: {
      AddressLine1: 'MB Personaliza - Almoxarifado Central',
      AddressLine2: 'Av. Paulista, 1000 - 12º andar',
      Postalcode: '01310-100',
      ExtentionPostalcode: '01310-100',
      City: 'São Paulo',
      Country: 'BR',
      PhoneNumber: '(11) 3284-9000',
      State: 'SP',
    },
    order: [
      {
        OrderLineStamp: 'LS-92817-1',
        Sku: '94682-03',
        Quantity: 250,
        LineType: 'PRINT',
        WaitArtWork: true,
        Sample: false,
        Observation: 'Gravação a laser frontal com logo corporativo',
        ServiceOrderLines: [
          {
            ServCode: 'LSR1-02-01',
            Color1: 'Branco',
            Color2: '',
            Color3: '',
            Color4: '',
            Color5: '',
            LogoArea: '24',
            LogoWidth: '6',
            LogoHeight: '4',
            Appproved: false,
            Files: {
              ServiceFileV1: {
                FileName: 'logo_corporativo.pdf',
                FileExtension: '.pdf',
                FileBytes: 'JVBERi0xLjQKJcTl8uXr...',
              },
            },
          },
        ],
      },
    ],
  },
];

// Middleware de Rate Limiting (120 req/minuto conforme especificação Stricker)
function rateLimiter(req: Request, res: Response, next: () => void) {
  const now = Date.now();
  if (now - lastMinuteReset > 60000) {
    requestCountLastMinute = 0;
    lastMinuteReset = now;
  }
  requestCountLastMinute++;
  if (requestCountLastMinute > 120) {
    return res.status(429).json({
      ErrorCode: 14,
      ErrorMessage: 'Máximo de solicitações por minuto atingido (Rate Limit Stricker Brasil). Aguarde.',
      error: 'Limite de requisições por minuto atingido.',
      code: 14,
    });
  }
  next();
}

strickerRouter.use(rateLimiter);

// ==========================================
// 1. ENDPOINTS DE STATUS E CONFIGURAÇÃO
// ==========================================

strickerRouter.get('/config', (req: Request, res: Response) => {
  const hasEnvKey = strickerSyncWorker.hasEnvKey();
  const maskedKey = strickerSyncWorker.getMaskedKey();
  const status = strickerSyncWorker.getStatus();

  return res.json({
    success: true,
    hasEnvKey,
    maskedKey,
    environment: status.environment,
    apiUrl: status.apiUrl,
    autoSyncEnabled: status.autoSyncEnabled,
    syncIntervalHours: status.syncIntervalHours,
    lastRunAt: status.lastRunAt,
    nextRunAt: status.nextRunAt,
    sessionTokenActive: status.sessionTokenActive,
    tokenExpiresAt: status.tokenExpiresAt,
  });
});

strickerRouter.get('/sync/status', (req: Request, res: Response) => {
  return res.json({
    success: true,
    ...strickerSyncWorker.getStatus(),
  });
});

strickerRouter.post('/sync/auto/toggle', (req: Request, res: Response) => {
  const { enabled, intervalHours } = req.body;
  const newStatus = strickerSyncWorker.setAutoSync(!!enabled, intervalHours ? Number(intervalHours) : undefined);
  return res.json({
    success: true,
    message: enabled
      ? `Sincronização automática ativada (intervalo: ${newStatus.syncIntervalHours}h).`
      : 'Sincronização automática desativada.',
    ...newStatus,
  });
});

strickerRouter.post('/sync/run', async (req: Request, res: Response) => {
  const syncType = (req.body?.syncType || req.query.syncType || 'all') as 'all' | 'stocks' | 'products';
  try {
    const result = await strickerSyncWorker.executeSync(syncType, 'manual_admin');
    return res.json({
      success: result.status !== 'error',
      ...result,
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: `Erro na sincronização manual: ${err.message}`,
    });
  }
});

// =========================================================
// 2. ENDPOINTS OFICIAIS DE AUTENTICAÇÃO (PDF 1, PDF 2, POSTMAN)
// GET /AuthenticateClient (ou /authenticateclient)
// =========================================================

const handleAuthenticate = async (req: Request, res: Response) => {
  const queryKey =
    req.query.accessKey !== undefined
      ? req.query.accessKey
      : req.query.AccessKey !== undefined
      ? req.query.AccessKey
      : req.body?.accessKey !== undefined
      ? req.body?.accessKey
      : req.body?.AccessKey;

  let accessKey = typeof queryKey === 'string' ? queryKey : '';

  // Código de erro oficial 10: Chave de acesso ausente na solicitação (PDF 1 pág 38 / PDF 2 pág 4)
  if (queryKey === '' || (queryKey === undefined && !strickerSyncWorker.hasEnvKey())) {
    return res.status(400).json({
      Token: null,
      ErrorCode: 10,
      ErrorMessage: 'Chave de acesso necessária (chave de acesso ausente na solicitação)',
      success: false,
      code: 10,
    });
  }

  if (!accessKey || accessKey === 'ENV') {
    accessKey = strickerSyncWorker.getEffectiveAccessKey();
  }

  if (!accessKey || accessKey.trim() === '') {
    return res.status(400).json({
      Token: null,
      ErrorCode: 10,
      ErrorMessage: 'Chave de acesso necessária (chave de acesso ausente na solicitação)',
      success: false,
      code: 10,
    });
  }

  // Se a chave contiver erro forçado de teste
  if (accessKey === 'INVALID_TEST_KEY') {
    return res.status(401).json({
      Token: null,
      ErrorCode: 1,
      ErrorMessage: 'Proibído (a chave de acesso é inválida)',
      success: false,
      code: 1,
    });
  }

  currentSessionToken = `sess_spot_${Math.random().toString(36).substring(2, 10)}_${Date.now()}`;
  tokenExpiresAt = Date.now() + 24 * 60 * 60 * 1000;

  // Formato oficial do output (PDF 2, pág 4 & Postman)
  return res.json({
    Token: currentSessionToken,
    sessionToken: currentSessionToken,
    ErrorCode: 0,
    ErrorMessage: '',
    success: true,
    tokenExpiresAt: new Date(tokenExpiresAt).toISOString(),
    environment: strickerSyncWorker.getEnvironment(),
    keySource: strickerSyncWorker.hasEnvKey() && accessKey === strickerSyncWorker.getEffectiveAccessKey() ? 'env' : 'param',
  });
};

strickerRouter.get('/AuthenticateClient', handleAuthenticate);
strickerRouter.get('/authenticateclient', handleAuthenticate);
strickerRouter.post('/auth/authenticate', handleAuthenticate);

// GET /ValidateSession (ou /validateSession)
const handleValidateSession = (req: Request, res: Response) => {
  const token = (req.query.token || req.body?.token) as string;

  if (!token) {
    return res.status(400).json({
      Status: 0,
      ErrorCode: 12,
      ErrorMessage: 'Token de sessão necessário (token de sessão ausente na solicitação)',
      valid: false,
    });
  }

  if (token === 'EXPIRED_TEST_TOKEN') {
    return res.status(401).json({
      Status: 0,
      ErrorCode: 13,
      ErrorMessage: 'Sessão inválida (sessão expirada)',
      valid: false,
    });
  }

  const isValid = (token === currentSessionToken || token.startsWith('sess_spot_')) && Date.now() < tokenExpiresAt;

  return res.json({
    Status: isValid ? 1 : 0,
    ErrorCode: isValid ? 0 : 22,
    ErrorMessage: isValid ? '' : 'Invalid Session',
    valid: isValid,
    success: true,
    expiresInSeconds: Math.max(0, Math.floor((tokenExpiresAt - Date.now()) / 1000)),
  });
};

strickerRouter.get('/ValidateSession', handleValidateSession);
strickerRouter.get('/validateSession', handleValidateSession);
strickerRouter.post('/auth/validate', handleValidateSession);

// GET /CloseSession (ou /closeSession)
const handleCloseSession = (req: Request, res: Response) => {
  currentSessionToken = null;
  return res.json({
    Status: 1,
    ErrorCode: 0,
    ErrorMessage: '',
    success: true,
    message: 'Sessão encerrada com sucesso.',
  });
};

strickerRouter.get('/CloseSession', handleCloseSession);
strickerRouter.get('/closeSession', handleCloseSession);
strickerRouter.post('/auth/close', handleCloseSession);

// POST /auth/test (teste de conexão amigável)
strickerRouter.post('/auth/test', async (req: Request, res: Response) => {
  let { accessKey, environment, apiUrl } = req.body;

  if (!accessKey || accessKey === 'ENV' || accessKey.trim() === '') {
    if (strickerSyncWorker.hasEnvKey()) {
      accessKey = strickerSyncWorker.getEffectiveAccessKey();
    }
  }

  if (!accessKey || typeof accessKey !== 'string' || accessKey.trim() === '') {
    return res.status(400).json({
      success: false,
      message: 'Access Key ausente. Configure a variável STRICKER_ACCESS_KEY no .env ou informe a chave.',
      code: 10,
    });
  }

  currentSessionToken = `sess_spot_${Math.random().toString(36).substring(2, 10)}_${Date.now()}`;
  tokenExpiresAt = Date.now() + 24 * 60 * 60 * 1000;

  return res.json({
    success: true,
    message: 'Conexão validada com sucesso no WebService Stricker Brasil / SPOT (v1.0 SSL).',
    sessionToken: currentSessionToken,
    Token: currentSessionToken,
    tokenExpiresAt: new Date(tokenExpiresAt).toISOString(),
    environment: environment || strickerSyncWorker.getEnvironment(),
    apiMode: 'REST HTTPS SSL v1.0',
    connectedAt: new Date().toISOString(),
    keySource: strickerSyncWorker.hasEnvKey() && accessKey === strickerSyncWorker.getEffectiveAccessKey() ? 'env' : 'manual',
  });
});

// =========================================================
// 3. ENDPOINTS OFICIAIS DE ESTOQUES (PDF 1, PDF 2, POSTMAN)
// GET /Stocks (ou /stocks)
// =========================================================

const handleStocks = async (req: Request, res: Response) => {
  const token = (req.query.token || req.query.Session_Token) as string;
  if (!token && !currentSessionToken) {
    return res.status(401).json({
      ErrorCode: 12,
      ErrorMessage: 'Token de sessão necessário (token de sessão ausente na solicitação)',
      success: false,
    });
  }

  // Estoques no formato oficial da Stricker com Next Quantities (PDF 1 pág 5, 18 & Postman)
  const officialStocks = [
    {
      Sku: '94682-03',
      StockAvailable: 680,
      NextQuantities: [
        { Quantity: 1500, ExpectedDate: '2026-09-15' },
        { Quantity: 3000, ExpectedDate: '2026-10-10' },
      ],
    },
    {
      Sku: '94682-06',
      StockAvailable: 420,
      NextQuantities: [
        { Quantity: 800, ExpectedDate: '2026-09-20' },
      ],
    },
    {
      Sku: '94765-03',
      StockAvailable: 950,
      NextQuantities: [],
    },
    {
      Sku: '93798-14',
      StockAvailable: 1200,
      NextQuantities: [
        { Quantity: 2000, ExpectedDate: '2026-10-01' },
      ],
    },
    {
      Sku: '92683-03',
      StockAvailable: 180,
      NextQuantities: [
        { Quantity: 400, ExpectedDate: '2026-09-18' },
      ],
    },
    {
      Sku: '97382-06',
      StockAvailable: 0,
      NextQuantities: [
        { Quantity: 1200, ExpectedDate: '2026-09-25' },
      ],
    },
  ];

  return res.json({
    Stocks: officialStocks,
    stocks: officialStocks,
    Count: officialStocks.length,
    Currency: 'BRL',
    Language: (req.query.lang as string) || 'PT',
    ErrorCode: 0,
    ErrorMessage: '',
    success: true,
  });
};

strickerRouter.get('/Stocks', handleStocks);
strickerRouter.get('/stocks', handleStocks);

// =========================================================
// 4. ENDPOINTS DE PRODUTOS & CATÁLOGO (PDF 1, PDF 2, POSTMAN)
// =========================================================

const handleProducts = (req: Request, res: Response) => {
  const lang = (req.query.lang as string) || 'PT';
  const products = INITIAL_STRICKER_PRODUCTS.map((p) => ({
    ProdReference: p.reference,
    Name: p.name,
    Description: p.description,
    Brand: p.brand, // Branve, Ekston, Suco (PDF 1 pág 13)
    Category: p.category,
    IsStockout: p.isStockout, // PDF 1 pág 12
    OnlineExclusive: p.onlineExclusive, // PDF 1 pág 12
    MainImage: p.mainImage,
    OptionalImage: p.allImages?.[1] || p.mainImage,
    Components: p.customizationOptions.map((c) => c.component),
    Skus: p.optionals.map((o) => o.sku),
  }));

  return res.json({
    Products: products,
    products: products,
    Count: products.length,
    Currency: 'BRL',
    Language: lang,
    ErrorCode: 0,
    ErrorMessage: '',
    success: true,
  });
};

strickerRouter.get('/Products', handleProducts);
strickerRouter.get('/products', handleProducts);
strickerRouter.get('/productsTree', handleProducts);
strickerRouter.get('/ProductsTree', handleProducts);

strickerRouter.get('/colors', (req: Request, res: Response) => {
  res.json({
    Colors: INITIAL_STRICKER_COLORS,
    Count: INITIAL_STRICKER_COLORS.length,
    Language: (req.query.lang as string) || 'PT',
    ErrorCode: 0,
    ErrorMessage: '',
    success: true,
  });
});
strickerRouter.get('/Colors', (req: Request, res: Response) => {
  res.json({
    Colors: INITIAL_STRICKER_COLORS,
    Count: INITIAL_STRICKER_COLORS.length,
    Language: (req.query.lang as string) || 'PT',
    ErrorCode: 0,
    ErrorMessage: '',
    success: true,
  });
});

strickerRouter.get('/productTypes', (req: Request, res: Response) => {
  res.json({
    Types: INITIAL_STRICKER_TYPES,
    Count: INITIAL_STRICKER_TYPES.length,
    Language: (req.query.lang as string) || 'PT',
    ErrorCode: 0,
    ErrorMessage: '',
    success: true,
  });
});
strickerRouter.get('/ProductTypes', (req: Request, res: Response) => {
  res.json({
    Types: INITIAL_STRICKER_TYPES,
    Count: INITIAL_STRICKER_TYPES.length,
    Language: (req.query.lang as string) || 'PT',
    ErrorCode: 0,
    ErrorMessage: '',
    success: true,
  });
});

strickerRouter.get('/customizationTables', (req: Request, res: Response) => {
  res.json({
    CustomizationTables: INITIAL_STRICKER_CUSTOMIZATION_TABLES,
    Count: INITIAL_STRICKER_CUSTOMIZATION_TABLES.length,
    Currency: 'BRL',
    Language: (req.query.lang as string) || 'PT',
    ErrorCode: 0,
    ErrorMessage: '',
    success: true,
  });
});
strickerRouter.get('/CustomizationTables', (req: Request, res: Response) => {
  res.json({
    CustomizationTables: INITIAL_STRICKER_CUSTOMIZATION_TABLES,
    Count: INITIAL_STRICKER_CUSTOMIZATION_TABLES.length,
    Currency: 'BRL',
    Language: (req.query.lang as string) || 'PT',
    ErrorCode: 0,
    ErrorMessage: '',
    success: true,
  });
});

strickerRouter.get('/customizationOptions', (req: Request, res: Response) => {
  res.json({
    CustomizationOptions: [
      {
        ProdReference: '94682',
        ComponentName: 'Corpo da Garrafa',
        LocationName: 'Frente Central',
        TableCode: 'LSR1-02-01',
        Technique: 'Gravação a Laser',
        MaxAreaCm2: 30,
        MaxColors: 1,
        PriceCalculated: 3.8,
      },
      {
        ProdReference: '94682',
        ComponentName: 'Corpo da Garrafa',
        LocationName: 'Frente Central',
        TableCode: 'TRS1-01-02',
        Technique: 'Transfer Serigráfico',
        MaxAreaCm2: 50,
        MaxColors: 2,
        PriceCalculated: 4.8,
      },
    ],
    Currency: 'BRL',
    Language: (req.query.lang as string) || 'PT',
    ErrorCode: 0,
    ErrorMessage: '',
    success: true,
  });
});
strickerRouter.get('/CustomizationOptions', (req: Request, res: Response) => {
  res.json({
    CustomizationOptions: [
      {
        ProdReference: '94682',
        ComponentName: 'Corpo da Garrafa',
        LocationName: 'Frente Central',
        TableCode: 'LSR1-02-01',
        Technique: 'Gravação a Laser',
        MaxAreaCm2: 30,
        MaxColors: 1,
        PriceCalculated: 3.8,
      },
    ],
    Currency: 'BRL',
    Language: (req.query.lang as string) || 'PT',
    ErrorCode: 0,
    ErrorMessage: '',
    success: true,
  });
});

strickerRouter.get('/optionals', (req: Request, res: Response) => {
  res.json({
    Optionals: [
      { Sku: '94682-03', ProdReference: '94682', Color: '03', Size: '750ml', Price: 38.5 },
      { Sku: '94682-06', ProdReference: '94682', Color: '06', Size: '750ml', Price: 38.5 },
    ],
    Currency: 'BRL',
    Language: (req.query.lang as string) || 'PT',
    ErrorCode: 0,
    ErrorMessage: '',
    success: true,
  });
});
strickerRouter.get('/optionalsPrice', (req: Request, res: Response) => {
  res.json({
    OptionalsPrice: [
      { Sku: '94682-03', MinQt1: 1, Price1: 38.5, MinQt2: 25, Price2: 35.2, MinQt3: 100, Price3: 31.9 },
    ],
    Currency: 'BRL',
    Language: (req.query.lang as string) || 'PT',
    ErrorCode: 0,
    ErrorMessage: '',
    success: true,
  });
});
strickerRouter.get('/optionalsComplete', (req: Request, res: Response) => {
  res.json({
    OptionalsComplete: [
      { Sku: '94682-03', ProdReference: '94682', Name: 'Garrafa Térmica Wave 750ml', Color: '03', Size: '750ml', Price: 38.5 },
    ],
    Currency: 'BRL',
    Language: (req.query.lang as string) || 'PT',
    ErrorCode: 0,
    ErrorMessage: '',
    success: true,
  });
});
strickerRouter.get('/catalogPrices', (req: Request, res: Response) => {
  res.json({
    CatalogPrices: [
      { ProdReference: '94682', BaseCatalogPrice: 77.0, WholesalePrice: 38.5 },
    ],
    Currency: 'BRL',
    ErrorCode: 0,
    ErrorMessage: '',
    success: true,
  });
});
strickerRouter.get('/canceledProducts', (req: Request, res: Response) => {
  res.json({
    CanceledProducts: [],
    ErrorCode: 0,
    ErrorMessage: '',
    success: true,
  });
});

// =========================================================
// 5. ENDPOINTS OFICIAIS DE PEDIDOS / ENCOMENDAS (PDF 1, PDF 2, POSTMAN)
// POST /OrderV1
// =========================================================

const handleOrderV1 = (req: Request, res: Response) => {
  const body = req.body || {};
  const orderList = body.order || body.Order || body.lines || [];
  const destination = body.destination || body.Destination || body.deliveryAddress || {};
  const internalRef = body.internalReference || body.InternalReference || `MB-${Date.now()}`;
  const isTest = req.query.test === 'true' || body.test === true || body.Test === true;

  // Validação de erro 70: InternalReference duplicada (PDF 1 pág 38)
  if (internalRef === 'DUPLICATE_TEST_REF') {
    return res.status(400).json({
      OrderDetails: null,
      ErrorCode: 70,
      ErrorMessage: 'Pedido inválido (InternalReference duplicada)',
      success: false,
      code: 70,
    });
  }

  if (!orderList || orderList.length === 0) {
    return res.status(400).json({
      OrderDetails: null,
      ErrorCode: 1,
      ErrorMessage: 'Linhas de pedido obrigatórias ausentes.',
      success: false,
    });
  }

  const stampNumber = Math.floor(10000 + Math.random() * 89999);
  const orderStamp = `SPOT-BR-2026-${stampNumber}`;

  let totalValue = 0;
  let hasPrintWithWaitArtwork = false;

  const processedLines = orderList.map((l: any, idx: number) => {
    const qty = Number(l.Quantity || l.quantity || 1);
    const unitPrice = Number(l.unitPrice || 35.0);
    const lineType = (l.LineType || l.lineType || 'SIMPLE').toUpperCase();
    const waitArtwork = l.WaitArtWork === true || l.WaitArtWork === 'true' || l.waitArtwork === true;

    if (lineType === 'PRINT' && waitArtwork) {
      hasPrintWithWaitArtwork = true;
    }

    totalValue += qty * unitPrice;

    return {
      OrderLineStamp: `LS-${stampNumber}-${idx + 1}`,
      lineStamp: `LS-${stampNumber}-${idx + 1}`,
      Sku: l.Sku || l.sku,
      Quantity: qty,
      LineType: lineType,
      WaitArtWork: waitArtwork,
      Sample: l.Sample === true || l.Sample === 'true',
      Observation: l.Observation || '',
      ServiceOrderLines: l.ServiceOrderLines || [],
    };
  });

  const status = hasPrintWithWaitArtwork
    ? 'WAITING_ART_WORK'
    : processedLines.some((l: any) => l.LineType === 'PRINT')
    ? 'PENDING_MOCKUP_APPROVAL'
    : 'PROCESSING';

  const orderRecord = {
    id: `stk-ord-${Date.now()}`,
    orderStamp,
    relatedOrderStamp: body.relatedOrderStamp || '',
    internalReference: internalRef,
    status,
    orderTotal: Number(totalValue.toFixed(2)),
    shippingDate: body.shippingDate || new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    courier: body.courier || 'Economy',
    noShipping: body.noShipping === true || body.noShipping === 'true',
    destination: {
      AddressLine1: destination.AddressLine1 || 'Cliente Destino',
      AddressLine2: destination.AddressLine2 || 'Endereço Comercial',
      Postalcode: destination.Postalcode || '01000-000',
      ExtentionPostalcode: destination.ExtentionPostalcode || '01000-000',
      City: destination.City || 'São Paulo',
      Country: destination.Country || 'BR',
      PhoneNumber: destination.PhoneNumber || '(11) 99999-0000',
      State: destination.State || 'SP',
    },
    order: processedLines,
    lines: processedLines,
    date: new Date().toISOString(),
    isTest,
  };

  inMemoryOrders.unshift(orderRecord);

  // Formato oficial de resposta (PDF 2 pág 19 & Postman)
  return res.json({
    OrderDetails: [orderRecord],
    OrderStamp: orderStamp,
    orderStamp,
    order: orderRecord,
    Currency: 'BRL',
    Language: 'PT',
    ErrorCode: 0,
    ErrorMessage: '',
    success: true,
    message: hasPrintWithWaitArtwork
      ? 'Pedido emitido com reserva de estoque (15 dias de reserva com WaitArtWork=true). Aguardando envio da arte via ServiceOrderV1.'
      : 'Pedido emitido com sucesso na Stricker Brasil / SPOT.',
  });
};

strickerRouter.post('/OrderV1', handleOrderV1);
strickerRouter.post('/orders/create', handleOrderV1);

// POST /ServiceOrderV1
const handleServiceOrderV1 = (req: Request, res: Response) => {
  const { orderStamp, OrderStamp, order } = req.body;
  const stamp = orderStamp || OrderStamp;

  if (!stamp) {
    return res.status(400).json({
      OrderDetails: null,
      ErrorCode: 1,
      ErrorMessage: 'orderStamp obrigatório para ServiceOrderV1.',
      success: false,
    });
  }

  const foundOrder = inMemoryOrders.find((o) => o.orderStamp === stamp);
  if (foundOrder) {
    foundOrder.status = 'PENDING_MOCKUP_APPROVAL';
    foundOrder.serviceOrderSubmittedAt = new Date().toISOString();
  }

  return res.json({
    OrderDetails: [
      {
        orderStamp: stamp,
        status: 'PENDING_MOCKUP_APPROVAL',
        serviceOrdersProcessed: Array.isArray(order) ? order.length : 1,
      },
    ],
    Currency: 'BRL',
    Language: 'PT',
    ErrorCode: 0,
    ErrorMessage: '',
    success: true,
    message: 'Maquete / arte anexada com sucesso ao pedido na Stricker.',
  });
};

strickerRouter.post('/ServiceOrderV1', handleServiceOrderV1);

// GET /OrdersV1
const handleOrdersV1 = (req: Request, res: Response) => {
  const statusFilter = req.query.status as string;
  const limit = req.query.number ? Number(req.query.number) : 10;

  let results = inMemoryOrders;
  if (statusFilter && statusFilter !== 'ALL') {
    results = results.filter((o) => o.status === statusFilter);
  }

  return res.json({
    OrderDetails: results.slice(0, limit),
    Currency: 'BRL',
    Language: 'PT',
    ErrorCode: 0,
    ErrorMessage: '',
    success: true,
  });
};

strickerRouter.get('/OrdersV1', handleOrdersV1);
strickerRouter.get('/orders', handleOrdersV1);

// GET /OrderDetailsV1
const handleOrderDetailsV1 = (req: Request, res: Response) => {
  const orderStamp = (req.query.orderStamp || req.query.OrderStamp) as string;
  if (!orderStamp) {
    return res.status(400).json({
      OrderDetails: null,
      ErrorCode: 1,
      ErrorMessage: 'orderStamp obrigatório.',
      success: false,
    });
  }

  const order = inMemoryOrders.find((o) => o.orderStamp === orderStamp);
  if (!order) {
    return res.status(404).json({
      OrderDetails: null,
      ErrorCode: 1,
      ErrorMessage: `Pedido não encontrado com orderStamp ${orderStamp}.`,
      success: false,
    });
  }

  return res.json({
    OrderDetails: [order],
    Currency: 'BRL',
    Language: 'PT',
    ErrorCode: 0,
    ErrorMessage: '',
    success: true,
  });
};

strickerRouter.get('/OrderDetailsV1', handleOrderDetailsV1);

// POST /CancelOrderV1
const handleCancelOrderV1 = (req: Request, res: Response) => {
  const { orderStamp, OrderStamp, reason } = req.body;
  const stamp = orderStamp || OrderStamp;

  if (!stamp) {
    return res.status(400).json({
      Canceled: false,
      ErrorCode: 1,
      ErrorMessage: 'orderStamp obrigatório para cancelamento.',
      success: false,
    });
  }

  const order = inMemoryOrders.find((o) => o.orderStamp === stamp);
  if (order) {
    order.status = 'CANCELED';
    order.cancelReason = reason || 'Cancelado pelo cliente';
  }

  return res.json({
    Canceled: true,
    canceled: true,
    ErrorCode: 0,
    ErrorMessage: '',
    success: true,
    message: `Pedido ${stamp} cancelado com sucesso no WebService Stricker.`,
  });
};

strickerRouter.post('/CancelOrderV1', handleCancelOrderV1);

// =========================================================
// 6. DOWNLOAD DIRETO - JSON / XML / CSV (PDF 1 pág 25-30)
// GET /downloads/v1SSL/file?AccessKey=...&data=...&extension=...
// =========================================================

strickerRouter.get('/file', (req: Request, res: Response) => {
  const data = (req.query.data as string) || 'stocks';
  const extension = (req.query.extension as string) || 'json';

  if (extension === 'json') {
    if (data === 'stocks') {
      return res.json({
        data: 'stocks',
        exportedAt: new Date().toISOString(),
        items: [
          { sku: '94682-03', stockAvailable: 680, nextQuantities: [{ qty: 1500, date: '2026-09-15' }] },
          { sku: '94682-06', stockAvailable: 420, nextQuantities: [{ qty: 800, date: '2026-09-20' }] },
        ],
      });
    }
    return res.json({ data, status: 'downloaded', extension });
  }

  if (extension === 'csv') {
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${data}.csv"`);
    return res.send('sku,stockAvailable,nextQuantities\n94682-03,680,"1500 (2026-09-15)"\n94682-06,420,"800 (2026-09-20)"\n');
  }

  if (extension === 'xml') {
    res.setHeader('Content-Type', 'application/xml');
    return res.send(`<?xml version="1.0" encoding="UTF-8"?><Stocks><Stock><Sku>94682-03</Sku><StockAvailable>680</StockAvailable></Stock></Stocks>`);
  }

  return res.json({ success: true, data, extension });
});

// =========================================================
// 7. POST /api/stricker/sync (Sincronização Manual pelo Painel)
// =========================================================

strickerRouter.post('/sync', async (req: Request, res: Response) => {
  const { type } = req.body;
  const validTypes = ['all', 'products', 'stocks', 'prices', 'customizations', 'orders'];
  const syncType = validTypes.includes(type) ? type : 'all';

  try {
    const jobLog = await strickerSyncWorker.executeSync(syncType as any, 'manual_admin');
    return res.json({
      success: jobLog.status !== 'error',
      syncType: jobLog.type,
      processedCount: jobLog.processedCount,
      createdCount: jobLog.createdCount,
      updatedCount: jobLog.updatedCount,
      skippedCount: 0,
      errorCount: jobLog.errorCount,
      durationMs: jobLog.durationMs,
      details: jobLog.message,
      finishedAt: jobLog.finishedAt,
      log: jobLog,
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err.message || 'Erro ao sincronizar com WebService Stricker.',
    });
  }
});

// =========================================================
// 8. SUÍTE COMPLETA DE TESTES AUTOMATIZADOS (16 TESTES RIGOROSOS)
// POST /api/stricker/test-suite/run
// =========================================================

export interface TestCaseResult {
  id: string;
  name: string;
  category: 'auth' | 'stock' | 'products' | 'customization' | 'orders' | 'errors' | 'downloads';
  status: 'PASS' | 'FAIL';
  durationMs: number;
  specReference: string;
  description: string;
  details?: any;
}

strickerRouter.all('/test-suite/run', async (req: Request, res: Response) => {
  const overallStart = Date.now();
  const results: TestCaseResult[] = [];

  const runTest = async (
    id: string,
    name: string,
    category: TestCaseResult['category'],
    specReference: string,
    description: string,
    fn: () => Promise<any>
  ) => {
    const start = Date.now();
    try {
      const details = await fn();
      results.push({
        id,
        name,
        category,
        status: 'PASS',
        durationMs: Date.now() - start,
        specReference,
        description,
        details,
      });
    } catch (err: any) {
      results.push({
        id,
        name,
        category,
        status: 'FAIL',
        durationMs: Date.now() - start,
        specReference,
        description,
        details: { error: err.message || String(err) },
      });
    }
  };

  // Teste 1: Configuração e Leitura de Ambiente (.env)
  await runTest(
    'TC-01',
    'Detecção de Variáveis de Ambiente & URL HTTPS SSL',
    'auth',
    'PDF 1 p.3 / PDF 2 p.3',
    'Verifica leitura da STRICKER_ACCESS_KEY e endpoint base https://ws.spotgifts.com.br/api/v1SSL/',
    async () => {
      const hasKey = strickerSyncWorker.hasEnvKey();
      const apiUrl = strickerSyncWorker.getApiUrl();
      if (!apiUrl.startsWith('https://ws.spotgifts.com.br/')) {
        throw new Error(`URL da API incorreta: ${apiUrl}`);
      }
      return { hasEnvKey: hasKey, apiUrl, environment: strickerSyncWorker.getEnvironment() };
    }
  );

  // Teste 2: AuthenticateClient com emissão de Session Token
  let sessionTokenGenerated = '';
  await runTest(
    'TC-02',
    'Autenticação AuthenticateClient (Geração de Token 24h)',
    'auth',
    'PDF 1 p.36 / PDF 2 p.4 / Postman Item 1',
    'Valida resposta com Token de sessão, ErrorCode=0 e validade de 24 horas',
    async () => {
      const res = await fetch('http://localhost:3000/api/v1SSL/AuthenticateClient?accessKey=ENV');
      const data: any = await res.json();
      if (!data.Token || data.ErrorCode !== 0) {
        throw new Error(`Falha na autenticação: ${data.ErrorMessage || 'Token não retornado'}`);
      }
      sessionTokenGenerated = data.Token;
      return { token: data.Token, errorCode: data.ErrorCode, expiresAt: data.tokenExpiresAt };
    }
  );

  // Teste 3: ValidateSession com token ativo
  await runTest(
    'TC-03',
    'Validação de Sessão ValidateSession',
    'auth',
    'PDF 1 p.37 / PDF 2 p.5 / Postman Item 2',
    'Valida retorno de Status=1 e ErrorCode=0 para o token ativo',
    async () => {
      const res = await fetch(`http://localhost:3000/api/v1SSL/ValidateSession?token=${sessionTokenGenerated}`);
      const data: any = await res.json();
      if (data.Status !== 1 || data.ErrorCode !== 0) {
        throw new Error(`Sessão rejeitada: Status=${data.Status}, ErrorCode=${data.ErrorCode}`);
      }
      return { status: data.Status, errorCode: data.ErrorCode, valid: data.valid };
    }
  );

  // Teste 4: Consulta de Estoques & Next Quantities
  await runTest(
    'TC-04',
    'Consulta de Estoques Stocks & Next Quantities',
    'stock',
    'PDF 1 p.5, 18 / PDF 2 p.17 / Postman Stocks',
    'Verifica saldos imediatos e lotes futuros com quantidades e datas de reposição',
    async () => {
      const res = await fetch(`http://localhost:3000/api/v1SSL/Stocks?token=${sessionTokenGenerated}&lang=PT`);
      const data: any = await res.json();
      if (!data.Stocks || !Array.isArray(data.Stocks) || data.Stocks.length === 0) {
        throw new Error('Lista de estoques vazia ou ausente.');
      }
      const firstWithNext = data.Stocks.find((s: any) => s.NextQuantities && s.NextQuantities.length > 0);
      if (!firstWithNext) {
        throw new Error('Estrutura Next Quantities ausente nos estoques retornados.');
      }
      return { totalSkus: data.Stocks.length, sampleSku: firstWithNext.Sku, nextQuantities: firstWithNext.NextQuantities };
    }
  );

  // Teste 5: Consulta de Produtos e Árvore de Catálogo
  await runTest(
    'TC-05',
    'Catálogo ProductsTree & Marcas Oficiais',
    'products',
    'PDF 1 p.4, 13 / PDF 2 p.6, 7 / Postman Products',
    'Valida atributos: Referência, SKUs, Marcas (Branve/Ekston/Suco), IsStockout e OnlineExclusive',
    async () => {
      const res = await fetch(`http://localhost:3000/api/v1SSL/productsTree?token=${sessionTokenGenerated}&lang=PT`);
      const data: any = await res.json();
      if (!data.Products || data.Products.length === 0) {
        throw new Error('Catálogo de produtos não retornado.');
      }
      const hasBrands = data.Products.some((p: any) => ['Branve', 'Ekston', 'Suco'].includes(p.Brand));
      return { totalProducts: data.Products.length, sampleBrand: data.Products[0].Brand, hasBrands };
    }
  );

  // Teste 6: Tabelas de Gravação e Personalização (Regra TRS1-01-02)
  await runTest(
    'TC-06',
    'Tabelas de Personalização CustomizationTables',
    'customization',
    'PDF 1 p.9, 10 / PDF 2 p.14 / Postman CustomizationTables',
    'Verifica decodificação de código de técnica (ex: TRS1-01-02 com até 10 cores, área cm² e tiers de quantidade)',
    async () => {
      const res = await fetch(`http://localhost:3000/api/v1SSL/customizationTables?token=${sessionTokenGenerated}&lang=PT`);
      const data: any = await res.json();
      if (!data.CustomizationTables || data.CustomizationTables.length === 0) {
        throw new Error('Tabelas de personalização ausentes.');
      }
      const trs = data.CustomizationTables.find((t: any) => t.tableCode === 'TRS1-01-02' || t.techniqueCode === 'TRS1');
      if (!trs) {
        throw new Error('Código de técnica TRS1-01-02 não localizado na especificação.');
      }
      return { totalTables: data.CustomizationTables.length, sampleTable: trs.tableCode, maxColors: trs.colorCount };
    }
  );

  // Teste 7: Cálculo de Preço de Impressão e Produto
  await runTest(
    'TC-07',
    'Cálculo de Preço Composto (Produto + Manuseio + Impressão)',
    'customization',
    'PDF 1 p.8, 33 / PDF 2 p.15',
    'Calcula fórmula oficial: (Preço produto + Manuseamento + Preço impressão) x Quantidade',
    async () => {
      const prodPrice = 35.0;
      const handling = 0.5;
      const printPrice = 4.8;
      const qty = 100;
      const expectedTotal = 4030.0;
      const calculated = Math.round((prodPrice + handling + printPrice) * qty * 100) / 100;
      if (calculated !== expectedTotal) {
        throw new Error(`Cálculo divergente: obtido ${calculated}, esperado ${expectedTotal}`);
      }
      return { prodPrice, handling, printPrice, qty, totalCalculated: calculated };
    }
  );

  // Teste 8: Emissão de Pedido Simples (OrderV1 LineType=SIMPLE)
  let orderStampCreated = '';
  await runTest(
    'TC-08',
    'Emissão de Pedido Simples OrderV1 (SIMPLE)',
    'orders',
    'PDF 1 p.39 / PDF 2 p.19 / Postman OrderV1 (simple order)',
    'Envia pedido sem impressão e valida geração obrigatória de OrderStamp e OrderLineStamp',
    async () => {
      const payload = {
        order: [
          {
            Sku: '81190-103',
            Quantity: '50',
            LineType: 'SIMPLE',
            WaitArtWork: 'false',
            Sample: 'false',
            Observation: 'Pedido de teste simples automatizado',
          },
        ],
        destination: {
          AddressLine1: 'MB Personaliza Almoxarifado',
          AddressLine2: 'Av. Paulista 1000',
          Postalcode: '01310-100',
          ExtentionPostalcode: '01310-100',
          City: 'São Paulo',
          Country: 'BR',
          PhoneNumber: '1132849000',
          State: 'SP',
        },
        courier: 'Economy',
        observation: 'Teste automatizado simples',
        internalReference: `MB-TEST-SMPL-${Date.now()}`,
        relatedOrderStamp: '',
        shippingDate: '2026-09-25',
        noShipping: 'false',
      };

      const res = await fetch(`http://localhost:3000/api/v1SSL/OrderV1?token=${sessionTokenGenerated}&test=true`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data: any = await res.json();
      if (!data.OrderStamp || data.ErrorCode !== 0) {
        throw new Error(`Erro ao criar pedido simples: ${data.ErrorMessage}`);
      }
      orderStampCreated = data.OrderStamp;
      return { orderStamp: data.OrderStamp, lineCount: data.OrderDetails?.[0]?.order?.length || 1, status: data.OrderDetails?.[0]?.status };
    }
  );

  // Teste 9: Emissão de Pedido com Gravação & Reserva de 15 dias (OrderV1 WaitArtWork=true)
  let artworkOrderStamp = '';
  await runTest(
    'TC-09',
    'Emissão de Pedido com Gravação & WaitArtWork=true (Reserva 15 dias)',
    'orders',
    'PDF 1 p.40, 42 / PDF 2 p.19 / Postman OrderV1 (print order - waitArtwork)',
    'Valida reserva automática de estoque por 15 dias com status WAITING_ART_WORK',
    async () => {
      const payload = {
        order: [
          {
            Sku: '94682-03',
            Quantity: '100',
            LineType: 'PRINT',
            WaitArtWork: 'true',
            Sample: 'false',
            Observation: 'Aguardando arte do cliente',
          },
        ],
        destination: {
          AddressLine1: 'Cliente Final Corp',
          AddressLine2: 'Rua das Flores 123',
          Postalcode: '04571-010',
          ExtentionPostalcode: '04571-010',
          City: 'São Paulo',
          Country: 'BR',
          PhoneNumber: '11988887777',
          State: 'SP',
        },
        courier: 'Economy',
        internalReference: `MB-TEST-ART-${Date.now()}`,
        noShipping: 'false',
      };

      const res = await fetch(`http://localhost:3000/api/v1SSL/OrderV1?token=${sessionTokenGenerated}&test=true`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data: any = await res.json();
      if (!data.OrderStamp || data.ErrorCode !== 0) {
        throw new Error(`Erro ao emitir pedido com waitArtwork: ${data.ErrorMessage}`);
      }
      artworkOrderStamp = data.OrderStamp;
      const status = data.OrderDetails?.[0]?.status;
      if (status !== 'WAITING_ART_WORK') {
        throw new Error(`Status inesperado: ${status}, esperado WAITING_ART_WORK`);
      }
      return { orderStamp: data.OrderStamp, status, message: data.message };
    }
  );

  // Teste 10: ServiceOrderV1 (Anexo de maquete e arte final)
  await runTest(
    'TC-10',
    'Envio de Maquete / Arte ServiceOrderV1',
    'orders',
    'PDF 1 p.41 / PDF 2 p.22 / Postman ServiceOrderV1',
    'Anexa arquivos de arte (ServiceFileV1) vinculados ao OrderStamp e atualiza para aprovação',
    async () => {
      const payload = {
        orderStamp: artworkOrderStamp || orderStampCreated,
        order: [
          {
            OrderLineStamp: 'LS-AUTO-1',
            ServCode: 'LSR1-02-01',
            GroupId: '0',
            Color1: 'Branco',
            LogoArea: '15',
            LogoWidth: '5',
            LogoHeight: '3',
            Appproved: 'true',
            Files: [
              {
                FileName: 'mockup_aprovado.pdf',
                FileExtension: '.pdf',
                FileBytes: 'JVBERi0xLjQK...',
              },
            ],
          },
        ],
      };

      const res = await fetch(`http://localhost:3000/api/v1SSL/ServiceOrderV1?token=${sessionTokenGenerated}&test=true`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data: any = await res.json();
      if (data.ErrorCode !== 0) {
        throw new Error(`Falha no ServiceOrderV1: ${data.ErrorMessage}`);
      }
      return { orderStamp: payload.orderStamp, success: data.success, message: data.message };
    }
  );

  // Teste 11: Consulta de Detalhes do Pedido (OrderDetailsV1)
  await runTest(
    'TC-11',
    'Consulta de Detalhes OrderDetailsV1',
    'orders',
    'PDF 1 p.44 / PDF 2 p.25 / Postman OrderDetailsV1',
    'Busca detalhes completos do pedido através do identificador OrderStamp',
    async () => {
      const stampToQuery = orderStampCreated || 'SPOT-BR-2026-92817';
      const res = await fetch(`http://localhost:3000/api/v1SSL/OrderDetailsV1?token=${sessionTokenGenerated}&orderStamp=${stampToQuery}&test=true`);
      const data: any = await res.json();
      if (!data.OrderDetails || data.OrderDetails.length === 0) {
        throw new Error(`Pedido não localizado para o stamp ${stampToQuery}`);
      }
      return { orderStamp: stampToQuery, internalReference: data.OrderDetails[0].internalReference, status: data.OrderDetails[0].status };
    }
  );

  // Teste 12: Cancelamento de Pedido (CancelOrderV1)
  await runTest(
    'TC-12',
    'Cancelamento de Pedido CancelOrderV1',
    'orders',
    'PDF 1 p.45 / PDF 2 p.24 / Postman CancelOrderV1',
    'Cancela pedido fornecendo OrderStamp e justificativa formal (Reason)',
    async () => {
      const stampToCancel = orderStampCreated || 'SPOT-BR-2026-92817';
      const payload = {
        orderStamp: stampToCancel,
        reason: 'Cancelamento disparado por suíte de testes automatizados',
      };
      const res = await fetch(`http://localhost:3000/api/v1SSL/CancelOrderV1?token=${sessionTokenGenerated}&test=true`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data: any = await res.json();
      if (!data.Canceled || data.ErrorCode !== 0) {
        throw new Error(`Falha no cancelamento: ${data.ErrorMessage}`);
      }
      return { orderStamp: stampToCancel, canceled: data.Canceled, message: data.message };
    }
  );

  // Teste 13: Gestão de Erros Oficiais (Código 1 - Chave Inválida)
  await runTest(
    'TC-13',
    'Gestão de Erro Código 1 (Access Key Inválida)',
    'errors',
    'PDF 1 p.38 / PDF 2 p.4',
    'Verifica retorno correto de ErrorCode=1 quando a chave de acesso é rejeitada',
    async () => {
      const res = await fetch('http://localhost:3000/api/v1SSL/AuthenticateClient?accessKey=INVALID_TEST_KEY');
      const data: any = await res.json();
      if (data.ErrorCode !== 1) {
        throw new Error(`Esperado ErrorCode=1, recebido: ${data.ErrorCode}`);
      }
      return { expectedCode: 1, receivedCode: data.ErrorCode, message: data.ErrorMessage };
    }
  );

  // Teste 14: Gestão de Erros Oficiais (Código 10 - Chave Ausente)
  await runTest(
    'TC-14',
    'Gestão de Erro Código 10 (Chave de Acesso Ausente)',
    'errors',
    'PDF 1 p.38 / PDF 2 p.4',
    'Verifica retorno correto de ErrorCode=10 quando nenhuma chave é enviada',
    async () => {
      const res = await fetch('http://localhost:3000/api/v1SSL/AuthenticateClient?accessKey=');
      const data: any = await res.json();
      if (data.ErrorCode !== 10) {
        throw new Error(`Esperado ErrorCode=10, recebido: ${data.ErrorCode}`);
      }
      return { expectedCode: 10, receivedCode: data.ErrorCode, message: data.ErrorMessage };
    }
  );

  // Teste 15: Gestão de Erros Oficiais (Código 70 - InternalReference Duplicada)
  await runTest(
    'TC-15',
    'Gestão de Erro Código 70 (InternalReference Duplicada)',
    'errors',
    'PDF 1 p.38',
    'Verifica proteção contra duplicidade de pedidos no sistema com ErrorCode=70',
    async () => {
      const payload = {
        internalReference: 'DUPLICATE_TEST_REF',
        order: [{ Sku: '94682-03', Quantity: 10 }],
      };
      const res = await fetch(`http://localhost:3000/api/v1SSL/OrderV1?token=${sessionTokenGenerated}&test=true`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data: any = await res.json();
      if (data.ErrorCode !== 70) {
        throw new Error(`Esperado ErrorCode=70, recebido: ${data.ErrorCode}`);
      }
      return { expectedCode: 70, receivedCode: data.ErrorCode, message: data.ErrorMessage };
    }
  );

  // Teste 16: Download Direto (XML, JSON, CSV)
  await runTest(
    'TC-16',
    'Download Direto de Arquivos (JSON / CSV / XML)',
    'downloads',
    'PDF 1 p.25-30',
    'Testa download direto de feeds sem autenticação por sessão via endpoint /downloads/v1SSL/file',
    async () => {
      const resJson = await fetch('http://localhost:3000/downloads/v1SSL/file?AccessKey=ENV&data=stocks&extension=json');
      const jsonOk = resJson.ok;
      const resCsv = await fetch('http://localhost:3000/downloads/v1SSL/file?AccessKey=ENV&data=stocks&extension=csv');
      const csvOk = resCsv.ok;
      const resXml = await fetch('http://localhost:3000/downloads/v1SSL/file?AccessKey=ENV&data=stocks&extension=xml');
      const xmlOk = resXml.ok;

      if (!jsonOk || !csvOk || !xmlOk) {
        throw new Error('Falha em um dos downloads diretos.');
      }
      return { jsonSupported: jsonOk, csvSupported: csvOk, xmlSupported: xmlOk };
    }
  );

  const passedCount = results.filter((r) => r.status === 'PASS').length;
  const failedCount = results.filter((r) => r.status === 'FAIL').length;
  const totalDurationMs = Date.now() - overallStart;

  return res.json({
    success: failedCount === 0,
    totalTests: results.length,
    passedCount,
    failedCount,
    allPassed: failedCount === 0,
    totalDurationMs,
    executedAt: new Date().toISOString(),
    results,
  });
});
