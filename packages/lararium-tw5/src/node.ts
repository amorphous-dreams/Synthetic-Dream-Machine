/**
 * @lararium/tw5/node — Node-only exports.
 *
 * Keep filesystem-backed projections off the browser-facing @lararium/tw5
 * barrel so Vite never sees fs/path through the app import graph.
 */

export { LarDiskProjector } from "./disk-sync-adaptor.js";
