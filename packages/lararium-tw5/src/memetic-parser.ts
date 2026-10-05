/*\
title: lar:///ha.ka.ba/lararium/tw5/parsers/memetic-parser
type: application/javascript
module-type: parser
\*/
/**
 * memetic-parser — WikiParser subclass for `text/memetic-wikitext+tiddlywiki`.
 *
 * Inherits the standard wikitext parser, but filters the rule CLASS maps
 * before `instantiateRules` runs rather than filtering rule instances
 * after the parse. TiddlyWiki5's WikiParser constructor instantiates the
 * pragma/block/inline rules AND runs `parsePragmas`/`parseBlocks` inside
 * itself (core/modules/parsers/wikiparser/wikiparser.js:79-90), so a
 * post-construction filter acts on an already-finished parse: too late to
 * stop a denied rule from firing even once. Overriding `instantiateRules`
 * to hand the standard constructor a filtered COPY of the class map
 * — never the shared `WikiParser.prototype.*RuleClasses` maps every
 * `text/vnd.tiddlywiki` parse also reads — runs before any matching or
 * parsing happens, so a denied rule never instantiates and never has a
 * chance to match. Per Jermolene (TW5 GH discussion #6712):
 *
 *   "The `\rules` pragma scope does not propagate through `<$transclude>`.
 *    Transcluded content reparses under its own type's full ruleset."
 *
 * Pragma injection (`\rules except codeblock dash …`) only affects the
 * outer parse — when a meme template transcludes the parent's text via
 * `{{!!text}}`, the inner content reparses fresh, the pragma evaporates,
 * and the offending rules fire. Filtering rule classes at construction
 * is the only mechanism that scopes per-type: it propagates because every
 * memetic-typed tiddler instantiates THIS parser, transclude or not.
 *
 * Deny list is empty — lar-sigil (block+inline) claims all
 * <<~ …>> forms; standard TW5 macro rules fire normally for <<macroname>>.
 *
 * Operator override: writing a space-separated rule-name list to
 * `lar:///ha.ka.ba/config/memetic-rules-except` replaces the default deny list.
 *
 * Schema: lar:///ha.ka.ba/lares/api/lararium/schema/memetic-parser
 */

import type { MemeDiagnostic as ParseDiagnostic } from "./meme-ast/diagnostics.js";
import type { ParseFailure as ParseFailureLike } from "./meme-ast/types.js";

const RULES_CONFIG_TIDDLER = "lar:///ha.ka.ba/config/memetic-rules-except";

import { CARRIER_TYPE as MEMETIC_TYPE } from "@lararium/mesh/carrier-type";

const DEFAULT_RULES_EXCEPT: ReadonlySet<string> = new Set<string>();

interface ParserCtor {
  (this: object, type: string, text: string, options: unknown): void;
  prototype: ParserPrototype;
  call(thisArg: object, type: string, text: string, options: unknown): void;
}

type RuleClassMap = Record<string, unknown>;

interface ParserInstance {
  memeticDenyList?: ReadonlySet<string>;
  diagnostics?: ParseDiagnostic[];
}

interface ParserPrototype {
  pragmaRuleClasses?:  RuleClassMap;
  blockRuleClasses?:   RuleClassMap;
  inlineRuleClasses?:  RuleClassMap;
  instantiateRules: (this: ParserInstance, classes: RuleClassMap, type: string, startPos: number) => unknown;
}

interface WikiLike {
  getTiddlerText?: (title: string, fallback?: string) => string;
}

/**
 * MemeticParser — WikiParser subclass for `text/memetic-wikitext+tiddlywiki`.
 *
 * Module-type: parser. TW5's standard plugin loader registers parsers via
 * `$tw.Wiki.parsers[contentType] = exports[contentType]`, iterating the
 * exports object's keys. The arbitrary-module-namespace-identifier export
 * (`export { MemeticParser as "text/memetic-wikitext+tiddlywiki" }`) compiles to
 * `exports["text/memetic-wikitext+tiddlywiki"] = MemeticParser` in CJS — the shape
 * TW5's loader expects.
 *
 * The standard wikitext parser is `require`d at module-load time. Vite
 * externalizes `$:/` paths so the require survives the bundle — TW5's
 * runtime resolves it.
 */
interface TwLike {
  utils?: {
    makeParseDiagnostic?: (
      diagnostic: unknown,
      options: { source: string; sourceLength: number },
    ) => unknown;
  };
}

declare const $tw: TwLike | undefined;
declare const require: (id: string) => Record<string, ParserCtor>;
const stdParserModule = require("$:/core/modules/parsers/wikiparser/wikiparser.js");
const stdParser: ParserCtor = stdParserModule["text/vnd.tiddlywiki"]!;

/**
 * The meme-ast library grades its own recoveries onto the severity ladder the core contract
 * closes over, so the parser reads that one ladder rather than keeping a second copy of it.
 * `$tw.utils.makeParseDiagnostic` then clamps each span to the source.
 */
interface MemeAstLibrary {
  parseMemeText?: (uri: string, text: string, grammar?: unknown) => { failures?: readonly ParseFailureLike[] };
  failuresToDiagnostics?: (
    failures: readonly ParseFailureLike[],
    sourceLength: number,
    source?: string,
  ) => ParseDiagnostic[];
}

function diagnosticsFrom(uri: string, text: string): ParseDiagnostic[] {
  const memeAst = require("lar:///ha.ka.ba/lararium/tw5/modules/meme-ast") as unknown as MemeAstLibrary;
  const grammarCache = require("lar:///ha.ka.ba/lararium/tw5/modules/grammar-cache") as unknown as {
    getGrammar?: () => unknown;
  };
  if (typeof memeAst?.parseMemeText !== "function" || typeof memeAst?.failuresToDiagnostics !== "function") {
    return [];
  }
  const failures = memeAst.parseMemeText(uri, text, grammarCache?.getGrammar?.() ?? undefined)?.failures ?? [];
  const diagnostics = memeAst.failuresToDiagnostics(failures, text.length);
  const make = $tw?.utils?.makeParseDiagnostic;
  if (!make) {
    return diagnostics;
  }
  return diagnostics.map((d) => make(d, { source: MEMETIC_TYPE, sourceLength: text.length }) as ParseDiagnostic);
}

function MemeticParser(this: ParserInstance, type: string, text: string, options: unknown): void {
  const wiki = (options as { wiki?: WikiLike } | undefined)?.wiki;
  const override = wiki?.getTiddlerText?.(RULES_CONFIG_TIDDLER, "")?.trim() ?? "";
  const denyList = override.length > 0
    ? new Set(override.split(/\s+/).filter(Boolean))
    : DEFAULT_RULES_EXCEPT;
  // Non-enumerable: a sibling that iterates over `this` (e.g. a tiddler-field mapper) should never see it.
  Object.defineProperty(this, "memeticDenyList", { value: denyList, enumerable: false, configurable: true });

  stdParser.call(this as object, type, text, options);

  // The superset law: the standard parser recovered first and left its receipts here, so the sigil
  // recoveries append to them rather than overwriting them. A memetic carrier therefore reports an
  // unclosed emphasis delimiter and an unplaceable sigil on one channel, graded on one ladder.
  const uri = (options as { _canonical_uri?: string } | undefined)?._canonical_uri ?? type;
  const inherited = this.diagnostics ?? [];
  try {
    this.diagnostics = [...inherited, ...diagnosticsFrom(uri, text ?? "")];
  } catch {
    this.diagnostics = inherited;
  }
}
MemeticParser.prototype = Object.create(stdParser.prototype as object) as ParserPrototype;

/**
 * Hand the standard constructor a filtered COPY of the rule-class map, never the shared
 * `WikiParser.prototype.*RuleClasses` map every `text/vnd.tiddlywiki` parse also reads. This runs
 * inside `stdParser.call` above, before any rule instantiates or matches, so a denied class never
 * gets the chance to fire — and it covers every later `instantiateRules` call on this same instance.
 */
MemeticParser.prototype.instantiateRules = function (
  this: ParserInstance,
  classes: RuleClassMap,
  type: string,
  startPos: number,
): unknown {
  const denyList = this.memeticDenyList;
  const filtered: RuleClassMap = denyList && denyList.size > 0
    ? Object.fromEntries(Object.entries(classes).filter(([name]) => !denyList.has(name)))
    : classes;
  return (stdParser.prototype as ParserPrototype).instantiateRules.call(this, filtered, type, startPos);
};

// BOTH SPELLINGS EXPORT THE SAME PARSER. TW5 keys parser modules by type string, so a carrier stored
// under the unsuffixed name needs its own export or it silently falls through to the wikitext parser.
export { MemeticParser as "text/memetic-wikitext+tiddlywiki" };
