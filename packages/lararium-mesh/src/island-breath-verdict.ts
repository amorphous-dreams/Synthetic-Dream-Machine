/**
 * island-breath-verdict — the judgement two reads of the islands' boot breath reach, shared by every reader (the vessel's
 * healthcheck, the host's rite) so one rule decides (`@lararium/node` `island-breath` writes the records).
 *
 * A breath MOVES where any island's state, phase or progress changed, a new island breathed, or the process spent at least
 * `BREATH_WORK_USEC` of CPU since the read before; it stands STILL otherwise; a record in `fault` names the fault. NO CLOCK
 * DECIDES: the islands' state and progress and the process's CPU counter carry the verdict, and a reader's pace judges nothing.
 */

/**
 * The least process CPU work between two reads that counts as a vessel working, where no island's breath advanced: a quarter
 * second. An idle node's timers spend a few milliseconds per read; a load holding a thread spends nearly the whole span. A
 * work measure, never a time-out.
 */
export const BREATH_WORK_USEC = 250_000;

/** One island's latest breath as its record holds it. */
export interface IslandBreathRecord {
  readonly wikiUri: string;
  readonly state: "mounting" | "ready" | "fault";
  readonly phase: string;
  readonly progress: number;
  /** The process's CPU work (user + system, µs) when the island wrote this record. */
  readonly cpuUsec: number;
  /** The fault's words, where the island faulted. */
  readonly fault?: string;
}

/** The verdict two reads of the breath reach: the vessel works (`moves`), rests (`still`), or names a fault. */
export type BreathVerdict = { readonly verdict: "moves" | "still" } | { readonly verdict: "fault"; readonly fault: string; readonly wikiUri: string };

/** The fault a breath names, where any island faulted. */
export function breathFault(records: readonly IslandBreathRecord[]): { readonly fault: string; readonly wikiUri: string } | null {
  const f = records.find((r) => r.state === "fault");
  return f === undefined ? null : { fault: f.fault ?? "the island faulted", wikiUri: f.wikiUri };
}

/**
 * Judge two reads of the breath (`before` null: the first read, which moves by definition). A fault in `after` names itself.
 * Movement reads the islands' own evidence (state, phase, progress, a new island) or the process's CPU work; a clock reads nothing.
 */
export function breathMoved(before: readonly IslandBreathRecord[] | null, after: readonly IslandBreathRecord[]): BreathVerdict {
  const fault = breathFault(after);
  if (fault !== null) return { verdict: "fault", ...fault };
  if (before === null) return { verdict: "moves" };
  const was = new Map(before.map((r) => [r.wikiUri, r]));
  for (const r of after) {
    const p = was.get(r.wikiUri);
    if (p === undefined || p.state !== r.state || p.phase !== r.phase || p.progress !== r.progress) return { verdict: "moves" };
  }
  const cpu = (rs: readonly IslandBreathRecord[]): number => rs.reduce((m, r) => Math.max(m, r.cpuUsec), 0);
  return cpu(after) - cpu(before) >= BREATH_WORK_USEC ? { verdict: "moves" } : { verdict: "still" };
}
