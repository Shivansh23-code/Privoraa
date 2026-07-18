import React, { useEffect, useRef } from 'react';
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
  const pinnedRef = useRef(true); // is the user scrolled to the bottom?

  // Track whether we should auto-follow the stream.
  const onScroll = () => {
    const el = containerRef.current;
    if (!el) return;
    pinnedRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  };

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
      <div className="mx-auto flex w-full max-w-[900px] flex-col gap-5 px-4 pb-[calc(var(--composer-height,9rem)+2rem)] pt-6 sm:gap-6 sm:px-6 lg:px-8">
        {messages.map((m) => (
          <MessageBubble
            key={m.id}
            message={m}
            isStreaming={isStreaming && m.id === streamingMessageId}
            onRegenerate={() => onRegenerate(m.id)}
            onStop={onStop}
          />
        ))}
        <div ref={endRef} />
      </div>
    </div>
  );
}
