/**
 * write — THE FRAME WRITER: the one hand that mints SOH, STX, ETX + check, and EOT around a body.
 *
 * ── WHAT THE WRITER OWNS, AND WHAT IT DOES NOT ──────────────────────────────────────────────────
 * The frame is the carrier's business: the declaration naming the grammar, the head naming the
 * address, the STX/ETX bounds, the check, the release. A writer that hand-spells any of these mints a
 * carrier in a shape the readers have left behind — six scripts did, each with the meta block above
 * STX, a positional bearing, and no check, and every one read as a degraded carrier at its first gate.
 *
 * The BODY is the caller's. Root TOML meta, authored prose, ahu worksites: all of it travels inside
 * STX..ETX and all of it is covered by the check, but none of it is frame. This writer never parses,
 * reorders or re-spells a byte of the body; it only bounds it and attests to it.
 *
 * ── COMPUTED, NEVER READ ────────────────────────────────────────────────────────────────────────
 * The check is computed over the span this call has just assembled — STX sigil through ETX sigil,
 * inclusive — and never copied from anywhere. A writer that patches the body of an existing carrier
 * re-stamps through `stampCarrier`, which reads the span with the ONE span reader the verifier uses.
 *
 * Meme: lar:///ha.ka.ba/lares/api/pono/memetic-wikitext-framing
 */

import { FRAME_MARKS } from "./marks.js";
import { bccOf, bccOfSpan, etxFaults } from "./check.js";
import { checkSpan, readFrame } from "./span.js";

/**
 * The one declaration a carrier opens on: this grammar (`type=`), at the address that specifies it
 * (`spec=`). Both values name themselves and ride backtick runs, as every value in the grammar does.
 */
export const CARRIER_DECLARATION =
  "<<!DOCTYPE type=`memetic-wikitext+tiddlywiki` spec=`lar:///ha.ka.ba/lares/api/pono/memetic-wikitext`>>";

/** A mark's entity by its NAME — so a writer names a mark rather than spelling its code. */
export function markCode(name: string): string {
  const mark = FRAME_MARKS.find((m) => m.name === name);
  if (!mark) throw new Error(`memetic-frame: no frame mark named ${name}`);
  return mark.code;
}

/** What the head names: the address, the namespace glyphs where one is declared, the Kapu variant. */
export interface FrameHeadSpec {
  readonly uri: string;
  /** Literal glyphs (`⊙`, `ॐ ँ`). Omitted or blank, the head carries no namespace param. */
  readonly namespace?: string;
  /** Head with SOH₂ (`&#x0011;`) — the Kapu heading. */
  readonly kapu?: boolean;
}

/**
 * The canonical head sigil: `code` first, the namespace where one stands, then the bearing pair,
 * `from` before `to`. Every value rides a backtick run, and no arrow stands between the ends: the
 * pair carries the relation.
 */
export function headSigil(head: FrameHeadSpec): string {
  const ns = (head.namespace ?? "").trim();
  const code = markCode(head.kapu ? "SOH2" : "SOH");
  return `<<^ code=\`${code}\`${ns ? ` namespace=\`${ns}\`` : ""} from=\`?\` to=\`${head.uri}\`>>`;
}

/** A bare frame mark by its NAME — ``<<^ code=`&#x0002;`>>`` for STX — the one spelling every writer mints. */
export function markSigil(name: string): string {
  return `<<^ code=\`${markCode(name)}\`>>`;
}

/** The sealed close: ETX carrying the block check in its `bcc` slot — ``<<^ code=`&#x0003;` bcc=`ni:///…`>>``. */
export function sealSigil(check: string): string {
  return `<<^ code=\`${markCode("ETX")}\` bcc=\`${check}\`>>`;
}

/** The release: EOT, resolving toward an address it cannot know — ``<<^ code=`&#x0004;` to=`?`>>``. */
export function releaseSigil(): string {
  return `<<^ code=\`${markCode("EOT")}\` to=\`?\`>>`;
}

export interface FrameCarrierInput {
  readonly head: FrameHeadSpec;
  /** Everything between STX and ETX — root meta, prose, worksites. Bounded and checked, never read. */
  readonly body: string;
  /** Bytes the author wrote ABOVE the declaration. Emitted first, verbatim. */
  readonly prologue?: string;
  /** The declaration line. Defaults to {@link CARRIER_DECLARATION}; `null` omits it. */
  readonly declaration?: string | null;
  /** Bytes past EOT. Leading newlines fold into the EOT line's own, so the shore is a fixed point. */
  readonly postamble?: string;
}

/**
 * Frame a body:
 *
 *     [prologue]<declaration>\n\n<head>\n<STX>\n\n<body>\n\n<ETX bcc=check>\n\n<EOT>\n[postamble]
 *
 * The padding is the canonical form's own (one blank line inside each bound), so a body framed here and
 * read back by the deserializer re-frames to the same bytes.
 */
export function frameCarrier(input: FrameCarrierInput): string {
  let out = input.prologue ?? "";
  const declaration = input.declaration === undefined ? CARRIER_DECLARATION : input.declaration;
  if (declaration !== null) out += `${declaration}\n\n`;
  out += `${headSigil(input.head)}\n`;
  // THE SPAN OPENS HERE, on the STX sigil's first byte.
  const spanStart = out.length;
  out += `${markSigil("STX")}\n\n${input.body}\n\n`;
  // THE CHECK RIDES ITS SLOT. The digest reads the span with the bcc run deleted, which is the span
  // closed on the bare ETX, so the writer hashes that and then seats the value in the slot.
  const check = bccOfSpan(out.slice(spanStart) + markSigil("ETX"));
  out += sealSigil(check);
  out += "\n";
  out += `\n${releaseSigil()}\n`;
  out += (input.postamble ?? "").replace(/^\n+/, "");
  return out;
}

/**
 * Re-stamp a carrier's check over its current span — the writer's half for a carrier edited IN PLACE.
 *
 * A writer that patches body bytes (a field, a digest, a line of prose) has moved the span the check
 * covers, and the check must move with it: the body first, the check last, always. The check rides
 * the closing ETX sigil's `bcc` slot, so a stamp rewrites that one sigil and no other byte.
 *
 *   · a matching slot — the bytes come back unchanged.
 *   · no frame, a torn frame, an ETX in a spelling outside the grammar, or the retired trailer after
 *     ETX — nothing stamps: the frame names its fault and the writer never guesses over it (the
 *     trailer migrates through `tools/grammar-cut.mjs`, which never re-seals a broken seal).
 *   · a stale slot — its value is REPLACED in place.
 *   · a bare ETX — the slot is MINTED.
 *
 * MINTING ON ABSENT (operator ruling). The check is optional on READ and minted on every EMIT, so a
 * hand-authored framed carrier gains its check here rather than standing legal at one gate and red at
 * the next. The cost, named: an unchecked FRAMED carrier cannot be authored on purpose through this
 * door — the BSC trusted-link case.
 */
export function stampCarrier(text: string): string {
  const frame = readFrame(text);
  if (!frame.stx || !frame.etx || frame.faults.length > 0) return text;
  if (etxFaults(text, frame.etx, true).length > 0) return text;
  const want = bccOf(text);
  if (!want || !checkSpan(text)) return text;
  return text.slice(0, frame.etx.index) + sealSigil(want) + text.slice(frame.etx.end);
}
