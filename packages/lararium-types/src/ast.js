// ast.ts — edge-vocabulary types and Law of Fives constants.
//
// MemeAstNode and parse-tree node types live in @lararium/tw5/ast.ts — they
// compile into TW5 CJS parser modules and must not create a circular dep here.
//
// What stays here: PranalaEdge, GrammarRules, SigilRule, FamilyRule,
// Law of Fives ladders, Stance/Syad/Tool vocabulary. These are shared by
// meme-graph.ts, compiler.ts, and carrier.ts without pulling in the parser.
// ---------------------------------------------------------------------------
// Law of Fives — invariant 5-point ladders
//
// Two orthogonal axes appear across every domain in the system.
// Scale tells you the size of a loop. Phase tells you where in it you are.
// They run in opposite directions: Act covers the finest-grain scale (Action);
// Observe covers the widest-lens scale (Week). This tension is productive.
//
// All domain-specific ladders (scope, zoom, Kowloon addressing, lifecycle)
// are projections of LADDER_5. All phase/confidence/stance systems are
// projections of OODA_HA_5.
// ---------------------------------------------------------------------------
// Schema: lar:///ha.ka.ba/@lares/api/v0.1/mu/the-law-of-5s
/** Temporal/spatial scale ladder — finest (action) to coarsest (week). */
export const LADDER_5 = ["action", "round", "turn", "watch", "week"];
/** OODA-HA phase cycle — active (act) to reflective (aftermath). */
export const OODA_HA_5 = ["act", "decide", "orient", "observe", "aftermath"];
/** Scope principle ladder — maps 1:1 onto LADDER_5. */
export const SCOPE_5 = ["ephemeral", "personal", "consensual", "collective", "universal"];
/** Scope → Ladder5 projection. */
export const SCOPE_TO_LADDER = {
    ephemeral: "action",
    personal: "round",
    consensual: "turn",
    collective: "watch",
    universal: "week",
};
// ---------------------------------------------------------------------------
// Law of Fives — rating and stage ladders
//
// rating = structural quality of the carrier (Noise→Data→Meme→Ano→Kapu)
//   Used in federation gate: only Meme+ carriers federate.
//
// stage  = UX/rendering annotation (GR→OS→US→CS→DS, from confidence scalar)
//   Used in masks/voices layer: color temperature, label prefix, arrow opacity.
//   NOT a federation gate condition.
// ---------------------------------------------------------------------------
// Schema: lar:///ha.ka.ba/@lares/api/v0.1/mu/the-law-of-5s (rating/stage ladders)
/** Structural quality ladder — lowest (noise) to highest (kapu). Gate: ≥meme to federate. */
export const RATING_5 = ["noise", "data", "meme", "ano", "kapu"];
/**
 * UX stage ladder — masks/voices rendering annotation only.
 * Maps onto the confidence scalar: GR 0.01–0.19, OS 0.20–0.39,
 * US 0.40–0.59, CS 0.60–0.79, DS 0.80–1.00.
 * NOT a federation gate condition.
 */
export const STAGE_5 = ["GR", "OS", "US", "CS", "DS"];
/**
 * Map a raw scalar to its Stage5 UX band label.
 * The scalar is a separate concept (operator-set or derived); Stage5 is the
 * masks/voices rendering label derived from it. Two distinct things.
 */
export function scalarToStageBand(scalar) {
    if (scalar >= 0.80)
        return "DS";
    if (scalar >= 0.60)
        return "CS";
    if (scalar >= 0.40)
        return "US";
    if (scalar >= 0.20)
        return "OS";
    return "GR";
}
/** Stage5 band → representative scalar midpoint (for display and defaults). */
export const STAGE_BAND_MID = {
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
export const RATING_COLOR = {
    noise: "grey",
    data: "blue",
    meme: "green",
    ano: "orange",
    kapu: "violet",
};
// ---------------------------------------------------------------------------
// Stances (Syad perspectives) — five epistemic standpoints.
// Register measures confidence *within* the active stance; not universal truth.
// ---------------------------------------------------------------------------
// Schema: lar:///ha.ka.ba/@lares/api/v0.1/mu/the-syad-perspectives
export const STANCES = ["philosopher", "poet", "satirist", "humorist", "private"];
// ---------------------------------------------------------------------------
// Syad (Jaina Saptabhangi) — 7 truth-value compounds.
// Three primitives T/F/M yield 7 compounds. P5/P6 are threshold crossings
// (stance past its boundary). P7 maps to Arcana only — no Stance mediates it.
// Poet and Private share P3; feed direction (Tool graph) differentiates them.
// Satirist: stated=P2, operational=P6 (maturity gradient within one stance).
// ---------------------------------------------------------------------------
export const SYAD_7 = [
    "asti", // P1 T       — Philosopher
    "nasti", // P2 F       — Satirist (stated)
    "avaktavya", // P3 M       — Poet (outward) / Private (inward)
    "asti-nasti", // P4 T+F     — Humorist
    "asti-avaktavya", // P5 T+M     — threshold: Philosopher past boundary
    "nasti-avaktavya", // P6 F+M     — threshold / Satirist operational
    "asti-nasti-avaktavya", // P7 T+F+M   — Arcana only
];
/** Primary Syad predicate for each stance. Satirist maps to stated (P2); see SATIRIST_OPERATIONAL for P6. */
export const STANCE_SYAD = {
    philosopher: "asti",
    poet: "avaktavya",
    satirist: "nasti",
    humorist: "asti-nasti",
    private: "avaktavya",
};
/** Satirist operational predicate — held when stable, not just stated. */
export const SATIRIST_OPERATIONAL = "nasti-avaktavya";
// ---------------------------------------------------------------------------
// Tools (Chapel Perilous) — five orientation postures.
// ASCII symbols are URI-safe invariants used in HUD notation.
// Two axes: feed (external | internal | release) × aperture (wide | narrow | release).
// Arcana has no Stance intermediary; maps directly to Syad P7.
// ---------------------------------------------------------------------------
// Schema: lar:///ha.ka.ba/@lares/api/v0.1/mu/the-four-tools
export const TOOLS = ["wand", "cup", "sword", "pentacle", "arcana"];
/** ASCII sigil for each tool. */
export const TOOL_ASCII = {
    wand: "*",
    cup: "?",
    sword: "!",
    pentacle: "~",
    arcana: "-",
};
export const TOOL_FEED = {
    wand: "external",
    cup: "external",
    sword: "external",
    pentacle: "internal",
    arcana: "release",
};
export const TOOL_APERTURE = {
    wand: "wide",
    cup: "wide",
    sword: "narrow",
    pentacle: "narrow",
    arcana: "release",
};
// ---------------------------------------------------------------------------
// Hawaiian ↔ Verse 5.6+ ↔ English concept mapping (core grammar reference)
//
// Hawaiian serves as the core grammar for load-bearing concepts.
// Verse 5.6+ names align to the UEFN target.
// English names serve as grammar-internal terms or programmer aliases only.
//
// ┌──────────────────────────┬──────────────────────────────┬──────────────────────────────┐
// │ Hawaiian / Lararium      │ Verse 5.6+ concept           │ English (alias/internal)     │
// ├──────────────────────────┼──────────────────────────────┼──────────────────────────────┤
// │ pranala                  │ edge (compositional link)    │ link / edge                  │
// │ ahu                      │ device class body scope      │ worksite / enclosure         │
// │ kahea                    │ summon sigil                 │ live summon / portal-in          │
// │ kau                      │ instance sigil               │ emplace / instantiate        │
// │ kumu                     │ creative_device class        │ device type                  │
// │ papalohe                 │ event→fn pin wire (editor)   │ reaction wire / binding      │
// │ kukali                   │ Await(event)<suspends>       │ suspend / single-shot await  │
// │ pono                     │ constraint / validation      │ correct / validate           │
// │ lele                     │ dispatch / jump              │ dispatch                     │
// │ loulou                   │ link sugar sigil             │ link                         │
// │ aka                      │ alias sugar sigil            │ shadow summon / transclusion │
// ├──────────────────────────┼──────────────────────────────┼──────────────────────────────┤
// │ Pranala reaction roles (type-level declarations on kumu type memes):                   │
// ├──────────────────────────┼──────────────────────────────┼──────────────────────────────┤
// │ (role: "listenable")     │ listenable OUTPUT event pin  │ listenable                   │
// │  → KumuListenable        │ Verse `listenable` value     │                              │
// │ (role: "subscribable")   │ @subscribes INPUT fn pin     │ subscribable                 │
// │  → KumuSubscribable      │ Verse `@subscribes` fn       │                              │
// │ (role: "observes")       │ passive observer (no fn)     │ watches / monitors           │
// │ (grammar-internal)       │ throttles / debounces        │ rate-control modifiers       │
// ├──────────────────────────┼──────────────────────────────┼──────────────────────────────┤
// │ ReactionBinding.source (instance-level wiring origin):                                 │
// │  "wired"                 │ editor-wired pin connection  │ static / design-time         │
// │  "subscribed"            │ Subscribe() call in code     │ dynamic / runtime            │
// ├──────────────────────────┼──────────────────────────────┼──────────────────────────────┤
// │ Instance-level wiring (papalohe edges, NOT type declarations):                         │
// │  listenable field        │ source listenable name       │ listenable name              │
// │  subscribable field      │ target @subscribes fn name   │ subscribable name            │
// └──────────────────────────┴──────────────────────────────┴──────────────────────────────┘
//
// ---------------------------------------------------------------------------
// Render modes — canonical values for PranalaEdge.renderMode.
// Hawaiian name carries primary weight; English serves as the internal programmer alias.
// ---------------------------------------------------------------------------
// Schema: lar:///ha.ka.ba/@lares/api/v0.1/pono/reaction-graph
export const RENDER_MODES = [
    "papalohe", // reaction wire — event OUTPUT pin → function INPUT pin; trigger label at source, fn label at target
];
/** English alias: "reaction-wire" → RENDER_MODES["papalohe"]. Use `"papalohe"` in new code. */
export const RENDER_MODE_REACTION_WIRE = "papalohe";
// ---------------------------------------------------------------------------
// Reaction roles — Verse 5.6+ aligned type-level declarations.
//
// These mark the KNOWN role values for `reaction` family pranala edges on type
// memes (KumuDeviceSpec derivation). NOT instance-level wiring (that is the
// papalohe sigil on instance memes, carrying listenable/subscribable payload fields).
// ---------------------------------------------------------------------------
export const REACTION_ROLES = [
    "listenable", // OUTPUT event pin — this device EMITS (Verse `listenable`; declare on kumu type)
    "subscribable", // INPUT function pin — this device EXPOSES (Verse `@subscribes`; declare on kumu type)
    "observes", // passive observation — no subscription callback registered
    "throttles", // rate-control modifier (grammar-internal)
    "debounces", // rate-control modifier (grammar-internal)
];
//# sourceMappingURL=ast.js.map