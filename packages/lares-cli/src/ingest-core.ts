/**
 * ingest-core — the disk→records gesture as the CLI runs it: the one-shot `lares ingest`, the watcher, the lay. The pure
 * machinery (the scan, the candidates, the deletions, the standing helpers, the settle, the siting call) stands in
 * `@lararium/node` (`ingest-scan`), so the vessel's own watch over a face's pool runs the SAME path; this module re-exports it
 * and fills its submit port with the verb socket (`submitIngest`), staging pointer bodies to the corpus CAS on the way.
 *
 * The full-source walk stays here: `scanSource` and its rename resolution (R2) read a whole source the CLI names.
 *
 * Meme: lar:///ha.ka.ba/lares/api/pono/working-procedures
 */

import { taskContentId, digestsEqual } from "@lararium/mesh";
import {
  syncedTreeKey, ingestWaveVerb, ingestWaitBudgetMs, listSourceFiles, scanFiles, fileToUriForSource, settleIngest as settleIngestVia,
  type SyncedTree, type ScanRow, type ScanStatus, type ScanResult, type PendingDeletion, type FileToUriFn, type SubmitIngestOpts, type IngestSettlement,
  type IngestPacing,
} from "@lararium/node";
import type { SubmitResult } from "./verb-result.js";
import { runVerb } from "./verb-call.js";
import { LocalWaitExpired, queryReceipt, type ReceiptAnswer } from "./local-connector.js";
import { stageBodyToCas, carrierCasFlagged, declaredType } from "./cas-stage.js";

export {
  carriedBasesOf, skipLines, openSyncedTree, readCarrierText, listCarriers, fileToUriForSource, siteMirrorFile, scanFiles,
  recordLandedCarriers, readCarrierAnswer, INGEST_PAGE, ingestVerdict, renamesOf, renamedSources, absentSources,
  NO_STANDING_ASKS, standsClean, standingAfterFault, standingAfterWave, candidatesOf, applyConfirmedRenames, deletionsOf,
  type ScanStatus, type PendingDeletion, type ArmedDeletion, type ScanRow, type ScanSkip, type ScanResult, type FileToUriFn,
  type MirrorDirs, type CarrierAnswer, type AskingCarrier, type IngestSettlement, type IngestVerdict, type StandingAsks,
  type SubmitIngestOpts,
} from "@lararium/node";

/**
 * THE WHOLE GESTURE over the verb socket: the node's settle (`settleIngest`, `ingest-scan`) with its submit port filled by
 * `submitIngest` unless a caller lends its own.
 */
export function settleIngest(
  opts: SubmitIngestOpts,
  tree: SyncedTree,
  submit: (o: SubmitIngestOpts) => Promise<SubmitResult> = (o) => submitIngest(o),
  pacing?: IngestPacing,
): Promise<IngestSettlement> {
  return settleIngestVia(opts, tree, submit, pacing);
}

/**
 * R2 rename-survival — over a FULL scan's rows, recover the observation of a carrier
 * that MOVED (its uri changed) with byte-identical content. For each location-`new`
 * row, ask the Synced tree's content-index for the UNIQUE live carrier already
 * observing that exact content in this bag; when it names a DIFFERENT uri whose file
 * is GONE from disk (not present among this full walk's live carriers — a COPY leaves
 * the source live and never qualifies), the row is a RENAME, not a fresh landing.
 *
 * The renamed row keeps riding as an ADD (so the island's rename pairing re-links its
 * records change-id-preserving), and its gone source rides the wave as a
 * rename-deletion; the caller moves the Synced observation on confirm
 * (`applyConfirmedRenames`). A genuine EDIT never matches (its hash changed); two
 * carriers sharing content decline (the index answers null on a >1 collision), and so do two files of
 * the wave sharing content: the pair must stand unique on both sides, since the island re-links no
 * ambiguous pair, and a source it declines stays where it stood.
 *
 * FULL-scan only: `liveUris` must be the WHOLE on-disk carrier set for the gone-guard
 * to read true, which a partial (watcher) wave cannot supply — so the watcher pairs
 * its own vanished set by content and never calls this.
 */
export function resolveRenames(rows: ScanRow[], toBag: string, tree: SyncedTree): { rows: ScanRow[]; renameDeletions: PendingDeletion[] } {
  const liveUris = new Set(rows.filter((r) => r.status !== "deleted").map((r) => r.uri));
  const renameDeletions: PendingDeletion[] = [];
  const claimedSources = new Set<string>();   // one source re-homes at most once per wave
  // How many of the wave's carriers hold each content: a rename pairs one vanished source with ONE file.
  // Every row that rides the wave counts (an arrival, and a standing carrier a hand edited into the same
  // bytes), since the island reads them all and a pair it finds ambiguous re-links nothing.
  const arrivals = new Map<string, number>();
  for (const r of rows) if ((r.status === "new" || r.status === "changed") && r.diskHash !== "") arrivals.set(r.diskHash, (arrivals.get(r.diskHash) ?? 0) + 1);
  const out = rows.map((r) => {
    if (r.status !== "new") return r;
    if ((arrivals.get(r.diskHash) ?? 0) !== 1) return r;
    const src = tree.renameSourceUri(toBag, r.diskHash);
    if (src === null || src === r.uri || liveUris.has(src) || claimedSources.has(src)) return r;
    // The source's base that observed this very content (a carrier holds one base per path).
    const srcHash = tree.bases(syncedTreeKey(toBag, src)).find((b) => digestsEqual(b.disk, r.diskHash))?.disk ?? null;
    if (srcHash === null) return r;             // the index and the rows disagree — decline, never guess
    claimedSources.add(src);
    // §2.2: `PendingDeletion` is the WIRE shape alone (`{uri, syncedHash}`) — no `file`. This whole-
    // source scan has no on-disk path for the vanished `src` uri (only the row's OWN `file`, the
    // rename's NEW home, is ever touched), so it never had one to carry honestly; the watcher's
    // `ArmedDeletion` (which DOES require `file`, real, for its own causal rescan) is a type this
    // path never runs and never claims to satisfy.
    renameDeletions.push({ uri: src, syncedHash: srcHash });
    return { ...r, status: "renamed" as ScanStatus, renameFrom: src };
  });
  return { rows: out, renameDeletions };
}

/** Walk a source and scan it whole. Returns null when the source does not
 *  resolve. `fileToUri` defaults to the source's mirror plane (bags/ vs wikis/).
 *  A full walk resolves renames (R2) — a moved carrier's observation survives. */
export function scanSource(
  root:   string,
  source: string,
  toBag:  string,
  tree:   SyncedTree,
  fileToUri: FileToUriFn = fileToUriForSource(root, source),
): ScanResult | null {
  const files = listSourceFiles(source);
  if (files === null) return null;
  const scan = scanFiles(root, files, toBag, tree, fileToUri);
  const { rows, renameDeletions } = resolveRenames(scan.rows, toBag, tree);
  return {
    rows, skipped: scan.skipped, ...(renameDeletions.length > 0 ? { renameDeletions } : {}),
    ...(scan.shadows !== undefined ? { shadows: scan.shadows } : {}),
    ...(scan.refusedShadows !== undefined ? { refusedShadows: scan.refusedShadows } : {}),
  };
}

/**
 * Submit NEW+CHANGED carriers as ONE INGEST verb over the verb socket — hashes travel WITH the content; the island runs the
 * full Confluence gate and answers per-carrier decisions (`ingestWaveArgs`). One call = one wave, one line over the sock. The
 * one-shot gesture and the watcher's every wave submit identically; the daemon holds the warm replica across both.
 *
 * THE BLOB LAW (cas-stage.ts): a pointer-kind `type` (the `.meta` declaration first, else TW5's registry by extension) or the
 * `_lar_cas` flag stages the body to the corpus CAS and rides a skinny `textCid`; a utf8 body under the wall rides INLINE.
 * `--in-wiki` wraps the INGEST so it runs IN the active wiki island over its composite (where working lives).
 */
/** A wave's wait ended and its receipt read no outcome: what the vessel holds for it, by its request id. */
export class WaveWaitEnded extends LocalWaitExpired {
  constructor(verb: string, timeoutMs: number, requestId: string, readonly receiptState: "committed" | "unknown", readonly detail?: string) {
    super(verb, timeoutMs, requestId);
  }
}

/** The doors one wave rides: the verb socket and the receipt read. A suite lends stubs. */
export interface IngestDoors {
  readonly run: typeof runVerb;
  readonly receipt: (requestId: string) => Promise<ReceiptAnswer>;
}
export const LIVE_INGEST_DOORS: IngestDoors = { run: runVerb, receipt: (id) => queryReceipt(id) };

export async function submitIngest(opts: SubmitIngestOpts, doors: IngestDoors = LIVE_INGEST_DOORS): Promise<SubmitResult> {
  const deletions = opts.deletions ?? [];
  const { verb: submitName, args: submitArgs } = ingestWaveVerb(opts, (r) => {
    const type = declaredType(r.meta);
    return stageBodyToCas(r.text, { ext: r.ext, flagged: carrierCasFlagged(r.text, r.meta), binary: r.binary ?? false, ...(type ? { type } : {}) });
  });
  const requestId = await taskContentId({ subject: opts.toBag, command: submitName, args: submitArgs, nonce: "" });
  // THE WAIT SCALES WITH THE WAVE: its carriers and its encoded bytes, capped (`ingestWaitBudgetMs`).
  const timeoutMs = ingestWaitBudgetMs({
    carriers: opts.candidates.length + deletions.length + (opts.kapae?.length ?? 0),
    bytes: Buffer.byteLength(JSON.stringify(submitArgs), "utf8"),
  });
  try {
    return await doors.run(submitName, submitArgs, opts.did, { requestId, timeoutMs });
  } catch (err) {
    if (!(err instanceof LocalWaitExpired)) throw err;
    return await readBackAfterWait(submitName, timeoutMs, err.requestId, doors);
  }
}

/**
 * THE WAIT ENDED; THE RECEIPT SPEAKS. The same request's receipt, read once (a read, never a dispatch): an outcome that
 * landed answers as the wave's own (the settle reads it whole); `committed` throws `WaveWaitEnded` reading committed; every
 * other answer (no line back, a vessel that never arbitrated the id, a dead engine that cannot read it) keeps the outcome
 * unknown, with the id. A receipt the vessel refuses gives no verdict on the wave, so it never reads as the wave's error.
 */
async function readBackAfterWait(verb: string, timeoutMs: number, requestId: string, doors: IngestDoors): Promise<SubmitResult> {
  let receipt: ReceiptAnswer;
  try { receipt = await doors.receipt(requestId); }
  catch (err) { throw new WaveWaitEnded(verb, timeoutMs, requestId, "unknown", `its receipt read failed (${err instanceof Error ? err.message : String(err)})`); }
  if ((receipt.state === "done" || receipt.state === "error") && receipt.refusal === undefined) {
    return {
      status: receipt.state, requestId,
      ...(receipt.results !== undefined ? { results: receipt.results as NonNullable<SubmitResult["results"]> } : {}),
      ...(receipt.errorMessage !== undefined ? { errorMessage: receipt.errorMessage } : {}),
    };
  }
  if (receipt.state === "committed") {
    // A COMMITTED FACT ON A FALLEN VESSEL NAMES THE FALL: no outcome lands until a fresh engine runs.
    const fell = receipt.engine !== undefined
      ? `committed, but the engine stopped (${String(receipt.engine.cause ?? "engine-terminated")}); the outcome will not land until the hand restarts the vessel`
      : undefined;
    throw new WaveWaitEnded(verb, timeoutMs, requestId, "committed", fell);
  }
  const detail = receipt.refusal !== undefined ? `its receipt read refused: ${receipt.errorMessage ?? receipt.refusal.reason}` : `its receipt reads ${receipt.state}`;
  throw new WaveWaitEnded(verb, timeoutMs, requestId, "unknown", detail);
}
