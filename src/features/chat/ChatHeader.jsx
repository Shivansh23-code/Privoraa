import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Menu,
  LogOut,
  User as UserIcon,
  ChevronDown,
  Cloud,
  CloudOff,
  HardDrive,
  Gem,
  Zap,
  Crown,
} from 'lucide-react';
import UnifiedModelPicker from './UnifiedModelPicker';
import OfflineOffer from './OfflineOffer';
import { useUserAuth } from '../../context/UserAuthContext';
import { useClickOutside } from './useClickOutside';
import { useChatStore } from '../../store/chatStore';
import { planLabel, planTheme } from '../../lib/plans';

const PLAN_ICON = { gem: Gem, zap: Zap, crown: Crown };

function EditableTitle() {
  const convo = useChatStore((s) =>
    s.conversations.find((c) => c.id === s.currentId)
  );
  const renameConversation = useChatStore((s) => s.renameConversation);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  if (!convo) return null;

  const commit = () => {
    renameConversation(convo.id, draft);
    setEditing(false);
  };

  return editing ? (
    <input
      autoFocus
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit();
        if (e.key === 'Escape') setEditing(false);
      }}
      className="w-44 rounded-md border border-brand-400 bg-bg px-2 py-1 text-sm font-medium focus:outline-none"
    />
  ) : (
    <button
      onClick={() => {
        setDraft(convo.title);
        setEditing(true);
      }}
      title="Rename conversation"
      className="hidden max-w-[180px] truncate rounded-md px-2 py-1 text-sm font-medium text-fg/90 transition hover:bg-surface-2 md:block"
    >
      {convo.title}
    </button>
  );
}

export default function ChatHeader({
  models,
  model,
  modelProvider,
  onModelSelect,
  onToggleSidebar,
  onOpenModels,
  localLlm,
  usingMock,
}) {
  const { user, logOut } = useUserAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [offerOpen, setOfferOpen] = useState(false);
  const menuRef = useClickOutside(() => setMenuOpen(false), menuOpen);

  // When the local provider is active, the chat runs on the user's active Ollama
  // model — bind the header to it instead of the cloud model picker.
  const isLocal = localLlm?.provider === 'ollama';

  // Per-plan theming: chip, avatar ring, and a top accent bar reflect the tier.
  const theme = planTheme(user?.plan);
  const PlanIcon = PLAN_ICON[theme.iconKey] || Gem;
  const isPaid = (user?.plan || 'FREE') !== 'FREE';

  return (
    <>
      <header className="relative z-30 flex items-center gap-2 border-b border-line bg-bg/80 px-3 py-2.5 backdrop-blur">
      <div className={`pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r ${theme.accent}`} />
      <button
        onClick={onToggleSidebar}
        className="flex h-9 w-9 items-center justify-center rounded-lg text-muted transition hover:bg-surface-2 hover:text-fg lg:hidden"
        title="Menu"
      >
        <Menu size={18} />
      </button>

      <div className="flex min-w-0 flex-1 items-center gap-2">
        <EditableTitle />
        <UnifiedModelPicker
          models={models}
          value={model}
          provider={modelProvider}
          onChange={(m, p) => {
            onModelSelect?.(m, p);
            if (p === 'offline') localLlm.refresh?.();
          }}
          localLlm={localLlm}
          onManage={onOpenModels}
        />
      </div>

      {/* Backend status pill */}
      {isLocal ? (
        localLlm.online ? (
          <span
            title={`Running locally on Ollama${localLlm.version ? ` ${localLlm.version}` : ''} — fully offline, nothing leaves your machine`}
            className="hidden items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 sm:flex"
          >
            <HardDrive size={12} /> Local · offline
          </span>
        ) : (
          <button
            onClick={onOpenModels}
            title="Ollama isn't running — click to set it up"
            className="hidden items-center gap-1 rounded-full bg-amber-500/10 px-2 py-1 text-[11px] font-medium text-amber-600 dark:text-amber-400 sm:flex"
          >
            <CloudOff size={12} /> Ollama offline
          </button>
        )
      ) : (
        <span
          title={usingMock ? 'Backend offline — using local demo engine' : 'Connected to backend'}
          className={`hidden items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium sm:flex ${
            usingMock
              ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
              : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
          }`}
        >
          {usingMock ? <CloudOff size={12} /> : <Cloud size={12} />}
          {usingMock ? 'Demo' : 'Live'}
        </span>
      )}

      {/* Plan chip — Free users see "Upgrade"; paid see their tier. */}
      <Link
        to="/plans"
        title={isPaid ? `${planLabel(user.plan)} plan` : 'See plans & upgrade'}
        className={`hidden items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition sm:flex ${theme.chip}`}
      >
        <PlanIcon size={12} />
        {isPaid ? planLabel(user.plan) : 'Upgrade'}
      </Link>

      {/* User menu */}
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setMenuOpen((o) => !o)}
          className="flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2 py-1.5 text-sm transition hover:bg-surface-2"
        >
          <span className={`flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br ${theme.ring} text-[11px] font-bold text-white`}>
            {(user?.name || user?.email || 'U').charAt(0).toUpperCase()}
          </span>
          <ChevronDown size={14} className="text-muted" />
        </button>

        {menuOpen && (
          <div className="absolute right-0 z-30 mt-2 w-56 overflow-hidden rounded-xl border border-line bg-elevated p-1.5 shadow-xl">
            <div className="flex items-center gap-2 px-2.5 py-2">
              <UserIcon size={16} className="text-muted" />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{user?.name || 'User'}</p>
                <p className="truncate text-xs text-muted">{user?.email}</p>
              </div>
            </div>
            <div className="my-1 h-px bg-line" />
            <Link
              to="/plans"
              onClick={() => setMenuOpen(false)}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition hover:bg-surface-2"
            >
              <Gem size={15} className="text-brand-500" /> Plans &amp; upgrade
            </Link>
            <button
              onClick={() => {
                setMenuOpen(false);
                setOfferOpen(true);
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition hover:bg-surface-2"
            >
              <HardDrive size={15} className="text-brand-500" /> Get Privoraa Offline
            </button>
            <div className="my-1 h-px bg-line" />
            <button
              onClick={logOut}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-red-500 transition hover:bg-red-500/10"
            >
              <LogOut size={15} /> Log out
            </button>
          </div>
        )}
      </div>
      </header>

      <OfflineOffer open={offerOpen} onClose={() => setOfferOpen(false)} />
    </>
  );
}
