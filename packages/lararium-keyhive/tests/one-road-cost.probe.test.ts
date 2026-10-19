/** The face door cost across successive bag mints on one face. */
import { describe, test, expect } from "vitest";
import { writeFileSync } from "node:fs";
import { KeyhiveProvider, InMemoryEventStore, makeFaceBagDoor } from "../src/index.js";

import { VERDICT_PATH } from "./verdict-path.js";

/** LOOSE ceilings — regression tripwires, never performance claims. A healthy run sits far under. */
const CEILING_SINGLE_MS   = 3000;
const CEILING_PER_CALL_16 = 5000;

async function vessel(fill: number): Promise<KeyhiveProvider> {
  const p = new KeyhiveProvider();
  await p.init({ seed: new Uint8Array(32).fill(fill), eventStore: new InMemoryEventStore() });
  return p;
}

interface RoadRig {
  readonly veilKh:    KeyhiveProvider;
  readonly faceAgent: string;            // the PersonaGroup's agent id (delegation target)
}

/** Stand a face and its group. */
async function standRig(fillBase: number): Promise<RoadRig> {
  const veilKh = await vessel(fillBase + 1);
  // The face — a sentinel doc the VEIL creates (the veil-born founding's seat), its agent the target.
  const face = await veilKh.createSentinelDoc(`lar:///probe.road.costs/face-${fillBase}`);
  return { veilKh, faceAgent: face.agentIdHex };
}

/** One face door mint. */
async function oneRoadTrip(rig: RoadRig, bagUrl: string): Promise<void> {
  await makeFaceBagDoor({ face: rig.veilKh, groupId: rig.faceAgent }).mint(bagUrl, "admin");
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
    // Each batch stands a fresh face.
    const b1  = await timeBatch(1,  0x31);
    const b4  = await timeBatch(4,  0x41);
    const b16 = await timeBatch(16, 0x51);

    const per1  = mean(b1.perCallMs);
    const per4  = mean(b4.perCallMs);
    const per16 = mean(b16.perCallMs);
    // Quartile means reduce single-call jitter.
    const firstQ = mean(b16.perCallMs.slice(0, 4));
    const lastQ  = mean(b16.perCallMs.slice(-4));
    const growth  = lastQ / Math.max(firstQ, 0.01);
    const scaling = growth > 1.5 ? "superlinear — per-call cost grows with accumulated delegations"
                                 : "linear-ish — per-call cost holds flat across accumulated delegations";

    const verdict = {
      road: "makeFaceBagDoor.mint",
      perCallMs: { n1: round(per1), n4: round(per4), n16: round(per16) },
      n16Gradient: { firstQuartileMs: round(firstQ), lastQuartileMs: round(lastQ), growthFactor: round(growth) },
      totalMs: { n1: round(b1.totalMs), n4: round(b4.totalMs), n16: round(b16.totalMs) },
      n16PerCallMs: b16.perCallMs.map(round),
      scaling,
    };
    writeFileSync(VERDICT_PATH, JSON.stringify(verdict, null, 2) + "\n");
    console.log(`[one-road-cost] verdict written: ${VERDICT_PATH}`);

    // Loose ceilings catch a large regression.
    expect(per1).toBeLessThan(CEILING_SINGLE_MS);
    expect(per16).toBeLessThan(CEILING_PER_CALL_16);
    // And the shape holds: every trip landed (16 measured calls, none thrown past).
    expect(b16.perCallMs).toHaveLength(16);
  }, 120_000);

  test("★ the road's product stands — the face VERIFIES on a bag the road carried ★", async () => {
    // A mint grants the group on the face provider.
    const rig = await standRig(0x61);
    const bagUrl = "lar:///probe.road.costs/verify-bag";
    await oneRoadTrip(rig, bagUrl);
    const verdict = await rig.veilKh.verify({ presenter: rig.faceAgent, bagUrl, access: "admin" });
    expect(verdict.ok).toBe(true);
  }, 60_000);
});
