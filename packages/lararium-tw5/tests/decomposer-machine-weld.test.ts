/**
 * THE DECOMPOSER IS MACHINE, AND VOCABULARY NEVER DECOMPOSES — the weld.
 *
 * The wire carries DECOMPOSED records (a root plus its ahu children), never meme text, and that stays
 * safe from dialect drift only because the cut that makes the records is fixed inside the engine
 * window: `findTopLevelAhuBlocks` reads hard-coded regexes under the frame's fence mask, and the split
 * (`splitRecursive` behind `splitBodyTiddler` and the carrier deserializer) composes from that scan
 * alone. The live vocabulary — every `SharktoothSigil` tiddler `getGrammar` folds — grades text and
 * renders it; it never decides where a record ends.
 *
 * The weld: a tripwire wiki stands where `getGrammar` would read the vocabulary, and `getGrammar`
 * itself counts every call. The family scan, the body split and the carrier deserializer run over a
 * nested-ahu carrier; neither counter moves. The CONTROL proves the instrument: one real `getGrammar`
 * call over the same tripwire reads the SharktoothSigil tiddler and moves both.
 */
import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { frameCarrier } from "@lararium/memetic-frame";
import { GRAMMAR_TAG } from "@lararium/mesh/lar-uris";

const counters = vi.hoisted(() => ({ getGrammar: 0 }));

vi.mock("../src/grammar-cache.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/grammar-cache.js")>();
  return {
    ...actual,
    getGrammar: () => { counters.getGrammar++; return actual.getGrammar(); },
  };
});

const { findTopLevelAhuBlocks } = await import("../src/meme-ast/ahu-scan.js");
const { splitBodyTiddler, memeticWikitextDeserializer } = await import("../src/deserializer.js");
const grammarCache = await import("../src/grammar-cache.js");

const URI = "lar:///t/weld";
const SIGIL = "lar:///ha.ka.ba/lararium/tw5/tiddlers/sigil-ahu";
const BODY = [
  "lead",
  "",
  "<<~ ahu #/a>>",
  "alpha",
  "",
  "<<~ ahu #/a/b>>",
  "beta",
  "<<~/ahu>>",
  "<<~/ahu>>",
  "",
  "<<~ ahu #/c>>",
  "gamma",
  "<<~/ahu>>",
  "",
].join("\n");

/** Every vocabulary read the wiki answered — a SharktoothSigil title fetched or the tag filtered. */
let vocabularyReads: string[] = [];

function installTripwireWiki(): void {
  const wiki = {
    filterTiddlers(filter: string): string[] {
      if (filter.includes(GRAMMAR_TAG)) { vocabularyReads.push(`filter:${filter}`); return [SIGIL]; }
      return [];
    },
    getTiddler(title: string) {
      if (title === SIGIL) {
        vocabularyReads.push(`get:${title}`);
        return { fields: { title, tags: [GRAMMAR_TAG], "lar-kind": "block", "lar-open-pattern": "<<~ ahu" } };
      }
      return undefined;
    },
    getTiddlersWithTag(tag: string): string[] {
      if (tag === GRAMMAR_TAG) { vocabularyReads.push(`tag:${tag}`); return [SIGIL]; }
      return [];
    },
  };
  (globalThis as { $tw?: unknown }).$tw = { wiki };
}

beforeEach(() => {
  counters.getGrammar = 0;
  vocabularyReads = [];
  grammarCache.resetGrammar();
  installTripwireWiki();
});

afterEach(() => {
  delete (globalThis as { $tw?: unknown }).$tw;
  grammarCache.resetGrammar();
});

describe("★ the decomposer is machine: the split reads no vocabulary ★", () => {
  test("CONTROL — the tripwire sees a real getGrammar read the SharktoothSigil tiddler", () => {
    grammarCache.getGrammar();
    expect(counters.getGrammar).toBe(1);
    expect(vocabularyReads.length).toBeGreaterThan(0);
  });

  test("findTopLevelAhuBlocks cuts the family without a getGrammar call or a vocabulary read", () => {
    const blocks = findTopLevelAhuBlocks(BODY);
    expect(blocks.map((b) => b.slot)).toEqual(["#/a", "#/c"]);
    expect(counters.getGrammar).toBe(0);
    expect(vocabularyReads).toEqual([]);
  });

  test("splitBodyTiddler decomposes root + children without a getGrammar call or a vocabulary read", () => {
    const { parent, children } = splitBodyTiddler(URI, "", BODY, { title: URI });
    expect(String(parent.text)).toContain("<<~ kahea ahu #/a>>");
    expect(children.map((c) => String(c.title))).toEqual(
      expect.arrayContaining([`${URI}#/a`, `${URI}#/a/b`, `${URI}#/c`]),
    );
    expect(counters.getGrammar).toBe(0);
    expect(vocabularyReads).toEqual([]);
  });

  test("the carrier deserializer decomposes a framed meme without a getGrammar call or a vocabulary read", () => {
    const text = frameCarrier({ head: { uri: URI }, body: BODY });
    const records = memeticWikitextDeserializer(text, { title: URI });
    expect(records.map((r) => String(r.title))).toEqual(
      expect.arrayContaining([URI, `${URI}#/a`, `${URI}#/a/b`, `${URI}#/c`]),
    );
    expect(counters.getGrammar).toBe(0);
    expect(vocabularyReads).toEqual([]);
  });
});
