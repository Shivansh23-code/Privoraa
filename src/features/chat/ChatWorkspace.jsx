import React, { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X } from 'lucide-react';

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
  const setMode = useChatStore((s) => s.setMode);
  const currentId = useChatStore((s) => s.currentId);
  const conversations = useChatStore((s) => s.conversations);
  const isStreaming = useChatStore((s) => s.isStreaming);
  const streamingMessageId = useChatStore((s) => s.streamingMessageId);
  const setDocuments = useChatStore((s) => s.setDocuments);

  const convo = conversations.find((c) => c.id === currentId) || null;
  const messages = convo?.messages ?? [];

  const { send, stop, regenerate } = useChat(models);
  const localLlm = useLocalLlm();

  const [sidebarOpen, setSidebarOpen] = useState(false); // mobile drawer
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
      if (live) fetchDocuments().then(setDocuments);
    });
  }, [setDocuments]);

  return (
    <div className="flex h-screen overflow-hidden bg-bg text-fg">
      {/* ---------- Left sidebar ---------- */}
      {/* Desktop */}
      <aside className="hidden w-[280px] shrink-0 border-r border-line bg-surface lg:block 2xl:w-[320px]">
        <Sidebar fileInputRef={fileInputRef} />
      </aside>
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
          mode={mode}
          onModelChange={setModel}
          onModeChange={setMode}
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
