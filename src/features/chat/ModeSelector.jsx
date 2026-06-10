import React, { useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { useClickOutside } from './useClickOutside';
import { MODES, getMode } from '../../lib/modes';

export default function ModeSelector({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useClickOutside(() => setOpen(false), open);
  const selected = getMode(value);
  const Icon = selected.icon;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-1.5 text-sm font-medium transition hover:border-brand-400 hover:bg-surface-2"
      >
        <Icon size={15} className="shrink-0 text-accent-500" />
        <span className="truncate">{selected.label}</span>
        <ChevronDown size={15} className="shrink-0 text-muted" />
      </button>

      {open && (
        <div className="absolute left-0 z-30 mt-2 w-72 overflow-hidden rounded-xl border border-line bg-elevated p-1.5 shadow-xl">
          {MODES.map((m) => {
            const MIcon = m.icon;
            const active = m.id === selected.id;
            return (
              <button
                key={m.id}
                onClick={() => {
                  onChange(m.id);
                  setOpen(false);
                }}
                className={`flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition ${
                  active ? 'bg-accent-500/10' : 'hover:bg-surface-2'
                }`}
              >
                <MIcon size={16} className="mt-0.5 shrink-0 text-accent-500" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">{m.label}</div>
                  <p className="text-xs text-muted">{m.short}</p>
                </div>
                {active && <Check size={15} className="mt-0.5 shrink-0 text-accent-500" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
