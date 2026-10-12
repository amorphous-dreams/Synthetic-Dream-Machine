/**
 * A BOOT FAULT MUST NAME THE CONDITION IT OBSERVED.
 *
 * ── THE FAULT THIS FILE REFUSES ──────────────────────────────────────────────────────────────────────────
 * `resolveBootDoc` reaches its throw down TWO different paths and threw ONE verdict:
 *
 *   · the library answered TERMINALLY — `unavailable`/`failed`. No peer will ever carry it.
 *   · the DEADLINE expired. The library said nothing at all; the doc simply had not resolved yet.
 *
 * Both produced "local corruption (no peer carries it)", which mislabels a timeout as store damage and
 * recommends a recovery that can destroy a healthy store.
 *
 * MEASURED: the docker mesh's one hearth died this way on every cold start beside three sibling vessels,
 * on a STABLE document id, through three restarts — and stood clean the moment it booted alone. Nothing
 * was corrupt. The store was fine and the deadline was not.
 *
 * ── THE LAW ──────────────────────────────────────────────────────────────────────────────────────────────
 * A verdict may assert only what the observation supports. `unavailable` is a library ANSWER and may be
 * reported as one; a deadline is OUR patience running out and names nothing about the store. Collapsing
 * them buys one branch and spends the operator's data.
 *
 * This is the house's own recurring shape — a reading that reports one cause for two conditions — and here
 * the wrong cause is the destructive one.
 */

import { describe, test, expect } from "vitest";
import { bootFaultVerdict } from "../src/boot-resolver.js";

describe("a boot fault names the condition it observed", () => {
  test("a TERMINAL answer may say the library refused it", () => {
    const v = bootFaultVerdict({ reason: "terminal", label: "@daemon", url: "automerge:abc" });
    expect(v.reason).toBe("doc-unavailable");
    expect(v.message).toMatch(/no peer carries it/);
  });

  test("★ a DEADLINE must NOT claim corruption — the store said nothing at all ★", () => {
    const v = bootFaultVerdict({ reason: "deadline", label: "@daemon", url: "automerge:abc", waitedMs: 15_000 });
    expect(v.message).not.toMatch(/corrupt/i);
    expect(v.message).not.toMatch(/no peer carries it/);
    expect(v.reason).toBe("resolve-timeout");
  });

  test("★ a deadline names a direct recovery without a vessel wipe rite ★", () => {
    const v = bootFaultVerdict({ reason: "deadline", label: "@daemon", url: "automerge:abc", waitedMs: 15_000 });
    expect(v.message).not.toMatch(/rebirth/);
    expect(v.message).not.toMatch(/clear/);
  });

  test("a deadline verdict carries what it actually waited, and a cure that costs nothing", () => {
    const v = bootFaultVerdict({ reason: "deadline", label: "@daemon", url: "automerge:abc", waitedMs: 15_000 });
    expect(v.message).toMatch(/15000|15s/);
    // Reading again is free and may simply succeed; that is the honest first move for a timeout.
    expect(v.message).toMatch(/again|retry|stand/i);
  });

  test("a terminal verdict names carrier restoration and seeding when the local read is absent", () => {
    const v = bootFaultVerdict({ reason: "terminal", label: "@daemon", url: "automerge:abc" });
    expect(v.message).toMatch(/vessel read vessel/);
    expect(v.message).toMatch(/restore a known-good carrier/);
    expect(v.message).toMatch(/vessel seed --apply --yes/);
    expect(v.message).toMatch(/lares vessel found --root <fresh-root>/);
  });

  test("both verdicts name the doc, so the operator knows WHICH plane refused", () => {
    for (const reason of ["terminal", "deadline"] as const) {
      const v = bootFaultVerdict({ reason, label: "@daemon", url: "automerge:abc", waitedMs: 1 });
      expect(v.message).toContain("@daemon");
      expect(v.message).toContain("automerge:abc");
      // The reason stays a branch token; prose lives in the message alone.
      expect(v.reason).toMatch(/^[a-z][a-z0-9-]*$/);
    }
  });

  test("★ the terminal verdict never claims the store HOLDS the doc ★", () => {
    // The branch knows the library answered UNAVAILABLE. It never read the store, and a vessel with a
    // perfectly healthy store reaches here whenever a pointer outlived its document. Asserting the
    // store's contents sends that operator to a destructive rite for a one-file fault.
    const v = bootFaultVerdict({ reason: "terminal", label: "@catalog", url: "automerge:abc" });
    expect(v.message).not.toMatch(/the store holds it/i);
  });

  test("★ the terminal verdict reads local state before naming its recovery ★", () => {
    const v = bootFaultVerdict({ reason: "terminal", label: "@catalog", url: "automerge:abc" });
    const readAt = v.message.search(/vessel read vessel/);
    expect(readAt).toBeGreaterThan(-1);
    expect(v.message.indexOf("restore a known-good carrier")).toBeGreaterThan(readAt);
    expect(v.message).not.toMatch(/rite rebirth|vessel clear/);
  });
});
