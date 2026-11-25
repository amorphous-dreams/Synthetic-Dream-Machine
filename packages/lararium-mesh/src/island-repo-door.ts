/**
 * island-repo-door: the names the package barrel exports from `island-repo.ts`, on a subpath of their own.
 *
 * `island-repo.ts` exports more than the barrel lends (helpers its own package composes with); a reader that names a
 * subpath instead of the barrel reaches this door, which carries exactly the barrel's names from that module and
 * nothing else. `tools/mesh-barrel-witness.test.mjs` holds every exported subpath to the barrel's reach.
 */
export { makeIslandRepo, attachMessageChannelSync, replicaHeads, islandPeersOf, markIslandArrival, markWikiIslandPeer, wikiIslandPeersOf } from "./island-repo.js";
export type { IslandRepoConfig } from "./island-repo.js";
