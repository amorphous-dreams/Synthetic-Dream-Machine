/**
 * `lares vessel seed` — plant the disk holdings into the vessel's canon.
 *
 * THE WORD: seed lays every disk mirror back into the layer it mirrors; import carries a bundle onto this hearth's
 * faces by pet-name. Today the seed lays the checkout's canon (`bags/<slug>`) back into each canon bag; the face and
 * working mirrors under `projections/` cross by import (`carry.ts`) until the seed reads them too.
 *
 * ONE ROAD, DECIDED BY WHERE CANON STANDS. A holding whose canon source stands on disk (its dir under the canon source
 * the daemon resolves, `daemonBagsDir`, and no private plane: `projectionRoots(...).sourcedSlugs()`) takes the
 * diff-gated `ingest` gesture into its canon bag, after a CREATE that converges on the bag that stands (a bag that
 * resolves anywhere, the realm's system canon included, mints nothing). No name list picks the road: in the vessel
 * `LAR_BAGS=/workspace/bags`, so every holding the checkout carries rides it. A holding whose canon source stands
 * elsewhere takes no road, and the seed names it.
 *
 * A SEED NEVER WRITES A WIKI'S WORKING LAYER ITSELF. INGEST lands canon alone, through its three-way gate (disk, synced
 * base, canon render). The working overrides above the canon it changed weigh in the same act (`override-bases.ts`):
 * a stale copy retracts so the new canon shows through, a diverged one stands off at the shore under a key
 * (`lares shore` lists it). A working-only title never promotes, and a title gone from disk stands pending at the shore.
 * LOAD + MOVE stays the human promotion door; the seed never walks it.
 *
 * IDEMPOTENT (causal-island law): each run converges from whatever state it finds — a virgin Synced tree reads
 * everything NEW; a converged tree no-ops per holding.
 *
 *   lares vessel seed [--apply] [--yes]   — preview per holding by default (the ingest posture)
 */

import { readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { bagUri } from "@lararium/mesh";
import { daemonBagsDir, projectionRoots } from "@lararium/node";
import type { ParsedArgs } from "../parse-args.js";
import { emit } from "../render.js";
import { larBagsDir, larProjectionsDirOrNone, vesselDid } from "../env.js";
import { askShore, readShoreList } from "../shore-core.js";
import { cmdIngest, type IngestOverrides } from "./ingest.js";
import { cmdAct } from "./act.js";

export interface SeedHolding {
  readonly holding: string;               // "lares"
  readonly source: string;                // "<bags dir>/lares"
  readonly toBag: string;                 // "lar:///ha.ka.ba/bags/lares"
  readonly gesture: "ingest" | "skip";    // the road taken
  readonly exitCode: number;              // the gesture's verdict for this holding
  readonly reason?: string;               // why a holding took no road
  readonly overrides?: IngestOverrides;   // what the canon change did to the working overrides above it
}

/**
 * The holdings map — every dir under the BAGS DIR, discovered, never hardcoded.
 *
 * THE BAGS DIR SITES ON ITS OWN CAP (`larBagsDir`: `LAR_BAGS`, else `<corpus>/bags`), the same cap the daemon's
 * projection and the `ingest` and `act` gestures read. A vessel whose state and corpus rest on two mounts (the
 * container: `LAR_ROOT=/state`, `LAR_BAGS=/workspace/bags`) holds its bags apart from its root, so a seed that
 * joined `bags` onto the root read an empty map there and planted nothing.
 */
export function discoverHoldings(bagsDir: string): Array<{ holding: string; source: string; toBag: string }> {
  let names: string[] = [];
  try {
    // EVERY DIRECTORY UNDER bags/ IS A HOLDING. The kind-plane segment above already says these are bags,
    // so the entity name carries no marker of its own — and a filter demanding one matches nothing, returns
    // an empty roster, and seeds silently with a clean exit.
    names = readdirSync(bagsDir).filter((n) => !n.startsWith(".") && statSync(join(bagsDir, n)).isDirectory());
  } catch { return []; }
  return names.sort().map((holding) => ({
    holding,
    source: join(bagsDir, holding),
    // The disk dir `elyncia` names bag `bags/elyncia` — mint through bagUri so the seed
    // targets the bag the daemon registers.
    toBag: bagUri(holding),
  }));
}

/**
 * WHETHER A HOLDING'S CANON STANDS ON DISK, read from the bag's resolution: its source dir stands under the canon
 * source the daemon resolves, and the projection split by origin counts it sourced (a private plane never does).
 */
export function canonIsDisk(h: { holding: string; source: string }, canonBags: string = daemonBagsDir()): boolean {
  const roots = projectionRoots({ projectionRoot: larProjectionsDirOrNone() ?? canonBags, canonBags });
  return roots.sourcedSlugs().includes(h.holding) && resolve(h.source) === resolve(roots.bagRoot(h.holding));
}

/**
 * Feed ONE holding into its canon. A disk-sourced holding: CREATE (applied runs only; it converges on the bag that
 * stands), then the diff-gated INGEST. A preview sends the INGEST preview alone and mutates nothing.
 */
export async function seedHolding(
  args: ParsedArgs,
  h: { holding: string; source: string; toBag: string },
  diskSourced: boolean = canonIsDisk(h),
): Promise<SeedHolding> {
  if (!diskSourced) {
    return { ...h, gesture: "skip", exitCode: 0, reason: "its canon source stands off disk (not under the canon source the daemon reads, or a private plane): the seed feeds disk canon alone" };
  }
  if (args.flags["apply"]) {
    const createCode = await foldCreateOutput(args, () => cmdAct({
      command: "act",
      positional: ["CREATE"],
      options: { ...args.options, bag: h.toBag },
      flags: { ...args.flags, yes: true },
    }));
    if (createCode !== 0) return { ...h, gesture: "ingest", exitCode: createCode };
  }
  // New content SURFACES for the operator to grade: without `--yes` the ingest gate asks; `--yes` (the operator's
  // relayed approval) passes through.
  const sink: { overrides?: IngestOverrides } = {};
  const exitCode = await withIngestTicks(h.holding, () => cmdIngest({
    command: "ingest",
    positional: [],
    options: { ...args.options, source: h.source, to: h.toBag },
    flags: args.flags,
  }, sink));
  return { ...h, gesture: "ingest", exitCode, ...(sink.overrides ? { overrides: sink.overrides } : {}) };
}

/**
 * THE SHORE FLOOD, ANSWERED ONCE. A wave tombstones no carrier: a title gone from disk (a branch switch drops many)
 * stands pending at the shore. The seed counts what stands pending per bag it fed and prints the one batch answer per
 * bag, so a person answers once rather than carrier by carrier.
 */
export function pendingRemovalLines(pending: ReadonlyArray<Record<string, unknown>>, bags: readonly string[]): string[] {
  const counts = new Map<string, number>();
  for (const p of pending) {
    const bag = String(p["bagId"]);
    if (bags.includes(bag)) counts.set(bag, (counts.get(bag) ?? 0) + 1);
  }
  return [...counts].sort(([a], [b]) => (a < b ? -1 : 1)).map(([bag, n]) =>
    `seed: ${n} pending removal(s) in ${bag}: the files left disk and nothing tombstoned; answer once with \`lares shore remove --all --count ${n} --bag ${bag}\` (or \`restore --all --count ${n} --bag ${bag}\`)`);
}

/** How many override titles a report names before it counts the rest. */
export const SEED_OVERRIDE_NAMES = 8;

/** The CLI already uses performance.now() for process-local liveness budgets; seed durations share that monotonic clock. */
function elapsedText(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  return seconds >= 60 ? `${Math.floor(seconds / 60)}m${String(seconds % 60).padStart(2, "0")}s` : `${seconds}s`;
}

function countCarriers(dir: string): number {
  let count = 0;
  try {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      const stat = statSync(path);
      if (stat.isDirectory()) count += countCarriers(path);
      else if (stat.isFile() && !name.startsWith(".")) count++;
    }
  } catch { /* The ingest gesture reports source failures. */ }
  return count;
}

async function withIngestTicks(holding: string, run: () => Promise<number>): Promise<number> {
  const started = performance.now();
  const timer = setInterval(() => {
    console.log(`… ${holding}: settling · ${elapsedText(performance.now() - started)}`);
  }, 5000);
  try { return await run(); } finally { clearInterval(timer); }
}

async function foldCreateOutput(args: ParsedArgs, run: () => Promise<number>): Promise<number> {
  if (args.flags["verbose"]) return run();
  const lines: string[] = [];
  const log = console.log;
  console.log = (...values: unknown[]) => { lines.push(values.map(String).join(" ")); };
  try {
    const result = await run();
    const detail = lines.join(" · ").replace(/\s+/g, " ").trim();
    if (detail) log(`  CREATE ${detail}`);
    return result;
  } finally { console.log = log; }
}

export async function cmdSeed(args: ParsedArgs): Promise<number> {
  const bagsDir = larBagsDir();
  const holdings = discoverHoldings(bagsDir);
  if (holdings.length === 0) {
    emit(args, {
      ok: false,
      error: { code: "not-found", message: `no holdings under ${bagsDir}` },
      human: () => console.error(`lares vessel seed: no holdings under ${bagsDir}`),
    });
    return 3;
  }
  const ledger: SeedHolding[] = [];
  const started = performance.now();
  for (const h of holdings) {
    const carriers = countCarriers(h.source);
    console.log(`seed ${h.holding}: ${carriers} files…`);
    const holdingStarted = performance.now();
    const row = await seedHolding(args, h);
    ledger.push(row);
    if (row.gesture === "skip") { console.log(`- ${h.holding}: no road · ${row.reason}`); continue; }
    const retry = row.exitCode === 0 ? "retry safe" : "retry safe (diff-gated)";
    console.log(`${row.exitCode === 0 ? "✓" : "✗"} ${h.holding}: ${carriers} files · ${elapsedText(performance.now() - holdingStarted)} · ${retry}`);
  }
  const failed = ledger.filter((h) => h.exitCode !== 0);
  for (const h of failed) console.error(`  ${h.holding}: ${h.gesture} failed (exit ${h.exitCode})`);
  // THE OVERRIDES THE SEED'S CANON CHANGE MET: stale copies retracted, diverged ones stand off at the shore.
  const retracted = ledger.reduce((n, h) => n + (h.overrides?.retractedCount ?? 0), 0);
  const standing = ledger.flatMap((h) => (h.overrides?.standing ?? []).map((s) => `${h.holding}:${s.title}`));
  const standingCount = ledger.reduce((n, h) => n + (h.overrides?.standingCount ?? 0), 0);
  if (retracted > 0) console.log(`seed: ${retracted} stale working override(s) retracted; the new canon shows through`);
  if (standingCount > 0) {
    console.error(`  ⚠ ${standingCount} working override(s) shadow a canon record this seed changed: ${standing.slice(0, SEED_OVERRIDE_NAMES).join(", ")}${standingCount > SEED_OVERRIDE_NAMES ? `, … ${standingCount - SEED_OVERRIDE_NAMES} more` : ""}`);
    console.error("    `lares shore` lists each with its key: `lares shore take-working <title> --bag <bag> --key <key>` keeps it · `take-canon` retracts it · or leave it standing");
  }
  const fed = ledger.filter((h) => h.gesture !== "skip");
  if (args.flags["apply"] && fed.length > 0) {
    try {
      const did = await vesselDid();
      const listed = await readShoreList((a) => askShore(a, did), { op: "list" });
      if (listed.ok) for (const line of pendingRemovalLines(listed.pending, fed.map((h) => h.toBag))) console.log(line);
    } catch { /* the shore unread: the seed's own verdict stands; `lares shore` reads it */ }
  }
  console.log(`seed: ${fed.length - failed.length}/${fed.length} holdings${ledger.length > fed.length ? ` · ${ledger.length - fed.length} off disk` : ""} · ${elapsedText(performance.now() - started)}`);
  return failed.length === 0 ? 0 : 1;
}
