/**
 * receipt-door — the receipt's writer (road L45): THE PLACE rests `receipt/<tree>` over a verdict the host battery hands it, once
 * for every face it lends.
 *
 * THE RECEIPT NOTARISES TESTIMONY. The place signs what the host's battery read and re-runs nothing, so a receipt vouches that
 * this place heard that verdict for that tree, never that the tree passes. A receipt testifies about code, never about a face:
 * it names no group, and every face's trust reads it through its `place` predicate, so a house of three faces stands one
 * receipt for all three faces' returns. A receipt a face key signed reads absent.
 * Every red pairs with a CONTROL. Meme: lar:///ha.ka.ba/lares/docs/pono/seat-harness
 */
import { describe, expect, test } from "vitest";
import { canonicalJsonBytes } from "../src/crypto.js";
import { CARRIAGE_RECEIPT_DOMAIN, RITE_RECEIPT_DOMAIN } from "../src/domains.js";
import { ed25519SignerFromSeed, ed25519VerifyingKeyFromSeed } from "../src/ed25519-door.js";
import { frameFloorDuty } from "../src/place-signer.js";
import { beginRite } from "../src/swarm-tessera.js";
import {
  putSwarmAct, restReceipt, riteReceiptImage, signSwarmAct, swarmActCid, swarmLeiNarrowedTitle, swarmLeiRecordTitle, swarmReceiptTitle, verifyRiteReceipt,
  type SwarmBodyParts, type SwarmTrust, type SwarmWikiPort,
} from "../src/swarm-tiddlers.js";
import { PLACE, placeOf, placeTrust } from "./place-receipt.js";

const BRANCH = "main", HEAD = "a".repeat(40), TREE = "1".repeat(40), DEFS = "d".repeat(64);
const keyed = async (n: number) => ({ key: await ed25519VerifyingKeyFromSeed(new Uint8Array(32).fill(n)), sign: ed25519SignerFromSeed(new Uint8Array(32).fill(n)) });
const ONE_DEVICE = { accepts: () => true };

function wikiPort(): SwarmWikiPort & { rows: Map<string, string> } {
  const rows = new Map<string, string>();
  return { rows, read: async (t) => rows.get(t) ?? null, write: async (t, x) => { rows.set(t, x); }, writeNew: async (t, x) => (rows.has(t) ? false : (rows.set(t, x), true)),
    list: async (prefix) => [...rows.keys()].filter((t) => t.startsWith(prefix)) };
}

/** One face of the house: its own group, its own hand, its own device atom as the vessel, and the house's one place. */
async function faceOf(wiki: SwarmWikiPort, n: number) {
  const group = `face-group-${n}`, hand = await keyed(10 + n), vessel = await keyed(20 + n);
  const trust: SwarmTrust = { hand: (k) => k === hand.key, vessel: (k) => k === vessel.key, place: placeTrust(), lead: () => false };
  const kui = async (terms: Record<string, unknown>, after: string | null = null): Promise<string> => {
    const lei = await signSwarmAct({ act: "lei", group, rite: "keep", branch: BRANCH, after, ...terms } as unknown as SwarmBodyParts, hand);
    await putSwarmAct(wiki, swarmLeiRecordTitle("keep", BRANCH, swarmActCid(lei)), lei);
    return swarmActCid(lei);
  };
  const begin = () => beginRite(wiki, { rite: "keep", branch: BRANCH, head: HEAD, tree: TREE }, trust, group, vessel, ONE_DEVICE);
  return { n, group, hand, vessel, trust, kui, begin };
}

async function fixture() {
  const wiki = wikiPort();
  const face = await faceOf(wiki, 0);
  const receipt = (verdict: "pass" | "fail", over: Record<string, unknown> = {}, place = PLACE) =>
    restReceipt(wiki, { tree: TREE, checks: ["typecheck", "mesh"], verdict, definitions: DEFS, ...over } as never, place);
  const halves = () => [...wiki.rows.keys()].filter((t) => t.includes("/tessera/"));
  return { wiki, rows: wiki.rows, face, receipt, halves };
}

describe("receipt-door-signs-the-tree", () => {
  test("RED: the door rests a place-signed receipt at the tree's title, naming the checks, the verdict and the definitions and no face; CONTROL: it verifies under the place", async () => {
    const f = await fixture();
    const out = await f.receipt("pass");
    expect(out).toEqual({ tree: TREE, verdict: "pass", checks: ["typecheck", "mesh"], receipt: expect.stringMatching(/^[0-9a-f]{64}$/) });
    const text = f.rows.get(swarmReceiptTitle(TREE))!;
    expect(verifyRiteReceipt(text, swarmReceiptTitle(TREE), placeTrust())).toEqual({
      ok: true, cid: out.receipt, receipt: { signer: PLACE.key, sig: expect.any(String), body: { kind: RITE_RECEIPT_DOMAIN, tree: TREE, checks: ["typecheck", "mesh"], verdict: "pass", definitions: DEFS } },
    });
    expect(Object.keys(JSON.parse(text).body)).not.toContain("group");
  });

  test("RED: a verdict outside pass and fail, a tree that reads as no name, checks that hold no name and definitions that read as no hash each refuse and rest nothing; CONTROL: a later receipt for the same tree replaces the one that stood", async () => {
    const f = await fixture();
    for (const bad of [{ verdict: "maybe" }, { tree: "" }, { tree: "a/b" }, { checks: [] }, { checks: ["ok", ""] }, { checks: "typecheck" }, { definitions: "abc" }]) {
      await expect(f.receipt("pass", bad), JSON.stringify(bad)).rejects.toMatchObject({ code: "swarm-receipt-malformed" });
    }
    expect(f.rows.size).toBe(0);
    await f.receipt("fail");
    await f.receipt("pass");
    expect(verifyRiteReceipt(f.rows.get(swarmReceiptTitle(TREE))!, swarmReceiptTitle(TREE), placeTrust())).toMatchObject({ ok: true, receipt: { body: { verdict: "pass" } } });
    expect([...f.rows.keys()]).toEqual([swarmReceiptTitle(TREE)]);
  });

  test("RED: a receipt another place signed refuses `role`, one whose verdict moved after the signature or that signs under another duty refuses `signature`, and one moved to another tree's title refuses `title`; CONTROL: the place's own receipt verifies", async () => {
    const f = await fixture();
    await f.receipt("fail");
    const title = swarmReceiptTitle(TREE), text = f.rows.get(title)!;
    expect(verifyRiteReceipt(text, title, placeTrust())).toMatchObject({ ok: true });
    await f.receipt("fail", {}, placeOf(5));
    expect(verifyRiteReceipt(f.rows.get(title)!, title, placeTrust())).toEqual({ ok: false, refusal: "role" });
    const raw = JSON.parse(text);
    expect(verifyRiteReceipt(JSON.stringify({ ...raw, body: { ...raw.body, verdict: "pass" } }), title, placeTrust())).toEqual({ ok: false, refusal: "signature" });
    // The same body under the carriage receipt's duty: the frame differs, so the signature crosses to nothing.
    const crossDuty = await PLACE.signFloor(CARRIAGE_RECEIPT_DOMAIN, frameFloorDuty(CARRIAGE_RECEIPT_DOMAIN, canonicalJsonBytes(raw.body)));
    expect(verifyRiteReceipt(JSON.stringify({ ...raw, sig: crossDuty }), title, placeTrust())).toEqual({ ok: false, refusal: "signature" });
    expect(await PLACE.signFloor(RITE_RECEIPT_DOMAIN, riteReceiptImage(raw.body))).toBe(raw.sig);
    expect(verifyRiteReceipt(text, swarmReceiptTitle("2".repeat(40)), placeTrust())).toEqual({ ok: false, refusal: "title" });
    expect(verifyRiteReceipt(JSON.stringify({ ...raw, body: { ...raw.body, group: "face-group-0" } }), title, placeTrust())).toEqual({ ok: false, refusal: "shape" });
  });
});

describe("one-receipt-serves-every-lent-face", () => {
  test("RED: three lent faces each hold a keep lei on one shared swarm wiki, and one place-signed passing receipt returns all three faces' leis; CONTROL: with no receipt each face refuses `swarm-lei-testimony-absent`", async () => {
    const wiki = wikiPort();
    const faces = await Promise.all([0, 1, 2].map((n) => faceOf(wiki, n)));
    const leis = [];
    for (const face of faces) leis.push(await face.kui({ reach: "wide", returns: 2 }));
    for (const face of faces) await expect(face.begin(), `h${face.n}`).rejects.toMatchObject({ code: "swarm-lei-testimony-absent" });
    await restReceipt(wiki, { tree: TREE, checks: ["typecheck"], verdict: "pass", definitions: DEFS }, PLACE);
    for (const [i, face] of faces.entries()) await expect(face.begin(), `h${face.n}`).resolves.toMatchObject({ rite: "keep", lei: leis[i], n: 1 });
    expect([...wiki.rows.keys()].filter((t) => t.includes("/tessera/"))).toHaveLength(3);
  });

  test("RED: a failing place receipt refuses every face `swarm-lei-testimony-red` and narrows each wide lei; CONTROL: a passing receipt rested after leaves each lei narrowed, and a fresh head lei begins each face's rite", async () => {
    const wiki = wikiPort();
    const faces = await Promise.all([0, 1, 2].map((n) => faceOf(wiki, n)));
    const leis = [];
    for (const face of faces) leis.push(await face.kui({ reach: "wide", returns: 2 }));
    await restReceipt(wiki, { tree: TREE, checks: ["typecheck"], verdict: "fail", definitions: DEFS }, PLACE);
    for (const face of faces) await expect(face.begin(), `h${face.n}`).rejects.toMatchObject({ code: "swarm-lei-testimony-red" });
    for (const cid of leis) expect(wiki.rows.has(swarmLeiNarrowedTitle(cid))).toBe(true);
    expect([...wiki.rows.keys()].filter((t) => t.includes("/tessera/"))).toEqual([]);
    await restReceipt(wiki, { tree: TREE, checks: ["typecheck"], verdict: "pass", definitions: DEFS }, PLACE);
    for (const face of faces) await expect(face.begin(), `h${face.n}`).rejects.toMatchObject({ code: "swarm-lei-narrowed" });
    for (const [i, face] of faces.entries()) {
      const head = await face.kui({ reach: "head", head: HEAD }, leis[i]!);
      await expect(face.begin(), `h${face.n}`).resolves.toMatchObject({ lei: head, n: 1 });
    }
  });

  test("RED: a receipt a face key signed (its device atom, its hand) stands for no face, its own included: each refuses `swarm-lei-testimony-absent` and claims nothing; CONTROL: the place's receipt over the same tree returns each", async () => {
    const wiki = wikiPort();
    const faces = await Promise.all([0, 1, 2].map((n) => faceOf(wiki, n)));
    for (const face of faces) await face.kui({ reach: "wide", returns: 2 });
    for (const seed of [20, 10]) {
      await restReceipt(wiki, { tree: TREE, checks: ["typecheck"], verdict: "pass", definitions: DEFS }, placeOf(seed));
      for (const face of faces) await expect(face.begin(), `h${face.n} under seed ${seed}`).rejects.toMatchObject({ code: "swarm-lei-testimony-absent" });
    }
    expect([...wiki.rows.keys()].filter((t) => t.includes("/lei-returned/") || t.includes("/tessera/"))).toEqual([]);
    await restReceipt(wiki, { tree: TREE, checks: ["typecheck"], verdict: "pass", definitions: DEFS }, PLACE);
    for (const face of faces) await expect(face.begin(), `h${face.n}`).resolves.toMatchObject({ n: 1 });
  });
});
