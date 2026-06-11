// Orchestrates a send: persists the user message, opens a streaming assistant
// message, pipes tokens into the store, and exposes stop / regenerate.

import { useCallback, useRef } from 'react';
import { useChatStore } from '../../store/chatStore';
import { streamChat } from '../../lib/chatService';

export function useChat(catalog) {
  const abortRef = useRef(null);

  const store = useChatStore;

  const run = useCallback(
    async (conversationId, content, { isRegenerate = false, image = null } = {}) => {
      const s = store.getState();
      const convo = s.conversations.find((c) => c.id === conversationId);
      if (!convo) return;

      if (!isRegenerate) {
        s.addMessage(conversationId, { role: 'user', content, image: image || undefined });
      }

      const assistantId = s.addMessage(conversationId, {
        role: 'assistant',
        content: '',
        model: s.model,
        pending: true,
      });
      s.setStreaming(true, assistantId);

      const controller = new AbortController();
      abortRef.current = controller;

      let firstToken = true;
      await streamChat(
        {
          content,
          model: s.model,
          mode: convo.mode,
          useRag: s.useRag && s.documents.some((d) => d.status === 'READY'),
          conversationId,
          catalog,
          image,
        },
        {
          signal: controller.signal,
          onMeta: (meta) =>
            store.getState().updateMessage(conversationId, assistantId, {
              model: meta.model,
              category: meta.category,
              routeReason: meta.reason,
              citations: meta.citations,
            }),
          onToken: (delta) => {
            if (firstToken) {
              firstToken = false;
              store.getState().updateMessage(conversationId, assistantId, { pending: false });
            }
            store.getState().appendToMessage(conversationId, assistantId, delta);
          },
          onDone: (usage) =>
            store.getState().updateMessage(conversationId, assistantId, {
              pending: false,
              promptTokens: usage.promptTokens,
              completionTokens: usage.completionTokens,
              citations: usage.citations ?? undefined,
              aborted: usage.aborted || undefined,
            }),
          onError: (err) =>
            store.getState().updateMessage(conversationId, assistantId, {
              pending: false,
              error: err.message || 'Something went wrong.',
            }),
        }
      );

      store.getState().setStreaming(false, null);
      abortRef.current = null;
    },
    [catalog, store]
  );

  const send = useCallback(
    (content, image = null) => {
      const text = content.trim();
      if (!text && !image) return; // allow image-only sends
      const s = store.getState();
      const conversationId = s.ensureConversation();
      run(conversationId, text, { image });
    },
    [run, store]
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const regenerate = useCallback(
    (conversationId, assistantMessageId) => {
      const s = store.getState();
      const convo = s.conversations.find((c) => c.id === conversationId);
      if (!convo) return;
      const idx = convo.messages.findIndex((m) => m.id === assistantMessageId);
      // Find the user prompt that produced this assistant message.
      const prompt = [...convo.messages.slice(0, idx)].reverse().find((m) => m.role === 'user');
      if (!prompt) return;
      s.truncateAfter(conversationId, assistantMessageId);
      run(conversationId, prompt.content, { isRegenerate: true });
    },
    [run, store]
  );

  return { send, stop, regenerate };
}
