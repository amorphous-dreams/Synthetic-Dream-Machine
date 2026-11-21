import { describe, expect, test } from "vitest";
import { emptyLarDoc } from "../src/base-doc.js";
import { charterHandLineage } from "../src/charter-hand-lineage.js";
import { leaseEpochSlotUri } from "../src/epoch-lease.js";
import { landQuorumLease, quorumLeaseEpoch, quorumLeaseEpochOnBoard, quorumLeaseSlotUri, readQuorumLease, signQuorumLease } from "../src/quorum-lease.js";
import { actCid, signQuorumAct } from "../src/signed-act.js";
import { seatedCharter } from "./charter-fixture.js";

const RESOURCE = "ab".repeat(32);
const OTHER = "cd".repeat(32);
const setup = async () => {
  const charter = await seatedCharter({ seats: 3, threshold: 2, seed: 41 });
  const hand = charterHandLineage(charter.chain)!;
  return { charter, hand, signers: await charter.signers() };
};

describe("quorum-lease", () => {
  test("RED: bare writer and quorum slots raise nothing; CONTROL: the threshold act raises", async () => {
    const { hand, signers } = await setup();
    const bare = "17";
    const board = emptyLarDoc();
    const writerSlot = leaseEpochSlotUri(RESOURCE, signers[0]!.signer);
    const quorumSlot = quorumLeaseSlotUri(RESOURCE, "00".repeat(32));
    (board.tiddlers as Record<string, unknown>)[writerSlot] = { tiddler: { title: writerSlot, text: bare }, meta: { authority: "test" } };
    (board.tiddlers as Record<string, unknown>)[quorumSlot] = { tiddler: { title: quorumSlot, text: bare }, meta: { authority: "test" } };
    expect(quorumLeaseEpoch(RESOURCE, [bare, bare], hand.lineage)).toBe(0);
    expect(quorumLeaseEpochOnBoard(board, RESOURCE, hand.lineage)).toBe(0);
    const act = await signQuorumLease({ resource: RESOURCE, epoch: 17, lineage: hand.lineage }, signers.slice(0, 2).map((s) => ({ key: s.signer, sign: s.sign })));
    landQuorumLease(board, RESOURCE, act);
    expect(quorumLeaseEpochOnBoard(board, RESOURCE, hand.lineage)).toBe(17);
    expect(quorumLeaseEpochOnBoard(board, RESOURCE, null)).toBe(0);
  });

  test("RED: one seat cannot raise; CONTROL: exactly k and extra seats count", async () => {
    const { hand, signers } = await setup();
    const all = signers.map((s) => ({ key: s.signer, sign: s.sign }));
    expect(() => signQuorumLease({ resource: RESOURCE, epoch: 4, lineage: hand.lineage }, all.slice(0, 1))).toThrow();
    const two = await signQuorumLease({ resource: RESOURCE, epoch: 4, lineage: hand.lineage }, all.slice(0, 2));
    const one = { ...two, signatures: two.signatures.slice(0, 1) };
    expect(quorumLeaseEpoch(RESOURCE, [JSON.stringify(one)], hand.lineage)).toBe(0);
    expect(quorumLeaseEpoch(RESOURCE, [JSON.stringify(two)], hand.lineage)).toBe(4);
    const three = await signQuorumLease({ resource: RESOURCE, epoch: 4, lineage: hand.lineage }, all);
    expect(quorumLeaseEpoch(RESOURCE, [JSON.stringify(three)], hand.lineage)).toBe(4);
  });

  test("RED: an old advance verifies at its own seal epoch; CONTROL: false epoch claims refuse", async () => {
    const { charter, hand, signers } = await setup();
    const old = await signQuorumLease({ resource: RESOURCE, epoch: 3, lineage: hand.lineage }, signers.slice(0, 2).map((s) => ({ key: s.signer, sign: s.sign })));
    const rolled = await charter.roll();
    const newHand = charterHandLineage(rolled.chain)!;
    expect(readQuorumLease(RESOURCE, JSON.stringify(old), newHand.lineage)).toBe(3);
    const lie = await signQuorumAct({ ...old.body, handEpoch: 1, rosterHash: newHand.lineage[1]!.rosterHash }, signers.slice(0, 2).map((s) => ({ key: s.signer, sign: s.sign })));
    expect(readQuorumLease(RESOURCE, JSON.stringify(lie), newHand.lineage)).toBeNull();
    expect(readQuorumLease(RESOURCE, JSON.stringify({ ...old, body: { ...old.body, handEpoch: 1 } }), newHand.lineage)).toBeNull();
  });

  test("RED: broken seal ancestry yields no hand; CONTROL: honest ancestry builds", async () => {
    const { charter, hand, signers } = await setup();
    const rolled = await charter.roll();
    expect(charterHandLineage(rolled.chain)).not.toBeNull();
    const bad = [rolled.chain[0]!, { ...rolled.chain[1]!, keySetHash: "00".repeat(32) }];
    expect(charterHandLineage(bad)).toBeNull();
    expect(charterHandLineage(rolled.chain.slice(1))).toBeNull();
    expect(charterHandLineage([...rolled.chain].reverse())).toBeNull();
    const act = await signQuorumLease({ resource: RESOURCE, epoch: 3, lineage: hand.lineage }, signers.slice(0, 2).map((s) => ({ key: s.signer, sign: s.sign })));
    expect(quorumLeaseEpoch(RESOURCE, [JSON.stringify(act)], charterHandLineage(bad)?.lineage ?? null)).toBe(0);
  });

  test("RED: no sighting lowers the fence; CONTROL: a closed roster's advance only raises", async () => {
    const { charter, hand, signers } = await setup();
    const oldHands = signers.slice(0, 2).map((s) => ({ key: s.signer, sign: s.sign }));
    const rolled = await charter.roll();
    const newHand = charterHandLineage(rolled.chain)!;
    const newHands = (await rolled.signers([0, 1])).map((s) => ({ key: s.signer, sign: s.sign }));
    const low = JSON.stringify(await signQuorumLease({ resource: RESOURCE, epoch: 2, lineage: newHand.lineage }, newHands));
    const oldHigh = JSON.stringify(await signQuorumLease({ resource: RESOURCE, epoch: 9, lineage: hand.lineage }, oldHands));
    // Either arrival order reads the same maximum: a replica that sighted the high advance never reads below it.
    expect(quorumLeaseEpoch(RESOURCE, [low, oldHigh], newHand.lineage)).toBe(9);
    expect(quorumLeaseEpoch(RESOURCE, [oldHigh, low], newHand.lineage)).toBe(9);
    expect(quorumLeaseEpoch(RESOURCE, [low], newHand.lineage)).toBe(2);
    const newHigh = JSON.stringify(await signQuorumLease({ resource: RESOURCE, epoch: 12, lineage: newHand.lineage }, newHands));
    expect(quorumLeaseEpoch(RESOURCE, [low, oldHigh, newHigh], newHand.lineage)).toBe(12);
  });

  test("RED: another resource and a tampered body refuse", async () => {
    const { hand, signers } = await setup();
    const act = await signQuorumLease({ resource: RESOURCE, epoch: 5, lineage: hand.lineage }, signers.slice(0, 2).map((s) => ({ key: s.signer, sign: s.sign })));
    expect(readQuorumLease(OTHER, JSON.stringify(act), hand.lineage)).toBeNull();
    expect(readQuorumLease(RESOURCE, JSON.stringify({ ...act, body: { ...act.body, epoch: 99 } }), hand.lineage)).toBeNull();
  });

  test("RED: concurrent quorum advances survive in distinct content slots and a lower advance cannot lower the max", async () => {
    const { hand, signers } = await setup();
    const hands = signers.map((s) => ({ key: s.signer, sign: s.sign }));
    const a = await signQuorumLease({ resource: RESOURCE, epoch: 7, lineage: hand.lineage }, hands.slice(0, 2));
    const b = await signQuorumLease({ resource: RESOURCE, epoch: 7, lineage: hand.lineage }, hands.slice(1, 3));
    const low = await signQuorumLease({ resource: RESOURCE, epoch: 4, lineage: hand.lineage }, hands.slice(0, 2));
    const board = emptyLarDoc();
    [a, b, low].forEach((act) => landQuorumLease(board, RESOURCE, act));
    expect(quorumLeaseSlotUri(RESOURCE, actCid(a.body))).toBe(quorumLeaseSlotUri(RESOURCE, actCid(b.body)));
    expect(quorumLeaseEpochOnBoard(board, RESOURCE, hand.lineage)).toBe(7);
  });
});
