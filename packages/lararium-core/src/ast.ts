// MemeAstNode — parse-time AST for memetic-wikitext surface form.
//
// Design: typed nodes only for things edgesFromAst branches on (edges, scope).
// Everything else — conditionals, iteration, definitions, variables, etc. —
// collapses into SigilNode: { sigilName, attrs, body }. Same shape TW5 uses.
// DynamicNode is the escape hatch for grammar-meme-registered extensions.
//
// PranaEdge, GrammarRules, SigilRule, FamilyRule live here so parser.ts and
// pranala-parser.ts can share them without a circular dependency.

export type MemeAstKind =
  | "Worksite"      // ahu — addressable scope socket
  | "Edge"          // pranala (block or inline)
  | "EdgeSugar"     // loulou / aka / kahea / pono / papalohe
  | "Dispatch"      // lele — fire-and-forget message edge
  | "CarrierHeader" // <<~ ? -> URI >>  (legacy; superseded by Control "soh")
  | "Control"       // <<~&#x0001;>> SOH / <<~&#x0002;>> STX / <<~&#x0003;>> ETX / <<~&#x0004;>> EOT
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
  trigger: string | null; // papalohe — source event name (DeviceA.EventX)
  fn: string | null;      // papalohe — target function name (DeviceB.FunctionY)
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

// ---------------------------------------------------------------------------
// ControlNode — ASCII framing protocol (SOH/STX/ETX/EOT).
//
// Maps the four classic teletype control characters onto carrier lifecycle:
//   soh — Start Of Heading  <<~&#x0001; ? -> lar:///URI >>  (self-declaration)
//   stx — Start of Text     <<~&#x0002;>>                   (identity done; content begins)
//   etx — End of Text       <<~&#x0003;>>                   (content done; trailer begins)
//   eot — End of Transmission <<~&#x0004; -> ? >>           (transmission complete)
//
// Streaming consumers can update incrementally on each phase boundary:
//   soh → open stub card for URI
//   stx → #iam dissolved; render identity panel
//   etx → content ahus committed; fire activate
//   eot → edges committed; update graph
// ---------------------------------------------------------------------------

export type ControlPhase = "soh" | "stx" | "etx" | "eot";

export interface ControlNode extends AstBase {
  kind: "Control";
  phase: ControlPhase;
  /** Present on soh (declared URI) and eot (return-to-caller marker). */
  toUri?: string;
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
//   kukali             → { trigger? }  — wait posture; trigger is optional papalohe slot name
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
  | ControlNode
  | TextNode
  | SigilNode
  | DynamicNode;

// ---------------------------------------------------------------------------
// CarrierNode — root of every parsed carrier document.
//
// The island boundary at the parse layer: every lar:/// URI maps to exactly
// one CarrierNode. body holds the flat MemeAstNode[] that parseMemeCarrier
// previously returned directly.
//
// Analogues:
//   TW5   — the wiki tiddler itself (title = uri, text = source)
//   UEFN  — a VerseDevice type definition (uri = device type path, body = island)
//
// Authority context: uri is the canonical key; authority checking (Orichalcum
// ceremony) is scoped to this node before any render pass runs.
// ---------------------------------------------------------------------------

export interface CarrierNode {
  readonly kind: "Carrier";
  readonly uri: string;
  readonly body: readonly MemeAstNode[];
}

// ---------------------------------------------------------------------------
// PranaEdge — compiled edge record (output of edgesFromAst / parsePranalaEdges)
// ---------------------------------------------------------------------------

export interface PranaEdge {
  readonly fromUri: string;
  /** The enclosing ahu worksite socket. Falls back to carrierUri if no ahu is open. */
  readonly fromSocket: string;
  /**
   * Named outgoing slot on the fromSocket ahu, if the pranala carries an explicit #fragment.
   * `<<~ pranala #hydrate-hud ? -> TARGET >>` → fromSocket=#core-hydration, fromSlot=#hydrate-hud
   * Null for bare `?` pranala (no explicit slot name).
   */
  readonly fromSlot: string | null;
  readonly toUri: string;
  readonly toSocket: string;
  readonly family: string;
  readonly lifecycle: string;
  readonly role: string | null;
  readonly traversal: string;
  readonly propagation: string;
  readonly label: string;
  readonly payload: Record<string, unknown>;
  readonly cardinality: string | null;
  readonly polarity: string | null;
  readonly status: string;
  readonly confidence: number | null;
  readonly renderMode: string | null;
}

export type PranaViolationSeverity = "error" | "warning";

export interface PranaEdgeViolation {
  readonly fromUri: string;
  readonly toUri: string;
  readonly family: string;
  readonly severity: PranaViolationSeverity;
  readonly rule: string;
  readonly message: string;
}

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Law of Fives — invariant 5-point ladders
//
// Two orthogonal axes appear across every domain in the system.
// Scale tells you the size of a loop. Phase tells you where in it you are.
// They run in opposite directions: Act is the finest-grain scale (Action);
// Observe is the widest-lens scale (Week). This tension is productive.
//
// All domain-specific ladders (scope, zoom, Kowloon addressing, lifecycle)
// are projections of LADDER_5. All phase/confidence/stance systems are
// projections of OODA_HA_5.
// ---------------------------------------------------------------------------

/** Temporal/spatial scale ladder — finest (action) to coarsest (week). */
export const LADDER_5 = ["action", "round", "turn", "watch", "week"] as const;
export type Ladder5 = typeof LADDER_5[number];

/** OODA-HA phase cycle — active (act) to reflective (aftermath). */
export const OODA_HA_5 = ["act", "decide", "orient", "observe", "aftermath"] as const;
export type OodaHa5 = typeof OODA_HA_5[number];

/** Scope principle ladder — maps 1:1 onto LADDER_5. */
export const SCOPE_5 = ["ephemeral", "personal", "consensual", "collective", "universal"] as const;
export type Scope5 = typeof SCOPE_5[number];

/** Scope → Ladder5 projection. */
export const SCOPE_TO_LADDER: Record<Scope5, Ladder5> = {
  ephemeral:  "action",
  personal:   "round",
  consensual: "turn",
  collective: "watch",
  universal:  "week",
};

// ---------------------------------------------------------------------------
// Law of Fives — rating and stage ladders
//
// rating = structural quality of the carrier (Noise→Data→Meme→Ano→Kapu)
//   Used in federation gate: only Meme+ carriers federate.
//
// stage  = UX/rendering annotation (GR→OS→US→CS→DS, from confidence scalar)
//   Used in masks/voices layer: color temperature, label prefix, arrow opacity.
//   NOT a federation gate condition. Room recipes MAY filter by stage as
//   operator-configured predicates, but stage does not appear in the
//   hardcoded visibility predicate or Orichalcum capability caveats.
// ---------------------------------------------------------------------------

/** Structural quality ladder — lowest (noise) to highest (kapu). Gate: ≥meme to federate. */
export const RATING_5 = ["noise", "data", "meme", "ano", "kapu"] as const;
export type Rating5 = typeof RATING_5[number];

/**
 * UX stage ladder — masks/voices rendering annotation only.
 * Maps onto the confidence scalar: GR 0.01–0.19, OS 0.20–0.39,
 * US 0.40–0.59, CS 0.60–0.79, DS 0.80–1.00.
 * NOT a federation gate condition.
 */
export const STAGE_5 = ["GR", "OS", "US", "CS", "DS"] as const;
export type Stage5 = typeof STAGE_5[number];

/**
 * Map a raw scalar to its Stage5 UX band label.
 * The scalar is a separate concept (operator-set or derived); Stage5 is the
 * masks/voices rendering label derived from it. Two distinct things.
 */
export function scalarToStageBand(scalar: number): Stage5 {
  if (scalar >= 0.80) return "DS";
  if (scalar >= 0.60) return "CS";
  if (scalar >= 0.40) return "US";
  if (scalar >= 0.20) return "OS";
  return "GR";
}

/** Stage5 band → representative scalar midpoint (for display and defaults). */
export const STAGE_BAND_MID: Record<Stage5, number> = {
  GR: 0.10,
  OS: 0.30,
  US: 0.50,
  CS: 0.70,
  DS: 0.90,
};

/**
 * Rating5 → canonical tldraw color name.
 * Used by template props when color === "rating".
 * Noise/Data are node-local only and render muted; Meme+ federate.
 */
export const RATING_COLOR: Record<Rating5, string> = {
  noise: "grey",
  data:  "blue",
  meme:  "green",
  ano:   "orange",
  kapu:  "violet",
};

// ---------------------------------------------------------------------------
// Stances (Syad perspectives) — five epistemic standpoints.
// Register measures confidence *within* the active stance; not universal truth.
// ---------------------------------------------------------------------------

export const STANCES = ["philosopher", "poet", "satirist", "humorist", "private"] as const;
export type Stance = typeof STANCES[number];

// ---------------------------------------------------------------------------
// Syad (Jaina Saptabhangi) — 7 truth-value compounds.
// Three primitives T/F/M yield 7 compounds. P5/P6 are threshold crossings
// (stance past its boundary). P7 maps to Arcana only — no Stance mediates it.
// Poet and Private share P3; feed direction (Tool graph) differentiates them.
// Satirist: stated=P2, operational=P6 (maturity gradient within one stance).
// ---------------------------------------------------------------------------

export const SYAD_7 = [
  "asti",                    // P1 T       — Philosopher
  "nasti",                   // P2 F       — Satirist (stated)
  "avaktavya",               // P3 M       — Poet (outward) / Private (inward)
  "asti-nasti",              // P4 T+F     — Humorist
  "asti-avaktavya",          // P5 T+M     — threshold: Philosopher past boundary
  "nasti-avaktavya",         // P6 F+M     — threshold / Satirist operational
  "asti-nasti-avaktavya",    // P7 T+F+M   — Arcana only
] as const;
export type Syad7 = typeof SYAD_7[number];

/** Primary Syad predicate for each stance. Satirist maps to stated (P2); see SATIRIST_OPERATIONAL for P6. */
export const STANCE_SYAD: Record<Stance, Syad7> = {
  philosopher: "asti",
  poet:        "avaktavya",
  satirist:    "nasti",
  humorist:    "asti-nasti",
  private:     "avaktavya",
};

/** Satirist operational predicate — held when stable, not just stated. */
export const SATIRIST_OPERATIONAL: Syad7 = "nasti-avaktavya";

// ---------------------------------------------------------------------------
// Tools (Chapel Perilous) — five orientation postures.
// ASCII symbols are URI-safe invariants used in HUD notation.
// Two axes: feed (external | internal | release) × aperture (wide | narrow | release).
// Arcana has no Stance intermediary; maps directly to Syad P7.
// ---------------------------------------------------------------------------

export const TOOLS = ["wand", "cup", "sword", "pentacle", "arcana"] as const;
export type Tool = typeof TOOLS[number];

/** ASCII sigil for each tool. */
export const TOOL_ASCII: Record<Tool, string> = {
  wand:     "*",
  cup:      "?",
  sword:    "!",
  pentacle: "~",
  arcana:   "-",
};

export type ToolFeed     = "external" | "internal" | "release";
export type ToolAperture = "wide" | "narrow" | "release";

export const TOOL_FEED: Record<Tool, ToolFeed> = {
  wand:     "external",
  cup:      "external",
  sword:    "external",
  pentacle: "internal",
  arcana:   "release",
};

export const TOOL_APERTURE: Record<Tool, ToolAperture> = {
  wand:     "wide",
  cup:      "wide",
  sword:    "narrow",
  pentacle: "narrow",
  arcana:   "release",
};

// ---------------------------------------------------------------------------
// Render modes — canonical values for PranaEdge.renderMode.
// The render layer switches on these; null means default arrow treatment.
// ---------------------------------------------------------------------------

export const RENDER_MODES = [
  "reaction-wire",   // papalohe — trigger label at source, fn label at target
] as const;
export type RenderMode = typeof RENDER_MODES[number];

// ---------------------------------------------------------------------------
// Canonical roles per family — informational; not exhaustive.
// roleRecommended families should carry one of these (or a custom string).
// ---------------------------------------------------------------------------

export const REACTION_ROLES = ["subscription", "handler", "callback"] as const;
export type ReactionRole = typeof REACTION_ROLES[number];

// ---------------------------------------------------------------------------
// GrammarRules — external grammar interface (Phase 2+)
//
// Loaded from lares/grammars/memetic-wikitext.md; overrides built-in patterns
// and family contracts. Accepted as optional arg by parseMemeCarrier and
// parsePranalaEdges.
// ---------------------------------------------------------------------------

export interface SigilRule {
  name: string;
  kind: "worksite" | "edge" | "edge-sugar" | "metadata" | "header" | "concurrency" | "query" | "guest-grammar" | "guest-grammar-alias" | "query-alias" | "pragma" | "conditional" | "conditional-else" | "conditional-branch" | "iteration" | "context" | "concurrency-alias" | "edge-alias" | "pragma-alias" | "iteration-alias" | "conditional-alias";
  layer?: "compile" | "render" | "both";
  inlinePattern?: string;
  blockPattern?: string;
  openPattern?: string;
  closePattern?: string;
  pattern?: string;
  pragmaPattern?: string;
  aliasFor?: string;
  defaultFamily?: string;
  defaultPropagation?: string;
}

export interface FamilyRule {
  name: string;
  dagRequired: boolean;
  roleRecommended: boolean;
  confidenceBounded: boolean;
}

export interface GrammarRules {
  sigils: SigilRule[];
  families: FamilyRule[];
}
