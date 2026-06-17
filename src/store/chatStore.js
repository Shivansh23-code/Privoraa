// Central client state for the chat workspace: conversations, messages, the
// selected model/mode, RAG documents, and transient streaming flags. Persisted
// to localStorage so history survives reloads (the backend becomes the source of
// truth once it's live — this store then hydrates from it).

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEFAULT_MODE } from '../lib/modes';

const uid = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const now = () => new Date().toISOString();

function makeConversation(mode = DEFAULT_MODE) {
  const ts = now();
  return {
    id: uid(),
    title: 'New chat',
    mode,
    pinned: false,
    createdAt: ts,
    updatedAt: ts,
    messages: [],
  };
}

export const useChatStore = create(
  persist(
    (set, get) => ({
      conversations: [],
      currentId: null,
      model: 'auto',
      modelProvider: 'auto', // 'auto' | 'online' | 'offline' — which backend this model runs on
      mode: DEFAULT_MODE,
      documents: [],
      useRag: false, // "Use my notes" composer toggle

      // transient (not persisted)
      isStreaming: false,
      streamingMessageId: null,

      /* ----------------------------- selectors ---------------------------- */
      currentConversation: () =>
        get().conversations.find((c) => c.id === get().currentId) || null,

      /* --------------------------- conversations -------------------------- */
      newConversation: () => {
        const convo = makeConversation(get().mode);
        set((s) => ({
          conversations: [convo, ...s.conversations],
          currentId: convo.id,
        }));
        return convo.id;
      },

      ensureConversation: () => {
        const id = get().currentId;
        if (id && get().conversations.some((c) => c.id === id)) return id;
        return get().newConversation();
      },

      selectConversation: (id) => set({ currentId: id }),

      deleteConversation: (id) =>
        set((s) => {
          const conversations = s.conversations.filter((c) => c.id !== id);
          const currentId =
            s.currentId === id ? conversations[0]?.id ?? null : s.currentId;
          return { conversations, currentId };
        }),

      renameConversation: (id, title) =>
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === id ? { ...c, title: title.trim() || c.title, updatedAt: now() } : c
          ),
        })),

      togglePin: (id) =>
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === id ? { ...c, pinned: !c.pinned, updatedAt: now() } : c
          ),
        })),

      setConversationMode: (id, mode) =>
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === id ? { ...c, mode, updatedAt: now() } : c
          ),
        })),

      /* ------------------------------ messages ---------------------------- */
      addMessage: (conversationId, message) => {
        const id = message.id || uid();
        const full = {
          id,
          role: 'user',
          content: '',
          createdAt: now(),
          ...message,
        };
        set((s) => ({
          conversations: s.conversations.map((c) => {
            if (c.id !== conversationId) return c;
            // Title the conversation from its first user message.
            const isFirstUser =
              full.role === 'user' && !c.messages.some((m) => m.role === 'user');
            return {
              ...c,
              title: isFirstUser ? deriveTitle(full.content) : c.title,
              messages: [...c.messages, full],
              updatedAt: now(),
            };
          }),
        }));
        return id;
      },

      appendToMessage: (conversationId, messageId, delta) =>
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === conversationId
              ? {
                  ...c,
                  messages: c.messages.map((m) =>
                    m.id === messageId ? { ...m, content: m.content + delta } : m
                  ),
                }
              : c
          ),
        })),

      updateMessage: (conversationId, messageId, patch) =>
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === conversationId
              ? {
                  ...c,
                  updatedAt: now(),
                  messages: c.messages.map((m) =>
                    m.id === messageId ? { ...m, ...patch } : m
                  ),
                }
              : c
          ),
        })),

      // Drop an assistant message and everything after it (for "regenerate").
      truncateAfter: (conversationId, messageId) =>
        set((s) => ({
          conversations: s.conversations.map((c) => {
            if (c.id !== conversationId) return c;
            const idx = c.messages.findIndex((m) => m.id === messageId);
            return idx === -1
              ? c
              : { ...c, messages: c.messages.slice(0, idx) };
          }),
        })),

      /* --------------------------- ui selections -------------------------- */
      setModel: (model) => set({ model }),
      // Unified picker: choose a model AND which provider it runs on.
      setModelSelection: (model, modelProvider = 'auto') => set({ model, modelProvider }),
      setMode: (mode) => {
        set({ mode });
        const id = get().currentId;
        if (id) get().setConversationMode(id, mode);
      },

      setStreaming: (isStreaming, streamingMessageId = null) =>
        set({ isStreaming, streamingMessageId }),

      setUseRag: (useRag) => set({ useRag }),

      /* ----------------------------- documents ---------------------------- */
      // Replace the whole list (used to hydrate from the backend on load).
      setDocuments: (documents) => set({ documents }),
      addDocument: (doc) => {
        const id = doc.id || uid();
        set((s) => ({
          documents: [
            { status: 'PROCESSING', chunkCount: 0, createdAt: now(), ...doc, id },
            ...s.documents,
          ],
        }));
        return id;
      },
      updateDocument: (id, patch) =>
        set((s) => ({
          documents: s.documents.map((d) => (d.id === id ? { ...d, ...patch } : d)),
        })),
      removeDocument: (id) =>
        set((s) => ({ documents: s.documents.filter((d) => d.id !== id) })),
    }),
    {
      name: 'privoraa-chat',
      partialize: (s) => ({
        conversations: s.conversations,
        currentId: s.currentId,
        model: s.model,
        modelProvider: s.modelProvider,
        mode: s.mode,
        documents: s.documents,
        useRag: s.useRag,
      }),
    }
  )
);

function deriveTitle(text) {
  const clean = (text || '').replace(/\s+/g, ' ').trim();
  if (!clean) return 'New chat';
  return clean.length > 42 ? clean.slice(0, 42) + '…' : clean;
}
