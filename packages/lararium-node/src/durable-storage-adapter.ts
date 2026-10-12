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
 * It overrides every method that reads or writes; it borrows the base's disk listing (`loadRange`) and disk
 * removal, and holds its own copy of the base directory to recompute the shard path the base derives privately.
 */

import { NodeFSStorageAdapter } from "@automerge/automerge-repo-storage-nodefs";
import type { Chunk, StorageKey } from "@automerge/automerge-repo/slim";
import { mkdir } from "node:fs/promises";
import { dirname, join, sep } from "node:path";

import { atomicWriteFile } from "./fs-atomic.js";

/** The temp spellings `fs-atomic` stages beside a target: `<target>.<pid>.<suffix>.tmp` and `<target>.<pid>.tmp`. */
const STAGED_TEMP = /^(.+)\.(\d+)\.(?:[^./]+\.)?tmp$/;

export interface DurableStorageOptions {
  /** Hears each stranded temp an opener passes over, by path, once. Absent, the adapter names it on stderr. */
  readonly onStrandedTemp?: (path: string) => void;
}

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

  constructor(baseDirectory: string, opts: DurableStorageOptions = {}) {
    super(baseDirectory);
    this.#root = baseDirectory;
    this.#onStranded = opts.onStrandedTemp
      ?? ((path) => console.warn(`[store] a stranded temp stands at ${path} — a writer died before its rename; ignored, never read as a chunk`));
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

  override async save(keyArray: StorageKey, binary: Uint8Array): Promise<void> {
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
    const filePath = this.#pathOf(keyArray);
    this.#pending.delete(filePath);
    await this.#afterWritesOf([filePath], () => super.remove(keyArray));
  }

  override async removeRange(keyPrefix: string[]): Promise<void> {
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
