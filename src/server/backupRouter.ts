import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {
  getServerBackupConfig,
  saveServerBackupConfig,
  getServerBackupHistory,
  saveServerBackupHistory,
  executeServerBackup,
  BACKUPS_DIR,
} from './backupSchedulerWorker';
import { BackupScheduleConfig } from '../types';

export const backupRouter = Router();

// GET /api/backup/config
backupRouter.get('/config', (req: Request, res: Response) => {
  try {
    const config = getServerBackupConfig();
    res.json({ success: true, config });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Erro ao obter configurações' });
  }
});

// POST /api/backup/config
backupRouter.post('/config', (req: Request, res: Response) => {
  try {
    const newConfig: BackupScheduleConfig = req.body;
    if (!newConfig || typeof newConfig !== 'object') {
      return res.status(400).json({ success: false, error: 'Configuração inválida.' });
    }
    saveServerBackupConfig(newConfig);
    const updated = getServerBackupConfig();
    res.json({ success: true, config: updated, message: 'Configuração de backup agendado salva com sucesso!' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Erro ao salvar configurações' });
  }
});

// GET /api/backup/history
backupRouter.get('/history', (req: Request, res: Response) => {
  try {
    const history = getServerBackupHistory();
    res.json({ success: true, history });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Erro ao obter histórico' });
  }
});

// POST /api/backup/export
backupRouter.post('/export', async (req: Request, res: Response) => {
  try {
    const { trigger = 'manual', clientPayload } = req.body;
    const result = await executeServerBackup(trigger, clientPayload);
    if (!result.success) {
      return res.status(500).json({ success: false, error: result.error });
    }
    res.json({
      success: true,
      entry: result.entry,
      jsonString: result.jsonString,
      message: 'Backup de recuperação gerado com sucesso!',
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Erro ao exportar backup' });
  }
});

// GET /api/backup/download/:filename
backupRouter.get('/download/:filename', (req: Request, res: Response) => {
  try {
    const { filename } = req.params;
    // Sanitização para evitar path traversal
    const safeFilename = path.basename(filename);
    const filePath = path.join(BACKUPS_DIR, safeFilename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, error: 'Arquivo de backup não encontrado no servidor.' });
    }

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Erro ao baixar arquivo' });
  }
});

// POST /api/backup/verify
backupRouter.post('/verify', (req: Request, res: Response) => {
  try {
    const { jsonString } = req.body;
    if (!jsonString) {
      return res.status(400).json({ success: false, valid: false, errors: ['Nenhum conteúdo fornecido.'] });
    }

    let parsed: any;
    try {
      parsed = JSON.parse(jsonString);
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
    const calculatedChecksum = crypto.createHash('sha256').update(rawDataJson + 'mb_personaliza_salt').digest('hex');

    const checksumMatches = statedChecksum === calculatedChecksum;

    res.json({
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
    res.status(500).json({ success: false, error: err.message || 'Erro ao verificar integridade' });
  }
});

// DELETE /api/backup/:id
backupRouter.delete('/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const history = getServerBackupHistory();
    const entry = history.find((h) => h.id === id);

    if (entry) {
      const filePath = path.join(BACKUPS_DIR, entry.filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    const updated = history.filter((h) => h.id !== id);
    saveServerBackupHistory(updated);

    res.json({ success: true, message: 'Registro de backup removido com sucesso.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Erro ao excluir backup' });
  }
});
