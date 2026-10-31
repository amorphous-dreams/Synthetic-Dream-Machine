/**
 * gate-sweep — THE ONE OWNER of a vessel's gate sweep: a transport-free cap-stack stage every vessel holding the "serves a
 * gate" capability composes (test-recut-road `T19`, `T27`; `T13` inherits it as an already-shared stage).
 *
 * One turn at a time, it reads the carried postures, then drops the sockets a refold demotes ON THOSE READINGS, then stands
 * down each gate its read no longer names and stands each one it newly names, then runs the after-steps. So the drop never
 * sorts on an older read, and an older read never lands after a newer one. A refold asked while one turn waits unstarted
 * joins it: that turn reads the carried postures only when it starts, so it sees both asks.
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
  /** Drop the sockets these readings no longer hold. */
  readonly drop: (readings: readonly R[]) => void;
  /** Before the read (a device book's refresh). A throw here is the port's own; the turn reads on. */
  readonly before?: () => Promise<void>;
  /** After the gates moved (a same-operator sweep, a relay's refresh). Skipped once the owner closed. */
  readonly after?: () => Promise<void>;
  /** A read that failed, a stand that threw: said once per fault, deciding nothing. */
  readonly onFault?: (err: unknown) => void;
}

export interface GateSweep<R> {
  /** Queue one turn (joined when one already waits unstarted); resolves when that turn has run. */
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

  const turn = async (): Promise<void> => {
    if (closed) return;
    try { await ports.before?.(); } catch (err) { fault(err); }
    if (closed) return;
    let read: readonly R[];
    try { read = await ports.readCarried(); } catch (err) { fault(err); read = []; }
    if (closed) return;
    current = read;
    try { ports.drop(read); } catch (err) { fault(err); }
    const seat = ports.seat();
    const wanted = new Set(seat ? ports.nexusesOf(read) : []);
    for (const nexus of [...stood.keys()]) if (!wanted.has(nexus)) standDown(nexus);
    if (seat) {
      for (const nexus of wanted) {
        if (stood.has(nexus)) continue;
        try { stood.set(nexus, seat.stand(nexus)); } catch (err) { fault(err); }
      }
    }
    if (closed) return;
    try { await ports.after?.(); } catch (err) { fault(err); }
  };

  let tail: Promise<void> = Promise.resolve();
  let waiting: Promise<void> | null = null;
  return {
    refold() {
      if (waiting) return waiting;
      const mine: Promise<void> = tail.then(() => { if (waiting === mine) waiting = null; return turn(); });
      waiting = mine;
      tail = mine.catch(() => {});
      return mine;
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
