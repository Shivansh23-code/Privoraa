import React, { useState } from 'react';
import {
  Check,
  Copy,
  RefreshCw,
  Square,
  User as UserIcon,
  AlertTriangle,
  FileText,
} from 'lucide-react';
import { Markdown } from './Markdown';
import { completionNotice } from './completionState';

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

function Citations({ citations }) {
  if (!citations?.length) return null;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5">
      <span className="mr-1 text-[11px] font-medium text-muted">Sources</span>
      {citations.map((c) => (
        <span
          key={c.chunk}
          title={c.snippet}
          className="inline-flex items-center gap-1 rounded-md border border-line bg-surface-2 px-2 py-0.5 text-[11px] text-muted"
        >
          <FileText size={11} />
          {c.doc} · {c.chunk}
        </span>
      ))}
    </div>
  );
}

export default function MessageBubble({ message, isStreaming, onCopy, onRegenerate, onStop }) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === 'user';
  const streaming = isStreaming && message.role === 'assistant';
  const notice = completionNotice(message);

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
      <div className="flex animate-rise justify-end">
        <div className="max-w-[86%] rounded-2xl rounded-tr-md bg-[var(--user-message-bg)] px-4 py-2.5 text-white shadow-sm sm:max-w-[75%] sm:px-5 sm:py-3">
          {message.image && (
            <img
              src={message.image}
              alt="attachment"
              className="mb-2 max-h-64 w-auto rounded-lg border border-white/20 object-contain"
            />
          )}
          {message.content && (
            <p className="whitespace-pre-wrap break-words text-[15px] leading-6 sm:text-base">
              {message.content}
            </p>
          )}
        </div>
      </div>
    );
  }

  // ---- Assistant message: full-width vertical stack (no avatar column) ----
  return (
    <div className="animate-rise w-full min-w-0">
      {message.model && (
        <div className="mb-1.5 flex items-center gap-1.5 text-xs text-muted">
          <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-surface-2 text-[var(--assistant-identity)] ring-1 ring-line">
            <span className="font-display text-[9px] font-bold">P</span>
          </div>
          <span className="truncate font-medium text-fg/80">{message.model}</span>
          {message.routeReason && (
            <span className="hidden truncate sm:inline">· {message.routeReason}</span>
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
        <div className={streaming ? 'streaming-caret' : ''}>
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
        <div className="mt-2.5 flex min-h-8 items-center gap-1">
          {streaming ? (
            <button
              onClick={onStop}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted transition hover:bg-surface-2 hover:text-fg"
            >
              <Square size={12} /> Stop
            </button>
          ) : (
            <>
              <button
                onClick={copy}
                className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted transition hover:bg-surface-2 hover:text-fg"
              >
                {copied ? <Check size={12} /> : <Copy size={12} />}
                {copied ? 'Copied' : 'Copy'}
              </button>
              <button
                onClick={onRegenerate}
                className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted transition hover:bg-surface-2 hover:text-fg"
              >
                <RefreshCw size={12} /> Regenerate
              </button>
              {message.completionTokens != null && (
                <span className="ml-1 text-[11px] text-faint">
                  {message.completionTokens} tokens
                </span>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
