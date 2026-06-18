// Orchestrates a send: persists the user message, opens a streaming assistant
// message, pipes tokens into the store, and exposes stop / regenerate.

import { useCallback, useRef } from 'react';
import { useChatStore } from '../../store/chatStore';
import { streamChat } from '../../lib/chatService';
import { retrieveContext } from '../../lib/ragService';
import {
  ensureLocalOllama, localHasModel, streamLocalOllamaChat, buildLocalMessages,
} from '../../lib/localOllama';

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
      const callbacks = {
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
            // Only overwrite citations when this path actually carries them (the
            // server path does); don't clobber ones onMeta already set (local path).
            ...(usage.citations != null ? { citations: usage.citations } : {}),
            aborted: usage.aborted || undefined,
          }),
        onError: (err) =>
          store.getState().updateMessage(conversationId, assistantId, {
            pending: false,
            error: err.message || 'Something went wrong.',
          }),
      };

      // Browser-direct local Ollama: if the user picked an offline model and has
      // Ollama running on THIS device with that model, stream straight from the
      // browser to it — uses the model they already downloaded, no cloud hop.
      const wantLocal =
        s.modelProvider === 'offline' && s.model && s.model !== 'auto' && !s.model.includes('/');
      let handledLocally = false;
      if (wantLocal) {
        const local = await ensureLocalOllama();
        if (local && localHasModel(local, s.model)) {
          handledLocally = true;

          // "Chat with my notes" for on-device models: the server can't reach this
          // local Ollama, so fetch the RAG context here and inject it into the
          // local prompt (best-effort — answer without grounding if it fails).
          const wantRag = s.useRag && s.documents.some((d) => d.status === 'READY');
          let ragBlock = null;
          let citations;
          if (wantRag && content) {
            try {
              const r = await retrieveContext(content);
              if (r?.contextBlock) { ragBlock = r.contextBlock; citations = r.citations; }
            } catch { /* notes unavailable — fall back to ungrounded answer */ }
          }

          callbacks.onMeta({
            model: s.model, category: 'general',
            reason: ragBlock ? 'Running on your device · grounded on your notes' : 'Running on your device',
            citations,
          });
          const conv = store.getState().conversations.find((c) => c.id === conversationId);
          const history = (conv?.messages || []).filter((m) => m.id !== assistantId);
          await streamLocalOllamaChat(
            { base: local.base, model: s.model, messages: buildLocalMessages(history, null, ragBlock) },
            callbacks
          );
        }
      }

      if (!handledLocally) {
        await streamChat(
          {
            content,
            model: s.model,
            provider: s.modelProvider,
            mode: convo.mode,
            useRag: s.useRag && s.documents.some((d) => d.status === 'READY'),
            conversationId,
            catalog,
            image,
          },
          callbacks
        );
      }

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
