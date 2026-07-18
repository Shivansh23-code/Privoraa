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
import { FALLBACK_MODELS } from '../../lib/models';

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
  const isStreaming = useChatStore((s) => s.isStreaming);
  const streamingMessageId = useChatStore((s) => s.streamingMessageId);
  const documents = useChatStore((s) => s.documents);
  const setDocuments = useChatStore((s) => s.setDocuments);
  const updateDocument = useChatStore((s) => s.updateDocument);

  const convo = conversations.find((c) => c.id === currentId) || null;
  const messages = convo?.messages ?? [];

  const { send, stop, regenerate } = useChat(models);
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
  const hydratedRef = useRef(false);
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
    if (hydratedRef.current) return;
    hydratedRef.current = true;
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
      {/* Per-plan ambient glow (violet for Plus, gold for Pro; none for Free). */}
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
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-[#070b14]" aria-hidden="true">
                <path fill="none" stroke="currentColor" strokeWidth="2.2" d="M7 11V8a5 5 0 0 1 10 0v3" />
                <rect x="5" y="11" width="14" height="10" rx="2.5" fill="currentColor" />
              </svg>
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
          <div ref={drawerRef} role="dialog" aria-modal="true" aria-label="Navigation" tabIndex={-1} className="absolute left-0 top-0 h-full w-[min(320px,88vw)] border-r border-line bg-surface pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)] shadow-2xl">
            <button
              onClick={() => setSidebarOpen(false)}
              aria-label="Close navigation"
              className="absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-surface-2"
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
            onStop={stop}
          />
        )}

        <Composer
          onSend={send}
          onStop={stop}
          isStreaming={isStreaming}
          onOpenSources={() => setSourcesOpen(true)}
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
