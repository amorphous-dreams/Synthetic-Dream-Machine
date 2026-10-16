/**
 * store-door-verbs-represented.test.ts — L2 plus F2-1 (H2): `nexus-admit-take` reports `represented` TRUTHFULLY,
 * and now awaits an ASYNC hook under `ON_ROLLED_BUDGET_MS` rather than reading a sync return alone.
 *
 * Before L2's fix, `represented` read `deps.onRolled !== undefined` — true whenever a vessel merely STANDS
 * over the row, regardless of whether the live re-presentation it triggers ever lands. That let the e2e
 * measure built on it pass even when re-presentation failed outright: a vessel standing proves this row could
 * TRY to re-present, never that it DID.
 *
 * F2-1 widens `onRolled` to admit a promise (`open-node-vessel.ts`'s `afterRoll` now returns one), so this row
 * must await it rather than read a synchronous return alone — and a hook still running past the budget must
 * read `"pending"`, never guess `true` or `false`.
 *
 * Proven:
 *   · RED (the exact prior bug, re-enacted below as a mutation proof): a vessel stands (`onRolled` merely
 *     EXISTS and returns nothing) — the old shape reads `represented: true`; CONTROL for the fix: the same
 *     call now reads `represented: false`, because the hook gave no truthful claim.
 *   · `onRolled` returning `true` SYNCHRONOUSLY is read as `represented: true`.
 *   · `onRolled` returning a PROMISE that resolves `true` within the budget is read as `represented: true`.
 *   · `onRolled` returning a promise that never settles within the budget is read as `represented: "pending"`
 *     — never `true` (no evidence) and never `false` (the refold may yet land).
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
  repo: {} as StoreDoorDeps["repo"],
  ...(onRolled ? { onRolled } : {}),
});

describe("nexus-admit-take — `represented` reads the hook's OWN claim (L2, F2-1)", () => {
  it("MUTATION PROOF: a hook that merely EXISTS (returns nothing) does not read as represented", async () => {
    const onRolled = vi.fn(() => { /* the mutant: a hook that merely EXISTS and returns nothing — the real
      vessel's `afterRoll` is an awaited, serialized `Promise<boolean>` (F1); this enacts the mutant on purpose */ });
    const rows = storeDoorReactors(baseDeps(onRolled));
    const out = await rows["nexus-admit-take"]({ raw: "{}" }, {} as never);
    expect(onRolled).toHaveBeenCalledTimes(1);
    // THE OLD SHAPE would have read `true` here purely because `onRolled` exists. Re-enacting it:
    const oldShapeRepresented = onRolled !== undefined;
    expect(oldShapeRepresented).toBe(true);           // the old reading — proves the bug this guards against
    expect(out["represented"]).toBe(false);            // the new, truthful reading: no claim was ever made
  });

  it("CONTROL: a hook that truthfully claims success SYNCHRONOUSLY (`true`) reads as represented", async () => {
    const onRolled = vi.fn(() => true);
    const rows = storeDoorReactors(baseDeps(onRolled));
    const out = await rows["nexus-admit-take"]({ raw: "{}" }, {} as never);
    expect(out["represented"]).toBe(true);
  });

  it("an ASYNC hook resolving `true` within the budget reads as represented", async () => {
    const onRolled = vi.fn(async () => true);
    const rows = storeDoorReactors(baseDeps(onRolled));
    const out = await rows["nexus-admit-take"]({ raw: "{}" }, {} as never);
    expect(out["represented"]).toBe(true);
  });

  it("an async hook that resolves VOID within the budget reads as NOT represented, never `pending`", async () => {
    const onRolled = vi.fn(async () => { /* resolves with no claim */ });
    const rows = storeDoorReactors(baseDeps(onRolled));
    const out = await rows["nexus-admit-take"]({ raw: "{}" }, {} as never);
    expect(out["represented"]).toBe(false);
  });

  it("a PENDING hook — still unsettled past the budget — reads as represented: \"pending\", never guessed either way", async () => {
    vi.useFakeTimers();
    try {
      let settle: (v: boolean) => void = () => {};
      const onRolled = vi.fn(() => new Promise<boolean>((resolve) => { settle = resolve; }));
      const rows = storeDoorReactors(baseDeps(onRolled));
      const outP = rows["nexus-admit-take"]({ raw: "{}" }, {} as never);
      await vi.advanceTimersByTimeAsync(3_000);
      const out = await outP;
      expect(out["represented"]).toBe("pending");
      // The refold itself kept running; settling it late must never surface as an unhandled rejection or throw.
      settle(true);
      await vi.advanceTimersByTimeAsync(0);
    } finally { vi.useRealTimers(); }
  });

  it("no vessel standing (no hook at all) reads as NOT represented, as it always did", async () => {
    const rows = storeDoorReactors(baseDeps(undefined));
    const out = await rows["nexus-admit-take"]({ raw: "{}" }, {} as never);
    expect(out["represented"]).toBe(false);
  });
});
