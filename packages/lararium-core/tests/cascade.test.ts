/**
 * Tests for @lararium/core/cascade — generic cascade engine.
 * Covers: compileCascade (filter + match paths), matchesEntry, edge: operator integration.
 */
import { describe, test, expect } from "@jest/globals";
import { compileCascade, matchesEntry } from "../src/cascade.js";
import { filterMemesWikitext } from "../src/lararium-tw5.js";
import type { ClosureEntry, EdgeRecord } from "../src/compiler.js";
import type { CascadeEntry, MemeCascadeFrame } from "../src/cascade.js";

function makeEntry(overrides: Partial<ClosureEntry>): ClosureEntry {
  return Object.freeze({
    uri:             "lar:///TEST",
    laresRelPath:    "lares/TEST.md",
    kind:            "meme",
    virtual:         false,
    exists:          true,
    role:            "test",
    hydrationSocket: "entry",
    implements:      [],
    contentHash:     "abc",
    depth:           0,
    confidence:      0.5,
    register:        "CS",
    manaoio:         0,
    mana:            0,
    manao:           0,
    ...overrides,
  } as ClosureEntry);
}

const CLOSURE: ClosureEntry[] = [
  makeEntry({ uri: "lar:///A", kind: "meme",  register: "CS", confidence: 0.9, depth: 0, implements: ["lar:///iface/meme"] }),
  makeEntry({ uri: "lar:///B", kind: "data",  register: "DS", confidence: 0.7, depth: 1, implements: [] }),
  makeEntry({ uri: "lar:///C", kind: "meme",  register: "SC", confidence: 0.5, depth: 2, implements: ["lar:///iface/meme"] }),
];

const EDGES: EdgeRecord[] = [
  { fromUri: "lar:///A", fromSocket: "core", toUri: "lar:///B", family: "control", role: "owns" },
  { fromUri: "lar:///B", fromSocket: "core", toUri: "lar:///C", family: "spatial",  role: "portal" },
];

// Thin engine wrapper matching FilterEngineFn signature
const engine = (expr: string, closure: readonly ClosureEntry[], edges?: readonly EdgeRecord[]) =>
  filterMemesWikitext(closure, expr, edges);

// ---------------------------------------------------------------------------
// matchesEntry — predicate matching
// ---------------------------------------------------------------------------

describe("matchesEntry", () => {
  const frame: MemeCascadeFrame = {
    uri: "lar:///A", rating: "meme", register: "CS",
    confidence: 0.9, manaoio: 0, implements: ["lar:///iface/meme"],
  };

  test("matchingUris: Set containing uri → true", () => {
    const compiled = { matchingUris: new Set(["lar:///A"]), entry: { override: {} } };
    expect(matchesEntry(compiled, frame)).toBe(true);
  });

  test("matchingUris: Set not containing uri → false", () => {
    const compiled = { matchingUris: new Set(["lar:///X"]), entry: { override: {} } };
    expect(matchesEntry(compiled, frame)).toBe(false);
  });

  test("matchingUris: null, no match → false", () => {
    const compiled = { matchingUris: null, entry: { override: {} } };
    expect(matchesEntry(compiled, frame)).toBe(false);
  });

  test("predicate: rating match", () => {
    const compiled = { matchingUris: null, entry: { match: { rating: "meme" }, override: {} } };
    expect(matchesEntry(compiled, frame)).toBe(true);
  });

  test("predicate: register mismatch → false", () => {
    const compiled = { matchingUris: null, entry: { match: { register: "DS" }, override: {} } };
    expect(matchesEntry(compiled, frame)).toBe(false);
  });

  test("predicate: uri prefix match", () => {
    const compiled = { matchingUris: null, entry: { match: { uri: "lar:///A" }, override: {} } };
    expect(matchesEntry(compiled, frame)).toBe(true);
  });

  test("predicate: uri regex mismatch → false", () => {
    const compiled = { matchingUris: null, entry: { match: { uri: /^lar:\/\/\/X/ }, override: {} } };
    expect(matchesEntry(compiled, frame)).toBe(false);
  });

  test("predicate: minConfidence pass", () => {
    const compiled = { matchingUris: null, entry: { match: { minConfidence: 0.8 }, override: {} } };
    expect(matchesEntry(compiled, frame)).toBe(true);
  });

  test("predicate: minConfidence fail", () => {
    const compiled = { matchingUris: null, entry: { match: { minConfidence: 0.95 }, override: {} } };
    expect(matchesEntry(compiled, frame)).toBe(false);
  });

  test("predicate: implements match", () => {
    const compiled = { matchingUris: null, entry: { match: { implements: "lar:///iface/meme" }, override: {} } };
    expect(matchesEntry(compiled, frame)).toBe(true);
  });

  test("predicate: function match", () => {
    const compiled = { matchingUris: null, entry: { match: (f: MemeCascadeFrame) => f.confidence > 0.8, override: {} } };
    expect(matchesEntry(compiled, frame)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// compileCascade — filter path (uses wikitext-filter engine)
// ---------------------------------------------------------------------------

describe("compileCascade — filter path", () => {
  test("entry without filter → matchingUris: null", async () => {
    const cascade: CascadeEntry[] = [{ match: { rating: "meme" }, override: { color: "red" } }];
    const compiled = await compileCascade(cascade, CLOSURE, engine);
    expect(compiled[0]!.matchingUris).toBeNull();
  });

  test("filter expression resolves to URI set", async () => {
    const cascade: CascadeEntry[] = [{ filter: "[all[memes]field:rating[meme]]", override: {} }];
    const compiled = await compileCascade(cascade, CLOSURE, engine);
    const uris = compiled[0]!.matchingUris;
    expect(uris).not.toBeNull();
    expect(uris!.has("lar:///A")).toBe(true);
    expect(uris!.has("lar:///B")).toBe(false); // data, not meme
  });

  test("toml: operator resolves in filter", async () => {
    const cascade: CascadeEntry[] = [{ filter: "[all[memes]toml:register[CS]]", override: {} }];
    const compiled = await compileCascade(cascade, CLOSURE, engine);
    const uris = compiled[0]!.matchingUris;
    expect(uris!.has("lar:///A")).toBe(true);
    expect(uris!.has("lar:///B")).toBe(false);
  });

  test("parallelised — multiple filter entries resolve independently", async () => {
    const cascade: CascadeEntry[] = [
      { filter: "[all[memes]field:rating[meme]]",  override: { color: "red"  } },
      { filter: "[all[memes]toml:register[DS]]",   override: { color: "blue" } },
    ];
    const compiled = await compileCascade(cascade, CLOSURE, engine);
    expect(compiled).toHaveLength(2);
    expect(compiled[0]!.matchingUris!.has("lar:///A")).toBe(true);
    expect(compiled[1]!.matchingUris!.has("lar:///B")).toBe(true);
  });

  test("empty cascade compiles to empty array", async () => {
    const compiled = await compileCascade([], CLOSURE, engine);
    expect(compiled).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// compileCascade — edge: operator integration
// ---------------------------------------------------------------------------

describe("compileCascade — edge: operator with edges", () => {
  test("edge:control[owns] filter resolves to lar:///A only", async () => {
    const cascade: CascadeEntry[] = [{ filter: "[all[memes]edge:control[owns]]", override: {} }];
    const compiled = await compileCascade(cascade, CLOSURE, engine, EDGES);
    const uris = compiled[0]!.matchingUris;
    expect(uris!.has("lar:///A")).toBe(true);
    expect(uris!.has("lar:///B")).toBe(false);
  });

  test("edge:spatial[portal] filter resolves to lar:///B only", async () => {
    const cascade: CascadeEntry[] = [{ filter: "[all[memes]edge:spatial[portal]]", override: {} }];
    const compiled = await compileCascade(cascade, CLOSURE, engine, EDGES);
    expect(compiled[0]!.matchingUris!.has("lar:///B")).toBe(true);
    expect(compiled[0]!.matchingUris!.has("lar:///A")).toBe(false);
  });

  test("without edges, edge: filter matches nothing", async () => {
    const cascade: CascadeEntry[] = [{ filter: "[all[memes]edge:control[owns]]", override: {} }];
    const compiled = await compileCascade(cascade, CLOSURE, engine);
    expect(compiled[0]!.matchingUris!.size).toBe(0);
  });
});
