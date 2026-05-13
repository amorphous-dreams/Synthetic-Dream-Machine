/**
 * lar-sigil-shared — shared helpers for the three lar-sigil wikirule
 * modules (lar-sigil-block, lar-sigil-inline, lar-doctype-comment).
 *
 * Each rule file lives in its own module-type:wikirule tiddler so TW5's
 * standard plugin loader registers them via the canonical
 * `WikiParser.createClassesFromModules` path (reads `exports.types.{block
 * |inline|pragma}` to classify the rule). This shared file is bundled by
 * Vite into each rule's CJS output (no separate module-type:wikirule
 * tiddler — Vite inlines the imports).
 */

import type { GrammarRules } from "@lararium/core";

export interface ParseTreeNode {
  readonly type:        string;
  readonly attributes?: Record<string, { type: "string"; value: string }>;
  readonly children?:   ParseTreeNode[];
  readonly text?:       string;
}

export interface WikiParser {
  source: string;
  pos:    number;
}

export interface RuleInstance {
  parser:    WikiParser | null;
  matchPos?: number;
  matchEnd?: number;
  /** For ahu blocks: parsed attributes. For literal-survival: { __literal__ }. */
  attrs?:    Record<string, string>;
}

export const AHU_OPEN_RE = /<<~\s+(?:(kahea|aka)\s+)?ahu\s+([^>]+?)\s*>>/g;
export const ANY_OPEN_RE = /<<~[^\n]*?>>/g;
export const AHU_CLOSE_TAG = "<<~/ahu";

/**
 * URI-form sigil matcher: `<<~ <sigil> <uri> >>` where the sigil keyword is
 * one of aka/kahea/loulou and the next token is a URI (lar:/// scheme,
 * fragment-only `#slot`, or path-shaped). Excludes child-slot summons
 * (`<<~ aka ahu ...>>`, `<<~ kahea ahu ...>>`) which the ahu rule claims.
 */
export const URI_FORM_SIGIL_RE = /<<~\s+(aka|kahea|loulou)\s+(lar:\/\/[^\s>]+|#[^\s>]+|[^\s>(]+\/[^\s>]+|[^\s>(]+#[^\s>]+)\s*>>/g;

export interface UriFormMatch {
  readonly start: number;
  readonly end:   number;
  readonly sigil: "aka" | "kahea" | "loulou";
  readonly uri:   string;
}

export function matchUriFormSigilAt(source: string, start: number): UriFormMatch | null {
  URI_FORM_SIGIL_RE.lastIndex = start;
  const m = URI_FORM_SIGIL_RE.exec(source);
  if (!m || m.index !== start) return null;
  const [, sigil, uri] = m;
  return {
    start: m.index,
    end:   URI_FORM_SIGIL_RE.lastIndex,
    sigil: sigil as "aka" | "kahea" | "loulou",
    uri:   uri!,
  };
}

/**
 * Pranala-header form: `<<~ ? -> uri >>` — the carrier-to-canonical edge
 * declared at the top of a meme. Distinct from URI-form aka/kahea/loulou
 * because the leading "?" is a special token (this carrier itself), not a
 * sigil keyword.
 */
export const PRANALA_HEADER_RE = /<<~\s*\?\s*->\s*(\S+)\s*>>/g;

export interface PranalaHeaderMatch {
  readonly start: number;
  readonly end:   number;
  readonly uri:   string;
}

export function matchPranalaHeaderAt(source: string, start: number): PranalaHeaderMatch | null {
  PRANALA_HEADER_RE.lastIndex = start;
  const m = PRANALA_HEADER_RE.exec(source);
  if (!m || m.index !== start) return null;
  const [, uri] = m;
  return {
    start: m.index,
    end:   PRANALA_HEADER_RE.lastIndex,
    uri:   uri!,
  };
}

/**
 * Pranala edge sigil — explicit edge with from/to and optional slot/family/role.
 *
 * Inline form:  `<<~ pranala #name? <from> -> <to> [family:f] [role:r] >>`
 * Block form:   `<<~ pranala #name? <from> -> <to> >>body<<~/pranala >>`
 *
 * The two forms share opener parsing; closer presence distinguishes them.
 */
export const PRANALA_OPEN_RE = /<<~\s*pranala\s+(?:(#[\w-]+)\s+)?(\S+)\s*->\s*(\S+)((?:\s+\w+:[^\s>]+)*)\s*>>/g;

export interface PranalaOpenMatch {
  readonly start:  number;
  readonly end:    number;
  readonly slot:   string | null;
  readonly from:   string;
  readonly to:     string;
  readonly attrs:  Record<string, string>;
}

export function matchPranalaOpenAt(source: string, start: number): PranalaOpenMatch | null {
  PRANALA_OPEN_RE.lastIndex = start;
  const m = PRANALA_OPEN_RE.exec(source);
  if (!m || m.index !== start) return null;
  const [, slot, from, to, tail] = m;
  const attrs: Record<string, string> = {};
  if (tail) {
    const attrRe = /(\w+):([^\s>]+)/g;
    let am: RegExpExecArray | null;
    while ((am = attrRe.exec(tail)) !== null) {
      attrs[am[1]!] = am[2]!;
    }
  }
  return {
    start: m.index,
    end:   PRANALA_OPEN_RE.lastIndex,
    slot:  slot ?? null,
    from:  from!,
    to:    to!,
    attrs,
  };
}

/**
 * Block sigils whose closing tag we recognize for body capture. The body
 * text rides through the parse tree as literal source so the disk render
 * preserves it; it's not used for widget rendering of non-ahu sigils today.
 */
export const BLOCK_CLOSERS: Record<string, string> = {
  ahu:        "<<~/ahu",
  pranala:    "<<~/pranala",
  kahea:      "<<~/kahea",
  wehe:       "<<~/wehe",
  helu:       "<<~/helu",
  wai:        "<<~/wai",
  huli:       "<<~/huli",
  hui:        "<<~/hui",
  heihei:     "<<~/heihei",
  puka:       "<<~/puka",
  meme:       "<<~/meme",
  procedure:  "<<~/\\procedure",
  function:   "<<~/\\function",
  "define":   "<<~/\\define",
  if:         "<<~/\\if",
  for:        "<<~/\\for",
  sync:       "<<~/\\sync",
  race:       "<<~/\\race",
  rush:       "<<~/\\rush",
  tiddler:    "<<~/\\tiddler",
};

export interface AhuMatch {
  readonly start:    number;
  readonly end:      number;
  readonly modifier: "kahea" | "aka" | null;
  readonly arg:      string;
}

export function matchAhuOpenAt(source: string, start: number): AhuMatch | null {
  AHU_OPEN_RE.lastIndex = start;
  const m = AHU_OPEN_RE.exec(source);
  if (!m || m.index !== start) return null;
  const [, modifier, arg] = m;
  return {
    start:    m.index,
    end:      AHU_OPEN_RE.lastIndex,
    modifier: (modifier as "kahea" | "aka" | undefined) ?? null,
    arg:      arg!.trim(),
  };
}

export function findCloseEnd(
  source: string,
  sigil: string,
  fromPos: number,
  closers: Record<string, string> = BLOCK_CLOSERS,
): number | null {
  const tag = closers[sigil];
  if (!tag) return null;
  const idx = source.indexOf(tag, fromPos);
  if (idx === -1) return null;
  const closingEnd = source.indexOf(">>", idx + tag.length);
  if (closingEnd === -1) return null;
  return closingEnd + 2;
}

export function findGenericOpenAt(source: string, start: number): { end: number; sigil: string | null } | null {
  if (!source.startsWith("<<~", start)) return null;
  ANY_OPEN_RE.lastIndex = start;
  const m = ANY_OPEN_RE.exec(source);
  if (!m || m.index !== start) return null;
  const inner = source.slice(start + 3, m.index + m[0].length - 2).trim();
  const kwMatch = inner.match(/^[!⊙]?(?:&#x[0-9a-fA-F]+;)?\s*(\\?[a-zA-Z][\w-]*)?/);
  const sigil = kwMatch?.[1]?.replace(/^\\/, "") ?? null;
  return { end: m.index + m[0].length, sigil };
}

export function attrsForAhu(open: AhuMatch): Record<string, string> {
  const attrs: Record<string, string> = {};
  const arg = open.arg;
  if (arg.startsWith("#"))           attrs["slot"] = arg;
  else if (arg.startsWith("lar:"))   attrs["uri"]  = arg;
  else                               attrs["raw"]  = arg;
  if (open.modifier === "kahea")     attrs["invocation"] = "true";
  if (open.modifier === "aka")       attrs["projection"] = "true";
  return attrs;
}

export function attrToTree(attrs: Record<string, string>): Record<string, { type: "string"; value: string }> {
  const out: Record<string, { type: "string"; value: string }> = {};
  for (const [k, v] of Object.entries(attrs)) out[k] = { type: "string", value: v };
  return out;
}

/**
 * Merge BLOCK_CLOSERS with any grammar-registered block sigils that have a
 * `closePattern`. Callers call this at the top of findNextMatch (memoized
 * grammar — zero cost after first call) and use the result instead of the
 * static BLOCK_CLOSERS map.
 */
export function buildClosers(grammar: GrammarRules | null): Record<string, string> {
  if (!grammar) return BLOCK_CLOSERS;
  const extra: Record<string, string> = {};
  for (const sigil of grammar.sigils) {
    if (sigil.closePattern && !(sigil.name in BLOCK_CLOSERS)) {
      extra[sigil.name] = sigil.closePattern;
    }
  }
  return Object.keys(extra).length === 0 ? BLOCK_CLOSERS : { ...BLOCK_CLOSERS, ...extra };
}

/**
 * Returns the set of inline/edge sigil names registered in the grammar that
 * are NOT already handled by the hardcoded URI_FORM_SIGIL_RE (aka/kahea/loulou).
 * Used by lar-sigil-inline to emit proper widget nodes for operator-added sigils.
 */
const URI_FORM_HARDCODED = new Set(["aka", "kahea", "loulou"]);

export function grammarInlineSigils(grammar: GrammarRules | null): Set<string> {
  if (!grammar) return new Set();
  const out = new Set<string>();
  for (const sigil of grammar.sigils) {
    if (
      (sigil.kind === "edge" || sigil.kind === "edge-sugar" || sigil.kind === "edge-alias") &&
      sigil.inlinePattern &&
      !URI_FORM_HARDCODED.has(sigil.name)
    ) {
      out.add(sigil.name);
    }
  }
  return out;
}
