/** Place arms cross only a charter lineage the held root can verify. */
import { describe, expect, test } from "vitest";
import { carriageEntryActCid, signRollAnchor, type CarriageEntry, type RollAnchor } from "../src/carriage-registry.js";
import { encodePlacePresentation, readPlacePresentation } from "../src/gate-exchange.js";
import { heldNexusRoot } from "../src/held-nexus-root.js";
import { makeMultiSigQuorumVerifier } from "../src/kapae-antigen.js";
import { verifyPresentedCarry } from "../src/face-gate.js";
import { seatedCharter, uncommittedSuccessor } from "./charter-fixture.js";
import { carriageAct, kahuSigners } from "./fixtures/carriage.js";

async function root(charter: Awaited<ReturnType<typeof seatedCharter>>) {
  const held = heldNexusRoot({ nexus: charter.aid, charter: charter.doc(), denyBoard: [], antigen: [], antigenVerifier: makeMultiSigQuorumVerifier() });
  if ("absent" in held) throw new Error(`fixture root absent: ${held.absent}`);
  return held;
}

async function anchor(closed: Awaited<ReturnType<typeof seatedCharter>>, opened: Awaited<ReturnType<typeof seatedCharter>>, parents: string[]): Promise<RollAnchor> {
  return signRollAnchor({ prevEpochCid: closed.head.epochCid, sealEpochCid: opened.head.epochCid, prevKeys: closed.roster.keys,
    prevThreshold: closed.roster.threshold, parents }, await kahuSigners(opened.seeds.slice(0, opened.threshold)));
}

async function carry(charter: Awaited<ReturnType<typeof seatedCharter>>, parents: string[] = []): Promise<CarriageEntry> {
  return carriageAct(new Uint8Array(32).fill(91), "carry", { kahu: charter.seeds.slice(0, charter.threshold), epoch: charter.head.epochCid, parents });
}

describe("place arms across charter rolls", () => {
  test("RED: a newer gate holds a contract carried at its ancestor when its anchor cites the contract", async () => {
    const old = await seatedCharter({ seats: 3, threshold: 2, seed: 713 });
    const next = await old.roll();
    const contract = await carry(old);
    const roll = await anchor(old, next, [carriageEntryActCid(contract)]);
    expect(await verifyPresentedCarry({ contract, lineage: [roll], sealLineage: next.chain }, await root(next))).toMatchObject({ state: "held" });
  });

  test("RED: an older gate accepts a presented epoch only when the charter committed that successor", async () => {
    const old = await seatedCharter({ seats: 3, threshold: 2, seed: 714 });
    const next = await old.roll();
    const contract = await carry(next);
    expect(await verifyPresentedCarry({ contract, lineage: [], sealLineage: next.chain }, await root(old))).toMatchObject({ state: "held" });
  });

  test("CONTROL: a head contract holds; a missing anchor and a false closing past refuse", async () => {
    const old = await seatedCharter({ seats: 3, threshold: 2, seed: 715 });
    const next = await old.roll();
    const contract = await carry(old);
    const held = await root(next);
    expect(await verifyPresentedCarry({ contract: await carry(next), lineage: [], sealLineage: next.chain }, await root(next))).toMatchObject({ state: "held" });
    expect(await verifyPresentedCarry({ contract, lineage: [], sealLineage: next.chain }, held)).toMatchObject({ state: "wrong-epoch" });
    const falseRoll = await anchor(old, next, []);
    expect(await verifyPresentedCarry({ contract, lineage: [falseRoll], sealLineage: next.chain }, held)).not.toMatchObject({ state: "held" });
  });

  test("CONTROL: a foreign epoch cannot extend the gate's charter", async () => {
    const old = await seatedCharter({ seats: 3, threshold: 2, seed: 716 });
    const foreign = await seatedCharter({ seats: 3, threshold: 2, seed: 717 });
    const contract = await carry(foreign);
    expect(await verifyPresentedCarry({ contract, lineage: [], sealLineage: foreign.chain }, await root(old))).not.toMatchObject({ state: "held" });
  });

  test("CONTROL: a same-charter extension signed by uncommitted successor seats refuses", async () => {
    const old = await seatedCharter({ seats: 3, threshold: 2, seed: 719 });
    const uncommitted = await seatedCharter({ seats: 3, threshold: 2, seed: 720 });
    const forged = await uncommittedSuccessor(old, uncommitted);
    const contract = await carry(uncommitted);
    expect(await verifyPresentedCarry({ contract, lineage: [], sealLineage: [old.head, forged] }, await root(old))).not.toMatchObject({ state: "held" });
  });

  test("CONTROL: an opening quorum cannot anchor false closing seats", async () => {
    const old = await seatedCharter({ seats: 3, threshold: 2, seed: 721 });
    const next = await old.roll();
    const falseClosing = await seatedCharter({ seats: 3, threshold: 2, seed: 722 });
    const contract = await carry(old);
    const falseRoll = await signRollAnchor({ prevEpochCid: old.head.epochCid, sealEpochCid: next.head.epochCid,
      prevKeys: falseClosing.roster.keys, prevThreshold: falseClosing.roster.threshold, parents: [carriageEntryActCid(contract)] },
      await kahuSigners(next.seeds.slice(0, next.threshold)));
    expect(await verifyPresentedCarry({ contract, lineage: [falseRoll], sealLineage: next.chain }, await root(next))).not.toMatchObject({ state: "held" });
  });

  test("the place wire reads the anchored lineage and epoch history under its exact bounded shape", async () => {
    const old = await seatedCharter({ seats: 3, threshold: 2, seed: 718 });
    const next = await old.roll();
    const contract = await carry(old);
    const roll = await anchor(old, next, [carriageEntryActCid(contract)]);
    const placeKey = contract.nym;
    const presentation = { placeKey, audience: "lar:///ha.ka.ba/bags/daemon", arm: { kind: "place" as const, contract, lineage: [roll], sealLineage: next.chain } };
    expect(readPlacePresentation(encodePlacePresentation(presentation))?.arm).toEqual(presentation.arm);
    const oversized = { ...presentation, arm: { ...presentation.arm, lineage: Array.from({ length: 65 }, () => roll) } };
    expect(readPlacePresentation(encodePlacePresentation(oversized))).toBeNull();
  });
});
