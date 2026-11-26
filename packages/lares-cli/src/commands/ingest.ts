/**
 * lares ingest — the disk→records gesture.
 *
 *   lares ingest --source <dir|file> --to <bagUri> [--apply] [--yes]
 *   lares ingest --watch --source <dir> --to <bagUri> [--apply] [--debounce ms]   (the same gesture, fired per settle: ./watch.ts)
 *
 * The gesture holds the disk grant and the Synced tree (the island holds
 * neither — readiness reads local on both sides of the shore):
 *   scan      walk source for `.mem` carriers; derive each uri by the address siting rule
 *   diff      disk-hash vs synced-hash per carrier (the cheap two legs)
 *   preview   (default) print NEW / UNCHANGED / CHANGED; submit nothing
 *   --apply   send NEW+CHANGED carriers with their hashes riding an INGEST
 *             verb; the island runs the full Confluence gate (its currentRenderHash
 *             = the third leg) and answers per-carrier decisions
 *
 * Meme: lar:///ha.ka.ba/lares/api/pono/working-procedures
 */

import { createInterface } from "readline/promises";
import { stdin, stdout } from "process";
import type { ParsedArgs } from "../parse-args.js";
import { emit, wantsJson, exitFor } from "../render.js";
import { summaryOutput } from "../verb-result.js";
import { OUTCOME_URI_PREFIX } from "@lararium/mesh/verb-tiddler";
import { larRoot, larBagsDir, larWikisDir, larProjectionsDirOrNone, vesselDid } from "../env.js";
import { openSyncedTree, scanSource, skipLines, fileToUriForSource, candidatesOf, settleIngest, ingestVerdict, type IngestSettlement } from "../ingest-core.js";
import { carrierNeedsTag, tagBlobs } from "../tag-blobs.js";
import { verbFailure } from "../verb-call.js";
import { askShore, askSettle, type SettleReading } from "../shore-core.js";
import { cmdWatch } from "./watch.js";

function printUsage(): void {
  console.log("usage: lares ingest --source <dir|file> --to <bagUri> [--apply] [--tag-blobs] [--in-wiki] [--yes]");
  console.log("       lares ingest --watch --source <dir> --to <bagUri> [--apply] [--debounce ms]");
  console.log("  --watch    fires the gesture on each settled wave instead of once (preview by default;");
  console.log("             --apply submits; --debounce sets the quiet window in ms);");
  console.log("  default    = preview (scan + two-leg diff, no submission);");
  console.log("  --tag-blobs writes the CAS opt-in flag (`.meta` sidecar / meme ahu meta) for the");
  console.log("             large un-flagged carriers that would fault during ingest; writes no records;");
  console.log("  --apply    sends NEW+CHANGED carriers through the island's INGEST gate;");
  console.log("  --in-wiki  runs the INGEST in the active wiki island (the path for the working");
  console.log("             write-layer ingest-back — a wikis/ source derives its URIs off that layer).");
}

/** The working copies that shadow a canon record this INGEST moved past the base each forked from (`override-bases.ts`). */
export interface FresherCanonReading {
  readonly working: string;
  readonly titles: readonly string[];
  readonly count: number;
}

/** Read the outcome's fresher-canon warning; absent where the wave moved no canon record under a working copy. */
export function readFresherCanon(summary: Readonly<Record<string, unknown>>): FresherCanonReading | undefined {
  const o = summary["fresherCanon"] as Record<string, unknown> | undefined;
  if (o === undefined || o === null || typeof o !== "object") return undefined;
  const titles = Array.isArray(o["titles"]) ? (o["titles"] as unknown[]).map(String) : [];
  return { working: String(o["working"] ?? ""), titles, count: typeof o["count"] === "number" ? (o["count"] as number) : titles.length };
}

/** What a caller (the lay) hears beside the exit: the fresher canon, and a wave whose wait ended, read back by its id. */
export interface IngestSink {
  fresher?: FresherCanonReading;
  outcome?: { readonly state: "committed" | "unknown"; readonly requestId: string };
}

/** What one run's settlement reads as: the envelope's verdict, its code, its exit and the headline a person reads. */
export interface IngestRunReading {
  readonly ok: boolean;
  readonly code?: string;
  readonly message?: string;
  readonly exit: number;
  readonly headline: string;
}

export function ingestRunReading(settled: IngestSettlement, o: { readonly candidates: number; readonly requestId: string; readonly kapaeFault: string | null }): IngestRunReading {
  const verdict = ingestVerdict(settled);
  const { refused, conflicts, pageError } = settled;
  const failed = verdict.failed || o.kapaeFault !== null;
  const stoodOff = !failed && conflicts.length > 0;
  const req = o.requestId.slice(0, 8);
  const headline = pageError !== undefined
    ? `INGEST ✗ ${refused.length} refusal(s) read, then a later wave failed; ${pageError.unread} carrier(s) stay unread (req ${req})`
    : stoodOff
    ? `INGEST ✗ ${conflicts.length} of ${o.candidates} carrier(s) stand in a conflict and landed nothing; the rest applied locally (req ${req})`
    : refused.length === 0
    ? `INGEST ✓ applied locally — ${o.candidates} carrier(s) submitted (req ${req})`
    : `INGEST ✗ ${refused.length} of ${o.candidates} carrier(s) refused; the rest applied locally (req ${req})`;
  // A LATER WAVE WHOSE WAIT ENDED READS ITS RECEIPT'S STATE, NEVER A FAILURE: committed or unknown, exit 6, ◐ with its id.
  if (pageError?.outcome !== undefined && refused.length === 0 && o.kapaeFault === null) {
    const id = pageError.requestId ?? "";
    return {
      ok: false, code: `outcome-${pageError.outcome}`, message: verdict.message ?? `a later wave reads ${pageError.outcome}`,
      exit: exitFor(`outcome-${pageError.outcome}`),
      headline: `INGEST ◐ ${settled.landed.size} carrier(s) landed; a later wave reads ${pageError.outcome} (req ${id}); ${pageError.unread} carrier(s) stay owed: read \`lares vessel request ${id}\`, then run the ingest again (diff-gated)`,
    };
  }
  if (failed) return { ok: false, code: "verb-error", message: verdict.message ?? o.kapaeFault ?? "INGEST refused", exit: exitFor("verb-error"), headline };
  if (stoodOff) return { ok: false, code: "conflict", message: "conflict", exit: exitFor("conflict"), headline };
  return { ok: true, exit: 0, headline };
}

export async function cmdIngest(args: ParsedArgs, sink?: IngestSink): Promise<number> {
  // `--watch` fires this gesture per settle. The watcher reads none of the one-shot flags, so each refuses by name
  // rather than riding a long-lived loop that ignores it.
  if (args.flags["watch"] === true) {
    const oneShot = [
      ...(args.flags["yes"] === true ? ["yes"] : []),
      ...(args.flags["tag-blobs"] === true ? ["tag-blobs"] : []),
      ...(args.flags["in-wiki"] === true ? ["in-wiki"] : []),
      ...(args.options["change-id"] !== undefined ? ["change-id"] : []),
    ];
    if (oneShot.length > 0) {
      console.error(`lares ingest --watch: ${oneShot.map((f) => `--${f}`).join(", ")} ride the one-shot ingest alone`);
      return 2;
    }
    return cmdWatch(args);
  }
  if (args.options["debounce"] !== undefined) {
    console.error("lares ingest: --debounce sets the watcher's quiet window and rides `--watch` alone");
    return 2;
  }
  const source = args.options["source"];
  const toBag  = args.options["to"];
  if (!source || !toBag) { printUsage(); return 2; }

  const root = larRoot();
  const tree = openSyncedTree();

  // scan — observations only, never a work queue
  const projections = larProjectionsDirOrNone();
  const dirs = { bags: larBagsDir(), wikis: larWikisDir(), ...(projections !== undefined ? { projections } : {}) };
  const scan = scanSource(root, source, toBag, tree, fileToUriForSource(root, source, dirs, tree));
  if (scan === null) {
    emit(args, { ok: false, error: { code: "usage", message: `source "${source}" does not resolve` }, human: () => console.error(`lares ingest: source "${source}" does not resolve`) });
    return exitFor("usage");
  }
  const { rows, skipped } = scan;
  // A scan that skipped every carrier is no success: say which mirror directories it derived against.
  if (rows.length === 0 && skipped.length > 0) {
    const message = `scanned 0 carriers; ${skipped.length} skipped. Derived against bags dir ${dirs.bags} and wikis dir ${dirs.wikis}; first skipped: ${skipped[0]!.file} (${skipped[0]!.why})`;
    emit(args, {
      ok: false,
      error: { code: "usage", message, hint: "the source must sit under the bags dir (LAR_BAGS) or wikis dir (LAR_WIKIS) as <holding>/<w.w.w>/…/<name>.<ext>" },
      human: () => { console.error(`lares ingest: ${message}`); },
    });
    return exitFor("usage");
  }
  const candidates = candidatesOf(rows);
  // R2 — a full scan discovers a moved carrier's gone source; it rides the wave as a
  // rename-deletion so the island re-links records (change-id preserved) and the
  // observation survives the move (see renameBaseAsksOf, the settle's base door).
  const renameDeletions = scan.renameDeletions ?? [];
  // THE KĀPAE THE SOURCE SPEAKS: each shadow file's title rides the wave, and the island raises a kāpae over
  // it in the target bag; a shadow file that proves no kāpae gets named and fails the run.
  const shadows = scan.shadows ?? [];
  const refusedShadows = scan.refusedShadows ?? [];

  // Carriers that would hit the ungated-large-inline wall during ingest, still
  // un-flagged — the readiness law reads off text the scan already holds.
  const wouldFault = rows.filter((r) => carrierNeedsTag(r));

  // ── --tag-blobs (write the CAS opt-in flag; submit nothing) ─────────────
  if (args.flags["tag-blobs"]) {
    const outcomes = tagBlobs(rows);
    const wrote = outcomes.filter((o) => o.wrote);
    emit(args, {
      ok: true,
      data: { toBag, scanned: rows.length, tagged: wrote.length, outcomes },
      human: () => {
        for (const o of outcomes) console.log(`  ${(o.wrote ? "TAGGED" : "REPORT").padEnd(8)} ${o.file}  (${o.kind}: ${o.detail})`);
        console.log(`\n  ${wrote.length} of ${outcomes.length} flag-ready carrier(s) tagged · the rest reported, canon untouched`);
      },
    });
    return 0;
  }

  // ── preview (the default posture) ──────────────────────────────────────
  if (!args.flags["apply"]) {
    emit(args, {
      ok: true,
      data: {
        toBag,
        scanned: rows.length,
        new: rows.filter((r) => r.status === "new").length,
        changed: rows.filter((r) => r.status === "changed").length,
        unchanged: rows.filter((r) => r.status === "unchanged").length,
        nonNfc: rows.filter((r) => r.status === "non-nfc").map((r) => r.uri),
        wouldFault: wouldFault.map((r) => r.uri),
        kapae: shadows,
        refusedShadows,
        skipped,
        rows: rows.filter((r) => r.status !== "unchanged").map((r) => ({ uri: r.uri, status: r.status })),
      },
      human: () => {
        for (const r of rows) console.log(`  ${r.status.toUpperCase().padEnd(10)} ${r.uri}`);
        for (const t of shadows) console.log(`  ${"KAPAE".padEnd(10)} ${t}`);
        for (const r of refusedShadows) console.error(`  ${"REFUSE".padEnd(10)} ${r.file} (${r.refusal})`);
        for (const line of skipLines(skipped)) console.log(`  ${line}`);
        console.log(`\n  ${rows.length} scanned · ${candidates.length} would submit · preview only (pass --apply)`);
        if (wouldFault.length > 0) console.log(`  ${wouldFault.length} large un-flagged file(s) would fault during ingest — run \`--tag-blobs\` to flag them.`);
      },
    });
    return 0;
  }

  if (candidates.length === 0 && shadows.length === 0) {
    emit(args, { ok: true, data: { toBag, scanned: rows.length, submitted: 0 }, human: () => console.log("nothing to ingest — all carriers match the Synced tree") });
    return 0;
  }

  // ── confirm (HUMAN path; agents carry --yes) ───────────────────────────
  if (!args.flags["yes"]) {
    if (wantsJson(args)) {
      emit(args, { ok: false, error: { code: "usage", message: "confirmation required", hint: "pass --yes for non-interactive (agent) invocation" }, human: () => { /* unreachable */ } });
      return exitFor("usage");
    }
    for (const r of candidates) console.log(`  ${r.status.toUpperCase().padEnd(8)} ${r.uri}`);
    for (const t of shadows) console.log(`  ${"KAPAE".padEnd(8)} ${t}`);
    const rl = createInterface({ input: stdin, output: stdout });
    const answer = await rl.question(`INGEST ${candidates.length} carriers${shadows.length > 0 ? ` and raise ${shadows.length} kāpae` : ""} into ${toBag}? [y/N] `);
    rl.close();
    if (!/^y(es)?$/i.test(answer.trim())) { console.log("aborted"); return 1; }
  }

  // ── submit — hashes travel WITH the content ────────────────────────────
  let did: string;
  try { did = await vesselDid(); } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    emit(args, { ok: false, error: { code: "not-found", message: msg }, human: () => console.error(`lares ingest: ${msg}`) });
    return exitFor("not-found");
  }
  // ── submit — one line over the daemon's sock (the lares↔lararium binding) ──
  // The settling gesture sends the wave, reads every row a person or the base needs (asking again in waves
  // under the outcome's row cap where the first answer left one behind), and pins what landed.
  let settled;
  try {
    settled = await settleIngest({
      source, toBag, candidates, did,
      inWiki: Boolean(args.flags["in-wiki"]),
      ...(renameDeletions.length > 0 ? { deletions: renameDeletions } : {}),
      ...(shadows.length > 0 ? { kapae: shadows } : {}),
      ...(args.options["change-id"] ? { changeId: args.options["change-id"] } : {}),
    }, tree);
  } catch (err) {
    // M3′: a LOCAL WAIT ENDING (`submitIngest`'s `runVerb` throws `LocalWaitExpired` exactly like
    // `act.ts`'s own submit) never folds into `daemon-unreachable`, which would tell an operator
    // whose write-door daemon stands to start a daemon already running. `verbFailure`
    // tells the fault apart by its own TYPE.
    const f = verbFailure(err);
    if (sink && f.requestId !== undefined && (f.code === "outcome-committed" || f.code === "outcome-unknown")) {
      sink.outcome = { state: f.code === "outcome-committed" ? "committed" : "unknown", requestId: f.requestId };
    }
    emit(args, {
      ok: false, ...(f.requestId !== undefined ? { requestId: f.requestId } : {}),
      error: { code: f.code, message: f.message, ...(f.hint !== undefined ? { hint: f.hint } : {}) },
      human: () => { console.error(`lares ingest: ${f.message}`); if (f.hint !== undefined) console.error(`  ${f.hint}`); },
    });
    return exitFor(f.code);
  }
  const result = settled.first;
  if (result.status === "error") {
    const msg = result.errorMessage ?? "unknown";
    const code = /^cap-denied/.test(msg) ? "cap-denied" : /conflict/i.test(msg) ? "conflict" : "verb-error";
    emit(args, { ok: false, requestId: result.requestId, error: { code, message: msg }, human: () => console.error(`INGEST failed: ${msg}`) });
    return exitFor(code);
  }
  const summary = summaryOutput(result) ?? {};
  const fresher = readFresherCanon(summary);
  if (sink && fresher) sink.fresher = fresher;
  if (sink && settled.pageError?.outcome !== undefined && settled.pageError.requestId !== undefined) {
    sink.outcome = { state: settled.pageError.outcome, requestId: settled.pageError.requestId };
  }

  // The gesture's bases landed through the island that took its waves (`settleIngest`, `shoreBaseDoor`); the projector pins
  // what it projects; both name the same key and the same base where they agree. An unchanged carrier then reads `unchanged`
  // on the next scan instead of re-landing.
  // R2 — a confirmed rename moved its base to the new location through the same door, with the history the source's base
  // vouched for, so the moved carrier reads `unchanged` next scan instead of re-landing.
  if (settled.bases !== undefined && settled.bases.differs > 0) {
    console.error(`  ${settled.bases.differs} base(s) pinned nothing: the island read each carrier's file and its own records, and they differ (a hand edit not yet in the records); its gate weighs each as it stands`);
  }
  if (settled.bases !== undefined && settled.bases.unread > 0) {
    console.error(`  ${settled.bases.unread} base(s) pinned nothing: the island could not read the file there (it left, or it rests where the island cannot read); the next scan asks again`);
  }
  if (settled.bases !== undefined && settled.bases.owed > 0) {
    console.error(`  ${settled.bases.owed} base(s) reached no owner (${settled.bases.why ?? "the island gave no answer"}): each such carrier reads as moved at the next scan, and its base asks again then`);
  }

  // THE SETTLE WORD. Each carrier whose records this gesture moved causes a projection; the gesture asks the
  // vessel to say when that projection has run, so the run ends where a scan that follows reads what the
  // projection left (`askSettle`). A wait that ends with no word says so and changes no exit: the records
  // landed either way. The word keeps waiting while pages keep settling; one that stalls leaves the carriers
  // still waiting as the bag's record, and `lares shore settle --bag <bag> --pending` resumes it.
  let settle: SettleReading | { readonly settled: false; readonly refusal: string; readonly why: string } | undefined;
  if (settled.rendered.length > 0) {
    try {
      settle = await askSettle((a) => askShore(a, did), toBag, settled.rendered, { record: true });
    } catch (err) {
      const f = verbFailure(err);
      settle = { settled: false, refusal: f.code, why: f.message };
    }
  }

  const auditUri = `${OUTCOME_URI_PREFIX}${result.requestId}`;
  // A REFUSED FILE ENDS THE RUN NON-ZERO, AND EVERY REFUSED FILE GETS NAMED WITH ITS REFUSAL, however many
  // rows the wave held. The landed carriers stay landed and pinned; the exit and the envelope say that the
  // run did not take everything it was handed.
  // A CONFLICT ENDS THE RUN NON-ZERO TOO, under its own exit class. The person named these files and the
  // gate landed nothing for a conflicting one, so an exit of zero would read as "your words landed". Each
  // one gets named with the two doors that settle it by key.
  const { refused, conflicts } = settled;
  const pageError = settled.pageError;
  const verdict = ingestVerdict(settled);
  // A SHADOW THAT RAISED NOTHING NEVER READS AS APPLIED: a file that proved no kāpae, or a title the island
  // refused to set aside, fails the run by name.
  const kapaeAnswer = (summary as { kapae?: { raised?: unknown; standing?: unknown; refused?: unknown } }).kapae;
  const kapaeRefused = Array.isArray(kapaeAnswer?.refused) ? (kapaeAnswer.refused as Array<Record<string, unknown>>) : [];
  const kapaeFault = refusedShadows.length > 0 || kapaeRefused.length > 0
    ? `INGEST set aside no title for ${refusedShadows.length + kapaeRefused.length} kāpae shadow(s): ${[...refusedShadows.map((r) => `${r.file} (${r.refusal})`), ...kapaeRefused.map((r) => `${String(r["uri"])} (${String(r["code"])})`)].join(", ")}`
    : null;
  const reading = ingestRunReading(settled, { candidates: candidates.length, requestId: result.requestId, kapaeFault });
  const refusedMessage = verdict.message ?? kapaeFault;
  const conflictMessage = `INGEST landed nothing for ${conflicts.length} of ${candidates.length} carrier(s) that stand in a conflict: ${conflicts.map((r) => r.uri).join(", ")}. \`lares shore\` names each standoff's key; settle one with \`lares shore take-disk <uri> --key <key>\` (the file's words) or \`lares shore take-records <uri> --key <key>\` (the records')`;
  const data = {
    verb: "INGEST", scanned: rows.length, submitted: candidates.length, ...summary,
    tallies: settled.tallies, refused, conflicts, derived: settled.derived,
    ...(settled.pages.length > 0 ? { pages: settled.pages.map((p) => p.requestId) } : {}),
    ...(settle !== undefined ? { settle } : {}),
    audit: auditUri,
  };
  emit(args, {
    ...(reading.ok
      ? { ok: true as const }
      : { ok: false as const, error: { code: reading.code ?? "verb-error", message: reading.code === "conflict" ? conflictMessage : reading.message ?? "INGEST refused" } }),
    requestId: result.requestId,
    data,
    human: () => {
      console.log(reading.headline);
      for (const [decision, n] of Object.entries(settled.tallies)) console.log(`  ${decision.toUpperCase().padEnd(10)} × ${n}`);
      for (const t of Array.isArray(kapaeAnswer?.raised) ? (kapaeAnswer.raised as unknown[]) : []) console.log(`  ${"KAPAE".padEnd(10)} ${String(t)}  (raised)`);
      for (const t of Array.isArray(kapaeAnswer?.standing) ? (kapaeAnswer.standing as unknown[]) : []) console.log(`  ${"KAPAE".padEnd(10)} ${String(t)}  (already set aside)`);
      if (kapaeFault !== null) console.error(`  ⚠ ${kapaeFault}`);
      // Under the row cap every row prints. Past it the landed rows ride the tally above, and each row
      // that asks for a hand, or a render whose rung warns, prints below with its reason.
      const asking = new Set([...refused, ...conflicts, ...settled.derived].map((r) => r.uri));
      for (const c of settled.named.values()) {
        if (asking.has(String(c["uri"]))) continue;
        const extra = c["reason"] ?? (Array.isArray(c["tombstoned"]) && (c["tombstoned"] as unknown[]).length ? `tombstoned ${(c["tombstoned"] as unknown[]).length}` : "");
        console.log(`  ${String(c["decision"]).toUpperCase().padEnd(10)} ${c["uri"]}${extra ? `  (${extra})` : ""}`);
      }
      // A render on a warning rung lands nothing and fails nothing: its line names the cure.
      for (const r of settled.derived) {
        console.log(`  ${r.decision.toUpperCase().padEnd(10)} ${r.uri}${r.file !== undefined ? `  (${r.file})` : ""}`);
        console.error(`    ⚠ ${r.why}`);
      }
      for (const r of [...refused, ...conflicts]) {
        console.error(`  ${r.decision.toUpperCase().padEnd(10)} ${r.uri}${r.file !== undefined ? `  (${r.file})` : ""}`);
        console.error(`    ⚠ ${r.why}`);
      }
      if (pageError !== undefined) console.error(`  ⚠ ${refusedMessage}`);
      if (settle !== undefined) {
        if (settle.settled && "shore" in settle && !settle.shore) {
          console.log("  no island of this vessel mounts a disk shore: no projection follows these records");
        } else if (settle.settled && "mirrored" in settle && !settle.mirrored) {
          console.log(`  no mirror holds ${toBag}: no projection follows these records`);
        } else if (settle.settled) {
          console.log(`  projection settled for ${settle.settledCount} carrier(s)${settle.elsewhereCount > 0 ? `; ${settle.elsewhereCount} project from a higher bag` : ""} · ${settle.pendingCount} pending · ${settle.stalledCount} stalled`);
          if ("supersededCount" in settle && settle.supersededCount > 0) console.error(`  ⚠ a later settle word took ${settle.supersededCount} carrier(s) over; this run claims no projection for them, and a scan now may read a file the projection still moves`);
        } else if ("stalled" in settle && settle.stalled) {
          console.log(`  projection settled for ${settle.settledCount} carrier(s) · ${settle.pendingCount} pending · ${settle.stalledCount} stalled`);
          console.error(`  ⚠ no page settled within the stall window; ${settle.pendingCount} carrier(s) still wait: \`lares shore settle --bag ${toBag} --pending\` resumes the word`);
        } else console.error(`  ⚠ the vessel did not say the projection settled (${settle.refusal}: ${settle.why}); a scan now may read a file the projection still moves`);
      }
      // The copy keeps shadowing canon (the recipe stack decides what shows); the word names it, nothing writes.
      if (fresher !== undefined) console.error(`  ⚠ canon is fresher than the working copy above it for ${fresher.count} title(s) in ${fresher.working}: ${fresher.titles.slice(0, 8).join(", ")}${fresher.count > 8 ? ", …" : ""} (remove a copy with the ordinary verbs to take the fresher canon)`);
      if (conflicts.length > 0) console.error(`  ⚠ settle a conflict under its key (\`lares shore\` names it): \`lares shore take-disk <uri> --key <key>\` lands the file's words · \`lares shore take-records <uri> --key <key>\` writes the records' render`);
      console.log(`\n  audit: ${auditUri}`);
    },
  });
  return reading.exit;
}
