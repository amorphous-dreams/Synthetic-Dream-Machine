// ---------------------------------------------------------------------------
// @lararium/tldraw — local-first canvas projection for the Lararium wiki.
//
// Isomorphic layer (no tldraw runtime dep):
export * from "./view-state.js";
export * from "./zoom-levels.js";
export * from "./room.js";
export * from "./canvas-record.js";
export * from "./canvas-projection.js";

// Browser-only layer (tldraw peer dep required):
export * from "./nav.js";
export * from "./canvas-view.js";

