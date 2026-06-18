import React from 'react';
import { Crown } from 'lucide-react';
import { PRO_MODES } from '../../lib/modes';
import { useChatStore } from '../../store/chatStore';
import SelectMenu from './SelectMenu';

/**
 * Pro-exclusive specialist assistants ("bots") — a VVIP-only dropdown. Selecting
 * one sets the chat mode to that persona. Gold-accented to match the Pro tier.
 */
export default function ProAssistants() {
  const mode = useChatStore((s) => s.mode);
  const setMode = useChatStore((s) => s.setMode);

  return (
    <div>
      <p className="mb-1.5 flex items-center gap-1.5 px-1 text-[11px] font-semibold uppercase tracking-wide text-amber-500">
        <Crown size={12} /> VVIP assistants
      </p>
      <SelectMenu
        items={PRO_MODES}
        value={mode}
        onChange={setMode}
        accent="amber"
        placeholder="Choose an assistant"
      />
    </div>
  );
}
