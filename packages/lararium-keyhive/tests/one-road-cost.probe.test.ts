/**
 * one-road-cost.probe — G4-entry MEASUREMENT: what one trip down the ONE ROAD costs, and how N trips scale.
 *
 * `delegateToFaceViaVeil` (operator-daemon-behavior.ts) is the ONE ROAD every vessel-bag→face delegation
 * takes: contact-card exchange both ways, vessel→veil delegate, `ingestPeerEvents(eventsForPeer(veilId))`,
 * registerBag + adoptBag, veil→face delegate. The road lives as a closure inside `operatorDaemonOptions`,
 * so this probe RECONSTRUCTS its exact call sequence over real KeyhiveProvider instances (real wasm, no
 * mocks — the cgka-enumeration setup) and times it at N=1, N=4, N=16 sequential delegations.
 *
 * THE SUSPECT, named ahead: `eventsForPeer(veilId)` returns the veil's WHOLE routed event history, and the
 * road ingests it EVERY call — so call k carries the freight of calls 1..k-1. Per-call cost within one
 * batch (first vs last) reads that directly; a fleet-gather that multiplies callers multiplies exactly this.
 *
 * The verdict lands on disk (one-road-cost.verdict.json beside this file) AND under a LOOSE ceiling
 * assertion, so a future regression reds here rather than surfacing as a slow gather in docker.
 *
 * Real Keyhive, no mocks. Timing carries this machine's wasm build — the per-call ms travels poorly
 * across hardware; the SCALING verdict travels.
 */
import { describe, test, expect } from "vitest";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { KeyhiveProvider, InMemoryEventStore } from "../src/index.js";

const VERDICT_PATH = join(dirname(fileURLToPath(import.meta.url)), "one-road-cost.verdict.json");

/** LOOSE ceilings — regression tripwires, never performance claims. A healthy run sits far under. */
const CEILING_SINGLE_MS   = 3000;  // one trip down the road
const CEILING_PER_CALL_16 = 5000;  // mean per-call inside the N=16 batch

async function vessel(fill: number): Promise<KeyhiveProvider> {
  const p = new KeyhiveProvider();
  await p.init({ seed: new Uint8Array(32).fill(fill), eventStore: new InMemoryEventStore() });
  return p;
}

interface RoadRig {
  readonly kh:        KeyhiveProvider;   // the vessel identity
  readonly veilKh:    KeyhiveProvider;   // the veil identity — the group's holder
  readonly faceAgent: string;            // the PersonaGroup's agent id (delegation target)
}

/** Stand the road's three parties the way the founding does: vessel, veil, and a face the veil holds. */
async function standRig(fillBase: number): Promise<RoadRig> {
  const kh     = await vessel(fillBase);
  const veilKh = await vessel(fillBase + 1);
  // The face — a sentinel doc the VEIL creates (the veil-born founding's seat), its agent the target.
  const face = await veilKh.createSentinelDoc(`lar:///probe.road.costs/face-${fillBase}`);
  return { kh, veilKh, faceAgent: face.agentIdHex };
}

/**
 * ONE trip down the one road — `delegateToFaceViaVeil`'s body, verbatim in sequence, PLUS the
 * `registerBagCap` prologue (`registerBag` before the road) its production caller always pays.
 * Source of the sequence: operator-daemon-behavior.ts `delegateToFaceViaVeil` + `registerBagCap`.
 */
async function oneRoadTrip(rig: RoadRig, bagUrl: string): Promise<void> {
  const { kh, veilKh, faceAgent } = rig;
  await kh.registerBag(bagUrl);                                                   // registerBagCap prologue
  try { await veilKh.receiveContactCard(await kh.contactCard()); } catch { /* known */ }
  try { await kh.receiveContactCard(await veilKh.contactCard()); } catch { /* known */ }
  const veilId = await veilKh.vesselIdentifierHex();
  await kh.delegate({ bagUrl, audience: veilId, access: "admin" });
  await veilKh.ingestPeerEvents(await kh.eventsForPeer(veilId));                  // THE SUSPECT — full history
  const { docId } = await kh.registerBag(bagUrl);                                 // idempotent — the cached mapping
  veilKh.adoptBag(bagUrl, docId);
  await veilKh.delegate({ bagUrl, audience: faceAgent, access: "admin" });
}

/** Time a batch of N sequential trips over ONE rig (the production shape: one vessel, one veil, N bags). */
async function timeBatch(n: number, fillBase: number): Promise<{ n: number; totalMs: number; perCallMs: number[] }> {
  const rig = await standRig(fillBase);
  const perCallMs: number[] = [];
  const t0 = performance.now();
  for (let i = 0; i < n; i++) {
    const c0 = performance.now();
    await oneRoadTrip(rig, `lar:///probe.road.costs/bag-${fillBase}-${i}`);
    perCallMs.push(performance.now() - c0);
  }
  return { n, totalMs: performance.now() - t0, perCallMs };
}

const mean  = (xs: readonly number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;
const round = (x: number): number => Math.round(x * 100) / 100;

describe("one-road-cost — the fleet-gather's per-dyad price, measured", () => {
  test("★ N=1 / N=4 / N=16 trips: per-call ms + the scaling verdict, written to disk ★", async () => {
    // Fresh rig per batch — each batch measures cost at call index 1..N cleanly, no cross-batch freight.
    const b1  = await timeBatch(1,  0x31);
    const b4  = await timeBatch(4,  0x41);
    const b16 = await timeBatch(16, 0x51);

    const per1  = mean(b1.perCallMs);
    const per4  = mean(b4.perCallMs);
    const per16 = mean(b16.perCallMs);
    // THE SCALING READ, off the N=16 batch's own gradient — QUARTILE means, because a single first or
    // last call carries jitter that flips a verdict (measured: last/first flickered 1.5–3.4 across runs
    // while the monotone climb stood in every one). A road whose per-call cost holds flat as calls
    // accumulate reads linear; a last-quartile several times its first reads superlinear — the
    // full-history re-ingest surfacing. The 1.5× line separates noise from growth.
    const firstQ = mean(b16.perCallMs.slice(0, 4));
    const lastQ  = mean(b16.perCallMs.slice(-4));
    const growth  = lastQ / Math.max(firstQ, 0.01);
    const scaling = growth > 1.5 ? "superlinear — per-call cost grows with accumulated delegations"
                                 : "linear-ish — per-call cost holds flat across accumulated delegations";

    const verdict = {
      measuredAt: new Date().toISOString(),
      road: "delegateToFaceViaVeil (reconstructed: registerBag + card-exchange + vessel→veil delegate + full-history ingest + adopt + veil→face delegate)",
      perCallMs: { n1: round(per1), n4: round(per4), n16: round(per16) },
      n16Gradient: { firstQuartileMs: round(firstQ), lastQuartileMs: round(lastQ), growthFactor: round(growth) },
      totalMs: { n1: round(b1.totalMs), n4: round(b4.totalMs), n16: round(b16.totalMs) },
      n16PerCallMs: b16.perCallMs.map(round),
      scaling,
      g4Reading: growth > 3
        ? "fleet-gather MUST batch — per-dyad road calls compound on the veil's event history"
        : "fleet-gather MAY call the road per-dyad at this scale — re-measure at fleet width before trusting it wider",
    };
    writeFileSync(VERDICT_PATH, JSON.stringify(verdict, null, 2) + "\n");

    // The LOOSE ceiling — a regression tripwire. A healthy road sits far under both lines.
    expect(per1).toBeLessThan(CEILING_SINGLE_MS);
    expect(per16).toBeLessThan(CEILING_PER_CALL_16);
    // And the shape holds: every trip landed (16 measured calls, none thrown past).
    expect(b16.perCallMs).toHaveLength(16);
  }, 120_000);

  test("★ the road's product stands — the face VERIFIES on a bag the road carried ★", async () => {
    // A timing over a road that silently failed would measure nothing. One trip, then the face's
    // access verified through the veil's own tree — the road's whole point, pinned.
    const rig = await standRig(0x61);
    const bagUrl = "lar:///probe.road.costs/verify-bag";
    await oneRoadTrip(rig, bagUrl);
    const verdict = await rig.veilKh.verify({ presenter: rig.faceAgent, bagUrl, access: "admin" });
    expect(verdict.ok).toBe(true);
  }, 60_000);
});
