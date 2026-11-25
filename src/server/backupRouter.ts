import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import {
  getServerBackupConfig,
  saveServerBackupConfig,
  getServerBackupHistory,
  executeServerBackup,
  deleteServerBackup,
} from './backupSchedulerWorker.ts';
import { BackupScheduleConfig } from '../types.ts';
import { requireAdminSession } from '../middleware/auth.ts';
import { restoreDatabaseFromBackupPayloadInDb } from '../db/repository.ts';
import { handleRouterError } from './dbErrorHelper.ts';

export const backupRouter = Router();
backupRouter.use(requireAdminSession);

// GET /api/backup/config
backupRouter.get('/config', async (_req: Request, res: Response) => {
  try {
    const config = await getServerBackupConfig();
    return res.json({ success: true, config });
  } catch (err: any) {
    return handleRouterError(res, err, 'Erro ao obter configurações de backup no PostgreSQL.');
  }
});

// POST /api/backup/config
backupRouter.post('/config', async (req: Request, res: Response) => {
  try {
    const newConfig: BackupScheduleConfig = req.body;
    if (!newConfig || typeof newConfig !== 'object') {
      return res.status(400).json({ success: false, error: 'Configuração inválida.' });
    }
    const updated = await saveServerBackupConfig(newConfig);
    return res.json({
      success: true,
      config: updated,
      message: 'Configuração de backup agendado salva no PostgreSQL com sucesso!',
    });
  } catch (err: any) {
    return handleRouterError(res, err, 'Erro ao salvar configurações de backup no PostgreSQL.');
  }
});

// GET /api/backup/history
backupRouter.get('/history', async (_req: Request, res: Response) => {
  try {
    const history = await getServerBackupHistory();
    return res.json({ success: true, history });
  } catch (err: any) {
    return handleRouterError(res, err, 'Erro ao obter histórico de backups do PostgreSQL.');
  }
});

const DB_DOWNLOAD_BLOCKED_PAYLOAD = {
  success: false,
  code: 'DB_DOWNLOAD_DISABLED',
  error: 'Download direto ou exportação do banco de dados PostgreSQL bloqueada por política de segurança.',
};

// Rotas de download/exportação direta do PostgreSQL bloqueadas permanentemente (inclusive para administradores)
backupRouter.all('/postgres-package', (_req: Request, res: Response) => {
  return res.status(403).json(DB_DOWNLOAD_BLOCKED_PAYLOAD);
});

backupRouter.all('/postgres-package/*', (_req: Request, res: Response) => {
  return res.status(403).json(DB_DOWNLOAD_BLOCKED_PAYLOAD);
});

backupRouter.all('/pg-dump', (_req: Request, res: Response) => {
  return res.status(403).json(DB_DOWNLOAD_BLOCKED_PAYLOAD);
});

backupRouter.all('/pg-dump/*', (_req: Request, res: Response) => {
  return res.status(403).json(DB_DOWNLOAD_BLOCKED_PAYLOAD);
});

backupRouter.all('/download', (_req: Request, res: Response) => {
  return res.status(403).json(DB_DOWNLOAD_BLOCKED_PAYLOAD);
});

backupRouter.all('/download/*', (_req: Request, res: Response) => {
  return res.status(403).json(DB_DOWNLOAD_BLOCKED_PAYLOAD);
});

// POST /api/backup/export (Executa snapshot interno protegido no servidor — nunca retorna dump ao navegador)
backupRouter.post('/export', async (req: Request, res: Response) => {
  try {
    const { trigger = 'manual' } = req.body || {};
    const validTrigger =
      trigger === 'scheduled' || trigger === 'disaster_recovery_preflight' ? trigger : 'manual';
    const result = await executeServerBackup(validTrigger);
    if (!result.success) {
      return res.status(500).json({ success: false, error: result.error });
    }
    return res.json({
      success: true,
      entry: result.entry,
      message: 'Snapshot interno de backup do PostgreSQL gerado e protegido no servidor com sucesso!',
    });
  } catch (err: any) {
    return handleRouterError(res, err, 'Erro ao gerar snapshot interno do PostgreSQL.');
  }
});

// POST /api/backup/verify
backupRouter.post('/verify', (req: Request, res: Response) => {
  try {
    const { jsonString } = req.body || {};
    if (!jsonString) {
      return res
        .status(400)
        .json({ success: false, valid: false, errors: ['Nenhum conteúdo fornecido.'] });
    }

    let parsed: any;
    try {
      parsed = typeof jsonString === 'string' ? JSON.parse(jsonString) : jsonString;
    } catch (err: any) {
      return res.json({
        success: true,
        valid: false,
        checksumMatches: false,
        errors: [`JSON inválido: ${err.message}`],
      });
    }

    const metadata = parsed.metadata;
    const data = parsed.data;
    const errors: string[] = [];

    if (!metadata) errors.push('Metadados ausentes (metadata não encontrado).');
    if (!data) errors.push('Dados ausentes (data não encontrado).');
    if (data && !Array.isArray(data.products)) errors.push('Lista de produtos ausente ou inválida.');
    if (data && !Array.isArray(data.quotes)) errors.push('Lista de orçamentos ausente ou inválida.');
    if (data && !Array.isArray(data.orders)) errors.push('Lista de pedidos ausente ou inválida.');

    const statedChecksum = metadata?.security?.checksumSha256 || '';
    const rawDataJson = JSON.stringify(data || {});
    const calculatedChecksum = crypto
      .createHash('sha256')
      .update(rawDataJson + 'mb_personaliza_salt')
      .digest('hex');

    const checksumMatches = Boolean(statedChecksum) && statedChecksum === calculatedChecksum;

    return res.json({
      success: true,
      valid: errors.length === 0,
      checksumMatches,
      statedChecksum,
      calculatedChecksum,
      metadata,
      counts: {
        products: Array.isArray(data?.products) ? data.products.length : 0,
        quotes: Array.isArray(data?.quotes) ? data.quotes.length : 0,
        orders: Array.isArray(data?.orders) ? data.orders.length : 0,
      },
      errors,
    });
  } catch (err: any) {
    return handleRouterError(res, err, 'Erro ao verificar integridade do backup.');
  }
});

// POST /api/backup/restore
backupRouter.post('/restore', async (req: Request, res: Response) => {
  try {
    const { jsonString, allowUnverified = false } = req.body || {};
    if (!jsonString) {
      return res.status(400).json({ success: false, error: 'Payload de backup ausente.' });
    }

    let parsed: any;
    try {
      parsed = typeof jsonString === 'string' ? JSON.parse(jsonString) : jsonString;
    } catch (err: any) {
      return res.status(400).json({ success: false, error: `JSON inválido: ${err.message}` });
    }

    if (!parsed?.data || typeof parsed.data !== 'object') {
      return res.status(400).json({ success: false, error: 'Estrutura do arquivo de backup inválida.' });
    }

    const statedChecksum = parsed?.metadata?.security?.checksumSha256 || '';
    const calculatedChecksum = crypto
      .createHash('sha256')
      .update(JSON.stringify(parsed.data) + 'mb_personaliza_salt')
      .digest('hex');

    if (!allowUnverified && (!statedChecksum || statedChecksum !== calculatedChecksum)) {
      return res.status(400).json({
        success: false,
        code: 'CHECKSUM_MISMATCH',
        error: 'Assinatura SHA-256 do backup não confere. Restauração bloqueada por segurança.',
      });
    }

    // Backup prévio de segurança antes da restauração transacional
    const preflight = await executeServerBackup('disaster_recovery_preflight');
    const restoredCounts = await restoreDatabaseFromBackupPayloadInDb(parsed.data);

    return res.json({
      success: true,
      restoredCounts,
      preflightBackup: preflight.entry,
      message: 'Restauração transacional no PostgreSQL concluída com sucesso!',
    });
  } catch (err: any) {
    return handleRouterError(res, err, 'Erro ao restaurar backup no PostgreSQL.');
  }
});

// DELETE /api/backup/:id
backupRouter.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const removed = await deleteServerBackup(id);
    if (!removed) {
      return res.status(404).json({ success: false, error: 'Backup não encontrado.' });
    }
    return res.json({ success: true, message: 'Registro de backup removido com sucesso do PostgreSQL.' });
  } catch (err: any) {
    return handleRouterError(res, err, 'Erro ao excluir backup no PostgreSQL.');
  }
});
