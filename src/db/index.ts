import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool, type PoolClient } from 'pg';
import * as schema from './schema.ts';

declare global {
  var _postgresPool: Pool | undefined;
}

export class DatabaseUnavailableError extends Error {
  public readonly statusCode = 503;
  public readonly code = 'DB_UNAVAILABLE';
  constructor(message = 'Banco de dados PostgreSQL indisponível ou não configurado.') {
    super(message);
    this.name = 'DatabaseUnavailableError';
  }
}

export function isPlaceholderConfig(val?: string): boolean {
  if (!val || typeof val !== 'string') return false;
  const lower = val.toLowerCase().trim();
  return (
    lower.includes('seu-postgresql-externo') ||
    lower.includes('sua_senha_segura') ||
    lower.includes('seu-host') ||
    lower.includes('example.com') ||
    lower.includes('placeholder')
  );
}

export function isDatabaseConfigured(): boolean {
  const rawDbUrl = process.env.DATABASE_URL;
  const hasValidDatabaseUrl =
    !!rawDbUrl &&
    !isPlaceholderConfig(rawDbUrl) &&
    (rawDbUrl.startsWith('postgres://') || rawDbUrl.startsWith('postgresql://'));
  const rawHost = process.env.SQL_HOST;
  const hasValidHost = !!rawHost && !isPlaceholderConfig(rawHost);
  return hasValidDatabaseUrl || (hasValidHost && !!(process.env.SQL_USER || process.env.SQL_ADMIN_USER));
}

export function isSslEnabledForConnection(): boolean {
  const rawDbUrl = process.env.DATABASE_URL || '';
  const rawHost = process.env.SQL_HOST || '';
  const isUnixSocket = !!rawHost && rawHost.startsWith('/');
  if (isUnixSocket) return false;
  if (process.env.SQL_SSL === 'false') return false;
  if (process.env.SQL_SSL === 'true' || process.env.SSL_MODE === 'require') return true;
  if (rawDbUrl.includes('sslmode=require') || rawDbUrl.includes('ssl=true')) return true;
  if (rawHost && !isPlaceholderConfig(rawHost) && !rawHost.includes('localhost') && !rawHost.includes('127.0.0.1')) {
    return true;
  }
  return false;
}

export function getDatabaseConnectionMetadata() {
  const configured = isDatabaseConfigured();
  const hasDatabaseUrl =
    !!process.env.DATABASE_URL &&
    !isPlaceholderConfig(process.env.DATABASE_URL) &&
    (process.env.DATABASE_URL.startsWith('postgres://') || process.env.DATABASE_URL.startsWith('postgresql://'));
  const sslEnabled = isSslEnabledForConnection();

  let targetHost = 'unconfigured';
  let targetDb = process.env.SQL_DB_NAME || 'mbpersonaliza';
  if (hasDatabaseUrl && process.env.DATABASE_URL) {
    try {
      const parsed = new URL(process.env.DATABASE_URL);
      targetHost = parsed.hostname || 'postgres-host';
      targetDb = parsed.pathname?.replace(/^\//, '') || targetDb;
    } catch {
      targetHost = 'configured-via-url';
    }
  } else if (process.env.SQL_HOST && !isPlaceholderConfig(process.env.SQL_HOST)) {
    targetHost = process.env.SQL_HOST.startsWith('/') ? 'unix-socket' : process.env.SQL_HOST;
  }

  return {
    configured,
    connectionMode: hasDatabaseUrl ? 'DATABASE_URL' : configured ? 'SQL_HOST_PARAMS' : 'unconfigured',
    sslEnabled,
    hostLabel: targetHost,
    databaseLabel: targetDb,
    poolMax: Number(process.env.SQL_POOL_MAX || 15),
  };
}

export function createPool(): Pool {
  if (!isDatabaseConfigured()) {
    throw new DatabaseUnavailableError(
      'Credenciais PostgreSQL não configuradas (DATABASE_URL ou SQL_HOST/SQL_USER).'
    );
  }

  if (!global._postgresPool) {
    const rawDbUrl = process.env.DATABASE_URL;
    const hasValidDatabaseUrl =
      !!rawDbUrl &&
      !isPlaceholderConfig(rawDbUrl) &&
      (rawDbUrl.startsWith('postgres://') || rawDbUrl.startsWith('postgresql://'));

    const isSslEnabled = isSslEnabledForConnection();
    const sslConfig = isSslEnabled
      ? {
          rejectUnauthorized: process.env.SQL_SSL_REJECT_UNAUTHORIZED === 'true',
        }
      : undefined;

    const rawHost = process.env.SQL_HOST;
    const hasValidHost = !!rawHost && !isPlaceholderConfig(rawHost);

    const connectionConfig = hasValidDatabaseUrl
      ? {
          connectionString: rawDbUrl,
          ssl: sslConfig,
        }
      : {
          host: hasValidHost ? rawHost : 'localhost',
          port: process.env.SQL_PORT ? Number(process.env.SQL_PORT) : 5432,
          user: process.env.SQL_USER || process.env.SQL_ADMIN_USER || 'postgres',
          password: process.env.SQL_PASSWORD || process.env.SQL_ADMIN_PASSWORD || '',
          database: process.env.SQL_DB_NAME || 'mbpersonaliza',
          ssl: sslConfig,
        };

    global._postgresPool = new Pool({
      ...connectionConfig,
      max: Number(process.env.SQL_POOL_MAX || 15),
      connectionTimeoutMillis: Number(process.env.SQL_TIMEOUT_MILLIS || 10000),
      idleTimeoutMillis: Number(process.env.SQL_IDLE_TIMEOUT_MILLIS || 15000),
      allowExitOnIdle: false,
    });

    global._postgresPool.on('error', (err) => {
      console.warn('[PostgreSQL Pool Warning] Erro no pool:', err.message);
    });
  }
  return global._postgresPool;
}

export const closePool = async (): Promise<void> => {
  if (global._postgresPool) {
    try {
      await global._postgresPool.end();
      global._postgresPool = undefined;
      console.log('[PostgreSQL Pool] Pool de conexões encerrado com segurança.');
    } catch (err: any) {
      console.warn('[PostgreSQL Pool] Erro ao encerrar pool:', err.message);
    }
  }
};

export interface DatabaseHealthCheckResult {
  connected: boolean;
  configured: boolean;
  status: 'connected' | 'pending_configuration' | 'offline_or_unreachable';
  latencyMs: number;
  currentDatabase?: string;
  currentUser?: string;
  version?: string;
  sslEnabled: boolean;
  connectionMode: string;
  publicTablesCount?: number;
  error?: string;
}

/**
 * Executa verificação REAL no PostgreSQL (SELECT 1 + current_database/current_user/version).
 * Nunca retorna sucesso falso nem vaza credenciais.
 */
export async function testDatabaseConnection(): Promise<DatabaseHealthCheckResult> {
  const meta = getDatabaseConnectionMetadata();
  if (!meta.configured) {
    return {
      connected: false,
      configured: false,
      status: 'pending_configuration',
      latencyMs: 0,
      sslEnabled: meta.sslEnabled,
      connectionMode: meta.connectionMode,
      error: 'Variáveis de conexão PostgreSQL (DATABASE_URL / SQL_HOST) não configuradas neste ambiente.',
    };
  }

  const startedAt = Date.now();
  let client: PoolClient | undefined;
  try {
    const pool = createPool();
    client = await pool.connect();
    await client.query('SELECT 1 AS ok');
    const idRes = await client.query<{
      current_database: string;
      current_user: string;
      version: string;
    }>('SELECT current_database(), current_user, version()');
    const tablesRes = await client.query<{ total: string }>(
      "SELECT COUNT(*)::text AS total FROM pg_tables WHERE schemaname = 'public'"
    );
    const row = idRes.rows[0];
    const shortVersion = row?.version ? row.version.split(',')[0] : 'PostgreSQL';
    return {
      connected: true,
      configured: true,
      status: 'connected',
      latencyMs: Date.now() - startedAt,
      currentDatabase: row?.current_database,
      currentUser: row?.current_user,
      version: shortVersion,
      sslEnabled: meta.sslEnabled,
      connectionMode: meta.connectionMode,
      publicTablesCount: Number(tablesRes.rows[0]?.total || 0),
    };
  } catch (err: any) {
    // Sanitize any URI/password that could appear in pg error strings
    const rawMsg = String(err?.message || 'Erro ao conectar no PostgreSQL');
    const sanitized = rawMsg.replace(/postgres(?:ql)?:\/\/[^\s@]+@/gi, 'postgresql://***@');
    return {
      connected: false,
      configured: true,
      status: 'offline_or_unreachable',
      latencyMs: Date.now() - startedAt,
      sslEnabled: meta.sslEnabled,
      connectionMode: meta.connectionMode,
      error: sanitized,
    };
  } finally {
    if (client) {
      client.release();
    }
  }
}

const poolProxy = new Proxy({} as Pool, {
  get(_target, prop, receiver) {
    const activePool = createPool();
    const value = Reflect.get(activePool, prop, receiver);
    if (typeof value === 'function') {
      return value.bind(activePool);
    }
    return value;
  },
});

function createUnavailableDbProxy(): ReturnType<typeof drizzle<typeof schema>> {
  const throwUnavailable = () => {
    throw new DatabaseUnavailableError(
      'PostgreSQL não está conectado ou configurado. Nenhuma operação foi simulada.'
    );
  };
  const handler: ProxyHandler<any> = {
    get(_t, prop) {
      if (prop === 'then' || prop === 'catch' || prop === 'finally') {
        return undefined;
      }
      return new Proxy(throwUnavailable, handler);
    },
    apply() {
      throwUnavailable();
    },
  };
  return new Proxy(throwUnavailable, handler) as any;
}

let _drizzleInstance: ReturnType<typeof drizzle<typeof schema>> | undefined;

function getRealDrizzleDb(): ReturnType<typeof drizzle<typeof schema>> {
  if (!isDatabaseConfigured()) {
    throw new DatabaseUnavailableError(
      'PostgreSQL não configurado (DATABASE_URL / SQL_HOST ausente).'
    );
  }
  if (!_drizzleInstance) {
    _drizzleInstance = drizzle(poolProxy, { schema });
  }
  return _drizzleInstance;
}

/**
 * Retorna a instância oficial do Drizzle ORM conectada ao PostgreSQL.
 * Lança DatabaseUnavailableError se o PostgreSQL não estiver configurado.
 */
export function requireDb(): ReturnType<typeof drizzle<typeof schema>> {
  return getRealDrizzleDb();
}

export const db: ReturnType<typeof drizzle<typeof schema>> = new Proxy({} as any, {
  get(_target, prop, receiver) {
    if (prop === 'then' || prop === 'catch' || prop === 'finally') {
      return undefined;
    }
    if (!isDatabaseConfigured()) {
      return Reflect.get(createUnavailableDbProxy(), prop, receiver);
    }
    const instance = getRealDrizzleDb();
    const value = Reflect.get(instance as any, prop, receiver);
    return typeof value === 'function' ? value.bind(instance) : value;
  },
});
