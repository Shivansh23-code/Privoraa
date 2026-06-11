// Thin fetch wrapper around the Spring Boot backend.
// Base URL comes from VITE_API_BASE_URL; the access token from localStorage.
// Every protected call sends `Authorization: Bearer`, and a 401 triggers one
// silent refresh + retry before giving up.

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:8099/api/v1';

const ACCESS_KEY = 'userToken';
const REFRESH_KEY = 'userRefreshToken';
const USER_KEY = 'userData';

export function getToken() {
  return localStorage.getItem(ACCESS_KEY);
}

export function getRefreshToken() {
  return localStorage.getItem(REFRESH_KEY);
}

export function setTokens({ accessToken, refreshToken } = {}) {
  if (accessToken) localStorage.setItem(ACCESS_KEY, accessToken);
  if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken);
}

export function setStoredUser(user) {
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearAuth() {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(USER_KEY);
}

export class ApiError extends Error {
  constructor(message, status, body) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

function authHeaders(extra = {}) {
  const token = getToken();
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

function rawFetch(path, { method = 'GET', body, headers, signal } = {}) {
  return fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: authHeaders({ 'Content-Type': 'application/json', ...headers }),
    body: body != null ? JSON.stringify(body) : undefined,
    signal,
  });
}

// Dedupe concurrent refreshes: many calls failing at once share one refresh.
let refreshPromise = null;

/** Exchange the refresh token for a fresh access token. Returns true on success. */
export async function refreshAccessToken() {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) return false;
      const data = await res.json().catch(() => null);
      if (data?.accessToken) {
        localStorage.setItem(ACCESS_KEY, data.accessToken);
        return true;
      }
      return false;
    } catch {
      return false;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

/** JSON request helper. Throws ApiError on non-2xx; refreshes once on 401. */
export async function apiFetch(path, opts = {}) {
  let res = await rawFetch(path, opts);

  if (res.status === 401 && !path.startsWith('/auth/')) {
    const refreshed = await refreshAccessToken();
    if (refreshed) res = await rawFetch(path, opts);
  }

  const text = await res.text();
  const data = text ? safeJson(text) : null;

  if (!res.ok) {
    const message = data?.message || data?.error || `Request failed (${res.status})`;
    throw new ApiError(message, res.status, data);
  }
  return data;
}

/** Open a raw streaming POST (used by the SSE chat endpoint). */
export function streamFetch(path, { body, signal } = {}) {
  return fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: authHeaders({
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    }),
    body: body != null ? JSON.stringify(body) : undefined,
    signal,
  });
}

function safeJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** Has the backend been configured / is it reachable? Used to pick mock vs live. */
export async function pingBackend(signal) {
  try {
    const base = API_BASE_URL.replace(/\/api\/v1\/?$/, '');
    const res = await fetch(`${base}/actuator/health`, { signal });
    return res.ok;
  } catch {
    return false;
  }
}
