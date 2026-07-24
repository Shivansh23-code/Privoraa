// Orchestrates a send: persists the user message, opens a streaming assistant
// message, pipes tokens into the store, and exposes stop / regenerate.

import { useCallback, useRef } from 'react';
import { useChatStore } from '../../store/chatStore';
import { streamChat } from '../../lib/chatService';
import { retrieveContext } from '../../lib/ragService';
import { retrieveVaultContext, retrieveMemory } from '../../lib/vectorStore';
import { isUnlocked } from '../../lib/vaultBridge';
import { finalContentPatch } from './finalContent';
import { hasPersistedAssistantIdentity } from './completionState';
import { assistantRunPlan, manualContinuationOptions } from './continuationMode';
import { truncateRemoteConversation } from '../../lib/chatSync';
import { abortControllers } from '../../lib/streamRegistry';
import {
  ensureLocalOllama, localHasModel, streamLocalOllamaChat, buildLocalMessages,
} from '../../lib/localOllama';

export function useChat(catalog) {
  const abortRefMap = useRef({});
  const streamRunsRef = useRef({});
  const store = useChatStore;

  const run = useCallback(
    async (conversationId, content, {
      isRegenerate = false, isContinuation = false, targetAssistantMessageId = null,
      existingContent = '', image = null, images = null, attachments = [], modelOverride, providerOverride,
    } = {}) => {
      const s = store.getState();
      s.clearGenerationError(conversationId);
      const requestModel = modelOverride || s.model;
      const requestProvider = providerOverride || s.modelProvider;
      const convo = s.conversations.find((c) => c.id === conversationId);
      if (!convo) return;
      if (s.deletingConversationIds?.[conversationId]) return;

      const runPlan = assistantRunPlan({ isRegenerate, isContinuation, targetAssistantMessageId });
      let userMessageId;
      if (runPlan.addUserMessage) {
        userMessageId = s.addMessage(conversationId, {
          role: 'user', content, image: image || images?.[0] || undefined,
          images: images?.length ? images : undefined, attachments,
          selectedModel: requestModel, selectedProvider: requestProvider,
        });
      } else if (!isContinuation) {
        const current = store.getState().conversations.find((item) => item.id === conversationId);
        userMessageId = [...(current?.messages || [])].reverse().find((item) => item.role === 'user')?.id;
      }

      const assistantId = isContinuation ? runPlan.assistantId : s.addMessage(conversationId, {
        role: 'assistant', content: '', model: requestModel, pending: true,
      });
      if (isContinuation) {
        if (!assistantId || !convo.messages.some((message) => message.id === assistantId && message.role === 'assistant')) return;
        s.updateMessage(conversationId, assistantId, { pending: true, error: undefined });
      }
      const requestId = globalThis.crypto?.randomUUID?.()
        || `chat-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const runKey = `${conversationId}:${assistantId}:${requestId}`;
      streamRunsRef.current[runKey] = {
        conversationId, assistantId, requestId,
        baseContent: isContinuation ? existingContent : '',
        runContent: '',
      };
      s.setConversationStreaming(conversationId, assistantId, requestId);

      // A new request for this conversation supersedes any in-flight one for the same conversation.
      abortRefMap.current[conversationId]?.abort();

      const controller = new AbortController();
      abortRefMap.current[conversationId] = controller;
      abortControllers[conversationId] = controller;

      // Finalize the assistant bubble exactly once (clears the pending/"thinking"
      // state). Without this, an aborted stream left the bubble stuck looking like
      // it was still responding.
      let firstToken = true;
      let finalized = false;
      const isActive = () => {
        const state = store.getState();
        const active = state.streamingConversations[conversationId];
        return streamRunsRef.current[runKey]
          && active?.streamingMessageId === assistantId
          && active?.requestId === requestId
          && state.conversations.some((c) => c.id === conversationId);
      };
      const finalize = (patch) => {
        if (finalized) return undefined;
        if (!isActive()) return undefined;
        finalized = true;
        return store.getState().updateMessage(conversationId, assistantId, {
          pending: false,
          ...patch,
        });
      };

      const callbacks = {
        signal: controller.signal,
        onMeta: (meta) => {
          if (!isActive()) return;
          store.getState().updateMessage(conversationId, assistantId, {
            model: meta.model,
            category: meta.category,
            routeReason: meta.reason,
            citations: meta.citations,
            ...(meta.provider ? { selectedProvider: meta.provider } : {}),
          });
        },
        onToken: (delta) => {
          if (finalized) return;
          if (!isActive() || !delta) return;
          if (firstToken) {
            firstToken = false;
            store.getState().updateMessage(conversationId, assistantId, { pending: false });
          }
          store.getState().appendToMessage(conversationId, assistantId, delta);
          streamRunsRef.current[runKey].runContent += delta;
        },
        onDone: (usage) => {
          const { baseContent = '', runContent = '' } = streamRunsRef.current[runKey] || {};
          finalize({
            ...finalContentPatch(usage, streamRunsRef.current[runKey]?.content || ''),
            persisted: true,
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
            totalSegments: usage.totalSegments,
            tokenCountEstimated: usage.tokenCountEstimated,
          }),
        onError: (err) => {
          if (finalized) return;
          if (!isActive()) return;
          const messageContent = streamRunsRef.current[runKey]?.content || '';
          const hasContent = isContinuation
            ? messageContent.length > (existingContent || '').length
            : messageContent.length > 0;
          finalized = true;
          if (!hasContent) {
            const s = store.getState();
            s.removeMessage(conversationId, assistantId);
            if (err?.name !== 'AbortError') {
              s.setGenerationError(conversationId, {
                message: err?.message || 'Something went wrong.',
                model: requestModel,
                requestId,
                retryPayload: {
                  content,
                  model: requestModel,
                  provider: requestProvider,
                  image,
                  images,
                  attachments,
                  userMessageId,
                },
              });
            }
            return;
          }
          finalize({ error: err?.message || 'Something went wrong.' });
        },
      };

      // Browser-direct local Ollama: if the user picked an offline model and has
      // Ollama running on THIS device with that model, stream straight from the
      // browser to it — uses the model they already downloaded, no cloud hop.
      const wantLocal =
        requestProvider === 'offline' && requestModel && requestModel !== 'auto' && !requestModel.includes('/');
      let handledLocally = false;
      try {
        if (wantLocal) {
          const local = await ensureLocalOllama();
          if (local && localHasModel(local, requestModel)) {
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

            callbacks.onMeta({ model: requestModel, category: 'general', reason, citations });
            const conv = store.getState().conversations.find((c) => c.id === conversationId);
            const history = (conv?.messages || []).filter((m) => m.id !== assistantId);
            await streamLocalOllamaChat(
              {
                base: local.base,
                model: requestModel,
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
              model: requestModel,
              provider: requestProvider,
              mode: convo.mode,
              useRag: s.useRag && s.documents.some((d) => d.status === 'READY'),
              conversationId,
              catalog,
              image,
              images,
              userMessageId,
              attachments,
              requestId,
              isContinuation,
              targetAssistantMessageId: isContinuation ? assistantId : undefined,
              existingContent: isContinuation ? existingContent : undefined,
            },
            callbacks
          );
        }
      } catch (err) {
        if (err?.name === 'AbortError') return;
        if (finalized) return;
        const isCurrent = () => {
          const state = store.getState();
          const active = state.streamingConversations[conversationId];
          return streamRunsRef.current[runKey]
            && active?.streamingMessageId === assistantId
            && active?.requestId === requestId;
        };
        if (!isCurrent()) return;
        const messageContent = streamRunsRef.current[runKey]?.content || '';
        const hasContent = isContinuation
          ? messageContent.length > (existingContent || '').length
          : messageContent.length > 0;
        finalized = true;
        if (!hasContent) {
          const s = store.getState();
          s.removeMessage(conversationId, assistantId);
          s.setGenerationError(conversationId, {
            message: err?.message || 'Something went wrong.',
            model: requestModel,
            requestId,
            retryPayload: {
              content,
              model: requestModel,
              provider: requestProvider,
              image,
              images,
              attachments,
              userMessageId,
            },
          });
        } else {
          finalize({ error: err?.message || 'Something went wrong.' });
        }
      } finally {
        // Stop ends the stream without an onDone — finalize so the bubble doesn't
        // stay stuck "responding". finalize() is idempotent.
        if (controller.signal.aborted) finalize({ aborted: true });
        // Only clear the per-conversation streaming/abort state if THIS run is still the
        // active one for this conversation; a newer request may have already taken over.
        if (abortRefMap.current[conversationId] === controller) {
          if (abortControllers[conversationId] === controller) {
            delete abortControllers[conversationId];
          }
          store.getState().clearConversationStreaming(conversationId);
          delete abortRefMap.current[conversationId];
        }
        delete streamRunsRef.current[runKey];
      }
    },
    [catalog, store]
  );

  const send = useCallback(
    (content, image = null, images = null, attachments = []) => {
      const text = content.trim();
      if (!text && !image) return; // allow image-only sends
      const s = store.getState();
      const conversationId = s.ensureConversation();
      run(conversationId, text, { image, images, attachments });
    },
    [run, store]
  );

  const stop = useCallback((conversationId) => {
    if (conversationId) {
      abortRefMap.current[conversationId]?.abort();
    } else {
      // Legacy: stop all
      Object.values(abortRefMap.current).forEach((c) => c?.abort());
    }
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
      run(conversationId, prompt.content, {
        isRegenerate: true, image: prompt.image || null, images: prompt.images || null,
        attachments: prompt.attachments || [],
        modelOverride: prompt.selectedModel || prompt.model, providerOverride: prompt.selectedProvider,
      });
    },
    [run, store]
  );

  const editPrompt = useCallback(async (conversationId, messageId, content) => {
    const s = store.getState();
    const convo = s.conversations.find((c) => c.id === conversationId);
    const message = convo?.messages.find((m) => m.id === messageId && m.role === 'user');
    const text = content.trim();
    if (!message || (!text && !message.image && !message.images?.length && !message.attachments?.length)) return;
    abortRefMap.current[conversationId]?.abort();
    const remote = await truncateRemoteConversation(conversationId, messageId);
    if (!remote.success && remote.error !== 'Not authenticated') throw new Error(remote.error);
    s.truncateFrom(conversationId, messageId);
    run(conversationId, text, {
      image: message.image || null,
      images: message.images || null,
      attachments: message.attachments || [],
      modelOverride: message.selectedModel || message.model,
      providerOverride: message.selectedProvider,
    });
  }, [run, store]);

  const continueResponse = useCallback((conversationId, assistantMessageId) => {
    const convo = store.getState().conversations.find((item) => item.id === conversationId);
    const message = convo?.messages.find((item) => item.id === assistantMessageId && item.role === 'assistant');
    if (!message || !hasPersistedAssistantIdentity(message)) return;
    run(conversationId,
      'Continue exactly from where the previous response stopped. Do not restart, repeat, introduce, or summarize. Complete the unfinished sentence or structure and finish the original answer.',
      manualContinuationOptions(message));
  }, [run, store]);

  const retryGeneration = useCallback((conversationId) => {
    const s = store.getState();
    const error = s.generationErrors?.[conversationId];
    if (!error) return;
    const currentStreaming = s.streamingConversations?.[conversationId];
    if (currentStreaming && error.requestId !== currentStreaming.requestId) return;
    s.clearGenerationError(conversationId);
    const p = error.retryPayload;
    run(conversationId, p.content, {
      isRegenerate: true,
      image: p.image || null,
      images: p.images || null,
      attachments: p.attachments || [],
      modelOverride: p.model,
      providerOverride: p.provider,
    });
  }, [run, store]);

  return { send, stop, regenerate, editPrompt, continueResponse, retryGeneration };
}
