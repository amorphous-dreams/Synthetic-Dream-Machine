/**
 * @lararium/browser/page — what the page's main thread may load of this package (browser-vessel-lift#/the-shape).
 *
 * The page paints the DOM, asks the person, forwards the page-only `navigator.storage.persist()` request and builds Workers;
 * the vessel (the Repo, custody, identity, the ward's rows, the seed wrap) runs on the vessel worker's own thread and loads
 * through the package's main entry there. Every module this entry reaches reads clear of `@automerge/automerge-repo`,
 * `@lararium/keyhive`, `browser-custody`, `browser-vessel-identity`, `ward-core` and `seed-wrap-prf`
 * (`tools/page-entry-witness.mjs` walks it from `lararium-web`'s `main.ts`).
 */
export { DAEMON_SURFACE_ID } from "./daemon-surface.js";
export { wardAskWords, type WardAskKind } from "./ward-ask-words.js";
export { vesselLockName } from "./vessel-lock.js";
export { requestDurableStorage, storageFloorReport } from "./secure-context-gate.js";
export type { StoragePersistence, StorageReading } from "./secure-context-gate.js";
export { readCasBlobFromOpfs } from "./browser-genesis.js";
export type { BrowserConnectionSnapshot, BrowserConnectionListener, BrowserConnectionState } from "./browser-connection-state.js";
export type { CustodyAsk, CustodyAnswer, BootCustodyVerdict } from "./browser-boot-custody.js";
export type { HearthFloorRead } from "./browser-floor-read.js";
export type { PageLife, PageLifeFeed } from "./browser-vessel-island-pool.js";
export type { ProjectionSurfaceFrame } from "./open-browser-vessel.js";
export type { CoherenceFrameWithRev } from "./wiki-coherence-frame.js";
export type { ReturnLegVerdict } from "./surface-return-leg.js";
