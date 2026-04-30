/**
 * @lararium/tw5 — TW5 as the active isomorphic render engine for Lararium.
 *
 * Carries:
 *   LarariumTW5             — boot/filter/render interface; owns the widget pipeline
 *   LarariumCrdtSyncAdaptor — TW5 SyncAdaptor backed by LarTiddlerStore (Automerge)
 *   MemoryTiddlerStore      — in-memory LarTiddlerStore (tests / fixtures)
 *   filterMemesWikitext     — functional filter API used by @lararium/node + MCP
 *   precomputeRooms         — batch filter for snapshot builder
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

export {
  LarariumTW5,
  filterMemesWikitext,
  precomputeRooms,
  toCanonicalWikitext,
  entryToFields,
  buildEdgeFieldMap,
} from "./lararium-tw5.js";

export type { FilterEngineFn, ZoomLayout, TW5SyncAdaptor } from "./lararium-tw5.js";

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
export { LarDiskSyncAdaptor }      from "./disk-sync-adaptor.js";
export { MemoryTiddlerStore }      from "./memory-store.js";

export { splitCarrierToTiddlers, serializeCarrier, replaceCarrierSlot, streamEventsToTiddlers } from "./carrier-split.js";
export type { CarrierSplit, ParentTiddler, ChildTiddler, TiddlerFields } from "./carrier-split.js";

export { tw5ElementToVdom, tw5ElementToHtml } from "./fake-dom.js";
export type { VDomNode, TW5FakeElement, TW5FakeTextNode, TW5FakeNode } from "./fake-dom.js";

export {
  MemeticParser,
  parseCarrierToTw5,
  buildCarrierAndTw5Tree,
  astToTw5Tree,
} from "./memetic-parser.js";
export type { TW5ParseNode } from "./memetic-parser.js";
