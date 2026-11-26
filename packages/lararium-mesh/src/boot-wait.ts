/**
 * boot-wait — a boot names what it waits on.
 *
 * A boot step that awaits something outside itself (a sealed document's hydration, a holder's unlock, an island's open)
 * wraps that await here, and the WORK prints its own lines: one as the step enters its wait, naming what it waits on, and
 * one as the awaited thing lands, carrying the step's measured span and, where the caller can count it, what landed
 * (documents, records, bags). A step that throws prints its own closing line and throws on.
 *
 *   [boot] face-catalog: awaits the sealed catalog's hydration through the daemon island's holder
 *   [boot] face-catalog: still awaits the sealed catalog's hydration through the daemon island's holder (2 pacing figure(s) of 10000ms)
 *   [boot] face-catalog: stood in 15012ms (41 row(s))
 *
 * THE CLOCK PACES AND ANNOTATES, AND DECIDES NOTHING. The pacing timer prints the "still awaits" line alone: it ends no
 * wait, fails no step and reads no verdict, and the step's span rides its closing line as an annotation. Only the awaited
 * work ends a wait, by landing or by throwing.
 *
 * A STEP'S NAME READS AS A HYPHEN-JOINED CODE (`face-catalog`, `daemon-island`) and leads the line, so the shore log
 * (`shore-log`, `classifyLogLine`) files every line of one step under one event, `boot/<step>`, whose last line stands in
 * the closing slice. No line here reads as a boot milestone (`phase → <name>`): a supervisor's milestone reading passes
 * over them.
 *
 * Dependency-free, so a module that may reach mesh by subpath alone can import it.
 */

/** The pacing figure: this long between two "still awaits" lines of one step. */
export const BOOT_PACE_MS = 10_000;

export interface BootWaitPorts {
  /** Where each line lands, whole. */
  readonly log: (line: string) => void;
  /** The annotation clock, in milliseconds: it measures a step's span for its closing line and decides nothing. */
  readonly now?: () => number;
  /** The pacing figure; `BOOT_PACE_MS` where none rides. */
  readonly paceMs?: number;
  /** The pacing timer's seat (tests fire it by hand): it calls `fn` once per pacing figure until `stop` runs. */
  readonly pace?: (fn: () => void, ms: number) => () => void;
}

/**
 * Run one boot step under its lines: `step` names it (a hyphen-joined code), `on` names what it waits on (a noun phrase
 * that completes "awaits …"), `run` carries the work (a thunk, or the promise of work already under way), and `counted`
 * reads what landed off the work's own answer. Work whose answer itself reads as a function rides in a thunk.
 */
export type BootWait = <T>(step: string, on: string, run: (() => Promise<T> | T) | Promise<T>, counted?: (value: T) => string | null | undefined) => Promise<T>;

const timerPace = (fn: () => void, ms: number): (() => void) => {
  const handle = setInterval(fn, ms);
  // The pacing timer never holds a process open.
  (handle as { unref?: () => void }).unref?.();
  return () => clearInterval(handle);
};

/** The entry line: the step and what it waits on. */
export const bootAwaitsLine = (step: string, on: string): string => `[boot] ${step}: awaits ${on}`;
/** The pacing line: the step still waits, after `paces` pacing figures. */
export const bootStillLine = (step: string, on: string, paces: number, paceMs: number): string =>
  `[boot] ${step}: still awaits ${on} (${paces} pacing figure(s) of ${paceMs}ms)`;
/** The landing line: the step's measured span and what landed. */
export const bootStoodLine = (step: string, ms: number, counted?: string | null): string =>
  `[boot] ${step}: stood in ${ms}ms${counted ? ` (${counted})` : ""}`;
/** The closing line of a step that threw: its span and the cause it threw. */
export const bootFailedLine = (step: string, ms: number, cause: string): string =>
  `[boot] ${step}: failed after ${ms}ms (${cause})`;

/** Stand a `BootWait` over its ports. */
export function bootWaits(ports: BootWaitPorts): BootWait {
  const now = ports.now ?? (() => Date.now());
  const paceMs = ports.paceMs ?? BOOT_PACE_MS;
  const pace = ports.pace ?? timerPace;
  return async (step, on, run, counted) => {
    ports.log(bootAwaitsLine(step, on));
    const began = now();
    let paces = 0;
    const stop = pace(() => ports.log(bootStillLine(step, on, ++paces, paceMs)), paceMs);
    try {
      const value = await (typeof run === "function" ? run() : run);
      let landed: string | null | undefined = null;
      // A count that cannot read leaves the line bare; the step still stood.
      try { landed = counted?.(value); } catch { landed = null; }
      ports.log(bootStoodLine(step, Math.round(now() - began), landed));
      return value;
    } catch (cause) {
      ports.log(bootFailedLine(step, Math.round(now() - began), cause instanceof Error ? cause.message : String(cause)));
      throw cause;
    } finally {
      stop();
    }
  };
}

/** The process's own boot wait: each line lands on the console, where the vessel's log sink folds it. */
export const bootWait: BootWait = bootWaits({ log: (line) => console.log(line) });
