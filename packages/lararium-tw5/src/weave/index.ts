/*\
title: lar:///ha.ka.ba/lararium/tw5/modules/weave
type: application/javascript
module-type: library
\*/
/**
 * weave — project one memetic-wikitext carrier into a markdown + meta pair.
 *
 * The one mouth (`transposeMarkdown` / `projectSubmission`) every door calls: the CLI's
 * `lares meme project --to md`, the wiki's `meme-project` filter, and the daemon's `meme-project`
 * verb. It WEAVES (carrier → markdown); TANGLE (markdown → carrier) reads the pair back elsewhere.
 * Same carrier bytes, same pair: no clock and no randomness anywhere in the path.
 *
 * ── WHY LINE-BASED, WHY ONE-DIRECTIONAL ─────────────────────────────────────────────────────────
 * Wikitext marks an ordered list with a bare `#`, which markdown spends on headings; markdown
 * numbers each item, which wikitext leaves implicit. This transposer counts list position and
 * reads `!` depth for headings — both total. The reverse direction would have to guess where a
 * `#` meant heading and where it meant item, so no reverse exists here.
 *
 * ── SHAPE: ONE WALK, AN ORDERED CHAIN OF LINE RECOGNIZERS ───────────────────────────────────────
 * The walk reads one line at a time (state carried forward: an open fence, a buffered meta fence,
 * a line-spanning sigil, a buffered prose run) and tries the module-level recognizers in a fixed
 * order (`FRAME_LINE`, `DOCTYPE_LINE`, `AHU_OPEN`/`AHU_CLOSE`, `EDGE_LINE`, `TRANSCLUSION_LINE`,
 * `SIGIL_LINE`, then tables, lists, headings, prose); the first that matches emits and the walk
 * moves on. Every emitter that varies by dialect reads the `profile` argument threaded through the
 * walk rather than branching on a dialect name — `PROFILES.CommonMark` is the default, matching todays output unchanged; `PROFILES.GFM` and `PROFILES["kramdown-rfc2629"]` weave standalone dialects with YAML frontmatter.
 *
 * ── WHAT EACH CONSTRUCT BECOMES ─────────────────────────────────────────────────────────────────
 *   frame sigils (`<<^ …>>`) + declaration    dropped — carriage, not content; the meta records them
 *   the meta fence                             dropped from the body — provenance rides the meta
 *   `<<~ ahu #slot>>` / `<<~/ahu>>`         an HTML anchor `<a id="…"></a>` / dropped — every
 *                                             `#slot` citation in prose keeps a target. A ROOTED
 *                                             slot (`#/a/b`) drops the root `/` and joins nested
 *                                             segments with `_` (`id="a_b"`) — canon slot names
 *                                             never carry `_` (0 of 2,011), so the join is unambiguous
 *                                             and reversible in practice. A BARE slot (`#name`, no
 *                                             leading `/`) reads gracefully as the rooted spelling
 *                                             of `/name` — a reader admits the variant spelling, the
 *                                             projection re-mints the canonical id (`id="name"`)
 *                                             rather than falling through to a literal code span.
 *   `<<~ aka …>>` / `<<~ loulou …>>`        a reference bullet carrying the SIGIL WORD and the
 *                                             address as code (`` - `aka lar://…` `` vs
 *                                             `` - `loulou lar://…` ``) — the two edges name
 *                                             different relations and the bullet keeps that legible
 *   any other line-standing sigil               the line wrapped in a code span — notation shown
 *                                             literally, never executed and never invented around
 *   `{{…}}` / `{{{…}}}` transclusion            no markdown equivalent exists, so it carries
 *     (line-standing)                         verbatim in a ` ```memetic-wikitext tangle ` fence —
 *                                             the office word for a fence carrying structure home,
 *                                             as opposed to a plain ` ```memetic-wikitext ` fence,
 *                                             which stays an inert teaching example
 *   `{{…}}` transclusion (mid-line)             a fence cannot open mid-paragraph, so an inline
 *                                             occurrence carries verbatim in a backtick code span
 *   `[[target]]` / `[[label|target]]`           a CommonMark link — `[label](target)`. A `lar:` URI
 *                                             target and a bare-title target render IDENTICALLY:
 *                                             both are equally valid meme titles (a `lar:` URI
 *                                             names, it does not fetch — HOSTFUL NAMES CONTENT), so
 *                                             neither earns a different href shape; CommonMark's
 *                                             link-destination grammar already accepts an arbitrary
 *                                             URI-reference. A target carrying whitespace (a titled
 *                                             tiddler, `[[My Title]]`) takes the angle-bracket
 *                                             destination form (`<My Title>`) CommonMark reserves
 *                                             for exactly that case — never a re-encoded href.
 *   `!` headings · `#` ordered · `*` bullets    markdown equivalents, totals
 *   `''bold''` · `//italic//`                   `**` · `*`, with code spans (and the two constructs
 *                                             above) masked first — a `lar://` pair reads as an
 *                                             italic open otherwise. A run of contiguous lines that
 *                                             all fall to the default/ordered pipeline is BUFFERED
 *                                             and emphasis-substituted as ONE JOINED STRING before
 *                                             the buffer flushes to output — a matching pass that
 *                                             can see past the newline is what a per-line pass
 *                                             cannot give, and a mark spanning a hard line break
 *                                             inside one paragraph now closes instead of riding to
 *                                             end-of-body as a literal quote character.
 *   fenced blocks                               sealed: a fence of N backticks closes only on ≥ N,
 *                                             so teaching examples pass through byte-identical
 *   tables                                      markdown tables; `!` header cells shed the mark and
 *                                             the separator row follows the first row
 *
 * Every door shares this one mouth: the in-VM face (`$tw.lares.meme.project(uri, "md")`), the
 * daemon's `meme-project` verb and `lares meme project --to md` all call {@link projectSubmission}.
 */

import { matchCarrierHeadLine } from "../carrier-head.js";
import { META_OPEN_LINE_RE } from "../meta-fence.js";
import { frameAlt } from "../frame-marks.js";
import { GENERATED_SIGILS, GENERATED_ALIAS_MAP } from "../meme-ast/grammar-table.generated.js";
import { parseTaploFields } from "../toml-ast.js";
import { fenceLineOpen, fenceLineClose } from "../meme-ast/fence-mask.js";

/**
 * G2-G4 cutover (lar:///sigil.grammar.lane loop 2): the word SET a line recognizer alternates on
 * derives from the tiddler-sourced table — the canonical name plus every tiddler that carries
 * `lar-mirror-of: <canonical>` — rather than a hand-typed list that could silently miss a mirror
 * (`shadow`/`snapshot` for `aka`, `link` for `loulou`) the tiddlers already declare. No dialect
 * changes: each recognized word still projects through the SAME shape this file always emitted —
 * only which words REACH that shape widens to match the tiddlers.
 *
 * A mirror's own PREFIX SHAPE still varies (`fragment` opens bare `<<fragment …>>`, never
 * `<<~ fragment …>>` — TW5-native compatibility spelling; every other mirror in this tree opens
 * sharktooth), so this reads each candidate's own `openPattern`/`pattern` off the table to sort it
 * bare vs sharktooth, rather than assuming one shape for every mirror.
 */
function mirrorsOf(canonical: string): string[] {
  return Object.entries(GENERATED_ALIAS_MAP)
    .filter(([, target]) => target === canonical)
    .map(([name]) => name);
}
function isBarePrefix(name: string): boolean {
  const rule = GENERATED_SIGILS.find((s) => s.name === name);
  const pat = rule?.openPattern ?? rule?.pattern ?? "";
  return pat.length > 0 && !pat.startsWith("<<~");
}
function splitByPrefixShape(names: string[]): { sharktooth: string[]; bare: string[] } {
  const sharktooth: string[] = [];
  const bare: string[] = [];
  for (const n of names) (isBarePrefix(n) ? bare : sharktooth).push(n);
  return { sharktooth, bare };
}

export interface SubmissionProjection {
  /** The markdown body — what a reviewer reads. Carries YAML frontmatter prepended when `standalone`. */
  markdown: string;
  /** The sidecar meta, TW5 `.meta` field lines — provenance the pair travels under. Empty when `standalone`. */
  meta: string;
  /** The carrier's own address, read off its SOH heading (or supplied). */
  uri: string;
  /** The block check found adjacent to ETX, or "unchecked". */
  check: string;
  /**
   * RFC 7763: true when the file travels ALONE and carries YAML frontmatter (no `.md.meta` sidecar —
   * `meta` reads empty); false for the CommonMark shelf pair (frontmatter-free, `.md.meta` sidecar).
   */
  standalone: boolean;
}

/**
 * A dialect/profile the walk reads but never branches on by name. Every construct in the module doc
 * is CommonMark-shaped; a dialect differs from another only through the fields of this interface, so
 * adding one extends the interface and the {@link PROFILES} table, never the walk.
 *
 * Dialect names are RFC 7764-registered Markdown variants (never an unnamed house flavour, per
 * #/the-woven-dialect) — `CommonMark`, `GFM`, `kramdown-rfc2629`.
 */
export interface WeaveProfile {
  /** An RFC 7764-registered variant name. */
  readonly dialect: string;
  /** The info-string a transclusion tangle fence carries. */
  readonly tangleInfoString: string;
  /** The marker a live `kahea` include weaves under — the dialect's own spelling of "this rides live". */
  readonly kaheaMarker: string;
  /**
   * RFC 7763: a `.md.meta` sidecar when the woven file sits on a shelf beside others (false — the
   * CommonMark shelf pairs), YAML frontmatter when the file travels alone (true). Mutually exclusive:
   * a profile never carries both.
   */
  readonly frontmatter: boolean;
  /**
   * Extra identity keys a standalone profile REQUIRES in the carrier's own root `toml meta` — absent,
   * `projectSubmission` refuses rather than weave a document the target format calls invalid.
   * kramdown-rfc2629 (an RFC I-D) requires `docname` (`draft-*-NN`), `cat`, `ipr`, `author`, `date`.
   */
  readonly requiredMeta?: readonly string[];
}

export const PROFILES: Readonly<Record<"CommonMark" | "GFM" | "kramdown-rfc2629", WeaveProfile>> = {
  // The kahea marker reads plain text, one spelling across every profile (Loop-Observer-III): a
  // glyph (`↻`, `🔁`) reads fine inside this wiki but a reader outward of it — a screen reader, a
  // plain-text mail client, an RFC I-D toolchain — has no way to decode it, where "(live) " carries
  // its own meaning in any tongue that reads the Latin word "live".
  CommonMark: { dialect: "CommonMark", tangleInfoString: "memetic-wikitext tangle", kaheaMarker: "(live) ", frontmatter: false },
  GFM: { dialect: "GFM", tangleInfoString: "memetic-wikitext tangle", kaheaMarker: "(live) ", frontmatter: true },
  "kramdown-rfc2629": {
    dialect: "kramdown-rfc2629",
    tangleInfoString: "memetic-wikitext tangle",
    kaheaMarker: "(live) ",
    frontmatter: true,
    requiredMeta: ["title", "docname", "cat", "ipr", "author", "date"],
  },
};

/** Line-standing frame sigil (any control code), with whatever rides after the closer. */
const FRAME_LINE = /^<<\^ code="&#x00[0-9A-Fa-f]{2};"(?:[^>\n]|>(?!>))*>>.*$/;
/**
 * The ETX closer with its adjacent check.
 *
 * THE CODE SET COMES FROM THE DECLARATION; THIS SHAPE STAYS THIS READER'S OWN (frame-marks.ts). The
 * line-anchored canonical spelling is what a transpose meets, and the trailing capture takes the BCC
 * that rides the closer with nothing between.
 */
const ETX_LINE = new RegExp(`^<<\\^ code="${frameAlt("ETX")}"[^\\n]*>>(\\S+)?`);
const DOCTYPE_LINE = /^<<!DOCTYPE (?:[^>\n]|>(?!>))*>>\s*$/;
// The tooth stands at one dispatch position: `<<~` then LWSP then the command word, and a close
// word carries its own slash (`ahu`, `/ahu`). Both spacings reach the same word, matching the
// plain register's `<<fragment …>>` / `<</fragment>>`.
//
// The `#` sigil marks a slot path, rooted (`#/a/b`) or bare (`#name`) — the capture takes
// whatever follows the `#` up to whitespace or the close, leading slash included when present, so
// `ahuId` below can tell the two spellings apart and drop only the ROOT slash, not a bare name.
const AHU_NAMES  = ["ahu", ...mirrorsOf("ahu")];
const AHU_SHAPES = splitByPrefixShape(AHU_NAMES);
const ahuAlt = [
  AHU_SHAPES.sharktooth.length ? `<<~\\s*(?:${AHU_SHAPES.sharktooth.join("|")})` : null,
  AHU_SHAPES.bare.length ? `<<(?:${AHU_SHAPES.bare.join("|")})` : null,
].filter((s): s is string => s !== null).join("|");
const AHU_OPEN = new RegExp(`^(?:${ahuAlt})\\s+#(\\S+?)(?: (?:[^>\\n]|>(?!>))*)?\\s*>>\\s*$`);
const AHU_CLOSE = new RegExp(`^(?:<<~\\s*\\/\\s*(?:${AHU_SHAPES.sharktooth.join("|")})|<<\\/(?:${AHU_SHAPES.bare.join("|") || "\\x00"})\\s*)>>\\s*$`);
// `loulou` (+ its mirror `link`) names a plain citation and keeps the reference-bullet shape it
// always had. `aka` (+ its mirrors `shadow`/`snapshot`) names a FROZEN edge — a pinned transclusion,
// per #/weave-and-tangle's "an open rhyme": a woven `aka` inlines its target's current text, pinned
// with the target's own `ni:` check, the same way an in-house `aka` already inlines at a moment.
// `kahea` (a live include; `import`/`transclude` alias it, but this slice reads only the bare word's
// one-line invoke shape — the block open/close form is declined, see the handback) weaves as a plain
// link under the profile's own marker, since a LIVE include names no frozen moment to pin.
const LOULOU_NAMES = ["loulou", ...mirrorsOf("loulou")];
const LOULOU_LINE = new RegExp(`^<<~\\s*(${LOULOU_NAMES.join("|")}) ((?:[^>\\n]|>(?!>))*?)\\s*>>\\s*$`);
const AKA_NAMES = ["aka", ...mirrorsOf("aka")];
const AKA_LINE = new RegExp(`^<<~\\s*(${AKA_NAMES.join("|")}) ((?:[^>\\n]|>(?!>))*?)\\s*>>\\s*$`);
const KAHEA_LINE = /^<<~\s*kahea\s+("?lar:[^"\s>]+"?|[^\s>(]+\/[^\s>]*|[^\s>(]+#[^\s>]*)\s*>>\s*$/;
// A transclusion standing alone as a block: `{{title}}`, `{{title||template}}`,
// `{{{filter}}}`, `{{{filter||template}}}` — no markdown equivalent exists for any of them, so
// the LINE-STANDING form carries whole into a tangle fence (a mid-line occurrence is handled
// inside `inline()`, where a fence cannot open).
const TRANSCLUSION_LINE = /^\s*(\{\{[\s\S]*\}\})\s*$/;
// `<<~ hana key>> … <<~/hana>>` — a foreign-grammar span (#/the-woven-dialect "Mixed grammar"). The
// body belongs to the EMBEDDED language, never this walk's recognizers: a `#` inside a TOML body
// must not become a markdown list item. So the whole span weaves as ONE fenced block, info string =
// the grammar key, body byte-verbatim — captured before any other recognizer gets a look at its lines.
const HANA_OPEN = /^<<~\s*hana\s+([^\n>]+?)\s*>>\s*$/;
const HANA_CLOSE = /^<<~\s*\/\s*hana\s*>>\s*$/;
// The speaking head with or without a joined name (`<<~ ahu`, `<<~ranks`, `<<~! wehe`) — any
// line-standing sigil not already given a markdown shape above.
const SIGIL_LINE = /^<<~\S* ?(?:[^>\n]|>(?!>))*>>\s*$/;

/**
 * The anchor id a rooted or bare `ahu` slot path projects. Canon slot names never carry `_`
 * (0 of 2,011), so joining nested segments with it is unambiguous, and the root `/` is dropped —
 * `#/a/b` → `a_b`, `#/x` → `x`. A bare `#name` (no leading `/`) reads gracefully as the rooted
 * spelling of `/name`, so it takes the identical treatment rather than a literal fallback.
 */
const XML_NAME_START = /[A-Za-z_À-￿]/;
const XML_NAME_CHAR = /[A-Za-z0-9_.\-·̀-ͯ‿⁀À-￿]/;

/**
 * ISO/IEC 9075-14's `_xHHHH_` escape (SQL/XML identifier mapping), self-escaping: the two-character
 * trigger `_x` is what a decoder watches for, so a literal `_x` in the source must escape too, or a
 * decoder could not tell an escape from a segment that merely starts with the same two bytes. HHHH is
 * the code point in uppercase hex, at least four digits (more where the code point needs them, per the
 * scheme — this module never emits fewer).
 */
export function escapeXmlNameSegment(segment: string): string {
  let out = "";
  for (let i = 0; i < segment.length; i++) {
    const ch = segment[i]!;
    if (ch === "_" && segment[i + 1] === "x") {
      out += `_x${(0x5f).toString(16).toUpperCase().padStart(4, "0")}_`;
      continue;
    }
    const valid = i === 0 ? XML_NAME_START.test(ch) : XML_NAME_CHAR.test(ch);
    out += valid ? ch : `_x${ch.codePointAt(0)!.toString(16).toUpperCase().padStart(4, "0")}_`;
  }
  return out;
}

/** The inverse of {@link escapeXmlNameSegment} — a round-trip test pins the pair. */
export function unescapeXmlNameSegment(escaped: string): string {
  return escaped.replace(/_x([0-9A-Fa-f]{4,6})_/g, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)));
}

/**
 * The anchor id a rooted or bare `ahu` slot path projects. Canon slot names never carry `_`
 * (0 of 2,011), so joining nested segments with it is unambiguous, and the root `/` is dropped —
 * `#/a/b` → `a_b`, `#/x` → `x`. A bare `#name` (no leading `/`) reads gracefully as the rooted
 * spelling of `/name`, so it takes the identical treatment rather than a literal fallback. Each
 * SEGMENT escapes on its own, per {@link escapeXmlNameSegment}, before the `_`-join — a slot name
 * carrying a character illegal in an XML Name (or the literal two bytes `_x`) escapes rather than
 * producing an id no consumer could parse as one.
 */
function ahuId(rawPath: string): string {
  const path = rawPath.startsWith("/") ? rawPath.slice(1) : rawPath;
  return path.split("/").map(escapeXmlNameSegment).join("_");
}

/**
 * Mask code spans, mid-line transclusions and wikilinks out of ONE LINE, each replaced by a
 * NUL-delimited token so nothing downstream (the emphasis pass, a numeral in prose) can see their
 * insides. A bare-digit token would collide with prose numerals ("12/20") and eat them on restore,
 * so the token carries the mask's own index rather than any part of the masked text.
 *
 * MASKING STAYS LINE-GRANULAR EVEN THOUGH EMPHASIS DOES NOT (see {@link emphasize}). A backtick
 * span or a `[[…]]` pair never crosses a line in this grammar, and matching them over a JOINED
 * multi-line buffer would let a stray unpaired backtick on one line consume unrelated text three
 * lines down — measured against the live corpus, where a quad-backtick teaching span (` ```` ```toml
 * meta``` ```` `) elsewhere in the same paragraph run swallowed a later `''carrier''` mark whole
 * once masking ran over the joined string instead of one line at a time.
 */
function maskLine(line: string, mask: (rendered: string) => string): string {
  const maskedCode = line.replace(/`[^`]*`/g, (m) => mask(m));

  // Mid-line transclusion: no markdown equivalent, so it carries verbatim as a code span — the
  // line-standing form (handled before this walk ever reaches `inline`) earns the fuller tangle
  // fence; this is the fallback for the same construct met mid-paragraph, where a fence cannot open.
  const maskedTangle = maskedCode.replace(/\{\{[^{}\n]*\}\}/g, (m) => mask(`\`${m}\``));

  // `[[target]]` / `[[label|target]]` → a CommonMark link. A `lar:` URI target and a bare-title
  // target render identically (see the module doc); a target carrying whitespace takes the
  // angle-bracket destination form CommonMark reserves for exactly that case.
  return maskedTangle.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_all, a: string, b?: string) => {
    const label = a.trim();
    const target = (b ?? a).trim();
    const href = /\s/.test(target) ? `<${target}>` : target;
    return mask(`[${label}](${href})`);
  });
}

/**
 * Bold/italic over already-masked text — the ONE substitution this walk lets run across a joined
 * multi-line buffer (see `flushProse` in {@link transposeMarkdown}).
 *
 * THE DELIMITERS TRANSPOSE ONE AT A TIME, NEVER AS PAIRS. Markdown opens and closes emphasis with
 * the same characters, so a transposition needs no pairing at all — and pairing is what broke here:
 * a bare single-line pass could not see a matching mark on the far side of a hard line break, so
 * a reader met `''` as a literal quote character mid-sentence. Joining the run first (with masking
 * already done per line, above) lets the same one-at-a-time substitution reach both sides of the
 * break without also letting unrelated backtick/bracket spans reach across it.
 */
function emphasize(s: string): string {
  return s
    .replace(/''/g, "**")
    // A scheme separator carries its own double slash — `lar://`, `https://`, `ni:///` — so the
    // italic mark yields wherever a colon or another slash stands immediately before it.
    .replace(/(^|[^:/])\/\//g, "$1*");
}

/** Restore every masked span, in order. NUL delimits the mask tokens — a byte the carrier-bytes law
 * keeps out of prose, so a numeral in the text ("12/20") never reads as a token. */
function restore(s: string, spans: readonly string[], NUL: string): string {
  return s.replace(new RegExp(NUL + "(\\d+)" + NUL, "g"), (_, i) => spans[Number(i)] ?? "");
}

/** One line's worth of inline transforms — table cells, and anywhere a whole paragraph run is not
 * being buffered. `profile` rides the signature for the same reason it rides every emitter: a later
 * dialect that renders links or spans differently reads it here rather than the walk branching. */
function inline(s: string, profile: WeaveProfile): string {
  void profile;
  const spans: string[] = [];
  const NUL = String.fromCharCode(0);
  const mask = (rendered: string): string => { spans.push(rendered); return NUL + String(spans.length - 1) + NUL; };
  return restore(emphasize(maskLine(s, mask)), spans, NUL);
}

/** One TW5 table row → its trimmed cells; null when the line is no row. */
function tableCells(line: string): string[] | null {
  if (!/^\s*\|.*\|\s*$/.test(line)) return null;
  const inner = line.trim().slice(1, -1);
  return inner.split("|").map((c) => c.trim());
}

/**
 * A FROZEN `aka` (or its mirrors `shadow`/`snapshot`) edge weaves by INLINING its target's current
 * text, pinned with the target's own `ni:` check — the woven-outward twin of the in-house `aka`
 * transclusion (#/weave-and-tangle's "an open rhyme"). Resolution needs a wiki/corpus; absent one
 * (no `resolve`, or `resolve` answers null — the target stands unknown), this falls back to a
 * clearly marked unresolved reference rather than inventing content around a target it cannot read.
 *
 * The nested weave carries NO resolver forward — a pin fixes one target at one moment, and a chain of
 * `aka`s pinning each other would have no moment to stop at.
 */
function weaveAka(word: string, rawTarget: string, profile: WeaveProfile, resolve?: (uri: string) => string | null): string[] {
  const target = rawTarget.replace(/^"|"$/g, "");
  const resolved = resolve ? resolve(target) : null;
  if (resolved === null || resolved === undefined) {
    return [`- \`${word} ${target}\` (unresolved — no corpus to pin)`];
  }
  const woven = transposeMarkdown(resolved, profile);
  const check = woven.check ?? "unchecked";
  return [
    `<!-- ${word}: ${target} pinned ${check} -->`,
    ...woven.markdown.split("\n"),
    `<!-- /${word} -->`,
  ];
}

/**
 * Transpose a memetic-wikitext body to markdown. Side-channel captures (address, check, meta fence)
 * ride the returned record; {@link projectSubmission} folds them into the meta.
 */
export function transposeMarkdown(
  text: string,
  profile: WeaveProfile = PROFILES.CommonMark,
  /**
   * The wiki/corpus a FROZEN `aka` edge resolves its target through — `null`/`undefined` when the
   * target stands unknown. Absent entirely, or answering `null`, `aka` falls back to a clearly marked
   * unresolved reference rather than inlining anything (#/weave-and-tangle's "an open rhyme": pinning
   * needs a moment to pin FROM). Recursion stops at one level: the target's own body weaves through
   * this same walk but WITHOUT a resolver, so a chain of `aka`s never loops.
   */
  resolve?: (uri: string) => string | null,
): { markdown: string; uri?: string; check?: string; metaFence?: string } {
  const out: string[] = [];
  let fence = 0;            // open fence length in backticks; 0 = prose
  let ordinal = 0;          // position inside a `#` ordered run
  let metaFence: string[] | null = null;
  let metaFenceDone: string | undefined;
  let inMetaFence = false;
  let uri: string | undefined;
  let check: string | undefined;
  let tableRow = 0;         // rows emitted in the current table run
  let sigilBuf: string[] | null = null;  // a line-spanning sigil, gathered whole
  let proseBuf: string[] | null = null;  // a contiguous default/ordered run, flushed as one string
  let hanaBuf: string[] | null = null;   // a `<<~ hana key>>` span, gathered byte-verbatim
  let hanaKey: string | null = null;

  // A contiguous run of default/ordered lines is buffered raw (structural markers already
  // substituted, emphasis NOT yet applied) and flushed together so a `''`/`//` pair spanning a
  // hard line break inside the run resolves — see the module doc and `inline`'s own comment.
  const flushProse = (): void => {
    if (proseBuf === null) return;
    const spans: string[] = [];
    const NUL = String.fromCharCode(0);
    const mask = (rendered: string): string => { spans.push(rendered); return NUL + String(spans.length - 1) + NUL; };
    // Mask each line on its OWN — a code span or wikilink never crosses a line in this grammar —
    // then emphasize the JOINED result, so a `''`/`//` pair spanning a hard line break resolves.
    const maskedLines = proseBuf.map((line) => maskLine(line, mask));
    const rendered = restore(emphasize(maskedLines.join("\n")), spans, NUL);
    out.push(...rendered.split("\n"));
    proseBuf = null;
  };
  const pushProse = (line: string): void => {
    (proseBuf ??= []).push(line);
  };

  for (const line of text.split("\n")) {
    // ── a hana span travels byte-verbatim, through NO recognizer — a `#` in a TOML body inside it
    // must never read as a markdown list item. Checked before fence tracking too: this walk's OWN
    // backtick-fence bookkeeping never opens on a line hana is carrying home whole.
    if (hanaBuf) {
      if (HANA_CLOSE.test(line)) {
        const joined = hanaBuf.join("\n");
        const longestRun = Math.max(0, ...(joined.match(/`+/g) ?? []).map((s) => s.length));
        const fenceStr = "`".repeat(Math.max(3, longestRun + 1));
        out.push(fenceStr + hanaKey, ...hanaBuf, fenceStr);
        hanaBuf = null;
        hanaKey = null;
        continue;
      }
      hanaBuf.push(line);
      continue;
    }

    // ── the meta fence: captured whole, dropped from the body. Its opener is fixed at exactly
    // three backticks (META_OPEN_LINE_RE), so its close reads through fence-mask's own close rule
    // at that width — a content line that merely STARTS with a backtick run, trailing content and
    // all, never closes it early. ──
    if (inMetaFence) {
      if (fenceLineClose(line, 3)) { inMetaFence = false; metaFenceDone = (metaFence ?? []).join("\n"); metaFence = null; continue; }
      (metaFence ?? []).push(line);
      continue;
    }
    // Only the fence that OPENS the carrier heads the carrier (the position law) — every later
    // `toml meta` fence heads a worksite and STAYS in the body as an ordinary fenced block.
    if (fence === 0 && metaFenceDone === undefined && META_OPEN_LINE_RE.test(line)) { inMetaFence = true; metaFence = []; continue; }

    // ── fence tracking: OPEN and CLOSE both read through fence-mask's own rules (CommonMark §4.5) —
    // `fenceLineOpen` (a fence's info string may carry no backtick) and `fenceLineClose` (a closer
    // needs a run ≥ the opener AND nothing else on the line — a content line that happens to start
    // with a shorter or trailed run, "```` example of `backticks`" inside a fence opened at four,
    // never closes early; it is body). ONE RULE, ONE PLACE — this walk no longer re-derives either
    // guard with its own unguarded regex. ──
    if (fence === 0) {
      const openLen = fenceLineOpen(line);
      if (openLen > 0) {
        flushProse();
        fence = openLen;
        out.push(line);
        continue;
      }
    } else if (fenceLineClose(line, fence)) {
      flushProse();
      fence = 0;
      out.push(line);
      continue;
    }
    if (fence > 0) { out.push(line); continue; }

    // ── a blank line closes the paragraph — a mark left unmatched on one side never pairs
    // across it; only a run of CONTIGUOUS lines buffers for the cross-line emphasis fix ──
    if (line.trim() === "") { flushProse(); ordinal = 0; out.push(line); continue; }

    // ── carriage, dropped; address and check captured on the way past ──
    const soh = matchCarrierHeadLine(line);
    if (soh) { uri = uri ?? soh.uri; continue; }
    const etx = ETX_LINE.exec(line);
    if (etx) { check = check ?? etx[1]; continue; }
    if (FRAME_LINE.test(line) || DOCTYPE_LINE.test(line)) continue;

    // ── a sigil spanning lines travels whole, shown literally in a fence ──
    if (sigilBuf) {
      sigilBuf.push(line);
      if (/>>\s*$/.test(line)) {
        flushProse();
        out.push("```", ...sigilBuf, "```");
        sigilBuf = null;
      }
      continue;
    }
    if (/^<<[~^]/.test(line) && !/>>/.test(line)) { sigilBuf = [line]; continue; }

    // ── a hana span opens: everything until the matching close travels verbatim (see above) ──
    const hanaOpen = HANA_OPEN.exec(line);
    if (hanaOpen) { flushProse(); hanaKey = hanaOpen[1]!.trim(); hanaBuf = []; continue; }

    // ── sigils with a markdown shape ──
    const ahu = AHU_OPEN.exec(line);
    if (ahu) { flushProse(); out.push(`<a id="${ahuId(ahu[1]!)}"></a>`); continue; }
    if (AHU_CLOSE.test(line)) continue;
    const loulou = LOULOU_LINE.exec(line);
    if (loulou) { flushProse(); out.push(`- \`${loulou[1]} ${(loulou[2] ?? "").trim()}\``); continue; }
    const aka = AKA_LINE.exec(line);
    if (aka) { flushProse(); out.push(...weaveAka(aka[1]!, (aka[2] ?? "").trim(), profile, resolve)); continue; }
    const kahea = KAHEA_LINE.exec(line);
    if (kahea) {
      flushProse();
      const target = kahea[1]!.replace(/^"|"$/g, "");
      const href = /\s/.test(target) ? `<${target}>` : target;
      out.push(`${profile.kaheaMarker}[${target}](${href})`);
      continue;
    }
    const transclusion = TRANSCLUSION_LINE.exec(line);
    if (transclusion) { flushProse(); out.push("```" + profile.tangleInfoString, transclusion[1]!, "```"); continue; }
    if (SIGIL_LINE.test(line)) {
      flushProse();
      out.push(line.includes("`") ? line : `\`${line}\``);
      continue;
    }

    // ── tables ──
    const cells = tableCells(line);
    if (cells) {
      flushProse();
      tableRow += 1;
      const header = cells.some((c) => c.startsWith("!"));
      const shed = cells.map((c) => inline(c.replace(/^!/, ""), profile));
      out.push(`| ${shed.join(" | ")} |`);
      if (tableRow === 1 || (header && tableRow === 1)) out.push(`|${shed.map(() => "---").join("|")}|`);
      continue;
    }
    tableRow = 0;

    // ── ordered runs, headings, bullets, emphasis (buffered — see flushProse) ──
    const ordered = /^(\s*)#\s+(.*)$/.exec(line);
    if (ordered) {
      ordinal += 1;
      pushProse(`${ordered[1]}${ordinal}. ${ordered[2] ?? ""}`);
      continue;
    }
    ordinal = 0;
    pushProse(
      line
        .replace(/^(!{1,5})\s+/, (_, h: string) => "#".repeat(h.length) + " ")
        .replace(/^(\s*)\*\s+/, (_, s: string) => `${s}- `),
    );
  }
  flushProse();
  const markdown = out.join("\n").replace(/\n{3,}/g, "\n\n").replace(/\n+$/, "\n");
  return { markdown, ...(uri ? { uri } : {}), ...(check ? { check } : {}), ...(metaFenceDone ? { metaFence: metaFenceDone } : {}) };
}

/**
 * Project one whole carrier into its submission pair. Deterministic: no clock rides the meta —
 * currency is proven by re-projection, never asserted by a stamp.
 */
/**
 * YAML frontmatter, strict subset: every value double-quoted, keys SORTED lexicographically —
 * defending the woven file against a YAML 1.1 reader meeting a YAML 1.2 writer's bare
 * `yes`/`no`/`on`/`off` ambiguity (#/the-woven-dialect). No unquoted scalars, no flow collections,
 * nothing a coercion rule can misread.
 */
/**
 * YAML double-quoted scalar escaping (YAML 1.2 §7.3.1's C-style escapes). Backslash first — every
 * later replacement inserts backslashes of its own, and escaping them again would double-escape.
 * `: `, `#`, a leading `-`, and a bare `no`/`on`/`yes`/`off` all read safely UNQUOTED-would-be-unsafe
 * plain scalars, but every value here rides double-quoted already, so none of those needs its own
 * rule — only the four bytes a double-quoted scalar cannot carry literally do.
 */
export function yamlEscape(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\r\n/g, "\\n")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t");
}

function yamlFrontmatter(fields: Readonly<Record<string, string>>): string {
  const lines = Object.keys(fields).sort().map((k) => `${k}: "${yamlEscape(fields[k]!)}"`);
  return ["---", ...lines, "---", ""].join("\n");
}

/**
 * Project one whole carrier into its submission pair. Deterministic: no clock rides the meta —
 * currency is proven by re-projection, never asserted by a stamp.
 *
 * `opts.profile` defaults to `PROFILES.CommonMark` — today's shelf-pair output, unchanged. A
 * standalone profile (`GFM`, `kramdown-rfc2629`) prepends YAML frontmatter to `markdown` instead of
 * carrying a `.md.meta` sidecar (`meta` reads `""`, `standalone` reads `true`) — RFC 7763's two
 * metadata channels, one per travel mode. `kramdown-rfc2629` additionally REQUIRES `docname`, `cat`,
 * `ipr`, `author`, `date` in the carrier's own root `toml meta`; missing any, this REFUSES (throws)
 * naming what is missing, rather than weave a document the target format calls invalid.
 */
export function projectSubmission(
  text: string,
  opts?: { uri?: string; title?: string; lang?: string; profile?: WeaveProfile; resolve?: (uri: string) => string | null },
): SubmissionProjection {
  const profile = opts?.profile ?? PROFILES.CommonMark;
  const t = transposeMarkdown(text, profile, opts?.resolve);
  const uri = opts?.uri ?? t.uri ?? "";
  if (!uri) throw new Error("projectSubmission: the carrier declares no address and none was supplied");
  const check = t.check ?? "unchecked";
  const title = opts?.title ?? `${uri}/submission`;

  if (profile.frontmatter) {
    const fields: Record<string, string> = {
      title,
      source: uri,
      "source-check": check,
      variant: profile.dialect,
      lang: opts?.lang ?? "en",
    };
    if (profile.requiredMeta?.length) {
      const tomlFields = t.metaFence ? parseTaploFields(t.metaFence) : {};
      const missing = profile.requiredMeta.filter((k) => !tomlFields[k]);
      if (missing.length > 0) {
        throw new Error(
          `projectSubmission: ${profile.dialect} requires ${missing.join(", ")} in the carrier's root toml meta — absent, refusing to weave`,
        );
      }
      for (const k of profile.requiredMeta) fields[k] = String(tomlFields[k]);
    }
    const markdown = yamlFrontmatter(fields) + t.markdown;
    return { markdown, meta: "", uri, check, standalone: true };
  }

  const meta = [
    `title: ${title}`,
    `type: text/markdown`,
    `source: ${uri}`,
    `source-check: ${check}`,
    `projected-by: weave (lares meme project --to md · meme-project)`,
    `law: projected artifact — hand edits do not survive re-projection`,
  ].join("\n") + "\n";
  return { markdown: t.markdown, meta, uri, check, standalone: false };
}
