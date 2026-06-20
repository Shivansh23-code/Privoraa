// Client-side document ingestion for the sealed vault (Phase 2b).
//
// Extract text from a file IN THE BROWSER, chunk it, and index each chunk into
// the encrypted vault vector store — so the document becomes searchable by
// on-device RAG without the file ever leaving the device. PDFs use pdf.js
// (lazy-loaded so the ~1 MB parser stays out of the main bundle); text-like
// files use FileReader directly.

import { indexText } from './vectorStore';

const TEXT_EXT = /\.(txt|md|markdown|csv|tsv|json|jsonl|log|ya?ml|html?|xml|rtf)$/i;

const uid = () =>
  globalThis.crypto?.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

function readAsText(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ''));
    r.onerror = () => reject(r.error || new Error('Could not read file.'));
    r.readAsText(file);
  });
}

let pdfjsP = null;
async function loadPdfjs() {
  if (pdfjsP) return pdfjsP;
  pdfjsP = (async () => {
    const pdfjs = await import('pdfjs-dist');
    const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
    return pdfjs;
  })();
  return pdfjsP;
}

async function extractPdf(file) {
  const pdfjs = await loadPdfjs();
  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjs.getDocument({ data }).promise;
  let text = '';
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    text += content.items.map((it) => it.str).join(' ') + '\n\n';
  }
  return text;
}

const isPdf = (file) => /\.pdf$/i.test(file.name || '') || file.type === 'application/pdf';
const isTextLike = (file) =>
  TEXT_EXT.test(file.name || '') || (file.type || '').startsWith('text/');

export function isSupported(file) {
  return isPdf(file) || isTextLike(file);
}

/** Extract plain text from a supported file (PDF or text-like). */
export async function extractText(file) {
  if (isPdf(file)) return extractPdf(file);
  if (isTextLike(file)) return readAsText(file);
  throw new Error('Unsupported file type — try a PDF or a text/markdown file.');
}

/** Split text into overlapping chunks, dropping trivial fragments. */
export function chunkText(text, size = 1000, overlap = 150) {
  const clean = String(text || '').replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  if (!clean) return [];
  const chunks = [];
  for (let i = 0; i < clean.length; i += size - overlap) {
    chunks.push(clean.slice(i, i + size));
  }
  return chunks.filter((c) => c.trim().length > 20);
}

/**
 * Ingest a file into the encrypted vault: extract → chunk → index. Each chunk is
 * tagged with the source filename for citations. Returns { chunks }.
 */
export async function ingestFile(file, { namespace = 'notes', onProgress } = {}) {
  const text = await extractText(file);
  const chunks = chunkText(text);
  if (!chunks.length) throw new Error('No readable text found in this file.');
  for (let i = 0; i < chunks.length; i++) {
    await indexText(namespace, uid(), chunks[i], { source: file.name });
    onProgress?.(i + 1, chunks.length);
  }
  return { chunks: chunks.length };
}
