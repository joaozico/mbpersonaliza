import crypto from 'crypto';
import type { Request, Response } from 'express';
import type { PriceVisibilityMode, RolePermissions, UserProfile, UserRole } from '../types.ts';
import { INITIAL_PERMISSIONS_MATRIX } from '../data/initialData.ts';

export const SESSION_COOKIE_NAME = 'mb_session';
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

// ==========================================
// SALTED SCRYPT PASSWORD HASHING
// ==========================================
export function hashPassword(password: string): string {
  const normalized = String(password ?? '');
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(normalized, salt, 64).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

export function verifyPassword(password: string, storedHash?: string | null): boolean {
  if (!storedHash || typeof storedHash !== 'string') return false;
  const parts = storedHash.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') {
    return false;
  }
  const [, salt, originalHex] = parts;
  if (!salt || !originalHex) return false;
  try {
    const derived = crypto.scryptSync(String(password ?? ''), salt, 64);
    const originalBuf = Buffer.from(originalHex, 'hex');
    if (derived.length !== originalBuf.length) return false;
    return crypto.timingSafeEqual(derived, originalBuf);
  } catch {
    return false;
  }
}

// ==========================================
// SESSION TOKEN HELPERS
// ==========================================
export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function hashSessionToken(token: string): string {
  return crypto.createHash('sha256').update(String(token || '')).digest('hex');
}

export function parseCookies(req: Request): Record<string, string> {
  const cookieHeader = req.headers.cookie;
  const result: Record<string, string> = {};
  if (!cookieHeader || typeof cookieHeader !== 'string') return result;

  const pairs = cookieHeader.split(';');
  for (const pair of pairs) {
    const idx = pair.indexOf('=');
    if (idx === -1) continue;
    const key = pair.slice(0, idx).trim();
    const rawVal = pair.slice(idx + 1).trim();
    if (!key) continue;
    try {
      result[key] = decodeURIComponent(rawVal);
    } catch {
      result[key] = rawVal;
    }
  }
  return result;
}

function isRequestHttps(req: Request): boolean {
  const proto = String(req.headers['x-forwarded-proto'] || '').toLowerCase();
  return req.secure || proto.includes('https');
}

export function setSessionCookie(
  req: Request,
  res: Response,
  token: string,
  maxAgeSeconds = SESSION_TTL_SECONDS
): void {
  const https = isRequestHttps(req);
  const parts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    `Max-Age=${maxAgeSeconds}`,
    https ? 'SameSite=None' : 'SameSite=Lax',
  ];
  if (https) {
    parts.push('Secure', 'Partitioned');
  }
  res.setHeader('Set-Cookie', parts.join('; '));
}

export function clearSessionCookie(req: Request, res: Response): void {
  const https = isRequestHttps(req);
  const parts = [
    `${SESSION_COOKIE_NAME}=`,
    'Path=/',
    'HttpOnly',
    'Max-Age=0',
    'Expires=Thu, 01 Jan 1970 00:00:00 GMT',
    https ? 'SameSite=None' : 'SameSite=Lax',
  ];
  if (https) {
    parts.push('Secure', 'Partitioned');
  }
  res.setHeader('Set-Cookie', parts.join('; '));
}

// ==========================================
// INPUT VALIDATION (EMAIL, CPF, CNPJ)
// ==========================================
export function onlyDigits(val?: string | null): string {
  return String(val || '').replace(/\D/g, '');
}

export function validateEmail(email?: string | null): boolean {
  if (!email || typeof email !== 'string') return false;
  const trimmed = email.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmed);
}

export function validateCpf(raw: string): boolean {
  const cpf = onlyDigits(raw);
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += Number(cpf[i]) * (10 - i);
  }
  let remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== Number(cpf[9])) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += Number(cpf[i]) * (11 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  return remainder === Number(cpf[10]);
}

export function validateCnpj(raw: string): boolean {
  const cnpj = onlyDigits(raw);
  if (cnpj.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(cnpj)) return false;

  const calcDigit = (base: string, weights: number[]): number => {
    let sum = 0;
    for (let i = 0; i < weights.length; i++) {
      sum += Number(base[i]) * weights[i];
    }
    const mod = sum % 11;
    return mod < 2 ? 0 : 11 - mod;
  };

  const d1 = calcDigit(cnpj.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  if (d1 !== Number(cnpj[12])) return false;

  const d2 = calcDigit(cnpj.slice(0, 13), [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return d2 === Number(cnpj[13]);
}

export function validateCpfCnpj(raw?: string | null): { valid: boolean; normalized: string; message?: string } {
  const digits = onlyDigits(raw);
  if (!digits) {
    return { valid: true, normalized: '' };
  }
  if (digits.length === 11) {
    if (!validateCpf(digits)) {
      return { valid: false, normalized: digits, message: 'CPF inválido. Verifique os dígitos informados.' };
    }
    return { valid: true, normalized: digits };
  }
  if (digits.length === 14) {
    if (!validateCnpj(digits)) {
      return { valid: false, normalized: digits, message: 'CNPJ inválido. Verifique os dígitos informados.' };
    }
    return { valid: true, normalized: digits };
  }
  return { valid: false, normalized: digits, message: 'CPF deve conter 11 dígitos ou CNPJ deve conter 14 dígitos.' };
}

// ==========================================
// USER SANITIZATION & PERMISSION RESOLUTION
// ==========================================
export function sanitizeUserForClient(raw: any): UserProfile {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Invalid user record');
  }
  const {
    password: _pw,
    passwordHash: _pwh,
    password_hash: _pwhSnake,
    ...rest
  } = raw;

  const uid = String(raw.uid || raw.id || '');
  const isInactive = raw.isActive === false || raw.status === 'inativo';

  return {
    ...rest,
    id: uid,
    uid,
    name: String(raw.name || ''),
    email: String(raw.email || ''),
    phone: String(raw.phone || ''),
    company: raw.company || '',
    cpfCnpj: raw.cpfCnpj || raw.cpf_cnpj || '',
    role: (raw.role || 'cliente') as UserRole,
    status: isInactive ? 'inativo' : 'ativo',
    isActive: !isInactive,
    customPermissions: raw.customPermissions || raw.custom_permissions || undefined,
    createdAt: raw.createdAt ? new Date(raw.createdAt).toISOString() : new Date().toISOString(),
  } as UserProfile & { uid?: string; isActive?: boolean };
}

export function resolveEffectivePermissions(
  user: UserProfile | null,
  matrix?: Partial<Record<UserRole, RolePermissions>> | null
): RolePermissions {
  const sourceMatrix = matrix || INITIAL_PERMISSIONS_MATRIX;
  const visitanteBase = {
    ...INITIAL_PERMISSIONS_MATRIX.visitante,
    ...(sourceMatrix.visitante || {}),
  };

  if (!user || user.role === 'visitante' || user.status === 'inativo') {
    return visitanteBase;
  }

  if (user.role === 'admin') {
    return {
      ...INITIAL_PERMISSIONS_MATRIX.admin,
      ...(sourceMatrix.admin || {}),
    };
  }

  const roleBase = {
    ...INITIAL_PERMISSIONS_MATRIX[user.role],
    ...(sourceMatrix[user.role] || {}),
  };

  if (user.customPermissions && typeof user.customPermissions === 'object') {
    return {
      ...roleBase,
      ...user.customPermissions,
    };
  }

  return roleBase;
}

// ==========================================
// PRICE VISIBILITY REDACTION (SERVER-SIDE ENFORCEMENT)
// ==========================================
export function normalizePriceVisibilityMode(val: any): PriceVisibilityMode {
  const mode = typeof val === 'string' ? val : val?.mode;
  return mode === 'all' || mode === 'public' ? 'all' : 'registered_only';
}

export function canUserViewPrices(
  user: UserProfile | null | undefined,
  mode: PriceVisibilityMode
): boolean {
  if (mode === 'all') return true;
  if (!user) return false;
  if (user.role === 'visitante') return false;
  if (user.status === 'inativo') return false;
  return true;
}

export function redactProductPrices(product: any): any {
  if (!product || typeof product !== 'object') return product;

  const redacted = {
    ...product,
    basePrice: 0,
    base_price: 0,
    promoPrice: undefined,
    promo_price: undefined,
    costPrice: undefined,
    cost_price: undefined,
    profitMargin: undefined,
    profit_margin: undefined,
    priceTiers: [],
    price_tiers: [],
  };

  if (Array.isArray(redacted.variants)) {
    redacted.variants = redacted.variants.map((v: any) => ({
      ...v,
      additional_price: 0,
      additionalPrice: 0,
    }));
  }

  if (redacted.rawData && typeof redacted.rawData === 'object') {
    const {
      basePrice: _bp,
      base_price: _bps,
      promoPrice: _pp,
      promo_price: _pps,
      costPrice: _cp,
      cost_price: _cps,
      priceTiers: _pt,
      price_tiers: _pts,
      ScalePrices: _sp,
      YourPrice: _yp,
      Price: _pr,
      ...safeRaw
    } = redacted.rawData;
    redacted.rawData = safeRaw;
  }

  return redacted;
}

export function redactProductsForPriceVisibility(
  productsList: any[],
  canViewPrices: boolean
): any[] {
  if (canViewPrices) return productsList;
  return (productsList || []).map((p) => redactProductPrices(p));
}
