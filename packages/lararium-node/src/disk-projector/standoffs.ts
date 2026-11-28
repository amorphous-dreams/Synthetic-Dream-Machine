/**
 * THE STANDOFF MACHINE: entering a standoff once per key, leaving it by act or by reading, resolving it once, and the
 * person's door (`takeRecords`) and the render a merge reads (`standoffRender`). One standoff names one carrier in one
 * bag at one pair of states.
 * Heleuma ha: see lararium/mesh/disk-projector-standoffs.
 */

import type { ProjectorCore } from "./core.js";
import { sitedKey, keepSpares } from "./entries.js";
import type { StandoffSides, StandoffEntry, StandingStandoff } from "./entries.js";
import { reconcileNow } from "./reconcile.js";

/**
 * Every standoff this projector stands in right now: the bag, the carrier, the key a person answers by,
 * and the states that key folds. A `sides` standoff names the file it weighed (`path`), the hash of the
 * bytes that stand there (`disk`) and the hash of the records' render (`records`), so a door that takes
 * the disk's words can prove it lands the very file, over the very records, the person read. A `home`
 * standoff names a file at a path the carrier left, and carries its reason alone.
 */
export function standing(core: ProjectorCore): StandingStandoff[] {
  return [...core.standoffs].map(([key, entry]) => {
    const cut = key.indexOf("\n");
    return { bagId: key.slice(0, cut), uri: key.slice(cut + 1), ...entry };
  });
}

/**
 * A PERSON TAKES THE RECORDS' SIDE of one standoff, named by its key. The answer admits one reconcile:
 * where the carrier still stands in the standoff the key names, the records' render writes over the
 * file and the base pins there. Where the states moved since the person read the key, the answer
 * takes nothing, and the standoff that stands keeps its own key.
 */
export async function takeRecords(core: ProjectorCore, bagId: string, uri: string, standoff: string): Promise<{ readonly took: boolean; readonly why?: string }> {
  const key = sitedKey(bagId, uri);
  const stands = core.standoffs.get(key)?.standoff;
  if (stands === undefined) return { took: false, why: `no standoff stands for ${uri} in ${bagId}` };
  if (stands !== standoff) return { took: false, why: `the standoff for ${uri} stands under key ${stands}; the answer names ${standoff}` };
  core.answered.set(key, standoff);
  try {
    await reconcileNow(core, uri);
  } finally {
    core.answered.delete(key);
  }
  const after = core.standoffs.get(key)?.standoff;
  return after === undefined ? { took: true } : { took: false, why: `the states moved while the answer travelled; the standoff stands under key ${after}` };
}

/**
 * THE RECORDS' SIDE OF ONE STANDOFF, AS IT WAS WEIGHED: the render the projector would have written when it raised
 * the standoff under `standoff`, with its hash. Null where no standoff stands under that key, or the carrier holds
 * a sidecar, a pointer or a binary body (no text a line merge can read). A key folds the records' hash, so the
 * render answers only the state the person read.
 */
export function standoffRender(core: ProjectorCore, bagId: string, uri: string, standoff: string): { readonly text: string; readonly records: string } | null {
  const key = sitedKey(bagId, uri);
  const entry = core.standoffs.get(key);
  const render = core.standoffRenders.get(key);
  if (entry === undefined || entry.standoff !== standoff || render === undefined || render.standoff !== standoff || entry.records === undefined) return null;
  return { text: render.text, records: entry.records };
}

/**
 * Leave the standoff this carrier stands in. An ACT that settled it (a write, an unlink, a new standoff under another
 * key) resolves it at once. A READING (`reading`: the gate found the two sides agreed, or the carrier projecting
 * elsewhere) proves less: the standoff steps aside, the carrier marks for one more reading, and that reading resolves it
 * where it finds no standoff again (`reconcile`), or re-seats it where it finds the same one (`_enterStandoff`).
 */
export function _leaveStandoff(core: ProjectorCore, bagId: string, uri: string, kind?: "sides" | "home", reading = false): void {
  const key = sitedKey(bagId, uri);
  const entry = core.standoffs.get(key);
  if (entry !== undefined) {
    if (kind !== undefined && entry.kind !== kind) return;
    core.standoffs.delete(key);
    if (reading) {
      core.leaving.set(key, { bagId, uri, entry, at: core.readings });
      if (core.gate !== null && !core.stopping) core.gate.mark(uri);
      return;
    }
    _resolveStandoff(core, bagId, uri, entry);
    return;
  }
  const left = core.leaving.get(key);
  if (left === undefined || reading || (kind !== undefined && left.entry.kind !== kind)) return;
  core.leaving.delete(key);
  _resolveStandoff(core, bagId, uri, left.entry);
}

/** A standoff ended: its render leaves and its alert clears, once. */
export function _resolveStandoff(core: ProjectorCore, bagId: string, uri: string, entry: StandoffEntry): void {
  const key = sitedKey(bagId, uri);
  if (core.standoffRenders.get(key)?.standoff === entry.standoff) core.standoffRenders.delete(key);
  core.onConflictResolved?.({ bagId, uri, standoff: entry.standoff });
}

/**
 * Enter a standoff, once per key: a reconcile that meets the standoff it already raised stays quiet, and so does one
 * that meets, under the same key, a standoff a reading had stepped aside from or one that surfaced before. A standoff
 * whose states moved ends (its alert clears) and the new one enters under its own key, and speaks.
 */
export function _enterStandoff(core: ProjectorCore, bagId: string, uri: string, standoff: string, kind: "sides" | "home", reason: string, sides?: StandoffSides): void {
  const key = sitedKey(bagId, uri);
  if (core.standoffs.get(key)?.standoff === standoff) return;
  const entry: StandoffEntry = { standoff, kind, reason, ...(sides ?? {}) };
  if (core.leaving.get(key)?.entry.standoff === standoff) {
    core.leaving.delete(key);
    core.standoffs.set(key, entry);
    return;
  }
  _leaveStandoff(core, bagId, uri);
  core.standoffs.set(key, entry);
  if (core.surfaced.get(key) === standoff) return;
  core.surfaced.set(key, standoff);
  console.error(`[confluence] projection conflict (${bagId} <- ${uri}): ${reason}`);
  core.onConflict?.({ bagId, uri, reason, standoff });
}

/**
 * Leave the SIDES standoff this carrier stands in under every mirror but `keepBag` (none kept when
 * absent): a carrier that stopped projecting there leaves a conflict nobody weighs. A HOME standoff
 * names a file that still stands on disk, so it leaves only when that file settles. A reading decides it.
 */
export function _leaveStandoffsExcept(core: ProjectorCore, uri: string, keep?: string | ReadonlySet<string>): void {
  if (core.standoffs.size === 0) return;
  for (const mirror of core.mirrors) if (!keepSpares(keep, mirror.bagId)) _leaveStandoff(core, mirror.bagId, uri, "sides", true);
}
