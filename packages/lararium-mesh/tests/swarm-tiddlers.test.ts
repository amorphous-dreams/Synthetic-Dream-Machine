/**
 * swarm-tiddlers — the swarm's live controls as signed records in the daemon wiki: the titles, the `swarm-act` signing domain, the
 * share sum law, a go that binds branch and head and is spent once, and a verify-on-read that fails closed.
 *
 * Each record names who may sign it: the face's hand (go), the vessel as witness (roster, receipt, a go's spend), the lead under its
 * own seat name (lane state). A record that fails any check reads as ABSENT for the caller's purpose, never as a softer grant.
 * Every red pairs with a CONTROL. Meme: lar:///ha.ka.ba/lares/docs/pono/seat-harness
 */
import { describe, expect, test } from "vitest";
import { ed25519SignerFromSeed, ed25519VerifyingKeyFromSeed } from "../src/ed25519-door.js";
import { PROMOTE_ACT_DOMAIN, SWARM_ACT_DOMAIN } from "../src/domains.js";
import { canonicalJsonBytes } from "../src/crypto.js";
import {
  SwarmRefused, putSwarmAct, readGo, readSwarmRecord, signSwarmAct, spendGo, swarmCapRefusal, swarmGoSpentTitle, swarmGoTitle, swarmHouseCapTitle,
  swarmLaneStateTitle, swarmReceiptTitle, swarmRecordFields, swarmRosterTitle, swarmShareRefusal, swarmShareTitle, SWARM_URI_PREFIX,
  type SwarmWikiPort,
} from "../src/swarm-tiddlers.js";

const GROUP = "face-group", HEAD = "a".repeat(40), TREE = "b".repeat(40);
const keyed = async (n: number) => ({ key: await ed25519VerifyingKeyFromSeed(new Uint8Array(32).fill(n)), sign: ed25519SignerFromSeed(new Uint8Array(32).fill(n)) });

function wikiPort(): SwarmWikiPort & { rows: Map<string, string> } {
  const rows = new Map<string, string>();
  return { rows, read: async (t) => rows.get(t) ?? null, write: async (t, text) => { rows.set(t, text); }, writeNew: async (t, text) => { if (rows.has(t)) return false; rows.set(t, text); return true; } };
}

/** A face of one device: a go reads on its own (the co-sign witness answers yes, as `wardActWitness` does for one device). */
const ONE_DEVICE = { accepts: () => true };

async function fixture() {
  const hand = await keyed(1), vessel = await keyed(2), lead = await keyed(3), outsider = await keyed(4);
  const trust = { hand: (k: string) => k === hand.key, vessel: (k: string) => k === vessel.key, lead: (seat: string, lane: string, k: string) => seat === "lead-a" && lane === "lane-a" && k === lead.key };
  const goBody = (over: Record<string, unknown> = {}) => ({ group: GROUP, branch: "feature/x", head: HEAD, after: null, ...over });
  return { hand, vessel, lead, outsider, trust, wiki: wikiPort(), goBody };
}

describe("the titles and the signing domain", () => {
  test("RED: every title rests under the swarm prefix, a name escapes as one segment, and the signing domain is its own minted name; CONTROL: a dot name refuses", () => {
    for (const t of [swarmHouseCapTitle(), swarmShareTitle("lane-a"), swarmGoTitle("feature/x"), swarmLaneStateTitle("lane-a"), swarmRosterTitle("seat-1"), swarmReceiptTitle(TREE), swarmGoSpentTitle("c".repeat(64))]) expect(t.startsWith(SWARM_URI_PREFIX), t).toBe(true);
    expect(swarmGoTitle("feature/x")).toBe("$:/lares/swarm/go/feature%2Fx");
    expect(swarmShareTitle("lane-a")).toBe("$:/lares/swarm/lane/lane-a/share");
    expect(SWARM_ACT_DOMAIN).not.toBe(PROMOTE_ACT_DOMAIN);
    expect(SWARM_ACT_DOMAIN.endsWith("/swarm-act")).toBe(true);
    for (const bad of ["", ".", "..", "a\u0000b"]) expect(() => swarmGoTitle(bad), JSON.stringify(bad)).toThrow(SwarmRefused);
  });

  test("RED: a swarm record carries disk-projection no; CONTROL: the fields hold the text and nothing that projects", () => {
    expect(swarmRecordFields("{}")).toEqual({ text: "{}", "disk-projection": "no" });
  });
});

describe("the sum law", () => {
  test("RED: a share past the house cap refuses, and a cap under the shares refuses; CONTROL: shares that sum to the cap stand, a re-set replaces its own lane", () => {
    expect(swarmShareRefusal(10, new Map([["a", 6]]), "b", 5)).toBe("swarm-share-over-cap");
    expect(swarmCapRefusal(10, new Map([["a", 6], ["b", 5]]))).toBe("swarm-cap-under-shares");
    expect(swarmShareRefusal(10, new Map([["a", 6]]), "b", 4)).toBeNull();
    expect(swarmShareRefusal(10, new Map([["a", 6], ["b", 4]]), "b", 4)).toBeNull();
    expect(swarmShareRefusal(10, new Map([["a", 10]]), "a", 10)).toBeNull();
    expect(swarmCapRefusal(11, new Map([["a", 6], ["b", 5]]))).toBeNull();
  });

  test("RED: no cap, a negative, a fractional or a non-number share or cap refuses; CONTROL: zero stands", () => {
    expect(swarmShareRefusal(null, new Map(), "a", 1)).toBe("swarm-cap-unset");
    for (const bad of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, "3" as unknown as number]) {
      expect(swarmShareRefusal(10, new Map(), "a", bad), String(bad)).toBe("swarm-share-malformed");
      expect(swarmCapRefusal(bad, new Map()), String(bad)).toBe("swarm-cap-malformed");
    }
    expect(swarmShareRefusal(10, new Map(), "a", 0)).toBeNull();
    expect(swarmCapRefusal(0, new Map())).toBeNull();
  });
});

describe("verify-on-read fails closed", () => {
  test("CONTROL: a hand-signed go, a vessel-signed roster and receipt, and a lead-signed lane state each read", async () => {
    const f = await fixture();
    const go = await signSwarmAct({ act: "go", ...f.goBody() }, f.hand);
    const roster = await signSwarmAct({ act: "roster", group: GROUP, seat: "seat-1", model: "gpt-5.3-codex", mode: "build", reading: 10, ceiling: 100, outcome: "running" }, f.vessel);
    const receipt = await signSwarmAct({ act: "receipt", group: GROUP, tree: TREE, checks: ["typecheck"], verdict: "pass", definitions: "d".repeat(64) }, f.vessel);
    const state = await signSwarmAct({ act: "lane-state", group: GROUP, lane: "lane-a", seat: "lead-a", state: { phase: "build" } }, f.lead);
    for (const [title, act] of [[swarmGoTitle("feature/x"), go], [swarmRosterTitle("seat-1"), roster], [swarmReceiptTitle(TREE), receipt], [swarmLaneStateTitle("lane-a"), state]] as const) {
      await putSwarmAct(f.wiki, title, act);
      expect(await readSwarmRecord(f.wiki, title, f.trust, GROUP), title).toMatchObject({ ok: true });
    }
  });

  test("RED: a roster the measured lead signed, a go the vessel signed, a lane state under another seat's name and a record from an outsider each read as refused `role`; CONTROL: the right signer reads", async () => {
    const f = await fixture();
    const roster = { act: "roster", group: GROUP, seat: "lead-a", model: "m", mode: "build", reading: 1, ceiling: 2, outcome: "running" } as const;
    const cases = [
      [swarmRosterTitle("lead-a"), await signSwarmAct(roster, f.lead)],
      [swarmGoTitle("feature/x"), await signSwarmAct({ act: "go", ...f.goBody() }, f.vessel)],
      [swarmLaneStateTitle("lane-b"), await signSwarmAct({ act: "lane-state", group: GROUP, lane: "lane-b", seat: "lead-b", state: {} }, f.lead)],
      [swarmReceiptTitle(TREE), await signSwarmAct({ act: "receipt", group: GROUP, tree: TREE, checks: [], verdict: "pass", definitions: "d".repeat(64) }, f.outsider)],
    ] as const;
    for (const [title, act] of cases) { await putSwarmAct(f.wiki, title, act); expect(await readSwarmRecord(f.wiki, title, f.trust, GROUP), title).toEqual({ ok: false, refusal: "role" }); }
    await putSwarmAct(f.wiki, swarmRosterTitle("lead-a"), await signSwarmAct(roster, f.vessel));
    expect(await readSwarmRecord(f.wiki, swarmRosterTitle("lead-a"), f.trust, GROUP)).toMatchObject({ ok: true });
  });

  test("RED: a tampered body, a torn text, an absent title, another face's record and a record at another act's title each refuse by name; CONTROL: the untouched record reads", async () => {
    const f = await fixture();
    const title = swarmGoTitle("feature/x");
    const good = await signSwarmAct({ act: "go", ...f.goBody() }, f.hand);
    await putSwarmAct(f.wiki, title, good);
    expect(await readSwarmRecord(f.wiki, title, f.trust, GROUP)).toMatchObject({ ok: true });
    f.wiki.rows.set(title, JSON.stringify({ ...good, body: { ...good.body, head: "c".repeat(40) } }));
    expect(await readSwarmRecord(f.wiki, title, f.trust, GROUP)).toEqual({ ok: false, refusal: "signature" });
    f.wiki.rows.set(title, "{not json");
    expect(await readSwarmRecord(f.wiki, title, f.trust, GROUP)).toEqual({ ok: false, refusal: "shape" });
    expect(await readSwarmRecord(f.wiki, swarmGoTitle("absent"), f.trust, GROUP)).toEqual({ ok: false, refusal: "absent" });
    await putSwarmAct(f.wiki, title, good);
    expect(await readSwarmRecord(f.wiki, title, f.trust, "other-group")).toEqual({ ok: false, refusal: "group" });
    f.wiki.rows.set(swarmGoTitle("other"), JSON.stringify(good));
    expect(await readSwarmRecord(f.wiki, swarmGoTitle("other"), f.trust, GROUP)).toEqual({ ok: false, refusal: "title" });
    const foreign = { ...good, body: { ...good.body, kind: PROMOTE_ACT_DOMAIN } };
    f.wiki.rows.set(title, JSON.stringify(foreign));
    expect(await readSwarmRecord(f.wiki, title, f.trust, GROUP)).toEqual({ ok: false, refusal: "domain" });
  });

  test("RED: a signature over the body without the swarm domain refuses; CONTROL: signing through signSwarmAct reads", async () => {
    const f = await fixture();
    const body = { kind: SWARM_ACT_DOMAIN, act: "go", ...f.goBody() };
    const act = { body, signer: f.hand.key, sig: await f.hand.sign(canonicalJsonBytes({ ...body, kind: "other" })) };
    f.wiki.rows.set(swarmGoTitle("feature/x"), JSON.stringify(act));
    expect(await readSwarmRecord(f.wiki, swarmGoTitle("feature/x"), f.trust, GROUP)).toEqual({ ok: false, refusal: "signature" });
  });
});

describe("a go binds branch and head and is spent once", () => {
  const issue = async (f: Awaited<ReturnType<typeof fixture>>, over: Record<string, unknown> = {}) => putSwarmAct(f.wiki, swarmGoTitle("feature/x"), await signSwarmAct({ act: "go", ...f.goBody(over) }, f.hand));

  test("RED: a go reads for its branch and head only; CONTROL: the named head reads", async () => {
    const f = await fixture();
    await issue(f);
    expect(await readGo(f.wiki, { branch: "feature/x", head: "c".repeat(40) }, f.trust, GROUP, ONE_DEVICE)).toEqual({ ok: false, refusal: "head-mismatch" });
    expect(await readGo(f.wiki, { branch: "feature/y", head: HEAD }, f.trust, GROUP, ONE_DEVICE)).toEqual({ ok: false, refusal: "absent" });
    expect(await readGo(f.wiki, { branch: "feature/x", head: HEAD }, f.trust, GROUP, ONE_DEVICE)).toMatchObject({ ok: true });
  });

  test("RED: the second spend of one go refuses `swarm-go-spent`, and the spent go no longer reads; CONTROL: the first spend lands a vessel-signed record", async () => {
    const f = await fixture();
    await issue(f);
    const spent = await spendGo(f.wiki, { branch: "feature/x", head: HEAD }, f.trust, GROUP, f.vessel, ONE_DEVICE);
    expect(await readSwarmRecord(f.wiki, swarmGoSpentTitle(spent.go), f.trust, GROUP)).toMatchObject({ ok: true });
    await expect(spendGo(f.wiki, { branch: "feature/x", head: HEAD }, f.trust, GROUP, f.vessel, ONE_DEVICE)).rejects.toMatchObject({ code: "swarm-go-spent" });
    expect(await readGo(f.wiki, { branch: "feature/x", head: HEAD }, f.trust, GROUP, ONE_DEVICE)).toEqual({ ok: false, refusal: "spent" });
  });

  test("RED: two spends racing past the read land exactly one; CONTROL: a freshly issued go (one that follows another) spends again", async () => {
    const f = await fixture();
    await issue(f);
    const results = await Promise.allSettled([1, 2, 3].map(() => spendGo(f.wiki, { branch: "feature/x", head: HEAD }, f.trust, GROUP, f.vessel, ONE_DEVICE)));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    await issue(f, { after: "2".repeat(64) });
    await expect(spendGo(f.wiki, { branch: "feature/x", head: HEAD }, f.trust, GROUP, f.vessel, ONE_DEVICE)).resolves.toMatchObject({ go: expect.any(String) });
  });

  test("RED: a spend refuses an unsigned, mis-signed or absent go and the spender must be the vessel; CONTROL: the failed spends wrote nothing", async () => {
    const f = await fixture();
    await expect(spendGo(f.wiki, { branch: "feature/x", head: HEAD }, f.trust, GROUP, f.vessel, ONE_DEVICE)).rejects.toMatchObject({ code: "swarm-go-absent" });
    await putSwarmAct(f.wiki, swarmGoTitle("feature/x"), await signSwarmAct({ act: "go", ...f.goBody() }, f.outsider));
    await expect(spendGo(f.wiki, { branch: "feature/x", head: HEAD }, f.trust, GROUP, f.vessel, ONE_DEVICE)).rejects.toMatchObject({ code: "swarm-go-role" });
    await issue(f);
    await expect(spendGo(f.wiki, { branch: "feature/x", head: HEAD }, f.trust, GROUP, f.outsider, ONE_DEVICE)).rejects.toMatchObject({ code: "swarm-spend-role" });
    expect([...f.wiki.rows.keys()].filter((k) => k.includes("go-spent"))).toEqual([]);
  });
});

describe("a name escapes no segment (S1 cold read, P2-1)", () => {
  test("RED: a branch that decodes to a dot, empty or dot-dot segment refuses, and so does one git refuses as a ref; CONTROL: an honest branch with slashes stands under the prefix", () => {
    for (const bad of ["a/../../../x", "../x", "a/./b", "a//b", "/a", "a/", "%2e%2e", "a/%2e%2e/b", "feature..x", ".hidden", "a/.b", "x.lock", "a.lock/b", "x.", "a@{b", "@", "a b", "a~b", "a^b", "a:b", "a?b", "a*b", "a[b", "a\\b"]) {
      expect(() => swarmGoTitle(bad), JSON.stringify(bad)).toThrow(SwarmRefused);
    }
    for (const good of ["feature/x", "feature/green-jello-dinosaur-5--row7-s2", "main", "v1.2"]) expect(swarmGoTitle(good).startsWith(SWARM_URI_PREFIX), good).toBe(true);
  });

  test("RED: a one-segment name (lane, seat, tree, a spend cid) refuses a slash and every dot spelling; CONTROL: a plain name stands", () => {
    for (const make of [swarmShareTitle, swarmLaneStateTitle, swarmRosterTitle, swarmReceiptTitle, swarmGoSpentTitle]) {
      for (const bad of ["a/b", "..", "%2e%2e", "a%2Fb", "%2F"]) expect(() => make(bad), `${make.name} ${bad}`).toThrow(SwarmRefused);
      expect(make("lane-a").startsWith(SWARM_URI_PREFIX)).toBe(true);
    }
  });
});

describe("a lead's trust binds its lane (S1 cold read, P2-3)", () => {
  test("RED: a lead's key signing another lane's state refuses by role; CONTROL: its own lane reads", async () => {
    const hand = await keyed(1), lead = await keyed(3);
    const trust = { hand: (k: string) => k === hand.key, vessel: () => false, lead: (seat: string, lane: string, k: string) => seat === "lead-a" && lane === "lane-a" && k === lead.key };
    const wiki = wikiPort();
    const other = await signSwarmAct({ act: "lane-state", group: GROUP, lane: "lane-b", seat: "lead-a", state: { phase: "build" } }, lead);
    await putSwarmAct(wiki, swarmLaneStateTitle("lane-b"), other);
    expect(await readSwarmRecord(wiki, swarmLaneStateTitle("lane-b"), trust, GROUP)).toEqual({ ok: false, refusal: "role" });
    const own = await signSwarmAct({ act: "lane-state", group: GROUP, lane: "lane-a", seat: "lead-a", state: { phase: "build" } }, lead);
    await putSwarmAct(wiki, swarmLaneStateTitle("lane-a"), own);
    expect(await readSwarmRecord(wiki, swarmLaneStateTitle("lane-a"), trust, GROUP)).toMatchObject({ ok: true });
  });
});
