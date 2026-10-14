/**
 * synced-tree — the per-carrier merge base (the Confluence's third leg; handoff
 * #pattern-integrities §6, the Nucleus triangle).
 *
 * For every file the two legs last agreed on, this tree persists the BASE: the
 * path the agreement stood at, the hash of the bytes the disk held there, and the hash
 * of the render the records carried. Disk and records co-project one carrier, each in
 * its own grain, so an agreement names both. AN AGREEMENT STANDS AT ONE PATH, AND A
 * CARRIER HOLDS ONE ROW PER PATH: the projector's base at the mirror file and the ingest
 * gesture's base at a holding file beside the mirror stand side by side, and neither
 * displaces the other. A carrier re-sited to another path holds no base there, so a file
 * absent at the new path reads as never written, while a file absent at a base's own
 * path reads as vanished. The two hashes read equal where the disk holds the canonical
 * render (every projector write leaves them so) and differ where the disk stands in a
 * framing the render would normalize. Each gate compares a disk read against the
 * disk side and the records' current render against the records side to decide
 * noop / ingest / project / conflict — three-way diffs, never timestamps, never
 * event windows (state-match law; Dropbox Nucleus, Syncthing #10351).
 *
 * Law: persist OBSERVATIONS, never work-queues — crash recovery = full
 * scan + re-diff against this tree; no journal replay.
 *
 * ONE FILE PER ROW, MANY WRITERS. Every projector in the vessel shares this tree: the
 * daemon island mirrors wikis/daemon + bags/crossroads, each wiki island mirrors
 * its recipe's bags, and the CLI's ingest gesture records what it landed. They live in
 * separate workers and separate processes. The tree rests as a DIRECTORY, one file per
 * row, each named by its carrier and its path and written whole (a temp file in the same
 * directory, then a rename). A writer touches only the rows it changed and reads no
 * other row to do so, so no read-merge-write window exists and two writers in one
 * moment drop no row: no lock, no holder to outlive, no clock. Two writers of the SAME
 * row leave the later rename standing, whole. A row that reads torn, or in any shape but
 * the one this tree writes, names no base: its carrier reads as never agreed there,
 * which converges and never corrupts.
 */

import { readFileSync, writeFileSync, renameSync, mkdirSync, readdirSync, unlinkSync, statSync } from "fs";
import { join, resolve } from "path";
import { randomBytes } from "crypto";
import { tagDigest, formatDigest, sha256HexSync } from "@lararium/mesh";

/** A text's tagged sha256 digest (`sha256:<hex>`) — the body-only hash the projector's byte-skip compares. */
export function contentHash(text: string): string {
  return formatDigest("sha256", sha256HexSync(text));
}

/** The canonical Synced-tree key: bag-id + carrier-root URI, NUL-joined.
 *  ONE source of truth — readers (ingest) and writers (projector) MUST call
 *  this, never hand-build the key (a separator drift silently reads every
 *  carrier as `new`, breaking ingest quiescence). */
export function syncedTreeKey(bagId: string, uri: string): string {
  return `${bagId}\0${uri}`;
}

/** The one spelling of a path a base carries: absolute and normalized, symlinks unread. The projector's
 *  confined write path and the ingest gesture's scanned file both pass through here. */
export function syncedPath(file: string): string {
  return resolve(file);
}

/** The directory a vessel's Synced tree rests in, under its projection directory. */
export function syncedTreeDir(projectionDir: string): string {
  return join(projectionDir, "synced-tree");
}

/** One base: where the agreement stood, what the disk held there and what the records rendered. */
export interface SyncedBase {
  /** The content file the agreement stood at (`syncedPath`). */
  readonly path: string;
  /** Whole-carrier hash of the bytes the disk held (body plus `.meta`). */
  readonly disk: string;
  /** Whole-carrier hash of the render the records carried. */
  readonly records: string;
}

/** One row as it rests: the carrier's key beside its base. */
interface Row { readonly key: string; readonly base: SyncedBase }

const filled = (v: unknown): v is string => typeof v === "string" && v !== "";

/** A row file reads as a row only in the one shape this tree writes; any other value names no base. */
function rowOf(value: unknown): Row | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  const { key, path, disk, records } = value as Record<string, unknown>;
  return filled(key) && filled(path) && filled(disk) && filled(records) ? { key, base: { path, disk, records } } : null;
}

const stem = (s: string): string => sha256HexSync(s).slice(0, 32);
/** A row's file name: its carrier, then its path. The name never moves, so a write replaces the row whole,
 *  and every row of one carrier shares the leading stem. */
const rowFile = (key: string, path: string): string => `${stem(key)}.${stem(path)}.json`;
/** One row's place inside an instance's map. */
const rowId = (key: string, path: string): string => `${key}\0${path}`;
/** A row file's name, as against a temp file or a stranger's. */
const ROW_NAME = /^[0-9a-f]{32}\.[0-9a-f]{32}\.json$/;

/** Read the row files of a tree directory (those of one carrier where `key` names it), and count the files
 *  that read as no row. An absent directory reads empty. */
function readRows(dir: string, key?: string): { rows: Row[]; unread: number } {
  const rows: Row[] = [];
  let unread = 0;
  let names: string[];
  try { names = readdirSync(dir); } catch { return { rows, unread }; }
  const lead = key === undefined ? null : `${stem(key)}.`;
  for (const name of names) {
    if (!ROW_NAME.test(name) || (lead !== null && !name.startsWith(lead))) continue;
    let row: Row | null = null;
    try { row = rowOf(JSON.parse(readFileSync(join(dir, name), "utf8"))); } catch { /* torn, or it left since the listing */ }
    // A row rests under the name its own key and path fold to; any other pairing names no base.
    if (row !== null && rowFile(row.key, row.base.path) === name && (key === undefined || row.key === key)) rows.push(row);
    else unread++;
  }
  return { rows, unread };
}

export class SyncedTree {
  /** `rowId` → the row. A carrier may hold several: one per path an agreement stands at. */
  private map = new Map<string, Row>();
  /** A carrier's key → the ids of its rows. Mirrors `map`. */
  private byKey = new Map<string, Set<string>>();
  private persistTimer: ReturnType<typeof setTimeout> | null = null;

  /** THIS instance's changes since its last persist, by row. A row records an observation; a path alone
   *  records a removal. */
  private journal = new Map<string, Row | { readonly key: string; readonly gone: string }>();

  /**
   * R2 rename-index — the CONTENT-addressed reverse view: `${bagId}\0${canonical-hash}`
   * → the set of carrier URIs in that bag that hold a base observing that exact content.
   * A rename keeps the whole-carrier `carrierHash` identical while the location (uri) moves, so
   * this index recovers the moved observation by CONTENT before the echo gate mis-reads
   * the new location as `new` and re-lands it (#46 content-addressing, deferred R2).
   *
   * DERIVED, never persisted: rebuilt from `map` on the first lookup after a change. The index keys on
   * the base's DISK side: a rename moves a file, and the scan that looks a moved file up holds its
   * bytes. The hash canonicalizes through `tagDigest`, so every tagged spelling of one digest lands on
   * ONE index key; a bare value parses as nothing and stays out of the index.
   */
  private byHash: Map<string, Set<string>> | null = null;

  constructor(
    /** The directory the tree rests in. Null holds the bases in memory for this instance's life and persists nothing. */
    private dirPath: string | null,
    /**
     * Persist coalesce window (ms). A flush wave (a corpus feed = hundreds
     * of observations in seconds) collapses into one pass per
     * quiet window instead of one per observation. 0 = persist immediately
     * (tests). A crash inside the window forgets at most the last few
     * observations — which degrade to fresh-adoption decisions, never
     * corruption (the Confluence's recovery law).
     */
    private readonly coalesceMs = 250,
  ) {
    if (dirPath === null) return;
    // A TREE IN AN EARLIER SHAPE NAMES NO BASE, AND SAYS SO BY NAME. A vessel founded under the single-file
    // tree keeps that file beside this directory. Nothing reads it and nothing rewrites it: every carrier
    // reads as never agreed, and each gate falls back to its fresh-adoption answer (an unchanged corpus pins
    // anew and writes nothing; a real difference stands off for a person).
    // A file standing at the directory's own path leaves this tree nowhere to rest: it holds its bases in memory.
    for (const earlier of [`${dirPath}.json`, dirPath]) {
      let isFile = false;
      try { isFile = statSync(earlier).isFile(); } catch { /* absent */ }
      if (!isFile) continue;
      console.warn(`[synced-tree] ${earlier} holds a tree in an earlier shape; it names no base here, and each carrier reads as never agreed`);
      if (earlier === dirPath) { this.dirPath = null; return; }
    }
    const { rows, unread } = readRows(dirPath);
    for (const row of rows) this.put(row);
    // A FORGOTTEN BASE SPEAKS ONCE. A row this tree cannot read leaves its carrier with no merge base
    // at that path, and a projection or an ingest there then decides as a fresh adoption.
    if (unread > 0) console.warn(`[synced-tree] ${unread} row(s) of ${dirPath} name no base in this tree's shape; each such carrier reads as never agreed`);
  }

  private put(row: Row): void {
    const id = rowId(row.key, row.base.path);
    this.map.set(id, row);
    let ids = this.byKey.get(row.key);
    if (!ids) { ids = new Set(); this.byKey.set(row.key, ids); }
    ids.add(id);
    this.byHash = null;
  }

  private drop(key: string, path: string): boolean {
    const id = rowId(key, path);
    if (!this.map.delete(id)) return false;
    const ids = this.byKey.get(key);
    ids?.delete(id);
    if (ids?.size === 0) this.byKey.delete(key);
    this.byHash = null;
    return true;
  }

  /** Every base the carrier holds, one per path an agreement stands at. */
  bases(key: string): SyncedBase[] {
    return [...(this.byKey.get(key) ?? [])].map((id) => this.map.get(id)!.base);
  }

  /** The carrier's base where it holds exactly one, or null where it holds none or several. A caller that
   *  means one file asks `baseAt`; a caller that means every file asks `bases`. */
  base(key: string): SyncedBase | null {
    const all = this.bases(key);
    return all.length === 1 ? all[0]! : null;
  }

  /** The DISK side of the carrier's one base (`base`), or null. */
  get(key: string): string | null {
    return this.base(key)?.disk ?? null;
  }

  /** The base that stands AT `file`, or null: an agreement reached at another path names no base here. */
  baseAt(key: string, file: string): SyncedBase | null {
    return this.map.get(rowId(key, syncedPath(file)))?.base ?? null;
  }

  /**
   * Record an agreement; persistence coalesces per quiet window. `file` names the content file the
   * agreement stands at; `diskHash` names the bytes the disk holds there; `recordsHash` names the render
   * the records carry, and equals `diskHash` where the disk holds that render (a projector write, a
   * byte-identical skip). The carrier's bases at other paths stand as they stood.
   */
  set(key: string, file: string, diskHash: string, recordsHash: string = diskHash): void {
    const row: Row = { key, base: { path: syncedPath(file), disk: diskHash, records: recordsHash } };
    this.put(row);
    this.journal.set(rowId(key, row.base.path), row);
    this.schedulePersist();
  }

  /** The base at `file` leaves; the carrier's bases at other paths stay. */
  deleteAt(key: string, file: string): void {
    const path = syncedPath(file);
    if (!this.drop(key, path)) return;
    this.journal.set(rowId(key, path), { key, gone: path });
    this.schedulePersist();
  }

  /** Every base of the carrier leaves. */
  delete(key: string): void {
    for (const base of this.bases(key)) this.deleteAt(key, base.path);
  }

  /**
   * R2 rename resolution — given a bag and a carrier's whole-carrier hash, answer the
   * UNIQUE live carrier URI that holds a base observing that exact content in that bag, else
   * null. Null on no match OR an AMBIGUOUS match (>1 live carrier shares the content —
   * two-carriers-same-content; the caller MUST NOT guess, mirroring the delete-gate's
   * decline-on-collision). Spelling-agnostic: every tagged spelling of one digest reads
   * one index key; a bare hash names no algorithm and resolves nothing.
   * A rename is confirmed by the CALLER (the moved uri differs AND the source file is
   * gone from disk — a copy leaves the source live and never resolves here).
   */
  renameSourceUri(bagId: string, hash: string): string | null {
    const ik = this.hashIndexKey(bagId, hash);
    if (ik === null) return null;
    const bucket = this.index().get(ik);
    if (!bucket || bucket.size !== 1) return null;         // unseen or ambiguous → decline, never guess
    return bucket.values().next().value ?? null;
  }

  /** Split a primary key `${bagId}\0${uri}` back into its two terms (NUL never
   *  appears inside a bagId or a lar: uri, so the first NUL is the sole boundary). */
  private splitKey(key: string): { bagId: string; uri: string } {
    const i = key.indexOf("\0");
    return i < 0 ? { bagId: "", uri: key } : { bagId: key.slice(0, i), uri: key.slice(i + 1) };
  }

  /** The reverse-index key for a (bagId, hash) pair — the hash canonicalized so every
   *  tagged spelling of one digest collapses together. A malformed or bare
   *  hash returns null (that observation simply stays out of the rename-index — it
   *  degrades to a fresh-adoption decision, never a crash). */
  private hashIndexKey(bagId: string, hash: string): string | null {
    try { return `${bagId}\0${tagDigest(hash)}`; } catch { return null; }
  }

  /** The reverse index over the rows as they stand (the index never persists). */
  private index(): Map<string, Set<string>> {
    if (this.byHash !== null) return this.byHash;
    const byHash = new Map<string, Set<string>>();
    for (const { key, base } of this.map.values()) {
      const { bagId, uri } = this.splitKey(key);
      const ik = this.hashIndexKey(bagId, base.disk);
      if (ik === null) continue;
      let bucket = byHash.get(ik);
      if (!bucket) { bucket = new Set(); byHash.set(ik, bucket); }
      bucket.add(uri);
    }
    return (this.byHash = byHash);
  }

  /** Every row the tree holds: the carrier's bag and address beside its base. */
  rows(): Array<{ readonly bagId: string; readonly uri: string; readonly base: SyncedBase }> {
    return [...this.map.values()].map(({ key, base }) => ({ ...this.splitKey(key), base }));
  }

  /** How many rows the tree holds. */
  get size(): number {
    return this.map.size;
  }

  /** Force any pending coalesced write to land now (shutdown hook, tests). */
  flush(): void {
    if (this.persistTimer) { clearTimeout(this.persistTimer); this.persistTimer = null; }
    this.persist();
  }

  private schedulePersist(): void {
    // A tree held in memory persists nothing, so it arms no timer.
    if (this.dirPath === null) { this.journal.clear(); return; }
    if (this.coalesceMs <= 0) { this.persist(); return; }
    if (this.persistTimer) clearTimeout(this.persistTimer);
    this.persistTimer = setTimeout(() => { this.persistTimer = null; this.persist(); }, this.coalesceMs);
    // Never hold the process open just to remember faster.
    (this.persistTimer as { unref?: () => void }).unref?.();
  }

  /**
   * Each changed row lands as its own file, whole: a temp file in the tree's directory, then a rename
   * onto the row's name; a removed row's file unlinks. No other row gets read or rewritten, so a sibling
   * writer's rows stand whatever this instance held when it loaded.
   */
  private persist(): void {
    if (this.dirPath === null || this.journal.size === 0) { this.journal.clear(); return; }
    const dir = this.dirPath;
    mkdirSync(dir, { recursive: true });
    for (const change of this.journal.values()) {
      if ("gone" in change) {
        try { unlinkSync(join(dir, rowFile(change.key, change.gone))); } catch { /* it already left */ }
        continue;
      }
      // The temp name carries a per-write nonce beside the pid: island projectors run as worker THREADS
      // of ONE process, so a pid-keyed name names one file twice. A leading dot keeps it out of every read.
      const tmp = join(dir, `.row.${process.pid}.${++SyncedTree.writeSeq}.${randomBytes(4).toString("hex")}.tmp`);
      writeFileSync(tmp, JSON.stringify({ key: change.key, ...change.base }), "utf-8");
      renameSync(tmp, join(dir, rowFile(change.key, change.base.path)));
    }
    this.journal.clear();
  }

  /**
   * Read the directory afresh and lay this instance's unpersisted changes over it: every row, or the rows
   * of one carrier where `key` names it. A sibling writer (another island, the ingest gesture) may have
   * pinned a base since this instance loaded; a caller about to surface a divergence reads through here
   * first, so a base a sibling pinned answers before an alert does.
   */
  reread(key?: string): void {
    if (this.dirPath === null) return;
    const { rows } = readRows(this.dirPath, key);
    for (const row of key === undefined ? [...this.map.values()] : [...(this.byKey.get(key) ?? [])].map((id) => this.map.get(id)!)) {
      this.drop(row.key, row.base.path);
    }
    for (const row of rows) this.put(row);
    for (const change of this.journal.values()) {
      if (key !== undefined && change.key !== key) continue;
      if ("gone" in change) this.drop(change.key, change.gone); else this.put(change);
    }
  }

  /** Per-process write counter — one half of the temp file's unique name. */
  private static writeSeq = 0;
}
