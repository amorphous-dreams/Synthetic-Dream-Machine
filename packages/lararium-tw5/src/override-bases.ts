/**
 * override-bases — the instrument that tells a person canon moved under a working copy that shadows it.
 *
 * A wiki composes its working layer (`wikis/<slug>/working`) over its canon bag (`bags/<slug>`), and the recipe stack
 * alone decides what shows: a top layer always shadows the layers under it. A working record of a title canon holds
 * shadows canon's record, and names the hash of the canon text it forked from (`overrideBase`, `@lararium/mesh`
 * `override-base.ts`).
 *
 * When canon moves past that base, nothing writes: the working copy keeps shadowing canon, its bytes untouched. The
 * instrument reads the move and WARNS per title, "canon is fresher than the working copy above it", so a person who
 * wants the fresher canon removes the copy with the ordinary verbs. A working-only title never takes part, and nothing
 * here promotes, retracts or writes any layer.
 *
 * ONE OWNER PER GATE. INGEST's three-way gate (disk, synced base, canon render) decides what canon takes; this module
 * never weighs a disk byte. It reads canon under each working copy before and after the gate ran.
 */

import { isEffectRecordUri, overrideBaseOf, overrideTextHash, type LarTiddlerRecord, type LarTiddlerStore } from "@lararium/mesh";

/** One working copy that shadows a canon text fresher than the one it forked from. */
export interface FresherCanon {
  readonly bag: string;
  readonly working: string;
  readonly title: string;
  /** The canon text hash the working copy forked from, or null where it names none (forked before bases were kept). */
  readonly base: string | null;
  /** The canon text hash that stands now, or null where canon holds no live record of the title. */
  readonly canonHash: string | null;
}

const live = (r: LarTiddlerRecord | null | undefined): r is LarTiddlerRecord => r !== null && r !== undefined && r.meta?.deleted !== true;
const textHashOf = (r: LarTiddlerRecord | null | undefined): string | null => (live(r) ? overrideTextHash(r.tiddler) : null);

/** Whether canon stands fresher than one working copy's base: null where the copy names no base or canon still says it. */
export function fresherThanBase(bag: string, working: string, title: string, copy: LarTiddlerRecord, canon: LarTiddlerRecord | null): FresherCanon | null {
  const base = overrideBaseOf(copy);
  if (base === null) return null;
  const canonHash = textHashOf(canon);
  return canonHash === base ? null : { bag, working, title, base, canonHash };
}

/** The live non-ledger titles a working layer holds, with their records. */
async function copiesIn(working: LarTiddlerStore): Promise<Map<string, LarTiddlerRecord>> {
  const out = new Map<string, LarTiddlerRecord>();
  for (const title of await working.listVisible()) {
    if (isEffectRecordUri(title)) continue;
    const record = await working.get(title);
    if (live(record)) out.set(title, record);
  }
  return out;
}

/** Read what canon holds under each title the working layer shadows, BEFORE a canon change. */
export async function snapshotUnderOverrides(working: LarTiddlerStore, canon: LarTiddlerStore): Promise<Map<string, LarTiddlerRecord | null>> {
  const prior = new Map<string, LarTiddlerRecord | null>();
  for (const title of (await copiesIn(working)).keys()) prior.set(title, await canon.get(title));
  return prior;
}

/**
 * AFTER A CANON CHANGE: each working copy whose canon text this change moved, read against its base (or, where it names
 * none, against the canon text the snapshot read). Reads alone; every copy stands as it stood.
 */
export async function fresherAfterChange(
  bag: string, workingBag: string, working: LarTiddlerStore, canon: LarTiddlerStore, prior: ReadonlyMap<string, LarTiddlerRecord | null>,
): Promise<FresherCanon[]> {
  const out: FresherCanon[] = [];
  for (const [title, before] of prior) {
    const now = await canon.get(title);
    const nowHash = textHashOf(now);
    if (textHashOf(before) === nowHash) continue;               // canon did not move under this title
    const copy = await working.get(title);
    if (!live(copy)) continue;
    const base = overrideBaseOf(copy);
    if (base === nowHash) continue;                              // canon moved back to the copy's own base
    out.push({ bag, working: workingBag, title, base, canonHash: nowHash });
  }
  return out;
}

/** Every working copy in one layer that shadows a canon text fresher than its base, ordered by title. */
export async function listFresherCanon(bag: string, workingBag: string, working: LarTiddlerStore, canon: LarTiddlerStore): Promise<FresherCanon[]> {
  const out: FresherCanon[] = [];
  for (const [title, copy] of await copiesIn(working)) {
    const fresher = fresherThanBase(bag, workingBag, title, copy, await canon.get(title));
    if (fresher !== null) out.push(fresher);
  }
  return out.sort((a, b) => (a.title < b.title ? -1 : a.title > b.title ? 1 : 0));
}
