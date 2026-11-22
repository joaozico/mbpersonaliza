import type { Request, Response, NextFunction } from 'express';
import type { PermissionKey, RolePermissions, UserProfile, UserRole } from '../types.ts';
import {
  SESSION_COOKIE_NAME,
  hashSessionToken,
  parseCookies,
  resolveEffectivePermissions,
  sanitizeUserForClient,
} from '../server/authUtils.ts';
import {
  getAuthSessionWithUserFromDb,
  getPermissionsMatrixFromDb,
} from '../db/repository.ts';

declare global {
  namespace Express {
    interface Request {
      authUser?: UserProfile | null;
      authTokenHash?: string | null;
      effectivePermissions?: RolePermissions;
      permissionsMatrix?: Record<UserRole, RolePermissions>;
    }
  }
}

export function isStaffRole(role?: string | null): boolean {
  return role === 'admin' || role === 'gerente' || role === 'vendedor' || role === 'estoquista';
}

export function extractSessionToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    const bearer = authHeader.slice(7).trim();
    if (bearer) return bearer;
  }
  const cookies = parseCookies(req);
  if (cookies[SESSION_COOKIE_NAME]) {
    return cookies[SESSION_COOKIE_NAME];
  }
  return null;
}

export async function attachSessionUser(req: Request, _res: Response, next: NextFunction) {
  try {
    const matrix = await getPermissionsMatrixFromDb();
    req.permissionsMatrix = matrix;
    req.authUser = null;
    req.authTokenHash = null;
    req.effectivePermissions = resolveEffectivePermissions(null, matrix);

    const rawToken = extractSessionToken(req);
    if (!rawToken) {
      return next();
    }

    const tokenHash = hashSessionToken(rawToken);
    const found = await getAuthSessionWithUserFromDb(tokenHash);
    if (!found || !found.user) {
      return next();
    }

    const sanitized = sanitizeUserForClient(found.user);
    if (sanitized.status === 'inativo' || sanitized.role === 'visitante') {
      return next();
    }

    req.authUser = sanitized;
    req.authTokenHash = tokenHash;
    req.effectivePermissions = resolveEffectivePermissions(sanitized, matrix);
    return next();
  } catch (err) {
    console.warn('[Auth Middleware] Session attach warning:', err);
    return next();
  }
}

export function hasServerPermission(req: Request, permission: PermissionKey): boolean {
  const user = req.authUser;
  if (!user || user.status === 'inativo' || user.role === 'visitante') {
    return false;
  }
  if (user.role === 'admin') {
    return true;
  }
  const perms = req.effectivePermissions;
  return Boolean(perms && perms[permission]);
}

export function requireAuthSession(req: Request, res: Response, next: NextFunction) {
  if (!req.authUser) {
    return res.status(401).json({
      success: false,
      error: 'Acesso negado. Usuário não autenticado.',
      code: 'UNAUTHENTICATED',
    });
  }
  if (req.authUser.status === 'inativo') {
    return res.status(403).json({
      success: false,
      error: 'Acesso negado. Cadastro inativo no sistema.',
      code: 'USER_INACTIVE',
    });
  }
  return next();
}

export function requireStaffSession(req: Request, res: Response, next: NextFunction) {
  if (!req.authUser) {
    return res.status(401).json({
      success: false,
      error: 'Acesso negado. Autenticação administrativa obrigatória.',
      code: 'UNAUTHENTICATED',
    });
  }
  if (!isStaffRole(req.authUser.role)) {
    return res.status(403).json({
      success: false,
      error: 'Acesso negado. Recurso restrito à equipe autorizada.',
      code: 'FORBIDDEN_STAFF_ONLY',
    });
  }
  return next();
}

export function requireAdminSession(req: Request, res: Response, next: NextFunction) {
  if (!req.authUser) {
    return res.status(401).json({
      success: false,
      error: 'Acesso negado. Autenticação de administrador obrigatória.',
      code: 'UNAUTHENTICATED',
    });
  }
  if (req.authUser.role !== 'admin') {
    return res.status(403).json({
      success: false,
      error: 'Acesso negado. Apenas administradores têm permissão para esta operação.',
      code: 'FORBIDDEN_ADMIN_ONLY',
    });
  }
  return next();
}

export function requirePermission(permission: PermissionKey) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.authUser) {
      return res.status(401).json({
        success: false,
        error: 'Acesso negado. Usuário não autenticado.',
        code: 'UNAUTHENTICATED',
      });
    }
    if (req.authUser.status === 'inativo') {
      return res.status(403).json({
        success: false,
        error: 'Acesso negado. Cadastro inativo no sistema.',
        code: 'USER_INACTIVE',
      });
    }
    if (!hasServerPermission(req, permission)) {
      return res.status(403).json({
        success: false,
        error: `Acesso negado. Permissão '${String(permission)}' necessária para esta operação.`,
        code: 'FORBIDDEN',
        requiredPermission: permission,
      });
    }
    return next();
  };
}

export const requireAuth = requireAuthSession;
