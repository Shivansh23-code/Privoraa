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
} from 'lucide-react';
import { useChatStore } from '../../store/chatStore';

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

export default function Sidebar({ onNavigate }) {
  const conversations = useChatStore((s) => s.conversations);
  const currentId = useChatStore((s) => s.currentId);
  const newConversation = useChatStore((s) => s.newConversation);
  const selectConversation = useChatStore((s) => s.selectConversation);
  const renameConversation = useChatStore((s) => s.renameConversation);
  const deleteConversation = useChatStore((s) => s.deleteConversation);
  const togglePin = useChatStore((s) => s.togglePin);

  const [query, setQuery] = useState('');

  const { pinned, recent } = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = conversations.filter((c) =>
      !q ? true : c.title.toLowerCase().includes(q)
    );
    const sorted = [...filtered].sort(
      (a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)
    );
    return {
      pinned: sorted.filter((c) => c.pinned),
      recent: sorted.filter((c) => !c.pinned),
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
      <div className="flex items-center gap-2 px-1 pt-1">
        <span className="font-display text-lg font-bold text-brand-500">Privoraa</span>
        <span className="rounded bg-brand-500/12 px-1.5 py-0.5 text-[10px] font-semibold text-brand-500">
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

        {recent.length > 0 && (
          <Section label={pinned.length ? 'Recent' : 'Chats'}>
            {recent.map((c) => (
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

        {query && pinned.length + recent.length === 0 && (
          <p className="px-2 py-6 text-center text-xs text-faint">No matches.</p>
        )}
      </div>
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
