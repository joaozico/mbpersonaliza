import { StrickerConfig } from '../../types/stricker';
import { authFetch } from '../authClient';

const DEFAULT_STRICKER_CONFIG: StrickerConfig = {
  accessKey: '',
  sessionToken: undefined,
  tokenExpiresAt: undefined,
  environment: 'sandbox',
  apiUrl: 'https://ws.spotgifts.com.br/api/v1SSL/',
  soapWsdlUrl: 'https://ws.spotgifts.com.br/strickerservice.svc?WSDL',
  language: 'PT',
  format: 'JSON',
  isEnabled: true,
  autoSyncEnabled: true,
  syncIntervalHours: 12,
  defaultProfitMarginPct: 50,
  additionalHandlingCost: 0.0,
  defaultProductStatus: 'importado',
  autoPublishToStore: false,
  rateLimitPerMinute: 60,
  lastConnectionStatus: 'disconnected',
  lastConnectionMessage: 'Aguardando sincronização com PostgreSQL.',
  lastConnectionDate: undefined,
  isEnvKeyConfigured: false,
  updatedAt: new Date().toISOString(),
};

let memoryConfig: StrickerConfig = { ...DEFAULT_STRICKER_CONFIG };

export class StrickerAuthService {
  /**
   * Obtém a configuração atual em memória (hidratada do PostgreSQL)
   */
  public static getConfig(): StrickerConfig {
    return { ...memoryConfig };
  }

  /**
   * Atualiza o cache em memória a partir de carga do PostgreSQL sem disparar POST redundante
   */
  public static setConfigFromServer(serverCfg: Partial<StrickerConfig>): StrickerConfig {
    memoryConfig = {
      ...memoryConfig,
      ...serverCfg,
      accessKey: '',
      updatedAt: serverCfg.updatedAt || new Date().toISOString(),
    };
    window.dispatchEvent(new Event('mb_stricker_config_updated'));
    return { ...memoryConfig };
  }

  /**
   * Sincroniza configuração com o servidor (PostgreSQL + .env e status do worker)
   */
  public static async syncWithServerConfig(): Promise<StrickerConfig> {
    try {
      const response = await authFetch('/api/stricker/config');
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          return this.setConfigFromServer({
            isEnvKeyConfigured: Boolean(data.hasEnvKey),
            maskedAccessKey: data.maskedKey,
            environment: data.environment || memoryConfig.environment,
            apiUrl: data.apiUrl || memoryConfig.apiUrl,
            autoSyncEnabled:
              data.autoSyncEnabled !== undefined
                ? Boolean(data.autoSyncEnabled)
                : memoryConfig.autoSyncEnabled,
            syncIntervalHours: data.syncIntervalHours || memoryConfig.syncIntervalHours,
            nextAutoSyncDate: data.nextRunAt || undefined,
            lastConnectionStatus: data.sessionTokenActive ? 'connected' : 'disconnected',
            lastConnectionMessage: data.sessionTokenActive
              ? 'Sessão Stricker ativa no PostgreSQL.'
              : 'Sem sessão Stricker ativa no momento.',
            tokenExpiresAt: data.tokenExpiresAt || undefined,
          });
        }
      }
    } catch (err) {
      console.warn('Não foi possível sincronizar configuração Stricker do PostgreSQL:', err);
    }
    return this.getConfig();
  }

  /**
   * Salva a configuração atual em memória e persiste no PostgreSQL
   */
  public static saveConfig(
    config: Partial<StrickerConfig>,
    options: { skipServerSync?: boolean } = {}
  ): StrickerConfig {
    const updated: StrickerConfig = {
      ...memoryConfig,
      ...config,
      updatedAt: new Date().toISOString(),
    };
    memoryConfig = updated;
    window.dispatchEvent(new Event('mb_stricker_config_updated'));

    if (!options.skipServerSync) {
      const { accessKey: _ignoredKey, sessionToken: _ignoredToken, ...safePayload } = updated;
      authFetch('/api/stricker/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(safePayload),
      }).catch((err) => {
        console.warn('Erro ao persistir configuração Stricker no PostgreSQL:', err);
      });

      if (config.autoSyncEnabled !== undefined || config.syncIntervalHours !== undefined) {
        authFetch('/api/stricker/sync/auto/toggle', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            enabled: updated.autoSyncEnabled,
            intervalHours: updated.syncIntervalHours,
          }),
        }).catch(() => {});
      }
    }

    return { ...updated };
  }

  /**
   * Verifica se o token de sessão atual ainda é válido (reutilização de até 24h)
   */
  public static isTokenValid(): boolean {
    if (!memoryConfig.sessionToken || !memoryConfig.tokenExpiresAt) {
      return false;
    }
    const expiry = new Date(memoryConfig.tokenExpiresAt).getTime();
    return Date.now() < expiry - 5 * 60 * 1000;
  }

  /**
   * Obtém token válido do PostgreSQL ou realiza autenticação via backend
   */
  public static async getValidSessionToken(): Promise<{
    success: boolean;
    token?: string;
    error?: string;
    code?: number;
  }> {
    const config = this.getConfig();

    if (!config.isEnabled) {
      return {
        success: false,
        error: 'A integração com a Stricker / SPOT está desativada nas configurações.',
      };
    }

    const hasKey =
      config.isEnvKeyConfigured || (config.accessKey && config.accessKey.trim().length > 0);
    if (!hasKey) {
      return {
        success: false,
        error:
          'Access Key ausente. Configure a variável STRICKER_ACCESS_KEY no servidor (.env) antes de autenticar.',
        code: 10,
      };
    }

    if (this.isTokenValid() && config.sessionToken) {
      return { success: true, token: config.sessionToken };
    }

    try {
      const response = await authFetch('/api/stricker/auth/authenticate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accessKey: config.isEnvKeyConfigured ? 'ENV' : config.accessKey,
          environment: config.environment,
          apiUrl: config.apiUrl,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success && data.sessionToken) {
        const tokenExpiresAt =
          data.tokenExpiresAt || new Date(Date.now() + 23 * 60 * 60 * 1000).toISOString();
        this.saveConfig(
          {
            sessionToken: data.sessionToken,
            tokenExpiresAt,
            lastConnectionStatus: 'connected',
            lastConnectionMessage:
              'Autenticação realizada com sucesso e token persistido no PostgreSQL.',
            lastConnectionDate: new Date().toISOString(),
          },
          { skipServerSync: true }
        );
        return { success: true, token: data.sessionToken };
      }

      this.saveConfig(
        {
          lastConnectionStatus: 'auth_error',
          lastConnectionMessage:
            data.error || data.ErrorMessage || 'Falha na autenticação da Access Key.',
          lastConnectionDate: new Date().toISOString(),
        },
        { skipServerSync: true }
      );
      return {
        success: false,
        error: data.error || data.ErrorMessage || 'Access Key inválida ou erro na autenticação.',
        code: data.code || data.ErrorCode || 1,
      };
    } catch (err: any) {
      this.saveConfig(
        {
          lastConnectionStatus: 'auth_error',
          lastConnectionMessage:
            err?.message || 'Erro de comunicação com o servidor ao autenticar Stricker.',
          lastConnectionDate: new Date().toISOString(),
        },
        { skipServerSync: true }
      );
      return {
        success: false,
        error:
          err?.message ||
          'Erro de comunicação com o backend ao autenticar sessão Stricker no PostgreSQL.',
      };
    }
  }

  /**
   * Executa teste completo de conexão (AuthenticateClient + ValidateSession)
   */
  public static async testConnection(
    customAccessKey?: string,
    environment?: string
  ): Promise<{
    success: boolean;
    message: string;
    durationMs: number;
    tokenExpiry?: string;
    details?: any;
    keySource?: string;
  }> {
    const startTime = Date.now();
    const config = this.getConfig();
    const keyToTest = customAccessKey || (config.isEnvKeyConfigured ? 'ENV' : config.accessKey);
    const envToTest = environment || config.environment;

    try {
      const response = await authFetch('/api/stricker/auth/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accessKey: keyToTest,
          environment: envToTest,
          apiUrl: config.apiUrl,
        }),
      });

      const data = await response.json();
      const durationMs = Date.now() - startTime;

      if (response.ok && data.success) {
        this.saveConfig(
          {
            accessKey: '',
            environment: envToTest as any,
            sessionToken: data.sessionToken,
            tokenExpiresAt:
              data.tokenExpiresAt || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            lastConnectionStatus: 'connected',
            lastConnectionMessage:
              data.message || 'Conexão realizada com sucesso via HTTPS REST API.',
            lastConnectionDate: new Date().toISOString(),
            isEnvKeyConfigured: data.keySource === 'env' || config.isEnvKeyConfigured,
          },
          { skipServerSync: true }
        );
        return {
          success: true,
          message:
            data.message ||
            'Conexão realizada com sucesso! Token de sessão gerado e persistido no PostgreSQL.',
          durationMs,
          tokenExpiry: data.tokenExpiresAt,
          details: data,
          keySource: data.keySource,
        };
      }

      this.saveConfig(
        {
          lastConnectionStatus: 'auth_error',
          lastConnectionMessage:
            data.message || data.error || 'Falha na autenticação da Access Key.',
          lastConnectionDate: new Date().toISOString(),
        },
        { skipServerSync: true }
      );
      return {
        success: false,
        message:
          data.message ||
          data.error ||
          'Falha na conexão: Verifique a Access Key e o ambiente configurado.',
        durationMs,
        details: data,
      };
    } catch (e: any) {
      const durationMs = Date.now() - startTime;
      return {
        success: false,
        message: `Erro na comunicação com o servidor de integração: ${
          e.message || 'Timeout ou erro de rede'
        }`,
        durationMs,
      };
    }
  }

  /**
   * Encerra a sessão ativa (CloseSession)
   */
  public static async closeSession(): Promise<boolean> {
    const config = this.getConfig();
    if (config.sessionToken) {
      try {
        await authFetch('/api/stricker/auth/close', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: config.sessionToken }),
        });
      } catch (e) {
        console.error('Erro ao fechar sessão Stricker:', e);
      }
    }
    this.saveConfig(
      {
        sessionToken: undefined,
        tokenExpiresAt: undefined,
        lastConnectionStatus: 'disconnected',
        lastConnectionMessage: 'Sessão encerrada pelo usuário.',
        lastConnectionDate: new Date().toISOString(),
      },
      { skipServerSync: true }
    );
    return true;
  }
}
