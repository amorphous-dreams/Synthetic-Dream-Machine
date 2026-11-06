/**
 * browser-face-custody — each face keeps its own fire: a face custody key (FCK) per PersonaGroup, wrapped in that face's own
 * slot tree, and that face's rows sealed under it (lar:///ha.ka.ba/lares/docs/pono/k15-custody-step-zero#/row-census-browser;
 * lar:///ha.ka.ba/lares/docs/pono/browser-vessel-lift, slice 3 part ii).
 *
 * ── WHAT RESTS WHERE ─────────────────────────────────────────────────────────────────────────────
 * In the vessel's IndexedDB `keystore`, beside the place rows:
 *   `face-index`               F, clear: one entry per face, `{ group, fcid }`, where `group` reads the SHA-256 hex of the
 *                              PersonaGroup and `fcid` the face custody id (16 random bytes, hex) minted with the face's tree.
 *                              It names no face, no handle and no key byte. A cleared face leaves a tombstone.
 *   `face-slots/<fcid>`        the face's own slot tree: its wrapped FCK, its salts, its slot ids, and nothing of a sibling.
 *   `face-sealed/<fcid>/<row>` a D row of that face, sealed under its FCK (`@lararium/mesh` `sealUnderFck`), its context binding
 *                              the store, the fcid as owner, the row name, its kind and its full reference, so bytes moved to
 *                              another face's place or another row's name open nowhere.
 * The face's `anchor` row, sealed at the bind, names its PersonaGroup: the index routes and never decides, so an unlock
 * compares the anchor's group with the face it opened for and refuses `face-index-mismatch` before it seats anything.
 *
 * ── THE FIRST PERSISTENCE ────────────────────────────────────────────────────────────────────────
 * A face holds no row before its tree binds: a write, the root mint and an ember's mint refuse `no-custody-slot` until
 * `bindFirstFaceSlot` stands the face's tree (the first fleet join included). A bound face whose key this thread does not hold
 * refuses `face-locked`.
 *
 * ── THE KEY MAP ──────────────────────────────────────────────────────────────────────────────────
 * This thread (the vessel worker's) holds each unlocked face's FCK in memory alone, keyed by store and face. No bare key leaves
 * the module: every seal and open runs here, each act on its own copy that zero-fills after it. `lockFaceCustody` overwrites
 * one face's key and leaves every other face as it stood; the house calls it at the face's last session.
 *
 * ── THE WRITER ───────────────────────────────────────────────────────────────────────────────────
 * One writer lock per store (the keystore port's `exclusive`). A write replaces a standing row only when that row opens under
 * the writer's own key (an occupied row the key never opens refuses `row-unopened`, every byte left), seals to a sidecar, reads
 * it back, opens it, and only then renames over the carrier.
 *
 * ── A CLEAR NAMES ONE FACE ───────────────────────────────────────────────────────────────────────
 * `clearFaceCustody` takes one PersonaGroup (none refuses `face-absent`), a route that opens THAT face's tree, and a person's
 * answer through the confirm door; it removes that face's tree and rows alone and leaves a tombstone in the index. A wrong
 * route answers `no-slot-opens` and writes nothing; the confirm door's first "no" parks the act with nothing written.
 *
 * Meme: lar:///ha.ka.ba/lararium/browser/browser-custody
 */
import {
  bindSlot, decodeSlotTree, encodeSlotTree, mintFck, nobleKdf, openTreeKey, openUnderFck, sealUnderFck, treeKeyEquals,
  type Credential, type FaceCarrier, type FaceCustodyKey,
} from "@lararium/mesh";
import { browserKeystoreCustodyIo, custodyPinOf, type ConfirmDoor, type CustodyBindRoute } from "./browser-custody.js";

export const FACE_INDEX_ROW = "face-index";
export const FACE_TREE_PREFIX = "face-slots/";
export const FACE_SEALED_PREFIX = "face-sealed/";
const ANCHOR_ROW = "anchor";
const ROOT_ROW = "persona-root";
const SIDECAR = ".sealing";
const ROW_NAME = /^[A-Za-z0-9][A-Za-z0-9._:/-]*$/;

export type FaceCustodyRefusalReading =
  | "face-absent" | "face-names-a-handle" | "no-custody-slot" | "face-locked" | "already-bound" | "row-unopened"
  | "face-index-mismatch" | "tree-unreadable" | "row-name-refused" | "passkey-alone-refused";

const SAYS: Record<FaceCustodyRefusalReading, string> = {
  "face-absent": "the act names no face; a face custody act names one PersonaGroup",
  "face-names-a-handle": "a face names its PersonaGroup, never a local handle index h<N>",
  "no-custody-slot": "this face holds no slot tree yet; its first row waits until a passphrase or paper slot binds",
  "face-locked": "this face's custody stands locked on this thread; the face's own unlock opens it",
  "already-bound": "this face's slot tree already stands; bind another slot over it instead",
  "row-unopened": "the face's key does not open the row standing there; nothing was written",
  "face-index-mismatch": "the tree the index routed to anchors another PersonaGroup; nothing was seated",
  "tree-unreadable": "this face's slot tree does not read; no route can be judged against it",
  "row-name-refused": "a face row names itself by a plain path, never the anchor, a sidecar or a climb",
  "passkey-alone-refused": "a face's first slot binds a passphrase or paper route; a passkey binds beside one",
};

/** A face custody act the face's standing state refuses. Nothing was written. */
export class FaceCustodyRefused extends Error {
  override readonly name = "FaceCustodyRefused";
  constructor(readonly reading: FaceCustodyRefusalReading, readonly row?: string, detail?: string) {
    super(`[browser-face-custody] ${reading}${row ? ` (row ${row})` : ""}: ${SAYS[reading]}${detail ? ` — ${detail}` : ""}`);
  }
}

/** The face an act names, checked: a PersonaGroup, never null, never `h<N>`. */
export function checkFaceName(face: unknown): string {
  if (typeof face !== "string" || face.length === 0) throw new FaceCustodyRefused("face-absent");
  if (/^h\d+$/.test(face)) throw new FaceCustodyRefused("face-names-a-handle");
  return face;
}

function checkRow(row: string): string {
  if (!ROW_NAME.test(row) || row === ANCHOR_ROW || row.endsWith(SIDECAR) || row.split("/").some((p) => p === "" || p === "." || p === "..")) {
    throw new FaceCustodyRefused("row-name-refused", row);
  }
  return row;
}

// ── the key map ───────────────────────────────────────────────────────────────────────────────────

interface Seated { readonly fcid: string; readonly fck: FaceCustodyKey }
const seated = new Map<string, Map<string, Seated>>();

function seat(idbName: string, face: string, fcid: string, fck: FaceCustodyKey): void {
  const faces = seated.get(idbName) ?? new Map<string, Seated>();
  seated.set(idbName, faces);
  const before = faces.get(face);
  if (before && before.fck !== fck) before.fck.fill(0);
  faces.set(face, { fcid, fck });
}

/** Overwrite one face's key on this thread. Every other face stands as it stood. Answers true when a key stood. */
export function lockFaceCustody(idbName: string, face: string): boolean {
  const faces = seated.get(idbName);
  const held = faces?.get(face);
  if (!held) return false;
  held.fck.fill(0);
  faces!.delete(face);
  return true;
}

/** Overwrite every face's key this thread holds for one store (the vessel's last session). Answers how many stood. */
export function overwriteEveryFaceCustody(idbName: string): number {
  const faces = seated.get(idbName);
  if (!faces) return 0;
  const n = faces.size;
  for (const held of faces.values()) held.fck.fill(0);
  seated.delete(idbName);
  return n;
}

/** Does this thread hold `face`'s key for this store. */
export function faceCustodyHeld(idbName: string, face: string): boolean { return seated.get(idbName)?.has(face) ?? false; }

/** How many face keys this thread holds: a count, never a key. */
export function faceCustodyKeysHeld(idbName?: string): number {
  if (idbName !== undefined) return seated.get(idbName)?.size ?? 0;
  let n = 0;
  for (const faces of seated.values()) n += faces.size;
  return n;
}

// ── the index ─────────────────────────────────────────────────────────────────────────────────────

interface IndexEntry { readonly group: string; readonly fcid: string; readonly removed?: true }

const hex = (b: Uint8Array): string => [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
const enc = (s: string): Uint8Array<ArrayBuffer> => new TextEncoder().encode(s);

async function groupDigest(face: string): Promise<string> {
  return hex(new Uint8Array(await crypto.subtle.digest("SHA-256", enc(face))));
}

async function readIndex(idbName: string): Promise<IndexEntry[]> {
  const bytes = await browserKeystoreCustodyIo(idbName).read(FACE_INDEX_ROW);
  if (bytes === null) return [];
  const parsed = JSON.parse(new TextDecoder().decode(bytes)) as { entries?: unknown };
  if (!Array.isArray(parsed.entries)) throw new Error("[browser-face-custody] the face index holds no { entries } record");
  return parsed.entries as IndexEntry[];
}

async function writeIndex(idbName: string, entries: readonly IndexEntry[]): Promise<void> {
  await browserKeystoreCustodyIo(idbName).write(FACE_INDEX_ROW, enc(JSON.stringify({ entries })));
}

async function entryOf(idbName: string, face: string): Promise<IndexEntry | null> {
  const group = await groupDigest(face);
  return (await readIndex(idbName)).find((e) => e.group === group && !e.removed) ?? null;
}

const treePath = (fcid: string): string => `${FACE_TREE_PREFIX}${fcid}`;
const rowPath = (fcid: string, row: string): string => `${FACE_SEALED_PREFIX}${fcid}/${row}`;

function carrierOf(idbName: string, fcid: string, row: string): FaceCarrier {
  const path = rowPath(fcid, row);
  return { name: row, path, kind: row.split("/")[0]!, ref: `browser-keystore/${path}`, owner: fcid, store: idbName };
}

/** The keystore row a face row rests at (for a census): resolves through the index, routing only. */
export async function faceRowPath(idbName: string, face: string, row: string): Promise<string> {
  checkFaceName(face);
  const fcid = seated.get(idbName)?.get(face)?.fcid ?? (await entryOf(idbName, face))?.fcid;
  if (!fcid) throw new FaceCustodyRefused("no-custody-slot");
  return rowPath(fcid, checkRow(row));
}

// ── reading the face ──────────────────────────────────────────────────────────────────────────────

export type FaceCustodyStatus =
  | { readonly reading: "absent" }
  | { readonly reading: "bound"; readonly unlocked: boolean }
  | { readonly reading: "unreadable"; readonly why: string };

/** A public reading of one face's custody: no tree, a tree locked or open on this thread, or a tree that does not read. */
export async function readFaceCustody(idbName: string, face: string): Promise<FaceCustodyStatus> {
  checkFaceName(face);
  const entry = await entryOf(idbName, face);
  if (!entry) return { reading: "absent" };
  const tree = decodeSlotTree(await browserKeystoreCustodyIo(idbName).read(treePath(entry.fcid)));
  if (tree.reading === "absent") return { reading: "absent" };
  if (tree.reading === "unreadable") return { reading: "unreadable", why: tree.why };
  return { reading: "bound", unlocked: faceCustodyHeld(idbName, face) };
}

/** The passkey pins' public halves of one face's tree, for the ceremony's assertion. */
export async function readFaceCustodyPasskeys(idbName: string, face: string): Promise<readonly { readonly credentialId: Uint8Array; readonly prfSalt: Uint8Array }[]> {
  const entry = await entryOf(idbName, checkFaceName(face));
  if (!entry) return [];
  const tree = decodeSlotTree(await browserKeystoreCustodyIo(idbName).read(treePath(entry.fcid)));
  if (tree.reading !== "readable") return [];
  return tree.tree.slots.flatMap((s) => s.pins.flatMap((p) => p.kind === "passkey" ? [{ credentialId: p.credentialId.slice(), prfSalt: p.prfSalt.slice() }] : []));
}

/** The held key, copied for one act; refused by name where the face holds no tree or stands locked. */
async function keyFor(idbName: string, face: string): Promise<Seated> {
  checkFaceName(face);
  const held = seated.get(idbName)?.get(face);
  // Each act seals on its own copy, so a lock that overwrites the held key meanwhile never leaves a write sealing under zeros.
  if (held) return { fcid: held.fcid, fck: held.fck.slice() as FaceCustodyKey };
  if (!(await entryOf(idbName, face))) throw new FaceCustodyRefused("no-custody-slot");
  throw new FaceCustodyRefused("face-locked");
}

// ── the seal ──────────────────────────────────────────────────────────────────────────────────────

async function sealRow(idbName: string, fcid: string, fck: FaceCustodyKey, row: string, plaintext: Uint8Array): Promise<void> {
  const io = browserKeystoreCustodyIo(idbName);
  const carrier = carrierOf(idbName, fcid, row);
  await io.exclusive(async () => {
    const standing = await io.read(carrier.path);
    if (standing !== null) {
      const opened = openUnderFck(fck, carrier, standing);
      if (opened.reading !== "opens") throw new FaceCustodyRefused("row-unopened", row);
      opened.plaintext.fill(0);
    }
    const side = `${carrier.path}${SIDECAR}`;
    await io.write(side, sealUnderFck(fck, carrier, plaintext));
    const back = openUnderFck(fck, carrier, await io.read(side));
    if (back.reading !== "opens") { await io.remove(side); throw new Error(`[browser-face-custody] the sealed ${row} did not read back; nothing was replaced`); }
    back.plaintext.fill(0);
    await io.rename(side, carrier.path);
  });
}

function openRow(idbName: string, fcid: string, fck: FaceCustodyKey, row: string, bytes: Uint8Array | null): Uint8Array | null {
  if (bytes === null) return null;
  const opened = openUnderFck(fck, carrierOf(idbName, fcid, row), bytes);
  if (opened.reading !== "opens") throw new FaceCustodyRefused("row-unopened", row, opened.reading);
  return opened.plaintext;
}

/** Seal one row of `face` under its own key. */
export async function writeFaceRow(idbName: string, face: string, row: string, value: Uint8Array): Promise<void> {
  checkRow(row);
  const { fcid, fck } = await keyFor(idbName, face);
  try { await sealRow(idbName, fcid, fck, row, value); } finally { fck.fill(0); }
}

/** Open one row of `face` under its own key; null where none rests. */
export async function readFaceRow(idbName: string, face: string, row: string): Promise<Uint8Array | null> {
  checkRow(row);
  const { fcid, fck } = await keyFor(idbName, face);
  try { return openRow(idbName, fcid, fck, row, await browserKeystoreCustodyIo(idbName).read(rowPath(fcid, row))); } finally { fck.fill(0); }
}

/**
 * The isolation probe's door, bypassing every router: does the key this thread holds for `keyFace` open the bytes resting at
 * `rowFace`'s row. It hands out no key and no plaintext; the plaintext of an open zero-fills before this answers.
 */
export async function faceKeyOpens(idbName: string, keyFace: string, rowFace: string, row: string): Promise<boolean> {
  const { fck } = await keyFor(idbName, keyFace);
  try {
    const entry = await entryOf(idbName, checkFaceName(rowFace));
    if (!entry) return false;
    const carrier = carrierOf(idbName, entry.fcid, checkRow(row));
    const opened = openUnderFck(fck, carrier, await browserKeystoreCustodyIo(idbName).read(carrier.path));
    if (opened.reading !== "opens") return false;
    opened.plaintext.fill(0);
    return true;
  } finally { fck.fill(0); }
}

// ── the bind, the unlock ──────────────────────────────────────────────────────────────────────────

/**
 * Stand `face`'s first slot tree, before its first row: a fresh FCK and fcid, the route proved to reopen the tree before it
 * lands, the anchor sealed, then the index entry. Leaves the face unlocked on this thread.
 */
export async function bindFirstFaceSlot(idbName: string, face: string, route: CustodyBindRoute): Promise<{ readonly slot: string }> {
  checkFaceName(face);
  if (route.kind === "passkey") throw new FaceCustodyRefused("passkey-alone-refused");
  const io = browserKeystoreCustodyIo(idbName);
  if (await entryOf(idbName, face)) throw new FaceCustodyRefused("already-bound");
  const fcid = hex(crypto.getRandomValues(new Uint8Array(16)));
  const fck = mintFck();
  const tree = await bindSlot(null, fck, { t: 1, pins: [custodyPinOf(route)] }, nobleKdf);
  const slot = tree.slots[0]!.id;
  const back = decodeSlotTree(encodeSlotTree(tree));
  if (back.reading !== "readable") throw new Error("[browser-face-custody] the bound tree does not read back; nothing was written");
  const proved = await openTreeKey(back.tree, [route], nobleKdf);
  if (proved.reading !== "opens" || !treeKeyEquals(proved.treeKey, fck)) throw new Error("[browser-face-custody] the route does not reopen the tree it just bound; nothing was written");
  proved.treeKey.fill(0);
  await io.exclusive(async () => {
    if ((await io.read(treePath(fcid))) !== null) throw new Error("[browser-face-custody] a tree already rests at a freshly minted fcid");
    await io.write(treePath(fcid), encodeSlotTree(tree));
  });
  await sealRow(idbName, fcid, fck, ANCHOR_ROW, enc(face));
  const group = await groupDigest(face);
  await io.exclusive(async () => {
    const entries = await readIndex(idbName);
    if (entries.some((e) => e.group === group && !e.removed)) throw new FaceCustodyRefused("already-bound");
    await writeIndex(idbName, [...entries, { group, fcid }]);
  });
  seat(idbName, face, fcid, fck);
  return { slot };
}

export type FaceCustodyUnlock =
  | { readonly reading: "opens"; readonly slot: string }
  | { readonly reading: "no-slot-opens"; readonly notes: readonly string[] };

/** Open `face`'s tree with the presented routes, check its anchor against the face, and seat its key. Never throws on a route. */
export async function unlockFaceCustody(idbName: string, face: string, credentials: readonly Credential[]): Promise<FaceCustodyUnlock> {
  checkFaceName(face);
  const entry = await entryOf(idbName, face);
  if (!entry) throw new FaceCustodyRefused("no-custody-slot");
  const reading = decodeSlotTree(await browserKeystoreCustodyIo(idbName).read(treePath(entry.fcid)));
  if (reading.reading === "absent") throw new FaceCustodyRefused("no-custody-slot");
  if (reading.reading === "unreadable") throw new FaceCustodyRefused("tree-unreadable", undefined, reading.why);
  const opened = await openTreeKey(reading.tree, credentials, nobleKdf);
  if (opened.reading !== "opens") return { reading: "no-slot-opens", notes: opened.notes };
  // THE INDEX ROUTES AND NEVER DECIDES: the anchor under the opened key names the face's PersonaGroup.
  let anchor: Uint8Array | null = null;
  try { anchor = openRow(idbName, entry.fcid, opened.treeKey, ANCHOR_ROW, await browserKeystoreCustodyIo(idbName).read(rowPath(entry.fcid, ANCHOR_ROW))); } catch { anchor = null; }
  const named = anchor === null ? null : new TextDecoder().decode(anchor);
  anchor?.fill(0);
  if (named !== face) { opened.treeKey.fill(0); throw new FaceCustodyRefused("face-index-mismatch"); }
  seat(idbName, face, entry.fcid, opened.treeKey);
  return { reading: "opens", slot: opened.slot };
}

// ── the root ──────────────────────────────────────────────────────────────────────────────────────

/** Mint `face`'s persona root under its own key, once. Refuses `no-custody-slot` before the face's tree binds, `face-locked` while it stands locked. */
export async function mintFaceRoot(idbName: string, face: string): Promise<{ readonly minted: boolean }> {
  const { fcid, fck } = await keyFor(idbName, face);
  try {
    const io = browserKeystoreCustodyIo(idbName);
    if ((await io.read(rowPath(fcid, ROOT_ROW))) !== null) return { minted: false };
    const seed = crypto.getRandomValues(new Uint8Array(32));
    try { await sealRow(idbName, fcid, fck, ROOT_ROW, seed); } finally { seed.fill(0); }
    return { minted: true };
  } finally { fck.fill(0); }
}

/** The face's persona root seed, for one act on this thread; the caller zero-fills it. */
export async function readFaceRoot(idbName: string, face: string): Promise<Uint8Array> {
  const seed = await readFaceRow(idbName, face, ROOT_ROW);
  if (seed === null) throw new FaceCustodyRefused("no-custody-slot", ROOT_ROW, "no root minted for this face yet");
  return seed;
}

// ── the clear ─────────────────────────────────────────────────────────────────────────────────────

export const CLEAR_FACE_QUESTION =
  "Remove this face's custody from this browser? Its slot tree and every row sealed under it leave this browser, and nothing here opens them again.";

export type FaceCustodyClear =
  | { readonly reading: "cleared"; readonly rows: number }
  | { readonly reading: "asked" }
  | { readonly reading: "no-slot-opens"; readonly notes: readonly string[] };

/** Clear ONE face's custody: a route that opens that face's tree and a person's yes; every other face stands untouched. */
export async function clearFaceCustody(idbName: string, face: string | null, credentials: readonly Credential[], confirm: ConfirmDoor): Promise<FaceCustodyClear> {
  const named = checkFaceName(face);
  const entry = await entryOf(idbName, named);
  if (!entry) throw new FaceCustodyRefused("no-custody-slot");
  const io = browserKeystoreCustodyIo(idbName);
  const reading = decodeSlotTree(await io.read(treePath(entry.fcid)));
  if (reading.reading !== "readable") throw new FaceCustodyRefused("tree-unreadable");
  const opened = await openTreeKey(reading.tree, credentials, nobleKdf);
  if (opened.reading !== "opens") return { reading: "no-slot-opens", notes: opened.notes };
  opened.treeKey.fill(0);
  if (!confirm(CLEAR_FACE_QUESTION)) return { reading: "asked" };
  const rows = await io.exclusive(async () => {
    const prefix = `${FACE_SEALED_PREFIX}${entry.fcid}/`;
    const mine = (await io.list()).filter((r) => r.startsWith(prefix));
    for (const r of mine) await io.remove(r);
    await io.remove(treePath(entry.fcid));
    const entries = await readIndex(idbName);
    await writeIndex(idbName, entries.map((e) => e.fcid === entry.fcid ? { group: e.group, fcid: e.fcid, removed: true as const } : e));
    return mine.length;
  });
  lockFaceCustody(idbName, named);
  return { reading: "cleared", rows };
}
