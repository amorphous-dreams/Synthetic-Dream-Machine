/**
 * Tests for the TW5 filter adapter (filterMemesTW).
 *
 * These tests exercise TW's actual filter engine against meme-shaped entries.
 * They are the ground truth that the hand-rolled filter.ts should match for
 * the overlapping operator set.
 */
import { describe, test, expect } from "@jest/globals";
import { filterMemesTW } from "../src/tw-filter.js";
import type { ClosureEntry } from "../src/compiler.js";

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
  makeEntry({ uri: "lar:///AGENTS",                           depth: 0, kind: "meme", implements: ["lar:///ha.ka.ba/api/v0.1/pono/meme"] }),
  makeEntry({ uri: "lar:///ha.ka.ba/api/v0.1/mu",            depth: 1, kind: "meme", implements: ["lar:///ha.ka.ba/api/v0.1/pono/meme", "lar:///ha.ka.ba/api/v0.1/pono/invariant"] }),
  makeEntry({ uri: "lar:///LARES",                            depth: 1, kind: "data", implements: [] }),
  makeEntry({ uri: "lar:///ha.ka.ba/api/v0.1/lararium",     depth: 2, kind: "meme", implements: ["lar:///ha.ka.ba/api/v0.1/pono/meme"] }),
  makeEntry({ uri: "lar:///ha.ka.ba/api/v0.1/pono/invariant", depth: 3, kind: "data", implements: ["lar:///ha.ka.ba/api/v0.1/pono/meme"] }),
];

describe("filterMemesTW — TW5 engine", () => {
  test("[all[memes]] returns all entries via [all[memes]] alias", async () => {
    const result = await filterMemesTW(ENTRIES, "[all[memes]]");
    expect(result).toHaveLength(ENTRIES.length);
  });

  test("[tag[invariant-uri]] filters by implements via TW tag membership", async () => {
    const result = await filterMemesTW(ENTRIES, "[all[memes]tag[lar:///ha.ka.ba/api/v0.1/pono/invariant]]");
    expect(result).toHaveLength(1);
    expect(result[0]!.uri).toBe("lar:///ha.ka.ba/api/v0.1/mu");
  });

  test("[field:rating[data]] filters by kind field", async () => {
    const result = await filterMemesTW(ENTRIES, "[all[memes]field:rating[data]]");
    expect(result.every((e) => e.kind === "data")).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  test("[nsort[depth]] sorts numerically by depth", async () => {
    const result = await filterMemesTW(ENTRIES, "[all[memes]nsort[depth]]");
    const depths = result.map((e) => e.depth);
    expect(depths).toEqual([...depths].sort((a, b) => a - b));
  });

  test("[limit[2]] returns at most 2 entries", async () => {
    const result = await filterMemesTW(ENTRIES, "[all[memes]limit[2]]");
    expect(result.length).toBeLessThanOrEqual(2);
  });

  test("[field:depth[0]] returns only depth-0 entries", async () => {
    const result = await filterMemesTW(ENTRIES, "[all[memes]field:depth[0]]");
    expect(result).toHaveLength(1);
    expect(result[0]!.uri).toBe("lar:///AGENTS");
  });

  test("empty result for non-matching tag", async () => {
    const result = await filterMemesTW(ENTRIES, "[all[memes]tag[lar:///nonexistent]]");
    expect(result).toHaveLength(0);
  });

  test("TW system tiddlers ($:/) are excluded from results", async () => {
    const result = await filterMemesTW(ENTRIES, "[all[memes]]");
    expect(result.every((e) => !e.uri.startsWith("$:"))).toBe(true);
  });

  test("parity with hand-rolled filter: both agree on depth-1 memes", async () => {
    const { filterEntries } = await import("../src/filter.js");
    const tw = await filterMemesTW(ENTRIES, "[all[memes]field:depth[1]]");
    const ours = filterEntries(ENTRIES, "[all[memes]depth[1]]");
    expect(new Set(tw.map((e) => e.uri))).toEqual(new Set(ours.map((e) => e.uri)));
  });
});
