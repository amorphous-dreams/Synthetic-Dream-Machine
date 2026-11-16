/**
 * receipt-door — the receipt's writer (road L45): the vessel rests `receipt/<tree>` over a verdict the host battery hands it.
 *
 * THE RECEIPT NOTARISES TESTIMONY. The vessel signs what the host's battery read and re-runs nothing, so a receipt vouches
 * that this vessel heard that verdict for that tree, never that the tree passes. The sampled re-run that cures it rides after.
 * Every red pairs with a CONTROL. Meme: lar:///ha.ka.ba/lares/docs/pono/seat-harness
 */
import { describe, expect, test } from "vitest";
import { ed25519SignerFromSeed, ed25519VerifyingKeyFromSeed } from "../src/ed25519-door.js";
import { beginRite } from "../src/swarm-tessera.js";
import {
  putSwarmAct, readSwarmRecord, restReceipt, signSwarmAct, swarmActCid, swarmLeiNarrowedTitle, swarmLeiRowTitle, swarmReceiptTitle,
  type SwarmBodyParts, type SwarmWikiPort,
} from "../src/swarm-tiddlers.js";

const GROUP = "face-group", BRANCH = "main", HEAD = "a".repeat(40), TREE = "1".repeat(40), DEFS = "d".repeat(64);
const keyed = async (n: number) => ({ key: await ed25519VerifyingKeyFromSeed(new Uint8Array(32).fill(n)), sign: ed25519SignerFromSeed(new Uint8Array(32).fill(n)) });
const ONE_DEVICE = { accepts: () => true };

async function fixture() {
  const hand = await keyed(1), vessel = await keyed(2), outsider = await keyed(4);
  const trust = { hand: (k: string) => k === hand.key, vessel: (k: string) => k === vessel.key, lead: () => false };
  const rows = new Map<string, string>();
  const wiki: SwarmWikiPort = { read: async (t) => rows.get(t) ?? null, write: async (t, x) => { rows.set(t, x); }, writeNew: async (t, x) => (rows.has(t) ? false : (rows.set(t, x), true)),
    list: async (prefix) => [...rows.keys()].filter((t) => t.startsWith(prefix)) };
  const kui = async (terms: Record<string, unknown>): Promise<string> => {
    const lei = await signSwarmAct({ act: "lei", group: GROUP, rite: "kukulu", branch: BRANCH, after: null, ...terms } as unknown as SwarmBodyParts, hand);
    await putSwarmAct(wiki, swarmLeiRowTitle("kukulu", BRANCH, swarmActCid(lei)), lei);
    return swarmActCid(lei);
  };
  const receipt = (verdict: "pass" | "fail", signer = vessel, over: Record<string, unknown> = {}) =>
    restReceipt(wiki, { tree: TREE, checks: ["typecheck", "mesh"], verdict, definitions: DEFS, ...over } as never, trust, GROUP, signer);
  const begin = () => beginRite(wiki, { rite: "kukulu", branch: BRANCH, head: HEAD, tree: TREE }, trust, GROUP, vessel, ONE_DEVICE);
  const halves = () => [...rows.keys()].filter((t) => t.includes("/tessera/"));
  return { hand, vessel, outsider, trust, wiki, rows, kui, receipt, begin, halves };
}

describe("receipt-door-signs-the-tree", () => {
  test("RED: the door rests a vessel-signed receipt at the tree's title, naming the checks, the verdict and the definitions; CONTROL: it verifies as the vessel's record", async () => {
    const f = await fixture();
    const out = await f.receipt("pass");
    expect(out).toEqual({ tree: TREE, verdict: "pass", checks: ["typecheck", "mesh"], receipt: expect.stringMatching(/^[0-9a-f]{64}$/) });
    const read = await readSwarmRecord(f.wiki, swarmReceiptTitle(TREE), f.trust, GROUP);
    expect(read).toMatchObject({ ok: true, cid: out.receipt, act: { signer: f.vessel.key, body: { act: "receipt", tree: TREE, checks: ["typecheck", "mesh"], verdict: "pass", definitions: DEFS } } });
  });

  test("RED: a signer that holds no vessel role, a verdict outside pass and fail, a tree that reads as no name, checks that hold no name and definitions that read as no hash each refuse and rest nothing; CONTROL: a later receipt for the same tree replaces the one that stood", async () => {
    const f = await fixture();
    await expect(f.receipt("pass", f.outsider)).rejects.toMatchObject({ code: "swarm-receipt-role" });
    for (const bad of [{ verdict: "maybe" }, { tree: "" }, { tree: "a/b" }, { checks: [] }, { checks: ["ok", ""] }, { checks: "typecheck" }, { definitions: "abc" }]) {
      await expect(f.receipt("pass", f.vessel, bad), JSON.stringify(bad)).rejects.toMatchObject({ code: "swarm-receipt-malformed" });
    }
    expect(f.rows.size).toBe(0);
    await f.receipt("fail");
    await f.receipt("pass");
    expect(await readSwarmRecord(f.wiki, swarmReceiptTitle(TREE), f.trust, GROUP)).toMatchObject({ ok: true, act: { body: { verdict: "pass" } } });
    expect([...f.rows.keys()]).toEqual([swarmReceiptTitle(TREE)]);
  });
});

describe("kukulu-returns-with-a-passing-receipt", () => {
  test("RED: a kukulu rite that found no receipt begins nothing, and the same rite begins once the door rests a passing one; CONTROL: the lei's return and the guest half both rest", async () => {
    const f = await fixture();
    const cid = await f.kui({ reach: "wide", returns: 2 });
    await expect(f.begin()).rejects.toMatchObject({ code: "swarm-lei-testimony-absent" });
    await f.receipt("pass");
    const begun = await f.begin();
    expect(begun).toMatchObject({ lei: cid, n: 1, rite: "kukulu" });
    expect(f.halves()).toHaveLength(1);
  });
});

describe("kukulu-refuses-a-failing-receipt", () => {
  test("RED: a kukulu rite over a failing receipt refuses `swarm-lei-testimony-red`, rests no half, and narrows the wide lei; CONTROL: a passing receipt rested after leaves that lei narrowed, and a fresh lei begins the rite", async () => {
    const f = await fixture();
    const cid = await f.kui({ reach: "wide", returns: 2 });
    await f.receipt("fail");
    await expect(f.begin()).rejects.toMatchObject({ code: "swarm-lei-testimony-red" });
    expect(f.halves()).toEqual([]);
    expect(f.rows.has(swarmLeiNarrowedTitle(cid))).toBe(true);
    await f.receipt("pass");
    await expect(f.begin()).rejects.toMatchObject({ code: "swarm-lei-narrowed" });
    const lei = await signSwarmAct({ act: "lei", group: GROUP, rite: "kukulu", branch: BRANCH, after: cid, reach: "head", head: HEAD } as SwarmBodyParts, f.hand);
    await putSwarmAct(f.wiki, swarmLeiRowTitle("kukulu", BRANCH, swarmActCid(lei)), lei);
    await expect(f.begin()).resolves.toMatchObject({ lei: swarmActCid(lei), n: 1 });
  });
});
