/**
 * store-door-verbs-represented.test.ts — L2: `nexus-admit-take` reports `represented` TRUTHFULLY.
 *
 * Before this fix, `represented` read `deps.onRolled !== undefined` — true whenever a vessel merely STANDS
 * over the row, regardless of whether the live re-presentation it triggers ever lands. That let the e2e
 * measure built on it pass even when re-presentation failed outright: a vessel standing proves this row could
 * TRY to re-present, never that it DID.
 *
 * Proven:
 *   · RED (the exact prior bug, re-enacted below as a mutation proof): a vessel stands (`onRolled` merely
 *     EXISTS and returns nothing) — the old shape reads `represented: true`; CONTROL for the fix: the same
 *     call now reads `represented: false`, because the hook gave no truthful claim.
 *   · `onRolled` returning `true` is read as `represented: true` — a hook CAN claim success, honestly.
 *   · no vessel standing (`storeDoorDirect`'s shape — `onRolled` absent) reads `represented: false`, as before.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("../src/admit-bundle.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/admit-bundle.js")>();
  return {
    ...actual,
    takeAdmitBundle: vi.fn(async () => ({
      aid: "a".repeat(64), nym: "n".repeat(64), admitCid: "c".repeat(64), gatePubKey: "g".repeat(64),
      lineage: 1, path: "/tmp/fake-admit.json",
    })),
  };
});

import { storeDoorReactors, type StoreDoorDeps } from "../src/store-door-verbs.js";

const baseDeps = (onRolled?: StoreDoorDeps["onRolled"]): StoreDoorDeps => ({
  storageDir: "/tmp/unused", sealHome: "/tmp/unused-seal",
  repo: {} as StoreDoorDeps["repo"], dialGate: () => null,
  ...(onRolled ? { onRolled } : {}),
});

describe("nexus-admit-take — `represented` reads the hook's OWN claim (L2)", () => {
  it("MUTATION PROOF of the retired bug: a hook that merely EXISTS (returns nothing) no longer reads as represented", async () => {
    const onRolled = vi.fn(() => { /* a real vessel's refold is fire-and-forget — no return */ });
    const rows = storeDoorReactors(baseDeps(onRolled));
    const out = await rows["nexus-admit-take"]({ raw: "{}" }, {} as never);
    expect(onRolled).toHaveBeenCalledTimes(1);
    // THE OLD SHAPE would have read `true` here purely because `onRolled` exists. Re-enacting it:
    const oldShapeRepresented = onRolled !== undefined;
    expect(oldShapeRepresented).toBe(true);           // the old reading — proves the bug this guards against
    expect(out["represented"]).toBe(false);            // the new, truthful reading: no claim was ever made
  });

  it("CONTROL: a hook that truthfully claims success (`true`) reads as represented", async () => {
    const onRolled = vi.fn(() => true);
    const rows = storeDoorReactors(baseDeps(onRolled));
    const out = await rows["nexus-admit-take"]({ raw: "{}" }, {} as never);
    expect(out["represented"]).toBe(true);
  });

  it("no vessel standing (no hook at all) reads as NOT represented, as it always did", async () => {
    const rows = storeDoorReactors(baseDeps(undefined));
    const out = await rows["nexus-admit-take"]({ raw: "{}" }, {} as never);
    expect(out["represented"]).toBe(false);
  });
});
