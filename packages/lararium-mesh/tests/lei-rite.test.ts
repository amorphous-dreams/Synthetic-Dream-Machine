/**
 * lei-rite — one power per lei (road L45b): a lei names its rite (`push` · `kukulu` · `keep`), and the rite rides its head, its title
 * and the ward verb its co-sign answers under.
 *
 * A lei that named no rite would let one record family serve two powers: a push lei would spend as a kukulu. Every red pairs
 * with a CONTROL. Meme: lar:///ha.ka.ba/lares/docs/pono/seat-harness
 */
import { describe, expect, test } from "vitest";
import { ed25519SignerFromSeed, ed25519VerifyingKeyFromSeed } from "../src/ed25519-door.js";
import { WARD_COSIGN_VERBS, faceIntentVerbs } from "../src/intent-verbs.js";
import type { LarDoc } from "../src/base-doc.js";
import { swarmBoardRecords, writeSwarmBoardAct } from "../src/swarm-board.js";
import { swarmCommand, type SwarmDoorDeps } from "../src/swarm-door.js";
import { SWARM_LEI_RITES, leiRiteCosigns, wardLeiVerb } from "../src/swarm-lei-rite.js";
import {
  SwarmRefused, putSwarmAct, readLei, readSwarmRecord, signSwarmAct, returnLei, swarmActCid, swarmLeiHead, swarmLeiRecordTitle, swarmLeiTitle, swarmReceiptTitle,
  type SwarmBodyParts, type SwarmWikiPort,
} from "../src/swarm-tiddlers.js";
import type { WardCosignAct } from "../src/ward-cosign.js";
import { soloCosign } from "./ward-cosign-table.js";

const GROUP = "face-group", HEAD = "a".repeat(40), TREE = "b".repeat(40), BRANCH = "feature/x";
const keyed = async (n: number) => ({ key: await ed25519VerifyingKeyFromSeed(new Uint8Array(32).fill(n)), sign: ed25519SignerFromSeed(new Uint8Array(32).fill(n)) });
const ONE_DEVICE = { accepts: () => true };

function wikiPort(): SwarmWikiPort & { rows: Map<string, string> } {
  const rows = new Map<string, string>();
  return { rows, read: async (t) => rows.get(t) ?? null, write: async (t, text) => { rows.set(t, text); }, writeNew: async (t, text) => { if (rows.has(t)) return false; rows.set(t, text); return true; },
    list: async (prefix) => [...rows.keys()].filter((t) => t.startsWith(prefix)) };
}

async function fixture() {
  const hand = await keyed(1), vessel = await keyed(2);
  const trust = { hand: (k: string) => k === hand.key, vessel: (k: string) => k === vessel.key, lead: () => false };
  const wiki = wikiPort();
  /** A hand-signed lei of one rite, at its own row; hands back the record and its cid. */
  const issue = async (rite: "push" | "kukulu" | "keep") => {
    const lei = await signSwarmAct({ act: "lei", group: GROUP, rite, reach: "head", branch: BRANCH, head: HEAD, after: null }, hand);
    await putSwarmAct(wiki, swarmLeiRecordTitle(rite, BRANCH, swarmActCid(lei)), lei);
    return { lei, cid: swarmActCid(lei) };
  };
  // Every spend rests on a passing receipt for the head's tree (`lei-reach.test.ts`); one stands here for each spend below.
  await putSwarmAct(wiki, swarmReceiptTitle(TREE), await signSwarmAct({ act: "receipt", group: GROUP, tree: TREE, checks: ["typecheck"], verdict: "pass", definitions: "d".repeat(64) }, vessel));
  return { hand, vessel, trust, wiki, issue };
}

describe("lei-rite-separates-powers", () => {
  test("RED: a push lei never satisfies a kukulu read, at the same branch and head; CONTROL: the push read finds it", async () => {
    const f = await fixture();
    await f.issue("push");
    expect(await readLei(f.wiki, { rite: "kukulu", branch: BRANCH, head: HEAD }, f.trust, GROUP, ONE_DEVICE)).toEqual({ ok: false, refusal: "absent" });
    expect(await readLei(f.wiki, { rite: "push", branch: BRANCH, head: HEAD }, f.trust, GROUP, ONE_DEVICE)).toMatchObject({ ok: true });
  });

  test("RED: the ward verbs differ, and a push lei's read asks its own; CONTROL: a kukulu lei asks none and stands beside a witness that co-signed the push lei alone", async () => {
    const f = await fixture();
    await f.issue("push"); await f.issue("kukulu");
    expect(wardLeiVerb("push")).toBe("ward-push-lei");
    expect(wardLeiVerb("kukulu")).toBe("ward-kukulu-lei");
    const asked: WardCosignAct[] = [];
    const pushOnly = { accepts: (act: WardCosignAct) => { asked.push(act); return act.verb === "ward-push-lei"; } };
    expect(await readLei(f.wiki, { rite: "push", branch: BRANCH, head: HEAD }, f.trust, GROUP, pushOnly)).toMatchObject({ ok: true });
    // A kukulu stays on the device, so its lei asks no co-sign at all and stands on the hand's signature (`lei-rulings.test.ts`).
    expect(await readLei(f.wiki, { rite: "kukulu", branch: BRANCH, head: HEAD }, f.trust, GROUP, pushOnly)).toMatchObject({ ok: true });
    expect(asked.map((a) => a.verb)).toEqual(["ward-push-lei"]);
    // The head a lei names folds the rite in, so one rite's lei never carries the other's identity.
    expect(asked[0]!.head).toBe(swarmLeiHead({ rite: "push", reach: "head", branch: BRANCH, head: HEAD, after: null }));
    expect(swarmLeiHead({ rite: "push", reach: "head", branch: BRANCH, head: HEAD, after: null })).not.toBe(swarmLeiHead({ rite: "kukulu", reach: "head", branch: BRANCH, head: HEAD, after: null }));
  });

  test("RED: a push lei's bytes moved to the kukulu title read as misplaced; CONTROL: at its own title the lei reads", async () => {
    const f = await fixture();
    const { lei, cid } = await f.issue("push");
    expect(swarmLeiTitle("push", BRANCH)).toBe("$:/lares/swarm/lei/push/feature%2Fx");
    expect(swarmLeiTitle("kukulu", BRANCH)).toBe("$:/lares/swarm/lei/kukulu/feature%2Fx");
    const moved = swarmLeiRecordTitle("kukulu", BRANCH, cid);
    f.wiki.rows.set(moved, JSON.stringify(lei));
    expect(await readSwarmRecord(f.wiki, moved, f.trust, GROUP)).toEqual({ ok: false, refusal: "title" });
    expect(await readLei(f.wiki, { rite: "kukulu", branch: BRANCH, head: HEAD }, f.trust, GROUP, ONE_DEVICE)).toEqual({ ok: false, refusal: "title" });
    expect(await readSwarmRecord(f.wiki, swarmLeiRecordTitle("push", BRANCH, cid), f.trust, GROUP)).toMatchObject({ ok: true });
  });

  test("RED: a push lei never spends as a kukulu, and spending it leaves the kukulu lei of the same head unspent; CONTROL: each spends once under its own rite", async () => {
    const f = await fixture();
    const push = await f.issue("push");
    await expect(returnLei(f.wiki, { rite: "kukulu", branch: BRANCH, head: HEAD, tree: TREE }, f.trust, GROUP, f.vessel, ONE_DEVICE)).rejects.toMatchObject({ code: "swarm-lei-absent" });
    const kukulu = await f.issue("kukulu");
    expect(kukulu.cid).not.toBe(push.cid);
    await expect(returnLei(f.wiki, { rite: "push", branch: BRANCH, head: HEAD, tree: TREE }, f.trust, GROUP, f.vessel, ONE_DEVICE)).resolves.toEqual({ lei: push.cid, reach: "head", n: 1 });
    expect(await readLei(f.wiki, { rite: "push", branch: BRANCH, head: HEAD }, f.trust, GROUP, ONE_DEVICE)).toEqual({ ok: false, refusal: "returned" });
    expect(await readLei(f.wiki, { rite: "kukulu", branch: BRANCH, head: HEAD }, f.trust, GROUP, ONE_DEVICE)).toMatchObject({ ok: true, cid: kukulu.cid });
    await expect(returnLei(f.wiki, { rite: "kukulu", branch: BRANCH, head: HEAD, tree: TREE }, f.trust, GROUP, f.vessel, ONE_DEVICE)).resolves.toEqual({ lei: kukulu.cid, reach: "head", n: 1 });
    await expect(returnLei(f.wiki, { rite: "kukulu", branch: BRANCH, head: HEAD, tree: TREE }, f.trust, GROUP, f.vessel, ONE_DEVICE)).rejects.toMatchObject({ code: "swarm-lei-returned" });
  });

  test("RED: the rite list holds four names (the executable-record lei's `exec` beside the three restart and keep rites), and a lei of any other rite forms no record, no title and no ward verb; CONTROL: the push rite registers its co-signed ward verb", async () => {
    const f = await fixture();
    expect([...SWARM_LEI_RITES]).toEqual(["push", "kukulu", "keep", "exec"]);
    for (const rite of ["merge", "", "PUSH", "push/x", undefined]) {
      await expect(signSwarmAct({ act: "lei", group: GROUP, rite, reach: "head", branch: BRANCH, head: HEAD, after: null } as unknown as SwarmBodyParts, f.hand), String(rite)).rejects.toMatchObject({ code: "swarm-shape" });
      expect(() => swarmLeiTitle(rite as never, BRANCH), String(rite)).toThrow(SwarmRefused);
      await expect(readLei(f.wiki, { rite: rite as never, branch: BRANCH, head: HEAD }, f.trust, GROUP, ONE_DEVICE), String(rite)).rejects.toMatchObject({ code: "swarm-name-malformed" });
    }
    expect(WARD_COSIGN_VERBS).toEqual(["ward-kapae-lower", "ward-house-cap", "ward-push-lei"]);
    expect(faceIntentVerbs().classOfVerb(wardLeiVerb("push"))).toEqual({ class: "single-effect", cosign: true });
  });
});

describe("keep-lei-keeps-its-own-power", () => {
  test("RED: a keep lei forms a record at its own title and spends as keep alone, asking no co-sign; CONTROL: a push lei at the same line never spends as a keep, and the keep lei never as a push or a kukulu", async () => {
    const f = await fixture();
    await f.issue("push");
    // A push lei at the workspace's line grants no keep: the house's memory leaves under its own lei alone.
    await expect(returnLei(f.wiki, { rite: "keep" as never, branch: BRANCH, head: HEAD, tree: TREE }, f.trust, GROUP, f.vessel, ONE_DEVICE)).rejects.toMatchObject({ code: "swarm-lei-absent" });
    const keep = await f.issue("keep");
    expect(swarmLeiTitle("keep" as never, BRANCH)).toBe("$:/lares/swarm/lei/keep/feature%2Fx");
    // The operator's own unlock strings it and no second device answers: the keep's cut rests on this device (`leiRiteCosigns`).
    expect(leiRiteCosigns("keep" as never)).toBe(false);
    const asked: WardCosignAct[] = [];
    const none = { accepts: (act: WardCosignAct) => { asked.push(act); return false; } };
    expect(await readLei(f.wiki, { rite: "keep" as never, branch: BRANCH, head: HEAD }, f.trust, GROUP, none)).toMatchObject({ ok: true, cid: keep.cid });
    expect(asked).toEqual([]);
    await expect(returnLei(f.wiki, { rite: "kukulu", branch: BRANCH, head: HEAD, tree: TREE }, f.trust, GROUP, f.vessel, ONE_DEVICE)).rejects.toMatchObject({ code: "swarm-lei-absent" });
    await expect(returnLei(f.wiki, { rite: "keep" as never, branch: BRANCH, head: HEAD, tree: TREE }, f.trust, GROUP, f.vessel, ONE_DEVICE)).resolves.toEqual({ lei: keep.cid, reach: "head", n: 1 });
    // The push lei beside it still stands unspent.
    expect(await readLei(f.wiki, { rite: "push", branch: BRANCH, head: HEAD }, f.trust, GROUP, ONE_DEVICE)).toMatchObject({ ok: true });
  });
});

describe("the door issues a lei under its rite", () => {
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

  test("RED: a lei-kui that names no rite, or one outside the list, refuses `swarm-lei-malformed` and writes nothing; CONTROL: a named rite lands under its own title", async () => {
    const s = await stand();
    for (const rite of [undefined, "merge", ""]) {
      await expect(swarmCommand({ action: "lei-kui", rite, branch: BRANCH, head: HEAD, after: null } as never, s.deps), String(rite)).rejects.toMatchObject({ code: "swarm-lei-malformed" });
    }
    expect([...s.wiki.rows.keys()]).toEqual([]);
    expect(await swarmCommand({ action: "lei-kui", rite: "kukulu", reach: "head", branch: BRANCH, head: HEAD, after: null }, s.deps)).toEqual({ rite: "kukulu", branch: BRANCH, reach: "head", head: HEAD });
    expect([...s.wiki.rows.keys()].every((t) => t.startsWith(`${swarmLeiTitle("kukulu", BRANCH)}/`))).toBe(true);
  });

  test("RED: a kukulu lei the door issued shows standing for kukulu and absent for push, and each rite keeps its own chain; CONTROL: a push lei issued beside it starts at null", async () => {
    const s = await stand();
    await swarmCommand({ action: "lei-kui", rite: "kukulu", reach: "head", branch: BRANCH, head: HEAD, after: null }, s.deps);
    expect(await swarmCommand({ action: "show", rite: "kukulu", branch: BRANCH, head: HEAD }, s.deps)).toMatchObject({ lei: { standing: true } });
    expect(await swarmCommand({ action: "show", rite: "push", branch: BRANCH, head: HEAD }, s.deps)).toMatchObject({ lei: { standing: false, refusal: "absent", after: null } });
    await expect(swarmCommand({ action: "show", branch: BRANCH, head: HEAD } as never, s.deps)).rejects.toMatchObject({ code: "swarm-lei-malformed" });
    // The push chain holds no lei, so its first names no predecessor: the kukulu lei never counts as the one it follows.
    await expect(swarmCommand({ action: "lei-kui", rite: "push", reach: "head", branch: BRANCH, head: HEAD, after: null }, s.deps)).resolves.toEqual({ rite: "push", branch: BRANCH, reach: "head", head: HEAD });
    expect(await swarmCommand({ action: "show", rite: "push", branch: BRANCH, head: HEAD }, s.deps)).toMatchObject({ lei: { standing: true } });
  });
});
