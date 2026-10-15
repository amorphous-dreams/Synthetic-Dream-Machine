/**
 * The control-plane records carry `disk-projection: "no"` at their makers: a receipt fact and a verb summons
 * never project to a disk mirror, and `neverProjects` names their addresses, so the inbound gate refuses a
 * file standing there.
 */
import { describe, expect, test } from "vitest";
import {
  RECEIPT_FACT_URI_PREFIX, SUMMONS_URI_PREFIX, WARD_AUDIT_URI_PREFIX, buildReceiptFact, neverProjects, summon,
} from "../src/verb-tiddler.js";

describe("control-plane records never project", () => {
  test("a receipt fact carries the opt-out and stands at a never-projected address", () => {
    const fact = buildReceiptFact({ requestId: "r1", state: "committed", seq: 0, inputDigest: "d" });
    expect(fact.tiddler["disk-projection"]).toBe("no");
    expect(fact.tiddler.title.startsWith(RECEIPT_FACT_URI_PREFIX)).toBe(true);
    expect(neverProjects(fact.tiddler.title)).toBe(true);
  });

  test("a verb summons carries the opt-out and stands at a never-projected address", () => {
    const record = summon({ verb: "v", args: {}, requestedBy: "did:key:z", requestId: "s1" });
    expect(record.tiddler["disk-projection"]).toBe("no");
    expect(record.tiddler.title.startsWith(SUMMONS_URI_PREFIX)).toBe(true);
    expect(neverProjects(record.tiddler.title)).toBe(true);
  });

  test("the ward-audit prefix reads never-projected; CONTROL: an ordinary title does not", () => {
    expect(neverProjects(`${WARD_AUDIT_URI_PREFIX}a1`)).toBe(true);
    expect(neverProjects("lar:///ha.ka.ba/lares/docs/an-ordinary-carrier")).toBe(false);
  });
});
