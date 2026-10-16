/**
 * carriage peering is SHUT by name unless a gate-native pull is handed in ("Routes at the cutover"): the old pull
 * (`pullAndVerifyOracle`) is gone from the cap, a dial entry carries a gate key and never a full pin, and an untested
 * old-wire fallback counts as open. A carriage handed a `pullOracle` merges what it returns, as before.
 */
import { describe, expect, test } from "vitest";
import { Repo } from "@automerge/automerge-repo";
import { composeVessel, type CapModule } from "../src/cap-compose.js";
import { CARRIAGE_CAP, carriageCap, type MeshPalaceComponent } from "../src/carriage-caps.js";
import { emptyMeshPalaceDoc, type MeshPalaceDoc } from "../src/mesh-palace.js";
import type { MeshPeer } from "../src/mesh-palace.js";

const PEER = { endpoint: "http://peer.test", gatePubKey: "ab".repeat(32) } as unknown as MeshPeer;

async function stand(deps: Partial<Parameters<typeof carriageCap>[0]>): Promise<{ pullOnce: () => Promise<number>; logs: string[]; handle: MeshPalaceComponent["handle"]; dispose: () => Promise<void> }> {
  const repo = new Repo({ sharePolicy: async () => true });
  const handle = repo.create<MeshPalaceDoc>(emptyMeshPalaceDoc());
  const mesh: CapModule = { id: CARRIAGE_CAP.meshpalace, build: () => ({ handle }) as MeshPalaceComponent };
  const logs: string[] = [];
  const vessel = await composeVessel([mesh, carriageCap({ peers: [PEER], pullIntervalMs: 1_000_000, onLog: (l) => logs.push(l), ...deps })]);
  const carriage = vessel.get<{ pullOnce: () => Promise<number> }>(CARRIAGE_CAP.carriage)!;
  return { pullOnce: carriage.pullOnce, logs, handle, dispose: () => vessel.dispose() };
}

describe("carriage peering", () => {
  test("SHUT: with no pullOracle (even with a legacy identity) nothing is pulled, and the shut is named", async () => {
    const s = await stand({ identity: { contactCard: "c", peerPubKey: "p", sign: () => "s" } as never });
    expect(await s.pullOnce()).toBe(0);
    expect(s.logs.some((l) => l.includes("carriage-peering-shut"))).toBe(true);
    await s.dispose();
  });

  test("CONTROL: a handed pullOracle is asked for each peer with its endpoint and gate key, and its map merges", async () => {
    const asked: Array<[string, string]> = [];
    const incoming = emptyMeshPalaceDoc();
    incoming.tiddlers["probe/one"] = { tiddler: { title: "probe/one", text: "x" }, kind: "probe" } as never;
    const s = await stand({ pullOracle: async (peer, key) => { asked.push([peer, key]); return { ok: true, doc: incoming } as never; } });
    await s.pullOnce();
    expect(asked.length).toBeGreaterThanOrEqual(1);
    for (const pair of asked) expect(pair).toEqual(["http://peer.test", "ab".repeat(32)]);
    expect(s.logs.some((l) => l.includes("carriage-peering-shut"))).toBe(false);
    await s.dispose();
  });
});
