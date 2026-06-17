import React, { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X, PanelLeftOpen } from 'lucide-react';

import Sidebar from './Sidebar';
import ChatHeader from './ChatHeader';
import MessageThread from './MessageThread';
import EmptyState from './EmptyState';
import Composer from './Composer';
import ModelCatalogModal from '../models/ModelCatalogModal';

import { useChatStore } from '../../store/chatStore';
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
  const mode = useChatStore((s) => s.mode);
  const setModel = useChatStore((s) => s.setModel);
  const currentId = useChatStore((s) => s.currentId);
  const conversations = useChatStore((s) => s.conversations);
  const isStreaming = useChatStore((s) => s.isStreaming);
  const streamingMessageId = useChatStore((s) => s.streamingMessageId);
  const documents = useChatStore((s) => s.documents);
  const setDocuments = useChatStore((s) => s.setDocuments);
  const updateDocument = useChatStore((s) => s.updateDocument);
  const setUseRag = useChatStore((s) => s.setUseRag);

  const convo = conversations.find((c) => c.id === currentId) || null;
  const messages = convo?.messages ?? [];

  const { send, stop, regenerate } = useChat(models);
  const localLlm = useLocalLlm();

  const [sidebarOpen, setSidebarOpen] = useState(false); // mobile drawer
  const [collapsed, setCollapsed] = useState(false); // desktop sidebar collapsed (pinned)
  const [peek, setPeek] = useState(false); // collapsed sidebar temporarily shown on hover
  const [modelsOpen, setModelsOpen] = useState(false); // local-model catalog modal
  const [usingMock, setUsingMock] = useState(true);
  const fileInputRef = useRef(null);
  const hydratedRef = useRef(false);

  useEffect(() => {
    ensureBackend().then(() => setUsingMock(isUsingMock()));
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
        // Auto-ground on existing notes: without this, a reload leaves useRag
        // false (persisted) while docs are already READY, so chat silently
        // ignores them — the "it can't read my document" complaint.
        if (Array.isArray(docs) && docs.some((d) => d.status === 'READY')) {
          setUseRag(true);
        }
      });
    });
  }, [setDocuments, setUseRag]);

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
      const prev = useChatStore.getState().documents;
      let becameReady = false;
      docs.forEach((d) => {
        const before = prev.find((x) => x.id === d.id);
        if (before?.status === 'PROCESSING' && d.status === 'READY') becameReady = true;
        updateDocument(d.id, { status: d.status, chunkCount: d.chunkCount });
      });
      if (becameReady) setUseRag(true); // auto-ground once a doc finishes
    }, 3500);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [hasProcessingDoc, updateDocument, setUseRag]);

  const desktopOpen = !collapsed || peek;

  return (
    <div className="relative flex h-screen overflow-hidden bg-bg text-fg">
      {/* ---------- Left sidebar (desktop) ---------- */}
      {/* Collapsed rail: brand logo; hover to peek the sidebar open. */}
      {collapsed && (
        <div
          onMouseEnter={() => setPeek(true)}
          className="hidden w-[56px] shrink-0 flex-col items-center border-r border-line bg-surface pt-3 lg:flex"
        >
          <button
            onClick={() => setCollapsed(false)}
            onMouseEnter={() => setPeek(true)}
            title="Open sidebar"
            className="group flex h-9 w-9 items-center justify-center rounded-lg transition hover:bg-surface-2"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-accent-500 to-brand-600 group-hover:opacity-0">
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
              : 'w-[280px] 2xl:w-[320px]'
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
            className="absolute inset-0 bg-black/40"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="absolute left-0 top-0 h-full w-[280px] border-r border-line bg-surface shadow-2xl">
            <button
              onClick={() => setSidebarOpen(false)}
              className="absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-surface-2"
            >
              <X size={18} />
            </button>
            <Sidebar onNavigate={() => setSidebarOpen(false)} fileInputRef={fileInputRef} />
          </div>
        </div>
      )}

      {/* ---------- Main column ---------- */}
      <main className="flex min-w-0 flex-1 flex-col">
        <ChatHeader
          models={models}
          model={model}
          onModelChange={setModel}
          onToggleSidebar={() => setSidebarOpen(true)}
          onOpenModels={() => setModelsOpen(true)}
          localLlm={localLlm}
          usingMock={usingMock}
        />

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
          onAttach={() => fileInputRef.current?.click()}
          mode={mode}
        />
      </main>

      {/* ---------- Local-model catalog ---------- */}
      <ModelCatalogModal
        open={modelsOpen}
        onClose={() => setModelsOpen(false)}
        onActiveChange={() => localLlm.refresh()}
      />
    </div>
  );
}
