/**
 * rite-verbs — the store door names the rite's rows (road L45d): `rite-begin` returns the rite's lei and rests the guest half of
 * its tessera, `rite-land` rests the host half, `rite-receipts` lists the halves and runs conferre. Each acts as a face; none
 * reads hand-only, since the lei carries the grant; with no standing daemon wiki each refuses by name before it loads a face.
 * Every red pairs with a CONTROL. Meme: lar:///ha.ka.ba/lares/docs/pono/seat-harness
 */
import { expect, test } from "vitest";
import { STORE_DOOR_FACE_VERBS, STORE_DOOR_HAND_ONLY_ACTS, STORE_DOOR_VERBS, storeDoorReactors, type StoreDoorDeps } from "../src/store-door-verbs.js";
import { storeVerbGatesFirst, storeVerbNeedsWard } from "../src/ward-credential.js";
import { lentOfferFaces } from "../src/commands/rite.js";

const ROWS = ["rite-begin", "rite-land", "rite-receipts", "rite-receipt", "rite-offer"] as const;

test("RED: every rite row is a store-door verb that acts as a face; CONTROL: a seat may run each, and none asks a ward route", () => {
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
  const face = async (ordinal: number) => { loaded.push(ordinal); if (ordinal === 5) throw new Error("no log"); return { group: `g${ordinal}`, trust: { hand: () => true, vessel: () => true, lead: () => false }, ward: { accepts: () => true } }; };
  const faces = await lentOfferFaces([0, 2], face);
  expect(loaded).toEqual([0, 2]);
  expect(faces.map((f) => [f.name, f.group])).toEqual([["h0", "g0"], ["h2", "g2"]]);
  await expect(lentOfferFaces([], face)).rejects.toMatchObject({ code: "lent-faces-empty" });
  await expect(lentOfferFaces([0, 5], face)).rejects.toMatchObject({ code: "face-log-unreadable", message: expect.stringContaining("h5") });
});
