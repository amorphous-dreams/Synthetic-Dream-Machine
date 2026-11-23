/**
 * doctor-sweep — L6 read-only half, isomorphic. Runs the L1 `DocLoadProbe` over a set of
 * documentIds and tallies the verdicts into a report. Pure orchestration over the probe
 * contract — a platform enumerates its own store (nodefs shards / IndexedDB keys) and
 * feeds the ids here; both read back the same chart. Mutates nothing (the `git fsck`
 * role); the `repair` actuator stays a separate, consent-gated verb.
 */

import { isCondemned, isUnresolved, type DocLoadProbe, type ProbeResult, type ProbeStatus } from "./doc-load-probe-contract.js";

/** One doc's line in the doctor chart. */
export interface DoctorEntry {
  readonly documentId: string;
  readonly status: ProbeStatus;
  readonly reason?: string;
  readonly chunks?: number;
  /** the records that rest sealed (sound envelopes, inner bytes unread: the sweep holds no key). */
  readonly sealed?: number;
}

/** The whole-store health chart. */
export interface DoctorReport {
  readonly entries: readonly DoctorEntry[];
  readonly total: number;
  /** sound documents with no sealed record. */
  readonly healthy: number;
  /** sound documents that rest sealed: every envelope well-formed, the inner bytes left to the vessel that holds the key.
   *  Counted APART from `healthy`, and never condemned. */
  readonly sealed: number;
  readonly condemned: number;
  /** H2 — counted APART from `condemned`: a probe that spent its own patience (or died with
   *  no abort signature) named no verdict at all. Never folds into "the store carries a
   *  tear" — only `condemned` does. */
  readonly unresolved: number;
  /** true once any doc comes back condemned — the store carries a tear. `unresolved` alone
   *  never degrades the chart (liveness is not safety evidence). */
  readonly degraded: boolean;
}

function toEntry(r: ProbeResult): DoctorEntry {
  return {
    documentId: r.documentId,
    status: r.status,
    ...(r.reason !== undefined ? { reason: r.reason } : {}),
    ...(r.chunks !== undefined ? { chunks: r.chunks } : {}),
    ...(r.sealed !== undefined ? { sealed: r.sealed } : {}),
  };
}

/**
 * Probe every documentId (bounded concurrency, so a large store does not spawn a
 * boundary per doc all at once) and tally the chart. Order of `entries` follows
 * completion, never input — the caller sorts for display.
 */
export async function sweepDocs(
  documentIds: readonly string[],
  probe: DocLoadProbe,
  opts: { concurrency?: number } = {},
): Promise<DoctorReport> {
  const concurrency = Math.max(1, opts.concurrency ?? 4);
  const entries: DoctorEntry[] = [];
  let next = 0;

  async function worker(): Promise<void> {
    while (next < documentIds.length) {
      const i = next++;
      const documentId = documentIds[i];
      if (documentId === undefined) continue;
      const verdict = await probe.probe(documentId);
      entries.push(toEntry(verdict));
    }
  }

  const lanes = Array.from({ length: Math.min(concurrency, documentIds.length) }, () => worker());
  await Promise.all(lanes);

  const condemned  = entries.filter((e) => isCondemned({ documentId: e.documentId, status: e.status })).length;
  const unresolved = entries.filter((e) => isUnresolved({ documentId: e.documentId, status: e.status })).length;
  const sealed     = entries.filter((e) => e.status === "ok" && (e.sealed ?? 0) > 0).length;
  return {
    entries,
    total: entries.length,
    healthy: entries.length - condemned - unresolved - sealed,
    sealed,
    condemned,
    unresolved,
    degraded: condemned > 0,
  };
}
