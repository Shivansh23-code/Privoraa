import React, { useState } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { useClickOutside } from './useClickOutside';

/**
 * Compact dropdown selector for the sidebar (Response style, VVIP assistants).
 * Replaces the old button grids so the sidebar stays short. `items` are
 * { id, label, short?, icon? }. `accent` tints the active state.
 */
export default function SelectMenu({ items, value, onChange, accent = 'accent', placeholder = 'Select' }) {
  const [open, setOpen] = useState(false);
  const ref = useClickOutside(() => setOpen(false), open);
  const current = items.find((i) => i.id === value);
  const CurrentIcon = current?.icon;

  const tone = accent === 'steel' ? 'text-[var(--accent-primary)]' : 'text-accent-500';
  const activeRow =
    accent === 'steel' ? 'border-[var(--accent-primary)]/30 bg-[var(--accent-soft)]' : 'border-accent-400/50 bg-accent-500/10';

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') { event.preventDefault(); setOpen(true); }
        }}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="control-surface flex h-10 w-full items-center gap-2 rounded-xl px-3 text-left text-sm transition"
      >
        {CurrentIcon ? (
          <CurrentIcon size={15} className={`shrink-0 ${tone}`} />
        ) : (
          <span className="h-[15px] w-[15px] shrink-0" />
        )}
        <span className={`min-w-0 flex-1 truncate font-medium ${current ? '' : 'text-muted'}`}>
          {current ? current.label : placeholder}
        </span>
        <ChevronDown size={15} className={`shrink-0 text-muted transition ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label={placeholder}
          onKeyDown={(event) => {
            if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
            event.preventDefault();
            const options = [...event.currentTarget.querySelectorAll('[role="option"]')];
            const currentIndex = options.indexOf(document.activeElement);
            const next = event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1 : event.key === 'ArrowDown' ? Math.min(options.length - 1, currentIndex + 1) : Math.max(0, currentIndex - 1);
            options[next]?.focus();
          }}
          className="elevated-surface floating-surface scroll-thin absolute inset-x-0 top-full z-30 mt-1.5 max-h-[44vh] overflow-y-auto rounded-xl p-1.5"
        >
          {items.map((m) => {
            const Icon = m.icon;
            const active = m.id === value;
            return (
              <button
                key={m.id}
                role="option"
                aria-selected={active}
                onClick={() => { onChange(m.id); setOpen(false); }}
                title={m.short}
                className={`flex w-full items-start gap-2 rounded-md border px-2 py-1.5 text-left transition ${
                  active ? activeRow : 'border-transparent hover:bg-surface-2'
                }`}
              >
                {Icon && <Icon size={14} className={`mt-0.5 shrink-0 ${active ? tone : 'text-muted'}`} />}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium">{m.label}</span>
                  {m.short && <span className="block truncate text-[11px] text-muted">{m.short}</span>}
                </span>
                {active && <Check size={14} className={`mt-0.5 shrink-0 ${tone}`} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
