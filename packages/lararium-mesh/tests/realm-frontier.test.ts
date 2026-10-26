import { describe, expect, test } from "vitest";
import { emptyLarDoc } from "../src/base-doc.js";
import { charterHandLineage } from "../src/charter-hand-lineage.js";
import { signGenesisFrontier, signNextFrontier } from "../src/edge-frontier.js";
import { writeEdgeFrontier, writeFrontierSnapshot } from "../src/edge-frontier-board.js";
import { landRealmFrontier, landRealmGenesis, nextRealmFrontier, readRealmFrontier, ensureRealmFrontier, realmRaiseCids } from "../src/realm-frontier.js";
import { seatedCharter } from "./charter-fixture.js";

const REALM = "ef".repeat(32);
async function setup() {
  const charter = await seatedCharter({ seats: 3, threshold: 2, seed: 77 });
  const hand = charterHandLineage(charter.chain)!;
  const signers = (await charter.signers([0, 1])).map((s) => ({ key: s.signer, sign: s.sign }));
  return { charter, hand, signers, board: emptyLarDoc() };
}
const read = (board: ReturnType<typeof emptyLarDoc>, lineage: NonNullable<ReturnType<typeof charterHandLineage>>["lineage"], seenRaises: string[] = []) =>
  readRealmFrontier({ realm: REALM, board, lineage, seenRaises, pinned: null });

describe("realm-frontier", () => {
  test("RED: before a frontier the reader waits; CONTROL: genesis qualifies and names its head", async () => {
    const { hand, signers, board } = await setup();
    expect(read(board, hand.lineage)).toMatchObject({ status: "unknown", missing: [{ why: "no-frontier" }] });
    expect((await ensureRealmFrontier({ realm: REALM, board, lineage: hand.lineage, counted: [], signers }))?.kind).toBe("genesis");
    const genesis = await landRealmGenesis(board, REALM, hand.lineage, signers);
    expect(read(board, hand.lineage)).toMatchObject({ status: "known", asOf: { quorum: { seq: 0 } } });
    expect((await ensureRealmFrontier({ realm: REALM, board, lineage: hand.lineage, counted: [], signers }))?.kind).toBe("none");
    expect(genesis.body.group).toBe(REALM);
  });

  test("RED: a subthreshold genesis refuses; CONTROL: threshold genesis stands", async () => {
    const { hand, signers, board } = await setup();
    const roster = hand.lineage[0]!;
    writeFrontierSnapshot(board, []);
    const one = await signGenesisFrontier({ board: REALM, hand: "quorum", epoch: 0, rosterHash: roster.rosterHash }, signers.slice(0, 1));
    writeEdgeFrontier(board, one);
    expect(read(board, hand.lineage)).toMatchObject({ status: "unknown", missing: [{ why: "below-threshold" }] });
    const two = await signGenesisFrontier({ board: REALM, hand: "quorum", epoch: 0, rosterHash: roster.rosterHash }, signers);
    writeEdgeFrontier(board, two);
    expect(read(board, hand.lineage).status).toBe("known");
  });

  test("RED: a seen raise withheld by the head waits; CONTROL: next counts it", async () => {
    const { hand, signers, board } = await setup();
    await landRealmGenesis(board, REALM, hand.lineage, signers);
    expect(read(board, hand.lineage, ["raise1"])).toMatchObject({ status: "unknown", missing: [{ why: "withholds-seen-raise" }] });
    const next = await nextRealmFrontier({ realm: REALM, board, lineage: hand.lineage, counted: ["raise1"], signers });
    landRealmFrontier(board, next!);
    expect(read(board, hand.lineage, ["raise1"])).toMatchObject({ status: "known", asOf: { quorum: { seq: 1 } } });
    expect(realmRaiseCids([{ actCid: "r", raised: true, hand: "quorum" }, { actCid: "x", raised: true, hand: "holder" }] as never)).toEqual(["r"]);
  });

  test("RED: an old head after roll waits; CONTROL: ensure signs a new head under the new roster", async () => {
    const { charter, hand, signers, board } = await setup();
    await landRealmGenesis(board, REALM, hand.lineage, signers);
    const rolled = await charter.roll();
    const nextHand = charterHandLineage(rolled.chain)!;
    const nextSigners = (await rolled.signers([0, 1])).map((s) => ({ key: s.signer, sign: s.sign }));
    expect(read(board, nextHand.lineage)).toMatchObject({ status: "unknown", missing: [{ why: "stale-lineage" }] });
    const needed = await ensureRealmFrontier({ realm: REALM, board, lineage: nextHand.lineage, counted: [], signers: nextSigners });
    expect(needed?.kind).toBe("next");
    if (needed && needed.kind !== "none") landRealmFrontier(board, needed);
    expect(read(board, nextHand.lineage).status).toBe("known");
  });

  test("RED: conflicting heads read fork", async () => {
    const { hand, signers, board } = await setup();
    const genesis = await landRealmGenesis(board, REALM, hand.lineage, signers);
    const roster = hand.lineage[0]!;
    const a = await signNextFrontier(genesis, ["a"], { epoch: 0, rosterHash: roster.rosterHash }, signers);
    const b = await signNextFrontier(genesis, ["b"], { epoch: 0, rosterHash: roster.rosterHash }, signers);
    writeFrontierSnapshot(board, ["a"]); writeFrontierSnapshot(board, ["b"]);
    writeEdgeFrontier(board, a); writeEdgeFrontier(board, b);
    expect(read(board, hand.lineage, ["a", "b"])).toMatchObject({ status: "unknown", missing: [{ why: "fork" }] });
  });
});
