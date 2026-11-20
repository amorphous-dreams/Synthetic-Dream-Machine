/**
 * lei-hand-record — THE VESSEL LANDS A HAND RECORD (road 4b, backlog-awakens Wave 4b lane B).
 *
 * Under a pūlama the vessel holds no face root, so the hand signs a lei (kui, restring) or an unstring at the pūlama's hand door,
 * sign-only, and the vessel lands that record by `lei-land`: it verifies the record against the face's grant and group, then runs
 * the very checks a kui or an unstring runs at the door (the chain's tip, the returns left, the co-sign gate for a rite that leaves
 * the device), signing nothing of its own. A record that does not verify lands nothing.
 *
 * Every red pairs with a CONTROL. Meme: lar:///ha.ka.ba/lares/docs/pono/seat-harness
 */
import { describe, expect, test } from "vitest";
import type { LarDoc } from "../src/base-doc.js";
import { ed25519SignerFromSeed, ed25519VerifyingKeyFromSeed } from "../src/ed25519-door.js";
import { swarmBoardRecords, writeSwarmBoardAct } from "../src/swarm-board.js";
import { swarmCommand, type SwarmDoorDeps } from "../src/swarm-door.js";
import { signSwarmAct, swarmActCid, swarmLeiRecordTitle, swarmLeiTitle, swarmLeiUnstrungTitle, type SignedSwarmAct, type SwarmSignerPort, type SwarmWikiPort } from "../src/swarm-tiddlers.js";
import { WardRefused } from "../src/ward-slots.js";
import { soloCosign } from "./ward-cosign-table.js";

const GROUP = "face-group", BRANCH = "feature/x";
const keyed = async (n: number): Promise<SwarmSignerPort> => ({ key: await ed25519VerifyingKeyFromSeed(new Uint8Array(32).fill(n)), sign: ed25519SignerFromSeed(new Uint8Array(32).fill(n)) });

/** A vessel that holds no face root: its own signer refuses every signature, as a vessel under a pūlama does. */
async function stand(opts: { readonly cosign?: SwarmDoorDeps["cosign"] } = {}) {
  const root = await keyed(1);
  const doc = { tiddlers: {} } as LarDoc, rows = new Map<string, string>();
  const wiki: SwarmWikiPort = { read: async (t) => rows.get(t) ?? null, write: async (t, x) => { rows.set(t, x); }, writeNew: async (t, x) => (rows.has(t) ? false : (rows.set(t, x), true)),
    list: async (prefix) => [...rows.keys()].filter((t) => t.startsWith(prefix)) };
  const keyless: SwarmSignerPort = { key: root.key, sign: async () => { throw new Error("needs-the-human: this vessel holds no face root"); } };
  const deps: SwarmDoorDeps = {
    group: GROUP, face: { group: GROUP, grant: (k) => k === root.key }, signer: keyless, trust: { hand: (k) => k === root.key, vessel: () => false, lead: () => false }, epoch: () => 0, wiki,
    board: { records: async () => swarmBoardRecords(doc, GROUP), land: async (act) => { writeSwarmBoardAct(doc, act); } },
    who: { kind: "hand", id: root.key }, cosign: opts.cosign ?? (() => soloCosign(GROUP, root)),
  };
  return { deps, rows, root, wiki };
}

const land = (record: unknown, deps: SwarmDoorDeps) => swarmCommand({ action: "lei-land", record } as never, deps);

describe("the vessel lands a lei the hand signed at the pūlama", () => {
  test("RED: a kui record signed apart lands byte for byte at its own row, then a restring after its tip and an unstring of the newer lei land, the vessel signing nothing; CONTROL: the keyless vessel's own kui refuses", async () => {
    const s = await stand();
    // CONTROL: this vessel opens no face root, so a kui it would sign itself never lands.
    await expect(swarmCommand({ action: "lei-kui", rite: "kukulu", branch: BRANCH, returns: 2, after: null }, s.deps)).rejects.toThrow(/needs-the-human/);
    expect(s.rows.size).toBe(0);
    const first = await signSwarmAct({ act: "lei", group: GROUP, rite: "kukulu", branch: BRANCH, after: null, reach: "wide", returns: 2 }, s.root);
    const cid = swarmActCid(first);
    expect(await land(first, s.deps)).toMatchObject({ rite: "kukulu", branch: BRANCH, reach: "wide", returns: 2, landed: cid });
    expect(JSON.parse(s.rows.get(swarmLeiRecordTitle("kukulu", BRANCH, cid))!)).toEqual(first);
    // A RESTRING RIDES KUI: the hand signs a lei after the tip it read, and it lands as a kui after that tip. The record may ride as its JSON text.
    const newer = await signSwarmAct({ act: "lei", group: GROUP, rite: "kukulu", branch: BRANCH, after: cid, reach: "wide", returns: 1 }, s.root);
    expect(await land(JSON.stringify(newer), s.deps)).toMatchObject({ landed: swarmActCid(newer) });
    const unstrung = await signSwarmAct({ act: "lei-unstrung", group: GROUP, rite: "kukulu", branch: BRANCH, lei: swarmActCid(newer) }, s.root);
    expect(await land(unstrung, s.deps)).toMatchObject({ lei: swarmActCid(newer), unstrung: true, landed: swarmActCid(unstrung) });
    expect(JSON.parse(s.rows.get(swarmLeiUnstrungTitle(swarmActCid(newer)))!)).toEqual(unstrung);
  });

  test("RED: a record signed by no grant, one of another group, one whose terms moved after the signature, and a body no lei forms each refuse `swarm-hand-record-unverified` and land nothing; CONTROL: the same record unaltered lands", async () => {
    const s = await stand();
    const stranger = await keyed(9);
    const good = await signSwarmAct({ act: "lei", group: GROUP, rite: "kukulu", branch: BRANCH, after: null, reach: "wide", returns: 2 }, s.root);
    const foreign = await signSwarmAct({ act: "lei", group: GROUP, rite: "kukulu", branch: BRANCH, after: null, reach: "wide", returns: 2 }, stranger);
    const elsewhere = await signSwarmAct({ act: "lei", group: "another-group", rite: "kukulu", branch: BRANCH, after: null, reach: "wide", returns: 2 }, s.root);
    const moved = { ...good, body: { ...good.body, returns: 12 } } as SignedSwarmAct;
    const receipt = await signSwarmAct({ act: "roster", group: GROUP, seat: "seat-1", model: "m", mode: "solo", reading: 1, ceiling: 2, outcome: "ok" }, s.root);
    for (const [name, bad] of [["no grant", foreign], ["another group", elsewhere], ["moved terms", moved], ["no lei", receipt], ["no record", { body: 1 }], ["no JSON", "{"]] as const) {
      await expect(land(bad, s.deps), name).rejects.toMatchObject({ code: "swarm-hand-record-unverified" });
    }
    expect(s.rows.size).toBe(0);
    expect(await land(good, s.deps)).toMatchObject({ landed: swarmActCid(good) });
  });

  test("RED: a record after a tip that moved refuses `swarm-lei-after-moved`, and a push record asks the face's co-sign port at landing, its refusal landing nothing; CONTROL: a kukulu record asks no co-sign", async () => {
    const asked: string[] = [];
    const s = await stand({ cosign: () => { asked.push("cosign"); throw new WardRefused("ward-awaiting-cosign", "f".repeat(64)); } });
    const first = await signSwarmAct({ act: "lei", group: GROUP, rite: "kukulu", branch: BRANCH, after: null, reach: "wide", returns: 1 }, s.root);
    await land(first, s.deps);
    expect(asked).toEqual([]);
    const stale = await signSwarmAct({ act: "lei", group: GROUP, rite: "kukulu", branch: BRANCH, after: null, reach: "wide", returns: 3 }, s.root);
    await expect(land(stale, s.deps)).rejects.toMatchObject({ code: "swarm-lei-forked" });
    const lost = await signSwarmAct({ act: "lei", group: GROUP, rite: "kukulu", branch: BRANCH, after: "9".repeat(64), reach: "wide", returns: 3 }, s.root);
    await expect(land(lost, s.deps)).rejects.toMatchObject({ code: "swarm-lei-after-moved" });
    const push = await signSwarmAct({ act: "lei", group: GROUP, rite: "push", branch: BRANCH, after: null, reach: "wide", returns: 1 }, s.root);
    await expect(land(push, s.deps)).rejects.toMatchObject({ code: "ward-awaiting-cosign" });
    expect(asked.length).toBeGreaterThan(0);
    expect([...s.rows.keys()].some((t) => t.startsWith(swarmLeiTitle("push", BRANCH)))).toBe(false);
  });

  test("RED: a seat lands no hand record (`swarm-needs-hand`); CONTROL: the hand lands it", async () => {
    const s = await stand();
    const good = await signSwarmAct({ act: "lei", group: GROUP, rite: "kukulu", branch: BRANCH, after: null, reach: "wide", returns: 2 }, s.root);
    await expect(land(good, { ...s.deps, who: { kind: "seat", id: "a-seat" } })).rejects.toMatchObject({ code: "swarm-needs-hand" });
    expect(s.rows.size).toBe(0);
    await expect(land(good, s.deps)).resolves.toMatchObject({ landed: swarmActCid(good) });
  });
});
