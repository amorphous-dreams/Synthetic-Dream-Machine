/**
 * relink-sigil-module.test.ts — the house's `relinkwikitextrule` module (`relink/relink-sigil`) answers for ONE opener and
 * never aborts Relink's walk of the record around it: an opener its reading throws on answers `impossible` and the walker
 * resumes past the match, so the rest of the record still relinks.
 */
import { describe, test, expect } from "vitest";
import { relink, report } from "../src/relink/relink-sigil.js";

/** A rule whose match state throws when read, standing in for an opener the reading cannot take. */
function brokenRule() {
  const source = "<<~ loulou uri=`lar:///t/old`>> and [[lar:///t/old]]";
  return {
    parser: { source, pos: 0 },
    matchPos: 0,
    matchEnd: 31,
    attrs: new Proxy({} as Record<string, string>, { has() { throw new Error("malformed opener"); } }),
  };
}

describe("relink/relink-sigil", () => {
  test("an opener the reading throws on answers impossible and the walk resumes past its match", () => {
    const rule = brokenRule();
    expect(relink.call(rule, rule.parser.source, "lar:///t/old", "lar:///t/new")).toEqual({ impossible: true });
    expect(rule.parser.pos).toBe(31);
  });

  test("the report of such an opener names nothing and resumes past its match", () => {
    const rule = brokenRule();
    const named: string[] = [];
    expect(() => report.call(rule, rule.parser.source, (title) => { named.push(title); })).not.toThrow();
    expect(named).toEqual([]);
    expect(rule.parser.pos).toBe(31);
  });

  test("CONTROL: a well-formed opener relinks and resumes at its end", () => {
    const source = "<<~ loulou uri=`lar:///t/old`>> and [[lar:///t/old]]";
    const rule = { parser: { source, pos: 0 }, matchPos: 0, matchEnd: 31, attrs: { __compound__: "loulou" } };
    expect(relink.call(rule, source, "lar:///t/old", "lar:///t/new")).toEqual({ output: "<<~ loulou uri=`lar:///t/new`>>" });
    expect(rule.parser.pos).toBe(31);
  });
});
