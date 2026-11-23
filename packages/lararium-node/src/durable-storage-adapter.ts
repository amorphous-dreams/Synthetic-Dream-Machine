/**
 * DurableNodeFSStorageAdapter — the CRDT store's OWN persistence writes, made crash-atomic.
 *
 * The stock `NodeFSStorageAdapter.save()` does a bare `fs.promises.writeFile`: a crash mid-write
 * leaves a TORN chunk on disk, and a torn length-prefix is precisely what drives automerge's
 * WASM into the uncatchable `capacity_overflow` abort the whole recovery keel exists to
 * survive (L1/L2/L3/L5b all descend from that one failure). This subclass closes the write
 * side of that wound: every `save` routes through the temp → fsync → rename → dir-fsync
 * discipline (`atomicWriteFile`), so a reader or a crash sees the whole old chunk or the whole
 * new one — never a half-written tear.
 *
 * A TEMP NEVER READS AS A CHUNK. A writer that dies between the temp and the rename (a SIGKILL, a force-exit)
 * leaves its temp beside the chunks, and the stock `loadRange` lists every file under a document's directory, so
 * the next opener would hand that partial temp to automerge as a chunk: the tear the rename exists to prevent. `load`
 * and `loadRange` here pass over every staged-temp spelling. A temp no save of this adapter has in flight reads as
 * STRANDED: the opener ignores it and names it (`onStrandedTemp`), and never removes bytes it did not write.
 *
 * SAVES OF ONE KEY RUN IN ORDER. Every save of a key stages through the same temp name, so two saves of one
 * key in flight together would rename each other's temp away. Each save of a key therefore waits for the one
 * before it, and the later call's bytes land last — the order the callers asked in.
 *
 * A SAVE READS BACK FROM THE MOMENT IT IS CALLED. The rename lands later than the call, and the Repo reads a
 * chunk it has just handed over. This adapter holds each key's latest bytes for exactly as long as a save of that
 * key stays in flight: `load` answers from them, and `loadRange` lists them beside the chunks on disk. Once the
 * last save of a key settles the adapter holds nothing for it, and every read follows the disk. The holding is
 * this adapter's own; it reads and writes no field of the base class.
 *
 * A HOLDER CLOSES ITS ADAPTER BEFORE IT RELEASES THE STORE. `close()` waits until every save and removal this
 * adapter issued has landed, and from then on the adapter writes nothing: a save or a removal that arrives later
 * (a Repo's own debounced save, firing after its shutdown returned) lands no byte and counts in `lateWrites`. The
 * holder that closes has already flushed its Repo, so a late save carries bytes that rest; a store whose claim
 * stands released belongs to its next holder, and no temp file of this one appears in it.
 *
 * It overrides every method that reads or writes; it borrows the base's disk listing (`loadRange`) and disk
 * removal, and holds its own copy of the base directory to recompute the shard path the base derives privately.
 *
 * A HEAVY DOCUMENT LOADS FOLDED (`fold`). Automerge's engine keeps memory for every change it replays onto a loaded
 * document and returns none of it inside one engine, so a document with a long history past its snapshot can carry the
 * live engine toward wasm32's ceiling at load. With a fold door seated, the Repo's own load of a document (its
 * `[id, "snapshot"]` range, then its `[id, "incremental"]` range) meets the fold gate (`fold-gate`): a document the gate
 * weighs heavy is replayed in the double (the doc-load-probe child's `--fold`), and the snapshot range answers ONE chunk,
 * the compacted snapshot, while the incremental range lists none of the records that snapshot covers. Records the fold
 * did not cover (a save landing after it) list as ever. A sealed or torn record, a light document, or a fold that fails
 * (a crash, its patience spent, heads that differ) loads the document as it rests, and a failure names itself
 * (`onFold`). Folds run one at a time, so two heavy documents never stand two doubles together.
 *
 * THE FOLD CHANGES HOW A DOCUMENT LOADS, NEVER WHAT RESTS (lararium/api/residency-model #/non-residency-verbs). The
 * folded chunk carries a key no file holds (`[id, "snapshot", "folded-<digest>"]`), and every stored record stays out of
 * the Repo's chunk accounting, so the Repo can never remove one: its first save after the load writes one incremental
 * beside them (a snapshot of a megabyte never compacts against no incrementals), and a later compaction of its own
 * removes only the folded key (nothing rests there) and the incrementals it wrote since. A rewrite of the stored records
 * belongs to a separate, receipted EPOCH act.
 */

import { NodeFSStorageAdapter } from "@automerge/automerge-repo-storage-nodefs";
import type { Chunk, StorageKey } from "@automerge/automerge-repo/slim";
import { mkdir } from "node:fs/promises";
import { dirname, join, sep } from "node:path";

import { createHash } from "node:crypto";
import { atomicWriteFile } from "./fs-atomic.js";
import { foldsAt, foldWeightOf, PONO_FOLD_GATE, shoreStorage, teachFold, type DocFold, type FoldGate, type FoldWeight } from "@lararium/mesh";

/** The temp spellings `fs-atomic` stages beside a target: `<target>.<pid>.<suffix>.tmp` and `<target>.<pid>.tmp`. */
const STAGED_TEMP = /^(.+)\.(\d+)\.(?:[^./]+\.)?tmp$/;

export interface DurableStorageOptions {
  /** Hears each stranded temp an opener passes over, by path, once. Absent, the adapter names it on stderr. */
  readonly onStrandedTemp?: (path: string) => void;
  /** Seats the fold at load: a heavy document reaches the Repo as one snapshot the double folded. Absent, none folds. */
  readonly fold?: FoldSeat;
}

/** What one fold at load came to. */
export type FoldEvent =
  | { readonly documentId: string; readonly outcome: "folded"; readonly weight: FoldWeight; readonly chunks: number; readonly snapshotBytes: number; readonly spentBytes: number }
  | { readonly documentId: string; readonly outcome: "unfolded"; readonly weight: FoldWeight; readonly reason: string };

/** The fold's seat in the store: the double, the gate it starts from, and who hears each fold. */
export interface FoldSeat {
  readonly door: DocFold;
  /** The gate the store starts from; it learns from every fold that lands. Absent, `PONO_FOLD_GATE`. */
  readonly gate?: FoldGate;
  /** Hears each fold, landed or fallen back. Absent, the store names each on stdout, a fall-back on stderr. */
  readonly onFold?: (event: FoldEvent) => void;
}

const MIB = 2 ** 20;

/** One key's bytes while a save of it stays in flight: the latest bytes asked for, and how many saves still run. */
interface PendingSave { readonly key: StorageKey; binary: Uint8Array; saves: number }

export class DurableNodeFSStorageAdapter extends NodeFSStorageAdapter {
  readonly #root: string;
  /** The last save in flight per file path — the next save of that path waits on it. */
  readonly #inFlight = new Map<string, Promise<void>>();
  /** The bytes of every key with a save in flight, by file path. Empty whenever no save runs. */
  readonly #pending = new Map<string, PendingSave>();
  readonly #onStranded: (path: string) => void;
  readonly #named = new Set<string>();
  readonly #fold: FoldSeat | undefined;
  #gate: FoldGate;
  /** Per document, the record paths its latest fold covered: its incremental range lists none of them. */
  readonly #covered = new Map<string, ReadonlySet<string>>();
  /** The fold running now: the next waits on it. */
  #folding: Promise<unknown> = Promise.resolve();

  constructor(baseDirectory: string, opts: DurableStorageOptions = {}) {
    super(baseDirectory);
    this.#root = baseDirectory;
    this.#fold = opts.fold;
    this.#gate = opts.fold?.gate ?? PONO_FOLD_GATE;
    this.#onStranded = opts.onStrandedTemp
      ?? ((path) => console.warn(`[store] a stranded temp stands at ${path} — a writer died before its rename; ignored, never read as a chunk`));
    // THE LOCAL STORAGE SHORE: a stored chunk carrying a prototype key refuses by name before it materializes.
    shoreStorage(this);
  }

  /** The base's shard path (getFilePath is private): dir / id[:2] / id[2:] / …rest. */
  #pathOf(keyArray: StorageKey): string {
    const [firstKey, ...rest] = keyArray;
    if (firstKey === undefined) throw new Error("DurableNodeFSStorageAdapter: empty storage key");
    return join(this.#root, firstKey.slice(0, 2), firstKey.slice(2), ...rest);
  }

  /** Whether `keyArray` names a staged temp; a temp no save of this adapter has in flight is named once. */
  #passOver(keyArray: StorageKey): boolean {
    const m = STAGED_TEMP.exec(keyArray[keyArray.length - 1] ?? "");
    if (!m) return false;
    const path = this.#pathOf(keyArray);
    const ours = Number(m[2]) === process.pid && this.#inFlight.has(join(dirname(path), m[1]!));
    if (!ours && !this.#named.has(path)) {
      this.#named.add(path);
      this.#onStranded(path);
    }
    return true;
  }

  override async load(keyArray: StorageKey): Promise<Uint8Array | undefined> {
    if (this.#passOver(keyArray)) return undefined;
    return this.#pending.get(this.#pathOf(keyArray))?.binary ?? await super.load(keyArray);
  }

  override async loadRange(keyPrefix: StorageKey): Promise<Chunk[]> {
    const chunks = await this.#listed(keyPrefix);
    if (this.#fold === undefined || keyPrefix.length !== 2) return chunks;
    const [documentId, role] = keyPrefix as [string, string];
    if (role === "incremental") {
      const covered = this.#covered.get(documentId);
      return covered === undefined ? chunks : chunks.filter((chunk) => !covered.has(this.#pathOf(chunk.key)));
    }
    if (role !== "snapshot") return chunks;
    this.#covered.delete(documentId);
    const folded = await this.#foldOf(documentId, this.#fold, chunks, await this.#listed([documentId, "incremental"]));
    return folded === null ? chunks : [folded];
  }

  /** The folded snapshot chunk for a heavy document, or null where it loads as it rests. */
  async #foldOf(documentId: string, seat: FoldSeat, snapshots: Chunk[], incrementals: Chunk[]): Promise<Chunk | null> {
    const records = [
      ...snapshots.flatMap((c) => (c.data === undefined ? [] : [{ kind: "snapshot" as const, key: c.key, data: c.data }])),
      ...incrementals.flatMap((c) => (c.data === undefined ? [] : [{ kind: "incremental" as const, key: c.key, data: c.data }])),
    ];
    const weighing = foldWeightOf(records);
    if (!("weight" in weighing) || !foldsAt(this.#gate, weighing.weight)) return null;
    const { weight } = weighing;
    const turn = this.#folding.then(() => seat.door.fold(documentId, records.map((r) => r.data)));
    this.#folding = turn.catch(() => { /* the verdict below names it */ });
    const verdict = await turn.catch((e: unknown) => ({ status: "unfolded" as const, reason: `the double's door threw: ${e instanceof Error ? e.message : String(e)}` }));
    const hear = seat.onFold ?? namedFold;
    if (verdict.status === "unfolded") {
      hear({ documentId, outcome: "unfolded", weight, reason: verdict.reason });
      return null;
    }
    // Only a fold that landed teaches the gate (completions-only-teach).
    this.#gate = teachFold(this.#gate, weight, verdict.spentBytes);
    this.#covered.set(documentId, new Set(records.map((r) => this.#pathOf(r.key))));
    hear({ documentId, outcome: "folded", weight, chunks: records.length, snapshotBytes: verdict.snapshot.length, spentBytes: verdict.spentBytes });
    const digest = createHash("sha256").update(verdict.snapshot).digest("hex");
    return { key: [documentId, "snapshot", `folded-${digest}`], data: verdict.snapshot };
  }

  /** The records under `keyPrefix`: the disk's, staged temps passed over, beside the bytes of every save in flight. */
  async #listed(keyPrefix: StorageKey): Promise<Chunk[]> {
    // The pending set is read BEFORE the disk walk: a save that settles during the walk has landed on disk by
    // then, so the walk lists it; one read after the walk could miss a key that was neither on disk when the
    // walk passed nor still pending afterwards.
    const held = [...this.#pending.values()].filter((p) => keyPrefix.every((part, i) => p.key[i] === part));
    const chunks = (await super.loadRange(keyPrefix)).filter((chunk) => !this.#passOver(chunk.key));
    const listed = new Set(chunks.map((chunk) => this.#pathOf(chunk.key)));
    for (const p of held) {
      const path = this.#pathOf(p.key);
      if (listed.has(path)) continue;
      chunks.push({ key: [...p.key], data: this.#pending.get(path)?.binary ?? await super.load(p.key) });
    }
    return chunks;
  }

  #closed = false;
  #late = 0;
  /** How many saves and removals arrived after `close()` and landed nothing. */
  get lateWrites(): number { return this.#late; }

  /**
   * Close the adapter: no write starts from here on, and the call resolves once every write already issued has
   * landed. A write's own fault stays with its own caller.
   */
  async close(): Promise<void> {
    this.#closed = true;
    while (this.#inFlight.size > 0 || this.#ranges.size > 0) {
      await Promise.allSettled([...this.#inFlight.values(), ...[...this.#ranges].map(([, gone]) => gone)]);
    }
  }

  override async save(keyArray: StorageKey, binary: Uint8Array): Promise<void> {
    if (this.#closed) { this.#late += 1; return; }
    const filePath = this.#pathOf(keyArray);
    let pending = this.#pending.get(filePath);
    if (pending) { pending.binary = binary; pending.saves++; }
    else { pending = { key: [...keyArray], binary, saves: 1 }; this.#pending.set(filePath, pending); }
    const held = pending;
    // A save joins the key's own write order AND every range removal running over its prefix, so its rename
    // never lands inside a range unlink.
    const fences = [...this.#ranges].filter(([base]) => filePath === base || filePath.startsWith(base + sep)).map(([, gone]) => gone);
    const prior = Promise.all([this.#inFlight.get(filePath) ?? Promise.resolve(), ...fences].map((p) => p.catch(() => { /* that fault belongs to its own caller */ })));
    const write = prior.then(async () => {
      await mkdir(dirname(filePath), { recursive: true });
      await atomicWriteFile(filePath, binary);
    });
    this.#inFlight.set(filePath, write);
    try { await write; }
    finally {
      if (this.#inFlight.get(filePath) === write) this.#inFlight.delete(filePath);
      // A remove may have dropped the holding meanwhile; only the holding this save counted into is released.
      if (--held.saves === 0 && this.#pending.get(filePath) === held) this.#pending.delete(filePath);
    }
  }

  /**
   * A REMOVE JOINS THE KEY'S SAVE IN FLIGHT, THEN UNLINKS. The held bytes leave at the call, so no read
   * answers them; the unlink waits for every write of the key already issued, so a rename landing late
   * never brings the key back; and the removal stands in the key's own write order, so a save issued after
   * it lands after it.
   */
  override async remove(keyArray: string[]): Promise<void> {
    if (this.#closed) { this.#late += 1; return; }
    const filePath = this.#pathOf(keyArray);
    this.#pending.delete(filePath);
    await this.#afterWritesOf([filePath], () => super.remove(keyArray));
  }

  override async removeRange(keyPrefix: string[]): Promise<void> {
    if (this.#closed) { this.#late += 1; return; }
    const paths = new Set<string>();
    for (const [path, p] of this.#pending) {
      if (keyPrefix.every((part, i) => p.key[i] === part)) { this.#pending.delete(path); paths.add(path); }
    }
    // A write whose holding already left still stands in flight under the prefix's directory.
    const base = keyPrefix.length > 0 ? this.#pathOf(keyPrefix) : this.#root;
    for (const path of this.#inFlight.keys()) if (path === base || path.startsWith(base + sep)) paths.add(path);
    const gone = this.#afterWritesOf([...paths], () => super.removeRange(keyPrefix));
    // The removal fences its whole prefix while it runs: a save of any key beneath it, in flight or not, waits.
    const fence = gone.catch(() => { /* the removal's fault reaches its own caller below */ });
    this.#ranges.add([base, fence]);
    const entry = [...this.#ranges].at(-1)!;
    try { await gone; }
    finally { this.#ranges.delete(entry); }
  }

  /** Range removals running now: each fences the directory it clears until it settles. */
  readonly #ranges = new Set<readonly [string, Promise<void>]>();

  /** Run `removal` after every write in flight for `paths`, standing in each path's write order while it runs. */
  async #afterWritesOf(paths: readonly string[], removal: () => Promise<void>): Promise<void> {
    const priors = paths.map((path) => (this.#inFlight.get(path) ?? Promise.resolve()).catch(() => { /* that write's fault belongs to its own caller */ }));
    const gone = Promise.all(priors).then(removal);
    for (const path of paths) this.#inFlight.set(path, gone);
    try { await gone; }
    finally { for (const path of paths) if (this.#inFlight.get(path) === gone) this.#inFlight.delete(path); }
  }
}

/** The store's own voice for a fold: a landed fold on stdout, a fall-back on stderr. */
function namedFold(event: FoldEvent): void {
  const weighs = `${event.weight.changes} change(s) past the snapshot on ${(event.weight.bytes / MIB).toFixed(1)} MiB`;
  if (event.outcome === "folded") {
    console.log(`[store] fold: ${event.documentId} loads folded (${weighs}); the double spent ${(event.spentBytes / MIB).toFixed(0)} MiB replaying it, the engine reads one ${(event.snapshotBytes / MIB).toFixed(1)} MiB snapshot`);
  } else {
    console.warn(`[store] fold: ${event.documentId} loads unfolded (${weighs}): ${event.reason}`);
  }
}
