// Vault-aware persistence for the chat store.
//
// Three modes, decided per call from the live vault state:
//   • No vault (default for everyone today) → plain localStorage under the
//     legacy key, byte-for-byte the original behavior. Nothing changes.
//   • Vault unlocked → the whole persisted blob is AES-GCM encrypted at rest;
//     no plaintext copy is ever left behind.
//   • Vault locked → chats are hidden (reads return nothing, writes are
//     suppressed) so a locked device shows nothing and never clobbers the
//     ciphertext.
//
// This only governs at-rest serialization. The live streaming pipeline is
// untouched — it operates on in-memory store state exactly as before.

import { encryptString, decryptString } from '../lib/crypto';
import { getMasterKey, subscribeVault } from '../lib/vaultBridge';

const PLAIN_KEY = 'privoraa-chat'; // legacy plaintext (vault OFF) — unchanged format
const ENC_KEY = 'privoraa-chat-enc'; // ciphertext blob { iv, ct } (vault ON)
const KEYFILE = 'privoraa-vault-keyfile';

const hasVault = () => {
  try {
    return !!localStorage.getItem(KEYFILE);
  } catch {
    return false;
  }
};

/** zustand StateStorage that transparently encrypts the chat blob at rest. */
export const chatStorage = {
  getItem: (_name) => {
    const key = getMasterKey();
    if (key) {
      // Unlocked: prefer the encrypted blob; fall back to any pre-vault plaintext
      // (the about-to-be-migrated state) so nothing is lost on first unlock.
      const enc = localStorage.getItem(ENC_KEY);
      if (enc) {
        let blob;
        try {
          blob = JSON.parse(enc);
        } catch {
          return null;
        }
        return decryptString(blob, key).catch(() => null); // Promise<string|null>
      }
      return localStorage.getItem(PLAIN_KEY);
    }
    // Locked vault → hide everything until unlock. No vault → plaintext (legacy).
    if (hasVault()) return null;
    return localStorage.getItem(PLAIN_KEY);
  },

  setItem: async (_name, value) => {
    const key = getMasterKey();
    if (key) {
      const blob = await encryptString(value, key);
      localStorage.setItem(ENC_KEY, JSON.stringify(blob));
      localStorage.removeItem(PLAIN_KEY); // never leave a plaintext copy behind
      return;
    }
    if (hasVault()) return; // locked → don't persist, don't clobber the ciphertext
    localStorage.setItem(PLAIN_KEY, value);
  },

  removeItem: (_name) => {
    localStorage.removeItem(PLAIN_KEY);
    localStorage.removeItem(ENC_KEY);
  },
};

/** Drop the encrypted chat blob (used when the vault is destroyed). */
export function purgeChatAtRest() {
  try {
    localStorage.removeItem(ENC_KEY);
    localStorage.removeItem(PLAIN_KEY);
  } catch {
    // ignore
  }
}

/**
 * Bridge the vault lock/unlock lifecycle to the chat store:
 *  - on unlock: load the encrypted chats (or migrate existing plaintext into
 *    ciphertext on first unlock), wiping the plaintext copy;
 *  - on lock: clear chats from memory (the ciphertext stays safely on disk).
 * Called once, client-side, after the store is created.
 */
export function wireVaultPersistence(store) {
  if (typeof window === 'undefined') return;
  let prevUnlocked = false;
  subscribeVault((key) => {
    const unlocked = !!key;
    if (unlocked && !prevUnlocked) {
      if (localStorage.getItem(ENC_KEY)) {
        // Returning user: pull the encrypted history back into memory.
        store.persist.rehydrate();
      } else {
        // First unlock with no ciphertext yet → encrypt the current in-memory
        // state and remove any legacy plaintext.
        store.setState((s) => ({ ...s }));
      }
    } else if (!unlocked && prevUnlocked) {
      // Locked: hide chats from memory; the write is suppressed by setItem so the
      // on-disk ciphertext is preserved.
      store.setState({ conversations: [], documents: [], currentId: null });
    }
    prevUnlocked = unlocked;
  });
}
