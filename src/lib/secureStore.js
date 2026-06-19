// Encrypted-at-rest IndexedDB store for the sealed vault.
//
// Every value is AES-GCM encrypted with the in-memory vault master key BEFORE it
// touches disk; only an opaque { iv, ct } blob is persisted. Record ids and the
// collection name are stored in the clear — they're non-sensitive routing
// metadata (UUIDs and namespaces), never user content.
//
// This is the shared client data layer for Phase 1 (encrypted notes) and Phase 3
// (on-device vectors) — built once, key never leaves memory.

import { encryptJson, decryptJson } from './crypto';
import { getMasterKey } from './vaultBridge';

const DB_NAME = 'privoraa-vault';
const DB_VERSION = 1;
const STORE = 'items';

let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const os = db.createObjectStore(STORE, { keyPath: 'id' });
        os.createIndex('collection', 'collection', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

const store = (db, mode) => db.transaction(STORE, mode).objectStore(STORE);

function reqToPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function requireKey() {
  const key = getMasterKey();
  if (!key) throw new Error('Vault is locked.');
  return key;
}

/** Encrypt and persist a value under (collection, id). Returns the id. */
export async function putItem(collection, id, value) {
  const key = requireKey();
  const blob = await encryptJson(value, key);
  const db = await openDb();
  await reqToPromise(
    store(db, 'readwrite').put({ id, collection, blob, updatedAt: Date.now() })
  );
  return id;
}

/** Fetch and decrypt a single value by id, or null if absent. */
export async function getItem(id) {
  const key = requireKey();
  const db = await openDb();
  const rec = await reqToPromise(store(db, 'readonly').get(id));
  if (!rec) return null;
  return decryptJson(rec.blob, key);
}

/**
 * Fetch and decrypt every value in a collection, newest first. Returns
 * [{ id, updatedAt, value }].
 */
export async function listCollection(collection) {
  const key = requireKey();
  const db = await openDb();
  const recs = await reqToPromise(
    store(db, 'readonly').index('collection').getAll(collection)
  );
  const items = await Promise.all(
    recs.map(async (r) => ({
      id: r.id,
      updatedAt: r.updatedAt,
      value: await decryptJson(r.blob, key),
    }))
  );
  items.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  return items;
}

/** Count records in a collection (no decryption — usable while locked). */
export async function countCollection(collection) {
  const db = await openDb();
  return reqToPromise(store(db, 'readonly').index('collection').count(collection));
}

export async function removeItem(id) {
  const db = await openDb();
  await reqToPromise(store(db, 'readwrite').delete(id));
}

/** Wipe all encrypted data. Used when the vault is destroyed (irreversible). */
export async function clearVaultData() {
  const db = await openDb();
  await reqToPromise(store(db, 'readwrite').clear());
}
