// Orchestrates a send: persists the user message, opens a streaming assistant
// message, pipes tokens into the store, and exposes stop / regenerate.

import { useCallback, useRef } from 'react';
import { useChatStore } from '../../store/chatStore';
import { streamChat } from '../../lib/chatService';
import { retrieveContext } from '../../lib/ragService';
import { retrieveVaultContext, retrieveMemory } from '../../lib/vectorStore';
import { isUnlocked } from '../../lib/vaultBridge';
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

      // A new request supersedes any in-flight one: abort it first so we never run
      // two live streams (e.g. the user hits Stop then sends again immediately).
      abortRef.current?.abort();

      const controller = new AbortController();
      abortRef.current = controller;

      // Finalize the assistant bubble exactly once (clears the pending/"thinking"
      // state). Without this, an aborted stream left the bubble stuck looking like
      // it was still responding.
      let firstToken = true;
      let finalized = false;
      const finalize = (patch) =>
        finalized
          ? undefined
          : ((finalized = true),
            store.getState().updateMessage(conversationId, assistantId, { pending: false, ...patch }));

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
          finalize({
            promptTokens: usage.promptTokens,
            completionTokens: usage.completionTokens,
            // Only overwrite citations when this path actually carries them (the
            // server path does); don't clobber ones onMeta already set (local path).
            ...(usage.citations != null ? { citations: usage.citations } : {}),
            aborted: usage.aborted || undefined,
            finishReason: usage.finishReason,
            completionStatus: usage.completionStatus,
            segments: usage.segments,
            continued: usage.continued,
            tokenCountEstimated: usage.tokenCountEstimated,
          }),
        onError: (err) => finalize({ error: err.message || 'Something went wrong.' }),
      };

      // Browser-direct local Ollama: if the user picked an offline model and has
      // Ollama running on THIS device with that model, stream straight from the
      // browser to it — uses the model they already downloaded, no cloud hop.
      const wantLocal =
        s.modelProvider === 'offline' && s.model && s.model !== 'auto' && !s.model.includes('/');
      let handledLocally = false;
      try {
        if (wantLocal) {
          const local = await ensureLocalOllama();
          if (local && localHasModel(local, s.model)) {
            handledLocally = true;

            // "Chat with my notes" for on-device models. Prefer the SEALED VAULT
            // notes — searched and decrypted entirely in this browser, so the notes
            // never leave the device (the whole point of the vault). Fall back to
            // server-side documents only when the vault is locked or empty. Either
            // way it's best-effort: answer ungrounded if retrieval fails.
            let ragBlock = null;
            let citations;
            let sealed = false;
            if (s.useRag && content) {
              if (isUnlocked()) {
                try {
                  const r = await retrieveVaultContext(content);
                  if (r.contextBlock) { ragBlock = r.contextBlock; citations = r.citations; sealed = true; }
                } catch { /* vault unreadable — try server docs next */ }
              }
              if (!ragBlock && s.documents.some((d) => d.status === 'READY')) {
                try {
                  const r = await retrieveContext(content);
                  if (r?.contextBlock) { ragBlock = r.contextBlock; citations = r.citations; }
                } catch { /* notes unavailable — fall back to ungrounded answer */ }
              }
            }

            // Sealed memory: auto-recall durable facts about the user whenever the
            // vault is unlocked (not gated on "use my notes") — on-device only.
            let memoryBlock = null;
            if (isUnlocked() && content) {
              try {
                const m = await retrieveMemory(content);
                if (m) memoryBlock = m;
              } catch { /* memory unavailable — continue without it */ }
            }

            let reason = 'Running on your device';
            if (memoryBlock && ragBlock) reason += ' · using your memory + notes';
            else if (memoryBlock) reason += ' · using your memory';
            else if (ragBlock) reason += sealed ? ' · grounded on your sealed notes' : ' · grounded on your notes';

            callbacks.onMeta({ model: s.model, category: 'general', reason, citations });
            const conv = store.getState().conversations.find((c) => c.id === conversationId);
            const history = (conv?.messages || []).filter((m) => m.id !== assistantId);
            await streamLocalOllamaChat(
              {
                base: local.base,
                model: s.model,
                messages: buildLocalMessages(history, null, ragBlock, memoryBlock),
              },
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
      } catch (err) {
        // Any transport throw not already routed through onError still finalizes
        // the bubble (an AbortError is handled by the finally below).
        if (err?.name !== 'AbortError') finalize({ error: err?.message || 'Something went wrong.' });
      } finally {
        // Stop ends the stream without an onDone — finalize so the bubble doesn't
        // stay stuck "responding". finalize() is idempotent.
        if (controller.signal.aborted) finalize({ aborted: true });
        // Only clear the shared streaming/abort state if THIS run is still the
        // active one; a newer request may have already taken over.
        if (abortRef.current === controller) {
          store.getState().setStreaming(false, null);
          abortRef.current = null;
        }
      }
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
