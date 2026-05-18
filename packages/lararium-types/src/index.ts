/**
 * @lararium/types — zero-dep shared types, interfaces, and isomorphic utilities.
 *
 * Consumed by both @lararium/tw5 and @lararium/mesh without creating a dep
 * between those two packages. Neither depends on the other; both depend here.
 *
 * Exports:
 *   ast              — PranalaEdge, GrammarRules, Law of Fives, Tool/Stance vocabulary
 *   tiddler-store    — LarTiddlerStore contract, LarTiddlerRecord, ChangeOrigin, ClosureEntry
 *   meme-provider    — MemeProjection interface + MemeProvider class (zero-dep coalescer)
 *   meme-stream      — MemeStreamEvent types + MemeStreamParser class
 *   live-protocol    — ReactionBinding, ReactionGraph, extractReactionBindings
 *   meme-recipe-vm   — MemeRecipeVm interface + bootMemeRecipeVm helper
 *   island-accumulator — IslandAccumulator (frame-aligned CRDT patch buffer)
 */

export type {
  PranalaEdge,
  PranalaEdgeViolation,
  PranalaViolationSeverity,
  GrammarRules,
  SigilRule,
  FamilyRule,
  Ladder5,
  OodaHa5,
  Scope5,
  Rating5,
  Stage5,
  Stance,
  Syad7,
  Tool,
  ToolFeed,
  ToolAperture,
  RenderMode,
  ReactionRole,
} from "./ast.js";

export {
  LADDER_5,
  OODA_HA_5,
  SCOPE_5,
  SCOPE_TO_LADDER,
  RATING_5,
  STAGE_5,
  scalarToStageBand,
  STAGE_BAND_MID,
  RATING_COLOR,
  STANCES,
  STANCE_SYAD,
  SATIRIST_OPERATIONAL,
  SYAD_7,
  TOOLS,
  TOOL_ASCII,
  TOOL_FEED,
  TOOL_APERTURE,
  RENDER_MODES,
  RENDER_MODE_REACTION_WIRE,
  REACTION_ROLES,
} from "./ast.js";

export type {
  ClosureEntry,
  EdgeRecord,
  LarTiddlerRecord,
  ChangeOrigin,
  LarTiddlerChange,
  LarTiddlerStore,
  FilterEngineFn,
} from "./tiddler-store.js";

export type { MemeProjection, RawPatch } from "./meme-provider.js";
export { MemeProvider } from "./meme-provider.js";

export type {
  StreamEventCarrierOpen,
  StreamEventAhuChild,
  StreamEventCarrierClose,
  StreamEventRealmDone,
  MemeStreamEvent,
} from "./meme-stream.js";
export { MemeStreamParser } from "./meme-stream.js";

export type {
  ReactionBinding,
  ReactionHandler,
  EdgeLike,
} from "./live-protocol.js";
export { ReactionGraph, extractReactionBindings } from "./live-protocol.js";

export type { MemeRecipeVm } from "./meme-recipe-vm.js";
export { bootMemeRecipeVm } from "./meme-recipe-vm.js";

export { IslandAccumulator } from "./island-accumulator.js";
