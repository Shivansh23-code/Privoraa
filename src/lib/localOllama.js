// Talk to the user's OWN Ollama directly from the browser.
//
// In production the cloud backend can't reach a user's localhost:11434 — only
// their browser can. So when Ollama is running on the user's machine, we stream
// chat straight from the browser to it, using the model they've ALREADY
// downloaded (no re-download, no cloud round-trip, fully private).
//
// Browsers allow https -> http://localhost (localhost is a "secure context").
// The user's Ollama must allow this web origin, e.g. start it with:
//   OLLAMA_ORIGINS=https://privoraaai.vercel.app   (or *)

const DEFAULT_BASE = 'http://localhost:11434';

// Concise persona for browser-direct chat (RAG/personas live server-side; this
// path is plain local chat). Mirrors the no-tables, conversational style.
const LOCAL_SYSTEM =
  'You are Privoraa, a helpful, friendly AI assistant running privately on the ' +
  "user's own device. Answer clearly in natural prose with short paragraphs and bullet " +
  'points for lists, steps and comparisons. Do NOT use Markdown tables — ever; even for ' +
  'comparisons, give each item a short heading with bullet points (one bullet per attribute) ' +
  'instead, since tables are unreadable on phones. Use fenced code blocks for code and LaTeX for math.';

let probe = null; // cached detection promise for the session

/** Detect a local Ollama once per session. Returns {base, models[]} or null. */
export function ensureLocalOllama(base = DEFAULT_BASE) {
  if (!probe) probe = detect(base);
  return probe;
}

export function resetLocalOllama() {
  probe = null;
}

async function detect(base) {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 2500);
    const res = await fetch(`${base}/api/tags`, { signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) return null;
    const data = await res.json();
    return { base, models: (data.models || []).map((m) => m.name) };
  } catch {
    return null;
  }
}

const norm = (t) => (t && t.includes(':') ? t : `${t}:latest`);
export function localHasModel(local, tag) {
  if (!local || !tag) return false;
  return local.models.some((m) => m === tag || norm(m) === norm(tag));
}

/** Build the Ollama /api/chat message array from the conversation history.
 *  When ragBlock is provided (the user's retrieved notes), it's grounded into the
 *  system prompt with the same instruction the server uses, so on-device answers
 *  cite the notes instead of ignoring them. When memoryBlock is provided (durable
 *  facts the user asked to be remembered), it's added as soft background — used
 *  when relevant, not recited. Both come from the sealed vault, on-device. */
export function buildLocalMessages(history, content, ragBlock = null, memoryBlock = null) {
  let system = LOCAL_SYSTEM;
  if (memoryBlock && memoryBlock.trim()) {
    system +=
      '\n\nThings you remember about this user (use them when relevant; do not list ' +
      'them back unprompted):\n' + memoryBlock;
  }
  if (ragBlock && ragBlock.trim()) {
    system +=
      '\n\nThe user has provided notes. Answer using ONLY the context below and cite sources ' +
      'inline as [1], [2], etc. If the answer is not in the context, say "I couldn\'t find that ' +
      'in your notes."\n\nContext:\n' + ragBlock;
  }
  const msgs = [{ role: 'system', content: system }];
  for (const m of history) {
    if (!m.content) continue;
    msgs.push({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content });
  }
  if (content) msgs.push({ role: 'user', content });
  return msgs;
}

/** Stream a chat completion straight from the browser to local Ollama (NDJSON). */
export async function streamLocalOllamaChat(
  { base = DEFAULT_BASE, model, messages },
  { onToken, onDone, onError, signal } = {}
) {
  let res;
  try {
    res = await fetch(`${base}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages, stream: true }),
      signal,
    });
  } catch {
    onError?.(new Error('Could not reach your local Ollama. Is it running with this site allowed in OLLAMA_ORIGINS?'));
    return;
  }
  if (!res.ok || !res.body) {
    onError?.(new Error(`Local Ollama error (${res.status}).`));
    return;
  }

  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buffer = '';
  let full = '';
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += dec.decode(value, { stream: true });
      let nl;
      while ((nl = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (!line) continue;
        let obj;
        try { obj = JSON.parse(line); } catch { continue; }
        const delta = obj.message?.content || '';
        if (delta) { full += delta; onToken?.(delta); }
        if (obj.done) { onDone?.({ model, content: full }); return; }
      }
    }
    onDone?.({ model, content: full });
  } catch (e) {
    if (e?.name === 'AbortError') { onDone?.({ model, content: full, aborted: true }); return; }
    onError?.(e instanceof Error ? e : new Error('Local stream failed.'));
  }
}
