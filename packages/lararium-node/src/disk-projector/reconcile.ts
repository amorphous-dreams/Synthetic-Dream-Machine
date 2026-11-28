/**
 * THE PER-ROOT RECONCILE: one carrier root read against the settled VM state, routed to the flush of each mirror that owns
 * it, to the unlink of each mirror it left, and to the orphan pass. The residency bar (`neverOnDisk`) and the pack-member
 * suppress decide what never reaches disk.
 * Heleuma ha: see lararium/mesh/disk-projector-reconcile.
 */

import { hasEffectRecordKind } from "@lararium/mesh/effect-record";
import { ORIGINAL_TIDDLER_PATHS, parseProvenance, packOfMember } from "@lararium/mesh/pack-provenance";
import { projectionWithheld } from "@lararium/mesh/projection-filter";
import type { ProjectionClass } from "@lararium/mesh/projection-filter";
import type { BagMirrorConfig } from "../bag-paths.js";
import type { ProjectorCore } from "./core.js";
import { _scheduleUnlinkByTitle } from "./dropped.js";
import { reconcileOrphans } from "./orphans.js";
import { _leavePendingExcept } from "./pending.js";
import { _resolveStandoff, _leaveStandoffsExcept } from "./standoffs.js";

/** Reconcile one carrier root through the queue where it runs, and wait for the queue to drain. */
export async function reconcileNow(core: ProjectorCore, rootUri: string): Promise<void> {
  if (core.gate === null) { await core.reconcile(rootUri); return; }
  core.gate.mark(rootUri);
  await core.gate.idle();
}

/**
 * Level-triggered reconcile of ONE carrier root against the settled VM state
 * (the projector's authoritative view, per VM-Primacy). Live (a `$origin-bag`
 * naming a mirror) → flush that owner (render + write + cross-mirror cleanup).
 * Gone from the resolved view → unlink from every mirror whose bag does not
 * hold it (a true delete; a bag still holding the carrier keeps its file). A
 * MOVE shows its new owner here because this read observes settled VM state.
 * Idempotent: a later nudge re-reconciles, so a transient "gone" self-heals
 * when the destination lands — the unlink can never be the final word for a
 * carrier a bag still holds.
 */
export async function reconcile(core: ProjectorCore, rootUri: string): Promise<void> {
  const reading = ++core.readings;
  await reconcileCarrier(core, rootUri);
  await reconcileOrphans(core, rootUri);
  // A STANDOFF AN EARLIER READING LEFT, AND THIS ONE FOUND NOWHERE, ENDED: it resolves now, once.
  for (const [key, left] of [...core.leaving]) {
    if (left.uri !== rootUri || left.at >= reading || core.standoffs.has(key)) continue;
    core.leaving.delete(key);
    _resolveStandoff(core, left.bagId, left.uri, left.entry);
  }
  // A STANDOFF THIS READING STEPPED ASIDE, AND NOTHING LATER IN IT RE-SEATED, ASKS ONE MORE READING: the mark rides the tail, so a
  // pass that re-seats the same key in the same reading (the view after a recovery unlink, the view after the recovery flush) sends no
  // mark it cannot withdraw, and the gate comes to rest.
  if (core.gate !== null && !core.stopping && [...core.leaving.values()].some((l) => l.uri === rootUri && l.at === reading)) core.gate.mark(rootUri);
}

export async function reconcileCarrier(core: ProjectorCore, rootUri: string): Promise<void> {
  // Pack-member projection-suppress — the loop-stopper. A member whose title
  // rides in a pack's aside provenance lives inside its pack file (`foo.json`)
  // and MUST NOT self-project: a per-member file explodes the pack into N files,
  // leaves `foo.json` stale, and the watcher then re-ingests both copies (once
  // from `foo.json`, once from the exploded files) — an unbounded doubling loop.
  // WITH the suppress: the pack file stays the one file on disk; a member edit
  // marks it stale-on-disk, and only a deliberate REPACK re-renders it. The guard
  // rides FIRST so it also holds the gone-branch (a vanished member never owns a
  // file to unlink — its home is the pack).
  // THE RECOVERY PASS OWNS ITS OWN STANDOFFS: a recovery mirror that flushed its bag's record here weighed the file against
  // that record, so the resolved view's pass below spares it. Left to that pass, a carrier the view projects nowhere (a draft
  // whose bag only a recovery mirror holds) would step aside every standoff the recovery flush just entered, mark the carrier
  // for another reading, and the next reading would re-seat and step it aside again: a reconcile loop the gate never rests from.
  const recovered = new Set<string>();
  for (const mirror of core.mirrors) {
    if (mirror.mirrorClass !== "recovery") continue;
    // A recovery-class mirror reads its bag's own store, ahead of the view's volatile bar below: the namespace bar
    // (`neverOnDisk`) answers here first, so neither the volatile VM plane nor a temp layer's internal state reaches
    // the flush or the unlink.
    if (await neverOnDisk(core, mirror, rootUri)) continue;
    const store = core.recoveryStore?.(mirror.bagId);
    if (store) {
      const record = await store.get(rootUri);
      if (record && !record.meta?.deleted) {
        await core.flush(mirror.bagId, rootUri, record.tiddler);
        recovered.add(mirror.bagId);
      } else {
        await _scheduleUnlinkByTitle(core, rootUri, mirror.bagId);
      }
    } else if (!core.recoveryStore && (await core.bagsHolding?.(rootUri))?.includes(mirror.bagId)) {
      await core.flush(mirror.bagId, rootUri);
      recovered.add(mirror.bagId);
    }
  }
  if (isPackMember(core, rootUri)) return;
  const tiddler = core._tw5?.$tw.wiki.getTiddler?.(rootUri);
  const fields = tiddler?.fields as Record<string, string | string[] | undefined> | undefined;
  // The host's provenance stamp (nalu-engine) names the mirror; `bag` is the author's field.
  const origin = typeof fields?.["$origin-bag"] === "string" ? fields["$origin-bag"] as string : undefined;
  const winner = fields !== undefined && origin !== undefined
    && core.mirrors.some((m) => m.bagId === origin && m.mirrorClass !== "recovery") ? origin : undefined;
  // THE SHADOWED OWN RECORDS: each ordinary mirror whose bag holds a live record of this root the view does not show
  // from that bag projects that record, rendered off its own fields.
  const shadowed = await shadowedOwnRecords(core, rootUri, winner);
  const keep = new Set<string>([...shadowed, ...recovered]);
  if (winner !== undefined) keep.add(winner);
  if (!tiddler) {
    // The resolved view holds no such carrier: nothing stands to write back, so no removal stays pending.
    _leavePendingExcept(core, rootUri, keep);
    await _scheduleUnlinkByTitle(core, rootUri, undefined, keep);
  } else if (winner === undefined) {
    // A carrier that stopped projecting, or left for an unmirrored bag, leaves every standoff it stood in where it
    // does not project: the alert would name a conflict this projector does not weigh.
    _leaveStandoffsExcept(core, rootUri, keep);
    _leavePendingExcept(core, rootUri, keep);
  } else {
    _leaveStandoffsExcept(core, rootUri, keep);
    _leavePendingExcept(core, rootUri, keep);
    await core.flush(winner, rootUri);
  }
  for (const bagId of shadowed) await core.flush(bagId, rootUri, undefined, true);
}

/**
 * A tiddler that belongs to a PACK — its title rides in the pack's aside
 * provenance map (`$:/config/OriginalTiddlerPaths`, the same map INGEST wrote,
 * read here from the settled VM view). A pack member's bytes live INSIDE its
 * pack file (`foo.json`), so the member NEVER owns its own disk file. Reads
 * false when no $tw is mounted or the map is absent/malformed (degrades to "no
 * packs" — a forgotten observation never suppresses a legitimate projection).
 */
export function isPackMember(core: ProjectorCore, title: string): boolean {
  const provFields = core._tw5?.$tw.wiki.getTiddler?.(ORIGINAL_TIDDLER_PATHS)?.fields as
    | Record<string, unknown>
    | undefined;
  const provText = provFields?.["text"];
  if (typeof provText !== "string") return false;
  return packOfMember(parseProvenance(provText), title) !== undefined;
}

/** The ordinary mirrors that read their own bag's records: present only with a record renderer and a bag store. */
export function ownRecordMirrors(core: ProjectorCore): BagMirrorConfig[] {
  if (!core.recordFileFn || !core.recoveryStore) return [];
  return core.mirrors.filter((m) => m.mirrorClass !== "recovery" && core.recoveryStore!(m.bagId) !== null);
}

/**
 * The ordinary mirrored bags (other than the view's winner) holding a live, projecting record of `rootUri`. None where a
 * tombstone tops the composition (a deliberate deletion shadows by intent), and none for a pack member: a member
 * lives inside its pack file, read off the bag's own provenance aside, since the view may not hold it yet.
 */
export async function shadowedOwnRecords(core: ProjectorCore, rootUri: string, winner: string | undefined): Promise<string[]> {
  const mirrors = ownRecordMirrors(core);
  if (mirrors.length === 0) return [];
  if ((await core.topRecordFn?.(rootUri))?.meta?.deleted) return [];
  const out: string[] = [];
  for (const mirror of mirrors) {
    if (mirror.bagId === winner || out.includes(mirror.bagId)) continue;
    const store = core.recoveryStore!(mirror.bagId)!;
    const record = await store.get(rootUri);
    if (!record || record.meta?.deleted) continue;
    const provenance = await store.get(ORIGINAL_TIDDLER_PATHS);
    const provText = provenance && !provenance.meta?.deleted ? provenance.tiddler["text"] : undefined;
    if (typeof provText === "string" && packOfMember(parseProvenance(provText), rootUri) !== undefined) continue;
    out.push(mirror.bagId);
  }
  return out;
}

/**
 * Disk residency comes from this mirror's bag. The effect ledger shape stays audit metadata and never becomes a file;
 * the ProjectionFilter only provides operator-configurable TW5 temp/state and temp-layer preferences.
 */
export async function neverOnDisk(core: ProjectorCore, mirror: BagMirrorConfig, uri: string, fields?: Record<string, unknown>): Promise<boolean> {
  let recordFields = fields;
  if (recordFields === undefined) {
    const record = await core.recoveryStore?.(mirror.bagId)?.get(uri);
    if (record && !record.meta?.deleted) recordFields = record.tiddler as Record<string, unknown>;
    else recordFields = core._tw5?.$tw.wiki.getTiddler?.(uri)?.fields as Record<string, unknown> | undefined;
  }
  if (recordFields && hasEffectRecordKind(recordFields)) return true;
  const classes: ProjectionClass[] = [
    ...(mirror.tempLayer ? ["temp" as const] : []),
  ];
  const wiki = core._tw5?.$tw.wiki as { getTiddlerText?: (t: string) => string | undefined } | undefined;
  return projectionWithheld(uri, classes, wiki?.getTiddlerText ? (t: string) => wiki.getTiddlerText!(t) || undefined : undefined);
}
