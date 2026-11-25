/*\
title: lar:///ha.ka.ba/lararium/tw5/relink/relink-sigil
type: application/javascript
module-type: relinkwikitextrule
\*/
/**
 * relink-sigil — the house's red ink under Relink's own handler API. Relink's wikitext walker extends each registered wikirule
 * class with the `relinkwikitextrule` module of the same name, so this module hands the house's sigil and declaration rules
 * (`lar-sigil`, `lar-declaration`) a `report` and a `relink`: a named value holding a `lar:///` local URI that names the moved
 * record (or a slot of it) follows the rename, through the pure law in `relink-sigil-core`.
 *
 * ── THE BODY WALKS AS WIKITEXT ───────────────────────────────────────────────────────────────────────
 * A container pair (`<<~ ahu …>> … <<~/ahu>>`, a pranala block, `<<fragment …>>`) carries wikitext in its body, so the walk
 * rewrites the OPENER alone and hands the walker back the position just past it: the body's `[[…]]`, `{{…}}` and sigils meet
 * Relink's own rules and this one in turn. A literal pair (a generic sigil with a closer) and a `hana`/`task` body (a foreign
 * grammar) take the whole span: their bodies render as text, never as links.
 *
 * ── INERT WITHOUT RELINK ─────────────────────────────────────────────────────────────────────────────
 * Only Relink reads the `relinkwikitextrule` module type, so where the offering stands absent nothing loads this module and it
 * changes nothing. It requires nothing of Relink itself. Its exports stay these three, since Relink copies every export onto the
 * rule's prototype.
 *
 * Meme: lar:///ha.ka.ba/lararium/tw5/heleuma/relink
 */
import { relinkSigilOpener, sigilReferences } from "../relink-sigil-core.js";
import { sigilOpenEnd } from "../wikirules/lar-sigil-shared.js";

interface WalkedRule {
  parser: { source: string; pos: number };
  matchPos?: number;
  matchEnd?: number;
  attrs?: Record<string, string>;
}

/** A pair whose body renders as wikitext: its body walks on after the opener. */
function bodyWalks(attrs: Record<string, string> | undefined): boolean {
  if (!attrs) return false;
  if ("__pranala_block__" in attrs) return true;
  const head = attrs["__compound__"];
  return head !== undefined && head !== "hana" && head !== "task";
}

/** Where the opener ends and where the walker resumes. */
function spanOf(rule: WalkedRule): { start: number; openEnd: number; resume: number } {
  const source = rule.parser.source;
  const start = rule.matchPos ?? rule.parser.pos;
  const matchEnd = rule.matchEnd ?? source.length;
  const close = sigilOpenEnd(source, start);
  const openEnd = close > start && close <= matchEnd ? close : matchEnd;
  return { start, openEnd, resume: bodyWalks(rule.attrs) ? openEnd : matchEnd };
}

export const name = ["lar-sigil", "lar-declaration"];

/**
 * ONE OPENER NEVER ABORTS THE WALK. Relink walks a whole record in one pass, so a throw here would stop every other reference
 * in it from relinking. An opener the reading cannot take answers `impossible` (Relink names it among its failures) and the
 * walker resumes past its match.
 */
function skipPast(rule: WalkedRule): void {
  if (typeof rule.matchEnd === "number") rule.parser.pos = rule.matchEnd;
}

export function report(this: WalkedRule, _text: string, callback: (title: string, blurb: string) => void): void {
  let refs: Array<{ title: string; blurb: string }>;
  try {
    const { start, openEnd, resume } = spanOf(this);
    const opener = this.parser.source.slice(start, openEnd);
    this.parser.pos = resume;
    const head = /^<<[~^!]?\s*([^\s>]*)/.exec(opener)?.[1] ?? "";
    refs = sigilReferences(opener).map((ref) => ({ title: ref.title, blurb: `<<${head} ${ref.name}>>` }));
  } catch {
    skipPast(this);
    return;
  }
  for (const ref of refs) callback(ref.title, ref.blurb);
}

export function relink(this: WalkedRule, _text: string, fromTitle: string, toTitle: string): { output?: string; impossible?: true } | undefined {
  try {
    const { start, openEnd, resume } = spanOf(this);
    const source = this.parser.source;
    this.parser.pos = resume;
    const entry = relinkSigilOpener(source.slice(start, openEnd), fromTitle, toTitle);
    if (!entry || entry.output === undefined) return entry;
    return { output: entry.output + source.slice(openEnd, resume) };
  } catch {
    skipPast(this);
    return { impossible: true };
  }
}
