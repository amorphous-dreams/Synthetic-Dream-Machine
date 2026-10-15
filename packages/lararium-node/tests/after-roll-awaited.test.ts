/**
 * H2 — `afterRoll` (open-node-vessel.ts) is awaited, serialized and truthful, never fire-and-forget.
 *
 * `afterRoll` is a closure local to `openNodeVessel` (no full boot runs cheaply in a unit test), so
 * this proof reads the real source the same way `a-reading-never-a-throw.test.ts` already does for
 * this file: it asserts the SHAPE the episkopos's H2 cure demands, each assertion load-bearing
 * against a specific regression this iteration measured in production —
 *   · the old `void (async () => { try { … } catch {} })()` IIFE (the fire-and-forget this cure
 *     retires — the reason `represented`/`refolded` always read false) must be GONE;
 *   · `afterRoll` must declare `Promise<boolean>`, so F2's `onRolled` (widened to
 *     `boolean | void | Promise<boolean | void>`) can read a truthful answer;
 *   · the three refold stages must sit in THREE separate `try` blocks (a fault in
 *     `realmPlane.refresh` must not skip `reverdict`/`representIfMoved` — the single-`try` bug);
 *   · every caller (`onRolled`, both `onReconnect` sites) must AWAIT it, not fire it into the void.
 */
import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";

const SRC = readFileSync(new URL("../src/open-node-vessel.ts", import.meta.url), "utf8");

/** The `afterRoll` definition's own body — from its declaration to the closing `};` of the
 *  function assigned to it, read as one block so every assertion below reads THIS region alone. */
function afterRollBody(): string {
  const start = SRC.indexOf("const afterRoll = (nexusAid?: string)");
  expect(start, "open-node-vessel.ts must declare `const afterRoll = (nexusAid?: string)`").toBeGreaterThan(-1);
  const end = SRC.indexOf("\n  };", start);
  expect(end, "afterRoll's definition must close with `};`").toBeGreaterThan(start);
  return SRC.slice(start, end);
}

describe("★ H2 — afterRoll is Promise<boolean>, serialized, and never fire-and-forget ★", () => {
  test("★ the old fire-and-forget IIFE is GONE — no `void (async () => …)()` wraps the refold ★", () => {
    const body = afterRollBody();
    expect(body, "the void-IIFE pattern that made represented/refolded always read false must not return").not.toMatch(/void\s*\(\s*async/);
  });

  test("afterRoll's own signature declares Promise<boolean>", () => {
    expect(SRC).toMatch(/const afterRoll = \(nexusAid\?: string\): Promise<boolean>/);
  });

  test("★ SERIALIZED — one in-flight chain variable both reads and reassigns through .then(...) ★", () => {
    expect(SRC, "a chain variable must stand outside afterRoll, reassigned via .then on every call").toMatch(/let afterRollChain: Promise<boolean>/);
    const body = afterRollBody();
    expect(body).toMatch(/afterRollChain\s*=\s*afterRollChain\.then\(/);
    expect(body).toMatch(/return afterRollChain;/);
  });

  test("★ the single try SPLIT in three — a realm-plane fault must not skip reverdict or representIfMoved ★", () => {
    const body = afterRollBody();
    const tryBlocks = body.match(/\btry\s*{/g) ?? [];
    expect(tryBlocks.length, "antigen/membership, realmPlane.refresh, and representIfMoved each need their OWN try").toBeGreaterThanOrEqual(3);
    // reverdict() must stand UNGUARDED between the realm-plane try and the representIfMoved try —
    // never inside either one, or a fault in either neighbor would skip it again.
    const reverdictIdx = body.indexOf("reverdict();");
    expect(reverdictIdx, "reverdict() must run unconditionally between the two later stages").toBeGreaterThan(-1);
    const before = body.slice(0, reverdictIdx);
    const openTrys = (before.match(/\btry\s*{/g) ?? []).length;
    const closedCatches = (before.match(/}\s*catch/g) ?? []).length;
    expect(openTrys, "reverdict() must sit OUTSIDE any try block (every try before it already closed)").toBe(closedCatches);
  });

  test("★ the return answers ONE question — representIfMoved ran without throwing ★", () => {
    const body = afterRollBody();
    const lastTryIdx = body.lastIndexOf("try {");
    const tail = body.slice(lastTryIdx);
    expect(tail, "the FINAL try block must call representIfMoved and return true on success").toMatch(/representIfMoved\?\.\(\)[\s\S]{0,40}return true;/);
    expect(tail, "the FINAL catch must return false, never rethrow and never return true").toMatch(/catch[\s\S]{0,220}return false;/);
  });

  test("★ every caller AWAITS afterRoll — onRolled (store-door-verbs) and both onReconnect sites ★", () => {
    expect(SRC, "the door table must hand afterRoll straight to onRolled, which F2's rows now await").toMatch(/onRolled:\s*afterRoll,/);
    const onReconnectSites = SRC.match(/onReconnect:\s*async \(\) => \{ await afterRoll\(\); \},/g) ?? [];
    expect(onReconnectSites.length, "both the carriage serve-loop and the nexus dial-out onReconnect must await afterRoll").toBe(2);
    // No onReconnect may still fire it unawaited (`async () => afterRoll(),` with no inner await/braces).
    expect(SRC).not.toMatch(/onReconnect:\s*async \(\) => afterRoll\(\),/);
  });
});
