// Client-side text embeddings for the sealed vault's semantic search.
//
// Two backends, chosen by a persisted mode:
//   'hash'  (default) — deterministic, dependency-free hashing embedding. Runs
//           anywhere, instantly, offline; captures lexical overlap (not neural).
//   'local' (Phase 3) — the user's local Ollama (nomic-embed-text): real neural
//           embeddings, fully on-device, much better semantic recall.
//
// Either way vectors are computed in the browser and only ever stored encrypted.
// Switching modes requires a re-index (vectorStore.reindexAll) because different
// models produce different dimensions; mixing them would break cosine.

import { ensureLocalOllama, localHasModel } from './localOllama';

const HASH_DIM = 256;
const MODE_KEY = 'privoraa-embed-mode';
const LOCAL_EMBED_MODEL = 'nomic-embed-text';

export function getEmbedMode() {
  try {
    return localStorage.getItem(MODE_KEY) === 'local' ? 'local' : 'hash';
  } catch {
    return 'hash';
  }
}
export function setEmbedMode(mode) {
  try {
    localStorage.setItem(MODE_KEY, mode === 'local' ? 'local' : 'hash');
  } catch {
    /* ignore */
  }
}

function l2normalize(v) {
  let s = 0;
  for (let i = 0; i < v.length; i++) s += v[i] * v[i];
  const n = Math.sqrt(s) || 1;
  for (let i = 0; i < v.length; i++) v[i] /= n;
  return v;
}

// Tokenize → signed-hash tokens into fixed buckets with tf weighting →
// L2-normalize. Signed hashing cancels some collisions.
function hashEmbed(text) {
  const v = new Array(HASH_DIM).fill(0);
  const toks = String(text).toLowerCase().match(/[a-z0-9]+/g) || [];
  for (const tok of toks) {
    let h = 2166136261; // FNV-1a
    for (let i = 0; i < tok.length; i++) {
      h ^= tok.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    const bucket = (h >>> 0) % HASH_DIM;
    v[bucket] += h & 1 ? 1 : -1;
  }
  return l2normalize(v);
}

function pickEmbedModel(local) {
  if (localHasModel(local, LOCAL_EMBED_MODEL)) return LOCAL_EMBED_MODEL;
  return local.models.find((m) => /embed/i.test(m)) || null;
}

async function ollamaEmbed(text) {
  const local = await ensureLocalOllama();
  if (!local) throw new Error('Local Ollama is not reachable — start it or switch to Fast embeddings.');
  const model = pickEmbedModel(local);
  if (!model) throw new Error('No embedding model installed. Run: ollama pull nomic-embed-text');
  const res = await fetch(`${local.base}/api/embed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, input: text }),
  });
  if (!res.ok) throw new Error(`Local embedding failed (HTTP ${res.status}).`);
  const data = await res.json();
  const vec = data.embeddings?.[0] || data.embedding;
  if (!Array.isArray(vec) || !vec.length) throw new Error('Local model returned no embedding.');
  return { vector: l2normalize(vec.slice()), model: `ollama:${model}` };
}

/**
 * Embed text → { vector, model }. In 'local' mode this hits Ollama and THROWS if
 * it's unavailable (callers fall back / surface a clear message) rather than
 * silently producing a mismatched hash vector that would corrupt the store.
 */
export async function embedText(text) {
  if (getEmbedMode() === 'local') return ollamaEmbed(text);
  return { vector: hashEmbed(text), model: `hash:${HASH_DIM}` };
}

/** Is local neural embedding usable right now? (Ollama up + an embed model pulled) */
export async function localEmbedAvailable() {
  try {
    const local = await ensureLocalOllama();
    return !!(local && pickEmbedModel(local));
  } catch {
    return false;
  }
}

/** Cosine similarity of two L2-normalized vectors (0 if shapes differ). */
export function cosine(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot;
}
