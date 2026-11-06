/**
 * browser-custody — the browser keystore's place tree, and the one row door every custody row rides; a face root rests under its ward.
 *
 * ── WHAT RESTS WHERE ─────────────────────────────────────────────────────────────────────────────
 * The vessel's IndexedDB `keystore` keeps two kinds of custody row (k15-custody-step-zero#/row-census-browser).
 * THE PLACE ROWS rest under this browser's own place tree (`custody-slots`), each sealed at `sealed/R` under the place key, its
 * AEAD binding the carrier name `browser-keystore/R`, so bytes moved from one row to another open nowhere. Two kinds stand
 * there, sorted by capability (the 2026-10-19 sort), beside the ward's public roster (below):
 *   `vessel-key`  F: the place KEL seed and its public half. It routes the vessel and signs the place KEL alone, a floor
 *                 duty of the place signer; it grants no face identity. It may stand clear before the place tree binds.
 *   `walk/<gate>` F: the walk a carried invite opens, taken at the boot before any face stands. It holds the invite, the
 *                 wallet's blind tokens and the hearth-signed grant over a per-Nexus public leaf: a walk at that hearth, no
 *                 face secret. A carry receipt (a document key the face's carry secret derives) would read D, and the walk
 *                 store refuses one by name (`walk-receipt-unhomed`, `browser-walk.ts`).
 * THE FACE ROWS rest under their own face's tree (`browser-face-custody.ts`, `face-sealed/<fcid>/<row>`), each named by the
 * face's PersonaGroup and never by a handle index: `veil-archive-g<G>`, `face-atom/<G>`, `face-anchor/<G>`,
 * `face-address-secret/<G>`, `vessel-face-tag/<G>`, `fleet-join-pending/<G>`, `vessel-face-key/<G>|<nexus>|<faceKey>`,
 * `nexus-key/<G>/<aid>`, `promoted/<G>` and `kapae/<G>`. A face row never rests under the place tree, and no face's row
 * rests before its own tree binds (`no-custody-slot`). Every other keystore row (`catalog-url`, public by construction)
 * stays as it stood.
 *
 * ── A FACE'S ROOT AND WARD KEY REST UNDER ITS WARD ───────────────────────────────────────────────
 * A face's ROOT, and a face's WARD KEY (the co-sign signer), rest elsewhere: each under a ward of its own (`browser-ward-tree.ts`,
 * `ward-core.ts`, seat-harness#/the-ward), whose key no slot of any tree here wraps. No door here reads, writes, moves or removes
 * one: each refuses `ward-needs-fresh-unlock` by name. The ward's roster (`persona-root-roster`: each held root's index and its
 * PUBLIC key, no seed) rests sealed under the place tree beside it.
 *
 * ── A FACE ROW NEVER RESTS UNDER THE PLACE TREE ──────────────────────────────────────────────────
 * A face row standing under the place tree (clear or sealed), or a custody row spelled by handle index (`persona-root-h<N>`,
 * `nexus-key/h<N>/…`), names no face: the boot refuses `face-row-shared` and the row door `face-names-a-handle`.
 *
 * ── ONE WRITER ───────────────────────────────────────────────────────────────────────────────────
 * Every place byte and the tree itself pass through the mesh's one writer (`sealed-writer.ts`) over an IndexedDB
 * `CustodyIo` port (`browserKeystoreCustodyIo`): the tree key in hand proves itself against the standing tree, a write
 * seals to a sidecar, reads it back, opens it, and only then renames over the carrier. A write never replaces a
 * sealed carrier until the new seal reopens. The act lock (`lares:custody-act:<idbName>`) keeps row doors outside a
 * custody act; the writer lock (`lares:custody:<idbName>`) holds each mesh write inside it.
 *
 * ── THE REFUSAL DESTROYS NOTHING ─────────────────────────────────────────────────────────────────
 * A route that opens no slot reads `no-slot-opens` and the act writes nothing at all: no attempt counter, no
 * settle, no cleanup. A mistyped passphrase once destroyed an identity archive; here it reaches no write.
 *
 * ── LOCKED AND UNLOCKED ──────────────────────────────────────────────────────────────────────────
 * An unlock holds the opened place key in this thread's memory alone, keyed by vessel; `lockBrowserCustody` drops it, and a
 * fresh thread starts locked. While the place tree stands sealed and locked, every place reader and writer refuses
 * `sealed-locked` by name: nothing mints over a sealed seed and nothing writes a clear row beside the tree. A clear
 * place row standing beside the tree (a fault between steps) reads `unsettled`: the next unlock moves it under the seal
 * when its sealed carrier stands absent or equal, and never chooses between two different values.
 *
 * ── THE CLEAR-PASSWORD ACT ASKS THROUGH THE CONFIRM DOOR ─────────────────────────────────────────
 * Returning the place rows to the clear takes the route AND a person's answer, asked the way the wiki asks
 * (`$tw.utils.confirm`, `lar:///ha.ka.ba/lares/docs/pono/dreamdom#/the-question`): the door answers false on the
 * first ask, the question parks, and the act abandons having written nothing; the person's "yes" re-dispatches the
 * asking message, the act runs from the top, and the door answers true on that pass. No closure resumes and no
 * blocking prompt stands. A face's own clear names that face (`clearFaceCustody`).
 *
 * ── PIN KINDS ────────────────────────────────────────────────────────────────────────────────────
 * A slot binds the mesh's built kinds: a passphrase, a paper sheet the person holds, or a passkey (a WebAuthn PRF output
 * over the pin's salt, the ceremony document's custody route). A passkey never stands as the tree's only route: a first
 * seal under a passkey alone refuses `passkey-alone-refused`, and a passkey slot binds beside a passphrase or paper slot.
 *
 * Meme: lar:///ha.ka.ba/lararium/browser/browser-custody
 */
import {
  bindSlot, unbindSlot, openTreeKey, nobleKdf, encodeSlotTree, decodeSlotTree, confirmHeldPaper, mintTreeKey, treeKeyEquals,
  writeSealedCarrier, openSealedCarrier, removeSealedCarrier, commitSlotTree, settleRotation, SEALING_SUFFIX, ROTATING_SUFFIX,
  constantTimeBytesEqual, isWalkRecord, type CustodyIo, type SealedCarrier, type Credential, type PinSpec, type SlotTree, type TreeKey,
} from "@lararium/mesh";
import { openVesselIdb } from "./browser-vessel-identity.js";
import { clearCustodyQuestion } from "@lararium/mesh/lar-uris";
import { readFaceRow, removeFaceRow, writeFaceRow } from "./browser-face-custody.js";

const STORE = "keystore";
export const CUSTODY_TREE_ROW = "custody-slots";
export const SEALED_ROW_PREFIX = "sealed/";
export const KEYSTORE_CARRIER_PREFIX = "browser-keystore/";

const DEVICE_SEED_ROW = "vessel-key";
const CUSTODY_ROW = /^(?:vessel-key|persona-root-roster|walk\/.+)$/;

/** Is `row` one the place tree wraps: the place seed, the ward's public roster or a walk. */
export function isCustodyRow(row: string): boolean { return CUSTODY_ROW.test(row); }

const hexUtf8 = (s: string): string => [...new TextEncoder().encode(s)].map((b) => b.toString(16).padStart(2, "0")).join("");

/** The face-private row spellings: each names its face's PersonaGroup, and rests under that face's tree as the second part. */
const FACE_ROWS: readonly (readonly [RegExp, (m: RegExpExecArray) => string])[] = [
  [/^veil-archive-g(.+)$/, () => "veil-archive"],
  [/^face-atom\/(.+)$/, () => "face-atom"],
  [/^face-anchor\/(.+)$/, () => "face-anchor"],
  [/^face-address-secret\/(.+)$/, () => "face-address-secret"],
  [/^vessel-face-tag\/(.+)$/, () => "vessel-face-tag"],
  [/^fleet-join-pending\/(.+)$/, () => "fleet-join-pending"],
  [/^promoted\/(.+)$/, () => "promoted"],
  [/^kapae\/(.+)$/, () => "kapae"],
  [/^vessel-face-key\/([^|]+)\|([^|]+)\|([^|]+)$/, (m) => `vessel-face-key/${hexUtf8(m[2]!)}/${m[3]!.toLowerCase()}`],
  [/^nexus-key\/([^/]+)\/(.+)$/, (m) => `nexus-key/${hexUtf8(m[2]!)}`],
];

/** A face-private row's face (its PersonaGroup) and the row it rests as under that face's own tree; null for any other row. */
export function faceRowOf(row: string): { readonly face: string; readonly row: string } | null {
  if (HANDLE_ROW.test(row)) return null;
  for (const [form, inner] of FACE_ROWS) {
    const m = form.exec(row);
    if (m) return { face: m[1]!, row: inner(m) };
  }
  return null;
}

/** A custody row spelled by handle index, or a vessel Archive: none names a face. (The ward's roster names roots by index
 *  under the ward's law, and rests under the place tree; see the header.) */
const HANDLE_ROW = /^(?:persona-root-h\d+|nexus-key\/h\d+\/.+|vessel-face-key\/[^|]+\|[^|]+|keyhive-archive)$/;

/** The rows a ward holds: a face root's and a face ward key's logical names, and every ward tree and warded row. No custody door reaches one. */
const WARD_ROW = /^(?:persona-root-h\d+|face-root\/.+|ward-sign\/.+|ward\/.*)$/;
export function isWardRow(row: string): boolean { return WARD_ROW.test(row); }

/** A ward act refused by name: no credential and no byte of the root rides the error. */
export class BrowserWardRefused extends Error {
  override readonly name = "BrowserWardRefused";
  constructor(readonly reading: string, detail = "the face root opened to no ward act in this browser") { super(`${reading}: ${detail}`); }
}

/** Refuse a ward row at a door of unlocked custody: the root opens only fresh, for one ward act. */
function refuseWardRow(row: string): void {
  if (isWardRow(row)) throw new BrowserWardRefused("ward-needs-fresh-unlock", `${row} rests under its face's ward, which opens only fresh from the face's own route for one act; unlocked custody never reaches it`);
}

/** The sealed carrier a custody row rests in once a slot binds. */
export function sealedCarrierOf(row: string): SealedCarrier {
  refuseWardRow(row);
  if (!isCustodyRow(row)) throw new Error(`[browser-custody] "${row}" names no custody row`);
  return { name: `${KEYSTORE_CARRIER_PREFIX}${row}`, path: `${SEALED_ROW_PREFIX}${row}` };
}

export type BrowserCustodyRefusalReading =
  | "sealed-locked" | "no-custody-slot" | "already-sealed" | "not-sealed" | "unsettled" | "tree-unreadable" | "row-unopened" | "torn-without-tree"
  | "face-names-a-handle" | "face-row-shared";

const SAYS: Record<BrowserCustodyRefusalReading, string> = {
  "sealed-locked": "the keystore rests sealed and this page holds no unlock; unlock it with its passphrase first",
  "no-custody-slot": "this secret row needs a passphrase or paper slot before it can be kept",
  "already-sealed": "a slot tree already stands; bind another slot instead of sealing again",
  "not-sealed": "no slot tree stands; the keystore rests in the clear",
  "unsettled": "a clear row stands beside the slot tree; an unlock settles it, and nothing chooses between two values",
  "tree-unreadable": "the slot tree does not read, so no route can be judged against it; nothing was written",
  "row-unopened": "the key this page holds does not open the sealed row; nothing was written",
  "torn-without-tree": "a sealed row stands with no slot tree beside it, so no route can open it; nothing was written",
  "face-names-a-handle": "a face's row names its PersonaGroup, never a local handle index h<N>; this row's shape names no face",
  "face-row-shared": "a face's row rests under this browser's place tree, where no face row rests; nothing here reads that row, and this browser founds afresh once its site data clears",
};

/**
 * Refuse a keystore whose place tree holds a face's row (clear or sealed), or a row spelled by handle index: each face's rows
 * rest under its own tree alone. Nothing is read or written past the row names.
 */
export async function refuseSharedTreeFaceRows(idbName: string): Promise<void> {
  const shared = (await keystoreKeys(idbName)).filter((k) => {
    const row = k.startsWith(SEALED_ROW_PREFIX) ? k.slice(SEALED_ROW_PREFIX.length).replace(new RegExp(`(?:${reEscape(SEALING_SUFFIX)}|${reEscape(ROTATING_SUFFIX)})$`), "") : k;
    return HANDLE_ROW.test(row) || faceRowOf(row) !== null;
  });
  if (shared.length > 0) throw new BrowserCustodyRefused("face-row-shared", idbName, shared[0], shared.join(", "));
}

/** A custody act or row the keystore's standing state refuses. Nothing was written. */
export class BrowserCustodyRefused extends Error {
  override readonly name = "BrowserCustodyRefused";
  constructor(readonly reading: BrowserCustodyRefusalReading, readonly idbName: string, readonly row?: string, detail?: string) {
    super(`[browser-custody] ${reading} — "${idbName}"${row ? ` row ${row}` : ""}: ${SAYS[reading]}${detail ? ` (${detail})` : ""}`);
  }
}

// ── the page's unlocks ──────────────────────────────────────────────────────────────────────────────

const unlocked = new Map<string, TreeKey>();

/** Drop this page's unlock of the vessel. The sealed rows stay; every custody read refuses until the next unlock. */
export function lockBrowserCustody(idbName: string): void {
  unlocked.delete(idbName);
  for (const listener of [...lockListeners.get(idbName) ?? []]) listener();
}

/**
 * The last session's lock (vessel-sessions.ts): wait out any custody act in flight, then overwrite the tree key's bytes and
 * drop the unlock. Answers true when a key stood. Taking the act lock exclusive first means no act seals under a key this
 * overwrites midway; an act that starts after reads no key and refuses `sealed-locked`.
 */
export async function overwriteBrowserCustody(idbName: string): Promise<boolean> {
  return withCustodyActLock(idbName, "exclusive", async () => {
    const held = unlocked.get(idbName);
    held?.fill(0);
    lockBrowserCustody(idbName);
    return held !== undefined;
  });
}

/** How many vessels this thread holds an unlock for: a count, never a key, for the lock's instrument. */
export function browserCustodyKeysHeld(): number { return unlocked.size; }

const lockListeners = new Map<string, Set<() => void>>();
/** Hear this page's lock of the vessel: a tab that told the holder it can seal tells it again when it cannot. */
export function onBrowserCustodyLock(idbName: string, listener: () => void): () => void {
  const set = lockListeners.get(idbName) ?? new Set<() => void>();
  set.add(listener); lockListeners.set(idbName, set);
  return () => { set.delete(listener); };
}

// ── the IndexedDB port ─────────────────────────────────────────────────────────────────────────────

function txDone(tx: IDBTransaction, what: string): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error(`[browser-custody] ${what} aborted`));
  });
}

function asBytes(held: unknown, idbName: string, row: string): Uint8Array | null {
  if (held === undefined) return null;
  if (held instanceof Uint8Array) return new Uint8Array(held);
  throw new Error(`[browser-custody] the ${row} row of "${idbName}" holds no bytes; the custody port reads bytes alone`);
}

/**
 * The mesh `CustodyIo` over the vessel's keystore: each path names one keystore row, each write completes with its
 * transaction, a rename moves one row onto another inside ONE transaction, and `exclusive` holds the vessel's one
 * custody Web Lock. `list` names only rows that hold bytes. An engine without Web Locks refuses: no lock, no holder.
 */
export function browserKeystoreCustodyIo(idbName: string): CustodyIo {
  const run = async <T>(mode: IDBTransactionMode, what: string, body: (s: IDBObjectStore, tx: IDBTransaction) => Promise<T> | T): Promise<T> => {
    const idb = await openVesselIdb(idbName);
    try {
      const tx = idb.transaction(STORE, mode, { durability: "strict" });
      const done = txDone(tx, what);
      done.catch(() => undefined);   // a body that aborts rejects `done` too; the body's own rejection carries the cause
      const out = await body(tx.objectStore(STORE), tx);
      await done;
      return out;
    } finally { idb.close(); }
  };
  const get = (s: IDBObjectStore, key: string): Promise<unknown> => new Promise((resolve, reject) => {
    const req = s.get(key); req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error);
  });
  return {
    read: (path) => run("readonly", `read ${path}`, async (s) => asBytes(await get(s, path), idbName, path)),
    write: (path, bytes) => run("readwrite", `write ${path}`, (s) => { s.put(new Uint8Array(bytes), path); }),
    rename: (from, to) => run("readwrite", `rename ${from}`, (s, tx) => new Promise<void>((resolve, reject) => {
      const req = s.get(from);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        if (!(req.result instanceof Uint8Array)) { tx.abort(); reject(new Error(`[browser-custody] nothing to rename at ${from}`)); return; }
        s.put(req.result, to); s.delete(from); resolve();
      };
    })),
    remove: (path) => run("readwrite", `remove ${path}`, (s) => { s.delete(path); }),
    list: () => run("readonly", "list", (s) => new Promise<string[]>((resolve, reject) => {
      const out: string[] = [];
      const req = s.openCursor();
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        const c = req.result;
        if (!c) { resolve(out); return; }
        if (c.value instanceof Uint8Array) out.push(String(c.key));
        c.continue();
      };
    })),
    exclusive: <T>(fn: () => Promise<T>): Promise<T> => {
      const locks = (globalThis as { navigator?: { locks?: LockManager } }).navigator?.locks;
      if (!locks) throw new Error("[browser-custody] this engine offers no Web Locks, so no custody act can hold the keystore alone");
      return locks.request(`lares:custody:${idbName}`, { mode: "exclusive" }, fn) as Promise<T>;
    },
  };
}

// ── the rows, raw ──────────────────────────────────────────────────────────────────────────────────

interface RowState { readonly tree: unknown; readonly clear: unknown; readonly sealed: unknown }

async function rowState(idbName: string, row: string): Promise<RowState> {
  const idb = await openVesselIdb(idbName);
  try {
    const tx = idb.transaction(STORE, "readonly");
    const s = tx.objectStore(STORE);
    const req = (k: string) => new Promise<unknown>((resolve, reject) => { const r = s.get(k); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
    const [tree, clear, sealed] = await Promise.all([req(CUSTODY_TREE_ROW), req(row), req(`${SEALED_ROW_PREFIX}${row}`)]);
    return { tree, clear, sealed };
  } finally { idb.close(); }
}

async function keystoreKeys(idbName: string): Promise<string[]> {
  const idb = await openVesselIdb(idbName);
  try {
    return await new Promise((resolve, reject) => {
      const req = idb.transaction(STORE, "readonly").objectStore(STORE).getAllKeys();
      req.onsuccess = () => resolve((req.result as IDBValidKey[]).map(String));
      req.onerror = () => reject(req.error);
    });
  } finally { idb.close(); }
}

/** Put a clear row only while the keystore holds no tree, checked inside the same transaction. */
async function putClearWhileNoTree(idbName: string, row: string, value: unknown): Promise<void> {
  const idb = await openVesselIdb(idbName);
  try {
    const tx = idb.transaction(STORE, "readwrite", { durability: "strict" });
    const done = txDone(tx, `write ${row}`);
    const s = tx.objectStore(STORE);
    const refused = await new Promise<BrowserCustodyRefused | null>((resolve, reject) => {
      const t = s.get(CUSTODY_TREE_ROW);
      t.onerror = () => reject(t.error);
      t.onsuccess = () => {
        if (t.result !== undefined) { resolve(new BrowserCustodyRefused("sealed-locked", idbName, row)); return; }
        s.put(value instanceof Uint8Array ? new Uint8Array(value) : value, row);
        resolve(null);
      };
    });
    if (refused) { tx.abort(); await done.catch(() => undefined); throw refused; }
    await done;
  } finally { idb.close(); }
}

/** Delete a clear row only while it still holds `expected`: a row another hand changed meanwhile stays. */
async function deleteClearIfUnchanged(idbName: string, row: string, expected: Uint8Array): Promise<boolean> {
  const idb = await openVesselIdb(idbName);
  try {
    const tx = idb.transaction(STORE, "readwrite", { durability: "strict" });
    const done = txDone(tx, `settle ${row}`);
    const s = tx.objectStore(STORE);
    const gone = await new Promise<boolean>((resolve, reject) => {
      const g = s.get(row);
      g.onerror = () => reject(g.error);
      g.onsuccess = () => {
        if (g.result === undefined) { resolve(false); return; }
        let now: Uint8Array;
        try { now = codecOf(row).toBytes(g.result); } catch { resolve(false); return; }
        if (!constantTimeBytesEqual(now, expected)) { resolve(false); return; }
        s.delete(row); resolve(true);
      };
    });
    await done;
    return gone;
  } finally { idb.close(); }
}

// ── the codecs: a row's clear value and its sealed plaintext ─────────────────────────────────────

interface RowCodec { toBytes(value: unknown): Uint8Array; fromBytes(bytes: Uint8Array): unknown }

const archiveCodec: RowCodec = {
  toBytes(value) {
    if (!(value instanceof Uint8Array) || value.byteLength === 0) throw new Error("[browser-custody] an Archive row holds non-empty bytes");
    return new Uint8Array(value);
  },
  fromBytes: (bytes) => new Uint8Array(bytes),
};

const key32Codec: RowCodec = {
  toBytes(value) {
    if (!(value instanceof Uint8Array) || value.length !== 32) throw new Error("[browser-custody] a face key holds exactly 32 bytes");
    return new Uint8Array(value);
  },
  fromBytes(bytes) { return this.toBytes(bytes); },
};

/** JSON carries nested typed bytes as numbered data, and rejects malformed byte tags on opening. */
function jsonRecordCodec(check: (value: unknown) => boolean, name: string): RowCodec {
  const unpack = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(unpack);
    if (value && typeof value === "object") {
      const obj = value as Record<string, unknown>;
      if (Object.prototype.hasOwnProperty.call(obj, "$bytes")) {
        const items = obj.$bytes;
        if (Object.keys(obj).length !== 1 || !Array.isArray(items) || !items.every((n) => Number.isInteger(n) && n >= 0 && n <= 255)) throw new Error(`[browser-custody] ${name} holds malformed bytes`);
        return Uint8Array.from(items);
      }
      return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, unpack(v)]));
    }
    return value;
  };
  const pack = (value: unknown): unknown => {
    if (value instanceof Uint8Array) return { $bytes: [...value] };
    if (Array.isArray(value)) return value.map(pack);
    if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, pack(v)]));
    return value;
  };
  return {
    toBytes(value) {
      if (!check(value)) throw new Error(`[browser-custody] ${name} holds no valid record`);
      return new TextEncoder().encode(JSON.stringify(pack(value)));
    },
    fromBytes(bytes) {
      const value = unpack(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)));
      this.toBytes(value);
      return value;
    },
  };
}

const pendingCodec = jsonRecordCodec((v) => {
  const p = v as { offer?: { kind?: unknown }; request?: { kind?: unknown }; sealSecret?: unknown; landed?: unknown } | null;
  return !!p && p.offer?.kind === "fleet-join-offer" && p.request?.kind === "fleet-join-request"
    && typeof p.sealSecret === "string" && /^[0-9a-f]+$/.test(p.sealSecret) && (p.landed === undefined || p.landed === true);
}, "fleet join pending");
const walkCodec = jsonRecordCodec(isWalkRecord, "walk");

/** The device seed's record: its public half and its seed. */
const deviceSeedCodec: RowCodec = {
  toBytes(value) {
    const v = value as { verifyingKey?: unknown; signingKey?: unknown } | null;
    if (!v || typeof v.verifyingKey !== "string" || typeof v.signingKey !== "string") {
      throw new Error("[browser-custody] the device seed row holds no { verifyingKey, signingKey } record");
    }
    return new TextEncoder().encode(JSON.stringify({ verifyingKey: v.verifyingKey, signingKey: v.signingKey }));
  },
  fromBytes(bytes) {
    const v = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as { verifyingKey: string; signingKey: string };
    return { verifyingKey: v.verifyingKey, signingKey: v.signingKey };
  },
};

/** The roster: one line per held root, its index and its PUBLIC key, so a possession check or a signer's key reads no seed. */
const personaRosterCodec: RowCodec = {
  toBytes(value) {
    const roots = (value as { roots?: unknown } | null)?.roots;
    const line = (l: unknown): boolean => {
      const { handleIndex, verifyingKey } = (l ?? {}) as { handleIndex?: unknown; verifyingKey?: unknown };
      return Number.isSafeInteger(handleIndex) && (handleIndex as number) >= 0 && typeof verifyingKey === "string" && /^[0-9a-f]{64}$/.test(verifyingKey);
    };
    // A ROSTER OF BARE INDICES (`{ roots: [0] }`) predates the ward: refuse by name with its cure.
    if (Array.isArray(roots) && roots.length > 0 && roots.every((r) => typeof r === "number")) {
      throw new BrowserWardRefused("ward-face-predates", "this face predates the ward; found it again");
    }
    if (!Array.isArray(roots) || !roots.every(line)) {
      throw new Error("[browser-custody] the persona-root roster holds no { roots: [{ handleIndex, verifyingKey }] } record");
    }
    return new TextEncoder().encode(JSON.stringify({ roots: roots.map((l: { handleIndex: number; verifyingKey: string }) => ({ handleIndex: l.handleIndex, verifyingKey: l.verifyingKey })) }));
  },
  fromBytes(bytes) {
    const value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as unknown;
    this.toBytes(value);
    return value;
  },
};

const codecOf = (row: string): RowCodec =>
  row === DEVICE_SEED_ROW ? deviceSeedCodec
    : row === "persona-root-roster" ? personaRosterCodec
    : row.startsWith("nexus-key/") || row.startsWith("vessel-face-key/") || row.startsWith("face-atom/") || row.startsWith("vessel-face-tag/") ? key32Codec
    : row.startsWith("face-anchor/") ? archiveCodec
    : row.startsWith("fleet-join-pending/") ? pendingCodec
    : row.startsWith("walk/") ? walkCodec : archiveCodec;

// ── the row door: every custody reader and writer rides it ───────────────────────────────────────

async function withCustodyActLock<T>(idbName: string, mode: LockMode, body: () => Promise<T>): Promise<T> {
  const locks = (globalThis as { navigator?: { locks?: LockManager } }).navigator?.locks;
  // NO WEB LOCKS: row doors run unlocked; acts that write refuse at the mesh writer's exclusive lock.
  if (!locks) return body();
  return locks.request(`lares:custody-act:${idbName}`, { mode }, body) as Promise<T>;
}

function treeOrRefuse(idbName: string, held: unknown, row?: string): SlotTree {
  const reading = decodeSlotTree(held instanceof Uint8Array ? held : null);
  if (reading.reading === "readable") return reading.tree;
  if (reading.reading === "absent") throw new BrowserCustodyRefused("tree-unreadable", idbName, row, "the tree row holds no bytes");
  throw new BrowserCustodyRefused("tree-unreadable", idbName, row, reading.why);
}

/**
 * A custody row's clear value: as it rests in the clear, or opened under this page's unlock. `undefined` when the
 * row never stood. Sealed and locked refuses `sealed-locked`; a clear row beside a tree refuses `unsettled`.
 */
export async function readKeystoreRow(idbName: string, row: string): Promise<unknown> {
  refuseWardRow(row);
  const face = faceRowOf(row);
  if (face) return readFaceDoor(face, row, idbName);
  return withCustodyActLock(idbName, "shared", () => readKeystoreRowHeld(idbName, row));
}

/** A face row through its own face's tree: `no-custody-slot` before the tree binds, `face-locked` while it stands locked. */
async function readFaceDoor(face: { readonly face: string; readonly row: string }, row: string, idbName: string): Promise<unknown> {
  const bytes = await readFaceRow(idbName, face.face, face.row);
  if (bytes === null) return undefined;
  try { return codecOf(row).fromBytes(bytes); } finally { bytes.fill(0); }
}

async function writeFaceDoor(face: { readonly face: string; readonly row: string }, row: string, idbName: string, value: unknown): Promise<void> {
  const plaintext = codecOf(row).toBytes(value);
  try { await writeFaceRow(idbName, face.face, face.row, plaintext); } finally { plaintext.fill(0); }
}

function refuseHandleRow(idbName: string, row: string): void {
  if (HANDLE_ROW.test(row)) throw new BrowserCustodyRefused("face-names-a-handle", idbName, row);
}

async function readKeystoreRowHeld(idbName: string, row: string): Promise<unknown> {
    const face = faceRowOf(row);
    if (face) return readFaceDoor(face, row, idbName);
    refuseHandleRow(idbName, row);
    const carrier = sealedCarrierOf(row);
    const st = await rowState(idbName, row);
    if (st.tree === undefined) {
      if (st.sealed !== undefined) throw new BrowserCustodyRefused("torn-without-tree", idbName, row);
      return st.clear;
    }
    treeOrRefuse(idbName, st.tree, row);
    if (st.clear !== undefined) throw new BrowserCustodyRefused("unsettled", idbName, row);
    // LOCKED REFUSES BEFORE ABSENT ANSWERS: a sealed keystore whose row never stood still names its lock, so no mint
    // reads "no seed yet" off a keystore it cannot open.
    const treeKey = unlocked.get(idbName);
    if (!treeKey) throw new BrowserCustodyRefused("sealed-locked", idbName, row);
    if (st.sealed === undefined) return undefined;
    const opened = await openSealedCarrier({ io: browserKeystoreCustodyIo(idbName), treeKey, carrier });
    if (opened.reading !== "opens") throw new BrowserCustodyRefused("row-unopened", idbName, row, opened.reading);
    return codecOf(row).fromBytes(opened.plaintext);
}

/**
 * Keep a custody row: device and Archive rows may stand clear before binding; roots require a slot. A sealed
 * write lands through the mesh writer, so the standing seal stays until the new one reads back and opens.
 */
export async function writeKeystoreRow(idbName: string, row: string, value: unknown): Promise<void> {
  refuseWardRow(row);
  const face = faceRowOf(row);
  if (face) return writeFaceDoor(face, row, idbName, value);
  return withCustodyActLock(idbName, "shared", () => writeKeystoreRowHeld(idbName, row, value));
}

async function writeKeystoreRowHeld(idbName: string, row: string, value: unknown): Promise<void> {
    const face = faceRowOf(row);
    if (face) return writeFaceDoor(face, row, idbName, value);
    refuseHandleRow(idbName, row);
    const carrier = sealedCarrierOf(row);
    const plaintext = codecOf(row).toBytes(value);
    const st = await rowState(idbName, row);
    if (st.tree === undefined) {
      if (st.sealed !== undefined) throw new BrowserCustodyRefused("torn-without-tree", idbName, row);
      // The place seed alone stands clear before the place tree binds (the pre-bind window); a walk takes the slot first.
      if (row !== DEVICE_SEED_ROW) throw new BrowserCustodyRefused("no-custody-slot", idbName, row);
      return putClearWhileNoTree(idbName, row, value);
    }
    treeOrRefuse(idbName, st.tree, row);
    if (st.clear !== undefined) throw new BrowserCustodyRefused("unsettled", idbName, row);
    const treeKey = unlocked.get(idbName);
    if (!treeKey) throw new BrowserCustodyRefused("sealed-locked", idbName, row);
    await writeSealedCarrier({ io: browserKeystoreCustodyIo(idbName), treeKey, treePath: CUSTODY_TREE_ROW, carrier, plaintext });
}

/** Hold one exclusive act across a read, decision and any number of custody row writes. */
export interface CustodyRowsAct {
  read(row: string): Promise<unknown>;
  write(row: string, value: unknown): Promise<void>;
  delete(row: string): Promise<void>;
}

export function withCustodyRows<T>(idbName: string, body: (rows: CustodyRowsAct) => Promise<T>): Promise<T> {
  if (!(globalThis as { navigator?: { locks?: LockManager } }).navigator?.locks) {
    throw new Error("[browser-custody] this engine offers no Web Locks, so a custody rows act cannot hold the keystore alone");
  }
  return withCustodyActLock(idbName, "exclusive", () => body({
    read: async (row) => { refuseWardRow(row); return readKeystoreRowHeld(idbName, row); },
    write: async (row, value) => { refuseWardRow(row); return writeKeystoreRowHeld(idbName, row, value); },
    delete: async (row) => {
      refuseWardRow(row);
      const face = faceRowOf(row);
      if (face) { await removeFaceRow(idbName, face.face, face.row); return; }
      refuseHandleRow(idbName, row);
      const carrier = sealedCarrierOf(row);
      const st = await rowState(idbName, row);
      if (st.tree === undefined) throw new BrowserCustodyRefused("no-custody-slot", idbName, row);
      treeOrRefuse(idbName, st.tree, row);
      if (st.clear !== undefined) throw new BrowserCustodyRefused("unsettled", idbName, row);
      const treeKey = heldOrRefuse(idbName);
      await removeSealedCarrier({ io: browserKeystoreCustodyIo(idbName), treeKey, treePath: CUSTODY_TREE_ROW, carrier });
    },
  }));
}

// ── the acts ─────────────────────────────────────────────────────────────────────────────────────

export type BrowserCustodyStatus =
  | { readonly reading: "clear" }
  | { readonly reading: "sealed"; readonly unlocked: boolean; readonly slots: readonly { readonly id: string; readonly t: number; readonly kinds: readonly ("passphrase" | "paper" | "passkey")[] }[] }
  | { readonly reading: "unreadable"; readonly why: string };

/** What the keystore's custody reads as: clear, sealed (and whether this page holds an unlock), or unreadable. */
export async function readBrowserCustody(idbName: string): Promise<BrowserCustodyStatus> {
  // A status read takes the shared act lock, so it never names an act's midway state as its outcome.
  return withCustodyActLock(idbName, "shared", () => readBrowserCustodyHeld(idbName));
}

async function readBrowserCustodyHeld(idbName: string): Promise<BrowserCustodyStatus> {
  const held = await browserKeystoreCustodyIo(idbName).read(CUSTODY_TREE_ROW).catch((e: unknown) => e as Error);
  if (held instanceof Error) return { reading: "unreadable", why: held.message };
  const reading = decodeSlotTree(held);
  if (reading.reading === "absent") {
    const torn = (await keystoreKeys(idbName)).filter((k) => k.startsWith(SEALED_ROW_PREFIX));
    return torn.length > 0 ? { reading: "unreadable", why: `sealed rows stand with no slot tree: ${torn.join(", ")}` } : { reading: "clear" };
  }
  if (reading.reading === "unreadable") return { reading: "unreadable", why: reading.why };
  return {
    reading: "sealed",
    unlocked: unlocked.has(idbName),
    slots: reading.tree.slots.map((s) => ({ id: s.id, t: s.t, kinds: s.pins.map((p) => p.kind) })),
  };
}

/** A route a slot binds under: a credential, where a passkey also names the PRF salt its output answered. */
export type CustodyBindRoute =
  | Exclude<Credential, { readonly kind: "passkey" }>
  | { readonly kind: "passkey"; readonly credentialId: Uint8Array; readonly prfSalt: Uint8Array; readonly prfOutput: Uint8Array };

/** The pin a bind route makes (one face's tree binds through it too, `browser-face-custody.ts`). */
export function custodyPinOf(route: CustodyBindRoute): PinSpec { return pinOf(route); }

function pinOf(route: CustodyBindRoute): PinSpec {
  if (route.kind === "passphrase") return { kind: "passphrase", passphrase: route.passphrase };
  if (route.kind === "paper") return { kind: "paper", confirmed: confirmHeldPaper(route.sheets) };
  if (route.kind === "passkey") return { kind: "passkey", credentialId: route.credentialId, prfSalt: route.prfSalt, prfOutput: route.prfOutput };
  throw new Error(`[browser-custody] a slot binds a passphrase, a paper sheet or a passkey; got "${String((route as { kind: unknown }).kind)}"`);
}

/** The passkey pins' public halves (credential id and PRF salt), for the ceremony's assertion. A clear or unreadable tree names none. */
export async function readBrowserCustodyPasskeys(idbName: string): Promise<readonly { readonly credentialId: Uint8Array; readonly prfSalt: Uint8Array }[]> {
  const reading = decodeSlotTree(await browserKeystoreCustodyIo(idbName).read(CUSTODY_TREE_ROW).catch(() => null));
  if (reading.reading !== "readable") return [];
  return reading.tree.slots.flatMap((s) => s.pins.flatMap((p) => p.kind === "passkey" ? [{ credentialId: p.credentialId.slice(), prfSalt: p.prfSalt.slice() }] : []));
}

/** Prove `route` opens `tree`'s encoded bytes to `treeKey` through `slotId`, before the tree lands anywhere. */
async function proveRouteOpens(tree: SlotTree, treeKey: TreeKey, route: CustodyBindRoute, slotId: string): Promise<void> {
  const back = decodeSlotTree(encodeSlotTree(tree));
  if (back.reading !== "readable") throw new Error("[browser-custody] the bound slot tree does not read back; nothing was written");
  const opened = await openTreeKey(back.tree, [route], nobleKdf);
  if (opened.reading !== "opens" || !treeKeyEquals(opened.treeKey, treeKey) || opened.slot !== slotId) {
    throw new Error("[browser-custody] the route does not reopen the slot it just bound; nothing was written");
  }
}

const reEscape = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

async function standingCarriers(idbName: string): Promise<SealedCarrier[]> {
  const rows = new Set<string>();
  for (const key of await keystoreKeys(idbName)) {
    if (isCustodyRow(key)) rows.add(key);
    else if (key.startsWith(SEALED_ROW_PREFIX)) {
      const row = key.slice(SEALED_ROW_PREFIX.length).replace(new RegExp(`(?:${reEscape(SEALING_SUFFIX)}|${reEscape(ROTATING_SUFFIX)})$`), "");
      if (isCustodyRow(row)) rows.add(row);
    }
  }
  return [...rows].sort().map(sealedCarrierOf);
}

/** A clear custody row a settle left standing beside the tree, and why. Readers name it `unsettled`. */
export interface UnsettledRow { readonly row: string; readonly why: string }

/**
 * Move every clear custody row under the seal: write its sealed carrier when none stands (the writer's read-back
 * proves the seal opens), or meet an equal one; then remove the clear row, only while it still holds what got
 * sealed. A clear row whose sealed carrier holds a DIFFERENT value stays, and so does every row the settle cannot
 * judge; each one returns in `left` with its reason, and the readers name it `unsettled`.
 */
async function settleClearRows(idbName: string, treeKey: TreeKey): Promise<{ moved: string[]; left: UnsettledRow[] }> {
  const io = browserKeystoreCustodyIo(idbName);
  const moved: string[] = [];
  const left: UnsettledRow[] = [];
  for (const key of (await keystoreKeys(idbName)).filter(isCustodyRow).sort()) {
    const carrier = sealedCarrierOf(key);
    const st = await rowState(idbName, key);
    if (st.clear === undefined) continue;
    let plaintext: Uint8Array;
    try { plaintext = codecOf(key).toBytes(st.clear); } catch (e) { left.push({ row: key, why: `the clear row holds no ${key} value (${(e as Error).message})` }); continue; }
    const standing = await openSealedCarrier({ io, treeKey, carrier });
    if (standing.reading === "absent") {
      await writeSealedCarrier({ io, treeKey, treePath: CUSTODY_TREE_ROW, carrier, plaintext });
    } else if (standing.reading !== "opens") {
      left.push({ row: key, why: `its sealed row reads ${standing.reading}` }); continue;
    } else if (!constantTimeBytesEqual(standing.plaintext, plaintext)) {
      left.push({ row: key, why: "its sealed row holds a different value; nothing chooses between the two" }); continue;
    }
    const back = await openSealedCarrier({ io, treeKey, carrier });
    if (back.reading !== "opens" || !constantTimeBytesEqual(back.plaintext, plaintext)) { left.push({ row: key, why: "its seal did not read back" }); continue; }
    if (await deleteClearIfUnchanged(idbName, key, plaintext)) moved.push(key);
    else left.push({ row: key, why: "the clear row changed while it settled" });
  }
  return { moved, left };
}

/**
 * Bind the keystore's first slot under `route` and move every custody row under the seal. The route reopens the
 * tree before the tree lands; the tree lands before any row moves; each row moves only after its seal reads back
 * and opens. An empty keystore seals too, so the slot stands before the first mint. Leaves this page unlocked.
 */
export async function sealBrowserKeystore(idbName: string, route: CustodyBindRoute): Promise<{ readonly slot: string; readonly sealed: readonly string[]; readonly unsettled: readonly UnsettledRow[] }> {
  return withCustodyActLock(idbName, "exclusive", async () => {
    const io = browserKeystoreCustodyIo(idbName);
    if ((await io.read(CUSTODY_TREE_ROW)) !== null) throw new BrowserCustodyRefused("already-sealed", idbName);
    const treeKey = mintTreeKey();
    const tree = await bindSlot(null, treeKey, { t: 1, pins: [pinOf(route)] }, nobleKdf);
    const slot = tree.slots[0]!.id;
    await proveRouteOpens(tree, treeKey, route, slot);
    await commitSlotTree({ io, path: CUSTODY_TREE_ROW, expected: null, treeKey, tree, carriers: await standingCarriers(idbName) });
    unlocked.set(idbName, treeKey);
    const { moved, left } = await settleClearRows(idbName, treeKey);
    return { slot, sealed: moved, unsettled: left };
  });
}

export type BrowserCustodyUnlock =
  | { readonly reading: "opens"; readonly slot: string; readonly settled: readonly string[]; readonly unsettled: readonly UnsettledRow[] }
  | { readonly reading: "no-slot-opens"; readonly notes: readonly string[] };

async function openWith(idbName: string, credentials: readonly Credential[]): Promise<{ tree: SlotTree; bytes: Uint8Array } & ({ opened: { treeKey: TreeKey; slot: string } } | { opened: null; notes: readonly string[] })> {
  const bytes = await browserKeystoreCustodyIo(idbName).read(CUSTODY_TREE_ROW);
  if (bytes === null) throw new BrowserCustodyRefused("not-sealed", idbName);
  const tree = treeOrRefuse(idbName, bytes);
  const r = await openTreeKey(tree, credentials, nobleKdf);
  return r.reading === "opens" ? { tree, bytes, opened: { treeKey: r.treeKey, slot: r.slot } } : { tree, bytes, opened: null, notes: r.notes };
}

/**
 * Open the keystore's tree key with the person's route and hold it for this page. A route that opens no slot answers
 * `no-slot-opens` and writes nothing. An opening settles first: a stray sidecar goes, and a clear row a fault left
 * moves under the seal.
 */
export async function unlockBrowserCustody(idbName: string, credentials: readonly Credential[]): Promise<BrowserCustodyUnlock> {
  return withCustodyActLock(idbName, "exclusive", async () => {
    const o = await openWith(idbName, credentials);
    if (!o.opened) return { reading: "no-slot-opens", notes: o.notes };
    const io = browserKeystoreCustodyIo(idbName);
    await settleRotation({ io, treePath: CUSTODY_TREE_ROW, carriers: await standingCarriers(idbName) });
    // A later session's own unlock opens the same key afresh: the copy it replaces gets overwritten, inside this act's lock.
    const prior = unlocked.get(idbName);
    unlocked.set(idbName, o.opened.treeKey);
    if (prior && prior !== o.opened.treeKey) prior.fill(0);
    const { moved, left } = await settleClearRows(idbName, o.opened.treeKey);
    return { reading: "opens", slot: o.opened.slot, settled: moved, unsettled: left };
  });
}

function heldOrRefuse(idbName: string): TreeKey {
  const treeKey = unlocked.get(idbName);
  if (!treeKey) throw new BrowserCustodyRefused("sealed-locked", idbName);
  return treeKey;
}

/** Bind one more slot under `route`, over the tree key this page holds. The route reopens the new tree before it lands. */
export async function bindBrowserCustodySlot(idbName: string, route: CustodyBindRoute): Promise<{ readonly slot: string }> {
  return withCustodyActLock(idbName, "exclusive", async () => {
    const treeKey = heldOrRefuse(idbName);
    const io = browserKeystoreCustodyIo(idbName);
    const expected = await io.read(CUSTODY_TREE_ROW);
    if (expected === null) throw new BrowserCustodyRefused("not-sealed", idbName);
    const tree = await bindSlot(treeOrRefuse(idbName, expected), treeKey, { t: 1, pins: [pinOf(route)] }, nobleKdf);
    const slot = tree.slots[tree.slots.length - 1]!.id;
    await proveRouteOpens(tree, treeKey, route, slot);
    await commitSlotTree({ io, path: CUSTODY_TREE_ROW, expected, treeKey, tree, carriers: [] });
    return { slot };
  });
}

/**
 * Remove one slot, over the tree key this page holds. The last slot never leaves. The answer carries the rotation offer:
 * a copy of the tree taken before the unbind still opens through the removed slot until the tree key rotates.
 */
export async function unbindBrowserCustodySlot(idbName: string, slotId: string): Promise<{ readonly rotationOffer: string }> {
  return withCustodyActLock(idbName, "exclusive", async () => {
    const treeKey = heldOrRefuse(idbName);
    const io = browserKeystoreCustodyIo(idbName);
    const expected = await io.read(CUSTODY_TREE_ROW);
    if (expected === null) throw new BrowserCustodyRefused("not-sealed", idbName);
    const { tree, rotationOffer } = unbindSlot(treeOrRefuse(idbName, expected), slotId);
    await commitSlotTree({ io, path: CUSTODY_TREE_ROW, expected, treeKey, tree, carriers: [] });
    return { rotationOffer };
  });
}

/** The door the clear-password act asks through: false parks the question, true on the person's confirmed pass. */
export type ConfirmDoor = (question: string) => boolean;

/** What this browser's place clear returns to the clear, as the question names it: the place rows alone; a face's rows clear
 *  with that face, and each face root stays under its face's ward. */
export const CLEAR_CUSTODY_CLEARS = "this browser's place custody: the device seed, its walk records and the persona-root roster (each face root stays under its face's ward)";
export const CLEAR_CUSTODY_QUESTION = clearCustodyQuestion(CLEAR_CUSTODY_CLEARS);

export type BrowserCustodyClear =
  | { readonly reading: "asks"; readonly question: string }
  | { readonly reading: "cleared"; readonly cleared: readonly string[] }
  | { readonly reading: "no-slot-opens"; readonly notes: readonly string[] };

/**
 * THE CLEAR-PASSWORD ACT: return every custody row to the clear. The route opens first (a wrong one answers
 * `no-slot-opens`, asks nothing and writes nothing); then the confirm door asks, and a parked question abandons the
 * act with nothing written. On the confirmed pass every sealed row opens before any byte moves; each clear row
 * lands before its sealed carrier leaves; the tree leaves last, once no sealed row stands.
 */
export async function clearBrowserCustody(idbName: string, credentials: readonly Credential[], confirm: ConfirmDoor): Promise<BrowserCustodyClear> {
  // THE QUESTION HOLDS NO LOCK: the route and every sealed row open, reading only, and the person answers before the
  // act lock is taken, so a door that waits on a person never holds another tab's row doors.
  const o = await openWith(idbName, credentials);
  if (!o.opened) return { reading: "no-slot-opens", notes: o.notes };
  const { treeKey } = o.opened;
  // Every sealed row opens BEFORE the person is asked, so a confirmed clear never meets a refusal it could have named.
  await openEverySealedRow(idbName, treeKey);
  // Only a literal `true` answers: a door that hands back anything else (a pending promise, a truthy string) parks.
  if (confirm(CLEAR_CUSTODY_QUESTION) !== true) return { reading: "asks", question: CLEAR_CUSTODY_QUESTION };
  return withCustodyActLock(idbName, "exclusive", async () => {
    const io = browserKeystoreCustodyIo(idbName);
    // The tree must still read as the one the route opened: another tab's bind, unbind or rotation meanwhile refuses.
    const tree = await io.read(CUSTODY_TREE_ROW);
    if (tree === null || !constantTimeBytesEqual(tree, o.bytes)) {
      throw new BrowserCustodyRefused("unsettled", idbName, undefined, "the slot tree moved since the question; nothing was written");
    }
    await settleRotation({ io, treePath: CUSTODY_TREE_ROW, carriers: await standingCarriers(idbName) });
    const cleared: string[] = [];
    for (const { row, carrier, frame, plaintext } of await openEverySealedRow(idbName, treeKey)) {
      // ONE TRANSACTION: the clear row lands only while the sealed row still holds the very frame this act opened, so
      // a newer seal another tab wrote meanwhile refuses the clear rather than losing to an older value.
      await putClearWhileSealedHolds(idbName, row, codecOf(row).fromBytes(plaintext), frame);
      const back = (await rowState(idbName, row)).clear;
      if (back === undefined || !constantTimeBytesEqual(codecOf(row).toBytes(back), plaintext)) {
        throw new Error(`[browser-custody] the clear ${row} row did not read back as opened; its sealed row stays`);
      }
      // The sealed carrier leaves only while it still opens to what now rests in the clear.
      const gone = await removeSealedCarrier({ io, treeKey, treePath: CUSTODY_TREE_ROW, carrier, when: (p) => constantTimeBytesEqual(p, plaintext) });
      if (!gone) throw new BrowserCustodyRefused("unsettled", idbName, row, "its sealed row changed during the clear; both rows stay");
      cleared.push(row);
    }
    await io.exclusive(async () => {
      const left = (await io.list()).filter((k) => k.startsWith(SEALED_ROW_PREFIX));
      if (left.length > 0) throw new Error(`[browser-custody] sealed rows still stand (${left.join(", ")}); the tree stays`);
      const now = await io.read(CUSTODY_TREE_ROW);
      if (now === null || !constantTimeBytesEqual(now, o.bytes)) throw new Error("[browser-custody] the slot tree moved during the clear; it stays");
      await io.remove(CUSTODY_TREE_ROW);
    });
    unlocked.delete(idbName);
    return { reading: "cleared", cleared };
  });
}

/** Open every sealed custody row under `treeKey`, reading only: a row that will not open, or a clear row beside it, refuses. */
async function openEverySealedRow(idbName: string, treeKey: TreeKey): Promise<{ row: string; carrier: SealedCarrier; frame: Uint8Array; plaintext: Uint8Array }[]> {
  const io = browserKeystoreCustodyIo(idbName);
  const out: { row: string; carrier: SealedCarrier; frame: Uint8Array; plaintext: Uint8Array }[] = [];
  for (const carrier of await standingCarriers(idbName)) {
    const row = carrier.path.slice(SEALED_ROW_PREFIX.length);
    const st = await rowState(idbName, row);
    if (st.clear !== undefined) throw new BrowserCustodyRefused("unsettled", idbName, row);
    if (st.sealed === undefined) continue;
    if (!(st.sealed instanceof Uint8Array)) throw new BrowserCustodyRefused("row-unopened", idbName, row, "the sealed row holds no bytes");
    const sealed = await openSealedCarrier({ io, treeKey, carrier });
    if (sealed.reading !== "opens") throw new BrowserCustodyRefused("row-unopened", idbName, row, sealed.reading);
    out.push({ row, carrier, frame: new Uint8Array(st.sealed), plaintext: sealed.plaintext });
  }
  return out;
}

/** Put a clear row in ONE transaction that first reads its sealed row still holding `frame` and no clear row standing. */
async function putClearWhileSealedHolds(idbName: string, row: string, value: unknown, frame: Uint8Array): Promise<void> {
  const idb = await openVesselIdb(idbName);
  try {
    const tx = idb.transaction(STORE, "readwrite", { durability: "strict" });
    const done = txDone(tx, `clear ${row}`);
    done.catch(() => undefined);
    const s = tx.objectStore(STORE);
    const refused = await new Promise<BrowserCustodyRefused | null>((resolve, reject) => {
      const g = s.get(`${SEALED_ROW_PREFIX}${row}`);
      g.onerror = () => reject(g.error);
      g.onsuccess = () => {
        if (!(g.result instanceof Uint8Array) || !constantTimeBytesEqual(g.result, frame)) {
          resolve(new BrowserCustodyRefused("unsettled", idbName, row, "its sealed row changed since the clear opened it; nothing was written")); return;
        }
        const c = s.get(row);
        c.onerror = () => reject(c.error);
        c.onsuccess = () => {
          if (c.result !== undefined) { resolve(new BrowserCustodyRefused("unsettled", idbName, row)); return; }
          s.put(value, row); resolve(null);
        };
      };
    });
    if (refused) { tx.abort(); throw refused; }
    await done;
  } finally { idb.close(); }
}
