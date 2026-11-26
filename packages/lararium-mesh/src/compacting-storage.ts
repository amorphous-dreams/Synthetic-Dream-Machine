/**
 * compacting-storage — a document's incremental chunks stay bounded by COUNT and by BYTES, whatever its snapshot weighs.
 *
 * The engine's own policy compacts a document once its incremental bytes reach its snapshot's bytes. A document that grew
 * a large snapshot therefore carries thousands of small chunks before its next compaction: measured on a live hearth, the
 * vessel's control document held a 30 MB snapshot beside 4,396 incremental chunks (12 MB), written about one a second
 * under door load, each one more file to seal, open and replay at the next boot. No clock decides here: a document
 * compacts when its incremental chunks reach `maxIncrementals`, or their bytes reach `maxIncrementalBytes`.
 *
 * ONLY WHAT THE REPO MOVED LEAVES. The wrapper stands directly beneath one Repo and counts the chunk keys that Repo
 * loaded (`loadRange` answers) or saved. A compaction saves one snapshot of the Repo's LIVE document, which holds every
 * chunk the Repo loaded or saved, then removes exactly the keys it counted before that snapshot: a chunk the Repo never
 * received (a refused open, a planted key) is never counted and never removed, and a save that lands while the compaction
 * runs stays at rest. A snapshot the inner rest refuses removes nothing. The rest beneath keeps its own laws over each
 * removal (a sealed rest defers a removal while that document's saves wait unsealed).
 *
 * Canon: lar:///ha.ka.ba/kahua/memory/research/vessel-heat-2026-11-26 (row 3)
 */
import * as A from "@automerge/automerge";
import type { Chunk, StorageAdapterInterface, StorageKey } from "@automerge/automerge-repo";
import { sha256 } from "@noble/hashes/sha2.js";
import { hex, utf8Bytes } from "./crypto.js";

/** Past this many incremental chunks a document compacts, whatever its snapshot weighs. */
export const COMPACT_AT_INCREMENTALS = 1024;
/** Past this many incremental bytes a document compacts, whatever its snapshot weighs. */
export const COMPACT_AT_INCREMENTAL_BYTES = 16 * 1024 * 1024;

export interface CompactingStorageOptions {
  /** The Repo's live document for `documentId`, or null where none stands ready. */
  readonly liveDoc: (documentId: string) => A.Doc<unknown> | null | undefined;
  readonly maxIncrementals?: number;
  readonly maxIncrementalBytes?: number;
  /** Hears each compaction that landed: the document, the chunks it replaced, the snapshot's bytes. */
  readonly onCompacted?: (event: { readonly documentId: string; readonly replaced: number; readonly snapshotBytes: number }) => void;
  /** Hears a compaction that faulted; the save that asked it has already landed. */
  readonly onFault?: (documentId: string, error: unknown) => void;
}

type Role = "snapshot" | "incremental";
interface Counted { readonly key: StorageKey; readonly role: Role; readonly size: number }

const roleOf = (key: StorageKey): Role | null => {
  const role = key[1];
  return key.length === 3 && typeof key[0] === "string" && (role === "snapshot" || role === "incremental") ? role : null;
};
const nameOf = (key: StorageKey): string => key.join("\u0000");
const under = (key: StorageKey, prefix: StorageKey): boolean => prefix.every((part, i) => key[i] === part);

/** Wrap the Repo's storage so every document compacts by count and bytes (see the module head). */
export function compactingStorage(inner: StorageAdapterInterface, opts: CompactingStorageOptions): StorageAdapterInterface & {
  /** The incremental chunks this wrapper counts for `documentId` (a reading, for tests and the census). */
  incrementalsOf(documentId: string): number;
} {
  const maxCount = opts.maxIncrementals ?? COMPACT_AT_INCREMENTALS;
  const maxBytes = opts.maxIncrementalBytes ?? COMPACT_AT_INCREMENTAL_BYTES;
  const counted = new Map<string, Map<string, Counted>>();
  const compacting = new Set<string>();

  const count = (key: StorageKey, size: number): void => {
    const role = roleOf(key);
    if (role === null) return;
    const doc = key[0]!;
    const rows = counted.get(doc) ?? new Map<string, Counted>();
    rows.set(nameOf(key), { key: [...key], role, size });
    counted.set(doc, rows);
  };
  const uncount = (key: StorageKey): void => { counted.get(key[0] ?? "")?.delete(nameOf(key)); };

  const owed = (documentId: string): boolean => {
    let n = 0, bytes = 0;
    for (const row of counted.get(documentId)?.values() ?? []) if (row.role === "incremental") { n++; bytes += row.size; }
    return n >= maxCount || bytes >= maxBytes;
  };

  async function compact(documentId: string): Promise<void> {
    const doc = opts.liveDoc(documentId);
    if (doc === null || doc === undefined) return;
    const before = [...(counted.get(documentId)?.values() ?? [])];
    const binary = A.save(doc);
    const heads = [...A.getHeads(doc)].sort();
    const key: StorageKey = [documentId, "snapshot", hex(sha256(utf8Bytes(heads.join(","))))];
    await inner.save(key, binary);
    count(key, binary.length);
    let replaced = 0;
    for (const row of before) {
      if (nameOf(row.key) === nameOf(key)) continue;
      await inner.remove(row.key);
      uncount(row.key);
      replaced++;
    }
    opts.onCompacted?.({ documentId, replaced, snapshotBytes: binary.length });
  }

  return {
    load: (key) => inner.load(key),
    async save(key, data) {
      await inner.save(key, data);
      count(key, data.length);
      const documentId = key[0];
      if (roleOf(key) !== "incremental" || typeof documentId !== "string" || compacting.has(documentId) || !owed(documentId)) return;
      compacting.add(documentId);
      try { await compact(documentId); }
      catch (error) { opts.onFault?.(documentId, error); }
      finally { compacting.delete(documentId); }
    },
    async remove(key) { await inner.remove(key); uncount(key); },
    async loadRange(prefix): Promise<Chunk[]> {
      const chunks = await inner.loadRange(prefix);
      for (const chunk of chunks) if (chunk.data !== undefined) count(chunk.key, chunk.data.length);
      return chunks;
    },
    async removeRange(prefix) {
      await inner.removeRange(prefix);
      const rows = counted.get(prefix[0] ?? "");
      if (rows) for (const [name, row] of [...rows]) if (under(row.key, prefix)) rows.delete(name);
    },
    ...(inner.close !== undefined ? { close: () => inner.close!() } : {}),
    incrementalsOf: (documentId) => [...(counted.get(documentId)?.values() ?? [])].filter((r) => r.role === "incremental").length,
  };
}
