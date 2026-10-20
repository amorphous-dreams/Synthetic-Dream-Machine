/** The gate reads its own signed fleet board and fails closed when that board cannot be read. */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import {
  deviceEdgeId, ed25519SignerFromSeed, ed25519VerifyingKeyFromSeed, fleetEdgeBoardDocUrl,
  makeIslandRepo, materializeSharedLarDoc, signEdgeKapae, writeEdgeKapae,
} from "@lararium/mesh";

async function reader() {
  const path = "../src/index.js";
  const module = await import(path).catch(() => null) as { boardDyadReader?: (repo: unknown) => (root: string, device: string) => Promise<string> } | null;
  expect(module?.boardDyadReader, "boardDyadReader stands at the keyhive door").toBeTypeOf("function");
  return module!.boardDyadReader!;
}

describe("the island's fleet board dyad reader", () => {
  test("a root signed aside reads aside; another device with no event reads clear", async () => {
    const rootSeed = new Uint8Array(32).fill(31);
    const root = await ed25519VerifyingKeyFromSeed(rootSeed);
    const device = await ed25519VerifyingKeyFromSeed(new Uint8Array(32).fill(32));
    const other = await ed25519VerifyingKeyFromSeed(new Uint8Array(32).fill(33));
    const repo = makeIslandRepo({ syncPort: new MessageChannel().port1 });
    try {
      const board = await materializeSharedLarDoc(repo, fleetEdgeBoardDocUrl(root), "board:edge-kapae");
      const act = await signEdgeKapae({ edgeId: deviceEdgeId(root, device), raised: true, hand: "holder", parents: [] },
        [{ signer: root, sign: ed25519SignerFromSeed(rootSeed) }]);
      board.change((draft) => writeEdgeKapae(draft, act));
      const read = (await reader())(repo);
      expect(await read(root, device), "the root's signed raise shadows this device").toBe("aside");
      expect(await read(root, other), "control: an untouched edge reads clear").toBe("clear");
    } finally { await repo.shutdown(); }
  });

  test("an unavailable board reads aside and the island imports no tab dyad asker", async () => {
    const root = await ed25519VerifyingKeyFromSeed(new Uint8Array(32).fill(41));
    const device = await ed25519VerifyingKeyFromSeed(new Uint8Array(32).fill(42));
    const unavailable = { find: async () => { throw new Error("board unavailable"); } };
    expect(await (await reader())(unavailable)(root, device), "an unreadable board fails closed").toBe("aside");
    const island = readFileSync(join(import.meta.dirname, "..", "..", "lararium-browser", "src", "browser-daemon-island.ts"), "utf8");
    expect(island, "the island no longer delegates dyad reading to a tab").not.toMatch(/import\s*\{[^}]*browserDyadAsker/);
  });
});
