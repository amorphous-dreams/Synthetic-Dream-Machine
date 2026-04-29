/**
 * Browser operator identity — persists Ed25519 keypair in IndexedDB.
 *
 * One identity per Lararium host. Survives page reloads and browser restarts.
 * Lost if the user clears site data (acceptable for local-operator mode;
 * future: backup to Keyhive member keychain).
 */

import {
  generateOperatorIdentity,
  deserializeIdentity,
  serializeIdentity,
  type LarOperatorIdentity,
  type LarOperatorIdentityJson,
} from "@lararium/core";

const DB_NAME  = "lararium:operator";
const DB_VER   = 1;
const STORE    = "identity";
const KEY      = "operator-key";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

async function idbGet(db: IDBDatabase): Promise<LarOperatorIdentityJson | null> {
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(KEY);
    req.onsuccess = () => resolve((req.result as LarOperatorIdentityJson | undefined) ?? null);
    req.onerror   = () => reject(req.error);
  });
}

async function idbSet(db: IDBDatabase, value: LarOperatorIdentityJson): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE, "readwrite");
    const req = tx.objectStore(STORE).put(value, KEY);
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  });
}

let _cached: LarOperatorIdentity | null = null;

export async function getOrCreateBrowserIdentity(): Promise<LarOperatorIdentity> {
  if (_cached) return _cached;
  const db  = await openDb();
  const raw = await idbGet(db);
  if (raw) {
    _cached = deserializeIdentity(raw);
  } else {
    _cached = await generateOperatorIdentity();
    await idbSet(db, serializeIdentity(_cached));
  }
  return _cached;
}
