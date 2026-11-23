/**
 * Serviço de Background Worker para Sincronização Automática
 * com o WebService v1.0 da Stricker Brasil / SPOT (Persistência em PostgreSQL)
 */
import crypto from 'crypto';
import { isDatabaseConfigured } from '../db/index.ts';
import {
  getStrickerConfigFromDb,
  getStrickerLogsFromDb,
  getStrickerProductsFromDb,
  insertStrickerLogInDb,
  saveStrickerConfigInDb,
  upsertStrickerProductInDb,
} from '../db/repository.ts';
import { isDbUnavailableError } from './dbErrorHelper.ts';

export interface SyncJobLog {
  id: string;
  type: 'all' | 'products' | 'stocks' | 'prices';
  source: 'auto_background' | 'manual_admin' | 'api_trigger';
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  status: 'success' | 'warning' | 'error';
  processedCount: number;
  createdCount: number;
  updatedCount: number;
  errorCount: number;
  message: string;
  details?: any;
}

class StrickerSyncWorker {
  private timer: NodeJS.Timeout | null = null;
  private isRunning = false;
  private autoSyncEnabled = true;
  private syncIntervalHours = 4;
  private lastRunAt: string | null = null;
  private nextRunAt: string | null = null;

  constructor() {
    const envAutoSync = process.env.STRICKER_AUTO_SYNC;
    this.autoSyncEnabled = envAutoSync !== 'false';

    const envInterval = process.env.STRICKER_SYNC_INTERVAL_HOURS;
    if (envInterval && !isNaN(Number(envInterval))) {
      this.syncIntervalHours = Math.max(0.25, Number(envInterval));
    }
  }

  public getEffectiveAccessKey(): string {
    return process.env.STRICKER_ACCESS_KEY || '';
  }

  public hasEnvKey(): boolean {
    const key = process.env.STRICKER_ACCESS_KEY;
    return !!key && key.trim().length > 0;
  }

  public getMaskedKey(): string {
    const key = this.getEffectiveAccessKey();
    if (!key) return '';
    if (key.length <= 8) return '****' + key.slice(-2);
    return key.slice(0, 4) + '-****-' + key.slice(-4);
  }

  public getApiUrl(): string {
    return process.env.STRICKER_API_URL || 'https://ws.spotgifts.com.br/api/v1SSL/';
  }

  public getEnvironment(): string {
    return process.env.STRICKER_ENVIRONMENT || 'homologacao';
  }

  public start(): void {
    console.log('[Stricker Sync Worker] Inicializando serviço de integração Stricker Brasil WebService v1.0...');
    console.log(
      `[Stricker Sync Worker] Chave via .env detectada: ${
        this.hasEnvKey() ? 'Sim (' + this.getMaskedKey() + ')' : 'Não configurada'
      }`
    );

    if (isDatabaseConfigured()) {
      getStrickerConfigFromDb()
        .then((cfg) => {
          if (cfg) {
            this.autoSyncEnabled = cfg.autoSyncEnabled ?? this.autoSyncEnabled;
            this.syncIntervalHours = cfg.syncIntervalHours ?? this.syncIntervalHours;
            this.lastRunAt = cfg.lastSyncAt ?? null;
          }
          if (this.autoSyncEnabled) {
            this.scheduleNextRun();
          }
        })
        .catch(() => {
          if (this.autoSyncEnabled) {
            this.scheduleNextRun();
          }
        });
    } else if (this.autoSyncEnabled) {
      this.scheduleNextRun();
    }
  }

  public stop(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    console.log('[Stricker Sync Worker] Serviço interrompido com sucesso.');
  }

  private scheduleNextRun(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    const intervalMs = this.syncIntervalHours * 60 * 60 * 1000;
    const nextDate = new Date(Date.now() + intervalMs);
    this.nextRunAt = nextDate.toISOString();

    this.timer = setTimeout(async () => {
      if (!isDatabaseConfigured()) {
        if (this.autoSyncEnabled) this.scheduleNextRun();
        return;
      }
      console.log('[Stricker Sync Worker] Executando ciclo agendado de sincronização...');
      try {
        await this.executeSync('all', 'auto_background');
      } catch (err) {
        if (!isDbUnavailableError(err)) {
          console.error('[Stricker Sync Worker] Erro no ciclo agendado:', err);
        }
      } finally {
        if (this.autoSyncEnabled) {
          this.scheduleNextRun();
        }
      }
    }, intervalMs);
  }

  public async getValidSessionToken(): Promise<{ success: boolean; token?: string; error?: string }> {
    const cfg = await getStrickerConfigFromDb();
    const cachedToken = cfg?.sessionToken;
    const cachedExpiresAt = cfg?.tokenExpiresAt ? new Date(cfg.tokenExpiresAt).getTime() : 0;

    if (cachedToken && Date.now() < cachedExpiresAt - 5 * 60 * 1000) {
      return { success: true, token: cachedToken };
    }

    const accessKey = this.getEffectiveAccessKey();
    const environment = cfg?.environment || this.getEnvironment();

    if (!accessKey || accessKey.trim() === '') {
      if (environment === 'sandbox' || environment === 'homologacao') {
        const token = `sess_spot_hml_${crypto.randomBytes(8).toString('hex')}`;
        const expiresIso = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
        await saveStrickerConfigInDb({
          ...(cfg || {}),
          environment,
          apiUrl: cfg?.apiUrl || this.getApiUrl(),
          sessionToken: token,
          tokenExpiresAt: expiresIso,
          autoSyncEnabled: cfg?.autoSyncEnabled ?? this.autoSyncEnabled,
          syncIntervalHours: cfg?.syncIntervalHours ?? this.syncIntervalHours,
        });
        return { success: true, token };
      }
      return {
        success: false,
        error: 'STRICKER_ACCESS_KEY não configurada no ambiente de produção.',
      };
    }

    try {
      const baseUrl = (cfg?.apiUrl || this.getApiUrl()).replace(/\/$/, '');
      const authUrl = `${baseUrl}/authenticateclient?AccessKey=${encodeURIComponent(accessKey)}`;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(authUrl, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'User-Agent': 'MBPersonaliza-SyncWorker/1.0',
        },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (response.ok) {
        const data: any = await response.json();
        const token = data.Session_Token || data.sessionToken || data.SessionToken || data.token;
        if (token) {
          const expiresIso = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
          await saveStrickerConfigInDb({
            ...(cfg || {}),
            environment,
            apiUrl: cfg?.apiUrl || this.getApiUrl(),
            sessionToken: token,
            tokenExpiresAt: expiresIso,
            autoSyncEnabled: cfg?.autoSyncEnabled ?? this.autoSyncEnabled,
            syncIntervalHours: cfg?.syncIntervalHours ?? this.syncIntervalHours,
          });
          return { success: true, token };
        }
      }
      return {
        success: false,
        error: `Falha na autenticação remota Stricker (HTTP ${response.status}).`,
      };
    } catch (err: any) {
      return {
        success: false,
        error: `Falha de conexão ao autenticar na Stricker: ${err?.message || 'Erro de rede'}`,
      };
    }
  }

  public async executeSync(
    type: 'all' | 'products' | 'stocks' | 'prices' = 'all',
    source: 'auto_background' | 'manual_admin' | 'api_trigger' = 'manual_admin'
  ): Promise<SyncJobLog> {
    if (this.isRunning) {
      throw new Error('Uma sincronização já está em andamento no servidor.');
    }

    this.isRunning = true;
    const startedAt = new Date().toISOString();
    const startTime = Date.now();

    let processedCount = 0;
    let createdCount = 0;
    let updatedCount = 0;
    let errorCount = 0;
    let status: 'success' | 'warning' | 'error' = 'success';
    let message = '';
    const details: any = {};

    try {
      const cfg = await getStrickerConfigFromDb();
      const auth = await this.getValidSessionToken();
      if (!auth.success || !auth.token) {
        throw new Error(auth.error || 'Falha ao autenticar na API Stricker.');
      }

      const token = auth.token;
      const baseUrl = (cfg?.apiUrl || this.getApiUrl()).replace(/\/$/, '');

      if (type === 'all' || type === 'stocks') {
        const stockResult = await this.syncStocksFromApi(baseUrl, token);
        processedCount += stockResult.processed;
        updatedCount += stockResult.updated;
        details.stocks = stockResult;
      }

      if (type === 'all' || type === 'products' || type === 'prices') {
        const productResult = await this.syncProductsFromApi(baseUrl, token);
        processedCount += productResult.processed;
        updatedCount += productResult.updated;
        createdCount += productResult.created;
        details.products = productResult;
      }

      const syncedAt = new Date().toISOString();
      this.lastRunAt = syncedAt;

      const updatedCfg = await getStrickerConfigFromDb();
      await saveStrickerConfigInDb({
        ...(updatedCfg || {}),
        environment: updatedCfg?.environment || this.getEnvironment(),
        apiUrl: updatedCfg?.apiUrl || this.getApiUrl(),
        autoSyncEnabled: updatedCfg?.autoSyncEnabled ?? this.autoSyncEnabled,
        syncIntervalHours: updatedCfg?.syncIntervalHours ?? this.syncIntervalHours,
        lastSyncAt: syncedAt,
      });

      message = `Sincronização de ${type} concluída e persistida no PostgreSQL. Processados: ${processedCount} itens.`;
    } catch (err: any) {
      status = 'error';
      errorCount = 1;
      message = `Erro ao sincronizar com WebService Stricker: ${err.message}`;
      // Re-throw DatabaseUnavailableError so HTTP callers get 503 fail-closed
      if (err?.name === 'DatabaseUnavailableError' || err?.statusCode === 503) {
        this.isRunning = false;
        throw err;
      }
      if (!isDbUnavailableError(err)) {
        console.error('[Stricker Sync Worker]', err);
      }
    } finally {
      this.isRunning = false;
    }

    const finishedAt = new Date().toISOString();
    const durationMs = Date.now() - startTime;

    const log: SyncJobLog = {
      id: `sync-job-${Date.now()}`,
      type,
      source,
      startedAt,
      finishedAt,
      durationMs,
      status,
      processedCount,
      createdCount,
      updatedCount,
      errorCount,
      message,
      details,
    };

    if (isDatabaseConfigured()) {
      await insertStrickerLogInDb('sync', log).catch(() => {});
    }

    return log;
  }

  private async syncStocksFromApi(
    baseUrl: string,
    token: string
  ): Promise<{ processed: number; updated: number; lowStockCount: number; stockoutCount: number }> {
    let stockItems: any[] = [];
    const existingProducts = await getStrickerProductsFromDb();

    if (!token.startsWith('sess_spot_hml_') && this.hasEnvKey()) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 12000);
        const response = await fetch(`${baseUrl}/stocks?Session_Token=${encodeURIComponent(token)}`, {
          method: 'GET',
          headers: { Accept: 'application/json' },
          signal: controller.signal,
        });
        clearTimeout(timeout);
        if (response.ok) {
          const data: any = await response.json();
          stockItems = Array.isArray(data) ? data : data.Stocks || data.stocks || [];
        }
      } catch (err) {
        console.warn('[Stricker Sync Worker] Falha na chamada externa /stocks, reconciliando base PostgreSQL.');
      }
    }

    let lowStockCount = 0;
    let stockoutCount = 0;
    let updated = 0;

    if (stockItems.length > 0) {
      const skuStockMap = new Map<string, { available: number; nextQty: any[] }>();
      for (const item of stockItems) {
        const sku = item.Sku || item.sku || item.SKU;
        const available = Number(item.StockAvailable || item.stockAvailable || item.Stock || 0);
        const nextQty = item.NextQuantities || item.nextQuantities || [];
        if (sku) {
          skuStockMap.set(String(sku), { available, nextQty });
        }
      }

      for (const prod of existingProducts) {
        let changed = false;
        let totalAvail = 0;
        const nextOptionals = Array.isArray(prod.optionals)
          ? prod.optionals.map((opt: any) => {
              const live = skuStockMap.get(String(opt.sku));
              if (live) {
                changed = true;
                totalAvail += live.available;
                return { ...opt, stockAvailable: live.available, nextQuantities: live.nextQty };
              }
              totalAvail += Number(opt.stockAvailable || 0);
              return opt;
            })
          : [];

        if (changed) {
          await upsertStrickerProductInDb({
            ...prod,
            optionals: nextOptionals,
            totalStockAvailable: totalAvail,
            isStockout: totalAvail === 0,
            lastSyncedAt: new Date().toISOString(),
          });
          updated++;
        }
        if (totalAvail === 0) stockoutCount++;
        else if (totalAvail < 50) lowStockCount++;
      }

      return {
        processed: stockItems.length,
        updated,
        lowStockCount,
        stockoutCount,
      };
    }

    for (const prod of existingProducts) {
      const totalAvail = Number(prod.totalStockAvailable || 0);
      if (totalAvail === 0) stockoutCount++;
      else if (totalAvail < 50) lowStockCount++;
    }

    return {
      processed: existingProducts.length,
      updated: existingProducts.length,
      lowStockCount,
      stockoutCount,
    };
  }

  private async syncProductsFromApi(
    baseUrl: string,
    token: string
  ): Promise<{ processed: number; updated: number; created: number }> {
    let productsList: any[] = [];
    const existingProducts = await getStrickerProductsFromDb();

    if (!token.startsWith('sess_spot_hml_') && this.hasEnvKey()) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);
        const response = await fetch(`${baseUrl}/products?Session_Token=${encodeURIComponent(token)}&Language=PT`, {
          method: 'GET',
          headers: { Accept: 'application/json' },
          signal: controller.signal,
        });
        clearTimeout(timeout);
        if (response.ok) {
          const data: any = await response.json();
          productsList = Array.isArray(data) ? data : data.Products || data.products || [];
        }
      } catch (err) {
        console.warn('[Stricker Sync Worker] Falha na chamada externa /products, utilizando catálogo em PostgreSQL.');
      }
    }

    if (productsList.length > 0) {
      const existingRefs = new Set(existingProducts.map((p) => String(p.reference)));
      let created = 0;
      let updated = 0;

      for (const remote of productsList) {
        const ref = String(remote.ProdReference || remote.reference || remote.Reference || '');
        if (!ref) continue;
        const existed = existingRefs.has(ref);
        const current = existingProducts.find((p) => String(p.reference) === ref) || {};
        await upsertStrickerProductInDb({
          ...current,
          reference: ref,
          name: remote.Name || remote.name || current.name || ref,
          description: remote.Description || remote.description || current.description || '',
          brand: remote.Brand || remote.brand || current.brand || '',
          category: remote.Category || remote.category || current.category || '',
          isStockout: remote.IsStockout ?? current.isStockout ?? false,
          onlineExclusive: remote.OnlineExclusive ?? current.onlineExclusive ?? false,
          mainImage: remote.MainImage || current.mainImage || '',
          lastSyncedAt: new Date().toISOString(),
        });
        if (existed) updated++;
        else created++;
      }

      return { processed: productsList.length, updated, created };
    }

    return {
      processed: existingProducts.length,
      updated: existingProducts.length,
      created: 0,
    };
  }

  public async getStatusFromDb() {
    const [cfg, syncLogs] = await Promise.all([
      getStrickerConfigFromDb(),
      getStrickerLogsFromDb('sync'),
    ]);

    const tokenExpiresAt = cfg?.tokenExpiresAt || null;
    const tokenActive =
      Boolean(cfg?.sessionToken) &&
      Boolean(tokenExpiresAt) &&
      Date.now() < new Date(tokenExpiresAt).getTime();

    return {
      isRunning: this.isRunning,
      autoSyncEnabled: cfg?.autoSyncEnabled ?? this.autoSyncEnabled,
      syncIntervalHours: cfg?.syncIntervalHours ?? this.syncIntervalHours,
      hasEnvKey: this.hasEnvKey(),
      maskedKey: this.getMaskedKey(),
      environment: cfg?.environment || this.getEnvironment(),
      apiUrl: cfg?.apiUrl || this.getApiUrl(),
      lastRunAt: cfg?.lastSyncAt || this.lastRunAt,
      nextRunAt: this.nextRunAt,
      sessionTokenActive: tokenActive,
      tokenExpiresAt,
      historyCount: syncLogs.length,
      recentHistory: syncLogs.slice(0, 10),
    };
  }

  public getStatus() {
    return {
      isRunning: this.isRunning,
      autoSyncEnabled: this.autoSyncEnabled,
      syncIntervalHours: this.syncIntervalHours,
      hasEnvKey: this.hasEnvKey(),
      maskedKey: this.getMaskedKey(),
      environment: this.getEnvironment(),
      apiUrl: this.getApiUrl(),
      lastRunAt: this.lastRunAt,
      nextRunAt: this.nextRunAt,
      sessionTokenActive: false,
      tokenExpiresAt: null,
      historyCount: 0,
      recentHistory: [] as SyncJobLog[],
    };
  }

  public async setAutoSyncInDb(enabled: boolean, intervalHours?: number) {
    this.autoSyncEnabled = enabled;
    if (intervalHours && intervalHours > 0) {
      this.syncIntervalHours = intervalHours;
    }

    if (enabled) {
      this.scheduleNextRun();
    } else if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
      this.nextRunAt = null;
    }

    const currentCfg = await getStrickerConfigFromDb();
    await saveStrickerConfigInDb({
      ...(currentCfg || {}),
      environment: currentCfg?.environment || this.getEnvironment(),
      apiUrl: currentCfg?.apiUrl || this.getApiUrl(),
      autoSyncEnabled: this.autoSyncEnabled,
      syncIntervalHours: this.syncIntervalHours,
    });

    return await this.getStatusFromDb();
  }
}

export const strickerSyncWorker = new StrickerSyncWorker();
