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
import { fleetFixture } from "./fleet-fixture.js";
import { operatorDaemonOptions } from "../src/operator-daemon-behavior.js";

describe("the island reads the vessel's seat-roll ledger", () => {
  test("missing vessel ledger answers owing now and a later synced roll answers returned", async () => {
    const rootSeed = new Uint8Array(32).fill(121);
    const root = await ed25519VerifyingKeyFromSeed(rootSeed);
    const own = await ed25519VerifyingKeyFromSeed(new Uint8Array(32).fill(122));
    const peer = await ed25519VerifyingKeyFromSeed(new Uint8Array(32).fill(123));
    const repo = makeIslandRepo({ syncPort: new MessageChannel().port1 });
    try {
      const board = await materializeSharedLarDoc(repo, fleetEdgeBoardDocUrl(root), "board:edge-kapae");
      const fx = await fleetFixture(rootSeed);
      await fx.found(board);
      const signer = [{ signer: root, sign: ed25519SignerFromSeed(rootSeed) }];
      const edgeId = deviceEdgeId(root, peer);
      const up = await signEdgeKapae({ edgeId, raised: true, hand: "holder", parents: [] }, signer);
      const down = await signEdgeKapae({ edgeId, raised: false, hand: "holder", parents: [up.actCid] }, signer);
      board.change((draft) => { writeEdgeKapae(draft, up); writeEdgeKapae(draft, down); });
      await fx.register(board, [up.actCid]);
      const privateLedger = repo.create(emptyLarDoc());
      const daemonAuth = {
        placeVerifyingKey: own, archiveOpens: false, registerBags: [],
        personaGroupId: "group", atom: { seed: "00".repeat(32), key: own },
        deviceEdge: { personaRootDid: root, deviceVerifyingKey: peer },
        personaKel: { prefix: fx.prefix, chain: fx.chain },
      };
      const options = operatorDaemonOptions({ daemonAuth } as never,
        { readDyadFromBoard: true, dyadLedger: privateLedger });
      const find = vi.spyOn(repo, "find");
      const read = () => options.verifierFactory!({ repo, composite: new CompositeStore(), post: () => {} } as never);
      // No clock can deliver the missing document. A local read must settle from documents already in this Repo.
      vi.useFakeTimers();
      let settled = false;
      const first = read().catch((error: unknown) => {
        if (!(error instanceof Error) || error.message !== "dyad-captured") throw error;
        settled = true;
      });
      for (let i = 0; i < 500 && !settled; i++) await Promise.resolve();
      expect(settled, "the absent roll ledger cannot hold the reading for the find timeout").toBe(true);
      await first;
      expect(boot.dyad, "an unrolled lift still owes its seat when the ledger is absent").toBe("owing");
      await Promise.all([read(), read(), read()].map((result) => result.catch((error: unknown) => {
        if (!(error instanceof Error) || error.message !== "dyad-captured") throw error;
      })));
      expect(find.mock.calls.filter(([url]) => url === edgeLedgerDocUrl(own)),
        "N missing-ledger gate reads share one pending find").toHaveLength(1);
      vi.useRealTimers();
      const ledger = await materializeSharedLarDoc(repo, edgeLedgerDocUrl(own), "ledger:edge");
      ledger.change((draft) => markRaiseRolled(draft, root, up.actCid, { edgeId, how: "gone" }));
      boot.dyad = "";
      await expect(read()).rejects.toThrow("dyad-captured");
      expect(boot.dyad, "the next reading sees the roll that arrived in the main Repo").toBe("returned");
    } finally { vi.useRealTimers(); await repo.shutdown(); }
  });

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
      const fx = await fleetFixture(rootSeed);
      await fx.found(board);
      const signer = [{ signer: root, sign: ed25519SignerFromSeed(rootSeed) }];
      const up = await signEdgeKapae({ edgeId: deviceEdgeId(root, peer), raised: true, hand: "holder", parents: [] }, signer);
      const down = await signEdgeKapae({ edgeId: deviceEdgeId(root, peer), raised: false, hand: "holder", parents: [up.actCid] }, signer);
      board.change((draft) => { writeEdgeKapae(draft, up); writeEdgeKapae(draft, down); });
      await fx.register(board, [up.actCid]);
      if (rolled) ledger.change((draft) => markRaiseRolled(draft, root, up.actCid, { edgeId: deviceEdgeId(root, peer), how: "gone" }));
      const islandLedger = privateRepo.create(emptyLarDoc());
      const daemonAuth = {
        placeVerifyingKey: own, archiveOpens: false, registerBags: [],
        personaGroupId: "group", atom: { seed: "00".repeat(32), key: own },
        deviceEdge: { personaRootDid: root, deviceVerifyingKey: peer },
        personaKel: { prefix: fx.prefix, chain: fx.chain },
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
