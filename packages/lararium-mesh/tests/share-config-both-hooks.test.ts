/**
 * share-config-both-hooks — THE VERDICT SEATS ON ANNOUNCE AND ACCESS, ON EVERY VESSEL.
 *
 * automerge-repo maps a legacy `sharePolicy` to `{ announce: policy, access: () => true }`, so a peer that
 * ASKS for a doc by id pulls it past a denying policy. The node seats one verdict on both hooks
 * (`share-policy-is-access.test.ts`); the browser composed its own `sharePolicy` and inherited the lie.
 * The law lives once, in mesh, and both vessels compose it.
 */
import { describe, expect, test } from "vitest";
import { shareConfigOf } from "../src/federation-gate.js";

describe("shareConfigOf", () => {
  test("one verdict, both hooks", async () => {
    const cfg = shareConfigOf(async (peer) => peer === ("friend" as never));
    expect(await cfg.announce("friend" as never)).toBe(true);
    expect(await cfg.access("friend" as never)).toBe(true);
    expect(await cfg.announce("stranger" as never)).toBe(false);
    // The lie: access would read true here under a legacy sharePolicy.
    expect(await cfg.access("stranger" as never)).toBe(false);
  });
});
