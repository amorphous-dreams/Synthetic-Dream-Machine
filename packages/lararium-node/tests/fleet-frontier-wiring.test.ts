import { describe, expect, test } from "vitest";
import {
  ed25519SignerFromSeed, ed25519VerifyingKeyFromSeed, emptyLarDoc, fleetEdgeBoardDocUrl,
  landFleetGenesis, makeHandLineage, makeIslandRepo, materializeSharedLarDoc,
  writeEdgeFrontier, writeFrontierSnapshot, deviceEdgeId, signEdgeKapae, writeEdgeKapae, nextFleetFrontier, landFleetFrontier, fleetRaiseCids,
} from "@lararium/mesh";
import { makeEdgeShadowRing } from "../src/edge-shadow-ring.js";

const seed = new Uint8Array(32).fill(111);

async function fixture() {
  const fleetRoot = await ed25519VerifyingKeyFromSeed(seed);
  const vesselKey = await ed25519VerifyingKeyFromSeed(new Uint8Array(32).fill(112));
  const repo = makeIslandRepo({ syncPort: new MessageChannel().port1 });
  const board = await materializeSharedLarDoc(repo, fleetEdgeBoardDocUrl(fleetRoot), "board:edge-kapae");
  const lineage = makeHandLineage([{ epoch: 0, signers: [fleetRoot], threshold: 1 }])!;
  const ring = makeEdgeShadowRing({ repo, vesselKey: () => vesselKey, sealHome: "",
    fleetRoots: () => [fleetRoot], lineageOfFleet: () => lineage,
    vesselKeyOfPeer: () => null, realmNymOfPeer: () => null });
  const genesis = async () => {
    const staged = emptyLarDoc();
    const signed = await landFleetGenesis(staged, fleetRoot, lineage,
      { key: fleetRoot, sign: ed25519SignerFromSeed(seed) });
    board.change((draft) => { writeFrontierSnapshot(draft, []); writeEdgeFrontier(draft, signed); });
  };
  return { repo, fleetRoot, vesselKey, board, ring, genesis };
}

describe("the node fleet ring widens through a signed frontier", () => {
  test("RED: before fold or without genesis, widening blocks; CONTROL: founded board clears", async () => {
    const f = await fixture();
    try {
      expect(f.ring.widenBlocked(f.fleetRoot)).toBe(true);
      await f.ring.refold();
      expect(f.ring.frontierOf(f.fleetRoot)?.status).toBe("unknown");
      expect(f.ring.deviceStanding(f.fleetRoot, f.vesselKey)).toBe("unknown");
      await f.genesis();
      await f.ring.refold();
      expect(f.ring.widenBlocked(f.fleetRoot)).toBe(false);
      expect(f.ring.deviceStanding(f.fleetRoot, f.vesselKey)).toBe("clear");
    } finally { f.ring.dispose(); await f.repo.shutdown(); }
  });

  test("RED: an UNKNOWN fleet frontier reads the device aside at the gate consult; CONTROL: a founded board reads it clear", async () => {
    const f = await fixture();
    try {
      await f.ring.refold();
      expect(f.ring.frontierOf(f.fleetRoot)?.status).toBe("unknown");
      expect(f.ring.deviceAside(f.vesselKey), "absence is not clear: an unknown frontier vouches for no device").toBe(true);
      await f.genesis();
      await f.ring.refold();
      expect(f.ring.deviceAside(f.vesselKey)).toBe(false);
    } finally { f.ring.dispose(); await f.repo.shutdown(); }
  });

  test("RED: a fleet with no held lineage blocks widening even with a signed genesis", async () => {
    const f = await fixture();
    const noLineage = makeEdgeShadowRing({ repo: f.repo, vesselKey: () => f.vesselKey, sealHome: "",
      fleetRoots: () => [f.fleetRoot], lineageOfFleet: () => null,
      vesselKeyOfPeer: () => null, realmNymOfPeer: () => null });
    try {
      await f.genesis();
      await noLineage.refold();
      expect(noLineage.widenBlocked(f.fleetRoot)).toBe(true);
      expect(noLineage.deviceStanding(f.fleetRoot, f.vesselKey)).toBe("unknown");
    } finally { noLineage.dispose(); f.ring.dispose(); await f.repo.shutdown(); }
  });

  test("CONTROL: registering the counted holder raise advances the signed head", async () => {
    const f = await fixture();
    try {
      await f.genesis();
      const raise = await signEdgeKapae({ edgeId: deviceEdgeId(f.fleetRoot, f.vesselKey), raised: true, hand: "holder", parents: [] },
        [{ signer: f.fleetRoot, sign: ed25519SignerFromSeed(seed) }]);
      f.board.change((draft) => writeEdgeKapae(draft, raise));
      await f.ring.refold();
      expect(f.ring.widenBlocked(f.fleetRoot)).toBe(true);
      const counted = await import("../src/edge-board.js").then(({ readVesselEdgeBoard }) => readVesselEdgeBoard({
        repo: f.repo, scope: f.fleetRoot, kind: "fleet", boardUrl: fleetEdgeBoardDocUrl(f.fleetRoot),
        label: "board:edge-kapae", vesselKey: f.vesselKey,
        authorityFor: () => ({ holder: f.fleetRoot }),
      }));
      const lineage = makeHandLineage([{ epoch: 0, signers: [f.fleetRoot], threshold: 1 }])!;
      const next = await nextFleetFrontier({ fleetRoot: f.fleetRoot, board: f.board.doc(), lineage,
        counted: fleetRaiseCids(counted.counted.acts), signer: { key: f.fleetRoot, sign: ed25519SignerFromSeed(seed) } });
      expect(next).not.toBeNull();
      f.board.change((draft) => landFleetFrontier(draft, next!));
      await f.ring.refold();
      expect(f.ring.frontierOf(f.fleetRoot)).toMatchObject({ status: "known", asOf: { fleet: { seq: 1 } } });
    } finally { f.ring.dispose(); await f.repo.shutdown(); }
  });

  test("RED: a counted raise absent from the frontier blocks widening but still shadows its target", async () => {
    const f = await fixture();
    try {
      await f.genesis();
      const raise = await signEdgeKapae({ edgeId: deviceEdgeId(f.fleetRoot, f.vesselKey), raised: true, hand: "holder", parents: [] },
        [{ signer: f.fleetRoot, sign: ed25519SignerFromSeed(seed) }]);
      f.board.change((draft) => writeEdgeKapae(draft, raise));
      await f.ring.refold();
      expect(f.ring.frontierOf(f.fleetRoot)?.status).toBe("unknown");
      expect(f.ring.widenBlocked(f.fleetRoot)).toBe(true);
      expect(f.ring.deviceStanding(f.fleetRoot, f.vesselKey)).toBe("aside");
    } finally { f.ring.dispose(); await f.repo.shutdown(); }
  });
});
