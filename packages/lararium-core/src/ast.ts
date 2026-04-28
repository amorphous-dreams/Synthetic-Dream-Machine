// MemeAstNode — parse-time AST for memetic-wikitext surface form.
//
// Design: typed nodes only for things edgesFromAst branches on (edges, scope).
// Everything else — conditionals, iteration, definitions, variables, etc. —
// collapses into SigilNode: { sigilName, attrs, body }. Same shape TW5 uses.
// DynamicNode is the escape hatch for grammar-meme-registered extensions.

export type MemeAstKind =
  | "Worksite"      // ahu — addressable scope socket
  | "Edge"          // pranala (block or inline)
  | "EdgeSugar"     // loulou / aka / kahea / pono / papalohe
  | "Dispatch"      // lele — fire-and-forget message edge
  | "CarrierHeader" // <<~ ? -> URI >>
  | "Text"          // raw wikitext span
  | "Sigil"         // all canonical sigils incl. toml (attrs bag carries content)
  | "Dynamic";      // grammar-meme-registered sigil not in canonical set

interface AstBase {
  kind: MemeAstKind;
  pos: number;
  raw: string;
}

// ---------------------------------------------------------------------------
// Typed nodes (edgesFromAst branches on these)
// ---------------------------------------------------------------------------

export interface WorksiteNode extends AstBase {
  kind: "Worksite";
  slot: string;           // e.g. "#section-name"
  uri: string;            // carrierUri + slot
  body: MemeAstNode[];
}

export interface EdgeNode extends AstBase {
  kind: "Edge";
  slot: string | null;
  fromRaw: string;
  toRaw: string;
  family: string;
  role: string | null;
  body: MemeAstNode[];    // non-empty for block-form pranala only
}

export interface EdgeSugarNode extends AstBase {
  kind: "EdgeSugar";
  sigil: "loulou" | "aka" | "kahea" | "pono" | "papalohe";
  slot: string | null;
  fromRaw: string | null; // null for single-URI sugar (loulou/aka/kahea)
  toRaw: string;
  family: string;
  role: string | null;
  trigger: string | null; // papalohe only
}

export interface DispatchNode extends AstBase {
  kind: "Dispatch";
  targetRaw: string;
  family: "message";
}

export interface CarrierHeaderNode extends AstBase {
  kind: "CarrierHeader";
  toUri: string;
}

// MetadataNode removed — TOML is a general data carrier.
// ahu #iam → WorksiteNode(slot="#iam") containing SigilNode(sigilName="toml", attrs={content}).
// Any <<~ toml >>...<<~/toml >> or ```toml``` fence elsewhere → same SigilNode shape.
// The #iam identity contract is carried by the slot name, not a special node type.

export interface TextNode extends AstBase {
  kind: "Text";
  content: string;
}

// ---------------------------------------------------------------------------
// SigilNode — the collapsed representation for all non-edge canonical sigils.
//
// Replaces: MemeBoundary, Conditional, ConditionalElse, ConditionalBranch,
//           Iteration, WorkBlock, TextTemplate, FilterFunction, TypeDefinition,
//           Variable, Qualification, SyncBlock, RaceBlock, RushBlock, Query,
//           MetadataNode (toml is now a general data carrier, not a special type).
//
// attrs carries sigil-specific named captures (all strings; rendering layer
// interprets types). Conventional keys per sigilName:
//   wai / kahawai / ui → { filter }
//   huli               → { filter, binding }
//   hana               → { grammarKey }
//   meme               → { targetUri }
//   wehe / kumu        → { name, params }
//   helu               → { name, params, expression }
//   kau                → { name, value, scope: "ephemeral"|"personal"|"consensual"|"collective"|"universal"|"carrier"|"block" }
//                         carrier/block are parse-time aliases for personal/collective (retained for compat)
//   kapu               → { qualifier, inline: "true"|"false" }
//                         qualifier may be a scope principle name to gate a block by scope
//   toml / iam         → { content }  — iam is #iam ahu slot; toml is general data block
//   hui / heihei / puka / mukuwai → {}
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
  | WorksiteNode
  | EdgeNode
  | EdgeSugarNode
  | DispatchNode
  | CarrierHeaderNode
  | TextNode
  | SigilNode
  | DynamicNode;
