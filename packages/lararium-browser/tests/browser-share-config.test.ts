/**
 * browser-share-config — THE BROWSER SEATS ITS VERDICT ON BOTH HOOKS.
 *
 * The node cured the announce-only lie (`share-policy-is-access.test.ts`); the browser vessel composed a
 * bare `sharePolicy` and inherited it. `browserShareConfig` seats the identity share decision on
 * `announce` AND `access`, so a relay peer asking by doc id draws the same verdict it would hear announced.
 */
import { describe, expect, test } from "vitest";
import { browserShareConfig } from "../src/open-browser-vessel.js";

describe("browserShareConfig", () => {
  test("a peer the decision refuses is refused on access too", async () => {
    const cfg = browserShareConfig(new Set(["relay"]), null, null);
    // No federation gate and no ring: a relay peer draws the decision's floor on BOTH hooks, identically.
    const a = await cfg.announce("relay" as never, "doc" as never);
    const b = await cfg.access("relay" as never, "doc" as never);
    expect(b).toBe(a);
    // CONTROL: both hooks are the same function — no legacy `() => true` stands behind access.
    expect(cfg.access).toBe(cfg.announce);
  });
});
