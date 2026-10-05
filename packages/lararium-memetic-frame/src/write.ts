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
import { bccOf, bccOfSpan, classifyPostamble, verifyBcc } from "./check.js";
import { checkSpan } from "./span.js";

/** The one declaration a carrier opens on: this grammar, at the address that specifies it. */
export const CARRIER_DECLARATION =
  '<<!DOCTYPE "memetic-wikitext+tiddlywiki" "lar:///ha.ka.ba/lares/api/pono/memetic-wikitext">>';

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

/** The canonical head sigil: `code` first, the namespace where one stands, both bearing ends quoted. */
export function headSigil(head: FrameHeadSpec): string {
  const ns = (head.namespace ?? "").trim();
  const code = markCode(head.kapu ? "SOH2" : "SOH");
  return `<<^ code="${code}"${ns ? ` namespace="${ns}"` : ""} from="?" -> to="${head.uri}">>`;
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
 *     [prologue]<declaration>\n\n<head>\n<STX>\n\n<body>\n\n<ETX><check>\n\n<EOT>\n[postamble]
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
  out += `<<^ code="${markCode("STX")}">>\n\n${input.body}\n\n<<^ code="${markCode("ETX")}">>`;
  // ETX takes its check adjacent, per the received framing (STX -> text -> ETX -> BCC).
  out += bccOfSpan(out.slice(spanStart));
  out += "\n";
  out += `\n<<^ code="${markCode("EOT")}" -> to="?">>\n`;
  out += (input.postamble ?? "").replace(/^\n+/, "");
  return out;
}

/**
 * Re-stamp a carrier's check over its current span — the writer's half for a carrier edited IN PLACE.
 *
 * A writer that patches body bytes (a field, a digest, a line of prose) has moved the span the check
 * covers, and the check must move with it: the body first, the check last, always.
 *
 *   · `ok` — nothing to do; the bytes come back unchanged.
 *   · `torn` / no frame — nothing is stampable: no bounded span stands to attest to. Unchanged.
 *   · `mismatch` — the stale check adjacent to ETX is REPLACED, byte-anchored at the span's close
 *     (never a whole-file swap: `ni:///…` also reads as prose in a carrier that discusses checks).
 *   · `unchecked` — names TWO shapes. `verifyBcc` demands exact adjacency, so a check that stands but
 *     drifted off its ETX reads `unchecked` like a bare slot. The slot classifier tells them apart: a
 *     check standing anywhere in the slot (the whole tail, or just its first line where more follows)
 *     is REPLACED, never left beside a second one; a genuinely empty slot takes the bare insert.
 *
 * MINTING ON ABSENT (operator ruling). The check is optional on READ and minted on every EMIT, so a
 * hand-authored framed carrier gains its check here rather than standing legal at one gate and red at
 * the next. The cost, named: an unchecked FRAMED carrier cannot be authored on purpose through this
 * door — the BSC trusted-link case. The `unchecked` branch is the one line to reverse if it ever is.
 */
export function stampCarrier(text: string): string {
  const standing = verifyBcc(text);
  if (standing !== "mismatch" && standing !== "unchecked") return text;
  const span = checkSpan(text);
  const want = bccOf(text);
  if (!span || !want) return text;
  if (standing === "mismatch") {
    return text.slice(0, span.end) + text.slice(span.end).replace(/^ni:\/\/\/[a-z0-9-]+;[A-Za-z0-9_-]+/, want);
  }
  const after = text.slice(span.end);
  const wholeTail = classifyPostamble(after);
  const eol = after.indexOf("\n");
  const ownLine = eol < 0 ? wholeTail : classifyPostamble(after.slice(0, eol));
  const standingDigest = wholeTail.kind === "bcc" ? wholeTail.digest : ownLine.kind === "bcc" ? ownLine.digest : null;
  if (standingDigest !== null) {
    const at = after.indexOf(standingDigest);
    const rest = at < 0 ? after : after.slice(at + standingDigest.length);
    return text.slice(0, span.end) + want + rest;
  }
  return text.slice(0, span.end) + want + after;
}
