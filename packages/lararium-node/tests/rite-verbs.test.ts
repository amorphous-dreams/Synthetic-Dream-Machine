/**
 * rite-verbs — the store door names the rite's rows (road L45d): `rite-begin` returns the rite's lei and rests the guest half of
 * its tessera, `rite-land` rests the host half, `rite-receipts` lists the halves and runs conferre. Each acts as a face; none
 * reads hand-only, since the lei carries the grant; with no standing daemon wiki each refuses by name before it loads a face.
 * Every red pairs with a CONTROL. Meme: lar:///ha.ka.ba/lares/docs/pono/seat-harness
 */
import { expect, test } from "vitest";
import { STORE_DOOR_FACE_VERBS, STORE_DOOR_HAND_ONLY_ACTS, STORE_DOOR_VERBS, storeDoorReactors, type StoreDoorDeps } from "../src/store-door-verbs.js";
import { storeVerbGatesFirst, storeVerbNeedsWard } from "../src/ward-credential.js";
import { beginLentFaces, lentOfferFaces } from "../src/commands/rite.js";
import {
  SwarmRefused, beginRite, ed25519SignerFromSeed, ed25519VerifyingKeyFromSeed, placeSignerFromSeed, restReceipt, signSwarmAct, swarmActCid, swarmLeiRecordTitle,
  type SwarmTrust, type SwarmWikiPort,
} from "@lararium/mesh";

const ROWS = ["rite-begin", "rite-land", "rite-receipts", "rite-receipt", "rite-offer"] as const;

test("RED: every rite row is a store-door verb, each acting as a face but the receipt, which the place signs; CONTROL: a seat may run each, and none asks a ward route", () => {
  for (const row of ROWS) {
    expect(STORE_DOOR_VERBS as readonly string[], row).toContain(row);
    // The receipt testifies about a tree, never a face: the place signs it, so it rides no face's session.
    expect(STORE_DOOR_FACE_VERBS.has(row as never), row).toBe(row !== "rite-receipt");
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
  for (const [row, args] of [["rite-begin", { rite: "kukulu", branch: "main", head: "a".repeat(40) }], ["rite-land", { tessera: "c".repeat(64), head: "a".repeat(40) }], ["rite-receipts", {}],
    // receipt-door-signs-the-tree: the receipt's writer rides the same door, open to a seat, with no ward.
    ["rite-receipt", { tree: "b".repeat(40), checks: ["typecheck"], verdict: "pass", definitions: "d".repeat(64) }]] as const) {
    const out = await rows[row](args, worn);
    expect(out["refused"], row).toContain("no standing daemon: a rite's records need the founded wiki");
    expect(out["refusal"], row).toBe(`${row}-refused`);
  }
});

test("RED: the offer gathers every lent face's line, one face each in the lend's order and named by ordinal; CONTROL: no lent face, or a face whose log reads unloadable, refuses by name", async () => {
  const loaded: number[] = [];
  const face = async (ordinal: number) => { loaded.push(ordinal); if (ordinal === 5) throw new Error("no log"); return { group: `g${ordinal}`, trust: { hand: () => true, vessel: () => true, place: () => true, lead: () => false }, ward: { accepts: () => true } }; };
  const faces = await lentOfferFaces([0, 2], face);
  expect(loaded).toEqual([0, 2]);
  expect(faces.map((f) => [f.name, f.group])).toEqual([["h0", "g0"], ["h2", "g2"]]);
  await expect(lentOfferFaces([], face)).rejects.toMatchObject({ code: "lent-faces-empty" });
  await expect(lentOfferFaces([0, 5], face)).rejects.toMatchObject({ code: "face-log-unreadable", message: expect.stringContaining("h5") });
});

test("RED: a kūkulu begins one rite per lent face, each spending that face's own lei; a face whose lei is missing waits by name; CONTROL: every face waiting refuses by the lei's reading, another reading refuses the whole begin, and no lent face refuses", async () => {
  const began: number[] = [];
  const begin = (missing: readonly number[], other: number | null = null) => async (ordinal: number) => {
    if (ordinal === other) throw new SwarmRefused("swarm-lei-returned", "spent");
    if (missing.includes(ordinal)) throw new SwarmRefused("swarm-lei-absent", `no lei of h${ordinal}`);
    began.push(ordinal);
    return { tessera: String(ordinal).repeat(64), rite: "kukulu" as const, lei: "l", n: 1, begun: "b" };
  };
  expect(await beginLentFaces([0, 1, 2], begin([1]))).toEqual({
    rite: "kukulu", faces: [{ face: "h0", ordinal: 0, tessera: "0".repeat(64), lei: "l", n: 1, begun: "b" }, { face: "h2", ordinal: 2, tessera: "2".repeat(64), lei: "l", n: 1, begun: "b" }], waits: ["h1"],
  });
  expect(began).toEqual([0, 2]);
  await expect(beginLentFaces([0, 1], begin([0, 1]))).rejects.toMatchObject({ code: "swarm-lei-absent", message: expect.stringContaining("h0, h1") });
  await expect(beginLentFaces([0, 1], begin([], 1))).rejects.toMatchObject({ code: "swarm-lei-returned" });
  await expect(beginLentFaces([], begin([]))).rejects.toMatchObject({ code: "lent-faces-empty" });
});

/**
 * THE SEAM, measured live on a three-face house: each lent face's kukulu begin verifies `receipt/<tree>` on the ONE shared swarm
 * wiki under its own trust, so a receipt one face signed stood for that face alone. The place signs the receipt once, and every
 * face's trust names the place.
 */
test("RED: three lent faces each hold a kukulu lei and one place-signed passing receipt stands for the tree: the kūkulu begin returns all three faces' leis; CONTROL: no receipt reads absent for every face, a failing one narrows the first face's wide lei, and a receipt a face key signed reads absent", async () => {
  const keyed = async (n: number) => ({ key: await ed25519VerifyingKeyFromSeed(new Uint8Array(32).fill(n)), sign: ed25519SignerFromSeed(new Uint8Array(32).fill(n)) });
  const house = async () => {
    const rows = new Map<string, string>();
    const wiki: SwarmWikiPort = { read: async (t) => rows.get(t) ?? null, write: async (t, x) => { rows.set(t, x); }, writeNew: async (t, x) => (rows.has(t) ? false : (rows.set(t, x), true)),
      list: async (prefix) => [...rows.keys()].filter((t) => t.startsWith(prefix)) };
    const place = placeSignerFromSeed(new Uint8Array(32).fill(77));
    const faces = [];
    for (const ordinal of [0, 1, 2]) {
      const group = `face-group-${ordinal}`, hand = await keyed(10 + ordinal), atom = await keyed(20 + ordinal);
      const trust: SwarmTrust = { hand: (k) => k === hand.key, vessel: (k) => k === atom.key, place: (k) => k === place.key, lead: () => false };
      const lei = await signSwarmAct({ act: "lei", group, rite: "kukulu", branch: "develop", after: null, reach: "wide", returns: 2 }, hand);
      await wiki.write(swarmLeiRecordTitle("kukulu", "develop", swarmActCid(lei)), JSON.stringify(lei));
      faces.push({ group, trust, atom, lei: swarmActCid(lei) });
    }
    const at = { rite: "kukulu" as const, branch: "develop", head: "a".repeat(40), tree: "b".repeat(40) };
    const begin = (ordinal: number) => beginRite(wiki, at, faces[ordinal]!.trust, faces[ordinal]!.group, faces[ordinal]!.atom, { accepts: () => true });
    const receipt = (verdict: "pass" | "fail", by = place) => restReceipt(wiki, { tree: at.tree, checks: ["typecheck"], verdict, definitions: "d".repeat(64) }, by);
    return { rows, faces, begin, receipt };
  };
  const h = await house();
  await h.receipt("pass");
  const begun = await beginLentFaces([0, 1, 2], h.begin);
  expect(begun.waits).toEqual([]);
  expect(begun.faces.map((f) => [f.face, f.lei, f.n])).toEqual(h.faces.map((f, i) => [`h${i}`, f.lei, 1]));
  // CONTROL: no receipt reads absent for every face, and the begin refuses by the testimony's reading.
  const bare = await house();
  await expect(beginLentFaces([0, 1, 2], bare.begin)).rejects.toMatchObject({ code: "swarm-lei-testimony-absent" });
  // CONTROL: a failing receipt narrows the wide lei it meets first (the begin refuses the whole kūkulu there).
  const red = await house();
  await red.receipt("fail");
  await expect(beginLentFaces([0, 1, 2], red.begin)).rejects.toMatchObject({ code: "swarm-lei-testimony-red" });
  expect([...red.rows.keys()].some((t) => t.includes(`/lei-narrowed/${red.faces[0]!.lei}`))).toBe(true);
  // CONTROL: a receipt face h0's own device atom signed stands for no face, h0's included.
  const faceSigned = await house();
  await faceSigned.receipt("pass", placeSignerFromSeed(new Uint8Array(32).fill(20)));
  for (const ordinal of [0, 1, 2]) await expect(faceSigned.begin(ordinal), `h${ordinal}`).rejects.toMatchObject({ code: "swarm-lei-testimony-absent" });
});
