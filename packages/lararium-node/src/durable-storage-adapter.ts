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
 * SAVES OF ONE KEY RUN IN ORDER. Every save of a key stages through the same temp name, so two saves of one
 * key in flight together would rename each other's temp away. Each save of a key therefore waits for the one
 * before it, and the later call's bytes land last — the order the callers asked in.
 *
 * It overrides `save` alone; `load` / `remove` / `loadRange` / `removeRange` inherit unchanged.
 * The base keeps a write-through read cache (private at the type layer, real at runtime): the
 * override mirrors that cache write so a load-after-save never returns stale bytes, and holds
 * its own copy of the base directory to recompute the shard path the base derives privately.
 */

import { NodeFSStorageAdapter } from "@automerge/automerge-repo-storage-nodefs";
import type { StorageKey } from "@automerge/automerge-repo/slim";
import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";

import { atomicWriteFile } from "./fs-atomic.js";

export class DurableNodeFSStorageAdapter extends NodeFSStorageAdapter {
  readonly #root: string;
  /** The last save in flight per file path — the next save of that path waits on it. */
  readonly #inFlight = new Map<string, Promise<void>>();

  constructor(baseDirectory: string) {
    super(baseDirectory);
    this.#root = baseDirectory;
  }

  override async save(keyArray: StorageKey, binary: Uint8Array): Promise<void> {
    // Mirror the base's write-through cache (keeps load-after-save coherent). `cache` is
    // TS-private on the base but present at runtime; the base keys it by `path.join(...key)`.
    (this as unknown as { cache: Record<string, Uint8Array> }).cache[join(...keyArray)] = binary;
    // Recompute the base's shard path (getFilePath is private): dir / id[:2] / id[2:] / …rest.
    const [firstKey, ...rest] = keyArray;
    if (firstKey === undefined) throw new Error("DurableNodeFSStorageAdapter.save: empty storage key");
    const filePath = join(this.#root, firstKey.slice(0, 2), firstKey.slice(2), ...rest);
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
