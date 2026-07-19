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
    <div className="mt-4 flex flex-wrap items-center gap-1.5">
      <span className="mr-1 text-[11px] font-medium text-muted">Grounded in sources</span>
      {citations.map((c) => (
        <span
          key={c.chunk}
          title={c.snippet}
          className="inline-flex items-center gap-1 rounded-md border border-line bg-surface-2 px-2 py-0.5 text-[11px] text-muted"
        >
          <FileText size={11} />
          {c.doc} · chunk {c.chunk}
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

  return (
    <article className={`group flex animate-rise gap-2 sm:gap-4 ${isUser ? 'flex-row-reverse' : ''}`}>
      {/* Avatar — slightly smaller on mobile to free width for prose */}
      <div
        className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl sm:h-8 sm:w-8 ${
          isUser
            ? 'bg-[var(--user-message-avatar)] text-white'
            : 'bg-surface-2 text-[var(--assistant-identity)] ring-1 ring-line'
        }`}
      >
        {isUser ? <UserIcon size={13} /> : <span className="font-display text-xs font-bold sm:text-sm">P</span>}
      </div>

      {/* Assistant answers fill the available column width (better for long
          markdown / code on wide screens); user messages stay compact. */}
      <div className={`flex min-w-0 flex-col ${isUser ? 'max-w-[min(640px,85%)] items-end' : 'flex-1'}`}>
        {/* Model badge */}
        {!isUser && message.model && (
          <div className="mb-1 flex items-center gap-1.5 text-xs text-muted">
            <span className="font-medium text-fg/80">Answered with {message.model}</span>
            {message.routeReason && (
              <span className="hidden sm:inline">· {message.routeReason}</span>
            )}
          </div>
        )}

        {/* Bubble */}
        <div
          className={`px-4 py-3 ${
            isUser
              ? 'rounded-2xl rounded-tr-md bg-[var(--user-message-bg)] text-white shadow-sm'
              : 'w-full px-0 py-1'
          }`}
        >
          {message.error ? (
            <div className="flex items-start gap-2 text-sm text-red-500">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <span>{message.error}</span>
            </div>
          ) : isUser ? (
            <>
              {message.image && (
                <img
                  src={message.image}
                  alt="attachment"
                  className="mb-2 max-h-64 w-auto rounded-lg border border-white/20 object-contain"
                />
              )}
              {message.content && (
                <p className="whitespace-pre-wrap break-words text-sm leading-6 sm:text-[15px]">
                  {message.content}
                </p>
              )}
            </>
          ) : message.pending && !message.content ? (
            <ThinkingDots />
          ) : (
            <div className={streaming ? 'streaming-caret' : ''}>
              <Markdown>{message.content}</Markdown>
            </div>
          )}

          {!isUser && <Citations citations={message.citations} />}

          {message.aborted && (
            <p className="mt-2 text-xs italic text-muted">Generation stopped.</p>
          )}
          {notice && (
            <p className="mt-2 text-xs italic text-amber-600 dark:text-amber-400">
              {notice}
            </p>
          )}
        </div>

        {/* Actions */}
        {!isUser && !message.error && (
          <div className="mt-2 flex min-h-8 items-center gap-1 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
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
                {(message.completionTokens != null) && (
                  <span className="ml-1 text-[11px] text-faint">
                    {message.completionTokens} tokens
                  </span>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
