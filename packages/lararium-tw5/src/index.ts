/**
 * @lararium/tw5 — TW5 as the active isomorphic render engine for Lararium.
 *
 * Carries:
 *   LarariumTW5             — boot/filter/render interface; owns the widget pipeline
 *   LarariumCrdtSyncAdaptor — TW5 SyncAdaptor backed by LarTiddlerStore (Automerge)
 *   MemoryTiddlerStore      — in-memory LarTiddlerStore (tests / fixtures)
 *   bootRecipeVm            — boot a recipe VM (one VM per recipe, all projections)
 *   filterRecipe            — TW5 filter expression against loaded wiki state
 *   renderCarrier           — disk projection via TW5 VM (fakeDOM pipeline)
 *   filterMemesWikitext     — ClosureEntry filter utility (tests / CLI tools)
 *   toCanonicalWikitext     — wikitext-filter pre-processor
 *   entryToFields           — ClosureEntry → TW5 tiddler fields
 *   buildEdgeFieldMap       — pranala edges → TW5 edge-out-* fields
 *
 * Widget tree ownership:
 *   Messaging (papalohe/kukali/lele) and kumu device instances are native
 *   TW5 widgets registered via createLarariumWidgets(). The active TW5 instance
 *   builds the widgetTree and fakeDOM on each renderMeme() call — no parallel
 *   render path needed.
 */

export { LarariumTW5, toCanonicalWikitext } from "./lararium-tw5.js";
export type { FilterEngineFn, TW5SyncAdaptor } from "./lararium-tw5.js";

// ---------------------------------------------------------------------------
// Active TW5 accessor — module-level, React-free.
//
// TW5 is a first-class citizen, not a React dependency.
// Any code (tldraw callbacks, MCP handlers, tests) calls getActiveTW5()
// without needing React context or prop threading.
//
// lararium-browser-host calls setActiveTW5(instance) after boot and
// setActiveTW5(null) on room teardown.
// ---------------------------------------------------------------------------

export { setActiveTW5, getActiveTW5 } from "./active-tw5.js";

export { LarariumCrdtSyncAdaptor } from "./sync-adaptor.js";
export { MemoryTiddlerStore }      from "./memory-store.js";

// @deprecated web2-era — carrier-codec re-exports. Use deserializer.ts TiddlerFields instead.
export { parseCarrier, splitCarrierToTiddlers, replaceCarrierSlot, composeCarrierSlotBody, streamEventsToTiddlers } from "./carrier-codec.js";
export type { CarrierSplit, ParentTiddler, ChildTiddler } from "./carrier-codec.js";

// TiddlerFields — canonical home is now deserializer.ts
export type { TiddlerFields } from "./deserializer.js";

export { tw5ElementToVdom, tw5ElementToHtml } from "./fake-dom.js";
export type { VDomNode, TW5FakeElement, TW5FakeTextNode, TW5FakeNode } from "./fake-dom.js";

// @deprecated web2-era — memetic-parser re-exports. Rebuild target: meme-parser.ts.
export {
  MemeticParser,
  parseCarrierToTw5,
  buildCarrierAndTw5Tree,
  astToTw5Tree,
} from "./memetic-parser.js";
export type { TW5ParseNode } from "./memetic-parser.js";

export { TW5_VERSION, TW5_CORE_SCRIPT_FILENAME, TW5_CORE_SCRIPT_URL } from "./generated-tw5-version.js";

export { parseTaploFields, patchTomlKey, lintToml } from "./toml-ast.js";

export { entryToFields, buildEdgeFieldMap } from "./closure-fields.js";
export { parseZoomLayoutTOML, getZoomLayout } from "./zoom-layout.js";
export type { ZoomLayout } from "./zoom-layout.js";
export { bindingsForUri, buildReactionGraph } from "./reaction-query.js";
export { bootRecipeVm, attachRecipeVm, releaseRecipeVm, makeRecipeId, liveVmCount, listRecipeIds, filterRecipe, precomputeRecipeRooms, renderCarrier, vmDebugSurface } from "./server-api.js";
export type { VmDebugSurface } from "./server-api.js";
export type { RecipeVm, SerializedRecord } from "./recipe-vm.js";
export { DirectRecipeVm } from "./recipe-vm.js";
export { TW5WorkerProxy } from "./tw5-worker-proxy.js";
export { VmPool } from "./vm-pool.js";
export { filterMemesWikitext } from "./filter-compat.js";
// @deprecated web2-era — carrier-write re-export. Rebuild target: meme-write.ts.
export { exportCarrierText } from "./carrier-write.js";
export { LarDiskProjector } from "./disk-sync-adaptor.js";

// ---------------------------------------------------------------------------
// Parser + AST — @deprecated web2-era. New model: @lararium/core/meme-ast.
//
// Re-exports remain so existing callers compile while the new model builds out.
// Rebuild targets:
//   parseMemeCarrier / edgesFromAst / buildAst  →  parseMemeText / edgesFromMemeAst / buildMemeAst
//   CarrierNode                                 →  MemeNode
//   grammarRulesFromText / parsePranalaEdges    →  @lararium/core/meme-grammar (TBD)
// ---------------------------------------------------------------------------

// @deprecated web2-era
export { parseMemeCarrier, edgesFromAst, collectEvents, buildAst, parseCarrierNode } from "./parser.js";
// @deprecated web2-era — use @lararium/core/meme-ast types instead
export type {
  MemeAstKind,
  MemeAstNode,
  AhuNode,
  PranalaNode,
  PranalaSugarNode,
  LeleNode,
  PaeNode,
  TextNode,
  SigilNode,
  DynamicNode,
  CarrierNode,
  PaePhase,
} from "./ast.js";
// @deprecated web2-era
export { grammarRulesFromText, parsePranalaEdges } from "./pranala-parser.js";
