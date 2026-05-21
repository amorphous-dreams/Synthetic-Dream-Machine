export interface PranalaEdge {
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
export type PranalaViolationSeverity = "error" | "warning";
export interface PranalaEdgeViolation {
    readonly fromUri: string;
    readonly toUri: string;
    readonly family: string;
    readonly severity: PranalaViolationSeverity;
    readonly rule: string;
    readonly message: string;
}
/** Temporal/spatial scale ladder — finest (action) to coarsest (week). */
export declare const LADDER_5: readonly ["action", "round", "turn", "watch", "week"];
export type Ladder5 = typeof LADDER_5[number];
/** OODA-HA phase cycle — active (act) to reflective (aftermath). */
export declare const OODA_HA_5: readonly ["act", "decide", "orient", "observe", "aftermath"];
export type OodaHa5 = typeof OODA_HA_5[number];
/** Scope principle ladder — maps 1:1 onto LADDER_5. */
export declare const SCOPE_5: readonly ["ephemeral", "personal", "consensual", "collective", "universal"];
export type Scope5 = typeof SCOPE_5[number];
/** Scope → Ladder5 projection. */
export declare const SCOPE_TO_LADDER: Record<Scope5, Ladder5>;
/** Structural quality ladder — lowest (noise) to highest (kapu). Gate: ≥meme to federate. */
export declare const RATING_5: readonly ["noise", "data", "meme", "ano", "kapu"];
export type Rating5 = typeof RATING_5[number];
/**
 * UX stage ladder — masks/voices rendering annotation only.
 * Maps onto the confidence scalar: GR 0.01–0.19, OS 0.20–0.39,
 * US 0.40–0.59, CS 0.60–0.79, DS 0.80–1.00.
 * NOT a federation gate condition.
 */
export declare const STAGE_5: readonly ["GR", "OS", "US", "CS", "DS"];
export type Stage5 = typeof STAGE_5[number];
/**
 * Map a raw scalar to its Stage5 UX band label.
 * The scalar is a separate concept (operator-set or derived); Stage5 is the
 * masks/voices rendering label derived from it. Two distinct things.
 */
export declare function scalarToStageBand(scalar: number): Stage5;
/** Stage5 band → representative scalar midpoint (for display and defaults). */
export declare const STAGE_BAND_MID: Record<Stage5, number>;
/**
 * Rating5 → canonical tldraw color name.
 * Used by template props when color === "rating".
 * Noise/Data are node-local only and render muted; Meme+ federate.
 */
export declare const RATING_COLOR: Record<Rating5, string>;
export declare const STANCES: readonly ["philosopher", "poet", "satirist", "humorist", "private"];
export type Stance = typeof STANCES[number];
export declare const SYAD_7: readonly ["asti", "nasti", "avaktavya", "asti-nasti", "asti-avaktavya", "nasti-avaktavya", "asti-nasti-avaktavya"];
export type Syad7 = typeof SYAD_7[number];
/** Primary Syad predicate for each stance. Satirist maps to stated (P2); see SATIRIST_OPERATIONAL for P6. */
export declare const STANCE_SYAD: Record<Stance, Syad7>;
/** Satirist operational predicate — held when stable, not just stated. */
export declare const SATIRIST_OPERATIONAL: Syad7;
export declare const TOOLS: readonly ["wand", "cup", "sword", "pentacle", "arcana"];
export type Tool = typeof TOOLS[number];
/** ASCII sigil for each tool. */
export declare const TOOL_ASCII: Record<Tool, string>;
export type ToolFeed = "external" | "internal" | "release";
export type ToolAperture = "wide" | "narrow" | "release";
export declare const TOOL_FEED: Record<Tool, ToolFeed>;
export declare const TOOL_APERTURE: Record<Tool, ToolAperture>;
export declare const RENDER_MODES: readonly ["papalohe"];
export type RenderMode = typeof RENDER_MODES[number];
/** English alias: "reaction-wire" → RENDER_MODES["papalohe"]. Use `"papalohe"` in new code. */
export declare const RENDER_MODE_REACTION_WIRE: "papalohe";
export declare const REACTION_ROLES: readonly ["listenable", "subscribable", "observes", "throttles", "debounces"];
export type ReactionRole = typeof REACTION_ROLES[number];
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
//# sourceMappingURL=ast.d.ts.map