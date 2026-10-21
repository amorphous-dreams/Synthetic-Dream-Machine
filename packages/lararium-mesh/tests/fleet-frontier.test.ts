/**
 * fleet-frontier (K17 on a fleet board) — the genesis lands with the fleet, a raise registers into the root's next
 * frontier, and the board reads known only as of a qualifying frontier. Reds: a fleet board with no frontier, a raise
 * the frontier does not count, and a reader pinned past a rewound board each answer unknown; a shadow narrows at
 * once. Controls: the founded fleet reads known; a registered raise reads known; the pin only rises.
 */
import { describe, expect, test } from "vitest";
import { emptyLarDoc } from "../src/base-doc.js";
import { edgeStandingAsOf } from "../src/edge-kapae.js";
import { readFrontierPins, writeFrontierPin } from "../src/edge-frontier-board.js";
import { raiseFrontierPins } from "../src/edge-frontier.js";
import { ed25519SignerFromSeed, ed25519VerifyingKeyFromSeed } from "../src/ed25519-door.js";
import { fleetRaiseCids, landFleetFrontier, landFleetGenesis, nextFleetFrontier, readFleetFrontier } from "../src/fleet-frontier.js";
import { makeHandLineage } from "../src/hand-lineage.js";
import { actCid } from "../src/signed-act.js";

const seed = new Uint8Array(32).fill(5);
const ROOT = "ab".repeat(32);
async function setup() {
  const key = await ed25519VerifyingKeyFromSeed(seed);
  const signer = { key, sign: ed25519SignerFromSeed(seed) };
  const lineage = makeHandLineage([{ epoch: 0, signers: [key], threshold: 1 }])!;
  return { signer, lineage };
}

describe("fleet-frontier", () => {
  test("CONTROL: a founded fleet reads known; a registered raise reads known once the root counts it", async () => {
    const { signer, lineage } = await setup();
    const board = emptyLarDoc();
    await landFleetGenesis(board, ROOT, lineage, signer);
    expect(readFleetFrontier({ fleetRoot: ROOT, board, lineage, seenRaises: [], pinned: null }).status).toBe("known");
    const registered = await nextFleetFrontier({ fleetRoot: ROOT, board, lineage, counted: ["raiseA"], signer });
    landFleetFrontier(board, registered!);
    expect(readFleetFrontier({ fleetRoot: ROOT, board, lineage, seenRaises: ["raiseA"], pinned: null })).toMatchObject({ status: "known", asOf: { fleet: { seq: 1 } } });
  });

  test("RED: a fleet board with no frontier reads unknown, and edgeStandingAsOf will not read it clear", async () => {
    const { lineage } = await setup();
    const read = readFleetFrontier({ fleetRoot: ROOT, board: emptyLarDoc(), lineage, seenRaises: [], pinned: null });
    expect(read.status).toBe("unknown");
    expect(edgeStandingAsOf(undefined, undefined, read.status === "known")).toBe("unknown");
    expect(edgeStandingAsOf(undefined, undefined, true)).toBe("clear");
  });

  test("RED: a seen raise the frontier does not count, and a reader pinned past a rewound board, read unknown", async () => {
    const { signer, lineage } = await setup();
    const board = emptyLarDoc();
    const genesis = await landFleetGenesis(board, ROOT, lineage, signer);
    expect(readFleetFrontier({ fleetRoot: ROOT, board, lineage, seenRaises: ["hidden"], pinned: null })).toMatchObject({ status: "unknown", missing: [{ why: "withholds-seen-raise" }] });
    const reg = await nextFleetFrontier({ fleetRoot: ROOT, board, lineage, counted: ["r1"], signer });
    const pinned = { seq: 1, cid: actCid(reg!.frontier.body) };
    expect(readFleetFrontier({ fleetRoot: ROOT, board, lineage, seenRaises: [], pinned })).toMatchObject({ status: "unknown", missing: [{ why: "does-not-extend-pin" }] });   // the registered frontier never landed on this replica: only the genesis stands
    void genesis;
  });

  test("a shadow narrows at once, whatever the frontier", () => {
    expect(edgeStandingAsOf({ stands: true, raiseCids: ["r"] } as never, undefined, false)).toBe("aside");
  });

  test("the pin rests in the ledger and only rises", () => {
    const ledger = emptyLarDoc();
    expect(writeFrontierPin(ledger, ROOT, "fleet", { seq: 2, cid: "c2" })).toBe(true);
    expect(writeFrontierPin(ledger, ROOT, "fleet", { seq: 1, cid: "c1" })).toBe(false);
    expect(readFrontierPins(ledger, ROOT)).toEqual({ fleet: { seq: 2, cid: "c2" } });
    expect(raiseFrontierPins({}, { status: "unknown", missing: [] })).toEqual({});
  });

  test("fleetRaiseCids counts the holder's raises alone", () => {
    expect(fleetRaiseCids([
      { actCid: "a", raised: true, hand: "holder" }, { actCid: "b", raised: false, hand: "holder" }, { actCid: "c", raised: true, hand: "quorum" },
    ] as never)).toEqual(["a"]);
  });
});
