import { describe, expect, test } from "vitest";
import { emptyLarDoc } from "../src/base-doc.js";
import { charterHandLineage } from "../src/charter-hand-lineage.js";
import { signEdgeKapae, signEdgeRollAnchor } from "../src/edge-kapae.js";
import { edgeActPartial, readEdgeActPartial } from "../src/edge-partial.js";
import { carryOfPrepared, cosignFrontierCarry, frontierCarryAgrees, frontierCarryStands, landFrontierCarry, readFrontierCarry } from "../src/frontier-carry.js";
import { nexusActPartial, readNexusActPartial } from "../src/nexus-partial.js";
import { memberEdgeId } from "../src/realm-edges.js";
import { landRealmGenesis, prepareRealmFrontier } from "../src/realm-frontier.js";
import { seatedCharter } from "./charter-fixture.js";

const REALM = "bc".repeat(32), MEMBER = "de".repeat(32);
const hands = async (charter: Awaited<ReturnType<typeof seatedCharter>>, indices: number[]) =>
  (await charter.signers(indices)).map((s) => ({ key: s.signer, sign: s.sign }));

describe("frontier carry", () => {
  test("each record needs the second seat, including genesis-and-next; a moved board changes the signed body", async () => {
    const charter = await seatedCharter({ seats: 2, threshold: 2, seed: 101 }), lineage = charterHandLineage(charter.chain)!.lineage;
    const board = emptyLarDoc(), first = await hands(charter, [0]), second = await hands(charter, [1]);
    const prepared = await prepareRealmFrontier({ realm: REALM, board, lineage, counted: ["raise"], signers: first });
    expect(prepared.kind).toBe("genesis-and-next");
    const short = carryOfPrepared(prepared)!;
    expect(frontierCarryStands({ carry: short, board, boardId: REALM, hand: "quorum", lineage })).toBe(false);
    const grown = await cosignFrontierCarry(short, second);
    expect(frontierCarryStands({ carry: grown, board, boardId: REALM, hand: "quorum", lineage })).toBe(true);
    expect(frontierCarryAgrees(grown, prepared)).toBe(true);
    expect(frontierCarryStands({ carry: { ...grown, records: [{ ...grown.records[0]!, body: { ...grown.records[0]!.body, group: "ff".repeat(32) } }, grown.records[1]!] }, board, boardId: REALM, hand: "quorum", lineage })).toBe(false);
    landFrontierCarry(board, grown);
    const moved = await prepareRealmFrontier({ realm: REALM, board, lineage, counted: ["raise", "later"], signers: first });
    expect(frontierCarryAgrees(grown, moved)).toBe(false);
  });

  test("a successor alone completes against the board's genesis", async () => {
    const charter = await seatedCharter({ seats: 2, threshold: 2, seed: 102 }), lineage = charterHandLineage(charter.chain)!.lineage;
    const board = emptyLarDoc();
    await landRealmGenesis(board, REALM, lineage, await hands(charter, [0, 1]));
    const prepared = await prepareRealmFrontier({ realm: REALM, board, lineage, counted: ["raise"], signers: await hands(charter, [0]) });
    expect(prepared.kind).toBe("next");
    const grown = await cosignFrontierCarry(carryOfPrepared(prepared)!, await hands(charter, [1]));
    expect(frontierCarryStands({ carry: grown, board, boardId: REALM, hand: "quorum", lineage })).toBe(true);
  });

  test("edge and edge-roll partials keep a bounded carry across JSON; a torn carry drops the partial", async () => {
    const charter = await seatedCharter({ seats: 2, threshold: 2, seed: 103 }), lineage = charterHandLineage(charter.chain)!.lineage;
    const carry = carryOfPrepared(await prepareRealmFrontier({ realm: REALM, board: emptyLarDoc(), lineage, counted: [], signers: await hands(charter, [0]) }))!;
    const act = await signEdgeKapae({ edgeId: memberEdgeId(REALM, MEMBER), raised: true, hand: "quorum", parents: [], epochCid: charter.head.epochCid }, await charter.signers([0]));
    const partial = edgeActPartial(act, REALM, { kind: "member", member: MEMBER }, carry);
    expect(readEdgeActPartial(JSON.parse(JSON.stringify(partial)))?.frontier).toEqual(carry);
    expect(readEdgeActPartial({ ...partial, frontier: { records: [], raises: [] } })).toBeNull();
    expect(readEdgeActPartial(edgeActPartial(act, REALM, { kind: "member", member: MEMBER }))?.frontier).toBeUndefined();
    const rolled = await charter.roll();
    const anchor = await signEdgeRollAnchor({ scope: REALM, prevEpochCid: charter.head.epochCid, sealEpochCid: rolled.head.epochCid,
      prevKeys: [...charter.keys].sort(), prevThreshold: charter.threshold, parents: [] }, await rolled.signers([0]));
    const nexus = nexusActPartial(rolled.aid, { family: "edge-roll-anchor", anchor, frontier: carry });
    expect((readNexusActPartial(JSON.parse(JSON.stringify(nexus)))?.act as { frontier?: unknown }).frontier).toEqual(carry);
    expect(readNexusActPartial({ ...nexus, act: { ...nexus.act, frontier: { records: [], raises: [] } } })).toBeNull();
    expect(readFrontierCarry({ ...carry, raises: Array(4097).fill("x") })).toBeNull();
  });
});
