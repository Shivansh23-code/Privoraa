import React from 'react';
import { MODES } from '../../lib/modes';
import { useChatStore } from '../../store/chatStore';

/**
 * Response-style (persona/mode) picker for the sidebar — a compact 2-column grid
 * of personas. The active one glows with the accent; selecting it sets the chat
 * mode. Moved here from the header so the top bar stays clean on small screens.
 */
export default function ResponseStyle() {
  const mode = useChatStore((s) => s.mode);
  const setMode = useChatStore((s) => s.setMode);

  return (
    <div className="grid grid-cols-2 gap-1.5">
      {MODES.map((m) => {
        const Icon = m.icon;
        const active = m.id === mode;
        return (
          <button
            key={m.id}
            onClick={() => setMode(m.id)}
            title={m.short}
            className={`group flex flex-col gap-1 rounded-lg border p-2 text-left transition ${
              active
                ? 'border-accent-400/50 bg-accent-500/10 shadow-[0_0_0_1px_rgba(43,224,190,.15)]'
                : 'border-line bg-surface hover:border-accent-400/40 hover:bg-surface-2'
            }`}
          >
            <Icon
              size={15}
              className={`shrink-0 ${active ? 'text-accent-500' : 'text-muted group-hover:text-accent-400'}`}
            />
            <span
              className={`text-[11px] font-medium leading-tight ${active ? 'text-fg' : 'text-fg/80'}`}
            >
              {m.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
