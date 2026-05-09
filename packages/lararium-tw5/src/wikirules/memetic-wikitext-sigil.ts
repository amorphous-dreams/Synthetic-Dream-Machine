/**
 * memetic-wikitext-sigil — TW5 wikirule for `<<~ ... >>` syntax.
 *
 * Recognizes the memetic-wikitext sigil syntax as first-class TW5 grammar.
 * Once registered onto WikiParser.prototype.{block,inline}RuleClasses, the
 * `<<~` sigil opener works in any wikitext context — `text/vnd.tiddlywiki`
 * tiddlers, browser-side authoring, embedded transclusions — without
 * requiring `text/x-memetic-wikitext` typing.
 *
 * Two match modes:
 *   - Block:  `<<~ ahu #slot >>body...<<~/ahu >>` — definition with body.
 *             Emits {type:"ahu", attributes:{slot, body-text}, children:[]}.
 *   - Inline: `<<~ ahu #slot >>` (no closing tag) — invocation reference.
 *             Emits {type:"ahu", attributes:{slot, invocation:"true"},
 *             children:[]}.
 *
 * This rewrite scope ships ahu only. Other sigils (aka, kahea, kau, lele,
 * papalohe, pranala, pae) follow the same shape — add their match patterns
 * here in a follow-up sprint. The grammar dispatch table below is the
 * extension point.
 *
 * Registration:
 *   `registerLarSigilWikirule(tw)` mutates WikiParser.prototype's
 *   block/inline rule class dictionaries. Idempotent — safe to call across
 *   multiple TW5Engine boots in the same process.
 *
 * Architectural law (operator's directive):
 *   Single grammar, multiple call sites. Disk sync, CRDT inbound, TW5 UX
 *   save, and disk export all consume the same parse output. This rule
 *   provides the parse for in-wiki contexts; @lararium/core/meme-ast
 *   `parseMemeText` provides the parse for full-meme contexts (file or
 *   bag record). Both produce the same AhuNode shape.
 */

interface ParseTreeNode {
  readonly type:        string;
  readonly attributes?: Record<string, { type: "string"; value: string }>;
  readonly children?:   ParseTreeNode[];
  readonly text?:       string;
}

interface WikiParser {
  source: string;
  pos:    number;
}

interface RuleInstance {
  parser:    WikiParser | null;
  matchPos?: number;
  matchEnd?: number;
  attrs?:    Record<string, string>;
}

/**
 * Match an opening sigil at the given position.
 * Returns parsed pieces, or null if no match.
 */
interface SigilOpenMatch {
  readonly start:    number;
  readonly end:      number;            // position just past `>>`
  readonly sigil:    string;            // canonical sigil keyword (e.g., "ahu")
  readonly modifier: string | null;     // "kahea", "aka", or null
  readonly arg:      string;            // raw arg ("#thesis", "lar:///...", etc.)
}

const SIGIL_OPEN_RE =
  /<<~\s+(?:(kahea|aka)\s+)?(ahu)\s+([^>]+?)\s*>>/g;

const SIGIL_CLOSE_RE = /<<~\/(ahu)\s*>>/g;

function matchSigilOpenAt(source: string, start: number): SigilOpenMatch | null {
  SIGIL_OPEN_RE.lastIndex = start;
  const m = SIGIL_OPEN_RE.exec(source);
  if (!m || m.index !== start) return null;
  const [, modifier, sigil, arg] = m;
  return {
    start:    m.index,
    end:      SIGIL_OPEN_RE.lastIndex,
    sigil:    sigil!,
    modifier: modifier ?? null,
    arg:      arg!.trim(),
  };
}

function findSigilClose(source: string, sigil: string, fromPos: number): number | null {
  // Manual seek (avoid regex /g state interactions).
  const tag = `<<~/${sigil}`;
  const idx = source.indexOf(tag, fromPos);
  if (idx === -1) return null;
  const closingEnd = source.indexOf(">>", idx + tag.length);
  if (closingEnd === -1) return null;
  return closingEnd + 2;
}

/**
 * Convert an open match's arg into TW5 attributes for the parse tree node.
 * Slot args start with `#`; URI args start with `lar:`.
 */
function attrsForMatch(open: SigilOpenMatch): Record<string, string> {
  const attrs: Record<string, string> = {};
  const arg = open.arg;
  if (arg.startsWith("#")) {
    attrs["slot"] = arg;
  } else if (arg.startsWith("lar:")) {
    attrs["uri"] = arg;
  } else {
    // Unknown arg shape — preserve as raw so the widget can decide.
    attrs["raw"] = arg;
  }
  if (open.modifier === "kahea") attrs["invocation"] = "true";
  if (open.modifier === "aka")   attrs["projection"] = "true";
  return attrs;
}

function attrToTree(attrs: Record<string, string>): Record<string, { type: "string"; value: string }> {
  const out: Record<string, { type: "string"; value: string }> = {};
  for (const [k, v] of Object.entries(attrs)) {
    out[k] = { type: "string", value: v };
  }
  return out;
}

// ---------------------------------------------------------------------------
// Rule modules — block + inline shape per TW5 wikirule contract
// ---------------------------------------------------------------------------

const BLOCK_RULE = {
  name:  "lar-sigil-block",
  types: { block: true },

  init(this: RuleInstance, parser: WikiParser): void {
    this.parser = parser;
  },

  findNextMatch(this: RuleInstance, startPos: number): number | undefined {
    const source = this.parser!.source;
    let pos = source.indexOf("<<~", startPos);
    while (pos >= 0) {
      const open = matchSigilOpenAt(source, pos);
      if (open) {
        // For a block match, require a closing tag.
        const closeEnd = findSigilClose(source, open.sigil, open.end);
        if (closeEnd !== null) {
          this.matchPos = pos;
          this.matchEnd = closeEnd;
          this.attrs = attrsForMatch(open);
          // Stash body text between open.end and closeEnd's `<<~/sigil >>`.
          const closeTagStart = source.lastIndexOf(`<<~/${open.sigil}`, closeEnd);
          this.attrs["__body__"] = source.slice(open.end, closeTagStart);
          return pos;
        }
      }
      pos = source.indexOf("<<~", pos + 3);
    }
    return undefined;
  },

  parse(this: RuleInstance): ParseTreeNode[] {
    const parser = this.parser!;
    parser.pos = this.matchEnd!;
    const attrs = { ...(this.attrs ?? {}) };
    const body  = attrs["__body__"] ?? "";
    delete attrs["__body__"];
    return [{
      type:       "ahu",
      attributes: attrToTree(attrs),
      // Body text is informational only — the slot child tiddler is the
      // authoritative source. Embed as a literal-text child so the parse
      // tree retains it for inspection / diff tooling without driving
      // render behaviour.
      children:   body ? [{ type: "text", text: body }] : [],
    }];
  },
};

const INLINE_RULE = {
  name:  "lar-sigil-inline",
  types: { inline: true },

  init(this: RuleInstance, parser: WikiParser): void {
    this.parser = parser;
  },

  findNextMatch(this: RuleInstance, startPos: number): number | undefined {
    const source = this.parser!.source;
    let pos = source.indexOf("<<~", startPos);
    while (pos >= 0) {
      const open = matchSigilOpenAt(source, pos);
      if (open) {
        // Inline rule fires for sigil opens that have NO closing tag
        // ahead — invocation form. If a closing tag exists nearby, the
        // block rule claims it; we leave that match alone here.
        const closeEnd = findSigilClose(source, open.sigil, open.end);
        if (closeEnd === null) {
          this.matchPos = pos;
          this.matchEnd = open.end;
          this.attrs = attrsForMatch(open);
          this.attrs["invocation"] = "true";
          return pos;
        }
      }
      pos = source.indexOf("<<~", pos + 3);
    }
    return undefined;
  },

  parse(this: RuleInstance): ParseTreeNode[] {
    const parser = this.parser!;
    parser.pos = this.matchEnd!;
    return [{
      type:       "ahu",
      attributes: attrToTree(this.attrs ?? {}),
      children:   [],
    }];
  },
};

// ---------------------------------------------------------------------------
// Registration — mutate WikiParser.prototype.{block,inline}RuleClasses
// ---------------------------------------------------------------------------

interface WikiRuleBaseCtor {
  new (parser: WikiParser): RuleInstance;
  prototype: object;
}

interface TW5Modules {
  types?: Record<string, Record<string, { exports?: unknown }>>;
  define?: (text: string, type: string, name: string) => void;
}

interface TW5Like {
  WikiRuleBase?: WikiRuleBaseCtor;
  modules?:     TW5Modules;
  Wiki?:        { parsers?: Record<string, unknown> };
}

interface WikiParserCtor {
  prototype: {
    blockRuleClasses?:  Record<string, WikiRuleBaseCtor>;
    inlineRuleClasses?: Record<string, WikiRuleBaseCtor>;
  };
}

/**
 * Wrap a rule module ({name, types, init, findNextMatch, parse}) into a
 * WikiRuleBase-extending constructor that TW5's WikiParser instantiates.
 */
function buildRuleClass(
  base:     WikiRuleBaseCtor,
  ruleSpec: Record<string, unknown>,
): WikiRuleBaseCtor {
  const Ctor = function (this: RuleInstance, parser: WikiParser) {
    this.parser = parser;
  } as unknown as WikiRuleBaseCtor;
  Object.setPrototypeOf(Ctor.prototype, base.prototype);
  Object.assign(Ctor.prototype, ruleSpec);
  return Ctor;
}

/**
 * Register the lar-sigil wikirules onto the active TW5 instance.
 * Idempotent — re-registration replaces prior class entries.
 */
export function registerLarSigilWikirule(tw: TW5Like): void {
  if (!tw.WikiRuleBase) return;
  const parsers = tw.Wiki?.parsers as Record<string, unknown> | undefined;
  // Look up the wikitext parser class to find its prototype's rule maps.
  const wikiTextParser = parsers?.["text/vnd.tiddlywiki"] as WikiParserCtor | undefined;
  if (!wikiTextParser?.prototype) return;

  wikiTextParser.prototype.blockRuleClasses ??= {};
  wikiTextParser.prototype.inlineRuleClasses ??= {};

  wikiTextParser.prototype.blockRuleClasses["lar-sigil-block"] =
    buildRuleClass(tw.WikiRuleBase, BLOCK_RULE);
  wikiTextParser.prototype.inlineRuleClasses["lar-sigil-inline"] =
    buildRuleClass(tw.WikiRuleBase, INLINE_RULE);
}
