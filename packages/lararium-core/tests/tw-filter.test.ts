/**
 * Tests for the wikitext-filter engine (filterMemesWikitext).
 *
 * wikitext-filter is the canonical Lararium filter dialect (lar:///grammars/wikitext-filter).
 * x-tiddlywiki-filter is a compatibility helper for TW5 content import.
 *
 * These tests exercise the TW5 engine with wikitext-filter pre-processing applied.
 */
import { describe, test, expect } from "@jest/globals";
import { filterMemesWikitext } from "@lararium/tw5";
import type { ClosureEntry, EdgeRecord } from "../src/compiler.js";

function makeEntry(overrides: Partial<ClosureEntry>): ClosureEntry {
  return Object.freeze({
    uri:             "lar:///AGENTS",
    laresRelPath:    "lares/AGENTS.md",
    kind:            "meme",
    virtual:         false,
    exists:          true,
    role:            "threshold constitution",
    hydrationSocket: "entry",
    implements:      [],
    contentHash:     "abc123",
    depth:           0,
    confidence:      0,
    register:        "",
    manaoio:         0,
    mana:            0,
    manao:           0,
    ...overrides,
  } as ClosureEntry);
}

const ENTRIES: ClosureEntry[] = [
  makeEntry({ uri: "lar:///AGENTS",                            depth: 0, kind: "meme", register: "CS",  confidence: 0.82, implements: ["lar:///ha.ka.ba/api/v0.1/pono/meme"] }),
  makeEntry({ uri: "lar:///ha.ka.ba/api/v0.1/mu",             depth: 1, kind: "meme", register: "DS",  confidence: 0.92, implements: ["lar:///ha.ka.ba/api/v0.1/pono/meme", "lar:///ha.ka.ba/api/v0.1/pono/invariant"] }),
  makeEntry({ uri: "lar:///LARES",                             depth: 1, kind: "data", register: "CS",  confidence: 0.70, implements: [] }),
  makeEntry({ uri: "lar:///ha.ka.ba/api/v0.1/lararium",       depth: 2, kind: "meme", register: "SC",  confidence: 0.60, implements: ["lar:///ha.ka.ba/api/v0.1/pono/meme"] }),
  makeEntry({ uri: "lar:///ha.ka.ba/api/v0.1/pono/invariant", depth: 3, kind: "data", register: "SC",  confidence: 0.88, implements: ["lar:///ha.ka.ba/api/v0.1/pono/meme"] }),
];

describe("filterMemesWikitext — wikitext-filter dialect", () => {
  // ---------------------------------------------------------------------------
  // Preserved TW5 operators
  // ---------------------------------------------------------------------------

  test("[all[memes]] returns all entries via noun alias", async () => {
    const result = await filterMemesWikitext(ENTRIES, "[all[memes]]");
    expect(result).toHaveLength(ENTRIES.length);
  });

  test("[tag[X]] filters by implements via TW tag membership", async () => {
    const result = await filterMemesWikitext(ENTRIES, "[all[memes]tag[lar:///ha.ka.ba/api/v0.1/pono/invariant]]");
    expect(result).toHaveLength(1);
    expect(result[0]!.uri).toBe("lar:///ha.ka.ba/api/v0.1/mu");
  });

  test("[field:rating[data]] filters by rating field", async () => {
    const result = await filterMemesWikitext(ENTRIES, "[all[memes]field:rating[data]]");
    expect(result.every((e) => e.kind === "data")).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  test("[nsort[depth]] sorts numerically by depth", async () => {
    const result = await filterMemesWikitext(ENTRIES, "[all[memes]nsort[depth]]");
    const depths = result.map((e) => e.depth);
    expect(depths).toEqual([...depths].sort((a, b) => a - b));
  });

  test("[limit[2]] returns at most 2 entries", async () => {
    const result = await filterMemesWikitext(ENTRIES, "[all[memes]limit[2]]");
    expect(result.length).toBeLessThanOrEqual(2);
  });

  test("[field:depth[0]] returns only depth-0 entries", async () => {
    const result = await filterMemesWikitext(ENTRIES, "[all[memes]field:depth[0]]");
    expect(result).toHaveLength(1);
    expect(result[0]!.uri).toBe("lar:///AGENTS");
  });

  test("empty result for non-matching tag", async () => {
    const result = await filterMemesWikitext(ENTRIES, "[all[memes]tag[lar:///nonexistent]]");
    expect(result).toHaveLength(0);
  });

  test("TW system tiddlers ($:/) are excluded from results", async () => {
    const result = await filterMemesWikitext(ENTRIES, "[all[memes]]");
    expect(result.every((e) => !e.uri.startsWith("$:"))).toBe(true);
  });

  test("depth-1 filter returns exactly 2 memes (LARES + mu)", async () => {
    const result = await filterMemesWikitext(ENTRIES, "[all[memes]field:depth[1]]");
    expect(result).toHaveLength(2);
    const uris = result.map((e) => e.uri);
    expect(uris).toContain("lar:///ha.ka.ba/api/v0.1/mu");
    expect(uris).toContain("lar:///LARES");
  });

  // ---------------------------------------------------------------------------
  // wikitext-filter extensions: toml: operator
  // ---------------------------------------------------------------------------

  test("[toml:register[CS]] filters by confidence register via toml: → field: translation", async () => {
    const result = await filterMemesWikitext(ENTRIES, "[all[memes]toml:register[CS]]");
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((e) => e.register === "CS")).toBe(true);
  });

  test("[toml:register[DS]] returns only DS-register entries", async () => {
    const result = await filterMemesWikitext(ENTRIES, "[all[memes]toml:register[DS]]");
    expect(result).toHaveLength(1);
    expect(result[0]!.uri).toBe("lar:///ha.ka.ba/api/v0.1/mu");
  });

  test("[toml:rating[meme]] is equivalent to [field:rating[meme]]", async () => {
    const a = await filterMemesWikitext(ENTRIES, "[all[memes]toml:rating[meme]]");
    const b = await filterMemesWikitext(ENTRIES, "[all[memes]field:rating[meme]]");
    expect(a.map((e) => e.uri)).toEqual(b.map((e) => e.uri));
  });

  test("[toml:register[SC]field:rating[meme]] compound query", async () => {
    const result = await filterMemesWikitext(ENTRIES, "[all[memes]toml:register[SC]field:rating[meme]]");
    expect(result.every((e) => e.register === "SC" && e.kind === "meme")).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // Epistemic fields: confidence, manaoio
  // ---------------------------------------------------------------------------

  test("[field:register[CS]] returns CS-register entries", async () => {
    const result = await filterMemesWikitext(ENTRIES, "[all[memes]field:register[CS]]");
    expect(result.every((e) => e.register === "CS")).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // edge: operator — pranala edge pre-loading
  // ---------------------------------------------------------------------------

  // Synthetic edges: AGENTS --control:owns--> mu; AGENTS --control:owns--> LARES
  //                  lararium --relation:companion--> pono/invariant
  //                  LARES --spatial:portal--> lararium
  const EDGES: EdgeRecord[] = [
    { fromUri: "lar:///AGENTS",                            fromSocket: "core", toUri: "lar:///ha.ka.ba/api/v0.1/mu",             family: "control",  role: "owns"      },
    { fromUri: "lar:///AGENTS",                            fromSocket: "core", toUri: "lar:///LARES",                             family: "control",  role: "owns"      },
    { fromUri: "lar:///ha.ka.ba/api/v0.1/lararium",       fromSocket: "core", toUri: "lar:///ha.ka.ba/api/v0.1/pono/invariant", family: "relation", role: "companion" },
    { fromUri: "lar:///LARES",                             fromSocket: "core", toUri: "lar:///ha.ka.ba/api/v0.1/lararium",       family: "spatial",  role: "portal"    },
  ];

  test("[edge:control[owns]] returns only entries with control:owns outgoing edge", async () => {
    const result = await filterMemesWikitext(ENTRIES, "[all[memes]edge:control[owns]]", EDGES);
    expect(result).toHaveLength(1);
    expect(result[0]!.uri).toBe("lar:///AGENTS");
  });

  test("[edge:control[]] returns entries with any outgoing control edge", async () => {
    const result = await filterMemesWikitext(ENTRIES, "[all[memes]edge:control[]]", EDGES);
    expect(result).toHaveLength(1);
    expect(result[0]!.uri).toBe("lar:///AGENTS");
  });

  test("[edge:relation[companion]] returns lararium entry", async () => {
    const result = await filterMemesWikitext(ENTRIES, "[all[memes]edge:relation[companion]]", EDGES);
    expect(result).toHaveLength(1);
    expect(result[0]!.uri).toBe("lar:///ha.ka.ba/api/v0.1/lararium");
  });

  test("[edge:spatial[portal]] returns LARES (has spatial:portal edge)", async () => {
    const result = await filterMemesWikitext(ENTRIES, "[all[memes]edge:spatial[portal]]", EDGES);
    expect(result).toHaveLength(1);
    expect(result[0]!.uri).toBe("lar:///LARES");
  });

  test("edge: operator without edges param returns empty (no edge fields loaded)", async () => {
    const result = await filterMemesWikitext(ENTRIES, "[all[memes]edge:control[owns]]");
    expect(result).toHaveLength(0);
  });

  test("edge: + toml: compound query: control:owns memes that are CS-register", async () => {
    const result = await filterMemesWikitext(ENTRIES, "[all[memes]edge:control[owns]toml:register[CS]]", EDGES);
    expect(result).toHaveLength(1);
    expect(result[0]!.uri).toBe("lar:///AGENTS");
  });
});
