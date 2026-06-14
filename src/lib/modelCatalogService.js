// Calls the local-model catalog endpoints (/api/models/*, /api/llm/health).
// These live OUTSIDE the /api/v1 namespace, so we derive an API_ROOT by stripping
// the trailing /v1 from the configured base. Auth + one silent refresh-on-401 are
// reused from apiClient.

import { API_BASE_URL, getToken, refreshAccessToken } from './apiClient';

const API_ROOT = API_BASE_URL.replace(/\/v1\/?$/, ''); // e.g. http://localhost:8099/api

function headers(extra = {}) {
  const token = getToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

async function jsonFetch(path, opts = {}) {
  const run = () =>
    fetch(`${API_ROOT}${path}`, {
      ...opts,
      headers: headers(opts.headers),
      body: opts.body != null ? JSON.stringify(opts.body) : undefined,
    });

  let res = await run();
  if (res.status === 401) {
    const ok = await refreshAccessToken();
    if (ok) res = await run();
  }
  const text = await res.text();
  const data = text ? safeJson(text) : null;
  if (!res.ok) {
    throw new Error(data?.message || data?.error || `Request failed (${res.status})`);
  }
  return data;
}

function safeJson(t) {
  try {
    return JSON.parse(t);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- read endpoints

/** {provider, ollamaInstalled, running, version} */
export function fetchLlmHealth() {
  return jsonFetch('/llm/health');
}

/** Annotated catalog: {ramBudgetGb, categories:[{key,title,blurb,models:[...]}]} */
export function fetchCatalog() {
  return jsonFetch('/models/catalog');
}

/** Raw Ollama /api/tags response: {models:[{name,size,...}]} */
export function fetchInstalled() {
  return jsonFetch('/models/installed');
}

export function fetchActiveModel() {
  return jsonFetch('/models/active');
}

export function setActiveModel(tag) {
  return jsonFetch('/models/active', { method: 'POST', body: { tag } });
}

export function deleteModel(tag) {
  return jsonFetch(`/models/${encodeURIComponent(tag)}`, { method: 'DELETE' });
}

// ---------------------------------------------------------------- streamed pull

/**
 * Pull a model, invoking onProgress({status, completed, total, percent}) for each
 * SSE progress event. Resolves on the `done` event; rejects on `error`/abort.
 */
export async function pullModel(tag, { onProgress, signal } = {}) {
  const res = await fetch(`${API_ROOT}/models/pull`, {
    method: 'POST',
    headers: headers({ Accept: 'text/event-stream' }),
    body: JSON.stringify({ tag }),
    signal,
  });
  if (!res.ok || !res.body) {
    throw new Error(`Pull failed to start (${res.status})`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let lastError = null;

  // SSE frames are separated by a blank line; each frame has event:/data: lines.
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let sep;
    while ((sep = buffer.indexOf('\n\n')) !== -1) {
      const frame = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      const { event, data } = parseFrame(frame);
      if (!data) continue;
      const payload = safeJson(data) || {};
      if (event === 'progress') {
        onProgress?.(payload);
      } else if (event === 'done') {
        onProgress?.({ status: 'success', percent: 100, completed: 0, total: 0 });
        return payload;
      } else if (event === 'error') {
        lastError = new Error(payload.message || 'Pull failed');
      }
    }
  }
  if (lastError) throw lastError;
  return { tag, percent: 100 };
}

function parseFrame(frame) {
  let event = 'message';
  const dataLines = [];
  for (const line of frame.split('\n')) {
    if (line.startsWith('event:')) event = line.slice(6).trim();
    else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
  }
  return { event, data: dataLines.join('\n') };
}

/** Human-readable byte size. */
export function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}
