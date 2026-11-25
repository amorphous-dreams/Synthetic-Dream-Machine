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
 * A LONE FAMILY RIDES FREE. A wave of one row, or one carrier with the deletion its rename pairs, cannot split further,
 * so the budget refuses only a wave that a caller could have paged; deletions, kāpae and a pointer carrier's staged size
 * all weigh in. This mirrors the landing queue's grain: a family heavier than the quota crests alone (`wave-crest`).
 *
 * WHAT IT BOUNDS: the rows and bytes one INGEST hands one document. It does not bound a LOAD (its size lives in the source,
 * not the args), a whole-layer MOVE, or the inbound sync a Repo applies.
 */

import type { WaveLimits, WaveWeight } from "./wave-crest.js";
import { fitsWave } from "./wave-crest.js";

/** The refusal the daemon names before dispatch when one wave weighs past the budget. */
export const INGEST_WAVE_OVER_BUDGET = "ingest-wave-over-budget";

/** The per-document wave budget (see the module header for how the house chose each). `count` reads rows: carriers,
 *  deletions and kāpae alike. */
export const INGEST_WAVE_LIMITS: WaveLimits = { count: 48, bytes: 1024 * 1024, ops: 4096 };

/** The objects one record writes: its map, and about a dozen scalar fields (title, text, type, tags, the meta envelope). */
export const RECORD_OBJECTS = 12;

/**
 * A body that rides the CAS (`textCid`) carries no text to count slots in, yet a framed memetic body lands inline all the
 * same, so its staged `size` stands in: one slot per this many bytes, the lares holding's average (9.9 MB over 3,483 slots).
 */
export const BYTES_PER_SLOT = 2_850;

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
  const meta = typeof carrier["meta"] === "string" ? carrier["meta"].split("\n").filter((l) => l.trim() !== "").length : 0;
  if (typeof carrier["text"] === "string") {
    const slots = carrier["text"].match(SLOT_MARK)?.length ?? 0;
    return { count: 1, bytes: bytesOf(carrier), ops: (1 + slots) * RECORD_OBJECTS + meta };
  }
  // A POINTER WEIGHS WHAT IT POINTS AT: the staged body's size joins the bytes, and its slots read from that size.
  const size = typeof carrier["size"] === "number" && Number.isFinite(carrier["size"]) && carrier["size"] > 0 ? carrier["size"] : 0;
  return { count: 1, bytes: bytesOf(carrier) + size, ops: (1 + Math.floor(size / BYTES_PER_SLOT)) * RECORD_OBJECTS + meta };
}

/** The rows a wave carries: its carriers, its deletions and its kāpae. */
export interface IngestWaveRows {
  readonly carriers: number;
  readonly deletions: number;
  readonly kapae: number;
}

export function ingestWaveRows(args: Readonly<Record<string, unknown>>): IngestWaveRows {
  return {
    carriers: Array.isArray(args["carriers"]) ? args["carriers"].length : 0,
    deletions: Array.isArray(args["deletions"]) ? args["deletions"].length : 0,
    kapae: Array.isArray(args["kapae"]) ? args["kapae"].length : 0,
  };
}

/**
 * A whole wave's weight (the INGEST args). `count` reads every row (a carrier, a deletion, a kāpae), each deletion and kāpae
 * writes one record, a pointer carrier weighs its staged size.
 */
export function ingestWaveWeight(args: Readonly<Record<string, unknown>>): IngestWaveWeight {
  const rows = ingestWaveRows(args);
  const carriers = Array.isArray(args["carriers"]) ? (args["carriers"] as Array<Record<string, unknown>>) : [];
  let ops = (rows.deletions + rows.kapae) * RECORD_OBJECTS;
  let pointed = 0;
  for (const c of carriers) {
    if (c === null || typeof c !== "object") { ops += RECORD_OBJECTS; continue; }
    const w = ingestCarrierWeight(c);
    ops += w.ops;
    if (typeof c["text"] !== "string") pointed += w.bytes - bytesOf(c);
  }
  return { count: rows.carriers + rows.deletions + rows.kapae, bytes: bytesOf(args) + pointed, ops };
}

/**
 * A LONE FAMILY RIDES FREE, AND NOTHING ELSE DOES: a wave of at most one row, or one carrier with the one deletion its
 * rename pairs (the gestures' family, `settleIngest`). A wave that cannot split further past that bound has no caller that
 * could have paged it; any other wave meets the budget on every axis.
 */
export function isLoneFamily(rows: IngestWaveRows): boolean {
  const total = rows.carriers + rows.deletions + rows.kapae;
  return total <= 1 || (rows.carriers === 1 && rows.deletions === 1 && rows.kapae === 0);
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
  const rows = ingestWaveRows(wave);
  if (isLoneFamily(rows) || fitsWave(weight, limits)) return null;
  const extra = rows.deletions + rows.kapae > 0 ? ` (+${rows.deletions} deletions, ${rows.kapae} kāpae)` : "";
  return {
    reason: INGEST_WAVE_OVER_BUDGET, weight, limits,
    message: `${INGEST_WAVE_OVER_BUDGET}: this INGEST wave weighs ${rows.carriers} carriers${extra} · ${mib(weight.bytes)} · ~${weight.ops} objects, `
      + `past one document's wave budget of ${limits.count} rows · ${mib(limits.bytes)} · ${limits.ops} objects; nothing ran. `
      + "Send it in pages (`lares ingest` and `lares vessel lay` page by themselves).",
  };
}
