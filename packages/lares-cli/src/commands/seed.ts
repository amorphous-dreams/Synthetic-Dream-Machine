/**
 * `lares vessel seed` — plant the disk holdings into the vessel's canon.
 *
 * THE WORD: seed lays every disk mirror back into the layer it mirrors; import carries a bundle onto this hearth's
 * faces by pet-name. Two legs: the HOLDINGS leg lays the checkout's canon (`bags/<slug>`) back into each canon bag, and
 * then the MIRRORS leg (`seed-mirrors.ts`) lays every mirror under the projections root back into its one layer (face
 * working and canon, house bags, other wikis' working), adopts a former face's folders by pet-name after a
 * re-founding, previews the kahua items it would lift and lifts them on the operator's confirmed count alone, and moves
 * an adopted face's folders to ashes once nothing stands pending.
 *
 * ONE ROAD, DECIDED BY WHERE CANON STANDS. A holding whose canon source stands on disk (its dir under the canon source
 * the daemon resolves, `daemonBagsDir`, and no private plane: `projectionRoots(...).sourcedSlugs()`) takes the
 * diff-gated `ingest` gesture into its canon bag, after a CREATE that converges on the bag that stands (a bag that
 * resolves anywhere, the realm's system canon included, mints nothing). No name list picks the road: in the vessel
 * `LAR_BAGS=/workspace/bags`, so every holding the checkout carries rides it. A holding whose canon source stands
 * elsewhere takes no road, and the seed names it.
 *
 * A SEED NEVER WRITES A WIKI'S WORKING LAYER. INGEST lands canon alone, through its three-way gate (disk, synced base,
 * canon render), and the recipe stack decides what shows: a working copy keeps shadowing the canon under it. Where the
 * seed moved canon past the text a copy forked from, it warns per title that canon stands fresher (`override-bases.ts`)
 * and writes nothing. A working-only title never promotes, and a title gone from disk stands pending at the shore.
 * LOAD + MOVE stays the human promotion door; the seed never walks it.
 *
 * IDEMPOTENT (causal-island law): each run converges from whatever state it finds — a virgin Synced tree reads
 * everything NEW; a converged tree no-ops per holding.
 *
 *   lares vessel seed [--apply] [--yes] [--lift-kahua <N>]   — preview per holding by default (the ingest posture);
 *                                          a bare --yes lifts nothing in kahua: a typed count on a TTY, or --lift-kahua N
 */

import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import type { ParsedArgs } from "../parse-args.js";
import { emit } from "../render.js";
import { larBagsDir, vesselDid } from "../env.js";
import { askShore, readShoreList } from "../shore-core.js";
import { cmdIngest, type FresherCanonReading } from "./ingest.js";
import { cmdAct } from "./act.js";
import { createInterface } from "node:readline/promises";
import { seedMirrors, mirrorLines, mirrorsLeftWork, kahuaConfirmPrompt, MirrorRefused, LIVE_MIRROR_DOORS, type MirrorDoors, type KahuaPreviewItem } from "../seed-mirrors.js";

export interface SeedHolding {
  readonly holding: string;               // "lares"
  readonly source: string;                // "<bags dir>/lares"
  readonly toBag: string;                 // "lar:///ha.ka.ba/bags/lares"
  readonly gesture: "ingest" | "skip";    // the road taken
  readonly exitCode: number;              // the gesture's verdict for this holding
  readonly reason?: string;               // why a holding took no road
  readonly fresher?: FresherCanonReading; // working copies that shadow a canon text this seed moved past their base
}

export { discoverHoldings, canonIsDisk } from "../holdings.js";
import { canonIsDisk, discoverHoldings } from "../holdings.js";

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
  const sink: { fresher?: FresherCanonReading } = {};
  const exitCode = await withIngestTicks(h.holding, () => cmdIngest({
    command: "ingest",
    positional: [],
    options: { ...args.options, source: h.source, to: h.toBag },
    flags: args.flags,
  }, sink));
  return { ...h, gesture: "ingest", exitCode, ...(sink.fresher ? { fresher: sink.fresher } : {}) };
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

/** How many fresher-canon titles a report names before it counts the rest. */
export const SEED_FRESHER_NAMES = 8;

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

/** `--lift-kahua <N>` read as a whole count, or null where absent; a malformed count refuses by name. */
export function liftKahuaCount(args: ParsedArgs): number | null {
  const raw = args.options["lift-kahua"];
  if (raw === undefined) return null;
  if (!/^(?:0|[1-9][0-9]*)$/.test(raw)) throw new MirrorRefused("seed-kahua-count", `--lift-kahua names the whole count the preview shows; "${raw}" names none`);
  return Number(raw);
}

/** A person at a TTY reads the preview and types the count; anywhere else no hand confirms. */
export function ttyKahuaConfirm(args: ParsedArgs): ((count: number, preview: readonly KahuaPreviewItem[]) => Promise<boolean>) | undefined {
  if (args.flags["json"] === true || !process.stdin.isTTY || !process.stdout.isTTY) return undefined;
  return async (count) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    try { return (await rl.question(kahuaConfirmPrompt(count))).trim() === String(count); } finally { rl.close(); }
  };
}

/** Run the mirror leg and print it; its exit code (0 clean, 1 a refusal or something standing for a hand). */
export async function runMirrorLeg(args: ParsedArgs, doors: MirrorDoors, opts: { kahuaOnly?: boolean } = {}): Promise<number> {
  try {
    const result = await seedMirrors({
      apply: args.flags["apply"] === true, doors, liftKahua: liftKahuaCount(args),
      ...(ttyKahuaConfirm(args) ? { confirmKahua: ttyKahuaConfirm(args)! } : {}), ...(opts.kahuaOnly ? { kahuaOnly: true } : {}),
    });
    const { out, err } = mirrorLines(result);
    for (const l of out) console.log(l);
    for (const l of err) console.error(l);
    return mirrorsLeftWork(result) ? 1 : 0;
  } catch (e) {
    if (e instanceof MirrorRefused) { console.error(`lares vessel seed: ${e.message}`); return 1; }
    throw e;
  }
}

export async function cmdSeed(args: ParsedArgs, mirrorDoors: MirrorDoors = LIVE_MIRROR_DOORS): Promise<number> {
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
  // THE FRESHER CANON: working copies keep shadowing the canon this seed moved; the word names them, nothing writes.
  const fresher = ledger.flatMap((h) => (h.fresher?.titles ?? []).map((t) => `${h.holding}:${t}`));
  const fresherCount = ledger.reduce((n, h) => n + (h.fresher?.count ?? 0), 0);
  if (fresherCount > 0) {
    console.error(`  ⚠ canon is fresher than the working copy above it for ${fresherCount} title(s): ${fresher.slice(0, SEED_FRESHER_NAMES).join(", ")}${fresherCount > SEED_FRESHER_NAMES ? `, … ${fresherCount - SEED_FRESHER_NAMES} more` : ""}`);
    console.error("    each copy still shadows canon; the daemon's fresher-canon read lists them all, and a person removes a copy with the ordinary verbs to take the fresher canon");
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
  // THE MIRRORS LEG, after canon stands: every mirror under the projections root back into its one layer.
  const mirrors = await runMirrorLeg(args, mirrorDoors);
  return failed.length === 0 && mirrors === 0 ? 0 : 1;
}
