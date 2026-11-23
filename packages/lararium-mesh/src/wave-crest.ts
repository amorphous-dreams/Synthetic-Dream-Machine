/**
 * wave-crest — the nalu's slice rule, lifted out of the landing queue so every wave that lands in a shared engine crests
 * the same way (lar:///ha.ka.ba/lares/api/pono/nalu#/the-wave-shape).
 *
 * THE GRAIN: a queue holds FAMILIES, and a crest takes whole families off its head, in order, while the next family still
 * fits every limit. The first family of a crest rides whatever it weighs, so a family heavier than the limits crests alone
 * and the queue moves on; no crest ever cuts inside one. The landing queue (`WaveLanding`, one axis: changes) and the
 * INGEST settle (three axes: carriers, encoded bytes, estimated objects) both take their slices here.
 *
 * THE SERVO: `adaptDepth` carries the accumulate family's shrink (`adaptGate`) on a bare number. A wave that ran slower than
 * its target shrinks the next depth; a fast one grows it back, each step bounded, the depth never below one. The caller
 * measures and decides when to step; this module reads no clock.
 *
 * Pure and dependency-free, so a module that reaches mesh by subpath alone can import it.
 */

/** What one family weighs on each axis a wave bounds. An absent axis weighs nothing. */
export interface WaveWeight {
  readonly count: number;
  readonly bytes?: number;
  readonly ops?: number;
}

/** The most one wave carries on each axis. */
export interface WaveLimits {
  readonly count: number;
  readonly bytes: number;
  readonly ops: number;
}

/** True where `w` fits inside `limits` on every axis. */
export function fitsWave(w: WaveWeight, limits: WaveLimits): boolean {
  return w.count <= limits.count && (w.bytes ?? 0) <= limits.bytes && (w.ops ?? 0) <= limits.ops;
}

/** The sum of two weights, axis by axis. */
export function addWeight(a: WaveWeight, b: WaveWeight): Required<WaveWeight> {
  return { count: a.count + b.count, bytes: (a.bytes ?? 0) + (b.bytes ?? 0), ops: (a.ops ?? 0) + (b.ops ?? 0) };
}

/**
 * Take the next crest off the head of `queue` (mutating it): whole families, in order, while the running weight with the
 * next family still fits every limit. The first family always rides. An empty queue answers an empty crest.
 */
export function takeCrest<F>(queue: F[], weigh: (family: F) => WaveWeight, limits: WaveLimits): F[] {
  if (queue.length === 0) return [];
  const first = queue.shift()!;
  const crest: F[] = [first];
  let held: WaveWeight = weigh(first);
  while (queue.length > 0) {
    const next = addWeight(held, weigh(queue[0]!));
    if (!fitsWave(next, limits)) break;
    crest.push(queue.shift()!);
    held = next;
  }
  return crest;
}

/** Each limit scaled by `factor` (floored, never below one): the servo's depth applied to every axis together. */
export function scaleLimits(limits: WaveLimits, factor: number): WaveLimits {
  const f = Number.isFinite(factor) && factor > 0 ? Math.min(factor, 1) : 1;
  return {
    count: Math.max(1, Math.floor(limits.count * f)),
    bytes: Math.max(1, Math.floor(limits.bytes * f)),
    ops: Math.max(1, Math.floor(limits.ops * f)),
  };
}

/**
 * One homeostatic servo step on a depth (the accumulate family's negative feedback, `adaptGate`): a wave slower than its
 * target shrinks the next depth, a faster one grows it, each step clamped to `maxStep`; the depth never falls below one.
 */
export function adaptDepth(current: number, observedMs: number, targetMs: number, maxStep = 0.25, ceiling = Number.POSITIVE_INFINITY): number {
  if (targetMs <= 0) return current;
  const error = (observedMs - targetMs) / targetMs; // >0 = too slow
  const factor = 1 - Math.max(-maxStep, Math.min(maxStep, error));
  const next = Math.max(1, Math.round(current * factor));
  // A SMALL DEPTH STILL CLIMBS: where rounding would hold a growing depth in place (one stays one), it grows by one.
  // THE CEILING HOLDS: a depth grows back up to the caller's budget, never past it.
  return Math.min(Math.max(1, ceiling), factor > 1 && next <= current ? current + 1 : next);
}
