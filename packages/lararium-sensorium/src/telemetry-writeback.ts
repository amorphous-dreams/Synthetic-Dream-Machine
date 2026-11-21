/**
 * telemetry-writeback — the lar-telemetry projection surface (the WRITE shore), held as a PLACEHOLDER.
 *
 * PLACEHOLDER SHIM (operator ruling 2026-10-31, Train Q, row Q6 — the one ruled exception to the
 * no-shims law). The harvester burn retired the turn reader this projection ran over each drawer and
 * the Python drawer writer it projected through, so the surface keeps its export shape for its callers
 * (the daemon `lar-telemetry` verb, `lares sense pour --writeback` and the re-pave's bearing leg) and
 * writes nothing: {@link writebackWing} reports zero drawers and {@link stampKapaeSalience} stamps
 * none. The sensorium arc returns the real projection; that arc waits on the founded-Lararium proof,
 * and a road row tracks this shim until it retires.
 *
 * Meme: lar:///ha.ka.ba/lararium/api/lar-telemetry
 */

export interface WritebackResult {
  readonly drawers: number;
  readonly framed: number;
  readonly applied: number;
  readonly standings: Record<string, number>;
}

/** Raised when the projection substrate is absent — the caller renders a clean error. */
export class TelemetryUnavailable extends Error {}

/**
 * The per-wing telemetry projection. PLACEHOLDER (operator ruling 2026-10-31, Train Q): reads no
 * drawer, writes no metadata, and reports an empty pass.
 */
export function writebackWing(_wing: string, _opts: { limit?: number } = {}): WritebackResult {
  return { drawers: 0, framed: 0, applied: 0, standings: { framed: 0, structured: 0, raw: 0 } };
}

/**
 * KAPAE salience down-weight on the content drawers a rewound turn fed. PLACEHOLDER (operator ruling
 * 2026-10-31, Train Q): stamps none.
 */
export function stampKapaeSalience(_verbatimShas: readonly string[], _ended?: string): { stamped: number } | null {
  return { stamped: 0 };
}
