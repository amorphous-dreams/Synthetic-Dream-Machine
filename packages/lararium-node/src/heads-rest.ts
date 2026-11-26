/**
 * heads-rest — the base pins only what sealed, on both sides of a node island's port.
 *
 * Vessel side: `repoHeadsRestAt` reads a document's heads at rest off this vessel's Repo (its handle table keys each
 * document by the bare document id, the id an `AutomergeDocStore` names as `documentId`) and its sealed store's waiting
 * saves; `restedOnSave` hears each save that reaches the inner rest, so the vessel tells its islands which document rested.
 * Island side: `islandHeadsAsker` asks over the thread's own port (`parentPort`) and hears the vessel's `rest:rested`.
 *
 * Canon: lar:///ha.ka.ba/lararium/mesh/sealed-store#/owed
 */
import * as A from "@automerge/automerge";
import type { StorageAdapterInterface } from "@automerge/automerge-repo";
import { isMainThread, parentPort } from "node:worker_threads";
import { headsRestAt, vesselHeadsAsker, type HeadsRestReading } from "@lararium/mesh/sealed-rest";

/** The vessel's reading of a document's heads at rest, off its Repo's handle table and its sealed store's waiting saves. */
export function repoHeadsRestAt(
  repo: { readonly handles: Record<string, unknown>; flush(documentIds?: never[]): Promise<void> },
  waiting: (documentId: string) => number,
): (documentId: string, heads: readonly string[]) => Promise<HeadsRestReading> {
  return headsRestAt({
    holds: (documentId, heads) => {
      const handle = repo.handles[documentId] as { isReady(): boolean; doc(): unknown } | undefined;
      try { return handle?.isReady() === true && A.hasHeads(handle.doc() as A.Doc<unknown>, [...heads]); } catch { return false; }
    },
    flush: (documentId) => repo.flush([documentId as never]),
    waiting,
  });
}

/**
 * THE SAVE BOOK'S REST, HEARD: wrap the inner rest so each save that lands there names its document to `saved`. The vessel
 * reads the document's waiting saves there and tells its islands once none wait (`rest:rested`). No clock paces it.
 */
export function restedOnSave(inner: StorageAdapterInterface, saved: (documentId: string) => void): StorageAdapterInterface {
  const tell = (key: readonly string[]): void => { if (typeof key[0] === "string") { try { saved(key[0]); } catch { /* a listener's fault never fails a save */ } } };
  return {
    load: (key) => inner.load(key),
    save: async (key, data) => { await inner.save(key, data); tell(key); },
    remove: (key) => inner.remove(key),
    loadRange: (prefix) => inner.loadRange(prefix),
    removeRange: (prefix) => inner.removeRange(prefix),
    ...(inner.close !== undefined ? { close: () => inner.close!() } : {}),
  };
}

/** A heads asker and the vessel's rested word, over one island thread's port. */
export interface IslandHeads {
  readonly rests: (doc: string, heads: readonly string[]) => Promise<HeadsRestReading>;
  readonly rested: (listener: (doc: string) => void) => () => void;
}

/** Ask and hear over `port`: the island half of the heads-rest door. */
export function headsOverPort(port: { postMessage(msg: unknown): void; on(ev: "message", fn: (m: unknown) => void): unknown; off(ev: "message", fn: (m: unknown) => void): unknown }, idPrefix: string): IslandHeads {
  const rests = vesselHeadsAsker({
    post: (msg) => { port.postMessage(msg); },
    listen: (cb) => { port.on("message", cb); return () => { port.off("message", cb); }; },
  }, { idPrefix });
  const listeners = new Set<(doc: string) => void>();
  port.on("message", (raw: unknown) => {
    const m = raw as { type?: unknown; documentId?: unknown } | null;
    if (m?.type !== "rest:rested" || typeof m.documentId !== "string") return;
    for (const listener of [...listeners]) listener(m.documentId);
  });
  return { rests, rested: (listener) => { listeners.add(listener); return () => { listeners.delete(listener); }; } };
}

/** THIS THREAD'S ONE HEADS DOOR over its vessel port, or null outside an island thread (a projector a test or the CLI mounts
 *  on the main thread pins at once). Every projector the thread mounts, a lit sibling's included, shares it. */
let threadHeads: IslandHeads | null | undefined;
export function islandHeadsAsker(): IslandHeads | null {
  if (threadHeads !== undefined) return threadHeads;
  const port = isMainThread ? null : parentPort;
  return (threadHeads = port === null ? null : headsOverPort(port, `island-${process.pid}-${Math.random().toString(36).slice(2, 8)}`));
}
