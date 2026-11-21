/**
 * rite-verbs — the store door names the rite's rows (road L45d): `rite-begin` returns the rite's lei and rests the guest half of
 * its tessera, `rite-land` rests the host half, `rite-receipts` lists the halves and runs conferre. Each acts as a face; none
 * reads hand-only, since the lei carries the grant; with no standing daemon wiki each refuses by name before it loads a face.
 * Every red pairs with a CONTROL. Meme: lar:///ha.ka.ba/lares/docs/pono/seat-harness
 */
import { expect, test } from "vitest";
import { STORE_DOOR_FACE_VERBS, STORE_DOOR_HAND_ONLY_ACTS, STORE_DOOR_VERBS, storeDoorReactors, type StoreDoorDeps } from "../src/store-door-verbs.js";
import { storeVerbGatesFirst, storeVerbNeedsWard } from "../src/ward-credential.js";
import { acceptAbandons, beginLentFaces, lentOfferFaces, offerVouchesOf, ownAbandonParts, refuseStandingBegin, signedMatchesTerms, standingKukuluBegins } from "../src/commands/rite.js";
import { kukuluRiteOver } from "../src/kukulu-lei-seat.js";
import { runHandVerb } from "../src/pulama-verbs.js";
import {
  SwarmRefused, abandonRites, beginChecked, checkReturn, conferre, landRite, pendingBegins, ed25519SignerFromSeed, ed25519VerifyingKeyFromSeed, signSwarmAct, swarmActCid, swarmLeiRecordTitle, swarmLeiReturnedPrefix, swarmLeiReturnedTitle,
  type SwarmTrust, type SwarmWikiPort,
} from "@lararium/mesh";

const ROWS = ["rite-begin", "rite-land", "rite-receipts", "rite-offer"] as const;

test("RED: every rite row is a store-door verb, each acting as a face; CONTROL: a seat may run each, and none asks a ward route", () => {
  for (const row of ROWS) {
    expect(STORE_DOOR_VERBS as readonly string[], row).toContain(row);
    expect(STORE_DOOR_FACE_VERBS.has(row as never), row).toBe(true);
    // The lei carries the grant: the hand strung it (a ward act), and the rite spends it.
    expect(STORE_DOOR_HAND_ONLY_ACTS.has(row), row).toBe(false);
    expect(storeVerbNeedsWard(row, {}), row).toBe(false);
    expect(storeVerbGatesFirst(row), row).toBe(false);
  }
});

test("RED: with no standing daemon wiki every rite row refuses by name and loads no face; CONTROL: the refusal rides the row's own name", async () => {
  const deps: StoreDoorDeps = { storageDir: "/tmp/unused", sealHome: "/tmp/unused-seal", repo: {} as StoreDoorDeps["repo"] };
  const rows = storeDoorReactors(deps);
  const worn = { worn: { ordinal: 0 } } as never;
  for (const [row, args] of [["rite-begin", { rite: "kukulu", branch: "main", head: "a".repeat(40) }], ["rite-land", { tessera: "c".repeat(64), head: "a".repeat(40) }], ["rite-receipts", {}]] as const) {
    const out = await rows[row](args, worn);
    expect(out["refused"], row).toContain("no standing daemon: a rite's records need the founded wiki");
    expect(out["refusal"], row).toBe(`${row}-refused`);
  }
});

test("RED: the offer gathers every lent face's line, one face each in the lend's order and named by ordinal; CONTROL: no lent face, or a face whose log reads unloadable, refuses by name", async () => {
  const loaded: number[] = [];
  const face = async (ordinal: number) => { loaded.push(ordinal); if (ordinal === 5) throw new Error("no log"); return { group: `g${ordinal}`, trust: { hand: () => true, vessel: () => true, lead: () => false }, ward: { accepts: () => true } }; };
  const faces = await lentOfferFaces([0, 2], face);
  expect(loaded).toEqual([0, 2]);
  expect(faces.map((f) => [f.name, f.group])).toEqual([["h0", "g0"], ["h2", "g2"]]);
  await expect(lentOfferFaces([], face)).rejects.toMatchObject({ code: "lent-faces-empty" });
  await expect(lentOfferFaces([0, 5], face)).rejects.toMatchObject({ code: "face-log-unreadable", message: expect.stringContaining("h5") });
});

test("RED: a kūkulu checks every lent face before it begins any, each spending that face's own lei; a face whose lei is missing waits by name; CONTROL: every face waiting refuses by the lei's reading, another reading refuses the whole begin naming that face with nothing begun, and no lent face refuses", async () => {
  let began: number[] = [];
  const check = (missing: readonly number[], other: number | null = null) => async (ordinal: number) => {
    if (ordinal === other) throw new SwarmRefused("swarm-lei-returned", "spent");
    if (missing.includes(ordinal)) throw new SwarmRefused("swarm-lei-absent", `no lei of h${ordinal}`);
    return ordinal;
  };
  const begin = async (ordinal: number) => { began.push(ordinal); return { tessera: String(ordinal).repeat(64), lei: "l", n: 1, begun: "b" }; };
  expect(await beginLentFaces([0, 1, 2], check([1]), begin)).toEqual({
    rite: "kukulu", faces: [{ face: "h0", ordinal: 0, tessera: "0".repeat(64), lei: "l", n: 1, begun: "b" }, { face: "h2", ordinal: 2, tessera: "2".repeat(64), lei: "l", n: 1, begun: "b" }], waits: ["h1"],
  });
  expect(began).toEqual([0, 2]);
  began = [];
  await expect(beginLentFaces([0, 1], check([0, 1]), begin)).rejects.toMatchObject({ code: "swarm-lei-absent", message: expect.stringContaining("h0, h1") });
  await expect(beginLentFaces([0, 1, 2], check([], 1), begin)).rejects.toMatchObject({ code: "swarm-lei-returned", message: expect.stringContaining("h1") });
  await expect(beginLentFaces([], check([]), begin)).rejects.toMatchObject({ code: "lent-faces-empty" });
  expect(began).toEqual([]);
});

/**
 * THE SEAM, measured live on a three-face house: the kukulu lei the hand signed stands as the operator's consent, so each lent
 * face's begin spends one return of its own lei and rests its guest half with no receipt on the shared swarm wiki. The restand's
 * tessera par stays the after-the-fact verdict.
 */
test("RED: three lent faces each hold a kukulu lei and no receipt stands for the tree: the kūkulu begin spends one return per face and rests three guest halves; CONTROL: an exhausted lei still refuses", async () => {
  const keyed = async (n: number) => ({ key: await ed25519VerifyingKeyFromSeed(new Uint8Array(32).fill(n)), sign: ed25519SignerFromSeed(new Uint8Array(32).fill(n)) });
  const house = async () => {
    const rows = new Map<string, string>();
    const wiki: SwarmWikiPort = { read: async (t) => rows.get(t) ?? null, write: async (t, x) => { rows.set(t, x); }, writeNew: async (t, x) => (rows.has(t) ? false : (rows.set(t, x), true)),
      list: async (prefix) => [...rows.keys()].filter((t) => t.startsWith(prefix)) };
    const faces: { group: string; trust: SwarmTrust; atom: Awaited<ReturnType<typeof keyed>>; lei: string }[] = [];
    for (const ordinal of [0, 1, 2]) {
      const group = `face-group-${ordinal}`, hand = await keyed(10 + ordinal), atom = await keyed(20 + ordinal);
      const trust: SwarmTrust = { hand: (k) => k === hand.key, vessel: (k) => k === atom.key, lead: () => false };
      const lei = await signSwarmAct({ act: "lei", group, rite: "kukulu", branch: "develop", after: null, reach: "wide", returns: 2 }, hand);
      await wiki.write(swarmLeiRecordTitle("kukulu", "develop", swarmActCid(lei)), JSON.stringify(lei));
      faces.push({ group, trust, atom, lei: swarmActCid(lei) });
    }
    const at = { rite: "kukulu" as const, branch: "develop", head: "a".repeat(40), tree: "b".repeat(40) };
    const check = (ordinal: number) => checkReturn(wiki, at, faces[ordinal]!.trust, faces[ordinal]!.group, faces[ordinal]!.atom, { accepts: () => true });
    const kukulu = (lent: readonly number[] = [0, 1, 2]) => beginLentFaces(lent, check, (c) => beginChecked(wiki, c));
    const claimed = () => faces.map((f) => [...rows.keys()].filter((t) => t.startsWith(swarmLeiReturnedPrefix(f.lei))).length);
    const guests = () => [...rows.keys()].filter((t) => t.endsWith("/guest")).length;
    return { rows, faces, kukulu, claimed, guests };
  };
  const h = await house();
  const begun = await h.kukulu();
  expect(begun.waits).toEqual([]);
  expect(begun.faces.map((f) => [f.face, f.lei, f.n])).toEqual(h.faces.map((f, i) => [`h${i}`, f.lei, 1]));
  expect([h.claimed(), h.guests()]).toEqual([[1, 1, 1], 3]);
  // RED: h2's returns ran out, so the begin refuses naming h2 and claims no face's return nor rests any guest half.
  const spent = await house();
  for (const n of [1, 2]) spent.rows.set(swarmLeiReturnedTitle(spent.faces[2]!.lei, n), "{}");
  await expect(spent.kukulu()).rejects.toMatchObject({ code: "swarm-lei-returns-spent", message: expect.stringContaining("h2") });
  expect([spent.claimed(), spent.guests()]).toEqual([[0, 0, 2], 0]);
  // CONTROL: a face with no lei of its own waits by name, and the others claim.
  const absent = await house();
  for (const t of [...absent.rows.keys()]) if (t === swarmLeiRecordTitle("kukulu", "develop", absent.faces[1]!.lei)) absent.rows.delete(t);
  expect((await absent.kukulu()).waits).toEqual(["h1"]);
  expect([absent.claimed(), absent.guests()]).toEqual([[1, 0, 1], 2]);
});

/**
 * ONE BEGIN PER RAISE (gate 2, beta-release-zero): a kūkulu begun and never landed (a Ctrl+C at the census, the light or the
 * admit) reads as each lent face's guest half standing unlanded on its line, and a second begin spends nothing more.
 */
test("RED: a kūkulu begun and never landed reads each lent face's guest half standing on its line, and a second begin refuses `rite-begun-stands` before any return is claimed; CONTROL: a landed face reads nothing standing, and another line reads none", async () => {
  const keyed = async (n: number) => ({ key: await ed25519VerifyingKeyFromSeed(new Uint8Array(32).fill(n)), sign: ed25519SignerFromSeed(new Uint8Array(32).fill(n)) });
  const rows = new Map<string, string>();
  const wiki: SwarmWikiPort = { read: async (t) => rows.get(t) ?? null, write: async (t, x) => { rows.set(t, x); }, writeNew: async (t, x) => (rows.has(t) ? false : (rows.set(t, x), true)),
    list: async (prefix) => [...rows.keys()].filter((t) => t.startsWith(prefix)) };
  const faces: { group: string; trust: SwarmTrust; atom: Awaited<ReturnType<typeof keyed>>; lei: string }[] = [];
  for (const ordinal of [0, 1]) {
    const group = `face-group-${ordinal}`, hand = await keyed(30 + ordinal), atom = await keyed(40 + ordinal);
    const trust: SwarmTrust = { hand: (k) => k === hand.key, vessel: (k) => k === atom.key, lead: () => false };
    const lei = await signSwarmAct({ act: "lei", group, rite: "kukulu", branch: "develop", after: null, reach: "wide", returns: 3 }, hand);
    await wiki.write(swarmLeiRecordTitle("kukulu", "develop", swarmActCid(lei)), JSON.stringify(lei));
    faces.push({ group, trust, atom, lei: swarmActCid(lei) });
  }
  const head = "a".repeat(40);
  const at = { rite: "kukulu" as const, branch: "develop", head, tree: "b".repeat(40) };
  const red = async (ordinal: number) => (await conferre(wiki, faces[ordinal]!.trust, faces[ordinal]!.group)).red;
  const claimed = () => faces.map((f) => [...rows.keys()].filter((t) => t.startsWith(swarmLeiReturnedPrefix(f.lei))).length);
  const begin = async () => {
    refuseStandingBegin(await standingKukuluBegins([0, 1], red, "develop"));
    return beginLentFaces([0, 1], (o) => checkReturn(wiki, at, faces[o]!.trust, faces[o]!.group, faces[o]!.atom, { accepts: () => true }), (c) => beginChecked(wiki, c));
  };
  const first = await begin();
  const standing = await standingKukuluBegins([0, 1], red, "develop");
  expect(standing).toEqual(first.faces.map((f) => ({ face: f.face, ordinal: f.ordinal, tessera: f.tessera, branch: "develop", head })));
  // RED: the re-run's begin refuses by name and claims no second return.
  await expect(begin()).rejects.toMatchObject({ code: "rite-begun-stands", message: expect.stringContaining(first.faces[0]!.tessera) });
  expect(claimed()).toEqual([1, 1]);
  // CONTROL: another line reads none; a face whose half landed reads nothing standing.
  expect(await standingKukuluBegins([0, 1], red, "main")).toEqual([]);
  await landRite(wiki, { tessera: first.faces[0]!.tessera, head }, faces[0]!.trust, faces[0]!.group, faces[0]!.atom);
  expect((await standingKukuluBegins([0, 1], red, "develop")).map((s) => s.face)).toEqual(["h1"]);
  await landRite(wiki, { tessera: first.faces[1]!.tessera, head }, faces[1]!.trust, faces[1]!.group, faces[1]!.atom);
  expect(await standingKukuluBegins([0, 1], red, "develop")).toEqual([]);
  // CONTROL: once every half landed, the next raise begins afresh (one return more per face).
  expect((await begin()).faces.map((f) => f.n)).toEqual([2, 2]);
});

/**
 * THE SECOND READ (gate 2): the debt reads by raw rows, so a face shut or rehived since its begin still refuses a second begin;
 * the resting offer reads back as its vouches, each named by face, so the host reuses it only where it matches the pending
 * halves; the abandon row runs on a hand alone; and the pūlama's begin over one offer is idempotent, so a refused composition
 * and its retry spend one return.
 */
test("RED: a face rehived since its begin (its old half verifies under no trust it holds now) still refuses a second begin by its raw row, naming the group and the abandon line; CONTROL: once abandoned, no debt stands", async () => {
  const keyed = async (n: number) => ({ key: await ed25519VerifyingKeyFromSeed(new Uint8Array(32).fill(n)), sign: ed25519SignerFromSeed(new Uint8Array(32).fill(n)) });
  const rows = new Map<string, string>();
  const wiki: SwarmWikiPort = { read: async (t) => rows.get(t) ?? null, write: async (t, x) => { rows.set(t, x); }, writeNew: async (t, x) => (rows.has(t) ? false : (rows.set(t, x), true)),
    list: async (prefix) => [...rows.keys()].filter((t) => t.startsWith(prefix)) };
  const hand = await keyed(50), atom = await keyed(51);
  const trust: SwarmTrust = { hand: (k) => k === hand.key, vessel: (k) => k === atom.key, lead: () => false };
  const lei = await signSwarmAct({ act: "lei", group: "old-group", rite: "kukulu", branch: "develop", after: null, reach: "wide", returns: 3 }, hand);
  await wiki.write(swarmLeiRecordTitle("kukulu", "develop", swarmActCid(lei)), JSON.stringify(lei));
  const at = { rite: "kukulu" as const, branch: "develop", head: "a".repeat(40), tree: "b".repeat(40) };
  const begun = await beginChecked(wiki, await checkReturn(wiki, at, trust, "old-group", atom, { accepts: () => true }));
  // The face rehived: its new group's trust reads nothing standing, and the raw debt still names the old half.
  const rehivedRed = async () => (await conferre(wiki, { hand: () => false, vessel: () => false, lead: () => false }, "new-group")).red;
  expect(await standingKukuluBegins([0], rehivedRed, "develop")).toEqual([]);
  const debt = await pendingBegins(wiki, "kukulu", "develop");
  expect(() => refuseStandingBegin(debt)).toThrow(expect.objectContaining({ code: "rite-begun-stands", message: expect.stringMatching(new RegExp(`old-group tessera ${begun.tessera}[\\s\\S]*lares rite kukulu --abandon --branch develop`)) }));
  await abandonRites(wiki, debt, hand);
  expect(await pendingBegins(wiki, "kukulu", "develop")).toEqual([]);
});

test("RED: the resting offer reads back as its vouches, each named by the lent face whose group it carries; CONTROL: a vouch for a group no lent face carries stays unnamed, and a file that reads as no offer reads none", () => {
  const offer = JSON.stringify({ lei: [], unstrung: [], vouch: [
    { body: { group: "g0", branch: "main", head: "a".repeat(40), tree: "t", image: "sha256:" + "ab".repeat(32) }, sig: "x" },
    { body: { group: "gx", branch: "other", head: "a".repeat(40), tree: "t", image: "sha256:" + "ab".repeat(32) }, sig: "x" },
  ] });
  expect(offerVouchesOf(offer, new Map([["g0", "h0"]]))).toEqual([
    { face: "h0", group: "g0", branch: "main", head: "a".repeat(40), image: "sha256:" + "ab".repeat(32) },
    { group: "gx", branch: "other", head: "a".repeat(40), image: "sha256:" + "ab".repeat(32) },
  ]);
  expect(offerVouchesOf("not json", new Map())).toBeNull();
  expect(offerVouchesOf(null, new Map())).toBeNull();
});

test("RED: the abandon row is a store-door face row a hand alone runs: a seat session refuses it by code; CONTROL: the begin, offer, land and receipts rows stay open to a seat", () => {
  expect(STORE_DOOR_VERBS as readonly string[]).toContain("rite-abandon");
  expect(STORE_DOOR_FACE_VERBS.has("rite-abandon" as never)).toBe(true);
  expect(STORE_DOOR_HAND_ONLY_ACTS.has("rite-abandon")).toBe(true);
  for (const row of ROWS) expect(STORE_DOOR_HAND_ONLY_ACTS.has(row), row).toBe(false);
});

test("RED: the pūlama's begin over one offer is idempotent: a composition refused after its claim, then the retry, rests one guest half and spends one return; CONTROL: once landed, the next kūkulu begins afresh", async () => {
  const keyed = async (n: number) => ({ key: await ed25519VerifyingKeyFromSeed(new Uint8Array(32).fill(n)), sign: ed25519SignerFromSeed(new Uint8Array(32).fill(n)) });
  const rows = new Map<string, string>();
  const records: SwarmWikiPort = { read: async (t) => rows.get(t) ?? null, write: async (t, x) => { rows.set(t, x); }, writeNew: async (t, x) => (rows.has(t) ? false : (rows.set(t, x), true)),
    list: async (prefix) => [...rows.keys()].filter((t) => t.startsWith(prefix)) };
  const hand = await keyed(60), pulama = await keyed(61);
  const lei = await signSwarmAct({ act: "lei", group: "g0", rite: "kukulu", branch: "main", after: null, reach: "wide", returns: 3 }, hand);
  const at = { group: "g0", branch: "main", head: "a".repeat(40), tree: "b".repeat(40), hand: (k: string) => k === hand.key, by: pulama };
  const port = kukuluRiteOver(records);
  const first = await port.begin({ lei: [lei], unstrung: [] }, at);
  const retry = await port.begin({ lei: [lei], unstrung: [] }, at);
  expect(retry).toEqual(first);
  expect([...rows.keys()].filter((t) => t.startsWith(swarmLeiReturnedPrefix(swarmActCid(lei))))).toHaveLength(1);
  if (!first.ok) throw new Error("the first begin refused");
  await port.land(first.tessera, at);
  expect(await port.begin({ lei: [lei], unstrung: [] }, at)).toMatchObject({ ok: true, n: 2 });
});

/**
 * THE THIRD READ (gate 2): the abandon is a hand act (a ward route opens the root, or the pūlama's hand door signs it), and the
 * vessel lands only marks a lent face's hand signed over a half pending on the line; the pūlama's reuse binds the image.
 */
test("RED: the vessel lands an abandon mark only where a lent face's HAND signed it over a half pending on the line; a mark the vessel's atom signed, or one over no pending half, lands nothing; CONTROL: the abandon row is a ward act unless it carries the hand's signed marks or asks its terms", async () => {
  const keyed = async (n: number) => ({ key: await ed25519VerifyingKeyFromSeed(new Uint8Array(32).fill(n)), sign: ed25519SignerFromSeed(new Uint8Array(32).fill(n)) });
  const rows = new Map<string, string>();
  const wiki: SwarmWikiPort = { read: async (t) => rows.get(t) ?? null, write: async (t, x) => { rows.set(t, x); }, writeNew: async (t, x) => (rows.has(t) ? false : (rows.set(t, x), true)),
    list: async (prefix) => [...rows.keys()].filter((t) => t.startsWith(prefix)) };
  const hand = await keyed(70), atom = await keyed(71);
  const trust: SwarmTrust = { hand: (k) => k === hand.key, vessel: (k) => k === atom.key, lead: () => false };
  const lei = await signSwarmAct({ act: "lei", group: "g0", rite: "kukulu", branch: "main", after: null, reach: "wide", returns: 3 }, hand);
  await wiki.write(swarmLeiRecordTitle("kukulu", "main", swarmActCid(lei)), JSON.stringify(lei));
  const at = { rite: "kukulu" as const, branch: "main", head: "a".repeat(40), tree: "b".repeat(40) };
  const begun = await beginChecked(wiki, await checkReturn(wiki, at, trust, "g0", atom, { accepts: () => true }));
  const mark = (signer: typeof hand, tessera = begun.tessera, guest = begun.begun) => signSwarmAct({ act: "rite-abandoned", group: "g0", rite: "kukulu", branch: "main", tessera, begun: guest }, signer);
  // THE FOURTH READ: only the root that strung the half's lei (its own face's hand) ends it, over that half's own guest cid.
  const otherHand = await keyed(72);
  await expect(acceptAbandons(wiki, "main", [await mark(atom)])).rejects.toMatchObject({ code: "rite-abandon-unsigned" });
  await expect(acceptAbandons(wiki, "main", [await mark(otherHand)])).rejects.toMatchObject({ code: "rite-abandon-unsigned" });
  await expect(acceptAbandons(wiki, "main", [await mark(hand, begun.tessera, "9".repeat(64))])).rejects.toMatchObject({ code: "rite-abandon-unsigned" });
  await expect(acceptAbandons(wiki, "main", [await mark(hand, "9".repeat(64))])).rejects.toMatchObject({ code: "rite-abandon-not-pending" });
  expect(await pendingBegins(wiki, "kukulu", "main")).toHaveLength(1);
  expect(await acceptAbandons(wiki, "main", [await mark(hand)])).toEqual([{ tessera: begun.tessera, group: "g0", head: at.head }]);
  expect(await pendingBegins(wiki, "kukulu", "main")).toEqual([]);
  expect(storeVerbNeedsWard("rite-abandon", { rite: "kukulu", branch: "main" })).toBe(true);
  expect(storeVerbNeedsWard("rite-abandon", { rite: "kukulu", branch: "main", signed: [] })).toBe(false);
  expect(storeVerbNeedsWard("rite-abandon", { rite: "kukulu", branch: "main", terms: true })).toBe(false);
});

test("RED: the pūlama's reuse binds the image: a retry over another image claims its own return and never takes the first image's half; CONTROL: the same image reuses", async () => {
  const keyed = async (n: number) => ({ key: await ed25519VerifyingKeyFromSeed(new Uint8Array(32).fill(n)), sign: ed25519SignerFromSeed(new Uint8Array(32).fill(n)) });
  const rows = new Map<string, string>();
  const records: SwarmWikiPort = { read: async (t) => rows.get(t) ?? null, write: async (t, x) => { rows.set(t, x); }, writeNew: async (t, x) => (rows.has(t) ? false : (rows.set(t, x), true)),
    list: async (prefix) => [...rows.keys()].filter((t) => t.startsWith(prefix)) };
  const hand = await keyed(80), pulama = await keyed(81);
  const lei = await signSwarmAct({ act: "lei", group: "g0", rite: "kukulu", branch: "main", after: null, reach: "wide", returns: 3 }, hand);
  const at = (image: string) => ({ group: "g0", branch: "main", head: "a".repeat(40), tree: "b".repeat(40), image, hand: (k: string) => k === hand.key, by: pulama });
  const port = kukuluRiteOver(records);
  const a = await port.begin({ lei: [lei], unstrung: [] }, at("sha256:" + "aa".repeat(32)));
  const b = await port.begin({ lei: [lei], unstrung: [] }, at("sha256:" + "bb".repeat(32)));
  expect(a).toMatchObject({ ok: true, n: 1 });
  expect(b).toMatchObject({ ok: true, n: 2 });
  expect(await port.begin({ lei: [lei], unstrung: [] }, at("sha256:" + "aa".repeat(32)))).toEqual(a);
});

test("RED (the fourth read): the pūlama's `lei` verb unwraps the CLI's answer envelope (`{ok, data}`) its abandon terms ride in, so the hand door reads the face and the parts; CONTROL: bare terms read as they stood", async () => {
  const frames: Array<Record<string, unknown>> = [];
  const ports = {
    ask: async (f: Record<string, unknown>) => { frames.push(f); return f["op"] === "status" ? { op: "status", lit: true } : { op: "lei", reading: "signed" }; },
    route: async () => "a route",
  };
  const terms = { face: 1, rite: "kukulu", branch: "main", parts: [{ tessera: "c".repeat(64), group: "g1", branch: "main", begun: "d".repeat(64) }] };
  for (const text of [JSON.stringify({ ok: true, data: terms }), JSON.stringify(terms)]) {
    frames.length = 0;
    await runHandVerb("lei", ["abandon", text], ports as never);
    expect(frames.at(-1)).toMatchObject({ op: "lei", act: "abandon", face: 1, parts: terms.parts });
  }
});

/**
 * THE FIFTH READ (gate 2): the abandon names its face or refuses (an unlent `--face`, nothing owed, none of this face's own); the
 * pūlama asks no route over zero parts.
 */
test("RED: the abandon's face reads by name: an unlent `--face` refuses `face-not-lent`; nothing pending refuses `rite-abandon-nothing-pending`; a face owing none of its own refuses `rite-abandon-no-own-halves` with each other face's own line; CONTROL: its own halves read as its parts", () => {
  const half = (tessera: string, group: string) => ({ tessera, group, branch: "main", head: "a".repeat(40), lei: "l", n: 1, begun: "b".repeat(64) });
  const faces = [{ ordinal: 0, group: "g0" }, { ordinal: 1, group: "g1" }];
  expect(() => ownAbandonParts({ pending: [half("c".repeat(64), "g0")], faces, named: 2, branch: "main" })).toThrow(expect.objectContaining({ code: "face-not-lent" }));
  expect(() => ownAbandonParts({ pending: [], faces, named: 0, branch: "main" })).toThrow(expect.objectContaining({ code: "rite-abandon-nothing-pending" }));
  expect(() => ownAbandonParts({ pending: [half("c".repeat(64), "g1"), half("d".repeat(64), "gone")], faces, named: 0, branch: "main" })).toThrow(expect.objectContaining({
    code: "rite-abandon-no-own-halves",
    message: expect.stringMatching(/h1 tessera c+ waits for its own face's hand: lares rite kukulu --abandon --face 1 --branch main[\s\S]*gone tessera d+ waits: no lent face's hand carries its group, so it ends once that face stands again/),
  }));
  const own = ownAbandonParts({ pending: [half("c".repeat(64), "g1"), half("e".repeat(64), "g0")], faces, named: 0, branch: "main" });
  expect([own.signer, own.mine.map((p) => p.tessera), own.others.map((o) => o["tessera"])]).toEqual([0, ["e".repeat(64)], ["c".repeat(64)]]);
});

test("RED: the pūlama's `lei abandon` with zero parts asks no route and signs nothing; CONTROL: parts ask the route once", async () => {
  let routes = 0;
  const ports = { ask: async (f: Record<string, unknown>) => (f["op"] === "status" ? { op: "status", lit: true } : { op: "lei", reading: "signed" }), route: async () => { routes++; return "a route"; } };
  expect(await runHandVerb("lei", ["abandon", JSON.stringify({ ok: true, data: { face: 0, rite: "kukulu", branch: "main", parts: [] } })], ports as never)).toMatchObject({ reading: "lei-malformed" });
  expect(routes).toBe(0);
  await runHandVerb("lei", ["abandon", JSON.stringify({ face: 0, rite: "kukulu", branch: "main", parts: [{ tessera: "c".repeat(64), group: "g", branch: "main", begun: "d".repeat(64) }] })], ports as never);
  expect(routes).toBe(1);
});

test("RED (the sixth read): a signed landing matches the operator's request: the marks name exactly the requested face's own halves, else `rite-abandon-terms-differ` and nothing lands; CONTROL: the very halves of the terms pass", () => {
  const half = (tessera: string) => ({ tessera, group: "g0", branch: "main", head: "a".repeat(40), lei: "l", n: 1, begun: "b".repeat(64) });
  const rec = (tessera: string, group = "g0") => ({ body: { act: "rite-abandoned", tessera, group, branch: "main" } });
  const mine = [half("c".repeat(64)), half("d".repeat(64))];
  expect(() => signedMatchesTerms([rec("c".repeat(64))], mine)).toThrow(expect.objectContaining({ code: "rite-abandon-terms-differ" }));
  expect(() => signedMatchesTerms([rec("c".repeat(64)), rec("e".repeat(64))], mine)).toThrow(expect.objectContaining({ code: "rite-abandon-terms-differ" }));
  expect(() => signedMatchesTerms([rec("c".repeat(64)), rec("d".repeat(64), "g1")], mine)).toThrow(expect.objectContaining({ code: "rite-abandon-terms-differ" }));
  expect(() => signedMatchesTerms([rec("c".repeat(64)), rec("c".repeat(64)), rec("d".repeat(64))], mine)).toThrow(expect.objectContaining({ code: "rite-abandon-terms-differ" }));
  expect(() => signedMatchesTerms([rec("d".repeat(64)), rec("c".repeat(64))], mine)).not.toThrow();
});
