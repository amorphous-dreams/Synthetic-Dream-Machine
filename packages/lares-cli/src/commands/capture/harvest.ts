/**
 * `lares sense pour` — the sovereign re-pave and its writeback leg; `lares sense capture` and
 * `lares sense sweep` — the source-stream capture doors.
 *
 * `pour --all` walks the whole tending movement: quiesce · baseline · drawers · bearing · projection ·
 * verify · resume, in that order, because each landing step reads what the one before it wrote.
 * `pour --writeback` runs the bearing leg alone — the lar-telemetry projection onto the drawers,
 * held as a placeholder (operator ruling 2026-10-31, Train Q) until the sensorium arc returns it.
 *
 * One surface, two actors: prose on a TTY, deterministic JSON off-TTY / under
 * --json (../../render.ts #actor-parity).
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, appendFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join } from "node:path";
import { TIMEOUT_CEIL_MS } from "@lararium/mempalace";
import { writebackWing, isoWholeSeconds } from "@lararium/sensorium";
import { larRoot, larHarvestDir, vesselDid } from "../../env.js";
import { wingFromDir } from "../../wing-law.js";
import { partitionEphemeral } from "../../ephemeral.js";
import { runVerb } from "../../verb-call.js";
import { readVerbOutcome } from "../../verb-result.js";
import { emit, exitFor, type LaresError } from "../../render.js";
import type { ParsedArgs } from "../../parse-args.js";

/** The re-pave's state home — `<state>/harvest`, XDG; LAR_ROOT-isolated for staged instances. The
 *  baseline series lands here under the wing. */
const HARVEST_DIR = larHarvestDir();

// --- the writeback leg (the daemon memory-shore) --------------------------
// The lar-telemetry projection onto a wing's drawers lives ONCE in @lararium/sensorium
// (telemetry-writeback) — this CLI leg and the daemon `lar-telemetry` verb both call it. It stands
// as a placeholder (operator ruling 2026-10-31, Train Q): an empty pass until the sensorium arc.

function runWriteback(args: ParsedArgs, wing: string): number {
  const limit = args.options["limit"] ? Number(args.options["limit"]) : 0;
  const r = writebackWing(wing, limit ? { limit } : {});
  emit(args, {
    ok: true,
    data: { wing, ...r, mode: "writeback" },
    human: () => {
      console.log(`lares sense pour --writeback → ${wing}`);
      console.log(`  drawers harvested: ${r.drawers}  (${r.framed} framed)`);
      console.log(`  metadata written:  ${r.applied}`);
      console.log(`  standings:         framed ${r.standings["framed"]} · structured ${r.standings["structured"]} · raw ${r.standings["raw"]}`);
    },
  });
  return 0;
}

// The bulk `--all` backfill + guest-comparator discovery/staging/mine now live in PYTHON
// (session_discovery.py + guest_harvest.py; the sovereign sweep in capture_session.py). The python
// guest lane owns discovery/stage/lock; `lares mempalace harvest` shells it, and `lares sense sweep`
// routes the sovereign lane through the daemon.

/** Recursively collect `.jsonl` files under a root whose basename passes `match`. */
function walkJsonl(root: string, match: (name: string) => boolean, depth = 0, out: string[] = []): string[] {
  if (depth > 8 || !existsSync(root)) return out;
  let ents;
  try { ents = readdirSync(root, { withFileTypes: true }); } catch { return out; }
  for (const e of ents) {
    const full = join(root, e.name);
    if (e.isDirectory()) walkJsonl(full, match, depth + 1, out);
    else if (e.name.endsWith(".jsonl") && match(e.name)) out.push(full);
  }
  return out;
}

// The default room every harvest/capture drawer lands in (the "convos mine"). `--room` joins the
// arg-surface for isomorphism with the MCP `harvest(..., room)` tool, but a NON-default value would
// change where a drawer lands — a byte-landing change this shape-pass never makes. So a non-default
// `--room` refuses honestly; the default lands drawers byte-for-byte in the default room. Absent →
// default; equal-to-default → proceed unchanged.
const DEFAULT_ROOM = "conversations";

/**
 * The one SOURCE identity for every capture ingress.
 *
 * A stage preserves the native filename. Its parent directory describes the
 * ingress actor and source scope; it never becomes memory identity. The Python
 * source-cap owns the final source key and CID derivation.
 */
const CAPTURE_SURFACES = ["claude", "codex", "copilot-cli", "copilot-vscode"] as const;
type CaptureSurface = typeof CAPTURE_SURFACES[number];

/** Derive the stable surface label from an existing staged name or its source path. */
function captureSurface(file: string): CaptureSurface {
  const staged = /(?:^|[/\\])(claude|codex|copilot-cli|copilot-vscode)(?:[/\\]|$)/.exec(file);
  if (staged?.[1]) return staged[1] as CaptureSurface;
  const normalized = file.replace(/\\/g, "/");
  if (normalized.includes("/.codex/sessions/")) return "codex";
  if (normalized.includes("/GitHub.copilot-chat/transcripts/")) return "copilot-vscode";
  if (normalized.includes("/.copilot/")) return "copilot-cli";
  return "claude";
}

/**
 * Stable capture provenance, shared by live hook staging and every backfill.
 * Exported for the ingress-law regression tests.
 */
export function captureSourceFile(wing: string, file: string): string {
  return `${wing}/${captureSurface(file)}__${basename(file)}`;
}

/** Guard `--room`: null when the room stays the default (proceed); an exit code when a non-default
 *  room refuses honestly (the override is not landed). */
function guardRoom(args: ParsedArgs, verb: string): number | null {
  const room = args.options["room"];
  if (room === undefined || room === DEFAULT_ROOM) return null;
  const msg = `--room override ("${room}") is not landed; ${verb} lands in the default room "${DEFAULT_ROOM}" only`;
  emit(args, {
    ok: false,
    error: { code: "verb-error", message: msg, hint: `Drop --room (or pass --room ${DEFAULT_ROOM}) to harvest into the default room.` },
    human: () => console.error(`lares ${verb}: ${msg}`),
  });
  return exitFor("verb-error");
}

/**
 * The sovereign re-pave — the three legs of filling a sensorium, in dependency order.
 *
 * DRAWERS land the verbatim content. The BEARING writeback reads those drawers and stamps the
 * navigational gradient onto them. The PROJECTION re-derives the lexical and entity view over the
 * content plane. The second reads what the first wrote, so the sequence is a dependency: a writeback
 * across drawers that have not landed reports zero harvested and exits clean.
 */
export type RepaveStageName =
  | "quiesce" | "baseline" | "drawers" | "bearing" | "projection" | "verify" | "resume";

export interface RepaveStage {
  readonly name: RepaveStageName;
  /** What this stage does — the line a person reads while a long pass runs. */
  readonly why: string;
}

/**
 * The tending rite's movement, as a sequence a door can run.
 *
 * The rite states this order and names each spelling a CLAIM to check; running it here turns the
 * claims into a pass or a friction at the step that stalls. Three of the seven stages exist because
 * a re-pave that skips them cannot be trusted afterwards rather than because they land anything:
 *
 *   QUIESCE  a bulk pass racing the live capture hook produces a corpus no re-run reproduces.
 *   BASELINE one clean before/after boundary exists per re-pave, and it opens exactly once. A
 *            reading taken after the fact needs a second whole pass and still has nothing to compare.
 *   VERIFY   counts against source counts, before any instrument reads the result.
 *
 * RESUME closes what QUIESCE opened, on every path out — a re-pave that halted holding the hooks
 * down leaves live capture silently off, which reads as a quiet machine rather than a fault.
 */
export function repaveStages(): readonly RepaveStage[] {
  return [
    { name: "quiesce",    why: "live capture paused — a bulk pass racing the hook is not reproducible" },
    { name: "baseline",   why: "the before-reading, taken while it can still be taken" },
    { name: "drawers",    why: "every transcript on every surface, landed verbatim into the content plane" },
    { name: "bearing",    why: "the lar-telemetry projection onto the drawers that just landed (a placeholder until the sensorium arc)" },
    { name: "projection", why: "the lexical and entity view, re-derived over the content plane" },
    { name: "verify",     why: "the landed counts read against the sources they came from" },
    { name: "resume",     why: "live capture handed back" },
  ];
}

/** How a finished re-pave reads: what it did, whether it may be trusted, and what to do about it. */
export interface RepaveVerdict {
  readonly ok:    boolean;
  readonly state: "landed" | "empty" | "barren" | "shrank";
  readonly why:   string;
}

/**
 * Read the verdict off the counts, never off the exit codes.
 *
 * EVERY LEG CAN RETURN 0 OVER AN EMPTY SENSORIUM. A sweep that discovered no sources exits clean, a
 * bearing pass over zero drawers stamps nothing and succeeds, and a projection re-derived from an
 * empty plane is honestly empty. So a green run proves the legs ran, not that anything landed — and
 * an instrument answering over an unfed plane reads exactly like one answering over a broken door.
 *
 * The distinction that matters is SOURCES: with none, an empty palace is the honest state of a fresh
 * machine; with a thousand, it is work that silently did not happen.
 */
export function repaveVerdict(counts: {
  readonly sources: number; readonly before: number; readonly after: number;
}): RepaveVerdict {
  const { sources, before, after } = counts;
  const n = (x: number): string => x.toLocaleString("en-US");
  if (after < before) {
    return { ok: false, state: "shrank",
             why: `the palace holds ${n(after)} drawers where it held ${n(before)} — a re-pave that shrinks the corpus `
                + `has lost what the ${n(sources)} source(s) still carry; the archive is where to compare` };
  }
  if (sources === 0) {
    return { ok: true, state: "empty",
             why: "no transcript sources stand on this machine — an empty sensorium is the honest reading, not a fault" };
  }
  if (after === 0) {
    return { ok: false, state: "barren",
             why: `${n(sources)} source(s) stand and no drawer landed — every leg exited clean over an empty palace; `
                + "check the holder (`lares sense recall <word>`) before trusting any instrument here" };
  }
  return { ok: true, state: "landed",
           why: `${n(after)} drawers over ${n(sources)} source(s)`
              + (after === before ? " — nothing new landed, which is the idempotent re-run working" : ` (up from ${n(before)})`) };
}

/**
 * The wing a re-pave fills, from the ONE law.
 *
 * `wingFromDir` is that law, and the hook already reaches it through `lares wing-of`. A second
 * derivation sends a bulk pass to a wing the per-transcript pass never writes, so a recall over
 * either name reads half a corpus while both verbs report success.
 */
export function repaveWing(args: ParsedArgs): string {
  const named = args.options["wing"];
  return typeof named === "string" && named.length > 0 ? named : wingFromDir(larRoot());
}

/** One leg's outcome. */
export interface RepaveLeg { readonly name: string; readonly code: number }

/**
 * Run every leg in order, halting at the first refusal.
 *
 * The runner is a parameter so the ORDER can be witnessed without walking the operator's corpus —
 * the contract worth holding is the sequence and the halt, not the landing.
 */
export async function runRepave(
  args: ParsedArgs,
  run: (stage: RepaveStage["name"], args: ParsedArgs) => Promise<number> = runRepaveLeg,
): Promise<{ stages: RepaveLeg[]; code: number }> {
  const wing = repaveWing(args);
  // ONE WING REACHES EVERY LEG. Threaded here rather than defaulted per-leg, which is how the two
  // fill-verbs came to disagree.
  const threaded: ParsedArgs = { ...args, options: { ...args.options, wing } };
  const stages: RepaveLeg[] = [];
  let halted = 0;
  for (const stage of repaveStages()) {
    // RESUME RUNS ON EVERY PATH OUT. Skipping it after a halt would leave the operator's live capture
    // paused with nothing on screen saying so — a machine that has quietly stopped remembering.
    if (halted !== 0 && stage.name !== "resume") continue;
    const code = await run(stage.name, threaded);
    stages.push({ name: stage.name, code });
    if (code !== 0 && halted === 0) halted = code;
  }
  return { stages, code: halted };
}

/** The legs as the door actually runs them — each at the verb that owns it. */
async function runRepaveLeg(stage: RepaveStageName, args: ParsedArgs): Promise<number> {
  switch (stage) {
    case "quiesce": return await runHooks("pause");
    case "baseline": return await readBaseline(args, "before");
    case "drawers":
      return await cmdSweep({ ...args, options: { ...args.options, surface: args.options["surface"] ?? "all" } });
    case "bearing": return runWriteback(args, repaveWing(args));
    case "projection": {
      const { cmdRefresh } = await import("../refresh.js");
      return await cmdRefresh({ ...args, positional: [] });
    }
    case "verify": return await runVerify(args);
    case "resume": return await runHooks("resume");
  }
}

/**
 * The rite's verify step — the landed counts read against the sources they came from.
 *
 * It reads the CONTENT plane, because drawers are what every instrument
 * downstream answers over. The before-count comes from the baseline this pass already took, so the
 * comparison is against this run rather than against a remembered number.
 */
async function runVerify(args: ParsedArgs): Promise<number> {
  const wing = repaveWing(args);
  const before = readBaselineRow(wing, "before");
  const after = await countDrawers();
  const sources = countSources();

  const v = repaveVerdict({ sources, before, after });
  appendBaseline(wing, { when: "after", drawers: after, sources, state: v.state });
  console.log(`  verify     ${v.state}: ${v.why}`);
  return v.ok ? 0 : 6;
}

/** Every AI transcript this machine holds — the denominator the verdict reads against. */
function countSources(): number {
  const roots = [join(homedir(), ".claude", "projects"), join(homedir(), ".codex"), join(homedir(), ".copilot")];
  let n = 0;
  for (const root of roots) { try { n += walkJsonl(root, () => true).length; } catch { /* absent is zero */ } }
  return n;
}

/** Hold or hand back the capture hooks, through the lever that owns the marker. */
async function runHooks(verb: "pause" | "resume"): Promise<number> {
  const { cmdHooks } = await import("../hooks.js");
  return await cmdHooks({ positional: [verb], flags: {}, options: {} } as unknown as ParsedArgs);
}

/**
 * A reading of the sensorium as it stands, kept beside the pass that changed it.
 *
 * The comparison is the whole point: a count means little alone and a great deal against the count
 * before it. Both readings land in the harvest state home under the wing, so the series survives the
 * pass that produced it.
 */
async function readBaseline(args: ParsedArgs, when: "before" | "after"): Promise<number> {
  const wing = repaveWing(args);
  try {
    const drawers = await countDrawers();
    appendBaseline(wing, { when, drawers, sources: countSources() });
    console.log(`  baseline   ${when}: ${drawers} drawer(s)`);
    return 0;
  } catch (e) {
    // A BASELINE THAT CANNOT BE WRITTEN MUST NOT PASS QUIETLY. It is the one reading no later pass
    // can recover, so its absence is the failure rather than a missing convenience.
    console.error(`  baseline   ${when}: could not be taken — ${e instanceof Error ? e.message : String(e)}`);
    return 5;
  }
}

/** The kept comparison series — both readings of a pass, in the re-pave's state home. */
function appendBaseline(wing: string, row: Record<string, unknown>): void {
  mkdirSync(HARVEST_DIR, { recursive: true });
  appendFileSync(join(HARVEST_DIR, `${wing}.baseline.ndjson`),
                 JSON.stringify({ wing, ...row, at: isoWholeSeconds(new Date().toISOString()) }) + "\n", "utf8");
}

/** This pass's own before-reading — the comparison is against this run, never a remembered number. */
function readBaselineRow(wing: string, when: "before" | "after"): number {
  try {
    const rows = readFileSync(join(HARVEST_DIR, `${wing}.baseline.ndjson`), "utf8")
      .split("\n").filter(Boolean).map((l) => JSON.parse(l) as Record<string, unknown>);
    for (let i = rows.length - 1; i >= 0; i--) {
      if (rows[i]?.["when"] === when) { const d = rows[i]?.["drawers"]; return typeof d === "number" ? d : 0; }
    }
  } catch { /* no series yet reads as a fresh start */ }
  return 0;
}

/**
 * The drawers the content plane holds, asked of the daemon that owns it.
 *
 * Zero on an unreachable daemon, which the verdict reads as an honest absence rather than a claim —
 * a count nobody could take is not a count of nothing.
 */
async function countDrawers(): Promise<number> {
  try {
    let did = ""; try { did = await vesselDid(); } catch { /* the read still routes */ }
    const out = readVerbOutcome(await runVerb("status", {}, did, { timeoutMs: 120_000 })).output;
    const total = out["total"] ?? (out["result"] as Record<string, unknown> | undefined)?.["total"];
    return typeof total === "number" ? total : 0;
  } catch { return 0; }
}

export async function cmdPour(args: ParsedArgs): Promise<number> {
  const roomGuard = guardRoom(args, "pour");
  if (roomGuard !== null) return roomGuard;

  // `--all` IS THE WHOLE MOTION: the legs a sensorium needs filled — drawers, bearing, projection —
  // in the order the second's dependency on the first sets.
  if (args.flags["all"] === true) {
    const r = await runRepave(args);
    emit(args, {
      ok: r.code === 0,
      ...(r.code === 0 ? {} : { error: { code: "repave-halted", message: `the ${r.stages.at(-1)?.name} leg refused`,
                                         hint: "the legs stand alone: `lares sense sweep`, `lares sense pour --writeback`, `lares sense refresh`" } }),
      data: { mode: "repave", wing: repaveWing(args), stages: r.stages },
      human: () => {
        for (const s of r.stages) console.log(`  ${s.name.padEnd(11)} ${s.code === 0 ? "landed" : `refused (${s.code})`}`);
      },
    });
    return r.code;
  }

  // --writeback: the bearing leg alone, over the mempalace DRAWERS.
  if (args.flags["writeback"] === true) {
    const wing = args.options["wing"] ?? wingFromDir(larRoot());
    return runWriteback(args, wing);
  }

  const error: LaresError = {
    code: "usage",
    message: "pour walks the re-pave (`--all`) or its writeback leg (`--writeback`)",
    hint: "lares sense pour --all · lares sense pour --writeback [--wing <wing>] · one transcript: lares sense capture <path> --wing <wing>",
  };
  emit(args, { ok: false, error, human: () => console.error(`lares sense pour: ${error.message}\n  ${error.hint}`) });
  return 2;
}

/**
 * `lares sense capture <transcript|stageDir> --wing <wing>` — request Python source-stream capture.
 *
 * The CLI and daemon carry source identity only: `{ surface, pointer, wing, room, sessionId? }`.  Python reads
 * the native transcript, derives stable CIDs, and upserts the sovereign content plane.  Re-running
 * the same pointer re-derives its ledger and lands only the new tail; the TypeScript layer neither
 * reads exchanges for capture nor holds a capture WAL.
 */
/** `lares sense sweep` — the BULK backfill, routed to the ONE daemon `sweep` op: the holder discovers every
 *  transcript and captures each on its warm stream (no per-session round-trips, no second writer). The
 *  isomorphic twin of the MCP `sweep` tool — CLI + MCP land on the SAME spine. `--surface all|claude|codex|
 *  copilot` (default all) · `--wing` (default wing_<user>) · `--project` (narrows claude) · `--limit`.
 *  Idempotent — a re-run catches up, a fresh sensorium fills fully. */
export async function cmdSweep(args: ParsedArgs): Promise<number> {
  const surface = typeof args.options["surface"] === "string" ? (args.options["surface"] as string) : "all";
  // ONE WING LAW. `wingFromDir` decides it everywhere — the hook reaches it through `lares wing-of`,
  // the bearing leg calls it directly. A second derivation here sent this leg to a name the
  // per-transcript leg never wrote, so an unflagged fill split one corpus across two wings.
  const wing = repaveWing(args);
  const sensoriumRoot = typeof args.options["sensorium-root"] === "string" ? (args.options["sensorium-root"] as string) : undefined;
  const project = typeof args.options["project"] === "string" ? (args.options["project"] as string) : undefined;
  const limitRaw = typeof args.options["limit"] === "string" ? Number(args.options["limit"]) : undefined;
  const limit = limitRaw !== undefined && !Number.isNaN(limitRaw) ? limitRaw : undefined;
  let did = "";
  try { did = await vesselDid(); } catch { /* un-gated verb; runVerb still reaches the daemon */ }
  const r = await runVerb("sweep", {
    surface, wing,
    ...(project ? { project } : {}),
    ...(limit !== undefined ? { limit } : {}),
    ...(sensoriumRoot ? { sensoriumRoot } : {}),
  }, did, { timeoutMs: TIMEOUT_CEIL_MS });
  // THE OUTCOME CARRIES ITS OWN VERDICT. The bulk spine returns a tally — sessions, landed, skipped,
  // by_surface — and a refusal returns none of it. Reading the envelope alone rendered `{}` over both,
  // so a pass the daemon cut short printed exactly like one that found nothing left to land.
  const outcome = readVerbOutcome(r);
  const tally = (k: string): number => (typeof outcome.output[k] === "number" ? outcome.output[k] as number : 0);
  const landed = tally("landed"), skipped = tally("skipped"), sessions = tally("sessions");
  emit(args, {
    ok: outcome.ok,
    ...(outcome.ok ? {} : { error: { code: "verb-error", message: outcome.error ?? "the sweep refused",
                                     hint: "a long backfill outruns the daemon's adaptive budget — narrow it with `--limit` or `--surface`, and re-run: the sweep is idempotent." } }),
    data: { surface, wing, landed, skipped, sessions, output: outcome.output },
    human: () => {
      if (!outcome.ok) { console.error(`lares sense sweep: ${outcome.error}`); return; }
      console.log(`[sweep] ${sessions} session(s) → ${landed} landed · ${skipped} re-derived (${surface}, wing ${wing})`);
    },
  });
  return outcome.ok ? 0 : exitFor("verb-error");
}

export async function cmdCapture(args: ParsedArgs): Promise<number> {
  const roomGuard = guardRoom(args, "capture");
  if (roomGuard !== null) return roomGuard;

  const target = args.positional[0] ?? "";
  const wing   = typeof args.options["wing"] === "string" ? args.options["wing"] : "";
  // A `lares sense <sensorium> capture …` address threads the target sensorium root (absent → memory).
  const sensoriumRoot = typeof args.options["sensorium-root"] === "string" ? args.options["sensorium-root"] : undefined;
  if (!target || !wing) {
    emit(args, {
      ok: false,
      error: { code: "usage", message: "usage: lares sense capture <transcript|stageDir> --wing <wing>" },
      human: () => console.error("usage: lares sense capture <transcript|stageDir> --wing <wing>"),
    });
    return 2;
  }

  // Collect .jsonl (a dir → its jsonl children; a file → itself).
  let files: string[] = [];
  try {
    const st = statSync(target);
    files = st.isDirectory()
      ? walkJsonl(target, () => true)
      : [target];
  } catch { files = []; }
  if (!files.length) {
    emit(args, { ok: true, data: { wing, submitted: 0 }, human: () => console.log(`[capture] no .jsonl under ${target}`) });
    return 0;
  }
  // THE EPHEMERAL GATE (the capture leg): a marked session's turns never submit to the palace
  // nalu. Reads the transcript's own CONTENT (its recorded cwd), so a staged hardlink/copy carries
  // the same verdict as the original. One loud line per skip; the transcript stays on disk.
  const { live: liveFiles, skipped: ephemeralSkips } = partitionEphemeral(files, "capture");
  files = liveFiles;
  if (!files.length) {
    emit(args, {
      ok: true,
      data: { wing, submitted: 0, ephemeralSkipped: ephemeralSkips },
      human: () => console.log(`[capture] all ${ephemeralSkips.length} transcript(s) EPHEMERAL — nothing submitted (wing ${wing})`),
    });
    return 0;
  }

  let did = "";
  try { did = await vesselDid(); } catch { /* the daemon still owns the routing boundary */ }
  const sessionId = typeof args.options["session-id"] === "string" ? args.options["session-id"] : undefined;
  const passes: Array<Record<string, unknown>> = [];
  const failures: Array<{ pointer: string; error: string }> = [];
  for (const pointer of files) {
    const detected = captureSurface(pointer);
    const surface = detected === "copilot-cli" ? "copilot" : detected;
    try {
      // The CALLER'S patience = the servo CEIL, so the CLI never cliffs before the daemon's adaptive
      // (gradient) budget resolves — a big session lands honestly; a real hang still dies within CEIL.
      const r = await runVerb("capture", { surface, pointer, wing, room: DEFAULT_ROOM, ...(surface === "copilot" && sessionId ? { sessionId } : {}), ...(sensoriumRoot ? { sensoriumRoot } : {}) }, did, { timeoutMs: TIMEOUT_CEIL_MS });
      // A capture that the daemon refused belongs with the failures, never among the passes with an
      // empty tally — the per-pointer loop is exactly where a swallowed refusal hides in a count.
      const outcome = readVerbOutcome(r);
      if (!outcome.ok) { failures.push({ pointer, error: outcome.error ?? "the capture refused" }); continue; }
      passes.push({ pointer, ...outcome.output });
    } catch (err) {
      failures.push({ pointer, error: err instanceof Error ? err.message : String(err) });
    }
  }
  const landed = passes.reduce((n, p) => n + (typeof p["landed"] === "number" ? p["landed"] : 0), 0);
  const skipped = passes.reduce((n, p) => n + (typeof p["skipped"] === "number" ? p["skipped"] : 0), 0);
  emit(args, {
    ok: failures.length === 0,
    ...(failures.length ? { error: { code: "capture-failed", message: `${failures.length} source stream(s) failed`, hint: "The source remains durable; re-run after the daemon reports healthy." } } : {}),
    data: { wing, sources: passes.length, landed, skipped, passes, failures, ...(ephemeralSkips.length ? { ephemeralSkipped: ephemeralSkips } : {}) },
    human: () => console.log(`[capture] ${passes.length} Python source stream(s) → ${landed} landed · ${skipped} re-derived (wing ${wing})${failures.length ? ` · ${failures.length} failed` : ""}`),
  });
  return failures.length ? 1 : 0;
}
