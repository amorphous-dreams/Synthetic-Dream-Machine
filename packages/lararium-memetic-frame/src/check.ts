/**
 * check — the block check a carrier carries, computed rather than stored.
 *
 * ── WHY IT DERIVES AND NEVER SITS IN A FIELD ────────────────────────────────────────────────────
 * A check held as a record field is a stored derivation, and a stored derivation goes stale the moment
 * the thing it derives from moves. This tree has met that five times over: a genesis manifest naming a
 * plugin two edits back, a router arm matching a shape no carrier writes, a harvester scanning for a
 * sigil that stopped rendering. Each one stayed internally consistent and described something that had
 * stopped being true, and nothing could notice because nothing recomputed.
 *
 * So the emitter computes the check over the body it has just assembled, and a reader recomputes it
 * over the bytes in front of it. Two computations of one fact, never a copy of one.
 *
 * ── THE SPAN, PER THE RECEIVED FRAMING ──────────────────────────────────────────────────────────
 * A block runs `STX -> text -> ETX -> BCC`: the terminator comes first and the check follows it
 * directly (IBM BSC, 1967). The span runs from the first character of the STX sigil to the last
 * character of the ETX sigil, inclusive — so the check covers the marks that bound it and never covers
 * itself, which is what lets it sit after ETX with no self-exclusion rule.
 *
 * ── TWO ALTITUDES: HEX TRAVELS, GLYPHS RENDER ───────────────────────────────────────────────────
 * The slot the check occupies — after ETX, before EOT — carries it in the received framing and in this
 * grammar alike, so one form serves both and the check needs no wrapper of its own.
 *
 * What the check LOOKS like splits by artifact class rather than by layer.
 *
 * A CARRIER holds the `ni:///sha-256;<base64url>` form — RFC 6920, full digest, canonical-or-reject —
 * because a carrier travels. Plain ASCII cannot be bitten by a variation selector, a zero-width joiner,
 * a skin-tone modifier or a client's own normalization, and a reader holding nothing but the file still
 * verifies it. Keeping every glyph vocabulary out of the encoding also keeps rendering REVISABLE: an
 * alphabet frozen into the bytes could never improve without invalidating every carrier ever written,
 * where an alphabet used only to render may be bettered in year three with every stamp still verifying.
 *
 * A PROJECTION carries the glyph-stamped form on disk — an FTLS Powers card, a character sheet, any
 * artifact the wiki renders for a reader rather than ships to a peer. A projection IS the rendered
 * surface, so the file on disk shows what the live wiki shows, and an operator comparing the two reads
 * one thing in both places. The at-a-glance stamp belongs where reading happens.
 *
 * Two spellings of one digest, each where it serves: the same law the house stands at every other
 * altitude — a private pet-name beside a declared Handle, `Aperture` beside `Focus`.
 *
 * ── WHAT A RELAY CAN DO WITH IT ─────────────────────────────────────────────────────────────────
 * One lexical scan — the frame recogniser read through the fence mask, so a quoted mark never frames.
 * No grammar, no rendering, no canonicaliser: the scan reads the carrier's QUOTING, never its meaning.
 * A Herm holding `pull` and not `read` runs that scan without opening what the carrier says — the
 * relay-law exception in `ability-implies` is exactly the capability this instrument was shaped to fit.
 *
 * Meme: lar:///ha.ka.ba/lares/api/pono/memetic-wikitext
 */

// ONE DIGEST, DIRECT. The frame stands on `@noble/hashes` itself rather than on any workspace package,
// so a holder of nothing but this package — a relay, a stock TiddlyWiki, a browser island — computes
// the same check every vessel computes.
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";

import { fencedSpans, maskedExec } from "./fence-mask.js";
import { frameAlt } from "./marks.js";
import { checkSpan, frameStanding } from "./span.js";

/** UTF-8 hex digest. TextEncoder stands in every context the frame runs in (a sandbox lends one). */
function sha256Hex(text: string): string {
  return bytesToHex(sha256(new TextEncoder().encode(text)));
}

/** The one digest algorithm this grammar accepts, named in the check and never chosen by it. */
export const CHECK_ALG = "sha-256";

/**
 * The check names its algorithm so a reader may KNOW, never so a message may CHOOSE.
 *
 * A verifier that dispatched on the algorithm a carrier declares would let the carrier pick its own
 * strength — the shape behind a decade of confusion attacks on token formats that trusted their own
 * `alg` field. So the allowlist lives here, on the reading side, and anything outside it refuses.
 */
const ACCEPTED_ALGS: ReadonlySet<string> = new Set([CHECK_ALG]);

/** base64url of a hex string — no padding, isomorphic, no Buffer. */
function hexToB64u(hex: string): string {
  const A = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  let bits = 0, acc = 0, out = "";
  for (let i = 0; i < hex.length; i += 2) {
    acc = (acc << 8) | parseInt(hex.slice(i, i + 2), 16);
    bits += 8;
    while (bits >= 6) { out += A[(acc >> (bits - 6)) & 63]; bits -= 6; }
  }
  if (bits > 0) out += A[(acc << (6 - bits)) & 63];
  return out;
}

/**
 * The check over an already-isolated body span, as a name that points at itself.
 *
 * The form is the shelves' own: an algorithm, then the full digest of the bytes it covers. A shelf's
 * name says the string it names lives elsewhere; this one says the string is the body directly above
 * it. Position is what tells them apart, and a resolver MUST NOT follow one found after ETX.
 *
 * FULL WIDTH, never truncated. Every system that stores a digest for machine verification stores all
 * of it and shortens only for a reader — and every truncation that got hurt had been sized against
 * accident and then met an adversary. `nihOfSpan` is the reader's form, derived and never stored.
 */
export function bccOfSpan(span: string): string {
  return `ni:///${CHECK_ALG};${hexToB64u(sha256Hex(span))}`;
}

/**
 * The same check in the form RFC 6920 wrote for people: lowercase hex, and a Luhn mod-16 digit that
 * catches the transposition a hand actually makes.
 *
 * DERIVED, NEVER STORED. A carrier holds one spelling; this is what an instrument PRINTS when a person
 * has to read a check aloud or carry it to another screen. Two homes for one fact is the failure this
 * grammar keeps finding, so the second home is a moment rather than a place.
 */
export function nihOfSpan(span: string): string {
  const hex = sha256Hex(span);
  let sum = 0, factor = 2;
  for (let i = hex.length - 1; i >= 0; i--) {
    const addend = factor * parseInt(hex[i]!, 16);
    factor = factor === 2 ? 1 : 2;
    sum += Math.floor(addend / 16) + (addend % 16);
  }
  return `nih:///${CHECK_ALG};${hex};${((16 - (sum % 16)) % 16).toString(16)}`;
}

/** The check a whole carrier should carry, or null where it holds no framed body. */
export function bccOf(text: string): string | null {
  const span = checkSpan(text);
  return span ? bccOfSpan(text.slice(span.start, span.end)) : null;
}

/**
 * Whether the check a carrier carries matches the bytes it wraps.
 *
 * A carrier holding NO check reads `unchecked` rather than `false` — absence of a check and a failed
 * check are different facts, and collapsing them would make the reading useless exactly where it
 * matters. The caller decides what an unchecked carrier may do; graceful parsing says it still parses.
 */
export function verifyBcc(text: string): "ok" | "mismatch" | "unchecked" | "torn" {
  const st = frameStanding(text);
  if (st.kind === "absent") return "unchecked";
  if (st.kind === "torn") return "torn";
  const check = standingCheck(text, st);
  if (!check) return "unchecked";
  return check.verifies ? "ok" : "mismatch";
}

/**
 * The check standing after a framed span, beside the check its bytes compute — or null where none
 * stands. The one place a trailing check is read; `verifyBcc` and `verdict` both answer through it.
 */
export function standingCheck(
  text: string,
  span: { readonly start: number; readonly end: number },
): { readonly stored: string; readonly computed: string; readonly verifies: boolean } | null {
  // ADJACENT, exactly. The check follows the closed sigil with nothing between — the emitter mints it
  // so, and slack here would let two byte-different files share one verdict. A shifted check reads as
  // postamble content: it does not verify, and the projection re-mints it adjacent.
  const trailing = /^(ni:\/\/\/([a-z0-9-]+);([A-Za-z0-9_-]+))/.exec(text.slice(span.end));
  if (!trailing) return null;
  const stored = trailing[1]!;
  const computed = bccOfSpan(text.slice(span.start, span.end));
  // The message names its algorithm; this reader decides whether to accept it. CANONICAL OR REJECT:
  // base64url admits several spellings of a value whose bit-length is not a multiple of six, so a
  // comparator that tolerated them would call two different strings one check. Re-encoding what we
  // computed and comparing whole refuses every non-canonical spelling for free.
  return { stored, computed, verifies: ACCEPTED_ALGS.has(trailing[2]!) && stored === computed };
}

/*
 * The BCC slot — what may stand between ETX and EOT, and nothing else.
 *
 * ── THE SLOT IS OCCUPIED, AND BY ONE THING ──────────────────────────────────────────────────────
 * The frame glyphs are ASCII C0 as IBM BSC (1967) and ISO 1745 (1975) used them: SOH opens the
 * heading, STX opens the text, ETX ends the text, EOT ends the transmission. A block reads
 *
 *     [SOH heading] STX text ETX BCC        …        EOT
 *
 * The BCC — block check character — is an integrity trailer, and it sits AFTER ETX for a reason that
 * is not stylistic: it cannot live inside the span it checks. Its coverage runs from STX through the
 * ETX **inclusive**, so the terminator is part of what the check attests.
 *
 * ETX is also where a verdict falls. In BSC it "calls for a reply": the receiver checks the BCC and
 * answers ACK or NAK. That is exactly the ingest gate's boundary — ingest · noop · conflict · refuse —
 * so the trailer belongs to the same moment the gate already decides in.
 *
 * EOT then ends the transmission in BOTH directions: nothing further is expected from or to the far
 * side. Content addressed after that is addressed to nobody.
 *
 * ── SO: NO PAYLOAD BETWEEN ETX AND EOT ──────────────────────────────────────────────────────────
 * A carrier that put content there lost it silently — the render simply did not reproduce it, which
 * is the inverse of a block check: BSC answered a bad block with NAK and a retransmission, never with
 * a quiet drop. `classifyPostamble` makes the slot legible so the deserializer can refuse instead.
 *
 * PARTIAL BLOCKS TAKE ETB, NEVER A SECOND ETX. BSC terminated a non-final block with ETB (0x17) and
 * reserved ETX for the last one. Two ETXs would assert two verdicts on one transmission — which is
 * the shape to reach for if a carrier is ever split, or streamed during a residency move.
 *
 * Canon: lar:///ha.ka.ba/lares/api/pono/memetic-wikitext
 */

// THE SLOT READER KEEPS ITS OWN SCAN (marks.ts). It reads an EOT sigil DECORATED — `(?:\s*\S+)?\s*`
// admits namespace glyphs and a `code=` binding alike — and strips to the line's end, because `[^>]*`
// cannot cross the `>` inside `-> ?`. Only the entity alternation travels.
const DECOR = "(?:\\s*\\S+)?\\s*";
const EOT_STRIP_SRC = `<<\\^${DECOR}${frameAlt("EOT")}[^\\n]*?>>`;


/**
 * The check as the spec writes it: `ni:///<alg>;<base64url>`, standing directly after the ETX sigil.
 * The namespace rides the heading, never the check — the digest binds bytes, and bytes carry no
 * vibration.
 *
 * A block runs `STX -> text -> ETX -> BCC` and the check follows the terminator with nothing between —
 * the position a receiver has always read it from. The value derives; `bccOfSpan` computes it over the
 * framed span, and the slot classifier only says whether one STANDS. Present and CORRECT are different
 * questions, and a classifier that answered the first under the name of the second would invite the
 * reading that a present postamble is a verified one.
 */
export const BCC_RE = /^(ni:\/\/\/[a-z0-9-]+;[A-Za-z0-9_-]+)$/;

/**
 * What a carrier wrote between ETX and EOT.
 *
 *   · `empty`   — whitespace only. The overwhelmingly common case, and legal: the BCC is OPTIONAL,
 *                 exactly as BSC allowed blocks to run without one on a trusted link.
 *   · `bcc`     — a well-formed block check. Legal, and checkable.
 *   · `foreign` — anything else. Payload stranded past the end of text, which no reader will ever
 *                 render. This is the case that used to vanish.
 */
export type Postamble =
  | { readonly kind: "empty" }
  | { readonly kind: "bcc";     readonly digest: string }
  | { readonly kind: "foreign"; readonly text: string; readonly lines: number };

export function classifyPostamble(postamble: string): Postamble {
  if (postamble.trim().length === 0) return { kind: "empty" };

  // EOT and any trailing whitespace belong to the frame, never to the slot — strip them before
  // judging what the operator actually wrote there.
  // `[^>]*` cannot cross the `>` inside `-> ?`, so the EOT sigil's own arrow defeats a naive strip.
  // Match to the line's end instead — a frame sigil never spans lines.
  const body = postamble
    .replace(new RegExp(EOT_STRIP_SRC, "g"), "")
    .trim();
  if (body.length === 0) return { kind: "empty" };

  const m = BCC_RE.exec(body);
  if (m) return { kind: "bcc", digest: m[1] as string };

  return { kind: "foreign", text: body, lines: body.split("\n").length };
}

/**
 * Read the bytes after the carrier's terminating EOT mark.
 *
 * A postamble between ETX and EOT is the BCC slot and may be empty or carry one BCC. Bytes after
 * EOT have no carrier boundary left to receive them. Keep this as a separate reading: a shifted
 * BCC with legitimate EOT still has a recoverable slot, while content after EOT is boundary drift
 * that normalization must refuse to guess over.
 */
export function classifyPostEot(text: string): Postamble | null {
  // Find the first actual EOT terminator. We inspect the raw tail afterwards rather
  // than passing it through `classifyPostamble`, whose ETX-slot reader intentionally strips all EOT
  // variants and would therefore launder a second terminator as empty postamble.
  const eot = maskedExec(text, new RegExp(EOT_STRIP_SRC, "g"), fencedSpans(text));
  if (!eot) return null;
  const tail = text.slice(eot.index + eot[0].length);
  if (tail.trim().length === 0) return { kind: "empty" };
  return { kind: "foreign", text: tail.trim(), lines: tail.trim().split("\n").length };
}
