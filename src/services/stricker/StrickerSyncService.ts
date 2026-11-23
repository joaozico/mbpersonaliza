import {
  StrickerSyncLog,
  StrickerRequestLog,
  StrickerStockEntry,
} from '../../types/stricker';
import {
  INITIAL_STRICKER_SYNC_LOGS,
  INITIAL_STRICKER_REQUEST_LOGS,
} from '../../data/strickerInitialData';
import { StrickerAuthService } from './StrickerAuthService';
import { StrickerProductService } from './StrickerProductService';
import { StrickerStockService } from './StrickerStockService';
import { authFetch } from '../authClient';

let memorySyncLogs: StrickerSyncLog[] | null = null;
let memoryRequestLogs: StrickerRequestLog[] | null = null;

export class StrickerSyncService {
  private static isSyncing: boolean = false;

  /**
   * Atualiza cache em memória de logs a partir do PostgreSQL
   */
  public static setLogsFromServer(
    syncLogs: StrickerSyncLog[],
    requestLogs: StrickerRequestLog[]
  ): void {
    if (Array.isArray(syncLogs)) {
      memorySyncLogs = syncLogs.slice(0, 100);
    }
    if (Array.isArray(requestLogs)) {
      memoryRequestLogs = requestLogs.slice(0, 100);
    }
    window.dispatchEvent(new Event('mb_stricker_logs_updated'));
  }

  /**
   * Obtém histórico de logs de sincronização
   */
  public static getSyncLogs(): StrickerSyncLog[] {
    if (memorySyncLogs !== null) {
      return [...memorySyncLogs];
    }
    return [...INITIAL_STRICKER_SYNC_LOGS];
  }

  /**
   * Registra um novo log de sincronização no cache em memória e PostgreSQL
   */
  public static addSyncLog(log: StrickerSyncLog): void {
    const logs = this.getSyncLogs();
    logs.unshift(log);
    memorySyncLogs = logs.slice(0, 100);
    window.dispatchEvent(new Event('mb_stricker_logs_updated'));

    authFetch('/api/stricker/logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ logType: 'sync', log }),
    }).catch((err) => {
      console.error('Erro ao gravar sync log Stricker no PostgreSQL:', err);
    });
  }

  /**
   * Obtém histórico de requisições à API
   */
  public static getRequestLogs(): StrickerRequestLog[] {
    if (memoryRequestLogs !== null) {
      return [...memoryRequestLogs];
    }
    return [...INITIAL_STRICKER_REQUEST_LOGS];
  }

  /**
   * Registra log de requisição protegendo credenciais e persistindo no PostgreSQL
   */
  public static addRequestLog(reqLog: StrickerRequestLog): void {
    const logs = this.getRequestLogs();
    const safePayload = reqLog.safePayload
      ? JSON.parse(JSON.stringify(reqLog.safePayload))
      : undefined;
    if (safePayload && safePayload.token) safePayload.token = '***';
    if (safePayload && safePayload.accessKey) safePayload.accessKey = '***';

    const sanitizedLog: StrickerRequestLog = {
      ...reqLog,
      safePayload,
    };

    logs.unshift(sanitizedLog);
    memoryRequestLogs = logs.slice(0, 100);
    window.dispatchEvent(new Event('mb_stricker_logs_updated'));

    authFetch('/api/stricker/logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ logType: 'request', log: sanitizedLog }),
    }).catch((err) => {
      console.error('Erro ao gravar request log Stricker no PostgreSQL:', err);
    });
  }

  /**
   * Obtém status do worker de sincronização automática do servidor
   */
  public static async getWorkerStatus(): Promise<any> {
    try {
      const res = await authFetch('/api/stricker/sync/status');
      if (res.ok) {
        return await res.json();
      }
    } catch (err) {
      console.warn('Erro ao consultar status do worker de sincronização:', err);
    }
    return null;
  }

  /**
   * Executa rotina de sincronização sob demanda diretamente da API da Stricker
   */
  public static async executeSync(
    type: 'all' | 'products' | 'stocks' | 'prices' | 'customizations' | 'orders'
  ): Promise<StrickerSyncLog> {
    if (this.isSyncing) {
      throw new Error('Uma sincronização já está em andamento. Aguarde a conclusão.');
    }

    this.isSyncing = true;
    const startedAt = new Date().toISOString();
    const startTime = Date.now();

    try {
      const auth = await StrickerAuthService.getValidSessionToken();
      if (!auth.success) {
        throw new Error(auth.error || 'Falha de autenticação com a Stricker.');
      }

      const response = await authFetch('/api/stricker/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type }),
      });

      const data = await response.json();
      const durationMs = Date.now() - startTime;
      const finishedAt = new Date().toISOString();

      if (response.ok && data.success) {
        const updateFields: any = {
          lastSyncAt: finishedAt,
        };
        if (type === 'all' || type === 'products') updateFields.lastProductsSyncDate = finishedAt;
        if (type === 'all' || type === 'stocks') updateFields.lastStockSyncDate = finishedAt;
        if (type === 'all' || type === 'prices') updateFields.lastPricesSyncDate = finishedAt;
        if (type === 'all' || type === 'customizations')
          updateFields.lastCustomizationsSyncDate = finishedAt;
        if (type === 'all' || type === 'orders') updateFields.lastOrdersSyncDate = finishedAt;
        StrickerAuthService.saveConfig(updateFields);

        if (type === 'all' || type === 'stocks') {
          try {
            const stockRes = await authFetch('/api/stricker/stocks');
            if (stockRes.ok) {
              const stockData = await stockRes.json();
              if (stockData.stocks && Array.isArray(stockData.stocks)) {
                const entries: StrickerStockEntry[] = stockData.stocks.map((s: any) => ({
                  sku: s.sku || s.Sku,
                  stockAvailable: Number(s.stockAvailable ?? s.StockAvailable ?? 0),
                  nextQuantities: Array.isArray(s.nextQuantities || s.NextQuantities)
                    ? (s.nextQuantities || s.NextQuantities).map((nq: any) => ({
                        quantity: Number(nq.quantity ?? nq.Quantity ?? 0),
                        expectedDate: String(nq.expectedDate ?? nq.ExpectedDate ?? ''),
                      }))
                    : [],
                  syncedAt: finishedAt,
                }));
                StrickerStockService.updateStocks(entries);
              }
            }
          } catch (stkErr) {
            console.warn('Atualização de estoques no frontend:', stkErr);
          }
        }

        const config = StrickerAuthService.getConfig();
        StrickerProductService.syncAllPublishedProductsToStore(config.autoPublishToStore);

        const log: StrickerSyncLog = {
          id: `synclog-${Date.now()}`,
          syncType: type,
          startedAt,
          finishedAt,
          durationMs,
          processedCount: data.processedCount || 0,
          createdCount: data.createdCount || 0,
          updatedCount: data.updatedCount || 0,
          skippedCount: data.skippedCount || 0,
          errorCount: data.errorCount || 0,
          status: data.errorCount > 0 ? 'warning' : 'success',
          details:
            data.details ||
            `Sincronização de ${type} concluída diretamente do WebService Stricker / SPOT.`,
        };

        this.addSyncLog(log);
        return log;
      }

      throw new Error(data.error || 'Erro retornado pela sincronização.');
    } catch (err: any) {
      const durationMs = Date.now() - startTime;
      const finishedAt = new Date().toISOString();

      const log: StrickerSyncLog = {
        id: `synclog-${Date.now()}`,
        syncType: type,
        startedAt,
        finishedAt,
        durationMs,
        processedCount: 0,
        createdCount: 0,
        updatedCount: 0,
        skippedCount: 0,
        errorCount: 1,
        status: 'error',
        errorMessage: err.message,
        details: `Falha na sincronização de ${type}: ${err.message}`,
      };

      this.addSyncLog(log);
      return log;
    } finally {
      this.isSyncing = false;
    }
  }
}
