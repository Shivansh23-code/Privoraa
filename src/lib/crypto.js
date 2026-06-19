// Client-side "sealed vault" cryptography (Phase 1). Web Crypto only — zero
// dependencies, and nothing here ever leaves the browser.
//
// Envelope design:
//   passphrase ──PBKDF2──▶ KEK ──wraps──▶ random master key ──AES-GCM──▶ content
//
// The server only ever stores the "keyfile" (salt + wrapped master key) and
// opaque ciphertext blobs; without the passphrase it learns nothing — not the
// key, not the plaintext. Changing the passphrase re-wraps the SAME master key,
// so content never has to be re-encrypted.
//
// Threat model (be honest about it):
//  - Protects: data at rest on our server + in the browser's localStorage/IndexedDB
//    against a server compromise or a leaked DB dump.
//  - Does NOT protect: a compromised client/device, a malicious browser extension,
//    or — for the ONLINE model tier — the prompt text we must send to the LLM
//    provider. True zero-knowledge only holds for the offline/on-device tier.
//  - Recovery: lose the passphrase ⇒ lose the data (unless a recovery key is added).

const PBKDF2_ITERS = 600000; // OWASP 2023 floor for PBKDF2-HMAC-SHA256
const KDF_HASH = 'SHA-256';
const enc = new TextEncoder();
const dec = new TextDecoder();

// Access Web Crypto lazily so this module is import-safe under SSR/prerender
// (no top-level `crypto` access).
const sc = () => globalThis.crypto.subtle;
const randomBytes = (n) => globalThis.crypto.getRandomValues(new Uint8Array(n));

function bufToB64(buf) {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}
function b64ToBytes(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function deriveKek(passphrase, salt, iters) {
  const base = await sc().importKey('raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return sc().deriveKey(
    { name: 'PBKDF2', salt, iterations: iters, hash: KDF_HASH },
    base,
    { name: 'AES-GCM', length: 256 },
    false, // the KEK itself is non-extractable
    ['wrapKey', 'unwrapKey']
  );
}

async function wrapMaster(masterKey, kek) {
  const iv = randomBytes(12);
  const wrapped = await sc().wrapKey('raw', masterKey, kek, { name: 'AES-GCM', iv });
  return { wrapIv: bufToB64(iv), wrappedKey: bufToB64(wrapped) };
}

function keyfileFrom(salt, wrapIv, wrappedKey, iters) {
  return { v: 1, kdf: 'PBKDF2', hash: KDF_HASH, iters, salt: bufToB64(salt), wrapIv, wrappedKey };
}

/**
 * Create a brand-new vault. Returns { keyfile, masterKey }.
 * `keyfile` is safe to persist (server or localStorage); `masterKey` is a live
 * CryptoKey held only in memory for the session.
 */
export async function createVault(passphrase) {
  const salt = randomBytes(16);
  const kek = await deriveKek(passphrase, salt, PBKDF2_ITERS);
  const masterKey = await sc().generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
  const { wrapIv, wrappedKey } = await wrapMaster(masterKey, kek);
  return { keyfile: keyfileFrom(salt, wrapIv, wrappedKey, PBKDF2_ITERS), masterKey };
}

/** Unlock an existing vault from its keyfile. Throws 'Wrong passphrase.' on mismatch. */
export async function unlockVault(passphrase, keyfile) {
  const kek = await deriveKek(passphrase, b64ToBytes(keyfile.salt), keyfile.iters || PBKDF2_ITERS);
  try {
    return await sc().unwrapKey(
      'raw', b64ToBytes(keyfile.wrappedKey), kek,
      { name: 'AES-GCM', iv: b64ToBytes(keyfile.wrapIv) },
      { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']
    );
  } catch {
    // GCM auth failure on unwrap == wrong passphrase (or a corrupted keyfile).
    throw new Error('Wrong passphrase.');
  }
}

/** Change the passphrase without re-encrypting content: re-wrap the master key. */
export async function rewrapVault(masterKey, newPassphrase) {
  const salt = randomBytes(16);
  const kek = await deriveKek(newPassphrase, salt, PBKDF2_ITERS);
  const { wrapIv, wrappedKey } = await wrapMaster(masterKey, kek);
  return keyfileFrom(salt, wrapIv, wrappedKey, PBKDF2_ITERS);
}

/** AES-GCM encrypt a string -> { iv, ct } (base64). GCM also authenticates, so
 *  any tampering is detected on decrypt. */
export async function encryptString(plaintext, masterKey) {
  const iv = randomBytes(12);
  const ct = await sc().encrypt({ name: 'AES-GCM', iv }, masterKey, enc.encode(plaintext));
  return { iv: bufToB64(iv), ct: bufToB64(ct) };
}

export async function decryptString(blob, masterKey) {
  const pt = await sc().decrypt({ name: 'AES-GCM', iv: b64ToBytes(blob.iv) }, masterKey, b64ToBytes(blob.ct));
  return dec.decode(pt);
}

export async function encryptJson(value, masterKey) {
  return encryptString(JSON.stringify(value), masterKey);
}
export async function decryptJson(blob, masterKey) {
  return JSON.parse(await decryptString(blob, masterKey));
}

/** Is client-side crypto available in this environment? (secure context + subtle) */
export function cryptoAvailable() {
  return typeof globalThis !== 'undefined' && !!globalThis.crypto?.subtle;
}
