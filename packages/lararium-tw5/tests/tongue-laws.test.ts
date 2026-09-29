/**
 * The TONGUE laws (lar:///sigil.grammar.lane) — a fixture table that violates each
 * of the five laws, one at a time, and the CONTROL that a clean table reports nothing.
 */
import { describe, test, expect } from "vitest";
import { checkTongueLaws } from "../scripts/tongue-laws.js";
import type { TongueEntry } from "../scripts/tongue-laws.js";

function violationsOf(law: string, entries: readonly TongueEntry[]): string[] {
  return checkTongueLaws(entries).filter((v) => v.law === law).map((v) => v.message);
}

describe("checkTongueLaws — CONTROL", () => {
  test("a clean table (canonical + one read-only mirror + one weave-primary mirror) reports nothing", () => {
    const entries: TongueEntry[] = [
      { name: "kahea" },
      { name: "import", aliasFor: "kahea" },
      { name: "transclude", aliasFor: "kahea", tongue: "en", weavePrimary: true },
    ];
    expect(checkTongueLaws(entries)).toEqual([]);
  });
});

describe("checkTongueLaws — RED, one violation of each law", () => {
  test("(a) two primary mirrors for the same canonical + tongue", () => {
    const entries: TongueEntry[] = [
      { name: "kahea" },
      { name: "transclude", aliasFor: "kahea", tongue: "en", weavePrimary: true },
      { name: "embed", aliasFor: "kahea", tongue: "en", weavePrimary: true },
    ];
    const v = violationsOf("a", entries);
    expect(v).toHaveLength(1);
    expect(v[0]).toMatch(/kahea \(en\)/);
  });

  test("(b) one mirror name maps to two different canonicals", () => {
    const entries: TongueEntry[] = [
      { name: "kahea" },
      { name: "aka" },
      { name: "link", aliasFor: "kahea" },
      { name: "link", aliasFor: "aka" },
    ];
    const v = violationsOf("b", entries);
    expect(v).toHaveLength(1);
    expect(v[0]).toMatch(/^link -> /);
  });

  test("(c) a mirror name equals another sigil's canonical name", () => {
    const entries: TongueEntry[] = [
      { name: "kahea" },
      { name: "loulou" },
      { name: "loulou", aliasFor: "kahea" }, // same name as the canonical "loulou" above
    ];
    const v = violationsOf("c", entries);
    expect(v).toHaveLength(1);
    expect(v[0]).toMatch(/^loulou —/);
  });

  test("(d) lar-mirror-of targets a name that is not a canonical tiddler", () => {
    const entries: TongueEntry[] = [
      { name: "kahea" },
      { name: "link", aliasFor: "nonexistent" },
    ];
    const v = violationsOf("d", entries);
    expect(v).toHaveLength(1);
    expect(v[0]).toBe("link -> nonexistent — lar-mirror-of target is not a canonical (non-mirror) tiddler");
  });

  test("(e) a lar-weave: primary mirror declares no lar-tongue", () => {
    const entries: TongueEntry[] = [
      { name: "kahea" },
      { name: "transclude", aliasFor: "kahea", weavePrimary: true }, // no tongue
    ];
    const v = violationsOf("e", entries);
    expect(v).toHaveLength(1);
    expect(v[0]).toBe("transclude — lar-weave: primary with no lar-tongue declared");
  });

  test("all five fire together over one adversarial fixture", () => {
    const entries: TongueEntry[] = [
      { name: "kahea" },
      { name: "aka" },
      { name: "loulou" },
      // (a): two primaries, kahea/en
      { name: "transclude", aliasFor: "kahea", tongue: "en", weavePrimary: true },
      { name: "embed", aliasFor: "kahea", tongue: "en", weavePrimary: true },
      // (b): "link" maps to both kahea and aka
      { name: "link", aliasFor: "kahea" },
      { name: "link", aliasFor: "aka" },
      // (c): mirror named "loulou" collides with canonical "loulou"
      { name: "loulou", aliasFor: "aka" },
      // (d): dangling target
      { name: "ghost", aliasFor: "nowhere" },
      // (e): primary with no tongue
      { name: "shadow", aliasFor: "aka", weavePrimary: true },
    ];
    const laws = new Set(checkTongueLaws(entries).map((v) => v.law));
    expect([...laws].sort()).toEqual(["a", "b", "c", "d", "e"]);
  });
});
