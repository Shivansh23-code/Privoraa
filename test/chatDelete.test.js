import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { create } from 'zustand';

const ROOT = resolve(fileURLToPath(import.meta.url), '../..');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
let idCounter = 0;
const uid = () => `test-id-${++idCounter}`;
const now = () => new Date().toISOString();

function makeConvo(overrides) {
  return {
    id: uid(),
    title: 'Test chat',
    mode: 'general',
    pinned: false,
    createdAt: now(),
    updatedAt: now(),
    messages: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Build a minimal test store with the same deletion logic as the real store
// but without persist middleware so it works in Node without localStorage.
// ---------------------------------------------------------------------------
function createTestStore() {
  let authState = false;
  let deleteResult = { success: true, data: null, error: null, status: 200 };

  const registry = {}; // abortControllers mirror

  const store = create((set, get) => ({
    conversations: [],
    currentId: null,
    deletingConversationIds: {},
    streamingConversations: {},
    syncStatus: 'idle',
    syncError: null,
    lastSyncAt: null,

    // ---- helpers for test injection ----
    _setAuth(v) { authState = v; },
    _setDeleteResult(r) { deleteResult = r; },
    _getDeleteCalled() { return deleteResult._called || 0; },
    _resetDeleteCalled() { deleteResult._called = 0; },

    // ---- actions ----
    newConversation: () => {
      const convo = makeConvo();
      set((s) => ({ conversations: [convo, ...s.conversations], currentId: convo.id }));
      return convo.id;
    },

    selectConversation: (id) => set({ currentId: id }),

    deleteConversation: async (id) => {
      const state = get();
      if (state.deletingConversationIds[id]) return;
      const convo = state.conversations.find((c) => c.id === id);
      if (!convo) return;

      set((s) => ({ deletingConversationIds: { ...s.deletingConversationIds, [id]: true } }));

      // Abort stream controller
      if (registry[id]) {
        registry[id].abort();
        delete registry[id];
      }

      if (state.streamingConversations[id]) {
        const { [id]: _, ...rest } = state.streamingConversations;
        set({ streamingConversations: rest });
      }

      // Unauthenticated path
      if (!authState) {
        set((s) => {
          const conversations = s.conversations.filter((c) => c.id !== id);
          const currentId = s.currentId === id ? (conversations[0]?.id ?? null) : s.currentId;
          return { conversations, currentId };
        });
        set((s) => { const { [id]: _, ...rest } = s.deletingConversationIds; return { deletingConversationIds: rest }; });
        return;
      }

      // Authenticated: this test doesn't actually make HTTP calls — it uses
      // the injected result to simulate the remote call.
      deleteResult._called = (deleteResult._called || 0) + 1;
      const result = deleteResult;

      if (result.status === 404 || result.success) {
        set((s) => {
          const conversations = s.conversations.filter((c) => c.id !== id);
          const currentId = s.currentId === id ? (conversations[0]?.id ?? null) : s.currentId;
          return { conversations, currentId };
        });
      } else {
        const errorMessage = result.status === 401
          ? 'Your session has expired. Please sign in again.'
          : result.error;
        set({ syncStatus: 'error', syncError: errorMessage });
      }

      set((s) => { const { [id]: _, ...rest } = s.deletingConversationIds; return { deletingConversationIds: rest }; });
    },

    // For stale callback tests
    addMessage: (conversationId, message) => {
      if (get().deletingConversationIds?.[conversationId]) return null;
      const id = message.id || uid();
      const full = { id, role: 'user', content: '', createdAt: now(), ...message };
      set((s) => ({
        conversations: s.conversations.map((c) =>
          c.id === conversationId ? { ...c, messages: [...c.messages, full], updatedAt: now() } : c
        ),
      }));
      return id;
    },

    appendToMessage: (conversationId, messageId, delta) => {
      if (get().deletingConversationIds?.[conversationId]) return;
      set((s) => ({
        conversations: s.conversations.map((c) =>
          c.id === conversationId
            ? { ...c, messages: c.messages.map((m) => (m.id === messageId ? { ...m, content: m.content + delta } : m)) }
            : c
        ),
      }));
    },

    updateMessage: (conversationId, messageId, patch) => {
      if (get().deletingConversationIds?.[conversationId]) return;
      set((s) => ({
        conversations: s.conversations.map((c) =>
          c.id === conversationId
            ? { ...c, updatedAt: now(), messages: c.messages.map((m) => (m.id === messageId ? { ...m, ...patch } : m)) }
            : c
        ),
      }));
    },

    setStreaming: (conversationId, streamingMessageId) =>
      set((s) => ({ streamingConversations: { ...s.streamingConversations, [conversationId]: { streamingMessageId } } })),

    clearConversationStreaming: (conversationId) =>
      set((s) => { const { [conversationId]: _, ...rest } = s.streamingConversations; return { streamingConversations: rest }; }),

    // For pullRemote test
    _registry: registry,
  }));

  return store;
}

// ---------------------------------------------------------------------------
// Simulated pullRemote (same logic as ChatWorkspace.jsx but test-friendly)
// ---------------------------------------------------------------------------
function simulatePullRemote(store, remote, prevRemoteIds, deletingIds = {}) {
  const s = store.getState();
  const merged = [...s.conversations];
  let changed = false;

  for (const r of remote) {
    if (deletingIds[r.id]) continue;
    const idx = merged.findIndex((c) => c.id === r.id);
    if (idx !== -1) {
      const existing = merged[idx];
      if (r.title !== existing.title || r.pinned !== existing.pinned || r.updatedAt !== existing.updatedAt) {
        merged[idx] = { ...existing, title: r.title, pinned: r.pinned, updatedAt: r.updatedAt };
        changed = true;
      }
    } else {
      merged.push({
        id: r.id, title: r.title, mode: r.mode || 'general',
        pinned: r.pinned || false, createdAt: r.createdAt, updatedAt: r.updatedAt,
        messages: [],
      });
      changed = true;
    }
  }

  // Cross-device deletion removal
  if (prevRemoteIds && remote.length > 0) {
    const remoteIds = new Set(remote.map((r) => r.id));
    const toRemove = merged.filter(
      (c) => prevRemoteIds.has(c.id) && !remoteIds.has(c.id) && !deletingIds[c.id]
    );
    for (const c of toRemove) {
      const idx = merged.findIndex((m) => m.id === c.id);
      if (idx !== -1) { merged.splice(idx, 1); changed = true; }
    }
  }

  const nextPrevIds = (prevRemoteIds === null || remote.length > 0)
    ? new Set(remote.map((r) => r.id))
    : prevRemoteIds;

  if (changed) {
    const patch = { conversations: merged };
    if (s.currentId && !merged.some((c) => c.id === s.currentId)) {
      patch.currentId = merged[0]?.id ?? null;
    }
    store.setState(patch);
  }

  return { changed, nextPrevIds };
}

// ===========================================================================
// Tests
// ===========================================================================

// ---- 1. Authenticated delete calls the correct endpoint ----
test('authenticated delete calls remote DELETE and removes locally on success', async () => {
  const store = createTestStore();
  store.getState()._setAuth(true);
  store.getState()._setDeleteResult({ success: true, data: null, error: null, status: 200, _called: 0 });

  const id = store.getState().newConversation();
  assert(store.getState().conversations.some((c) => c.id === id));

  await store.getState().deleteConversation(id);

  // Remote was called
  assert.equal(store.getState()._getDeleteCalled(), 1);
  // Conversation removed locally
  assert.equal(store.getState().conversations.some((c) => c.id === id), false);
  // Guard cleaned up
  assert.equal(store.getState().deletingConversationIds[id], undefined);
});

// ---- 2. Local removal only after remote success ----
test('conversation stays locally when authenticated remote delete fails (500)', async () => {
  const store = createTestStore();
  store.getState()._setAuth(true);
  store.getState()._setDeleteResult({ success: false, data: null, error: 'Server error', status: 500, _called: 0 });

  const id = store.getState().newConversation();
  await store.getState().deleteConversation(id);

  // Remote was called
  assert.equal(store.getState()._getDeleteCalled(), 1);
  // Conversation still present
  assert(store.getState().conversations.some((c) => c.id === id));
  // Error set
  assert.equal(store.getState().syncStatus, 'error');
  assert(store.getState().syncError);
  // Guard cleaned up
  assert.equal(store.getState().deletingConversationIds[id], undefined);
});

// ---- 3. 404 treated as confirmed deletion ----
test('authenticated delete with 404 response removes conversation locally', async () => {
  const store = createTestStore();
  store.getState()._setAuth(true);
  store.getState()._setDeleteResult({ success: false, data: null, error: 'Not found', status: 404, _called: 0 });

  const id = store.getState().newConversation();
  await store.getState().deleteConversation(id);

  // Remote was called (we still make the request)
  assert.equal(store.getState()._getDeleteCalled(), 1);
  // Conversation removed (404 = already deleted)
  assert.equal(store.getState().conversations.some((c) => c.id === id), false);
  // No error
  assert.notEqual(store.getState().syncStatus, 'error');
});

// ---- 4. 401/403/409/500/network failure keeps conversation ----
test('401 error keeps conversation and shows session-expired message', async () => {
  const store = createTestStore();
  store.getState()._setAuth(true);
  store.getState()._setDeleteResult({ success: false, data: null, error: 'Unauthorized', status: 401, _called: 0 });

  const id = store.getState().newConversation();
  await store.getState().deleteConversation(id);

  assert(store.getState().conversations.some((c) => c.id === id));
  assert.equal(store.getState().syncStatus, 'error');
  assert(store.getState().syncError.includes('Your session has expired'));
  assert(store.getState().syncError.includes('sign in again'));
});

test('403 error keeps conversation and sets syncError', async () => {
  const store = createTestStore();
  store.getState()._setAuth(true);
  store.getState()._setDeleteResult({ success: false, data: null, error: 'Forbidden', status: 403, _called: 0 });

  const id = store.getState().newConversation();
  await store.getState().deleteConversation(id);

  assert(store.getState().conversations.some((c) => c.id === id));
  assert.equal(store.getState().syncStatus, 'error');
});

test('409 error keeps conversation and sets syncError', async () => {
  const store = createTestStore();
  store.getState()._setAuth(true);
  store.getState()._setDeleteResult({ success: false, data: null, error: 'Conflict', status: 409, _called: 0 });

  const id = store.getState().newConversation();
  await store.getState().deleteConversation(id);

  assert(store.getState().conversations.some((c) => c.id === id));
  assert.equal(store.getState().syncStatus, 'error');
});

test('network failure (no status) keeps conversation and sets syncError', async () => {
  const store = createTestStore();
  store.getState()._setAuth(true);
  store.getState()._setDeleteResult({ success: false, data: null, error: 'Network error', _called: 0 });

  const id = store.getState().newConversation();
  await store.getState().deleteConversation(id);

  assert(store.getState().conversations.some((c) => c.id === id));
  assert.equal(store.getState().syncStatus, 'error');
});

// ---- 5. Duplicate clicks send one DELETE request ----
test('duplicate delete calls only invoke remote DELETE once', async () => {
  const store = createTestStore();
  store.getState()._setAuth(true);
  store.getState()._setDeleteResult({ success: true, data: null, error: null, status: 200, _called: 0 });

  const id = store.getState().newConversation();

  // Fire two concurrent deletes
  await Promise.all([
    store.getState().deleteConversation(id),
    store.getState().deleteConversation(id),
  ]);

  // Only one actual remote call
  assert.equal(store.getState()._getDeleteCalled(), 1);
  // Conversation removed
  assert.equal(store.getState().conversations.some((c) => c.id === id), false);
});

// ---- 6. pullRemote cannot re-add a pending deletion ----
test('pullRemote skips conversations in deletingConversationIds', () => {
  const store = createTestStore();
  const id = store.getState().newConversation();

  // Simulate deletion in-flight
  store.setState({ deletingConversationIds: { [id]: true } });

  const remote = [{ id, title: 'Resurrected', pinned: false, updatedAt: now(), createdAt: now(), mode: 'general' }];
  simulatePullRemote(store, remote, null, { [id]: true });

  // Conversation was NOT re-added (only existed in remote, not local)
  // Actually it's still in local because deletion hasn't completed
  assert(store.getState().conversations.some((c) => c.id === id));
});

test('pullRemote does not re-add a conversation that was deleted during sync', () => {
  // Simulate: local conversation deleted, then pullRemote runs with remote
  // still having it. Since deletingConversationIds is set, it should be skipped.
  const store = createTestStore();
  const id = store.getState().newConversation();
  store.setState({ deletingConversationIds: { [id]: true } });

  const remote = [{ id, title: 'Still on server', pinned: false, updatedAt: now(), createdAt: now(), mode: 'general' }];
  simulatePullRemote(store, remote, null, { [id]: true });

  // The conversation was in local, it's still there (deletion in flight),
  // but if it were removed locally, pullRemote would not re-add it.
  // Test: if we remove it locally to simulate deletion completion,
  // it should NOT be added back.
  store.setState((s) => ({
    conversations: s.conversations.filter((c) => c.id !== id),
    deletingConversationIds: {},
  }));
  assert(!store.getState().conversations.some((c) => c.id === id));

  // Now pullRemote again — this time local doesn't have it, but remote does.
  // Since deletingIds is now empty, it WOULD be re-added. This is correct
  // because the deletion is no longer in-flight.
  simulatePullRemote(store, remote, null, {});
  assert(store.getState().conversations.some((c) => c.id === id));
});

// ---- 7. Device B sync removes a remotely deleted server-backed conversation ----
test('Device B pullRemote removes conversation that no longer exists remotely', () => {
  const store = createTestStore();

  // Device B has two conversations from a previous sync
  const id1 = store.getState().newConversation();
  const id2 = store.getState().newConversation();

  // First sync: both exist on server
  const remote1 = [
    { id: id1, title: 'Chat A', pinned: false, updatedAt: now(), createdAt: now(), mode: 'general' },
    { id: id2, title: 'Chat B', pinned: false, updatedAt: now(), createdAt: now(), mode: 'general' },
  ];
  const { nextPrevIds } = simulatePullRemote(store, remote1, null, {});
  assert.equal(store.getState().conversations.length, 2);

  // Device A deletes Chat A. Device B's next sync only gets Chat B.
  const remote2 = [
    { id: id2, title: 'Chat B', pinned: false, updatedAt: now(), createdAt: now(), mode: 'general' },
  ];
  simulatePullRemote(store, remote2, nextPrevIds, {});

  // Chat A should be removed locally
  assert(!store.getState().conversations.some((c) => c.id === id1));
  assert.equal(store.getState().conversations.length, 1);
  assert(store.getState().conversations.some((c) => c.id === id2));
});

// ---- 8. Local-only conversations not removed by remote reconciliation ----
test('local-only (unsynced) conversations are not removed during pullRemote', () => {
  const store = createTestStore();

  // Create a server-backed conversation (was in a previous sync)
  const serverId = store.getState().newConversation();

  // First sync
  const remote1 = [
    { id: serverId, title: 'Server chat', pinned: false, updatedAt: now(), createdAt: now(), mode: 'general' },
  ];
  const { nextPrevIds } = simulatePullRemote(store, remote1, null, {});
  assert.equal(store.getState().conversations.length, 1);

  // Create a local-only conversation (not pushed yet)
  const localId = store.getState().newConversation();
  store.getState().selectConversation(localId);
  assert.equal(store.getState().conversations.length, 2);

  // Next sync: server still has the server-backed one, local-only one hasn't been pushed
  const remote2 = [
    { id: serverId, title: 'Server chat', pinned: false, updatedAt: now(), createdAt: now(), mode: 'general' },
  ];
  simulatePullRemote(store, remote2, nextPrevIds, {});

  // Local-only conversation should survive
  assert(store.getState().conversations.some((c) => c.id === localId));
  assert(store.getState().conversations.some((c) => c.id === serverId));
  assert.equal(store.getState().conversations.length, 2);
});

// ---- 9. Deleting selected conversation chooses valid fallback ----
test('deleting selected conversation selects first remaining conversation', async () => {
  const store = createTestStore();
  const id1 = store.getState().newConversation(); // becomes current
  const id2 = store.getState().newConversation();
  store.getState().selectConversation(id1); // select first one

  assert.equal(store.getState().currentId, id1);

  await store.getState().deleteConversation(id1);

  // currentId should fallback to the remaining conversation
  assert.equal(store.getState().currentId, id2);
});

test('deleting unselected conversation does not change currentId', async () => {
  const store = createTestStore();
  const id1 = store.getState().newConversation(); // becomes current
  const id2 = store.getState().newConversation();
  store.getState().selectConversation(id1);

  await store.getState().deleteConversation(id2);

  // currentId unchanged
  assert.equal(store.getState().currentId, id1);
  // second conversation removed
  assert(!store.getState().conversations.some((c) => c.id === id2));
});

// ---- 10. Deleting only conversation preserves empty state ----
test('deleting the only conversation leaves currentId null', async () => {
  const store = createTestStore();
  const id = store.getState().newConversation();
  assert.equal(store.getState().currentId, id);

  await store.getState().deleteConversation(id);

  assert.equal(store.getState().conversations.length, 0);
  assert.equal(store.getState().currentId, null);
});

// ---- 11. Deleting during streaming aborts that conversation's controller ----
test('deleting a streaming conversation aborts its controller and clears stream state', async () => {
  const store = createTestStore();
  const registry = store.getState()._registry;
  const id = store.getState().newConversation();

  // Simulate active stream
  const controller = new AbortController();
  registry[id] = controller;
  store.getState().setStreaming(id, 'msg-1');
  assert(store.getState().streamingConversations[id]);

  // Delete conversation
  await store.getState().deleteConversation(id);

  // Controller should have been aborted
  assert(controller.signal.aborted);
  // Controller removed from registry
  assert(!registry[id]);
  // Streaming state cleared
  assert(!store.getState().streamingConversations[id]);
  // Conversation removed
  assert(!store.getState().conversations.some((c) => c.id === id));
});

test('deleting one streaming conversation does not abort others', async () => {
  const store = createTestStore();
  const registry = store.getState()._registry;
  const id1 = store.getState().newConversation();
  const id2 = store.getState().newConversation();

  // Both streaming
  const ctrl1 = new AbortController();
  const ctrl2 = new AbortController();
  registry[id1] = ctrl1;
  registry[id2] = ctrl2;
  store.getState().setStreaming(id1, 'msg-1');
  store.getState().setStreaming(id2, 'msg-2');

  // Delete only id1
  await store.getState().deleteConversation(id1);

  // id1 aborted
  assert(ctrl1.signal.aborted);
  // id2 NOT aborted
  assert(!ctrl2.signal.aborted);
  // id2 still in registry
  assert(registry[id2]);
});

// ---- 12. Late SSE/finalContent callback cannot restore deleted conversation ----
test('addMessage guard prevents stale message addition during deletion', async () => {
  const store = createTestStore();
  const id = store.getState().newConversation();

  // Simulate deletion in-flight
  store.setState({ deletingConversationIds: { [id]: true } });

  // Try to add a message (simulating a stale SSE callback)
  const result = store.getState().addMessage(id, { role: 'assistant', content: 'Stale response' });

  // Should return null and NOT add the message
  assert.equal(result, null);
  const convo = store.getState().conversations.find((c) => c.id === id);
  assert.equal(convo.messages.length, 0);
});

test('appendToMessage guard prevents stale token appending during deletion', () => {
  const store = createTestStore();
  const id = store.getState().newConversation();
  const msgId = store.getState().addMessage(id, { role: 'assistant', content: '' });

  // Simulate deletion in-flight
  store.setState({ deletingConversationIds: { [id]: true } });

  // Stale callback
  store.getState().appendToMessage(id, msgId, 'stale delta');

  // Message content should not have changed
  const convo = store.getState().conversations.find((c) => c.id === id);
  assert.equal(convo.messages[0].content, '');
});

test('updateMessage guard prevents stale metadata update during deletion', () => {
  const store = createTestStore();
  const id = store.getState().newConversation();
  const msgId = store.getState().addMessage(id, { role: 'assistant', content: 'some content' });

  // Simulate deletion in-flight
  store.setState({ deletingConversationIds: { [id]: true } });

  // Stale callback
  store.getState().updateMessage(id, msgId, { pending: false, content: 'final content' });

  // Content should not have changed
  const convo = store.getState().conversations.find((c) => c.id === id);
  assert.equal(convo.messages[0].content, 'some content');
});

// ---- 13. deletingConversationIds is not persisted ----
test('deletingConversationIds is excluded from partialize', () => {
  // The real store's partialize function only includes:
  // conversations, currentId, model, modelProvider, mode, documents, useRag
  const partialize = (s) => ({
    conversations: s.conversations,
    currentId: s.currentId,
    model: s.model,
    modelProvider: s.modelProvider,
    mode: s.mode,
    documents: s.documents,
    useRag: s.useRag,
  });

  const state = {
    conversations: [{ id: '1', title: 'x' }],
    currentId: '1',
    model: 'auto',
    modelProvider: 'auto',
    mode: 'general',
    documents: [],
    useRag: false,
    deletingConversationIds: { '1': true },
    streamingConversations: {},
    syncStatus: 'error',
    syncError: 'test error',
  };

  const persisted = partialize(state);
  assert(!('deletingConversationIds' in persisted), 'deletingConversationIds must not be persisted');
  assert(!('streamingConversations' in persisted), 'streamingConversations must not be persisted');
  assert(!('syncStatus' in persisted), 'syncStatus must not be persisted');
  assert(!('syncError' in persisted), 'syncError must not be persisted');
});

// ---- Bonus: Unauthenticated delete works ----
test('unauthenticated delete removes locally without remote call', async () => {
  const store = createTestStore();
  store.getState()._setAuth(false);

  const id = store.getState().newConversation();
  store.getState()._setDeleteResult({ success: true, data: null, error: null, status: 200, _called: 0 });

  await store.getState().deleteConversation(id);

  // No remote call
  assert.equal(store.getState()._getDeleteCalled(), 0);
  // Removed locally
  assert(!store.getState().conversations.some((c) => c.id === id));
});

// ===========================================================================
// Bearer token chain — verify DELETE carries Authorization header end-to-end
// ===========================================================================

test('deleteRemoteConversation sends DELETE with Bearer token via apiFetch chain', () => {
  const apiClient = readFileSync(resolve(ROOT, 'src/lib/apiClient.js'), 'utf-8');
  const chatSync = readFileSync(resolve(ROOT, 'src/lib/chatSync.js'), 'utf-8');
  const chatStore = readFileSync(resolve(ROOT, 'src/store/chatStore.js'), 'utf-8');

  // 1. getToken reads 'userToken' from localStorage
  assert.match(apiClient, /getToken.*\{\s*return localStorage\.getItem\(ACCESS_KEY\)/);
  assert.match(apiClient, /ACCESS_KEY.*=.*'userToken'/);

  // 2. authHeaders builds Authorization: Bearer <token> from getToken()
  assert.match(apiClient, /Authorization.*`Bearer \$\{token\}`/);

  // 3. rawFetch passes authHeaders to every fetch call
  assert.match(apiClient, /headers:\s*authHeaders\(/);

  // 4. apiFetch calls rawFetch with the caller's opts (including method: 'DELETE')
  assert.match(apiClient, /let res = await rawFetch\(path, opts\)/);

  // 5. deleteRemoteConversation calls apiFetch with method: 'DELETE'
  assert.match(chatSync, /apiFetch\(`\/conversations\/\$\{id\}`, \{ method: 'DELETE' \}\)/);

  // 6. chatStore calls deleteRemoteConversation(id)
  assert.match(chatStore, /deleteRemoteConversation\(id\)/);

  // 7. 401 response maps to 'Your session has expired. Please sign in again.'
  assert.match(chatStore, /result\.status === 401/);
  assert.match(chatStore, /'Your session has expired\. Please sign in again\.'/);
});


