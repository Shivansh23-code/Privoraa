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
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 xl:max-w-4xl 2xl:max-w-5xl min-[2200px]:max-w-[88rem] min-[3200px]:max-w-[120rem]">
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
