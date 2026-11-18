/**
 * vessel-gates — ONE face gate per (Nexus, route), assembled from this vessel's own readers: the held root of that
 * Nexus alone, the D4 shadow ring, the PersonaGroup grant ring, the one sorter over that Nexus's posture, and the
 * withdrawal memory a sovereign gate keeps.
 *
 * Proven, each with its control, through a real gate and a real dial:
 *   · an admit held at the gate's own Nexus attaches contracted, standing as the proven face / RED: a vessel that
 *     carries no reading for that Nexus answers the same dial silence (`admit-refused`);
 *   · RED: a bare presenter at a PRIVATE Nexus draws silence / CONTROL: at an OPEN one it attaches as a stranger,
 *     the posture read fresh for THIS gate's Nexus;
 *   · a refusal reaches the vessel's own log under the gate's Nexus and route.
 */
import { describe, expect, test } from "vitest";
import type { FederationPosture, GateShadowRing } from "@lararium/mesh";
import { vesselGate } from "../src/vessel-gates.js";
import type { CarriedNexusReading } from "../src/nexus-carriage.js";
import { world, presenter, dial, type World } from "../../lararium-mesh/tests/face-gate-fixture.js";

const clear: GateShadowRing = { consult: () => ({ aside: false, fleetAside: true }), consultPlace: () => ({ aside: false }) };

function readingOf(w: World): CarriedNexusReading {
  return { ...w.held!, aid: w.nexus, via: "consent", island: `island-${w.nexus}`, sealLineage: [], posture: "private" } as CarriedNexusReading;
}

async function stood(opts: { carried?: boolean; posture?: FederationPosture } = {}) {
  const w = await world();
  const refused: string[] = [], shut: string[] = [];
  let posture: FederationPosture = opts.posture ?? "private";
  const gate = vesselGate({
    readings: async () => (opts.carried === false ? [] : [readingOf(w)]),
    posture: () => posture,
    shadows: clear,
    grants: { grantFor: () => null },
    withdrawals: w.withdrawals,
    deadlines: w.deadlines,
    audience: "lar:///ha.ka.ba/bags/daemon",
    onRefuse: (at, reason) => { refused.push(`${at.nexus}${at.route}:${reason}`); },
    onShut: (arm) => { shut.push(arm); },
  }, { bundle: w.bundle, nexus: w.nexus, sessions: {
    attach(_socket, session) { return { open() { w.attached.push({ socket: _socket, session }); }, abandon() {} }; },
  } });
  const mine: World = { ...w, gate } as World;
  return { w, mine, refused, shut, setPosture: (p: FederationPosture) => { posture = p; } };
}

describe("a vessel's gate, assembled", () => {
  test("an admit held at the gate's own Nexus attaches contracted; RED: with no reading for that Nexus, silence", async () => {
    const s = await stood();
    const p = await presenter(s.w, "face");
    expect((await dial(s.mine, p)).gate).toEqual({ outcome: "attached", class: "contracted" });
    expect(s.w.attached.at(-1)!.session.standing).toEqual({ nym: p.scope.faceKey, aid: s.w.nexus });
    const bare = await stood({ carried: false });
    const q = await presenter(bare.w, "face");
    expect((await dial(bare.mine, q)).gate).toEqual({ outcome: "silence", reason: "admit-refused" });
    expect(bare.refused).toEqual([`${bare.w.nexus}/ws:admit-refused`]);
  });

  test("RED: a bare presenter at a PRIVATE Nexus draws silence; CONTROL: OPEN seats it as a stranger, read fresh", async () => {
    const s = await stood();
    const p = await presenter(s.w, "bare");
    expect((await dial(s.mine, p, { arm: null })).gate).toEqual({ outcome: "silence", reason: "sorted-silent" });
    s.setPosture("open");
    expect((await dial(s.mine, p, { arm: null })).gate).toEqual({ outcome: "attached", class: "stranger" });
  });
});
