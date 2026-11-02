/**
 * The promote act gate: the kapae arrival on the RAISING device waits for the raise's own session act to answer.
 *
 * A raise runs as a face row on the daemon island; the board watcher sees its act land before the row's reply leaves, and a holder restart
 * then rejects the row `daemon-restarting` though the act landed. The vessel begins each promote or kapae session act here, the channel
 * ends it once the reply left, and the arrival restart awaits `settled()`: the acts that stood when it was asked, each answered. No timer
 * decides, and the holder keeps its law (a restart never waits on a call): the wait stands in front of the restart, on acts this vessel
 * began itself. An arrival with no such act in flight (every other device) restarts at once.
 */
export const isPromoteAct = (act: string): boolean => /^(promote|kapae)-/.test(act);

export interface PromoteActGate {
  begin(act: object): void;
  end(act: object): void;
  /** Resolves once every act that stood at this call has ended; an act that begins later never extends it. */
  settled(): Promise<void>;
}

export function promoteActGate(): PromoteActGate {
  const open = new Set<object>();
  const waiters = new Set<{ left: Set<object>; done: () => void }>();
  return {
    begin(act) { open.add(act); },
    end(act) {
      if (!open.delete(act)) return;
      for (const w of [...waiters]) { w.left.delete(act); if (!w.left.size) { waiters.delete(w); w.done(); } }
    },
    settled() {
      if (!open.size) return Promise.resolve();
      return new Promise<void>((done) => { waiters.add({ left: new Set(open), done }); });
    },
  };
}
