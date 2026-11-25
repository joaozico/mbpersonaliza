import { PriceVisibilityMode, RolePermissions, UserProfile, UserRole } from '../types';

let memoryToken: string | null = null;

export function getAuthToken(): string | null {
  return memoryToken;
}

export function setAuthToken(token: string | null): void {
  memoryToken = token && token.trim() ? token.trim() : null;
}

export function getAuthHeaders(extra?: HeadersInit): Headers {
  const headers = new Headers(extra || {});
  if (memoryToken && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${memoryToken}`);
  }
  return headers;
}

export async function authFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const headers = getAuthHeaders(init.headers);
  return fetch(input, {
    ...init,
    credentials: 'include',
    headers,
  });
}

export async function safeParseJson<T = any>(res: Response): Promise<T | null> {
  const contentType = (res.headers.get('content-type') || '').toLowerCase();
  const text = await res.text();
  if (!text || !text.trim()) return null;
  const trimmed = text.trim();
  if (
    !contentType.includes('application/json') &&
    !contentType.includes('+json') &&
    (trimmed.startsWith('<!') || trimmed.startsWith('<html'))
  ) {
    return null;
  }
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    return null;
  }
}

export interface AuthSessionResponse {
  success: boolean;
  authenticated?: boolean;
  message?: string;
  error?: string;
  code?: string;
  field?: string;
  token?: string;
  user?: UserProfile | null;
  permissions?: Partial<RolePermissions>;
  rolePermissions?: Partial<Record<UserRole, RolePermissions>>;
  priceVisibility?: PriceVisibilityMode;
}

export async function bootstrapSession(): Promise<AuthSessionResponse> {
  try {
    const res = await authFetch('/api/auth/me', {
      method: 'GET',
      cache: 'no-store',
    });
    const data = await safeParseJson<AuthSessionResponse>(res);
    if (!data) {
      memoryToken = null;
      return { success: false, authenticated: false, user: null };
    }
    if (!data.authenticated || !data.user) {
      memoryToken = null;
    }
    return data;
  } catch (err: any) {
    return {
      success: false,
      authenticated: false,
      user: null,
      error: err?.message || 'Erro ao verificar sessão atual.',
    };
  }
}

export async function loginWithCredentials(payload: {
  email: string;
  password: string;
  portal?: 'customer' | 'staff';
}): Promise<AuthSessionResponse> {
  const res = await authFetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = (await safeParseJson<AuthSessionResponse>(res)) || {
    success: false,
    error: 'Resposta inválida do servidor ao autenticar.',
  };
  if (res.ok && data.success && data.token) {
    setAuthToken(data.token);
  }
  return data;
}

export async function registerCustomer(payload: {
  name: string;
  email: string;
  phone: string;
  cpfCnpj?: string;
  company?: string;
  password: string;
  confirmPassword: string;
}): Promise<AuthSessionResponse> {
  const res = await authFetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = (await safeParseJson<AuthSessionResponse>(res)) || {
    success: false,
    error: 'Resposta inválida do servidor ao cadastrar.',
  };
  if (res.ok && data.success && data.token) {
    setAuthToken(data.token);
  }
  return data;
}

export async function logoutSession(): Promise<{ success: boolean }> {
  try {
    await authFetch('/api/auth/logout', {
      method: 'POST',
    });
  } catch {
    // Ignore network failures during logout
  } finally {
    setAuthToken(null);
  }
  return { success: true };
}

export async function updateMyProfile(payload: {
  name?: string;
  phone?: string;
  company?: string;
  cpfCnpj?: string;
  stateRegistration?: string;
  address?: UserProfile['address'];
  favoriteProductIds?: string[];
  currentPassword?: string;
  newPassword?: string;
}): Promise<{ success: boolean; user?: UserProfile; error?: string; message?: string }> {
  const res = await authFetch('/api/auth/profile', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return (await safeParseJson(res)) || { success: false, error: 'Resposta inválida do servidor.' };
}

export async function fetchPriceVisibility(): Promise<{
  success: boolean;
  mode?: PriceVisibilityMode;
  priceVisibility?: PriceVisibilityMode;
}> {
  const res = await authFetch('/api/system/price-visibility', {
    method: 'GET',
    cache: 'no-store',
  });
  return (await safeParseJson(res)) || { success: false };
}

export async function savePriceVisibility(mode: PriceVisibilityMode): Promise<{
  success: boolean;
  mode?: PriceVisibilityMode;
  priceVisibility?: PriceVisibilityMode;
  message?: string;
  error?: string;
}> {
  const res = await authFetch('/api/system/price-visibility', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode }),
  });
  return (await safeParseJson(res)) || { success: false, error: 'Resposta inválida do servidor.' };
}
