export const ADMIN_TOKEN_STORAGE_KEY = "admin_token";
export const ADMIN_SESSION_EXPIRED_EVENT = "wmti-admin-session-expired";
export const ADMIN_SESSION_TTL_MS = 8 * 60 * 60 * 1000;
export const ADMIN_SESSION_EXPIRED_MESSAGE = "Sessão admin expirada. Faça login novamente.";

type AdminSessionReason = "expired" | "unauthorized" | "manual";

function getBrowserWindow() {
  return typeof window !== "undefined" ? window : null;
}

export function readAdminToken(): string | null {
  try {
    return sessionStorage.getItem(ADMIN_TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function saveAdminToken(token: string) {
  try {
    sessionStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, token);
  } catch {
    // noop
  }
}

export function removeAdminToken() {
  try {
    sessionStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
  } catch {
    // noop
  }
}

export function parseAdminTokenTimestamp(token: string | null): number | null {
  if (!token) return null;
  const [rawTimestamp] = token.split(".");
  const timestamp = Number(rawTimestamp);
  return Number.isFinite(timestamp) && timestamp > 0 ? timestamp : null;
}

export function isAdminTokenExpired(token: string | null = readAdminToken()): boolean {
  const timestamp = parseAdminTokenTimestamp(token);
  if (!timestamp) return true;
  return Date.now() - timestamp >= ADMIN_SESSION_TTL_MS;
}

export function clearAdminSession(reason: AdminSessionReason = "expired") {
  removeAdminToken();
  getBrowserWindow()?.dispatchEvent(
    new CustomEvent(ADMIN_SESSION_EXPIRED_EVENT, {
      detail: { reason },
    }),
  );
}

export function getValidAdminToken(): string | null {
  const token = readAdminToken();
  if (!token) return null;
  if (isAdminTokenExpired(token)) {
    clearAdminSession("expired");
    return null;
  }
  return token;
}

export function requireAdminToken(): string {
  const token = getValidAdminToken();
  if (!token) {
    throw new Error(ADMIN_SESSION_EXPIRED_MESSAGE);
  }
  return token;
}

export async function adminFunctionFetch(url: string, init: RequestInit = {}) {
  const token = requireAdminToken();
  const headers = new Headers(init.headers || {});
  headers.set("x-admin-token", token);

  const response = await fetch(url, {
    ...init,
    headers,
  });

  if (response.status === 401) {
    clearAdminSession("unauthorized");
    throw new Error(ADMIN_SESSION_EXPIRED_MESSAGE);
  }

  return response;
}
