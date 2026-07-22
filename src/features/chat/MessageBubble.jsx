import React, { memo, useState, useRef, useEffect } from 'react';
import {
  Check,
  Copy,
  RefreshCw,
  Square,
  User as UserIcon,
  AlertTriangle,
  ExternalLink,
  Pencil, X, Save, Share2, Download, ThumbsUp, ThumbsDown,
} from 'lucide-react';
import { Markdown } from './Markdown';
import { canContinueResponse, completionNotice } from './completionState';

function ThinkingDots() {
  return (
    <span className="inline-flex items-center gap-1 py-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-2 w-2 animate-bounce rounded-full bg-brand-400"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </span>
  );
}

function domain(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
}

function Citations({ citations }) {
  if (!citations?.length) return null;
  return (
    <div className="mobile-citations mt-2 flex flex-wrap items-center gap-1 sm:mt-3 sm:gap-1.5">
      <span className="mr-0.5 text-[11px] font-medium tracking-wide text-muted/70 uppercase">Sources</span>
      {citations.map((c) => (
        <a
          key={c.chunk}
          href={c.url || '#'}
          target="_blank"
          rel="noopener noreferrer"
          title={c.snippet || c.doc}
          className="inline-flex items-center gap-1 rounded-full border border-line/70 bg-surface-2/60 px-2.5 py-0.5 text-[11px] text-muted no-underline transition-all duration-150 hover:border-line hover:bg-surface-2 hover:shadow-sm hover:-translate-y-px focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)]"
        >
          <ExternalLink size={10} className="shrink-0 text-faint" />
          <span className="max-w-[140px] truncate">{domain(c.doc || c.url || '')}</span>
          <span className="text-faint">·</span>
          <span className="shrink-0 font-medium text-fg/70">{c.chunk}</span>
        </a>
      ))}
    </div>
  );
}

function downloadText(content, filename) {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/markdown' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function MessageBubble({ message, isStreaming, onCopy, onRegenerate, onContinue, onStop, onEditPrompt }) {
  const [copied, setCopied] = useState(false);
  const [caretFading, setCaretFading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.content || '');
  const [feedback, setFeedback] = useState(null);
  const [actionStatus, setActionStatus] = useState('');
  const prevStreaming = useRef(false);
  const fadeTimer = useRef(null);
  const isUser = message.role === 'user';
  const streaming = isStreaming && message.role === 'assistant';
  const notice = completionNotice(message);

  // Caret fade-out on completion transition.
  useEffect(() => {
    if (prevStreaming.current && !streaming) {
      setCaretFading(true);
      fadeTimer.current = setTimeout(() => setCaretFading(false), 200);
    }
    prevStreaming.current = streaming;
    return () => { if (fadeTimer.current) clearTimeout(fadeTimer.current); };
  }, [streaming]);

  useEffect(() => {
    if (!isUser) return undefined;
    const startEditing = (event) => {
      if (event.detail === message.id) { setDraft(message.content || ''); setEditing(true); }
    };
    window.addEventListener('privoraa:edit-prompt', startEditing);
    return () => window.removeEventListener('privoraa:edit-prompt', startEditing);
  }, [isUser, message.id, message.content]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
      onCopy?.();
    } catch {
      /* ignore */
    }
  };

  // ---- User message: compact right-aligned bubble ----
  if (isUser) {
    return (
      <div className="mobile-user-message group/user flex animate-rise flex-col items-end gap-1">
        <div className="mobile-user-bubble max-w-[88%] rounded-2xl rounded-tr-md bg-[var(--user-message-bg)] px-3 py-2 text-white shadow-sm sm:max-w-[75%] sm:px-5 sm:py-3">
          {(message.images?.length ? message.images : message.image ? [message.image] : []).map((image, index) => (
            <img key={index} src={image} alt={`Attachment ${index + 1}`} className="mb-2 max-h-64 w-auto rounded-lg border border-white/20 object-contain" />
          ))}
          {message.attachments?.filter((item) => item.kind !== 'image').map((item) => (
            <span key={item.id || item.uploadedSourceId} className="mb-2 mr-1 inline-flex rounded-lg border border-white/20 px-2 py-1 text-xs">{item.name}</span>
          ))}
          {editing ? (
            <textarea
              autoFocus value={draft} onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Escape') { setDraft(message.content || ''); setEditing(false); } }}
              aria-label="Edit prompt"
              className="min-h-24 w-[min(70vw,560px)] resize-y rounded-lg bg-black/15 p-2 text-[15px] leading-6 text-white outline-none ring-1 ring-white/30"
            />
          ) : message.content && (
            <p className="whitespace-pre-wrap break-words text-[15px] leading-6 sm:text-base">
              {message.content}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1 text-xs text-muted opacity-100 transition sm:opacity-0 sm:group-hover/user:opacity-100 sm:group-focus-within/user:opacity-100">
          {editing ? <>
            <button aria-label="Save edited prompt" onClick={async () => { try { await onEditPrompt?.(draft); setEditing(false); } catch (error) { setActionStatus(error.message || 'Could not edit this prompt.'); } }} className="flex items-center gap-1 rounded-md px-2 py-1 hover:bg-surface-2"><Save size={12} />Save</button>
            <button aria-label="Cancel editing" onClick={() => { setDraft(message.content || ''); setEditing(false); }} className="flex items-center gap-1 rounded-md px-2 py-1 hover:bg-surface-2"><X size={12} />Cancel</button>
          </> : <>
            <button aria-label="Copy prompt" onClick={copy} className="flex items-center gap-1 rounded-md px-2 py-1 hover:bg-surface-2"><Copy size={12} />{copied ? 'Copied' : 'Copy'}</button>
            <button aria-label="Edit prompt" onClick={() => setEditing(true)} className="flex items-center gap-1 rounded-md px-2 py-1 hover:bg-surface-2"><Pencil size={12} />Edit</button>
          </>}
        </div>
      </div>
    );
  }

  // ---- Assistant message: full-width vertical stack ----
  return (
    <div className="mobile-assistant-message animate-rise w-full min-w-0">
      {message.model && (
        <div className="mobile-assistant-identity mb-1.5 flex items-center gap-1.5 text-xs text-muted">
          <div className="mobile-assistant-badge flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-surface-2 text-[var(--assistant-identity)] ring-1 ring-line">
            <span className="font-display text-[9px] font-bold">V</span>
          </div>
          <span className="truncate font-medium text-fg/80" title={`${message.model}${message.routeReason ? ` · ${message.routeReason}` : ''}`}>Vedix Assistant</span>
          {message.model && (
            <span className="hidden truncate sm:inline text-faint">· {message.model}{message.routeReason ? ` · ${message.routeReason}` : ''}</span>
          )}
        </div>
      )}

      {message.error ? (
        <div className="flex items-start gap-2 text-sm text-red-500">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span>{message.error}</span>
        </div>
      ) : message.pending && !message.content ? (
        <ThinkingDots />
      ) : (
        <div className={`${streaming || caretFading ? 'streaming-caret' : ''} ${caretFading ? 'streaming-caret-fade' : ''}`}>
          <Markdown>{message.content}</Markdown>
        </div>
      )}

      <Citations citations={message.citations} />

      {message.aborted && (
        <p className="mt-2 text-xs italic text-muted">Generation stopped.</p>
      )}
      {notice && (
        <p className="mt-2 text-xs italic text-[var(--accent-primary)]/70">
          {notice}
        </p>
      )}

      {!message.error && (
        <div className="mobile-action-row mt-2 flex min-h-6 items-center gap-0.5 sm:mt-2.5 sm:min-h-7">
          {streaming ? (
            <button
              onClick={onStop}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-[12px] text-muted transition hover:bg-surface-2 hover:text-fg"
            >
              <Square size={12} /> Stop
            </button>
          ) : (
            <>
              <div className="mobile-action-primary contents">
                {canContinueResponse(message) && (
                  <button onClick={onContinue} className="mobile-continue-action flex items-center gap-1 rounded-md px-2 py-1 text-[12px] text-[var(--accent-primary)] transition hover:bg-surface-2">
                    Continue response
                  </button>
                )}
                <button
                  onClick={copy}
                  className="flex items-center gap-1 rounded-md px-2 py-1 text-[12px] text-muted/70 transition hover:bg-surface-2 hover:text-fg"
                >
                  {copied ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
                <button
                  onClick={onRegenerate}
                  className="flex items-center gap-1 rounded-md px-2 py-1 text-[12px] text-muted/70 transition hover:bg-surface-2 hover:text-fg"
                >
                  <RefreshCw size={12} /> Regenerate
                </button>
              </div>
              <div className="mobile-action-secondary contents">
                <button aria-label="Share response" onClick={async () => { try {
                  if (navigator.share) { await navigator.share({ title: 'Vedix response', text: message.content }); setActionStatus('Shared.'); }
                  else { await navigator.clipboard.writeText(message.content); setActionStatus('Sharing is unavailable. Response copied instead.'); }
                } catch { setActionStatus('Could not share this response.'); }
                }} className="mobile-icon-action rounded-md p-1.5 text-muted/70 hover:bg-surface-2 hover:text-fg"><Share2 size={13} /></button>
                <button aria-label="Download response" onClick={() => downloadText(message.content, `vedix-response-${message.id}.md`)} className="mobile-icon-action rounded-md p-1.5 text-muted/70 hover:bg-surface-2 hover:text-fg"><Download size={13} /></button>
                <button aria-label="Like response" aria-pressed={feedback === 'up'} onClick={() => setFeedback(feedback === 'up' ? null : 'up')} className={`mobile-icon-action rounded-md p-1.5 hover:bg-surface-2 ${feedback === 'up' ? 'text-brand-500' : 'text-muted/70'}`}><ThumbsUp size={13} /></button>
                <button aria-label="Dislike response" aria-pressed={feedback === 'down'} onClick={() => setFeedback(feedback === 'down' ? null : 'down')} className={`mobile-icon-action rounded-md p-1.5 hover:bg-surface-2 ${feedback === 'down' ? 'text-brand-500' : 'text-muted/70'}`}><ThumbsDown size={13} /></button>
                {message.completionTokens != null && (
                  <span className="mobile-token-count ml-auto text-[11px] text-faint">
                    {message.completionTokens} tokens
                  </span>
                )}
              </div>
            </>
          )}
        </div>
      )}
      <p className="sr-only" aria-live="polite">{actionStatus}</p>
    </div>
  );
}

export default memo(MessageBubble);
