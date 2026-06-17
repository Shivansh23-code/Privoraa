import React, { useMemo, useState } from 'react';
import {
  Sparkles, Cloud, HardDrive, Check, ChevronDown, Zap, Lock, Download, Loader2, Boxes,
} from 'lucide-react';
import { useClickOutside } from './useClickOutside';
import { fetchCatalog, setActiveModel } from '../../lib/modelCatalogService';

/**
 * One picker for every model: Auto (routes per-prompt), Online (OpenRouter free,
 * grouped by task) and Offline (Ollama, grouped by task). Offline models are
 * selectable when local Ollama is live and the model is installed; otherwise the
 * row deep-links to the download/setup catalog. Selecting sets both the model id
 * and the provider it runs on, so the chat request targets the right backend.
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
  const [catalog, setCatalog] = useState(null);
  const [loadingCat, setLoadingCat] = useState(false);
  const [switching, setSwitching] = useState(null);
  const ref = useClickOutside(() => setOpen(false), open);

  const ollamaLive = !!localLlm?.online;

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && !catalog) {
      setLoadingCat(true);
      fetchCatalog()
        .then(setCatalog)
        .catch(() => setCatalog({ categories: [] }))
        .finally(() => setLoadingCat(false));
    }
  };

  const currentLabel = useMemo(() => {
    if (!value || value === 'auto') return 'Auto';
    const on = models.find((m) => m.id === value);
    return on ? on.shortName || on.name : value;
  }, [value, models]);

  const HeadIcon = provider === 'offline' ? HardDrive : provider === 'online' ? Cloud : Sparkles;
  const headTone = provider === 'offline' ? 'text-emerald-500' : provider === 'online' ? 'text-sky-500' : 'text-brand-500';

  const pickAuto = () => { onChange('auto', 'auto'); setOpen(false); };
  const pickOnline = (m) => { onChange(m.id, 'online'); setOpen(false); };
  const pickOffline = async (m) => {
    if (ollamaLive && m.installed && !m.locked) {
      setSwitching(m.tag);
      try {
        await setActiveModel(m.tag);
        onChange(m.tag, 'offline');
      } finally {
        setSwitching(null);
        setOpen(false);
      }
    } else {
      setOpen(false);
      onManage?.(); // download / setup / upgrade lives in the catalog modal
    }
  };

  const onlineGroups = groupOnline(models);
  const offlineCats = (catalog?.categories || []).filter((c) => c.key !== 'embeddings');
  const isOn = (id) => value === id;
  const isOffActive = (tag) => provider === 'offline' && (value === tag || value === `${tag}:latest`);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={toggle}
        title="Choose a model — Auto, online (cloud) or offline (on your device)"
        className="flex max-w-[220px] items-center gap-2 rounded-lg border border-line bg-surface px-3 py-1.5 text-sm font-medium transition hover:border-brand-400 hover:bg-surface-2"
      >
        <HeadIcon size={15} className={`shrink-0 ${headTone}`} />
        <span className="truncate">{currentLabel}</span>
        <ChevronDown size={15} className="shrink-0 text-muted" />
      </button>

      {open && (
        <div className="scroll-thin absolute left-0 z-30 mt-2 max-h-[72vh] w-[min(22rem,calc(100vw-1.5rem))] overflow-y-auto rounded-xl border border-line bg-elevated p-1.5 shadow-xl">
          {/* Auto */}
          <Row
            active={!value || value === 'auto'}
            icon={<Sparkles size={15} className="text-brand-500" />}
            title="Auto"
            sub="Smart route — best model per prompt"
            onClick={pickAuto}
          />

          {/* Online */}
          <SectionHeader icon={Cloud} title="Online" sub="cloud · free" tone="text-sky-500" />
          {onlineGroups.length === 0 ? (
            <p className="px-2.5 py-2 text-xs text-muted">No online models available.</p>
          ) : (
            onlineGroups.map((g) => (
              <div key={g.label}>
                <GroupLabel>{g.label}</GroupLabel>
                {g.items.map((m) => (
                  <Row
                    key={m.id}
                    active={provider !== 'offline' && isOn(m.id)}
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

          {/* Offline */}
          <SectionHeader
            icon={HardDrive}
            title="Offline"
            sub={ollamaLive ? 'on your device' : 'run locally'}
            tone="text-emerald-500"
          />
          {loadingCat ? (
            <div className="flex items-center gap-2 px-2.5 py-3 text-sm text-muted">
              <Loader2 size={15} className="animate-spin" /> Loading…
            </div>
          ) : offlineCats.length === 0 ? (
            <p className="px-2.5 py-2 text-xs text-muted">Catalog unavailable.</p>
          ) : (
            offlineCats.map((c) => (
              <div key={c.key}>
                <GroupLabel>{taskLabel(c.key)}</GroupLabel>
                {c.models.map((m) => {
                  const runnable = ollamaLive && m.installed && !m.locked;
                  return (
                    <Row
                      key={m.tag}
                      active={isOffActive(m.tag)}
                      icon={<Boxes size={15} className="text-emerald-500" />}
                      title={m.displayName}
                      sub={m.installed ? 'Installed' : m.locked ? `${(m.plan || '').toUpperCase()} plan` : `~${m.sizeGbApprox} GB · download`}
                      trailing={
                        switching === m.tag ? (
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
            onClick={() => { setOpen(false); onManage?.(); }}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-brand-500 transition hover:bg-surface-2"
          >
            <Download size={15} /> Browse &amp; download models
          </button>
        </div>
      )}
    </div>
  );
}

function SectionHeader({ icon, title, sub, tone }) {
  const Icon = icon;
  return (
    <div className="mt-1.5 flex items-center gap-1.5 px-2.5 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-faint">
      <Icon size={12} className={tone} /> {title}
      {sub && <span className="font-normal normal-case text-faint/80">· {sub}</span>}
    </div>
  );
}

function GroupLabel({ children }) {
  return <p className="px-2.5 pb-0.5 pt-1 text-[10px] font-medium uppercase tracking-wide text-faint/70">{children}</p>;
}

function Row({ active, icon, title, sub, badge, trailing, onClick }) {
  return (
    <button
      onClick={onClick}
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
