import { defineConfig } from "drizzle-kit";
import * as dotenv from "dotenv";

// Load environment variables from .env file.
dotenv.config();

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

const rawDbUrl = process.env.DATABASE_URL;
const hasValidDbUrl = !!rawDbUrl && !isPlaceholderConfig(rawDbUrl) && (rawDbUrl.startsWith('postgres://') || rawDbUrl.startsWith('postgresql://'));

const rawHost = process.env.SQL_HOST;
const sqlHost = (rawHost && !isPlaceholderConfig(rawHost)) ? rawHost : "localhost";
const sqlPort = process.env.SQL_PORT ? Number(process.env.SQL_PORT) : 5432;
const sqlDbName = process.env.SQL_DB_NAME || "cloud_sql_development_database";
const user = process.env.SQL_USER || process.env.SQL_ADMIN_USER || "postgres";
const password = process.env.SQL_PASSWORD || process.env.SQL_ADMIN_PASSWORD || "";

const isUnixSocket = sqlHost.startsWith('/');

const isSsl =
  !isUnixSocket &&
  (process.env.SQL_SSL === "true" ||
    process.env.SSL_MODE === "require" ||
    (process.env.SQL_SSL !== "false" &&
      sqlHost &&
      !sqlHost.includes("localhost") &&
      !sqlHost.includes("127.0.0.1")));

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle", // Output directory for migrations.
  dialect: "postgresql",
  schemaFilter: ["public"],
  dbCredentials: hasValidDbUrl
    ? {
        url: rawDbUrl!,
        ssl: isSsl ? { rejectUnauthorized: process.env.SQL_SSL_REJECT_UNAUTHORIZED === "true" } : false,
      }
    : {
        host: sqlHost,
        port: sqlPort,
        user: user,
        password: password,
        database: sqlDbName,
        ssl: isSsl ? { rejectUnauthorized: process.env.SQL_SSL_REJECT_UNAUTHORIZED === "true" } : false,
      },
  verbose: true,
});
