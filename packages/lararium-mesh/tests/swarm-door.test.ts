/**
 * swarm-door — the hand-only verbs over the swarm model: show, set the house cap, set a lane share, issue a go.
 *
 * Only a hand sets or issues (a seat refuses `swarm-needs-hand`), only the face's grant key signs (through `SwarmSignerPort`),
 * the sum law holds at the write, and with no standing daemon wiki every act refuses by name and writes nothing. Show reads and
 * is open to a seat. Every red pairs with a CONTROL. Meme: lar:///ha.ka.ba/lares/docs/pono/seat-harness
 */
import { describe, expect, test } from "vitest";
import type { LarDoc } from "../src/base-doc.js";
import { ed25519SignerFromSeed, ed25519VerifyingKeyFromSeed } from "../src/ed25519-door.js";
import { SWARM_VERB_HAND_CODES, swarmCommand, type SwarmDoorDeps } from "../src/swarm-door.js";
import { signSwarmCap, swarmBoardActCid, swarmBoardRecords, writeSwarmBoardAct, type SignedSwarmBoardAct } from "../src/swarm-board.js";
import { swarmActCid, swarmGoTitle, readGo, type SwarmWikiPort } from "../src/swarm-tiddlers.js";
import { cosignPortWitness } from "../src/ward-cosign-gate.js";
import { storedLarRecord } from "../src/stored-record.js";
import { soloCosign } from "./ward-cosign-table.js";

const GROUP = "face-group", HEAD = "a".repeat(40);
const keyed = async (n: number) => ({ key: await ed25519VerifyingKeyFromSeed(new Uint8Array(32).fill(n)), sign: ed25519SignerFromSeed(new Uint8Array(32).fill(n)) });

async function stand(over: Partial<SwarmDoorDeps> = {}) {
  const root = await keyed(1), outsider = await keyed(3);
  const doc = { tiddlers: {} } as LarDoc, rows = new Map<string, string>();
  const wiki: SwarmWikiPort = { read: async (t) => rows.get(t) ?? null, write: async (t, x) => { rows.set(t, x); }, writeNew: async (t, x) => (rows.has(t) ? false : (rows.set(t, x), true)) };
  const trust = { hand: (k: string) => k === root.key, vessel: () => false, lead: () => false };
  const deps: SwarmDoorDeps = {
    group: GROUP, face: { group: GROUP, grant: (k) => k === root.key }, signer: root, trust, epoch: () => 0, wiki,
    board: { records: async () => swarmBoardRecords(doc, GROUP), land: async (act) => { writeSwarmBoardAct(doc, act); } },
    who: { kind: "hand", id: root.key }, cosign: () => soloCosign(GROUP, root), ...over,
  };
  return { deps, doc, rows, wiki, trust, root, outsider };
}

describe("the hand sets the cap and the shares", () => {
  test("RED: cap-set then share-set land on the board and show reads them; CONTROL: a share re-set replaces its own lane", async () => {
    const s = await stand();
    await swarmCommand({ action: "cap-set", value: 10 }, s.deps);
    await swarmCommand({ action: "share-set", lane: "a", value: 6 }, s.deps);
    await swarmCommand({ action: "share-set", lane: "b", value: 4 }, s.deps);
    expect(await swarmCommand({ action: "show" }, s.deps)).toMatchObject({ cap: 10, shares: { a: 6, b: 4 }, ok: true });
    await swarmCommand({ action: "share-set", lane: "a", value: 2 }, s.deps);
    expect(await swarmCommand({ action: "show" }, s.deps)).toMatchObject({ cap: 10, shares: { a: 2, b: 4 } });
  });

  test("RED: the sum law holds at the write: a share past the cap, a cap under the shares, a share before any cap and a malformed value refuse by name; CONTROL: nothing landed for them", async () => {
    const s = await stand();
    await expect(swarmCommand({ action: "share-set", lane: "a", value: 1 }, s.deps)).rejects.toMatchObject({ code: "swarm-cap-unset" });
    await swarmCommand({ action: "cap-set", value: 10 }, s.deps);
    await swarmCommand({ action: "share-set", lane: "a", value: 6 }, s.deps);
    await expect(swarmCommand({ action: "share-set", lane: "b", value: 5 }, s.deps)).rejects.toMatchObject({ code: "swarm-share-over-cap" });
    await expect(swarmCommand({ action: "cap-set", value: 5 }, s.deps)).rejects.toMatchObject({ code: "swarm-cap-under-shares" });
    await expect(swarmCommand({ action: "cap-set", value: -1 }, s.deps)).rejects.toMatchObject({ code: "swarm-cap-malformed" });
    await expect(swarmCommand({ action: "share-set", lane: "", value: 1 }, s.deps)).rejects.toMatchObject({ code: "swarm-name-malformed" });
    expect(swarmBoardRecords(s.doc, GROUP)).toHaveLength(2);
  });

  test("RED: a board the sum law folds closed cannot be written open: a cap set under the raw shares refuses even while the reading shows zero shares; CONTROL: a cap that covers them lands", async () => {
    const s = await stand();
    await swarmCommand({ action: "cap-set", value: 10 }, s.deps);
    await swarmCommand({ action: "share-set", lane: "a", value: 6 }, s.deps);
    // a lower cap written straight onto the board, bypassing the door
    const capAct = (swarmBoardRecords(s.doc, GROUP) as SignedSwarmBoardAct[]).find((r) => r.body.act === "cap")!;
    writeSwarmBoardAct(s.doc, await signSwarmCap({ group: GROUP, epoch: 0, value: 3, parents: [swarmBoardActCid(capAct)] }, s.root));
    expect(await swarmCommand({ action: "show" }, s.deps)).toMatchObject({ cap: 3, ok: false, refusal: "swarm-shares-over-cap", shares: { a: 0 } });
    await expect(swarmCommand({ action: "cap-set", value: 5 }, s.deps)).rejects.toMatchObject({ code: "swarm-cap-under-shares" });
    await expect(swarmCommand({ action: "cap-set", value: 6 }, s.deps)).resolves.toMatchObject({ cap: 6 });
  });
});

describe("the hand issues a go", () => {
  test("RED: go-issue lands a hand-signed go that reads for its branch and head; CONTROL: a later issue, naming the go it follows, replaces it", async () => {
    const s = await stand();
    const out = await swarmCommand({ action: "go-issue", branch: "feature/x", head: HEAD, after: null }, s.deps);
    expect(out).toMatchObject({ branch: "feature/x", head: HEAD });
    expect(await readGo(s.wiki, { branch: "feature/x", head: HEAD }, s.trust, GROUP, cosignPortWitness(soloCosign(GROUP, s.root)))).toMatchObject({ ok: true });
    const first = s.rows.get(swarmGoTitle("feature/x"));
    const shown = await swarmCommand({ action: "show", branch: "feature/x", head: HEAD }, s.deps) as { go: { after: string } };
    expect(shown.go.after).toBe(swarmActCid(JSON.parse(first!)));
    await swarmCommand({ action: "go-issue", branch: "feature/x", head: HEAD, after: shown.go.after }, s.deps);
    expect(s.rows.get(swarmGoTitle("feature/x"))).not.toBe(first);
    expect(await swarmCommand({ action: "show", branch: "feature/x", head: HEAD }, s.deps)).toMatchObject({ go: { standing: true } });
  });

  test("RED: an issue naming a go that no longer stands there refuses `swarm-go-after-moved` and writes nothing; CONTROL: naming the standing one lands", async () => {
    const s = await stand();
    await swarmCommand({ action: "go-issue", branch: "feature/x", head: HEAD, after: null }, s.deps);
    const first = s.rows.get(swarmGoTitle("feature/x"));
    await expect(swarmCommand({ action: "go-issue", branch: "feature/x", head: "b".repeat(40), after: null }, s.deps)).rejects.toMatchObject({ code: "swarm-go-after-moved" });
    expect(s.rows.get(swarmGoTitle("feature/x"))).toBe(first);
    await swarmCommand({ action: "go-issue", branch: "feature/x", head: "b".repeat(40), after: swarmActCid(JSON.parse(first!)) }, s.deps);
    expect(s.rows.get(swarmGoTitle("feature/x"))).not.toBe(first);
  });

  test("RED: a go with no head, an empty branch, or no `after` (or one that names no cid) refuses; CONTROL: show of an unissued branch reads not standing", async () => {
    const s = await stand();
    await expect(swarmCommand({ action: "go-issue", branch: "feature/x", after: null } as never, s.deps)).rejects.toMatchObject({ code: "swarm-go-malformed" });
    await expect(swarmCommand({ action: "go-issue", branch: "", head: HEAD, after: null }, s.deps)).rejects.toMatchObject({ code: "swarm-go-malformed" });
    await expect(swarmCommand({ action: "go-issue", branch: "feature/x", head: HEAD } as never, s.deps)).rejects.toMatchObject({ code: "swarm-go-malformed" });
    await expect(swarmCommand({ action: "go-issue", branch: "feature/x", head: HEAD, after: "not-a-cid" }, s.deps)).rejects.toMatchObject({ code: "swarm-go-malformed" });
    expect(s.rows.size).toBe(0);
    expect(await swarmCommand({ action: "show", branch: "nope", head: HEAD }, s.deps)).toMatchObject({ go: { standing: false, refusal: "absent", after: null } });
  });
});

describe("hand, grant and the standing daemon", () => {
  test("RED: a seat sets, issues nothing: each mutating action refuses `swarm-needs-hand` and writes nothing; CONTROL: a seat reads show", async () => {
    const s = await stand({ who: { kind: "seat", id: "lead-a" } });
    for (const req of [{ action: "cap-set", value: 1 }, { action: "share-set", lane: "a", value: 1 }, { action: "go-issue", branch: "b", head: HEAD, after: null }] as const) {
      await expect(swarmCommand(req, s.deps), req.action).rejects.toMatchObject({ code: "swarm-needs-hand" });
    }
    expect(swarmBoardRecords(s.doc, GROUP)).toHaveLength(0);
    expect(s.rows.size).toBe(0);
    expect(await swarmCommand({ action: "show" }, s.deps)).toMatchObject({ cap: null, ok: true });
  });

  test("RED: a signer the face never granted refuses `swarm-signer-not-grant`; CONTROL: the granted signer lands", async () => {
    const s = await stand();
    const bad = await stand({});
    await expect(swarmCommand({ action: "cap-set", value: 1 }, { ...bad.deps, signer: s.outsider })).rejects.toMatchObject({ code: "swarm-signer-not-grant" });
    await expect(swarmCommand({ action: "cap-set", value: 1 }, s.deps)).resolves.toMatchObject({ cap: 1 });
  });

  test("RED: with no standing daemon wiki every action refuses by name and writes nothing; CONTROL: the same request lands once the wiki stands", async () => {
    const { wiki: _wiki, ...bare } = (await stand()).deps;
    const doc = { tiddlers: {} } as LarDoc;
    const noWiki = { ...bare, board: { records: async () => [], land: async (act: never) => { writeSwarmBoardAct(doc, act); } } } as SwarmDoorDeps;
    for (const req of [{ action: "show" }, { action: "cap-set", value: 1 }, { action: "share-set", lane: "a", value: 1 }, { action: "go-issue", branch: "b", head: HEAD, after: null }] as const) {
      await expect(swarmCommand(req, noWiki), req.action).rejects.toMatchObject({ code: "swarm-no-daemon", message: expect.stringContaining("no standing daemon: swarm controls need the founded wiki") });
    }
    expect(swarmBoardRecords(doc, GROUP)).toHaveLength(0);
    await expect(swarmCommand({ action: "cap-set", value: 1 }, (await stand()).deps)).resolves.toMatchObject({ cap: 1 });
  });

  test("RED: the hand codes name the three mutating verbs and leave show open; CONTROL: every code reads swarm-needs-hand", () => {
    expect(SWARM_VERB_HAND_CODES).toEqual({ "swarm-cap-set": "swarm-needs-hand", "swarm-share-set": "swarm-needs-hand", "swarm-go-issue": "swarm-needs-hand" });
    expect(Object.hasOwn(SWARM_VERB_HAND_CODES, "swarm-show")).toBe(false);
  });
});

describe("an unavailable line refuses by name (S1 cold read, P2-2)", () => {
  test("RED: a cap line citing a missing parent shows unavailable with its reason, and cap-set refuses; CONTROL: a hand's supersede starts a new line that reads its value", async () => {
    const s = await stand();
    writeSwarmBoardAct(s.doc, await signSwarmCap({ group: GROUP, epoch: 0, value: 9, parents: ["e".repeat(64)] }, s.root));
    const shown = await swarmCommand({ action: "show" }, s.deps);
    expect(shown).toMatchObject({ ok: false, unavailable: { cap: "parent-missing" } });
    await expect(swarmCommand({ action: "cap-set", value: 10 }, s.deps)).rejects.toMatchObject({ code: "swarm-line-unavailable" });
    await swarmCommand({ action: "cap-set", value: 10, supersede: true }, s.deps);
    expect(await swarmCommand({ action: "show" }, s.deps)).toMatchObject({ cap: 10, ok: true });
    await swarmCommand({ action: "cap-set", value: 12 }, s.deps);
    expect(await swarmCommand({ action: "show" }, s.deps)).toMatchObject({ cap: 12 });
  });

  test("RED: a share line citing a missing parent refuses share-set; a seat's supersede refuses; CONTROL: the hand's supersede lands", async () => {
    const s = await stand();
    await swarmCommand({ action: "cap-set", value: 10 }, s.deps);
    const { signSwarmShare } = await import("../src/swarm-board.js");
    writeSwarmBoardAct(s.doc, await signSwarmShare({ group: GROUP, epoch: 0, lane: "a", value: 2, parents: ["f".repeat(64)] }, s.root));
    expect(await swarmCommand({ action: "show" }, s.deps)).toMatchObject({ unavailable: { shares: { a: "parent-missing" } } });
    await expect(swarmCommand({ action: "share-set", lane: "a", value: 3 }, s.deps)).rejects.toMatchObject({ code: "swarm-line-unavailable" });
    await expect(swarmCommand({ action: "share-set", lane: "a", value: 3, supersede: true }, { ...s.deps, who: { kind: "seat", id: "x" } })).rejects.toMatchObject({ code: "swarm-needs-hand" });
    await swarmCommand({ action: "share-set", lane: "a", value: 3, supersede: true }, s.deps);
    expect(await swarmCommand({ action: "show" }, s.deps)).toMatchObject({ shares: { a: 3 } });
  });

  test("RED: a torn record on the board enters refused; CONTROL: the whole records still read", async () => {
    const s = await stand();
    await swarmCommand({ action: "cap-set", value: 10 }, s.deps);
    const key = `lar:///ha.ka.ba/dreamnet/swarm-act/${encodeURIComponent(GROUP)}/${"9".repeat(64)}`;
    (s.doc.tiddlers as Record<string, unknown>)[key] = storedLarRecord(key, { text: "{torn" }, "9".repeat(64));
    const shown = await swarmCommand({ action: "show" }, s.deps);
    expect(shown).toMatchObject({ cap: 10, refused: 1 });
  });
});
