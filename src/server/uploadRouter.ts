import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { requireAuthSession } from '../middleware/auth.ts';

export const uploadRouter = Router();

const UPLOADS_DIR = path.join(process.cwd(), 'uploads');

// Ensure directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

/**
 * POST /api/upload/base64
 * Recebe imagens e arquivos em Base64 (DataURL) e grava no disco permanente,
 * retornando uma URL pública leve (/uploads/...) para não sobrecarregar o PostgreSQL.
 */
uploadRouter.post('/base64', requireAuthSession, (req: Request, res: Response) => {
  try {
    const { dataUrl, filename = 'upload.png', folder = '' } = req.body;

    if (!dataUrl || typeof dataUrl !== 'string') {
      return res.status(400).json({ success: false, error: 'DataURL não informado ou inválido.' });
    }

    const matches = dataUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return res.status(400).json({ success: false, error: 'Formato DataURL inválido.' });
    }

    const mimeType = matches[1];
    const buffer = Buffer.from(matches[2], 'base64');

    // Limite de segurança: 50MB
    if (buffer.length > 50 * 1024 * 1024) {
      return res.status(413).json({ success: false, error: 'Arquivo excede o limite de 50MB.' });
    }

    // Extensão baseada no MIME ou nome
    let ext = path.extname(filename).toLowerCase();
    if (!ext) {
      if (mimeType.includes('png')) ext = '.png';
      else if (mimeType.includes('jpeg') || mimeType.includes('jpg')) ext = '.jpg';
      else if (mimeType.includes('webp')) ext = '.webp';
      else if (mimeType.includes('svg')) ext = '.svg';
      else if (mimeType.includes('pdf')) ext = '.pdf';
      else ext = '.bin';
    }

    const safeHash = crypto.randomBytes(12).toString('hex');
    const safeBaseName = path
      .basename(filename, ext)
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 30);
    const finalFilename = `${Date.now()}-${safeBaseName}-${safeHash}${ext}`;

    const safeFolder = folder ? path.basename(String(folder)).replace(/[^a-zA-Z0-9_-]/g, '_') : '';
    const resolvedBase = path.resolve(UPLOADS_DIR);
    const targetFolder = safeFolder ? path.resolve(resolvedBase, safeFolder) : resolvedBase;
    if (targetFolder !== resolvedBase && !targetFolder.startsWith(resolvedBase + path.sep)) {
      return res.status(400).json({ success: false, error: 'Diretório de destino inválido.' });
    }
    if (!fs.existsSync(targetFolder)) {
      fs.mkdirSync(targetFolder, { recursive: true });
    }

    const filePath = path.resolve(targetFolder, finalFilename);
    if (!filePath.startsWith(resolvedBase + path.sep)) {
      return res.status(400).json({ success: false, error: 'Caminho de destino inválido.' });
    }
    fs.writeFileSync(filePath, buffer);

    const publicUrl = safeFolder ? `/uploads/${safeFolder}/${finalFilename}` : `/uploads/${finalFilename}`;

    return res.json({
      success: true,
      url: publicUrl,
      filename: finalFilename,
      sizeBytes: buffer.length,
      mimeType,
    });
  } catch (err: any) {
    console.error('[UploadRouter] Erro ao gravar upload:', err);
    return res.status(500).json({ success: false, error: err.message || 'Erro no processamento do arquivo.' });
  }
});

/**
 * GET /api/upload/health
 */
uploadRouter.get('/health', (req: Request, res: Response) => {
  res.json({
    success: true,
    storage: 'Local Disk Volume (/uploads)',
    uploadsDir: UPLOADS_DIR,
  });
});
