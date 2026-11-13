/**
 * root-meta — THE FENCE OPENS THE BODY: the one rule for which meta fence names a carrier.
 *
 * A labelled meta fence names the CARRIER only where it opens the body: the first live opener after STX,
 * with nothing but spacing between STX and it, closed by `META_FENCE_RE` (the first tick run after the
 * opener). Every later meta fence heads the slot it sits in and never reaches the carrier. The deserializer
 * splits the root fields by exactly this rule (`divideCarrier`); the frame's head binding, carrier-shape and
 * the tw5 root-meta locator read it here, so a carrier whose root names nothing never borrows a slot's
 * title (blind security read A3, 2026-11-01).
 *
 * The rule reads the span the check covers: STX through ETX. A carrier with no text frame has no sealed
 * root meta, and this answers null.
 *
 * Meme: lar:///ha.ka.ba/lares/api/pono/memetic-wikitext-framing
 */

import { fencedSpans, maskedExec, type MaskSpan } from "./fence-mask.js";
import { META_FENCE_RE } from "./meta-fence.js";
import { readFrame } from "./span.js";

export interface RootMetaFence {
  /** Where the opener begins, in the whole text. */
  readonly openStart: number;
  /** Where the body begins, just past the opener's newline. */
  readonly bodyStart: number;
  /** Where the body ends: the index of the closing tick run. */
  readonly bodyEnd: number;
  /** The body, `text.slice(bodyStart, bodyEnd)`. */
  readonly body: string;
}

/** The carrier's root meta fence, by the one rule, or null where no fence opens the body. */
export function rootMetaFence(text: string, spans: readonly MaskSpan[] = fencedSpans(text)): RootMetaFence | null {
  const frame = readFrame(text, spans);
  if (!frame.stx || !frame.etx || frame.etx.index < frame.stx.end) return null;
  const from = frame.stx.end;
  const region = text.slice(from, frame.etx.index);
  // The region reads its own mask, as the deserializer's body region does: one rule, one reading.
  const m = maskedExec(region, META_FENCE_RE, fencedSpans(region), true);
  if (!m || region.slice(0, m.index).trim() !== "") return null;
  const openLen = (/^[^\n]*\n/.exec(m[0]) ?? [""])[0].length;
  const bodyStart = from + m.index + openLen;
  const body = m[1] ?? "";
  return { openStart: from + m.index, bodyStart, bodyEnd: bodyStart + body.length, body };
}
