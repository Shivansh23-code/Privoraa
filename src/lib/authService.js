// Auth transport. Talks to the backend's /auth endpoints when reachable, and
// falls back to a local mock user when it isn't — so the app stays demoable
// without a backend, and "just works" once the backend is live.
//
// Real auth failures (wrong password, email taken) are surfaced as thrown
// errors; only an unreachable backend triggers the mock path.

import { apiFetch, setTokens, setStoredUser, clearAuth } from './apiClient';
import { ensureBackend } from './chatService';

function normalizeUser(u) {
  if (!u) return null;
  return {
    id: u.id,
    email: u.email,
    name: u.displayName || u.email?.split('@')[0] || 'User',
    displayName: u.displayName,
    role: u.role || 'USER',
  };
}

function mockUser(email, name) {
  return normalizeUser({
    id: 'demo',
    email,
    displayName: name || email?.split('@')[0],
    role: 'USER',
  });
}

function persist(user) {
  setStoredUser(user);
  return user;
}

export async function login(email, password) {
  if (await ensureBackend()) {
    const data = await apiFetch('/auth/login', {
      method: 'POST',
      body: { email, password },
    });
    setTokens(data);
    return persist(normalizeUser(data.user));
  }
  // Backend unreachable — demo mode.
  setTokens({ accessToken: 'demo-token', refreshToken: 'demo-refresh' });
  return persist(mockUser(email));
}

export async function register(name, email, password) {
  if (await ensureBackend()) {
    const data = await apiFetch('/auth/register', {
      method: 'POST',
      body: { email, password, displayName: name },
    });
    setTokens(data);
    return persist(normalizeUser(data.user));
  }
  setTokens({ accessToken: 'demo-token', refreshToken: 'demo-refresh' });
  return persist(mockUser(email, name));
}

/** Validate the stored session against the backend. Returns the user or null. */
export async function fetchMe() {
  if (!(await ensureBackend())) return null;
  try {
    const data = await apiFetch('/auth/me');
    return persist(normalizeUser(data));
  } catch (err) {
    // 401 means the stored token is invalid/expired (e.g. signed with an older
    // secret) — clear the stale session so the app falls back to logged-out.
    if (err?.status === 401) clearAuth();
    return null;
  }
}

export function logout() {
  clearAuth();
}
