import React from 'react';
import { MODES } from '../../lib/modes';
import { useChatStore } from '../../store/chatStore';
import SelectMenu from './SelectMenu';

/**
 * Response-style (persona/mode) picker for the sidebar — a compact dropdown so
 * the sidebar stays short on small screens. Selecting one sets the chat mode.
 */
export default function ResponseStyle() {
  const mode = useChatStore((s) => s.mode);
  const setMode = useChatStore((s) => s.setMode);
  return (
    <SelectMenu
      items={MODES}
      value={mode}
      onChange={setMode}
      accent="accent"
      placeholder="Choose a style"
    />
  );
}
