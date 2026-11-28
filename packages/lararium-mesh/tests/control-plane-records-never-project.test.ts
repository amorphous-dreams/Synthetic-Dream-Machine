import { describe, expect, test } from "vitest";
import { PROJECTION_FILTER_TEXT, projectionWithheld } from "../src/projection-filter.js";
import { OUTCOME_URI_PREFIX, SUMMONS_URI_PREFIX, WARD_AUDIT_URI_PREFIX, concludeVerb, summon, verdictRowOf } from "../src/verb-tiddler.js";

describe("record titles do not decide residency", () => {
  test("verdict row, summons and audit titles remain ordinary content under the default filter", () => {
    const fact = verdictRowOf(concludeVerb({ requestId: "r1", verb: "load", status: "done", cause: "c", batchMode: "best-effort" }));
    const record = summon({ verb: "v", args: {}, requestedBy: "did:key:z", requestId: "s1" });
    expect(String(fact.tiddler.title).startsWith(OUTCOME_URI_PREFIX)).toBe(true);
    expect(record.tiddler.title.startsWith(SUMMONS_URI_PREFIX)).toBe(true);
    for (const title of [String(fact.tiddler.title), record.tiddler.title, `${WARD_AUDIT_URI_PREFIX}a1`]) {
      expect(projectionWithheld(title), title).toBe(false);
    }
    expect(PROJECTION_FILTER_TEXT.base).not.toContain("daemon");
  });
});
