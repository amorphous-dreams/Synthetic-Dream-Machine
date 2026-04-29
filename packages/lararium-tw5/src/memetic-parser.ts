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
 *   CarrierHeader → "lararium-header"
 *   Worksite      → "lararium-worksite"  (maps to <<~ ahu #slot >>)
 *   Text          → "text"               (TW5 native text node)
 *   Edge / EdgeSugar → "lararium-edge"
 *   Sigil(toml)   → "lararium-toml"
 *   Sigil(other)  → "lararium-sigil"
 *   Dynamic       → "lararium-dynamic"
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

import { parseMemeCarrier } from "@lararium/core";
import type { MemeAstNode, CarrierNode } from "@lararium/core";

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

function nodeToTw5(node: MemeAstNode): TW5ParseNode {
  switch (node.kind) {
    case "CarrierHeader":
      return { type: "lararium-header", _ast: node, children: [],
        attributes: { uri: attr(node.toUri) } };

    case "Worksite":
      return { type: "lararium-worksite", _ast: node,
        attributes: { slot: attr(node.slot), uri: attr(node.uri) },
        children: node.body.map(nodeToTw5) };

    case "Text":
      // TW5 native text node — TW5 renders these directly.
      return { type: "text", text: node.content, _ast: node, children: [] };

    case "Edge":
      return { type: "lararium-edge", _ast: node, children: [],
        attributes: {
          from:   attr(node.fromRaw),
          to:     attr(node.toRaw),
          family: attr(node.family),
          ...(node.role ? { role: attr(node.role) } : {}),
        } };

    case "EdgeSugar":
      // papalohe gets its own widget so trigger/fn labels render visually.
      // All other edge-sugar sigils (loulou, aka, pono, kahea) stay as lararium-edge.
      if (node.sigil === "papalohe") {
        return { type: "lararium-papalohe", _ast: node, children: [],
          attributes: {
            from:    attr(node.fromRaw ?? ""),
            to:      attr(node.toRaw),
            ...(node.trigger ? { trigger: attr(node.trigger) } : {}),
            ...(node.fn      ? { fn:      attr(node.fn) }      : {}),
            ...(node.slot    ? { slot:    attr(node.slot) }    : {}),
          } };
      }
      return { type: "lararium-edge", _ast: node, children: [],
        attributes: {
          sigil:  attr(node.sigil),
          to:     attr(node.toRaw),
          family: attr(node.family),
          ...(node.fromRaw ? { from: attr(node.fromRaw) } : {}),
          ...(node.role    ? { role: attr(node.role) }    : {}),
          ...(node.trigger ? { trigger: attr(node.trigger) } : {}),
          ...(node.fn      ? { fn: attr(node.fn) }        : {}),
        } };

    case "Dispatch":
      return { type: "lararium-dispatch", _ast: node, children: [],
        attributes: { target: attr(node.targetRaw) } };

    case "Sigil":
      if (node.sigilName === "toml" || node.sigilName === "iam") {
        return { type: "lararium-toml", _ast: node, children: [],
          attributes: { content: attr(node.attrs["content"] ?? "") } };
      }
      if (node.sigilName === "kukali") {
        return { type: "lararium-kukali", _ast: node, children: [],
          attributes: { ...(node.attrs["trigger"] ? { trigger: attr(node.attrs["trigger"]) } : {}) } };
      }
      // kahea-call → kumu device instance (name + resolved props, body rendered as children)
      if (node.sigilName === "kahea") {
        return { type: "lararium-kumu", _ast: node,
          attributes: {
            name:     attr(node.attrs["name"] ?? ""),
            props:    attr(node.attrs["args"] ?? ""),
            resolved: attr("unknown"), // registry not available at parse time; kumu-executor resolves
          },
          children: node.body.map(nodeToTw5) };
      }
      return { type: "lararium-sigil", _ast: node,
        tag: node.sigilName,
        attributes: Object.fromEntries(
          Object.entries(node.attrs).map(([k, v]) => [k, attr(v)])
        ),
        children: node.body.map(nodeToTw5) };

    case "Dynamic":
      return { type: "lararium-dynamic", _ast: node,
        tag: node.sigilName,
        attributes: {},
        children: node.body.map(nodeToTw5) };

    default:
      // Unknown node kind — emit as opaque text fallback.
      return { type: "text", text: (node as MemeAstNode).raw, children: [] };
  }
}

export function astToTw5Tree(ast: readonly MemeAstNode[]): TW5ParseNode[] {
  return ast.map(nodeToTw5);
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
export class MemeticParser {
  tree: TW5ParseNode[];

  constructor(
    _type: string,
    text: string,
    options: { tiddler?: { fields?: { title?: string } }; parseAsInline?: boolean } = {},
  ) {
    const uri = options.tiddler?.fields?.title ?? "lar:///unknown";
    const ast = parseMemeCarrier(uri, text);
    this.tree = astToTw5Tree(ast);
  }
}

// ---------------------------------------------------------------------------
// parseCarrierToTw5 — convenience: text → TW5ParseNode[] without a wiki context
// ---------------------------------------------------------------------------

export function parseCarrierToTw5(uri: string, text: string): TW5ParseNode[] {
  return astToTw5Tree(parseMemeCarrier(uri, text));
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
