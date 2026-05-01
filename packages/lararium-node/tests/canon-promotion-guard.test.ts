/**
 * Keyhive promotion seam tests.
 *
 * The old direct promotion guard/HTTP ceremony has been removed.
 * These tests pin the new state: promotion requests have a named shape, but no
 * runtime path can mutate canon until Keyhive membership/capability receipts land.
 */

import { requestKeyhivePromotion } from "@lararium/core";

describe("requestKeyhivePromotion — stub", () => {
  it("rejects all promotion requests until Keyhive is wired", async () => {
    await expect(requestKeyhivePromotion({
      fromUri:      "lar:///draft/example",
      targetUri:    "lar:///AGENTS",
      roomId:       "altar-fire",
      proposedText: "draft text",
      reason:       "test",
    })).resolves.toEqual({
      ok: false,
      status: "not-implemented",
      reason: "keyhive-promotion-graph-not-wired",
    });
  });
});
