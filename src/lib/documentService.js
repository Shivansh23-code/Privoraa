// Document (RAG) transport. Uploads notes to the backend so chat can be grounded
// on them. Multipart upload can't go through apiFetch (which forces JSON), so it
// builds the request directly with the bearer token. Falls back to a local mock
// when the backend is unreachable, mirroring chatService.

import { API_BASE_URL, getToken } from './apiClient';

function authHeader() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** Upload one file. Returns the backend DocumentDto ({ id, filename, status, … }). */
export async function uploadDocument(file) {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${API_BASE_URL}/documents`, {
    method: 'POST',
    headers: authHeader(), // no Content-Type — browser sets the multipart boundary
    body: form,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.message || `Upload failed (${res.status})`);
  }
  return res.json();
}

/** List the user's documents with current processing status. */
export async function fetchDocuments() {
  const res = await fetch(`${API_BASE_URL}/documents`, { headers: authHeader() });
  if (!res.ok) return [];
  return res.json();
}

/** Delete a document (and its chunks) on the backend. */
export async function deleteDocumentRemote(id) {
  await fetch(`${API_BASE_URL}/documents/${id}`, {
    method: 'DELETE',
    headers: authHeader(),
  }).catch(() => {});
}
