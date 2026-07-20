import React, { useEffect, useMemo, useState } from 'react';
import {
  Sparkles, Cloud, HardDrive, Check, ChevronDown, ChevronRight, ArrowLeft,
  Zap, Lock, Download, Loader2, Boxes,
} from 'lucide-react';
import { useClickOutside } from './useClickOutside';
import { fetchCatalog, setActiveModel } from '../../lib/modelCatalogService';
import {
  ensureLocalOllama, localHasModel, resetLocalOllama, pullLocalOllama,
} from '../../lib/localOllama';

const SITE_ORIGIN = typeof window !== 'undefined' ? window.location.origin : '';
// Ollama is desktop-only (Win/Mac/Linux). On phones there's no localhost:11434 to
// reach, so we tell mobile users the truth instead of a useless OLLAMA_ORIGINS hint.
const IS_MOBILE =
  typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);

/**
 * Drill-down model picker. Level 1: Auto / Online / Offline. Choosing Online or
 * Offline opens a second view listing that provider's models grouped by task.
 * Offline models are runnable when local Ollama is the live backend and the model
 * is installed; otherwise the row deep-links to download/setup. Selecting sets
 * both the model id and the provider it runs on.
 */

const TASK_LABEL = {
  general: 'General', daily: 'General',
  code: 'Coding', coding: 'Coding',
  reasoning: 'Reasoning',
  fast: 'Fast', lightweight: 'Fast',
  multilingual: 'Multilingual',
  vision: 'Vision',
};
const taskLabel = (c) => TASK_LABEL[c] || (c ? c[0].toUpperCase() + c.slice(1) : 'General');
const TASK_ORDER = ['General', 'Coding', 'Reasoning', 'Fast', 'Multilingual', 'Vision'];

// Shown if the live catalog can't be fetched, so Offline always lists something.
const STATIC_OFFLINE = {
  categories: [
    { key: 'daily', title: 'Daily / General', models: [
      { tag: 'llama3.2:3b', displayName: 'Llama 3.2 3B', sizeGbApprox: 2.0, plan: 'free' },
      { tag: 'qwen2.5:3b', displayName: 'Qwen2.5 3B', sizeGbApprox: 1.9, plan: 'free' },
    ] },
    { key: 'coding', title: 'Coding', models: [
      { tag: 'qwen2.5-coder:3b', displayName: 'Qwen2.5 Coder 3B', sizeGbApprox: 1.9, plan: 'plus' },
    ] },
    { key: 'reasoning', title: 'Reasoning', models: [
      { tag: 'qwen3:4b', displayName: 'Qwen3 4B', sizeGbApprox: 2.6, plan: 'plus' },
    ] },
    { key: 'lightweight', title: 'Lightweight', models: [
      { tag: 'llama3.2:1b', displayName: 'Llama 3.2 1B', sizeGbApprox: 1.3, plan: 'free' },
      { tag: 'gemma3:1b', displayName: 'Gemma 3 1B', sizeGbApprox: 0.8, plan: 'free' },
    ] },
    { key: 'vision', title: 'Vision', models: [
      { tag: 'moondream', displayName: 'Moondream 2', sizeGbApprox: 1.7, plan: 'plus' },
    ] },
  ],
};

function groupOnline(models) {
  const map = new Map();
  for (const m of models) {
    const label = taskLabel(m.category);
    if (!map.has(label)) map.set(label, []);
    map.get(label).push(m);
  }
  return [...map.entries()]
    .sort((a, b) => {
      const ia = TASK_ORDER.indexOf(a[0]); const ib = TASK_ORDER.indexOf(b[0]);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    })
    .map(([label, items]) => ({ label, items }));
}

export default function UnifiedModelPicker({ models = [], value, provider, onChange, localLlm, onManage }) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState('root'); // 'root' | 'online' | 'offline'
  const [catalog, setCatalog] = useState(null);
  const [loadingCat, setLoadingCat] = useState(false);
  const [switching, setSwitching] = useState(null);
  const [browserOllama, setBrowserOllama] = useState(null); // user's own Ollama, reachable from the browser
  const [probing, setProbing] = useState(false); // detection in flight (vs. "detected = null")
  const [pulls, setPulls] = useState({}); // tag -> { percent, status } during a browser-direct download
  // Don't let an outside click close the dropdown while a download is streaming.
  const ref = useClickOutside(() => { if (!Object.keys(pulls).length) setOpen(false); }, open);

  // Ollama is the live local backend (not merely "the active cloud provider is up").
  const ollamaLive = localLlm?.provider === 'ollama' && !!localLlm?.online;

  // A model can run if the backend's Ollama has it OR the user's browser-reachable
  // Ollama has it (the "use my already-installed Ollama in production" path).
  const offlineRunnable = (m) =>
    (ollamaLive && m.installed && !m.locked) || (browserOllama && localHasModel(browserOllama, m.tag));

  // Reset to the top level each open, and detect the user's local Ollama.
  useEffect(() => {
    if (open) {
      setView('root');
      setProbing(true);
      ensureLocalOllama().then(setBrowserOllama).finally(() => setProbing(false));
    }
  }, [open]);

  // After the user fixes OLLAMA_ORIGINS / starts Ollama, re-detect without a reload.
  const reCheckOllama = () => {
    resetLocalOllama();
    setProbing(true);
    ensureLocalOllama().then(setBrowserOllama).finally(() => setProbing(false));
  };

  const loadCatalog = () => {
    if (catalog) return;
    setLoadingCat(true);
    fetchCatalog()
      .then((c) => setCatalog(c && c.categories && c.categories.length ? c : STATIC_OFFLINE))
      .catch(() => setCatalog(STATIC_OFFLINE))
      .finally(() => setLoadingCat(false));
  };

  const currentLabel = useMemo(() => {
    if (!value || value === 'auto') return 'Auto';
    const on = models.find((m) => m.id === value);
    return on ? on.shortName || on.name : value;
  }, [value, models]);

  const HeadIcon = provider === 'offline' ? HardDrive : provider === 'online' ? Cloud : Sparkles;
  const headTone = provider === 'offline' ? 'text-emerald-500' : provider === 'online' ? 'text-sky-500' : 'text-brand-500';

  const close = () => setOpen(false);
  const pickAuto = () => { onChange('auto', 'auto'); close(); };
  const pickOnline = (m) => { onChange(m.id, 'online'); close(); };
  // Select an already-installed model → runs browser-direct in chat.
  const selectModel = async (tag) => {
    setSwitching(tag);
    try {
      await setActiveModel(tag).catch(() => {}); // best-effort; browser-direct doesn't need it
      onChange(tag, 'offline');
    } finally {
      setSwitching(null);
      close();
    }
  };

  // Download a model straight into the user's OWN Ollama (no server hop), then
  // re-detect so it flips to "ready". The dropdown stays open during the pull.
  const startPull = async (tag) => {
    if (!browserOllama || pulls[tag]) return;
    setPulls((p) => ({ ...p, [tag]: { percent: 0, status: 'starting' } }));
    try {
      await pullLocalOllama(browserOllama.base, tag, {
        onProgress: (pr) =>
          setPulls((p) => ({ ...p, [tag]: { percent: pr.percent || 0, status: pr.status } })),
      });
      resetLocalOllama();
      setBrowserOllama(await ensureLocalOllama());
    } catch {
      /* leave as "download"; user can retry */
    } finally {
      setPulls((p) => {
        const n = { ...p };
        delete n[tag];
        return n;
      });
    }
  };

  const pickOffline = (m) => {
    if (offlineRunnable(m)) return selectModel(m.tag);
    if (m.locked) { close(); onManage?.(); return; } // plan-gated → upgrade/setup
    if (browserOllama) return startPull(m.tag); // browser-direct download, in place
    close();
    onManage?.(); // no local Ollama reachable → setup help
  };

  const onlineGroups = groupOnline(models);
  const offlineCats = (catalog?.categories || []).filter((c) => c.key !== 'embeddings');
  const isOn = (id) => provider !== 'offline' && value === id;
  const isOffActive = (tag) => provider === 'offline' && (value === tag || value === `${tag}:latest`);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="dialog"
        title="Choose a model — Auto, Online (cloud) or Offline (on your device)"
        className="control-surface flex h-11 max-w-[160px] items-center gap-2 rounded-xl px-3 text-sm font-medium transition sm:max-w-[240px]"
      >
        <HeadIcon size={15} className={`shrink-0 ${headTone}`} />
        <span className="truncate">{currentLabel}</span>
        <ChevronDown size={15} className="shrink-0 text-muted" />
      </button>

      {open && (
        <div aria-label="Model selection" className="elevated-surface floating-surface scroll-thin fixed inset-x-2 top-[4.5rem] z-30 max-h-[72vh] overflow-y-auto rounded-2xl p-1.5 sm:absolute sm:inset-x-auto sm:left-0 sm:top-auto sm:mt-2 sm:w-[min(22rem,calc(100vw-1.5rem))]">
          {/* ---------------- Level 1: Auto / Online / Offline ---------------- */}
          {view === 'root' && (
            <>
              <Row
                active={!value || value === 'auto'}
                icon={<Sparkles size={16} className="text-brand-500" />}
                title="Auto"
                sub="Smart route — best model per prompt"
                onClick={pickAuto}
              />
              <NavRow
                icon={<Cloud size={16} className="text-sky-500" />}
                title="Online"
                sub="Cloud · free models"
                activeProvider={provider === 'online'}
                onClick={() => setView('online')}
              />
              <NavRow
                icon={<HardDrive size={16} className="text-emerald-500" />}
                title="Offline"
                sub="Run on your device"
                activeProvider={provider === 'offline'}
                onClick={() => { setView('offline'); loadCatalog(); }}
              />
            </>
          )}

          {/* ---------------- Level 2: Online models ---------------- */}
          {view === 'online' && (
            <>
              <BackHeader icon={Cloud} title="Online" sub="cloud · free" tone="text-sky-500" onBack={() => setView('root')} />
              {onlineGroups.length === 0 ? (
                <p className="px-2.5 py-3 text-xs text-muted">No online models available.</p>
              ) : (
                onlineGroups.map((g) => (
                  <div key={g.label}>
                    <GroupLabel>{g.label}</GroupLabel>
                    {g.items.map((m) => (
                      <Row
                        key={m.id}
                        active={isOn(m.id)}
                        icon={<Zap size={15} className="text-sky-500" />}
                        title={m.name}
                        sub={m.description}
                        badge={m.isFree ? 'FREE' : null}
                        onClick={() => pickOnline(m)}
                      />
                    ))}
                  </div>
                ))
              )}
            </>
          )}

          {/* ---------------- Level 2: Offline models ---------------- */}
          {view === 'offline' && (
            <>
              <BackHeader
                icon={HardDrive}
                title="Offline"
                sub={ollamaLive ? 'on your device' : 'run locally'}
                tone="text-emerald-500"
                onBack={() => setView('root')}
              />
              <OllamaStatus
                probing={probing}
                ollama={browserOllama}
                origin={SITE_ORIGIN}
                isMobile={IS_MOBILE}
                onRecheck={reCheckOllama}
                onHelp={() => { close(); onManage?.(); }}
              />
              {/* Everything actually installed in the user's Ollama — including
                  models pulled via `ollama pull` that aren't in the curated list.
                  This is the authoritative "what I can run right now" surface. */}
              {(() => {
                const installed = (browserOllama?.models || []).filter((t) => !/embed/i.test(t));
                if (!installed.length) return null;
                return (
                  <div>
                    <GroupLabel>On your device</GroupLabel>
                    {installed.map((tag) => (
                      <Row
                        key={`dev-${tag}`}
                        active={isOffActive(tag)}
                        icon={<Boxes size={15} className="text-emerald-500" />}
                        title={tag}
                        sub="On your device — ready"
                        trailing={switching === tag ? <Loader2 size={14} className="animate-spin text-muted" /> : null}
                        onClick={() => selectModel(tag)}
                      />
                    ))}
                  </div>
                );
              })()}
              {loadingCat ? (
                <div className="flex items-center gap-2 px-2.5 py-3 text-sm text-muted">
                  <Loader2 size={15} className="animate-spin" /> Loading…
                </div>
              ) : (
                offlineCats.map((c) => (
                  <div key={c.key}>
                    <GroupLabel>{taskLabel(c.key)}</GroupLabel>
                    {c.models.map((m) => {
                      const onDevice = browserOllama && localHasModel(browserOllama, m.tag);
                      const runnable = offlineRunnable(m);
                      const pull = pulls[m.tag];
                      return (
                        <Row
                          key={m.tag}
                          active={isOffActive(m.tag)}
                          icon={<Boxes size={15} className="text-emerald-500" />}
                          title={m.displayName}
                          sub={
                            pull
                              ? `Downloading to your device… ${pull.percent}%`
                              : onDevice
                                ? 'On your device — ready'
                                : m.installed
                                  ? 'Installed'
                                  : m.locked
                                    ? `${(m.plan || '').toUpperCase()} plan`
                                    : `~${m.sizeGbApprox} GB · download`
                          }
                          trailing={
                            pull ? (
                              <span className="text-[11px] tabular-nums text-muted">{pull.percent}%</span>
                            ) : switching === m.tag ? (
                              <Loader2 size={14} className="animate-spin text-muted" />
                            ) : m.locked ? (
                              <Lock size={13} className="text-amber-500" />
                            ) : runnable ? null : (
                              <Download size={13} className="text-muted" />
                            )
                          }
                          onClick={() => pickOffline(m)}
                        />
                      );
                    })}
                  </div>
                ))
              )}
              <div className="my-1 h-px bg-line" />
              <button
                onClick={() => { close(); onManage?.(); }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-brand-500 transition hover:bg-surface-2"
              >
                <Download size={15} /> Browse &amp; download models
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function NavRow({ icon, title, sub, activeProvider, onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition hover:bg-surface-2"
    >
      <div className="shrink-0">{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{title}</span>
          {activeProvider && (
            <span className="rounded bg-brand-500/15 px-1.5 py-px text-[10px] font-semibold text-brand-500">
              SELECTED
            </span>
          )}
        </div>
        <p className="truncate text-xs text-muted">{sub}</p>
      </div>
      <ChevronRight size={16} className="shrink-0 text-muted" />
    </button>
  );
}

function BackHeader({ icon, title, sub, tone, onBack }) {
  const Icon = icon;
  return (
    <button
      onClick={onBack}
      className="mb-1 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition hover:bg-surface-2"
    >
      <ArrowLeft size={16} className="shrink-0 text-muted" />
      <Icon size={14} className={tone} />
      <span className="text-sm font-semibold">{title}</span>
      {sub && <span className="text-[11px] font-normal text-faint">· {sub}</span>}
    </button>
  );
}

function GroupLabel({ children }) {
  return <p className="px-2.5 pb-0.5 pt-1.5 text-[10px] font-medium uppercase tracking-wide text-faint/70">{children}</p>;
}

/**
 * Connection status for the user's OWN Ollama (browser → localhost:11434).
 * When unreachable (the common cause is OLLAMA_ORIGINS not allowing this site),
 * every model would otherwise silently show "download" — so spell out the fix
 * and offer a re-check that doesn't need a page reload.
 */
function OllamaStatus({ probing, ollama, origin, isMobile, onRecheck, onHelp }) {
  if (probing && !ollama) {
    return (
      <div className="mx-1 mb-1 flex items-center gap-2 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs text-muted">
        <Loader2 size={13} className="shrink-0 animate-spin" /> Looking for your local Ollama…
      </div>
    );
  }
  // Phones can't run Ollama — don't show a desktop command they can't use.
  if (!ollama && isMobile) {
    return (
      <div className="mx-1 mb-1 rounded-lg border border-sky-500/30 bg-sky-500/10 px-2.5 py-2 text-xs">
        <p className="font-medium text-sky-600 dark:text-sky-400">On-device models need a computer.</p>
        <p className="mt-1 text-muted">
          Offline models run through Ollama, which only works on desktop (Windows, macOS, Linux) —
          not on phones. On mobile, use <span className="font-medium text-fg">Online</span> or{' '}
          <span className="font-medium text-fg">Auto</span>. To run your own local models, open
          Vedix on your computer.
        </p>
      </div>
    );
  }
  if (ollama) {
    const n = ollama.models?.length || 0;
    return (
      <div className="mx-1 mb-1 flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1.5 text-xs text-emerald-600 dark:text-emerald-400">
        <Check size={13} className="shrink-0" />
        <span className="flex-1 truncate">
          Connected to your Ollama · {n} model{n === 1 ? '' : 's'} on your device
        </span>
        <button onClick={onRecheck} title="Re-check" className="shrink-0 hover:underline">Refresh</button>
      </div>
    );
  }
  return (
    <div className="mx-1 mb-1 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-2 text-xs">
      <p className="font-medium text-amber-600 dark:text-amber-400">Can’t see your local Ollama from this site.</p>
      <p className="mt-1 text-muted">If Ollama is installed, allow this site then restart it (Chrome/Edge):</p>
      <code className="mt-1 block overflow-x-auto whitespace-nowrap rounded bg-bg px-2 py-1 font-mono text-[11px] text-fg">
        OLLAMA_ORIGINS={origin || '*'}
      </code>
      <div className="mt-1.5 flex items-center gap-3">
        <button onClick={onRecheck} className="font-medium text-brand-500 hover:underline">Re-check</button>
        <button onClick={onHelp} className="font-medium text-brand-500 hover:underline">Setup guide</button>
      </div>
    </div>
  );
}

function Row({ active, icon, title, sub, badge, trailing, onClick }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition ${
        active ? 'bg-brand-500/10' : 'hover:bg-surface-2'
      }`}
    >
      <div className="mt-0.5 shrink-0">{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{title}</span>
          {badge && (
            <span className="rounded bg-emerald-500/15 px-1.5 py-px text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
              {badge}
            </span>
          )}
        </div>
        {sub && <p className="truncate text-xs text-muted">{sub}</p>}
      </div>
      {active ? (
        <Check size={15} className="mt-0.5 shrink-0 text-brand-500" />
      ) : (
        trailing && <div className="mt-0.5 shrink-0">{trailing}</div>
      )}
    </button>
  );
}
