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
 *   lares vessel lay --canon                                — a household's canon follows its checkout: the holdings leg alone,
 *                                          applied, then every carrier the head switch carried off tombstones (the kūkulu's own lay)
 *   lares vessel lay --lag                                  — the house's lag; writes nothing
 *
 * THE LAG (`readHouseLag`) reads what the kūkulu weighs on every raise: each disk-sourced holding's titles its canon lacks (NEW)
 * or holds in other bytes (CHANGED), scanned against the Synced tree the INGEST gate keeps; each checkout workbench folder's titles
 * new or moved against its wiki's working layer, with whether the worn face mounts that workbench; and whether the canon source
 * stands in a checkout (an SDM repo: `pnpm-workspace.yaml` beside its `bags/`).
 *
 * A HOUSEHOLD'S CANON FOLLOWS ITS CHECKOUT (operator ruling 2026-11-28): where the canon source stands in a checkout, the kūkulu lays
 * it at the head the raise stood (`--canon`, licensed by the rite's lei), and between raises the vessel's checkout watch lands each
 * disk edit live (`writer: disk`). A shared tier's canon fills through promote and the floor's sealed cut: no raise lays it.
 */

import { existsSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { houseCanonSlugs } from "@lararium/mesh/kahu-canon-reach";
import { namesTw5Docs } from "@lararium/mesh/tw5-docs-name";
import { type FloorDriftReading } from "@lararium/mesh/floor-drift";
import type { ParsedArgs } from "../parse-args.js";
import { emit, exitFor } from "../render.js";
import { larBagsDir, larProjectionsDirOrNone, larRoot, larWikisDir, vesselDid } from "../env.js";
import { fileToUriForSource, openSyncedTree, scanSource } from "../ingest-core.js";
import type { CanonFollowHolding, CanonFollowReading, HouseLag, LagHolding } from "../rite-kukulu.js";
import { askShore, readShoreList, type ShoreAnswer } from "../shore-core.js";
import { cmdIngest, type FresherCanonReading, type IngestSink } from "./ingest.js";
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
  readonly outcome?: { readonly state: "committed" | "unknown"; readonly requestId: string }; // a wave whose wait ended, read back
}

/** The one line a laid holding prints. */
/**
 * The one line a laid holding prints. A WAIT THAT ENDED IS NO FAILURE: a wave whose receipt read `committed` prints
 * committed with its request id and the read-back, one that read nothing prints unknown with its id; ✗ stays for a
 * gesture that failed.
 */
export function layHoldingLine(row: LayHolding, carriers: number, elapsed: string): string {
  if (row.outcome !== undefined) {
    const said = row.outcome.state === "committed"
      ? "committed; its outcome had not landed when the wait ended"
      : "outcome unknown";
    return `◐ ${row.holding}: ${carriers} files · ${elapsed} · ${said} · read \`lares vessel request ${row.outcome.requestId}\` · retry safe (diff-gated)`;
  }
  const retry = row.exitCode === 0 ? "retry safe" : "retry safe (diff-gated)";
  return `${row.exitCode === 0 ? "✓" : "✗"} ${row.holding}: ${carriers} files · ${elapsed} · ${retry}`;
}

export { discoverHoldings, canonIsDisk } from "../holdings.js";

/** The lay's word for a house canon holding on a face outside the Kahu cabal (action-handler `HOUSE_CANON_READS_FLOOR`). */
export const HOUSE_CANON_FLOOR_REASON = "house canon, written by the Kahu steward (h0); this face reads the floor";
import { canonIsDisk, discoverHoldings } from "../holdings.js";
import { pendingReceipts, retirementLine, type Retirement } from "../shore-retirement.js";
import { storeVerb } from "../store-door.js";
import { udsAlive } from "../local-connector.js";
import { floorDriftNames, floorDriftTally } from "./floor.js";

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
  const sink: IngestSink = {};
  const exitCode = await withIngestTicks(h.holding, () => cmdIngest({
    command: "ingest",
    positional: [],
    options: { ...args.options, source: h.source, to: h.toBag },
    flags: args.flags,
  }, sink));
  return { ...h, gesture: "ingest", exitCode, ...(sink.fresher ? { fresher: sink.fresher } : {}), ...(exitCode !== 0 && sink.outcome ? { outcome: sink.outcome } : {}) };
}

/**
 * THE SHORE FLOOD, ANSWERED ONCE. A wave tombstones no carrier: a title gone from disk (a branch switch drops many)
 * stands pending at the shore. The lay counts what stands pending per bag it fed and prints the one batch answer per
 * bag, so a person answers once rather than carrier by carrier.
 */
export function pendingRemovalLines(pending: ReadonlyArray<Record<string, unknown>>, bags: readonly string[], receipts: ReadonlyMap<string, Retirement> = new Map()): string[] {
  const rows = new Map<string, Array<Record<string, unknown>>>();
  for (const p of pending) {
    const bag = String(p["bagId"]);
    if (bags.includes(bag)) rows.set(bag, [...(rows.get(bag) ?? []), p]);
  }
  return [...rows].sort(([a], [b]) => (a < b ? -1 : 1)).flatMap(([bag, held]) => {
    const n = held.length;
    // THE RECEIPT: each carrier a commit took from the checkout carries that commit beneath its bag's count, up to a few; `lares shore` names each.
    const retired = held.flatMap((p) => {
      const r = typeof p["path"] === "string" ? receipts.get(p["path"]) : undefined;
      return r === undefined ? [] : [`lay:   ${String(p["uri"])}: ${retirementLine(r)}`];
    });
    return [
      `lay: ${n} pending removal(s) in ${bag}: the files left disk and nothing tombstoned; answer once with \`lares shore remove --all --count ${n} --bag ${bag}\` (or \`restore --all --count ${n} --bag ${bag}\`)`,
      ...retired.slice(0, LAY_RECEIPT_NAMES),
      ...(retired.length > LAY_RECEIPT_NAMES ? [`lay:   … ${retired.length - LAY_RECEIPT_NAMES} more retired carrier(s): \`lares shore\` names each`] : []),
    ];
  });
}

/** How many retired carriers a lay names beneath one bag's count before it counts the rest. */
export const LAY_RECEIPT_NAMES = 8;

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

/**
 * THE FLOOR'S DRIFT, as the standing vessel reads it (`floor-status`'s `floorDrift`): each live public-canon carrier the floor it
 * serves misses or serves with older bytes. Asked of a standing vessel alone, since the lag reads off disk and opens no store. Where
 * it does not read, it answers null with the reason by name: no vessel stands, the vessel answers no drift field (its build carries no
 * drift reading), or the vessel's own reason. Never a zero it did not count.
 */
export async function liveFloorDrift(): Promise<FloorDriftReading> {
  if (!(await udsAlive())) return { drift: null, why: "no standing vessel answers the floor read" };
  const { output } = await storeVerb("floor-status", {});
  if (typeof output["refused"] === "string") return { drift: null, why: `the floor read refused: ${output["refused"]}` };
  const drift = output["floorDrift"];
  if (drift !== null && typeof drift === "object") return { drift: drift as NonNullable<FloorDriftReading["drift"]> };
  if (!("floorDrift" in output)) return { drift: null, why: "the standing vessel answers no drift reading (its build carries none; a refresh brings it)" };
  return { drift: null, why: typeof output["floorDriftWhy"] === "string" ? output["floorDriftWhy"] : "the standing vessel reads the drift null and names no reason" };
}

export async function cmdLay(args: ParsedArgs, mirrorDoors: MirrorDoors = LIVE_MIRROR_DOORS, floorDrift: () => Promise<FloorDriftReading> = liveFloorDrift): Promise<number> {
  const bagsDir = larBagsDir();
  if (args.flags["canon"]) return cmdLayCanon(args, bagsDir);
  if (args.flags["lag"]) {
    const lag = await readHouseLag(mirrorDoors, bagsDir);
    // THE FLOOR'S DRIFT RIDES BESIDE THE LAG, never inside it: lag counts disk against live canon, the drift live canon against
    // the floor every recipe outside the cabal's `lares` stack reads.
    const reading = await floorDrift().catch((e: unknown): FloorDriftReading => ({ drift: null, why: `the floor read faulted: ${(e instanceof Error ? e.message : String(e)).replace(/[\r\n]+/g, " ").trim()}` }));
    const drift = reading.drift;
    emit(args, {
      ok: true,
      data: { ...lag, floorDrift: drift, ...(reading.why !== undefined ? { floorDriftWhy: reading.why } : {}) } as unknown as Record<string, unknown>,
      human: () => {
        for (const h of lag.holdings) console.log(`canon ${h.holding}: ${h.new.length} new, ${h.changed.length} changed`);
        for (const b of lag.benches) console.log(`workbench ${b.slug}: ${b.planned.length} new or moved${b.mounts === true ? "" : ` · does not mount (${b.why ?? "unread"})`}`);
        console.log(`lay: canon lags ${lag.source} by ${lag.lag} carrier(s)${lag.wikis === null ? "" : ` · the workbenches lag ${lag.wikis} by ${lag.benchLag}`}${lag.checkout ? "" : " · the source stands in no checkout"}`);
        if (drift === null) console.log(`floor: drift unread (${reading.why ?? "no reason named"})`);
        else {
          console.log(`floor: the floor this vessel serves trails live canon by ${drift.count} carrier(s) · ${floorDriftTally(drift)}`);
          for (const line of floorDriftNames(drift, "  ")) console.log(line);
        }
      },
    });
    return 0;
  }
  // AN APPLY THAT NO HAND CONFIRMS REFUSES OUT LOUD: without `--yes` the lay asks at a terminal, and with none (a pipe, a seat, a
  // harness) no one can answer, so it names the cure instead of standing silent.
  if (args.flags["apply"] === true && args.flags["yes"] !== true && !(process.stdin.isTTY && process.stdout.isTTY)) {
    const cure = "lares vessel lay --apply --yes";
    emit(args, {
      ok: false,
      error: { code: "usage", message: "confirmation required", hint: `no terminal answers the lay's confirmation; pass --yes (the operator's relayed approval): ${cure}` },
      human: () => { /* the line below speaks for the prose route and rides stderr beside a JSON envelope too */ },
    });
    console.error(`lares vessel lay: --apply needs a confirmation and no terminal stands to give it; run \`${cure}\` to confirm (add --lift-kahua <N> to lift kahua items).`);
    return exitFor("usage");
  }
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
    console.log(layHoldingLine(row, carriers, elapsedText(performance.now() - holdingStarted)));
  }
  const failed = ledger.filter((h) => h.exitCode !== 0);
  // A WAVE WHOSE WAIT ENDED READS ITS RECEIPT'S STATE, NEVER "failed": committed or unknown, with its request id.
  for (const h of failed) {
    if (h.outcome !== undefined) console.error(`  ${h.holding}: ${h.gesture} ${h.outcome.state} (request ${h.outcome.requestId}); read it with \`lares vessel request ${h.outcome.requestId}\` before a re-run`);
    else console.error(`  ${h.holding}: ${h.gesture} failed (exit ${h.exitCode})`);
  }
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
      if (listed.ok) for (const line of pendingRemovalLines(listed.pending, fed.map((h) => h.toBag), pendingReceipts(listed.pending))) console.log(line);
    } catch { /* the shore unread: the lay's own verdict stands; `lares shore` reads it */ }
  }
  const offDisk = ledger.filter((h) => h.gesture === "skip").length;
  console.log(`lay: ${fed.length - failed.length}/${fed.length} holdings${floorRead > 0 ? ` · ${floorRead} read the floor` : ""}${offDisk > 0 ? ` · ${offDisk} off disk` : ""} · ${elapsedText(performance.now() - started)}`);
  // THE MIRRORS LEG, after canon stands: every mirror under the projections root back into its one layer.
  const mirrors = await runMirrorLeg(args, mirrorDoors);
  return failed.length === 0 && mirrors === 0 ? 0 : 1;
}

/** The pending removals the shore lists, counted per bag the canon follow fed. */
export function pendingByBag(pending: ReadonlyArray<Record<string, unknown>>, bags: readonly string[]): Array<[string, number]> {
  const counts = new Map<string, number>();
  for (const p of pending) {
    const bag = String(p["bagId"]);
    if (bags.includes(bag)) counts.set(bag, (counts.get(bag) ?? 0) + 1);
  }
  return [...counts].sort(([a], [b]) => (a < b ? -1 : 1));
}

/** The shore door the canon follow reads and answers through: the list, and the batch removal per bag. */
export type CanonShore = (shoreArgs: Readonly<Record<string, unknown>>) => Promise<ShoreAnswer>;

const liveCanonShore = async (): Promise<CanonShore> => { const did = await vesselDid(); return (a) => askShore(a, did); };

/**
 * A HOUSEHOLD'S CANON FOLLOWS ITS CHECKOUT (`lares vessel lay --canon`; operator ruling 2026-11-28, forks 1 and 3). The kūkulu asks
 * it of the vessel after a raise, under the license the rite's lei carries: the holdings leg alone, applied (each disk-sourced
 * holding's CREATE, then its diff-gated INGEST into its canon bag), so canon stands at the head the raise stood; then every carrier
 * the head switch carried off (each removal the shore lists pending in a bag this lay fed) tombstones, one batch answer per bag. A
 * canon source in no checkout keeps a shared tier, and the follow refuses by name: that canon fills through promote and the cut.
 * The answer names each holding's verdict, the tombstones per bag and each refused step; it answers ok whatever a holding said, so
 * the rite reads the rows.
 */
export async function cmdLayCanon(args: ParsedArgs, bagsDir: string = larBagsDir(), shore: () => Promise<CanonShore> = liveCanonShore): Promise<number> {
  if (!canonSourceIsCheckout(bagsDir)) {
    const message = `canon-source-shared: ${bagsDir} stands in no checkout, so its canon keeps a shared tier and follows no head; it fills through promote and the floor's sealed cut (\`lares meme offer promote <cid>\`, then \`lares nexus release <manifest-file> --cut\`)`;
    emit(args, { ok: false, error: { code: "canon-source-shared", message }, human: () => console.error(`lares vessel lay: ${message}`) });
    return 2;
  }
  // THE RITE'S LEI CARRIES THE LICENSE: the follow lays applied and asks no hand at a terminal.
  const applied: ParsedArgs = { ...args, flags: { ...args.flags, apply: true, yes: true } };
  const holdings: CanonFollowHolding[] = [];
  const fed: string[] = [];
  const started = performance.now();
  for (const h of discoverHoldings(bagsDir)) {
    const carriers = countCarriers(h.source);
    const holdingStarted = performance.now();
    const row = await layHolding(applied, h);
    // A holding that takes no road (off disk, the TW5 docs name) follows nothing: canon follows the checkout's own holdings alone.
    if (row.gesture === "skip") continue;
    holdings.push({ holding: row.holding, toBag: row.toBag, exitCode: row.exitCode, ...(row.reason !== undefined ? { reason: row.reason } : {}) });
    if (row.gesture === "floor") { console.log(`· ${row.holding}: ${row.reason}`); continue; }
    fed.push(row.toBag);
    console.log(layHoldingLine(row, carriers, elapsedText(performance.now() - holdingStarted)));
  }
  // A VANISH THE HEAD SWITCH CARRIED TOMBSTONES AT THE RAISE (fork 3): each removal the shore lists pending in a fed bag.
  const tombstoned: Record<string, number> = {};
  const refused: string[] = [];
  if (fed.length > 0) {
    try {
      const ask = await shore();
      const listed = await readShoreList(ask, { op: "list" });
      if (!listed.ok) refused.push(`the shore's list refused (${listed.refusal ?? listed.why ?? "unread"}); \`lares shore\` names each pending removal`);
      else {
        for (const [bag, n] of pendingByBag(listed.pending, fed)) {
          const answer = await ask({ op: "remove", all: true, count: n, bag });
          if (answer.ok) tombstoned[bag] = n;
          else refused.push(`${bag}: ${n} pending removal(s) stand (${answer.refusal ?? answer.why ?? "the shore refused"}); \`lares shore remove --all --count ${n} --bag ${bag}\` tombstones them`);
        }
      }
    } catch (e) {
      refused.push(`the shore read faulted (${(e instanceof Error ? e.message : String(e)).replace(/[\r\n]+/g, " ").trim()}); \`lares shore\` names each pending removal`);
    }
  }
  const reading: CanonFollowReading = { holdings, tombstoned, refused };
  const failed = holdings.filter((h) => h.exitCode !== 0);
  emit(args, {
    ok: true,
    data: { ...reading, source: bagsDir } as unknown as Record<string, unknown>,
    human: () => {
      for (const [bag, n] of Object.entries(tombstoned)) console.log(`lay: ${bag}: ${n} carrier(s) the head switch carried off tombstone`);
      for (const line of refused) console.error(`  ${line}`);
      console.log(`lay: canon follows ${bagsDir}: ${holdings.length - failed.length}/${holdings.length} holdings · ${elapsedText(performance.now() - started)}`);
    },
  });
  return failed.length === 0 && refused.length === 0 ? 0 : 1;
}
