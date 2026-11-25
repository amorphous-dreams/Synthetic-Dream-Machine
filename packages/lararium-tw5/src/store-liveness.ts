/**
 * store-liveness — what an island's own store is doing for its Repo right now: how many reads stand in flight, and when
 * the last one settled.
 *
 * An island's Repo reads a document from its own store before it asks the vessel for it over the sync port. The store
 * stands behind the rest guard (`islandRestGuard`), so a read may itself wait on the vessel's rest answer, which can queue
 * behind the vessel's own corpus load. While such a read stands in flight the Repo sends nothing on the port and hears
 * nothing back, so a slot wait that clocks the port alone would read the island's own work as the vessel's silence
 * (`slot-wait`). This shim counts the reads, so the wait can tell the two apart and name the one it waited on.
 *
 * Platform-blind and engine-free: it wraps whatever object the host's storage hands, passing every member through and
 * counting the two read members the Repo calls (`load`, `loadRange`).
 */

/** The store's reading at one instant. */
export interface StoreReading {
  /** Reads (`load`, `loadRange`) the Repo started that have not settled. */
  readonly inFlight: number;
  /** The monotonic reading when the last read settled; null before any settled. */
  readonly lastSettled: number | null;
}

export interface StoreLiveness {
  reading(): StoreReading;
}

type Reads = { load?: (...args: never[]) => Promise<unknown>; loadRange?: (...args: never[]) => Promise<unknown> };

/** Wrap `inner`, counting its reads against `now` (a monotonic clock). The wrapped store answers exactly as `inner` does. */
export function storeLiveness<S extends object>(inner: S, now: () => number): { readonly storage: S; readonly liveness: StoreLiveness } {
  let inFlight = 0;
  let lastSettled: number | null = null;
  const counted = <F extends (...args: never[]) => Promise<unknown>>(read: F): F => (async (...args: Parameters<F>) => {
    inFlight++;
    try { return await read.apply(inner, args); }
    finally { inFlight--; lastSettled = now(); }
  }) as F;
  const reads = inner as Reads;
  const storage = new Proxy(inner, {
    get(target, key, receiver) {
      if (key === "load" && typeof reads.load === "function") return counted(reads.load);
      if (key === "loadRange" && typeof reads.loadRange === "function") return counted(reads.loadRange);
      const value: unknown = Reflect.get(target, key, receiver);
      return typeof value === "function" ? (value as (...a: unknown[]) => unknown).bind(target) : value;
    },
  });
  return { storage, liveness: { reading: () => ({ inFlight, lastSettled }) } };
}
