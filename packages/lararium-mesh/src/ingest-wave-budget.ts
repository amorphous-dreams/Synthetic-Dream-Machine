/**
 * ingest-wave-budget — what one INGEST wave may carry into one document.
 *
 * A bag stands as one Automerge document, and every document in an isolate shares that isolate's one wasm engine. On
 * 2026-11-22 a lay sent 194 lares carriers (about 3.6 MB of bodies, about 1,400 records) as one INGEST; the engine ran
 * out of memory applying it (`rust_oom` in `BatchApply::insert_ops`), the module terminated, and every later request
 * refused. Upstream bounds no sync batch (automerge-repo #339), and Automerge's memory follows the objects and ops a change
 * writes rather than its bytes (automerge #896), so the house bounds the wave it hands the engine, on three axes:
 *
 *   count — carriers in the wave;
 *   bytes — the wave's encoded size on the wire (the JSON the daemon receives);
 *   ops   — an ESTIMATE of the objects the wave's records write: each carrier lands a root record and one record per
 *           ahu slot its body carries (a `.mem` splits by slot), each record one map holding about a dozen scalar fields
 *           (`stored-record.ts` writes every string as one `ImmutableString` op); a deletion or a kāpae writes one record.
 *
 * The estimate counts what the wave asks the engine to hold, not what the engine measures; a measured per-document op
 * count (the census) would sharpen it, and stays the next rung.
 *
 * HOW THE LIMITS WERE CHOSEN: about a quarter of the wave that trapped (194 carriers, 3.6 MB, ~17,000 estimated objects),
 * so that wave crests in five or more pages, while an ordinary edit (a handful of carriers) rides one. The lares holding
 * averages 18.6 KB and 6.5 slots per carrier (533 files, 9.9 MB, 3,483 slots), so 48 average carriers weigh about 0.9 MB
 * and 3,800 objects: the three axes bind at nearly the same place for that holding. Constants, not configuration: a
 * vessel that needs other numbers needs a measured reason first.
 *
 * A LONE CARRIER ALWAYS RIDES. A wave of one cannot split further, and a body past the inline wall already rides the CAS
 * as a pointer, so the budget refuses only a wave that a caller could have paged. This mirrors the landing queue's grain:
 * a family heavier than the quota crests alone (`wave-crest`).
 */

import type { WaveLimits, WaveWeight } from "./wave-crest.js";
import { fitsWave } from "./wave-crest.js";

/** The refusal the daemon names before dispatch when one wave weighs past the budget. */
export const INGEST_WAVE_OVER_BUDGET = "ingest-wave-over-budget";

/** The per-document wave budget (see the module header for how the house chose each). */
export const INGEST_WAVE_LIMITS: WaveLimits = { count: 48, bytes: 1024 * 1024, ops: 4096 };

/** The objects one record writes: its map, and about a dozen scalar fields (title, text, type, tags, the meta envelope). */
export const RECORD_OBJECTS = 12;

/** Each ahu slot a carrier's body opens lands as a record of its own. */
const SLOT_MARK = /<<~\s*ahu\b/g;

export interface IngestWaveWeight extends WaveWeight {
  readonly count: number;
  readonly bytes: number;
  readonly ops: number;
}

const encoder = new TextEncoder();
const bytesOf = (value: unknown): number => encoder.encode(JSON.stringify(value) ?? "").length;

/** One carrier's weight: one carrier, its encoded bytes, and the objects its root and slot records write. */
export function ingestCarrierWeight(carrier: Readonly<Record<string, unknown>>): IngestWaveWeight {
  const text = typeof carrier["text"] === "string" ? carrier["text"] : "";
  const slots = text.match(SLOT_MARK)?.length ?? 0;
  const meta = typeof carrier["meta"] === "string" ? carrier["meta"].split("\n").filter((l) => l.trim() !== "").length : 0;
  return { count: 1, bytes: bytesOf(carrier), ops: (1 + slots) * RECORD_OBJECTS + meta };
}

/** A whole wave's weight (the INGEST args): its carriers summed, each deletion and kāpae one record more. */
export function ingestWaveWeight(args: Readonly<Record<string, unknown>>): IngestWaveWeight {
  const carriers = Array.isArray(args["carriers"]) ? (args["carriers"] as Array<Record<string, unknown>>) : [];
  const deletions = Array.isArray(args["deletions"]) ? args["deletions"].length : 0;
  const kapae = Array.isArray(args["kapae"]) ? args["kapae"].length : 0;
  let ops = (deletions + kapae) * RECORD_OBJECTS;
  for (const c of carriers) ops += c !== null && typeof c === "object" ? ingestCarrierWeight(c).ops : RECORD_OBJECTS;
  return { count: carriers.length, bytes: bytesOf(args), ops };
}

/** The INGEST args a verb carries: INGEST's own, or the INGEST a `wiki-act` wraps; null for any other verb. */
export function ingestWaveOf(verb: string, args: unknown): Readonly<Record<string, unknown>> | null {
  if (args === null || typeof args !== "object") return null;
  const a = args as Record<string, unknown>;
  if (verb === "INGEST") return a;
  if (verb === "wiki-act" && a["verb"] === "INGEST" && a["args"] !== null && typeof a["args"] === "object") return a["args"] as Record<string, unknown>;
  return null;
}

export interface IngestWaveRefusal {
  readonly reason: typeof INGEST_WAVE_OVER_BUDGET;
  readonly message: string;
  readonly weight: IngestWaveWeight;
  readonly limits: WaveLimits;
}

const mib = (n: number): string => `${(n / (1024 * 1024)).toFixed(1)} MiB`;

/**
 * The daemon's preflight: null where the verb carries no INGEST wave, or the wave fits the budget, or it holds one carrier;
 * otherwise the named refusal, with the weight it read and the limits it holds.
 */
export function ingestWaveRefusal(verb: string, args: unknown, limits: WaveLimits = INGEST_WAVE_LIMITS): IngestWaveRefusal | null {
  const wave = ingestWaveOf(verb, args);
  if (wave === null) return null;
  const weight = ingestWaveWeight(wave);
  if (weight.count <= 1 || fitsWave(weight, limits)) return null;
  return {
    reason: INGEST_WAVE_OVER_BUDGET, weight, limits,
    message: `${INGEST_WAVE_OVER_BUDGET}: this INGEST wave weighs ${weight.count} carriers · ${mib(weight.bytes)} · ~${weight.ops} objects, `
      + `past one document's wave budget of ${limits.count} carriers · ${mib(limits.bytes)} · ${limits.ops} objects; nothing ran. `
      + "Send it in pages (`lares ingest` and `lares vessel lay` page by themselves).",
  };
}
