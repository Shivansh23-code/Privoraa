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

  return (
    <div
      ref={containerRef}
      onScroll={onScroll}
      className="scroll-thin flex-1 overflow-y-auto"
    >
      <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-6">
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
