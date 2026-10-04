/**
 * FENCE-MASK: a backtick fence's info string admits no backtick (CommonMark §4.5).
 *
 * ── THE DEFECT (see lar:///sigil.grammar.lane) ──────────────────────────────────────────────────
 * `FENCE_LINE_RE = /^ {0,3}(\`{3,})/` treated ANY line opening with 3+ backticks as a fence open,
 * even when the rest of that line (its would-be info string) itself carries a backtick — CommonMark
 * forbids that: such a line never opens a fence at all, it reads as ordinary text carrying an
 * inline code span. `fencedSpans` masked to end-of-text with no closer in sight, tearing the
 * carrier's frame — everything after that line (the SOH/close marks, later prose) fell inside the
 * "fence" and every reader built on `fencedSpans`/`maskedExecAll` went blind to it.
 */
import { describe, test, expect } from "vitest";
import { fencedSpans, inMask } from "@lararium/memetic-frame";

describe("fencedSpans — a backtick fence's info string carries no backtick", () => {
  test("RED→GREEN — a quad-backtick line whose info string carries a backtick opens NO fence", () => {
    const src = [
      "before",
      "```memetic-wikitext tangle` more prose",
      "after — this line must stay UNMASKED",
      "still more prose past it",
    ].join("\n");
    const spans = fencedSpans(src);
    const afterIdx = src.indexOf("after — this line must stay UNMASKED");
    expect(inMask(spans, afterIdx), "the carrier's frame tore — everything past the false opener masked").toBe(false);
    const laterIdx = src.indexOf("still more prose past it");
    expect(inMask(spans, laterIdx)).toBe(false);
  });

  test("CONTROL — a real fence, WITH a clean info string, still masks its body", () => {
    const src = [
      "before",
      "```memetic-wikitext tangle",
      "fenced body, held text",
      "```",
      "after — outside the fence, unmasked",
    ].join("\n");
    const spans = fencedSpans(src);
    const bodyIdx = src.indexOf("fenced body");
    expect(inMask(spans, bodyIdx), "a real fence with a clean info string stopped masking its own body").toBe(true);
    const afterIdx = src.indexOf("after — outside");
    expect(inMask(spans, afterIdx), "a real, CLOSED fence still masked past its own closer").toBe(false);
  });

  test("CONTROL — a plain ``` fence with no info string still masks", () => {
    const src = ["```", "body line", "```", "after"].join("\n");
    const spans = fencedSpans(src);
    expect(inMask(spans, src.indexOf("body line"))).toBe(true);
    expect(inMask(spans, src.indexOf("after"))).toBe(false);
  });

  test("a refused fence-open line still falls to ordinary prose — the line does not vanish, and a real closer past it un-masks", () => {
    // The line reads as ordinary prose once it is refused as a fence opener — masking stays
    // confined to whatever inline code spans that prose line itself carries, never to end-of-text.
    const src = ["```code` in prose", "next line, plainly unmasked"].join("\n");
    const spans = fencedSpans(src);
    const nextIdx = src.indexOf("next line");
    expect(inMask(spans, nextIdx), "the refused opener still swallowed the rest of the text").toBe(false);
  });
});
