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

/** What a parameter's value carries beyond its text. */
export type SigilValueKind = "string" | "macro" | "transclude" | "filter" | "substitution" | "title";

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

/** A scheme is not a parameter. `lar:///x` carries no key named `lar`. */
const SCHEMES = new Set([
  "lar", "ni", "did", "http", "https", "file", "urn", "data", "mailto", "at", "ipfs", "ipns",
]);

/** The opening bracket pair that names a typed value, and the kind it carries. */
const TYPED: ReadonlyArray<readonly [string, SigilValueKind]> = [
  ["<<", "macro"],
  ["{{", "transclude"],
  ["[[", "title"],
  ["[{", "filter"],
  ["${", "substitution"],
];

/**
 * Read every named parameter in a sigil's BODY — the text between the head word and `>>`.
 *
 * A positional argument carries no name and appears in no result; a caller that wants one reads the
 * body directly, the way `ahu` reads its slot.
 */
export function readSigilAttrs(body: string): SigilAttr[] {
  const out: SigilAttr[] = [];
  // ── THE NAME CHARSET IS THE PARSER'S, NOT A GUESS ──────────────────────────────────────────────
  // Measured against TiddlyWiki 5.5.0: `a-b` `a_b` `a+b` `a.b` `a$b` `a#b` `a@b` `a!b` `a%b` `a*b` all
  // parse as ONE parameter name; only `a/b` does not. A narrower charset reads a DIFFERENT name out of
  // the same bytes — `…+precariousness=Varela` became `precariousness=` — and then disagrees with the
  // parser about a parameter neither side is wrong about.
  //
  // A key stands where no `:` or `/` precedes it, so a URI's scheme and a path segment fall away.
  const re = /(?<![\w:/@.-])([^\s=:>"'/]+)\s*([=:])\s*/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    const name = m[1]!, sep = m[2]! as "=" | ":";
    if (SCHEMES.has(name.toLowerCase())) continue;
    const at = m.index + m[0].length;
    const two = body.slice(at, at + 2);

    const typed = TYPED.find(([open]) => two === open);
    if (typed) {
      // A TYPED value ends at its own closing pair; the sigil's `>>` may sit inside it.
      const close = { "<<": ">>", "{{": "}}", "[[": "]]", "[{": "}]", "${": "}$" }[two] ?? ">>";
      const end = body.indexOf(close, at + 2);
      const stop = end === -1 ? body.length : end + close.length;
      out.push({ name, value: body.slice(at, stop), sep, quoted: false, kind: typed[1], start: m.index, end: stop });
      re.lastIndex = stop;
      continue;
    }

    const q = two[0];
    if (q === '"' || q === "'") {
      const end = body.indexOf(q, at + 1);
      const stop = end === -1 ? body.length : end;
      out.push({ name, value: body.slice(at + 1, stop), sep, quoted: true, kind: "string", start: m.index, end: stop + 1 });
      re.lastIndex = stop + 1;
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
