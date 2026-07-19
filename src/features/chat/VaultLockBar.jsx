import React, { useState } from 'react';
import { Lock, Loader2 } from 'lucide-react';
import { useVault } from '../../context/VaultContext';

export default function VaultLockBar() {
  const { status, unlock } = useVault();
  const [pass, setPass] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [expanded, setExpanded] = useState(false);

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
      className="flex min-h-[40px] flex-wrap items-center gap-x-2 gap-y-1 border-b border-line bg-brand-500/10 px-4 py-1.5 text-xs sm:min-h-0 sm:flex-nowrap sm:py-2.5"
    >
      <Lock size={13} className="shrink-0 text-brand-500" />
      <span className="font-medium text-fg">Vault locked</span>

      {/* Passphrase + submit: hidden on mobile unless expanded, always visible on desktop */}
      <div className={`items-center gap-2 ${expanded ? 'flex' : 'hidden'} sm:flex`}>
        <input
          type="password"
          value={pass}
          onChange={(e) => setPass(e.target.value)}
          placeholder="Passphrase"
          autoComplete="current-password"
          className="w-36 rounded-md border border-line bg-surface px-2 py-1 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/15"
        />
        <button
          type="submit"
          disabled={busy || !pass}
          className="flex items-center gap-1 rounded-md bg-brand-600 px-2.5 py-1 font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
        >
          {busy && <Loader2 size={12} className="animate-spin" />}
          Unlock
        </button>
      </div>

      {/* Mobile collapsed: tap Unlock to expand the full row */}
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className={`flex items-center gap-1 rounded-md bg-brand-600 px-2.5 py-1 font-semibold text-white transition hover:bg-brand-700 sm:hidden ${expanded ? 'hidden' : ''}`}
      >
        Unlock
      </button>

      {err && <span className="w-full text-red-500">{err}</span>}
    </form>
  );
}
