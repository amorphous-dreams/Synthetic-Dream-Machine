/**
 * THE WARD CARRIES THE PULL OR THE CLUE ALONE; THE TOOL RIDES THE `mu` KEY.
 *
 * ── WHY ───────────────────────────────────────────────────────────────────────────────────────────────────
 * Train Q's ward-prefix fork ruled the seed form (lar:///ha.ka.ba/lares/api/noosphere-boot#/l-prime): a
 * `drift-ward` value names the pull at open and the contact-ready clue at close, and nothing more. A value
 * that opens with a Mu tool glyph (`*` Wand, `!` Sword, `?` Cup, `_` Pentacle, `0` Arcana) gives the ward a
 * second job, the tool's, which the `mu` key already holds. A carrier that prints the prefix teaches both
 * forms, so every ward value in the bags reads unprefixed.
 *
 * ── WHAT THIS HOLDS ───────────────────────────────────────────────────────────────────────────────────────
 * One law runs as a pure function of a carrier's text and returns its findings. The CONTROLS feed it a
 * planted prefix it MUST name and an unprefixed ward it MUST pass, so a law that reads nothing cannot pass
 * for green. The CORPUS block walks every carrier under bags/ and asserts no finding. The operator's lift
 * (a ward of exactly `0`) carries no glyph-led text and stands.
 */

import { describe, test, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const BAGS = new URL("../../../bags/", import.meta.url).pathname;

/** A ward value rides a backtick span or a double-quoted span. */
const WARD = /drift-ward=(?:`([^`]*)`|"([^"]*)")/g;
/** A Mu tool glyph, then whitespace and more text: the tool leads the ward. */
const TOOL_LED = /^[*!?_0]\s+\S/;

/** Each ward value in the text that opens with a tool glyph, by line. */
function toolLedWards(text: string): string[] {
  return text.split("\n").flatMap((line, i) =>
    [...line.matchAll(WARD)]
      .map((m) => m[1] ?? m[2] ?? "")
      .filter((v) => TOOL_LED.test(v))
      .map((v) => `${i + 1}: tool-led ward · ${v.slice(0, 60)}`),
  );
}

function carriers(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return carriers(p);
    return /\.(mem|md|tid)$/.test(e.name) ? [p] : [];
  });
}

describe("CONTROLS: the ward law names a tool-led ward and passes a bare one", () => {
  test("each tool glyph leading a ward reads red", () => {
    for (const v of ["* · the pull", "! · the clue · ↻ L-Prime", "? · the fork", "_ · L-Prime · crossing: x", "0 · L-Prime · lifted", "! ⚠ 2 · 'span' ↻ L-Prime", "? “span” --- question"]) {
      expect(toolLedWards(`<<~ set lares=\`aim\` drift-ward=\`${v}\`>>`)).toHaveLength(1);
      expect(toolLedWards(`drift-ward="${v}"`)).toHaveLength(1);
    }
  });
  test("an unprefixed ward, a lift of 0 and a clue that opens with ⚠ all pass", () => {
    const clean = [
      "<<~ set lares=`aim` drift-ward=`the pull this island carries`>>",
      "<<~ set lares=`yield` drift-ward=`the joint that breaks first · ↻ L-Prime` from=`lar:///a.b.c` to=`?`>>",
      "<<~ set drift-ward=`0`>>",
      'drift-ward="⚠ ⌜2⌝ · \'span\' · the clue · ↻ L-Prime"',
      "drift-ward=`lifted · the pull`",
    ].join("\n");
    expect(toolLedWards(clean)).toEqual([]);
  });
});

describe("CORPUS: every ward value in the bags reads unprefixed", () => {
  const all = carriers(BAGS);
  test("the walk reaches carriers that hold a ward", () => {
    expect(all.filter((p) => readFileSync(p, "utf8").includes("drift-ward=")).length).toBeGreaterThan(20);
  });
  test("no ward value opens with a tool glyph", () => {
    const found = all.flatMap((p) => toolLedWards(readFileSync(p, "utf8")).map((f) => `${p.slice(BAGS.length)}:${f}`));
    expect(found).toEqual([]);
  });
});
