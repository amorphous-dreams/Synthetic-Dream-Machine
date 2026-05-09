/**
 * memetic-parser — WikiParser subclass for `text/x-memetic-wikitext`.
 *
 * Inherits the standard wikitext parser, then filters its rule arrays in
 * the constructor so the rules that mangle round-trip never instantiate
 * for memetic-typed tiddlers. Per Jermolene (TW5 GH discussion #6712):
 *
 *   "The `\rules` pragma scope does not propagate through `<$transclude>`.
 *    Transcluded content reparses under its own type's full ruleset."
 *
 * Pragma injection (`\rules except codeblock dash …`) only affects the
 * outer parse — when a meme template transcludes the parent's text via
 * `{{!!text}}`, the inner content reparses fresh, the pragma evaporates,
 * and the offending rules fire. Rule-array filtering at parser
 * construction is the only mechanism that scopes per-type. The filter
 * propagates because every memetic-typed tiddler instantiates THIS
 * parser, transclude or not.
 *
 * What gets filtered (deny list):
 *   - codeblock / codeinline    — strip backtick fences (turn ``` into `).
 *   - commentblock / commentinline — strip `<!-- ... -->` (DOCTYPE, etc).
 *   - entity                    — expand `&#x0001;` carrier sentinels.
 *   - dash                      — convert `---` to em-dash.
 *   - macrocallinline / macrocallblock — claim `<<...>>` before the
 *     lar-sigil rules can match.
 *
 * Operator override: writing a space-separated rule-name list to
 * `$:/config/Lar/MemeticRulesExcept` replaces the default deny list.
 *
 * Schema: lar:///ha.ka.ba/@lares/api/v0.1/lararium/schema/memetic-parser
 */

const RULES_CONFIG_TIDDLER = "$:/config/Lar/MemeticRulesExcept";

const DEFAULT_RULES_EXCEPT: ReadonlySet<string> = new Set([
  "codeblock", "codeinline",
  "commentblock", "commentinline",
  "entity",
  "dash",
  "macrocallinline", "macrocallblock",
]);

interface ParserCtor {
  new (type: string, text: string, options: unknown): unknown;
}

interface RuleClass {
  prototype: { name?: string };
}

interface RuleInstance {
  name?: string;
}

interface ParserInstance {
  pragmaRules?: RuleInstance[];
  blockRules?:  RuleInstance[];
  inlineRules?: RuleInstance[];
}

interface ParserPrototype {
  pragmaRuleClasses?:  Record<string, RuleClass>;
  blockRuleClasses?:   Record<string, RuleClass>;
  inlineRuleClasses?:  Record<string, RuleClass>;
}

interface WikiLike {
  getTiddlerText?: (title: string, fallback?: string) => string;
}

/**
 * Build a parser class that subclasses the standard wikitext parser. After
 * the base constructor populates `pragmaRules` / `blockRules` / `inlineRules`,
 * filter out the offenders by `name`. The base lazy-instantiates rule
 * classes from the prototype's `*RuleClasses` maps; we drop instances after
 * the base constructor runs, leaving the maps untouched (other parsers see
 * full rule sets).
 */
export function makeMemeticParser(stdParser: ParserCtor): ParserCtor {
  function MemeticParser(this: ParserInstance, type: string, text: string, options: unknown): void {
    // Resolve the operator-override deny list from the wiki, falling back
    // to the default deny set. Set lookup is O(1) for the per-rule filter.
    const wiki = (options as { wiki?: WikiLike } | undefined)?.wiki;
    const override = wiki?.getTiddlerText?.(RULES_CONFIG_TIDDLER, "")?.trim() ?? "";
    const denyList = override.length > 0
      ? new Set(override.split(/\s+/).filter(Boolean))
      : DEFAULT_RULES_EXCEPT;

    // Run the base constructor — it instantiates all rule classes onto
    // `this.{pragma,block,inline}Rules`.
    stdParser.call(this, type, text, options);

    // Filter offending rule instances out of each list. The base parser's
    // findNextMatch loops over these arrays per parse pass; absent rules
    // never fire. Rule classes stay registered globally.
    if (Array.isArray(this.pragmaRules)) {
      this.pragmaRules = this.pragmaRules.filter((r) => !r.name || !denyList.has(r.name));
    }
    if (Array.isArray(this.blockRules)) {
      this.blockRules = this.blockRules.filter((r) => !r.name || !denyList.has(r.name));
    }
    if (Array.isArray(this.inlineRules)) {
      this.inlineRules = this.inlineRules.filter((r) => !r.name || !denyList.has(r.name));
    }
  }
  MemeticParser.prototype = Object.create(stdParser.prototype as object) as ParserPrototype;
  return MemeticParser as unknown as ParserCtor;
}
