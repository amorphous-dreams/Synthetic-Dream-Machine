/**
 * lei-rulings — three rulings the operator approved on the lei (2026-11-15):
 *
 *   the co-sign weighs reach   a `kukulu` lei needs no second device: the co-sign binds acts whose effect leaves the device, and a
 *                              vessel raised again stays home. A `push` lei keeps its co-sign. The ward still guards every kui.
 *   returns hold no hard cap   a kui of more than twelve returns asks an explicit confirm, and names the count it asks about.
 *   show needs no head         a wide lei names no head, so its line reads by rite and branch alone.
 *
 * Every red pairs with a CONTROL. Meme: lar:///ha.ka.ba/lares/docs/pono/seat-harness
 */
import { describe, expect, test } from "vitest";
import type { LarDoc } from "../src/base-doc.js";
import { ed25519SignerFromSeed, ed25519VerifyingKeyFromSeed } from "../src/ed25519-door.js";
import { WARD_COSIGN_VERBS, faceIntentVerbs } from "../src/intent-verbs.js";
import { swarmBoardRecords, writeSwarmBoardAct } from "../src/swarm-board.js";
import { LEI_RETURNS_ASK_ABOVE, swarmCommand, type SwarmDoorDeps } from "../src/swarm-door.js";
import { leiRiteCosigns } from "../src/swarm-lei-rite.js";
import { putSwarmAct, readLei, signSwarmAct, swarmActCid, swarmLeiRecordTitle, type SwarmBodyParts, type SwarmWikiPort } from "../src/swarm-tiddlers.js";
import type { WardCosignAct } from "../src/ward-cosign.js";
import type { WardCosignPort } from "../src/ward-cosign-gate.js";
import { soloCosign } from "./ward-cosign-table.js";

const GROUP = "face-group", BRANCH = "main", HEAD = "a".repeat(40);
const keyed = async (n: number) => ({ key: await ed25519VerifyingKeyFromSeed(new Uint8Array(32).fill(n)), sign: ed25519SignerFromSeed(new Uint8Array(32).fill(n)) });

async function stand(cosign?: () => WardCosignPort | Promise<WardCosignPort>) {
  const root = await keyed(1);
  const doc = { tiddlers: {} } as LarDoc, rows = new Map<string, string>();
  const wiki: SwarmWikiPort = { read: async (t) => rows.get(t) ?? null, write: async (t, x) => { rows.set(t, x); }, writeNew: async (t, x) => (rows.has(t) ? false : (rows.set(t, x), true)),
    list: async (prefix) => [...rows.keys()].filter((t) => t.startsWith(prefix)) };
  const trust = { hand: (k: string) => k === root.key, vessel: () => false, place: () => false, lead: () => false };
  const deps: SwarmDoorDeps = {
    group: GROUP, face: { group: GROUP, grant: (k) => k === root.key }, signer: root, trust, epoch: () => 0, wiki,
    board: { records: async () => swarmBoardRecords(doc, GROUP), land: async (act) => { writeSwarmBoardAct(doc, act); } },
    who: { kind: "hand", id: root.key }, cosign: cosign ?? (() => soloCosign(GROUP, root)),
  };
  return { deps, wiki, rows, trust, root };
}

describe("the co-sign weighs reach: a kukulu lei stays home", () => {
  test("RED: `ward-kukulu-lei` stands in no co-sign table, and a kukulu lei reads with a witness that co-signs nothing; CONTROL: a push lei at the same witness stands on no chain", async () => {
    expect(WARD_COSIGN_VERBS).toEqual(["ward-kapae-lower", "ward-house-cap", "ward-push-lei"]);
    expect(faceIntentVerbs().classOfVerb("ward-kukulu-lei")).toBeNull();
    expect(leiRiteCosigns("push")).toBe(true);
    expect(leiRiteCosigns("kukulu")).toBe(false);
    const s = await stand();
    const asked: WardCosignAct[] = [];
    const none = { accepts: (act: WardCosignAct) => { asked.push(act); return false; } };
    for (const rite of ["push", "kukulu"] as const) {
      const lei = await signSwarmAct({ act: "lei", group: GROUP, rite, reach: "wide", returns: 2, branch: BRANCH, after: null } as SwarmBodyParts, s.root);
      await putSwarmAct(s.wiki, swarmLeiRecordTitle(rite, BRANCH, swarmActCid(lei)), lei);
    }
    expect(await readLei(s.wiki, { rite: "kukulu", branch: BRANCH, head: HEAD }, s.trust, GROUP, none)).toMatchObject({ ok: true, reach: "wide" });
    expect(asked).toEqual([]);
    expect(await readLei(s.wiki, { rite: "push", branch: BRANCH, head: HEAD }, s.trust, GROUP, none)).toEqual({ ok: false, refusal: "ward-act-uncosigned" });
    expect(asked.map((a) => a.verb)).toEqual(["ward-push-lei"]);
  });

  test("RED: a kukulu kui never asks the co-sign port, on a face whose port would refuse; CONTROL: a push kui at the same port asks it, and a kukulu replay lands nothing more", async () => {
    let asks = 0;
    const s = await stand(() => { asks++; throw new Error("the co-sign port stands unreachable here"); });
    // show reads the board's cap through the witness; a line's read alone runs below.
    await expect(swarmCommand({ action: "lei-kui", rite: "kukulu", branch: BRANCH, returns: 2, after: null }, s.deps)).resolves.toEqual({ rite: "kukulu", branch: BRANCH, reach: "wide", returns: 2, lei: expect.stringMatching(/^[0-9a-f]{64}$/) });
    expect(asks).toBe(0);
    const rows = s.rows.size;
    await expect(swarmCommand({ action: "lei-kui", rite: "kukulu", branch: BRANCH, returns: 2, after: null }, s.deps)).rejects.toMatchObject({ code: "swarm-lei-already-strung" });
    expect(s.rows.size).toBe(rows);
    await expect(swarmCommand({ action: "lei-kui", rite: "push", branch: BRANCH, returns: 2, after: null }, s.deps)).rejects.toThrow(/unreachable/);
    expect(asks).toBeGreaterThan(0);
  });
});

describe("returns hold no hard cap, and a large count asks a confirm", () => {
  test("RED: a kui or a restring of more than twelve returns refuses `swarm-lei-returns-unconfirmed`, naming the count, and writes nothing; CONTROL: twelve passes, and the confirm passes the larger count", async () => {
    const s = await stand();
    expect(LEI_RETURNS_ASK_ABOVE).toBe(12);
    await expect(swarmCommand({ action: "lei-kui", rite: "kukulu", branch: BRANCH, returns: 13, after: null }, s.deps)).rejects.toMatchObject({ code: "swarm-lei-returns-unconfirmed", message: expect.stringContaining("13") });
    expect(s.rows.size).toBe(0);
    await expect(swarmCommand({ action: "lei-kui", rite: "kukulu", branch: BRANCH, returns: 12, after: null }, s.deps)).resolves.toMatchObject({ returns: 12 });
    await expect(swarmCommand({ action: "lei-restring", rite: "kukulu", branch: BRANCH, returns: 400 }, s.deps)).rejects.toMatchObject({ code: "swarm-lei-returns-unconfirmed" });
    await expect(swarmCommand({ action: "lei-restring", rite: "kukulu", branch: BRANCH, returns: 400, confirm: true }, s.deps)).resolves.toMatchObject({ returns: 400 });
  });
});

describe("show needs no head for a wide line", () => {
  test("RED: a show by rite and branch alone reads a wide lei standing with its returns; CONTROL: a head lei shows the head it pins, and a head named beside it still reads `head-mismatch` where it differs", async () => {
    const s = await stand();
    expect(await swarmCommand({ action: "show", rite: "kukulu", branch: BRANCH }, s.deps)).toMatchObject({ lei: { standing: false, refusal: "absent", after: null } });
    await swarmCommand({ action: "lei-kui", rite: "kukulu", branch: BRANCH, returns: 3, after: null }, s.deps);
    expect(await swarmCommand({ action: "show", rite: "kukulu", branch: BRANCH }, s.deps)).toMatchObject({ lei: { standing: true, reach: "wide", returnsLeft: 3 } });
    await swarmCommand({ action: "lei-restring", rite: "kukulu", branch: BRANCH, reach: "head", head: HEAD }, s.deps);
    expect(await swarmCommand({ action: "show", rite: "kukulu", branch: BRANCH }, s.deps)).toMatchObject({ lei: { standing: true, reach: "head", head: HEAD, returnsLeft: 1 } });
    expect(await swarmCommand({ action: "show", rite: "kukulu", branch: BRANCH, head: "b".repeat(40) }, s.deps)).toMatchObject({ lei: { standing: false, refusal: "head-mismatch" } });
    await expect(swarmCommand({ action: "show", branch: BRANCH } as never, s.deps)).rejects.toMatchObject({ code: "swarm-lei-malformed" });
  });
});
