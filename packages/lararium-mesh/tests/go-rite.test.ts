/**
 * go-rite — one power per go (road L45b): a go names its rite (`push` · `restart`), and the rite rides its head, its title
 * and the ward verb its co-sign answers under.
 *
 * A go that named no rite would let one record family serve two powers: a push go would spend as a restart. Every red pairs
 * with a CONTROL. Meme: lar:///ha.ka.ba/lares/docs/pono/seat-harness
 */
import { describe, expect, test } from "vitest";
import { ed25519SignerFromSeed, ed25519VerifyingKeyFromSeed } from "../src/ed25519-door.js";
import { WARD_COSIGN_VERBS, faceIntentVerbs } from "../src/intent-verbs.js";
import type { LarDoc } from "../src/base-doc.js";
import { swarmBoardRecords, writeSwarmBoardAct } from "../src/swarm-board.js";
import { swarmCommand, type SwarmDoorDeps } from "../src/swarm-door.js";
import { SWARM_GO_RITES, wardGoVerb } from "../src/swarm-go-rite.js";
import {
  SwarmRefused, putSwarmAct, readGo, readSwarmRecord, signSwarmAct, spendGo, swarmActCid, swarmGoHead, swarmGoRowTitle, swarmGoTitle, swarmReceiptTitle,
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
  /** A hand-signed go of one rite, at its own row; hands back the record and its cid. */
  const issue = async (rite: "push" | "restart") => {
    const go = await signSwarmAct({ act: "go", group: GROUP, rite, reach: "head", branch: BRANCH, head: HEAD, after: null }, hand);
    await putSwarmAct(wiki, swarmGoRowTitle(rite, BRANCH, swarmActCid(go)), go);
    return { go, cid: swarmActCid(go) };
  };
  // Every spend rests on a passing receipt for the head's tree (`go-reach.test.ts`); one stands here for each spend below.
  await putSwarmAct(wiki, swarmReceiptTitle(TREE), await signSwarmAct({ act: "receipt", group: GROUP, tree: TREE, checks: ["typecheck"], verdict: "pass", definitions: "d".repeat(64) }, vessel));
  return { hand, vessel, trust, wiki, issue };
}

describe("go-rite-separates-powers", () => {
  test("RED: a push go never satisfies a restart read, at the same branch and head; CONTROL: the push read finds it", async () => {
    const f = await fixture();
    await f.issue("push");
    expect(await readGo(f.wiki, { rite: "restart", branch: BRANCH, head: HEAD }, f.trust, GROUP, ONE_DEVICE)).toEqual({ ok: false, refusal: "absent" });
    expect(await readGo(f.wiki, { rite: "push", branch: BRANCH, head: HEAD }, f.trust, GROUP, ONE_DEVICE)).toMatchObject({ ok: true });
  });

  test("RED: the ward verbs differ, and each go's read asks its own: a witness that co-signed the push go alone leaves the restart go standing on no chain", async () => {
    const f = await fixture();
    await f.issue("push"); await f.issue("restart");
    expect(wardGoVerb("push")).toBe("ward-push-go");
    expect(wardGoVerb("restart")).toBe("ward-restart-go");
    const asked: WardCosignAct[] = [];
    const pushOnly = { accepts: (act: WardCosignAct) => { asked.push(act); return act.verb === "ward-push-go"; } };
    expect(await readGo(f.wiki, { rite: "push", branch: BRANCH, head: HEAD }, f.trust, GROUP, pushOnly)).toMatchObject({ ok: true });
    expect(await readGo(f.wiki, { rite: "restart", branch: BRANCH, head: HEAD }, f.trust, GROUP, pushOnly)).toEqual({ ok: false, refusal: "ward-act-uncosigned" });
    expect(asked.map((a) => a.verb)).toEqual(["ward-push-go", "ward-restart-go"]);
    // The head a co-sign names folds the rite in, so an answer to one never reads as an answer to the other.
    expect(asked[0]!.head).not.toBe(asked[1]!.head);
    expect(swarmGoHead({ rite: "push", reach: "head", branch: BRANCH, head: HEAD, after: null })).not.toBe(swarmGoHead({ rite: "restart", reach: "head", branch: BRANCH, head: HEAD, after: null }));
  });

  test("RED: a push go's bytes moved to the restart title read as misplaced; CONTROL: at its own title the go reads", async () => {
    const f = await fixture();
    const { go, cid } = await f.issue("push");
    expect(swarmGoTitle("push", BRANCH)).toBe("$:/lares/swarm/go/push/feature%2Fx");
    expect(swarmGoTitle("restart", BRANCH)).toBe("$:/lares/swarm/go/restart/feature%2Fx");
    const moved = swarmGoRowTitle("restart", BRANCH, cid);
    f.wiki.rows.set(moved, JSON.stringify(go));
    expect(await readSwarmRecord(f.wiki, moved, f.trust, GROUP)).toEqual({ ok: false, refusal: "title" });
    expect(await readGo(f.wiki, { rite: "restart", branch: BRANCH, head: HEAD }, f.trust, GROUP, ONE_DEVICE)).toEqual({ ok: false, refusal: "title" });
    expect(await readSwarmRecord(f.wiki, swarmGoRowTitle("push", BRANCH, cid), f.trust, GROUP)).toMatchObject({ ok: true });
  });

  test("RED: a push go never spends as a restart, and spending it leaves the restart go of the same head unspent; CONTROL: each spends once under its own rite", async () => {
    const f = await fixture();
    const push = await f.issue("push");
    await expect(spendGo(f.wiki, { rite: "restart", branch: BRANCH, head: HEAD, tree: TREE }, f.trust, GROUP, f.vessel, ONE_DEVICE)).rejects.toMatchObject({ code: "swarm-go-absent" });
    const restart = await f.issue("restart");
    expect(restart.cid).not.toBe(push.cid);
    await expect(spendGo(f.wiki, { rite: "push", branch: BRANCH, head: HEAD, tree: TREE }, f.trust, GROUP, f.vessel, ONE_DEVICE)).resolves.toEqual({ go: push.cid, reach: "head", n: 1 });
    expect(await readGo(f.wiki, { rite: "push", branch: BRANCH, head: HEAD }, f.trust, GROUP, ONE_DEVICE)).toEqual({ ok: false, refusal: "spent" });
    expect(await readGo(f.wiki, { rite: "restart", branch: BRANCH, head: HEAD }, f.trust, GROUP, ONE_DEVICE)).toMatchObject({ ok: true, cid: restart.cid });
    await expect(spendGo(f.wiki, { rite: "restart", branch: BRANCH, head: HEAD, tree: TREE }, f.trust, GROUP, f.vessel, ONE_DEVICE)).resolves.toEqual({ go: restart.cid, reach: "head", n: 1 });
    await expect(spendGo(f.wiki, { rite: "restart", branch: BRANCH, head: HEAD, tree: TREE }, f.trust, GROUP, f.vessel, ONE_DEVICE)).rejects.toMatchObject({ code: "swarm-go-spent" });
  });

  test("RED: the rite list holds two names, and a go of any other rite forms no record, no title and no ward verb; CONTROL: both rites register as co-signed ward verbs", async () => {
    const f = await fixture();
    expect([...SWARM_GO_RITES]).toEqual(["push", "restart"]);
    for (const rite of ["merge", "", "PUSH", "push/x", undefined]) {
      await expect(signSwarmAct({ act: "go", group: GROUP, rite, reach: "head", branch: BRANCH, head: HEAD, after: null } as unknown as SwarmBodyParts, f.hand), String(rite)).rejects.toMatchObject({ code: "swarm-shape" });
      expect(() => swarmGoTitle(rite as never, BRANCH), String(rite)).toThrow(SwarmRefused);
      await expect(readGo(f.wiki, { rite: rite as never, branch: BRANCH, head: HEAD }, f.trust, GROUP, ONE_DEVICE), String(rite)).rejects.toMatchObject({ code: "swarm-name-malformed" });
    }
    expect(WARD_COSIGN_VERBS).toEqual(["ward-kapae-lower", "ward-house-cap", "ward-push-go", "ward-restart-go"]);
    for (const rite of SWARM_GO_RITES) expect(faceIntentVerbs().classOfVerb(wardGoVerb(rite))).toEqual({ class: "single-effect", cosign: true });
  });
});

describe("the door issues a go under its rite", () => {
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

  test("RED: a go-issue that names no rite, or one outside the list, refuses `swarm-go-malformed` and writes nothing; CONTROL: a named rite lands under its own title", async () => {
    const s = await stand();
    for (const rite of [undefined, "merge", ""]) {
      await expect(swarmCommand({ action: "go-issue", rite, branch: BRANCH, head: HEAD, after: null } as never, s.deps), String(rite)).rejects.toMatchObject({ code: "swarm-go-malformed" });
    }
    expect([...s.wiki.rows.keys()]).toEqual([]);
    expect(await swarmCommand({ action: "go-issue", rite: "restart", reach: "head", branch: BRANCH, head: HEAD, after: null }, s.deps)).toEqual({ rite: "restart", branch: BRANCH, reach: "head", head: HEAD });
    expect([...s.wiki.rows.keys()].every((t) => t.startsWith(`${swarmGoTitle("restart", BRANCH)}/`))).toBe(true);
  });

  test("RED: a restart go the door issued shows standing for restart and absent for push, and each rite keeps its own chain; CONTROL: a push go issued beside it starts at null", async () => {
    const s = await stand();
    await swarmCommand({ action: "go-issue", rite: "restart", reach: "head", branch: BRANCH, head: HEAD, after: null }, s.deps);
    expect(await swarmCommand({ action: "show", rite: "restart", branch: BRANCH, head: HEAD }, s.deps)).toMatchObject({ go: { standing: true } });
    expect(await swarmCommand({ action: "show", rite: "push", branch: BRANCH, head: HEAD }, s.deps)).toMatchObject({ go: { standing: false, refusal: "absent", after: null } });
    await expect(swarmCommand({ action: "show", branch: BRANCH, head: HEAD } as never, s.deps)).rejects.toMatchObject({ code: "swarm-go-malformed" });
    // The push chain holds no go, so its first names no predecessor: the restart go never counts as the one it follows.
    await expect(swarmCommand({ action: "go-issue", rite: "push", reach: "head", branch: BRANCH, head: HEAD, after: null }, s.deps)).resolves.toEqual({ rite: "push", branch: BRANCH, reach: "head", head: HEAD });
    expect(await swarmCommand({ action: "show", rite: "push", branch: BRANCH, head: HEAD }, s.deps)).toMatchObject({ go: { standing: true } });
  });
});
