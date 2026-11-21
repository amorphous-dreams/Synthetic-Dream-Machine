/**
 * lei-reach — a lei's reach (road L45c): a WIDE lei (the default) binds a rite, a branch and a face's group plus a count of
 * returns, and names no head; a HEAD lei pins one head. Every spend names the head's tree and rests on the hand's signed lei
 * (a `push` lei adds its ward co-sign), with no receipt; a wide lei ends when its returns run out. No reading takes a clock.
 *
 * Every red pairs with a CONTROL. Meme: lar:///ha.ka.ba/lares/docs/pono/seat-harness
 */
import { describe, expect, test } from "vitest";
import type { LarDoc } from "../src/base-doc.js";
import { ed25519SignerFromSeed, ed25519VerifyingKeyFromSeed } from "../src/ed25519-door.js";
import { swarmBoardRecords, writeSwarmBoardAct } from "../src/swarm-board.js";
import { kuiLei, swarmCommand, type SwarmDoorDeps } from "../src/swarm-door.js";
import {
  putSwarmAct, readLei, readSwarmRecord, signSwarmAct, returnLei, swarmActCid, swarmLeiHead, swarmLeiRecordTitle, swarmLeiReturnedTitle,
  type SwarmBodyParts, type SwarmWikiPort,
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
    const lei = await signSwarmAct({ act: "lei", group: GROUP, rite: "push", branch: BRANCH, after: null, ...parts } as unknown as SwarmBodyParts, hand);
    await putSwarmAct(wiki, swarmLeiRecordTitle((parts["rite"] as "push" | "kukulu" | undefined) ?? "push", BRANCH, swarmActCid(lei)), lei);
    return swarmActCid(lei);
  };
  /** A hand-signed wide lei at its own row; hands back its cid. */
  const wide = (returns: number, over: Record<string, unknown> = {}) => rest({ reach: "wide", returns, ...over });
  /** A hand-signed head lei at its own row; hands back its cid. */
  const pinned = (head: string, over: Record<string, unknown> = {}) => rest({ reach: "head", head, ...over });
  const spend = (head: string, tree: string, rite: "push" | "kukulu" = "push", spender = vessel) => returnLei(wiki, { rite, branch: BRANCH, head, tree }, trust, GROUP, spender, ONE_DEVICE);
  const read = (head: string, rite: "push" | "kukulu" = "push") => readLei(wiki, { rite, branch: BRANCH, head }, trust, GROUP, ONE_DEVICE);
  const spendRows = (cid: string) => [...wiki.rows.keys()].filter((t) => t.startsWith(`${swarmLeiReturnedTitle(cid, 1).slice(0, -1)}`));
  return { hand, vessel, outsider, trust, wiki, wide, pinned, spend, read, spendRows, rest };
}

describe("lei-wide-spends-on-the-lei", () => {
  test("RED: a wide lei spends at any head with no receipt standing, each spend resting at its own counted row; CONTROL: a spender that is no vessel claims nothing", async () => {
    const f = await fixture();
    const cid = await f.wide(3);
    await expect(f.spend(HEAD, TREE, "push", f.outsider)).rejects.toMatchObject({ code: "swarm-return-role" });
    expect(f.spendRows(cid)).toEqual([]);
    await expect(f.spend(HEAD, TREE)).resolves.toEqual({ lei: cid, reach: "wide", n: 1 });
    // The lei named no head: a second head spends under it.
    await expect(f.spend(HEAD2, TREE2)).resolves.toEqual({ lei: cid, reach: "wide", n: 2 });
    const spent = await readSwarmRecord(f.wiki, swarmLeiReturnedTitle(cid, 1), f.trust, GROUP);
    expect(spent).toMatchObject({ ok: true, act: { body: { act: "lei-returned", lei: cid, n: 1, head: HEAD, tree: TREE, branch: BRANCH } } });
  });

  test("RED: a wide lei's body names no head, and a lei that mixes the two reaches forms no record; CONTROL: each reach signs in its own shape and names its own co-sign head", async () => {
    const f = await fixture();
    const base = { act: "lei", group: GROUP, rite: "push", branch: BRANCH, after: null };
    for (const bad of [
      { ...base, reach: "wide", returns: 2, head: HEAD }, { ...base, reach: "wide" }, { ...base, reach: "wide", returns: 0 }, { ...base, reach: "wide", returns: -1 },
      { ...base, reach: "wide", returns: 1.5 }, { ...base, reach: "wide", returns: "2" }, { ...base, reach: "head" }, { ...base, reach: "head", head: HEAD, returns: 2 },
      { ...base, head: HEAD }, { ...base, reach: "all", returns: 2 },
    ]) await expect(signSwarmAct(bad as unknown as SwarmBodyParts, f.hand), JSON.stringify(bad)).rejects.toMatchObject({ code: "swarm-shape" });
    const w = await signSwarmAct({ act: "lei", group: GROUP, rite: "push", branch: BRANCH, reach: "wide", returns: 2, after: null }, f.hand);
    expect("head" in w.body).toBe(false);
    const heads = [
      swarmLeiHead({ rite: "push", branch: BRANCH, reach: "wide", returns: 2, after: null }), swarmLeiHead({ rite: "push", branch: BRANCH, reach: "wide", returns: 3, after: null }),
      swarmLeiHead({ rite: "push", branch: BRANCH, reach: "head", head: HEAD, after: null }), swarmLeiHead({ rite: "kukulu", branch: BRANCH, reach: "wide", returns: 2, after: null }),
    ];
    expect(new Set(heads).size).toBe(4);
  });

  test("RED: a wide kukulu lei never reaches a push: the push read and the push spend find no lei; CONTROL: it spends as a kukulu", async () => {
    const f = await fixture();
    const cid = await f.wide(2, { rite: "kukulu" });
    expect(await f.read(HEAD, "push")).toEqual({ ok: false, refusal: "absent" });
    await expect(f.spend(HEAD, TREE, "push")).rejects.toMatchObject({ code: "swarm-lei-absent" });
    await expect(f.spend(HEAD, TREE, "kukulu")).resolves.toEqual({ lei: cid, reach: "wide", n: 1 });
  });
});

describe("lei-count-runs-out", () => {
  test("RED: a wide lei of two returns spends twice and refuses the third `swarm-lei-returns-spent`; CONTROL: each spend rests at its own counted row, and a refused spend claims none", async () => {
    const f = await fixture();
    const cid = await f.wide(2);
    expect(await f.read(HEAD)).toMatchObject({ ok: true, cid, reach: "wide", returnsLeft: 2 });
    await expect(f.spend(HEAD, TREE)).resolves.toMatchObject({ n: 1 });
    expect(await f.read(HEAD)).toMatchObject({ ok: true, returnsLeft: 1 });
    await expect(f.spend(HEAD, TREE)).resolves.toMatchObject({ n: 2 });
    await expect(f.spend(HEAD, TREE)).rejects.toMatchObject({ code: "swarm-lei-returns-spent" });
    expect(await f.read(HEAD)).toEqual({ ok: false, refusal: "returns-spent" });
    expect(f.spendRows(cid).sort()).toEqual([swarmLeiReturnedTitle(cid, 1), swarmLeiReturnedTitle(cid, 2)]);
  });

  test("RED: five spends racing a lei of three returns land exactly three; a forged row under the lei's spend title counts against it; CONTROL: a fresh lei restrings the count", async () => {
    const f = await fixture();
    const cid = await f.wide(3);
    const results = await Promise.allSettled([1, 2, 3, 4, 5].map(() => f.spend(HEAD, TREE)));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(3);
    expect(results.filter((r) => r.status === "rejected").every((r) => (r as PromiseRejectedResult).reason.code === "swarm-lei-returns-spent")).toBe(true);
    expect(f.spendRows(cid)).toHaveLength(3);
    const next = await f.wide(2, { after: cid });
    f.wiki.rows.set(`${swarmLeiReturnedTitle(next, 1).slice(0, -1)}forged`, "not a record");
    await expect(f.spend(HEAD, TREE)).resolves.toMatchObject({ lei: next, n: 1 });
    await expect(f.spend(HEAD, TREE)).rejects.toMatchObject({ code: "swarm-lei-returns-spent" });
  });
});

describe("a head lei stays the narrow form", () => {
  test("CONTROL: a head lei spends once at its head with its ward co-sign and no receipt; RED: at another head it refuses `swarm-lei-head-mismatch`, and a second time `swarm-lei-returned`", async () => {
    const f = await fixture();
    const cid = await f.pinned(HEAD);
    await expect(f.spend(HEAD2, TREE2)).rejects.toMatchObject({ code: "swarm-lei-head-mismatch" });
    expect(await f.read(HEAD)).toMatchObject({ ok: true, cid, reach: "head", returnsLeft: 1 });
    await expect(f.spend(HEAD, TREE)).resolves.toEqual({ lei: cid, reach: "head", n: 1 });
    await expect(f.spend(HEAD, TREE)).rejects.toMatchObject({ code: "swarm-lei-returned" });
    expect(await f.read(HEAD)).toEqual({ ok: false, refusal: "returned" });
  });

  test("RED: a spend that names no tree forms no return record and claims no row; CONTROL: the same lei spends once the spend names its tree", async () => {
    const f = await fixture();
    const cid = await f.wide(2);
    await expect(returnLei(f.wiki, { rite: "push", branch: BRANCH, head: HEAD } as never, f.trust, GROUP, f.vessel, ONE_DEVICE)).rejects.toMatchObject({ code: "swarm-shape" });
    expect(f.spendRows(cid)).toEqual([]);
    await expect(f.spend(HEAD, TREE)).resolves.toMatchObject({ lei: cid, n: 1 });
  });
});

describe("the door issues a lei under its reach", () => {
  async function stand() {
    const root = await keyed(1);
    const doc = { tiddlers: {} } as LarDoc, wiki = wikiPort();
    const trust = { hand: (k: string) => k === root.key, vessel: () => false, place: () => false, lead: () => false };
    const deps: SwarmDoorDeps = {
      group: GROUP, face: { group: GROUP, grant: (k) => k === root.key }, signer: root, trust, epoch: () => 0, wiki,
      board: { records: async () => swarmBoardRecords(doc, GROUP), land: async (act) => { writeSwarmBoardAct(doc, act); } },
      who: { kind: "hand", id: root.key }, cosign: () => soloCosign(GROUP, root),
    };
    return { deps, wiki };
  }

  test("RED: a lei-kui that names no reach issues a WIDE lei and needs its returns; one that names a head beside the wide reach, or no returns, refuses and writes nothing; CONTROL: the wide lei lands and shows its returns, and its answer names its cid, the line's tip a next lei follows", async () => {
    const s = await stand();
    for (const bad of [{}, { returns: 0 }, { returns: 2, head: HEAD }, { head: HEAD }, { reach: "all", returns: 2 }, { reach: "head" }, { reach: "head", head: HEAD, returns: 2 }]) {
      await expect(swarmCommand({ action: "lei-kui", rite: "push", branch: BRANCH, after: null, ...bad } as never, s.deps), JSON.stringify(bad)).rejects.toMatchObject({ code: "swarm-lei-malformed" });
    }
    expect([...s.wiki.rows.keys()]).toEqual([]);
    const strung = await swarmCommand({ action: "lei-kui", rite: "push", branch: BRANCH, returns: 4, after: null }, s.deps);
    expect(strung).toEqual({ rite: "push", branch: BRANCH, reach: "wide", returns: 4, lei: expect.stringMatching(/^[0-9a-f]{64}$/) });
    expect(await swarmCommand({ action: "show", rite: "push", branch: BRANCH, head: HEAD }, s.deps)).toMatchObject({ lei: { standing: true, reach: "wide", returnsLeft: 4, after: strung["lei"] } });
    // THE LINE NAMES ITS LEI'S RETURNS (a spent line's refill strings the same count).
    expect(await swarmCommand({ action: "show", rite: "push", branch: BRANCH, head: HEAD }, s.deps)).toMatchObject({ lei: { returns: 4 } });
    // The same words again name the lei that already rests: nothing more lands.
    const rows = s.wiki.rows.size;
    await expect(swarmCommand({ action: "lei-kui", rite: "push", branch: BRANCH, returns: 4, after: null }, s.deps)).rejects.toBeDefined();
    expect(s.wiki.rows.size).toBe(rows);
  });

  test("CONTROL: `kuiLei` strings the same lei the door's `lei-kui` act strings, and a replay through either lands nothing more", async () => {
    const s = await stand();
    expect(await kuiLei({ rite: "push", branch: BRANCH, returns: 2, after: null }, s.deps)).toEqual({ rite: "push", branch: BRANCH, reach: "wide", returns: 2, lei: expect.stringMatching(/^[0-9a-f]{64}$/) });
    const rows = s.wiki.rows.size;
    await expect(swarmCommand({ action: "lei-kui", rite: "push", branch: BRANCH, returns: 2, after: null }, s.deps)).rejects.toBeDefined();
    expect(s.wiki.rows.size).toBe(rows);
  });

  test("CONTROL: a lei-kui naming the head reach pins one head, and show reads it standing at that head alone", async () => {
    const s = await stand();
    expect(await swarmCommand({ action: "lei-kui", rite: "push", branch: BRANCH, reach: "head", head: HEAD, after: null }, s.deps)).toEqual({ rite: "push", branch: BRANCH, reach: "head", head: HEAD, lei: expect.stringMatching(/^[0-9a-f]{64}$/) });
    expect(await swarmCommand({ action: "show", rite: "push", branch: BRANCH, head: HEAD }, s.deps)).toMatchObject({ lei: { standing: true, reach: "head", returnsLeft: 1 } });
    expect(await swarmCommand({ action: "show", rite: "push", branch: BRANCH, head: HEAD2 }, s.deps)).toMatchObject({ lei: { standing: false, refusal: "head-mismatch" } });
  });
});
