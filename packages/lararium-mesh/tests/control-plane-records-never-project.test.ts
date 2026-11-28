import { describe, expect, test } from "vitest";
import { PROJECTION_FILTER_TEXT, projectionWithheld } from "../src/projection-filter.js";
import { RECEIPT_FACT_URI_PREFIX, buildReceiptFact } from "../src/verb-tiddler.js";

describe("record titles do not decide residency", () => {
  test("receipt titles remain ordinary content under the default filter", () => {
    const fact = buildReceiptFact({ requestId: "r1", state: "committed", seq: 0, inputDigest: "d" });
    expect(fact.tiddler.title.startsWith(RECEIPT_FACT_URI_PREFIX)).toBe(true);
    for (const title of [fact.tiddler.title]) {
      expect(projectionWithheld(title), title).toBe(false);
    }
    expect(PROJECTION_FILTER_TEXT.base).not.toContain("daemon");
  });
});
