import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema.ts';

// Add global connection pool caching to persist across hot-reloads
declare global {
  var _postgresPool: Pool | undefined;
}

// Helper to detect placeholder credentials in .env
function isPlaceholderConfig(val?: string): boolean {
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

// Function to create or retrieve the connection pool.
export const createPool = () => {
  if (!global._postgresPool) {
    const rawDbUrl = process.env.DATABASE_URL;
    const hasValidDatabaseUrl =
      !!rawDbUrl &&
      !isPlaceholderConfig(rawDbUrl) &&
      (rawDbUrl.startsWith('postgres://') || rawDbUrl.startsWith('postgresql://'));

    const isUnixSocket = !!process.env.SQL_HOST && process.env.SQL_HOST.startsWith('/');

    const isSslEnabled =
      !isUnixSocket &&
      (process.env.SQL_SSL === 'true' ||
        process.env.SSL_MODE === 'require' ||
        (process.env.SQL_SSL !== 'false' &&
          process.env.SQL_HOST &&
          !process.env.SQL_HOST.includes('localhost') &&
          !process.env.SQL_HOST.includes('127.0.0.1')));

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
          database: process.env.SQL_DB_NAME || 'cloud_sql_development_database',
          ssl: sslConfig,
        };

    global._postgresPool = new Pool({
      ...connectionConfig,
      max: Number(process.env.SQL_POOL_MAX || 15),
      connectionTimeoutMillis: Number(process.env.SQL_TIMEOUT_MILLIS || 15000),
      idleTimeoutMillis: Number(process.env.SQL_IDLE_TIMEOUT_MILLIS || 10000),
      allowExitOnIdle: false,
    });

    // Prevent unhandled pool-level errors from crashing the application
    global._postgresPool.on('error', (err) => {
      // Don't crash on transient idle termination or network errors
      console.warn('[PostgreSQL Pool Warning] Connection terminated or pool error:', err.message);
    });
  }
  return global._postgresPool;
};

// Graceful pool shutdown for VPS / Docker restart
export const closePool = async (): Promise<void> => {
  if (global._postgresPool) {
    try {
      await global._postgresPool.end();
      global._postgresPool = undefined;
      console.log('[PostgreSQL Pool] Connection pool closed cleanly.');
    } catch (err: any) {
      console.warn('[PostgreSQL Pool] Error closing connection pool:', err.message);
    }
  }
};

// Pool proxy that always delegates to the currently active connection pool instance
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

// Initialize Drizzle with the dynamic pool and schema.
export const db = drizzle(poolProxy, { schema });
