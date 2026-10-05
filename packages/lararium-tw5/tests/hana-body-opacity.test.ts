// vm-grammar-boundary: exempt — the unit test of the scanner's own worksite exclusion (the same
// mechanism pranala's block body already gets) — whether a `<<~ …>>` written INSIDE a hana body
// fires as an event at all. That question lives entirely at the scan layer: the render path can
// only observe whether the final tree/HTML differs, never whether the SCANNER specifically
// excluded the position, so this claim has no other surface. It blesses no grammar; it holds
// the scan layer to guest-grammar.mem's #/hana-worksite law (a hana body carries a FOREIGN
// grammar, never this house's own sigils).
/**
 * HANA BODY OPACITY — a hana block's body carries a FOREIGN grammar, not TW5 wikitext.
 *
 * ── THE DEFECT ───────────────────────────────────────────────────────────────────────────────────
 * `guest-grammar.mem` (#/hana-worksite) and `hana.mem` (#/law) both hold: a `hana` block's body is
 * consumed by a registered guest interpreter keyed off the block's grammar-key, never parsed as this
 * house's own sigil grammar. `pranala` already gets this exclusion (scanner.ts's blockSpans/inBlock);
 * `hana` got NONE, so a `<<~ ahu #/x>>`-shaped guest payload fired as a REAL sigil inside the body —
 * an ahu the author never meant to open.
 *
 * Fix reuses the same worksite-exclusion mechanism pranala already carries (scanner.ts), scoped to
 * the hana BODY only (never the block's own opener/closer, which must keep scanning normally).
 */
import { describe, test, expect } from "vitest";
import { collectEvents } from "../src/meme-ast/index.js";

describe("a hana body stays opaque to the sigil scanner", () => {
  test("RED — a `<<~ ahu #/x>>` written inside a hana body fires NO inner ahu event", () => {
    const src = '<<~ hana "x-tiddlywiki-filter">>\n<<~ ahu #/x>>\nsneaks in\n<<~/ahu>>\n<<~/hana>>';
    const events = collectEvents(src);
    const ahuEvents = events.filter((e) => e.sigilName === "ahu");
    expect(ahuEvents, "an ahu inside a hana body fired as a real sigil — the body is not opaque").toHaveLength(0);
  });

  test("the hana block itself still opens and closes", () => {
    const src = '<<~ hana "x-tiddlywiki-filter">>\n<<~ ahu #/x>>\nsneaks in\n<<~/ahu>>\n<<~/hana>>';
    const events = collectEvents(src);
    const hanaOpen  = events.filter((e) => e.sigilName === "hana" && e.eventType === "open");
    const hanaClose = events.filter((e) => e.sigilName === "hana" && e.eventType === "close");
    expect(hanaOpen, "hana's own opener vanished under the exclusion meant for its body").toHaveLength(1);
    expect(hanaClose, "hana's own closer vanished under the exclusion meant for its body").toHaveLength(1);
  });

  test("CONTROL — the same `<<~ ahu #/x>>` OUTSIDE a hana block still scans", () => {
    const src = '<<~ ahu #/x>>\nordinary content\n<<~/ahu>>';
    const events = collectEvents(src);
    const ahuEvents = events.filter((e) => e.sigilName === "ahu");
    expect(ahuEvents, "the control itself lost its ahu events — the harness is broken, not the fix").toHaveLength(2); // open + close
  });

  test("the \\task alias shares the same worksite exclusion", () => {
    const src = '<<~ task "x-tiddlywiki-filter">>\n<<~ ahu #/x>>\nsneaks in\n<<~/ahu>>\n<<~/task>>';
    const events = collectEvents(src);
    const ahuEvents = events.filter((e) => e.sigilName === "ahu");
    expect(ahuEvents, "\\task (hana's English alias) did not share the exclusion").toHaveLength(0);
  });
});
