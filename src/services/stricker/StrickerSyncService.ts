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

const STORAGE_KEYS = {
  SYNC_LOGS: 'mb_stricker_sync_logs_v1',
  REQUEST_LOGS: 'mb_stricker_request_logs_v1',
};

export class StrickerSyncService {
  private static isSyncing: boolean = false;

  /**
   * Obtém histórico de logs de sincronização
   */
  public static getSyncLogs(): StrickerSyncLog[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SYNC_LOGS);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error('Erro ao ler logs de sincronização:', e);
    }
    return INITIAL_STRICKER_SYNC_LOGS;
  }

  /**
   * Registra um novo log de sincronização
   */
  public static addSyncLog(log: StrickerSyncLog): void {
    const logs = this.getSyncLogs();
    logs.unshift(log);
    const trimmed = logs.slice(0, 100);
    try {
      localStorage.setItem(STORAGE_KEYS.SYNC_LOGS, JSON.stringify(trimmed));
      window.dispatchEvent(new Event('mb_stricker_logs_updated'));
    } catch (e) {
      console.error('Erro ao salvar log de sincronização:', e);
    }
  }

  /**
   * Obtém histórico de requisições à API
   */
  public static getRequestLogs(): StrickerRequestLog[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.REQUEST_LOGS);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error('Erro ao ler logs de requisição:', e);
    }
    return INITIAL_STRICKER_REQUEST_LOGS;
  }

  /**
   * Registra log de requisição protegendo credenciais (mascarando tokens e chaves)
   */
  public static addRequestLog(reqLog: StrickerRequestLog): void {
    const logs = this.getRequestLogs();
    const safePayload = reqLog.safePayload ? JSON.parse(JSON.stringify(reqLog.safePayload)) : undefined;
    if (safePayload && safePayload.token) safePayload.token = 'sess_spot_***';
    if (safePayload && safePayload.accessKey) safePayload.accessKey = 'stricker_sec_***';

    logs.unshift({
      ...reqLog,
      safePayload,
    });
    const trimmed = logs.slice(0, 100);
    try {
      localStorage.setItem(STORAGE_KEYS.REQUEST_LOGS, JSON.stringify(trimmed));
      window.dispatchEvent(new Event('mb_stricker_logs_updated'));
    } catch (e) {
      console.error('Erro ao salvar log de requisição:', e);
    }
  }

  /**
   * Obtém status do worker de sincronização automática do servidor
   */
  public static async getWorkerStatus(): Promise<any> {
    try {
      const res = await fetch('/api/stricker/sync/status');
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
      // 1. Garante autenticação válida
      const auth = await StrickerAuthService.getValidSessionToken();
      if (!auth.success) {
        throw new Error(auth.error || 'Falha de autenticação com a Stricker.');
      }

      // 2. Chama rota backend de sincronização
      const response = await fetch('/api/stricker/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type }),
      });

      const data = await response.json();
      const durationMs = Date.now() - startTime;
      const finishedAt = new Date().toISOString();

      if (data.success) {
        // Atualiza datas de última sincronização
        const updateFields: any = {
          lastSyncAt: finishedAt,
        };
        if (type === 'all' || type === 'products') updateFields.lastProductsSyncDate = finishedAt;
        if (type === 'all' || type === 'stocks') updateFields.lastStockSyncDate = finishedAt;
        if (type === 'all' || type === 'prices') updateFields.lastPricesSyncDate = finishedAt;
        if (type === 'all' || type === 'customizations') updateFields.lastCustomizationsSyncDate = finishedAt;
        if (type === 'all' || type === 'orders') updateFields.lastOrdersSyncDate = finishedAt;
        StrickerAuthService.saveConfig(updateFields);

        // 3. Atualiza estoques no frontend caso envolva estoques
        if (type === 'all' || type === 'stocks') {
          try {
            const stockRes = await fetch('/api/stricker/stocks');
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

        // 4. Se produtos foram atualizados, sincroniza todos os produtos com o catálogo da loja
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
          details: data.details || `Sincronização de ${type} concluída diretamente do WebService Stricker / SPOT.`,
        };

        this.addSyncLog(log);
        return log;
      } else {
        throw new Error(data.error || 'Erro retornado pela sincronização.');
      }
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
