// A slim banner shown at the top of the chat workspace when the user has a vault
// but it's currently locked. Conversations stay hidden until it's unlocked here
// (or in Settings). Unlock is inline so there's an obvious path back to the data.
import React, { useState } from 'react';
import { Lock, Loader2 } from 'lucide-react';
import { useVault } from '../../context/VaultContext';

export default function VaultLockBar() {
  const { status, unlock } = useVault();
  const [pass, setPass] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  if (status !== 'locked') return null;

  const submit = async (e) => {
    e?.preventDefault();
    if (!pass) return;
    setErr('');
    setBusy(true);
    try {
      await unlock(pass);
      setPass('');
    } catch (e2) {
      setErr(e2?.message || 'Could not unlock.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      className="flex flex-wrap items-center gap-2 border-b border-line bg-brand-500/10 px-4 py-2 text-xs"
    >
      <Lock size={13} className="shrink-0 text-brand-500" />
      <span className="font-semibold text-fg">Your vault is locked.</span>
      <span className="text-muted">Unlock to see your conversations.</span>
      <input
        type="password"
        value={pass}
        onChange={(e) => setPass(e.target.value)}
        placeholder="Passphrase"
        autoComplete="current-password"
        className="ml-auto w-40 rounded-md border border-line bg-surface px-2 py-1 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/15"
      />
      <button
        type="submit"
        disabled={busy}
        className="flex items-center gap-1 rounded-md bg-brand-600 px-2.5 py-1 font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
      >
        {busy && <Loader2 size={12} className="animate-spin" />}
        Unlock
      </button>
      {err && <span className="w-full text-red-500">{err}</span>}
    </form>
  );
}
