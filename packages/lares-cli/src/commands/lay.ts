/**
 * `lares vessel lay` — lay the disk holdings into the vessel's canon.
 *
 * THE WORD: `lay` lays every disk mirror back into the layer it mirrors; import carries a bundle onto this hearth's
 * faces by pet-name. Two legs: the HOLDINGS leg lays the checkout's canon (`bags/<slug>`) back into each canon bag, and
 * then the MIRRORS leg (`seed-mirrors.ts`) lays every mirror under the projections root back into its one layer (face
 * working and canon from each face root `faces/<pet name>/`, which a re-founding keeps where it stands; house bags; other
 * wikis' working), previews the kahua items it would lift and lifts them on the operator's confirmed count alone.
 *
 * ONE ROAD, DECIDED BY WHERE CANON STANDS. A holding whose canon source stands on disk (its dir under the canon source
 * the daemon resolves, `daemonBagsDir`, and no private plane: `projectionRoots(...).sourcedSlugs()`) takes the
 * diff-gated `ingest` gesture into its canon bag, after a CREATE that converges on the bag that stands (a bag that
 * resolves anywhere, the realm's house canon included, mints nothing). No name list picks the road: in the vessel
 * `LAR_BAGS=/workspace/bags`, so every holding the checkout carries rides it. A holding whose canon source stands
 * elsewhere takes no road, and the lay names it.
 *
 * A LAY NEVER WRITES A WIKI'S WORKING LAYER. INGEST lands canon alone, through its three-way gate (disk, synced base,
 * canon render), and the recipe stack decides what shows: a working copy keeps shadowing the canon under it. Where the
 * lay moved canon past the text a copy forked from, it warns per title that canon stands fresher (`override-bases.ts`)
 * and writes nothing. A working-only title never promotes, and a title gone from disk stands pending at the shore.
 * LOAD + MOVE stays the human promotion door; the lay never walks it.
 *
 * IDEMPOTENT (causal-island law): each run converges from whatever state it finds — a virgin Synced tree reads
 * everything NEW; a converged tree no-ops per holding.
 *
 *   lares vessel lay [--apply] [--yes] [--lift-kahua <N>]   — preview per holding by default (the ingest posture);
 *                                          a bare --yes lifts nothing in kahua: a typed count on a TTY, or --lift-kahua N
 *   lares vessel lay --workbench [--apply]                  — the checkout's workbench folders alone (`<source>/../wikis/<slug>`)
 *                                          into each wiki's working layer the worn face mounts; never canon, never a face root
 *   lares vessel lay --lag                                  — the house's lag; writes nothing
 *
 * THE LAG (`readHouseLag`) reads what the kūkulu prints on every raise: each disk-sourced holding's titles its canon lacks (NEW)
 * or holds in other bytes (CHANGED), scanned against the Synced tree the INGEST gate keeps; each checkout workbench folder's titles
 * new or moved against its wiki's working layer, with whether the worn face mounts that workbench; and whether the canon source
 * stands in a checkout (an SDM repo: `pnpm-workspace.yaml` beside its `bags/`), the one case where the raise offers the workbench
 * lay on the owner's yes. Canon itself fills through promote and the floor's sealed cut: no raise lays it.
 */

import { existsSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { houseCanonSlugs, namesTw5Docs } from "@lararium/mesh";
import type { ParsedArgs } from "../parse-args.js";
import { emit } from "../render.js";
import { larBagsDir, larProjectionsDirOrNone, larRoot, larWikisDir, vesselDid } from "../env.js";
import { fileToUriForSource, openSyncedTree, scanSource } from "../ingest-core.js";
import type { HouseLag, LagHolding } from "../rite-kukulu.js";
import { askShore, readShoreList } from "../shore-core.js";
import { cmdIngest, type FresherCanonReading } from "./ingest.js";
import { cmdAct } from "./act.js";
import { LIVE_MIRROR_DOORS, readBenchLag, type MirrorDoors } from "../seed-mirrors.js";
import { runMirrors } from "../seed-mirror-leg.js";

export interface LayHolding {
  readonly holding: string;               // "lares"
  readonly source: string;                // "<bags dir>/lares"
  readonly toBag: string;                 // "lar:///ha.ka.ba/bags/lares"
  readonly gesture: "ingest" | "skip" | "floor";    // the road taken (`floor`: house canon this face reads, never writes)
  readonly exitCode: number;              // the gesture's verdict for this holding
  readonly reason?: string;               // why a holding took no road
  readonly fresher?: FresherCanonReading; // working copies that shadow a canon record this lay moved past their base
}

export { discoverHoldings, canonIsDisk } from "../holdings.js";

/** The lay's word for a house canon holding on a face outside the Kahu cabal (action-handler `HOUSE_CANON_READS_FLOOR`). */
export const HOUSE_CANON_FLOOR_REASON = "house canon, written by the Kahu steward (h0); this face reads the floor";
import { canonIsDisk, discoverHoldings } from "../holdings.js";

/**
 * Feed ONE holding into its canon. A disk-sourced holding: CREATE (applied runs only; it converges on the bag that
 * stands), then the diff-gated INGEST. A preview sends the INGEST preview alone and mutates nothing.
 */
export async function layHolding(
  args: ParsedArgs,
  h: { holding: string; source: string; toBag: string },
  diskSourced: boolean = canonIsDisk(h),
): Promise<LayHolding> {
  // A dir named for the TW5 docs library stands no bag (`tw5-docs-name`, `projectionRoots`): the lay names that, never the
  // off-disk reason the sourced-slug reading would otherwise give it.
  if (namesTw5Docs(h.holding)) {
    return { ...h, gesture: "skip", exitCode: 0, reason: "tw5-docs-reserved: dir stands no bag (the name rests with the read-only TW5 docs library, `--recipe tw5-docs`)" };
  }
  if (!diskSourced) {
    return { ...h, gesture: "skip", exitCode: 0, reason: "its canon source stands off disk (not under the canon source the daemon reads, or a private plane): the lay feeds disk canon alone" };
  }
  if (args.flags["apply"]) {
    // THE SEED'S DISK READING RIDES THE CREATE (`ActClaims.houseCanon`): a disk-sourced holding other than the board stands as
    // house canon (`houseCanonSlugs`), so an island that never seated it (the holding landed after the vessel booted) refuses
    // `house-canon-unseated` and mints no catalog row, where a plain CREATE would strand the laid rows outside the realm.
    const created = await foldCreateOutput(args, () => cmdAct({
      command: "act",
      positional: ["CREATE"],
      options: { ...args.options, bag: h.toBag },
      flags: { ...args.flags, yes: true },
    }, { houseCanon: houseCanonSlugs([h.holding]).includes(h.holding) }));
    if (created.code !== 0) return { ...h, gesture: "ingest", exitCode: created.code };
    // HOUSE CANON ON A FACE OUTSIDE THE KAHU CABAL: the CREATE answered that this face reads the floor, so the INGEST
    // writes nothing (the steward alone writes canon live) and the lay names the state, clean.
    if (created.readsFloor) return { ...h, gesture: "floor", exitCode: 0, reason: HOUSE_CANON_FLOOR_REASON };
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
 * stands pending at the shore. The lay counts what stands pending per bag it fed and prints the one batch answer per
 * bag, so a person answers once rather than carrier by carrier.
 */
export function pendingRemovalLines(pending: ReadonlyArray<Record<string, unknown>>, bags: readonly string[]): string[] {
  const counts = new Map<string, number>();
  for (const p of pending) {
    const bag = String(p["bagId"]);
    if (bags.includes(bag)) counts.set(bag, (counts.get(bag) ?? 0) + 1);
  }
  return [...counts].sort(([a], [b]) => (a < b ? -1 : 1)).map(([bag, n]) =>
    `lay: ${n} pending removal(s) in ${bag}: the files left disk and nothing tombstoned; answer once with \`lares shore remove --all --count ${n} --bag ${bag}\` (or \`restore --all --count ${n} --bag ${bag}\`)`);
}

/** How many fresher-canon titles a report names before it counts the rest. */
export const SEED_FRESHER_NAMES = 8;

/** The CLI already uses performance.now() for process-local liveness budgets; lay durations share that monotonic clock. */
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

/** The CREATE's verdict, and whether its answer named the floor (a house canon bag on a face outside the Kahu cabal). */
export interface CreateFold { readonly code: number; readonly readsFloor: boolean }

/**
 * Whether the CREATE's printed answer names the floor (the action handler's house canon answer), in either form `act` prints:
 * the human line `readsFloor true` (a terminal), or the one JSON line whose `data.readsFloor` reads `true` (a pipe, a seat, a
 * harness). The JSON form reads the answer's own field alone: a line that quotes the word elsewhere, or a torn line, names no floor.
 */
export function createReadsFloor(lines: readonly string[]): boolean {
  return lines.some((line) => {
    if (/^\s*readsFloor\s+true\s*$/.test(line)) return true;
    if (!line.trimStart().startsWith("{")) return false;
    try { return (JSON.parse(line) as { data?: { readsFloor?: unknown } } | null)?.data?.readsFloor === true; } catch { return false; }
  });
}

/**
 * Run the CREATE and hear its answer on BOTH mouths `act` speaks through: the human lines ride `console.log` (folded to one
 * line unless --verbose), and off a terminal the one JSON line rides `process.stdout.write` (`emit`). The JSON line passes
 * through to the caller untouched and the fold listens beside it, so a lay in a pipe, a seat or a harness hears `readsFloor`
 * exactly as a lay at a terminal does.
 */
async function foldCreateOutput(args: ParsedArgs, run: () => Promise<number>): Promise<CreateFold> {
  const lines: string[] = [];
  const written: string[] = [];
  const log = console.log;
  const write = process.stdout.write;
  console.log = (...values: unknown[]) => { lines.push(values.map(String).join(" ")); };
  process.stdout.write = ((chunk: unknown, ...rest: unknown[]) => {
    written.push(typeof chunk === "string" ? chunk : Buffer.from(chunk as Uint8Array).toString("utf8"));
    return (write as (...a: unknown[]) => boolean).call(process.stdout, chunk, ...rest);
  }) as typeof process.stdout.write;
  try {
    const code = await run();
    if (args.flags["verbose"]) for (const line of lines) log(line);
    else {
      const detail = lines.join(" · ").replace(/\s+/g, " ").trim();
      if (detail) log(`  CREATE ${detail}`);
    }
    return { code, readsFloor: code === 0 && createReadsFloor([...lines, ...written.join("").split("\n")]) };
  } finally { console.log = log; process.stdout.write = write; }
}

/** Run the mirror leg off the lay's own flags: `--apply`, `--lift-kahua <N>`, `--json`. */
export function runMirrorLeg(args: ParsedArgs, doors: MirrorDoors, opts: { kahuaOnly?: boolean } = {}): Promise<number> {
  return runMirrors({ apply: args.flags["apply"] === true, liftKahua: args.options["lift-kahua"], json: args.flags["json"] === true, ...(opts.kahuaOnly ? { kahuaOnly: true } : {}) }, doors);
}

/** Whether a canon source dir stands in a checkout of this repo: the `pnpm-workspace.yaml` the repo root carries beside `bags/`. */
export const canonSourceIsCheckout = (bagsDir: string): boolean => existsSync(join(dirname(bagsDir), "pnpm-workspace.yaml"));

/**
 * THE HOUSE'S LAG, read and never written: every disk-sourced holding scanned against the Synced tree (the INGEST gate's own two
 * cheap legs, no daemon). A title the tree never synced reads NEW; one whose bytes moved (or that moved home) reads CHANGED. A
 * holding whose canon stands off disk takes no lay, so it counts no lag. Beside it, each checkout workbench's lag and seat
 * (`readBenchLag`).
 */
export async function readHouseLag(doors: MirrorDoors = LIVE_MIRROR_DOORS, bagsDir: string = larBagsDir()): Promise<HouseLag> {
  const root = larRoot();
  const tree = openSyncedTree();
  const projections = larProjectionsDirOrNone();
  const dirs = { bags: bagsDir, wikis: larWikisDir(), ...(projections !== undefined ? { projections } : {}) };
  const holdings: LagHolding[] = [];
  for (const h of discoverHoldings(bagsDir)) {
    if (!canonIsDisk(h)) continue;
    const scan = scanSource(root, h.source, h.toBag, tree, fileToUriForSource(root, h.source, dirs, tree));
    const rows = scan?.rows ?? [];
    holdings.push({
      holding: h.holding, toBag: h.toBag,
      new: rows.filter((r) => r.status === "new").map((r) => r.uri),
      changed: rows.filter((r) => r.status === "changed" || r.status === "renamed").map((r) => r.uri),
    });
  }
  const benches = await readBenchLag(doors);
  return {
    source: bagsDir, checkout: canonSourceIsCheckout(bagsDir), holdings, lag: holdings.reduce((n, h) => n + h.new.length + h.changed.length, 0),
    wikis: benches.dir, benches: benches.benches, benchLag: benches.benches.reduce((n, b) => n + b.planned.length, 0),
  };
}

export async function cmdLay(args: ParsedArgs, mirrorDoors: MirrorDoors = LIVE_MIRROR_DOORS): Promise<number> {
  const bagsDir = larBagsDir();
  if (args.flags["lag"]) {
    const lag = await readHouseLag(mirrorDoors, bagsDir);
    emit(args, {
      ok: true,
      data: lag as unknown as Record<string, unknown>,
      human: () => {
        for (const h of lag.holdings) console.log(`canon ${h.holding}: ${h.new.length} new, ${h.changed.length} changed`);
        for (const b of lag.benches) console.log(`workbench ${b.slug}: ${b.planned.length} new or moved${b.mounts === true ? "" : ` · does not mount (${b.why ?? "unread"})`}`);
        console.log(`lay: canon lags ${lag.source} by ${lag.lag} carrier(s)${lag.wikis === null ? "" : ` · the workbenches lag ${lag.wikis} by ${lag.benchLag}`}${lag.checkout ? "" : " · the source stands in no checkout"}`);
      },
    });
    return 0;
  }
  // `--workbench` walks the checkout's workbench folders alone (the lay a kūkulu offers on the owner's yes): no holdings leg, no
  // face root, no share, no kahua; each workbench lays only where the worn face holds a writer's seat.
  if (args.flags["workbench"]) return runMirrors({ apply: args.flags["apply"] === true, json: args.flags["json"] === true, benchesOnly: true }, mirrorDoors);
  const holdings = discoverHoldings(bagsDir);
  if (holdings.length === 0) {
    emit(args, {
      ok: false,
      error: { code: "not-found", message: `no holdings under ${bagsDir}` },
      human: () => console.error(`lares vessel lay: no holdings under ${bagsDir}`),
    });
    return 3;
  }
  const ledger: LayHolding[] = [];
  const started = performance.now();
  for (const h of holdings) {
    const carriers = countCarriers(h.source);
    console.log(`lay ${h.holding}: ${carriers} files…`);
    const holdingStarted = performance.now();
    const row = await layHolding(args, h);
    ledger.push(row);
    if (row.gesture === "skip") { console.log(`- ${h.holding}: no road · ${row.reason}`); continue; }
    if (row.gesture === "floor") { console.log(`· ${h.holding}: ${row.reason}`); continue; }
    const retry = row.exitCode === 0 ? "retry safe" : "retry safe (diff-gated)";
    console.log(`${row.exitCode === 0 ? "✓" : "✗"} ${h.holding}: ${carriers} files · ${elapsedText(performance.now() - holdingStarted)} · ${retry}`);
  }
  const failed = ledger.filter((h) => h.exitCode !== 0);
  for (const h of failed) console.error(`  ${h.holding}: ${h.gesture} failed (exit ${h.exitCode})`);
  // THE FRESHER CANON: working copies keep shadowing the canon this lay moved; the word names them, nothing writes.
  const fresher = ledger.flatMap((h) => (h.fresher?.titles ?? []).map((t) => `${h.holding}:${t}`));
  const fresherCount = ledger.reduce((n, h) => n + (h.fresher?.count ?? 0), 0);
  if (fresherCount > 0) {
    console.error(`  ⚠ canon is fresher than the working copy above it for ${fresherCount} title(s): ${fresher.slice(0, SEED_FRESHER_NAMES).join(", ")}${fresherCount > SEED_FRESHER_NAMES ? `, … ${fresherCount - SEED_FRESHER_NAMES} more` : ""}`);
    console.error("    each copy still shadows canon; the daemon's fresher-canon read lists them all, and a person removes a copy with the ordinary verbs to take the fresher canon");
  }
  const fed = ledger.filter((h) => h.gesture === "ingest");
  const floorRead = ledger.filter((h) => h.gesture === "floor").length;
  if (args.flags["apply"] && fed.length > 0) {
    try {
      const did = await vesselDid();
      const listed = await readShoreList((a) => askShore(a, did), { op: "list" });
      if (listed.ok) for (const line of pendingRemovalLines(listed.pending, fed.map((h) => h.toBag))) console.log(line);
    } catch { /* the shore unread: the lay's own verdict stands; `lares shore` reads it */ }
  }
  const offDisk = ledger.filter((h) => h.gesture === "skip").length;
  console.log(`lay: ${fed.length - failed.length}/${fed.length} holdings${floorRead > 0 ? ` · ${floorRead} read the floor` : ""}${offDisk > 0 ? ` · ${offDisk} off disk` : ""} · ${elapsedText(performance.now() - started)}`);
  // THE MIRRORS LEG, after canon stands: every mirror under the projections root back into its one layer.
  const mirrors = await runMirrorLeg(args, mirrorDoors);
  return failed.length === 0 && mirrors === 0 ? 0 : 1;
}
