/**
 * span — THE ONE READER that divides a carrier into its text frame.
 *
 * ── WHY ONE ─────────────────────────────────────────────────────────────────────────────────────
 * The block check, the gradient, the deserializer and the writer each ask "where does the text open,
 * and where does it close?". Three of them once answered three ways — first masked ETX, last masked
 * ETX, last UNMASKED ETX — and a carrier could then verify over bytes the deserializer never read, or
 * shed bytes nothing reported. A writer-minted carrier whose body held one stray ETX line lost every
 * byte after it at ingest, with no diagnostic and a check reading `unchecked`. One reader, one rule.
 *
 * ── THE RULE, FROM THE CANON ────────────────────────────────────────────────────────────────────
 * memetic-wikitext-framing #/control-set: the span runs from the first character of the STX sigil
 * through the last character of the ETX sigil, inclusive. #/frame-security: the check covers the
 * FIRST STX..ETX span only. #/the-touchstone: a reader MUST divide a carrier through the fence mask —
 * this grammar teaches its own control set, so a conformant corpus quotes every mark in a fence.
 *
 * So: the first live (unmasked) STX opens the span; the first live ETX after it closes it.
 *
 * ── A SECOND LIVE MARK IS A FAULT, NEVER A CHOICE ───────────────────────────────────────────────
 * One text frame per carrier. A second live ETX, a live ETX ahead of the STX, or a second live STX
 * makes a frame the reader cannot divide without choosing — and choosing first-vs-last in silence is
 * exactly how the readers drifted. The reader closes at the rule's ETX AND names the extra marks in
 * `faults`; the gradient and the deserializer surface them to the operator. Nothing past the close is
 * ever silently folded back in.
 *
 * The rule's choice lives in `closeOf` and nowhere else, so a ruling that moves it moves one line.
 *
 * Meme: lar:///ha.ka.ba/lares/api/pono/memetic-wikitext-framing
 */

import { frameAlt } from "./marks.js";
import { fencedSpans, maskedExecAll, type MaskSpan } from "./fence-mask.js";

// THE CODE SET COMES FROM THE DECLARATION; THIS SCAN IS THE SPAN READER'S OWN (marks.ts).
// A frame sigil never crosses a line, and `>>` closes it only when a second bracket follows — the
// arrow's own `>` rides as content.
const INNER = "(?:[^>\\n]|>(?!>))*";
const STX_SRC = `<<\\^${INNER}${frameAlt("STX")}${INNER}>>`;
const ETX_SRC = `<<\\^${INNER}${frameAlt("ETX")}${INNER}>>`;
const EOT_SRC = `<<\\^${INNER}${frameAlt("EOT")}${INNER}>>`;

/** One live frame mark: where its sigil opens and where it ends. */
export interface MarkHit {
  readonly index: number;
  readonly end: number;
}

/** Every LIVE frame mark of a text — quoted marks masked out. */
export interface FrameMarks {
  readonly stx: readonly MarkHit[];
  readonly etx: readonly MarkHit[];
  readonly eot: readonly MarkHit[];
}

const hits = (text: string, src: string, spans: readonly MaskSpan[]): MarkHit[] =>
  maskedExecAll(text, new RegExp(src, "g"), spans).map((m) => ({ index: m.index, end: m.index + m[0].length }));

/** The live STX, ETX and EOT marks of `text`, in order, read through the fence mask. */
export function frameMarks(text: string, spans: readonly MaskSpan[] = fencedSpans(text)): FrameMarks {
  return { stx: hits(text, STX_SRC, spans), etx: hits(text, ETX_SRC, spans), eot: hits(text, EOT_SRC, spans) };
}

/**
 * THE CLOSE RULE — the one place first-vs-last is decided. Given the live ETX marks standing after
 * the opening STX (or every live ETX, where no STX stands), answer the one that closes the text.
 * Canon: the first (#/frame-security, "the first STX..ETX span only").
 */
function closeOf(candidates: readonly MarkHit[]): MarkHit | null {
  return candidates[0] ?? null;
}

/**
 * A carrier's frame, divided once.
 *
 *   · `stx`   — the first live STX, or null.
 *   · `etx`   — the ETX that closes the text: after `stx` where one stands, else among every live ETX.
 *   · `eot`   — the first live EOT past the close (past `stx` when the frame is torn; anywhere when
 *               no STX or ETX stands).
 *   · `faults` — marks the rule had to pass over. Empty for a well-formed frame.
 */
export interface FrameRead {
  readonly stx: MarkHit | null;
  readonly etx: MarkHit | null;
  readonly eot: MarkHit | null;
  readonly faults: readonly FrameFault[];
}

/**
 * A mark the rule passed over, named. `kind` is for a caller that weighs faults differently — a stream
 * of several carriers stands several STX by design, while a second ETX inside one frame never does.
 */
export interface FrameFault {
  readonly kind: "second-stx" | "etx-before-stx" | "second-etx" | "no-etx";
  readonly message: string;
}

export function readFrame(text: string, spans: readonly MaskSpan[] = fencedSpans(text)): FrameRead {
  const marks = frameMarks(text, spans);
  const stx = marks.stx[0] ?? null;
  const after = stx ? marks.etx.filter((h) => h.index >= stx.end) : marks.etx;
  const etx = closeOf(after);
  const floor = etx ? etx.end : stx ? stx.end : 0;
  const eot = marks.eot.find((h) => h.index >= floor) ?? null;

  const faults: FrameFault[] = [];
  // THE MESSAGE NAMES THE COUNT, so the gradient's own phrasing ("text frames stand where the grammar
  // admits one") stays the one a reader has learned.
  if (marks.stx.length > 1) {
    faults.push({ kind: "second-stx", message: `${marks.stx.length} text frames stand where the grammar admits one — only the first verifies` });
  }
  if (stx && marks.etx.some((h) => h.index < stx.index)) {
    faults.push({ kind: "etx-before-stx", message: "an ETX stands ahead of the STX — the text closes before it opens" });
  }
  if (after.length > 1) {
    faults.push({ kind: "second-etx", message: `${after.length} live ETX marks follow the STX — the text closes at the first, and nothing past it is checked or read as body` });
  }
  return { stx, etx, eot, faults };
}

/**
 * The frame's standing, before any digest: absent, torn, or framed.
 *
 * TORN names STX standing without ETX — a truncated transmission. It gets its own reading because the
 * conflation it prevents is the cheapest strip there is: cut a file ahead of its closer and a missing
 * check would otherwise read as lawful absence.
 *
 * `start..end` is the CHECKED span (STX sigil through ETX sigil, inclusive); `bodyStart..bodyEnd` is
 * the text between the two sigils — the authored document, root meta included.
 */
export type FrameStanding =
  | { readonly kind: "absent" }
  | { readonly kind: "torn"; readonly start: number; readonly bodyStart: number; readonly faults: readonly FrameFault[] }
  | {
      readonly kind: "framed";
      readonly start: number;
      readonly end: number;
      readonly bodyStart: number;
      readonly bodyEnd: number;
      readonly faults: readonly FrameFault[];
    };

export function frameStanding(text: string): FrameStanding {
  const f = readFrame(text);
  if (!f.stx) return { kind: "absent" };
  if (!f.etx) return { kind: "torn", start: f.stx.index, bodyStart: f.stx.end, faults: f.faults };
  return { kind: "framed", start: f.stx.index, end: f.etx.end, bodyStart: f.stx.end, bodyEnd: f.etx.index, faults: f.faults };
}

/** The checked span alone — STX sigil through ETX sigil, inclusive — or null where none is framed. */
export function checkSpan(text: string): { start: number; end: number } | null {
  const st = frameStanding(text);
  return st.kind === "framed" ? { start: st.start, end: st.end } : null;
}
