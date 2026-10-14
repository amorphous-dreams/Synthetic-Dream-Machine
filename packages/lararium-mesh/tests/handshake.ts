/**
 * handshake — the one way a vector waits for another party: by that party's own word, never by the clock.
 *
 * Two acts a vector merely STARTS together cross their awaits in whatever order the machine runs them. A vector
 * that needs one to have happened before the other says so with an arrival: the party that reaches the moment
 * calls `arrive`, and the party that needs it awaits `arrived`. No sleep stands in for the event, no loop asks
 * again, and nothing repeats a case to see it hold.
 *
 * THE BOUND FAILS, IT NEVER SUCCEEDS. Each arrival carries a bound that only REJECTS, naming the moment that
 * never came, so a vector whose party went missing reads red by name instead of by the runner's timeout. No
 * outcome of a vector depends on the bound's length.
 */

/** One named moment: `arrive` marks it (the first call wins), `arrived` resolves with what it carried. */
export interface Arrival<T> {
  readonly arrived: Promise<T>;
  arrive(value: T): void;
  /** Whether the moment came already. */
  readonly came: boolean;
}

/** An arrival named `what`. Past `boundMs` with no arrival, `arrived` rejects and names `what`. */
export function arrival<T = void>(what: string, boundMs = 15_000): Arrival<T> {
  let came = false;
  let settle!: (value: T) => void;
  let fail!: (err: Error) => void;
  const arrived = new Promise<T>((resolve, reject) => { settle = resolve; fail = reject; });
  const bound = setTimeout(() => { fail(new Error(`never arrived within ${boundMs}ms: ${what}`)); }, boundMs);
  (bound as { unref?: () => void }).unref?.();
  // A vector may end before it awaits an arrival it no longer needs: the bound's rejection then has no reader.
  arrived.catch(() => { /* read where awaited */ });
  return {
    arrived,
    arrive(value: T): void { if (came) return; came = true; clearTimeout(bound); settle(value); },
    get came(): boolean { return came; },
  };
}
