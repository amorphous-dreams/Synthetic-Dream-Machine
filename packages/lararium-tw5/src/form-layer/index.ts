/**
 * form-layer — the daemon-side living-grammar form surface.
 * Meme: lar:///ha.ka.ba/lararium/api/living-grammar-palace
 *
 * P0 pins the constructicon basis (the grammar-SEED axes), pure and isomorphic. The
 * teleodynamic probe reads a self-read sequence beside it.
 */

export type {
  GrammarLayer,
  AxisCategory,
  ConstructiconAxis,
  ConstructiconBasis,
  PhaseDef,
  WardStateDef,
} from "./constructicon-basis.js";
export {
  GRAMMAR_LAYERS,
  VOICE_ROLES,
  VOICE_HANDLE_TO_ROLE,
  OODA_HA_PHASES,
  WARD_STATES,
  CATEGORY_ORDER,
  resolveVoiceRole,
  phaseForGlyph,
  wardStateForGlyph,
  buildConstructiconBasis,
} from "./constructicon-basis.js";

// The teleodynamic-probe — a PROVISIONAL-HYPOTHESIS probe (NOT Canon) for the
// eigenform-motor claim. Instruments a teleodynamic triple (aftermath-rate ·
// structural-change-rate · freeze) over the machina's OWN self-read sequence.
// Pure + isomorphic. Every reading it emits carries `provisional: true`.
export type {
  SelfRead,
  TeleodynamicGauge,
  ApertureBand,
  TeleodynamicReading,
  MotorSignal,
  ProbeOptions,
} from "./teleodynamic-probe.js";
export { teleodynamicProbe, apertureBandFor } from "./teleodynamic-probe.js";

// Re-export the shared grammar + AST shapes the basis/emitter index against, so
// consumers (and tests) take them from the form-layer surface — never reaching
// into the VM-sovereign meme-ast internals directly (vm-grammar-boundary).
export type {
  GrammarRules,
  SigilRule,
  FamilyRule,
  MemeAstNode,
  MemeAstKind,
  AhuNode,
  SigilNode,
  PranalaSugarNode,
  TextNode,
} from "../meme-ast/types.js";
