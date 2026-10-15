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
 *                reader recovers it), a head or release in a TORN spelling (a bare `?`, an unquoted
 *                or positional target, glyphs before the code), a mark out of spine order (a release
 *                before the text closes), a second heading or text frame anywhere in the file — no
 *                reader repairs one in silence. Each fault is named; nothing past the close is folded in.
 *   · `bare`   — NO frame at all: no head, no STX, no ETX, no release. Bare data found on the internet
 *                is not a meme, and reading it as one would invent a carrier nobody wrote.
 *
 * Pure, isomorphic, built on the one span reader and the one check reader — a second reading of the
 * frame here would be the drift `span.ts` exists to end. One file frames ONE carrier, so a second STX
 * tears like any second mark: a stream of several carriers belongs to the SYN-framed profile
 * (#/frame-security), which defines its own resynchronisation, never to this base profile.
 *
 * Meme: lar:///ha.ka.ba/lares/api/pono/memetic-wikitext-framing
 */

import { fencedSpans, maskedExec, maskedExecAll } from "./fence-mask.js";
import { META_OPEN_RE } from "./meta-fence.js";
import { carrierHeadPattern, carrierMarkPattern, carrierReleasePattern } from "./head.js";
import { frameHex } from "./marks.js";
import { CARRIER_DECLARATION } from "./write.js";
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

/**
 * Any caret sigil carrying a head or release code, in whatever spelling — wider than the canonical
 * patterns by design, so a torn spelling is SEEN and named rather than read as no frame at all.
 */
const ANY_END_RE = new RegExp(`<<\\^(?:[^>\\n]|>(?!>))*?&#x(${frameHex("SOH")}|${frameHex("EOT")});(?:[^>\\n]|>(?!>))*>>`, "g");
const SOH_HEX = new RegExp(`^(?:${frameHex("SOH")})$`);

/** A declaration line, live — the frame's own, whatever it spells. */
const DECLARATION_LINE_RE = /^<<!DOCTYPE[^\n]*/gm;

/**
 * ETB (`&#x0017;`) is no frame mark; `FRAME_MARKS` does not declare it, so this reader matches the
 * literal directly, and any ETB sigil in a carrier reads as a torn spelling, the same fault class
 * as a torn declaration or a torn head/release spelling. A mark joins the grammar only through
 * `FRAME_MARKS`, behind a computed, verified check.
 */
const ETB_MARK_RE = /<<\^(?:[^>\n]|>(?!>))*?&#x0017;(?:[^>\n]|>(?!>))*>>/g;

/** Each declaration, head and release written in a spelling the frame grammar does not read. */
function tornSpellings(text: string, spans: ReturnType<typeof fencedSpans>): FrameFault[] {
  const faults: FrameFault[] = [];
  for (const m of maskedExecAll(text, DECLARATION_LINE_RE, spans)) {
    if (m[0] === CARRIER_DECLARATION) continue;
    faults.push({ kind: "torn-spelling", message: `\`${m[0]}\` reads outside the frame grammar — the frame declares \`${CARRIER_DECLARATION}\`; nothing repairs it` });
  }
  for (const m of maskedExecAll(text, ANY_END_RE, spans)) {
    const canonical = SOH_HEX.test(m[1]!) ? carrierHeadPattern("y") : carrierReleasePattern("y");
    canonical.lastIndex = m.index;
    const hit = canonical.exec(text);
    if (hit && hit[0] === m[0]) continue;
    faults.push({
      kind: "torn-spelling",
      message: `\`${m[0]}\` reads outside the frame grammar — the ends read \`code="…" from="?" -> to="…"\` and \`-> to="?"\`, quoted; nothing repairs it`,
    });
  }
  for (const m of maskedExecAll(text, ETB_MARK_RE, spans)) {
    faults.push({
      kind: "torn-spelling",
      message: `\`${m[0]}\` carries ETB — \`$carrier-sila\` mints the fence only behind a computed, verified check, never this bare literal`,
    });
  }
  return faults;
}

/**
 * The frame's SHAPE — the span reader's division, graded, with no digest taken:
 *
 *   · `bare`   — no frame stands.
 *   · `torn`   — the frame cannot be divided without choosing; each fault named.
 *   · `absent` — a frame stands with no text frame (no STX..ETX span).
 *   · `framed` — a text frame stands; `span` is the checked span, STX sigil through ETX sigil.
 *
 * A reader that needs only the shape reads it here and never computes a digest; `verdictOf` adds the
 * digest over the same shape, so the two depths are one reading.
 */
export type FrameShape =
  | { readonly kind: "bare" }
  | { readonly kind: "torn"; readonly faults: readonly FrameFault[] }
  | { readonly kind: "absent" }
  | { readonly kind: "framed"; readonly span: { readonly start: number; readonly end: number } };

export function frameShape(text: string): FrameShape {
  const spans = fencedSpans(text);
  const frame = readFrame(text, spans);
  const torn = tornSpellings(text, spans);
  const marked = frame.stx || frame.etx || frame.eot || torn.length > 0
    || maskedExec(text, carrierMarkPattern("head", "g"), spans)
    || maskedExec(text, carrierMarkPattern("release", "g"), spans);
  if (!marked) return { kind: "bare" };

  const faults = [...frame.faults, ...torn];
  if (frame.stx && !frame.etx) faults.push(NO_ETX);
  // A meta fence IS a fence, so its opener sits at a mask span's start: `allowSpanStart` admits it and
  // still refuses one quoted inside another fence.
  if (frame.stx && maskedExecAll(text, META_OPEN_RE, spans, true).some((m) => m.index < frame.stx!.index)) {
    faults.push(META_BEFORE_STX);
  }
  if (faults.length > 0) return { kind: "torn", faults };
  if (!frame.stx || !frame.etx) return { kind: "absent" };
  return { kind: "framed", span: { start: frame.stx.index, end: frame.etx.end } };
}

/** The verdict over a shape already read: the digest is the one thing it adds. */
export function verdictOf(text: string, shape: FrameShape): FrameVerdict {
  if (shape.kind !== "framed") return shape;
  const check = standingCheck(text, shape.span);
  if (!check) return { kind: "absent" };
  return check.verifies
    ? { kind: "match", check: check.stored }
    : { kind: "stale", stored: check.stored, computed: check.computed };
}

export function verdict(text: string): FrameVerdict {
  return verdictOf(text, frameShape(text));
}
