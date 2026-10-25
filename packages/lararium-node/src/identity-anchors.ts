/**
 * identity-anchors — the identity home's four sealed rows of one family: each face's sentinel anchors, the roster
 * of anchored faces, the vessel's own keyhive archive, and each face's veil archive.
 *
 * ── WHAT RESTS HERE ─────────────────────────────────────────────────────────────────────────────
 * The founding ceremony mints the PersonaGroup / MeshCabal sentinel ids off keyhive's CSPRNG, unreproducible from
 * any seed, and a keyhive Archive carries the prekey secrets and the group key agreement state a creator needs to
 * seat a member or seal a chunk. Both rest in the identity home beside the vessel's keys, outside the store a
 * re-found wipes, so a face survives its substrate.
 *
 * ── EVERY ROW RESTS SEALED UNDER THE VESSEL KEY ─────────────────────────────────────────────────
 * Each row reads and writes through the custody seat (`custody-seat`), and so through the one sealed writer. No
 * function here takes a key or a passphrase, and none writes a file by its own hand. At the floor (no key held)
 * every reader and writer refuses `CustodyLocked`; a row that stands and does not open refuses
 * `CustodyRowUnavailable`. `null` means one thing only: nothing stands at the row's path.
 *
 * ── A VEIL ARCHIVE BELONGS TO ONE FACE ──────────────────────────────────────────────────────────
 * Each face's veil identity keeps its own archive at `veil-archive-g<group digest>.bin`. The seal binds the row's name, so one
 * face's archive carried to another face's path opens for nobody.
 *
 * ── TWO ROWS, ONE COMMIT POINT ──────────────────────────────────────────────────────────────────
 * Anchoring a face writes its anchors row, then the roster. The roster's line commits the act: an anchors row no
 * roster line names stands unlisted until the same act runs again and records it.
 */

import { mkdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { faceFilePathSync, readFaceIndexSync } from "./face-index.js";
import { larIdentityDir } from "./vessel-paths.js";
import { readIdentityAnchors, type AnchorStore, type IdentityAnchors } from "@lararium/mesh";
import { identityHomeClosure } from "./identity-home-closure.js";
import { CustodyRowUnavailable } from "./custody-holder.js";
import { readCustodyRow, unlockedFaceOrdinals, writeCustodyRow } from "./custody-seat.js";
import { personaGroupDigest } from "./persona-group-file.js";

// The IdentityAnchors SHAPE + the AnchorStore shore lift to @lararium/mesh (platform-blind); this node
// adapter implements the fs shore. Re-exported so existing importers keep their spelling.
export type { IdentityAnchors } from "@lararium/mesh";

// PLURALITY PONO at the identity layer: a vessel that WEARS several personas anchors EACH to its OWN
// veiled Handle (distinct PersonaGroup + MeshCabal ids + agentId). The anchor store is therefore a SET
// keyed by handle-index (the `handle'` the persona-HD scheme derives). UNIFORM KEYING: every index
// spells `anchors-h${N}.json` (no founding special-case). A joinee holds only its ONE admitted persona's
// anchors, no matching root.
const anchorsFile = (handleIndex: number): string => `anchors-h${handleIndex}.json`;

type RowReader = typeof readCustodyRow;
const utf8 = new TextEncoder();
const text = (bytes: Uint8Array): string => new TextDecoder().decode(bytes);

/** A row that opened and does not hold its own shape: named, never read as absent. */
function malformed(file: string): CustodyRowUnavailable {
  return new CustodyRowUnavailable("identity", file, "malformed");
}

/**
 * Read the identity home's mode and report an opening, once per process.
 *
 * The identity module states the invariant and leaves it to its caller — "caller must ensure the
 * identity dir is not world-readable" — so this stands where the directory gets made. It reports and
 * never repairs, and it says plainly what a mode bit declines to cover.
 */
let identityHomeReported = false;
export function warnIfIdentityHomeOpen(): void {
  if (identityHomeReported) return;
  identityHomeReported = true;
  let mode: number | null = null;
  try { mode = statSync(larIdentityDir()).mode & 0o777; } catch { mode = null; }
  if (mode === null) return;                       // no reading, and a guess would reassure on nothing
  const verdict = identityHomeClosure(mode);
  if (!verdict.closed) console.warn(`[identity] ${verdict.reading}`);
}

/** Write ONE persona's anchor set (founding and admit both land it here) and record the index into the explicit
 *  roster. `handleIndex` selects which persona (0 = founding). */
export async function persistIdentityAnchors(anchors: IdentityAnchors, handleIndex = 0): Promise<void> {
  // THE HOME CARRIES THE MODE, not just the file. A recursive mkdir takes the process umask for the directory,
  // ordinarily 0755, and the floor key rests here outside the seal. Created owner-only, then READ BACK and
  // reported: a home that already stood open keeps its mode, because a vessel widened on purpose has reasons and
  // a silent chmod would hide the misconfiguration an operator wants to see.
  mkdirSync(larIdentityDir(), { recursive: true, mode: 0o700 });
  warnIfIdentityHomeOpen();
  await writeCustodyRow("identity", anchorsFile(handleIndex), utf8.encode(JSON.stringify(anchors, null, 2)));
}

/** Read ONE persona's anchor set back, or null when the index holds no persona. `handleIndex` selects which
 *  persona (0 = founding). */
export async function loadIdentityAnchors(handleIndex = 0, read: RowReader = readCustodyRow): Promise<IdentityAnchors | null> {
  const file = anchorsFile(handleIndex);
  const bytes = await read("identity", file);
  if (bytes === null) return null;
  let parsed: Partial<IdentityAnchors>;
  try { parsed = JSON.parse(text(bytes)) as Partial<IdentityAnchors>; } catch { throw malformed(file); }
  const anchors = readIdentityAnchors(parsed);
  if (anchors === null) throw malformed(file);
  return anchors;
}

/**
 * The anchored faces: every handle-index of a face standing UNLOCKED whose anchors row stands, ascending. Each face's anchors rest in
 * that face's own directory, so no shared roster names them; a face that rests locked names itself through the floor index alone
 * (`listFaceOrdinals`) and its anchors read once it unlocks.
 */
export async function listAnchoredPersonas(read: RowReader = readCustodyRow): Promise<number[]> {
  const out: number[] = [];
  for (const handleIndex of await unlockedFaceOrdinals()) {
    if (await read("identity", anchorsFile(handleIndex)) !== null) out.push(handleIndex);
  }
  return out;
}

/** Every handle index the floor index names a standing face at, ascending: the public list. Opens nothing. */
export function listFaceOrdinals(): number[] {
  const out: number[] = [];
  readFaceIndexSync(larIdentityDir()).faces.forEach((f, ordinal) => { if ("fcid" in f) out.push(ordinal); });
  return out;
}

/** The vessel's own keyhive Archive row. */
const ARCHIVE_FILE = "keyhive-archive.bin";

/** The keyhive Archive carrier path. The carrier table spells its row through it. */
export function archivePath(): string {
  return join(larIdentityDir(), ARCHIVE_FILE);
}

/** The veil archive family's filename law: one row per PersonaGroup. */
export const VEIL_ARCHIVE_FILE = /^veil-archive-g([0-9a-f]{64})\.bin$/;

/** One face's veil archive filename. */
export function veilArchiveFile(personaGroup: string): string {
  return `veil-archive-g${personaGroupDigest(personaGroup)}.bin`;
}

/** One face's veil archive path. */
export function veilArchivePath(personaGroup: string): string {
  return faceFilePathSync(larIdentityDir(), { group: personaGroupDigest(personaGroup) }, veilArchiveFile(personaGroup));
}

/**
 * Seal the vessel's own keyhive Archive (the membership and capability state, the prekey secrets, the contact
 * card). The restore path lives in keyhive-provider; this supplies the bytes a composition reads back. A newer
 * full archive supersedes an older one.
 */
export async function persistIdentityArchive(bytes: Uint8Array): Promise<void> {
  mkdirSync(larIdentityDir(), { recursive: true, mode: 0o700 });
  await writeCustodyRow("identity", ARCHIVE_FILE, bytes);
}

/** The vessel's keyhive Archive, or null when none stands. */
export function loadIdentityArchive(): Promise<Uint8Array | null> {
  return readCustodyRow("identity", ARCHIVE_FILE);
}

/** Seal ONE face's veil archive: the group creator's prekeys and key agreement state survive a boot, or material
 *  keyed to the card that veil presented stops opening and its creator seats nobody. */
export async function persistVeilArchive(bytes: Uint8Array, personaGroup: string): Promise<void> {
  mkdirSync(larIdentityDir(), { recursive: true, mode: 0o700 });
  await writeCustodyRow("identity", veilArchiveFile(personaGroup), bytes);
}

/** ONE face's veil archive, or null when none stands. */
export function loadVeilArchive(personaGroup: string): Promise<Uint8Array | null> {
  return readCustodyRow("identity", veilArchiveFile(personaGroup));
}

/** The node AnchorStore: the shore the PersonaVault carries. `save` writes the face's own anchors row;
 *  `list` names the unlocked faces that hold one. Every call reads or writes through the custody seat. */
export const nodeAnchorStore: AnchorStore = {
  load: (handleIndex) => loadIdentityAnchors(handleIndex),
  save: (handleIndex, anchors) => persistIdentityAnchors(anchors, handleIndex),
  list: () => listAnchoredPersonas(),
};
