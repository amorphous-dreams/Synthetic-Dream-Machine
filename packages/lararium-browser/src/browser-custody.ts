/**
 * browser-custody — the browser keystore's slot tree: a human route wraps the device seed and the Keyhive Archives.
 *
 * ── WHAT RESTS WHERE ─────────────────────────────────────────────────────────────────────────────
 * The vessel's IndexedDB `keystore` keeps three kinds of custody row: `vessel-key` (the device seed and its public
 * half), `keyhive-archive` (the vessel individual's Archive) and `veil-archive-h<N>` (face N's creator-veil
 * Archive). Before a slot binds they rest IN THE CLEAR at those names. Once a slot binds, the mesh slot tree rests
 * at `custody-slots` (plain bytes: ids, salts, nonces and wrapped bytes, nothing a route does not open), and each
 * custody row R rests sealed under the vessel key at `sealed/R`, its AEAD binding the carrier name
 * `browser-keystore/R`, so bytes moved from one row to another open nowhere. Every other keystore row
 * (`catalog-url`, public by construction) stays as it stood.
 *
 * ── ONE WRITER ───────────────────────────────────────────────────────────────────────────────────
 * Every sealed byte and the tree itself pass through the mesh's one writer (`sealed-writer.ts`) over an IndexedDB
 * `CustodyIo` port (`browserKeystoreCustodyIo`): the VK in hand proves itself against the standing tree, a write
 * seals to a sidecar, reads it back, opens it, and only then renames over the carrier. A write never replaces a
 * sealed carrier until the new seal reopens. One Web Lock per vessel (`lares:custody:<idbName>`) holds each act.
 *
 * ── THE REFUSAL DESTROYS NOTHING ─────────────────────────────────────────────────────────────────
 * A route that opens no slot reads `no-slot-opens` and the act writes nothing at all: no attempt counter, no
 * settle, no cleanup. A mistyped passphrase once destroyed an identity archive; here it reaches no write.
 *
 * ── LOCKED AND UNLOCKED ──────────────────────────────────────────────────────────────────────────
 * An unlock holds the opened VK in this page's memory alone, keyed by vessel; `lockBrowserCustody` drops it, and a
 * fresh page starts locked. While the keystore stands sealed and locked, every custody reader and writer refuses
 * `sealed-locked` by name: nothing mints over a sealed seed and nothing writes a clear row beside the tree. A clear
 * custody row standing beside the tree (a fault between steps, or an older page's write) reads `unsettled`: the
 * next unlock moves it under the seal when its sealed carrier stands absent or equal, and never chooses between two
 * different values.
 *
 * ── THE CLEAR-PASSWORD ACT ASKS THROUGH THE CONFIRM DOOR ─────────────────────────────────────────
 * Returning the rows to the clear takes the route AND a person's answer, asked the way the wiki asks
 * (`$tw.utils.confirm`, `lar:///ha.ka.ba/lares/docs/pono/dreamdom#/the-question`): the door answers false on the
 * first ask, the question parks, and the act abandons having written nothing; the person's "yes" re-dispatches the
 * asking message, the act runs from the top, and the door answers true on that pass. No closure resumes and no
 * blocking prompt stands.
 *
 * ── PIN KINDS ────────────────────────────────────────────────────────────────────────────────────
 * A slot binds the mesh's built kinds: a passphrase, or a paper sheet the person holds. A passkey slot joins only
 * after its PRF derivation gets measured on the person's own devices, and never alone; no passkey kind stands here.
 *
 * Meme: lar:///ha.ka.ba/lararium/browser/browser-custody
 */
import {
  bindSlot, unbindSlot, openVk, encodeSlotTree, decodeSlotTree, confirmHeldPaper, mintVk, vkEquals,
  writeSealedCarrier, openSealedCarrier, removeSealedCarrier, commitSlotTree, settleRotation, SEALING_SUFFIX, ROTATING_SUFFIX,
  type CustodyIo, type SealedCarrier, type Credential, type PinSpec, type SlotTree, type VesselKey,
} from "@lararium/mesh";
import { openVesselIdb } from "./browser-vessel-identity.js";

const STORE = "keystore";
export const CUSTODY_TREE_ROW = "custody-slots";
export const SEALED_ROW_PREFIX = "sealed/";
export const KEYSTORE_CARRIER_PREFIX = "browser-keystore/";

const DEVICE_SEED_ROW = "vessel-key";
const CUSTODY_ROW = /^(?:vessel-key|keyhive-archive|veil-archive-h\d+)$/;

/** Is `row` one the slot tree wraps: the device seed or a Keyhive Archive. */
export function isCustodyRow(row: string): boolean { return CUSTODY_ROW.test(row); }

/** The sealed carrier a custody row rests in once a slot binds. */
export function sealedCarrierOf(row: string): SealedCarrier {
  if (!isCustodyRow(row)) throw new Error(`[browser-custody] "${row}" names no custody row`);
  return { name: `${KEYSTORE_CARRIER_PREFIX}${row}`, path: `${SEALED_ROW_PREFIX}${row}` };
}

export type BrowserCustodyRefusalReading =
  | "sealed-locked" | "already-sealed" | "not-sealed" | "unsettled" | "tree-unreadable" | "row-unopened" | "torn-without-tree";

const SAYS: Record<BrowserCustodyRefusalReading, string> = {
  "sealed-locked": "the keystore rests sealed and this page holds no unlock; unlock it with its passphrase first",
  "already-sealed": "a slot tree already stands; bind another slot instead of sealing again",
  "not-sealed": "no slot tree stands; the keystore rests in the clear",
  "unsettled": "a clear row stands beside the slot tree; an unlock settles it, and nothing chooses between two values",
  "tree-unreadable": "the slot tree does not read, so no route can be judged against it; nothing was written",
  "row-unopened": "the key this page holds does not open the sealed row; nothing was written",
  "torn-without-tree": "a sealed row stands with no slot tree beside it, so no route can open it; nothing was written",
};

/** A custody act or row the keystore's standing state refuses. Nothing was written. */
export class BrowserCustodyRefused extends Error {
  override readonly name = "BrowserCustodyRefused";
  constructor(readonly reading: BrowserCustodyRefusalReading, readonly idbName: string, readonly row?: string, detail?: string) {
    super(`[browser-custody] ${reading} — "${idbName}"${row ? ` row ${row}` : ""}: ${SAYS[reading]}${detail ? ` (${detail})` : ""}`);
  }
}

// ── the page's unlocks ──────────────────────────────────────────────────────────────────────────────

const unlocked = new Map<string, VesselKey>();

/** Drop this page's unlock of the vessel. The sealed rows stay; every custody read refuses until the next unlock. */
export function lockBrowserCustody(idbName: string): void { unlocked.delete(idbName); }

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
        if (!bytesEqual(now, expected)) { resolve(false); return; }
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

/** The device seed's record: its public half and its seed, as the clear row has always held them. */
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

const codecOf = (row: string): RowCodec => (row === DEVICE_SEED_ROW ? deviceSeedCodec : archiveCodec);

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a[i]! ^ b[i]!;
  return d === 0;
}

// ── the row door: every custody reader and writer rides it ───────────────────────────────────────

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
  const vk = unlocked.get(idbName);
  if (!vk) throw new BrowserCustodyRefused("sealed-locked", idbName, row);
  if (st.sealed === undefined) return undefined;
  const opened = await openSealedCarrier({ io: browserKeystoreCustodyIo(idbName), vk, carrier });
  if (opened.reading !== "opens") throw new BrowserCustodyRefused("row-unopened", idbName, row, opened.reading);
  return codecOf(row).fromBytes(opened.plaintext);
}

/**
 * Keep a custody row: in the clear while no tree stands, sealed under this page's unlock once one does. A sealed
 * write lands through the mesh writer, so the standing seal stays until the new one reads back and opens.
 */
export async function writeKeystoreRow(idbName: string, row: string, value: unknown): Promise<void> {
  const carrier = sealedCarrierOf(row);
  const plaintext = codecOf(row).toBytes(value);
  const st = await rowState(idbName, row);
  if (st.tree === undefined) {
    if (st.sealed !== undefined) throw new BrowserCustodyRefused("torn-without-tree", idbName, row);
    return putClearWhileNoTree(idbName, row, value);
  }
  treeOrRefuse(idbName, st.tree, row);
  if (st.clear !== undefined) throw new BrowserCustodyRefused("unsettled", idbName, row);
  const vk = unlocked.get(idbName);
  if (!vk) throw new BrowserCustodyRefused("sealed-locked", idbName, row);
  await writeSealedCarrier({ io: browserKeystoreCustodyIo(idbName), vk, treePath: CUSTODY_TREE_ROW, carrier, plaintext });
}

// ── the acts ─────────────────────────────────────────────────────────────────────────────────────

export type BrowserCustodyStatus =
  | { readonly reading: "clear" }
  | { readonly reading: "sealed"; readonly unlocked: boolean; readonly slots: readonly { readonly id: string; readonly t: number; readonly kinds: readonly ("passphrase" | "paper")[] }[] }
  | { readonly reading: "unreadable"; readonly why: string };

/** What the keystore's custody reads as: clear, sealed (and whether this page holds an unlock), or unreadable. */
export async function readBrowserCustody(idbName: string): Promise<BrowserCustodyStatus> {
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

function pinOf(route: Credential): PinSpec {
  if (route.kind === "passphrase") return { kind: "passphrase", passphrase: route.passphrase };
  if (route.kind === "paper") return { kind: "paper", confirmed: confirmHeldPaper(route.sheets) };
  throw new Error(`[browser-custody] a slot binds a passphrase or a paper sheet; got "${String((route as { kind: unknown }).kind)}"`);
}

/** Prove `route` opens `tree`'s encoded bytes to `vk` through `slotId`, before the tree lands anywhere. */
function proveRouteOpens(tree: SlotTree, vk: VesselKey, route: Credential, slotId: string): void {
  const back = decodeSlotTree(encodeSlotTree(tree));
  if (back.reading !== "readable") throw new Error("[browser-custody] the bound slot tree does not read back; nothing was written");
  const opened = openVk(back.tree, [route]);
  if (opened.reading !== "opens" || !vkEquals(opened.vk, vk) || opened.slot !== slotId) {
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
async function settleClearRows(idbName: string, vk: VesselKey): Promise<{ moved: string[]; left: UnsettledRow[] }> {
  const io = browserKeystoreCustodyIo(idbName);
  const moved: string[] = [];
  const left: UnsettledRow[] = [];
  for (const key of (await keystoreKeys(idbName)).filter(isCustodyRow).sort()) {
    const carrier = sealedCarrierOf(key);
    const st = await rowState(idbName, key);
    if (st.clear === undefined) continue;
    let plaintext: Uint8Array;
    try { plaintext = codecOf(key).toBytes(st.clear); } catch (e) { left.push({ row: key, why: `the clear row holds no ${key} value (${(e as Error).message})` }); continue; }
    const standing = await openSealedCarrier({ io, vk, carrier });
    if (standing.reading === "absent") {
      await writeSealedCarrier({ io, vk, treePath: CUSTODY_TREE_ROW, carrier, plaintext });
    } else if (standing.reading !== "opens") {
      left.push({ row: key, why: `its sealed row reads ${standing.reading}` }); continue;
    } else if (!bytesEqual(standing.plaintext, plaintext)) {
      left.push({ row: key, why: "its sealed row holds a different value; nothing chooses between the two" }); continue;
    }
    const back = await openSealedCarrier({ io, vk, carrier });
    if (back.reading !== "opens" || !bytesEqual(back.plaintext, plaintext)) { left.push({ row: key, why: "its seal did not read back" }); continue; }
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
export async function sealBrowserKeystore(idbName: string, route: Credential): Promise<{ readonly slot: string; readonly sealed: readonly string[]; readonly unsettled: readonly UnsettledRow[] }> {
  const io = browserKeystoreCustodyIo(idbName);
  if ((await io.read(CUSTODY_TREE_ROW)) !== null) throw new BrowserCustodyRefused("already-sealed", idbName);
  const vk = mintVk();
  const tree = bindSlot(null, vk, { t: 1, pins: [pinOf(route)] });
  const slot = tree.slots[0]!.id;
  proveRouteOpens(tree, vk, route, slot);
  await commitSlotTree({ io, path: CUSTODY_TREE_ROW, expected: null, vk, tree, carriers: await standingCarriers(idbName) });
  unlocked.set(idbName, vk);
  const { moved, left } = await settleClearRows(idbName, vk);
  return { slot, sealed: moved, unsettled: left };
}

export type BrowserCustodyUnlock =
  | { readonly reading: "opens"; readonly slot: string; readonly settled: readonly string[]; readonly unsettled: readonly UnsettledRow[] }
  | { readonly reading: "no-slot-opens"; readonly notes: readonly string[] };

async function openWith(idbName: string, credentials: readonly Credential[]): Promise<{ tree: SlotTree; bytes: Uint8Array } & ({ opened: { vk: VesselKey; slot: string } } | { opened: null; notes: readonly string[] })> {
  const bytes = await browserKeystoreCustodyIo(idbName).read(CUSTODY_TREE_ROW);
  if (bytes === null) throw new BrowserCustodyRefused("not-sealed", idbName);
  const tree = treeOrRefuse(idbName, bytes);
  const r = openVk(tree, credentials);
  return r.reading === "opens" ? { tree, bytes, opened: { vk: r.vk, slot: r.slot } } : { tree, bytes, opened: null, notes: r.notes };
}

/**
 * Open the keystore's VK with the person's route and hold it for this page. A route that opens no slot answers
 * `no-slot-opens` and writes nothing. An opening settles first: a stray sidecar goes, and a clear row a fault left
 * moves under the seal.
 */
export async function unlockBrowserCustody(idbName: string, credentials: readonly Credential[]): Promise<BrowserCustodyUnlock> {
  const o = await openWith(idbName, credentials);
  if (!o.opened) return { reading: "no-slot-opens", notes: o.notes };
  const io = browserKeystoreCustodyIo(idbName);
  await settleRotation({ io, treePath: CUSTODY_TREE_ROW, carriers: await standingCarriers(idbName) });
  unlocked.set(idbName, o.opened.vk);
  const { moved, left } = await settleClearRows(idbName, o.opened.vk);
  return { reading: "opens", slot: o.opened.slot, settled: moved, unsettled: left };
}

function heldOrRefuse(idbName: string): VesselKey {
  const vk = unlocked.get(idbName);
  if (!vk) throw new BrowserCustodyRefused("sealed-locked", idbName);
  return vk;
}

/** Bind one more slot under `route`, over the VK this page holds. The route reopens the new tree before it lands. */
export async function bindBrowserCustodySlot(idbName: string, route: Credential): Promise<{ readonly slot: string }> {
  const vk = heldOrRefuse(idbName);
  const io = browserKeystoreCustodyIo(idbName);
  const expected = await io.read(CUSTODY_TREE_ROW);
  if (expected === null) throw new BrowserCustodyRefused("not-sealed", idbName);
  const tree = bindSlot(treeOrRefuse(idbName, expected), vk, { t: 1, pins: [pinOf(route)] });
  const slot = tree.slots[tree.slots.length - 1]!.id;
  proveRouteOpens(tree, vk, route, slot);
  await commitSlotTree({ io, path: CUSTODY_TREE_ROW, expected, vk, tree, carriers: [] });
  return { slot };
}

/**
 * Remove one slot, over the VK this page holds. The last slot never leaves. The answer carries the rotation offer:
 * a copy of the tree taken before the unbind still opens through the removed slot until the VK rotates.
 */
export async function unbindBrowserCustodySlot(idbName: string, slotId: string): Promise<{ readonly rotationOffer: string }> {
  const vk = heldOrRefuse(idbName);
  const io = browserKeystoreCustodyIo(idbName);
  const expected = await io.read(CUSTODY_TREE_ROW);
  if (expected === null) throw new BrowserCustodyRefused("not-sealed", idbName);
  const { tree, rotationOffer } = unbindSlot(treeOrRefuse(idbName, expected), slotId);
  await commitSlotTree({ io, path: CUSTODY_TREE_ROW, expected, vk, tree, carriers: [] });
  return { rotationOffer };
}

/** The door the clear-password act asks through: false parks the question, true on the person's confirmed pass. */
export type ConfirmDoor = (question: string) => boolean;

export const CLEAR_CUSTODY_QUESTION =
  "Clear this browser's passphrase? The device seed and the Keyhive Archives will rest in the clear in this browser's storage, readable by anyone who can read it.";

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
  const o = await openWith(idbName, credentials);
  if (!o.opened) return { reading: "no-slot-opens", notes: o.notes };
  const { vk } = o.opened;
  // Every sealed row opens BEFORE the person is asked, so a confirmed clear never meets a refusal it could have named.
  await openEverySealedRow(idbName, vk);
  // Only a literal `true` answers: a door that hands back anything else (a pending promise, a truthy string) parks.
  if (confirm(CLEAR_CUSTODY_QUESTION) !== true) return { reading: "asks", question: CLEAR_CUSTODY_QUESTION };
  const io = browserKeystoreCustodyIo(idbName);
  await settleRotation({ io, treePath: CUSTODY_TREE_ROW, carriers: await standingCarriers(idbName) });
  const cleared: string[] = [];
  for (const { row, carrier, frame, plaintext } of await openEverySealedRow(idbName, vk)) {
    // ONE TRANSACTION: the clear row lands only while the sealed row still holds the very frame this act opened, so
    // a newer seal another tab wrote meanwhile refuses the clear rather than losing to an older value.
    await putClearWhileSealedHolds(idbName, row, codecOf(row).fromBytes(plaintext), frame);
    const back = (await rowState(idbName, row)).clear;
    if (back === undefined || !bytesEqual(codecOf(row).toBytes(back), plaintext)) {
      throw new Error(`[browser-custody] the clear ${row} row did not read back as opened; its sealed row stays`);
    }
    // The sealed carrier leaves only while it still opens to what now rests in the clear.
    const gone = await removeSealedCarrier({ io, vk, treePath: CUSTODY_TREE_ROW, carrier, when: (p) => bytesEqual(p, plaintext) });
    if (!gone) throw new BrowserCustodyRefused("unsettled", idbName, row, "its sealed row changed during the clear; both rows stay");
    cleared.push(row);
  }
  await io.exclusive(async () => {
    const left = (await io.list()).filter((k) => k.startsWith(SEALED_ROW_PREFIX));
    if (left.length > 0) throw new Error(`[browser-custody] sealed rows still stand (${left.join(", ")}); the tree stays`);
    const now = await io.read(CUSTODY_TREE_ROW);
    if (now === null || !bytesEqual(now, o.bytes)) throw new Error("[browser-custody] the slot tree moved during the clear; it stays");
    await io.remove(CUSTODY_TREE_ROW);
  });
  unlocked.delete(idbName);
  return { reading: "cleared", cleared };
}

/** Open every sealed custody row under `vk`, reading only: a row that will not open, or a clear row beside it, refuses. */
async function openEverySealedRow(idbName: string, vk: VesselKey): Promise<{ row: string; carrier: SealedCarrier; frame: Uint8Array; plaintext: Uint8Array }[]> {
  const io = browserKeystoreCustodyIo(idbName);
  const out: { row: string; carrier: SealedCarrier; frame: Uint8Array; plaintext: Uint8Array }[] = [];
  for (const carrier of await standingCarriers(idbName)) {
    const row = carrier.path.slice(SEALED_ROW_PREFIX.length);
    const st = await rowState(idbName, row);
    if (st.clear !== undefined) throw new BrowserCustodyRefused("unsettled", idbName, row);
    if (st.sealed === undefined) continue;
    if (!(st.sealed instanceof Uint8Array)) throw new BrowserCustodyRefused("row-unopened", idbName, row, "the sealed row holds no bytes");
    const sealed = await openSealedCarrier({ io, vk, carrier });
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
        if (!(g.result instanceof Uint8Array) || !bytesEqual(g.result, frame)) {
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
