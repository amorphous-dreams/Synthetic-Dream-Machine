import type { LarTiddlerStore } from "./tiddler-store.js";

/**
 * LarOpenPhase — canonical peer boot sequence shared by all platform peers.
 * Phase order is monotonic — never goes backward.
 */
export type LarOpenPhase =
  | "boot"           // factory called; repo not yet open
  | "repo-open"      // Repo + adapters initialized
  | "catalog-ready"  // catalog DocHandle resolved
  | "island-ready"   // island (system bag) resolved — may arrive async
  | "wiki-ready"     // wiki DocHandle resolved
  | "draft-ready"    // wiki-drafts DocHandle resolved
  | "peer-ready"     // LarPeer constructed, CompositeStore wired
  | "tw5-booted"     // TW5Engine.boot() resolved
  | "corpus-ready"   // corpus bags attached (fires once all initial corpora loaded)
  | "live";          // IslandAdaptor wired, VmPool attached

/**
 * OperatorPeerVmFactory — caller-injected VM constructor shared by browser and node peers.
 *
 * The platform factory owns engine boot and bag-stack derivation. The VM factory only
 * receives the resolved recipe scope for the operator peer lane it is opening.
 */
export type OperatorPeerVmFactory<TVm, TEngine> = (
  recipeUri: string,
  engine: TEngine,
  bagStack: readonly string[],
) => Promise<TVm>;

/**
 * OperatorPeerOpenOptions — shared browser/node operator-peer inputs.
 *
 * Platform peers may extend this with transport, storage, or mount-specific fields,
 * but these fields stay common across every operator peer factory.
 */
export interface OperatorPeerOpenOptions<TVm = unknown, TEngine = unknown> {
  hostId: string;
  wikiId: string;
  recipeUri?: string;
  onPhase?: (phase: LarOpenPhase) => void;
  vmFactory?: OperatorPeerVmFactory<TVm, TEngine>;
}

/**
 * OperatorPeerOpenResult — explicit shared browser/node peer contract.
 *
 * Runtime-specific factories may extend this with edge adaptors or UI mounts, but the
 * common peer/runtime/store/pool surface lives here so every operator peer reads alike.
 */
export interface OperatorPeerOpenResult<
  TPeer = unknown,
  TPool = unknown,
  TRepo = unknown,
  TStore extends LarTiddlerStore = LarTiddlerStore,
> {
  peer: TPeer;
  pool: TPool;
  repo: TRepo;
  store: TStore;
  catalogHandleUrl: string;
  larariumDocUrl: string | null;
  phase: LarOpenPhase;
}
