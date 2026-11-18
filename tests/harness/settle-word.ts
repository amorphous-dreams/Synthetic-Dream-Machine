/**
 * settle-word — an e2e test reads the projection's end from the vessel's own words, never from a clock
 * (road row G36; `working-procedures#/an-absence-names-its-far-side-barrier`).
 *
 * Two far-side events stand here.
 *
 *   THE SETTLE WORD OVER AN INGEST RESULT. `lares ingest --apply` lands records, then asks the vessel to say when the
 *   projection those records cause has run (`data.settle`). `settleWordOver` reads that word off the result and
 *   fails by name when it is missing, refused or short: the file the test reads next stands as the projection
 *   left it. A word that ended `far-side-closed` or `projector-stopped` reads here as the refusal it names.
 *
 *   THE PROJECTION DRAINED. `lares shore` answers after the island looked at the disk and its reconcile queue
 *   drained (`projector.sense`, then `idle`). A test that holds "the mirror stays still" asks it once the
 *   projection began, so a write an echo would cause has landed by the time the answer comes. It counts only
 *   the queue that stands when asked: a record still travelling to the island needs its own settle word.
 */
import { expect } from "vitest";
import type { CliResult, LarInstance } from "./instance.js";

/** The reading `lares ingest --apply` reports under `data.settle`. */
export interface SettleWord {
  readonly settled: boolean;
  readonly shore?: boolean;
  readonly mirrored?: boolean;
  readonly settledCount?: number;
  readonly elsewhereCount?: number;
  readonly supersededCount?: number;
  readonly refusal?: string;
  readonly why?: string;
}

/**
 * The settle word an ingest result names, held to what the test expects. Fails with the reading itself, so a
 * refusal (`far-side-closed`, `projector-stopped`, `projection-failed`) shows by name.
 */
export function settleWordOver(result: CliResult, expected: { readonly settledCount: number }): SettleWord {
  const data = result.json?.["data"] as Record<string, unknown> | undefined;
  const word = data?.["settle"] as SettleWord | undefined;
  expect(word, `the apply names its settle word: ${JSON.stringify(data?.["settle"])}`).toBeDefined();
  expect(word, `the settle word ended: ${JSON.stringify(word)}`).toMatchObject({ settled: true, mirrored: true, settledCount: expected.settledCount });
  return word!;
}

/** What `lares shore` listed once the island's queue drained. */
export interface ShoreDrained {
  readonly standoffs: number;
  readonly pending: number;
}

/** Ask the island to look at the disk and answer once its reconcile queue drained. */
export async function projectionDrained(lar: LarInstance): Promise<ShoreDrained> {
  const r = await lar.cli(["shore", "list", "--json"]);
  const data = r.json?.["data"] as Record<string, unknown> | undefined;
  expect(r.json?.["ok"], `the shore answered: ${JSON.stringify(r.json ?? r.stderr)}`).toBe(true);
  return { standoffs: Number(data?.["standoffCount"] ?? NaN), pending: Number(data?.["pendingCount"] ?? NaN) };
}
