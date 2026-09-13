/**
 * sigil-attrs — THE ONE PLACE THAT READS A SIGIL'S NAMED PARAMETERS.
 *
 * ── THE SAME COLLAPSE, ONE LAYER OUT ─────────────────────────────────────────────────────────────
 * `carrier-head` collapsed the nine spellings of one question about the CONTROL frame. This answers
 * the same question for every OTHER sigil: what named parameters does this body carry, and what value
 * does each hold? Five readers hold their own spelling of it today — the pranala wikirule on the
 * RENDER path, three bootstrap scans, the edge reader, and the turn harvester.
 *
 * ── THE QUOTE IS NOT PART OF THE VALUE, AND A TYPED VALUE IS NOT A STRING ────────────────────────
 * TiddlyWiki types `family=code` and `family="code"` identically, so both spell one parameter and the
 * capture strips the pair. But FIVE shapes do NOT survive quoting — a macro call, a transclusion, a
 * filter, a substitution, and a bracketed title each carry a TYPE that quoting would flatten to
 * string, and `name=<<name>>` would stop calling the macro. Those arrive with `typed` set and their
 * source text intact, so no caller can quote one by accident.
 *
 * ── AND A SEPARATOR IS NOT A SPELLING CHOICE ─────────────────────────────────────────────────────
 * `=` and `:` both appear in this corpus. A reader binding one meets carriers written in the other.
 */

import { fencedSpans, inMask } from "./meme-ast/fence-mask.js";

/**
 * What a parameter's value carries beyond its text — the kinds TiddlyWiki itself assigns.
 *
 * `filtered`, `indirect`, `macro` and `substituted` reach a call ONLY through the `=` separator; the
 * `:` separator admits a quoted or unquoted string and nothing else.
 */
export type SigilValueKind = "string" | "macro" | "indirect" | "filtered" | "substituted";

export interface SigilAttr {
  readonly name: string;
  /** The value with any quote pair stripped. For a TYPED value, the source text as written. */
  readonly value: string;
  /** Which separator the source used. */
  readonly sep: "=" | ":";
  /** Whether the source quoted the value. */
  readonly quoted: boolean;
  /**
   * Anything but `string` names a value QUOTING WOULD BREAK. A caller that canonicalizes MUST leave
   * these exactly as they stand.
   */
  readonly kind: SigilValueKind;
  readonly start: number;
  readonly end: number;
}

/**
 * The four delimiters a string literal wears — `"""…"""`, `"…"`, `'…'`, `[[…]]`. Mirrors
 * TiddlyWiki's own `parseStringLiteral`, which strips the pair and reports a plain string.
 */
function matchStringLiteral(body: string, at: number): { value: string; end: number } | null {
  const re = /(?:"""([\s\S]*?)"""|"([^"]*)")|(?:'([^']*)')|\[\[((?:[^\]]|\](?!\]))*)\]\]/y;
  re.lastIndex = at;
  const m = re.exec(body);
  if (!m || m.index !== at) return null;
  const value = m[1] !== undefined ? m[1] : m[2] !== undefined ? m[2] : m[3] !== undefined ? m[3] : m[4]!;
  return { value, end: at + m[0].length };
}

/** A scheme is not a parameter. `lar:///x` carries no key named `lar`. */
const SCHEMES = new Set([
  "lar", "ni", "did", "http", "https", "file", "urn", "data", "mailto", "at", "ipfs", "ipns",
]);

/**
 * ── THE SEPARATOR DECIDES WHAT A VALUE MAY BE ────────────────────────────────────────────────────
 * `=` in a CALL arrived to unlock the indirect forms. Only after it does TiddlyWiki look for a
 * filtered `{{{…}}}`, an indirect `{{…}}`, a macro `<<…>>` or a substituted `` `…` `` value; after
 * `:` it takes a string literal or an unquoted run and nothing else.
 *
 * A quoted value stands legal after EITHER separator — the string literal is tried first, before the
 * new-style branch opens.
 *
 * ── AND A STRING LITERAL WEARS FOUR DELIMITERS ───────────────────────────────────────────────────
 * `parseStringLiteral` takes `"""triple"""`, `"double"`, `'single'` AND `[[bracketed]]`, each yielding
 * a plain string with the delimiters stripped. It runs BEFORE the new-style branch, so all four stand
 * legal after either separator — `p=[[A Title]]` and `p:[[A Title]]` both hand back `A Title`.
 *
 * A value already wearing any of the four needs no further quoting.
 */
const NEW_STYLE: ReadonlyArray<readonly [string, string, SigilValueKind]> = [
  ["{{{", "}}}", "filtered"],
  ["{{",  "}}",  "indirect"],
  ["<<",  ">>",  "macro"],
  ["```", "```", "substituted"],
  ["`",   "`",   "substituted"],
];

/**
 * Read every named parameter in a sigil's BODY — the text between the head word and `>>`.
 *
 * A positional argument carries no name and appears in no result; a caller that wants one reads the
 * body directly, the way `ahu` reads its slot.
 */
export function readSigilAttrs(body: string): SigilAttr[] {
  const out: SigilAttr[] = [];
  // ── A KEY INSIDE A QUOTED VALUE IS NOT A PARAMETER ──────────────────────────────────────────────
  // A free note wrapped in quotes is ONE string literal, and TiddlyWiki finds no parameter inside it.
  // Scanning the raw body invents one wherever the prose happens to carry `word:` or `word=` — and a
  // carrier writing `<<~Task T1.1 "build/… ~ ACCEPT: a blind rater…">>` reads as bearing an `ACCEPT`
  // parameter the parser never assigns. The scan runs over the MASKED body and the values are cut
  // from the raw one, so a value keeps its own text while a quoted interior names nothing.
  const scan = maskProtectedSpans(body);
  // ── THE NAME CHARSET IS THE PARSER'S, AND THE SEPARATOR NARROWS IT ─────────────────────────────
  // `reAttributeName` admits `[^\/\s>"'`=:]+` — so `a-b` `a_b` `a+b` `a.b` `a$b` `a#b` `a@b` `a!b`
  // `a%b` `a*b` all name ONE parameter and only `a/b` does not.
  //
  // ⚠ AND THE COLON DEMANDS A STRICT IDENTIFIER. TiddlyWiki discards the name and the separator
  // where `:` follows anything but `[A-Za-z0-9-_]+` — "to avoid mis-parsing values like `$:/foo`" —
  // and the token then reads as a POSITIONAL. A reader that bound `a.b:v` as a named parameter would
  // report one where the parser reports none.
  //
  // A key stands where no `:` or `/` precedes it, so a URI's scheme and a path segment fall away.
  // The scan stops AT the separator — a trailing `\s*` would eat a masked value whole, since the mask
  // writes spaces where the quoted text stood, and the read position would land past it.
  const re = /(?<![\w:/@.-])([^\s=:>"'`/]+)[ \t]*([=:])/g;
  const STRICT = /^[A-Za-z0-9\-_]+$/;
  let m: RegExpExecArray | null;
  while ((m = re.exec(scan)) !== null) {
    const name = m[1]!, sep = m[2]! as "=" | ":";
    if (SCHEMES.has(name.toLowerCase())) continue;
    // The colon binds only a strict identifier; anything else reads as a positional, name and all.
    if (sep === ":" && !STRICT.test(name)) continue;
    // whitespace after the separator is skipped against the RAW body, where the value still stands
    let at = m.index + m[0].length;
    while (at < body.length && (body[at] === " " || body[at] === "\t")) at++;
    // A QUOTED value stands legal after EITHER separator — the string literal is tried first.
    const q0 = body[at];
    if (q0 !== '"' && q0 !== "'" && sep === "=") {
      const typed = NEW_STYLE.find(([open]) => body.startsWith(open, at));
      if (typed) {
        const [open, close, kind] = typed;
        const end = body.indexOf(close, at + open.length);
        const stop = end === -1 ? body.length : end + close.length;
        out.push({ name, value: body.slice(at, stop), sep, quoted: false, kind, start: m.index, end: stop });
        re.lastIndex = stop;
        continue;
      }
    }

    // A STRING LITERAL, in any of its four delimiters — tried before the unquoted run, as the parser does.
    const lit = matchStringLiteral(body, at);
    if (lit) {
      out.push({ name, value: lit.value, sep, quoted: true, kind: "string", start: m.index, end: lit.end });
      re.lastIndex = lit.end;
      continue;
    }

    // A BARE value runs to whitespace — and a `>` closes a call only when a second one follows, so a
    // bracket inside a value rides as content, exactly as TiddlyWiki's own unquoted attribute admits.
    //
    // AND IT STOPS AT A QUOTE. A quote may DELIMIT a value, so an unquoted one cannot contain either
    // kind: measured, `Phonology=don't` gives the parser `don`, and a reader that took the apostrophe
    // as content read a value TiddlyWiki never assigns.
    const bare = /(?:[^\s>"']|>(?!>))*/y;
    bare.lastIndex = at;
    const text = bare.exec(body)?.[0] ?? "";
    out.push({ name, value: text, sep, quoted: false, kind: "string", start: m.index, end: at + text.length });
    re.lastIndex = at + text.length;
  }
  return out;
}

/** One parameter by name, or undefined. The LAST wins, matching TiddlyWiki's own attribute order. */
export function sigilAttr(body: string, name: string): SigilAttr | undefined {
  let found: SigilAttr | undefined;
  for (const a of readSigilAttrs(body)) if (a.name === name) found = a;
  return found;
}

/** The value alone — the question most callers ask. */
export function sigilAttrValue(body: string, name: string): string | undefined {
  return sigilAttr(body, name)?.value;
}

/** Every parameter a canonicalizer MAY quote: a plain string that stands bare today. */
export function quotableAttrs(body: string): SigilAttr[] {
  return readSigilAttrs(body).filter((a) => a.kind === "string" && !a.quoted);
}

/**
 * Blank every span whose interior a delimiter already protects, keeping offsets.
 *
 * TWO KINDS, and both carry spaces so a word-walker cannot see their edges:
 *   · a QUOTED value — `feedback="closed 1↺ -> open 1φ @◇:reason"`, where the colon separates nothing,
 *     in any of the delimiters a string literal wears, `"""…"""` included and tried FIRST;
 *   · a WIKILINK — `[[label|lar:///x]]`, which TiddlyWiki reads as one link and which quoting would
 *     BREAK. A sigil carrying prose carries these, and they are already well-formed.
 */
function maskProtectedSpans(body: string): string {
  const out = body.split("");
  const blank = (from: number, to: number) => { for (let j = from; j <= to && j < out.length; j++) out[j] = " "; };
  for (let i = 0; i < out.length; i++) {
    const c = body[i];
    // THE TRIPLE FORM IS TRIED FIRST, as TiddlyWiki tries it — `"""…"""` admits almost anything,
    // including the very quotes a single pair would end on. Matching `"` first would close the span
    // at the opening delimiter's second character and read the interior as bare text.
    if (body.startsWith('"""', i)) {
      const end = body.indexOf('"""', i + 3);
      if (end === -1) break;
      blank(i, end + 2); i = end + 2; continue;
    }
    if (c === '"' || c === "'") {
      const end = body.indexOf(c, i + 1);
      if (end === -1) break;
      blank(i, end); i = end; continue;
    }
    if (c === "[" && body[i + 1] === "[") {
      const end = body.indexOf("]]", i + 2);
      if (end === -1) continue;
      blank(i, end + 1); i = end + 1;
    }
  }
  return out.join("");
}

/**
 * A POSITIONAL argument that TiddlyWiki would read as a NAMED PARAMETER instead.
 *
 * ── THE HAZARD, MEASURED ─────────────────────────────────────────────────────────────────────────
 * `param-name ":" value` is call syntax. A URI scheme spells with exactly the characters a parameter
 * name admits, so an unquoted `lar:///x` standing in a positional slot binds a parameter named `lar`
 * and THE POSITIONAL RECEIVES NOTHING. Measured against TiddlyWiki 5.5.0:
 *
 *   <<~ loulou lar:///x>>     positional [0="loulou"]              named [lar="///x"]
 *   <<~ loulou "lar:///x">>   positional [0="loulou", 1="lar:///x"]
 *
 * Upstream's `Calls` overstates when delimiters may be dropped; the correction this house wrote
 * stands at lar:///ha.ka.ba/lares/docs/tw5-calls-colon-caveat.
 *
 * Quoting the value is the whole cure: the colon stops being a separator and the slot fills.
 */
export function schemeShapedPositionals(body: string): string[] {
  const out: string[] = [];
  // ── A QUOTED SPAN IS ALREADY SAFE, AND IT CARRIES SPACES ──────────────────────────────────────
  // A word-walker that only refused words BEGINNING with a quote still reads the interior of
  // `feedback="closed 1↺ -> open 1φ @◇:reason"` as bare words, and reports a hazard inside a value
  // that is already delimited. The span is masked whole before any word is read.
  const masked = maskProtectedSpans(body);
  const word = /(?:^|\s)(?!["'])((?:[^\s>"']|>(?!>))+)/g;
  let m: RegExpExecArray | null;
  while ((m = word.exec(masked)) !== null) {
    const w = m[1]!;
    // A NAMED parameter is not a positional — `family=lar:///x` fills a name, and its value may carry
    // any colon it likes.
    if (/^[^\s=:>"'/]+\s*=/.test(w)) continue;
    // The hazard shape: a parameter-name-shaped run, then a colon, then more.
    const hazard = /^([^\s=:>"'/]+):(.+)$/.exec(w);
    if (hazard) out.push(w);
  }
  return out;
}

/** One sigil found in a carrier, with the positionals TiddlyWiki would lose. */
export interface LostPositional {
  /** Offset of `<<` in the carrier. */
  readonly index: number;
  /** The whole sigil as written. */
  readonly sigil: string;
  /** Every positional value a scheme would steal. */
  readonly values: readonly string[];
}

const SIGIL_RE = /<<(?:~[ \t]*)?[A-Za-z][\w-]*(?:[^>]|>(?!>))*>>/g;

/**
 * Walk a WHOLE carrier and report every sigil whose positional TiddlyWiki would lose to a scheme.
 *
 * ── A FENCED SIGIL OPENS NOTHING ─────────────────────────────────────────────────────────────────
 * A carrier that SHOWS the grammar writes sigils inside a fence or a tick span. TiddlyWiki produces
 * no node there, so such a sigil teaches the form and calls no procedure — the mask keeps it whole
 * and this reader passes over it.
 *
 * The corpus-level question lives HERE so no caller reaches past the shore to ask it.
 */
export function lostPositionals(carrierText: string): LostPositional[] {
  const spans = fencedSpans(carrierText);
  const out: LostPositional[] = [];
  SIGIL_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = SIGIL_RE.exec(carrierText)) !== null) {
    if (inMask(spans, m.index)) continue;
    const body = m[0].replace(/^<<~?[ \t]*/, "").replace(/>>$/, "");
    const values = schemeShapedPositionals(body);
    if (values.length) out.push({ index: m.index, sigil: m[0], values });
  }
  return out;
}

// ── THE SLOTS, THE OTHER HALF OF THE SAME QUESTION ───────────────────────────────────────────────

/** The four delimiters, as `parseStringLiteral` wears them — the triple form FIRST. */
const LITERALS: ReadonlyArray<readonly [string, string]> = [
  ['"""', '"""'], ['"', '"'], ["'", "'"], ["[[", "]]"],
];

/** A string literal at `i`, delimiters stripped — or null. */
function literalAt(body: string, i: number): { value: string; end: number } | null {
  for (const [open, close] of LITERALS) {
    if (!body.startsWith(open, i)) continue;
    const end = body.indexOf(close, i + open.length);
    if (end === -1) continue;
    return { value: body.slice(i + open.length, end), end: end + close.length };
  }
  return null;
}

/** Past the VALUE a named parameter binds — a literal, one of the typed forms, or a bare run. */
function pastValue(body: string, i: number): number {
  const lit = literalAt(body, i);
  if (lit) return lit.end;
  for (const [open, close] of NEW_STYLE) {
    if (!body.startsWith(open, i)) continue;
    const end = body.indexOf(close, i + open.length);
    if (end !== -1) return end + close.length;
  }
  const ws = body.slice(i).search(/\s/);
  return ws === -1 ? body.length : i + ws;
}

/**
 * Read the POSITIONAL arguments of a sigil body, in order, delimiters stripped.
 *
 * ── A DISPATCHER'S SLOTS ARE A PROMISE, AND THIS READER KEEPS IT ────────────────────────────────
 * Twenty-nine sigil definitions declare `p1 … p5`. Filling those slots asks the same question
 * `readSigilAttrs` asks about names, under the same rules: a positional wears the same four
 * delimiters a named value wears, and it stands beside the same `name=value` pairs it must step
 * over. One reader, so the two halves cannot drift apart.
 *
 * ── THE QUOTE BINDS THE VALUE AND IS NOT PART OF IT ─────────────────────────────────────────────
 * `<<~ stage "20" "Mischief-Muse">>` fills TWO slots with `20` and `Mischief-Muse`. Handing a slot
 * its own delimiters back renders them, and every definition would then have to strip what the
 * grammar already bound.
 *
 * ── AND AN UNQUOTED SCHEME STILL BINDS A NAME ───────────────────────────────────────────────────
 * `lar:///x` standing bare spells with parameter-name characters, so TiddlyWiki reads a parameter
 * `lar` and the slot receives nothing. This reader AGREES with that rather than papering over it —
 * a reader kinder than the parser reports a slot the render will leave empty.
 */
export function positionalsOf(body: string): string[] {
  const out: string[] = [];
  const NAME = /^([^\s=:>"'`/]+)[ \t]*([=:])/;
  const STRICT = /^[A-Za-z0-9\-_]+$/;
  let i = 0;
  while (i < body.length) {
    if (/\s/.test(body[i]!)) { i++; continue; }
    const named = NAME.exec(body.slice(i));
    if (named && (named[2] === "=" || STRICT.test(named[1]!))) {
      i = pastValue(body, i + named[0].length);
      continue;
    }
    const lit = literalAt(body, i);
    if (lit) { out.push(lit.value); i = lit.end; continue; }
    const ws = body.slice(i).search(/\s/);
    const end = ws === -1 ? body.length : i + ws;
    out.push(body.slice(i, end));
    i = end;
  }
  return out;
}
