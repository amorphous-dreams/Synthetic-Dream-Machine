/**
 * store-door-verbs-represented.test.ts — `nexus-admit-take` reports `represented` TRUTHFULLY, and awaits an
 * ASYNC hook to its own settle rather than reading a sync return alone.
 *
 * A vessel standing proves this row could TRY to re-present, never that it DID. `represented` therefore
 * reads the hook's own claim, and a hook still running is waited on (the caller's own socket wait is the LIVENESS bound).
 *
 * Proven:
 *   · a vessel stands (`onRolled` merely EXISTS and returns nothing): `represented: false`, because the
 *     hook gave no truthful claim.
 *   · `onRolled` returning `true` SYNCHRONOUSLY is read as `represented: true`.
 *   · `onRolled` returning a PROMISE that resolves `true` within the budget is read as `represented: true`.
 *   · `onRolled` returning a promise that settles late (past any clock) is read by its OWN settle: no timer answers for the hook.
 *   · no vessel standing (`storeDoorDirect`'s shape — `onRolled` absent) reads `represented: false`.
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
  it("a hook that merely EXISTS (returns nothing) does not read as represented", async () => {
    const onRolled = vi.fn(() => { /* a hook that returns nothing — the real vessel's `afterRoll` is an awaited,
      serialized `Promise<boolean>` (F1) */ });
    const rows = storeDoorReactors(baseDeps(onRolled));
    const out = await rows["nexus-admit-take"]({ raw: "{}" }, {} as never);
    expect(onRolled).toHaveBeenCalledTimes(1);
    expect(out["represented"]).toBe(false);            // no claim was made, so nothing reads as represented
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

  it("a SLOW hook reads its OWN settle, never a clock's \"pending\": the refold ending after 3 s still answers true", async () => {
    vi.useFakeTimers();
    try {
      let settle: (v: boolean) => void = () => {};
      const onRolled = vi.fn(() => new Promise<boolean>((resolve) => { settle = resolve; }));
      const rows = storeDoorReactors(baseDeps(onRolled));
      let out: Record<string, unknown> | undefined;
      const outP = rows["nexus-admit-take"]({ raw: "{}" }, {} as never).then((o) => { out = o; });
      await vi.advanceTimersByTimeAsync(30_000);
      expect(out).toBeUndefined();                 // no clock answered for the hook
      settle(true);
      await outP;
      expect(out?.["represented"]).toBe(true);
    } finally { vi.useRealTimers(); }
  });

  it("CONTROL: a hook that REJECTS reads represented false, and the rejection never surfaces", async () => {
    const onRolled = vi.fn(async () => { throw new Error("refold fell"); });
    const rows = storeDoorReactors(baseDeps(onRolled));
    const out = await rows["nexus-admit-take"]({ raw: "{}" }, {} as never);
    expect(out["represented"]).toBe(false);
  });

  it("no vessel standing (no hook at all) reads as NOT represented", async () => {
    const rows = storeDoorReactors(baseDeps(undefined));
    const out = await rows["nexus-admit-take"]({ raw: "{}" }, {} as never);
    expect(out["represented"]).toBe(false);
  });
});
