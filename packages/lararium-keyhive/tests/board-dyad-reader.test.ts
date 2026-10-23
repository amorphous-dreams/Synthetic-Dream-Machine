/** The gate reads its own signed fleet board and fails closed when that board cannot be read. */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import {
  deviceEdgeId, ed25519SignerFromSeed, ed25519VerifyingKeyFromSeed, emptyLarDoc, fleetEdgeBoardDocUrl,
  makeIslandRepo, materializeSharedLarDoc, signEdgeKapae, writeEdgeKapae,
} from "@lararium/mesh";
import { edgeKapaeKey } from "../../lararium-mesh/src/edge-kapae.js";
import { markRaiseRolled } from "../../lararium-mesh/src/edge-ledger.js";
import { fleetFixture } from "./fleet-fixture.js";

async function reader() {
  const path = "../src/index.js";
  const module = await import(path).catch(() => null) as { boardDyadReader?: (repo: unknown) => (root: string, device: string) => Promise<string> } | null;
  expect(module?.boardDyadReader, "boardDyadReader stands at the keyhive door").toBeTypeOf("function");
  return module!.boardDyadReader!;
}

describe("the island's fleet board dyad reader", () => {
  test("a counted raise survives its omission from the same board replica", async () => {
    const rootSeed = new Uint8Array(32).fill(61);
    const root = await ed25519VerifyingKeyFromSeed(rootSeed);
    const device = await ed25519VerifyingKeyFromSeed(new Uint8Array(32).fill(62));
    const other = await ed25519VerifyingKeyFromSeed(new Uint8Array(32).fill(63));
    const repo = makeIslandRepo({ syncPort: new MessageChannel().port1 });
    try {
      const board = await materializeSharedLarDoc(repo, fleetEdgeBoardDocUrl(root), "board:edge-kapae");
      const fx = await fleetFixture(rootSeed);
      await fx.found(board);
      const act = await signEdgeKapae({ edgeId: deviceEdgeId(root, device), raised: true, hand: "holder", parents: [] },
        [{ signer: root, sign: ed25519SignerFromSeed(rootSeed) }]);
      const row = edgeKapaeKey(act);
      board.change((draft) => writeEdgeKapae(draft, act));
      await fx.register(board, [act.actCid]);
      const ledger = repo.create(emptyLarDoc());
      const absentLedger = repo.create(emptyLarDoc());
      const makeRead = (await reader()) as unknown as (source: unknown, ownedLedger: unknown, rest?: unknown, own?: string, rolls?: unknown, scope?: string, lineage?: unknown) => (root: string, device: string) => Promise<string>;
      const read = makeRead(repo, ledger, undefined, undefined, undefined, undefined, fx.lineage);
      expect(await read(root, device), "the first read counts the signed raise into the island ledger").toBe("aside");
      expect(await read(root, other), "control: an untouched edge starts clear").toBe("clear");
      board.change((draft) => { delete draft.tiddlers[row]; });
      expect(board.doc()?.tiddlers[row], "the second replica omits the raise").toBeUndefined();
      expect(await makeRead(repo, absentLedger, undefined, other, undefined, undefined, fx.lineage)(root, device), "ABSENT EDGE: the frontier counts the raise the board omitted, so a reader with no local copy reads it unknown, never clear").toBe("unknown");
      expect(await read(root, other), "control: the untouched edge remains clear").toBe("clear");
      expect(await read(root, device), "the island ledger restores an omitted counted raise").toBe("aside");
      expect(board.doc()?.tiddlers[row], "the reader writes its kept signed raise back to the board").toBeDefined();
    } finally { await repo.shutdown(); }
  });
  test("a fresh empty fleet board leaves both the own and a healthy peer edge clear", async () => {
    const rootSeed = new Uint8Array(32).fill(71);
    const root = await ed25519VerifyingKeyFromSeed(rootSeed);
    const own = await ed25519VerifyingKeyFromSeed(new Uint8Array(32).fill(72));
    const peer = await ed25519VerifyingKeyFromSeed(new Uint8Array(32).fill(73));
    const other = await ed25519VerifyingKeyFromSeed(new Uint8Array(32).fill(74));
    const repo = makeIslandRepo({ syncPort: new MessageChannel().port1 });
    try {
      const board = await materializeSharedLarDoc(repo, fleetEdgeBoardDocUrl(root), "board:edge-kapae");
      const ledger = repo.create(emptyLarDoc());
      const makeRead = await reader() as unknown as (r: unknown, l: unknown, rest: unknown, own: string, rolls: unknown, scope: unknown, lineage: unknown) => (r: string, d: string) => Promise<string>;
      const fx = await fleetFixture(rootSeed);
      const read = makeRead(repo, ledger, undefined, own, undefined, undefined, fx.lineage);
      expect(await read(root, own), "RED: with no signed frontier on the board even the device's own edge reads unknown").toBe("unknown");
      expect(await read(root, peer), "RED: an empty board with no frontier reads the peer unknown, never clear").toBe("unknown");
      await fx.found(board);
      expect(await read(root, own), "CONTROL: the founded fleet's signed genesis reads the own device clear").toBe("clear");
      expect(await read(root, peer), "CONTROL: and the healthy peer clear").toBe("clear");
      const signer = [{ signer: root, sign: ed25519SignerFromSeed(rootSeed) }];
      const otherRaise = await signEdgeKapae({ edgeId: deviceEdgeId(root, other), raised: true, hand: "holder", parents: [] }, signer);
      board.change((draft) => writeEdgeKapae(draft, otherRaise));
      await fx.register(board, [otherRaise.actCid]);
      expect(await read(root, peer), "CONTROL: an unrelated counted edge does not shadow this peer").toBe("clear");
      const raise = await signEdgeKapae({ edgeId: deviceEdgeId(root, peer), raised: true, hand: "holder", parents: [] }, signer);
      board.change((draft) => writeEdgeKapae(draft, raise));
      expect(await read(root, peer), "RED: a raise the root's frontier does not yet count shadows at once, for every reader that sees it").toBe("aside");
      await fx.register(board, [otherRaise.actCid, raise.actCid]);
      expect(await read(root, peer), "a registered verified raise shadows the peer").toBe("aside");
      expect(await read(root, other), "CONTROL: the other counted raise remains shadowed").toBe("aside");
    } finally { await repo.shutdown(); }
  });

  test("a lifted raise remains owing until the seat roll named by this vessel lands", async () => {
    const rootSeed = new Uint8Array(32).fill(81);
    const root = await ed25519VerifyingKeyFromSeed(rootSeed);
    const own = await ed25519VerifyingKeyFromSeed(new Uint8Array(32).fill(82));
    const peer = await ed25519VerifyingKeyFromSeed(new Uint8Array(32).fill(83));
    const scope = "ab".repeat(32);
    const repo = makeIslandRepo({ syncPort: new MessageChannel().port1 });
    try {
      const board = await materializeSharedLarDoc(repo, fleetEdgeBoardDocUrl(root), "board:edge-kapae");
      const fx = await fleetFixture(rootSeed);
      await fx.found(board);
      const ledger = repo.create(emptyLarDoc());
      const seatLedger = emptyLarDoc();
      const signer = [{ signer: root, sign: ed25519SignerFromSeed(rootSeed) }];
      const up = await signEdgeKapae({ edgeId: deviceEdgeId(root, peer), raised: true, hand: "holder", parents: [] }, signer);
      const down = await signEdgeKapae({ edgeId: deviceEdgeId(root, peer), raised: false, hand: "holder", parents: [up.actCid] }, signer);
      board.change((draft) => { writeEdgeKapae(draft, up); writeEdgeKapae(draft, down); });
      await fx.register(board, [up.actCid]);
      // The reader needs the local seat-roll ledger and its scope in addition to the fleet ledger.
      const makeRead = await reader() as unknown as (r: unknown, l: unknown, rest: unknown, own: string, rolls: unknown, scope: string, lineage: unknown) => (r: string, d: string) => Promise<string>;
      const read = makeRead(repo, ledger, undefined, own, seatLedger, scope, fx.lineage);
      expect(await makeRead(repo, ledger, undefined, own, undefined, scope, fx.lineage)(root, peer),
        "a named vessel scope with no available seat ledger treats its rolled set as empty").toBe("owing");
      expect(await read(root, peer), "the lift does not return a seat whose raise still lacks a roll").toBe("owing");
      markRaiseRolled(seatLedger, scope, up.actCid, { edgeId: deviceEdgeId(root, peer), how: "gone" });
      expect(await read(root, peer), "CONTROL: a rolled lift returns the peer").toBe("returned");
    } finally { await repo.shutdown(); }
  });
  test("a root signed aside reads aside; another device with no event reads clear", async () => {
    const rootSeed = new Uint8Array(32).fill(31);
    const root = await ed25519VerifyingKeyFromSeed(rootSeed);
    const device = await ed25519VerifyingKeyFromSeed(new Uint8Array(32).fill(32));
    const other = await ed25519VerifyingKeyFromSeed(new Uint8Array(32).fill(33));
    const repo = makeIslandRepo({ syncPort: new MessageChannel().port1 });
    try {
      const board = await materializeSharedLarDoc(repo, fleetEdgeBoardDocUrl(root), "board:edge-kapae");
      const fx = await fleetFixture(rootSeed);
      await fx.found(board);
      const act = await signEdgeKapae({ edgeId: deviceEdgeId(root, device), raised: true, hand: "holder", parents: [] },
        [{ signer: root, sign: ed25519SignerFromSeed(rootSeed) }]);
      board.change((draft) => writeEdgeKapae(draft, act));
      await fx.register(board, [act.actCid]);
      const read = (await reader() as unknown as (r: unknown, l?: unknown, rest?: unknown, own?: string, rolls?: unknown, scope?: string, lineage?: unknown) => (r: string, d: string) => Promise<string>)(repo, undefined, undefined, undefined, undefined, undefined, fx.lineage);
      expect(await read(root, device), "the root's signed raise shadows this device").toBe("aside");
      expect(await read(root, other), "control: an untouched edge reads clear").toBe("clear");
    } finally { await repo.shutdown(); }
  });

  test("an unavailable board reads aside and the island imports no tab dyad asker", async () => {
    const root = await ed25519VerifyingKeyFromSeed(new Uint8Array(32).fill(41));
    const device = await ed25519VerifyingKeyFromSeed(new Uint8Array(32).fill(42));
    const unavailable = { find: async () => { throw new Error("board unavailable"); } };
    expect(await (await reader())(unavailable)(root, device), "an unreadable board fails closed").toBe("aside");
    const island = readFileSync(join(import.meta.dirname, "..", "..", "lararium-browser", "src", "daemon-island-start.ts"), "utf8");
    expect(island, "the island no longer delegates dyad reading to a tab").not.toMatch(/import\s*\{[^}]*browserDyadAsker/);
  });
});
