/**
 * lei-unstring — ending a lei short of its returns (road L45): UNSTRING revokes a lei that still holds returns, RESTRING
 * supersedes the standing lei with a newer one. Each writes a signed record and deletes nothing.
 *
 * Every red pairs with a CONTROL. Meme: lar:///ha.ka.ba/lares/docs/pono/seat-harness
 */
import { describe, expect, test } from "vitest";
import type { LarDoc } from "../src/base-doc.js";
import { ed25519SignerFromSeed, ed25519VerifyingKeyFromSeed } from "../src/ed25519-door.js";
import { swarmBoardRecords, writeSwarmBoardAct } from "../src/swarm-board.js";
import { SWARM_VERB_HAND_CODES, restringLei, swarmCommand, unstringLei, type SwarmDoorDeps } from "../src/swarm-door.js";
import {
  putSwarmAct, readLei, readSwarmRecord, returnLei, signSwarmAct, swarmActCid, swarmLeiRecordTitle, swarmLeiTitle, swarmLeiUnstrungTitle, swarmReceiptTitle,
  type SignedSwarmAct, type SwarmWikiPort,
} from "../src/swarm-tiddlers.js";
import { soloCosign } from "./ward-cosign-table.js";
import { placeTrust, restPlaceReceipt } from "./place-receipt.js";

const GROUP = "face-group", BRANCH = "feature/x", HEAD = "a".repeat(40), TREE = "1".repeat(40);
const keyed = async (n: number) => ({ key: await ed25519VerifyingKeyFromSeed(new Uint8Array(32).fill(n)), sign: ed25519SignerFromSeed(new Uint8Array(32).fill(n)) });
const ONE_DEVICE = { accepts: () => true };

async function stand(who: SwarmDoorDeps["who"]["kind"] = "hand") {
  const root = await keyed(1), vessel = await keyed(2);
  const doc = { tiddlers: {} } as LarDoc, rows = new Map<string, string>();
  const wiki: SwarmWikiPort = { read: async (t) => rows.get(t) ?? null, write: async (t, x) => { rows.set(t, x); }, writeNew: async (t, x) => (rows.has(t) ? false : (rows.set(t, x), true)),
    list: async (prefix) => [...rows.keys()].filter((t) => t.startsWith(prefix)) };
  const trust = { hand: (k: string) => k === root.key, vessel: (k: string) => k === vessel.key, place: placeTrust(), lead: () => false };
  const deps: SwarmDoorDeps = {
    group: GROUP, face: { group: GROUP, grant: (k) => k === root.key }, signer: root, trust, epoch: () => 0, wiki,
    board: { records: async () => swarmBoardRecords(doc, GROUP), land: async (act) => { writeSwarmBoardAct(doc, act); } },
    who: { kind: who, id: root.key }, cosign: () => soloCosign(GROUP, root),
  };
  /** The cid of each lei resting on the push line, in chain order (first to tip). */
  const line = (): string[] => {
    const acts = [...rows].filter(([t]) => t.startsWith(`${swarmLeiTitle("push", BRANCH)}/`)).map(([, text]) => JSON.parse(text) as SignedSwarmAct);
    const out: string[] = [];
    for (let after: string | null = null; ;) {
      const next = acts.find((a) => (a.body as { after: string | null }).after === after);
      if (!next) return out;
      after = swarmActCid(next); out.push(after);
    }
  };
  await restPlaceReceipt(wiki, TREE);
  const read = () => readLei(wiki, { rite: "push", branch: BRANCH, head: HEAD }, trust, GROUP, ONE_DEVICE);
  const giveBack = () => returnLei(wiki, { rite: "push", branch: BRANCH, head: HEAD, tree: TREE }, trust, GROUP, vessel, ONE_DEVICE);
  return { deps, wiki, rows, trust, root, vessel, line, read, giveBack };
}

describe("lei-unstring-ends-the-lei", () => {
  test("RED: an unstrung lei returns nothing more, its row still rests, and a hand-signed record names the act; CONTROL: the lei returned while it stood", async () => {
    const s = await stand();
    await swarmCommand({ action: "lei-kui", rite: "push", branch: BRANCH, returns: 3, after: null }, s.deps);
    const [cid] = s.line();
    await expect(s.giveBack()).resolves.toMatchObject({ lei: cid, n: 1 });
    const before = s.rows.size;
    expect(await swarmCommand({ action: "lei-unstring", rite: "push", branch: BRANCH, lei: cid! }, s.deps)).toEqual({ rite: "push", branch: BRANCH, lei: cid, unstrung: true });
    // One record more, and none fewer: unstring writes and never deletes.
    expect(s.rows.size).toBe(before + 1);
    expect(s.rows.has(swarmLeiRecordTitle("push", BRANCH, cid!))).toBe(true);
    expect(await readSwarmRecord(s.wiki, swarmLeiUnstrungTitle(cid!), s.trust, GROUP)).toMatchObject({ ok: true, act: { signer: s.root.key, body: { act: "lei-unstrung", lei: cid, rite: "push", branch: BRANCH } } });
    expect(await s.read()).toEqual({ ok: false, refusal: "unstrung" });
    await expect(s.giveBack()).rejects.toMatchObject({ code: "swarm-lei-unstrung" });
  });

  test("RED: a second unstring, an unstring of a lei that rests nowhere on the line, and one of a lei with no return left each refuse by name and write nothing; CONTROL: a fresh kui after the unstrung lei strings the line again", async () => {
    const s = await stand();
    await swarmCommand({ action: "lei-kui", rite: "push", branch: BRANCH, returns: 2, after: null }, s.deps);
    const [cid] = s.line();
    await expect(swarmCommand({ action: "lei-unstring", rite: "push", branch: BRANCH, lei: "9".repeat(64) }, s.deps)).rejects.toMatchObject({ code: "swarm-lei-absent" });
    await expect(swarmCommand({ action: "lei-unstring", rite: "kukulu", branch: BRANCH, lei: cid! }, s.deps)).rejects.toMatchObject({ code: "swarm-lei-absent" });
    for (const bad of [{}, { lei: "not-a-cid" }, { lei: cid, rite: "merge" }]) {
      await expect(swarmCommand({ action: "lei-unstring", rite: "push", branch: BRANCH, ...bad } as never, s.deps), JSON.stringify(bad)).rejects.toMatchObject({ code: "swarm-lei-malformed" });
    }
    await unstringLei({ rite: "push", branch: BRANCH, lei: cid! }, s.deps);
    const rows = s.rows.size;
    await expect(unstringLei({ rite: "push", branch: BRANCH, lei: cid! }, s.deps)).rejects.toMatchObject({ code: "swarm-lei-unstrung" });
    expect(s.rows.size).toBe(rows);
    await swarmCommand({ action: "lei-kui", rite: "push", branch: BRANCH, reach: "head", head: HEAD, after: cid! }, s.deps);
    const pin = s.line()[1]!;
    await expect(s.giveBack()).resolves.toMatchObject({ lei: pin, reach: "head", n: 1 });
    await expect(unstringLei({ rite: "push", branch: BRANCH, lei: pin }, s.deps)).rejects.toMatchObject({ code: "swarm-lei-returned" });
  });

  test("RED: a seat unstrings nothing (`swarm-needs-hand`), and any row at the unstrung title ends the lei, signed or not; CONTROL: the hand-only table names both acts", async () => {
    const seat = await stand("seat");
    await expect(swarmCommand({ action: "lei-unstring", rite: "push", branch: BRANCH, lei: "9".repeat(64) }, seat.deps)).rejects.toMatchObject({ code: "swarm-needs-hand" });
    await expect(swarmCommand({ action: "lei-restring", rite: "push", branch: BRANCH, returns: 2 }, seat.deps)).rejects.toMatchObject({ code: "swarm-needs-hand" });
    expect(SWARM_VERB_HAND_CODES).toMatchObject({ "swarm-lei-unstring": "swarm-needs-hand", "swarm-lei-restring": "swarm-needs-hand" });
    const s = await stand();
    await swarmCommand({ action: "lei-kui", rite: "push", branch: BRANCH, returns: 2, after: null }, s.deps);
    s.rows.set(swarmLeiUnstrungTitle(s.line()[0]!), "forged");
    expect(await s.read()).toEqual({ ok: false, refusal: "unstrung" });
  });
});

describe("lei-restring-supersedes", () => {
  test("RED: a restring strings a newer lei after the standing one, which then reads no more, and its row still rests; CONTROL: with no lei on the line a restring refuses and writes nothing", async () => {
    const s = await stand();
    await expect(swarmCommand({ action: "lei-restring", rite: "push", branch: BRANCH, returns: 2 }, s.deps)).rejects.toMatchObject({ code: "swarm-lei-nothing-to-restring" });
    expect(s.line()).toEqual([]);
    await swarmCommand({ action: "lei-kui", rite: "push", branch: BRANCH, returns: 5, after: null }, s.deps);
    const [old] = s.line();
    expect(await restringLei({ rite: "push", branch: BRANCH, reach: "head", head: HEAD }, s.deps)).toEqual({ rite: "push", branch: BRANCH, reach: "head", head: HEAD, lei: expect.stringMatching(/^[0-9a-f]{64}$/), restrung: old });
    const [, fresh] = s.line();
    // The newer lei names the one it supersedes, under the hand's signature; the old row rests where it stood.
    expect(JSON.parse(s.rows.get(swarmLeiRecordTitle("push", BRANCH, fresh!))!)).toMatchObject({ signer: s.root.key, body: { act: "lei", after: old, reach: "head" } });
    expect(s.rows.has(swarmLeiRecordTitle("push", BRANCH, old!))).toBe(true);
    expect(await s.read()).toMatchObject({ ok: true, cid: fresh, reach: "head" });
    await expect(s.giveBack()).resolves.toMatchObject({ lei: fresh, n: 1 });
  });

  test("RED: a restring reaches past an unstrung lei and strings the line again; a restring that mixes the reaches refuses as a kui does", async () => {
    const s = await stand();
    await swarmCommand({ action: "lei-kui", rite: "push", branch: BRANCH, returns: 5, after: null }, s.deps);
    const [old] = s.line();
    await unstringLei({ rite: "push", branch: BRANCH, lei: old! }, s.deps);
    await expect(restringLei({ rite: "push", branch: BRANCH, returns: 2, head: HEAD } as never, s.deps)).rejects.toMatchObject({ code: "swarm-lei-malformed" });
    await expect(restringLei({ rite: "push", branch: BRANCH, returns: 2 }, s.deps)).resolves.toMatchObject({ reach: "wide", returns: 2, restrung: old });
    expect(await s.read()).toMatchObject({ ok: true, reach: "wide", returnsLeft: 2 });
  });
});
