/**
 * temp-layer — the USER temp layer's life on disk: read-back at mount, housekeeping at start and once a day, opt-in
 * age expiry through the trash, and one content-free audit line per act.
 *
 * A wiki's temp layer (`wikis/{slug}/temp`) lives in the island's memory and comes up empty at every restart. Where the
 * wiki's recipe designates the layer AND the operator's consent row names the wiki's slug (`projection.temp.<slug>` in
 * `<root>/config/config.json`), a recovery-class mirror projects it under `<projections>/wikis/<wiki-folder>/temp/`,
 * one `.tid` per carrier, the shape the draft recovery mirror writes. The projector bars the layer's internal volatile
 * state by namespace (`isTempLayerInternalTitle`); this module carries the rest:
 *
 *   READ-BACK  at mount, ahead of the projector's first pass, every `.tid` under the mirror re-enters the layer's store,
 *              so the projector's start scan finds each record standing and never reads a carrier as dropped. A file
 *              under `<projections>/observe` never reads back, an internal-volatile title never re-enters, and an
 *              atomic write's stray temp never parses.
 *   HOUSEKEEP  at start and then once a day (an injectable clock): an orphan `*.lar-tmp-*` past the settle window goes,
 *              and so does a settled carrier whose record left the layer (a tombstone stands) or whose consent the
 *              operator withdrew. A file a hand edited (its hash differs from the projector's last write), a pending
 *              or conflicted carrier, and a sole copy (the layer holds no word of the record at all) stay untouched.
 *   EXPIRY     only where the config names a window (`projection.tempExpiryDays.<slug>`): a settled carrier older
 *              than the window moves to `<projections>/trash/<date>/<its path under projections>`, and a trash day
 *              older than the same window purges.
 *   AUDIT      each act appends one line to `<projections>/audit/<date>.ndjson`: time, action, bag slug, the hash of
 *              the record's title (or of an orphan's path), outcome. No body, no title, no field value.
 *
 * Meme: lar:///ha.ka.ba/lararium/api/disk-projection
 */

import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, rmdirSync, statSync, unlinkSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join, relative, resolve, sep } from "node:path";
import { carrierHash } from "@lararium/mesh";
import { isObserveProjectionPath, isTempLayerInternalTitle } from "./bag-paths.js";

/** One day, the housekeeping period. */
export const HOUSEKEEPING_PERIOD_MS = 24 * 60 * 60 * 1000;
/** How long a `*.lar-tmp-*` file must stand untouched before housekeeping reads it as an orphan: a live atomic write
 *  lasts milliseconds, so ten minutes leaves no write in flight. */
export const TEMP_ORPHAN_SETTLE_MS = 10 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const ORPHAN_MARK = ".lar-tmp-";

/** The clock housekeeping reads and the scheduler that wakes it: injected, so no suite reads the wall clock. */
export interface TempHousekeepingClock {
  now(): number;
  /** Run `fn` every `ms`; the returned function stops it. */
  every(ms: number, fn: () => void): () => void;
}

/** The node clock, the temp layer's ONE wall read: age expiry and the orphan settle window measure a file's age against
 *  wall time, so every housekeeping run reads `now` here alone (a suite injects its own), with an unref'd interval, so a
 *  standing schedule never holds a process open. */
export const systemHousekeepingClock: TempHousekeepingClock = {
  now: () => Date.now(),
  every: (ms, fn) => {
    const timer = setInterval(fn, ms);
    timer.unref?.();
    return () => clearInterval(timer);
  },
};

/** What the config says for one temp layer at the moment a run reads it. */
export interface TempHousekeepingPolicy {
  /** `projection.temp.<slug>` stands true. */
  readonly consent: boolean;
  /** `projection.tempExpiryDays.<slug>`, or null: housekeeping alone. */
  readonly expiryDays: number | null;
}

/** What the layer's store holds of a title: a live record, a tombstone (the record left), or no word at all. */
export type TempRecordState = "live" | "gone" | "absent";

/** One audit line, content-free. */
export interface TempAuditLine {
  readonly ts: string;
  readonly action: "orphan-removed" | "obsolete-removed" | "expired-to-trash" | "trash-purged";
  readonly bag: string;
  readonly id: string;
  readonly outcome: string;
}

/** `<projections>/audit/<date>.ndjson`. */
export function tempAuditPath(projectionsRoot: string, date: string): string {
  return join(projectionsRoot, "audit", `${date}.ndjson`);
}

/** A clock reading's ISO forms: every time this layer writes comes off the one clock seam, never off a wall read. */
const isoTime = (ms: number): string => new Date(ms).toISOString();
const isoDate = (ms: number): string => isoTime(ms).slice(0, 10);
const idOf = (text: string): string => `sha256:${createHash("sha256").update(text, "utf8").digest("hex")}`;

/**
 * Parse one `.tid` carrier — the header block `name: value` up to the first blank line, then the text — into fields.
 * Null for bytes that name no title.
 */
export type TidFields = Record<string, string> & { readonly title: string };

export function parseTidCarrier(text: string): TidFields | null {
  const fields: Record<string, string> = {};
  const lines = text.split(/\r?\n/);
  let i = 0;
  for (; i < lines.length; i++) {
    const line = lines[i]!;
    if (line === "") { i++; break; }
    const colon = line.indexOf(":");
    if (colon <= 0) return null;
    fields[line.slice(0, colon).trim()] = line.slice(colon + 1).trim();
  }
  if (i < lines.length) fields["text"] = lines.slice(i).join("\n");
  return typeof fields["title"] === "string" && fields["title"] !== "" ? fields as TidFields : null;
}

/** Every file under `dir`, recursively, as absolute paths; an absent dir reads empty. */
function walkFiles(dir: string): string[] {
  const out: string[] = [];
  let names: string[];
  try { names = readdirSync(dir); } catch { return out; }
  for (const name of names) {
    const path = join(dir, name);
    let st;
    try { st = statSync(path); } catch { continue; }
    if (st.isDirectory()) out.push(...walkFiles(path));
    else if (st.isFile()) out.push(path);
  }
  return out;
}

/**
 * READ-BACK: every `.tid` carrier under a temp mirror re-enters the layer through `put`, synchronously before this
 * returns its count. A file under `<projections>/observe` refuses, an internal-volatile title never re-enters, an
 * orphan temp and a `.meta` sidecar never parse, and a title the layer already holds stays as the layer holds it.
 */
export function readBackTempCarriers(opts: {
  readonly mirrorRoot: string;
  readonly projectionsRoot: string;
  readonly holds: (title: string) => boolean;
  readonly put: (fields: TidFields) => void;
}): { readonly read: number; readonly refused: number } {
  let read = 0;
  let refused = 0;
  if (isObserveProjectionPath(opts.projectionsRoot, opts.mirrorRoot)) return { read, refused: 1 };
  for (const file of walkFiles(opts.mirrorRoot)) {
    if (!file.endsWith(".tid") || file.includes(ORPHAN_MARK)) continue;
    if (isObserveProjectionPath(opts.projectionsRoot, file)) { refused++; continue; }
    let fields: TidFields | null = null;
    try { fields = parseTidCarrier(readFileSync(file, "utf8")); } catch { /* unreadable: no record */ }
    if (fields === null || isTempLayerInternalTitle(fields["title"]!)) { refused++; continue; }
    if (opts.holds(fields["title"]!)) continue;
    opts.put(fields);
    read++;
  }
  return { read, refused };
}

/**
 * HOUSEKEEPING for one temp mirror. `run` reads the policy afresh, so a consent the operator withdrew reaches the next
 * run without a restart; a policy the config cannot answer (a malformed file) skips the run whole, since a misread
 * consent would read every settled carrier as obsolete.
 */
export class TempLayerHousekeeper {
  private stopSchedule: (() => void) | null = null;
  private running: Promise<void> = Promise.resolve();

  constructor(private readonly opts: {
    /** The mirror's bag (`wikis/<slug>/temp`), its slug (the consent key) and its root on disk. */
    readonly bagId: string;
    readonly slug: string;
    readonly mirrorRoot: string;
    /** `<root>/projections`: the trash and the audit rest under it. */
    readonly projectionsRoot: string;
    readonly policy: () => TempHousekeepingPolicy;
    /** What the layer's store holds of a title. */
    readonly record: (title: string) => Promise<TempRecordState>;
    /** The whole-carrier hash the projector last wrote at `path` (its Synced-tree base), or null where it wrote none. */
    readonly lastWritten: (title: string, path: string) => string | null;
    /** Drop the projector's base at `path`: the file left by housekeeping's hand, not a person's. */
    readonly forget: (title: string, path: string) => void;
    /** True while the projector holds the carrier open: a pending removal, a standing standoff, a write in flight. */
    readonly holdsOpen: (title: string) => boolean;
    readonly clock?: TempHousekeepingClock;
    readonly onError?: (err: unknown) => void;
  }) {}

  private get clock(): TempHousekeepingClock { return this.opts.clock ?? systemHousekeepingClock; }

  /** Run once now, then once per period, until `stop`. */
  start(): void {
    if (this.stopSchedule !== null) return;
    this.kick();
    this.stopSchedule = this.clock.every(HOUSEKEEPING_PERIOD_MS, () => this.kick());
  }

  /** Stop the schedule and wait for a run in flight. */
  async stop(): Promise<void> {
    this.stopSchedule?.();
    this.stopSchedule = null;
    await this.running;
  }

  private kick(): void {
    this.running = this.running.then(() => this.run()).catch((err) => this.opts.onError?.(err));
  }

  /** One pass: orphans, settled obsolete carriers, opt-in expiry, then the trash purge. */
  async run(): Promise<void> {
    let policy: TempHousekeepingPolicy;
    try { policy = this.opts.policy(); } catch (err) { this.opts.onError?.(err); return; }
    const now = this.clock.now();
    const files = walkFiles(this.opts.mirrorRoot);
    for (const file of files) {
      if (file.includes(ORPHAN_MARK)) { this.orphan(file, now); continue; }
      if (file.endsWith(".meta")) continue;   // a sidecar goes with its content file
      await this.carrier(file, policy, now);
    }
    if (policy.expiryDays !== null) this.purgeTrash(policy.expiryDays, now);
  }

  private orphan(file: string, now: number): void {
    let mtime: number;
    try { mtime = statSync(file).mtimeMs; } catch { return; }
    if (now - mtime < TEMP_ORPHAN_SETTLE_MS) return;
    const id = idOf(relative(this.opts.projectionsRoot, file));
    this.act("orphan-removed", id, () => unlinkSync(file), now);
  }

  private async carrier(file: string, policy: TempHousekeepingPolicy, now: number): Promise<void> {
    let body: string;
    let fields: TidFields | null;
    try { body = readFileSync(file, "utf8"); fields = parseTidCarrier(body); } catch { return; }
    if (fields === null) return;
    const title = fields["title"]!;
    if (this.opts.holdsOpen(title)) return;                                    // pending or conflicted
    const metaPath = `${file}.meta`;
    let meta: string | undefined;
    try { if (existsSync(metaPath)) meta = readFileSync(metaPath, "utf8"); } catch { return; }
    const last = this.opts.lastWritten(title, file);
    if (last === null || carrierHash(body, meta) !== last) return;            // a hand edited it, or the projector never wrote it
    const state = await this.opts.record(title);
    if (state === "absent") return;                                            // the sole copy
    const id = idOf(title);
    if (state === "gone" || !policy.consent) {
      this.act("obsolete-removed", id, () => {
        unlinkSync(file);
        if (meta !== undefined) rmSync(metaPath, { force: true });
        this.opts.forget(title, file);
      }, now);
      return;
    }
    if (policy.expiryDays === null) return;
    let mtime: number;
    try { mtime = statSync(file).mtimeMs; } catch { return; }
    if (now - mtime < policy.expiryDays * DAY_MS) return;
    const dest = join(this.opts.projectionsRoot, "trash", isoDate(now), relative(this.opts.projectionsRoot, file));
    this.act("expired-to-trash", id, () => {
      mkdirSync(dirname(dest), { recursive: true, mode: 0o700 });
      renameSync(file, dest);
      if (meta !== undefined) renameSync(metaPath, `${dest}.meta`);
      this.opts.forget(title, file);
    }, now);
  }

  /** Purge the trash days older than the window, inside this mirror's own subtree of each day. */
  private purgeTrash(days: number, now: number): void {
    const trash = join(this.opts.projectionsRoot, "trash");
    const rel = relative(this.opts.projectionsRoot, this.opts.mirrorRoot);
    if (rel.startsWith("..") || resolve(this.opts.projectionsRoot, rel) !== resolve(this.opts.mirrorRoot)) return;
    let dates: string[];
    try { dates = readdirSync(trash); } catch { return; }
    for (const date of dates) {
      const day = Date.parse(`${date}T00:00:00Z`);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(day) || now - day < days * DAY_MS) continue;
      const subtree = join(trash, date, rel);
      for (const file of walkFiles(subtree)) {
        if (file.endsWith(".meta") && existsSync(file.slice(0, -".meta".length))) continue;   // goes with its content file
        const isMeta = file.endsWith(".meta");
        let title: string | null = null;
        if (!isMeta) { try { title = parseTidCarrier(readFileSync(file, "utf8"))?.["title"] ?? null; } catch { /* unreadable */ } }
        const id = idOf(title ?? relative(trash, file));
        this.act("trash-purged", id, () => {
          unlinkSync(file);
          if (!isMeta) rmSync(`${file}.meta`, { force: true });
        }, now);
      }
      pruneEmpty(subtree, join(trash, date));
    }
  }

  /** Run one act and append its audit line, whatever its outcome. */
  private act(action: TempAuditLine["action"], id: string, fn: () => void, now: number): void {
    let outcome = "ok";
    try { fn(); } catch (err) { outcome = `error:${(err as NodeJS.ErrnoException).code ?? "unknown"}`; }
    const line: TempAuditLine = { ts: isoTime(now), action, bag: this.opts.slug, id, outcome };
    const path = tempAuditPath(this.opts.projectionsRoot, isoDate(now));
    try {
      mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
      appendFileSync(path, `${JSON.stringify(line)}\n`, { mode: 0o600 });
    } catch (err) { this.opts.onError?.(err); }
  }
}

/** Remove the empty directories at and under `dir`, then each emptied parent up to and including `stop`. */
function pruneEmpty(dir: string, stop: string): void {
  const prune = (d: string): void => {
    let names: string[];
    try { names = readdirSync(d); } catch { return; }
    for (const name of names) { const p = join(d, name); try { if (statSync(p).isDirectory()) prune(p); } catch { /* left */ } }
    try { rmdirSync(d); } catch { /* holds files, or left */ }
  };
  const end = resolve(stop);
  prune(resolve(dir));
  for (let cur = dirname(resolve(dir)); cur === end || cur.startsWith(end + sep); cur = dirname(cur)) {
    try { rmdirSync(cur); } catch { break; }
    if (cur === end) break;
  }
}
