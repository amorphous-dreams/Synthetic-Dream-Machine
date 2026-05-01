/**
 * memetic-parser — TW5 content-type parser binding for text/x-memetic-wikitext.
 *
 * Registers `text/x-memetic-wikitext` as a TW5 parser that delegates to
 * parseMemeCarrier() from @lararium/core. TW5 gets a parse tree it can walk
 * with its widget system; we reuse our AST as the canonical source of truth.
 *
 * TW5 parser contract:
 *   - Constructed as: new Parser(type, text, options)
 *   - Must expose: this.tree → TW5ParseNode[]
 *   - TW5ParseNode: { type, children?, attributes?, tag? }
 *
 * Node type mapping (MemeAstNode → TW5ParseNode):
 *   Worksite      → "ahu"         (maps to <<~ ahu #slot >> → <$ahu>)
 *   Text          → "text"       (TW5 native text node)
 *   Pranala / PranalaSugar → "pranala"  (<$pranala>)
 *   Sigil(toml)   → "toml"      (<$toml>)
 *   Sigil(other)  → "sigil"     (<$sigil>)
 *   Dynamic       → "dynamic"   (<$dynamic>)
 *
 * TW5 widgets for each "lararium-*" type are registered separately.
 * Text nodes use TW5's built-in text rendering.
 *
 * Installation:
 *   ltw.wiki.addTiddler({ title: "$:/core/modules/parsers/memeticparser.js",
 *     type: "application/javascript", "module-type": "parser", ... })
 *
 * Because TW5 parser modules must be synchronous JS, we register this via
 * LarariumTW5.registerMemeticParser() which injects the parser class directly
 * into $tw.Wiki.parsers after boot.
 */

import { parseMemeCarrier, grammarRulesFromText } from "@lararium/core";
import type { MemeAstNode, CarrierNode, PaeNode, GrammarRules } from "@lararium/core";

// ---------------------------------------------------------------------------
// TW5ParseNode — minimal type for TW5's parse tree nodes
// ---------------------------------------------------------------------------

export interface TW5ParseNode {
  type: string;
  children?: TW5ParseNode[];
  text?: string;
  attributes?: Record<string, { type: "string" | "indirect"; value: string }>;
  tag?: string;
  /** Original MemeAstNode for round-trip access without re-parsing. */
  _ast?: MemeAstNode;
}

// ---------------------------------------------------------------------------
// astToTw5 — map MemeAstNode[] to TW5ParseNode[]
// ---------------------------------------------------------------------------

function attr(value: string): { type: "string"; value: string } {
  return { type: "string", value };
}

type TW5Wiki = {
  parseText(type: string, text: string, opts?: unknown): { tree: TW5ParseNode[] };
};

function nodeToTw5(node: MemeAstNode, wiki?: TW5Wiki): TW5ParseNode {
  switch (node.kind) {
    case "Pae":
      // Phase boundary markers are structurally significant but invisible in rendered output.
      return { type: "pae", _ast: node, children: [],
        attributes: {
          phase: attr((node as PaeNode).phase),
          ...((node as PaeNode).toUri ? { uri: attr((node as PaeNode).toUri!) } : {}),
        } };

    case "Ahu":
      return { type: "ahu", _ast: node,
        attributes: {
          slot: attr(node.slot),
          uri:  attr(node.uri),
          ...(node.delegate ? { delegate: attr(node.delegate) } : {}),
        },
        children: node.body.map((n) => nodeToTw5(n, wiki)) };

    case "Text": {
      // When a wiki context is available, pipe prose through TW5's own wikitext
      // parser so markdown headings, lists, and formatting render correctly in
      // mixed-body carriers (plain text interleaved with ahu slots).
      if (wiki && node.content.trim()) {
        try {
          const parsed = wiki.parseText("text/vnd.tiddlywiki", node.content, {});
          if (parsed?.tree?.length) {
            return { type: "element", tag: "span", _ast: node, children: parsed.tree };
          }
        } catch (e) {
          console.warn("[lararium] wiki.parseText failed for prose node — falling back to raw text:", e);
        }
      }
      return { type: "text", text: node.content, _ast: node, children: [] };
    }

    case "Pranala":
      return { type: "pranala", _ast: node, children: [],
        attributes: {
          from:   attr(node.fromRaw),
          to:     attr(node.toRaw),
          family: attr(node.family),
          ...(node.role ? { role: attr(node.role) } : {}),
        } };

    case "PranalaSugar":
      // papalohe gets its own widget so trigger/fn labels render visually.
      // All other edge-sugar sigils (loulou, aka, pono, kahea) stay as lararium-edge.
      if (node.sigil === "papalohe") {
        return { type: "papalohe", _ast: node, children: [],
          attributes: {
            from:    attr(node.fromRaw ?? ""),
            to:      attr(node.toRaw),
            ...(node.trigger ? { trigger: attr(node.trigger) } : {}),
            ...(node.fn      ? { fn:      attr(node.fn) }      : {}),
            ...(node.slot    ? { slot:    attr(node.slot) }    : {}),
          } };
      }
      return { type: "pranala", _ast: node, children: [],
        attributes: {
          sigil:  attr(node.sigil),
          to:     attr(node.toRaw),
          family: attr(node.family),
          ...(node.fromRaw ? { from: attr(node.fromRaw) } : {}),
          ...(node.role    ? { role: attr(node.role) }    : {}),
          ...(node.trigger ? { trigger: attr(node.trigger) } : {}),
          ...(node.fn      ? { fn: attr(node.fn) }        : {}),
        } };

    case "Lele":
      return { type: "lele", _ast: node, children: [],
        attributes: { target: attr(node.targetRaw) } };

    case "Sigil":
      if (node.sigilName === "toml") {
        const profile = node.attrs["profile"] ?? "";
        return { type: "toml", _ast: node, children: [],
          attributes: {
            content: attr(node.attrs["content"] ?? ""),
            ...(profile ? { profile: attr(profile) } : {}),
            ...(profile === "iam" ? { suppress: attr("true") } : {}),
          } };
      }
      if (node.sigilName === "kukali") {
        return { type: "kukali", _ast: node, children: [],
          attributes: { ...(node.attrs["trigger"] ? { trigger: attr(node.attrs["trigger"]) } : {}) } };
      }
      // waiho — ephemeral variable binding; no visual output, scope-injected at render time.
      // Emitted as "waiho" type so the waiho widget can shadow the variable into context.
      if (node.sigilName === "waiho") {
        return { type: "waiho", _ast: node,
          attributes: {
            name:  attr(node.attrs["name"] ?? ""),
            value: attr(node.attrs["value"] ?? ""),
            scope: attr(node.attrs["scope"] ?? "block"),
          },
          children: node.body.map((n) => nodeToTw5(n, wiki)) };
      }
      // kau — invocation or placement, disambiguated by attrs.fragment presence.
      //
      // Invocation (no fragment): <<~ kau name(args) >>
      //   Renders kumu def in caller's currentTiddler context.
      //   Analogous to TW5's {{SomeTiddler}} = <$tiddler><$transclude/></$tiddler>.
      //
      // Placement (#fragment present): <<~ kau #frag Name props >>
      //   Renders kumu def in instance's own URI (carrierUri#frag) as currentTiddler.
      //   Creates a new persistent execution scope. UUID write-back fires on first commit.
      if (node.sigilName === "kau") {
        const fragment = node.attrs["fragment"] ?? "";
        if (fragment) {
          // Placement path — KauWidget will push instanceUri as currentTiddler
          return { type: "kau", _ast: node, children: [],
            attributes: {
              fragment: attr(fragment),
              name:     attr(node.attrs["name"] ?? ""),
              propsRaw: attr(node.attrs["propsRaw"] ?? ""),
            } };
        }
        // Invocation path — KauWidget renders in caller context
        return { type: "kau", _ast: node, children: [],
          attributes: {
            name: attr(node.attrs["name"] ?? ""),
            args: attr(node.attrs["args"] ?? ""),
          } };
      }
      return { type: "sigil", _ast: node,
        tag: node.sigilName,
        attributes: Object.fromEntries(
          Object.entries(node.attrs).map(([k, v]) => [k, attr(v)])
        ),
        children: node.body.map((n) => nodeToTw5(n, wiki)) };

    case "Dynamic":
      return { type: "dynamic", _ast: node,
        tag: node.sigilName,
        attributes: {},
        children: node.body.map((n) => nodeToTw5(n, wiki)) };

    default:
      // Unknown node kind — emit as opaque text fallback.
      return { type: "text", text: (node as MemeAstNode).raw, children: [] };
  }
}

export function astToTw5Tree(ast: readonly MemeAstNode[], wiki?: TW5Wiki): TW5ParseNode[] {
  return ast.map((n) => nodeToTw5(n, wiki));
}

// ---------------------------------------------------------------------------
// MemeticParser — the TW5 parser class to register
// ---------------------------------------------------------------------------

/**
 * TW5 parser class for text/x-memetic-wikitext.
 * Instantiate via TW5's internal parser factory — do not call directly.
 *
 * The constructor signature matches TW5's parser protocol:
 *   new MemeticParser(type, text, options)
 * where options may carry { parseAsInline, wiki, tiddler }.
 */
const GRAMMAR_URI = "lar:///lares/grammars/memetic-wikitext";

type AstCache = Map<string, { text: string; grammarText: string; ast: ReturnType<typeof parseMemeCarrier> }>;
type WikiWithCache = TW5Wiki & {
  _larAstCache?:  AstCache;
  _larGrammar?:   { text: string; rules: GrammarRules | null };
  getTiddlerText?(title: string, defaultText?: string): string | undefined;
};

function resolveGrammar(wiki: WikiWithCache | undefined): GrammarRules | null {
  if (!wiki) return null;
  const text = wiki.getTiddlerText?.(GRAMMAR_URI) ?? "";
  if (!text) return null;
  // Cache grammar rules on the wiki instance; invalidate when the carrier text changes.
  if (!wiki._larGrammar || wiki._larGrammar.text !== text) {
    wiki._larGrammar = { text, rules: grammarRulesFromText(GRAMMAR_URI, text) };
  }
  return wiki._larGrammar.rules;
}

export class MemeticParser {
  tree: TW5ParseNode[];

  constructor(
    _type: string,
    text: string,
    options: { tiddler?: { fields?: { title?: string } }; parseAsInline?: boolean; wiki?: unknown } = {},
  ) {
    const uri  = options.tiddler?.fields?.title ?? "lar:///unknown";
    const wiki = options.wiki as WikiWithCache | undefined;

    const grammar     = resolveGrammar(wiki);
    const grammarText = wiki?._larGrammar?.text ?? "";

    // Per-wiki AST cache keyed by URI; invalidated when text or grammar changes.
    if (wiki && !wiki._larAstCache) wiki._larAstCache = new Map();
    const cache  = wiki?._larAstCache;
    const cached = cache?.get(uri);
    const ast = (cached?.text === text && cached?.grammarText === grammarText)
      ? cached.ast
      : (() => {
          const a = parseMemeCarrier(uri, text, grammar ?? undefined);
          cache?.set(uri, { text, grammarText, ast: a });
          return a;
        })();

    this.tree = astToTw5Tree(ast, wiki);
  }
}

// ---------------------------------------------------------------------------
// parseCarrierToTw5 — convenience: text → TW5ParseNode[] without a wiki context
// ---------------------------------------------------------------------------

export function parseCarrierToTw5(uri: string, text: string, wiki?: TW5Wiki): TW5ParseNode[] {
  return astToTw5Tree(parseMemeCarrier(uri, text), wiki);
}

// ---------------------------------------------------------------------------
// parseCarrierNode — canonical entry: text → CarrierNode + TW5ParseNode[]
//
// Returns both representations so callers can use whichever layer they need.
// ---------------------------------------------------------------------------

export function buildCarrierAndTw5Tree(uri: string, text: string): {
  carrier: CarrierNode;
  tw5Tree: TW5ParseNode[];
} {
  const body = parseMemeCarrier(uri, text);
  return {
    carrier: { kind: "Carrier", uri, body },
    tw5Tree: astToTw5Tree(body),
  };
}
