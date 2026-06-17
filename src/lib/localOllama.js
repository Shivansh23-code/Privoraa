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
  "user's own device. Answer clearly in natural prose with bullet points for lists. " +
  'Do not format answers as tables unless the data is genuinely tabular. Use fenced ' +
  'code blocks for code and LaTeX for math.';

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

/** Build the Ollama /api/chat message array from the conversation history. */
export function buildLocalMessages(history, content) {
  const msgs = [{ role: 'system', content: LOCAL_SYSTEM }];
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
