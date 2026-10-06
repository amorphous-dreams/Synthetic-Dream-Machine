import { describe, expect, test } from "vitest";
import {
  carriageEntryActCid,
  foldCarriageDetails,
  foldCarriageSet,
  type CarriageEntry,
} from "../src/carriage-registry.js";
import type { KahuRoster } from "../src/kapae-antigen.js";
import { kahuRoster, carriageAct } from "./fixtures/carriage.js";

const EPOCH = "epoch-cid-genesis";
const SEEDS = {
  guru: new Uint8Array(32).fill(1),
  telarus: new Uint8Array(32).fill(2),
  joiner: new Uint8Array(32).fill(5),
};

function roster(): Promise<KahuRoster> {
  return kahuRoster([SEEDS.guru, SEEDS.telarus], 2, EPOCH);
}

function act(
  action: "admit" | "revoke",
  parents: readonly string[] = [],
): Promise<CarriageEntry> {
  return carriageAct(SEEDS.joiner, action, { kahu: [SEEDS.guru, SEEDS.telarus], epoch: EPOCH, parents });
}

describe("causal carriage evidence", () => {
  test("semantic act CIDs are stable and parents are signed", async () => {
    const root = await act("admit");
    expect(carriageEntryActCid(root)).toMatch(/^[0-9a-f]{64}$/);
    expect(carriageEntryActCid({ ...root, signatures: [...root.signatures].reverse() })).toBe(carriageEntryActCid(root));
    expect(carriageEntryActCid({ ...root, parents: ["different"] })).not.toBe(carriageEntryActCid(root));
  });

  test("a descendant admit supersedes its parent without a numeric version", async () => {
    const root = await act("admit");
    const child = await act("admit", [carriageEntryActCid(root)]);
    const details = await foldCarriageDetails([root, child], await roster());
    const rootDetail = details.entries.find((e) => e.evidenceCid === carriageEntryActCid(root));
    const childDetail = details.entries.find((e) => e.evidenceCid === carriageEntryActCid(child));
    expect(rootDetail).toMatchObject({ state: "ignored", reason: "superseded-by-descendant" });
    expect(childDetail).toMatchObject({ state: "accepted" });
    expect((await foldCarriageSet([root, child], await roster())).has(root.nym)).toBe(true);
  });

  test("a descendant revoke removes an admitted relation", async () => {
    const root = await act("admit");
    const revoke = await act("revoke", [carriageEntryActCid(root)]);
    const details = await foldCarriageDetails([root, revoke], await roster());
    expect(details.entries.find((e) => e.evidenceCid === carriageEntryActCid(revoke))).toMatchObject({ state: "revoked" });
    expect((await foldCarriageSet([root, revoke], await roster())).has(root.nym)).toBe(false);
  });

  test("missing parents remain unavailable and never become a head", async () => {
    const child = await act("admit", ["aa".repeat(32)]);
    const details = await foldCarriageDetails([child], await roster());
    expect(details.entries[0]).toMatchObject({ counted: false, reason: "missing-parent" });
    expect((await foldCarriageSet([child], await roster())).size).toBe(0);
  });

  test("unavailable parent closure invalidates every descendant", async () => {
    const child = await act("admit", ["aa".repeat(32)]);
    const grandchild = await act("revoke", [carriageEntryActCid(child)]);
    const details = await foldCarriageDetails([child, grandchild], await roster());
    expect(details.entries).toEqual(expect.arrayContaining([
      expect.objectContaining({ evidenceCid: carriageEntryActCid(child), state: "unavailable", reason: "missing-parent" }),
      expect.objectContaining({ evidenceCid: carriageEntryActCid(grandchild), state: "unavailable", reason: "missing-parent" }),
    ]));
  });

  test("concurrent contradictory acts remain unsettled, preserving both branches", async () => {
    const root = await act("admit");
    const parent = carriageEntryActCid(root);
    const revoke = await act("revoke", [parent]);
    const re_admit = await act("admit", [parent]);
    const details = await foldCarriageDetails([root, revoke, re_admit], await roster());
    expect(details.entries.filter((e) => e.evidenceCid === carriageEntryActCid(revoke) || e.evidenceCid === carriageEntryActCid(re_admit)))
      .toEqual(expect.arrayContaining([
        expect.objectContaining({ state: "unsettled" }),
        expect.objectContaining({ state: "unsettled" }),
      ]));
    expect((await foldCarriageSet([root, revoke, re_admit], await roster())).has(root.nym)).toBe(false);
  });
});
