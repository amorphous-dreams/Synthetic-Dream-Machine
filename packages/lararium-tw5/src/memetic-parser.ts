/**
 * meme-parser — TW5 content-type parser binding for text/x-memetic-wikitext.
 *
 * Replaces memetic-parser.web2.ts: uses parseMemeText (MemeAstNode) not
 * parseMemeCarrier (CarrierNode). Node kind names are identical; only the
 * source type and import origin change.
 *
 * TW5 parser contract:
 *   - Constructed as: new MemeticParser(type, text, options)
 *   - Must expose: this.tree → TW5ParseNode[]
 *   - TW5ParseNode: { type, children?, attributes?, tag?, text? }
 *
 * Node kind → TW5 widget type mapping (invariant across web2→meme rebuild):
 *   Ahu          → "ahu"      (<$ahu>)
 *   Text         → "text"     (TW5 native text / prose delegation)
 *   Pranala      → "pranala"  (<$pranala>)
 *   PranalaSugar → "pranala" or "papalohe"
 *   Lele         → "lele"     (<$lele>)
 *   Pae          → "pae"      (phase boundary marker)
 *   Sigil(toml)  → "toml"     (<$toml>)
 *   Sigil(kukali)→ "kukali"   (<$kukali>)
 *   Sigil(waiho) → "waiho"    (<$waiho>)
 *   Sigil(kau)   → "kau"      (<$kau>)
 *   Sigil(other) → "sigil"    (<$sigil>)
 *   Dynamic      → "dynamic"  (<$dynamic>)
 *
 * Grammar boot: grammar tiddler is loaded from the TW5 wiki via
 * getTiddlerText(GRAMMAR_MEME_URI); parsed once per wiki instance and
 * cached. Invalidated when the grammar tiddler text changes.
 *
 * Schema: lar:///ha.ka.ba/@lares/api/v0.1/lararium/modules/meme-parser
 */

import type {
  MemeAstNode,
  AhuNode,
  PranalaNode,
  PranalaSugarNode,
  LeleNode,
  PaeNode,
  SigilNode,
  DynamicNode,
  GrammarRules,
} from "@lararium/core";
import { parseMemeText, grammarRulesFromText } from "@lararium/core";
import { GRAMMAR_MEME_URI } from "@lararium/core";

// TW5ParseNode — the parse-tree contract between the parser and TW5 widget renderer.
// Shape is invariant across web2→meme rebuild; exported for downstream callers.
export interface TW5ParseNode {
  type:           string;
  tag?:           string;
  attributes?:    Record<string, { type: string; value: unknown }>;
  children?:      TW5ParseNode[];
  text?:          string;
  isSelfClosing?: boolean;
  /** Original MemeAstNode for round-trip access without re-parsing. */
  _ast?:          MemeAstNode;
}

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

/** Minimal TW5 wiki surface used by the parser (grammar resolution + prose delegation). */
type TW5Wiki = {
  getTiddlerText?(title: string, defaultText?: string): string | undefined;
  parseText?(type: string, text: string, opts?: unknown): { tree: TW5ParseNode[] };
  _larGrammar?:  { text: string; rules: GrammarRules | null };
  _larAstCache?: Map<string, { text: string; grammarText: string; nodes: readonly MemeAstNode[] }>;
};

// ---------------------------------------------------------------------------
// Attribute helpers
// ---------------------------------------------------------------------------

function attr(value: string): { type: "string"; value: string } {
  return { type: "string", value };
}

// ---------------------------------------------------------------------------
// Grammar resolution — cached per wiki instance
// ---------------------------------------------------------------------------

function resolveGrammar(wiki: TW5Wiki | undefined): GrammarRules | null {
  if (!wiki?.getTiddlerText) return null;
  const text = wiki.getTiddlerText(GRAMMAR_MEME_URI) ?? "";
  if (!text) return null;
  if (!wiki._larGrammar || wiki._larGrammar.text !== text) {
    wiki._larGrammar = { text, rules: grammarRulesFromText(GRAMMAR_MEME_URI, text) };
  }
  return wiki._larGrammar.rules;
}

// ---------------------------------------------------------------------------
// nodeToTw5 — map a single MemeAstNode to a TW5ParseNode
// ---------------------------------------------------------------------------

function nodeToTw5(node: MemeAstNode, wiki?: TW5Wiki): TW5ParseNode {
  switch (node.kind) {
    case "Pae": {
      const n = node as PaeNode;
      return {
        type: "pae", _ast: node, children: [],
        attributes: {
          phase: attr(n.phase),
          ...(n.toUri ? { uri: attr(n.toUri) } : {}),
        },
      };
    }

    case "Ahu": {
      const n = node as AhuNode;
      return {
        type: "ahu", _ast: node,
        attributes: {
          slot: attr(n.slot),
          uri:  attr(n.uri),
          ...(n.delegate   ? { delegate:   attr(n.delegate) }   : {}),
          ...(n.invocation ? { invocation: attr("true") }        : {}),
          ...(n.projection ? { projection: attr("true") }        : {}),
        },
        children: (n.invocation || n.projection) ? [] : n.body.map((c) => nodeToTw5(c, wiki)),
      };
    }

    case "Text": {
      // Delegate prose through TW5's own wikitext parser when wiki context is available.
      if (wiki?.parseText && node.content.trim()) {
        try {
          const parsed = wiki.parseText("text/vnd.tiddlywiki", node.content, {});
          if (parsed?.tree?.length) {
            return { type: "element", tag: "span", _ast: node, children: parsed.tree };
          }
        } catch {
          // Fall through to raw text.
        }
      }
      return { type: "text", text: node.content, _ast: node, children: [] };
    }

    case "Pranala": {
      const n = node as PranalaNode;
      return {
        type: "pranala", _ast: node, children: [],
        attributes: {
          from:   attr(n.fromRaw),
          to:     attr(n.toRaw),
          family: attr(n.family),
          ...(n.role ? { role: attr(n.role) } : {}),
        },
      };
    }

    case "PranalaSugar": {
      const n = node as PranalaSugarNode;
      if (n.sigil === "papalohe") {
        return {
          type: "papalohe", _ast: node, children: [],
          attributes: {
            from:    attr(n.fromRaw ?? ""),
            to:      attr(n.toRaw),
            ...(n.listenable  ? { listenable:  attr(n.listenable) }  : {}),
            ...(n.subscribable ? { subscribable: attr(n.subscribable) } : {}),
            ...(n.slot    ? { slot:    attr(n.slot) }    : {}),
          },
        };
      }
      return {
        type: "pranala", _ast: node, children: [],
        attributes: {
          sigil:  attr(n.sigil),
          to:     attr(n.toRaw),
          family: attr(n.family),
          ...(n.fromRaw    ? { from:       attr(n.fromRaw) }       : {}),
          ...(n.role      ? { role:       attr(n.role) }         : {}),
          ...(n.listenable  ? { listenable:  attr(n.listenable) }  : {}),
          ...(n.subscribable ? { subscribable: attr(n.subscribable) } : {}),
        },
      };
    }

    case "Lele": {
      const n = node as LeleNode;
      return {
        type: "lele", _ast: node, children: [],
        attributes: { target: attr(n.targetRaw) },
      };
    }

    case "Sigil": {
      const n = node as SigilNode;
      if (n.sigilName === "toml") {
        const profile = n.attrs["profile"] ?? "";
        return {
          type: "toml", _ast: node, children: [],
          attributes: {
            content: attr(n.attrs["content"] ?? ""),
            ...(profile ? { profile: attr(profile) } : {}),
            ...(profile === "iam" ? { suppress: attr("true") } : {}),
          },
        };
      }
      if (n.sigilName === "kukali") {
        return {
          type: "kukali", _ast: node, children: [],
          attributes: n.attrs["trigger"] ? { trigger: attr(n.attrs["trigger"]) } : {},
        };
      }
      if (n.sigilName === "waiho") {
        return {
          type: "waiho", _ast: node,
          attributes: {
            name:  attr(n.attrs["name"]  ?? ""),
            value: attr(n.attrs["value"] ?? ""),
            scope: attr(n.attrs["scope"] ?? "block"),
          },
          children: n.body.map((c) => nodeToTw5(c, wiki)),
        };
      }
      if (n.sigilName === "kau") {
        const fragment = n.attrs["fragment"] ?? "";
        if (fragment) {
          return {
            type: "kau", _ast: node, children: [],
            attributes: {
              fragment: attr(fragment),
              name:     attr(n.attrs["name"]     ?? ""),
              propsRaw: attr(n.attrs["propsRaw"] ?? ""),
            },
          };
        }
        return {
          type: "kau", _ast: node, children: [],
          attributes: {
            name: attr(n.attrs["name"] ?? ""),
            args: attr(n.attrs["args"] ?? ""),
          },
        };
      }
      // Generic sigil fallback
      return {
        type: "sigil", _ast: node,
        tag: n.sigilName,
        attributes: Object.fromEntries(
          Object.entries(n.attrs).map(([k, v]) => [k, attr(v)])
        ),
        children: n.body.map((c) => nodeToTw5(c, wiki)),
      };
    }

    case "Dynamic": {
      const n = node as DynamicNode;
      return {
        type: "dynamic", _ast: node,
        tag: n.sigilName,
        attributes: {},
        children: n.body.map((c) => nodeToTw5(c, wiki)),
      };
    }

    default:
      return { type: "text", text: (node as MemeAstNode).raw ?? "", children: [] };
  }
}

// ---------------------------------------------------------------------------
// astToTw5Tree — map a MemeAstNode array to TW5ParseNode[]
// ---------------------------------------------------------------------------

export function astToTw5Tree(
  ast:   readonly MemeAstNode[],
  wiki?: TW5Wiki,
): TW5ParseNode[] {
  return ast.map((n) => nodeToTw5(n, wiki));
}

// ---------------------------------------------------------------------------
// MemeticParser — the TW5 parser class registered for text/x-memetic-wikitext
// ---------------------------------------------------------------------------

/**
 * TW5 parser class for text/x-memetic-wikitext.
 * Registered via `$tw.Wiki.parsers["text/x-memetic-wikitext"] = MemeticParser`.
 *
 * Constructor signature matches TW5's parser protocol:
 *   new MemeticParser(type, text, options)
 *
 * Grammar is resolved from the TW5 wiki at construction time (hot-reloadable):
 *   wiki.getTiddlerText(GRAMMAR_MEME_URI) → GrammarRules
 */
export class MemeticParser {
  readonly tree: TW5ParseNode[];

  constructor(
    _type: string,
    text:  string,
    options: {
      tiddler?:      { fields?: { title?: string } };
      parseAsInline?: boolean;
      wiki?:         unknown;
    } = {},
  ) {
    const uri     = options.tiddler?.fields?.title ?? "lar:///unknown";
    const wiki    = options.wiki as TW5Wiki | undefined;
    const grammar = resolveGrammar(wiki);
    const grammarText = wiki?._larGrammar?.text ?? "";

    // Per-wiki AST cache keyed by URI; invalidated when text or grammar text changes.
    if (wiki && !wiki._larAstCache) wiki._larAstCache = new Map();
    const cache   = wiki?._larAstCache;
    const cached  = cache?.get(uri);
    const nodes = (cached?.text === text && cached?.grammarText === grammarText)
      ? cached.nodes
      : (() => {
          const result = parseMemeText(uri, text, grammar ?? undefined);
          cache?.set(uri, { text, grammarText, nodes: result.nodes });
          return result.nodes;
        })();

    this.tree = astToTw5Tree(nodes, wiki);
  }
}

// ---------------------------------------------------------------------------
// parseMemeToTw5 — convenience: text → TW5ParseNode[] without a wiki context
// ---------------------------------------------------------------------------

export function parseMemeToTw5(
  uri:  string,
  text: string,
  wiki?: TW5Wiki,
): TW5ParseNode[] {
  const grammar = wiki ? resolveGrammar(wiki) : null;
  const { nodes } = parseMemeText(uri, text, grammar ?? undefined);
  return astToTw5Tree(nodes, wiki);
}

