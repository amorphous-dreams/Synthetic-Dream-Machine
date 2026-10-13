/**
 * ingest-core — the disk→records gesture, factored out of `cmdIngest` so the
 * one-shot CLI command AND the long-lived watcher daemon run the SAME path.
 *
 * Two legs live here; the third leg lives on the island:
 *   scan  — walk source for carriers, derive each uri by the loci law,
 *           NFC-assert at the shore, hash, diff the disk hash against the base's disk side
 *   submit — pack NEW+CHANGED carriers (hashes riding with the text) into one
 *            INGEST verb; the island's gate supplies currentRenderHash (leg 3)
 *
 * The gesture holds the disk grant and the Synced tree; the island holds
 * neither (readiness reads local on both sides of the shore). A watcher is
 * just this gesture fired on a settle instead of on an operator keystroke.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/handoff
 */

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, resolve, sep, extname } from "node:path";
import { newChangeId, taskContentId, carrierHash, digestsEqual, BAG_MANIFEST_FILE } from "@lararium/mesh";
import { SyncedTree, syncedTreeKey, bagsFileToUri, mirrorDirFileToUri, larProjectionDir } from "@lararium/node";
import { canonicalizeCarrierText } from "@lararium/tw5/carrier-canonical";
import { summaryOutput, type SubmitResult } from "./verb-result.js";
import { runVerb } from "./verb-call.js";
import { stageBodyToCas, carrierCasFlagged, declaredType } from "./cas-stage.js";

export type ScanStatus = "new" | "unchanged" | "changed" | "non-nfc" | "deleted" | "renamed";

/** A vanished carrier the Synced tree still projects — the WIRE shape: rides an INGEST wave's
 *  `deletions[]` exactly as `resolveRenames`/`submitIngest` send it. No `file` here (§2.2) — a
 *  rename-deletion's `file` would be the NEW home a renamed row's OWN uri already names, never a
 *  usable path for the VANISHED source uri this record carries, so a reader that re-stat'd it (the
 *  watcher's causal rescan) would stat the wrong file entirely. The island gate splits rename
 *  re-links from tombstones off `uri` alone. */
export interface PendingDeletion {
  readonly uri:        string;
  readonly syncedHash: string;
}

/** The WATCHER-LOCAL shape (§2.2): a `PendingDeletion` this process can re-find on disk because IT
 *  (never the island, never a whole-source rename) scanned it FROM a real path — `deletionsOf`,
 *  `pendingDeletes`, and `dueDeletions` all deal in this shape, with `file` REQUIRED and no `?? uri`
 *  fallback (L7): a `lar://` uri stat'd as a path always reads absent, so a silent fallback there
 *  would have let a `file`-less pending delete ride on the grace timer's patience alone, never the
 *  causal rescan M9 built. */
export interface ArmedDeletion extends PendingDeletion {
  readonly file: string;
}

export interface ScanRow {
  readonly file:       string;
  readonly uri:        string;
  readonly text:       string;
  readonly diskHash:   string;
  readonly syncedHash: string | null;
  /** The base's RECORDS side, where it differs from the disk side (`syncedHash`): the disk stood in a
   *  framing the records' render would normalize. Absent = one hash names both sides. */
  readonly syncedRecordsHash?: string;
  readonly status:     ScanStatus;
  /** The file's extension (".mem" / ".tid" / ".json" / ".md" …); rides the
   *  INGEST carrier so the island routes by TW5's own filetype registry. */
  readonly ext:        string;
  /** The body failed the utf8 round-trip (a raw binary shard rides base64) — the CAS stager
   *  decodes it back to raw bytes before hashing a pointer-kind carrier. */
  readonly binary?:    boolean;
  /** Raw `<file>.meta` sidecar text when one sits beside a content file — rides
   *  the carrier so the island keeps the sidecar's fields across a body edit.
   *  Absent for a self-contained filetype (`.mem`/`.tid`) or no sidecar. */
  readonly meta?:      string;
  /** R2 — set on a `renamed` row: the VANISHED source URI whose byte-identical
   *  observation this carrier re-homes. The row rides as an ADD (so the island
   *  re-links records change-id-preserving via the delete-gate), the source rides
   *  the wave as a rename-deletion, and the CLI moves the observation post-confirm. */
  readonly renameFrom?: string;
}

export interface ScanResult {
  readonly rows:    ScanRow[];
  readonly skipped: string[];
  /** R2 — the rename-deletions a FULL scan discovered (each `renamed` row's gone
   *  source), threaded into the INGEST wave's `deletions[]` so the island pairs
   *  them and re-homes records. Absent on a partial (watcher) scan, which keeps
   *  its own grace-window + delete-gate rename path. */
  readonly renameDeletions?: PendingDeletion[];
}

/** Open the Synced tree at the canonical projection-state path (larProjectionDir() —
 *  runtime vessel state, not corpus). */
export function openSyncedTree(): SyncedTree {
  return new SyncedTree(join(larProjectionDir(), "synced-tree.json"));
}

/**
 * Read a carrier's bytes as the string form the gesture carries — utf8 for a text
 * file, base64 for a binary one (image/PDF). The detection needs no registry and no
 * extension list: bytes that survive a utf8 round-trip ARE text; bytes that do not
 * ARE binary, and ride as base64. THE BLOB LAW then reads the TYPE: a pointer-kind
 * carrier's base64 decodes back to raw bytes at the CAS stager (`stageBodyToCas`) and
 * rides a pointer; a utf8 body rides inline. A base64 body carries no SOH heading, so
 * it never routes to the memetic path.
 */
export function readCarrierText(file: string): { text: string; binary: boolean } {
  const buf  = readFileSync(file);
  const utf8 = buf.toString("utf8");
  if (Buffer.from(utf8, "utf8").equals(buf)) return { text: utf8, binary: false };
  return { text: buf.toString("base64"), binary: true };
}

/**
 * List the carriers under a source — a directory walks recursively for every
 * REAL file (a `.meta` sidecar rides with its content file, never as a carrier
 * of its own), a single file lists itself. Returns null when the source does
 * not resolve. Filetype routing is the ISLAND's job (TW5's registry); the Node
 * gesture only enumerates + carries the extension. Observations only, never a
 * work queue (Confluence: scan is truth, events are hints).
 */
export function listCarriers(source: string): string[] | null {
  let st;
  try { st = statSync(source); } catch { return null; }
  if (!st.isDirectory()) return [source];
  // A bag's OWN declaration is DISK-OWNED and never becomes a record (operator ruling, 2026-08-08). Seeded,
  // it would land in the bag's document and then round-trip through the projection — after which a wiki edit
  // could re-home the bag or loosen its cap-tier. A declaration a rendered surface can move is a declaration
  // nothing holds, so the authority stays on disk where `lares bag declare` writes it. Only the holding
  // ROOT's manifest is excluded: a meme deeper in the tree may legitimately carry that name.
  const bagDeclaration = join(source, BAG_MANIFEST_FILE);
  return (readdirSync(source, { recursive: true }) as string[])
    .map((f) => join(source, f))
    .filter((f) => { try { return statSync(f).isFile(); } catch { return false; } })
    // A `.meta` sidecar carries a content file's fields — it lands WITH that
    // file at the shore, never as a standalone carrier.
    .filter((f) => !f.endsWith(".meta"))
    .filter((f) => f !== bagDeclaration);
}

/** Derive a file's carrier-root URI for one mirror plane (bags/ canon vs
 *  wikis/ working write-layer). The watcher and CLI both feed a source; this
 *  names which loci reverse-derivation a row carries. */
export type FileToUriFn = (root: string, file: string) => string | null;

/** The two mirror directories a vessel reads — `LAR_BAGS` / `LAR_WIKIS` (cli `larBagsDir()` / `larWikisDir()`),
 *  which may sit outside `LAR_ROOT`. */
export interface MirrorDirs { readonly bags: string; readonly wikis: string }

/**
 * Pick the loci reverse-derivation by which mirror plane the source sits in.
 * Under the wikis dir → the working write-layer ingest-back derivation
 * (the editing plane); else the bags dir canon derivation. Designation of the
 * target bag stays the caller's (`--to`); the plane only drives the URI.
 * `dirs` defaults to `<root>/bags` and `<root>/wikis`; the returned function derives against `dirs`
 * and ignores the root its caller hands it.
 */
export function fileToUriForSource(
  root: string, source: string,
  dirs: MirrorDirs = { bags: join(root, "bags"), wikis: join(root, "wikis") },
): FileToUriFn {
  const wikisRoot = resolve(dirs.wikis);
  const abs = resolve(source);
  const dir = abs === wikisRoot || abs.startsWith(wikisRoot + sep) ? dirs.wikis : dirs.bags;
  return (_root, file) => mirrorDirFileToUri(dir, file);
}

/**
 * The two-leg diff over an explicit carrier list: derive uri, NFC-assert, hash,
 * compare against the Synced tree. The watcher feeds the buffered changed paths
 * here; the CLI feeds the whole walked source. `fileToUri` names the mirror
 * plane (default bags/ canon; wikis/ for working ingest-back).
 */
export function scanFiles(
  root:  string,
  files: readonly string[],
  toBag: string,
  tree:  SyncedTree,
  fileToUri: FileToUriFn = bagsFileToUri,
): ScanResult {
  const rows: ScanRow[] = [];
  const skipped: string[] = [];
  for (const file of files) {
    const uri = fileToUri(root, file);
    if (!uri) { skipped.push(file); continue; }
    const ext = extname(file);
    let text: string;
    let binary: boolean;
    try { ({ text, binary } = readCarrierText(file)); } catch {
      // A path gone from disk that the Synced tree still projects = a deletion
      // candidate (the watcher feeds vanished paths; the grace window + the
      // island gate confirm before any tombstone). An unknown gone path skips.
      const goneSynced = tree.get(syncedTreeKey(toBag, uri));
      if (goneSynced !== null) rows.push({ file, uri, text: "", diskHash: "", syncedHash: goneSynced, status: "deleted", ext });
      else skipped.push(file);
      continue;
    }
    // The NFC shore assertion (spec: memetic-wikitext-framing #carrier-bytes) — foreign
    // TEXT bytes first walk in HERE; non-NFC refuses loudly, never enters. A binary
    // carrier rides base64 (pure ASCII), so the NFC law does not touch it.
    if (!binary && text !== text.normalize("NFC")) {
      rows.push({ file, uri, text, diskHash: "", syncedHash: null, status: "non-nfc", ext });
      continue;
    }
    // Pair a `.meta` sidecar sitting beside a content file — its fields ride WITH
    // the carrier, AND fold into the observation hash: `.meta` holds LIVE metadata
    // for the entity, so an edit to it alone must read as CHANGED (a body-only
    // hash let a field-only edit slip past the echo gate).
    let meta: string | undefined;
    try {
      const metaPath = file + ".meta";
      if (existsSync(metaPath)) meta = readFileSync(metaPath, "utf8");
    } catch { /* no readable sidecar — a self-contained filetype needs none */ }
    const diskHash   = carrierHash(text, meta);
    // THE BASE HOLDS TWO SIDES. The scan reads the disk side: a file whose bytes stand where the last
    // agreement left them reads `unchanged`, whatever framing they wear. The records side rides the
    // wave so the island's gate can tell "the records moved" from "the disk stands in another framing".
    const base       = tree.base(syncedTreeKey(toBag, uri));
    const syncedHash = base?.disk ?? null;
    const syncedRecordsHash = base !== null && !digestsEqual(base.disk, base.records) ? base.records : undefined;
    // Both sides ride tagged now (`carrierHash` emits `sha256:…`; the tree stores
    // the same tagged form) — `digestsEqual` still normalizes the two spellings a
    // tagged digest can carry (canonical `:` vs legacy SRI `-`).
    const status: ScanStatus =
      syncedHash === null ? "new" : digestsEqual(diskHash, syncedHash) ? "unchanged" : "changed";
    rows.push({ file, uri, text, diskHash, syncedHash, ...(syncedRecordsHash !== undefined ? { syncedRecordsHash } : {}), status, ext, binary, ...(meta !== undefined ? { meta } : {}) });
  }
  return { rows, skipped };
}

/**
 * Record a landed carrier's synced observation. The gesture records what it landed;
 * the projector records what it projects; both write the same key and the same hash
 * where they agree. A bag no mounted wiki mirrors never projects, and a pack file
 * never projects back, so without the gesture's record the next scan reads every
 * landed carrier `new` and a vanished file never reads as a deletion.
 *
 * Records a BASE for each result that decided `ingest` or `noop` (a noop says the
 * records already say what the disk says): the candidate's disk hash on the disk
 * side, and on the records side the hash the island answered for the render its
 * records hold (`canonicalHash`). A row that names no render (an echo noop, a
 * pointer) keeps the records side a standing base already holds for these same
 * bytes, else the disk hash names both sides. Never records `conflict`, `refuse`,
 * or a result naming no candidate. Before recording, the file is hashed as it
 * stands NOW: where the disk moved since the scan, the projector wrote it and owns
 * that observation, so nothing records. Returns the count recorded; the caller
 * flushes the tree.
 */
export function recordLandedCarriers(
  tree: SyncedTree,
  toBag: string,
  candidates: readonly ScanRow[],
  resultCarriers: ReadonlyArray<Record<string, unknown>>,
): number {
  const byUri = new Map(candidates.map((c) => [c.uri, c] as const));
  let recorded = 0;
  for (const c of resultCarriers) {
    if (c["decision"] !== "ingest" && c["decision"] !== "noop") continue;
    const cand = byUri.get(String(c["uri"]));
    if (!cand || cand.diskHash === "") continue;
    if (diskHashNow(cand.file) !== cand.diskHash) continue;
    const key = syncedTreeKey(toBag, cand.uri);
    const standing = tree.base(key);
    const answered = typeof c["canonicalHash"] === "string" && c["canonicalHash"] ? (c["canonicalHash"] as string) : null;
    const recordsHash = answered
      ?? (standing !== null && digestsEqual(standing.disk, cand.diskHash) ? standing.records : cand.diskHash);
    tree.set(key, cand.diskHash, recordsHash);
    recorded++;
  }
  return recorded;
}

/**
 * The island's per-carrier answer, as an outcome carries it.
 *
 * AN OUTCOME KEEPS EVERY ROW ONLY UNDER ITS AUDIT CAP. Past the cap (`boundOutcomeOutput`, `@lararium/tw5`
 * `verb-vm.ts`) the durable outcome holds a count, a tally per decision, a hash, a short sample, and every
 * `refuse` and `conflict` row up to the cap (`held`, with `heldMore` counting the ones it leaves unnamed), and
 * the CLI reads that same outcome as its answer. A whole-bag seed crosses the cap, so every reader of
 * `carriers` reads through here: `rows` holds what the outcome names (all rows under the cap; past it, the held
 * rows), and `bounded` holds the count, the tally and `heldMore` where the rest stayed behind.
 */
export interface CarrierAnswer {
  readonly rows:    ReadonlyArray<Record<string, unknown>>;
  readonly bounded: { readonly count: number; readonly tallies: Readonly<Record<string, number>>; readonly heldMore: number } | null;
}

export function readCarrierAnswer(carriers: unknown): CarrierAnswer {
  if (Array.isArray(carriers)) return { rows: carriers as Array<Record<string, unknown>>, bounded: null };
  if (carriers !== null && typeof carriers === "object") {
    const o = carriers as Record<string, unknown>;
    const count = o["boundedArrayCount"];
    const tallies = o["tallies"];
    const held = o["held"];
    const heldMore = o["heldMore"];
    if (typeof count === "number" && tallies !== null && typeof tallies === "object" && !Array.isArray(tallies)
        && Array.isArray(held) && typeof heldMore === "number") {
      const clean: Record<string, number> = {};
      for (const [k, v] of Object.entries(tallies as Record<string, unknown>)) if (typeof v === "number") clean[k] = v;
      return { rows: held as Array<Record<string, unknown>>, bounded: { count, tallies: clean, heldMore } };
    }
  }
  return { rows: [], bounded: null };
}

/** A wave under this many carriers answers with every row whole. It never exceeds the outcome's audit cap
 *  (`AUDIT_ARRAY_CAP`, `@lararium/tw5` `verb-vm.ts`); `tests/ingest-settles-every-row.test.ts` welds the two. */
export const INGEST_PAGE = 32;

/** One refused or conflicting carrier, as a person reads it: where, what the island decided, and why. */
export interface AskingCarrier {
  readonly uri:      string;
  readonly file?:    string;
  readonly decision: string;
  readonly why:      string;
}

/** Why the island refused or stood off, in its own words: every warning it gave, else its reason, else its code. */
function whyOf(row: Record<string, unknown>): string {
  const warnings = Array.isArray(row["warnings"]) ? (row["warnings"] as unknown[]).filter((w): w is string => typeof w === "string" && w !== "") : [];
  if (warnings.length > 0) return warnings.join("; ");
  if (typeof row["reason"] === "string" && row["reason"]) return row["reason"];
  if (typeof row["code"] === "string" && row["code"]) return row["code"];
  return row["decision"] === "conflict"
    ? "the disk and the records both moved past the base this file last agreed on"
    : "the island named no reason";
}

/** What an INGEST gesture settled: every wave it sent, and every row those waves named. */
export interface IngestSettlement {
  /** The first wave: its request id names the gesture's audit record, and its error ends the gesture. */
  readonly first:    SubmitResult;
  /** Every later wave the gesture sent to read a row the first answer left behind. */
  readonly pages:    readonly SubmitResult[];
  /** How many carriers the gesture submitted. */
  readonly submitted: number;
  /** Every carrier address the gesture submitted, and every vanished address it sent as a deletion. */
  readonly asked:    readonly string[];
  readonly askedDeletions: readonly string[];
  /** The carriers the answer proves landed or already matching: a row that says so, a tally that proves
   *  every unnamed carrier landed, or a rename the island confirmed. */
  readonly landed:   ReadonlySet<string>;
  /** The carriers no answer accounts for: neither landed, refused, nor standing in a conflict. A wave the
   *  island answered without their rows, or a later wave that failed before reaching them. */
  readonly unanswered: readonly string[];
  /** The decision the island gave each carrier it NAMED, by uri. Past the cap a landed carrier may go unnamed. */
  readonly named:    ReadonlyMap<string, Record<string, unknown>>;
  /** Every carrier the island refused, each with its refusal. Complete: no refusal stays unnamed. */
  readonly refused:  readonly AskingCarrier[];
  /** Every carrier that stood off in a conflict, each named. Complete. */
  readonly conflicts: readonly AskingCarrier[];
  /** Carriers per decision over the whole gesture. */
  readonly tallies:  Readonly<Record<string, number>>;
  /** The first wave's deletion summary (renames, tombstones, a tripped brake). */
  readonly deletions: Record<string, unknown> | undefined;
  /** How many bases the gesture pinned. */
  readonly recorded: number;
  /** A later wave that ended in an error: the gesture stops there and names what stays unread. */
  readonly pageError?: { readonly message: string; readonly unread: number };
}

/** What a settled gesture says of itself: whether the run took everything it was handed, and why it did not. */
export interface IngestVerdict {
  /** True where the run refused a carrier, a later wave failed, or the mass-delete brake applied nothing. */
  readonly failed:  boolean;
  /** The brake's own reason where it tripped; null otherwise. */
  readonly braked:  string | null;
  /** The sentence a person reads where the run failed; null where it took everything. */
  readonly message: string | null;
}

/**
 * A REFUSAL NEVER READS AS APPLIED. Four states end a run non-zero: a refused carrier (each one named), a
 * later wave that failed (the count that stays unread named), a carrier no answer accounts for, and a
 * tripped mass-delete brake, which applies nothing and answers no carrier row at all. A conflict gets named and leaves the verdict alone: the island
 * surfaced it for a hand, and the run took every carrier it could decide.
 */
export function ingestVerdict(s: IngestSettlement): IngestVerdict {
  const braked = s.deletions?.["decision"] === "suspend"
    ? String(s.deletions["reason"] ?? "the wave would remove more carriers than the brake allows")
    : null;
  if (braked !== null) {
    return { failed: true, braked, message: `INGEST applied nothing: the mass-delete brake tripped (${braked}); ${s.submitted} carrier(s) and the wave's deletions stand unapplied` };
  }
  if (s.pageError !== undefined) {
    return { failed: true, braked, message: `INGEST read ${s.refused.length} refusal(s) and then a later wave failed (${s.pageError.message}); ${s.pageError.unread} carrier(s) stay unread: run the ingest again` };
  }
  if (s.refused.length > 0) {
    return { failed: true, braked, message: `INGEST refused ${s.refused.length} of ${s.submitted} carrier(s): ${s.refused.map((r) => r.uri).join(", ")}` };
  }
  if (s.unanswered.length > 0) {
    return { failed: true, braked, message: `INGEST drew no answer for ${s.unanswered.length} of ${s.submitted} carrier(s): ${s.unanswered.join(", ")}; run the ingest again` };
  }
  return { failed: false, braked, message: null };
}

/**
 * What a watcher still owes across its waves: each carrier that did not land, and each vanished address
 * whose deletion did not apply, by address, with the reason in the island's or the wave's own words.
 */
export interface StandingAsks {
  readonly owed:          ReadonlyMap<string, string>;
  readonly owedDeletions: ReadonlyMap<string, string>;
}

export const NO_STANDING_ASKS: StandingAsks = { owed: new Map(), owedDeletions: new Map() };

/** True where nothing stays owed. */
export function standsClean(standing: StandingAsks): boolean {
  return standing.owed.size === 0 && standing.owedDeletions.size === 0;
}

/** A wave that never answered (a thrown fault, a wait that ended): everything it carried stays owed. */
export function standingAfterFault(
  standing: StandingAsks, wave: { readonly asked: readonly string[]; readonly askedDeletions: readonly string[] }, message: string,
): StandingAsks {
  const owed = new Map(standing.owed);
  const owedDeletions = new Map(standing.owedDeletions);
  for (const uri of wave.asked) owed.set(uri, message);
  for (const uri of wave.askedDeletions) owedDeletions.set(uri, message);
  return { owed, owedDeletions };
}

/**
 * Fold one settled wave into what stays owed, BY ADDRESS. A debt clears only where a wave proves that very
 * carrier landed, or that very deletion applied: a later wave over other files clears nothing.
 *
 *   · a carrier the wave refused, or that drew no answer, stands owed with the reason;
 *   · a carrier the answer proves landed (a row, a proving tally, a confirmed rename) leaves the set;
 *   · a wave the island answered with an error, or that the brake stopped, leaves everything it carried
 *     owed, its deletions too;
 *   · a deletion the summary names applied (a tombstone, a rename's source) leaves the set.
 *
 * A conflict stays out: the island surfaced it for a hand, and the wave took every carrier it could decide.
 * A long-lived watcher reads this at its stop and ends non-zero where anything stays owed.
 */
export function standingAfterWave(standing: StandingAsks, s: IngestSettlement): StandingAsks {
  if (s.first.status === "error") return standingAfterFault(standing, s, s.first.errorMessage ?? "the daemon refused and named no reason");
  const verdict = ingestVerdict(s);
  if (verdict.braked !== null) return standingAfterFault(standing, s, `the mass-delete brake tripped (${verdict.braked})`);
  const owed = new Map(standing.owed);
  const owedDeletions = new Map(standing.owedDeletions);
  for (const uri of s.landed) owed.delete(uri);
  for (const r of s.refused) owed.set(r.uri, r.why);
  const unread = s.pageError !== undefined ? `a later wave failed (${s.pageError.message})` : "the island answered the wave without this carrier's row";
  for (const uri of s.unanswered) owed.set(uri, unread);
  // The deletions the summary names applied. A summary that names none leaves each asked deletion owed.
  const applied = new Set<string>();
  if (s.deletions?.["decision"] === "apply") {
    for (const uri of Array.isArray(s.deletions["tombstoned"]) ? (s.deletions["tombstoned"] as unknown[]) : []) applied.add(String(uri));
    for (const r of Array.isArray(s.deletions["renames"]) ? (s.deletions["renames"] as Array<Record<string, unknown>>) : []) applied.add(String(r["fromUri"]));
  }
  for (const uri of applied) owedDeletions.delete(uri);
  for (const uri of s.askedDeletions) if (!applied.has(uri)) owedDeletions.set(uri, "the wave's deletion summary names no tombstone and no rename for it");
  return { owed, owedDeletions };
}

/**
 * The records side the gesture can read for itself: a framed meme with no sidecar renders through the one
 * pure door the projector reads (`canonicalizeCarrierText`), so both pin the same hash. A carrier beside a
 * sidecar, a native filetype, a binary body and a carrier the door cannot read whole all answer null: the
 * island's own row names their render.
 */
function ownRecordsSide(c: ScanRow): string | null {
  if (c.meta !== undefined || c.binary) return null;
  let canonical: string | null;
  try { canonical = canonicalizeCarrierText(c.uri, c.text); } catch { canonical = null; }
  return canonical === null ? null : carrierHash(canonical);
}

/**
 * THE WHOLE GESTURE: submit, read every row a person or the base needs, pin what landed.
 *
 * One wave carries every candidate. Under the audit cap its outcome names every row and the gesture ends
 * there. Past the cap the outcome holds a tally and the rows that ask for a hand, and two readings may stay
 * behind:
 *
 *   · A REFUSAL THE SUMMARY LEFT UNNAMED (`heldMore` above zero). The gesture asks again for every carrier
 *     the summary did not name, in waves under the cap, so each answers with its row whole.
 *   · A LANDED CARRIER'S RENDER. A base holds two sides, and the records side comes from the island's row.
 *     Where the rows stayed behind the gesture reads that side through the pure door for a framed meme with
 *     no sidecar, and asks again, in waves under the cap, for each carrier the door cannot read.
 *
 * A carrier asked again reads against the records the first wave left: a landed one answers `noop` and its
 * render, a refused one answers its refusal again. Nothing lands twice. Deletions ride the first wave alone.
 */
export async function settleIngest(
  opts: SubmitIngestOpts,
  tree: SyncedTree,
  submit: (o: SubmitIngestOpts) => Promise<SubmitResult> = submitIngest,
): Promise<IngestSettlement> {
  const first = await submit(opts);
  const asked = opts.candidates.map((c) => c.uri);
  const askedDeletions = (opts.deletions ?? []).map((d) => d.uri);
  if (first.status === "error") {
    return {
      first, pages: [], submitted: asked.length, asked, askedDeletions, landed: new Set(), unanswered: asked,
      named: new Map(), refused: [], conflicts: [], tallies: {}, deletions: undefined, recorded: 0,
    };
  }

  const summary = summaryOutput(first) ?? {};
  const deletions = (summary as { deletions?: Record<string, unknown> }).deletions;
  const answer = readCarrierAnswer((summary as { carriers?: unknown }).carriers);
  const byUri = new Map(opts.candidates.map((c) => [c.uri, c] as const));
  const named = new Map<string, Record<string, unknown>>();
  for (const row of answer.rows) named.set(String(row["uri"]), row);
  const pages: SubmitResult[] = [];
  let recorded = 0;
  let pageError: IngestSettlement["pageError"];
  /** Carriers a tally proves landed though no row names them. */
  const provenLanded = new Set<string>();
  // A carrier the island re-homed from a vanished source rides the deletion summary and pins there
  // (`applyConfirmedRenames`).
  const rehomed = new Set<string>();
  if (deletions?.["decision"] === "apply" && Array.isArray(deletions["renames"])) {
    for (const r of deletions["renames"] as Array<Record<string, unknown>>) rehomed.add(String(r["toUri"]));
  }

  if (!answer.bounded) {
    recorded += recordLandedCarriers(tree, opts.toBag, opts.candidates, answer.rows);
  } else {
    // Who stays unread. Each unnamed carrier landed only where the answer PROVES it: no refusal stays
    // unnamed, and the tally's landed count equals the unnamed carriers. Where the tally proves less (a row
    // this reader cannot place, a row short), every unnamed carrier gets asked again and its own row decides.
    const unnamed = opts.candidates.filter((c) => !named.has(c.uri) && !rehomed.has(c.uri));
    const { tallies: told, heldMore } = answer.bounded;
    const proven = heldMore === 0 && (told["ingest"] ?? 0) + (told["noop"] ?? 0) === unnamed.length;
    const askAgain: ScanRow[] = [];
    if (!proven) {
      askAgain.push(...unnamed);
    } else {
      for (const c of unnamed) provenLanded.add(c.uri);
      const own: Array<Record<string, unknown>> = [];
      for (const c of unnamed) {
        const records = ownRecordsSide(c);
        if (records === null) askAgain.push(c);
        else own.push({ uri: c.uri, decision: "ingest", canonicalHash: records });
      }
      recorded += recordLandedCarriers(tree, opts.toBag, opts.candidates, own);
    }
    for (let at = 0; at < askAgain.length && pageError === undefined; at += INGEST_PAGE) {
      const page = askAgain.slice(at, at + INGEST_PAGE);
      const { deletions: _first, changeId: _id, ...rest } = opts;
      const result = await submit({ ...rest, candidates: page });
      pages.push(result);
      if (result.status === "error") {
        pageError = { message: result.errorMessage ?? "the daemon refused and named no reason", unread: askAgain.length - at };
        break;
      }
      const rows = readCarrierAnswer((summaryOutput(result) as { carriers?: unknown } | undefined)?.carriers).rows;
      for (const row of rows) named.set(String(row["uri"]), row);
      recorded += recordLandedCarriers(tree, opts.toBag, page, rows);
    }
  }

  const asking = (decision: string): AskingCarrier[] => [...named.values()]
    .filter((row) => row["decision"] === decision)
    .map((row) => {
      const uri = String(row["uri"] ?? "(carrier)");
      const file = byUri.get(uri)?.file;
      return { uri, ...(file !== undefined ? { file } : {}), decision, why: whyOf(row) };
    });
  const refused = asking("refuse");
  const conflicts = asking("conflict");
  // The tally over the whole gesture: the rows where every carrier got named, else the first wave's own
  // count with the asking decisions corrected to what the later waves named.
  const tallies: Record<string, number> = {};
  if (!answer.bounded) {
    for (const row of answer.rows) { const d = String(row["decision"]); tallies[d] = (tallies[d] ?? 0) + 1; }
  } else {
    Object.assign(tallies, answer.bounded.tallies);
    if (pageError === undefined) {
      if (refused.length > 0) tallies["refuse"] = refused.length; else delete tallies["refuse"];
      if (conflicts.length > 0) tallies["conflict"] = conflicts.length; else delete tallies["conflict"];
    }
  }
  // What the answer accounts for. A row that says a carrier landed, a tally that proves it, a rename the
  // island confirmed; a refusal and a conflict each named. Every other carrier drew no answer.
  const landed = new Set<string>([...provenLanded, ...rehomed].filter((uri) => byUri.has(uri)));
  for (const [uri, row] of named) {
    const decision = String(row["decision"]);
    if (decision === "ingest" || decision === "noop" || decision === "rename-target" || decision === "rename") landed.add(uri);
    else landed.delete(uri);
  }
  const askingUris = new Set([...refused, ...conflicts].map((r) => r.uri));
  const unanswered = asked.filter((uri) => !landed.has(uri) && !askingUris.has(uri));
  return {
    first, pages, submitted: asked.length, asked, askedDeletions, landed, unanswered,
    named, refused, conflicts, tallies, deletions, recorded,
    ...(pageError !== undefined ? { pageError } : {}),
  };
}

/** The observation hash of a carrier file as it stands now (body plus `.meta` pairing), or null where unreadable. */
function diskHashNow(file: string): string | null {
  try {
    const { text } = readCarrierText(file);
    const metaPath = file + ".meta";
    const meta = existsSync(metaPath) ? readFileSync(metaPath, "utf8") : undefined;
    return carrierHash(text, meta);
  } catch { return null; }
}

/**
 * R2 rename-survival — over a FULL scan's rows, recover the observation of a carrier
 * that MOVED (its uri changed) with byte-identical content. For each location-`new`
 * row, ask the Synced tree's content-index for the UNIQUE live carrier already
 * observing that exact content in this bag; when it names a DIFFERENT uri whose file
 * is GONE from disk (not present among this full walk's live carriers — a COPY leaves
 * the source live and never qualifies), the row is a RENAME, not a fresh landing.
 *
 * The renamed row keeps riding as an ADD (so the island's delete-gate re-links its
 * records change-id-preserving), and its gone source rides the wave as a
 * rename-deletion; the caller moves the Synced observation on confirm
 * (`applyConfirmedRenames`). A genuine EDIT never matches (its hash changed); two
 * carriers sharing content decline (the index answers null on a >1 collision).
 *
 * FULL-scan only: `liveUris` must be the WHOLE on-disk carrier set for the gone-guard
 * to read true, which a partial (watcher) wave cannot supply — so the watcher keeps
 * its grace-window + delete-gate path and never calls this.
 */
export function resolveRenames(rows: ScanRow[], toBag: string, tree: SyncedTree): { rows: ScanRow[]; renameDeletions: PendingDeletion[] } {
  const liveUris = new Set(rows.filter((r) => r.status !== "deleted").map((r) => r.uri));
  const renameDeletions: PendingDeletion[] = [];
  const claimedSources = new Set<string>();   // one source re-homes at most once per wave
  const out = rows.map((r) => {
    if (r.status !== "new") return r;
    const src = tree.renameSourceUri(toBag, r.diskHash);
    if (src === null || src === r.uri || liveUris.has(src) || claimedSources.has(src)) return r;
    const srcHash = tree.get(syncedTreeKey(toBag, src));
    if (srcHash === null) return r;             // the index and the map disagree — decline, never guess
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
  const files = listCarriers(source);
  if (files === null) return null;
  const scan = scanFiles(root, files, toBag, tree, fileToUri);
  const { rows, renameDeletions } = resolveRenames(scan.rows, toBag, tree);
  return { rows, skipped: scan.skipped, ...(renameDeletions.length > 0 ? { renameDeletions } : {}) };
}

/** The rows an INGEST submission carries — NEW, CHANGED, and RENAMED. A `renamed`
 *  row rides as an ADD so the island's delete-gate pairs it with its gone source and
 *  re-links the records (change-id preserved); it returns `rename-target`, never a
 *  fresh re-land. */
export function candidatesOf(rows: readonly ScanRow[]): ScanRow[] {
  return rows.filter((r) => r.status === "new" || r.status === "changed" || r.status === "renamed");
}

/**
 * R2 — move the Synced observation for each rename the island CONFIRMED. Reads the
 * authoritative `deletions.renames` the gate returned (never the CLI's own guess),
 * so a suspended wave (mass-delete brake) moves nothing. For each `fromUri → toUri`
 * it drops the stale source observation and records the moved carrier's hash at the
 * new location — so the NEXT scan reads the moved carrier `unchanged` and never
 * re-lands it. Returns the count moved; the caller flushes the tree.
 */
export function applyConfirmedRenames(
  tree: SyncedTree,
  toBag: string,
  candidates: readonly ScanRow[],
  deletionSummary: Record<string, unknown> | undefined,
): number {
  if (!deletionSummary || deletionSummary["decision"] !== "apply") return 0;
  const renames = deletionSummary["renames"];
  if (!Array.isArray(renames)) return 0;
  const diskHashByUri = new Map(candidates.map((c) => [c.uri, c.diskHash] as const));
  let moved = 0;
  for (const r of renames as Array<Record<string, unknown>>) {
    const fromUri = String(r["fromUri"]);
    const toUri   = String(r["toUri"]);
    const diskHash = diskHashByUri.get(toUri);
    if (diskHash === undefined) continue;   // a rename we did not submit — leave it be
    // The records re-homed whole, so the base's records side travels with them where the moved file
    // holds the bytes the source's base named.
    const source = tree.base(syncedTreeKey(toBag, fromUri));
    tree.delete(syncedTreeKey(toBag, fromUri));
    tree.set(syncedTreeKey(toBag, toUri), diskHash, source !== null && digestsEqual(source.disk, diskHash) ? source.records : diskHash);
    moved++;
  }
  return moved;
}

/** The vanished carriers in a scan — DELETED rows, as the watcher's ARMED set (§2.2): each one DID
 *  scan from a real on-disk `file`, so it carries the shape that can honestly re-stat itself later. */
export function deletionsOf(rows: readonly ScanRow[]): ArmedDeletion[] {
  return rows
    .filter((r) => r.status === "deleted" && r.syncedHash !== null)
    .map((r) => ({ uri: r.uri, syncedHash: r.syncedHash as string, file: r.file }));
}

export interface SubmitIngestOpts {
  readonly source:    string;
  readonly toBag:     string;
  readonly candidates: readonly ScanRow[];
  readonly did:       string;
  /** Omit for a fresh change-id; pass one to thread a known id. */
  readonly changeId?: string;
  /** Vanished carriers riding the same wave (rename re-link or tombstone). */
  readonly deletions?: readonly PendingDeletion[];
  /** Operator mass-delete brake dial (0,1]; omitted → island default. */
  readonly massDeleteFraction?: number;
  /**
   * Run the INGEST IN the active wiki island over ITS composite — the path
   * for `working` (the per-fingerprint write layer the daemon never reaches).
   * The daemon commands via `wiki-act` wrapping the INGEST; the default path
   * executes daemon-side (canon bags).
   */
  readonly inWiki?: boolean;
}

/**
 * Submit NEW+CHANGED carriers as ONE INGEST verb — hashes travel WITH the content;
 * the island runs the full Confluence gate and answers per-carrier decisions. One call =
 * one wave, one line over the sock. The one-shot gesture and the watcher's every
 * wave submit identically; the daemon holds the warm replica across both.
 */
export async function submitIngest(opts: SubmitIngestOpts): Promise<SubmitResult> {
  const changeId = opts.changeId ?? newChangeId();
  const deletions = opts.deletions ?? [];
  const actionArgs: Record<string, unknown> = {
    "source-uri": opts.source,
    "to-bag":     opts.toBag,
    "change-id":  changeId,
    // THE BLOB LAW (cas-stage.ts): a pointer-kind `type` (the `.meta` declaration first, else TW5's
    // registry by extension) or the `_lar_cas` flag stages the body to the corpus CAS and rides a
    // skinny `textCid` — the island lands a POINTER. A utf8 body under the wall rides INLINE `text`
    // (a meme is an inline-by-nature tiddler bundle, no persistent CAS blob). An oversized un-flagged
    // utf8 body stages for transport but rides no `skinny`, so the island faults it (a verb rides a
    // reference, never a body) rather than materializing it — bag-agnostic.
    carriers: opts.candidates.map((r) => {
      const flagged = carrierCasFlagged(r.text, r.meta);
      const type = declaredType(r.meta);
      const staged = stageBodyToCas(r.text, { ext: r.ext, flagged, binary: r.binary ?? false, ...(type ? { type } : {}) });
      return {
        uri: r.uri, file: r.file, size: staged.size, diskHash: r.diskHash, syncedHash: r.syncedHash,
        ...(r.syncedRecordsHash !== undefined ? { syncedRecordsHash: r.syncedRecordsHash } : {}), ext: r.ext,
        ...(staged.staged ? { textCid: staged.cid } : { text: r.text }),
        ...(staged.skinny ? { skinny: true } : {}),
        ...(r.meta !== undefined ? { meta: r.meta } : {}),
      };
    }),
    ...(deletions.length > 0 ? { deletions: deletions.map((d) => ({ uri: d.uri, syncedHash: d.syncedHash })) } : {}),
    ...(opts.massDeleteFraction !== undefined ? { massDeleteFraction: opts.massDeleteFraction } : {}),
  };
  // --in-wiki: wrap the INGEST so it runs IN the active wiki island over its
  // composite (where working lives), mirroring `lares act --in-wiki`. The
  // default submits daemon-side for canon bags.
  const submitName = opts.inWiki ? "wiki-act" : "INGEST";
  const submitArgs = opts.inWiki ? { verb: "INGEST", args: actionArgs } : actionArgs;
  const requestId = await taskContentId({ subject: opts.toBag, command: submitName, args: submitArgs, nonce: "" });
  const timeoutMs = Math.max(10_000, 10_000 + (opts.candidates.length + deletions.length) * 400);
  return await runVerb(submitName, submitArgs, opts.did, { requestId, timeoutMs });
}
