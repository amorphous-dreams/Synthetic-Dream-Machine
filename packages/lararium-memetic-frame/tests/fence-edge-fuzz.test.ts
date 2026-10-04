/**
 * fence-edge-fuzz — the ONE span reader, measured against a seeded generator that places a frame
 * mark at every fence-boundary edge a quoting carrier can wear.
 *
 * ── WHY A FUZZ, NOT A TABLE ──────────────────────────────────────────────────────────────────────
 * `frame.test.ts` pins the shapes someone already thought of. A boundary bug lives exactly where
 * nobody thought to look — this fuzz exists to look at the SEAM between `fencedSpans` (CommonMark
 * §4.5's fence rule) and `readFrame`/`frameStanding` (the one span reader), at every edge the two
 * could disagree about: the line right after a fence opens, the line right before it closes, the
 * fence's own delimiter line, a fence that never closes, backtick vs tilde, a shorter fence nested
 * inside a longer one, an inline code span, CRLF line endings, and a mark glued to other text with
 * no newline to anchor on.
 *
 * ── THE ORACLE ───────────────────────────────────────────────────────────────────────────────────
 * Every generated carrier is built through `frameCarrier`, so it carries exactly ONE real STX and
 * ONE real ETX (the writer's own skeleton) plus a quoting attempt around a SECOND, fake mark-shaped
 * string the generator plants in the body. For every case, one of three things MUST hold:
 *
 *   1. `verifyBcc` reads `ok` — the reader's span is BYTE-IDENTICAL to the span the writer checked,
 *      so the fake mark stayed masked and the real frame verifies exactly as minted;
 *   2. `readFrame` NAMES a fault (`second-stx` / `etx-before-stx` / `second-etx`) — the fake mark
 *      leaked live, and the reader SAYS SO rather than silently trusting a wrong span;
 *   3. `frameStanding` reads `torn` — a runaway fence swallowed the real ETX too, which the reader
 *      also names rather than inventing a span over bytes it never bounded.
 *
 * The one outcome that must NEVER happen: a `framed` standing, zero faults, and `verifyBcc` reading
 * `mismatch` — that is the silent-wrong-span failure mode itself (recompute landed on a different
 * span than the one actually checked, and nothing said why).
 *
 * Every LAWFUL case (the generator's intended quoting is one `fencedSpans` recognizes — including
 * the "unclosed to EOF" shape, which swallows the real ETX by design) gets the STRICT assertion too:
 * `verifyBcc` reads `ok` (or the carrier reads `torn`, for the unclosed-fence family), never a fault.
 */

import { describe, test, expect } from "vitest";
import { frameCarrier } from "../src/write.js";
import { readFrame, frameStanding } from "../src/span.js";
import { verifyBcc } from "../src/check.js";
import { markCode } from "../src/write.js";

// ── a small, seeded PRNG (mulberry32) — deterministic, no dependency ──────────────────────────────
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function pick<T>(rng: () => number, xs: readonly T[]): T {
  return xs[Math.floor(rng() * xs.length)]!;
}

const STX_TXT = `<<^ code="${markCode("STX")}">>`;
const ETX_TXT = `<<^ code="${markCode("ETX")}">>`;

type Placement =
  | "after-open" | "before-close" | "on-open-line" | "unclosed-to-eof"
  | "inner-shorter-fence" | "inline-span" | "adjacent-no-newline";

interface Case {
  readonly name: string;
  readonly placement: Placement;
  readonly fenceCh: "`" | "~";
  readonly fenceLen: number;
  readonly mark: string;
  readonly crlf: boolean;
  /** Does the generator's OWN intent say this quoting is lawful (fully masked)? */
  readonly lawful: boolean;
}

/** One body carrying the planted mark at `placement`, fenced per `fenceCh`/`fenceLen`. */
function bodyFor(c: Case): string {
  const fence = c.fenceCh.repeat(c.fenceLen);
  const lines: string[] = ["prose above"];
  switch (c.placement) {
    case "after-open":
      // mark on the line immediately following the opener — squarely inside the span.
      lines.push(fence, c.mark, "more prose inside", fence);
      break;
    case "before-close":
      // mark on the line immediately preceding the closer.
      lines.push(fence, "prose inside", c.mark, fence);
      break;
    case "on-open-line":
      // the mark rides the OPENER's own line, trailing the delimiter — CommonMark's info string.
      // `fenceLineOpenAny` forbids the fence's own character in the info string, so a mark (which
      // carries neither backtick nor tilde) is always a legal info string here.
      lines.push(fence + c.mark, "prose inside", fence);
      break;
    case "unclosed-to-eof":
      // the fence opens and never closes within the body — `fencedSpans` masks the open tail to
      // the end of the WHOLE text, which (since `frameCarrier` appends the real ETX/EOT AFTER this
      // body) swallows the carrier's own closer too. Lawful outcome: `torn`, never a wrong `framed`.
      lines.push(fence, c.mark, "never closes");
      break;
    case "inner-shorter-fence": {
      // a longer OUTER fence holds a SHORTER inner delimiter line of the same character — the
      // shorter run must not close the longer fence (CommonMark §4.5: closer needs length >= the
      // opener). `Math.max(2, …)` keeps the inner run BELOW 3 when the outer is already the floor
      // (3) — a run that short is not even a fence candidate (`{3,}`), so it reads as plain body
      // either way, while an outer fence of 4/5 gets a genuinely shorter-but-still-fence-shaped line.
      const inner = c.fenceCh.repeat(Math.max(2, c.fenceLen - 1));
      lines.push(fence, inner, c.mark, inner, fence);
      break;
    }
    case "inline-span":
      // a single-backtick inline code span on one line — only meaningful for backtick; for tilde
      // (which this grammar never reads as an inline-span character) the mark rides bare, UNMASKED,
      // which is the point: an inline tilde pair is not a CommonMark construct, so it must fault.
      lines.push(c.fenceCh === "`" ? "prose `" + c.mark + "` more" : "prose " + c.mark + " more");
      break;
    case "adjacent-no-newline":
      // the mark glued directly to surrounding fenced content with no newline anchoring either side.
      lines.push(fence, "lead-in" + c.mark + "trail-out", fence);
      break;
  }
  lines.push("prose below");
  let text = lines.join("\n");
  if (c.crlf) text = text.replace(/\n/g, "\r\n");
  return text;
}

/** Whether the generator's OWN intent for `placement` is a fully-masked (lawful) quoting. */
function isLawful(placement: Placement, fenceCh: "`" | "~"): boolean {
  if (placement === "inline-span") return fenceCh === "`"; // a tilde pair never opens an inline span
  return true; // every fenced-block placement here is designed to mask fully (or, for
               // unclosed-to-eof, to mask by running off the end — also a NAMED outcome: torn)
}

function buildCases(): readonly Case[] {
  const rng = mulberry32(0xC0FFEE ^ 0x5E5);
  const placements: readonly Placement[] = [
    "after-open", "before-close", "on-open-line", "unclosed-to-eof",
    "inner-shorter-fence", "inline-span", "adjacent-no-newline",
  ];
  const fenceChars: readonly ("`" | "~")[] = ["`", "~"];
  const fenceLens = [3, 4, 5];
  const marks = [STX_TXT, ETX_TXT];
  const cases: Case[] = [];
  // Full enumeration first — every combination at least once, so no edge the task names is left
  // to chance.
  for (const placement of placements) {
    for (const fenceCh of fenceChars) {
      for (const fenceLen of fenceLens) {
        for (const mark of marks) {
          for (const crlf of [false, true]) {
            cases.push({
              name: `${placement} · ${fenceCh.repeat(fenceLen)} · ${mark === STX_TXT ? "STX" : "ETX"} · ${crlf ? "CRLF" : "LF"}`,
              placement, fenceCh, fenceLen, mark, crlf,
              lawful: isLawful(placement, fenceCh),
            });
          }
        }
      }
    }
  }
  // Then a seeded random tail, padding the corpus with shuffled combinations (including repeats
  // of the rarer corners) past the exhaustive sweep — "a few hundred cases" without a second
  // hand-written table.
  while (cases.length < 300) {
    const placement = pick(rng, placements);
    const fenceCh = pick(rng, fenceChars);
    const fenceLen = pick(rng, fenceLens);
    const mark = pick(rng, marks);
    const crlf = rng() < 0.5;
    cases.push({
      name: `[fuzz ${cases.length}] ${placement} · ${fenceCh.repeat(fenceLen)} · ${mark === STX_TXT ? "STX" : "ETX"} · ${crlf ? "CRLF" : "LF"}`,
      placement, fenceCh, fenceLen, mark, crlf,
      lawful: isLawful(placement, fenceCh),
    });
  }
  return cases;
}

const CASES = buildCases();

describe("fence-edge fuzz — the one span reader at every fence boundary", () => {
  test(`generated ${CASES.length} cases (sanity floor)`, () => {
    expect(CASES.length).toBeGreaterThanOrEqual(300);
  });

  for (const c of CASES) {
    test(c.name, () => {
      const body = bodyFor(c);
      const carrier = frameCarrier({ head: { uri: "lar:///t/fuzz" }, body });
      const standing = frameStanding(carrier);
      const read = readFrame(carrier);
      const check = verifyBcc(carrier);

      // THE INVARIANT: agree with the writer, or NAME why not — never a silent wrong span.
      const named = check === "ok" || read.faults.length > 0 || standing.kind === "torn";
      if (!named) {
        throw new Error(
          `silent wrong span: check=${check} faults=${JSON.stringify(read.faults)} standing=${standing.kind}`,
        );
      }
      expect(named).toBe(true);

      if (c.lawful) {
        // The POSITIVE half: a lawfully-quoted case masks fully. `unclosed-to-eof` is lawful by
        // running the fence off the end of the text — reading `torn` there is the CORRECT outcome
        // (the real ETX got swallowed with the fake one), not a fault.
        if (c.placement === "unclosed-to-eof") {
          expect(standing.kind).toBe("torn");
        } else {
          expect(check).toBe("ok");
          expect(read.faults).toEqual([]);
          expect(standing.kind).toBe("framed");
        }
      }
    });
  }
});
