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
 * daemon island mirrors faces/<pet name>/{wikis/daemon,bags/daemon,bags/kahua} + bags/crossroads, each wiki island mirrors
 * its recipe's bags, and the CLI's ingest gesture records what it landed. They live in
 * separate workers and separate processes. The tree rests as a DIRECTORY, one file per
 * row, each named by its carrier and its path and written whole (a temp file in the same
 * directory, then a rename). A writer touches only the rows it changed and reads no
 * other row to do so, so no read-merge-write window exists and two writers in one
 * moment drop no row: no lock, no holder to outlive, no clock.
 *
 * AN OBSERVATION RESTS THE MOMENT IT GETS RECORDED. `set` lands its row and `deleteAt` unlinks
 * its row before either returns; no instance holds a change back for a later write, save a pin that waits on its
 * seal (THE BASE PINS ONLY WHAT SEALED, below). Two writers of
 * the SAME row therefore leave the LATER OBSERVATION standing, whole: a row never lands behind a
 * sibling's newer word, and a row a sibling removed never returns from another instance's memory.
 * THE DIRECTORY'S WORD STANDS. A landing the disk refuses gets named, and the instance reads that one row
 * back from the directory: an observation the disk never took rests nowhere, a row the disk would not give
 * up stands in memory as it stands on disk, and a row a sibling moved meanwhile answers as the sibling left
 * it. Where the disk refuses that read too, the instance keeps the row it held before the act. Nothing
 * retries on a timer (an observation written late would claim a moment that passed); the next gate that
 * weighs the carrier meets the base the directory holds, finds it behind, and pins anew.
 *
 * A BASE LEAVES WITH ITS OWN FILE. A carrier's rows stand one per path, and each leaves alone
 * (`deleteAt`): the file a hand keeps in a holding directory keeps its base while the mirror's
 * file and base leave, so its next scan still reads it against the agreement it reached.
 *
 * A row that reads torn, or in any shape but the one this tree writes, names no base: its
 * carrier reads as never agreed there, which converges and never corrupts.
 *
 * A BASE NAMES THE DOCUMENT ITS RECORDS SIDE READ (`doc`), where its writer names one. Several documents may
 * serve one bag id over one mirror root: each face of a vessel mounts its own workbench document for an unshared
 * wiki. The agreement a base records holds between a file and ONE document's records, so a projector that reads
 * another document treats the file as that other document's (`disk-projector.ts`, `otherDocument`). A writer that
 * names no document (the ingest gesture, a mirror over a store with none) leaves `doc` off the row.
 *
 * A BASE NAMES THE HISTORY ITS RECORDS SIDE READ (`heads`), where its writer holds one: the document's heads when the
 * agreement stood. Two hashes say what each side held and nothing of which came first, so a document that reads back
 * WITHOUT the write an agreement saw (a save that never rested, a snapshot restored, a blank doc standing in for one
 * that failed to load) looks exactly like records that moved on. The heads tell the two apart by causal identity, no
 * clock: a document that still holds the base's heads moved forward from the agreement, and one that lacks them fell
 * behind it. The projector reads the second as a standoff and writes nothing over the file (`disk-projector.ts`,
 * `pastRecords`). A row with no heads vouches as it always did.
 *
 * THE BASE PINS ONLY WHAT SEALED. A tree handed a rest (`rests`: the vessel's reading of a document's heads at rest) holds a
 * row that names a document and its heads in memory as PENDING, and lands it in the directory only once those heads rest in
 * the vessel's sealed rest. A base that vouched for heads no rest holds would read, after a crash, as records that fell
 * behind, and stand off a file the house itself wrote. The pending row answers every read in this instance at once, so the
 * projector decides as it always did; only its landing waits. The tree asks at the pin, and again at each settle (`settle`:
 * the projector's idle, the shore's flush), never on a timer. A pending row a crash takes costs nothing: the projector wrote
 * the canonical render, so the next boot reads disk == records with no base between them and pins again. A row that names
 * no document or no heads (the ingest gesture, a store with no history) lands at once, as before. A rest that answers
 * nothing it can read (none stands, it faulted, the ask never crossed) reads `unread`, never rested: the pin stays pending,
 * named so where the shore shows pins. The landing compares and sets on the directory's row the pin was set over, so a
 * sibling island's newer row for the same path stands and the superseded pin drops with no write.
 */

import { readFileSync, writeFileSync, renameSync, mkdirSync, readdirSync, unlinkSync, statSync } from "fs";
import { join, resolve, sep } from "path";
import { randomBytes } from "crypto";
import { tagDigest, formatDigest } from "@lararium/mesh/agile-digest";
import { sha256HexSync } from "@lararium/mesh/crypto";

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
/** The vessel's reading of a document's heads at rest (`@lararium/mesh/sealed-rest`, `headsRestAt`). */
export type HeadsRestReading = "rested" | "waiting" | "unread";

export interface SyncedBase {
  /** The content file the agreement stood at (`syncedPath`). */
  readonly path: string;
  /** Whole-carrier hash of the bytes the disk held (body plus `.meta`). */
  readonly disk: string;
  /** Whole-carrier hash of the render the records carried. */
  readonly records: string;
  /** The document whose records the agreement read, where the writer named one. */
  readonly doc?: string;
  /** The heads that document stood at when the agreement was read, where the writer held them. */
  readonly heads?: readonly string[];
}

/** One row as it rests: the carrier's key beside its base. */
interface Row { readonly key: string; readonly base: SyncedBase }

const filled = (v: unknown): v is string => typeof v === "string" && v !== "";

/** A row file reads as a row only in the one shape this tree writes; any other value names no base. */
function rowOf(value: unknown): Row | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  const { key, path, disk, records, doc, heads } = value as Record<string, unknown>;
  if (!(filled(key) && filled(path) && filled(disk) && filled(records)) || (doc !== undefined && !filled(doc))) return null;
  if (heads !== undefined && !(Array.isArray(heads) && heads.length > 0 && heads.every(filled))) return null;
  return { key, base: { path, disk, records, ...(doc !== undefined ? { doc } : {}), ...(heads !== undefined ? { heads: heads as string[] } : {}) } };
}

const stem = (s: string): string => sha256HexSync(s).slice(0, 32);
/** The directory the kāpae shadows' rows rest in, inside the tree's own (`shadows`). No row file takes its name. */
const SHADOW_DIR = "kapae";
/** A row's file name: its carrier, then its path. The name never moves, so a write replaces the row whole,
 *  and every row of one carrier shares the leading stem. */
const rowFile = (key: string, path: string): string => `${stem(key)}.${stem(path)}.json`;
/** One row's place inside an instance's map. */
const rowId = (key: string, path: string): string => `${key}\0${path}`;
/** A row file's name, as against a temp file or a stranger's. */
const ROW_NAME = /^[0-9a-f]{32}\.[0-9a-f]{32}\.json$/;

/** A pin waiting on its seal: its row, the directory's row it was set over (undefined where the disk refused that read),
 *  and why it still waits. */
interface PendingPin { readonly row: Row; readonly over: Row | null | undefined; why: string }
const PENDING_ASKED = "pending: rest asked";
const PENDING_WAITING = "pending: heads not yet sealed";
const PENDING_UNREAD = "pending: rest unread";
const PENDING_UNREAD_ROW = "pending: the directory's row unread";

/** Two rows name one agreement: the same carrier, path, both hashes, document and heads. */
function sameRow(a: Row | null | undefined, b: Row | null | undefined): boolean {
  if (a === undefined || b === undefined) return false;
  if (a === null || b === null) return a === b;
  const heads = (r: Row): string => [...(r.base.heads ?? [])].sort().join(" ");
  return a.key === b.key && a.base.path === b.base.path && a.base.disk === b.base.disk && a.base.records === b.base.records
    && a.base.doc === b.base.doc && heads(a) === heads(b);
}

/** Read ONE row's file: the row, null where no file stands (or it reads as no row), undefined where the disk refuses the read. */
function readRow(dir: string, key: string, path: string): Row | null | undefined {
  const name = rowFile(key, path);
  let text: string;
  try { text = readFileSync(join(dir, name), "utf8"); } catch (err) {
    return (err as NodeJS.ErrnoException).code === "ENOENT" ? null : undefined;
  }
  let row: Row | null = null;
  try { row = rowOf(JSON.parse(text)); } catch { /* torn */ }
  return row !== null && row.key === key && row.base.path === path ? row : null;
}

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
  /** The keys whose base stands at each path: DERIVED like `byHash`, rebuilt on the first `uriAt` after a change. */
  private byPath: Map<string, Set<string>> | null = null;

  /** `rowId` → a pin whose heads rest nowhere yet: it stands in `map`, and lands in the directory once its heads rest. */
  private readonly pendingRows = new Map<string, PendingPin>();
  /** The rest a pending pin asks, or null: every pin lands at once. */
  private readonly rests: ((doc: string, heads: readonly string[]) => Promise<HeadsRestReading>) | null;

  constructor(
    /** The directory the tree rests in. Null holds the bases in memory for this instance's life and persists nothing. */
    private dirPath: string | null,
    opts: {
      /** The vessel's reading of a document's heads at rest (`headsRestAt`, `@lararium/mesh/sealed-rest`). Present, a row
       *  that names a document and its heads waits pending until they rest. */
      readonly rests?: (doc: string, heads: readonly string[]) => Promise<HeadsRestReading>;
    } = {},
  ) {
    this.rests = opts.rests ?? null;
    if (dirPath === null) return;
    // A file standing at the directory's own path leaves this tree nowhere to rest: it holds its bases in memory.
    let isFile = false;
    try { isFile = statSync(dirPath).isFile(); } catch { /* absent */ }
    if (isFile) {
      console.warn(`[synced-tree] ${dirPath} stands as a file; the tree holds its bases in memory`);
      this.dirPath = null;
      return;
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
    this.byPath = null;
  }

  private drop(key: string, path: string): boolean {
    const id = rowId(key, path);
    if (!this.map.delete(id)) return false;
    const ids = this.byKey.get(key);
    ids?.delete(id);
    if (ids?.size === 0) this.byKey.delete(key);
    this.byHash = null;
    this.byPath = null;
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
   * THE REVERSE LOOKUP A BASE ROW GIVES: the one carrier whose base stands AT `file` (scoped to `bagId` where named), or null
   * where none stands there or several carriers' bases do. A mirror file reads back under the carrier the projector last
   * agreed at its path (`siteFileToTitle`, rule 0), so a title the projector sited by a uniquifier or a flatten reads home.
   */
  uriAt(file: string, bagId?: string): string | null {
    const uris = new Set<string>();
    for (const key of this.pathIndex().get(syncedPath(file)) ?? []) {
      const at = this.splitKey(key);
      if (bagId === undefined || at.bagId === bagId) uris.add(at.uri);
    }
    return uris.size === 1 ? uris.values().next().value ?? null : null;
  }

  /**
   * Record an agreement, and land its row before returning. `file` names the content file the
   * agreement stands at; `diskHash` names the bytes the disk holds there; `recordsHash` names the render
   * the records carry, and equals `diskHash` where the disk holds that render (a projector write, a
   * byte-identical skip). `doc` names the document whose records the agreement read, where the writer holds one, and
   * `heads` the heads it stood at then. The carrier's bases at other paths stand as they stood.
   */
  set(key: string, file: string, diskHash: string, recordsHash: string = diskHash, doc?: string, heads?: readonly string[]): void {
    const row: Row = { key, base: {
      path: syncedPath(file), disk: diskHash, records: recordsHash,
      ...(doc !== undefined && doc !== "" ? { doc } : {}),
      ...(heads !== undefined && heads.length > 0 ? { heads: [...heads] } : {}),
    } };
    const id = rowId(key, row.base.path);
    const before = this.map.get(id) ?? null;
    this.put(row);
    if (this.rests !== null && row.base.doc !== undefined && row.base.heads !== undefined) {
      // THE PIN WAITS ON ITS SEAL: it answers every read here at once, and reaches the directory once its heads rest. It
      // remembers the directory's row it was set over, for the compare at its landing.
      const pin: PendingPin = { row, over: this.dirPath === null ? null : readRow(this.dirPath, key, row.base.path), why: PENDING_ASKED };
      this.pendingRows.set(id, pin);
      void this.landSealed(id, pin);
      return;
    }
    this.pendingRows.delete(id);
    if (!this.land(row)) this.takeBack(key, row.base.path, before);
  }

  /** How many pins stand in memory waiting on their seal. */
  get pending(): number { return this.pendingRows.size; }

  /** Every pin standing in memory waiting on its seal, with why it waits (`pending: rest unread`, ...): the shore shows them. */
  pendingPins(): Array<{ readonly bagId: string; readonly uri: string; readonly path: string; readonly why: string }> {
    return [...this.pendingRows.values()].map(({ row, why }) => ({ ...this.splitKey(row.key), path: row.base.path, why }));
  }

  /**
   * THE SETTLE: ask the rest again for every pending pin, and land each whose heads now rest. The projector's idle and the
   * shore's flush call it; nothing calls it on a timer. Answers how many landed.
   */
  async settle(): Promise<number> {
    // AN ASK IN FLIGHT MAY READ THE REST AS IT STOOD BEFORE THIS SETTLE (ahead of a stand-down's seal): it answers first, and
    // every pin still pending after it asks afresh.
    const before = this.sealedLandings;
    await Promise.all([...this.asking.values()]);
    await Promise.all([...this.pendingRows].map(([id, pin]) => this.landSealed(id, pin)));
    return this.sealedLandings - before;
  }

  /** The asks in flight, one per document and heads: a wave pins many carriers at one document's heads, and asks once. */
  private readonly asking = new Map<string, Promise<HeadsRestReading>>();

  /** Ask the rest whether `heads` of `doc` rest, joining an ask already in flight for the same pair. A fault reads `unread`. */
  private askRest(doc: string, heads: readonly string[]): Promise<HeadsRestReading> {
    const at = `${doc}\0${[...heads].sort().join(" ")}`;
    let ask = this.asking.get(at);
    if (ask === undefined) {
      ask = this.rests!(doc, heads).then((reading) => (reading === "rested" || reading === "waiting" ? reading : "unread"), () => "unread" as const).finally(() => { this.asking.delete(at); });
      this.asking.set(at, ask);
    }
    return ask;
  }

  /**
   * Ask whether one pending pin's heads rest, and land it where they do and it still stands as asked. THE LANDING COMPARES
   * AND SETS ON THE BASE IT READ, never last-writer-wins: the directory's row for that path must still stand as the pin found
   * it when set (`over`). A sibling island that landed its own row there meanwhile wrote the newer word, so the pending pin
   * drops with no write, and memory takes the directory's row.
   */
  private async landSealed(id: string, pin: PendingPin): Promise<boolean> {
    const { row } = pin;
    const reading = await this.askRest(row.base.doc!, row.base.heads!);
    // A NEWER PIN OR A REMOVAL OF THE SAME ROW SINCE THE ASK SUPERSEDES IT: only the pin still pending lands.
    if (this.pendingRows.get(id) !== pin) return false;
    if (reading !== "rested") { pin.why = reading === "unread" ? PENDING_UNREAD : PENDING_WAITING; return false; }
    const stands = this.dirPath === null ? null : readRow(this.dirPath, row.key, row.base.path);
    if (stands === undefined) { pin.why = PENDING_UNREAD_ROW; return false; }
    this.pendingRows.delete(id);
    if (!sameRow(stands, pin.over)) { this.takeBack(row.key, row.base.path, stands); return false; }
    if (!this.land(row)) { this.takeBack(row.key, row.base.path, null); return false; }
    this.sealedLandings += 1;
    return true;
  }

  /** How many pending pins landed over this instance's life. */
  private sealedLandings = 0;

  /**
   * The disk refused an act on one row: memory takes the directory's word for it. Where the disk refuses
   * that read too, memory keeps the row this instance held before the act.
   */
  private takeBack(key: string, path: string, before: Row | null): void {
    const stands = this.dirPath === null ? undefined : readRow(this.dirPath, key, path);
    const row = stands === undefined ? before : stands;
    if (row !== null) this.put(row); else this.drop(key, path);
  }

  /**
   * The base at `file` leaves, and its row file with it, before this returns; the carrier's bases at
   * other paths stay. The row file unlinks whether or not this instance ever read it: a sibling may
   * have pinned it since this instance loaded.
   */
  deleteAt(key: string, file: string): void {
    const path = syncedPath(file);
    const before = this.map.get(rowId(key, path)) ?? null;
    this.pendingRows.delete(rowId(key, path));
    this.drop(key, path);
    if (this.dirPath === null) return;
    const name = join(this.dirPath, rowFile(key, path));
    try { unlinkSync(name); } catch (err) {
      // A row that already left needs no word. Any other refusal leaves the row standing, and memory says so.
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return;
      this.refused("remove", name, err);
      this.takeBack(key, path, before);
    }
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

  /** The path index over the rows as they stand (it never persists). */
  private pathIndex(): Map<string, Set<string>> {
    if (this.byPath !== null) return this.byPath;
    const byPath = new Map<string, Set<string>>();
    for (const { key, base } of this.map.values()) {
      let keys = byPath.get(base.path);
      if (!keys) { keys = new Set(); byPath.set(base.path, keys); }
      keys.add(key);
    }
    return (this.byPath = byPath);
  }

  /**
   * THE KĀPAE SHADOWS' OWN TREE (`kapae-shadow.ts`): a shadow file names no carrier home, so its rows rest apart from the
   * carriers' bases, in a `kapae/` directory inside this tree's own. Each row keys by the bag and the title the shadow
   * sets aside, stands at the shadow file's path, and names the hash of the bytes the projector last wrote there (or
   * found already standing as its own write would leave them); the projector removes the row as it lowers the shadow.
   * So the house remembers its last write of every shadow, and `lares surface commit` stages the lowering where the
   * disk still holds those bytes, as it stages a carrier the house agrees with. A tree held in memory keeps its shadow
   * rows in memory too.
   */
  shadows(): SyncedTree {
    return (this.shadowTree ??= new SyncedTree(this.dirPath === null ? null : join(this.dirPath, SHADOW_DIR)));
  }

  private shadowTree: SyncedTree | null = null;

  /**
   * A FOLDER MOVED WHOLE, ITS AGREEMENTS WITH IT: every base standing at or below `from` (this tree's rows and its shadows')
   * re-stands at the same place below `to`, its two hashes and its document kept, and leaves its old path. A heal that moves a
   * face's folders onto their shelves (`shelveFaceRoot`) calls it, so no file reads as vanished from where it stood and none as
   * never agreed where it now stands. Answers how many rows moved.
   */
  movePaths(from: string, to: string): number {
    return this.moveOwnPaths(from, to) + this.shadows().moveOwnPaths(from, to);
  }

  private moveOwnPaths(from: string, to: string): number {
    const src = syncedPath(from), dst = syncedPath(to);
    let moved = 0;
    for (const { key, base } of [...this.map.values()]) {
      if (base.path !== src && !base.path.startsWith(src + sep)) continue;
      this.set(key, dst + base.path.slice(src.length), base.disk, base.records, base.doc);
      this.deleteAt(key, base.path);
      moved++;
    }
    return moved;
  }

  /** Every row the tree holds: the carrier's bag and address beside its base. */
  rows(): Array<{ readonly bagId: string; readonly uri: string; readonly base: SyncedBase }> {
    return [...this.map.values()].map(({ key, base }) => ({ ...this.splitKey(key), base }));
  }

  /** How many rows the tree holds. */
  get size(): number {
    return this.map.size;
  }

  /**
   * One row lands as its own file, whole: a temp file in the tree's directory, then a rename onto the
   * row's name. No other row gets read or rewritten, so a sibling writer's rows stand whatever this
   * instance held when it loaded.
   */
  private land(row: Row): boolean {
    if (this.dirPath === null) return true;
    const dir = this.dirPath;
    // The temp name carries a per-write nonce beside the pid: island projectors run as worker THREADS
    // of ONE process, so a pid-keyed name names one file twice. A leading dot keeps it out of every read.
    const tmp = join(dir, `.row.${process.pid}.${++SyncedTree.writeSeq}.${randomBytes(4).toString("hex")}.tmp`);
    const name = join(dir, rowFile(row.key, row.base.path));
    const text = JSON.stringify({ key: row.key, ...row.base });
    try {
      try { writeFileSync(tmp, text, "utf-8"); } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
        mkdirSync(dir, { recursive: true });               // the first row of a tree, or a directory a hand removed
        writeFileSync(tmp, text, "utf-8");
      }
      renameSync(tmp, name);
      return true;
    } catch (err) {
      try { unlinkSync(tmp); } catch { /* it never landed, or it already left */ }
      this.refused("write", name, err);
      return false;
    }
  }

  /**
   * THE DISK REFUSED A ROW, AND THE TREE SAYS SO BY NAME. The caller takes the row back from the directory
   * (`takeBack`), so its memory never claims a base no reader could meet, nor forgets one every reader
   * still meets. The first refusal of a write and the first of a removal each speak, naming the row;
   * `refusals` counts all.
   */
  private refused(act: "write" | "remove", name: string, err: unknown): void {
    this.refusedCount += 1;
    if (this.spoke.has(act)) return;
    this.spoke.add(act);
    const why = (err as NodeJS.ErrnoException).code ?? (err instanceof Error ? err.message : String(err));
    console.warn(act === "write"
      ? `[synced-tree] the disk refused to write row ${name} (${why}); the carrier keeps the base the directory holds, and the next agreement pins anew`
      : `[synced-tree] the disk refused to remove row ${name} (${why}); the row stays, and the carrier keeps that base`);
  }

  private refusedCount = 0;
  private readonly spoke = new Set<"write" | "remove">();
  /** How many rows the disk refused to write or to remove over this instance's life. */
  get refusals(): number { return this.refusedCount; }

  /**
   * Read the directory afresh: every row, or the rows of one carrier where `key` names it. A sibling
   * writer (another island, the ingest gesture) may have pinned or removed a base since this instance
   * loaded; a caller about to surface a divergence reads through here first, so a base a sibling pinned
   * answers before an alert does. Every change this instance made already rests in the directory, save a pin
   * still waiting on its seal, so the directory's word replaces this instance's own, and each pending pin stands over it.
   */
  reread(key?: string): void {
    if (this.dirPath === null) return;
    const { rows } = readRows(this.dirPath, key);
    for (const row of key === undefined ? [...this.map.values()] : [...(this.byKey.get(key) ?? [])].map((id) => this.map.get(id)!)) {
      this.drop(row.key, row.base.path);
    }
    for (const row of rows) this.put(row);
    // A PIN WAITING ON ITS SEAL STANDS OVER THE DIRECTORY'S WORD: it rests nowhere yet, and stays this instance's own.
    for (const { row } of this.pendingRows.values()) if (key === undefined || row.key === key) this.put(row);
  }

  /** Per-process write counter — one half of the temp file's unique name. */
  private static writeSeq = 0;
}
