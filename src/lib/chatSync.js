import { apiFetch, ApiError } from './apiClient';
import { getToken } from './apiClient';

export function isAuthenticated() {
  return !!getToken();
}

function requireAuth() {
  if (!isAuthenticated()) return { success: false, error: 'Not authenticated' };
  return null;
}

function ok(data) {
  return { success: true, data, error: null };
}

function fail(error) {
  return { success: false, data: null, error: error || 'Unknown sync error' };
}

export async function fetchRemoteConversations() {
  const unauth = requireAuth();
  if (unauth) return unauth;
  try {
    const data = await apiFetch('/conversations');
    return Array.isArray(data) ? ok(data) : ok([]);
  } catch (err) {
    return fail(err instanceof Error ? err.message : 'Failed to fetch conversations');
  }
}

export async function fetchRemoteConversationDetail(id) {
  const unauth = requireAuth();
  if (unauth) return unauth;
  try {
    const data = await apiFetch(`/conversations/${id}`);
    return data ? ok(data) : fail('Conversation not found');
  } catch (err) {
    return fail(err instanceof Error ? err.message : 'Failed to fetch conversation detail');
  }
}

export async function createRemoteConversation(id, title, mode) {
  const unauth = requireAuth();
  if (unauth) return unauth;
  try {
    const data = await apiFetch('/conversations', {
      method: 'POST',
      body: { id, title, mode },
    });
    return data ? ok(data) : fail('Failed to create conversation on server');
  } catch (err) {
    return fail(err instanceof Error ? err.message : 'Failed to create conversation');
  }
}

export async function updateRemoteConversation(id, patch) {
  const unauth = requireAuth();
  if (unauth) return unauth;
  try {
    await apiFetch(`/conversations/${id}`, {
      method: 'PATCH',
      body: patch,
    });
    return ok(null);
  } catch (err) {
    return fail(err instanceof Error ? err.message : 'Failed to update conversation');
  }
}

export async function deleteRemoteConversation(id) {
  const unauth = requireAuth();
  if (unauth) return unauth;
  try {
    await apiFetch(`/conversations/${id}`, { method: 'DELETE' });
    return ok(null);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to delete conversation';
    const status = err instanceof ApiError ? err.status : undefined;
    return { success: false, data: null, error: message, ...(status !== undefined ? { status } : {}) };
  }
}

export async function truncateRemoteConversation(id, messageId) {
  const unauth = requireAuth();
  if (unauth) return unauth;
  try {
    await apiFetch(`/conversations/${id}/messages/${messageId}/from`, { method: 'DELETE' });
    return ok(null);
  } catch (err) {
    return fail(err instanceof Error ? err.message : 'Failed to edit conversation history');
  }
}

export function subscribeAuth(callback) {
  let authed = isAuthenticated();
  const check = () => {
    const now = isAuthenticated();
    if (now !== authed) {
      authed = now;
      callback(authed);
    }
  };
  window.addEventListener('storage', check);
  const poll = setInterval(check, 2000);
  return () => {
    window.removeEventListener('storage', check);
    clearInterval(poll);
  };
}
