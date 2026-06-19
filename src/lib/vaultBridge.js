// A tiny module-level bridge so non-React code (the encrypted IndexedDB store,
// and later the chat-at-rest storage adapter / RAG) can read the live vault
// master key and react to lock/unlock — without importing React or threading
// context through every call site.
//
// The master key lives ONLY here, in memory, as a non-serializable CryptoKey.
// It is never written to disk, never logged, and is dropped on lock.

let masterKey = null;
const listeners = new Set();

/** Set (or clear, with null) the live master key and notify subscribers. */
export function setMasterKey(key) {
  masterKey = key || null;
  for (const fn of listeners) {
    try {
      fn(masterKey);
    } catch {
      // A misbehaving subscriber must never break the vault lifecycle.
    }
  }
}

/** The live master key, or null when the vault is locked. */
export function getMasterKey() {
  return masterKey;
}

export function isUnlocked() {
  return masterKey != null;
}

/**
 * Subscribe to lock/unlock transitions. Fires immediately with the current
 * state so a late subscriber never misses an already-unlocked vault. Returns an
 * unsubscribe function.
 */
export function subscribeVault(fn) {
  listeners.add(fn);
  try {
    fn(masterKey);
  } catch {
    // ignore
  }
  return () => listeners.delete(fn);
}
