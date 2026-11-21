/**
 * gate-sweep — THE ONE OWNER of a vessel's gate sweep: a transport-free cap-stack stage every vessel holding the "serves a
 * gate" capability composes (test-recut-road `T19`, `T27`; `T13` inherits it as an already-shared stage).
 *
 * One turn at a time, it reads the carried postures, then drops the sockets a refold demotes ON THOSE READINGS, then runs
 * its before-step, then stands down each gate its read leaves out and stands each one it newly names. So the drop sorts on
 * the newest read, and an older read never lands after a newer one. A refold asked while one turn waits unstarted joins it:
 * that turn reads the carried postures only when it starts, so it sees both asks. The after-steps run one at a time on a
 * chain of their own, so a stalled one (a relay that never answers) holds no later turn's read or drop.
 *
 * FAIL-CLOSED. A read that throws reads as NOTHING CARRIED: every carried gate stands down and every carried posture reads
 * absent. A seat port that answers null (a floor, or a composition before its arm) stands nothing; the drop still runs.
 * Once closed, the owner stands every gate down, and a turn still in flight stands nothing and runs no after-step.
 *
 * Ports, by capability: `readCarried` reads carried postures; `seat` serves a gate (its `stand` answers the gate's own
 * stand-down); `drop` drops what a refold demotes; `before` / `after` run beside each turn. No port names a host.
 */

/** Serves a gate: stands the gate of one Nexus and answers its stand-down. Synchronous, so a turn never interleaves. */
export interface GateSweepSeat {
  stand(nexus: string): () => void;
}

export interface GateSweepPorts<R extends { readonly aid: string }> {
  /** Read the carried postures, as the gates read them. A throw reads as nothing carried. */
  readonly readCarried: () => Promise<readonly R[]>;
  /** The Nexuses whose gates stand for these readings (a vessel's own beside the carried ones). */
  readonly nexusesOf: (readings: readonly R[]) => readonly string[];
  /** The gate seat this turn stands through, or null where the composition stands none. Read at each turn. */
  readonly seat: () => GateSweepSeat | null;
  /** Drop the sockets these readings leave unheld. */
  readonly drop: (readings: readonly R[]) => void;
  /** After the drop, before the gates move (a device book's refresh). A throw here is the port's own; the turn goes on. */
  readonly before?: () => Promise<void>;
  /** After the gates moved (a same-operator sweep, a relay's refresh), one at a time on its own chain. Skipped once closed. */
  readonly after?: () => Promise<void>;
  /** A read that failed, a stand that threw: said once per fault, deciding nothing. */
  readonly onFault?: (err: unknown) => void;
}

export interface GateSweep<R> {
  /** Queue one turn (joined when one already waits unstarted); resolves when that turn and its after-step have run. */
  refold(): Promise<void>;
  /** The carried postures the last finished read answered. */
  readings(): readonly R[];
  /** Stand every gate down; a turn in flight stands nothing after it. Idempotent. */
  close(): void;
  readonly closed: boolean;
}

export function gateSweep<R extends { readonly aid: string }>(ports: GateSweepPorts<R>): GateSweep<R> {
  let current: readonly R[] = [];
  let closed = false;
  const stood = new Map<string, () => void>();
  const fault = (err: unknown): void => { try { ports.onFault?.(err); } catch { /* a log never decides */ } };
  const standDown = (nexus: string): void => {
    const down = stood.get(nexus);
    stood.delete(nexus);
    try { down?.(); } catch (err) { fault(err); }
  };

  // THE AFTER-STEPS' OWN CHAIN: one at a time, never on the turns' chain.
  let afterTail: Promise<void> = Promise.resolve();
  const afterStep = (): Promise<void> => {
    const mine = afterTail.then(async () => {
      if (closed) return;
      try { await ports.after?.(); } catch (err) { fault(err); }
    });
    afterTail = mine;
    return mine;
  };

  /** One turn: read, drop on that read, the before-step, then the gates. Answers the after-step it queued, if any. */
  // The after-step rides in a box: an async function that returned the bare promise would adopt it and wait on it.
  const turn = async (): Promise<{ readonly after: Promise<void> } | null> => {
    if (closed) return null;
    let read: readonly R[];
    try { read = await ports.readCarried(); } catch (err) { fault(err); read = []; }
    if (closed) return null;
    current = read;
    try { ports.drop(read); } catch (err) { fault(err); }
    try { await ports.before?.(); } catch (err) { fault(err); }
    if (closed) return null;
    // From here to the last stand no await runs: a close cannot land between them.
    let seat: GateSweepSeat | null = null;
    let wanted = new Set<string>();
    try { seat = ports.seat(); wanted = new Set(seat ? ports.nexusesOf(read) : []); } catch (err) { fault(err); seat = null; wanted = new Set(); }
    for (const nexus of [...stood.keys()]) if (!wanted.has(nexus)) standDown(nexus);
    if (seat) {
      for (const nexus of wanted) {
        if (stood.has(nexus)) continue;
        try { stood.set(nexus, seat.stand(nexus)); } catch (err) { fault(err); }
      }
    }
    return { after: afterStep() };
  };

  let tail: Promise<void> = Promise.resolve();
  let waiting: Promise<void> | null = null;
  return {
    refold() {
      if (waiting) return waiting;
      // The turns' chain waits on each turn's read, drop and gates, never on its after-step.
      const core = tail.then(() => { if (waiting === answer) waiting = null; return turn(); });
      const answer: Promise<void> = core.then((queued) => queued?.after);
      waiting = answer;
      tail = core.then(() => {}, () => {});
      return answer;
    },
    readings: () => current,
    close() {
      if (closed) return;
      closed = true;
      for (const nexus of [...stood.keys()]) standDown(nexus);
    },
    get closed() { return closed; },
  };
}
