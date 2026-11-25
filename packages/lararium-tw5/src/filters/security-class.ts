/*\
title: lar:///ha.ka.ba/lararium/tw5/filters/security-class
type: application/javascript
module-type: filteroperator
\*/
/**
 * security-class — WHICH OF A DIFF'S PATHS THE SECURITY CLASS NAMES, from inside a filter.
 *
 *   [[<path>]] [[<path>]] +[security-class[<encodeURIComponent of the list's JSON>]]
 *
 * The class (`tools/security-class-paths.json`, read from develop's tree, never the lane's): a path matching a glob in `paths`,
 * or holding a `tokens` word anywhere (case-folded), takes a cold read before the familiar's merge lands. The source titles
 * ride in as the diff's paths; the operand carries the list's JSON, percent-encoded so its brackets never close the operand.
 * The operator yields the matched paths in source order and decides nothing else. A malformed list THROWS (an empty answer
 * would read as a clean diff).
 *
 * TWO CALLERS, ONE MATCHER. A wiki page renders the class through the filter operator. The landing judge
 * (`tools/cold-read-owed.mjs`) loads this module's source out of develop's git objects and calls `readSecurityClass` and
 * `securityClassPaths` in a child node, through no daemon and no door: it relies on those two export names and on this file
 * importing types alone, so the stripped source loads on its own.
 *
 * Globs: `**` crosses `/` (a leading `**` and its slash match nothing too, so `**` + `/package.json` holds the root file),
 * `*` stops at `/`, `?` holds one non-`/` char; every other char stands for itself. A wildcard holds a newline like any other
 * char (git lets a path carry one), so no line break walks a path out of its glob.
 */
import type { TW5FilterOperator, TW5FilterSource } from "../types/tiddlywiki.js";

export interface SecurityClassList { paths: string[]; tokens: string[] }

/** One glob as an anchored RegExp (see the module note for the three wildcards). */
export function globToRegExp(glob: string): RegExp {
  let out = "";
  for (let i = 0; i < glob.length; i++) {
    const c = glob.charAt(i);
    if (c === "*" && glob[i + 1] === "*") {
      if (glob[i + 2] === "/") { out += "(?:[\\s\\S]*/)?"; i += 2; } else { out += "[\\s\\S]*"; i += 1; }
    } else if (c === "*") out += "[^/]*";
    else if (c === "?") out += "[^/]";
    else out += c.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^${out}$`);
}

/** The list's own shape, or a throw naming what stands wrong. */
export function readSecurityClass(raw: unknown): SecurityClassList {
  const o = raw as { paths?: unknown; tokens?: unknown } | null;
  const words = (v: unknown, name: string): string[] => {
    if (!Array.isArray(v) || v.some((s) => typeof s !== "string" || s === "")) throw new Error(`security-class: the list's \`${name}\` holds an array of non-empty strings and nothing else`);
    return v as string[];
  };
  if (!o || typeof o !== "object") throw new Error("security-class: the list answers as a JSON object holding `paths` and `tokens`");
  return { paths: words(o.paths, "paths"), tokens: words(o.tokens, "tokens") };
}

/** The paths the class names, in the order given, each once. */
export function securityClassPaths(paths: readonly string[], list: SecurityClassList): string[] {
  const globs = list.paths.map(globToRegExp);
  const tokens = list.tokens.map((t) => t.toLowerCase());
  const seen = new Set<string>();
  const hit: string[] = [];
  for (const p of paths) {
    if (seen.has(p)) continue;
    seen.add(p);
    const folded = p.toLowerCase();
    if (globs.some((g) => g.test(p)) || tokens.some((t) => folded.includes(t))) hit.push(p);
  }
  return hit;
}

export function securityClass(source: TW5FilterSource, operator: TW5FilterOperator): string[] {
  let list: SecurityClassList;
  try { list = readSecurityClass(JSON.parse(decodeURIComponent(operator.operand || ""))); }
  catch (e) { throw new Error(e instanceof Error && e.message.startsWith("security-class:") ? e.message : "security-class: the operand carries the percent-encoded JSON of the list, and this one would not decode"); }
  const titles: string[] = [];
  source((_tiddler, title: string) => { titles.push(title); });
  return securityClassPaths(titles, list);
}

export { securityClass as "security-class" };
