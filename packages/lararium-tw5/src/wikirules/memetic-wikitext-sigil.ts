/**
 * memetic-wikitext-sigil — TW5 wikirule for `<<~ ... >>` syntax.
 *
 * Recognizes the memetic-wikitext sigil grammar as first-class TW5 wikitext.
 * Once registered onto WikiParser.prototype.{block,inline}RuleClasses, every
 * wikitext context — `text/vnd.tiddlywiki` tiddlers, browser-side authoring
 * drafts, embedded transclusions — recognizes `<<~` as the lar-sigil opener
 * without requiring `text/x-memetic-wikitext` typing or MemeticParser.
 *
 * Two emission categories share the same parser:
 *
 *   1. **Slot-bearing sigils** (today: `ahu`). Parse to a TW5 widget node
 *      (`{type: "ahu"}`). The widget owns no scope decision; cascade picks
 *      a template (cf. tw5-widgets.ts $:/tags/Lar/AhuTemplate).
 *
 *   2. **Literal-survival sigils** — every other `<<~ ... >>` shape:
 *      aka / kahea / loulou / pranala / pranala-header (`<<~ ? -> uri >>`)
 *      / carrier sentinels (SOH/STX/ETX) / DOCTYPE comments / pragmas.
 *      Parse to a `{type: "text"}` node carrying the raw source slice. The
 *      wikifier emits the text verbatim — round-trip preserved.
 *
 *   3. **DOCTYPE comments** (`<!-- <<~ !DOCTYPE = ... >> -->`). Same as (2)
 *      but the rule pre-empts TW5's built-in `htmlcomment` rule which would
 *      otherwise strip the comment in text/plain output. Block-form rule.
 *
 * HTML-side rendering for category-2 sigils will land widget-by-widget in
 * follow-up sprints (aka shadow transclusion, kahea live invocation,
 * loulou bidirectional edge, pranala explicit edge). The wikirule's
 * literal-survival path keeps disk round-trip working in the meantime.
 *
 * Schema: lar:///ha.ka.ba/@lares/api/v0.1/lararium/schema/memetic-wikitext-sigil
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
  /** For ahu blocks: parsed attributes. For literal-survival: { __literal__ }. */
  attrs?:    Record<string, string>;
}

// ---------------------------------------------------------------------------
// Pattern dispatch
// ---------------------------------------------------------------------------
//
// All sigils share the `<<~` opener and `>>` closer. The first significant
// token after the opener determines dispatch:
//
//   `<<~ ahu ...`     → slot-bearing widget; closing `<<~/ahu >>` required
//   `<<~ kahea X ...` → literal-survival inline (X may be a sigil keyword
//                       for child-slot summons, or a URI for live edge)
//   `<<~ aka ...`     → literal-survival inline (URI form or `aka X #slot`
//                       projection of a child-slot sigil)
//   `<<~ loulou ...`  → literal-survival inline (relation edge sugar)
//   `<<~ pranala ...` → literal-survival; block form has matching closer
//   `<<~ ? -> uri >>` → pranala-header (literal-survival inline)
//   `<<~&#x000N;...`  → carrier sentinel SOH/STX/ETX (literal-survival)
//   `<<~⊙&#x000N...`  → boot-phase carrier sentinel with phase glyph
//   `<<~! ...`        → pragma (\procedure, \function, \define, ...)
//   `<<~ wehe / helu / wai / mukuwai / kahawai / huli / hui / heihei / puka
//      / lele / meme / pae / kau / kumu / kukali / papalohe ...` →
//      literal-survival until ported to template-cascade per-sigil.
//
// The catch-all literal-survival branch absorbs everything that isn't ahu.
// Round-trip stays correct; HTML render for non-ahu lands per-sigil later.

const AHU_OPEN_RE   = /<<~\s+(?:(kahea|aka)\s+)?ahu\s+([^>]+?)\s*>>/g;
const ANY_OPEN_RE   = /<<~[^\n]*?>>/g;
const AHU_CLOSE_TAG = "<<~/ahu";
// Block sigils whose closing tag we recognize for body capture. The body
// text rides through the parse tree as literal source so the disk render
// preserves it; it's not used for widget rendering of non-ahu sigils today.
const BLOCK_CLOSERS: Record<string, string> = {
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

interface AhuMatch {
  readonly start:    number;
  readonly end:      number;
  readonly modifier: "kahea" | "aka" | null;
  readonly arg:      string;
}

function matchAhuOpenAt(source: string, start: number): AhuMatch | null {
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

function findCloseEnd(source: string, sigil: string, fromPos: number): number | null {
  const tag = BLOCK_CLOSERS[sigil];
  if (!tag) return null;
  const idx = source.indexOf(tag, fromPos);
  if (idx === -1) return null;
  const closingEnd = source.indexOf(">>", idx + tag.length);
  if (closingEnd === -1) return null;
  return closingEnd + 2;
}

function findGenericOpenAt(source: string, start: number): { end: number; sigil: string | null } | null {
  if (!source.startsWith("<<~", start)) return null;
  ANY_OPEN_RE.lastIndex = start;
  const m = ANY_OPEN_RE.exec(source);
  if (!m || m.index !== start) return null;
  // Detect the sigil keyword for closing-tag lookup. Form: `<<~[!⊙ ]?keyword ...>>`.
  const inner = source.slice(start + 3, m.index + m[0].length - 2).trim();
  const kwMatch = inner.match(/^[!⊙]?(?:&#x[0-9a-fA-F]+;)?\s*(\\?[a-zA-Z][\w-]*)?/);
  const sigil = kwMatch?.[1]?.replace(/^\\/, "") ?? null;
  return { end: m.index + m[0].length, sigil };
}

function attrsForAhu(open: AhuMatch): Record<string, string> {
  const attrs: Record<string, string> = {};
  const arg = open.arg;
  if (arg.startsWith("#"))           attrs["slot"] = arg;
  else if (arg.startsWith("lar:"))   attrs["uri"]  = arg;
  else                                attrs["raw"]  = arg;
  if (open.modifier === "kahea")     attrs["invocation"] = "true";
  if (open.modifier === "aka")       attrs["projection"] = "true";
  return attrs;
}

function attrToTree(attrs: Record<string, string>): Record<string, { type: "string"; value: string }> {
  const out: Record<string, { type: "string"; value: string }> = {};
  for (const [k, v] of Object.entries(attrs)) out[k] = { type: "string", value: v };
  return out;
}

// ---------------------------------------------------------------------------
// Block rule: ahu definition (slot-bearing) + non-ahu block sigils
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
      // Try ahu first (most common; slot-bearing).
      const ahu = matchAhuOpenAt(source, pos);
      if (ahu) {
        const closeEnd = findCloseEnd(source, "ahu", ahu.end);
        if (closeEnd !== null) {
          this.matchPos = pos;
          this.matchEnd = closeEnd;
          this.attrs    = attrsForAhu(ahu);
          const closeTagStart = source.lastIndexOf(AHU_CLOSE_TAG, closeEnd);
          this.attrs["__body__"] = source.slice(ahu.end, closeTagStart);
          return pos;
        }
      }
      // Generic block: any `<<~` opener whose sigil keyword has a known
      // closer. Capture entire opener+body+closer as literal source for
      // round-trip survival.
      const generic = findGenericOpenAt(source, pos);
      if (generic?.sigil && BLOCK_CLOSERS[generic.sigil] && generic.sigil !== "ahu") {
        const closeEnd = findCloseEnd(source, generic.sigil, generic.end);
        if (closeEnd !== null) {
          this.matchPos = pos;
          this.matchEnd = closeEnd;
          this.attrs    = { __literal__: source.slice(pos, closeEnd) };
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

    if ("__literal__" in attrs) {
      const literal = attrs["__literal__"]!;
      return [{ type: "text", text: literal }];
    }

    const body  = attrs["__body__"] ?? "";
    delete attrs["__body__"];
    return [{
      type:       "ahu",
      attributes: attrToTree(attrs),
      children:   body ? [{ type: "text", text: body }] : [],
    }];
  },
};

// ---------------------------------------------------------------------------
// Inline rule: ahu invocation + every other inline `<<~ ... >>` shape
// ---------------------------------------------------------------------------

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
      // Ahu inline (no closing tag): invocation form.
      const ahu = matchAhuOpenAt(source, pos);
      if (ahu) {
        const closeEnd = findCloseEnd(source, "ahu", ahu.end);
        if (closeEnd === null) {
          this.matchPos = pos;
          this.matchEnd = ahu.end;
          this.attrs    = attrsForAhu(ahu);
          this.attrs["invocation"] = "true";
          return pos;
        }
        // Block-form ahu: leave for the block rule to claim.
        pos = source.indexOf("<<~", pos + 3);
        continue;
      }
      // Generic inline `<<~ ... >>` shape — every other sigil. Capture as
      // literal source so the disk render preserves it verbatim.
      const generic = findGenericOpenAt(source, pos);
      if (generic) {
        // If a known block closer exists for this sigil, the block rule
        // owns the match — skip here.
        if (generic.sigil && BLOCK_CLOSERS[generic.sigil]) {
          const blockClose = findCloseEnd(source, generic.sigil, generic.end);
          if (blockClose !== null) {
            pos = source.indexOf("<<~", pos + 3);
            continue;
          }
        }
        this.matchPos = pos;
        this.matchEnd = generic.end;
        this.attrs    = { __literal__: source.slice(pos, generic.end) };
        return pos;
      }
      pos = source.indexOf("<<~", pos + 3);
    }
    return undefined;
  },

  parse(this: RuleInstance): ParseTreeNode[] {
    const parser = this.parser!;
    parser.pos = this.matchEnd!;
    const attrs = { ...(this.attrs ?? {}) };

    if ("__literal__" in attrs) {
      return [{ type: "text", text: attrs["__literal__"]! }];
    }

    return [{
      type:       "ahu",
      attributes: attrToTree(attrs),
      children:   [],
    }];
  },
};

// ---------------------------------------------------------------------------
// DOCTYPE block rule: `<!-- <<~ !DOCTYPE = uri >> -->` survives verbatim.
// Pre-empts TW5's built-in `htmlcomment` rule (which would strip the line
// in text/plain output). Round-trip preservation.
// ---------------------------------------------------------------------------

const DOCTYPE_RE = /<!--\s*<<~\s*!DOCTYPE\s*=\s*[^>]+>>\s*-->/g;

const DOCTYPE_RULE = {
  name:  "lar-doctype-comment",
  types: { block: true },

  init(this: RuleInstance, parser: WikiParser): void {
    this.parser = parser;
  },

  findNextMatch(this: RuleInstance, startPos: number): number | undefined {
    const source = this.parser!.source;
    DOCTYPE_RE.lastIndex = startPos;
    const m = DOCTYPE_RE.exec(source);
    if (!m) return undefined;
    this.matchPos = m.index;
    this.matchEnd = DOCTYPE_RE.lastIndex;
    this.attrs    = { __literal__: m[0] };
    return m.index;
  },

  parse(this: RuleInstance): ParseTreeNode[] {
    const parser = this.parser!;
    parser.pos = this.matchEnd!;
    return [{ type: "text", text: this.attrs!["__literal__"]! }];
  },
};

// ---------------------------------------------------------------------------
// Registration — mutate WikiParser.prototype.{block,inline}RuleClasses
// ---------------------------------------------------------------------------

interface WikiRuleBaseCtor {
  new (parser: WikiParser): RuleInstance;
  prototype: object;
}

interface TW5Like {
  WikiRuleBase?: WikiRuleBaseCtor;
  Wiki?:        { parsers?: Record<string, unknown> };
}

interface WikiParserCtor {
  prototype: {
    blockRuleClasses?:  Record<string, WikiRuleBaseCtor>;
    inlineRuleClasses?: Record<string, WikiRuleBaseCtor>;
  };
}

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
 * Register the lar-sigil + lar-doctype-comment wikirules onto the active
 * TW5 instance. Idempotent — re-registration replaces prior class entries.
 */
export function registerLarSigilWikirule(tw: TW5Like): void {
  if (!tw.WikiRuleBase) return;
  const wikiTextParser = tw.Wiki?.parsers?.["text/vnd.tiddlywiki"] as WikiParserCtor | undefined;
  if (!wikiTextParser?.prototype) return;

  wikiTextParser.prototype.blockRuleClasses ??= {};
  wikiTextParser.prototype.inlineRuleClasses ??= {};

  wikiTextParser.prototype.blockRuleClasses["lar-sigil-block"] =
    buildRuleClass(tw.WikiRuleBase, BLOCK_RULE);
  wikiTextParser.prototype.blockRuleClasses["lar-doctype-comment"] =
    buildRuleClass(tw.WikiRuleBase, DOCTYPE_RULE);
  wikiTextParser.prototype.inlineRuleClasses["lar-sigil-inline"] =
    buildRuleClass(tw.WikiRuleBase, INLINE_RULE);
}
