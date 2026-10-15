// vm-grammar-boundary: exempt — the unit test of the compile layer's OWN capture-group split
// for waiho/const's `name = value` shape — whether the `=` separator rides into the captured
// VALUE or is consumed as a separator. That question lives at the scan+build layer alone (the
// render path never exposes waiho's raw captured groups), so it has no other surface. It
// blesses no grammar; it holds one sigil's own capture shape to canon.
/**
 * waiho's space-form pattern captured the stray `=` (lar:///sigil.grammar.lane).
 *
 * Canon (api/pono/waiho.mem ~51, ~64) writes BOTH the carrier-scoped and block-scoped forms with
 * `=`: `<<~! waiho name = value>>` and `<<~ waiho name = value>>...<<~/waiho>>` — but the tiddler's
 * own `lar-open-pattern` treated the separator between name and value as bare whitespace
 * (`\s+`), so the captured VALUE group included the literal `= ` prefix: `name = value` captured
 * value `"= value"`, not `"value"`. `const`/`let`/`var` (waiho's mirrors, same canon shape) carried
 * the identical fault.
 */
import { describe, test, expect } from "vitest";
import { collectEvents } from "../src/meme-ast/index.js";
import { GENERATED_SIGILS, GENERATED_FAMILIES } from "../src/meme-ast/grammar-table.generated.js";
import type { GrammarRules } from "../src/meme-ast/types.js";

const GRAMMAR: GrammarRules = { sigils: GENERATED_SIGILS, families: GENERATED_FAMILIES };

function openValue(name: string, src: string): string | undefined {
  const events = collectEvents(src, GRAMMAR);
  const evt = events.find((e) => e.sigilName === "waiho" && (e.eventType === "open" || e.eventType === "pragma"));
  return evt?.groups[2];
}

describe("waiho/const/let/var — the `=` separator never rides into the captured value", () => {
  test.each([
    ["waiho", '<<~ waiho name = value>>body<<~/waiho>>'],
    ["const", '<<~ const name = value>>body<<~/const>>'],
    ["let",   '<<~ let name = value>>body<<~/let>>'],
    ["var",   '<<~ var name = value>>body<<~/var>>'],
  ])("RED→GREEN — %s's block form: `name = value` captures value \"value\", not \"= value\"", (_name, src) => {
    expect(openValue("waiho", src)).toBe("value");
  });

  test("CONTROL — waiho's carrier-scoped `!`/hoisted form ALSO drops the stray `=`", () => {
    const src = '<<~! waiho name = value>>\n';
    expect(openValue("waiho", src)).toBe("value");
  });

  test("CONTROL — const's `!`/hoisted form ALSO drops the stray `=`", () => {
    const src = '<<~! const name = value>>\n';
    expect(openValue("waiho", src)).toBe("value");
  });

  test("CONTROL — the bare space-only form (no `=` at all) still parses, unaffected", () => {
    const src = '<<~ waiho name "value">>body<<~/waiho>>';
    expect(openValue("waiho", src)).toBe('"value"');
  });
});
