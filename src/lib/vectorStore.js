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

/**
 * Build a RAG context block from the encrypted vault notes for a query, in the
 * same { contextBlock, citations } shape the server returns — so the on-device
 * chat path can ground on sealed notes without anything leaving the device.
 */
export async function retrieveVaultContext(query, k = 4) {
  const hits = await search('notes', query, k);
  if (!hits.length) return { contextBlock: '', citations: [] };
  const contextBlock = hits.map((h, i) => `[${i + 1}] ${h.text}`).join('\n\n');
  const citations = hits.map((h, i) => ({
    chunk: i + 1,
    doc: h.meta?.source || 'Sealed note',
    snippet: h.text.length > 160 ? h.text.slice(0, 160) + '…' : h.text,
  }));
  return { contextBlock, citations };
}

/**
 * Recall the most relevant durable "memories" for a query, as a plain bullet
 * block (soft background context, not strict RAG). Returns '' if none.
 */
export async function retrieveMemory(query, k = 4) {
  const hits = await search('memory', query, k);
  return hits.map((h) => `- ${h.text}`).join('\n');
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
