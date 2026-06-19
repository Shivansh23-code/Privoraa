// Sealed-vault session manager (Phase 1). Owns the master-key lifecycle —
// locked/unlocked — and the keyfile, building on the pure crypto in lib/crypto.
//
// Zero-knowledge model: there is NO recovery key. The passphrase is the only way
// in; lose it and the data is gone. The server never sees the passphrase or the
// master key. The keyfile (salt + wrapped key) is kept device-local in
// localStorage and never leaves this machine — so the wrapped key itself never
// touches our servers either. (Cross-device sync would just POST/GET this same
// blob; the zero-knowledge property holds regardless.)

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import { createVault, unlockVault, rewrapVault, cryptoAvailable } from '../lib/crypto';
import { setMasterKey } from '../lib/vaultBridge';
import { clearVaultData } from '../lib/secureStore';
import { purgeChatAtRest } from '../store/chatPersist';

const KEYFILE_STORAGE = 'privoraa-vault-keyfile';
// Auto-lock after sustained inactivity — defense for shared/unattended devices.
const AUTO_LOCK_MS = 15 * 60 * 1000;

const VaultContext = createContext(null);

function loadKeyfile() {
  try {
    const raw = localStorage.getItem(KEYFILE_STORAGE);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function saveKeyfile(keyfile) {
  localStorage.setItem(KEYFILE_STORAGE, JSON.stringify(keyfile));
}

export function VaultProvider({ children }) {
  const supported = cryptoAvailable();
  // 'unsupported' | 'none' (no vault yet) | 'locked' | 'unlocked'
  const [status, setStatus] = useState('none');
  const masterRef = useRef(null);

  // Resolve the initial status on the client (this provider is only mounted in
  // the lazy, client-only chat workspace, so localStorage is available here).
  useEffect(() => {
    if (!supported) {
      setStatus('unsupported');
      return;
    }
    setStatus(loadKeyfile() ? 'locked' : 'none');
  }, [supported]);

  const applyKey = useCallback((key) => {
    masterRef.current = key;
    setMasterKey(key);
    setStatus(key ? 'unlocked' : loadKeyfile() ? 'locked' : 'none');
  }, []);

  const create = useCallback(
    async (passphrase) => {
      const { keyfile, masterKey } = await createVault(passphrase);
      saveKeyfile(keyfile);
      applyKey(masterKey);
    },
    [applyKey]
  );

  const unlock = useCallback(
    async (passphrase) => {
      const keyfile = loadKeyfile();
      if (!keyfile) throw new Error('No vault on this device.');
      const masterKey = await unlockVault(passphrase, keyfile); // throws 'Wrong passphrase.'
      applyKey(masterKey);
    },
    [applyKey]
  );

  const lock = useCallback(() => applyKey(null), [applyKey]);

  const changePassphrase = useCallback(
    async (current, next) => {
      const keyfile = loadKeyfile();
      if (!keyfile) throw new Error('No vault on this device.');
      // Verify `current` by unlocking, then re-wrap the SAME master key under the
      // new passphrase — content never has to be re-encrypted.
      const masterKey = await unlockVault(current, keyfile);
      saveKeyfile(await rewrapVault(masterKey, next));
      applyKey(masterKey);
    },
    [applyKey]
  );

  // Irreversible: drop the keyfile and wipe encrypted data. Zero-knowledge means
  // there is no way back — the ciphertext becomes permanently unreadable.
  const destroy = useCallback(async () => {
    localStorage.removeItem(KEYFILE_STORAGE);
    purgeChatAtRest(); // drop the orphaned encrypted chat blob too
    try {
      await clearVaultData();
    } catch {
      // best-effort wipe; the keyfile is already gone so data is unrecoverable
    }
    applyKey(null);
  }, [applyKey]);

  // Idle auto-lock while unlocked.
  useEffect(() => {
    if (status !== 'unlocked') return;
    let timer;
    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(lock, AUTO_LOCK_MS);
    };
    const events = ['mousedown', 'keydown', 'touchstart', 'visibilitychange'];
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    reset();
    return () => {
      clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [status, lock]);

  const value = {
    status,
    supported,
    hasVault: status === 'locked' || status === 'unlocked',
    isUnlocked: status === 'unlocked',
    create,
    unlock,
    lock,
    changePassphrase,
    destroy,
  };

  return <VaultContext.Provider value={value}>{children}</VaultContext.Provider>;
}

export const useVault = () => {
  const ctx = useContext(VaultContext);
  if (!ctx) throw new Error('useVault must be used within VaultProvider');
  return ctx;
};
