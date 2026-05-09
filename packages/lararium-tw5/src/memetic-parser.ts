/**
 * memetic-parser — thin parser wrapper for `text/x-memetic-wikitext`.
 *
 * Prepends a `\rules only` pragma to the source so the standard WikiParser
 * runs with a curated rule set. Without this, rendering a memetic-wikitext
 * tiddler invokes the full wikitext rule pipeline — backticks become inline
 * code, triple-backticks become code fences, dashes become em-dashes,
 * `<!-- -->` comments get stripped, etc. — and round-trip identity breaks.
 *
 * The curated set lets sigil and transclusion rules fire while everything
 * else passes through verbatim:
 *   - `transcludeinline`     → `{{!!field}}` resolves
 *   - `lar-sigil-block`      → `<<~ ahu #slot >>...<<~/ahu >>` → AhuWidget
 *   - `lar-sigil-inline`     → every other `<<~ ... >>` → literal-survival
 *   - `lar-doctype-comment`  → `<!-- <<~ !DOCTYPE = ... >> -->` → literal
 *   - `macrodef`             → `\procedure ... \end` definitions
 *   - `transcludeblock`      → `<$transclude>` widget invocations
 *   - `prettyextlink`        → operator-authored markdown links survive
 *
 * Operators may extend the rule set per-wiki by editing
 * `$:/config/Lar/MemeticRules` (read at parser construction).
 *
 * Architecture note:
 *   This wrapper is NOT the prior MemeticParser class (330 lines of typed-
 *   widget node-emission boilerplate). That logic collapsed in E.10.5;
 *   sigil recognition lives entirely in the wikirule. The wrapper here
 *   only curates which TW5 rules fire — a one-line pragma prepend.
 *
 * Schema: lar:///ha.ka.ba/@lares/api/v0.1/lararium/schema/memetic-parser
 */

const RULES_CONFIG_TIDDLER = "$:/config/Lar/MemeticRulesExcept";

/**
 * Default rules to DISABLE for memetic-wikitext. Each entry would otherwise
 * mangle round-trip identity:
 *   - `codeblockinline` / `codeblockbacktick` — interpret triple-backtick
 *     toml fences as code-block elements; text/plain output strips fence.
 *   - `dash`                                  — converts `---` to `—`.
 *   - `htmlcomment`                           — strips `<!-- ... -->`,
 *     including DOCTYPE prologue.
 *   - `macrocallinline` / `macrocallblock`    — claims `<<...>>` as macro
 *     syntax before the lar-sigil rules can match.
 *   - `entity`                                — would expand `&#x0001;`
 *     control char in carrier sentinels at parse time.
 *
 * Operators may override by writing a space-separated rule-name list to
 * `$:/config/Lar/MemeticRulesExcept`.
 */
const DEFAULT_RULES_EXCEPT = [
  // Code-fence / inline-code rules — strip backticks in text/plain output.
  "codeblock",
  "codeinline",
  // HTML comment rules — strip `<!-- ... -->` lines (incl. DOCTYPE).
  "commentblock",
  "commentinline",
  // Entity rule — expands `&#x0001;` carrier sentinels at parse time.
  "entity",
  // Dash rule — converts `---` to em-dash.
  "dash",
  // Macrocall — claims `<<...>>` before lar-sigil rules can match.
  "macrocallinline",
  "macrocallblock",
] as const;

interface ParserCtor {
  new (type: string, text: string, options: unknown): unknown;
}

interface WikiLike {
  getTiddlerText?: (title: string, fallback?: string) => string;
}

/**
 * Build a parser class that wraps the standard wikitext parser with a
 * `\rules only` pragma prepended to the source. The base parser comes
 * from `tw.Wiki.parsers["text/vnd.tiddlywiki"]`.
 */
export function makeMemeticParser(stdParser: ParserCtor): ParserCtor {
  function MemeticParser(this: object, type: string, text: string, options: unknown): unknown {
    const wiki = (options as { wiki?: WikiLike } | undefined)?.wiki;
    const override = wiki?.getTiddlerText?.(RULES_CONFIG_TIDDLER, "")?.trim() ?? "";
    const rules = override.length > 0 ? override : DEFAULT_RULES_EXCEPT.join(" ");
    const wrapped = `\\rules except ${rules}\n${text ?? ""}`;
    return new stdParser(type, wrapped, options);
  }
  MemeticParser.prototype = stdParser.prototype;
  return MemeticParser as unknown as ParserCtor;
}
