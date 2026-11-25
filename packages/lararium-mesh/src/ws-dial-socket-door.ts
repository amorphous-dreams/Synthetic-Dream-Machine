/**
 * ws-dial-socket-door: the names the package barrel exports from `ws-dial-socket.ts`, on a subpath of their own.
 *
 * `ws-dial-socket.ts` exports more than the barrel lends (helpers its own package composes with); a reader that names a
 * subpath instead of the barrel reaches this door, which carries exactly the barrel's names from that module and
 * nothing else. `tools/mesh-barrel-witness.test.mjs` holds every exported subpath to the barrel's reach.
 */
export { wsDialSocket } from "./ws-dial-socket.js";
export type { WsFactory, WsFactoryOptions, WsLike } from "./ws-dial-socket.js";
