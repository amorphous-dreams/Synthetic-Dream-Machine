import { describe, expect, test } from "vitest";
import {
  deviceEdgeId, ed25519SignerFromSeed, ed25519VerifyingKeyFromSeed, emptyLarDoc,
  fleetEdgeBoardDocUrl, landFleetGenesis, makeHandLineage, makeIslandRepo,
  materializeSharedLarDoc, signEdgeKapae, writeEdgeFrontier, writeFrontierSnapshot,
  writeEdgeKapae, readFrontierPins, FLEET_HAND,
} from "@lararium/mesh";
import { boardDyadReader } from "../src/board-dyad-reader.js";

const seed = new Uint8Array(32).fill(97);

async function fixture() {
  const root = await ed25519VerifyingKeyFromSeed(seed);
  const own = await ed25519VerifyingKeyFromSeed(new Uint8Array(32).fill(98));
  const repo = makeIslandRepo({ syncPort: new MessageChannel().port1 });
  const board = await materializeSharedLarDoc(repo, fleetEdgeBoardDocUrl(root), "board:edge-kapae");
  const ledger = repo.create(emptyLarDoc());
  const lineage = makeHandLineage([{ epoch: 0, signers: [root], threshold: 1 }])!;
  const read = boardDyadReader(repo, ledger, undefined, own, undefined, root, lineage);
  const genesis = async () => {
    const staged = emptyLarDoc();
    const signed = await landFleetGenesis(staged, root, lineage, { key: root, sign: ed25519SignerFromSeed(seed) });
    board.change((draft) => { writeFrontierSnapshot(draft, []); writeEdgeFrontier(draft, signed); });
  };
  return { repo, root, own, board, ledger, read, genesis };
}

describe("the keyhive dyad reads the signed fleet frontier", () => {
  test("RED: own and peer absence remain unknown until genesis; CONTROL: genesis clears both and raises a pin", async () => {
    const f = await fixture();
    try {
      const peer = await ed25519VerifyingKeyFromSeed(new Uint8Array(32).fill(99));
      expect(await f.read(f.root, f.own)).toBe("unknown");
      expect(await f.read(f.root, peer)).toBe("unknown");
      await f.genesis();
      expect(await f.read(f.root, f.own)).toBe("clear");
      expect(await f.read(f.root, peer)).toBe("clear");
      expect(readFrontierPins(f.ledger.doc(), f.root)[FLEET_HAND]?.seq).toBe(0);
    } finally { await f.repo.shutdown(); }
  });

  test("RED: a seen raise absent from the frontier leaves an untouched device unknown; the shadow narrows at once", async () => {
    const f = await fixture();
    try {
      await f.genesis();
      const peer = await ed25519VerifyingKeyFromSeed(new Uint8Array(32).fill(100));
      const raise = await signEdgeKapae({ edgeId: deviceEdgeId(f.root, peer), raised: true, hand: "holder", parents: [] },
        [{ signer: f.root, sign: ed25519SignerFromSeed(seed) }]);
      f.board.change((draft) => writeEdgeKapae(draft, raise));
      expect(await f.read(f.root, f.own)).toBe("unknown");
      expect(await f.read(f.root, peer)).toBe("aside");
    } finally { await f.repo.shutdown(); }
  });
});
