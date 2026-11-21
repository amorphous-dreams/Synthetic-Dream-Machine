/**
 * identity-anchors — each face's sealed anchors and veil archive.
 * The face custody row names its PersonaGroup, and the face index lets a floor count
 * faces without opening their private rows. A face archive holds its own prekeys.
 */

import { mkdirSync, statSync } from "node:fs";
import { faceFilePathSync, readFaceIndexSync } from "./face-index.js";
import { larIdentityDir } from "./vessel-paths.js";
import { readIdentityAnchors, type AnchorStore, type IdentityAnchors } from "@lararium/mesh";
import { identityHomeClosure } from "./identity-home-closure.js";
import { CustodyRecordUnavailable } from "./custody-holder.js";
import { readCustodyRecord, unlockedFaceOrdinals, writeCustodyRecord } from "./custody-seat.js";
import { requireArchiveOf } from "@lararium/keyhive";
import { loadFaceAtomOfGroup } from "./face-atom-store.js";
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

type RecordReader = typeof readCustodyRecord;
const utf8 = new TextEncoder();
const text = (bytes: Uint8Array): string => new TextDecoder().decode(bytes);

/** A row that opened and does not hold its own shape: named, never read as absent. */
function malformed(file: string): CustodyRecordUnavailable {
  return new CustodyRecordUnavailable("identity", file, "malformed");
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

/**
 * Whether `personaGroup`'s anchors may land at `handleIndex`: refuses `anchors-face-mismatch` where the floor index binds that
 * face to another PersonaGroup. A founding and an admit ask this BEFORE their first row, so neither leaves a half-written act
 * (an archive written, its anchors refused). A face so bound never takes another group's anchors: the holder's unlock reads a
 * face's anchors against its index entry, and a mismatched face never opens again.
 */
export function requireAnchorsLand(personaGroup: string, handleIndex: number): void {
  const entry = readFaceIndexSync(larIdentityDir()).faces[handleIndex];
  if (entry !== undefined && "fcid" in entry && entry.group !== null && entry.group !== personaGroupDigest(personaGroup)) {
    throw new Error(`anchors-face-mismatch: face h${handleIndex} stands under another PersonaGroup than this act's own; nothing was written`);
  }
}

/** Write ONE persona's anchor set (founding and admit both land it here). `handleIndex` names the face the row rests in,
 *  always: EACH ANCHORS ROW NAMES ITS FACE. Where the floor index already binds that face to a PersonaGroup, the anchors must
 *  name the same group, or the write refuses `anchors-face-mismatch` and nothing writes (a join that lands at another face's
 *  handle never hands that face its anchors). */
export async function persistIdentityAnchors(anchors: IdentityAnchors, handleIndex: number): Promise<void> {
  requireAnchorsLand(anchors.personaGroupId, handleIndex);
  // THE HOME CARRIES THE MODE, not just the file. A recursive mkdir takes the process umask for the directory,
  // ordinarily 0755, and the floor key rests here outside the seal. Created owner-only, then READ BACK and
  // reported: a home that already stood open keeps its mode, because a vessel widened on purpose has reasons and
  // a silent chmod would hide the misconfiguration an operator wants to see.
  mkdirSync(larIdentityDir(), { recursive: true, mode: 0o700 });
  warnIfIdentityHomeOpen();
  await writeCustodyRecord("identity", anchorsFile(handleIndex), utf8.encode(JSON.stringify(anchors, null, 2)));
}

/** Read ONE persona's anchor set back, or null when the index holds no persona. `handleIndex` selects which
 *  persona (0 = founding). */
export async function loadIdentityAnchors(handleIndex = 0, read: RecordReader = readCustodyRecord): Promise<IdentityAnchors | null> {
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
export async function listAnchoredPersonas(read: RecordReader = readCustodyRecord): Promise<number[]> {
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

/** Each standing face's ordinal beside its custody id, off the floor index. */
export function listFaceCustodyIds(): Array<{ readonly ordinal: number; readonly fcid: string }> {
  const out: Array<{ ordinal: number; fcid: string }> = [];
  readFaceIndexSync(larIdentityDir()).faces.forEach((f, ordinal) => { if ("fcid" in f) out.push({ ordinal, fcid: f.fcid }); });
  return out;
}

/** The veil archive family's filename law: one row per PersonaGroup. */
export const VEIL_ARCHIVE_FILE = /^veil-archive-g([0-9a-f]{64})\.bin$/;
/** One generation back: the row a face's last overwrite replaced, so a write can be reversed. Never more than one. */
export const VEIL_ARCHIVE_PREV_FILE = /^veil-archive-g([0-9a-f]{64})\.bin\.prev$/;

/** One face's veil archive filename. */
export function veilArchiveFile(personaGroup: string): string {
  return `veil-archive-g${personaGroupDigest(personaGroup)}.bin`;
}

/** One face's veil archive path. */
export function veilArchivePath(personaGroup: string): string {
  return faceFilePathSync(larIdentityDir(), { group: personaGroupDigest(personaGroup) }, veilArchiveFile(personaGroup));
}

/** One face's previous veil archive filename: the generation its last overwrite replaced. */
export function veilArchivePrevFile(personaGroup: string): string {
  return `${veilArchiveFile(personaGroup)}.prev`;
}

/** A face holds no atom, so nothing can prove an Archive is its own: the seal refuses rather than write unproven bytes. */
export class VeilArchiveUnproven extends Error {
  override readonly name = "VeilArchiveUnproven";
  constructor(readonly personaGroup: string) {
    super(`archive-unproven: face ${personaGroup.slice(0, 8)}… holds no atom, so no Archive proves itself its own and none rests`);
  }
}

const sameBytes = (a: Uint8Array, b: Uint8Array): boolean => a.length === b.length && a.every((byte, i) => byte === b[i]);

/**
 * Seal ONE face's veil archive: the group creator's prekeys and key agreement state survive a boot, or material
 * keyed to the card that veil presented stops opening and its creator seats nobody.
 *
 * THE SEAL PROVES THE BYTES ARE THE FACE'S OWN. Before anything moves, the face's atom seed stands a throwaway provider
 * over the bytes (`requireArchiveOf`): an Archive that restores another identity refuses `ArchiveIdentityMismatch`, one
 * that does not decode refuses its own fault, and a face holding no atom refuses `VeilArchiveUnproven`. On any refusal
 * the row stands unchanged. This one guard stands under every route that reaches the row, named or not.
 *
 * ONE GENERATION BACK. An overwrite first seals the standing row's bytes as `….bin.prev` (replacing any older one), then
 * the new bytes over the row, each a whole sealed write: a stop between the two leaves the standing row whole beside its
 * copy. Only a standing row the face's own seed proves rotates: a wrong current (another identity's, or bytes that decode as
 * none) never displaces the `.prev` it would overwrite, and a row that stands and does not open is never copied.
 *
 * ONE WRITE OF A FACE AT A TIME. A face's writes serialize in this process (the one writer of its rows), so two saves never
 * both read one standing row and rotate it twice: the later rotates the earlier.
 */
export function persistVeilArchive(bytes: Uint8Array, personaGroup: string): Promise<void> {
  const prior = veilWrites.get(personaGroup) ?? Promise.resolve();
  const run = prior.catch(() => undefined).then(() => sealVeilArchive(bytes, personaGroup));
  veilWrites.set(personaGroup, run);
  void run.finally(() => { if (veilWrites.get(personaGroup) === run) veilWrites.delete(personaGroup); }).catch(() => undefined);
  return run;
}

/** Each face's write in flight, by PersonaGroup: the next write of that face waits on it. */
const veilWrites = new Map<string, Promise<void>>();

/** Whether `bytes` restore the identity `seed` derives; an Archive of another identity, or bytes that decode as none, read false. */
async function provenBy(seed: Uint8Array, bytes: Uint8Array): Promise<boolean> {
  try { await requireArchiveOf(seed, bytes); return true; } catch { return false; }
}

async function sealVeilArchive(bytes: Uint8Array, personaGroup: string): Promise<void> {
  const seed = await loadFaceAtomOfGroup(personaGroup);
  if (!seed) throw new VeilArchiveUnproven(personaGroup);
  try {
    await requireArchiveOf(seed, bytes);
    mkdirSync(larIdentityDir(), { recursive: true, mode: 0o700 });
    const file = veilArchiveFile(personaGroup);
    const standing = await readCustodyRecord("identity", file).catch((error: unknown) => {
      if (error instanceof CustodyRecordUnavailable) return null;
      throw error;
    });
    if (standing && !sameBytes(standing, bytes) && await provenBy(seed, standing)) {
      await writeCustodyRecord("identity", veilArchivePrevFile(personaGroup), standing);
    }
    await writeCustodyRecord("identity", file, bytes);
  } finally {
    seed.fill(0);
  }
}

/** ONE face's previous veil archive (the generation its last overwrite replaced), or null when none stands. */
export function loadVeilArchivePrev(personaGroup: string): Promise<Uint8Array | null> {
  return readCustodyRecord("identity", veilArchivePrevFile(personaGroup));
}

/** ONE face's veil archive, or null when none stands. */
export function loadVeilArchive(personaGroup: string): Promise<Uint8Array | null> {
  return readCustodyRecord("identity", veilArchiveFile(personaGroup));
}

/** The node AnchorStore: the shore the PersonaVault carries. `save` writes the face's own anchors row;
 *  `list` names the unlocked faces that hold one. Every call reads or writes through the custody seat. */
export const nodeAnchorStore: AnchorStore = {
  load: (handleIndex) => loadIdentityAnchors(handleIndex),
  save: (handleIndex, anchors) => persistIdentityAnchors(anchors, handleIndex),
  list: () => listAnchoredPersonas(),
};
