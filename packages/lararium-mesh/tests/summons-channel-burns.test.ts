/**
 * summons-channel-burns — no remote summons channel stands. Nothing in the runtime wrote a summons (the record served a remote
 * peer, and early alpha holds none), so the title family, its builder and the dispatcher's replay scan all burn: a record
 * shaped as the old summons parses as no verb, so nothing a store carries at that title ever dispatches.
 */
import { describe, expect, test } from "vitest";
import * as verbTiddler from "../src/verb-tiddler.js";
import { isResidencyActionUri } from "../src/residency-actions.js";
import { LARES_VERB_TAG } from "../src/lar-uris.js";

describe("the summons channel burns", () => {
  test("RED: verb-tiddler exports no summons title family and no summons builder", () => {
    expect("SUMMONS_URI_PREFIX" in verbTiddler).toBe(false);
    expect("summon" in verbTiddler).toBe(false);
  });

  test("RED: a pending record at the old summons title parses as no verb and names no action", () => {
    const title = "lar:///ha.ka.ba/bags/control/summons/r1";
    const fields = { title, tags: LARES_VERB_TAG, verb: "status", "request-id": "r1", status: "pending", args: "{}", targets: "[]" };
    expect(verbTiddler.parseVerb(fields)).toBeNull();
    expect(isResidencyActionUri(title)).toBe(false);
  });

  test("CONTROL: a volatile invocation still parses", () => {
    const fields = verbTiddler.buildVerb({ verb: "status", args: {}, requestedBy: "did:key:z" });
    expect(verbTiddler.parseVerb(fields)?.action).toBe("status");
  });
});
