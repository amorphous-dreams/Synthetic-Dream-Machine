/**
 * browser-custody-proof — whether a route opens the custody this store holds, read without unlocking anything
 * (lar:///ha.ka.ba/lares/docs/pono/browser-vessel-lift#/the-confirm-gate).
 *
 * THE MEASURE. A slot tree rests in the clear beside the rows it wraps: its salts, its nonces and its wrapped key, and no
 * key byte. A passphrase proves itself against it by the unwrap alone (`openTreeKey`), which reads the tree and writes
 * nothing. So a store whose vessel stands LOCKED, half-founded or down still answers whether a typed passphrase opens it:
 * the proof needs the keystore's own rows and a KDF, never an unlock, a session or a vessel worker.
 *
 *   the place tree   `custody-slots`: this browser's own place custody (`browser-custody.ts`).
 *   a face's tree    `face-slots/<fcid>`: one per face bound or joined here, and a stopped founding's unnamed one
 *                    (`browser-face-custody.ts`). The proof reads every tree that stands, whatever the index routes to.
 *
 * A PROOF HOLDS NO KEY. Each opened tree key zero-fills before the proof answers, and nothing seats on this thread: a proof
 * unlocks no row and admits no session. The answer names a reading and a count of trees, never which tree opened.
 *
 * ANY TREE THAT OPENS PROVES A HOLDER. The confirm gate asks "does a holder of custody on this device stand here", so one
 * route that opens the place tree or any one face's tree answers `opens`. A store whose trees all refuse to read (a torn
 * or foreign tree) answers `unverifiable`: no passphrase can be judged against it, here or at any unlock.
 *
 * Meme: lar:///ha.ka.ba/lararium/browser/browser-custody
 */
// The keyslot door alone: the proof loads no Repo and no WASM, so the ceremony's worker stands under any policy.
import { decodeSlotTree, nobleKdf, openTreeKey, type Credential, type KdfPort } from "@lararium/mesh/keyslot-door";

/** The keystore's object store, the place tree's row and each custody prefix, as the two custody modules write them
 *  (`browser-custody.ts`, `browser-face-custody.ts`; `tests/browser-custody-proof.test.ts` welds them). */
export const PROOF_KEYSTORE = "keystore";
export const PROOF_PLACE_TREE_RECORD = "custody-slots";
export const PROOF_FACE_TREE_PREFIX = "face-slots/";
export const PROOF_SEALED_PREFIXES: readonly string[] = ["sealed/", "face-sealed/", "ward/"];

/** How one store's custody stands, read off its row names alone: nothing opens and nothing decodes. */
export type CustodyStanding =
  /** No tree and no sealed row: a bare floor, with nothing a passphrase guards. */
  | { readonly reading: "bare" }
  /** At least one slot tree stands: a first passphrase bound, or a face bound or joined. */
  | { readonly reading: "held"; readonly trees: number }
  /** Sealed rows stand with no tree beside them: nothing opens them, and no passphrase can be judged. */
  | { readonly reading: "torn"; readonly rows: number };

/** The standing a list of keystore row names reads as. Pure: the ceremony document reads the same names off its own census. */
export function custodyStandingOf(rows: readonly string[]): CustodyStanding {
  const trees = rows.filter((row) => row === PROOF_PLACE_TREE_RECORD || row.startsWith(PROOF_FACE_TREE_PREFIX)).length;
  if (trees > 0) return { reading: "held", trees };
  const sealed = rows.filter((row) => PROOF_SEALED_PREFIXES.some((prefix) => row.startsWith(prefix))).length;
  return sealed > 0 ? { reading: "torn", rows: sealed } : { reading: "bare" };
}

/**
 * Open one store's keystore as it stands and hand its object store to `body`, or answer null where the database holds no
 * keystore. The open names no version, so it upgrades nothing and creates no store in a database another hand owns; a name
 * no database answers to would mint an empty one, so that open aborts and reads as no keystore.
 */
async function withKeystore<T>(idbName: string, body: (store: IDBObjectStore) => Promise<T>): Promise<T | null> {
  const db = await new Promise<IDBDatabase | null>((resolve, reject) => {
    const request = indexedDB.open(idbName);
    let minted = false;
    request.onupgradeneeded = () => { minted = true; request.transaction?.abort(); };
    request.onsuccess = () => resolve(request.result);
    request.onerror = (e) => { if (minted) { e.preventDefault(); resolve(null); } else reject(request.error ?? new Error(`the database "${idbName}" did not open`)); };
  });
  if (db === null) return null;
  try {
    if (!db.objectStoreNames.contains(PROOF_KEYSTORE)) return null;
    return await body(db.transaction(PROOF_KEYSTORE, "readonly").objectStore(PROOF_KEYSTORE));
  } finally { db.close(); }
}

const asked = <T>(request: IDBRequest<T>): Promise<T> => new Promise((resolve, reject) => {
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});

/** One store's custody standing, read off its keystore's row names. A database with no keystore reads bare. */
export async function readCustodyStanding(idbName: string): Promise<CustodyStanding> {
  const rows = await withKeystore(idbName, async (store) => (await asked(store.getAllKeys())).map(String));
  return custodyStandingOf(rows ?? []);
}

/** The custody trees one store holds, read and decoded but never opened: how many stand, and how many of those read. */
async function treesOf(idbName: string): Promise<Uint8Array[]> {
  return await withKeystore(idbName, async (store) => {
    const names = (await asked(store.getAllKeys())).map(String).filter((row) => row === PROOF_PLACE_TREE_RECORD || row.startsWith(PROOF_FACE_TREE_PREFIX)).sort();
    // The place tree leads: the first passphrase a browser binds stands there.
    names.sort((a, b) => Number(b === PROOF_PLACE_TREE_RECORD) - Number(a === PROOF_PLACE_TREE_RECORD));
    const bytes: Uint8Array[] = [];
    for (const name of names) { const row: unknown = await asked(store.get(name)); bytes.push(row instanceof Uint8Array ? new Uint8Array(row) : new Uint8Array(0)); }
    return bytes;
  }) ?? [];
}

/**
 * How many custody trees this store holds and how many of them read. A tree that does not read (torn bytes, a foreign
 * shape) can judge no route, so a store whose trees all stand unreadable holds custody no passphrase proves.
 */
export async function readCustodyTrees(idbName: string): Promise<{ readonly trees: number; readonly readable: number }> {
  const held = await treesOf(idbName);
  return { trees: held.length, readable: held.filter((bytes) => decodeSlotTree(bytes).reading === "readable").length };
}

export type CustodyProof =
  /** The route opens a tree that stands here. `trees` counts the trees read. */
  | { readonly reading: "opens"; readonly trees: number }
  /** Trees read, and the route opens none of them. Nothing was written. */
  | { readonly reading: "no-slot-opens"; readonly trees: number }
  /** No tree here reads (none stands, or each stands torn): no route can be judged against this store. */
  | { readonly reading: "unverifiable"; readonly trees: number };

/**
 * Whether `credentials` open any custody tree this store holds: the place tree first, then each face tree in row order. It
 * reads the trees, derives, and writes nothing; each opened key zero-fills before the answer. A locked store answers as an
 * unlocked one does, since no reading here touches this thread's held keys.
 */
export async function proveCustodyRoute(idbName: string, credentials: readonly Credential[], kdf: KdfPort = nobleKdf): Promise<CustodyProof> {
  const held = await treesOf(idbName);
  let trees = 0;
  for (const bytes of held) {
    const decoded = decodeSlotTree(bytes);
    if (decoded.reading !== "readable") continue;
    trees++;
    const opened = await openTreeKey(decoded.tree, credentials, kdf);
    if (opened.reading === "opens") { opened.treeKey.fill(0); return { reading: "opens", trees }; }
  }
  return { reading: trees > 0 ? "no-slot-opens" : "unverifiable", trees };
}
