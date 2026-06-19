import React, { useState } from 'react';
import { X } from 'lucide-react';
import { useUserAuth } from '../../context/UserAuthContext';
import { useChatStore } from '../../store/chatStore';
import { MODES } from '../../lib/modes';
import VaultPanel from './VaultPanel';

export default function SettingsModal({ open, onClose }) {
  const { user, updateProfile } = useUserAuth();
  const mode = useChatStore((s) => s.mode);
  const setMode = useChatStore((s) => s.setMode);

  const [name, setName] = useState(user?.name || '');
  const [defaultMode, setDefaultMode] = useState(mode);

  if (!open) return null;

  const save = () => {
    if (name.trim()) updateProfile({ name: name.trim() });
    setMode(defaultMode);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        className="relative max-h-[85vh] w-full max-w-md animate-rise overflow-y-auto rounded-2xl border border-line bg-elevated p-5 shadow-2xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">Settings</h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition hover:bg-surface-2 hover:text-fg"
            title="Close"
          >
            <X size={17} />
          </button>
        </div>

        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Display name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              className="rounded-lg border border-line bg-surface px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/15"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Default mode</span>
            <select
              value={defaultMode}
              onChange={(e) => setDefaultMode(e.target.value)}
              className="rounded-lg border border-line bg-surface px-3 py-2 text-sm focus:border-brand-400 focus:outline-none"
            >
              {MODES.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>

          <p className="text-xs text-muted">
            Appearance follows your system's light/dark preference automatically.
          </p>
        </div>

        <div className="mt-4">
          <VaultPanel />
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg border border-line bg-surface px-4 py-2 text-sm font-medium transition hover:bg-surface-2"
          >
            Cancel
          </button>
          <button
            onClick={save}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
