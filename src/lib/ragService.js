// Standalone RAG retrieval — used by the browser-direct local-Ollama path so
// on-device models can answer from the user's notes (the server can't reach the
// user's local Ollama to run RAG end-to-end). Returns { contextBlock, citations }.

import { apiFetch } from './apiClient';

export async function retrieveContext(query) {
  if (!query || !query.trim()) return { contextBlock: '', citations: [] };
  return apiFetch('/rag/retrieve', { method: 'POST', body: { query } });
}
