/**
 * synced-tree — the per-carrier merge base (the Confluence's third leg; handoff
 * #pattern-integrities §6, the Nucleus triangle).
 *
 * For every carrier the two legs last agreed on, this tree persists the BASE: the
 * hash of the bytes the disk held and the hash of the render the records carried.
 * Disk and records co-project one carrier, each in its own grain, so an agreement
 * names both. The two hashes read equal where the disk holds the canonical render
 * (every projector write leaves them so) and differ where the disk stands in a
 * framing the render would normalize. Each gate compares a disk read against the
 * disk side and the records' current render against the records side to decide
 * noop / ingest / project / conflict — three-way diffs, never timestamps, never
 * event windows (state-match law; Dropbox Nucleus, Syncthing #10351).
 *
 * Law: persist OBSERVATIONS, never work-queues — crash recovery = full
 * scan + re-diff against this tree; no journal replay. Writes go atomic
 * (temp + rename, same dir) so a crash never leaves a torn tree; a
 * missing or corrupt tree degrades to "never projected" (fresh-adoption
 * ingest decisions), which converges, never corrupts.
 *
 * ONE FILE, MANY WRITERS. Every projector in the vessel shares this tree: the
 * daemon island mirrors wikis/daemon + bags/crossroads, each wiki island mirrors
 * its recipe's bags, and the CLI's ingest gate records packs and confirmed renames.
 * They live in separate workers and separate processes, so each holds its own map
 * loaded at open. Persistence is therefore a MERGE, never a whole-map overwrite:
 * a write re-reads the file and lays only THIS instance's changes over it. A
 * whole-map write would erase every observation a sibling recorded after our load,
 * and a bag whose observations vanish reads `new` forever — the echo gate re-lands
 * it and no deletion is detectable at all (the ingest gate needs a synced hash to
 * call a vanished path a deletion).
 */

import { readFileSync, writeFileSync, renameSync, mkdirSync, existsSync } from "fs";
import { dirname, join } from "path";
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

/** One carrier's base: what the disk held and what the records rendered at the last agreement. */
export interface SyncedBase {
  /** Whole-carrier hash of the bytes the disk held (body plus `.meta`). */
  readonly disk: string;
  /** Whole-carrier hash of the render the records carried. */
  readonly records: string;
}

/** A persisted row reads as a base only in the one shape this tree writes; any other value names no base. */
function baseOf(value: unknown): SyncedBase | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  const { disk, records } = value as Record<string, unknown>;
  return typeof disk === "string" && disk !== "" && typeof records === "string" && records !== "" ? { disk, records } : null;
}

/** The persisted file as a map, keeping the rows that read as a base, and the count of rows that read as none.
 *  An absent or torn file reads empty. */
function readBases(filePath: string): { bases: Map<string, SyncedBase>; unread: number } {
  const bases = new Map<string, SyncedBase>();
  let unread = 0;
  try {
    const raw = JSON.parse(readFileSync(filePath, "utf8")) as Record<string, unknown>;
    for (const [key, value] of Object.entries(raw)) {
      const base = baseOf(value);
      if (base) bases.set(key, base); else unread++;
    }
  } catch { /* absent or torn: every carrier reads as never agreed */ }
  return { bases, unread };
}

export class SyncedTree {
  private map = new Map<string, SyncedBase>();   // `${bagId}\0${carrier-root URI}` → the base (a carrier may project to multiple mirrors)
  private persistTimer: ReturnType<typeof setTimeout> | null = null;

  /** THIS instance's changes since its last persist — the merge delta laid over the
   *  file's current contents. A base records an observation, `null` records a removal
   *  (so a delete lands instead of resurrecting from the sibling-written file). */
  private journal = new Map<string, SyncedBase | null>();

  /**
   * R2 rename-index — the CONTENT-addressed reverse view: `${bagId}\0${canonical-hash}`
   * → the set of carrier URIs in that bag currently observing that exact content.
   * MIRRORS `map` exactly (every live primary observation appears here), so a lookup
   * answers "which live carrier(s) in this bag hold this content right now". A rename
   * keeps the whole-carrier `carrierHash` identical while the location (uri) moves, so
   * this index recovers the moved observation by CONTENT before the echo gate mis-reads
   * the new location as `new` and re-lands it (#46 content-addressing, deferred R2).
   *
   * DERIVED, never persisted: rebuilt from `map` on load, and a torn/absent tree degrades
   * to fresh-adoption. The index keys on the base's DISK side: a rename moves a file, and
   * the scan that looks a moved file up holds its bytes. The hash canonicalizes through
   * `tagDigest`, so every tagged spelling of one digest lands on ONE index key; a bare
   * value parses as nothing and stays out of the index.
   */
  private byHash = new Map<string, Set<string>>();

  constructor(
    private readonly filePath: string,
    /**
     * Persist coalesce window (ms). A flush wave (a corpus feed = hundreds
     * of observations in seconds) collapses into one atomic write per
     * quiet window instead of one per observation. 0 = persist immediately
     * (tests). A crash inside the window forgets at most the last few
     * observations — which degrade to fresh-adoption decisions, never
     * corruption (the Confluence's recovery law).
     */
    private readonly coalesceMs = 250,
  ) {
    // A corrupt tree, or a row in any shape but the one this tree writes, names no base: that
    // carrier reads as never agreed and each gate falls back to its fresh-adoption answer.
    if (existsSync(filePath)) {
      const { bases, unread } = readBases(filePath);
      this.map = bases;
      // A FORGOTTEN BASE SPEAKS ONCE. A row this tree cannot read leaves its carrier with no merge base,
      // and a projection or an ingest over that carrier then decides as a fresh adoption. The line names
      // how many, so a hand that kept an earlier vessel's state reads why before the first write.
      if (unread > 0) console.warn(`[synced-tree] ${unread} row(s) of ${filePath} name no base in this tree's shape; each such carrier reads as never agreed`);
    }
    this.rebuildIndex();
  }

  /** The base's DISK side: the hash of the bytes the disk held at the last agreement, or null. */
  get(uri: string): string | null {
    return this.map.get(uri)?.disk ?? null;
  }

  /** The whole base, both sides, or null where the two legs never agreed. */
  base(uri: string): SyncedBase | null {
    return this.map.get(uri) ?? null;
  }

  /**
   * Record an agreement; persistence coalesces per quiet window. `diskHash` names the bytes the disk
   * holds; `recordsHash` names the render the records carry, and equals `diskHash` where the disk holds
   * that render (a projector write, a byte-identical skip).
   */
  set(uri: string, diskHash: string, recordsHash: string = diskHash): void {
    const prev = this.map.get(uri);
    if (prev !== undefined) this.indexRemove(uri, prev.disk);   // the prior value leaves the reverse view
    const base: SyncedBase = { disk: diskHash, records: recordsHash };
    this.map.set(uri, base);
    this.indexAdd(uri, diskHash);                               // the new content enters it
    this.journal.set(uri, base);
    this.schedulePersist();
  }

  delete(uri: string): void {
    const prev = this.map.get(uri);
    if (this.map.delete(uri)) {
      if (prev !== undefined) this.indexRemove(uri, prev.disk);
      this.journal.set(uri, null);
      this.schedulePersist();
    }
  }

  /**
   * R2 rename resolution — given a bag and a carrier's whole-carrier hash, answer the
   * UNIQUE live carrier URI currently observing that exact content in that bag, else
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
    const bucket = this.byHash.get(ik);
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

  private indexAdd(key: string, hash: string): void {
    const { bagId, uri } = this.splitKey(key);
    const ik = this.hashIndexKey(bagId, hash);
    if (ik === null) return;
    let bucket = this.byHash.get(ik);
    if (!bucket) { bucket = new Set(); this.byHash.set(ik, bucket); }
    bucket.add(uri);
  }

  private indexRemove(key: string, hash: string): void {
    const { bagId, uri } = this.splitKey(key);
    const ik = this.hashIndexKey(bagId, hash);
    if (ik === null) return;
    const bucket = this.byHash.get(ik);
    if (!bucket) return;
    bucket.delete(uri);
    if (bucket.size === 0) this.byHash.delete(ik);
  }

  /** Rebuild the reverse index from the primary map (load-time; the index never persists). */
  private rebuildIndex(): void {
    this.byHash.clear();
    for (const [key, base] of this.map) this.indexAdd(key, base.disk);
  }

  get size(): number {
    return this.map.size;
  }

  /** Force any pending coalesced write to land now (shutdown hook, tests). */
  flush(): void {
    if (this.persistTimer) { clearTimeout(this.persistTimer); this.persistTimer = null; }
    this.persist();
  }

  private schedulePersist(): void {
    if (this.coalesceMs <= 0) { this.persist(); return; }
    if (this.persistTimer) clearTimeout(this.persistTimer);
    this.persistTimer = setTimeout(() => { this.persistTimer = null; this.persist(); }, this.coalesceMs);
    // Never hold the process open just to remember faster.
    (this.persistTimer as { unref?: () => void }).unref?.();
  }

  /**
   * Read-merge-write: the file's current contents take our journal on top, so a
   * sibling writer's observations survive our write and our own removals still land.
   * The merged result becomes our map (the shared state IS the truth), and the
   * rename-index rebuilds over it. A torn or absent file merges onto nothing —
   * the same fresh-adoption degradation the constructor already allows.
   */
  private persist(): void {
    const dir = dirname(this.filePath);
    mkdirSync(dir, { recursive: true });
    const merged = readBases(this.filePath).bases;
    for (const [k, v] of this.journal) { if (v === null) merged.delete(k); else merged.set(k, v); }
    this.journal.clear();
    this.map = merged;
    this.rebuildIndex();
    // The temp name carries a per-write nonce, not just the pid: island projectors are
    // worker THREADS of ONE process, so a pid-keyed name is the same name twice and one
    // rename could carry the other's half-written bytes.
    const tmp = join(dir, `.synced-tree.${process.pid}.${++SyncedTree.writeSeq}.${randomBytes(4).toString("hex")}.tmp`);
    writeFileSync(tmp, JSON.stringify(Object.fromEntries(merged), null, 1), "utf-8");
    renameSync(tmp, this.filePath);
  }

  /** Per-process write counter — one half of the temp file's unique name. */
  private static writeSeq = 0;
}
