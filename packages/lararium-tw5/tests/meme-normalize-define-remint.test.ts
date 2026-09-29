/**
 * `lares meme normalize` re-mints `define` → `wehe` (lar:///sigil.grammar.lane loop 2, item 2).
 *
 * RULED: `define` is a READ-ONLY mirror of `wehe` (sigil-mirror-flip, loop 1) — no grammar of its
 * own, so re-minting it loses no authored intent. Scoped to `define` ALONE — every other read-only
 * mirror (`shadow`, `import`, …) stays authored as written; folding every mirror to canonical is an
 * UNRULED, broader question this loop only counts carriers for.
 */
import { describe, test, expect } from "vitest";
import { normalizeMemeSource } from "../src/meme-normalize.js";

describe("normalizeMemeSource — define re-mints to wehe", () => {
  test("RED→GREEN — an open+close define pair re-mints to wehe", () => {
    const src = '<<~ define greet(name:"world")>>Hello <<name>>!<<~/define>>\n';
    const { text, changed, notes } = normalizeMemeSource(src);
    expect(changed).toBe(true);
    expect(text).toContain('<<~ wehe greet(name:"world")>>');
    expect(text).toContain("<<~/wehe>>");
    expect(text).not.toContain("define");
    expect(notes.join()).toMatch(/define.*re-minted to `wehe`/);
  });

  test("re-mints applies UNCONDITIONALLY (FRAME authority) — no --grammar flag needed", () => {
    const src = "<<~ define greeting(name)>>Hi<<~/define>>\n";
    const { changed, grammarChanged } = normalizeMemeSource(src, { grammar: false });
    expect(changed).toBe(true);
    expect(grammarChanged).toBe(false);
  });

  test("a `define` shown inside a fence is held text — never rewritten", () => {
    const src = "```text\n<<~ define greet(name)>>body<<~/define>>\n```\n";
    const { text, changed } = normalizeMemeSource(src);
    expect(changed).toBe(false);
    expect(text).toContain("<<~ define greet(name)>>");
  });

  test("CONTROL — every OTHER read-only mirror stays untouched (only define re-mints)", () => {
    const src = '<<~ shadow "lar:///a.b.c/x">>\n<<~ import "lar:///a.b.c/y">>\n';
    const { text, changed } = normalizeMemeSource(src);
    expect(changed).toBe(false);
    expect(text).toBe(src);
  });

  test("idempotent — re-running the normalize over already-wehe text changes nothing", () => {
    const src = '<<~ wehe greet(name:"world")>>Hello<<~/wehe>>\n';
    const { changed } = normalizeMemeSource(src);
    expect(changed).toBe(false);
  });
});
