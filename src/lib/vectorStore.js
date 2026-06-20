// Encrypted semantic vector store for the sealed vault.
//
// Each item carries its text + an L2-normalized embedding, stored AES-GCM
// encrypted via secureStore. Search embeds the query in the browser, then ranks
// by cosine over the decrypted vectors — retrieval never leaves the device and
// the server never sees the vectors. A linear scan is fine for a personal vault;
// it's the privacy cost of a truly sealed store (no server-side ANN index).
//
// This is the shared retrieval layer for Phase 1 (searchable encrypted notes)
// and Phase 3 (on-device RAG) — built once.

import { putItem, listCollection, removeItem, countCollection } from './secureStore';
import { embedText, cosine } from './embeddings';

const col = (ns) => `vec:${ns}`;

/** Embed + store text under (namespace, id). Returns { id, model }. */
export async function indexText(namespace, id, text, meta = {}) {
  const { vector, model } = await embedText(text);
  await putItem(col(namespace), id, { text, vector, model, meta });
  return { id, model };
}

/** All items in a namespace, newest first — embeddings stripped for display. */
export async function listTexts(namespace) {
  const items = await listCollection(col(namespace));
  return items.map(({ id, updatedAt, value }) => ({
    id,
    updatedAt,
    text: value.text,
    model: value.model,
    meta: value.meta,
  }));
}

export async function removeVector(id) {
  await removeItem(id);
}

export async function countVectors(namespace) {
  return countCollection(col(namespace));
}

/** Semantic search: embed query, cosine-rank decrypted vectors, return top-k
 *  [{ id, text, meta, model, score }]. */
export async function search(namespace, query, k = 5) {
  if (!query || !query.trim()) return [];
  const [{ vector: qv }, items] = await Promise.all([
    embedText(query),
    listCollection(col(namespace)),
  ]);
  return items
    .map((it) => ({
      id: it.id,
      text: it.value.text,
      meta: it.value.meta,
      model: it.value.model,
      score: cosine(qv, it.value.vector),
    }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}
