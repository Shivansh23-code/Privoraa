import React, { useCallback, useEffect, useState } from 'react';
import {
  X, Download, Check, Trash2, AlertTriangle, Loader2, ArrowLeft,
  HardDrive, Cpu, Boxes, ServerCog, CheckCircle2, Star, Eye,
} from 'lucide-react';
import {
  fetchCatalog, fetchInstalled, fetchActiveModel, setActiveModel,
  deleteModel, pullModel, fetchLlmHealth, formatBytes,
} from '../../lib/modelCatalogService';

/** Badge derived from the curated tier + the computed fits-this-machine flag. */
function fitBadge(m) {
  if (m.tier === 'not_recommended' || (!m.fitsThisMachine && m.tier !== 'stretch')) {
    return { label: 'Too large', tone: 'text-red-500 bg-red-500/10', icon: AlertTriangle };
  }
  if (m.tier === 'stretch') {
    return { label: 'Stretch', tone: 'text-amber-500 bg-amber-500/10', icon: AlertTriangle };
  }
  return { label: 'Fits your machine', tone: 'text-emerald-500 bg-emerald-500/10', icon: Check };
}

const CATEGORY_ICONS = {
  daily: Boxes, coding: Cpu, reasoning: ServerCog, lightweight: Star, vision: Eye, embeddings: HardDrive,
};

export default function ModelCatalogModal({ open, onClose, onActiveChange }) {
  const [loading, setLoading] = useState(true);
  const [health, setHealth] = useState(null);
  const [catalog, setCatalog] = useState(null);
  const [active, setActive] = useState(null);
  const [installedRaw, setInstalledRaw] = useState([]);
  const [selectedCat, setSelectedCat] = useState(null); // category key or 'installed'
  const [pulls, setPulls] = useState({}); // tag -> {percent, status}
  const [busy, setBusy] = useState({}); // tag -> 'active' | 'delete'
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    try {
      const [h, c, a] = await Promise.all([fetchLlmHealth(), fetchCatalog(), fetchActiveModel()]);
      setHealth(h);
      setCatalog(c);
      setActive(a?.active || null);
      if (h?.running) {
        const inst = await fetchInstalled().catch(() => null);
        setInstalledRaw(inst?.models || []);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    reload();
  }, [open, reload]);

  if (!open) return null;

  const handleInstall = async (tag) => {
    setError(null);
    setPulls((p) => ({ ...p, [tag]: { percent: 0, status: 'starting' } }));
    try {
      await pullModel(tag, {
        onProgress: (pr) =>
          setPulls((p) => ({ ...p, [tag]: { percent: pr.percent ?? 0, status: pr.status } })),
      });
      await reload();
    } catch (e) {
      setError(`Install failed: ${e.message}`);
    } finally {
      setPulls((p) => {
        const next = { ...p };
        delete next[tag];
        return next;
      });
    }
  };

  const handleActivate = async (tag) => {
    setBusy((b) => ({ ...b, [tag]: 'active' }));
    try {
      const r = await setActiveModel(tag);
      setActive(r?.active || tag);
      onActiveChange?.(r?.active || tag);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy((b) => ({ ...b, [tag]: undefined }));
    }
  };

  const handleDelete = async (tag) => {
    setBusy((b) => ({ ...b, [tag]: 'delete' }));
    try {
      await deleteModel(tag);
      await reload();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy((b) => ({ ...b, [tag]: undefined }));
    }
  };

  const categories = catalog?.categories || [];
  const ollamaDown = health && !health.running;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-line bg-elevated shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-line px-5 py-4">
          {selectedCat && (
            <button
              aria-label="Back"
              onClick={() => setSelectedCat(null)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-fg"
            >
              <ArrowLeft size={18} />
            </button>
          )}
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold">Local models</h2>
            <p className="truncate text-xs text-muted">
              Download models to run privately on your machine
              {health?.version ? ` · Ollama ${health.version}` : ''}
              {catalog ? ` · ${catalog.ramBudgetGb} GB budget` : ''}
            </p>
          </div>
          {active && (
            <span className="hidden items-center gap-1.5 rounded-full bg-brand-500/10 px-2.5 py-1 text-xs font-medium text-brand-500 sm:flex">
              <CheckCircle2 size={13} /> Active: {active}
            </span>
          )}
          <button
            aria-label="Close"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-fg"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="scroll-thin flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="flex h-full items-center justify-center text-muted">
              <Loader2 className="animate-spin" /> <span className="ml-2">Loading catalog…</span>
            </div>
          ) : ollamaDown ? (
            <SetupCard health={health} onRetry={reload} />
          ) : (
            <>
              {error && (
                <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-500">
                  {error}
                </div>
              )}

              {!selectedCat && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <button
                    onClick={() => setSelectedCat('installed')}
                    className="flex items-center gap-3 rounded-xl border border-line bg-surface p-4 text-left transition hover:border-brand-400 hover:bg-surface-2"
                  >
                    <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-500/10 text-brand-500">
                      <HardDrive size={20} />
                    </span>
                    <div>
                      <p className="text-sm font-semibold">Installed</p>
                      <p className="text-xs text-muted">{installedRaw.length} on disk · manage / delete</p>
                    </div>
                  </button>
                  {categories.map((c) => {
                    const Icon = CATEGORY_ICONS[c.key] || Boxes;
                    return (
                      <button
                        key={c.key}
                        onClick={() => setSelectedCat(c.key)}
                        className="flex items-center gap-3 rounded-xl border border-line bg-surface p-4 text-left transition hover:border-brand-400 hover:bg-surface-2"
                      >
                        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-500/10 text-accent-500">
                          <Icon size={20} />
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold">{c.title}</p>
                          <p className="truncate text-xs text-muted">{c.blurb}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {selectedCat === 'installed' && (
                <InstalledView
                  models={installedRaw}
                  active={active}
                  busy={busy}
                  onActivate={handleActivate}
                  onDelete={handleDelete}
                />
              )}

              {selectedCat && selectedCat !== 'installed' && (
                <div className="flex flex-col gap-3">
                  {(categories.find((c) => c.key === selectedCat)?.models || []).map((m) => (
                    <ModelCard
                      key={m.tag}
                      m={m}
                      active={active}
                      pull={pulls[m.tag]}
                      busy={busy[m.tag]}
                      onInstall={() => handleInstall(m.tag)}
                      onActivate={() => handleActivate(m.tag)}
                      onDelete={() => handleDelete(m.tag)}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ModelCard({ m, active, pull, busy, onInstall, onActivate, onDelete }) {
  const badge = fitBadge(m);
  const BadgeIcon = badge.icon;
  const isActive = active === m.tag || active === `${m.tag}:latest`;
  const installing = !!pull;

  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold">{m.displayName}</h3>
            {m.isDefault && (
              <span className="rounded bg-brand-500/15 px-1.5 py-px text-[10px] font-semibold text-brand-500">
                RECOMMENDED
              </span>
            )}
            <span className={`flex items-center gap-1 rounded px-1.5 py-px text-[10px] font-semibold ${badge.tone}`}>
              <BadgeIcon size={10} /> {badge.label}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted">{m.blurb}</p>
          <p className="mt-1 font-mono text-[11px] text-muted">
            {m.tag} · ~{m.sizeGbApprox} GB
          </p>
        </div>

        <div className="shrink-0">
          {m.installed ? (
            <div className="flex items-center gap-1.5">
              {isActive ? (
                <span className="flex items-center gap-1 rounded-lg bg-brand-500/10 px-2.5 py-1.5 text-xs font-medium text-brand-500">
                  <CheckCircle2 size={14} /> Active
                </span>
              ) : (
                <button
                  onClick={onActivate}
                  disabled={busy === 'active'}
                  className="flex items-center gap-1 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs font-medium hover:border-brand-400 hover:bg-surface-2 disabled:opacity-50"
                >
                  {busy === 'active' ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  Set active
                </button>
              )}
              <button
                onClick={onDelete}
                disabled={busy === 'delete'}
                title="Delete to reclaim disk"
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-line text-muted hover:border-red-400 hover:text-red-500 disabled:opacity-50"
              >
                {busy === 'delete' ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
              </button>
            </div>
          ) : installing ? (
            <span className="flex items-center gap-1 rounded-lg bg-surface-2 px-2.5 py-1.5 text-xs font-medium text-muted">
              <Loader2 size={14} className="animate-spin" /> {pull.percent}%
            </span>
          ) : (
            <button
              onClick={onInstall}
              className="flex items-center gap-1 rounded-lg bg-brand-500 px-2.5 py-1.5 text-xs font-medium text-white transition hover:bg-brand-600"
            >
              <Download size={14} /> Install
            </button>
          )}
        </div>
      </div>

      {installing && (
        <div className="mt-3">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full rounded-full bg-brand-500 transition-all"
              style={{ width: `${pull.percent || 0}%` }}
            />
          </div>
          <p className="mt-1 truncate text-[11px] text-muted">{pull.status}</p>
        </div>
      )}
    </div>
  );
}

function InstalledView({ models, active, busy, onActivate, onDelete }) {
  if (!models.length) {
    return <p className="py-10 text-center text-sm text-muted">No models installed yet. Pick a category to download one.</p>;
  }
  return (
    <div className="flex flex-col gap-2">
      {models.map((m) => {
        const isActive = active === m.name;
        return (
          <div key={m.name} className="flex items-center gap-3 rounded-xl border border-line bg-surface p-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-2 text-muted">
              <Boxes size={18} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-mono text-sm font-medium">{m.name}</p>
              <p className="text-xs text-muted">{formatBytes(m.size)}</p>
            </div>
            {isActive ? (
              <span className="flex items-center gap-1 rounded-lg bg-brand-500/10 px-2.5 py-1.5 text-xs font-medium text-brand-500">
                <CheckCircle2 size={14} /> Active
              </span>
            ) : (
              <button
                onClick={() => onActivate(m.name)}
                disabled={busy[m.name] === 'active'}
                className="flex items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium hover:border-brand-400 hover:bg-surface-2 disabled:opacity-50"
              >
                {busy[m.name] === 'active' ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                Set active
              </button>
            )}
            <button
              onClick={() => onDelete(m.name)}
              disabled={busy[m.name] === 'delete'}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-line text-muted hover:border-red-400 hover:text-red-500 disabled:opacity-50"
            >
              {busy[m.name] === 'delete' ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            </button>
          </div>
        );
      })}
    </div>
  );
}

function SetupCard({ health, onRetry }) {
  return (
    <div className="mx-auto max-w-lg rounded-2xl border border-line bg-surface p-6 text-center">
      <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500">
        <ServerCog size={24} />
      </span>
      <h3 className="text-base font-semibold">
        {health?.ollamaInstalled ? 'Ollama isn’t running' : 'Ollama isn’t installed'}
      </h3>
      <p className="mt-1 text-sm text-muted">
        Privoraa runs models locally through Ollama. Pulling a model needs internet once;
        every chat afterward is fully offline.
      </p>
      <ol className="mx-auto mt-4 max-w-sm space-y-2 text-left text-sm">
        <li className="flex gap-2">
          <span className="font-semibold text-brand-500">1.</span>
          Install Ollama from{' '}
          <a href="https://ollama.com/download" target="_blank" rel="noreferrer" className="text-brand-500 underline">
            ollama.com/download
          </a>
        </li>
        <li className="flex gap-2">
          <span className="font-semibold text-brand-500">2.</span>
          Start it, then pull the starters:
          <code className="ml-1 rounded bg-surface-2 px-1 font-mono text-xs">ollama pull llama3.2:3b</code>
        </li>
        <li className="flex gap-2">
          <span className="font-semibold text-brand-500">3.</span>
          Come back and hit retry.
        </li>
      </ol>
      <button
        onClick={onRetry}
        className="mt-5 rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600"
      >
        Retry connection
      </button>
    </div>
  );
}
