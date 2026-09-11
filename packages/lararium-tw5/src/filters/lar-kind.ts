/*\
title: lar:///ha.ka.ba/lararium/tw5/filters/lar-kind
type: application/javascript
module-type: filteroperator
\*/
/**
 * lar-kind — the KIND of a raw tiddler, in one word, read the way TiddlyWiki reads it.
 *
 * ── ONE WORD, BOTH DOORS ────────────────────────────────────────────────────────────────────────
 * The recipe stack routes a tiddler by its kind (recipe-layer-model#/as-routed). A stock
 * `tiddlywiki --listen` carrying this plugin and a lararium island MUST answer the same word for the
 * same tiddler, so every predicate here is TiddlyWiki's own — `isVolatileTiddler`,
 * `isTemporaryTiddler`, `Tiddler.isDraft`, `isSystemTiddler` — and the one set the core does not name
 * (the per-person view state) stands here ONCE, so the cascade and the operator read a single spelling.
 *
 * `[lar-kind[]]` emits, per input title, exactly one of:
 *
 *   volatile   `$:/temp/volatile/…`            never leaves the process
 *   temporary  `$:/temp/…`                     lives for the session
 *   draft      the `draft.of` FIELD stands     — the operator's ruling: the field is the switch
 *   personal   view state that follows a person across devices (`$:/StoryList`, folded, tabs, palette)
 *   system     any other `$:/` title
 *   content    everything else
 *
 * ── THE FIELD DECIDES DRAFT-NESS, NEVER THE TITLE ───────────────────────────────────────────────
 * TiddlyWiki mints a draft's title through a LOCALIZED string (`Draft/Title`, or `Draft/Attribution`
 * when `$:/status/UserName` stands — `Draft of 'X' by Alice`), so an English prefix names a draft on
 * one wiki and a plain tiddler on another. `Tiddler.isDraft` reads `hasField("draft.of")`, and so does
 * this: a tiddler literally titled `Draft of Beer` with no `draft.of` field reads `content`.
 *
 * A title whose tiddler is absent reads by its title alone — the only reads the title can carry.
 */
import type { TW5FilterOperator, TW5FilterSource, TW5Wiki } from "../types/tiddlywiki.js";

export type TiddlerKind = "volatile" | "temporary" | "draft" | "personal" | "system" | "content";

/**
 * The view-state titles that follow a person rather than a device or a wiki. TiddlyWiki names no
 * predicate for this set; the house names it here and the bag-paths cascade reads it through this
 * operator, so the set has one spelling.
 */
export const PERSONAL_TITLE_PREFIXES: readonly string[] = [
  "$:/StoryList",
  "$:/state/folded/",
  "$:/state/tab-",
  "$:/palette",
];

export function isPersonalTitle(title: string): boolean {
  return PERSONAL_TITLE_PREFIXES.some((p) => title.startsWith(p));
}

/** The kind of one tiddler, reading TiddlyWiki's own predicates in their order of specificity. */
export function kindOf(wiki: TW5Wiki, title: string, tiddler: { isDraft?(): boolean } | undefined): TiddlerKind {
  if (wiki.isVolatileTiddler(title))  return "volatile";
  if (wiki.isTemporaryTiddler(title)) return "temporary";
  if (tiddler?.isDraft?.() === true)  return "draft";
  if (isPersonalTitle(title))         return "personal";
  if (wiki.isSystemTiddler(title))    return "system";
  return "content";
}

export function larKind(
  source:    TW5FilterSource,
  _operator: TW5FilterOperator,
  options:   { wiki: TW5Wiki },
): string[] {
  const results: string[] = [];
  source(function (tiddler, title: string) {
    results.push(kindOf(options.wiki, title, tiddler));
  });
  return results;
}

// The operator's name is its EXPORTED name (lar-uri states the law); a hyphen needs the string form.
export { larKind as "lar-kind" };
