/**
 * @lararium/browser — browser vessel for the Lararium causal-islands system.
 *
 * Island Sovereignty Law (isomorphic): each island boots a Repo-in-island via transferred
 * syncPort; derives tiddler state from its own CRDT doc; owns timing via rAF drain.
 *
 * Primary exports:
 *   BrowserVesselIslandPool — island pool (mountWiki / unmountWiki / disposeAll).
 *   browser-wiki-worker — Web Worker entry (compiled separately; not re-exported here).
 */

export { BrowserVesselIslandPool } from "./browser-vessel-island-pool.js";
export type { BrowserVesselIslandPoolOptions } from "./browser-vessel-island-pool.js";

export { openBrowserVessel, DAEMON_SURFACE_ID } from "./open-browser-vessel.js";
export { holdVesselLock, vesselLockName, ambientLocks } from "./vessel-lock.js";
export type { LockHost, VesselLockHold } from "./vessel-lock.js";
export { publishHandleBrowser } from "./browser-handle-publish.js";
export { burnFaceBrowser, attestFaceBrowser, resolveOwnerBurnHandBrowser } from "./browser-handle-verbs.js";
export { composeBrowser } from "./browser-caps.js";
export type { BrowserVesselOptions, BrowserVesselResult } from "./open-browser-vessel.js";

export { mountCoherenceIndicator } from "./wiki-coherence-sink.js";
export type { CoherenceIndicatorSink, CoherenceFrameWithRev } from "./wiki-coherence-sink.js";

export {
  generateOrLoadBrowserVesselIdentity, loadBrowserSigningSeed, loadBrowserDeviceKey,
  openVesselIdb, idbGet, idbPut, idbDelete, idbKeys,
  readBrowserSeedWrap, writeBrowserSeedWrap, loadBrowserActivePersona, SEED_WRAP_STORE,
} from "./browser-vessel-identity.js";
// The opt-in PRF wrap of a persona-root seed at rest — beside the cleartext finding, never the mint.
export { detectPrf, ambientPrfHost, wrapSeed, unwrapSeed, SeedWrapRefused, SEED_WRAP_HKDF_INFO } from "./seed-wrap-prf.js";
export type { PrfHost, PrfDetection, SeedWrapRecord, SeedWrapKeyClass } from "./seed-wrap-prf.js";
export type { BrowserVesselIdentity } from "./browser-vessel-identity.js";
// The two-layer pet-names (#64 stage 4): the PRIVATE own-persona label map (fleet-only; never PUBLICLY
// federates) + the PUBLIC own-published-face record. Browser twins of the node fs stores; distinct from the
// handle-book.
export {
  makeBrowserPersonaPetnameStore, makeBrowserPublicHandleStore, makeBrowserPersonaDeclarationStore,
} from "./browser-vessel-identity.js";

export {
  writeBlobsToCasOpfs, readCasBlobFromOpfs, readCasFileBytes, type CasFileHandleLike,
  fetchGenesisCasToOpfs,
  genesisCidFromBytes,
} from "./browser-genesis.js";

export { openBrowserDaemonVm, VerbTable } from "./open-browser-daemon-vm.js";
export type {
  BrowserDaemonVmOptions,
  BrowserVerbTable, VerbReactor, BrowserVerbPlacementRequest,
} from "./open-browser-daemon-vm.js";
export { parseAdmitCarriage, parseAdmitPaste, formatAdmitCommand, toAdmitCarriage, ADMIT_KIND } from "./admit-carriage.js";

// The mint-time context gate — refuse where a browser withholds, and name the cause and the cure.
export type {
  SecureContextVerdict, SecureContextReading, SecureContextHost, StoragePersistence, StorageReading, StorageHost,
} from "./secure-context-gate.js";
export {
  readSecureContext, assertCanMint, ambientHost, requestDurableStorage, ambientStorage, storageFloorReport,
} from "./secure-context-gate.js";
