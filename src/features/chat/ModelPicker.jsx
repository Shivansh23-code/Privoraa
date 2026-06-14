import React, { useState } from 'react';
import { Check, ChevronDown, Sparkles, Zap } from 'lucide-react';
import { useClickOutside } from './useClickOutside';
import { AUTO_MODEL, CATEGORY_LABELS, findModel } from '../../lib/models';

export default function ModelPicker({ models, value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useClickOutside(() => setOpen(false), open);
  const list = [AUTO_MODEL, ...models];
  const selected = findModel(models, value);
  const isAuto = selected.id === 'auto';

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex max-w-[200px] items-center gap-2 rounded-lg border border-line bg-surface px-3 py-1.5 text-sm font-medium transition hover:border-brand-400 hover:bg-surface-2"
      >
        {isAuto ? (
          <Sparkles size={15} className="shrink-0 text-brand-500" />
        ) : (
          <Zap size={15} className="shrink-0 text-brand-400" />
        )}
        <span className="truncate">{selected.shortName || selected.name}</span>
        <ChevronDown size={15} className="shrink-0 text-muted" />
      </button>

      {open && (
        <div className="absolute left-0 z-30 mt-2 max-h-[60vh] w-[min(18rem,calc(100vw-1.5rem))] overflow-y-auto rounded-xl border border-line bg-elevated p-1.5 shadow-xl scroll-thin">
          {list.map((m) => {
            const active = m.id === selected.id;
            return (
              <button
                key={m.id}
                onClick={() => {
                  onChange(m.id);
                  setOpen(false);
                }}
                className={`flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition ${
                  active ? 'bg-brand-500/10' : 'hover:bg-surface-2'
                }`}
              >
                <div className="mt-0.5">
                  {m.id === 'auto' ? (
                    <Sparkles size={15} className="text-brand-500" />
                  ) : (
                    <Zap size={15} className="text-brand-400" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">{m.name}</span>
                    {m.isFree && m.id !== 'auto' && (
                      <span className="rounded bg-emerald-500/15 px-1.5 py-px text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                        FREE
                      </span>
                    )}
                  </div>
                  <p className="truncate text-xs text-muted">
                    {CATEGORY_LABELS[m.category] || m.category}
                    {m.description ? ` · ${m.description}` : ''}
                  </p>
                </div>
                {active && <Check size={15} className="mt-0.5 shrink-0 text-brand-500" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
