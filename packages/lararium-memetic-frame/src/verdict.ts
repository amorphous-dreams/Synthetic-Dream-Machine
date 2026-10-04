/**
 * verdict — what the FRAME says about a text, before any grammar reads it.
 *
 * ingest(bytes) = decide(parse(bytes), verdict(bytes)). The parse is the body reader's; this is the
 * frame's, and it carries its evidence rather than a bare flag, so a gate deciding policy over it never
 * has to read the bytes a second time:
 *
 *   · `match`  — the check standing after ETX covers the span. The check it read rides along.
 *   · `stale`  — a check stands and the span no longer computes it: BOTH digests, the stored and the
 *                computed, so a report can show the operator what moved.
 *   · `absent` — a frame stands (a head, a text frame, a release) and no check was ever stamped.
 *   · `torn`   — the frame cannot be divided without choosing: no ETX after the STX, a second live ETX,
 *                an ETX ahead of the STX, a toml meta fence standing before the STX (root metadata
 *                opens the BODY — a block above STX stands outside the span the check covers, and no
 *                reader recovers it). Each fault is named; nothing past the close is folded in.
 *   · `bare`   — NO frame at all: no head, no STX, no ETX, no release. Bare data found on the internet
 *                is not a meme, and reading it as one would invent a carrier nobody wrote.
 *
 * Pure, isomorphic, built on the one span reader and the one check reader — a second reading of the
 * frame here would be the drift `span.ts` exists to end. A second STX is never a tear: a stream of
 * several carriers stands several by design, and the check covers the first span only.
 *
 * Meme: lar:///ha.ka.ba/lares/api/pono/memetic-wikitext-framing
 */

import { fencedSpans, maskedExec, maskedExecAll } from "./fence-mask.js";
import { META_OPEN_RE } from "./meta-fence.js";
import { carrierMarkPattern } from "./head.js";
import { readFrame, type FrameFault } from "./span.js";
import { standingCheck } from "./check.js";

export type FrameVerdict =
  | { readonly kind: "match"; readonly check: string }
  | { readonly kind: "stale"; readonly stored: string; readonly computed: string }
  | { readonly kind: "absent" }
  | { readonly kind: "torn"; readonly faults: readonly FrameFault[] }
  | { readonly kind: "bare" };

const NO_ETX: FrameFault = { kind: "no-etx", message: "STX stands without ETX; carrier body is torn" };
const META_BEFORE_STX: FrameFault = {
  kind: "meta-before-stx",
  message: "a toml meta fence stands before STX — root metadata opens the body, below STX; the frame recovers nothing above it",
};

export function verdict(text: string): FrameVerdict {
  const spans = fencedSpans(text);
  const frame = readFrame(text, spans);
  const marked = frame.stx || frame.etx || frame.eot
    || maskedExec(text, carrierMarkPattern("head", "g"), spans)
    || maskedExec(text, carrierMarkPattern("release", "g"), spans);
  if (!marked) return { kind: "bare" };

  const faults = frame.faults.filter((f) => f.kind !== "second-stx");
  if (frame.stx && !frame.etx) faults.push(NO_ETX);
  // A meta fence IS a fence, so its opener sits at a mask span's start: `allowSpanStart` admits it and
  // still refuses one quoted inside another fence.
  if (frame.stx && maskedExecAll(text, META_OPEN_RE, spans, true).some((m) => m.index < frame.stx!.index)) {
    faults.push(META_BEFORE_STX);
  }
  if (faults.length > 0) return { kind: "torn", faults };

  if (!frame.stx || !frame.etx) return { kind: "absent" };
  const check = standingCheck(text, { start: frame.stx.index, end: frame.etx.end });
  if (!check) return { kind: "absent" };
  return check.verifies
    ? { kind: "match", check: check.stored }
    : { kind: "stale", stored: check.stored, computed: check.computed };
}
