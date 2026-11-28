/**
 * THE HASH BEFORE THE WRITE, AND THE CAPTURE IT HANDS OFF: every flush the byte-identity skip did not answer reads what
 * stands on disk against the base at that path (the bytes this projector last wrote there or last saw captured) through
 * the one gate (`projection-gate.decideProjection`). A file that stands as the base left it takes the write. A file a hand
 * moved goes to the capture door instead: its words enter the records (or stand as parallel drafts where the records
 * moved too), the base moves to those bytes, and the carrier marks for one more reading, which projects whatever the
 * records then say. Nothing holds a carrier between readings: the base carries what the projector knows of a file, and a
 * refusal remembers only the bytes it named, so it speaks once per state of the file.
 * Heleuma ha: see lararium/mesh/disk-projector-capture.
 */

import { existsSync, readFileSync } from "fs";
import { digestsEqual } from "@lararium/mesh/agile-digest";
import { carrierHash } from "@lararium/mesh/crypto";
import { MEME_EXT } from "@lararium/mesh/mirror-paths";
import type { CarrierFile } from "@lararium/tw5";
import type { BagMirrorConfig } from "../bag-paths.js";
import { decideProjection } from "../projection-gate.js";
import { syncedTreeKey } from "../synced-tree.js";
import type { SyncedBase } from "../synced-tree.js";
import type { ProjectorCore } from "./core.js";
import { sitedKey } from "./entries.js";
import type { MovedFile } from "./entries.js";
import { otherDocument, pastRecords, ownBaseAt, headBaseAt, pin } from "./bases.js";
import { sweepLeftMirrors } from "./flush.js";
import { _enterPending, _leavePending } from "./pending.js";
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
}

/**
 * HAND ONE MOVED FILE TO THE CAPTURE DOOR, and answer whether the house now holds its words. Captured (landed in the
 * records, or standing as parallel drafts), the base moves to the file's bytes and the carrier marks for one more reading:
 * that reading finds the file where the base names it and writes the records' render, or unlinks a home the carrier left.
 * Refused, or with no door standing, nothing writes over the file and nothing unlinks it; the refusal rides the ward rail.
 */
export async function captureMoved(core: ProjectorCore, moved: MovedFile): Promise<boolean> {
  const { bagId, uri, path } = moved;
  const outcome = core.capture === undefined
    ? { kind: "refused" as const, why: "this projector stands no capture door" }
    : await core.capture(moved).catch((err: unknown) => ({ kind: "refused" as const, why: err instanceof Error ? err.message : String(err) }));
  const key = `${bagId}\n${uri}\n${path}`;
  if (outcome.kind === "refused") {
    // ONCE PER STATE OF THE FILE: the same bytes refuse silently at every later reading, and a new edit speaks again.
    if (core.refusedAt.get(key) === moved.disk) return false;
    core.refusedAt.set(key, moved.disk);
    const reason = `the file at ${path} moved since the projector last wrote it, and its words did not enter the records (${outcome.why}); nothing writes over it`;
    console.error(`[capture] ${bagId} <- ${uri}: ${reason}`);
    core.onRefusal?.({ bagId, uri, reason });
    return false;
  }
  core.refusedAt.delete(key);
  pin(core, bagId, uri, path, moved.disk, moved.records ?? moved.disk);
  if (core.gate !== null && !core.stopping) core.gate.mark(uri);
  return true;
}

/**
 * Weigh one carrier through the gate. Answers true where the write goes ahead; false where the gate settled the carrier
 * itself: a pending removal entered, a congruent agreement pinned (or already standing), or a moved file handed to capture.
 */
export async function projectingLeg(core: ProjectorCore, leg: LegCarrier): Promise<boolean> {
  const { bagId, tiddlerUri, file, candidate, metaPath, isBinary, bodyPending, gateRecords, obsHash } = leg;
  const onDisk  = bodyPending ? null : diskCarrierText(candidate, metaPath, isBinary);
  // A SIDECAR STANDING WITH NO BODY BESIDE IT names a disk state of its own (the empty body and the sidecar's bytes)
  // under a pending pointer, and where the base itself names such a state, or none stands.
  const loneHash = (() => {
    if (onDisk !== null || metaPath === null) return null;
    try { return existsSync(metaPath) ? carrierHash("", readFileSync(metaPath, "utf-8")) : null; } catch { return null; }
  })();
  // WHAT THE DISK SAYS, folded exactly as `obsHash` folds the render: a `.mem` carrier reads through the memetic view
  // (`canonicalizeFn`), every other text filetype through the native view (`canonicalizeNativeFn`). A binary carrier asks
  // neither. Absent from either door hands the gate null, which never reads as equivalence.
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
  // A base that names ANOTHER DOCUMENT names no agreement of this one, and its file mirrors that document's records.
  let another = otherDocument(core, bagId, core.syncedTree.baseAt(syncedTreeKey(bagId, tiddlerUri), candidate));
  // NO SYNCED BASE AND NO OTHER DOCUMENT'S: the pool's HEAD stands in where it holds the file (a re-found cleared the tree).
  let headed = false;
  const baseOf = (): SyncedBase | null => {
    const own = ownBaseAt(core, bagId, tiddlerUri, candidate);
    const head = own === null && !another ? headBaseAt(core, tiddlerUri, candidate, file.ext, isBinary) : null;
    headed = head !== null;
    return own ?? head;
  };
  let base = baseOf();
  const weigh = (): { diskHash: string | null; behind: boolean; decision: ReturnType<typeof decideProjection> } => {
    const diskHash = onDisk !== null ? carrierHash(onDisk.body, onDisk.meta)
      : loneHash !== null && (bodyPending || base === null || digestsEqual(base.disk, loneHash)) ? loneHash
      : null;
    // A HEAD base rests in no tree and names no heads; a synced base past the records vouches for no write.
    const behind = !headed && pastRecords(core, bagId, base);
    const decision = decideProjection({
      diskHash,
      syncedHash:        base?.disk ?? null,
      syncedRecordsHash: base?.records ?? null,
      recordsHash:       gateRecords,
      diskCanonicalHash,
      ...(behind ? { recordsBehindBase: true } : {}),
      ...(core.restoreAsked.has(sitedKey(bagId, tiddlerUri)) ? { answer: "restore" as const } : {}),
    });
    return { diskHash, behind, decision };
  };
  let weighed = weigh();
  // A SIBLING MAY HAVE MOVED THE BASE since this projector loaded the tree (another island, the ingest gesture): before
  // the carrier writes, pends or goes to capture, the tree reads afresh and the gate decides again.
  if (weighed.decision.kind !== "noop") {
    core.syncedTree.reread(syncedTreeKey(bagId, tiddlerUri));
    another = otherDocument(core, bagId, core.syncedTree.baseAt(syncedTreeKey(bagId, tiddlerUri), candidate));
    base = baseOf();
    weighed = weigh();
  }
  const { diskHash, behind, decision } = weighed;
  if (decision.kind === "pending-removal") {
    // THE FILE VANISHED WHERE A BASE STANDS: nothing writes back and nothing tombstones until a person answers.
    _enterPending(core, bagId, tiddlerUri, candidate);
    return false;
  }
  _leavePending(core, bagId, tiddlerUri);
  if (decision.kind === "noop") {
    // THE DISK AND THE RECORDS SAY THE SAME THING IN TWO FRAMINGS: no byte writes, and the base pins at this agreement
    // (the disk's bytes on one side, the records' render on the other), so a later edit on either side reads as moved.
    if (decision.reason === "canonical-equivalent" && diskHash !== null && !another
        && !(base !== null && !headed && base.disk === diskHash && base.records === gateRecords)) {
      pin(core, bagId, tiddlerUri, candidate, diskHash, gateRecords);
    }
    // A PENDING POINTER'S SIDECAR STANDS AS THE RECORDS RENDER IT, and no base stands here: that agreement holds a sidecar alone.
    if (bodyPending && base === null && !another && diskHash !== null && decision.reason === "disk-matches-records") {
      pin(core, bagId, tiddlerUri, candidate, diskHash);
    }
    await sweepLeftMirrors(core, bagId, tiddlerUri, candidate, bodyPending ? null : obsHash);
    return false;
  }
  if (decision.kind === "capture") {
    // ANOTHER DOCUMENT'S FILE stays whole: it mirrors that document's records, and this document writes nothing over it.
    if (another || diskHash === null) return false;
    await captureMoved(core, {
      bagId, uri: tiddlerUri, path: candidate, disk: diskHash, records: gateRecords,
      base: base !== null ? { disk: base.disk, records: base.records } : null,
      ...(behind ? { behind: true as const } : {}),
    });
    return false;
  }
  return true;
}
