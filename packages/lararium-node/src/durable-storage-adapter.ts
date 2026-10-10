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
 * It overrides `save`, `load` and `loadRange`; `remove` / `removeRange` inherit unchanged.
 * The base keeps a write-through read cache (private at the type layer, real at runtime): the
 * override mirrors that cache write so a load-after-save never returns stale bytes, and holds
 * its own copy of the base directory to recompute the shard path the base derives privately.
 */

import { NodeFSStorageAdapter } from "@automerge/automerge-repo-storage-nodefs";
import type { Chunk, StorageKey } from "@automerge/automerge-repo/slim";
import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";

import { atomicWriteFile } from "./fs-atomic.js";

/** The temp spellings `fs-atomic` stages beside a target: `<target>.<pid>.<suffix>.tmp` and `<target>.<pid>.tmp`. */
const STAGED_TEMP = /^(.+)\.(\d+)\.(?:[^./]+\.)?tmp$/;

export interface DurableStorageOptions {
  /** Hears each stranded temp an opener passes over, by path, once. Absent, the adapter names it on stderr. */
  readonly onStrandedTemp?: (path: string) => void;
}

export class DurableNodeFSStorageAdapter extends NodeFSStorageAdapter {
  readonly #root: string;
  /** The last save in flight per file path — the next save of that path waits on it. */
  readonly #inFlight = new Map<string, Promise<void>>();
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
    return await super.load(keyArray);
  }

  override async loadRange(keyPrefix: StorageKey): Promise<Chunk[]> {
    return (await super.loadRange(keyPrefix)).filter((chunk) => !this.#passOver(chunk.key));
  }

  override async save(keyArray: StorageKey, binary: Uint8Array): Promise<void> {
    // Mirror the base's write-through cache (keeps load-after-save coherent). `cache` is
    // TS-private on the base but present at runtime; the base keys it by `path.join(...key)`.
    (this as unknown as { cache: Record<string, Uint8Array> }).cache[join(...keyArray)] = binary;
    const filePath = this.#pathOf(keyArray);
    const prior = this.#inFlight.get(filePath) ?? Promise.resolve();
    const write = prior.catch(() => { /* the prior save's fault belongs to its own caller */ }).then(async () => {
      await mkdir(dirname(filePath), { recursive: true });
      await atomicWriteFile(filePath, binary);
    });
    this.#inFlight.set(filePath, write);
    try { await write; }
    finally { if (this.#inFlight.get(filePath) === write) this.#inFlight.delete(filePath); }
  }
}
