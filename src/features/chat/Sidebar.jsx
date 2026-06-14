import React, { useMemo, useState } from 'react';
import {
  Plus,
  Search,
  Pin,
  PinOff,
  Pencil,
  Trash2,
  MessageSquare,
  X,
  Check,
  Settings,
  ChevronDown,
  FileText,
  Activity,
  PanelLeftClose,
} from 'lucide-react';
import { useChatStore } from '../../store/chatStore';
import { useUserAuth } from '../../context/UserAuthContext';
import SettingsModal from './SettingsModal';
import DocumentsPanel from './DocumentsPanel';
import UsagePanel from './UsagePanel';

function ConversationItem({ convo, active, onSelect, onRename, onDelete, onTogglePin }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(convo.title);

  const commit = () => {
    onRename(convo.id, draft);
    setEditing(false);
  };

  return (
    <div
      onClick={() => !editing && onSelect(convo.id)}
      className={`group flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition ${
        active ? 'bg-brand-500/12 text-fg' : 'text-fg/80 hover:bg-surface-2'
      }`}
    >
      <MessageSquare size={15} className={`shrink-0 ${active ? 'text-brand-500' : 'text-faint'}`} />

      {editing ? (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') setEditing(false);
          }}
          className="min-w-0 flex-1 rounded border border-brand-400 bg-bg px-1 py-0.5 text-sm focus:outline-none"
        />
      ) : (
        <span className="min-w-0 flex-1 truncate">{convo.title}</span>
      )}

      <div
        className="flex shrink-0 items-center gap-0.5"
        onClick={(e) => e.stopPropagation()}
      >
        {editing ? (
          <>
            <IconBtn title="Save" onClick={commit}><Check size={13} /></IconBtn>
            <IconBtn title="Cancel" onClick={() => setEditing(false)}><X size={13} /></IconBtn>
          </>
        ) : (
          <div className={`items-center gap-0.5 ${convo.pinned ? 'flex' : 'hidden group-hover:flex'}`}>
            <IconBtn title={convo.pinned ? 'Unpin' : 'Pin'} onClick={() => onTogglePin(convo.id)}>
              {convo.pinned ? <PinOff size={13} /> : <Pin size={13} />}
            </IconBtn>
            <IconBtn title="Rename" onClick={() => { setDraft(convo.title); setEditing(true); }}>
              <Pencil size={13} />
            </IconBtn>
            <IconBtn title="Delete" danger onClick={() => onDelete(convo.id)}>
              <Trash2 size={13} />
            </IconBtn>
          </div>
        )}
      </div>
    </div>
  );
}

function IconBtn({ children, onClick, title, danger }) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={`flex h-6 w-6 items-center justify-center rounded-md text-muted transition hover:bg-line ${
        danger ? 'hover:text-red-500' : 'hover:text-fg'
      }`}
    >
      {children}
    </button>
  );
}

function SidebarSection({ title, icon, defaultOpen = false, children }) {
  const Icon = icon;
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-t border-line pt-2">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 rounded-md px-1.5 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-faint transition hover:text-fg"
      >
        <Icon size={13} className="shrink-0" />
        <span className="flex-1 text-left">{title}</span>
        <ChevronDown size={14} className={`shrink-0 transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="scroll-thin max-h-[38vh] overflow-y-auto px-1 pb-1">{children}</div>
      )}
    </div>
  );
}

export default function Sidebar({ onNavigate, fileInputRef, onCollapse }) {
  const conversations = useChatStore((s) => s.conversations);
  const currentId = useChatStore((s) => s.currentId);
  const newConversation = useChatStore((s) => s.newConversation);
  const selectConversation = useChatStore((s) => s.selectConversation);
  const renameConversation = useChatStore((s) => s.renameConversation);
  const deleteConversation = useChatStore((s) => s.deleteConversation);
  const togglePin = useChatStore((s) => s.togglePin);

  const { user } = useUserAuth();
  const [query, setQuery] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);

  const { pinned, today, previous } = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = conversations.filter((c) =>
      !q ? true : c.title.toLowerCase().includes(q)
    );
    const sorted = [...filtered].sort(
      (a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)
    );
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const unpinned = sorted.filter((c) => !c.pinned);
    return {
      pinned: sorted.filter((c) => c.pinned),
      today: unpinned.filter((c) => new Date(c.updatedAt) >= startOfDay),
      previous: unpinned.filter((c) => new Date(c.updatedAt) < startOfDay),
    };
  }, [conversations, query]);

  const select = (id) => {
    selectConversation(id);
    onNavigate?.();
  };
  const startNew = () => {
    newConversation();
    onNavigate?.();
  };

  return (
    <div className="flex h-full flex-col gap-3 p-3">
      <div className="flex items-center gap-2.5 px-1 pt-1">
        {/* Brand logo by default; reveals a collapse button on hover (desktop). */}
        <button
          type="button"
          onClick={onCollapse}
          disabled={!onCollapse}
          title={onCollapse ? 'Collapse sidebar' : 'Privoraa'}
          className="group relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accent-500 to-brand-600 shadow-[0_6px_18px_rgba(43,224,190,.25)]"
        >
          <svg
            viewBox="0 0 24 24"
            className={`h-3.5 w-3.5 text-[#070b14] ${onCollapse ? 'group-hover:opacity-0' : ''}`}
            aria-hidden="true"
          >
            <path fill="none" stroke="currentColor" strokeWidth="2.2" d="M7 11V8a5 5 0 0 1 10 0v3" />
            <rect x="5" y="11" width="14" height="10" rx="2.5" fill="currentColor" />
          </svg>
          {onCollapse && (
            <PanelLeftClose
              size={16}
              className="absolute text-[#070b14] opacity-0 transition group-hover:opacity-100"
            />
          )}
        </button>
        <span className="font-display text-lg font-bold tracking-tight text-fg">Privoraa</span>
        <span className="rounded bg-accent-500/12 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-accent-500">
          2.0
        </span>
      </div>

      <button
        onClick={startNew}
        className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-600 to-accent-500 px-3 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-95"
      >
        <Plus size={16} /> New chat
      </button>

      <div className="relative">
        <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-faint" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search chats…"
          className="w-full rounded-lg border border-line bg-surface py-2 pl-8 pr-3 text-sm placeholder:text-faint focus:border-brand-400 focus:outline-none"
        />
      </div>

      <div className="scroll-thin -mx-1 flex-1 overflow-y-auto px-1">
        {conversations.length === 0 && (
          <p className="px-2 py-6 text-center text-xs text-faint">
            No conversations yet. Start a new chat.
          </p>
        )}

        {pinned.length > 0 && (
          <Section label="Pinned">
            {pinned.map((c) => (
              <ConversationItem
                key={c.id}
                convo={c}
                active={c.id === currentId}
                onSelect={select}
                onRename={renameConversation}
                onDelete={deleteConversation}
                onTogglePin={togglePin}
              />
            ))}
          </Section>
        )}

        {today.length > 0 && (
          <Section label="Today">
            {today.map((c) => (
              <ConversationItem
                key={c.id}
                convo={c}
                active={c.id === currentId}
                onSelect={select}
                onRename={renameConversation}
                onDelete={deleteConversation}
                onTogglePin={togglePin}
              />
            ))}
          </Section>
        )}

        {previous.length > 0 && (
          <Section label="Previous">
            {previous.map((c) => (
              <ConversationItem
                key={c.id}
                convo={c}
                active={c.id === currentId}
                onSelect={select}
                onRename={renameConversation}
                onDelete={deleteConversation}
                onTogglePin={togglePin}
              />
            ))}
          </Section>
        )}

        {query && pinned.length + today.length + previous.length === 0 && (
          <p className="px-2 py-6 text-center text-xs text-faint">No matches.</p>
        )}
      </div>

      {/* Merged from the old right panel: notes (RAG) + usage */}
      <SidebarSection title="Your notes (RAG)" icon={FileText} defaultOpen>
        <DocumentsPanel fileInputRef={fileInputRef} hideHeading />
      </SidebarSection>
      <SidebarSection title="Usage" icon={Activity}>
        <UsagePanel hideHeading />
      </SidebarSection>

      {/* Footer: user + settings */}
      <div className="flex items-center gap-2 border-t border-line pt-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-accent-500 text-xs font-bold text-white">
          {(user?.name || user?.email || 'U').charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{user?.name || 'User'}</p>
          <p className="truncate text-[11px] text-faint">{user?.email}</p>
        </div>
        <button
          onClick={() => setSettingsOpen(true)}
          title="Settings"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted transition hover:bg-surface-2 hover:text-fg"
        >
          <Settings size={16} />
        </button>
      </div>

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}

function Section({ label, children }) {
  return (
    <div className="mb-3">
      <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-faint">
        {label}
      </p>
      <div className="flex flex-col gap-0.5">{children}</div>
    </div>
  );
}
