import type { LarTiddlerStore } from "@lararium/types";
import type { LarOpenPhase } from "./open-phase.js";

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
