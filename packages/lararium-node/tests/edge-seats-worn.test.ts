/**
 * edge-seats-worn — A JOINEE READS ITS OWN FLEET (road `T34`, controller ruling F1(b)).
 *
 * A joinee wears a face whose root it never holds: its device edge names the fleet root, and its own atom names its
 * ledger. The facts, the marks and the fold read the fleet the vessel WEARS from those two (the composer hands them in,
 * `worn: { fleetRoot, atomKey }`), never from the roster, so a joinee settles its own foundings on a counted removal.
 *
 *   W1  RED: on a vessel that holds no persona root, the worn fleet's facts name the counted raise, and the fold reads it
 *       owed; CONTROL: a fleet the vessel neither wears nor serves still refuses by name.
 *   W2  RED: the joinee keeps its own receipt-signed roll (under its atom), and the fold then reads the raise answered.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  deviceEdgeId, ed25519SignerFromSeed, ed25519VerifyingKeyFromSeed, fleetEdgeBoardDocUrl, materializeSharedLarDoc, signEdgeKapae,
  signSeatRoll, writeEdgeKapae,
} from "@lararium/mesh";
import { restEvery, restingRepo } from "./resting-repo.js";
import { generateOrLoadVesselIdentity } from "../src/node-vessel-identity.js";
import { larDataDir } from "../src/vessel-paths.js";
import { runEdgeSeatFacts, runEdgeSeatMarks, fleetRaisesOf, EdgeSeatError } from "../src/commands/edge-seats.js";
import { seedFaceAtom, atomSeedOf } from "./atom-fixture.js";

const ROOT_SEED = new Uint8Array(32).fill(0x5a);       // the fleet root's seed: held by the founder, never by this joinee
const REMOVED = "c4".repeat(32);

type Worn = { readonly fleetRoot: string; readonly atomKey: string };
type WornFacts = (o: { repo: unknown; worn?: Worn; fleetRoot?: string }) => ReturnType<typeof runEdgeSeatFacts>;
type WornMarks = (o: { repo: unknown; worn?: Worn; fleetRoot?: string; rolls: readonly unknown[] }) => ReturnType<typeof runEdgeSeatMarks>;
type WornFold = (o: { repo: unknown; worn?: Worn | null; fleetRoot?: string | null }) => ReturnType<typeof fleetRaisesOf>;

let root: string;
let priorLarRoot: string | undefined;
beforeEach(async () => {
  root = mkdtempSync(join(tmpdir(), "lares-edge-seats-worn-"));
  priorLarRoot = process.env["LAR_ROOT"];
  process.env["LAR_ROOT"] = root;
  await generateOrLoadVesselIdentity({ placeFoundingCard: { readBack: async () => {} } });
  await seedFaceAtom(0);                                   // the joinee's own atom and anchors; no persona root stands
});
afterEach(async () => {
  await restEvery();
  if (priorLarRoot === undefined) delete process.env["LAR_ROOT"];
  else process.env["LAR_ROOT"] = priorLarRoot;
  rmSync(root, { recursive: true, force: true });
});

/** The founder raises a removal on the fleet board: an act the fleet root signs, written where the joinee reads it. */
async function raiseOnBoard(fleetRoot: string): Promise<{ actCid: string; edgeId: string }> {
  const act = await signEdgeKapae({ edgeId: deviceEdgeId(fleetRoot, REMOVED), raised: true, hand: "holder", parents: [] },
    [{ signer: fleetRoot, sign: ed25519SignerFromSeed(ROOT_SEED) }]);
  const repo = restingRepo(larDataDir());
  const board = await materializeSharedLarDoc(repo, fleetEdgeBoardDocUrl(fleetRoot), "board:edge-kapae");
  board.change((d) => { writeEdgeKapae(d, act); });
  await repo.flush();
  await repo.rest();
  return { actCid: act.actCid, edgeId: act.edgeId };
}
const wornOf = async (): Promise<Worn> => {
  const { faceAtomKeyFromSeed } = await import("@lararium/mesh");
  return { fleetRoot: await ed25519VerifyingKeyFromSeed(ROOT_SEED), atomKey: faceAtomKeyFromSeed(await atomSeedOf(0), "group-fixture-h0").key };
};

describe("a joinee reads the fleet it wears (T34)", () => {
  it("W1 — RED: the worn fleet's facts name the counted raise and the fold reads it owed; CONTROL: another fleet refuses", async () => {
    const worn = await wornOf();
    const raise = await raiseOnBoard(worn.fleetRoot);
    const repo = restingRepo(larDataDir());
    try {
      const facts = await (runEdgeSeatFacts as unknown as WornFacts)({ repo, worn });
      expect(facts.fleets.map((f) => f.fleetRoot), "the worn fleet reads").toEqual([worn.fleetRoot]);
      expect(facts.fleets[0]!.edges).toContainEqual({ edgeId: raise.edgeId, aside: true, raiseCids: [raise.actCid] });
      const fold = await (fleetRaisesOf as unknown as WornFold)({ repo, worn });
      expect(fold, "the joinee's fold reads its own fleet").toEqual({ read: true, counted: [raise.actCid], unanswered: [raise.actCid] });
      // CONTROL: a fleet this vessel neither wears nor serves still refuses by name.
      await expect((runEdgeSeatFacts as unknown as WornFacts)({ repo, fleetRoot: "7e".repeat(32) })).rejects.toThrow(EdgeSeatError);
    } finally { await repo.rest(); }
  });

  it("W2 — RED: the joinee keeps its own receipt-signed roll, and the fold reads the raise answered", async () => {
    const worn = await wornOf();
    const raise = await raiseOnBoard(worn.fleetRoot);
    const roll = await signSeatRoll({ kind: "seat-roll", scope: worn.fleetRoot, edgeId: raise.edgeId, raiseCids: [raise.actCid], how: "no-authority" },
      ed25519SignerFromSeed(await atomSeedOf(0)));
    const repo = restingRepo(larDataDir());
    try {
      const marked = await (runEdgeSeatMarks as unknown as WornMarks)({ repo, worn, rolls: [roll] });
      expect(marked.marked).toEqual([raise.actCid]);
      expect((await (fleetRaisesOf as unknown as WornFold)({ repo, worn })).unanswered).toEqual([]);
    } finally { await repo.rest(); }
  });
});
