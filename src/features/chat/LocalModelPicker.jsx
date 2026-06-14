import React, { useState } from 'react';
import { Lock, ChevronDown, Check, Loader2, Boxes, Download } from 'lucide-react';
import { useClickOutside } from './useClickOutside';
import {
  fetchInstalled,
  fetchCatalog,
  setActiveModel,
  formatBytes,
} from '../../lib/modelCatalogService';

/**
 * Quick switcher for the active LOCAL chat model — shows only the models the
 * user has installed (excluding embedding models, which aren't for chat), like
 * the cloud model picker. "Browse & download" opens the full catalog.
 */
export default function LocalModelPicker({ active, online, onChanged, onManage }) {
  const [open, setOpen] = useState(false);
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(false);
  const [switching, setSwitching] = useState(null);
  const ref = useClickOutside(() => setOpen(false), open);

  const norm = (t) => (t && t.includes(':') ? t : `${t}:latest`);
  const isActive = (name) => active === name || norm(active) === norm(name);

  // Installed chat models = everything Ollama has, minus catalog embedding models.
  const load = async () => {
    setLoading(true);
    try {
      const [inst, catalog] = await Promise.all([
        fetchInstalled().catch(() => null),
        fetchCatalog().catch(() => null),
      ]);
      const embed = new Set();
      catalog?.categories
        ?.filter((c) => c.key === 'embeddings')
        .forEach((c) => c.models.forEach((m) => embed.add(norm(m.tag))));
      const list = (inst?.models || [])
        .filter((m) => !embed.has(norm(m.name)))
        .map((m) => ({ tag: m.name, size: m.size }));
      setModels(list);
    } finally {
      setLoading(false);
    }
  };

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next) load(); // refresh on open to catch newly-installed models
  };

  const pick = async (tag) => {
    if (isActive(tag)) {
      setOpen(false);
      return;
    }
    setSwitching(tag);
    try {
      await setActiveModel(tag);
      onChanged?.(tag);
    } finally {
      setSwitching(null);
      setOpen(false);
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={toggle}
        title="Active local model — click to switch"
        className="flex max-w-[220px] items-center gap-2 rounded-lg border border-line bg-surface px-3 py-1.5 text-sm font-medium transition hover:border-brand-400 hover:bg-surface-2"
      >
        <Lock size={14} className={`shrink-0 ${online ? 'text-brand-500' : 'text-amber-500'}`} />
        <span className="truncate">{active || 'Pick a model'}</span>
        <ChevronDown size={15} className="shrink-0 text-muted" />
      </button>

      {open && (
        <div className="absolute left-0 z-30 mt-2 max-h-[60vh] w-72 overflow-y-auto rounded-xl border border-line bg-elevated p-1.5 shadow-xl scroll-thin">
          <p className="px-2.5 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wide text-faint">
            Installed models
          </p>

          {loading ? (
            <div className="flex items-center gap-2 px-2.5 py-3 text-sm text-muted">
              <Loader2 size={15} className="animate-spin" /> Loading…
            </div>
          ) : models.length === 0 ? (
            <p className="px-2.5 py-3 text-xs text-muted">
              No chat models installed yet. Download one below.
            </p>
          ) : (
            models.map((m) => {
              const activeRow = isActive(m.tag);
              return (
                <button
                  key={m.tag}
                  onClick={() => pick(m.tag)}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition ${
                    activeRow ? 'bg-brand-500/10' : 'hover:bg-surface-2'
                  }`}
                >
                  <Boxes size={15} className="shrink-0 text-brand-400" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-mono text-sm">{m.tag}</p>
                    {m.size ? <p className="text-[11px] text-muted">{formatBytes(m.size)}</p> : null}
                  </div>
                  {switching === m.tag ? (
                    <Loader2 size={15} className="shrink-0 animate-spin text-muted" />
                  ) : activeRow ? (
                    <Check size={15} className="shrink-0 text-brand-500" />
                  ) : null}
                </button>
              );
            })
          )}

          <div className="my-1 h-px bg-line" />
          <button
            onClick={() => {
              setOpen(false);
              onManage?.();
            }}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-brand-500 transition hover:bg-surface-2"
          >
            <Download size={15} /> Browse &amp; download models
          </button>
        </div>
      )}
    </div>
  );
}
