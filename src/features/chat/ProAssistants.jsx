import React from 'react';
import { Crown } from 'lucide-react';
import { PRO_MODES } from '../../lib/modes';
import { useChatStore } from '../../store/chatStore';

/**
 * Pro-exclusive specialist assistants ("bots") — a VVIP-only panel. Selecting one
 * sets the chat mode to that persona. Gold-styled to match the Pro experience.
 */
export default function ProAssistants() {
  const mode = useChatStore((s) => s.mode);
  const setMode = useChatStore((s) => s.setMode);

  return (
    <div>
      <p className="mb-1.5 flex items-center gap-1.5 px-1 text-[11px] font-semibold uppercase tracking-wide text-amber-500">
        <Crown size={12} /> VVIP assistants
      </p>
      <div className="grid grid-cols-2 gap-1.5">
        {PRO_MODES.map((m) => {
          const Icon = m.icon;
          const active = m.id === mode;
          return (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              title={m.short}
              className={`group flex flex-col gap-1 rounded-lg border p-2 text-left transition ${
                active
                  ? 'border-amber-400/50 bg-amber-500/10 shadow-[0_0_0_1px_rgba(245,200,110,.18)]'
                  : 'border-line bg-surface hover:border-amber-400/40 hover:bg-surface-2'
              }`}
            >
              <Icon
                size={15}
                className={`shrink-0 ${active ? 'text-amber-500' : 'text-muted group-hover:text-amber-400'}`}
              />
              <span className={`text-[11px] font-medium leading-tight ${active ? 'text-fg' : 'text-fg/80'}`}>
                {m.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
