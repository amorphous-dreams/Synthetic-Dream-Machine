// @deprecated web2-era — use @lararium/core meme-ast instead.
// This file pre-dates the FFZ quine-wiki model where parsing MUST happen inside
// a TW5 VM. New code uses lararium-core/src/meme-ast/types.ts for AST types and
// lararium-core/src/meme-ast/parse.ts for the parseMemeText() entry point.
// This file remains for reference and gradual migration; do NOT add to new surfaces.

// MemeAstNode — parse-time AST for memetic-wikitext surface form.
//
// Owned by lararium-tw5: these types compile into TW5 IIFE parser/deserializer
// modules that run inside TW5 VMs. No AST trees cross the VM boundary.
//
// Edge-vocabulary types (PranaEdge, GrammarRules, SigilRule, FamilyRule) live
// in @lararium/core — shared with server-side graph/compiler without circular dep.

import type {
  PranaEdge,
  GrammarRules,
  SigilRule,
} from "@lararium/core";

export type { PranaEdge, GrammarRules, SigilRule };

export type MemeAstKind =
  | "Ahu"           // ahu — addressable scope socket (<<~ ahu #slot >>)
  | "Pranala"       // pranala — explicit edge (block or inline)
  | "PranalaSugar"  // sugared pranala forms: loulou / aka / kahea / pono / papalohe
  | "Lele"          // lele — fire-and-forget dispatch
  | "Pae"            // <<~①>> SOH / <<~②>> STX / <<~③>> ETX / <<~④>> EOT
  | "Text"          // raw wikitext prose span
  | "Sigil"         // canonical sigil incl. toml
  | "Dynamic";      // grammar-meme-registered extension

interface AstBase {
  kind: MemeAstKind;
  pos: number;
  raw: string;
}

// ---------------------------------------------------------------------------
// Typed nodes (edgesFromAst branches on these)
// ---------------------------------------------------------------------------

export interface AhuNode extends AstBase {
  kind: "Ahu";
  slot: string;           // e.g. "#section-name"
  uri: string;            // carrierUri + slot
  delegate: string | null;
  body: MemeAstNode[];
  invocation?: boolean;   // true for <<~ kahea ahu #slot >> (live summons)
  projection?: boolean;   // true for <<~ aka ahu #slot >> (frozen shadow embed)
}

export interface PranalaNode extends AstBase {
  kind: "Pranala";
  slot: string | null;
  fromRaw: string;
  toRaw: string;
  family: string;
  role: string | null;
  body: MemeAstNode[];    // non-empty for block-form pranala only
}

export interface PranalaSugarNode extends AstBase {
  kind: "PranalaSugar";
  sigil: "loulou" | "aka" | "kahea" | "pono" | "papalohe";
  slot: string | null;
  fromRaw: string | null; // null for single-URI sugar (loulou/aka/kahea)
  toRaw: string;
  family: string;
  role: string | null;
  trigger: string | null; // papalohe — source event name (DeviceA.EventX)
  fn: string | null;      // papalohe — target function name (DeviceB.FunctionY)
}

export interface LeleNode extends AstBase {
  kind: "Lele";
  targetRaw: string;
  family: "message";
}

// ---------------------------------------------------------------------------
// PaeNode — ASCII framing protocol (SOH/STX/ETX/EOT).
//
// Maps the four classic teletype control characters onto carrier lifecycle:
//   soh — Start Of Heading  <<~&#x0001; ? -> lar:///URI >>  (self-declaration)
//   stx — Start of Text     <<~&#x0002;>>                   (identity done; content begins)
//   etx — End of Text       <<~&#x0003;>>                   (content done; trailer begins)
//   eot — End of Transmission <<~&#x0004; -> ? >>           (transmission complete)
//
// Streaming consumers can update incrementally on each phase boundary:
//   soh → open stub card for URI
//   stx → root toml iam prelude dissolved; render identity panel
//   etx → content ahus committed; fire activate
//   eot → edges committed; update graph
// ---------------------------------------------------------------------------

export type PaePhase = "soh" | "stx" | "etx" | "eot";

export interface PaeNode extends AstBase {
  kind: "Pae";
  phase: PaePhase;
  /** Present on soh (declared URI) and eot (return-to-caller marker). */
  toUri?: string;
}

export interface TextNode extends AstBase {
  kind: "Text";
  content: string;
}

// ---------------------------------------------------------------------------
// SigilNode — collapsed representation for all non-edge canonical sigils.
//
// attrs carries sigil-specific named captures (all strings).
// Conventional keys per sigilName:
//   wai / kahawai / ui → { filter }
//   huli               → { filter, binding }
//   hana               → { grammarKey }
//   meme               → { targetUri }
//   wehe / kumu        → { name, params }
//   helu               → { name, params, expression }
//   kau                → { name, value, scope }
//   kapu               → { qualifier, inline: "true"|"false" }
//   toml               → { profile, content }
// ---------------------------------------------------------------------------

export interface SigilNode extends AstBase {
  kind: "Sigil";
  sigilName: string;
  attrs: Record<string, string>;
  body: MemeAstNode[];
}

// ---------------------------------------------------------------------------
// DynamicNode — grammar-meme-registered sigil not in the canonical union
// ---------------------------------------------------------------------------

export interface DynamicNode extends AstBase {
  kind: "Dynamic";
  sigilName: string;
  sigilKind: string;
  eventType: "open-close" | "leaf" | "pragma";
  body: MemeAstNode[];
}

// ---------------------------------------------------------------------------
// Union
// ---------------------------------------------------------------------------

export type MemeAstNode =
  | AhuNode
  | PranalaNode
  | PranalaSugarNode
  | LeleNode
  | PaeNode
  | TextNode
  | SigilNode
  | DynamicNode;

// ---------------------------------------------------------------------------
// CarrierNode — root of every parsed carrier document.
//
// The island boundary at the parse layer: every lar:/// URI maps to exactly
// one CarrierNode. body holds the flat MemeAstNode[] that parseMemeCarrier
// previously returned directly.
// ---------------------------------------------------------------------------

export interface CarrierNode {
  readonly kind: "Carrier";
  readonly uri: string;
  readonly body: readonly MemeAstNode[];
}
