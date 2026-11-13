// vm-grammar-boundary: exempt — the unit test of the compile layer's OWN capture-group split
// for waiho/const's `name = value` shape — whether the `=` separator rides into the captured
// VALUE or is consumed as a separator. That question lives at the scan+build layer alone (the
// render path never exposes waiho's raw captured groups), so it has no other surface. It
// blesses no grammar; it holds one sigil's own capture shape to canon.
/**
 * waiho's open pattern captures the VALUE, never its ticks (lar:///sigil.grammar.lane).
 *
 * The Cut 3 grammar writes both the carrier-scoped and block-scoped forms with named, ticked values:
 * ``<<~! waiho name=`n` value=`v`>>`` and ``<<~ waiho name=`n` value=`v`>>...<<~/waiho>>``. The old
 * `name = value` separator form retired with the positional values: the capture groups stay `1 = name`,
 * `2 = value` (the builder reads them by index), and the value group holds `v`, never `` `v` ``.
 * `const` / `let` / `var` (waiho's mirrors) carry the same shape.
 */
import { describe, test, expect } from "vitest";
import { collectEvents } from "../src/meme-ast/index.js";
import { GENERATED_SIGILS, GENERATED_FAMILIES } from "../src/meme-ast/grammar-table.generated.js";
import type { GrammarRules } from "../src/meme-ast/types.js";

const GRAMMAR: GrammarRules = { sigils: GENERATED_SIGILS, families: GENERATED_FAMILIES };

function openGroups(src: string): (string | undefined)[] | undefined {
  const events = collectEvents(src, GRAMMAR);
  const evt = events.find((e) => e.sigilName === "waiho" && (e.eventType === "open" || e.eventType === "pragma"));
  return evt?.groups;
}

describe("waiho/const/let/var — the named value reaches the capture group without its ticks", () => {
  test.each([
    ["waiho", "<<~ waiho name=`name` value=`value`>>body<<~/waiho>>"],
    ["const", "<<~ const name=`name` value=`value`>>body<<~/const>>"],
    ["let",   "<<~ let name=`name` value=`value`>>body<<~/let>>"],
    ["var",   "<<~ var name=`name` value=`value`>>body<<~/var>>"],
  ])("RED→GREEN — %s's block form captures name \"name\" and value \"value\", no ticks", (_name, src) => {
    const g = openGroups(src);
    expect(g?.[1]).toBe("name");
    expect(g?.[2]).toBe("value");
  });

  test("CONTROL — waiho's carrier-scoped `!`/hoisted form captures the same two groups", () => {
    const g = openGroups("<<~! waiho name=`name` value=`value`>>\n");
    expect([g?.[1], g?.[2]]).toEqual(["name", "value"]);
  });

  test("CONTROL — const's `!`/hoisted form erases to waiho and captures the same two groups", () => {
    const g = openGroups("<<~! const name=`name` value=`value`>>\n");
    expect([g?.[1], g?.[2]]).toEqual(["name", "value"]);
  });

  test("CONTROL — a value holding spaces and an arrow rides whole", () => {
    expect(openGroups("<<~ waiho name=`n` value=`a -> b c`>>body<<~/waiho>>")?.[2]).toBe("a -> b c");
  });

});
