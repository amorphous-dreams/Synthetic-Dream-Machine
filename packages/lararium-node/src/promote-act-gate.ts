/**
 * The promote act gate: the RAISING device's own raise completes before its daemon island restarts, and nothing else holds an arrival.
 *
 * A raise runs as a face row on the daemon island; the board watcher sees its act land before the row's reply leaves, and a holder restart
 * then rejects the row `daemon-restarting` though the act landed. The vessel begins each promote or kapae session act here, the channel
 * ends it once the reply left, and `after(kinds, run)` hands a restart to the completion of the acts of those kinds standing NOW. It never
 * awaits and holds no promise: the holder keeps its law (a restart never waits on a call), a hung act leaves a plain restart (the owner
 * door's `island.restart`) free to force the swap, and an arrival with no such act in flight (a remote raise, a sync) restarts at once.
 * Narrow residual, named: a hung reply of this device's own raise holds only the deferred run for the raise standing at the request.
 */
export const isPromoteAct = (act: string): boolean => /^(promote|kapae)-/.test(act);

export interface PromoteActGate {
  begin(act: object, kind: string): void;
  end(act: object): void;
  /** True when acts of `kinds` stand and `run` waits on their completion; false when none stand and the caller acts now. */
  after(kinds: readonly string[], run: () => void): boolean;
}

export function promoteActGate(): PromoteActGate {
  const open = new Map<object, string>();
  const waiters = new Set<{ left: Set<object>; run: () => void }>();
  return {
    begin(act, kind) { open.set(act, kind); },
    end(act) {
      if (!open.delete(act)) return;
      for (const w of [...waiters]) {
        w.left.delete(act);
        if (!w.left.size) { waiters.delete(w); w.run(); }
      }
    },
    after(kinds, run) {
      const left = new Set([...open].filter(([, kind]) => kinds.includes(kind)).map(([act]) => act));
      if (!left.size) return false;
      waiters.add({ left, run });
      return true;
    },
  };
}
