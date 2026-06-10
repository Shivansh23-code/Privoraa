// Thin fetch wrapper around the Spring Boot backend.
// Base URL comes from VITE_API_BASE_URL; the auth token from localStorage
// (set by UserAuthContext). Every protected call sends `Authorization: Bearer`.

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api/v1';

export function getToken() {
  return localStorage.getItem('userToken');
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

/** JSON request helper. Throws ApiError on non-2xx. */
export async function apiFetch(path, { method = 'GET', body, headers, signal } = {}) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: authHeaders({
      'Content-Type': 'application/json',
      ...headers,
    }),
    body: body != null ? JSON.stringify(body) : undefined,
    signal,
  });

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
