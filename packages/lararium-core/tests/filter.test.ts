import { describe, test, expect } from "@jest/globals";
import { parseFilter, applyFilter, filterEntries, type FilterExpression } from "../src/filter.js";
import type { ClosureEntry } from "../src/compiler.js";

// ---------------------------------------------------------------------------
// Fixture: minimal closure resembling the real boot artifact
// ---------------------------------------------------------------------------

function makeEntry(overrides: Partial<ClosureEntry>): ClosureEntry {
  return Object.freeze({
    uri: "lar:///AGENTS",
    laresRelPath: "lares/AGENTS.md",
    kind: "meme",
    virtual: false,
    exists: true,
    role: "threshold constitution",
    hydrationSocket: "entry",
    implements: [],
    contentHash: "abc123",
    depth: 0,
    ...overrides,
  } as ClosureEntry);
}

const ENTRIES: ClosureEntry[] = [
  makeEntry({ uri: "lar:///AGENTS",                      depth: 0, kind: "meme",      implements: ["lar:///ha.ka.ba/api/v0.1/pono/meme"] }),
  makeEntry({ uri: "lar:///ha.ka.ba/api/v0.1/mu",        depth: 1, kind: "meme",      implements: ["lar:///ha.ka.ba/api/v0.1/pono/meme", "lar:///ha.ka.ba/api/v0.1/pono/invariant"] }),
  makeEntry({ uri: "lar:///LARES",                        depth: 1, kind: "data",      implements: [] }),
  makeEntry({ uri: "lar:///ha.ka.ba/api/v0.1/lararium", depth: 2, kind: "meme",      implements: ["lar:///ha.ka.ba/api/v0.1/pono/meme"] }),
  makeEntry({ uri: "lar:///ha.ka.ba/api/v0.1/pono/invariant", depth: 3, kind: "data", implements: ["lar:///ha.ka.ba/api/v0.1/pono/meme"] }),
];

// ---------------------------------------------------------------------------
// parseFilter
// ---------------------------------------------------------------------------

describe("parseFilter", () => {
  test("parses [all[memes]]", () => {
    const expr = parseFilter("[all[memes]]");
    expect(expr).toHaveLength(1);
    expect(expr[0]!.op).toBe("all");
  });

  test("parses multi-step [all[memes]sort[depth]limit[3]]", () => {
    const expr = parseFilter("[all[memes]sort[depth]limit[3]]");
    expect(expr).toHaveLength(3);
    expect(expr.map((s) => s.op)).toEqual(["all", "sort", "limit"]);
  });

  test("parses [tag[lar:///pono/invariant]]", () => {
    const expr = parseFilter("[tag[lar:///pono/invariant]]");
    expect(expr[0]!.op).toBe("implements");
    if (expr[0]!.op === "implements") expect(expr[0]!.operand).toBe("lar:///pono/invariant");
  });

  test("parses [entry[]]", () => {
    const expr = parseFilter("[entry[]]");
    expect(expr[0]!.op).toBe("entry");
  });

  test("parses bare [entry] without inner brackets", () => {
    const expr = parseFilter("[entry]");
    expect(expr[0]!.op).toBe("entry");
  });

  test("parses [depth[2]]", () => {
    const expr = parseFilter("[depth[2]]");
    expect(expr[0]!.op).toBe("depth");
    if (expr[0]!.op === "depth") expect(expr[0]!.operand).toBe(2);
  });

  test("parses [uri[LARES]]", () => {
    const expr = parseFilter("[uri[LARES]]");
    expect(expr[0]!.op).toBe("uri");
  });

  test("throws on unknown operator", () => {
    expect(() => parseFilter("[frobnicate[x]]")).toThrow(/unknown operator/);
  });

  test("throws on unclosed bracket", () => {
    expect(() => parseFilter("[all[memes]")).toThrow();
  });

  test("whitespace between steps is tolerated", () => {
    const expr = parseFilter("[all[memes]]  [sort[depth]]");
    expect(expr).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// applyFilter
// ---------------------------------------------------------------------------

describe("applyFilter", () => {
  test("[all[memes]] returns all entries", () => {
    const result = applyFilter(ENTRIES, parseFilter("[all[memes]]"));
    expect(result).toHaveLength(ENTRIES.length);
  });

  test("[entry[]] returns only depth-0 memes", () => {
    const result = applyFilter(ENTRIES, parseFilter("[entry[]]"));
    expect(result).toHaveLength(1);
    expect(result[0]!.uri).toBe("lar:///AGENTS");
  });

  test("[all[memes]depth[1]] returns 2 depth-1 memes", () => {
    const result = applyFilter(ENTRIES, parseFilter("[all[memes]depth[1]]"));
    expect(result).toHaveLength(2);
    expect(result.every((e) => e.depth === 1)).toBe(true);
  });

  test("[all[memes]rating[data]] returns data-kind entries", () => {
    const result = applyFilter(ENTRIES, parseFilter("[all[memes]rating[data]]"));
    expect(result.every((e) => e.kind === "data")).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  test("[all[memes]tag[invariant]] filters by implements partial match", () => {
    const result = applyFilter(ENTRIES, parseFilter("[all[memes]tag[invariant]]"));
    expect(result.length).toBe(1);
    expect(result[0]!.uri).toBe("lar:///ha.ka.ba/api/v0.1/mu");
  });

  test("[all[memes]sort[depth]] is ordered by depth ascending", () => {
    const result = applyFilter(ENTRIES, parseFilter("[all[memes]sort[depth]]"));
    const depths = result.map((e) => e.depth);
    expect(depths).toEqual([...depths].sort((a, b) => a - b));
  });

  test("[all[memes]sort[uri]] is ordered alphabetically by URI", () => {
    const result = applyFilter(ENTRIES, parseFilter("[all[memes]sort[uri]]"));
    const uris = result.map((e) => e.uri);
    expect(uris).toEqual([...uris].sort());
  });

  test("[all[memes]limit[2]] returns at most 2 entries", () => {
    const result = applyFilter(ENTRIES, parseFilter("[all[memes]limit[2]]"));
    expect(result).toHaveLength(2);
  });

  test("[all[memes]sort[depth]limit[1]] returns the shallowest meme", () => {
    const result = applyFilter(ENTRIES, parseFilter("[all[memes]sort[depth]limit[1]]"));
    expect(result).toHaveLength(1);
    expect(result[0]!.depth).toBe(0);
  });

  test("[uri[LARES]] filters by URI substring", () => {
    const result = applyFilter(ENTRIES, parseFilter("[all[memes]uri[LARES]]"));
    expect(result).toHaveLength(1);
    expect(result[0]!.uri).toContain("LARES");
  });

  test("empty expression returns empty result", () => {
    const result = applyFilter(ENTRIES, []);
    expect(result).toHaveLength(0);
  });

  test("steps without all[] start from empty set", () => {
    // [sort[depth]] with no all[] step → result starts empty, sort is no-op
    const result = applyFilter(ENTRIES, parseFilter("[sort[depth]]"));
    expect(result).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// filterEntries convenience
// ---------------------------------------------------------------------------

describe("filterEntries", () => {
  test("parse + apply in one call", () => {
    const result = filterEntries(ENTRIES, "[all[memes]depth[0]]");
    expect(result).toHaveLength(1);
    expect(result[0]!.uri).toBe("lar:///AGENTS");
  });
});
