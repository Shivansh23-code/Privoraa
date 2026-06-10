import React, { useEffect, useRef, useState } from 'react';
import { ArrowUp, BookOpenCheck, Paperclip, Square } from 'lucide-react';
import { useChatStore } from '../../store/chatStore';

export default function Composer({ onSend, onStop, isStreaming, onAttach, mode }) {
  const useRag = useChatStore((s) => s.useRag);
  const setUseRag = useChatStore((s) => s.setUseRag);
  const hasReadyDocs = useChatStore((s) => s.documents.some((d) => d.status === 'READY'));
  const [value, setValue] = useState('');
  const taRef = useRef(null);

  // Auto-grow the textarea up to a cap.
  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 200) + 'px';
  }, [value]);

  const submit = () => {
    const text = value.trim();
    if (!text || isStreaming) return;
    onSend(text);
    setValue('');
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="border-t border-line bg-bg/80 px-4 py-3 backdrop-blur">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-end gap-2 rounded-2xl border border-line bg-surface p-2 shadow-sm transition focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-500/15">
          <button
            type="button"
            onClick={onAttach}
            title="Attach a document (RAG)"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-muted transition hover:bg-surface-2 hover:text-fg"
          >
            <Paperclip size={18} />
          </button>

          <button
            type="button"
            onClick={() => setUseRag(!useRag)}
            disabled={!hasReadyDocs}
            title={
              hasReadyDocs
                ? useRag
                  ? 'Answers grounded on your notes — click to disable'
                  : 'Ground answers on your uploaded notes'
                : 'Upload a document first to use your notes'
            }
            className={`flex h-9 shrink-0 items-center gap-1.5 rounded-xl px-2.5 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${
              useRag && hasReadyDocs
                ? 'bg-brand-500/15 text-brand-600 dark:text-brand-300'
                : 'text-muted hover:bg-surface-2 hover:text-fg'
            }`}
          >
            <BookOpenCheck size={16} />
            <span className="hidden sm:inline">My notes</span>
          </button>

          <textarea
            ref={taRef}
            rows={1}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Ask anything…  (Enter to send, Shift+Enter for newline)"
            className="scroll-thin max-h-[200px] flex-1 resize-none bg-transparent py-1.5 text-[0.95rem] leading-relaxed text-fg placeholder:text-faint focus:outline-none"
          />

          {isStreaming ? (
            <button
              type="button"
              onClick={onStop}
              title="Stop generating"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-fg transition hover:bg-line"
            >
              <Square size={16} className="fill-current" />
            </button>
          ) : (
            <button
              type="button"
              onClick={submit}
              disabled={!value.trim()}
              title="Send"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ArrowUp size={18} />
            </button>
          )}
        </div>
        <p className="mt-1.5 px-1 text-center text-[11px] text-faint">
          Privoraa can make mistakes. Verify important info. · Mode: <span className="capitalize">{mode.replace('_', ' ')}</span>
        </p>
      </div>
    </div>
  );
}
