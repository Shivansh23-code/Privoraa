import React, { useEffect, useRef, useState, useCallback } from 'react';
import { ChevronDown } from 'lucide-react';
import MessageBubble from './MessageBubble';

export default function MessageThread({
  messages,
  isStreaming,
  streamingMessageId,
  onRegenerate,
  onStop,
}) {
  const endRef = useRef(null);
  const containerRef = useRef(null);
  const pinnedRef = useRef(true);
  const [showScrollButton, setShowScrollButton] = useState(false);

  const onScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    pinnedRef.current = nearBottom;
    setShowScrollButton(!nearBottom && !isStreaming);
  }, [isStreaming]);

  const scrollToBottom = useCallback(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
    pinnedRef.current = true;
    setShowScrollButton(false);
  }, []);

  useEffect(() => {
    if (pinnedRef.current) {
      endRef.current?.scrollIntoView({ behavior: isStreaming ? 'auto' : 'smooth' });
    }
  });

  useEffect(() => {
    const onComposerResize = () => {
      if (pinnedRef.current) endRef.current?.scrollIntoView({ behavior: 'auto' });
    };
    window.addEventListener('privoraa:composer-resize', onComposerResize);
    return () => window.removeEventListener('privoraa:composer-resize', onComposerResize);
  }, []);

  return (
    <div
      ref={containerRef}
      onScroll={onScroll}
      className="scroll-thin flex-1 overflow-y-auto"
      aria-busy={isStreaming}
    >
      <span className="sr-only" aria-live="polite">{isStreaming ? 'Assistant is responding.' : ''}</span>
      <div className="flex w-full max-w-none flex-col gap-4 px-4 pb-[calc(var(--composer-height,9rem)+2rem)] pt-4 sm:mx-auto sm:max-w-[760px] sm:px-6 sm:gap-6 lg:max-w-[860px] lg:px-0">
        {messages.map((m) => (
          <MessageBubble
            key={m.id}
            message={m}
            isStreaming={isStreaming && m.id === streamingMessageId}
            onRegenerate={() => onRegenerate(m.id)}
            onStop={onStop}
          />
        ))}
        {showScrollButton && (
          <div className="flex justify-center">
            <button
              onClick={scrollToBottom}
              className="flex items-center gap-1 rounded-full border border-line/70 bg-surface-2/90 px-3 py-1.5 text-xs text-muted shadow-sm backdrop-blur transition hover:bg-surface-2 hover:text-fg"
              aria-label="Scroll to bottom"
            >
              <ChevronDown size={14} />
              Newer
            </button>
          </div>
        )}
        <div ref={endRef} />
      </div>
    </div>
  );
}
