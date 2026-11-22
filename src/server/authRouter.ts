import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import {
  SESSION_TTL_SECONDS,
  clearSessionCookie,
  generateSessionToken,
  hashPassword,
  hashSessionToken,
  onlyDigits,
  resolveEffectivePermissions,
  sanitizeUserForClient,
  setSessionCookie,
  validateCpfCnpj,
  validateEmail,
  verifyPassword,
} from './authUtils.ts';
import {
  createAuthSessionInDb,
  deleteAuthSessionByTokenHashFromDb,
  getPermissionsMatrixFromDb,
  getPriceVisibilityFromDb,
  getUserByCpfCnpjFromDb,
  getUserByEmailFromDb,
  getUserByUidFromDb,
  seedInitialDataIfEmpty,
  updateUserLastLoginInDb,
  upsertUserInDb,
} from '../db/repository.ts';
import { isStaffRole, requireAuthSession } from '../middleware/auth.ts';
import { INITIAL_PERMISSIONS_MATRIX } from '../data/initialData.ts';

export const authRouter = Router();

async function issueSessionResponse(
  req: Request,
  res: Response,
  userRecord: any,
  statusCode = 200,
  extraMessage?: string
) {
  const sanitized = sanitizeUserForClient(userRecord);
  const token = generateSessionToken();
  const tokenHash = hashSessionToken(token);
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000);
  const clientIp = String(req.headers['x-forwarded-for'] || req.ip || '').slice(0, 120);
  const userAgent = String(req.headers['user-agent'] || '').slice(0, 250);

  await createAuthSessionInDb({
    tokenHash,
    userUid: sanitized.id,
    role: sanitized.role,
    expiresAt,
    ip: clientIp,
    userAgent,
  });

  await updateUserLastLoginInDb(sanitized.id);
  setSessionCookie(req, res, token, SESSION_TTL_SECONDS);

  const matrix = await getPermissionsMatrixFromDb();
  const effectivePermissions = resolveEffectivePermissions(sanitized, matrix);
  const priceVisibility = await getPriceVisibilityFromDb();

  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  return res.status(statusCode).json({
    success: true,
    authenticated: true,
    message: extraMessage,
    token,
    user: sanitized,
    permissions: effectivePermissions,
    rolePermissions: matrix,
    priceVisibility,
  });
}

// POST /api/auth/register — Customer Registration with full validation & PostgreSQL persistence
authRouter.post('/register', async (req: Request, res: Response) => {
  try {
    await seedInitialDataIfEmpty();

    const {
      name,
      email,
      phone,
      cpfCnpj,
      company,
      password,
      confirmPassword,
    } = req.body || {};

    const cleanName = String(name || '').trim();
    const cleanEmail = String(email || '').trim().toLowerCase();
    const cleanPhone = String(phone || '').trim();
    const cleanCompany = String(company || '').trim();
    const rawPassword = String(password || '');
    const rawConfirm = confirmPassword !== undefined ? String(confirmPassword) : rawPassword;

    if (!cleanName || cleanName.length < 3) {
      return res.status(400).json({
        success: false,
        error: 'Informe seu nome completo ou razão social (mínimo de 3 caracteres).',
        field: 'name',
      });
    }

    if (!validateEmail(cleanEmail)) {
      return res.status(400).json({
        success: false,
        error: 'Informe um endereço de e-mail válido.',
        field: 'email',
      });
    }

    if (!cleanPhone || onlyDigits(cleanPhone).length < 8) {
      return res.status(400).json({
        success: false,
        error: 'Informe um telefone ou WhatsApp válido para contato.',
        field: 'phone',
      });
    }

    if (!rawPassword || rawPassword.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'A senha deve conter pelo menos 6 caracteres.',
        field: 'password',
      });
    }

    if (rawPassword !== rawConfirm) {
      return res.status(400).json({
        success: false,
        error: 'A confirmação de senha não confere.',
        field: 'confirmPassword',
      });
    }

    const docValidation = validateCpfCnpj(cpfCnpj);
    if (!docValidation.valid) {
      return res.status(400).json({
        success: false,
        error: docValidation.message || 'CPF ou CNPJ inválido.',
        field: 'cpfCnpj',
      });
    }

    // Check duplicate e-mail
    const existingByEmail = await getUserByEmailFromDb(cleanEmail);
    if (existingByEmail) {
      return res.status(409).json({
        success: false,
        code: 'DUPLICATE_EMAIL',
        error: 'Já existe uma conta cadastrada com este e-mail. Utilize a opção ENTRAR.',
        field: 'email',
      });
    }

    // Check duplicate CPF/CNPJ (when supplied)
    if (docValidation.normalized) {
      const existingByDoc = await getUserByCpfCnpjFromDb(docValidation.normalized);
      if (existingByDoc) {
        return res.status(409).json({
          success: false,
          code: 'DUPLICATE_CPF_CNPJ',
          error: 'Já existe um cadastro utilizando este CPF ou CNPJ.',
          field: 'cpfCnpj',
        });
      }
    }

    const newUid = `usr_${crypto.randomBytes(8).toString('hex')}`;
    const formattedDoc =
      docValidation.normalized.length === 11
        ? docValidation.normalized.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
        : docValidation.normalized.length === 14
        ? docValidation.normalized.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
        : String(cpfCnpj || '').trim();

    const createdRows = await upsertUserInDb({
      uid: newUid,
      id: newUid,
      name: cleanName,
      email: cleanEmail,
      phone: cleanPhone,
      company: cleanCompany || cleanName,
      cpfCnpj: formattedDoc,
      role: 'cliente',
      passwordHash: hashPassword(rawPassword),
      isActive: true,
      createdAt: new Date().toISOString(),
    });

    const createdUser = createdRows?.[0] || {
      uid: newUid,
      id: newUid,
      name: cleanName,
      email: cleanEmail,
      phone: cleanPhone,
      company: cleanCompany || cleanName,
      cpfCnpj: formattedDoc,
      role: 'cliente',
      isActive: true,
    };

    return await issueSessionResponse(
      req,
      res,
      createdUser,
      201,
      'Cadastro realizado com sucesso! Bem-vindo à MB Personaliza.'
    );
  } catch (err: any) {
    console.error('[Auth Register] Error:', err);
    return res.status(500).json({
      success: false,
      error: 'Erro interno ao processar cadastro. Tente novamente.',
    });
  }
});

// POST /api/auth/login — Real email + password verification against PostgreSQL hash
authRouter.post('/login', async (req: Request, res: Response) => {
  try {
    await seedInitialDataIfEmpty();

    const { email, password, portal } = req.body || {};
    const cleanEmail = String(email || '').trim().toLowerCase();
    const rawPassword = String(password || '');

    if (!validateEmail(cleanEmail) || !rawPassword) {
      return res.status(400).json({
        success: false,
        error: 'Informe e-mail válido e senha para entrar.',
      });
    }

    const userRecord = await getUserByEmailFromDb(cleanEmail);
    if (!userRecord || userRecord.role === 'visitante') {
      return res.status(401).json({
        success: false,
        error: 'E-mail ou senha inválidos.',
      });
    }

    const isInactive = userRecord.isActive === false || userRecord.status === 'inativo';
    if (isInactive) {
      return res.status(403).json({
        success: false,
        error: 'Este cadastro está inativo. Entre em contato com o suporte da MB Personaliza.',
      });
    }

    const storedHash = userRecord.passwordHash || userRecord.password_hash;
    if (!verifyPassword(rawPassword, storedHash)) {
      return res.status(401).json({
        success: false,
        error: 'E-mail ou senha inválidos.',
      });
    }

    if (portal === 'staff' && !isStaffRole(userRecord.role)) {
      return res.status(403).json({
        success: false,
        error: 'Esta conta é de cliente e não possui acesso ao Portal Interno/Administrativo.',
      });
    }

    return await issueSessionResponse(req, res, userRecord, 200, 'Autenticação realizada com sucesso.');
  } catch (err: any) {
    console.error('[Auth Login] Error:', err);
    return res.status(500).json({
      success: false,
      error: 'Erro interno ao autenticar usuário.',
    });
  }
});

// POST /api/auth/logout — Revokes session in PostgreSQL and clears cookie
authRouter.post('/logout', async (req: Request, res: Response) => {
  try {
    if (req.authTokenHash) {
      await deleteAuthSessionByTokenHashFromDb(req.authTokenHash);
    }
    clearSessionCookie(req, res);
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    return res.json({
      success: true,
      authenticated: false,
      message: 'Sessão encerrada com sucesso.',
    });
  } catch (err: any) {
    clearSessionCookie(req, res);
    return res.json({ success: true, authenticated: false });
  }
});

// GET /api/auth/me — Hydrates current session, permissions and price visibility strictly from server
authRouter.get('/me', async (req: Request, res: Response) => {
  try {
    await seedInitialDataIfEmpty();
    const matrix = req.permissionsMatrix || (await getPermissionsMatrixFromDb());
    const priceVisibility = await getPriceVisibilityFromDb();

    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

    if (!req.authUser) {
      return res.json({
        success: true,
        authenticated: false,
        user: null,
        permissions: resolveEffectivePermissions(null, matrix),
        rolePermissions: {
          visitante: matrix.visitante || INITIAL_PERMISSIONS_MATRIX.visitante,
        },
        priceVisibility,
      });
    }

    return res.json({
      success: true,
      authenticated: true,
      user: req.authUser,
      permissions: req.effectivePermissions || resolveEffectivePermissions(req.authUser, matrix),
      rolePermissions: isStaffRole(req.authUser.role)
        ? matrix
        : { [req.authUser.role]: matrix[req.authUser.role] || INITIAL_PERMISSIONS_MATRIX.cliente },
      priceVisibility,
    });
  } catch (err: any) {
    console.error('[Auth Me] Error:', err);
    return res.status(500).json({
      success: false,
      error: 'Falha ao consultar sessão atual.',
    });
  }
});

// PUT /api/auth/profile — Authenticated user updates only their own allowed profile fields
authRouter.put('/profile', requireAuthSession, async (req: Request, res: Response) => {
  try {
    const authUser = req.authUser!;
    const existing = await getUserByUidFromDb(authUser.id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Usuário não encontrado.' });
    }

    const {
      name,
      phone,
      company,
      cpfCnpj,
      stateRegistration,
      address,
      favoriteProductIds,
      currentPassword,
      newPassword,
    } = req.body || {};

    let nextCpfCnpj = existing.cpfCnpj || '';
    if (cpfCnpj !== undefined) {
      const docCheck = validateCpfCnpj(cpfCnpj);
      if (!docCheck.valid) {
        return res.status(400).json({
          success: false,
          error: docCheck.message || 'CPF/CNPJ inválido.',
        });
      }
      if (docCheck.normalized && docCheck.normalized !== onlyDigits(existing.cpfCnpj)) {
        const dup = await getUserByCpfCnpjFromDb(docCheck.normalized);
        if (dup && (dup.uid || dup.id) !== authUser.id) {
          return res.status(409).json({
            success: false,
            error: 'Já existe outro cadastro utilizando este CPF ou CNPJ.',
          });
        }
      }
      nextCpfCnpj = String(cpfCnpj).trim();
    }

    let nextPasswordHash: string | undefined;
    if (newPassword) {
      if (String(newPassword).length < 6) {
        return res.status(400).json({
          success: false,
          error: 'A nova senha deve conter pelo menos 6 caracteres.',
        });
      }
      const existingHash = existing.passwordHash || existing.password_hash;
      if (!currentPassword || !verifyPassword(String(currentPassword), existingHash)) {
        return res.status(400).json({
          success: false,
          error: 'Senha atual incorreta.',
        });
      }
      nextPasswordHash = hashPassword(String(newPassword));
    }

    const updatedRows = await upsertUserInDb({
      ...existing,
      uid: authUser.id,
      id: authUser.id,
      name: name !== undefined && String(name).trim() ? String(name).trim() : existing.name,
      email: existing.email,
      phone: phone !== undefined ? String(phone).trim() : existing.phone,
      company: company !== undefined ? String(company).trim() : existing.company,
      cpfCnpj: nextCpfCnpj,
      stateRegistration: stateRegistration !== undefined ? String(stateRegistration) : existing.stateRegistration,
      address: address !== undefined ? address : existing.address,
      favoriteProductIds: favoriteProductIds !== undefined ? favoriteProductIds : existing.favoriteProductIds,
      role: existing.role, // Locked: never escalatable via profile update
      customPermissions: existing.customPermissions, // Locked
      isActive: existing.isActive !== false, // Locked
      ...(nextPasswordHash ? { passwordHash: nextPasswordHash } : {}),
    });

    const updated = sanitizeUserForClient(updatedRows?.[0] || existing);
    return res.json({
      success: true,
      user: updated,
      message: 'Perfil atualizado com sucesso.',
    });
  } catch (err: any) {
    console.error('[Auth Profile] Error:', err);
    return res.status(500).json({
      success: false,
      error: 'Erro ao atualizar perfil.',
    });
  }
});
