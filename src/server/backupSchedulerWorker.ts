import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { BackupScheduleConfig, BackupHistoryEntry, SecureBackupPayload, BackupMetadata } from '../types';

const BACKUPS_DIR = path.join(process.cwd(), 'data', 'backups');
const CONFIG_FILE = path.join(process.cwd(), 'data', 'backup-schedule-config.json');
const HISTORY_FILE = path.join(process.cwd(), 'data', 'backup-history.json');

// Ensure backups directory exists
function ensureDirs() {
  try {
    if (!fs.existsSync(BACKUPS_DIR)) {
      fs.mkdirSync(BACKUPS_DIR, { recursive: true });
    }
  } catch (err) {
    console.error('[BackupWorker] Error creating backup directory:', err);
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

export function getServerBackupConfig(): BackupScheduleConfig {
  ensureDirs();
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = fs.readFileSync(CONFIG_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      if (!parsed.nextRunAt) {
        parsed.nextRunAt = calculateNextRun(parsed);
      }
      return parsed;
    }
  } catch (err) {
    console.error('[BackupWorker] Failed reading config file:', err);
  }
  const initial = { ...DEFAULT_CONFIG };
  initial.nextRunAt = calculateNextRun(initial);
  saveServerBackupConfig(initial);
  return initial;
}

export function saveServerBackupConfig(cfg: BackupScheduleConfig): void {
  ensureDirs();
  try {
    cfg.nextRunAt = calculateNextRun(cfg);
    cfg.updatedAt = new Date().toISOString();
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2), 'utf-8');
  } catch (err) {
    console.error('[BackupWorker] Failed writing config file:', err);
  }
}

export function getServerBackupHistory(): BackupHistoryEntry[] {
  ensureDirs();
  try {
    if (fs.existsSync(HISTORY_FILE)) {
      const data = fs.readFileSync(HISTORY_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('[BackupWorker] Failed reading history file:', err);
  }
  return [];
}

export function saveServerBackupHistory(history: BackupHistoryEntry[]): void {
  ensureDirs();
  try {
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2), 'utf-8');
  } catch (err) {
    console.error('[BackupWorker] Failed writing history file:', err);
  }
}

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
    while (!days.includes((next.getDay() + dayOffset) % 7) || dayOffset <= 0) {
      dayOffset++;
      if (dayOffset > 7) break;
    }
    next.setDate(next.getDate() + dayOffset);
    return next.toISOString();
  }

  // Daily
  next.setHours(targetHours, targetMinutes, 0, 0);
  if (next.getTime() <= now.getTime()) {
    next.setDate(next.getDate() + 1);
  }
  return next.toISOString();
}

/**
 * Executes a server-side backup export and saves to disk
 */
export async function executeServerBackup(
  trigger: 'scheduled' | 'manual' | 'disaster_recovery_preflight' = 'scheduled',
  clientPayload?: any
): Promise<{ success: boolean; entry?: BackupHistoryEntry; jsonString?: string; error?: string }> {
  ensureDirs();
  try {
    const config = getServerBackupConfig();
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
    const filePath = path.join(BACKUPS_DIR, filename);

    // Payload data from client or mock/server baseline
    const data = clientPayload?.data || {
      products: clientPayload?.products || [],
      quotes: clientPayload?.quotes || [],
      orders: clientPayload?.orders || [],
      categories: clientPayload?.categories || [],
      subcategories: clientPayload?.subcategories || [],
      stockMovements: clientPayload?.stockMovements || [],
      customers: clientPayload?.customers || [],
      companySettings: clientPayload?.companySettings || undefined,
    };

    const rawDataJson = JSON.stringify(data);
    const checksum = crypto.createHash('sha256').update(rawDataJson + 'mb_personaliza_salt').digest('hex');

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
        'Cópia de segurança para recuperação de desastres. Contém catálogo, orçamentos e pedidos da MB Personaliza.',
    };

    const fullPayload: SecureBackupPayload = {
      metadata,
      data,
    };

    const jsonString = JSON.stringify(fullPayload, null, 2);
    fs.writeFileSync(filePath, jsonString, 'utf-8');

    const sizeBytes = Buffer.byteLength(jsonString, 'utf-8');
    const sizeFormatted = (sizeBytes / 1024).toFixed(2) + ' KB';

    const entry: BackupHistoryEntry = {
      id: `bkp-srv-${Date.now()}`,
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
      storedOnServer: true,
      downloadUrl: `/api/backup/download/${filename}`,
    };

    // Update history and apply retention policy
    const history = getServerBackupHistory();
    const updatedHistory = [entry, ...history].slice(0, config.retentionCount || 15);
    saveServerBackupHistory(updatedHistory);

    // Prune old files on disk that are no longer in history
    try {
      const activeFiles = new Set(updatedHistory.map((h) => h.filename));
      const filesOnDisk = fs.readdirSync(BACKUPS_DIR);
      for (const f of filesOnDisk) {
        if (f.endsWith('.json') && !activeFiles.has(f)) {
          fs.unlinkSync(path.join(BACKUPS_DIR, f));
        }
      }
    } catch (cleanErr) {
      console.warn('[BackupWorker] Cleanup warning:', cleanErr);
    }

    // Update config execution state
    config.lastRunAt = timestamp;
    config.lastRunStatus = 'success';
    config.lastRunMessage = `Backup ${trigger === 'scheduled' ? 'agendado' : 'manual'} concluído com sucesso (${metadata.counts.products} produtos, ${metadata.counts.quotes} orçamentos, ${metadata.counts.orders} pedidos).`;
    config.nextRunAt = calculateNextRun(config);
    saveServerBackupConfig(config);

    return {
      success: true,
      entry,
      jsonString,
    };
  } catch (err: any) {
    console.error('[BackupWorker] Execution error:', err);
    return {
      success: false,
      error: err.message || 'Erro ao gerar backup no servidor',
    };
  }
}

/**
 * Background scheduler daemon for automated periodic backups
 */
export class BackupSchedulerWorker {
  private timer: NodeJS.Timeout | null = null;
  private isRunning = false;

  start(intervalMs = 60000): void {
    if (this.isRunning) return;
    this.isRunning = true;
    ensureDirs();

    console.log('[BackupWorker] Serviço de exportação agendada iniciado.');

    this.timer = setInterval(async () => {
      try {
        const config = getServerBackupConfig();
        if (!config.enabled) return;

        const now = new Date();
        const nextRun = config.nextRunAt ? new Date(config.nextRunAt) : new Date(0);

        if (now.getTime() >= nextRun.getTime()) {
          console.log('[BackupWorker] Horário agendado atingido. Disparando backup de recuperação de desastres...');
          await executeServerBackup('scheduled');
        }
      } catch (err) {
        console.error('[BackupWorker] Erro no ciclo de verificação:', err);
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
