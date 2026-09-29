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
 * walk rather than branching on a dialect name — `PROFILES.commonmark` is the one profile shipped.
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

export interface SubmissionProjection {
  /** The markdown body — what a reviewer reads. */
  markdown: string;
  /** The sidecar meta, TW5 `.meta` field lines — provenance the pair travels under. */
  meta: string;
  /** The carrier's own address, read off its SOH heading (or supplied). */
  uri: string;
  /** The block check found adjacent to ETX, or "unchecked". */
  check: string;
}

/**
 * A dialect/profile the walk reads but never branches on by name. This slice ships exactly one —
 * `PROFILES.commonmark` — and every construct above is CommonMark-shaped. A dialect differs from
 * another only through the fields of this interface, so adding one extends the interface, never
 * the walk.
 */
export interface WeaveProfile {
  readonly dialect: string;
  /** The info-string a transclusion tangle fence carries. */
  readonly tangleInfoString: string;
}

export const PROFILES: Readonly<Record<"commonmark", WeaveProfile>> = {
  commonmark: { dialect: "commonmark", tangleInfoString: "memetic-wikitext tangle" },
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
const AHU_OPEN = /^(?:<<~\s*ahu|<<fragment)\s+#(\S+?)(?: (?:[^>\n]|>(?!>))*)?\s*>>\s*$/;
const AHU_CLOSE = /^(?:<<~\s*\/\s*ahu|<<\/fragment)\s*>>\s*$/;
// The sigil WORD rides the capture too — `aka` and `loulou` name different relations and the
// projected bullet keeps that legible rather than collapsing both to one bullet shape.
const EDGE_LINE = /^<<~\s*(aka|loulou) ((?:[^>\n]|>(?!>))*?)\s*>>\s*$/;
// A transclusion standing alone as a block: `{{title}}`, `{{title||template}}`,
// `{{{filter}}}`, `{{{filter||template}}}` — no markdown equivalent exists for any of them, so
// the LINE-STANDING form carries whole into a tangle fence (a mid-line occurrence is handled
// inside `inline()`, where a fence cannot open).
const TRANSCLUSION_LINE = /^\s*(\{\{[\s\S]*\}\})\s*$/;
// The speaking head with or without a joined name (`<<~ ahu`, `<<~ranks`, `<<~! wehe`) — any
// line-standing sigil not already given a markdown shape above.
const SIGIL_LINE = /^<<~\S* ?(?:[^>\n]|>(?!>))*>>\s*$/;

/**
 * The anchor id a rooted or bare `ahu` slot path projects. Canon slot names never carry `_`
 * (0 of 2,011), so joining nested segments with it is unambiguous, and the root `/` is dropped —
 * `#/a/b` → `a_b`, `#/x` → `x`. A bare `#name` (no leading `/`) reads gracefully as the rooted
 * spelling of `/name`, so it takes the identical treatment rather than a literal fallback.
 */
function ahuId(rawPath: string): string {
  const path = rawPath.startsWith("/") ? rawPath.slice(1) : rawPath;
  return path.replace(/\//g, "_");
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
 * Transpose a memetic-wikitext body to markdown. Side-channel captures (address, check, meta fence)
 * ride the returned record; {@link projectSubmission} folds them into the meta.
 */
export function transposeMarkdown(
  text: string,
  profile: WeaveProfile = PROFILES.commonmark,
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
    const fenceMark = /^(`{3,})/.exec(line);

    // ── the meta fence: captured whole, dropped from the body ──
    if (inMetaFence) {
      if (fenceMark) { inMetaFence = false; metaFenceDone = (metaFence ?? []).join("\n"); metaFence = null; continue; }
      (metaFence ?? []).push(line);
      continue;
    }
    // Only the fence that OPENS the carrier heads the carrier (the position law) — every later
    // `toml meta` fence heads a worksite and STAYS in the body as an ordinary fenced block.
    if (fence === 0 && metaFenceDone === undefined && META_OPEN_LINE_RE.test(line)) { inMetaFence = true; metaFence = []; continue; }

    // ── fence tracking: N backticks close only on ≥ N ──
    if (fenceMark) {
      flushProse();
      const len = fenceMark[1]!.length;
      if (fence === 0) fence = len;
      else if (len >= fence) fence = 0;
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

    // ── sigils with a markdown shape ──
    const ahu = AHU_OPEN.exec(line);
    if (ahu) { flushProse(); out.push(`<a id="${ahuId(ahu[1]!)}"></a>`); continue; }
    if (AHU_CLOSE.test(line)) continue;
    const edge = EDGE_LINE.exec(line);
    if (edge) { flushProse(); out.push(`- \`${edge[1]} ${(edge[2] ?? "").trim()}\``); continue; }
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
export function projectSubmission(
  text: string,
  opts?: { uri?: string; title?: string; profile?: WeaveProfile },
): SubmissionProjection {
  const t = transposeMarkdown(text, opts?.profile);
  const uri = opts?.uri ?? t.uri ?? "";
  if (!uri) throw new Error("projectSubmission: the carrier declares no address and none was supplied");
  const check = t.check ?? "unchecked";
  const meta = [
    `title: ${opts?.title ?? `${uri}/submission`}`,
    `type: text/markdown`,
    `source: ${uri}`,
    `source-check: ${check}`,
    `projected-by: weave (lares meme project --to md · meme-project)`,
    `law: projected artifact — hand edits do not survive re-projection`,
  ].join("\n") + "\n";
  return { markdown: t.markdown, meta, uri, check };
}
