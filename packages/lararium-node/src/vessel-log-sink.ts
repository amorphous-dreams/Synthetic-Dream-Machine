/**
 * vessel-log-sink — THE VESSEL'S CONSOLE, FOLDED AT THE SOURCE into one record per distinct event (`@lararium/mesh/shore-log`).
 *
 * The tap reads every line the process writes (its own console and each island worker's, which Node pipes through the main
 * process's stdout and stderr), passes it through unchanged, and folds it into the boot's ring. A storm costs one map update
 * per line and nothing else: no write rides a line.
 *
 * THE SHORE'S QUEUE, CRESTED AS THE NALU CRESTS (lar:///ha.ka.ba/lares/api/pono/nalu#/the-wave-shape, `wave-crest`). Each
 * distinct event key stands ONE FAMILY on the sink's queue, queued once however many lines fold into it before it lands: a
 * storm raises counts, never writes. The drain takes a crest of whole families (`takeCrest`, bounded by event count and
 * encoded bytes; no crest cuts a family) and lands it:
 *   · into `run/vessel-live.log`, one JSON line per record: the flat fallback a reader tails when no door answers. Past
 *     `liveMaxBytes` the file rewrites as the ring's own state (one line per event), so it stays bounded. `run/` stands a
 *     tmpfs inside the container; the shim's down copies its closing slice to the house's `run/vessel-last.log`.
 *   · into the worn face's daemon temp layer, through the daemon island (`placeShoreLog`), where `$:/lares/shore/log` and
 *     `lares shore log` read the records. The temp class reaches plaintext only through its consented mirror.
 * The NEXT crest goes only once the previous one landed, after a host-task yield (`yieldToHost`): the landing's own
 * backpressure paces the sink, as the landing queue paces. NO CLOCK PACES IT: no timer, no interval, no duration read.
 *
 * O-TAKIAGE OF OLD RINGS: at open, a live log an earlier boot left folds into the month's ash (`run/shore-ash/<YYYY-MM>.jsonl`,
 * its closing slice, one line per event, the ash itself bounded to its last `ashMaxLines`), and the live log starts empty for
 * this boot. The month and each record's `first-at`/`last-at` annotate alone: the clock never orders, keys or paces a record.
 *
 * Meme: lar:///ha.ka.ba/lararium/api/disk-projection
 */

import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import {
  ShoreLogRing, closingSlice, shoreLogJsonLine, shoreLogKey, shoreLogPlacements, SHORE_LOG_EVICTED_KIND,
  type ShoreLogPlacement, type ShoreLogRecord, type ShoreLogStream,
} from "@lararium/mesh/shore-log";
import { takeCrest, type WaveLimits } from "@lararium/mesh/wave-crest";
import { yieldToHost, type HostTaskYield } from "@lararium/mesh/host-task";

/** The live log's name under the run dir. */
export const VESSEL_LIVE_LOG = "vessel-live.log";
/** The ash folder under the run dir. */
export const SHORE_ASH_DIR = "shore-ash";
const LIVE_MAX_BYTES = 8 * 1024 * 1024;
const ASH_MAX_LINES = 20_000;
/** One crest's bound: event families, and the encoded bytes their live-log lines weigh (`ops` unused). */
export const SHORE_LOG_CREST: WaveLimits = { count: 64, bytes: 64 * 1024, ops: Number.MAX_SAFE_INTEGER };

export interface VesselLogSinkOptions {
  /** The house's run dir (`larRuntimeHome()`); null keeps no flat file (the records still reach the island). */
  readonly runDir: string | null;
  readonly boot?: string;
  readonly capacity?: number;
  readonly crest?: WaveLimits;
  readonly liveMaxBytes?: number;
  readonly ashMaxLines?: number;
  /** The annotation clock (first-at / last-at, the ash's month): it never paces, keys or orders. */
  readonly now?: () => Date;
  /** The host-task seam between crests (tests hand it out by hand); never a timer. */
  readonly yieldHost?: HostTaskYield;
}

export interface VesselLogSink {
  readonly boot: string;
  readonly ring: ShoreLogRing;
  /** Fold one line (a whole line, no newline) into the ring; its event's family joins the queue once. */
  take(line: string, stream?: ShoreLogStream): void;
  /** Name where the records land in the island; every record the ring holds goes first. May answer a promise: the next crest waits on it. */
  attach(place: (records: readonly ShoreLogPlacement[]) => void | Promise<void>): void;
  /** Hand the whole ring to the island again (a restarted island's temp layer stands empty). */
  replay(): void;
  /** The families queued, not yet landed. */
  queued(): number;
  /** Resolves once the queue stands empty and no crest lands. */
  settled(): Promise<void>;
  /** Land every queued family now, synchronously into the live log (the close's path); the island takes them as one batch. */
  flush(): void;
  /** The last flush, then the live log rewrites as the ring's closing slice. */
  close(): void;
}

/** A boot's id: eight random hex digits, minted at open; it names the ring, never orders it. */
export const mintBootId = (): string => randomBytes(4).toString("hex");

const monthOf = (d: Date): string => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;

/**
 * FOLD AN EARLIER BOOT'S LIVE LOG INTO THE MONTH'S ASH: its closing slice (one line per event) appends to
 * `<runDir>/shore-ash/<YYYY-MM>.jsonl`, the ash keeps its last `ashMaxLines` lines, and the live log empties. Answers the
 * count of events folded; a live log that stands absent or empty folds nothing.
 */
export function otakiageLiveLog(runDir: string, opts: { readonly now?: Date; readonly ashMaxLines?: number } = {}): number {
  const live = join(runDir, VESSEL_LIVE_LOG);
  if (!existsSync(live)) return 0;
  const slice = closingSlice(readFileSync(live, "utf8").split("\n"));
  writeFileSync(live, "");
  if (slice.length === 0) return 0;
  const ashDir = join(runDir, SHORE_ASH_DIR);
  mkdirSync(ashDir, { recursive: true });
  const ash = join(ashDir, `${monthOf(opts.now ?? new Date())}.jsonl`);
  appendFileSync(ash, slice.map((rec) => `${shoreLogJsonLine(rec)}\n`).join(""));
  const max = opts.ashMaxLines ?? ASH_MAX_LINES;
  const lines = readFileSync(ash, "utf8").split("\n").filter((l) => l !== "");
  if (lines.length > max) {
    const tmp = `${ash}.tmp`;
    writeFileSync(tmp, lines.slice(-max).map((l) => `${l}\n`).join(""));
    renameSync(tmp, ash);
  }
  return slice.length;
}

/** Open the boot's sink: the earlier boot's live log folds to ash first. */
export function openVesselLogSink(opts: VesselLogSinkOptions): VesselLogSink {
  const now = opts.now ?? (() => new Date());
  const boot = opts.boot ?? mintBootId();
  const ring = new ShoreLogRing({ boot, ...(opts.capacity !== undefined ? { capacity: opts.capacity } : {}), now: () => now().toISOString() });
  const limits = opts.crest ?? SHORE_LOG_CREST;
  const liveMax = opts.liveMaxBytes ?? LIVE_MAX_BYTES;
  const yieldHost = opts.yieldHost ?? yieldToHost;
  const live = opts.runDir === null ? null : join(opts.runDir, VESSEL_LIVE_LOG);
  let fileOk = live !== null;
  if (opts.runDir !== null) {
    try { mkdirSync(opts.runDir, { recursive: true }); otakiageLiveLog(opts.runDir, { now: now(), ...(opts.ashMaxLines !== undefined ? { ashMaxLines: opts.ashMaxLines } : {}) }); }
    catch { fileOk = false; }
  }
  const evictedKey = shoreLogKey(SHORE_LOG_EVICTED_KIND, "");
  /** THE SHORE'S QUEUE: event keys, each a family, each queued once until its crest lands. */
  const queue: string[] = [];
  const inQueue = new Set<string>();
  let evictedSeen = 0;
  let place: ((records: readonly ShoreLogPlacement[]) => void | Promise<void>) | null = null;
  let draining: Promise<void> | null = null;
  let closed = false;

  const enqueue = (key: string): void => { if (!inQueue.has(key)) { inQueue.add(key); queue.push(key); } };
  const current = (): Map<string, ShoreLogRecord> => new Map(ring.records().map((r) => [r.key, r]));
  const toIsland = (records: readonly ShoreLogRecord[]): void | Promise<void> => {
    if (place === null || records.length === 0) return;
    // A daemon mid-restart refuses (a throw or a rejection); its restart replays the whole ring (`replay`).
    try {
      const landed = place(shoreLogPlacements(records));
      if (landed && typeof (landed as Promise<void>).then === "function") return (landed as Promise<void>).catch(() => undefined);
    } catch { /* the restart's replay carries it */ }
  };
  const rewriteLive = (): void => {
    if (!fileOk || live === null) return;
    const tmp = `${live}.tmp`;
    writeFileSync(tmp, ring.records().map((rec) => `${shoreLogJsonLine(rec)}\n`).join(""));
    renameSync(tmp, live);
  };
  const toFile = (records: readonly ShoreLogRecord[]): void => {
    if (!fileOk || live === null || records.length === 0) return;
    try {
      appendFileSync(live, records.map((rec) => `${shoreLogJsonLine(rec)}\n`).join(""));
      if (statSync(live).size > liveMax) rewriteLive();
    } catch { fileOk = false; }   // a run dir that refuses keeps the records in memory and the island; never a console line
  };
  /** Take one crest off the queue: whole families while the next still fits; a family the ring let go weighs nothing and lands nothing. */
  const crestOf = (): ShoreLogRecord[] => {
    const held = current();
    const keys = takeCrest(queue, (key) => {
      const rec = held.get(key);
      return { count: 1, bytes: rec ? Buffer.byteLength(shoreLogJsonLine(rec)) + 1 : 0 };
    }, limits);
    for (const key of keys) inQueue.delete(key);
    return keys.map((key) => held.get(key)).filter((rec): rec is ShoreLogRecord => rec !== undefined);
  };
  /** THE DRAIN: a host task first, then crest after crest, each landing before the next goes; a yield between crests. */
  const drain = async (): Promise<void> => {
    await yieldHost();
    while (queue.length > 0 && !closed) {
      const crest = crestOf();
      toFile(crest);
      await toIsland(crest);
      if (queue.length > 0) await yieldHost();
    }
    draining = null;
    if (queue.length > 0 && !closed) kick();
  };
  const kick = (): void => { if (draining === null) draining = drain(); };
  const flushAll = (): void => {
    const all: ShoreLogRecord[] = [];
    while (queue.length > 0) all.push(...crestOf());
    toFile(all);
    void toIsland(all);
  };

  return {
    boot,
    ring,
    take(line, stream = "stdout") {
      const rec = ring.take(line, stream);
      if (rec === null) return;
      enqueue(rec.key);
      if (ring.evicted !== evictedSeen) { evictedSeen = ring.evicted; enqueue(evictedKey); }
      if (!closed) kick();
    },
    attach(fn) { place = fn; void toIsland(ring.records()); },
    replay() { void toIsland(ring.records()); },
    queued: () => queue.length,
    settled: async () => { while (draining !== null) await draining; },
    flush: flushAll,
    close() {
      if (closed) return;
      flushAll();
      closed = true;
      try { rewriteLive(); } catch { /* the appended lines already carry every record's last state */ }
    },
  };
}

type Write = typeof process.stdout.write;

/**
 * TAP A PROCESS'S TWO STREAMS into the sink: each whole line folds in, the bytes pass through unchanged. A partial line waits
 * for its newline (bounded: past 64 KiB it folds as it stands). Answers the untap.
 */
export function tapProcessStreams(sink: Pick<VesselLogSink, "take">, proc: { stdout: { write: Write }; stderr: { write: Write } } = process): () => void {
  const undo: Array<() => void> = [];
  for (const stream of ["stdout", "stderr"] as const) {
    const target = proc[stream];
    const original = target.write;
    let pending = "";
    const tapped = function (this: unknown, chunk: unknown, ...rest: unknown[]): boolean {
      try {
        pending += typeof chunk === "string" ? chunk : chunk instanceof Uint8Array ? Buffer.from(chunk).toString("utf8") : "";
        let at: number;
        while ((at = pending.indexOf("\n")) >= 0) { sink.take(pending.slice(0, at), stream); pending = pending.slice(at + 1); }
        if (pending.length > 65_536) { sink.take(pending, stream); pending = ""; }
      } catch { /* the tap never breaks the stream it reads */ }
      return (original as (...a: unknown[]) => boolean).call(this ?? target, chunk, ...rest);
    } as Write;
    target.write = tapped;
    undo.push(() => { if (target.write === tapped) target.write = original; });
  }
  return () => { for (const fn of undo) fn(); };
}
