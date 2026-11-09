import { describe, expect, test } from "vitest";
import { PROJECTION_FILTER_TEXT, projectionWithheld } from "../src/projection-filter.js";
import { RECEIPT_FACT_URI_PREFIX, SUMMONS_URI_PREFIX, WARD_AUDIT_URI_PREFIX, buildReceiptFact, summon } from "../src/verb-tiddler.js";

describe("record titles do not decide residency", () => {
  test("receipt, summons and audit titles remain ordinary content under the default filter", () => {
    const fact = buildReceiptFact({ requestId: "r1", state: "committed", seq: 0, inputDigest: "d" });
    const record = summon({ verb: "v", args: {}, requestedBy: "did:key:z", requestId: "s1" });
    expect(fact.tiddler.title.startsWith(RECEIPT_FACT_URI_PREFIX)).toBe(true);
    expect(record.tiddler.title.startsWith(SUMMONS_URI_PREFIX)).toBe(true);
    for (const title of [fact.tiddler.title, record.tiddler.title, `${WARD_AUDIT_URI_PREFIX}a1`]) {
      expect(projectionWithheld(title), title).toBe(false);
    }
    expect(PROJECTION_FILTER_TEXT.base).not.toContain("daemon");
  });
});
