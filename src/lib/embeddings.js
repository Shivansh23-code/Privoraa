// Client-side text embeddings for the sealed vault's semantic search.
//
// Phase 1 uses a deterministic, dependency-free hashing embedding: it runs in
// the browser, never touches the network, and is consistent everywhere — so the
// encrypted vector store always searches reliably (no embedding-model/dimension
// drift). It captures lexical overlap; it is not neural-quality.
//
// Phase 3 will add the user's local Ollama (nomic-embed-text) as an opt-in
// higher-quality backend, pinned per namespace with a re-index so vectors never
// mix dimensions. Vectors are computed here and only ever stored encrypted.

const HASH_DIM = 256;

function l2normalize(v) {
  let s = 0;
  for (let i = 0; i < v.length; i++) s += v[i] * v[i];
  const n = Math.sqrt(s) || 1;
  for (let i = 0; i < v.length; i++) v[i] /= n;
  return v;
}

// Tokenize → signed-hash tokens into fixed buckets with tf weighting →
// L2-normalize. Signed hashing cancels some collisions; normalization makes
// cosine a plain dot product.
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

/** Embed text → { vector, model }. Never throws. */
export async function embedText(text) {
  return { vector: hashEmbed(text), model: `hash:${HASH_DIM}` };
}

/** Cosine similarity of two L2-normalized vectors (0 if shapes differ). */
export function cosine(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot;
}
