import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  X, Download, Check, Trash2, AlertTriangle, Loader2, ArrowLeft,
  HardDrive, Cpu, Boxes, ServerCog, CheckCircle2, Star, Eye,
  Lock, Sparkles, Zap, Crown,
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

/** Subscription-tier metadata for badges, the plan chip, and the upgrade panel. */
const PLAN_META = {
  free: { label: 'Free', rank: 0, icon: Sparkles, tone: 'text-muted bg-surface-2' },
  plus: { label: 'Plus', rank: 1, icon: Zap, tone: 'text-brand-500 bg-brand-500/10' },
  pro: { label: 'Pro', rank: 2, icon: Crown, tone: 'text-slate-400 bg-slate-400/10 dark:text-slate-300' },
};
const planMeta = (p) => PLAN_META[(p || 'free').toLowerCase()] || PLAN_META.free;

/** What each tier unlocks — drives the upgrade panel. */
const PLAN_TIERS = [
  { key: 'free', price: 'Free', tagline: 'Get started, fully offline', perks: ['Daily & lightweight chat models', 'Embeddings for document chat', 'Run privately on your machine'] },
  { key: 'plus', price: 'Coming soon', tagline: 'For everyday power users', perks: ['Everything in Free', 'Coding & reasoning models', 'Vision (read images)', 'Larger 4B models'] },
  { key: 'pro', price: 'Coming soon', tagline: 'Biggest models, best quality', perks: ['Everything in Plus', '7B+ models, top quality', 'Every category unlocked', 'Priority new models'] },
];

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
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  const reload = useCallback(async () => {
    setError(null);
    // Settle each independently: a transient failure of one call (e.g. Render
    // cold-start) must NOT blank the whole modal. The catalog is the essential
    // one — health/active are best-effort.
    const [h, c, a] = await Promise.allSettled([
      fetchLlmHealth(),
      fetchCatalog(),
      fetchActiveModel(),
    ]);
    const health = h.status === 'fulfilled' ? h.value : null;
    const cat = c.status === 'fulfilled' ? c.value : null;
    setHealth(health);
    setCatalog(cat);
    setActive(a.status === 'fulfilled' ? a.value?.active || null : null);
    if (health?.running) {
      const inst = await fetchInstalled().catch(() => null);
      setInstalledRaw(inst?.models || []);
    }
    // Only surface an error if the essential catalog itself couldn't load.
    if (!cat) {
      const reason = c.reason?.message || '';
      setError(
        /failed to fetch|networkerror|load failed/i.test(reason)
          ? 'Couldn’t reach the server — it may be waking up from sleep. Give it a few seconds and retry.'
          : reason || 'Couldn’t load the model catalog.'
      );
    }
    setLoading(false);
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
  // Ollama is usable only when it's the live LOCAL runtime — not merely that the
  // active provider (e.g. cloud OpenRouter) is reachable. In cloud there's no
  // Ollama, so installs would fail; show the setup/get-the-app card instead.
  const ollamaLive = health?.provider === 'ollama' && health?.running;
  const ollamaDown = health && !ollamaLive;
  const userPlan = (catalog?.userPlan || 'free').toLowerCase();
  const PlanChipIcon = planMeta(userPlan).icon;

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
              {ollamaLive && health?.version ? ` · Ollama ${health.version}` : ''}
              {catalog ? ` · ${catalog.ramBudgetGb} GB budget` : ''}
            </p>
          </div>
          {active && (
            <span className="hidden items-center gap-1.5 rounded-full bg-brand-500/10 px-2.5 py-1 text-xs font-medium text-brand-500 sm:flex">
              <CheckCircle2 size={13} /> Active: {active}
            </span>
          )}
          <button
            onClick={() => setUpgradeOpen(true)}
            title="Your plan — see what each tier unlocks"
            className={`flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-xs font-medium transition hover:border-brand-400 ${planMeta(userPlan).tone}`}
          >
            <PlanChipIcon size={13} /> {planMeta(userPlan).label}
          </button>
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
          ) : !catalog && error ? (
            <div className="mx-auto max-w-md rounded-2xl border border-line bg-surface p-6 text-center">
              <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500">
                <AlertTriangle size={24} />
              </span>
              <h3 className="text-base font-semibold">Couldn’t load the catalog</h3>
              <p className="mt-1 text-sm text-muted">{error}</p>
              <button
                onClick={() => { setLoading(true); reload(); }}
                className="mt-5 inline-flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600"
              >
                <Loader2 size={15} className={loading ? 'animate-spin' : 'hidden'} /> Retry
              </button>
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
                    // Category is "locked" only if every model in it is above the plan.
                    const allLocked = c.models?.length > 0 && c.models.every((x) => x.locked);
                    const gatePlan = allLocked
                      ? c.models.reduce((lo, x) => (planMeta(x.plan).rank < planMeta(lo).rank ? x.plan : lo), c.models[0].plan)
                      : null;
                    return (
                      <button
                        key={c.key}
                        onClick={() => setSelectedCat(c.key)}
                        className="flex items-center gap-3 rounded-xl border border-line bg-surface p-4 text-left transition hover:border-brand-400 hover:bg-surface-2"
                      >
                        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-500/10 text-accent-500">
                          <Icon size={20} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="flex items-center gap-1.5 text-sm font-semibold">
                            {c.title}
                            {allLocked && (
                              <span className={`flex items-center gap-0.5 rounded px-1 py-px text-[10px] font-semibold ${planMeta(gatePlan).tone}`}>
                                <Lock size={9} /> {planMeta(gatePlan).label}
                              </span>
                            )}
                          </p>
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
                      onUpgrade={() => setUpgradeOpen(true)}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {upgradeOpen && (
          <UpgradePanel currentPlan={userPlan} onClose={() => setUpgradeOpen(false)} />
        )}
      </div>
    </div>
  );
}

function UpgradePanel({ currentPlan, onClose }) {
  return (
    <div className="absolute inset-0 z-10 flex flex-col rounded-2xl bg-elevated/95 backdrop-blur-sm">
      <div className="flex items-center gap-3 border-b border-line px-5 py-4">
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold">Plans & models</h2>
          <p className="truncate text-xs text-muted">
            Bigger models and more categories unlock with higher tiers — all run offline on your machine.
          </p>
        </div>
        <button
          aria-label="Close"
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-fg"
        >
          <X size={18} />
        </button>
      </div>
      <div className="scroll-thin flex-1 overflow-y-auto p-5">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {PLAN_TIERS.map((t) => {
            const meta = planMeta(t.key);
            const Icon = meta.icon;
            const isCurrent = t.key === currentPlan;
            return (
              <div
                key={t.key}
                className={`flex flex-col rounded-xl border bg-surface p-4 ${isCurrent ? 'border-brand-400 ring-1 ring-brand-400/40' : 'border-line'}`}
              >
                <div className="flex items-center gap-2">
                  <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${meta.tone}`}>
                    <Icon size={16} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{meta.label}</p>
                    <p className="truncate text-[11px] text-muted">{t.tagline}</p>
                  </div>
                </div>
                <p className="mt-3 text-lg font-bold">{t.price}</p>
                <ul className="mt-3 flex-1 space-y-1.5">
                  {t.perks.map((p) => (
                    <li key={p} className="flex items-start gap-1.5 text-xs text-muted">
                      <Check size={13} className="mt-0.5 shrink-0 text-emerald-500" /> {p}
                    </li>
                  ))}
                </ul>
                <button
                  disabled={isCurrent || t.key === 'free'}
                  className={`mt-4 w-full rounded-lg px-3 py-2 text-xs font-semibold transition ${
                    isCurrent
                      ? 'cursor-default bg-surface-2 text-muted'
                      : t.key === 'free'
                        ? 'cursor-default bg-surface-2 text-muted'
                        : 'bg-gradient-to-r from-brand-600 to-accent-500 text-white hover:opacity-95'
                  }`}
                >
                  {isCurrent ? 'Your plan' : t.key === 'free' ? 'Included' : `Get ${meta.label}`}
                </button>
              </div>
            );
          })}
        </div>
        <p className="mt-4 text-center text-[11px] text-faint">
          Paid plans are coming soon — Free is fully usable today. Models are open-source, run locally; Privoraa curates and manages them for you.
        </p>
      </div>
    </div>
  );
}

function ModelCard({ m, active, pull, busy, onInstall, onActivate, onDelete, onUpgrade }) {
  const badge = fitBadge(m);
  const BadgeIcon = badge.icon;
  const isActive = active === m.tag || active === `${m.tag}:latest`;
  const installing = !!pull;
  const locked = m.locked && !m.installed;
  const pm = planMeta(m.plan);

  return (
    <div className={`rounded-xl border bg-surface p-4 ${locked ? 'border-line/60' : 'border-line'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className={`text-sm font-semibold ${locked ? 'text-fg/70' : ''}`}>{m.displayName}</h3>
            {m.isDefault && (
              <span className="rounded bg-brand-500/15 px-1.5 py-px text-[10px] font-semibold text-brand-500">
                RECOMMENDED
              </span>
            )}
            {m.plan && m.plan !== 'free' && (
              <span className={`flex items-center gap-1 rounded px-1.5 py-px text-[10px] font-semibold ${pm.tone}`}>
                {locked ? <Lock size={9} /> : <pm.icon size={10} />} {pm.label}
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
          ) : locked ? (
            <button
              onClick={onUpgrade}
              title={`Requires the ${pm.label} plan`}
              className={`flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition hover:border-brand-400 ${pm.tone}`}
            >
              <Lock size={13} /> Unlock
            </button>
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
  // Cloud: the active provider isn't Ollama, so there's no local runtime here.
  const isCloud = health && health.provider !== 'ollama';
  return (
    <div className="mx-auto max-w-lg rounded-2xl border border-line bg-surface p-6 text-center">
      <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500">
        <ServerCog size={24} />
      </span>
      <h3 className="text-base font-semibold">
        {isCloud
          ? 'Run these models on your device'
          : health?.ollamaInstalled
            ? 'Ollama isn’t running'
            : 'Ollama isn’t installed'}
      </h3>
      <p className="mt-1 text-sm text-muted">
        {isCloud
          ? 'These models run privately on your own computer — nothing leaves your device. The cloud app uses online models; to download and run local ones, use Privoraa with Ollama on your machine.'
          : 'Privoraa runs models locally through Ollama. Pulling a model needs internet once; every chat afterward is fully offline.'}
      </p>
      <ol className="mx-auto mt-4 max-w-sm space-y-2 text-left text-sm">
        <li className="flex gap-2">
          <span className="font-semibold text-brand-500">1.</span>
          Get the free engine from{' '}
          <Link to="/download" className="text-brand-500 underline">
            Privoraa’s download page
          </Link>
        </li>
        <li className="flex gap-2">
          <span className="font-semibold text-brand-500">2.</span>
          Start it, then pull a model:
          <code className="ml-1 rounded bg-surface-2 px-1 font-mono text-xs">ollama pull llama3.2:3b</code>
        </li>
        <li className="flex gap-2">
          <span className="font-semibold text-brand-500">3.</span>
          {isCloud ? 'Open Privoraa on that machine to run it.' : 'Come back and hit retry.'}
        </li>
      </ol>
      <button
        onClick={onRetry}
        className="mt-5 rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600"
      >
        {isCloud ? 'Check again' : 'Retry connection'}
      </button>
    </div>
  );
}
