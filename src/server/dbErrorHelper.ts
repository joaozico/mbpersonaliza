import type { Response } from 'express';
import { DatabaseUnavailableError } from '../db/index.ts';

export function isDbUnavailableError(err: any): boolean {
  if (!err) return false;
  if (err instanceof DatabaseUnavailableError) return true;
  if (err?.name === 'DatabaseUnavailableError' || err?.statusCode === 503) return true;
  const msg = String(err?.message || '').toLowerCase();
  const code = String(err?.code || '');
  return (
    code === 'ECONNREFUSED' ||
    code === 'ETIMEDOUT' ||
    code === 'ENOTFOUND' ||
    code === '57P01' ||
    msg.includes('postgresql não configurado') ||
    msg.includes('banco de dados postgresql indisponível') ||
    msg.includes('connection terminated unexpectedly')
  );
}

export function handleRouterError(
  res: Response,
  err: any,
  fallbackMessage = 'Erro interno ao processar operação no PostgreSQL.'
) {
  if (isDbUnavailableError(err)) {
    return res.status(503).json({
      success: false,
      code: 'DB_UNAVAILABLE',
      error:
        err?.message ||
        'PostgreSQL indisponível no momento. Nenhuma alteração foi persistida.',
    });
  }
  return res.status(500).json({
    success: false,
    error: err?.message || fallbackMessage,
  });
}
