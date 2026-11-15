/**
 * go-reach — a go's reach (road L45c): a WIDE go (the default) binds a rite, a branch and a face's group plus a count of
 * returns, and names no head; a HEAD go pins one head. Every spend names the head's tree and needs a passing receipt standing
 * for it; a red receipt narrows a wide go; a wide go ends when its returns run out. No reading takes a clock.
 *
 * Every red pairs with a CONTROL. Meme: lar:///ha.ka.ba/lares/docs/pono/seat-harness
 */
import { describe, expect, test } from "vitest";
import type { LarDoc } from "../src/base-doc.js";
import { ed25519SignerFromSeed, ed25519VerifyingKeyFromSeed } from "../src/ed25519-door.js";
import { swarmBoardRecords, writeSwarmBoardAct } from "../src/swarm-board.js";
import { swarmCommand, type SwarmDoorDeps } from "../src/swarm-door.js";
import {
  putSwarmAct, readGo, readSwarmRecord, signSwarmAct, spendGo, swarmActCid, swarmGoHead, swarmGoNarrowedTitle, swarmGoRowTitle, swarmGoSpentTitle,
  swarmReceiptTitle, type SwarmBodyParts, type SwarmWikiPort,
} from "../src/swarm-tiddlers.js";
import { soloCosign } from "./ward-cosign-table.js";

const GROUP = "face-group", BRANCH = "feature/x";
const HEAD = "a".repeat(40), HEAD2 = "b".repeat(40), TREE = "1".repeat(40), TREE2 = "2".repeat(40);
const keyed = async (n: number) => ({ key: await ed25519VerifyingKeyFromSeed(new Uint8Array(32).fill(n)), sign: ed25519SignerFromSeed(new Uint8Array(32).fill(n)) });
const ONE_DEVICE = { accepts: () => true };

function wikiPort(): SwarmWikiPort & { rows: Map<string, string> } {
  const rows = new Map<string, string>();
  return { rows, read: async (t) => rows.get(t) ?? null, write: async (t, text) => { rows.set(t, text); }, writeNew: async (t, text) => { if (rows.has(t)) return false; rows.set(t, text); return true; },
    list: async (prefix) => [...rows.keys()].filter((t) => t.startsWith(prefix)) };
}

async function fixture() {
  const hand = await keyed(1), vessel = await keyed(2), outsider = await keyed(4);
  const trust = { hand: (k: string) => k === hand.key, vessel: (k: string) => k === vessel.key, lead: () => false };
  const wiki = wikiPort();
  const rest = async (parts: Record<string, unknown>): Promise<string> => {
    const go = await signSwarmAct({ act: "go", group: GROUP, rite: "push", branch: BRANCH, after: null, ...parts } as unknown as SwarmBodyParts, hand);
    await putSwarmAct(wiki, swarmGoRowTitle((parts["rite"] as "push" | "restart" | undefined) ?? "push", BRANCH, swarmActCid(go)), go);
    return swarmActCid(go);
  };
  /** A hand-signed wide go at its own row; hands back its cid. */
  const wide = (returns: number, over: Record<string, unknown> = {}) => rest({ reach: "wide", returns, ...over });
  /** A hand-signed head go at its own row; hands back its cid. */
  const pinned = (head: string, over: Record<string, unknown> = {}) => rest({ reach: "head", head, ...over });
  /** A receipt over a tree, standing at its title (a later one replaces it). */
  const receipt = async (tree: string, verdict: "pass" | "fail", signer = vessel) =>
    putSwarmAct(wiki, swarmReceiptTitle(tree), await signSwarmAct({ act: "receipt", group: GROUP, tree, checks: ["typecheck"], verdict, definitions: "d".repeat(64) }, signer));
  const spend = (head: string, tree: string, rite: "push" | "restart" = "push", spender = vessel) => spendGo(wiki, { rite, branch: BRANCH, head, tree }, trust, GROUP, spender, ONE_DEVICE);
  const read = (head: string, rite: "push" | "restart" = "push") => readGo(wiki, { rite, branch: BRANCH, head }, trust, GROUP, ONE_DEVICE);
  const spendRows = (cid: string) => [...wiki.rows.keys()].filter((t) => t.startsWith(`${swarmGoSpentTitle(cid, 1).slice(0, -1)}`));
  return { hand, vessel, outsider, trust, wiki, wide, pinned, receipt, spend, read, spendRows, rest };
}

describe("lei-wide-needs-evidence", () => {
  test("RED: a wide go spends nothing with no receipt standing for the head's tree, one for another tree, or one the vessel never signed; CONTROL: a passing receipt lets it spend, at any head", async () => {
    const f = await fixture();
    const cid = await f.wide(3);
    await expect(f.spend(HEAD, TREE)).rejects.toMatchObject({ code: "swarm-go-evidence-absent" });
    await f.receipt(TREE2, "pass");
    await expect(f.spend(HEAD, TREE)).rejects.toMatchObject({ code: "swarm-go-evidence-absent" });
    await f.receipt(TREE, "pass", f.outsider);
    await expect(f.spend(HEAD, TREE)).rejects.toMatchObject({ code: "swarm-go-evidence-absent" });
    // A spend that lacked its evidence claimed no return and narrowed nothing.
    expect(f.spendRows(cid)).toEqual([]);
    expect(f.wiki.rows.has(swarmGoNarrowedTitle(cid))).toBe(false);
    await f.receipt(TREE, "pass");
    await expect(f.spend(HEAD, TREE)).resolves.toEqual({ go: cid, reach: "wide", n: 1 });
    // The go named no head: a second head spends under it, on its own tree's receipt.
    await expect(f.spend(HEAD2, TREE2)).resolves.toEqual({ go: cid, reach: "wide", n: 2 });
    const spent = await readSwarmRecord(f.wiki, swarmGoSpentTitle(cid, 1), f.trust, GROUP);
    expect(spent).toMatchObject({ ok: true, act: { body: { act: "go-spent", go: cid, n: 1, head: HEAD, tree: TREE, branch: BRANCH } } });
  });

  test("RED: a wide go's body names no head, and a go that mixes the two reaches forms no record; CONTROL: each reach signs in its own shape and names its own co-sign head", async () => {
    const f = await fixture();
    const base = { act: "go", group: GROUP, rite: "push", branch: BRANCH, after: null };
    for (const bad of [
      { ...base, reach: "wide", returns: 2, head: HEAD }, { ...base, reach: "wide" }, { ...base, reach: "wide", returns: 0 }, { ...base, reach: "wide", returns: -1 },
      { ...base, reach: "wide", returns: 1.5 }, { ...base, reach: "wide", returns: "2" }, { ...base, reach: "head" }, { ...base, reach: "head", head: HEAD, returns: 2 },
      { ...base, head: HEAD }, { ...base, reach: "all", returns: 2 },
    ]) await expect(signSwarmAct(bad as unknown as SwarmBodyParts, f.hand), JSON.stringify(bad)).rejects.toMatchObject({ code: "swarm-shape" });
    const w = await signSwarmAct({ act: "go", group: GROUP, rite: "push", branch: BRANCH, reach: "wide", returns: 2, after: null }, f.hand);
    expect("head" in w.body).toBe(false);
    const heads = [
      swarmGoHead({ rite: "push", branch: BRANCH, reach: "wide", returns: 2, after: null }), swarmGoHead({ rite: "push", branch: BRANCH, reach: "wide", returns: 3, after: null }),
      swarmGoHead({ rite: "push", branch: BRANCH, reach: "head", head: HEAD, after: null }), swarmGoHead({ rite: "restart", branch: BRANCH, reach: "wide", returns: 2, after: null }),
    ];
    expect(new Set(heads).size).toBe(4);
  });

  test("RED: a wide restart go never reaches a push: the push read and the push spend find no go; CONTROL: it spends as a restart", async () => {
    const f = await fixture();
    const cid = await f.wide(2, { rite: "restart" });
    await f.receipt(TREE, "pass");
    expect(await f.read(HEAD, "push")).toEqual({ ok: false, refusal: "absent" });
    await expect(f.spend(HEAD, TREE, "push")).rejects.toMatchObject({ code: "swarm-go-absent" });
    await expect(f.spend(HEAD, TREE, "restart")).resolves.toEqual({ go: cid, reach: "wide", n: 1 });
  });
});

describe("lei-red-narrows-to-head", () => {
  test("RED: a spend that meets a red receipt refuses, writes a vessel-signed narrowing record, and the wide go spends nothing after it, a later green receipt included; CONTROL: the same go spent while its receipt read green", async () => {
    const f = await fixture();
    const cid = await f.wide(5);
    await f.receipt(TREE, "pass");
    await expect(f.spend(HEAD, TREE)).resolves.toMatchObject({ n: 1 });
    await f.receipt(TREE2, "fail");
    await expect(f.spend(HEAD2, TREE2)).rejects.toMatchObject({ code: "swarm-go-evidence-red" });
    const narrowed = await readSwarmRecord(f.wiki, swarmGoNarrowedTitle(cid), f.trust, GROUP);
    expect(narrowed).toMatchObject({ ok: true, act: { signer: f.vessel.key, body: { act: "go-narrowed", go: cid, head: HEAD2, tree: TREE2 } } });
    // The red claimed no return.
    expect(f.spendRows(cid)).toHaveLength(1);
    await f.receipt(TREE2, "pass");
    await expect(f.spend(HEAD2, TREE2)).rejects.toMatchObject({ code: "swarm-go-narrowed" });
    await expect(f.spend(HEAD, TREE)).rejects.toMatchObject({ code: "swarm-go-narrowed" });
    expect(await f.read(HEAD)).toEqual({ ok: false, refusal: "narrowed" });
  });

  test("RED: after a narrowing the line reads head-only: a head go that follows the narrowed one spends at its own head alone; CONTROL: a fresh wide go restrings the line wide", async () => {
    const f = await fixture();
    const cid = await f.wide(5);
    await f.receipt(TREE, "fail");
    await expect(f.spend(HEAD, TREE)).rejects.toMatchObject({ code: "swarm-go-evidence-red" });
    const pin = await f.pinned(HEAD2, { after: cid });
    await f.receipt(TREE2, "pass");
    await expect(f.spend(HEAD, TREE2)).rejects.toMatchObject({ code: "swarm-go-head-mismatch" });
    await expect(f.spend(HEAD2, TREE2)).resolves.toEqual({ go: pin, reach: "head", n: 1 });
    const again = await f.wide(2, { after: pin });
    await expect(f.spend(HEAD, TREE2)).resolves.toEqual({ go: again, reach: "wide", n: 1 });
  });

  test("RED: any row at the narrowing title narrows the go, signed or not, and a spender that is no vessel writes none; CONTROL: a red on a head go refuses and writes no narrowing", async () => {
    const f = await fixture();
    const cid = await f.wide(5);
    await f.receipt(TREE, "fail");
    await expect(f.spend(HEAD, TREE, "push", f.outsider)).rejects.toMatchObject({ code: "swarm-spend-role" });
    expect(f.wiki.rows.has(swarmGoNarrowedTitle(cid))).toBe(false);
    f.wiki.rows.set(swarmGoNarrowedTitle(cid), "forged");
    await f.receipt(TREE, "pass");
    await expect(f.spend(HEAD, TREE)).rejects.toMatchObject({ code: "swarm-go-narrowed" });
    const g = await fixture();
    const pin = await g.pinned(HEAD);
    await g.receipt(TREE, "fail");
    await expect(g.spend(HEAD, TREE)).rejects.toMatchObject({ code: "swarm-go-evidence-red" });
    expect(g.wiki.rows.has(swarmGoNarrowedTitle(pin))).toBe(false);
    await g.receipt(TREE, "pass");
    await expect(g.spend(HEAD, TREE)).resolves.toEqual({ go: pin, reach: "head", n: 1 });
  });
});

describe("lei-count-runs-out", () => {
  test("RED: a wide go of two returns spends twice and refuses the third `swarm-go-returns-spent`; CONTROL: each spend rests at its own counted row, and a refused spend claims none", async () => {
    const f = await fixture();
    const cid = await f.wide(2);
    await expect(f.spend(HEAD, TREE)).rejects.toMatchObject({ code: "swarm-go-evidence-absent" });
    await f.receipt(TREE, "pass");
    expect(await f.read(HEAD)).toMatchObject({ ok: true, cid, reach: "wide", returnsLeft: 2 });
    await expect(f.spend(HEAD, TREE)).resolves.toMatchObject({ n: 1 });
    expect(await f.read(HEAD)).toMatchObject({ ok: true, returnsLeft: 1 });
    await expect(f.spend(HEAD, TREE)).resolves.toMatchObject({ n: 2 });
    await expect(f.spend(HEAD, TREE)).rejects.toMatchObject({ code: "swarm-go-returns-spent" });
    expect(await f.read(HEAD)).toEqual({ ok: false, refusal: "returns-spent" });
    expect(f.spendRows(cid).sort()).toEqual([swarmGoSpentTitle(cid, 1), swarmGoSpentTitle(cid, 2)]);
  });

  test("RED: five spends racing a go of three returns land exactly three; a forged row under the go's spend title counts against it; CONTROL: a fresh go restrings the count", async () => {
    const f = await fixture();
    const cid = await f.wide(3);
    await f.receipt(TREE, "pass");
    const results = await Promise.allSettled([1, 2, 3, 4, 5].map(() => f.spend(HEAD, TREE)));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(3);
    expect(results.filter((r) => r.status === "rejected").every((r) => (r as PromiseRejectedResult).reason.code === "swarm-go-returns-spent")).toBe(true);
    expect(f.spendRows(cid)).toHaveLength(3);
    const next = await f.wide(2, { after: cid });
    f.wiki.rows.set(`${swarmGoSpentTitle(next, 1).slice(0, -1)}forged`, "not a record");
    await expect(f.spend(HEAD, TREE)).resolves.toMatchObject({ go: next, n: 1 });
    await expect(f.spend(HEAD, TREE)).rejects.toMatchObject({ code: "swarm-go-returns-spent" });
  });
});

describe("a head go stays the narrow form", () => {
  test("CONTROL: a head go spends once at its head with evidence; RED: with none it refuses `swarm-go-evidence-absent`, at another head `swarm-go-head-mismatch`, and a second time `swarm-go-spent`", async () => {
    const f = await fixture();
    const cid = await f.pinned(HEAD);
    await expect(f.spend(HEAD, TREE)).rejects.toMatchObject({ code: "swarm-go-evidence-absent" });
    await f.receipt(TREE, "pass"); await f.receipt(TREE2, "pass");
    await expect(f.spend(HEAD2, TREE2)).rejects.toMatchObject({ code: "swarm-go-head-mismatch" });
    expect(await f.read(HEAD)).toMatchObject({ ok: true, cid, reach: "head", returnsLeft: 1 });
    await expect(f.spend(HEAD, TREE)).resolves.toEqual({ go: cid, reach: "head", n: 1 });
    await expect(f.spend(HEAD, TREE)).rejects.toMatchObject({ code: "swarm-go-spent" });
    expect(await f.read(HEAD)).toEqual({ ok: false, refusal: "spent" });
  });

  test("RED: a spend that names no tree refuses before it reads a receipt", async () => {
    const f = await fixture();
    await f.wide(2);
    await expect(spendGo(f.wiki, { rite: "push", branch: BRANCH, head: HEAD } as never, f.trust, GROUP, f.vessel, ONE_DEVICE)).rejects.toMatchObject({ code: "swarm-go-evidence-absent" });
  });
});

describe("the door issues a go under its reach", () => {
  async function stand() {
    const root = await keyed(1);
    const doc = { tiddlers: {} } as LarDoc, wiki = wikiPort();
    const trust = { hand: (k: string) => k === root.key, vessel: () => false, lead: () => false };
    const deps: SwarmDoorDeps = {
      group: GROUP, face: { group: GROUP, grant: (k) => k === root.key }, signer: root, trust, epoch: () => 0, wiki,
      board: { records: async () => swarmBoardRecords(doc, GROUP), land: async (act) => { writeSwarmBoardAct(doc, act); } },
      who: { kind: "hand", id: root.key }, cosign: () => soloCosign(GROUP, root),
    };
    return { deps, wiki };
  }

  test("RED: a go-issue that names no reach issues a WIDE go and needs its returns; one that names a head beside the wide reach, or no returns, refuses and writes nothing; CONTROL: the wide go lands and shows its returns", async () => {
    const s = await stand();
    for (const bad of [{}, { returns: 0 }, { returns: 2, head: HEAD }, { head: HEAD }, { reach: "all", returns: 2 }, { reach: "head" }, { reach: "head", head: HEAD, returns: 2 }]) {
      await expect(swarmCommand({ action: "go-issue", rite: "push", branch: BRANCH, after: null, ...bad } as never, s.deps), JSON.stringify(bad)).rejects.toMatchObject({ code: "swarm-go-malformed" });
    }
    expect([...s.wiki.rows.keys()]).toEqual([]);
    expect(await swarmCommand({ action: "go-issue", rite: "push", branch: BRANCH, returns: 4, after: null }, s.deps)).toEqual({ rite: "push", branch: BRANCH, reach: "wide", returns: 4 });
    expect(await swarmCommand({ action: "show", rite: "push", branch: BRANCH, head: HEAD }, s.deps)).toMatchObject({ go: { standing: true, reach: "wide", returnsLeft: 4 } });
    // The same words again name the go that already rests: nothing more lands.
    const rows = s.wiki.rows.size;
    await expect(swarmCommand({ action: "go-issue", rite: "push", branch: BRANCH, returns: 4, after: null }, s.deps)).rejects.toBeDefined();
    expect(s.wiki.rows.size).toBe(rows);
  });

  test("CONTROL: a go-issue naming the head reach pins one head, and show reads it standing at that head alone", async () => {
    const s = await stand();
    expect(await swarmCommand({ action: "go-issue", rite: "push", branch: BRANCH, reach: "head", head: HEAD, after: null }, s.deps)).toEqual({ rite: "push", branch: BRANCH, reach: "head", head: HEAD });
    expect(await swarmCommand({ action: "show", rite: "push", branch: BRANCH, head: HEAD }, s.deps)).toMatchObject({ go: { standing: true, reach: "head", returnsLeft: 1 } });
    expect(await swarmCommand({ action: "show", rite: "push", branch: BRANCH, head: HEAD2 }, s.deps)).toMatchObject({ go: { standing: false, refusal: "head-mismatch" } });
  });
});
