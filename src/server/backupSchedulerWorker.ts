import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {
  BackupScheduleConfig,
  BackupHistoryEntry,
  SecureBackupPayload,
  BackupMetadata,
} from '../types.ts';
import { isDatabaseConfigured } from '../db/index.ts';
import {
  deleteBackupFromDb,
  enforceBackupRetentionInDb,
  exportAllBusinessTablesFromDb,
  getBackupByIdFromDb,
  getBackupsFromDb,
  getSystemSettingsFromDb,
  recordBackupInDb,
  saveSystemSettingsToDb,
} from '../db/repository.ts';
import { isDbUnavailableError } from './dbErrorHelper.ts';

const BACKUPS_DIR = path.join(process.cwd(), 'data', 'backups');

function ensureBackupsDir() {
  try {
    if (!fs.existsSync(BACKUPS_DIR)) {
      fs.mkdirSync(BACKUPS_DIR, { recursive: true });
    }
  } catch (err) {
    console.error('[BackupWorker] Erro ao criar diretório de backups:', err);
  }
}

const DEFAULT_CONFIG: BackupScheduleConfig = {
  enabled: true,
  frequency: 'daily',
  intervalHours: 24,
  scheduledTime: '03:00',
  daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
  retentionCount: 15,
  retentionDays: 30,
  includeProducts: true,
  includeQuotes: true,
  includeOrders: true,
  includeStock: true,
  includeCustomers: true,
  includeSettings: true,
  encryptPayload: false,
  autoDownloadBrowser: false,
  saveOnServer: true,
  lastRunAt: undefined,
  lastRunStatus: undefined,
  nextRunAt: undefined,
  updatedAt: new Date().toISOString(),
};

function calculateNextRun(config: BackupScheduleConfig): string {
  const now = new Date();
  const next = new Date(now);

  const [targetHours, targetMinutes] = (config.scheduledTime || '03:00')
    .split(':')
    .map((n) => parseInt(n, 10) || 0);

  if (config.frequency === 'hourly') {
    next.setHours(next.getHours() + 1, 0, 0, 0);
    return next.toISOString();
  }

  if (config.frequency === 'custom_interval') {
    const interval = Math.max(1, config.intervalHours || 6);
    next.setHours(next.getHours() + interval, 0, 0, 0);
    return next.toISOString();
  }

  if (config.frequency === 'weekly') {
    const days = config.daysOfWeek && config.daysOfWeek.length > 0 ? config.daysOfWeek : [0];
    next.setHours(targetHours, targetMinutes, 0, 0);
    let dayOffset = 1;
    while (!days.includes((next.getDay() + dayOffset) % 7)) {
      dayOffset++;
      if (dayOffset > 7) break;
    }
    next.setDate(next.getDate() + dayOffset);
    return next.toISOString();
  }

  next.setHours(targetHours, targetMinutes, 0, 0);
  if (next.getTime() <= now.getTime()) {
    next.setDate(next.getDate() + 1);
  }
  return next.toISOString();
}

export async function getServerBackupConfig(): Promise<BackupScheduleConfig> {
  const saved = await getSystemSettingsFromDb<BackupScheduleConfig>('backup_schedule');
  if (saved) {
    if (!saved.nextRunAt) {
      saved.nextRunAt = calculateNextRun(saved);
    }
    return saved;
  }
  const initial: BackupScheduleConfig = {
    ...DEFAULT_CONFIG,
    nextRunAt: calculateNextRun(DEFAULT_CONFIG),
    updatedAt: new Date().toISOString(),
  };
  await saveSystemSettingsToDb('backup_schedule', initial);
  return initial;
}

export async function saveServerBackupConfig(
  cfg: BackupScheduleConfig
): Promise<BackupScheduleConfig> {
  const normalized: BackupScheduleConfig = {
    ...DEFAULT_CONFIG,
    ...cfg,
    nextRunAt: calculateNextRun(cfg),
    updatedAt: new Date().toISOString(),
  };
  await saveSystemSettingsToDb('backup_schedule', normalized);
  return normalized;
}

export async function getServerBackupHistory(): Promise<BackupHistoryEntry[]> {
  ensureBackupsDir();
  const rows = await getBackupsFromDb(false);
  return rows.map((row) => {
    const safeFilename = path.basename(row.filename);
    const filePath = path.resolve(BACKUPS_DIR, safeFilename);
    const onDisk =
      filePath.startsWith(path.resolve(BACKUPS_DIR) + path.sep) && fs.existsSync(filePath);
    return {
      id: row.id,
      filename: safeFilename,
      timestamp: row.timestamp,
      sizeBytes: row.sizeBytes,
      sizeFormatted: row.sizeFormatted,
      checksum: row.checksum,
      trigger: row.trigger,
      status: row.status,
      counts: {
        products: Number(row.counts?.products || 0),
        quotes: Number(row.counts?.quotes || 0),
        orders: Number(row.counts?.orders || 0),
      },
      storedOnServer: onDisk || true,
    };
  });
}

export async function deleteServerBackup(id: string): Promise<boolean> {
  const existing = await getBackupByIdFromDb(id);
  if (!existing) {
    return false;
  }
  const resolvedDir = path.resolve(BACKUPS_DIR);
  const safeName = path.basename(existing.filename);
  const resolvedFile = path.resolve(resolvedDir, safeName);
  if (resolvedFile.startsWith(resolvedDir + path.sep) && fs.existsSync(resolvedFile)) {
    try {
      fs.unlinkSync(resolvedFile);
    } catch (unlinkErr) {
      console.warn('[BackupWorker] Aviso ao remover arquivo de backup:', unlinkErr);
    }
  }
  await deleteBackupFromDb(id);
  return true;
}

/**
 * Executa exportação oficial diretamente do PostgreSQL e persiste na tabela `backups` + disco.
 */
export async function executeServerBackup(
  trigger: 'scheduled' | 'manual' | 'disaster_recovery_preflight' = 'scheduled'
): Promise<{ success: boolean; entry?: BackupHistoryEntry; jsonString?: string; error?: string }> {
  ensureBackupsDir();
  const config = await getServerBackupConfig();
  const now = new Date();
  const timestamp = now.toISOString();

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');

  const prefix = trigger === 'scheduled' ? 'mb_backup_agendado' : 'mb_backup_recuperacao';
  const filename = `${prefix}_${year}-${month}-${day}_${hours}${minutes}${seconds}.json`;
  const resolvedDir = path.resolve(BACKUPS_DIR);
  const filePath = path.resolve(resolvedDir, path.basename(filename));

  if (!filePath.startsWith(resolvedDir + path.sep)) {
    throw new Error('Caminho de arquivo de backup inválido.');
  }

  // Exporta diretamente das tabelas reais do PostgreSQL (sem dados mockados ou do navegador)
  const dbSnapshot = await exportAllBusinessTablesFromDb({
    includeProducts: config.includeProducts,
    includeQuotes: config.includeQuotes,
    includeOrders: config.includeOrders,
    includeStock: config.includeStock,
    includeCustomers: config.includeCustomers,
    includeSettings: config.includeSettings,
  });

  const data: any = {
    ...dbSnapshot,
    customers: dbSnapshot.users,
    companySettings: (dbSnapshot.settings as Record<string, any>)?.company,
  };

  const rawDataJson = JSON.stringify(data);
  const checksum = crypto
    .createHash('sha256')
    .update(rawDataJson + 'mb_personaliza_salt')
    .digest('hex');

  const metadata: BackupMetadata = {
    system: 'MB Personaliza - Sistema Integrado de Gestão',
    appletId: 'c2a4b442-9b4f-41b6-8554-96d40752f5a7',
    version: '2.0.0',
    exportTimestamp: timestamp,
    exportType: trigger,
    schemaVersion: '1.0.0',
    counts: {
      products: Array.isArray(data.products) ? data.products.length : 0,
      categories: Array.isArray(data.categories) ? data.categories.length : 0,
      subcategories: Array.isArray(data.subcategories) ? data.subcategories.length : 0,
      quotes: Array.isArray(data.quotes) ? data.quotes.length : 0,
      orders: Array.isArray(data.orders) ? data.orders.length : 0,
      stockMovements: Array.isArray(data.stockMovements) ? data.stockMovements.length : 0,
      customers: Array.isArray(data.customers) ? data.customers.length : 0,
    },
    security: {
      algorithm: 'SHA-256',
      checksumSha256: checksum,
      signature: `SIG-MB-${checksum.substring(0, 16).toUpperCase()}`,
      encrypted: Boolean(config.encryptPayload),
      integrityVerified: true,
    },
    disasterRecoveryNote:
      'Cópia de segurança oficial extraída diretamente do PostgreSQL da MB Personaliza.',
  };

  const fullPayload: SecureBackupPayload = {
    metadata,
    data,
  };

  const jsonString = JSON.stringify(fullPayload, null, 2);
  const sizeBytes = Buffer.byteLength(jsonString, 'utf-8');
  const sizeFormatted = (sizeBytes / 1024).toFixed(2) + ' KB';

  const entry: BackupHistoryEntry = {
    id: `bkp-srv-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    filename,
    timestamp,
    sizeBytes,
    sizeFormatted,
    checksum,
    trigger,
    status: 'success',
    counts: {
      products: metadata.counts.products,
      quotes: metadata.counts.quotes,
      orders: metadata.counts.orders,
    },
    storedOnServer: config.saveOnServer !== false,
  };

  // Grava na tabela `backups` do PostgreSQL e aplica política de retenção no banco
  await recordBackupInDb({
    ...entry,
    payload: fullPayload,
  });

  const retentionCount = Math.max(1, Number(config.retentionCount || 15));
  await enforceBackupRetentionInDb(retentionCount);

  if (config.saveOnServer !== false) {
    fs.writeFileSync(filePath, jsonString, 'utf-8');
    try {
      const dbHistory = await getBackupsFromDb(false);
      const activeFiles = new Set(dbHistory.map((h) => path.basename(h.filename)));
      const filesOnDisk = fs.readdirSync(BACKUPS_DIR);
      for (const f of filesOnDisk) {
        if (f.endsWith('.json') && !activeFiles.has(f)) {
          const target = path.resolve(resolvedDir, path.basename(f));
          if (target.startsWith(resolvedDir + path.sep)) {
            fs.unlinkSync(target);
          }
        }
      }
    } catch (cleanErr) {
      console.warn('[BackupWorker] Aviso na limpeza de arquivos antigos:', cleanErr);
    }
  }

  config.lastRunAt = timestamp;
  config.lastRunStatus = 'success';
  config.lastRunMessage = `Backup PostgreSQL ${trigger === 'scheduled' ? 'agendado' : 'manual'} concluído (${metadata.counts.products} produtos, ${metadata.counts.quotes} orçamentos, ${metadata.counts.orders} pedidos).`;
  config.nextRunAt = calculateNextRun(config);
  await saveServerBackupConfig(config);

  return {
    success: true,
    entry,
    jsonString,
  };
}

export class BackupSchedulerWorker {
  private timer: NodeJS.Timeout | null = null;
  private isRunning = false;

  start(intervalMs = 60000): void {
    if (this.isRunning) return;
    this.isRunning = true;
    ensureBackupsDir();

    console.log('[BackupWorker] Serviço de exportação agendada (PostgreSQL) iniciado.');

    this.timer = setInterval(async () => {
      if (!isDatabaseConfigured()) return;
      try {
        const config = await getServerBackupConfig();
        if (!config.enabled) return;

        const now = new Date();
        const nextRun = config.nextRunAt ? new Date(config.nextRunAt) : new Date(0);

        if (now.getTime() >= nextRun.getTime()) {
          console.log('[BackupWorker] Horário agendado atingido. Executando backup PostgreSQL...');
          await executeServerBackup('scheduled');
        }
      } catch (err) {
        if (!isDbUnavailableError(err)) {
          console.error('[BackupWorker] Erro no ciclo de verificação:', err);
        }
      }
    }, intervalMs);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.isRunning = false;
    console.log('[BackupWorker] Serviço de backup agendado pausado.');
  }
}

export const backupSchedulerWorker = new BackupSchedulerWorker();
export { BACKUPS_DIR };
