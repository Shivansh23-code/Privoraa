// Settings section for the sealed vault (Phase 1). Self-contained: it drives the
// full zero-knowledge lifecycle — create / unlock / lock / change passphrase /
// destroy — and demonstrates the encrypted store end-to-end with private notes
// that are AES-GCM encrypted on this device before they ever touch disk.
//
// Note: this surface is independent of the chat stream. It only reads/writes the
// vault's own encrypted store; it does not touch conversation persistence.

import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck,
  Lock,
  KeyRound,
  Trash2,
  Plus,
  Loader2,
  AlertTriangle,
  Search,
} from 'lucide-react';
import { useVault } from '../../context/VaultContext';
import { indexText, listTexts, removeVector, search } from '../../lib/vectorStore';

const uid = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const inputCls =
  'rounded-lg border border-line bg-surface px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/15';

export default function VaultPanel() {
  const { status, supported, isUnlocked, create, unlock, lock, changePassphrase, destroy } =
    useVault();

  if (!supported || status === 'unsupported') {
    return (
      <Section>
        <p className="text-xs text-muted">
          Your browser doesn't support the secure-crypto APIs the vault needs
          (this usually means an insecure connection). Open Privoraa over HTTPS to
          use the sealed vault.
        </p>
      </Section>
    );
  }

  return (
    <Section>
      {status === 'none' && <CreateVault onCreate={create} />}
      {status === 'locked' && <UnlockVault onUnlock={unlock} onDestroy={destroy} />}
      {isUnlocked && (
        <UnlockedVault onLock={lock} onChangePassphrase={changePassphrase} onDestroy={destroy} />
      )}
    </Section>
  );
}

function Section({ children }) {
  return (
    <div className="flex flex-col gap-3 border-t border-line pt-4">
      <div className="flex items-center gap-2">
        <ShieldCheck size={16} className="text-brand-500" />
        <span className="text-sm font-semibold">Sealed vault</span>
      </div>
      {children}
    </div>
  );
}

function ErrorLine({ children }) {
  if (!children) return null;
  return <p className="text-xs font-medium text-red-500">{children}</p>;
}

function CreateVault({ onCreate }) {
  const [p1, setP1] = useState('');
  const [p2, setP2] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const submit = async () => {
    setErr('');
    if (p1.length < 8) return setErr('Use at least 8 characters.');
    if (p1 !== p2) return setErr("Passphrases don't match.");
    setBusy(true);
    try {
      await onCreate(p1);
    } catch (e) {
      setErr(e?.message || 'Could not create the vault.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <p className="text-xs text-muted">
        Set a passphrase to seal your private data on this device. It's encrypted
        with a key only your passphrase can unlock — we never see it.
      </p>
      <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5">
        <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-500" />
        <p className="text-xs text-amber-700 dark:text-amber-400">
          Zero-knowledge: there's no reset. If you forget this passphrase, the
          data is gone for good.
        </p>
      </div>
      <input
        type="password"
        autoComplete="new-password"
        value={p1}
        onChange={(e) => setP1(e.target.value)}
        placeholder="Vault passphrase"
        className={inputCls}
      />
      <input
        type="password"
        autoComplete="new-password"
        value={p2}
        onChange={(e) => setP2(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
        placeholder="Confirm passphrase"
        className={inputCls}
      />
      <ErrorLine>{err}</ErrorLine>
      <button onClick={submit} disabled={busy} className={primaryBtn}>
        {busy ? <Loader2 size={15} className="animate-spin" /> : <ShieldCheck size={15} />}
        Create vault
      </button>
    </>
  );
}

function UnlockVault({ onUnlock, onDestroy }) {
  const [pass, setPass] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const submit = async () => {
    setErr('');
    setBusy(true);
    try {
      await onUnlock(pass);
      setPass('');
    } catch (e) {
      setErr(e?.message || 'Could not unlock.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <p className="text-xs text-muted">This device has a sealed vault. Enter your passphrase to unlock it.</p>
      <input
        type="password"
        autoComplete="current-password"
        value={pass}
        onChange={(e) => setPass(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
        placeholder="Vault passphrase"
        className={inputCls}
      />
      <ErrorLine>{err}</ErrorLine>
      <button onClick={submit} disabled={busy} className={primaryBtn}>
        {busy ? <Loader2 size={15} className="animate-spin" /> : <KeyRound size={15} />}
        Unlock
      </button>
      <DestroyVault onDestroy={onDestroy} />
    </>
  );
}

function UnlockedVault({ onLock, onChangePassphrase, onDestroy }) {
  const [showChange, setShowChange] = useState(false);

  return (
    <>
      <div className="flex items-center justify-between rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2">
        <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
          <ShieldCheck size={14} /> Unlocked
        </span>
        <button
          onClick={onLock}
          className="flex items-center gap-1 rounded-md border border-line bg-surface px-2.5 py-1 text-xs font-medium transition hover:bg-surface-2"
        >
          <Lock size={13} /> Lock
        </button>
      </div>

      <VaultItems
        namespace="memory"
        label="Memories"
        placeholder="A fact to remember about you…"
        hint="auto-recalled in on-device chats"
      />
      <VaultItems
        namespace="notes"
        label="Private notes"
        placeholder="Write something private…"
        hint="encrypted on this device"
      />

      <button
        onClick={() => setShowChange((v) => !v)}
        className="self-start text-xs font-medium text-brand-500 hover:underline"
      >
        {showChange ? 'Hide' : 'Change passphrase'}
      </button>
      {showChange && <ChangePassphrase onChange={onChangePassphrase} onDone={() => setShowChange(false)} />}

      <DestroyVault onDestroy={onDestroy} />
    </>
  );
}

function ChangePassphrase({ onChange, onDone }) {
  const [cur, setCur] = useState('');
  const [n1, setN1] = useState('');
  const [n2, setN2] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState(false);

  const submit = async () => {
    setErr('');
    if (n1.length < 8) return setErr('Use at least 8 characters.');
    if (n1 !== n2) return setErr("New passphrases don't match.");
    setBusy(true);
    try {
      await onChange(cur, n1);
      setOk(true);
      setTimeout(onDone, 900);
    } catch (e) {
      setErr(e?.message || 'Could not change passphrase.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-line bg-surface p-3">
      <input type="password" autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} placeholder="Current passphrase" className={inputCls} />
      <input type="password" autoComplete="new-password" value={n1} onChange={(e) => setN1(e.target.value)} placeholder="New passphrase" className={inputCls} />
      <input type="password" autoComplete="new-password" value={n2} onChange={(e) => setN2(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} placeholder="Confirm new passphrase" className={inputCls} />
      <ErrorLine>{err}</ErrorLine>
      {ok && <p className="text-xs font-medium text-emerald-500">Passphrase changed.</p>}
      <button onClick={submit} disabled={busy} className={primaryBtn}>
        {busy ? <Loader2 size={15} className="animate-spin" /> : <KeyRound size={15} />}
        Update passphrase
      </button>
    </div>
  );
}

// A reusable encrypted-item list (used for both Memories and Notes — same store,
// different namespace). Add / semantic-search / delete, all on-device.
function VaultItems({ namespace, label, placeholder, hint }) {
  const [items, setItems] = useState(null); // null = loading
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState('');
  const [results, setResults] = useState(null); // null = not searching

  const load = useCallback(async () => {
    try {
      setItems(await listTexts(namespace));
    } catch {
      setItems([]);
    }
  }, [namespace]);

  useEffect(() => {
    load();
  }, [load]);

  // Semantic search runs entirely on-device over the decrypted vectors. Cheap
  // for a personal vault, so just re-run whenever the query or items change.
  useEffect(() => {
    let alive = true;
    if (!q.trim()) {
      setResults(null);
      return undefined;
    }
    search(namespace, q, 5)
      .then((r) => alive && setResults(r))
      .catch(() => alive && setResults([]));
    return () => {
      alive = false;
    };
  }, [q, items, namespace]);

  const add = async () => {
    const text = draft.trim();
    if (!text) return;
    setBusy(true);
    try {
      await indexText(namespace, uid(), text);
      setDraft('');
      await load();
    } finally {
      setBusy(false);
    }
  };

  const del = async (id) => {
    await removeVector(id);
    await load();
  };

  const shown = results ?? items;

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-medium text-muted">
        {label} {items ? `(${items.length})` : ''} — {hint}
      </span>
      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder={placeholder}
          className={`${inputCls} flex-1`}
        />
        <button
          onClick={add}
          disabled={busy || !draft.trim()}
          className="flex items-center justify-center rounded-lg bg-brand-600 px-3 text-white transition hover:bg-brand-700 disabled:opacity-50"
          title="Save (encrypted)"
        >
          {busy ? <Loader2 size={15} className="animate-spin" /> : <Plus size={16} />}
        </button>
      </div>

      {items && items.length > 2 && (
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={`Search ${label.toLowerCase()}…`}
            className={`${inputCls} w-full pl-8`}
          />
        </div>
      )}

      {shown && shown.length > 0 && (
        <ul className="flex max-h-40 flex-col gap-1 overflow-y-auto">
          {shown.map((it) => (
            <li
              key={it.id}
              className="group flex items-center justify-between gap-2 rounded-lg border border-line bg-surface px-3 py-1.5"
            >
              <span className="truncate text-xs">{it.text}</span>
              <div className="flex shrink-0 items-center gap-2">
                {results && typeof it.score === 'number' && (
                  <span className="text-[10px] tabular-nums text-muted">
                    {Math.round(it.score * 100)}%
                  </span>
                )}
                <button
                  onClick={() => del(it.id)}
                  className="text-muted opacity-0 transition hover:text-red-500 group-hover:opacity-100"
                  title="Delete"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {results && results.length === 0 && q.trim() && (
        <p className="text-xs text-muted">No matches.</p>
      )}
    </div>
  );
}

function DestroyVault({ onDestroy }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        className="self-start text-xs font-medium text-red-500 hover:underline"
      >
        Forget this vault
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3">
      <p className="text-xs text-red-600 dark:text-red-400">
        This permanently erases the vault and everything in it on this device.
        There is no undo. Continue?
      </p>
      <div className="flex gap-2">
        <button
          onClick={() => setConfirming(false)}
          className="rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-medium transition hover:bg-surface-2"
        >
          Cancel
        </button>
        <button
          onClick={async () => {
            setBusy(true);
            try {
              await onDestroy();
            } finally {
              setBusy(false);
            }
          }}
          disabled={busy}
          className="flex items-center gap-1 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
        >
          {busy ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
          Erase vault
        </button>
      </div>
    </div>
  );
}

const primaryBtn =
  'flex items-center justify-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50';
