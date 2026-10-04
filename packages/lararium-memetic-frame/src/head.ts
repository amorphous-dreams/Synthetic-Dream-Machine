/**
 * carrier-head — THE ONE PLACE THAT READS A CARRIER'S FRAMING ENDS.
 *
 * ── WHY ONE PLACE ────────────────────────────────────────────────────────────────────────────────
 * Nine readers across this tree asked the same question — what address does this carrier's head
 * name? — and each carried its own spelling of it. When the corpus quoted its control values, eight
 * of the nine stopped matching in the same minute: the tw5 suite fell to ten failures, one witness
 * reported 1395 torn frames, and a corpus finder in the e2e suite matched ONE carrier in 700 while
 * every per-carrier law beneath it would have reported clean over the empty set.
 *
 * A spelling that lives in nine places changes in nine places, and the ninth is always the one no
 * routine run reaches. It lives here now.
 *
 * ── TWO QUESTIONS, NOT ONE ───────────────────────────────────────────────────────────────────────
 * `matchCarrierMark` asks whether a framing mark STANDS — a head or a release, bearing or not. The
 * deserializer strips one; a shape reader counts them.
 * `matchCarrierHead` asks what the head NAMES, which requires the bearing. A head with no bearing
 * answers the first question and not the second, and collapsing them would let a torn frame report
 * an address it never carried.
 *
 * ── ONE SPELLING, QUOTED ─────────────────────────────────────────────────────────────────────────
 * The framing ends are written one way: `<<^ code="&#x0001;" from="?" -> to="lar:///x">>` and
 * `<<^ code="&#x0004;" -> to="?">>`. TiddlyWiki would type an unquoted or positional end the same,
 * and that is exactly why reading them stopped: a tolerance read silently becomes the canon. A retired
 * spelling reads as no mark here, and the frame verdict names it as a tear. Every capture strips the
 * quote pair rather than carrying it into the value.
 *
 * ── WHAT STANDS BETWEEN THE ENDS ─────────────────────────────────────────────────────────────────
 * The ARROW rides as an unnamed positional and carries the RELATION. Quoting reaches only the two
 * values it stands between, so a bearing never demotes to a field.
 *
 * ── AND WHAT THIS DOES NOT COLLAPSE ──────────────────────────────────────────────────────────────
 * Three layers, and only the middle one is new:
 *
 *   · the CODES collapse, in marks.ts — one fact, and a mark either stands in this grammar or
 *     it does not. This module derives its code sets from there rather than restating them.
 *   · the BEARING READ collapses, here — nine readers asked one question in nine identical spellings
 *     and eight broke in the same minute.
 *   · the frame SCANS DO NOT collapse, by standing ruling (marks.ts). The stream framer refuses
 *     a line-crossing sigil because the multi-line form once swallowed text to a distant real sigil;
 *     the bootstrap scanner takes the wider read deliberately, running before grammar loads; the
 *     deserializer's prefix stops at a binding mark. Those differences are SCARRED, not accidental.
 *
 *     The bootstrap scanner keeps its OWN control literals for a second reason: `frame-parity` reads
 *     them out of that file as the independent recogniser, so sourcing them here would make the
 *     spec-against-scanner comparison tautological and delete the seam that witness measures.
 */

/**
 * The framing codes come from marks.ts — ONE fact, declared once. Restating them here would let a
 * mark added there read correct in every file while this one quietly dropped it.
 */
import { frameHex } from "./marks.js";
import { maskedExec } from "./fence-mask.js";

const SOH_CODES = `(?:${frameHex("SOH")})`;
const EOT_CODES = `(?:${frameHex("EOT")})`;

/** A control sigil never crosses a line, and `>>` closes it only when a second bracket follows. */
const INNER = "(?:[^>\\n]|>(?!>))*";
/**
 * THE CODE IS NAMED, AND NAMED FIRST: `<<^ code="&#x0001;"`. A head that carried its code as a bare
 * entity — glyphs in front of it standing for a namespace — is a retired spelling, read as no mark at
 * all here and named by the frame verdict as a tear. Nothing repairs it in silence.
 */
const CODE = (codes: string): string => `<<\\^\\s+code="&#x${codes};"`;
/** A bearing end: `"?"`, quoted. A bare `?` is a retired spelling. */
const UNK = '"\\?"';
/**
 * A bearing target: `to="…"`, named and quoted, the pair stripped from the capture. The positional
 * (`? -> lar:///x`) and unquoted (`to=lar:///x`) spellings are retired.
 *
 * A `>` CLOSES A CALL ONLY WHEN A SECOND ONE FOLLOWS. TiddlyWiki's `reUnquotedAttribute` admits
 * `>(?!>)` inside a value, so an address carrying a bracket rides as content. A capture that excluded
 * `>` outright read NULL where the parser read the whole address — measured against the parse tree.
 */
const TARGET = 'to="((?:[^"\\s>]|>(?!>))+)"';

export interface CarrierMark {
  /** Offset of `<<^`, relative to the text handed in. */
  readonly index: number;
  /** Offset just past `>>`. */
  readonly end: number;
  /** The four-hex control code, without entity punctuation — `0001`, `0011`, `0004`, `0014`. */
  readonly code: string;
  /** The whole matched sigil. */
  readonly text: string;
}

export interface CarrierHead extends CarrierMark {
  /** The address the head names, quotes stripped. */
  readonly uri: string;
  /** The namespace glyphs, whole — a value like `ॐ ँ` carries its space. */
  readonly namespace: string | null;
}

/**
 * A FRESH pattern per call. A module-scope `/g` regex carries `lastIndex` between unrelated callers,
 * and a reader that inherited a stale index skips the very first mark in its own text.
 */
export const carrierHeadPattern = (flags = ""): RegExp =>
  new RegExp(`${CODE(SOH_CODES)}${INNER}\\bfrom=${UNK}\\s*->\\s*${TARGET}\\s*>>`, flags);

/** The head line, anchored and taking its trailing newline — what a stripper needs. */
export const carrierHeadLinePattern = (flags = ""): RegExp =>
  new RegExp(`^${CODE(SOH_CODES)}${INNER}>>\\n?`, flags);

/** The head or release MARK — bearing not required. */
export const carrierMarkPattern = (which: "head" | "release", flags = ""): RegExp =>
  new RegExp(`${CODE(which === "head" ? SOH_CODES : EOT_CODES)}${INNER}>>`, flags);

/** The release, which resolves toward an address it cannot know. */
export const carrierReleasePattern = (flags = ""): RegExp =>
  new RegExp(`${CODE(EOT_CODES)}${INNER}->\\s*to=${UNK}\\s*>>`, flags);

const CODE_RE = new RegExp(`&#x(${frameHex("SOH")}|${frameHex("EOT")});`);
const NS_RE = /\bnamespace="([^"]*)"/;

/**
 * What does this carrier's head NAME? Null where no head carries a bearing.
 *
 * ── A QUOTED HEAD IS NOT A HEAD ──────────────────────────────────────────────────────────────────
 * A carrier that SHOWS the grammar — a spec, a lesson, a scout's record — writes a head-shaped line
 * inside a fence or a tick span, and that line opens nothing. TiddlyWiki's parser produces no node
 * there; an unmasked pattern takes the first one it meets. Measured against the parser over the whole
 * corpus, a fenced decoy placed above a real head is the ONE reading where the two ever diverged.
 *
 * So the mask rides here rather than in each caller. The same law already cost this tree a silent
 * truncation at ingest, where a fenced ETX mention ended every carrier that quoted one.
 */
export function matchCarrierHead(text: string, from = 0): CarrierHead | null {
  const m = from === 0
    ? maskedExec(text, carrierHeadPattern("g"))
    : (() => { const re = carrierHeadPattern("g"); re.lastIndex = from; return re.exec(text); })();
  if (!m) return null;
  const ns = NS_RE.exec(m[0]);
  return {
    index: m.index,
    end: m.index + m[0].length,
    code: CODE_RE.exec(m[0])?.[1] ?? "",
    text: m[0],
    uri: m[1] ?? "",
    namespace: ns ? ns[1]! : null,
  };
}

/** Does a framing mark STAND here? Bearing not required — a torn frame still answers. */
export function matchCarrierMark(text: string, which: "head" | "release", from = 0): CarrierMark | null {
  const re = carrierMarkPattern(which, "g");
  re.lastIndex = from;
  const m = re.exec(text);
  if (!m) return null;
  return { index: m.index, end: m.index + m[0].length, code: CODE_RE.exec(m[0])?.[1] ?? "", text: m[0] };
}

/** The address alone — the question seven of the nine readers asked. */
export function headUriOf(text: string): string | null {
  return matchCarrierHead(text)?.uri ?? null;
}

/** Line-anchored, for a walker that reads one line at a time. */
export function matchCarrierHeadLine(line: string): CarrierHead | null {
  const h = matchCarrierHead(line);
  return h && h.index === 0 ? h : null;
}
