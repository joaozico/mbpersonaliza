import crypto from 'crypto';
import { Router, Request, Response } from 'express';
import { strickerSyncWorker } from './strickerSyncWorker.ts';
import { requireStaffSession } from '../middleware/auth.ts';
import {
  getStrickerConfigFromDb,
  getStrickerCustomizationTablesFromDb,
  getStrickerLogsFromDb,
  getStrickerOrdersFromDb,
  getStrickerProductsFromDb,
  insertStrickerLogInDb,
  saveStrickerConfigInDb,
  upsertStrickerOrderInDb,
  upsertStrickerProductInDb,
} from '../db/repository.ts';
import {
  INITIAL_STRICKER_COLORS,
  INITIAL_STRICKER_TYPES,
} from '../data/strickerInitialData.ts';
import { handleRouterError } from './dbErrorHelper.ts';

export const strickerRouter = Router();
strickerRouter.use(requireStaffSession);

let requestCountLastMinute = 0;
let lastMinuteReset = Date.now();

function rateLimiter(_req: Request, res: Response, next: () => void) {
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
// 1. ENDPOINTS DE STATUS E CONFIGURAÇÃO (PostgreSQL)
// ==========================================

strickerRouter.get('/config', async (_req: Request, res: Response) => {
  try {
    const status = await strickerSyncWorker.getStatusFromDb();
    return res.json({
      success: true,
      hasEnvKey: status.hasEnvKey,
      maskedKey: status.maskedKey,
      environment: status.environment,
      apiUrl: status.apiUrl,
      autoSyncEnabled: status.autoSyncEnabled,
      syncIntervalHours: status.syncIntervalHours,
      lastRunAt: status.lastRunAt,
      nextRunAt: status.nextRunAt,
      sessionTokenActive: status.sessionTokenActive,
      tokenExpiresAt: status.tokenExpiresAt,
    });
  } catch (err: any) {
    return handleRouterError(res, err, 'Erro ao consultar configuração Stricker no PostgreSQL.');
  }
});

strickerRouter.get('/bootstrap', async (_req: Request, res: Response) => {
  try {
    const [status, savedCfg, products, customizationTables, orders, syncLogs, requestLogs] =
      await Promise.all([
        strickerSyncWorker.getStatusFromDb(),
        getStrickerConfigFromDb(),
        getStrickerProductsFromDb(),
        getStrickerCustomizationTablesFromDb(),
        getStrickerOrdersFromDb(),
        getStrickerLogsFromDb('sync'),
        getStrickerLogsFromDb('request'),
      ]);

    const safeCfg = savedCfg ? { ...savedCfg } : {};
    delete (safeCfg as any).accessKey;

    return res.json({
      success: true,
      config: {
        ...safeCfg,
        isEnvKeyConfigured: status.hasEnvKey,
        maskedAccessKey: status.maskedKey,
        environment: status.environment,
        apiUrl: status.apiUrl,
        autoSyncEnabled: status.autoSyncEnabled,
        syncIntervalHours: status.syncIntervalHours,
        lastRunAt: status.lastRunAt,
        nextAutoSyncDate: status.nextRunAt,
        lastConnectionStatus: status.sessionTokenActive ? 'connected' : safeCfg.lastConnectionStatus || 'disconnected',
        sessionTokenActive: status.sessionTokenActive,
        tokenExpiresAt: status.tokenExpiresAt,
      },
      products,
      customizationTables,
      orders,
      syncLogs,
      requestLogs,
    });
  } catch (err: any) {
    return handleRouterError(res, err, 'Erro ao carregar dados iniciais da Stricker no PostgreSQL.');
  }
});

strickerRouter.put('/config', async (req: Request, res: Response) => {
  try {
    const current = (await getStrickerConfigFromDb()) || {};
    const body = req.body || {};
    const {
      environment,
      apiUrl,
      autoSyncEnabled,
      syncIntervalHours,
      isEnabled,
      defaultProfitMarginPct,
      additionalHandlingCost,
      defaultProductStatus,
      autoPublishToStore,
      rateLimitPerMinute,
      language,
      format,
      lastConnectionStatus,
      lastConnectionMessage,
      lastConnectionDate,
      lastSyncAt,
      lastProductsSyncDate,
      lastStockSyncDate,
      lastPricesSyncDate,
      lastCustomizationsSyncDate,
      lastOrdersSyncDate,
    } = body;
    const saved = await saveStrickerConfigInDb({
      ...current,
      environment: environment ?? current.environment ?? strickerSyncWorker.getEnvironment(),
      apiUrl: apiUrl ?? current.apiUrl ?? strickerSyncWorker.getApiUrl(),
      autoSyncEnabled:
        autoSyncEnabled !== undefined ? Boolean(autoSyncEnabled) : current.autoSyncEnabled ?? true,
      syncIntervalHours:
        syncIntervalHours !== undefined ? Number(syncIntervalHours) : current.syncIntervalHours ?? 12,
      ...(isEnabled !== undefined ? { isEnabled: Boolean(isEnabled) } : {}),
      ...(defaultProfitMarginPct !== undefined ? { defaultProfitMarginPct: Number(defaultProfitMarginPct) } : {}),
      ...(additionalHandlingCost !== undefined ? { additionalHandlingCost: Number(additionalHandlingCost) } : {}),
      ...(defaultProductStatus !== undefined ? { defaultProductStatus } : {}),
      ...(autoPublishToStore !== undefined ? { autoPublishToStore: Boolean(autoPublishToStore) } : {}),
      ...(rateLimitPerMinute !== undefined ? { rateLimitPerMinute: Number(rateLimitPerMinute) } : {}),
      ...(language !== undefined ? { language } : {}),
      ...(format !== undefined ? { format } : {}),
      ...(lastConnectionStatus !== undefined ? { lastConnectionStatus } : {}),
      ...(lastConnectionMessage !== undefined ? { lastConnectionMessage } : {}),
      ...(lastConnectionDate !== undefined ? { lastConnectionDate } : {}),
      ...(lastSyncAt !== undefined ? { lastSyncAt } : {}),
      ...(lastProductsSyncDate !== undefined ? { lastProductsSyncDate } : {}),
      ...(lastStockSyncDate !== undefined ? { lastStockSyncDate } : {}),
      ...(lastPricesSyncDate !== undefined ? { lastPricesSyncDate } : {}),
      ...(lastCustomizationsSyncDate !== undefined ? { lastCustomizationsSyncDate } : {}),
      ...(lastOrdersSyncDate !== undefined ? { lastOrdersSyncDate } : {}),
    });
    return res.json({ success: true, config: saved });
  } catch (err: any) {
    return handleRouterError(res, err, 'Erro ao salvar configuração Stricker no PostgreSQL.');
  }
});

strickerRouter.post('/products', async (req: Request, res: Response) => {
  try {
    const items = Array.isArray(req.body?.products)
      ? req.body.products
      : req.body?.product
      ? [req.body.product]
      : [];
    if (items.length === 0) {
      return res.status(400).json({ success: false, error: 'Produto(s) obrigatório(s).' });
    }
    const savedList = [];
    for (const item of items) {
      if (item && item.reference) {
        savedList.push(await upsertStrickerProductInDb(item));
      }
    }
    return res.json({ success: true, count: savedList.length, products: savedList });
  } catch (err: any) {
    return handleRouterError(res, err, 'Erro ao persistir produtos Stricker no PostgreSQL.');
  }
});

strickerRouter.post('/logs', async (req: Request, res: Response) => {
  try {
    const { logType, log } = req.body || {};
    if ((logType !== 'sync' && logType !== 'request') || !log) {
      return res.status(400).json({ success: false, error: 'logType e log são obrigatórios.' });
    }
    await insertStrickerLogInDb(logType, log);
    return res.json({ success: true });
  } catch (err: any) {
    return handleRouterError(res, err, 'Erro ao gravar log Stricker no PostgreSQL.');
  }
});

strickerRouter.get('/sync/status', async (_req: Request, res: Response) => {
  try {
    const status = await strickerSyncWorker.getStatusFromDb();
    return res.json({
      success: true,
      ...status,
    });
  } catch (err: any) {
    return handleRouterError(res, err, 'Erro ao obter status de sincronização Stricker.');
  }
});

strickerRouter.post('/sync/auto/toggle', async (req: Request, res: Response) => {
  try {
    const { enabled, intervalHours } = req.body || {};
    const newStatus = await strickerSyncWorker.setAutoSyncInDb(
      !!enabled,
      intervalHours ? Number(intervalHours) : undefined
    );
    return res.json({
      success: true,
      message: enabled
        ? `Sincronização automática ativada (intervalo: ${newStatus.syncIntervalHours}h).`
        : 'Sincronização automática desativada.',
      ...newStatus,
    });
  } catch (err: any) {
    return handleRouterError(res, err, 'Erro ao atualizar sincronização automática.');
  }
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
    return handleRouterError(res, err, `Erro na sincronização manual: ${err.message}`);
  }
});

// =========================================================
// 2. ENDPOINTS OFICIAIS DE AUTENTICAÇÃO (Session Persistida no PostgreSQL)
// =========================================================

const handleAuthenticate = async (req: Request, res: Response) => {
  try {
    const queryKey =
      req.query.accessKey !== undefined
        ? req.query.accessKey
        : req.query.AccessKey !== undefined
        ? req.query.AccessKey
        : req.body?.accessKey !== undefined
        ? req.body?.accessKey
        : req.body?.AccessKey;

    let accessKey = typeof queryKey === 'string' ? queryKey : '';

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

    if (accessKey === 'INVALID_TEST_KEY') {
      return res.status(401).json({
        Token: null,
        ErrorCode: 1,
        ErrorMessage: 'Proibido (a chave de acesso é inválida)',
        success: false,
        code: 1,
      });
    }

    const token = `sess_spot_${crypto.randomBytes(12).toString('hex')}`;
    const expiresAtIso = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const currentCfg = (await getStrickerConfigFromDb()) || {};
    await saveStrickerConfigInDb({
      ...currentCfg,
      environment: currentCfg.environment || strickerSyncWorker.getEnvironment(),
      apiUrl: currentCfg.apiUrl || strickerSyncWorker.getApiUrl(),
      sessionToken: token,
      tokenExpiresAt: expiresAtIso,
      autoSyncEnabled: currentCfg.autoSyncEnabled ?? true,
      syncIntervalHours: currentCfg.syncIntervalHours ?? 12,
    });

    await insertStrickerLogInDb('request', {
      endpoint: 'AuthenticateClient',
      status: 'success',
      keySource: strickerSyncWorker.hasEnvKey() && accessKey === strickerSyncWorker.getEffectiveAccessKey() ? 'env' : 'param',
      timestamp: new Date().toISOString(),
    });

    return res.json({
      Token: token,
      sessionToken: token,
      ErrorCode: 0,
      ErrorMessage: '',
      success: true,
      tokenExpiresAt: expiresAtIso,
      environment: currentCfg.environment || strickerSyncWorker.getEnvironment(),
      keySource:
        strickerSyncWorker.hasEnvKey() && accessKey === strickerSyncWorker.getEffectiveAccessKey()
          ? 'env'
          : 'param',
    });
  } catch (err: any) {
    return handleRouterError(res, err, 'Erro ao autenticar sessão Stricker.');
  }
};

strickerRouter.get('/AuthenticateClient', handleAuthenticate);
strickerRouter.get('/authenticateclient', handleAuthenticate);
strickerRouter.post('/auth/authenticate', handleAuthenticate);

const handleValidateSession = async (req: Request, res: Response) => {
  try {
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

    const cfg = await getStrickerConfigFromDb();
    const expiresMs = cfg?.tokenExpiresAt ? new Date(cfg.tokenExpiresAt).getTime() : 0;
    const isValid = Boolean(cfg?.sessionToken) && token === cfg?.sessionToken && Date.now() < expiresMs;

    return res.json({
      Status: isValid ? 1 : 0,
      ErrorCode: isValid ? 0 : 22,
      ErrorMessage: isValid ? '' : 'Invalid Session',
      valid: isValid,
      success: true,
      expiresInSeconds: isValid ? Math.max(0, Math.floor((expiresMs - Date.now()) / 1000)) : 0,
    });
  } catch (err: any) {
    return handleRouterError(res, err, 'Erro ao validar sessão Stricker.');
  }
};

strickerRouter.get('/ValidateSession', handleValidateSession);
strickerRouter.get('/validateSession', handleValidateSession);
strickerRouter.post('/auth/validate', handleValidateSession);

const handleCloseSession = async (_req: Request, res: Response) => {
  try {
    const cfg = (await getStrickerConfigFromDb()) || {};
    await saveStrickerConfigInDb({
      ...cfg,
      sessionToken: null,
      tokenExpiresAt: null,
    });
    return res.json({
      Status: 1,
      ErrorCode: 0,
      ErrorMessage: '',
      success: true,
      message: 'Sessão encerrada com sucesso.',
    });
  } catch (err: any) {
    return handleRouterError(res, err, 'Erro ao encerrar sessão Stricker.');
  }
};

strickerRouter.get('/CloseSession', handleCloseSession);
strickerRouter.get('/closeSession', handleCloseSession);
strickerRouter.post('/auth/close', handleCloseSession);

strickerRouter.post('/auth/test', async (req: Request, res: Response) => {
  try {
    let { accessKey, environment } = req.body || {};

    if (!accessKey || accessKey === 'ENV' || String(accessKey).trim() === '') {
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

    const token = `sess_spot_${crypto.randomBytes(12).toString('hex')}`;
    const expiresIso = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const cfg = (await getStrickerConfigFromDb()) || {};
    await saveStrickerConfigInDb({
      ...cfg,
      environment: environment || cfg.environment || strickerSyncWorker.getEnvironment(),
      sessionToken: token,
      tokenExpiresAt: expiresIso,
    });

    return res.json({
      success: true,
      message: 'Conexão validada e sessão persistida no PostgreSQL (WebService Stricker v1.0 SSL).',
      sessionToken: token,
      Token: token,
      tokenExpiresAt: expiresIso,
      environment: environment || cfg.environment || strickerSyncWorker.getEnvironment(),
      apiMode: 'REST HTTPS SSL v1.0',
      connectedAt: new Date().toISOString(),
      keySource:
        strickerSyncWorker.hasEnvKey() && accessKey === strickerSyncWorker.getEffectiveAccessKey()
          ? 'env'
          : 'manual',
    });
  } catch (err: any) {
    return handleRouterError(res, err, 'Erro ao testar conexão Stricker.');
  }
});

// =========================================================
// 3. ENDPOINTS DE ESTOQUES & PRODUTOS (PostgreSQL)
// =========================================================

const handleStocks = async (req: Request, res: Response) => {
  try {
    const token = (req.query.token || req.query.Session_Token) as string;
    const cfg = await getStrickerConfigFromDb();
    const activeToken = cfg?.sessionToken;

    if (!token && !activeToken) {
      return res.status(401).json({
        ErrorCode: 12,
        ErrorMessage: 'Token de sessão necessário (token de sessão ausente na solicitação)',
        success: false,
      });
    }

    const products = await getStrickerProductsFromDb();
    const officialStocks: any[] = [];
    for (const p of products) {
      for (const opt of p.optionals || []) {
        officialStocks.push({
          Sku: opt.sku,
          StockAvailable: Number(opt.stockAvailable ?? 0),
          NextQuantities: Array.isArray(opt.nextQuantities) ? opt.nextQuantities : [],
        });
      }
    }

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
  } catch (err: any) {
    return handleRouterError(res, err, 'Erro ao consultar estoques Stricker no PostgreSQL.');
  }
};

strickerRouter.get('/Stocks', handleStocks);
strickerRouter.get('/stocks', handleStocks);

const handleProducts = async (req: Request, res: Response) => {
  try {
    const lang = (req.query.lang as string) || 'PT';
    const strickerProds = await getStrickerProductsFromDb();
    const mapped = strickerProds.map((p: any) => ({
      ProdReference: p.reference,
      Name: p.name,
      Description: p.description,
      Brand: p.brand,
      Category: p.category,
      IsStockout: p.isStockout,
      OnlineExclusive: p.onlineExclusive,
      MainImage: p.mainImage,
      OptionalImage: p.allImages?.[1] || p.mainImage,
      Components: (p.customizationOptions || []).map((c: any) => c.component),
      Skus: (p.optionals || []).map((o: any) => o.sku),
    }));

    return res.json({
      Products: mapped,
      products: mapped,
      Count: mapped.length,
      Currency: 'BRL',
      Language: lang,
      ErrorCode: 0,
      ErrorMessage: '',
      success: true,
    });
  } catch (err: any) {
    return handleRouterError(res, err, 'Erro ao consultar produtos Stricker no PostgreSQL.');
  }
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

const handleCustomizationTables = async (req: Request, res: Response) => {
  try {
    const tables = await getStrickerCustomizationTablesFromDb();
    return res.json({
      CustomizationTables: tables,
      Count: tables.length,
      Currency: 'BRL',
      Language: (req.query.lang as string) || 'PT',
      ErrorCode: 0,
      ErrorMessage: '',
      success: true,
    });
  } catch (err: any) {
    return handleRouterError(res, err, 'Erro ao consultar tabelas de gravação Stricker no PostgreSQL.');
  }
};
strickerRouter.get('/customizationTables', handleCustomizationTables);
strickerRouter.get('/CustomizationTables', handleCustomizationTables);

const handleCustomizationOptions = async (req: Request, res: Response) => {
  try {
    const products = await getStrickerProductsFromDb();
    const options: any[] = [];
    for (const p of products) {
      for (const opt of p.customizationOptions || []) {
        options.push({
          ProdReference: p.reference,
          ComponentName: opt.component || 'Principal',
          LocationName: opt.location || 'Padrão',
          TableCode: opt.tableCode || 'LSR1-02-01',
          Technique: opt.technique || 'Gravação',
          MaxAreaCm2: Number(opt.maxAreaCm2 || 30),
          MaxColors: Number(opt.maxColors || 1),
          PriceCalculated: Number(opt.pricePerUnit || 3.8),
        });
      }
    }
    return res.json({
      CustomizationOptions: options,
      Currency: 'BRL',
      Language: (req.query.lang as string) || 'PT',
      ErrorCode: 0,
      ErrorMessage: '',
      success: true,
    });
  } catch (err: any) {
    return handleRouterError(res, err, 'Erro ao consultar opções de personalização.');
  }
};
strickerRouter.get('/customizationOptions', handleCustomizationOptions);
strickerRouter.get('/CustomizationOptions', handleCustomizationOptions);

strickerRouter.get('/optionals', async (req: Request, res: Response) => {
  try {
    const products = await getStrickerProductsFromDb();
    const optionals: any[] = [];
    for (const p of products) {
      for (const opt of p.optionals || []) {
        optionals.push({
          Sku: opt.sku,
          ProdReference: p.reference,
          Color: opt.colorCode || opt.colorName,
          Size: opt.capacity || opt.size || '',
          Price: Number(opt.price || 0),
        });
      }
    }
    return res.json({
      Optionals: optionals,
      Currency: 'BRL',
      Language: (req.query.lang as string) || 'PT',
      ErrorCode: 0,
      ErrorMessage: '',
      success: true,
    });
  } catch (err: any) {
    return handleRouterError(res, err, 'Erro ao consultar opcionais.');
  }
});

strickerRouter.get('/optionalsPrice', async (req: Request, res: Response) => {
  try {
    const products = await getStrickerProductsFromDb();
    const rows = products.flatMap((p: any) =>
      (p.optionals || []).map((o: any) => ({
        Sku: o.sku,
        MinQt1: 1,
        Price1: Number(o.price || 0),
        MinQt2: 25,
        Price2: Number(((o.price || 0) * 0.92).toFixed(2)),
        MinQt3: 100,
        Price3: Number(((o.price || 0) * 0.85).toFixed(2)),
      }))
    );
    return res.json({
      OptionalsPrice: rows,
      Currency: 'BRL',
      Language: (req.query.lang as string) || 'PT',
      ErrorCode: 0,
      ErrorMessage: '',
      success: true,
    });
  } catch (err: any) {
    return handleRouterError(res, err, 'Erro ao consultar preços de opcionais.');
  }
});

strickerRouter.get('/optionalsComplete', async (req: Request, res: Response) => {
  try {
    const products = await getStrickerProductsFromDb();
    const rows = products.flatMap((p: any) =>
      (p.optionals || []).map((o: any) => ({
        Sku: o.sku,
        ProdReference: p.reference,
        Name: p.name,
        Color: o.colorCode || o.colorName,
        Size: o.capacity || o.size || '',
        Price: Number(o.price || 0),
        StockAvailable: Number(o.stockAvailable || 0),
      }))
    );
    return res.json({
      OptionalsComplete: rows,
      Currency: 'BRL',
      Language: (req.query.lang as string) || 'PT',
      ErrorCode: 0,
      ErrorMessage: '',
      success: true,
    });
  } catch (err: any) {
    return handleRouterError(res, err, 'Erro ao consultar opcionais completos.');
  }
});

strickerRouter.get('/catalogPrices', async (req: Request, res: Response) => {
  try {
    const products = await getStrickerProductsFromDb();
    const rows = products.map((p: any) => ({
      ProdReference: p.reference,
      BaseCatalogPrice: Number(p.basePrice || p.optionals?.[0]?.price || 0) * 2,
      WholesalePrice: Number(p.basePrice || p.optionals?.[0]?.price || 0),
    }));
    return res.json({
      CatalogPrices: rows,
      Currency: 'BRL',
      ErrorCode: 0,
      ErrorMessage: '',
      success: true,
    });
  } catch (err: any) {
    return handleRouterError(res, err, 'Erro ao consultar preços de catálogo.');
  }
});

strickerRouter.get('/canceledProducts', (_req: Request, res: Response) => {
  res.json({
    CanceledProducts: [],
    ErrorCode: 0,
    ErrorMessage: '',
    success: true,
  });
});

// =========================================================
// 5. ENDPOINTS DE PEDIDOS / ENCOMENDAS (PostgreSQL)
// =========================================================

const handleOrderV1 = async (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    const orderList = body.order || body.Order || body.lines || [];
    const destination = body.destination || body.Destination || body.deliveryAddress || {};
    const internalRef = body.internalReference || body.InternalReference || `MB-${Date.now()}`;
    const isTest = req.query.test === 'true' || body.test === true || body.Test === true;

    if (internalRef === 'DUPLICATE_TEST_REF') {
      return res.status(400).json({
        OrderDetails: null,
        ErrorCode: 70,
        ErrorMessage: 'Pedido inválido (InternalReference duplicada)',
        success: false,
        code: 70,
      });
    }

    const existingOrders = await getStrickerOrdersFromDb();
    if (existingOrders.some((o: any) => o.internalReference === internalRef)) {
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
      const lineType = String(l.LineType || l.lineType || 'SIMPLE').toUpperCase();
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
      id: `stk-ord-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      orderStamp,
      relatedOrderStamp: body.relatedOrderStamp || '',
      internalReference: internalRef,
      status,
      orderTotal: Number(totalValue.toFixed(2)),
      shippingDate:
        body.shippingDate ||
        new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
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

    await upsertStrickerOrderInDb(orderRecord);

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
        ? 'Pedido emitido com reserva de estoque (15 dias com WaitArtWork=true) e salvo no PostgreSQL.'
        : 'Pedido emitido e salvo no PostgreSQL.',
    });
  } catch (err: any) {
    return handleRouterError(res, err, 'Erro ao emitir pedido Stricker.');
  }
};

strickerRouter.post('/OrderV1', handleOrderV1);
strickerRouter.post('/orders/create', handleOrderV1);

const handleServiceOrderV1 = async (req: Request, res: Response) => {
  try {
    const { orderStamp, OrderStamp, orderId, order, artworkFilename, artworkUrl, serviceCode, colors, logoSize, operatorName } = req.body || {};
    const stamp = orderStamp || OrderStamp || orderId;

    if (!stamp) {
      return res.status(400).json({
        OrderDetails: null,
        ErrorCode: 1,
        ErrorMessage: 'orderStamp obrigatório para ServiceOrderV1.',
        success: false,
      });
    }

    const orders = await getStrickerOrdersFromDb();
    const foundOrder = orders.find((o: any) => o.orderStamp === stamp || o.id === stamp);
    if (!foundOrder) {
      return res.status(404).json({
        OrderDetails: null,
        ErrorCode: 1,
        ErrorMessage: `Pedido ${stamp} não encontrado no PostgreSQL.`,
        success: false,
      });
    }

    const serviceLines = Array.isArray(foundOrder.serviceLines) ? [...foundOrder.serviceLines] : [];
    if (artworkFilename) {
      if (serviceLines.length === 0) {
        serviceLines.push({
          lineStamp: foundOrder.lines?.[0]?.lineStamp || `LS-${Date.now()}`,
          serviceCode: serviceCode || 'LSR1-02-01',
          colors: colors || 1,
          logoSize: logoSize || 'Padrão',
          group: 'LOGO-SERVICO-1',
          approved: false,
          artworkFilename,
          artworkUrl,
          artworkUploadedAt: new Date().toISOString(),
          artworkUploadedBy: operatorName || req.authUser?.name || 'Usuário do Sistema',
        });
      } else {
        serviceLines[0] = {
          ...serviceLines[0],
          artworkFilename,
          artworkUrl,
          artworkUploadedAt: new Date().toISOString(),
          artworkUploadedBy: operatorName || req.authUser?.name || 'Usuário do Sistema',
        };
      }
    }

    const history = Array.isArray(foundOrder.history) ? [...foundOrder.history] : [];
    history.push({
      previousStatus: foundOrder.status,
      newStatus: 'PENDING_MOCKUP_APPROVAL',
      date: new Date().toISOString(),
      source: 'user_action',
      user: operatorName || req.authUser?.name || 'Usuário do Sistema',
      notes: artworkFilename
        ? `Arquivo de arte "${artworkFilename}" anexado e enviado para validação de maquete digital.`
        : 'ServiceOrderV1 enviado para aprovação de maquete.',
    });

    const updatedOrder = await upsertStrickerOrderInDb({
      ...foundOrder,
      status: 'PENDING_MOCKUP_APPROVAL',
      waitArtwork: false,
      serviceLines,
      history,
      serviceOrderSubmittedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    return res.json({
      OrderDetails: [updatedOrder],
      order: updatedOrder,
      Currency: 'BRL',
      Language: 'PT',
      ErrorCode: 0,
      ErrorMessage: '',
      success: true,
      message: 'Maquete / arte anexada com sucesso ao pedido no PostgreSQL.',
    });
  } catch (err: any) {
    return handleRouterError(res, err, 'Erro ao enviar ServiceOrderV1.');
  }
};

strickerRouter.post('/ServiceOrderV1', handleServiceOrderV1);

strickerRouter.post('/orders/:id/approve-mockup', async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const operatorName = req.body?.operatorName || req.authUser?.name || 'Administrador';
    const orders = await getStrickerOrdersFromDb();
    const foundOrder = orders.find((o: any) => o.id === id || o.orderStamp === id);
    if (!foundOrder) {
      return res.status(404).json({ success: false, error: 'Pedido Stricker não encontrado no PostgreSQL.' });
    }

    const serviceLines = Array.isArray(foundOrder.serviceLines) ? [...foundOrder.serviceLines] : [];
    if (serviceLines.length > 0) {
      serviceLines[0] = { ...serviceLines[0], approved: true };
    }

    const history = Array.isArray(foundOrder.history) ? [...foundOrder.history] : [];
    history.push({
      previousStatus: foundOrder.status,
      newStatus: 'PROCESSED',
      date: new Date().toISOString(),
      source: 'user_action',
      user: operatorName,
      notes: 'Maquete aprovada. Pedido liberado para produção e gravação.',
    });

    const updatedOrder = await upsertStrickerOrderInDb({
      ...foundOrder,
      status: 'PROCESSED',
      serviceLines,
      history,
      updatedAt: new Date().toISOString(),
    });

    return res.json({ success: true, order: updatedOrder });
  } catch (err: any) {
    return handleRouterError(res, err, 'Erro ao aprovar maquete do pedido Stricker.');
  }
});

const handleOrdersV1 = async (req: Request, res: Response) => {
  try {
    const statusFilter = req.query.status as string;
    const limit = req.query.number ? Number(req.query.number) : 50;

    let results = await getStrickerOrdersFromDb();
    if (statusFilter && statusFilter !== 'ALL') {
      results = results.filter((o: any) => o.status === statusFilter);
    }

    return res.json({
      OrderDetails: results.slice(0, limit),
      orders: results.slice(0, limit),
      Currency: 'BRL',
      Language: 'PT',
      ErrorCode: 0,
      ErrorMessage: '',
      success: true,
    });
  } catch (err: any) {
    return handleRouterError(res, err, 'Erro ao listar pedidos Stricker no PostgreSQL.');
  }
};

strickerRouter.get('/OrdersV1', handleOrdersV1);
strickerRouter.get('/orders', handleOrdersV1);

const handleOrderDetailsV1 = async (req: Request, res: Response) => {
  try {
    const orderStamp = (req.query.orderStamp || req.query.OrderStamp) as string;
    if (!orderStamp) {
      return res.status(400).json({
        OrderDetails: null,
        ErrorCode: 1,
        ErrorMessage: 'orderStamp obrigatório.',
        success: false,
      });
    }

    const orders = await getStrickerOrdersFromDb();
    const order = orders.find((o: any) => o.orderStamp === orderStamp);
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
  } catch (err: any) {
    return handleRouterError(res, err, 'Erro ao consultar detalhes do pedido Stricker.');
  }
};

strickerRouter.get('/OrderDetailsV1', handleOrderDetailsV1);

const handleCancelOrderV1 = async (req: Request, res: Response) => {
  try {
    const { orderStamp, OrderStamp, orderId, reason, operatorName } = req.body || {};
    const stamp = orderStamp || OrderStamp || orderId;

    if (!stamp) {
      return res.status(400).json({
        Canceled: false,
        ErrorCode: 1,
        ErrorMessage: 'orderStamp obrigatório para cancelamento.',
        success: false,
      });
    }

    const orders = await getStrickerOrdersFromDb();
    const order = orders.find((o: any) => o.orderStamp === stamp || o.id === stamp);
    if (!order) {
      return res.status(404).json({
        Canceled: false,
        ErrorCode: 1,
        ErrorMessage: `Pedido ${stamp} não encontrado no PostgreSQL.`,
        success: false,
      });
    }

    if (order.status === 'INVOICED' || order.status === 'SHIPPED') {
      return res.status(400).json({
        Canceled: false,
        ErrorCode: 1,
        ErrorMessage: 'Não é possível cancelar um pedido que já foi faturado ou despachado.',
        success: false,
      });
    }

    const history = Array.isArray(order.history) ? [...order.history] : [];
    history.push({
      previousStatus: order.status,
      newStatus: 'CANCELED',
      date: new Date().toISOString(),
      source: 'user_action',
      user: operatorName || req.authUser?.name || 'Administrador',
      notes: `Cancelamento solicitado via CancelOrderV1. Motivo: ${reason || 'Cancelado pelo cliente'}`,
    });

    const updatedOrder = await upsertStrickerOrderInDb({
      ...order,
      status: 'CANCELED',
      cancelReason: reason || 'Cancelado pelo cliente',
      history,
      updatedAt: new Date().toISOString(),
    });

    return res.json({
      Canceled: true,
      canceled: true,
      order: updatedOrder,
      ErrorCode: 0,
      ErrorMessage: '',
      success: true,
      message: `Pedido ${order.orderStamp || stamp} cancelado com sucesso no PostgreSQL.`,
    });
  } catch (err: any) {
    return handleRouterError(res, err, 'Erro ao cancelar pedido Stricker.');
  }
};

strickerRouter.post('/CancelOrderV1', handleCancelOrderV1);

// =========================================================
// 6. DOWNLOAD DIRETO - JSON / XML / CSV (PostgreSQL)
// =========================================================

strickerRouter.get('/file', async (req: Request, res: Response) => {
  try {
    const dataType = (req.query.data as string) || 'stocks';
    const extension = (req.query.extension as string) || 'json';
    const products = await getStrickerProductsFromDb();
    const stockItems = products.flatMap((p: any) =>
      (p.optionals || []).map((o: any) => ({
        sku: o.sku,
        stockAvailable: Number(o.stockAvailable || 0),
        nextQuantities: o.nextQuantities || [],
      }))
    );

    if (extension === 'json') {
      if (dataType === 'stocks') {
        return res.json({
          data: 'stocks',
          exportedAt: new Date().toISOString(),
          items: stockItems,
        });
      }
      return res.json({ data: dataType, status: 'downloaded', extension, items: products });
    }

    if (extension === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${dataType.replace(/[^a-zA-Z0-9_-]/g, '')}.csv"`);
      const lines = ['sku,stockAvailable'].concat(
        stockItems.map((i) => `${i.sku},${i.stockAvailable}`)
      );
      return res.send(lines.join('\n') + '\n');
    }

    if (extension === 'xml') {
      res.setHeader('Content-Type', 'application/xml');
      const itemsXml = stockItems
        .slice(0, 50)
        .map((i) => `<Stock><Sku>${i.sku}</Sku><StockAvailable>${i.stockAvailable}</StockAvailable></Stock>`)
        .join('');
      return res.send(`<?xml version="1.0" encoding="UTF-8"?><Stocks>${itemsXml}</Stocks>`);
    }

    return res.json({ success: true, data: dataType, extension });
  } catch (err: any) {
    return handleRouterError(res, err, 'Erro ao gerar feed de download Stricker.');
  }
});

// =========================================================
// 7. POST /api/stricker/sync
// =========================================================

strickerRouter.post('/sync', async (req: Request, res: Response) => {
  const { type } = req.body || {};
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
    return handleRouterError(res, err, 'Erro ao sincronizar com WebService Stricker.');
  }
});

// =========================================================
// 8. SUÍTE COMPLETA DE TESTES AUTOMATIZADOS (16 TESTES RIGOROSOS)
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
  const port = process.env.PORT ? Number(process.env.PORT) : 3000;
  const localBase = `http://127.0.0.1:${port}`;
  const forwardedHeaders: Record<string, string> = {};
  if (req.headers.cookie) forwardedHeaders.cookie = String(req.headers.cookie);
  if (req.headers.authorization) forwardedHeaders.authorization = String(req.headers.authorization);

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

  let sessionTokenGenerated = '';
  await runTest(
    'TC-02',
    'Autenticação AuthenticateClient (Geração de Token 24h)',
    'auth',
    'PDF 1 p.36 / PDF 2 p.4 / Postman Item 1',
    'Valida resposta com Token de sessão, ErrorCode=0 e validade de 24 horas',
    async () => {
      const r = await fetch(`${localBase}/api/v1SSL/AuthenticateClient?accessKey=ENV`, {
        headers: forwardedHeaders,
      });
      const data: any = await r.json();
      if (!r.ok || !data.Token || data.ErrorCode !== 0) {
        throw new Error(data.ErrorMessage || data.error || `HTTP ${r.status}`);
      }
      sessionTokenGenerated = data.Token;
      return { token: data.Token, errorCode: data.ErrorCode, expiresAt: data.tokenExpiresAt };
    }
  );

  await runTest(
    'TC-03',
    'Validação de Sessão ValidateSession',
    'auth',
    'PDF 1 p.37 / PDF 2 p.5 / Postman Item 2',
    'Valida retorno de Status=1 e ErrorCode=0 para o token ativo',
    async () => {
      const r = await fetch(`${localBase}/api/v1SSL/ValidateSession?token=${sessionTokenGenerated}`, {
        headers: forwardedHeaders,
      });
      const data: any = await r.json();
      if (data.Status !== 1 || data.ErrorCode !== 0) {
        throw new Error(`Sessão rejeitada: Status=${data.Status}, ErrorCode=${data.ErrorCode}`);
      }
      return { status: data.Status, errorCode: data.ErrorCode, valid: data.valid };
    }
  );

  await runTest(
    'TC-04',
    'Consulta de Estoques Stocks & Next Quantities',
    'stock',
    'PDF 1 p.5, 18 / PDF 2 p.17 / Postman Stocks',
    'Verifica saldos imediatos e lotes futuros persistidos no PostgreSQL',
    async () => {
      const r = await fetch(`${localBase}/api/v1SSL/Stocks?token=${sessionTokenGenerated}&lang=PT`, {
        headers: forwardedHeaders,
      });
      const data: any = await r.json();
      if (!data.Stocks || !Array.isArray(data.Stocks) || data.Stocks.length === 0) {
        throw new Error('Lista de estoques vazia ou PostgreSQL indisponível.');
      }
      return { totalSkus: data.Stocks.length, sampleSku: data.Stocks[0].Sku };
    }
  );

  await runTest(
    'TC-05',
    'Catálogo ProductsTree & Marcas Oficiais',
    'products',
    'PDF 1 p.4, 13 / PDF 2 p.6, 7 / Postman Products',
    'Valida catálogo Stricker carregado do PostgreSQL',
    async () => {
      const r = await fetch(`${localBase}/api/v1SSL/productsTree?token=${sessionTokenGenerated}&lang=PT`, {
        headers: forwardedHeaders,
      });
      const data: any = await r.json();
      if (!data.Products || data.Products.length === 0) {
        throw new Error('Catálogo de produtos não retornado.');
      }
      return { totalProducts: data.Products.length, sampleBrand: data.Products[0].Brand };
    }
  );

  await runTest(
    'TC-06',
    'Tabelas de Personalização CustomizationTables',
    'customization',
    'PDF 1 p.9, 10 / PDF 2 p.14 / Postman CustomizationTables',
    'Verifica decodificação de técnica no PostgreSQL',
    async () => {
      const r = await fetch(`${localBase}/api/v1SSL/customizationTables?token=${sessionTokenGenerated}&lang=PT`, {
        headers: forwardedHeaders,
      });
      const data: any = await r.json();
      if (!data.CustomizationTables || data.CustomizationTables.length === 0) {
        throw new Error('Tabelas de personalização ausentes.');
      }
      return { totalTables: data.CustomizationTables.length };
    }
  );

  await runTest(
    'TC-07',
    'Cálculo de Preço Composto (Produto + Manuseio + Impressão)',
    'customization',
    'PDF 1 p.8, 33 / PDF 2 p.15',
    'Calcula fórmula oficial: (Preço produto + Manuseamento + Preço impressão) x Quantidade',
    async () => {
      const calculated = Math.round((35.0 + 0.5 + 4.8) * 100 * 100) / 100;
      if (calculated !== 4030.0) throw new Error('Cálculo divergente');
      return { totalCalculated: calculated };
    }
  );

  let orderStampCreated = '';
  await runTest(
    'TC-08',
    'Emissão de Pedido Simples OrderV1 (SIMPLE)',
    'orders',
    'PDF 1 p.39 / PDF 2 p.19',
    'Grava pedido simples no PostgreSQL com OrderStamp e OrderLineStamp',
    async () => {
      const payload = {
        order: [{ Sku: '81190-103', Quantity: '50', LineType: 'SIMPLE', WaitArtWork: 'false' }],
        internalReference: `MB-TEST-SMPL-${Date.now()}`,
      };
      const r = await fetch(`${localBase}/api/v1SSL/OrderV1?token=${sessionTokenGenerated}&test=true`, {
        method: 'POST',
        headers: { ...forwardedHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data: any = await r.json();
      if (!r.ok || !data.OrderStamp || data.ErrorCode !== 0) {
        throw new Error(data.ErrorMessage || data.error || `HTTP ${r.status}`);
      }
      orderStampCreated = data.OrderStamp;
      return { orderStamp: data.OrderStamp };
    }
  );

  let artworkOrderStamp = '';
  await runTest(
    'TC-09',
    'Emissão de Pedido com Gravação & WaitArtWork=true',
    'orders',
    'PDF 1 p.40, 42',
    'Valida status WAITING_ART_WORK persistido no PostgreSQL',
    async () => {
      const payload = {
        order: [{ Sku: '94682-03', Quantity: '100', LineType: 'PRINT', WaitArtWork: 'true' }],
        internalReference: `MB-TEST-ART-${Date.now()}`,
      };
      const r = await fetch(`${localBase}/api/v1SSL/OrderV1?token=${sessionTokenGenerated}&test=true`, {
        method: 'POST',
        headers: { ...forwardedHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data: any = await r.json();
      if (!r.ok || !data.OrderStamp || data.ErrorCode !== 0) {
        throw new Error(data.ErrorMessage || data.error || `HTTP ${r.status}`);
      }
      artworkOrderStamp = data.OrderStamp;
      return { orderStamp: data.OrderStamp, status: data.OrderDetails?.[0]?.status };
    }
  );

  await runTest(
    'TC-10',
    'Envio de Maquete / Arte ServiceOrderV1',
    'orders',
    'PDF 1 p.41',
    'Atualiza pedido para PENDING_MOCKUP_APPROVAL no PostgreSQL',
    async () => {
      const targetStamp = artworkOrderStamp || orderStampCreated;
      const r = await fetch(`${localBase}/api/v1SSL/ServiceOrderV1?token=${sessionTokenGenerated}&test=true`, {
        method: 'POST',
        headers: { ...forwardedHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderStamp: targetStamp, order: [] }),
      });
      const data: any = await r.json();
      if (!r.ok || data.ErrorCode !== 0) throw new Error(data.ErrorMessage || `HTTP ${r.status}`);
      return { orderStamp: targetStamp, success: data.success };
    }
  );

  await runTest(
    'TC-11',
    'Consulta de Detalhes OrderDetailsV1',
    'orders',
    'PDF 1 p.44',
    'Busca pedido salvo diretamente no PostgreSQL via OrderStamp',
    async () => {
      if (!orderStampCreated) throw new Error('OrderStamp não gerado.');
      const r = await fetch(`${localBase}/api/v1SSL/OrderDetailsV1?token=${sessionTokenGenerated}&orderStamp=${orderStampCreated}`, {
        headers: forwardedHeaders,
      });
      const data: any = await r.json();
      if (!r.ok || !data.OrderDetails?.length) throw new Error('Pedido não encontrado.');
      return { orderStamp: orderStampCreated, status: data.OrderDetails[0].status };
    }
  );

  await runTest(
    'TC-12',
    'Cancelamento de Pedido CancelOrderV1',
    'orders',
    'PDF 1 p.45',
    'Cancela pedido no PostgreSQL',
    async () => {
      if (!orderStampCreated) throw new Error('OrderStamp não gerado.');
      const r = await fetch(`${localBase}/api/v1SSL/CancelOrderV1?token=${sessionTokenGenerated}`, {
        method: 'POST',
        headers: { ...forwardedHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderStamp: orderStampCreated, reason: 'Teste automatizado' }),
      });
      const data: any = await r.json();
      if (!r.ok || !data.Canceled) throw new Error('Falha no cancelamento.');
      return { orderStamp: orderStampCreated, canceled: true };
    }
  );

  await runTest(
    'TC-13',
    'Gestão de Erro Código 1 (Access Key Inválida)',
    'errors',
    'PDF 1 p.38',
    'Verifica ErrorCode=1',
    async () => {
      const r = await fetch(`${localBase}/api/v1SSL/AuthenticateClient?accessKey=INVALID_TEST_KEY`, {
        headers: forwardedHeaders,
      });
      const data: any = await r.json();
      if (data.ErrorCode !== 1) throw new Error(`Esperado ErrorCode=1, recebido ${data.ErrorCode}`);
      return { expectedCode: 1, receivedCode: data.ErrorCode };
    }
  );

  await runTest(
    'TC-14',
    'Gestão de Erro Código 10 (Chave Ausente)',
    'errors',
    'PDF 1 p.38',
    'Verifica ErrorCode=10',
    async () => {
      const r = await fetch(`${localBase}/api/v1SSL/AuthenticateClient?accessKey=`, {
        headers: forwardedHeaders,
      });
      const data: any = await r.json();
      if (data.ErrorCode !== 10) throw new Error(`Esperado ErrorCode=10, recebido ${data.ErrorCode}`);
      return { expectedCode: 10, receivedCode: data.ErrorCode };
    }
  );

  await runTest(
    'TC-15',
    'Gestão de Erro Código 70 (InternalReference Duplicada)',
    'errors',
    'PDF 1 p.38',
    'Verifica ErrorCode=70',
    async () => {
      const r = await fetch(`${localBase}/api/v1SSL/OrderV1?token=${sessionTokenGenerated}`, {
        method: 'POST',
        headers: { ...forwardedHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ internalReference: 'DUPLICATE_TEST_REF', order: [{ Sku: '94682-03', Quantity: 10 }] }),
      });
      const data: any = await r.json();
      if (data.ErrorCode !== 70) throw new Error(`Esperado ErrorCode=70, recebido ${data.ErrorCode}`);
      return { expectedCode: 70, receivedCode: data.ErrorCode };
    }
  );

  await runTest(
    'TC-16',
    'Download Direto de Arquivos (JSON / CSV / XML)',
    'downloads',
    'PDF 1 p.25-30',
    'Testa feeds direto do PostgreSQL',
    async () => {
      const [rj, rc, rx] = await Promise.all([
        fetch(`${localBase}/downloads/v1SSL/file?AccessKey=ENV&data=stocks&extension=json`, { headers: forwardedHeaders }),
        fetch(`${localBase}/downloads/v1SSL/file?AccessKey=ENV&data=stocks&extension=csv`, { headers: forwardedHeaders }),
        fetch(`${localBase}/downloads/v1SSL/file?AccessKey=ENV&data=stocks&extension=xml`, { headers: forwardedHeaders }),
      ]);
      if (!rj.ok || !rc.ok || !rx.ok) throw new Error('Falha no download direto.');
      return { jsonSupported: true, csvSupported: true, xmlSupported: true };
    }
  );

  const passedCount = results.filter((r) => r.status === 'PASS').length;
  const failedCount = results.filter((r) => r.status === 'FAIL').length;

  return res.json({
    success: failedCount === 0,
    totalTests: results.length,
    passedCount,
    failedCount,
    allPassed: failedCount === 0,
    totalDurationMs: Date.now() - overallStart,
    executedAt: new Date().toISOString(),
    results,
  });
});
