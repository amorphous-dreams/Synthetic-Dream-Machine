/** The browser island's peer reading must see rolls kept by the vessel's main Repo. */
import { describe, expect, test, vi } from "vitest";
import {
  CompositeStore, deviceEdgeId, edgeLedgerDocUrl, ed25519SignerFromSeed, ed25519VerifyingKeyFromSeed,
  emptyLarDoc, fleetEdgeBoardDocUrl, makeIslandRepo, materializeSharedLarDoc, signEdgeKapae, writeEdgeKapae,
} from "@lararium/mesh";
import { markRaiseRolled } from "../../lararium-mesh/src/edge-ledger.js";

const boot = vi.hoisted(() => ({ dyad: "" }));
vi.mock("../src/boot-daemon-keyhive.js", () => ({
  bootDaemonKeyhive: async (args: { dyad: string }) => { boot.dyad = args.dyad; throw new Error("dyad-captured"); },
}));
import { operatorDaemonOptions } from "../src/operator-daemon-behavior.js";

describe("the island reads the vessel's seat-roll ledger", () => {
  test.each([false, true])("lifted peer with vessel roll=%s", async (rolled) => {
    const rootSeed = new Uint8Array(32).fill(111);
    const root = await ed25519VerifyingKeyFromSeed(rootSeed);
    const own = await ed25519VerifyingKeyFromSeed(new Uint8Array(32).fill(112));
    const peer = await ed25519VerifyingKeyFromSeed(new Uint8Array(32).fill(113));
    const repo = makeIslandRepo({ syncPort: new MessageChannel().port1 });
    const privateRepo = makeIslandRepo({ syncPort: new MessageChannel().port1 });
    try {
      const board = await materializeSharedLarDoc(repo, fleetEdgeBoardDocUrl(root), "board:edge-kapae");
      const ledger = await materializeSharedLarDoc(repo, edgeLedgerDocUrl(own), "ledger:edge");
      const signer = [{ signer: root, sign: ed25519SignerFromSeed(rootSeed) }];
      const up = await signEdgeKapae({ edgeId: deviceEdgeId(root, peer), raised: true, hand: "holder", parents: [] }, signer);
      const down = await signEdgeKapae({ edgeId: deviceEdgeId(root, peer), raised: false, hand: "holder", parents: [up.actCid] }, signer);
      board.change((draft) => { writeEdgeKapae(draft, up); writeEdgeKapae(draft, down); });
      if (rolled) ledger.change((draft) => markRaiseRolled(draft, root, up.actCid, { edgeId: deviceEdgeId(root, peer), how: "gone" }));
      const islandLedger = privateRepo.create(emptyLarDoc());
      const daemonAuth = {
        seed: new Uint8Array(32).fill(114), vesselVerifyingKey: own, archiveOpens: false, registerBags: [],
        personaGroupId: "group", atom: { seed: "00".repeat(32), key: own },
        deviceEdge: { personaRootDid: root, deviceVerifyingKey: peer },
      };
      const ctx = { repo, composite: new CompositeStore(), post: () => {} };
      boot.dyad = "";
      await expect(operatorDaemonOptions({ daemonAuth } as never, { readDyadFromBoard: true, dyadLedger: islandLedger }).verifierFactory!(ctx as never)).rejects.toThrow("dyad-captured");
      expect(boot.dyad, rolled
        ? "VESSEL ROLL: a lifted peer raise answered in the main Repo returns"
        : "CONTROL: without that roll the lifted raise remains owing").toBe(rolled ? "returned" : "owing");
    } finally { await Promise.all([repo.shutdown(), privateRepo.shutdown()]); }
  });
});
