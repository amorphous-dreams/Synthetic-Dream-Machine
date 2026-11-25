/**
 * tessera — the two halves of one rite across a restart (road L45d). A rite begins by returning its lei, and the vessel rests
 * the GUEST half (`rite-begun`) before it goes down; the vessel that stands after rests the HOST half (`rite-landed`), naming
 * the begun half. CONFERRE matches the halves at each wake: a match reads `par`, and a half with no match reads red.
 *
 * Every red pairs with a CONTROL. Meme: lar:///ha.ka.ba/lares/docs/pono/seat-harness
 */
import { describe, expect, test } from "vitest";
import { ed25519SignerFromSeed, ed25519VerifyingKeyFromSeed } from "../src/ed25519-door.js";
import { beginRite, conferre, landRite, pendingBegins, riteReceipts, tesseraOf } from "../src/swarm-tessera.js";
import {
  checkReturn, claimReturn, putSwarmAct, readSwarmRecord, signSwarmAct, swarmActCid, swarmLeiReturnedTitle, swarmLeiRecordTitle, swarmTesseraTitle,
  type SwarmBodyParts, type SwarmWikiPort,
} from "../src/swarm-tiddlers.js";

const GROUP = "face-group", BRANCH = "main", HEAD = "a".repeat(40), HEAD2 = "b".repeat(40), TREE = "1".repeat(40);
const keyed = async (n: number) => ({ key: await ed25519VerifyingKeyFromSeed(new Uint8Array(32).fill(n)), sign: ed25519SignerFromSeed(new Uint8Array(32).fill(n)) });
const ONE_DEVICE = { accepts: () => true };

async function fixture() {
  const hand = await keyed(1), vessel = await keyed(2), outsider = await keyed(4);
  const trust = { hand: (k: string) => k === hand.key, vessel: (k: string) => k === vessel.key, lead: () => false };
  const rows = new Map<string, string>();
  const wiki: SwarmWikiPort = { read: async (t) => rows.get(t) ?? null, write: async (t, x) => { rows.set(t, x); }, writeNew: async (t, x) => (rows.has(t) ? false : (rows.set(t, x), true)),
    list: async (prefix) => [...rows.keys()].filter((t) => t.startsWith(prefix)) };
  /** A hand-signed lei at its own row; hands back its cid. */
  const kui = async (rite: "push" | "kukulu", terms: Record<string, unknown>, after: string | null = null): Promise<string> => {
    const lei = await signSwarmAct({ act: "lei", group: GROUP, rite, branch: BRANCH, after, ...terms } as unknown as SwarmBodyParts, hand);
    await putSwarmAct(wiki, swarmLeiRecordTitle(rite, BRANCH, swarmActCid(lei)), lei);
    return swarmActCid(lei);
  };
  const begin = (head = HEAD, spender = vessel) => beginRite(wiki, { rite: "kukulu", branch: BRANCH, head, tree: TREE }, trust, GROUP, spender, ONE_DEVICE);
  const land = (tessera: string, head = HEAD, lander = vessel) => landRite(wiki, { tessera, head }, trust, GROUP, lander);
  const halves = () => [...rows.keys()].filter((t) => t.includes("/tessera/"));
  return { hand, vessel, outsider, trust, wiki, rows, kui, begin, land, halves };
}

describe("rite-refuses-without-lei", () => {
  test("RED: with no kukulu lei standing a rite begins nothing: no return, no half; a push lei at the same branch grants no kukulu; CONTROL: a kukulu lei alone begins the rite, no receipt standing", async () => {
    const f = await fixture();
    await expect(f.begin()).rejects.toMatchObject({ code: "swarm-lei-absent" });
    await f.kui("push", { reach: "wide", returns: 3 });
    await expect(f.begin()).rejects.toMatchObject({ code: "swarm-lei-absent" });
    expect(f.halves()).toEqual([]);
    const cid = await f.kui("kukulu", { reach: "wide", returns: 2 });
    const begun = await f.begin();
    expect(begun).toMatchObject({ lei: cid, n: 1, rite: "kukulu", tessera: tesseraOf({ lei: cid, n: 1 }) });
    expect(f.rows.has(swarmLeiReturnedTitle(cid, 1))).toBe(true);
  });

  test("RED: a lei pinned to another head, and a spender that holds no vessel role each begin nothing; CONTROL: no half rests after any of them", async () => {
    const f = await fixture();
    await f.kui("kukulu", { reach: "head", head: HEAD });
    await expect(f.begin(HEAD2)).rejects.toMatchObject({ code: "swarm-lei-head-mismatch" });
    await expect(f.begin(HEAD, f.outsider)).rejects.toMatchObject({ code: "swarm-return-role" });
    expect(f.halves()).toEqual([]);
  });

  test("RED: the guest half rests as the vessel's signed record, naming the lei, its count, the head and the tree; a second rite on one wide lei takes its own tessera", async () => {
    const f = await fixture();
    const cid = await f.kui("kukulu", { reach: "wide", returns: 2 });
    const one = await f.begin(), two = await f.begin(HEAD2);
    expect(one.tessera).not.toBe(two.tessera);
    const guest = await readSwarmRecord(f.wiki, swarmTesseraTitle(one.tessera, "guest"), f.trust, GROUP);
    expect(guest).toMatchObject({ ok: true, cid: one.begun, act: { signer: f.vessel.key, body: { act: "rite-begun", rite: "kukulu", branch: BRANCH, head: HEAD, tree: TREE, lei: cid, n: 1, tessera: one.tessera } } });
    await expect(f.begin()).rejects.toMatchObject({ code: "swarm-lei-returns-spent" });
  });
});

describe("rite-landed-names-begun", () => {
  test("RED: the host half names the begun half by its cid and rests as the vessel's record; a landing with no begun half, a second landing and a lander that holds no vessel role each refuse; CONTROL: conferre reads the pair par", async () => {
    const f = await fixture();
    await f.kui("kukulu", { reach: "wide", returns: 2 });
    await expect(f.land("9".repeat(64))).rejects.toMatchObject({ code: "rite-begun-absent" });
    const begun = await f.begin();
    await expect(f.land(begun.tessera, HEAD, f.outsider)).rejects.toMatchObject({ code: "rite-land-role" });
    expect(f.rows.has(swarmTesseraTitle(begun.tessera, "host"))).toBe(false);
    const landed = await f.land(begun.tessera);
    expect(landed).toMatchObject({ tessera: begun.tessera, rite: "kukulu", begun: begun.begun, par: true });
    const host = await readSwarmRecord(f.wiki, swarmTesseraTitle(begun.tessera, "host"), f.trust, GROUP);
    expect(host).toMatchObject({ ok: true, cid: landed.landed, act: { signer: f.vessel.key, body: { act: "rite-landed", rite: "kukulu", tessera: begun.tessera, begun: begun.begun, head: HEAD } } });
    await expect(f.land(begun.tessera)).rejects.toMatchObject({ code: "rite-already-landed" });
    expect(await conferre(f.wiki, f.trust, GROUP)).toEqual({ par: [{ tessera: begun.tessera, rite: "kukulu", begun: begun.begun, landed: landed.landed, branch: BRANCH, head: HEAD, par: true }], red: [] });
  });
});

describe("wake-reads-unmatched-half-red", () => {
  test("RED: a begun half with no landed half reads red at conferre, and so does a vessel that stood at another head; CONTROL: the matched pair beside them reads par, and the receipts name every half", async () => {
    const f = await fixture();
    await f.kui("kukulu", { reach: "wide", returns: 3 });
    const matched = await f.begin(), other = await f.begin(), open = await f.begin();
    const landed = await f.land(matched.tessera);
    const drifted = await f.land(other.tessera, HEAD2);
    expect(drifted.par).toBe(false);
    const read = await conferre(f.wiki, f.trust, GROUP);
    expect(read.par).toEqual([{ tessera: matched.tessera, rite: "kukulu", begun: matched.begun, landed: landed.landed, branch: BRANCH, head: HEAD, par: true }]);
    expect([...read.red].sort((a, b) => String(a.red).localeCompare(String(b.red)))).toEqual([
      { tessera: other.tessera, rite: "kukulu", begun: other.begun, landed: drifted.landed, branch: BRANCH, head: HEAD, par: false, red: "head-differs" },
      { tessera: open.tessera, rite: "kukulu", begun: open.begun, landed: null, branch: BRANCH, head: HEAD, par: false, red: "landed-absent" },
    ]);
    const receipts = await riteReceipts(f.wiki, f.trust, GROUP);
    expect(receipts).toHaveLength(5);
    expect(receipts.filter((r) => r.act === "rite-begun").map((r) => r.tessera).sort()).toEqual([matched.tessera, other.tessera, open.tessera].sort());
    expect(receipts.filter((r) => r.act === "rite-landed").every((r) => r.rite === "kukulu")).toBe(true);
  });

  test("RED: an open begun half reads red naming the branch and head it began at, so the seat that owes its landing finds it; CONTROL: a lone host half with no guest names neither", async () => {
    const f = await fixture();
    await f.kui("kukulu", { reach: "wide", returns: 2 });
    const open = await f.begin(HEAD2);
    const lone = "7".repeat(64);
    await putSwarmAct(f.wiki, swarmTesseraTitle(lone, "host"), await signSwarmAct({ act: "rite-landed", group: GROUP, rite: "kukulu", tessera: lone, begun: "8".repeat(64), head: HEAD }, f.vessel));
    const read = await conferre(f.wiki, f.trust, GROUP);
    expect(read.red.find((r) => r.tessera === open.tessera)).toMatchObject({ red: "landed-absent", branch: BRANCH, head: HEAD2 });
    const alone = read.red.find((r) => r.tessera === lone);
    expect(alone?.red).toBe("begun-absent");
    expect("head" in (alone ?? {}) || "branch" in (alone ?? {})).toBe(false);
  });

  test("RED: a host half no vessel signed, one that names another begun half, and one with no guest half each read red by name; none reads par", async () => {
    const f = await fixture();
    await f.kui("kukulu", { reach: "wide", returns: 3 });
    const forged = await f.begin(), crossed = await f.begin(), lone = "7".repeat(64);
    f.rows.set(swarmTesseraTitle(forged.tessera, "host"), "not a record");
    const wrong = await signSwarmAct({ act: "rite-landed", group: GROUP, rite: "kukulu", tessera: crossed.tessera, begun: forged.begun, head: HEAD }, f.vessel);
    await putSwarmAct(f.wiki, swarmTesseraTitle(crossed.tessera, "host"), wrong);
    await putSwarmAct(f.wiki, swarmTesseraTitle(lone, "host"), await signSwarmAct({ act: "rite-landed", group: GROUP, rite: "kukulu", tessera: lone, begun: "8".repeat(64), head: HEAD }, f.vessel));
    const read = await conferre(f.wiki, f.trust, GROUP);
    expect(read.par).toEqual([]);
    expect(Object.fromEntries(read.red.map((r) => [r.tessera, r.red]))).toEqual({ [forged.tessera]: "landed-refused", [crossed.tessera]: "landed-names-another", [lone]: "begun-absent" });
  });
});

/**
 * KŪKULU SURVIVES A CTRL+C (gate 2, the second read): a begin binds the image it raises, so a landing over another image never
 * reads par; a return claimed and never rested as a guest half is reused by the next begin at the same head and tree, never a
 * second return; and a pending half reads by its raw rows (a shut or rehived face's too).
 */
describe("kukulu-binds-its-image-and-spends-once", () => {
  const D1 = "sha256:" + "d1".repeat(32), D2 = "sha256:" + "d2".repeat(32);

  test("RED: a begin names its image in the guest half; a landing over another image at the same head reads off par and conferre reads it red `image-differs`; CONTROL: the same image reads par", async () => {
    const f = await fixture();
    await f.kui("kukulu", { reach: "wide", returns: 3 });
    const one = await beginRite(f.wiki, { rite: "kukulu", branch: BRANCH, head: HEAD, tree: TREE, image: D1 }, f.trust, GROUP, f.vessel, ONE_DEVICE);
    const guest = await readSwarmRecord(f.wiki, swarmTesseraTitle(one.tessera, "guest"), f.trust, GROUP);
    expect(guest).toMatchObject({ ok: true, act: { body: { image: D1 } } });
    const off = await landRite(f.wiki, { tessera: one.tessera, head: HEAD, image: D2 }, f.trust, GROUP, f.vessel);
    expect(off.par).toBe(false);
    expect((await conferre(f.wiki, f.trust, GROUP)).red).toEqual([expect.objectContaining({ tessera: one.tessera, red: "image-differs", image: D1 })]);
    const two = await beginRite(f.wiki, { rite: "kukulu", branch: BRANCH, head: HEAD, tree: TREE, image: D1 }, f.trust, GROUP, f.vessel, ONE_DEVICE);
    expect((await landRite(f.wiki, { tessera: two.tessera, head: HEAD, image: D1 }, f.trust, GROUP, f.vessel)).par).toBe(true);
  });

  test("RED: a return claimed and never rested as a guest half (a crash between) is reused by the next begin at the same head and tree, so no second return spends; CONTROL: an orphan return at another head stays spent and the begin claims the next", async () => {
    const f = await fixture();
    const cid = await f.kui("kukulu", { reach: "wide", returns: 3 });
    const at = { rite: "kukulu" as const, branch: BRANCH, head: HEAD, tree: TREE };
    await claimReturn(f.wiki, await checkReturn(f.wiki, at, f.trust, GROUP, f.vessel, ONE_DEVICE));
    const begun = await f.begin();
    expect([begun.n, begun.tessera]).toEqual([1, tesseraOf({ lei: cid, n: 1 })]);
    expect(f.rows.has(swarmLeiReturnedTitle(cid, 2))).toBe(false);
    await claimReturn(f.wiki, await checkReturn(f.wiki, { ...at, head: HEAD2 }, f.trust, GROUP, f.vessel, ONE_DEVICE));
    expect((await f.begin()).n).toBe(3);
  });

  test("RED: a pending half reads by its raw rows, even where its face's trust no longer verifies it (a shut or rehived face); CONTROL: a landed half is never pending, and another line reads none", async () => {
    const f = await fixture();
    await f.kui("kukulu", { reach: "wide", returns: 3 });
    const open = await beginRite(f.wiki, { rite: "kukulu", branch: BRANCH, head: HEAD, tree: TREE, image: D1 }, f.trust, GROUP, f.vessel, ONE_DEVICE);
    const done = await f.begin(HEAD2);
    await f.land(done.tessera, HEAD2);
    const pending = await pendingBegins(f.wiki, "kukulu", BRANCH);
    expect(pending).toEqual([{ tessera: open.tessera, group: GROUP, branch: BRANCH, head: HEAD, image: D1, lei: open.lei, n: open.n, begun: open.begun }]);
    // A rehived face's trust verifies nothing of the old half, and the raw read still names it.
    const rehived = { hand: () => false, vessel: () => false, lead: () => false };
    expect((await conferre(f.wiki, rehived, "face-group-rehived")).red.filter((r) => r.red === "landed-absent")).toEqual([]);
    expect(await pendingBegins(f.wiki, "kukulu", "other")).toEqual([]);
    await f.land(open.tessera);
    expect(await pendingBegins(f.wiki, "kukulu", BRANCH)).toEqual([]);
  });
});

/**
 * THE THIRD READ (gate 2): the orphan return is found before the lei's count refuses, so a crash after the LAST claim still
 * reuses it; and the claim names the image it paid for, so a retry over another image never takes it.
 */
describe("kukulu-reuses-its-own-return", () => {
  const D1 = "sha256:" + "d1".repeat(32), D2 = "sha256:" + "d2".repeat(32);

  test("RED: a crash after the LAST claim (zero spare returns) still reuses that return for a begin over the same image; the claim names its image; CONTROL: a begin over another image takes no other image's orphan and the spent lei refuses", async () => {
    const f = await fixture();
    const cid = await f.kui("kukulu", { reach: "wide", returns: 1 });
    const at = { rite: "kukulu" as const, branch: BRANCH, head: HEAD, tree: TREE, image: D1 };
    await claimReturn(f.wiki, await checkReturn(f.wiki, at, f.trust, GROUP, f.vessel, ONE_DEVICE));
    expect(JSON.parse(f.rows.get(swarmLeiReturnedTitle(cid, 1))!)).toMatchObject({ body: { act: "lei-returned", image: D1 } });
    await expect(beginRite(f.wiki, { ...at, image: D2 }, f.trust, GROUP, f.vessel, ONE_DEVICE)).rejects.toMatchObject({ code: "swarm-lei-returns-spent" });
    const begun = await beginRite(f.wiki, at, f.trust, GROUP, f.vessel, ONE_DEVICE);
    expect([begun.n, begun.tessera]).toEqual([1, tesseraOf({ lei: cid, n: 1 })]);
    await expect(beginRite(f.wiki, at, f.trust, GROUP, f.vessel, ONE_DEVICE)).rejects.toMatchObject({ code: "swarm-lei-returns-spent" });
  });

});
