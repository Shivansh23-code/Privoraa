import React, { useState } from 'react';
import {
  Bot,
  Check,
  Copy,
  RefreshCw,
  Square,
  User as UserIcon,
  AlertTriangle,
  FileText,
} from 'lucide-react';
import { Markdown } from './Markdown';

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
    <div className="mt-3 flex flex-wrap gap-1.5">
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
    <div className={`group flex animate-rise gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      {/* Avatar */}
      <div
        className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
          isUser
            ? 'bg-brand-600 text-white'
            : 'bg-gradient-to-br from-brand-500 to-accent-500 text-white'
        }`}
      >
        {isUser ? <UserIcon size={16} /> : <Bot size={16} />}
      </div>

      <div className={`min-w-0 max-w-[min(720px,85%)] ${isUser ? 'items-end' : ''}`}>
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
          className={`rounded-2xl px-4 py-3 ${
            isUser
              ? 'rounded-tr-sm bg-brand-600 text-white'
              : 'rounded-tl-sm border border-line bg-surface'
          }`}
        >
          {message.error ? (
            <div className="flex items-start gap-2 text-sm text-red-500">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <span>{message.error}</span>
            </div>
          ) : isUser ? (
            <p className="whitespace-pre-wrap break-words text-[0.95rem] leading-relaxed">
              {message.content}
            </p>
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
        </div>

        {/* Actions */}
        {!isUser && !message.error && (
          <div className="mt-1.5 flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
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
    </div>
  );
}
