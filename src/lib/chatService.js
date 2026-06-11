// Chat transport. Talks to the backend's SSE endpoint when it's reachable,
// and transparently falls back to the local mock engine otherwise — so the UI
// behaves identically today and once the Spring Boot service is live.

import { apiFetch, streamFetch, pingBackend, refreshAccessToken } from './apiClient';
import { mockStreamChat } from './mockEngine';
import { FALLBACK_MODELS } from './models';
import { routeModel } from './router';

let backendAvailable = null; // null = unknown, then cached boolean

/** Probe the backend once and cache the result for the session. */
export async function ensureBackend() {
  if (backendAvailable !== null) return backendAvailable;
  backendAvailable = await pingBackend();
  return backendAvailable;
}

/** Force a re-probe (e.g. after the user starts the backend). */
export function resetBackendProbe() {
  backendAvailable = null;
}

export function isUsingMock() {
  return backendAvailable === false;
}

/** Live model catalog with a static fallback. */
export async function fetchModels() {
  if (await ensureBackend()) {
    try {
      const data = await apiFetch('/models?freeOnly=true');
      if (Array.isArray(data) && data.length) return data;
    } catch {
      /* fall through to static list */
    }
  }
  return FALLBACK_MODELS;
}

/**
 * Stream a chat completion.
 *
 * @param {object} payload
 *   { content, model, mode, useRag, history, conversationId, catalog }
 * @param {object} callbacks
 *   { onMeta(meta), onToken(delta), onDone(usage), onError(err), signal }
 */
export async function streamChat(payload, callbacks) {
  const { content, model, mode, useRag, catalog = [] } = payload;

  // Resolve what "Auto" would pick (used for the meta badge + mock content).
  const routed =
    model === 'auto' || !model
      ? routeModel(content, { mode, useRag }, catalog)
      : null;
  const resolvedId = routed?.modelId || model;
  const resolved = catalog.find((m) => m.id === resolvedId);
  const modelName = resolved?.name || resolved?.shortName || resolvedId;
  const category = routed?.category || resolved?.category || 'general';

  if (await ensureBackend()) {
    try {
      await streamLive(payload, callbacks);
      return;
    } catch (err) {
      if (err?.name === 'AbortError') return;
      // Live transport failed — degrade to mock rather than dead-ending the UI.
      backendAvailable = false;
    }
  }

  await mockStreamChat({ category, modelName, useRag }, callbacks);
}

async function streamLive(payload, { onMeta, onToken, onDone, onError, signal }) {
  const requestBody = {
    conversationId: payload.conversationId,
    model: payload.model,
    mode: payload.mode,
    content: payload.content,
    useRag: payload.useRag,
  };

  let res = await streamFetch('/chat/stream', { body: requestBody, signal });

  // Access token expired — refresh once and retry.
  if (res.status === 401) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      res = await streamFetch('/chat/stream', { body: requestBody, signal });
    }
  }

  if (res.status === 429) {
    const retry = res.headers.get('Retry-After');
    onError?.(
      new Error(
        `Rate limit reached.${retry ? ` Try again in ${retry}s.` : ' Please slow down.'}`
      )
    );
    return;
  }
  if (!res.ok || !res.body) {
    throw new Error(`Stream failed (${res.status})`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // SSE events are separated by a blank line.
    let idx;
    while ((idx = buffer.indexOf('\n\n')) !== -1) {
      const raw = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      dispatchEvent(raw, { onMeta, onToken, onDone, onError });
    }
  }
}

function dispatchEvent(raw, { onMeta, onToken, onDone, onError }) {
  let event = 'message';
  const dataLines = [];

  for (const line of raw.split('\n')) {
    // Skip OpenRouter-style comment / keep-alive lines (": OPENROUTER PROCESSING").
    if (line.startsWith(':') || line.trim() === '') continue;
    if (line.startsWith('event:')) event = line.slice(6).trim();
    else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
  }

  const dataStr = dataLines.join('\n');
  if (dataStr === '[DONE]') return;

  let data = dataStr;
  try {
    data = JSON.parse(dataStr);
  } catch {
    /* keep as string (raw token delta) */
  }

  switch (event) {
    case 'meta':
      onMeta?.(data);
      break;
    case 'token':
      onToken?.(typeof data === 'string' ? data : data.delta ?? data.content ?? '');
      break;
    case 'done':
      onDone?.(typeof data === 'object' ? data : {});
      break;
    case 'error':
      onError?.(new Error(typeof data === 'string' ? data : data.message || 'Stream error'));
      break;
    default:
      // Unnamed events carry token deltas in the OpenAI-compatible shape.
      if (typeof data === 'object' && data?.choices?.[0]?.delta?.content) {
        onToken?.(data.choices[0].delta.content);
      }
  }
}
