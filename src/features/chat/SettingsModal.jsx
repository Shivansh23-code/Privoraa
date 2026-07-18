import React, { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { useUserAuth } from '../../context/UserAuthContext';
import { useChatStore } from '../../store/chatStore';
import { MODES } from '../../lib/modes';
import VaultPanel from './VaultPanel';
import { useTheme } from '../../context/ThemeContext';

export default function SettingsModal({ open, onClose }) {
  const { user, updateProfile } = useUserAuth();
  const mode = useChatStore((s) => s.mode);
  const setMode = useChatStore((s) => s.setMode);
  const { theme, setTheme } = useTheme();

  const [name, setName] = useState(user?.name || '');
  const [defaultMode, setDefaultMode] = useState(mode);
  const panelRef = useRef(null);
  const closeRef = useRef(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
  useEffect(() => {
    if (!open) return undefined;
    const returnFocus = document.activeElement;
    closeRef.current?.focus();
    const onKeyDown = (event) => {
      if (event.key === 'Escape') { onCloseRef.current(); return; }
      if (event.key !== 'Tab') return;
      const items = [...(panelRef.current?.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])') || [])];
      if (event.shiftKey && document.activeElement === items[0]) { event.preventDefault(); items.at(-1)?.focus(); }
      else if (!event.shiftKey && document.activeElement === items.at(-1)) { event.preventDefault(); items[0]?.focus(); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => { window.removeEventListener('keydown', onKeyDown); returnFocus?.focus?.(); };
  }, [open]);

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
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        className="relative max-h-[85vh] w-full max-w-md animate-rise overflow-y-auto rounded-2xl border border-line bg-elevated p-5 shadow-2xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">Settings</h2>
          <button
            ref={closeRef}
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

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Appearance</span>
            <select
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              className="rounded-lg border border-line bg-surface px-3 py-2 text-sm focus:border-brand-400 focus:outline-none"
            >
              <option value="system">System</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
            <span className="text-xs text-muted">System follows your device appearance.</span>
          </label>
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
