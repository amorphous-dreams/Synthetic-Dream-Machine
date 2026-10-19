import { describe, expect, test } from "vitest";
import { carriageAct } from "./fixtures/carriage.js";
import { seatedCharter } from "./charter-fixture.js";
import { encodePlacePresentation, readPlacePresentation, type PlacePresentation } from "../src/gate-exchange.js";
import { verifyPresentedCarry } from "../src/face-gate.js";
import { heldNexusRoot } from "../src/held-nexus-root.js";
import { makeMultiSigQuorumVerifier } from "../src/kapae-antigen.js";
import type { SealEpoch } from "../src/wax-stamp.js";

describe("one place arm shape and anchored charter prefix", () => {
  test("RED: the reader refuses a three-key arm; CONTROL: the four-key arm reads", async () => {
    const charter = await seatedCharter({ seats: 3, threshold: 2, seed: 811 });
    const contract = await carriageAct(new Uint8Array(32).fill(81), "carry", {
      kahu: charter.seeds.slice(0, charter.threshold), epoch: charter.head.epochCid, parents: [],
    });
    const three = { placeKey: contract.nym, audience: "lar:///ha.ka.ba/bags/daemon", arm: { kind: "place" as const, contract, lineage: [] } };
    const four = { ...three, arm: { ...three.arm, sealLineage: [] } };
    expect(readPlacePresentation(encodePlacePresentation(four))?.arm).toEqual(four.arm);
    expect(readPlacePresentation(encodePlacePresentation(three as unknown as PlacePresentation))).toBeNull();
  });

  test("RED: a verified epoch with reordered fields matches its held content id; CONTROL: the original prefix matches", async () => {
    const old = await seatedCharter({ seats: 3, threshold: 2, seed: 812 });
    const next = await old.roll();
    const contract = await carriageAct(new Uint8Array(32).fill(82), "carry", {
      kahu: next.seeds.slice(0, next.threshold), epoch: next.head.epochCid, parents: [],
    });
    const held = heldNexusRoot({ nexus: old.aid, charter: old.doc(), denyBoard: [], antigen: [], antigenVerifier: makeMultiSigQuorumVerifier() });
    if ("absent" in held) throw new Error(`fixture root absent: ${held.absent}`);
    expect(await verifyPresentedCarry({ contract, lineage: [], sealLineage: next.chain }, held)).toMatchObject({ state: "held" });
    const reordered = Object.fromEntries(Object.entries(next.chain[0]!).reverse()) as unknown as SealEpoch;
    expect(await verifyPresentedCarry({ contract, lineage: [], sealLineage: [reordered, ...next.chain.slice(1)] }, held)).toMatchObject({ state: "held" });
  });
});
