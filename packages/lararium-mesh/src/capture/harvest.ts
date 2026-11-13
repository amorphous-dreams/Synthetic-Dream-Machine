/**
 * harvest — the PURE capture surface (no Automerge), safe to bundle into a TW5 plugin module.
 *
 * The mesh barrel (`@lararium/mesh`) transitively pulls in Automerge (Repo/resolver), which a TW5
 * plugin build can't bundle (wasm). A plugin module that needs the pure capture pieces imports them
 * from this subpath (`@lararium/mesh/harvest`) — the same pure-subpath idiom grammar-cache uses for
 * `@lararium/mesh/lar-uris`: the FFZ membership address, the fork frontier with its handle
 * derivations, and the gone-turn reading.
 */

export * from "../ffz-project.js";
export * from "./branch-frontier.js";
export * from "./gone-turns.js";
