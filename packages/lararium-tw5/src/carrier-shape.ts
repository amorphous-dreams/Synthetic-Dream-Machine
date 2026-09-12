/**
 * carrier-shape — how far down the ingest gradient a carrier sits, named rather than counted.
 *
 * ── WHY A SHAPE AND NOT A BOOLEAN ───────────────────────────────────────────────────────────────
 * Graceful parsing says NO parse breaks badly: a carrier missing its frame still yields records, a
 * carrier missing its declaration still dispatches. That mercy is load-bearing and it hides things.
 * A file can lose its address and keep rendering, and every corpus gate that walks `uri-path` will
 * skip it forever at `if (!uri) continue` — the gate reporting 601 of 618 while calling itself
 * corpus-wide.
 *
 * So the reading is a GRADIENT, not a verdict. This names which marks a carrier carries, which KIND
 * that makes it, and which marks that kind requires and lacks.
 *
 * ── THE FOUR KINDS, AS THE CORPUS ACTUALLY HOLDS THEM ───────────────────────────────────────────
 * · `carrier`    — declares `uri-path`: a meme. Wants the whole frame and a block check.
 * · `descriptor` — declares `bag`: a bag's own declaration, not a meme. It names WHO may read the
 *                  bag and WHERE its bytes rest, so it carries a head and a declaration and stops.
 *                  A body frame here would claim it holds a meme's text, which it does not.
 * · `shelf`      — declares neither, but its head names an address: a library index. The head knows
 *                  where it stands and the declaration does not say so, which is exactly the fault
 *                  that makes it invisible.
 * · `unframed`   — no head at all. Bytes with a `.mem` extension.
 *
 * The kind reads from the DECLARATION, never from the path: a file's location says where it rests,
 * and what it IS is a thing it states.
 *
 * Meme: lar:///ha.ka.ba/lares/api/pono/memetic-wikitext
 */

import { fencedSpans, maskedExec, maskedExecAll, type MaskSpan } from "./meme-ast/fence-mask.js";
import { carrierMarkPattern, matchCarrierHead } from "./carrier-head.js";
import { verifyBcc } from "./carrier-check.js";
import { META_OPEN_RE, META_OPEN_CANON, isCanonicalMetaOpen } from "./meta-fence.js";

/** One mark's presence, read through the fence mask so a teaching example never counts as a frame. */
export interface CarrierMarks {
  readonly doctype: boolean;
  readonly head:    boolean;
  readonly meta:     boolean;
  readonly uriPath: string | null;
  readonly bag:     string | null;
  readonly headUri: string | null;
  readonly stx:     boolean;
  readonly etx:     boolean;
  readonly eot:     boolean;
  readonly check:   "ok" | "mismatch" | "unchecked" | "torn";
}

export type CarrierKind = "carrier" | "descriptor" | "shelf" | "unframed";

export interface CarrierShape {
  readonly kind:   CarrierKind;
  readonly marks:  CarrierMarks;
  /** What this kind requires and this file lacks. Empty means the file stands at its kind's floor. */
  readonly faults: readonly string[];
}

/** A frame mark, counted only outside a quote fence. */
function marked(text: string, re: RegExp): boolean {
  return maskedExec(text, re, fencedSpans(text)) !== null;
}

/**
 * The first meta block's value for a key, or null. Read raw: a shape reading must not need a parser.
 *
 * READ THROUGH THE MASK, like the `meta` mark beside it. A flat `.exec` took the FIRST block in the
 * bytes, so a carrier whose head sat above a ````-quoted lesson answered with the LESSON'S address:
 * `marks.meta` read false at its own mask while `marks.uriPath` read `ha.ka.ba/not/this`, and a shelf
 * could present as a carrier bearing an address no file owns. No corpus file stood that way — the two
 * readings were measured over all 724 and never disagreed — so this closes a hole rather than a wound.
 */
function metaValue(text: string, spans: readonly MaskSpan[], key: string): string | null {
  const open = maskedExec(text, META_OPEN_RE, spans, true);
  if (!open) return null;
  const from  = open.index + open[0].length;
  const close = text.indexOf("\n```", from);
  // An opener with no closer names no block. The flat read required the closer too, and a shape
  // reading of half a fence would be a value the file never finished stating.
  if (close < 0) return null;
  const m = new RegExp(`^${key}\\s*=\\s*"([^"]*)"`, "m").exec(text.slice(from, close));
  return m ? m[1]! : null;
}

/** The opener line as this file actually spells it, or null when it carries no meta block. */
function metaOpenLine(text: string, spans: readonly MaskSpan[]): string | null {
  const open = maskedExec(text, META_OPEN_RE, spans, true);
  return open ? open[0].replace(/\n$/, "") : null;
}

export function readCarrierShape(text: string): CarrierShape {
  const spans = fencedSpans(text);
  // A `>` CLOSES A CALL ONLY WHEN A SECOND ONE FOLLOWS. That reads TiddlyWiki's own
  // `reUnquotedAttribute` (core/modules/parsers/parseutils.js), which admits `(?:>(?!>))|[^\s>"']` inside
  // an unquoted value — so a bearing arrow, a comparison, any bracket at all rides as content. A tail
  // scanned as `[^>\n]*` stops at the first one and the sigil never closes, and the corpus reads unframed.
  // The PREFIX still stops at `&`: a namespace written as entities would otherwise be read as the
  // control code, which is the quietest way this frame has broken.
  const headM = maskedExec(text, carrierMarkPattern("head", "g"), spans);
  const marks: CarrierMarks = {
    doctype: /^<<!DOCTYPE /m.test(text),
    head:    headM !== null,
    // THE DECLARATION OPENS A FENCE OF ITS OWN, so its opener sits exactly at a mask span's start and a
    // plain masked read rejects it. `allowSpanStart` admits the boundary and still refuses a fence
    // INTERIOR — which is what separates a carrier's real declaration from one quoted in a lesson.
    meta:     maskedExec(text, META_OPEN_RE, spans, true) !== null,
    uriPath: metaValue(text, spans, "uri-path"),
    bag:     metaValue(text, spans, "bag"),
    // THE ARROW'S FAR SIDE IS A NAMED FIELD, and reading the token after `->` takes the name with it.
    // Every carrier in the corpus names that side, so an unnamed read returned `to=lar:///…` on all of
    // them — 639 when this was measured, 724 now — while the only vector for it built its fixture
    // without the name and stayed green. A count in prose goes stale the week it is written; the
    // reading it records does not, and the corpus test beside it is what actually holds the line. The
    // name stays OPTIONAL in the grammar — `? -> lar:///x` is the positional spelling normalize
    // converts — and it is stripped where present.
    // AND THE ADDRESS COMES FROM THE SHORE, which strips the quote pair and refuses a torn head.
    headUri: headM ? (matchCarrierHead(headM[0])?.uri ?? null) : null,
    stx:     marked(text, /<<\^(?:[^>\n]|>(?!>))*&#x0002;(?:[^>\n]|>(?!>))*>>/g),
    etx:     marked(text, /<<\^(?:[^>\n]|>(?!>))*&#x0003;(?:[^>\n]|>(?!>))*>>/g),
    eot:     marked(text, /<<\^(?:[^>\n]|>(?!>))*&#x(?:0004|0014);(?:[^>\n]|>(?!>))*>>/g),
    check:   verifyBcc(text),
  };

  // KIND READS THE DECLARATION FIRST. A descriptor that also carried a uri-path would name itself two
  // things at once, so `bag` wins and the collision surfaces as a fault rather than a silent pick.
  const kind: CarrierKind =
    !marks.head            ? "unframed"
    : marks.bag !== null   ? "descriptor"
    : marks.uriPath !== null ? "carrier"
    : "shelf";

  const faults: string[] = [];
  if (!marks.doctype) faults.push("no declaration — nothing names the grammar that reads it");
  if (!marks.head)    faults.push("no head sigil — the file states no bearing and no namespace");

  // THE OPENER IS ADMITTED WIDE AND HELD NARROW. A reader takes `[ \t]+` between the label and the
  // word so no carrier goes invisible over whitespace, and the canon is one space — how every emitter
  // writes it and how 733 of 733 openers in the corpus stand. Without this fault the tolerance would
  // BE the canon: a deviant spelling parses, so nothing would ever say otherwise, and the corpus would
  // drift one file at a time until the strict readers this collapse retired were needed again.
  const openLine = metaOpenLine(text, spans);
  if (openLine !== null && !isCanonicalMetaOpen(openLine)) {
    faults.push(`meta fence opens \`${openLine}\` — canon is \`${META_OPEN_CANON}\`, one space and nothing after`);
  }

  if (kind === "descriptor" && marks.uriPath !== null) {
    faults.push("declares both `bag` and `uri-path` — a bag and a meme are different things");
  }
  if (kind === "shelf") {
    faults.push(
      marks.headUri
        ? `the head names ${marks.headUri} and the declaration states no uri-path — every corpus gate skips it`
        : "no uri-path and no head address — the file names nowhere",
    );
  }
  if (kind === "carrier" || kind === "unframed") {
    if (!marks.meta) faults.push("no meta block — the carrier declares no identity");
    for (const [have, name] of [[marks.stx, "STX"], [marks.etx, "ETX"], [marks.eot, "EOT"]] as const) {
      if (!have) faults.push(`no ${name} — the body has no ${name === "EOT" ? "release" : "bound"}`);
    }
  }
  // A descriptor closes on EOT with no body between; only the release is required of it.
  if (kind === "descriptor" && !marks.eot) faults.push("no EOT — the declaration never releases");
  if (marks.check === "mismatch") faults.push("block check does not match the body it follows");
  // A torn frame reads as a truncated transmission, never as an unchecked one — the conflation would
  // let a file cut ahead of its closer pass as lawful absence-of-check.
  if (marks.check === "torn") faults.push("the frame opens and never closes — STX stands without ETX; torn reads as truncated, never unchecked");
  // ONE TEXT FRAME PER CARRIER. The check covers the first STX..ETX span and only that, so a second
  // frame would ride beneath a verdict computed over the first — the smuggling shape. The gradient
  // surfaces it rather than letting the first frame's `ok` speak for bytes it never covered.
  const stxCount = maskedExecAll(text, /<<\^(?:[^>\n]|>(?!>))*&#x0002;(?:[^>\n]|>(?!>))*>>/g, spans).length;
  if (stxCount > 1) faults.push(`${stxCount} text frames stand where the grammar admits one — only the first verifies`);
  // THE FRAME MUST OPEN BEFORE THE BODY IT CLAIMS TO COVER. An STX seated after the last block leaves
  // a span of nearly nothing, and the check over nothing matches its own recomputation — so the file
  // reads `ok` at every gate while none of its bytes are covered. Two carriers stood that way, and the
  // check-witness counted both among its greens. Ahu openers outside the frame are the reading: they
  // are body, and body before the frame is body the verdict never saw.
  const stxAt = maskedExecAll(text, /<<\^(?:[^>\n]|>(?!>))*&#x0002;(?:[^>\n]|>(?!>))*>>/g, spans)[0]?.index;
  if (stxAt !== undefined) {
    const outside = maskedExecAll(text, /<<~ ahu\b/g, spans).filter((m) => m.index < stxAt).length;
    if (outside > 0) faults.push(`${outside} block(s) stand ahead of the text frame — the check covers a span that is not the body`);
  }

  return { kind, marks, faults };
}
