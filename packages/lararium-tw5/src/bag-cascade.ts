/**
 * bag-cascade — the ONE walk of the in-wiki bag-paths cascade.
 *
 * The cascade tiddler holds newline-separated filter expressions, each evaluated against a
 * single-tiddler source; the first rule with a non-empty result decides. It mirrors TW5's
 * `$:/config/FileSystemPaths` walk, and takes TW5's `$:/config/SyncFilter` shape too: a total
 * catch-all at the end and NAMED exclusions up front.
 *
 * ⚠ THE THREE VERDICTS ARE NOT ONE. A rule may ROUTE a title to a slot, a rule may WITHHOLD it (the
 * empty-operand form, `[match[$:/core]then[]]`, lawful only from a rule that names its subject), or no
 * rule may reach it at all — a ROUTER GAP, a fault in the cascade rather than a decision about the
 * title. The walk reports which happened; each caller acts on the three in its own way (the island
 * adaptor fills a gap at the write layer so a save never vanishes; the backstop reads anything but a
 * slot as a bag this hearth does not keep).
 *
 * Imports nothing, so it rides inlined into any plugin module that reads it.
 */

/** The cascade config tiddler — newline-separated filter expressions; first non-empty result wins. */
export const BAG_PATHS_CONFIG = "lar:///ha.ka.ba/lararium/config/bag-paths";

/** What the cascade did with a title. A withholding and a gap both stop a write and mean opposite things. */
export type RouteVerdict =
  | { readonly kind: "slot";     readonly uri:  string }
  | { readonly kind: "withheld"; readonly rule: string }
  | { readonly kind: "gap";      readonly why:  string };

/** The wiki surface the walk reads. The cascade read is optional: a bare change bus carries none. */
export interface CascadeWiki {
  getTiddler(title: string): unknown;
  getTiddlerText?(title: string, fallback?: string): string | undefined;
  filterTiddlers?(filter: string, widget?: unknown, source?: unknown): string[];
}

/** Walk the cascade for `title` and report the verdict of the first rule that answers. */
export function routeBag(wiki: CascadeWiki, title: string): RouteVerdict {
  if (typeof wiki.getTiddlerText !== "function" || typeof wiki.filterTiddlers !== "function") {
    return { kind: "gap", why: "the wiki exposes no filter engine" };
  }
  const config = wiki.getTiddlerText(BAG_PATHS_CONFIG, "");
  if (!config) return { kind: "gap", why: `no cascade at ${BAG_PATHS_CONFIG}` };
  const filters = config.split("\n").map((s) => s.trim()).filter((s) => s.length > 0);
  // Single-tiddler iterator — equivalent to TW5's wiki.makeTiddlerIterator([title]).
  const source = (fn: (t: unknown, ti: string) => void): void => fn(wiki.getTiddler(title), title);
  for (const filter of filters) {
    const result = wiki.filterTiddlers(filter, undefined, source);
    if (result.length === 0) continue;
    const first = result[0] ?? "";
    return first === "" ? { kind: "withheld", rule: filter } : { kind: "slot", uri: first };
  }
  return { kind: "gap", why: "no rule reached this title — the cascade lost its catch-all" };
}
