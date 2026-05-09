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
// VmPool and MemeRecipeVm are isomorphic contracts — they live in @lararium/core.
// Import them from there: import { VmPool, MemeRecipeVm } from "@lararium/core".

export { DirectMemeRecipeVm, bootMemeRecipeVm } from "./meme-recipe-vm.js";

export { exportMemeText, buildDirectRecord, inferChildMemeTitle } from "./meme-write.js";

export { tw5ElementToVdom, tw5ElementToHtml } from "./fake-dom.js";
export type { VDomNode, TW5FakeElement, TW5FakeTextNode, TW5FakeNode } from "./fake-dom.js";

export { TW5_VERSION, TW5_CORE_SCRIPT_FILENAME } from "./generated-tw5-version.js";

export { parseTaploFields, patchTomlKey, lintToml } from "./toml-ast.js";

export { parseZoomLayoutTOML, getZoomLayout } from "./zoom-layout.js";


export { TW5WorkerProxy } from "./tw5-worker-proxy.js";

export { buildCeremonyTiddlers, didKeyFromVerifyingKey } from "./cold-boot-ceremony.js";
export type { CeremonyTiddler } from "./cold-boot-ceremony.js";
export type { WorkerFactory, AnyWorker } from "./tw5-worker-proxy.js";

// ---------------------------------------------------------------------------
// Active type re-exports
// ---------------------------------------------------------------------------

export type { TiddlerFields } from "./deserializer.js";
export type { TW5ParseNode } from "./memetic-parser.js";
export type { FilterEngineFn } from "@lararium/core";
