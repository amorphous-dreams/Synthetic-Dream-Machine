/**
 * @lararium/tw5 — TW5 as the active isomorphic render engine for Lararium.
 *
 * Primary exports:
 *   TW5Engine               — clean isomorphic TW5 VM (boot/render/tiddler mutation)
 *   MemeSyncAdaptor         — TW5 SyncAdaptor backed by LarTiddlerStore (Automerge)
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
export type { ZoomLayout } from "./tw5-vm.js";

export { MemeSyncAdaptor } from "./meme-sync-adaptor.js";
export { MemoryTiddlerStore } from "./memory-store.js";
export { VmPool } from "./vm-pool.js";

export { DirectMemeRecipeVm, bootMemeRecipeVm } from "./meme-recipe-vm.js";
export type { MemeRecipeVm } from "./meme-recipe-vm.js";

export { exportMemeText, buildDirectRecord, inferChildMemeTitle } from "./meme-write.js";

export { tw5ElementToVdom, tw5ElementToHtml } from "./fake-dom.js";
export type { VDomNode, TW5FakeElement, TW5FakeTextNode, TW5FakeNode } from "./fake-dom.js";

export { TW5_VERSION, TW5_CORE_SCRIPT_FILENAME, TW5_CORE_SCRIPT_URL } from "./generated-tw5-version.js";

export { parseTaploFields, patchTomlKey, lintToml } from "./toml-ast.js";

export { parseZoomLayoutTOML, getZoomLayout } from "./zoom-layout.js";


export { TW5WorkerProxy } from "./tw5-worker-proxy.js";

// ---------------------------------------------------------------------------
// @deprecated web2-era type stubs — kept so existing callers compile.
// ---------------------------------------------------------------------------

// carrier-codec type stubs (CarrierSplit, ParentTiddler, ChildTiddler)
export type { CarrierSplit, ParentTiddler, ChildTiddler } from "./carrier-codec.js";

// TiddlerFields — canonical home is deserializer.ts
export type { TiddlerFields } from "./deserializer.js";

// Parser AST type stub
export type { TW5ParseNode } from "./memetic-parser.js";

// VmDebugSurface type stub
export type { VmDebugSurface } from "./server-api.js";

// RecipeVm / SerializedRecord type stubs (recipe-vm.ts is a stub)
export type { RecipeVm, SerializedRecord } from "./recipe-vm.js";

// FilterEngineFn lives in @lararium/core
export type { FilterEngineFn } from "@lararium/core";
