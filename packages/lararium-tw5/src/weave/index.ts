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

import {
  matchCarrierHeadLine,
  META_OPEN_LINE_RE,
  frameAlt,
  fenceLineOpen,
  fenceLineClose,
  bccOfSpan,
  type FenceOpen,
} from "@lararium/memetic-frame";
import { GENERATED_SIGILS, GENERATED_ALIAS_MAP, GENERATED_PRIMARY_WEAVE } from "../meme-ast/grammar-table.generated.js";
// Re-exported so a test of weave's OWN tongue-axis properties (round-trip, injectivity) reaches
// the mirror/primary tables through this sanctioned surface rather than importing
// `meme-ast/grammar-table.generated.js` directly (vm-grammar-boundary.test.ts forbids a test
// reaching the compile-layer's internals as if THEY were the canonical grammar surface).
export { GENERATED_ALIAS_MAP, GENERATED_PRIMARY_WEAVE };
import { parseTaploFields } from "../toml-ast.js";
// Re-exported for the SAME reason as GENERATED_ALIAS_MAP/GENERATED_PRIMARY_WEAVE above — a test
// walking a woven body's own fence structure (CENSUS LANE C) reads the canonical open/close rule
// through this sanctioned surface rather than a hand-rolled `startsWith("\`\`\`")` re-derivation.
export { fenceLineOpen, fenceLineClose };

/** The root meta fence's run: its opener is fixed at exactly three backticks (META_OPEN_LINE_RE). */
const META_FENCE: FenceOpen = { len: 3, ch: "`" };

/**
 * The word SET a line recognizer alternates on (lar:///sigil.grammar.lane)
 * derives from the tiddler-sourced table — the canonical name plus every tiddler that carries
 * `lar-mirror-of: <canonical>` — rather than a hand-typed list that could silently miss a mirror
 * (`pin` for `aka`, `law` for `kanawai`, `link` for `loulou`) the tiddlers already declare. No dialect
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
  /**
   * The sidecar meta, TW5 `.meta` field lines — ALWAYS populated (every profile keeps this
   * sidecar; TW5 loads it regardless of dialect). Authoritative for `title`/`type` and for the
   * TARGET RECORD (`variant`/`tongue`, present only when non-default) a re-projection reads back —
   * see the placement-law comment in {@link projectSubmission}.
   */
  meta: string;
  /** The carrier's own address, read off its SOH heading (or supplied). */
  uri: string;
  /** The block check found adjacent to ETX, or "unchecked". */
  check: string;
  /**
   * RFC 7763: true when the file ALSO carries YAML frontmatter for standalone travel (GFM,
   * kramdown-rfc2629) — the `.md.meta` sidecar travels alongside it regardless, never "no sidecar."
   * False for the CommonMark shelf pair (frontmatter-free; the sidecar is the only metadata).
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

/**
 * `--dialect <variant>` names an RFC 7764-registered Markdown variant, matched case-insensitively
 * against {@link PROFILES}' own keys (`CommonMark`, `GFM`, `kramdown-rfc2629`) — never a house
 * abbreviation. Every door that reads a dialect name (the CLI's `--dialect`, the `meme-project`
 * filter's second operand, the daemon verb's `dialect` arg) reads it through this ONE function, so
 * "unknown dialect" is one error message rather than three hand-written ones.
 */
export function profileOf(name: string): WeaveProfile {
  const key = (Object.keys(PROFILES) as Array<keyof typeof PROFILES>)
    .find((k) => k.toLowerCase() === name.toLowerCase());
  if (!key) {
    const names = Object.keys(PROFILES).join(" · ");
    throw new Error(`--dialect names an RFC 7764 variant, one of ${names} (got "${name}")`);
  }
  return PROFILES[key];
}

export const PROFILES: Readonly<Record<"CommonMark" | "GFM" | "kramdown-rfc2629", WeaveProfile>> = {
  // The kahea marker reads plain text, one spelling across every profile: a
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

/**
 * The TARGET RECORD a projected `.md.meta` sidecar carries — `variant:`/`tongue:`, present only when
 * non-default (the placement law in {@link projectSubmission}'s header comment). This reads the
 * `variant:`/`tongue:` lines of a sidecar's RAW text (a `.md.meta` file's bytes, read off disk). A
 * door that already holds the PARSED fields instead — the `meme-project` filter's recorded-default
 * read off a wiki tiddler, where TW5 has parsed the `.meta` file into tiddler fields, not its text —
 * reads the same two keys as fields directly, never through this function.
 */
export function recordedTargetOf(metaText: string): { variant?: string; tongue?: string } {
  const variant = /^variant: (\S+)$/m.exec(metaText)?.[1];
  const tongue = /^tongue: (\S+)$/m.exec(metaText)?.[1];
  return { ...(variant ? { variant } : {}), ...(tongue ? { tongue } : {}) };
}

/** The `.md.meta` sidecar's default title for a carrier's root `uri` — {@link projectSubmission}'s
 * own default, named here so a caller that needs to FIND the record (never project it) does not
 * re-spell the `/submission` suffix by hand. */
export function submissionTitleOf(uri: string): string {
  return `${uri}/submission`;
}

/**
 * ONE TARGET LAW FOR EVERY DOOR: an explicit `dialect`/`tongue` wins; absent, the pair's own RECORDED
 * target (read by the caller, off whatever text carries it, through {@link recordedTargetOf}) wins;
 * absent that too, CommonMark with no tongue — today's default. Every door that resolves a weave
 * target — the CLI, the filter, the store-path verb — reads the SAME law through this one function,
 * never a hand-matching copy of it.
 */
export function resolveWeaveTarget(opts: {
  readonly dialect?: string | null;
  readonly tongue?: string | null;
  readonly recorded: { readonly variant?: string; readonly tongue?: string };
}): { profile: WeaveProfile; tongue?: string } {
  const dialect = opts.dialect || opts.recorded.variant || "";
  const profile = dialect ? profileOf(dialect) : PROFILES.CommonMark;
  const tongue = opts.tongue || opts.recorded.tongue;
  return { profile, ...(tongue ? { tongue } : {}) };
}

/**
 * Line-standing frame sigil (every mark the frame declares), with whatever rides after the closer.
 * THE SET IS THE DECLARATION'S (`frameAlt()` names every mark): a hand-spelled `&#x00..;` read any C0
 * entity as frame and would have dropped an authored line that merely quoted one.
 */
const FRAME_LINE = new RegExp(`^<<\\^ code="${frameAlt()}"(?:[^>\\n]|>(?!>))*>>.*$`);
/**
 * The ETX closer with its adjacent check.
 *
 * THE CODE SET COMES FROM THE DECLARATION; THIS SHAPE STAYS THIS READER'S OWN (@lararium/memetic-frame marks.ts). The
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
// always had. `aka`/`kanawai` (English mirrors `pin`/`law`) PIN an edge — rendering follows the
// TARGET (#/weave-and-tangle's "an open rhyme"): a reference meme's pin weaves as a citation, a
// content slot's pin inlines, pinned with the target's own `ni:` check. See `weaveAka` below for
// the full law (LOOP 7 — role, never position, decides normative vs informative).
// `kahea` (a live include; `import`/`transclude` alias it, but this slice reads only the bare word's
// one-line invoke shape — the block open/close form is declined, see the handback) weaves as a plain
// link under the profile's own marker, since a LIVE include names no frozen moment to pin.
const LOULOU_NAMES = ["loulou", ...mirrorsOf("loulou")];
const LOULOU_LINE = new RegExp(`^<<~\\s*(${LOULOU_NAMES.join("|")}) ((?:[^>\\n]|>(?!>))*?)\\s*>>\\s*$`);
// `aka` (English `pin`, informative) and `kanawai` (English `law`, binding/normative) are TWO
// canonical sigils sharing one rendering mechanism — a pin's TARGET decides whether it weaves as a
// citation or a frozen image either way; only the SIGIL decides which kramdown reference list a
// citation folds into (operator ruling, LOOP 7 — role = WHICH SIGIL, no parameter, no position
// rule). Both families' names derive from the table, never hand-listed.
const AKA_NAMES = ["aka", ...mirrorsOf("aka"), "kanawai", ...mirrorsOf("kanawai")];
const AKA_LINE = new RegExp(`^<<~\\s*(${AKA_NAMES.join("|")}) ((?:[^>\\n]|>(?!>))*?)\\s*>>\\s*$`);

/**
 * Every BASE URI (fragment stripped, quotes stripped) an `aka`/`kanawai` pin names in `text` — the
 * SAME line recognizer ({@link AKA_LINE}) and fence-tracking the walk itself reads below, so a
 * caller that needs to know what a carrier pins BEFORE weaving it (a store-path verb's prefetch,
 * which has no live resolver to call synchronously mid-walk) sees exactly the pins the walk would
 * meet. A fence (the same rule {@link extractAhuSlot} and `transposeMarkdown` read) may SHOW an
 * `aka` line as literal teaching text, and a line inside one never names a real pin.
 */
export function pinTargetsOf(text: string): string[] {
  const targets = new Set<string>();
  let fence: FenceOpen | null = null;
  for (const line of text.split("\n")) {
    if (fence === null) {
      const opened = fenceLineOpen(line);
      if (opened) { fence = opened; continue; }
    } else if (fenceLineClose(line, fence)) { fence = null; continue; }
    if (fence !== null) continue;
    const aka = AKA_LINE.exec(line);
    if (!aka) continue;
    const raw = (aka[2] ?? "").trim().replace(/^"|"$/g, "");
    const base = raw.split("#")[0];
    if (base) targets.add(base);
  }
  return [...targets];
}
// CENSUS LANE B: the word set derives from the table (`mirrorsOf`), matching AHU/LOULOU/AKA above —
// a hand-typed "kahea" alone would silently miss `import`/`transclude` the tiddlers already declare.
const KAHEA_NAMES = ["kahea", ...mirrorsOf("kahea")];
const KAHEA_LINE = new RegExp(`^<<~\\s*(?:${KAHEA_NAMES.join("|")})\\s+("?lar:[^"\\s>]+"?|[^\\s>(]+\\/[^\\s>]*|[^\\s>(]+#[^\\s>]*)\\s*>>\\s*$`);
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
 * The CANONICAL (Hawaiian) name a mirror — primary or read-only — points at, or `null` for a name
 * that carries no mirror relation at all (a canonical itself, or no sigil this table names).
 * `GENERATED_ALIAS_MAP` already IS this reverse map (`lar-mirror-of`, alias → canonical); this
 * function is the one place that reads it, so a caller never re-derives the reverse.
 */
export function mirrorToCanonical(name: string): string | null {
  return GENERATED_ALIAS_MAP[name] ?? null;
}

/**
 * The woven HEAD NAME for one sigil word under one tongue (#/the-woven-dialect's Tongue clause).
 * `tongue` absent: the word passes through UNCHANGED — the default axis this module has always
 * held, so every prior test and the whole shelf stay byte-identical. `tongue` present: the word
 * canonicalizes first (through {@link mirrorToCanonical}, or itself if already canonical), then
 * reads the ONE mirror `GENERATED_PRIMARY_WEAVE[canonical]?.[tongue]` names — the table's OWN
 * canonical×tongue→primary index (`lar-weave: primary`; #/mirror-vocabulary: "exactly one mirror
 * per tongue weaves"), never re-derived by scanning `GENERATED_SIGILS` here: a second reader
 * deriving the same fact its own way is exactly the drift #/one-mouth already warns against — one
 * table, one consumer of it. A canonical with no primary mirror for that tongue weaves under its
 * OWN canonical name, never the word as authored — the same "many spellings read, one spelling gets
 * written" law tangle already holds in reverse.
 *
 * ARGUMENTS NEVER TRANSLATE. Every caller applies this to a HEAD WORD captured by its own construct
 * regex, never to a whole line or a target string — the ITS 2.0 Translate/no-translate split
 * #/the-woven-dialect draws, held structurally: there is nothing here FOR a target string to match.
 */
function resolveHeadWord(word: string, tongue: string | undefined): string {
  if (!tongue) return word;
  const canonical = mirrorToCanonical(word) ?? word;
  return GENERATED_PRIMARY_WEAVE[canonical]?.[tongue] ?? canonical;
}

// The head token: `<<~` (bare or joined), optional LWSP, then the word — up to the first
// space/`(`/`#`/close, matching #/the-woven-dialect's own cut: "only the head token between `<<~`
// and the first space/`(`/`#`" translates; everything after it (arguments) is untouched BY
// CONSTRUCTION, since the replacement below only ever splices in place of the captured word.
const HEAD_TOKEN_RE = /^(<<~\s*)([A-Za-z][\w-]*)/;

/** Any line-standing sigil this walk gives no dedicated shape — its head word translates the same
 * way a recognized construct's does, in place, leaving everything after it byte-identical. */
function translateSigilHead(line: string, tongue: string | undefined): string {
  if (!tongue) return line;
  const m = HEAD_TOKEN_RE.exec(line);
  if (!m) return line;
  const resolved = resolveHeadWord(m[2]!, tongue);
  return resolved === m[2] ? line : m[1] + resolved + line.slice(m[0].length);
}

/**
 * BCP 14 key-words boilerplate, quoted VERBATIM from RFC 8174 §2 ("Guidance in the Use of These Key
 * Words") — fetched 2026-10-03 from https://www.rfc-editor.org/rfc/rfc8174:
 *
 *   "The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD", "SHOULD NOT",
 *   "RECOMMENDED", "NOT RECOMMENDED", "MAY", and "OPTIONAL" in this document are to be interpreted
 *   as described in BCP 14 [RFC2119] [RFC8174] when, and only when, they appear in all capitals, as
 *   shown here."
 *
 * Operator-approved: a pin of the BCP 14 key-words source ({@link isBcp14KeyWordsSource}, detected
 * off the TARGET's own meta — never a hardcoded path) weaves AS this sentence under
 * `kramdown-rfc2629` — the dialect's native way of citing BCP 14, rather than a markdown citation
 * line naming a meme the kramdown toolchain has never heard of. [RFC2119] and [RFC8174] become the
 * kramdown frontmatter's `normative:` refs.
 */
const BCP14_BOILERPLATE =
  'The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD", "SHOULD NOT", ' +
  '"RECOMMENDED", "NOT RECOMMENDED", "MAY", and "OPTIONAL" in this document are to be interpreted ' +
  "as described in BCP 14 [RFC2119] [RFC8174] when, and only when, they appear in all capitals, as " +
  "shown here.";

/**
 * A REFERENCE meme declares itself — `reference-kind` in its OWN root toml meta (e.g. `"rfc"`), the
 * field name a sibling's tiddler work writes. Anything else is a CONTENT SLOT. Operator ruling:
 * `aka` PINS a `lar:` target; RENDERING FOLLOWS THE TARGET, never where the pin stands — a pin of a
 * reference meme weaves as a citation, a pin of a content slot weaves as the frozen image, in BOTH
 * carrier scope and body scope alike. Position no longer changes rendering.
 */
function isReferenceMeme(meta: Readonly<Record<string, unknown>>): boolean {
  return typeof meta["reference-kind"] === "string" && meta["reference-kind"].length > 0;
}

/**
 * Is THIS reference meme the BCP 14 key-words source — the one a `kanawai` pin (never an `aka`
 * pin; see {@link referenceCategory}) weaves as the boilerplate sentence rather than a plain
 * citation? Detected through the target's OWN META alone (`reference-kind: "rfc"` and a
 * `seriesinfo` naming RFC 2119 or BCP 14) — NEVER a hardcoded path: operator redirect moved the
 * reference meme to `lar:///ha.ka.ba/lares/ref/RFC-2119` (Canon-Scribe's sibling work) and left the
 * old `.../api/pono/RFC-2119` standing as the house's own usage law — a plain content meme a pin of
 * it still inlines, never the boilerplate, because it carries no `reference-kind` at all.
 */
function isBcp14KeyWordsSource(meta: Readonly<Record<string, unknown>>): boolean {
  if (meta["reference-kind"] !== "rfc") return false;
  // The citation fields live under TOML's own `[reference]` TABLE, which `parseTaploFields`
  // flattens to `reference-<key>` (toml-ast.ts's own nesting convention) — never a bare top-level
  // `seriesinfo`.
  const seriesinfo = typeof meta["reference-seriesinfo"] === "string" ? meta["reference-seriesinfo"] : "";
  return /\bRFC\s*2119\b/i.test(seriesinfo) || /\bBCP\s*14\b/i.test(seriesinfo);
}

/**
 * THE NORMATIVE/INFORMATIVE MECHANISM — OPERATOR-RULED (LOOP 7, superseding the earlier "unruled,
 * keyed off content" interim): the category is WHICH SIGIL PINNED, never the target's content, a
 * parameter, the tongue, or where the pin stands. `aka` (English `pin`) is informative; `kanawai`
 * (English `law`, binding) is normative. One function, so a future ruling still swaps one place.
 */
function referenceCategory(canonical: "aka" | "kanawai"): "normative" | "informative" {
  return canonical === "kanawai" ? "normative" : "informative";
}

/** The kramdown reference anchor a target answers to: its own declared `anchor` field, else derived
 * from the base URI's last path segment (letters/digits only, uppercased) — kramdown-rfc's own
 * alias-name shape. `ref/RFC-2119` and `api/pono/RFC-2119` derive the SAME anchor, `RFC2119`, since
 * only the last segment feeds it — the meme's own meta still decides whether that anchor resolves
 * through kramdown's standard registry or carries inline fields (`isStandardRfcAnchor`, below). */
function referenceAnchor(base: string, meta: Readonly<Record<string, unknown>>): string {
  if (typeof meta["anchor"] === "string" && meta["anchor"].length > 0) return meta["anchor"];
  const seg = base.split("/").pop() ?? base;
  return seg.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

/** Does kramdown resolve this anchor through its OWN standard-RFC alias registry (a bare `ANCHOR:`,
 * no inline fields needed) — or does the reference entry need its citation fields written out? */
function isStandardRfcAnchor(anchor: string): boolean {
  return /^RFC\d+$/.test(anchor);
}

/** The citation fields a reference meme's own meta carries, in kramdown-rfc's own field names — only
 * the ones PRESENT; an absent field is an absent line, never an invented placeholder. Read off the
 * flattened `reference-<key>` TOML-table keys ({@link isBcp14KeyWordsSource}'s own note), re-keyed
 * to the SHORT names the emitted YAML entry carries. */
export const CITATION_FIELD_KEYS = ["title", "author", "date", "seriesinfo", "target"] as const;
function citationFields(meta: Readonly<Record<string, unknown>>): Record<string, string> | undefined {
  const fields: Record<string, string> = {};
  for (const k of CITATION_FIELD_KEYS) { const v = meta[`reference-${k}`]; if (typeof v === "string" && v.length > 0) fields[k] = v; }
  return Object.keys(fields).length > 0 ? fields : undefined;
}

/**
 * The raw wikitext span of one ahu slot — open sigil through its MATCHING close sigil, inclusive.
 * The same convention the carrier's own block check already stands (@lararium/memetic-frame check.ts: "the span
 * runs from the first character of STX to the last character of ETX, inclusive"), held here at slot
 * granularity: the span covers the marks that bound the slot and never covers itself. Nesting-aware:
 * an ahu (or a mirror) opened INSIDE the target slot bumps depth, so the close that returns depth to
 * zero — never merely the first close met — is the match. `null` when no slot in `text` answers to
 * `slotPath` (rooted or bare, same normalization {@link ahuId} applies elsewhere).
 */
function extractAhuSlot(text: string, slotPath: string): string | null {
  const wantId = slotPath.startsWith("/") ? slotPath.slice(1) : slotPath;
  let depth = 0;
  let collected: string[] | null = null;
  // ── fence tracking, same rule weave() reads below (ONE RULE, ONE PLACE): a fence — backtick or
  // tilde — may SHOW the ahu sigils as literal text (a worked example, a quoted illustration), and a
  // line inside one never opens or closes a real slot. ──
  let fence: FenceOpen | null = null;
  for (const line of text.split("\n")) {
    if (fence === null) {
      const opened = fenceLineOpen(line);
      if (opened) { fence = opened; if (collected !== null) collected.push(line); continue; }
    } else if (fenceLineClose(line, fence)) {
      fence = null;
      if (collected !== null) collected.push(line);
      continue;
    }
    if (fence !== null) { if (collected !== null) collected.push(line); continue; }
    if (collected === null) {
      const open = AHU_OPEN.exec(line);
      if (open) {
        const gotId = open[1]!.startsWith("/") ? open[1]!.slice(1) : open[1]!;
        if (gotId === wantId) { collected = [line]; depth = 1; }
      }
      continue;
    }
    collected.push(line);
    if (AHU_OPEN.exec(line)) depth++;
    else if (AHU_CLOSE.test(line)) { depth--; if (depth === 0) return collected.join("\n"); }
  }
  return null;
}

export interface ReferenceEntry {
  readonly anchor: string;
  readonly category: "normative" | "informative";
  /** Inline YAML citation fields — present only when kramdown cannot resolve the anchor through
   * its own standard-RFC alias registry. */
  readonly fields?: Readonly<Record<string, string>>;
}

interface WovenAka {
  readonly lines: string[];
  /** Reference-meme pins a kramdown weave folds into its `normative:`/`informative:` lists. */
  readonly references?: ReferenceEntry[];
}

/**
 * The target's own check, whichever shape it pins — the whole carrier's ETX check with no
 * fragment, or (per the slot-scoped law above) `bccOfSpan` over just the named slot's bytes.
 * `null` covers both failure shapes a caller must answer the SAME unresolved way: no resolver
 * reached the target, or a fragment named a slot the target does not carry.
 */
function pinOf(resolved: string, slot: string | null, profile: WeaveProfile, tongue: string | undefined): { check: string; body: string } | null {
  if (slot === null) {
    const woven = transposeMarkdown(resolved, profile, undefined, tongue);
    return { check: woven.check ?? "unchecked", body: woven.markdown };
  }
  const span = extractAhuSlot(resolved, slot);
  if (span === null) return null;
  // The check covers the SLOT's own bytes alone — open sigil through its matching close,
  // inclusive — never the whole carrier: a reader pinning one section wants proof of THAT
  // section, and a whole-carrier check would certify bytes the inline never carried.
  return { check: bccOfSpan(span), body: transposeMarkdown(span, profile, undefined, tongue).markdown };
}

export interface ReadPinReference {
  readonly kind: "reference";
  readonly check: string;
  /** The citation fields present on the target's own meta — absent where none are. */
  readonly citation?: Readonly<Record<string, string>>;
  /** The target's whole root toml meta — what decided `kind` and what a reference shape (the BCP 14
   * boilerplate, a kramdown anchor) reads further off, kept whole rather than re-read a second time. */
  readonly anchorMeta: Readonly<Record<string, unknown>>;
}
export interface ReadPinContent {
  readonly kind: "content";
  readonly check: string;
  /** The target's (or slot's) woven body — absent only when resolution itself failed, which {@link readPin} instead answers `null` for. */
  readonly body?: string;
}

/**
 * THE ONE READ a pin's target answers, for every door that pins one: `weaveAka` here (the outward
 * markdown weave) and the live `meme-pin` filter render alike. Resolution already happened (the caller hands the
 * TARGET'S OWN RESOLVED TEXT, never a uri); this reads that text's own root meta to tell a
 * REFERENCE meme from a CONTENT slot ({@link isReferenceMeme}), and answers the one check and (for
 * content) the one woven body either shape needs. `null` names the one failure both kinds share: a
 * `#slot` fragment naming a slot the target does not carry.
 */
export function readPin(
  resolvedText: string,
  slot: string | null,
  profile: WeaveProfile = PROFILES.CommonMark,
  tongue?: string,
): ReadPinReference | ReadPinContent | null {
  const wholeWoven = transposeMarkdown(resolvedText, profile, undefined, tongue);
  const targetMeta = wholeWoven.metaFence ? parseTaploFields(wholeWoven.metaFence) : {};
  if (isReferenceMeme(targetMeta)) {
    let check: string;
    if (slot === null) {
      check = wholeWoven.check ?? "unchecked";
    } else {
      const span = extractAhuSlot(resolvedText, slot);
      if (span === null) return null;
      check = bccOfSpan(span);
    }
    const citation = citationFields(targetMeta);
    return { kind: "reference", check, anchorMeta: targetMeta, ...(citation ? { citation } : {}) };
  }
  const pin = pinOf(resolvedText, slot, profile, tongue);
  if (pin === null) return null;
  return { kind: "content", check: pin.check, body: pin.body };
}

/**
 * A FROZEN `aka` edge's TARGET decides EVERYTHING: how much it pins, AND what shape the pin weaves
 * as. Operator ruling (LOOP 7): `aka` PINS a `lar:` target; rendering follows the TARGET, never
 * where the pin stands. The target's own root toml meta decides the kind ({@link isReferenceMeme}):
 *
 *   REFERENCE meme (`reference-kind` set) → CITATION. CommonMark/GFM: one line naming the target
 *   and its pin, never inlined content. `kramdown-rfc2629`: the BCP 14 key-words source
 *   ({@link isBcp14KeyWordsSource}, read off the target's OWN meta — never a hardcoded path) weaves
 *   as the boilerplate sentence ({@link BCP14_BOILERPLATE}); every other reference meme weaves its
 *   bracketed anchor, and the reference entry itself (standard-RFC bare, or its citation fields
 *   inline) rides the kramdown frontmatter's `normative:`/`informative:` lists
 *   ({@link referenceCategory}).
 *
 *   CONTENT slot (no `reference-kind`) → FROZEN IMAGE. The target's current text INLINES, pinned
 *   with its own check (or, with a `#/slot` fragment, ONLY that slot's woven body, pinned with a
 *   check over that slot's OWN bytes — never the whole carrier, which would smuggle every OTHER
 *   section past what the author named into an artifact that may travel outward with no license to
 *   hold it) — the woven-outward twin of the in-house `aka` transclusion (#/weave-and-tangle's "an
 *   open rhyme").
 *
 * Resolution needs a wiki/corpus either way; absent one (no `resolve`, or `resolve` answers null —
 * the target stands unknown), this falls back to a clearly marked unresolved reference rather than
 * inventing content, a pin, or a kind around a target it cannot read.
 *
 * The nested weave carries NO resolver forward — a pin fixes one target at one moment, and a chain
 * of `aka`s pinning each other would have no moment to stop at. It DOES carry `tongue` forward: the
 * pinned content weaves into the same outward artifact, so its own sigil names follow the same axis.
 */
function weaveAka(
  word: string,
  rawTarget: string,
  profile: WeaveProfile,
  resolve?: (uri: string) => string | null,
  tongue?: string,
): WovenAka {
  const headWord = resolveHeadWord(word, tongue);
  // WHICH SIGIL — never a parameter, the target, or where the pin stands — decides normative vs
  // informative (operator ruling). `mirrorToCanonical` folds any mirror (`pin`, `law`, a read-only
  // alias) back to its canonical `aka`/`kanawai` before the category question is even asked.
  const canonical = (mirrorToCanonical(word) ?? word) as "aka" | "kanawai";
  const target = rawTarget.replace(/^"|"$/g, "");
  const hashIdx = target.indexOf("#");
  const base = hashIdx === -1 ? target : target.slice(0, hashIdx);
  const slot = hashIdx === -1 ? null : target.slice(hashIdx + 1);

  const resolved = resolve ? resolve(base) : null;
  if (resolved === null || resolved === undefined) {
    return { lines: [`- \`${headWord} ${target}\` (unresolved — no corpus to pin)`] };
  }

  // THE ONE READ — the target's own root toml meta decides reference vs content, and either shape's
  // check + body comes back through it, so this weave and a live render read the SAME law.
  const pin = readPin(resolved, slot, profile, tongue);
  if (pin === null) {
    return { lines: [`- \`${headWord} ${target}\` (unresolved — slot #${slot} not found)`] };
  }

  if (pin.kind === "reference") {
    if (profile.dialect !== "kramdown-rfc2629") {
      return { lines: [`- \`${headWord} ${target}\` — pinned \`${pin.check}\``] };
    }
    // The BCP 14 boilerplate fires on a `kanawai` (binding) pin of the key-words source alone — the
    // SAME target pinned by `aka` (informative) weaves its ordinary bracketed citation instead.
    if (canonical === "kanawai" && isBcp14KeyWordsSource(pin.anchorMeta)) {
      return {
        lines: [BCP14_BOILERPLATE],
        references: [
          { anchor: "RFC2119", category: "normative" },
          { anchor: "RFC8174", category: "normative" },
        ],
      };
    }
    const anchor = referenceAnchor(base, pin.anchorMeta);
    const category = referenceCategory(canonical);
    const fields = isStandardRfcAnchor(anchor) ? undefined : pin.citation;
    return { lines: [`[${anchor}]`], references: [{ anchor, category, ...(fields ? { fields } : {}) }] };
  }

  // CONTENT SLOT: the frozen image — position never enters this decision; only the target's own
  // meta (just read, through {@link readPin}) does.
  return { lines: [`<!-- ${headWord}: ${target} pinned ${pin.check} -->`, ...(pin.body ?? "").split("\n"), `<!-- /${headWord} -->`] };
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
  /**
   * The BCP 47 tongue to weave sigil HEAD names into (#/the-woven-dialect's Tongue clause). Absent:
   * every head name passes through unchanged — the axis this module held before this parameter
   * existed, so leaving it off reproduces every prior byte exactly. Present: each construct that
   * echoes a sigil's own head word resolves it through {@link resolveHeadWord} before emitting —
   * never touching an argument, a target, or prose.
   */
  tongue?: string,
): { markdown: string; uri?: string; check?: string; metaFence?: string; references?: ReferenceEntry[] } {
  const out: string[] = [];
  let fence: FenceOpen | null = null;   // the open fence's run; null = prose
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
  const references = new Map<string, ReferenceEntry>(); // anchor -> entry, every reference-meme pin

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
      if (fenceLineClose(line, META_FENCE)) { inMetaFence = false; metaFenceDone = (metaFence ?? []).join("\n"); metaFence = null; continue; }
      (metaFence ?? []).push(line);
      continue;
    }
    // Only the fence that OPENS the carrier heads the carrier (the position law) — every later
    // `toml meta` fence heads a worksite and STAYS in the body as an ordinary fenced block.
    if (fence === null && metaFenceDone === undefined && META_OPEN_LINE_RE.test(line)) { inMetaFence = true; metaFence = []; continue; }

    // ── fence tracking: OPEN and CLOSE both read through fence-mask's own rules (CommonMark §4.5) —
    // `fenceLineOpen` (backtick or tilde; a fence's info string may carry no run of its own
    // character) and `fenceLineClose` (a closer needs a run of the SAME character ≥ the opener AND
    // nothing else on the line — a content line that happens to start with a shorter or trailed run,
    // "```` example of `backticks`" inside a fence opened at four, never closes early; it is body).
    // ONE RULE, ONE PLACE — this walk reads fence-mask's guard rather than re-deriving either. ──
    if (fence === null) {
      const opened = fenceLineOpen(line);
      if (opened) {
        flushProse();
        fence = opened;
        out.push(line);
        continue;
      }
    } else if (fenceLineClose(line, fence)) {
      flushProse();
      fence = null;
      out.push(line);
      continue;
    }
    if (fence !== null) { out.push(line); continue; }

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
    if (loulou) { flushProse(); out.push(`- \`${resolveHeadWord(loulou[1]!, tongue)} ${(loulou[2] ?? "").trim()}\``); continue; }
    const aka = AKA_LINE.exec(line);
    if (aka) {
      flushProse();
      // TARGET-KIND decides the shape now (LOOP 7) — position (carrier scope vs inside an ahu)
      // no longer enters it; `weaveAka` reads the target's own meta.
      const woven = weaveAka(aka[1]!, (aka[2] ?? "").trim(), profile, resolve, tongue);
      out.push(...woven.lines);
      for (const ref of woven.references ?? []) references.set(ref.anchor, ref);
      continue;
    }
    const kahea = KAHEA_LINE.exec(line);
    if (kahea) {
      flushProse();
      const target = kahea[1]!.replace(/^"|"$/g, "");
      const href = /\s/.test(target) ? `<${target}>` : target;
      const kaheaWord = resolveHeadWord("kahea", tongue);
      out.push(`${profile.kaheaMarker}\`${kaheaWord}\` [${target}](${href})`);
      continue;
    }
    const transclusion = TRANSCLUSION_LINE.exec(line);
    if (transclusion) { flushProse(); out.push("```" + profile.tangleInfoString, transclusion[1]!, "```"); continue; }
    if (SIGIL_LINE.test(line)) {
      flushProse();
      const translated = translateSigilHead(line, tongue);
      out.push(translated.includes("`") ? translated : `\`${translated}\``);
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
  return {
    markdown,
    ...(uri ? { uri } : {}),
    ...(check ? { check } : {}),
    ...(metaFenceDone ? { metaFence: metaFenceDone } : {}),
    ...(references.size > 0 ? { references: [...references.values()] } : {}),
  };
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

function yamlFrontmatter(fields: Readonly<Record<string, string>>, extraLines: readonly string[] = []): string {
  const lines = Object.keys(fields).sort().map((k) => `${k}: "${yamlEscape(fields[k]!)}"`);
  return ["---", ...lines, ...extraLines, "---", ""].join("\n");
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
  opts?: {
    uri?: string;
    title?: string;
    lang?: string;
    /** BCP 47 — weaves every sigil head name through its `lar-weave: primary` mirror for this
     * tongue (#/the-woven-dialect). Absent: canonical, byte-identical to every prior projection. */
    tongue?: string;
    profile?: WeaveProfile;
    resolve?: (uri: string) => string | null;
  },
): SubmissionProjection {
  const profile = opts?.profile ?? PROFILES.CommonMark;
  const t = transposeMarkdown(text, profile, opts?.resolve, opts?.tongue);
  const uri = opts?.uri ?? t.uri ?? "";
  if (!uri) throw new Error("projectSubmission: the carrier declares no address and none was supplied");
  const check = t.check ?? "unchecked";
  const title = opts?.title ?? submissionTitleOf(uri);

  // THE PLACEMENT LAW — ONE AUTHORITY PER QUESTION, both channels written from these SAME inputs so
  // they never disagree in practice: the `.md.meta` SIDECAR is authoritative for what TW5 loads as
  // the tiddler's own fields (title/type) and for the TARGET RECORD (`variant`/`tongue`) — the fact
  // `--check` and the currency gate read back to know what to re-project THIS pair with, no flag
  // needed at check time. The YAML FRONTMATTER is authoritative for the identity the file travels
  // WITH when it leaves the shelf alone (source/source-check/lang/tongue/the kramdown identity
  // keys) — what an external reader (an IANA tool, an RFC toolchain) sees with no sidecar beside it.
  // A pair with no recorded variant stays CommonMark, no tongue (the default both channels share).
  const metaLines = [
    `title: ${title}`,
    `type: text/markdown`,
    `source: ${uri}`,
    `source-check: ${check}`,
    ...(profile.dialect !== "CommonMark" ? [`variant: ${profile.dialect}`] : []),
    ...(opts?.tongue ? [`tongue: ${opts.tongue}`] : []),
    `projected-by: weave (lares meme project --to md · meme-project)`,
    `law: projected artifact — hand edits do not survive re-projection`,
  ];
  const meta = metaLines.join("\n") + "\n";

  if (profile.frontmatter) {
    const fields: Record<string, string> = {
      title,
      source: uri,
      "source-check": check,
      variant: profile.dialect,
      // `lang` names the READER's tongue; `tongue` (added only when one wove) marks the WOVEN
      // authoring lineage, `x-lares` (private-use, a Lares-authored source) `>` the tongue it wove
      // into — #/the-woven-dialect's own two-field split.
      lang: opts?.lang ?? opts?.tongue ?? "en",
    };
    if (opts?.tongue) fields.tongue = `x-lares>${opts.tongue}`;
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
    // DERIVED, NEVER HAND-LISTED: every `normative:`/`informative:` entry comes from the carrier's
    // OWN pins ({@link ReferenceEntry}, collected while weaving), split by {@link referenceCategory}.
    // kramdown-rfc's OWN reference convention: a bare anchor key with no value resolves through its
    // own standard-RFC alias registry — quoting it would turn the lookup key into a literal string
    // the toolchain checks verbatim, never resolving; an anchor outside that registry carries its
    // citation fields inline instead. This rides OUTSIDE the quoted-scalar writer, appended inside
    // the SAME frontmatter block rather than forced through one generic field shape.
    const referenceBlock = (label: "normative" | "informative", refs: readonly ReferenceEntry[]): string[] => {
      const matching = refs.filter((r) => r.category === label);
      if (matching.length === 0) return [];
      const lines = [`${label}:`];
      for (const r of matching) {
        lines.push(`  ${r.anchor}:`);
        for (const [k, v] of Object.entries(r.fields ?? {})) lines.push(`    ${k}: "${yamlEscape(v)}"`);
      }
      return lines;
    };
    const refs = t.references ?? [];
    const extraLines = profile.dialect === "kramdown-rfc2629"
      ? [...referenceBlock("normative", refs), ...referenceBlock("informative", refs)]
      : [];
    const markdown = yamlFrontmatter(fields, extraLines) + t.markdown;
    // Frontmatter-carrying dialects keep the `.md.meta` sidecar TOO (TW5 loads it) — `standalone`
    // still names "this file carries its own frontmatter," never "no sidecar travels beside it."
    return { markdown, meta, uri, check, standalone: true };
  }

  return { markdown: t.markdown, meta, uri, check, standalone: false };
}
