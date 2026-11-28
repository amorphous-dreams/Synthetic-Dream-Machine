/**
 * THE CONFLUENCE, PROJECTING LEG: the three-way gate every flush meets once the byte-identity skip has not answered. It weighs
 * the records' render, the merge base, and what stands on disk (`projection-gate.decideProjection`), and acts on the answer:
 * pend a vanished file, pin a congruent agreement, or stand off loudly under the standoff's key. It writes no carrier
 * bytes; the flush that called it writes them where it answers true.
 * Heleuma ha: see lararium/mesh/disk-projector-confluence.
 */

import { existsSync, readFileSync } from "fs";
import { digestsEqual } from "@lararium/mesh/agile-digest";
import { carrierHash, sha256HexBytesSync } from "@lararium/mesh/crypto";
import { MEME_EXT } from "@lararium/mesh/mirror-paths";
import type { CarrierFile } from "@lararium/tw5";
import type { BagMirrorConfig } from "../bag-paths.js";
import { decideProjection } from "../projection-gate.js";
import { syncedTreeKey } from "../synced-tree.js";
import type { SyncedBase } from "../synced-tree.js";
import type { ProjectorCore } from "./core.js";
import { sitedKey } from "./entries.js";
import { otherDocument, pastRecords, ownBaseAt, headBaseAt, pin } from "./bases.js";
import { sweepLeftMirrors } from "./flush.js";
import { _enterPending, _leavePending } from "./pending.js";
import { _leaveStandoff, _enterStandoff } from "./standoffs.js";
import { diskCarrierText } from "./write.js";

/** One carrier at its sited path in one bag's mirror, as the flush hands it to the gate. */
export interface LegCarrier {
  readonly mirror: BagMirrorConfig;
  readonly bagId: string;
  readonly tiddlerUri: string;
  readonly file: CarrierFile;
  readonly candidate: string;
  readonly metaPath: string | null;
  readonly isBinary: boolean;
  readonly bodyPending: boolean;
  /** The records' side the gate weighs: the whole carrier, or the sidecar alone under a pending pointer. */
  readonly gateRecords: string;
  /** The whole carrier's hash, for the sweep of mirrors the carrier left. */
  readonly obsHash: string;
  /** The records' render as text a line merge reads (`standoffRender`), where the carrier holds one. */
  readonly renderText: string | undefined;
}

/**
 * Weigh one carrier through the gate. Answers true where the write goes ahead; false where the gate settled the carrier
 * itself: a pending removal entered, a congruent agreement pinned (or already standing), or a standoff surfaced.
 */
export async function projectingLeg(core: ProjectorCore, leg: LegCarrier): Promise<boolean> {
  const { mirror, bagId, tiddlerUri, file, candidate, metaPath, isBinary, bodyPending, gateRecords, obsHash, renderText } = leg;
  const onDisk  = bodyPending ? null : diskCarrierText(candidate, metaPath, isBinary);
  // A SIDECAR STANDING WITH NO BODY BESIDE IT. It names a disk state of its own (the empty body and the
  // sidecar's bytes) in two places: under a pending pointer, and where the base itself names such a
  // state, or none stands. Where the base names a carrier that held a body, the body vanished.
  const loneHash = (() => {
    if (onDisk !== null || metaPath === null) return null;
    try { return existsSync(metaPath) ? carrierHash("", readFileSync(metaPath, "utf-8")) : null; } catch { return null; }
  })();
  // WHAT THE DISK SAYS, folded exactly as `obsHash` folds the render — so the gate's
  // `≈` compares like with like. TWO congruences, ONE clause: a `.mem` carrier reads
  // through the MEMETIC family's view (`canonicalizeFn`); every other TEXT filetype
  // reads through the NATIVE view (`canonicalizeNativeFn`, mirroring the ingest leg's
  // `nativeRender`) — a binary (base64) carrier asks neither, since a byte-for-byte
  // round trip carries no reformatting to normalize (only the identity the echo gate
  // above already answers). Absent from either door hands the gate null, which reads
  // as the standoff, never as equivalence.
  const diskCanonicalHash = (() => {
    if (onDisk === null || onDisk.sidecarGone) return null;
    if (file.ext === MEME_EXT) {
      const canonicalText = core.canonicalizeFn ? core.canonicalizeFn(tiddlerUri, onDisk.body) : null;
      return canonicalText === null ? null : carrierHash(canonicalText, onDisk.meta);
    }
    if (!isBinary && core.canonicalizeNativeFn) {
      const canonical = core.canonicalizeNativeFn(tiddlerUri, file.ext, onDisk.body, onDisk.meta);
      return canonical === null ? null : carrierHash(canonical.body, canonical.metaBody);
    }
    return null;
  })();
  const key = sitedKey(mirror.bagId, tiddlerUri);
  // A BASE STANDS AT ONE PATH: an agreement this carrier reached at another path names no base here.
  // A base that names ANOTHER DOCUMENT names no agreement of this one: the gate reads none.
  let another = otherDocument(core, bagId, core.syncedTree.baseAt(syncedTreeKey(bagId, tiddlerUri), candidate));
  // NO SYNCED BASE AND NO OTHER DOCUMENT'S: the pool's HEAD stands in where it holds the file (a re-found cleared the
  // tree). These records stand, so HEAD vouches for an agreement with a record the house holds.
  // A HEAD base rests in no tree, so an agreement it names still pins.
  let headed = false;
  const baseOf = (): SyncedBase | null => {
    const own = ownBaseAt(core, bagId, tiddlerUri, candidate);
    const head = own === null && !another ? headBaseAt(core, tiddlerUri, candidate, file.ext, isBinary) : null;
    headed = head !== null;
    return own ?? head;
  };
  let base = baseOf();
  /** Weigh the carrier against the base as it stands: the disk's hash, the standoff those states fold to, and the gate's answer. */
  const weigh = (): { diskHash: string | null; standoff: string; decision: ReturnType<typeof decideProjection> } => {
    const diskHash = onDisk !== null ? carrierHash(onDisk.body, onDisk.meta)
      : loneHash !== null && (bodyPending || base === null || digestsEqual(base.disk, loneHash)) ? loneHash
      : null;
    // ONE STANDOFF, ONE KEY: the bag, the carrier, the path, the two states and the base they stand
    // against. A person's answer names this key, and the gate hears the answer only where everything
    // that stands now folds to the key the person named.
    const standoff = sha256HexBytesSync(new TextEncoder().encode(
      [mirror.bagId, tiddlerUri, candidate, diskHash ?? "", gateRecords, base?.disk ?? "", base?.records ?? ""].join("\n"))).slice(0, 24);
    const decision = decideProjection({
      diskHash,
      syncedHash:        base?.disk ?? null,
      syncedRecordsHash: base?.records ?? null,
      recordsHash:       gateRecords,
      diskCanonicalHash,
      // A HEAD base rests in no tree and names no heads; a synced base past the records vouches for no write.
      ...(!headed && pastRecords(core, bagId, base) ? { recordsBehindBase: true } : {}),
      ...(core.answered.get(key) === standoff ? { answer: "take-records" as const }
        : core.restoreAsked.has(key) ? { answer: "restore" as const } : {}),
    });
    return { diskHash, standoff, decision };
  };
  let weighed = weigh();
  // A SIBLING MAY HAVE MOVED THE BASE since this projector loaded the tree (another island, the ingest
  // gesture). Before the carrier's own files write, surface or pend, the tree reads afresh and the gate
  // decides again.
  if (weighed.decision.kind !== "noop") {
    core.syncedTree.reread(syncedTreeKey(bagId, tiddlerUri));
    another = otherDocument(core, bagId, core.syncedTree.baseAt(syncedTreeKey(bagId, tiddlerUri), candidate));
    base = baseOf();
    weighed = weigh();
  }
  const { diskHash, standoff, decision } = weighed;
  if (decision.kind === "pending-removal") {
    // THE FILE VANISHED WHERE A BASE STANDS. Nothing writes back and nothing tombstones; the base stays,
    // and the carrier stands pending until a person answers or the file returns.
    _leaveStandoff(core, bagId, tiddlerUri, undefined, true);
    _enterPending(core, bagId, tiddlerUri, candidate);
    return false;
  }
  _leavePending(core, bagId, tiddlerUri);
  if (decision.kind === "noop") {
    // THE DISK AND THE RECORDS SAY THE SAME THING IN TWO FRAMINGS: the carrier stands unchanged, so
    // no byte writes. The base pins at this agreement, the disk's bytes on one side and the records'
    // render on the other, so the ingest scan reads the file `unchanged` and each gate still tells a
    // later disk edit from a later record edit. A base that already names this agreement stays put.
    if (decision.reason === "canonical-equivalent" && diskHash !== null && !another
        && !(base !== null && !headed && base.disk === diskHash && base.records === gateRecords)) {
      pin(core, bagId, tiddlerUri, candidate, diskHash, gateRecords);
    }
    // A PENDING POINTER'S SIDECAR STANDS AS THE RECORDS RENDER IT, and no base stands here: that
    // agreement holds a sidecar alone, and its base says so. A base that already stands stays: where
    // it names a body, that body vanished, and the carrier pends once its bytes resolve.
    if (bodyPending && base === null && !another && diskHash !== null && decision.reason === "disk-matches-records") {
      pin(core, bagId, tiddlerUri, candidate, diskHash);
    }
    _leaveStandoff(core, bagId, tiddlerUri, undefined, true);
    if (mirror.mirrorClass !== "recovery") await sweepLeftMirrors(core, bagId, tiddlerUri, candidate, bodyPending ? null : obsHash);
    return false;
  }
  if (decision.kind === "conflict") {
    // SURFACE, never overwrite. The write stops here; the divergence goes out on the
    // ward-alert rail (a durable ledger record + an alert in the operator's pinned VM),
    // named for the mechanism that actually stood down — never as a disk-ward refusal.
    // THE ALERT NAMES BOTH DOORS: the one that lands the disk's words and the one that lands the
    // records', each under this standoff's own key, so a person who reads the alert alone can settle it.
    const doors = `Take the disk's words: \`lares shore take-disk ${tiddlerUri} --key ${standoff}\`. Take the records' words: \`lares shore take-records ${tiddlerUri} --key ${standoff}\`. Or save in the wiki until both say the same`;
    const reason = another
      ? `the file at ${candidate} mirrors another document's record of ${tiddlerUri} (another face's workbench serves this bag over the same mirror), and this document's records say something else; nothing writes, so that file stays whole. ${doors}`
      : decision.reason === "records-behind-base"
      ? `the records fell behind their last agreement with the file at ${candidate} (${decision.reason}): the document read back without the write that agreement saw (a save that never rested, or a document that failed to load), so its older render writes nothing over the file's newer words. Land the file's words whole: \`lares shore keep-disk ${tiddlerUri} --key ${standoff}\`. Take the records' older words: \`lares shore take-records ${tiddlerUri} --key ${standoff}\``
      : decision.reason === "no-base"
      ? `the file at ${candidate} and the records say different things, and no base names a last agreement (${decision.reason}); nothing writes. ${doors}`
      : `the file at ${candidate} and the records both moved past their last agreement (${decision.reason}); nothing writes, so neither edit drowns. ${doors}`;
    // ONE SURFACING PER STANDOFF: the key names the bag, the carrier and the two states. A reconcile
    // that meets the standoff it already raised stays quiet; the write still stands down.
    _enterStandoff(core, mirror.bagId, tiddlerUri, standoff, "sides", reason,
      { path: candidate, disk: diskHash, records: gateRecords, ...(base !== null ? { base: { disk: base.disk, records: base.records } } : {}),
        ...(decision.reason === "records-behind-base" && base?.heads !== undefined
          ? { behind: { ...(base.doc !== undefined ? { doc: base.doc } : {}), heads: base.heads, quiet: core.lineageOf?.(bagId)?.quiet === true } } : {}) });
    if (renderText !== undefined && !another) core.standoffRenders.set(key, { standoff, text: renderText });
    return false;
  }
  return true;
}
