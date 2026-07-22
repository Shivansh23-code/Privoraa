import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X, PanelLeftOpen, Loader2 } from 'lucide-react';

import Sidebar from './Sidebar';
import ChatHeader from './ChatHeader';
import MessageThread from './MessageThread';
import EmptyState from './EmptyState';
import Composer from './Composer';
import VaultLockBar from './VaultLockBar';
import ModelCatalogModal from '../models/ModelCatalogModal';
import SourcesModal from './SourcesModal';

import { useChatStore } from '../../store/chatStore';
import { useUserAuth } from '../../context/UserAuthContext';
import { useChat } from './useChat';
import { useLocalLlm } from './useLocalLlm';
import { fetchModels, ensureBackend, isUsingMock } from '../../lib/chatService';
import { fetchDocuments } from '../../lib/documentService';
import {
  fetchRemoteConversations,
  fetchRemoteConversationDetail,
  createRemoteConversation,
  updateRemoteConversation,
} from '../../lib/chatSync';
import { FALLBACK_MODELS } from '../../lib/models';

// Tracks which conversation IDs have been confirmed to exist on the remote
// server across sync cycles. Used to detect cross-device deletion: if a
// conversation that was previously server-backed no longer appears in a remote
// response, it was deleted by another device and should be removed locally.
let prevRemoteIds = null;

export default function ChatWorkspace() {
  const { data: models = FALLBACK_MODELS } = useQuery({
    queryKey: ['models'],
    queryFn: fetchModels,
    staleTime: 1000 * 60 * 60,
  });

  const model = useChatStore((s) => s.model);
  const modelProvider = useChatStore((s) => s.modelProvider);
  const mode = useChatStore((s) => s.mode);
  const setModelSelection = useChatStore((s) => s.setModelSelection);
  const currentId = useChatStore((s) => s.currentId);
  const conversations = useChatStore((s) => s.conversations);
  const isConversationStreaming = useChatStore((s) => s.isConversationStreaming);
  const streamingConversations = useChatStore((s) => s.streamingConversations);
  const isStreaming = currentId ? isConversationStreaming(currentId) : false;
  const streamingMessageId = isStreaming && currentId ? streamingConversations[currentId]?.streamingMessageId : null;
  const documents = useChatStore((s) => s.documents);
  const setDocuments = useChatStore((s) => s.setDocuments);
  const updateDocument = useChatStore((s) => s.updateDocument);

  // Cross-device conversation sync. On mount (authenticated), fetch remote
  // conversations and merge into local state. Also push local mutations upstream.
  // Periodic re-sync on focus and timer keeps multi-device history consistent.
  const syncRef = useRef(false);
  const hydratedRef = useRef({}); // track which conversations have been hydrated
  const [authToken, setAuthToken] = useState(null);
  const setSyncStatus = useChatStore((s) => s.setSyncStatus);
  const setSyncError = useChatStore((s) => s.setSyncError);
  const setLastSyncAt = useChatStore((s) => s.setLastSyncAt);
  const syncStatus = useChatStore((s) => s.syncStatus);
  const syncError = useChatStore((s) => s.syncError);

  useEffect(() => {
    const check = () => {
      const token = localStorage.getItem('userToken');
      setAuthToken(token);
    };
    check();
    window.addEventListener('storage', check);
    return () => window.removeEventListener('storage', check);
  }, []);

  // Pull: fetch remote conversations and merge into local state.
  const pullRemote = useCallback(async () => {
    if (!authToken) return;
    const live = await ensureBackend();
    if (!live) return;
    setSyncStatus('syncing');
    const result = await fetchRemoteConversations();
    if (!result.success) {
      setSyncStatus('error');
      setSyncError(result.error);
      return;
    }
    const remote = result.data;
    if (!Array.isArray(remote)) {
      setSyncStatus('idle');
      return;
    }
    const s = useChatStore.getState();
    const deletingIds = s.deletingConversationIds || {};
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
          id: r.id,
          title: r.title,
          mode: r.mode || 'general',
          pinned: r.pinned || false,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
          messages: [],
        });
        changed = true;
      }
    }
    // Cross-device deletion: remove local conversations that were previously
    // confirmed to exist on the server but no longer appear in the remote list.
    if (prevRemoteIds && remote.length > 0) {
      const remoteIds = new Set(remote.map((r) => r.id));
      const toRemove = merged.filter(
        (c) => prevRemoteIds.has(c.id) && !remoteIds.has(c.id) && !deletingIds[c.id]
      );
      for (const c of toRemove) {
        const idx = merged.findIndex((m) => m.id === c.id);
        if (idx !== -1) {
          merged.splice(idx, 1);
          changed = true;
        }
      }
    }
    if (prevRemoteIds === null || remote.length > 0) {
      prevRemoteIds = new Set(remote.map((r) => r.id));
    }

    if (changed) {
      const patch = { conversations: merged };
      if (s.currentId && !merged.some((c) => c.id === s.currentId)) {
        patch.currentId = merged[0]?.id ?? null;
      }
      useChatStore.setState(patch);
    }
    setSyncStatus('synced');
    setLastSyncAt(new Date().toISOString());
  }, [authToken, setSyncStatus, setSyncError, setLastSyncAt]);

  // Initial pull + periodic re-sync on focus and timer.
  useEffect(() => {
    if (!authToken || syncRef.current) return;
    syncRef.current = true;
    pullRemote();
    const onFocus = () => pullRemote();
    window.addEventListener('focus', onFocus);
    const interval = setInterval(pullRemote, 30000);
    return () => {
      window.removeEventListener('focus', onFocus);
      clearInterval(interval);
    };
  }, [authToken, pullRemote]);

  // Hydrate messages when opening a conversation that has no messages yet.
  useEffect(() => {
    if (!authToken || !currentId) return;
    if (hydratedRef.current[currentId]) return;
    const convo = useChatStore.getState().conversations.find((c) => c.id === currentId);
    if (!convo || convo.messages.length > 0) return;
    hydratedRef.current[currentId] = true;
    ensureBackend().then((live) => {
      if (!live) return;
      fetchRemoteConversationDetail(currentId).then((result) => {
        if (!result.success || !result.data) return;
        const remote = result.data;
        if (!remote.messages || remote.messages.length === 0) return;
        const s = useChatStore.getState();
        const existing = s.conversations.find((c) => c.id === currentId);
        if (!existing) return;
        if (existing.messages.length > 0) return;
        useChatStore.setState({
          conversations: s.conversations.map((c) =>
            c.id === currentId
              ? { ...c, messages: remote.messages, title: remote.title, mode: remote.mode, pinned: remote.pinned }
              : c
          ),
        });
      });
    });
  }, [authToken, currentId]);

  // Push: subscribe to local conversation mutations and sync upstream.
  useEffect(() => {
    if (!authToken) return;
    const unsub = useChatStore.subscribe((s, prev) => {
      if (s.conversations === prev.conversations) return;
      const prevIds = new Set(prev.conversations.map((c) => c.id));
      // New conversations: push to remote with local ID (backend now accepts it).
      for (const c of s.conversations) {
        if (!prevIds.has(c.id)) {
          createRemoteConversation(c.id, c.title, c.mode);
        }
      }
      // Renamed/pinned: update remote.
      const prevMap = new Map(prev.conversations.map((c) => [c.id, c]));
      for (const c of s.conversations) {
        const p = prevMap.get(c.id);
        if (p && (p.title !== c.title || p.pinned !== c.pinned)) {
          updateRemoteConversation(c.id, { title: c.title, pinned: c.pinned }).then((result) => {
            if (!result.success) {
              setSyncStatus('error');
              setSyncError(result.error);
            }
          });
        }
      }
    });
    return unsub;
  }, [authToken, setSyncError, setSyncStatus]);

  const convo = conversations.find((c) => c.id === currentId) || null;
  const messages = convo?.messages ?? [];

  const { send, stop, regenerate, editPrompt, continueResponse } = useChat(models);
  const localLlm = useLocalLlm();
  const { user } = useUserAuth();
  const plan = (user?.plan || 'FREE').toLowerCase(); // drives per-plan dashboard theming

  const [sidebarOpen, setSidebarOpen] = useState(false); // mobile drawer
  const [collapsed, setCollapsed] = useState(false); // desktop sidebar collapsed (pinned)
  const [peek, setPeek] = useState(false); // collapsed sidebar temporarily shown on hover
  const [modelsOpen, setModelsOpen] = useState(false); // local-model catalog modal
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const closeSources = useCallback(() => setSourcesOpen(false), []);
  const [usingMock, setUsingMock] = useState(true);
  const [serverWaking, setServerWaking] = useState(false); // cold-start in progress
  const fileInputRef = useRef(null);
  const docsHydratedRef = useRef(false);
  const drawerRef = useRef(null);
  const mobileMenuTriggerRef = useRef(null);

  useEffect(() => {
    // On a free host the first request can wake a slept instance (~30-60s). If the
    // health probe hasn't resolved in a few seconds, show a friendly banner rather
    // than appearing frozen.
    let settled = false;
    const t = setTimeout(() => {
      if (!settled) setServerWaking(true);
    }, 4000);
    ensureBackend().then(() => {
      settled = true;
      clearTimeout(t);
      setServerWaking(false);
      setUsingMock(isUsingMock());
    });
    return () => clearTimeout(t);
  }, []);

  // Hydrate the document list from the backend exactly once. The ref guard makes
  // this idempotent under StrictMode's double-invoked effects, and living here
  // (a single stable mount) avoids the refetch DocumentsPanel caused by being
  // mounted twice and remounting on panel toggle.
  useEffect(() => {
    if (docsHydratedRef.current) return;
    docsHydratedRef.current = true;
    ensureBackend().then((live) => {
      if (!live) return;
      fetchDocuments().then((docs) => {
        setDocuments(docs);
        // Grounding remains an explicit user choice even when ready sources exist.
      });
    });
  }, [setDocuments]);

  // Poll while ANY document is still processing — one shared loop for all docs
  // (replaces per-upload polling that fired a /documents request every 2s each).
  // Stops as soon as nothing is PROCESSING, so a single upload makes far fewer calls.
  const hasProcessingDoc = documents.some((d) => d.status === 'PROCESSING');
  useEffect(() => {
    if (!hasProcessingDoc) return undefined;
    let active = true;
    const id = setInterval(async () => {
      const docs = await fetchDocuments().catch(() => null);
      if (!active || !Array.isArray(docs)) return;
      docs.forEach((d) => {
        updateDocument(d.id, { status: d.status, chunkCount: d.chunkCount });
      });
      // Ready sources become available, but are never enabled silently.
    }, 3500);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [hasProcessingDoc, updateDocument]);

  useEffect(() => {
    if (!sidebarOpen) return undefined;
    const previous = document.body.style.overflow;
    const returnFocus = mobileMenuTriggerRef.current;
    document.body.style.overflow = 'hidden';
    const drawer = drawerRef.current;
    const focusableSelector = 'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const focusables = () => [...(drawer?.querySelectorAll(focusableSelector) || [])];
    requestAnimationFrame(() => focusables()[0]?.focus());
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setSidebarOpen(false);
        return;
      }
      if (event.key !== 'Tab') return;
      const items = focusables();
      if (!items.length) { event.preventDefault(); drawer?.focus(); return; }
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKeyDown);
      returnFocus?.focus();
    };
  }, [sidebarOpen]);

  const desktopOpen = !collapsed || peek;

  return (
    <div data-plan={plan} className="relative flex h-[100dvh] w-full min-w-0 max-w-none overflow-hidden bg-bg text-fg">
      {/* Per-plan ambient glow (violet for Plus, steel for Pro; none for Free). */}
      <div className="plan-glow-bg pointer-events-none absolute inset-x-0 top-0 z-0 h-72" />
      {/* ---------- Left sidebar (desktop) ---------- */}
      {/* Collapsed rail: brand logo; hover to peek the sidebar open. */}
      {collapsed && (
        <div
          onMouseEnter={() => setPeek(true)}
          className="hidden w-[60px] shrink-0 flex-col items-center border-r border-line bg-surface pt-3 lg:flex"
        >
          <button
            onClick={() => setCollapsed(false)}
            onMouseEnter={() => setPeek(true)}
            title="Open sidebar"
            className="group flex h-9 w-9 items-center justify-center rounded-lg transition hover:bg-surface-2"
          >
            <span className="brand-grad flex h-8 w-8 items-center justify-center rounded-full group-hover:opacity-0">
              <img src="/logo.png" alt="Vedix" />
            </span>
            <PanelLeftOpen size={18} className="absolute text-brand-500 opacity-0 transition group-hover:opacity-100" />
          </button>
        </div>
      )}

      {/* The sidebar itself: in-flow when open, an overlay while peeking. */}
      {desktopOpen && (
        <aside
          onMouseLeave={() => collapsed && setPeek(false)}
          className={`hidden shrink-0 border-r border-line bg-surface lg:block ${
            collapsed
              ? 'absolute left-0 top-0 z-40 h-full w-[300px] shadow-2xl'
              : 'w-[288px]'
          }`}
        >
          <Sidebar
            fileInputRef={fileInputRef}
            onCollapse={() => {
              setCollapsed(true);
              setPeek(false);
            }}
          />
        </aside>
      )}
      {/* Mobile drawer */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-black/65 backdrop-blur-[2px]"
            onClick={() => setSidebarOpen(false)}
          />
          <div ref={drawerRef} role="dialog" aria-modal="true" aria-label="Navigation" tabIndex={-1} className="absolute left-0 top-0 h-[100dvh] w-[min(320px,88vw)] overflow-y-auto border-r border-line bg-surface pb-[env(safe-area-inset-bottom,0px)] pt-[env(safe-area-inset-top,0px)] shadow-2xl">
            <button
              onClick={() => setSidebarOpen(false)}
              aria-label="Close navigation"
              className="absolute right-2 top-2 z-10 flex h-11 w-11 items-center justify-center rounded-lg text-muted hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)]"
            >
              <X size={18} />
            </button>
            <Sidebar onNavigate={() => setSidebarOpen(false)} fileInputRef={fileInputRef} />
          </div>
        </div>
      )}

      {/* ---------- Main column ---------- */}
      <main className="relative z-10 flex min-w-0 flex-1 flex-col overflow-hidden">
        <ChatHeader
          models={models}
          model={model}
          modelProvider={modelProvider}
          onModelSelect={setModelSelection}
          onToggleSidebar={() => setSidebarOpen(true)}
          onOpenModels={() => setModelsOpen(true)}
          localLlm={localLlm}
          usingMock={usingMock}
          mobileMenuTriggerRef={mobileMenuTriggerRef}
        />

        <VaultLockBar />

        {syncStatus === 'error' && syncError && (
          <div className="flex items-center justify-center gap-2 border-b border-line bg-red-500/10 px-4 py-1 text-xs text-red-600 dark:text-red-400">
            Sync issue: {syncError}
          </div>
        )}

        {syncStatus === 'syncing' && (
          <div className="flex items-center justify-center gap-2 border-b border-line bg-blue-500/10 px-4 py-1 text-xs text-blue-600 dark:text-blue-400">
            <Loader2 size={11} className="animate-spin" />
            Syncing conversations…
          </div>
        )}

        {serverWaking && (
          <div className="flex items-center justify-center gap-2 border-b border-line bg-amber-500/10 px-4 py-1.5 text-xs font-medium text-amber-600 dark:text-amber-400">
            <Loader2 size={13} className="animate-spin" />
            Waking the server — the free host sleeps when idle, so the first request can take ~30–60s.
          </div>
        )}

        {messages.length === 0 ? (
          <div className="flex-1 overflow-y-auto">
            <EmptyState mode={mode} onPick={send} />
          </div>
        ) : (
          <MessageThread
            messages={messages}
            isStreaming={isStreaming}
            streamingMessageId={streamingMessageId}
            onRegenerate={(msgId) => regenerate(convo.id, msgId)}
            onContinue={(msgId) => continueResponse(convo.id, msgId)}
            onEditPrompt={(msgId, content) => editPrompt(convo.id, msgId, content)}
            onStop={() => stop(convo?.id)}
          />
        )}

        <Composer
          onSend={send}
          onStop={() => stop(convo?.id)}
          isStreaming={isStreaming}
          onOpenSources={() => setSourcesOpen(true)}
          onEditLast={() => {
            const lastUser = [...messages].reverse().find((message) => message.role === 'user');
            if (lastUser) window.dispatchEvent(new CustomEvent('privoraa:edit-prompt', { detail: lastUser.id }));
          }}
          mode={mode}
        />
      </main>

      {/* ---------- Local-model catalog ---------- */}
      <ModelCatalogModal
        open={modelsOpen}
        onClose={() => setModelsOpen(false)}
        onActiveChange={() => localLlm.refresh()}
      />
      <SourcesModal open={sourcesOpen} onClose={closeSources} />
    </div>
  );
}
