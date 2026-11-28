/**
 * The vessel's durable work ledger. One sealed current snapshot replaces its predecessor atomically;
 * no Automerge history or deletion tombstones accumulate. Acknowledgements follow the replacement.
 * Pending work and completed effect keys never expire. Receipt eviction follows the receipt ledger's
 * explicit transitions; a removed queue row leaves no retained title. No clock decides retention.
 *
 * replace must compare the previous bytes under the substrate's exclusive holder, then durably
 * replace the entire row. Failure publishes no state and leaves the previous snapshot authoritative.
 */
import { CompositeStore } from "./composite-store.js";
import { VESSEL_WORK_ID } from "./lar-uris.js";
import { canonicalJsonBytes, sha256HexBytesSync } from "./crypto.js";
import { holdsOnly, type ChangeOrigin, type LarTiddlerChange, type LarTiddlerRecord, type LarTiddlerStore } from "./tiddler-store.js";

export interface WorkSnapshotRest {
  read(): Promise<Uint8Array | null>;
  replace(bytes: Uint8Array, previous: Uint8Array | null): Promise<void>;
}
export interface VesselWork {
  readonly store: CompositeStore;
  flush(): Promise<void>;
  checkpoint(): Promise<{ docUrl: string; heads: readonly string[] }>;
}
const workByStore = new WeakMap<CompositeStore, VesselWork>();
export function workOf(store: CompositeStore): VesselWork {
  const work = workByStore.get(store);
  if (!work) throw new Error("vessel-work-unavailable: this store holds no durable work capability");
  return work;
}
export async function openVesselWork(rest: WorkSnapshotRest): Promise<VesselWork> {
  return vesselWorkFromSnapshot(rest, await rest.read());
}

/** Restore a snapshot already read under its custody holder. */
export function vesselWorkFromSnapshot(rest: WorkSnapshotRest, initialBytes: Uint8Array | null): VesselWork {
  let bytes = initialBytes;
  let rows = new Map<string, LarTiddlerRecord>();
  if (bytes !== null) {
    const image = JSON.parse(new TextDecoder().decode(bytes));
    if (image.version !== 1 || !Array.isArray(image.rows)) throw new Error("vessel-work: malformed snapshot");
    for (const pair of image.rows) {
      if (!Array.isArray(pair) || typeof pair[0] !== "string" || pair[1]?.tiddler?.title !== pair[0] || pair[1]?.meta?.deleted) throw new Error("vessel-work: malformed row");
      rows.set(pair[0], pair[1]);
    }
  }
  let tail: Promise<void> = Promise.resolve();
  let lastFailure: unknown;
  const listeners = new Set<(change: LarTiddlerChange) => void>();
  const mutate = (puts: readonly LarTiddlerRecord[], removes: readonly string[], origin: ChangeOrigin, only?: LarTiddlerRecord): Promise<void> => {
    const next = tail.then(async () => {
      if (only && !holdsOnly(rows.get(removes[0]!), only)) return;
      const copy = new Map(rows);
      for (const title of removes) copy.delete(title);
      for (const row of puts) copy.set(row.tiddler.title, structuredClone(row));
      const image = canonicalJsonBytes({ version: 1, rows: [...copy].sort(([a], [b]) => a.localeCompare(b)) });
      if (bytes !== null && sha256HexBytesSync(bytes) === sha256HexBytesSync(image)) return;
      await rest.replace(image, bytes);
      rows = copy; bytes = image; lastFailure = undefined;
      for (const title of new Set([...puts.map(r => r.tiddler.title), ...removes])) {
        const change: LarTiddlerChange = { title, record: rows.get(title) ?? null, origin, bag: VESSEL_WORK_ID };
        for (const fn of listeners) { try { fn(change); } catch { /* observers cannot undo a durable replacement */ } }
      }
    });
    tail = next.catch(error => { lastFailure = error; });
    return next;
  };
  const layer: LarTiddlerStore = {
    listVisible: async () => [...rows.keys()],
    get: async title => structuredClone(rows.get(title) ?? null),
    put: (row, origin) => mutate([row], [], origin),
    tombstone: (title, origin) => mutate([], [title], origin),
    remove: (title, origin, options) => mutate([], [title], origin, options?.only),
    writeFamily: (puts, removes, origin, options) => mutate(puts, [...removes, ...options?.retracts ?? []], origin),
    subscribe: fn => { listeners.add(fn); return () => { listeners.delete(fn); }; },
  };
  const store = new CompositeStore();
  void store.addLayer({ bagId: VESSEL_WORK_ID, writable: true, store: layer });
  const work: VesselWork = {
    store,
    flush: async () => { await tail; if (lastFailure) throw lastFailure; },
    checkpoint: async () => {
      await tail;
      if (lastFailure) throw lastFailure;
      // Establish even the empty snapshot before claiming a durable checkpoint.
      if (bytes === null) await mutate([], [], { kind: "lares-verb", requestId: "work-checkpoint" });
      return { docUrl: VESSEL_WORK_ID, heads: [sha256HexBytesSync(bytes!)] };
    },
  };
  workByStore.set(store, work);
  return work;
}

// A daemon island asks the vessel's ledger over its existing capability port. It never opens a second store.
export type WorkAsk = { type: "work:ask"; id: string; op: "get" | "list" | "write"; title?: string; puts?: readonly LarTiddlerRecord[]; removes?: readonly string[]; only?: LarTiddlerRecord; origin?: ChangeOrigin };
export type WorkAnswer = { type: "work:answer"; id: string; value?: unknown; error?: string };
export type WorkChanged = { type: "work:changed"; change: LarTiddlerChange };
type Port = { post(msg: WorkAsk | WorkAnswer | WorkChanged): void; listen(fn: (raw: unknown) => void): () => void };
export function serveVesselWork(port: { post(msg: WorkAnswer | WorkChanged): void; listen: Port["listen"] }, work: Pick<VesselWork, "store">): () => void {
  let closed = false;
  const stopChanges = work.store.subscribe(change => port.post({ type: "work:changed", change }));
  const stop = port.listen(raw => {
    const ask = raw as WorkAsk;
    if (ask?.type !== "work:ask") return;
    void (async () => {
      if (ask.op === "get") return work.store.get(ask.title!);
      if (ask.op === "list") return work.store.listVisible();
      if (ask.op !== "write" || !ask.origin) throw new Error("vessel-work: malformed operation");
      if (ask.only) await work.store.remove(ask.removes![0]!, ask.origin, { only: ask.only });
      else await work.store.writeFamily(ask.puts ?? [], ask.removes ?? [], ask.origin);
      return null;
    })().then(value => {
      if (!closed) port.post({ type: "work:answer", id: ask.id, value });
    }, error => {
      if (!closed) port.post({ type: "work:answer", id: ask.id, error: String(error) });
    }).catch(() => { /* a closed worker cannot receive the answer; the durable decision still stands */ });
  });
  return () => { closed = true; stop(); stopChanges(); };
}
export function islandWorkStore(port: { post(msg: WorkAsk): void; listen: Port["listen"] }): { store: CompositeStore; close(): void } {
  let serial = 0;
  let closed = false;
  const pending = new Map<string, { resolve(value: any): void; reject(error: Error): void }>();
  const listeners = new Set<(change: LarTiddlerChange) => void>();
  const stop = port.listen(raw => {
    const msg = raw as WorkAnswer | WorkChanged;
    if (msg?.type === "work:changed") {
      for (const fn of listeners) { try { fn(msg.change); } catch { /* one observer cannot suppress another's change */ } }
      return;
    }
    if (msg?.type !== "work:answer") return;
    const ask = pending.get(msg.id); if (!ask) return;
    pending.delete(msg.id);
    if (msg.error) ask.reject(new Error(msg.error)); else ask.resolve(msg.value);
  });
  const ask = (op: WorkAsk["op"], args: Omit<Partial<WorkAsk>, "type" | "id" | "op"> = {}): Promise<any> => new Promise((resolve, reject) => {
    if (closed) { reject(new Error("vessel-work: island closed; open a fresh island before asking again")); return; }
    const id = `work-${++serial}`;
    pending.set(id, { resolve, reject });
    try { port.post({ type: "work:ask", id, op, ...args }); }
    catch (error) { pending.delete(id); reject(error); }
  });
  const store = new CompositeStore();
  void store.addLayer({ bagId: VESSEL_WORK_ID, writable: true, store: {
    get: title => ask("get", { title }), listVisible: () => ask("list"),
    put: (row, origin) => ask("write", { puts: [row], origin }),
    tombstone: (title, origin) => ask("write", { removes: [title], origin }),
    remove: (title, origin, opts) => ask("write", { removes: [title], origin, ...opts?.only ? { only: opts.only } : {} }),
    writeFamily: (puts, removes, origin, opts) => ask("write", { puts, removes: [...removes, ...opts?.retracts ?? []], origin }),
    subscribe: fn => { listeners.add(fn); return () => { listeners.delete(fn); }; },
  } });
  return { store, close() { closed = true; stop(); for (const ask of pending.values()) ask.reject(new Error("vessel-work: island closed; open a fresh island before asking again")); pending.clear(); listeners.clear(); } };
}
