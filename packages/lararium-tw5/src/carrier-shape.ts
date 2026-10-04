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
 * So the reading is a GRADIENT, not a verdict. Every `.mem` source reads as a carrier; its marks name
 * how completely that carrier arrives.
 *
 * ── ONE CARRIER, MANY MARKS ─────────────────────────────────────────────────────────────────────
 * `uri-path` names a meme address. `bag` names a bag declaration. Both are authored fields within the
 * same carrier shape. DOCTYPE, SOH, root TOML, STX, ETX, EOT, and the block check establish the full
 * transmission; absent marks surface as gradient faults.
 *
 * Meme: lar:///ha.ka.ba/lares/api/pono/memetic-wikitext
 */

import {
  fencedSpans,
  maskedExec,
  maskedExecAll,
  type MaskSpan,
  carrierMarkPattern,
  matchCarrierHead,
  verifyBcc,
  readFrame,
  META_OPEN_RE,
  META_OPEN_CANON,
  isCanonicalMetaOpen,
} from "@lararium/memetic-frame";

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

export interface CarrierShape {
  readonly marks:  CarrierMarks;
  /** What the carrier requires and this source lacks. Empty means the carrier stands at its full floor. */
  readonly faults: readonly string[];
}

/**
 * The first meta block's value for a key, or null. Read raw: a shape reading must not need a parser.
 *
 * READ THROUGH THE MASK, like the `meta` mark beside it. A flat `.exec` took the FIRST block in the
 * bytes, so a carrier whose head sat above a ````-quoted lesson answered with the LESSON'S address:
 * `marks.meta` read false at its own mask while `marks.uriPath` read `ha.ka.ba/not/this`, and a carrier
 * could present as bearing an address no file owns. No corpus file stood that way — the two
 * readings were measured over all 724 and never disagreed — so this closes a hole rather than a wound.
 */
function metaValue(text: string, spans: readonly MaskSpan[], key: string, from = 0): string | null {
  const open = metaOpenFrom(text, spans, from);
  if (!open) return null;
  const start = open.index + open[0].length;
  const close = text.indexOf("\n```", start);
  // An opener with no closer names no block. The flat read required the closer too, and a shape
  // reading of half a fence would be a value the file never finished stating.
  if (close < 0) return null;
  const m = new RegExp(`^${key}\\s*=\\s*"([^"]*)"`, "m").exec(text.slice(start, close));
  return m ? m[1]! : null;
}

/** The opener line as this file actually spells it, or null when it carries no meta block. */
function metaOpenLine(text: string, spans: readonly MaskSpan[], from = 0): string | null {
  const open = metaOpenFrom(text, spans, from);
  return open ? open[0].replace(/\n$/, "") : null;
}

/**
 * The first live meta opener at or past `from`. THE ROOT META RIDES THE BODY: where a frame opens, the
 * carrier's identity block is the first thing after STX, so the reading starts there and a meta block
 * standing ABOVE the frame never answers for the body below it.
 */
function metaOpenFrom(text: string, spans: readonly MaskSpan[], from: number): RegExpExecArray | null {
  return maskedExecAll(text, META_OPEN_RE, spans, true).find((m) => m.index >= from) ?? null;
}

export function readCarrierShape(text: string): CarrierShape {
  const spans = fencedSpans(text);
  // A `>` CLOSES A CALL ONLY WHEN A SECOND ONE FOLLOWS. That reads TiddlyWiki's own
  // `reUnquotedAttribute` (core/modules/parsers/parseutils.js), which admits `(?:>(?!>))|[^\s>"']` inside
  // an unquoted value — so a bearing arrow, a comparison, any bracket at all rides as content. A tail
  // scanned as `[^>\n]*` stops at the first one and the sigil never closes, lowering the carrier's frame grade.
  // The PREFIX still stops at `&`: a namespace written as entities would otherwise be read as the
  // control code, which is the quietest way this frame has broken.
  const headM = maskedExec(text, carrierMarkPattern("head", "g"), spans);
  // THE FRAME IS READ ONCE, by the one span reader every gate shares — never re-scanned here.
  const frame = readFrame(text, spans);
  // Where a frame opens, the root meta is the body's: read from STX on. A carrier with no STX is all
  // body, and reads from the top.
  const bodyFrom = frame.stx ? frame.stx.end : 0;
  const marks: CarrierMarks = {
    doctype: /^<<!DOCTYPE /m.test(text),
    head:    headM !== null,
    // THE DECLARATION OPENS A FENCE OF ITS OWN, so its opener sits exactly at a mask span's start and a
    // plain masked read rejects it. `allowSpanStart` admits the boundary and still refuses a fence
    // INTERIOR — which is what separates a carrier's real declaration from one quoted in a lesson.
    meta:     metaOpenFrom(text, spans, bodyFrom) !== null,
    uriPath: metaValue(text, spans, "uri-path", bodyFrom),
    bag:     metaValue(text, spans, "bag", bodyFrom),
    // THE ARROW'S FAR SIDE IS A NAMED FIELD, and reading the token after `->` takes the name with it.
    // Corpus carriers name that side, while the bare form remains a legal grammar spelling. The corpus
    // test beside this reader holds the shared interpretation. `? -> lar:///x` supplies the far-side
    // address positionally, and normalization writes the named form.
    // AND THE ADDRESS COMES FROM THE SHORE, which strips the quote pair and refuses a torn head.
    headUri: headM ? (matchCarrierHead(headM[0])?.uri ?? null) : null,
    stx:     frame.stx !== null,
    etx:     frame.etx !== null,
    eot:     frame.eot !== null,
    check:   verifyBcc(text),
  };

  const faults: string[] = [];
  if (!marks.doctype) faults.push("no declaration — nothing names the grammar that reads it");
  if (!marks.head)    faults.push("no head sigil — the file states no bearing and no namespace");

  // THE OPENER IS ADMITTED WIDE AND HELD NARROW. A reader takes `[ \t]+` between the label and the
  // word so no carrier goes invisible over whitespace, and the canon is one space — how every emitter
  // writes it and how 733 of 733 openers in the corpus stand. Without this fault the tolerance would
  // BE the canon: a deviant spelling parses, so nothing would ever say otherwise, and the corpus would
  // drift one file at a time until the strict readers this collapse retired were needed again.
  const openLine = metaOpenLine(text, spans, bodyFrom);
  if (openLine !== null && !isCanonicalMetaOpen(openLine)) {
    faults.push(`meta fence opens \`${openLine}\` — canon is \`${META_OPEN_CANON}\`, one space and nothing after`);
  }

  if (!marks.meta) {
    // A ROOT META ABOVE STX is the pre-body shape: it still names an identity, but outside the span the
    // check covers. Named as its own fault so the repair reads plainly — the block moves below STX.
    faults.push(frame.stx && metaOpenFrom(text, spans, 0) !== null
      ? "root meta stands before STX — the body, and the identity the check covers, begin at STX"
      : "no meta block — the carrier declares no identity");
  }
  for (const [have, name] of [[marks.stx, "STX"], [marks.etx, "ETX"], [marks.eot, "EOT"]] as const) {
    if (!have) faults.push(`no ${name} — the body has no ${name === "EOT" ? "release" : "bound"}`);
  }
  if (marks.check === "mismatch") faults.push("block check does not match the body it follows");
  // A torn frame reads as a truncated transmission, never as an unchecked one — the conflation would
  // let a file cut ahead of its closer pass as lawful absence-of-check.
  if (marks.check === "torn") faults.push("the frame opens and never closes — STX stands without ETX; torn reads as truncated, never unchecked");
  // ONE TEXT FRAME PER CARRIER, ONE CLOSE PER FRAME. A second STX, a second live ETX, an ETX ahead of
  // the STX: the span reader names each, and the gradient carries the reader's own words rather than
  // re-deriving them — a second count here would be a second reader.
  faults.push(...frame.faults.map((f) => f.message));
  // THE FRAME MUST OPEN BEFORE THE BODY IT CLAIMS TO COVER. An STX seated after the last block leaves
  // a span of nearly nothing, and the check over nothing matches its own recomputation — so the file
  // reads `ok` at every gate while none of its bytes are covered. Two carriers stood that way, and the
  // check-witness counted both among its greens. Ahu openers outside the frame are the reading: they
  // are body, and body before the frame is body the verdict never saw.
  const stxAt = frame.stx?.index;
  if (stxAt !== undefined) {
    const outside = maskedExecAll(text, /<<~ ahu\b/g, spans).filter((m) => m.index < stxAt).length;
    if (outside > 0) faults.push(`${outside} block(s) stand ahead of the text frame — the check covers a span that is not the body`);
  }

  return { marks, faults };
}
