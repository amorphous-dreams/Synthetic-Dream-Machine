/**
 * @lararium/tw5 — TW5 as the active isomorphic render engine for Lararium.
 *
 * Primary exports:
 *   TW5Engine               — clean isomorphic TW5 VM (boot/render/tiddler mutation)
 *   IslandAdaptor           — causal-island↔TW5 wiki bridge; inbound buffer/flush + outbound writes
 *   IslandAccumulator         — live crdt-remote patch queue; drained by startRenderLoop()
 *   MemoryTiddlerStore      — in-memory LarTiddlerStore (tests / fixtures)
 *   VmPool                  — generic isomorphic VM lifecycle manager
 *   DirectMemeRecipeVm      — in-process TW5Engine wrapper; bootMemeRecipeVm boot helper
 *
 * Widget tree ownership:
 *   Messaging (papalohe/kukali/lele) and kumu device instances are native
 *   TW5 widgets registered via createLarariumWidgets(). The active TW5Engine
 *   builds the widgetTree and fakeDOM on each render call.
 */

export { TW5Engine } from "./tw5-vm.js";
export type { TW5CoreBootBlob, CameraRegistration, CameraMount } from "./tw5-vm.js";

export { IslandAdaptor } from "./island-adaptor.js";
export { MemoryTiddlerStore } from "./memory-store.js";
export type { ProjectionStore } from "./memory-store.js";
export type { MemeRecipeVm } from "@lararium/types";
export { MemeProvider } from "@lararium/types";
export type { MemeProjection } from "@lararium/types";
export type {
  LarTiddlerStore, LarTiddlerRecord, LarTiddlerChange, ChangeOrigin,
  ClosureEntry, EdgeRecord,
} from "@lararium/types";
export type { PranalaEdge, PranalaEdgeViolation, PranalaViolationSeverity, GrammarRules, SigilRule, FamilyRule } from "@lararium/types";
export { IslandAccumulator } from "@lararium/types";
export { MemeStreamParser } from "@lararium/types";
export type { MemeStreamEvent } from "@lararium/types";
export { ReactionGraph, extractReactionBindings } from "@lararium/types";
export type { ReactionBinding } from "@lararium/types";

export { DirectMemeRecipeVm, bootMemeRecipeVm } from "./meme-recipe-vm.js";

export { exportMemeText, buildDirectRecord } from "./meme-write.js";
export { promoteUris, planPromoteUris } from "./modules/lar-promote.js";
export type { PromoteWiki, PromoteResult, PromotePlan, PromotePlannedRecord } from "./modules/lar-promote.js";

export { tw5ElementToVdom, tw5ElementToHtml } from "./fake-dom.js";
export type { VDomNode, TW5FakeElement, TW5FakeTextNode, TW5FakeNode } from "./fake-dom.js";

export { TW5_VERSION, TW5_CORE_SCRIPT_FILENAME, TW5_CORE_DIR } from "./generated-tw5-version.js";

export { parseTaploFields, patchTomlKey, lintToml } from "./toml-ast.js";

export type { BagTiddler, RecipeTiddler } from "./recipe.js";
export { bagDescriptorUri, recipeUri, parseBagStack, parsePlugins } from "./recipe.js";



export { TW5WorkerProxy } from "./tw5-worker-proxy.js";

export { buildCeremonyTiddlers, didKeyFromVerifyingKey } from "./cold-boot-ceremony.js";
export type { CeremonyTiddler } from "./cold-boot-ceremony.js";
export type { WorkerFactory, AnyWorker } from "./tw5-worker-proxy.js";

// ---------------------------------------------------------------------------
// Active type re-exports
// ---------------------------------------------------------------------------

export type { TiddlerFields } from "./deserializer.js";
export type { FilterEngineFn } from "@lararium/types";
