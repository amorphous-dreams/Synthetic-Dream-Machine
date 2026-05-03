import type { DocHandle } from "@automerge/automerge-repo";
import type { MemeProjection } from "./meme-provider.js";
import type { MemeStoreDoc } from "./meme-store-doc.js";
import { AutomergeDocStore } from "./automerge-doc-store.js";

/**
 * KeyhiveSlot — opaque optional handle for the Keyhive three-layer stack.
 *
 * Typed minimally; fills in as keyhive_wasm API stabilizes (pre-alpha).
 * Layer 1: convergent capabilities (concap tokens, Ed25519 delegation chains)
 * Layer 2: Group CRDT (coordination-free membership + revocation)
 * Layer 3: BeeKEM (binary tree DH key agreement, BLAKE3 ratchet, causal order only)
 */
export interface KeyhiveSlot {
  verifyCapability(documentId: string, ability: string): Promise<boolean>;
  addMember(publicKey: Uint8Array): Promise<void>;
  removeMember(publicKey: Uint8Array): Promise<void>;
  deriveApplicationSecret(): Promise<Uint8Array>;
}

/**
 * LarPeerCapabilities — I/O surfaces this peer can perform.
 *
 * These declare capability, not authority. No peer holds content truth.
 * The server sets diskAccess + corsHop + persistentRelay.
 * The browser sets broadcastChannel.
 * Workers set only what applies to their role.
 */
export interface LarPeerCapabilities {
  diskAccess:       boolean;
  corsHop:          boolean;
  persistentRelay:  boolean;
  broadcastChannel: boolean;
}

/** Full capability set defaults — all capabilities off. */
export const PEER_CAPABILITIES_NONE: LarPeerCapabilities = {
  diskAccess:       false,
  corsHop:          false,
  persistentRelay:  false,
  broadcastChannel: false,
};

/** Server peer capability preset. */
export const PEER_CAPABILITIES_NODE: LarPeerCapabilities = {
  diskAccess:       true,
  corsHop:          true,
  persistentRelay:  true,
  broadcastChannel: false,
};

/** Browser peer capability preset. */
export const PEER_CAPABILITIES_BROWSER: LarPeerCapabilities = {
  diskAccess:       false,
  corsHop:          false,
  persistentRelay:  false,
  broadcastChannel: true,
};

/**
 * LarPeerOptions — construction args for a LarPeer.
 *
 * @param TVm — the VM pool type. Typed generically to keep @lararium/core
 * free of @lararium/tw5 imports. Pass VmPool<TW5Engine> at call sites.
 */
export interface LarPeerOptions<TVm = unknown> {
  peerId:       string;
  handle:       DocHandle<MemeStoreDoc>;
  bagId?:       string;
  vmPool?:      TVm | null;
  capabilities?: Partial<LarPeerCapabilities>;
  keyhive?:     KeyhiveSlot;
}

/**
 * LarPeer — the one peer class for browser, Node, and worker.
 *
 * All peers instantiate LarPeer directly. Capability differences live in the
 * AutomergeDocStore's backing Repo (IndexedDB vs fs vs memory adapter) and in
 * the `capabilities` preset — not in peer subclasses.
 *
 * "The server holds no privilege over the content it relays." — local-first.md
 *
 * VmPool wiring:
 *   const peer = new LarPeer({ peerId, handle, vmPool: pool, capabilities: PEER_CAPABILITIES_NODE });
 *   pool.activateSlot(0, tw5Engine, reactionEngine);
 *
 * Multiple rooms (server pattern):
 *   For each room, create a new LarPeer with a separate DocHandle.
 *   Same class, same code — the Repo's sharePolicy controls which docs sync where.
 */
export class LarPeer<TVm = unknown> {
  readonly peerId:       string;
  readonly store:        AutomergeDocStore;
  readonly capabilities: LarPeerCapabilities;
  readonly keyhive:      KeyhiveSlot | undefined;

  private _vmPool: TVm | null;

  constructor(opts: LarPeerOptions<TVm>) {
    this.peerId       = opts.peerId;
    this.store        = new AutomergeDocStore(opts.handle, opts.bagId);
    this.capabilities = { ...PEER_CAPABILITIES_NONE, ...opts.capabilities };
    this.keyhive      = opts.keyhive;
    this._vmPool      = opts.vmPool ?? null;
  }

  get vmPool(): TVm | null { return this._vmPool; }

  /** Attach the VM pool after async boot. */
  attachVmPool(pool: TVm): void {
    this._vmPool = pool;
  }

  /** True once a vmPool has been attached. */
  get ready(): boolean { return this._vmPool !== null; }

  /** Delegate to store — shorthand for projection wiring. */
  addProjection(p: MemeProjection): () => void {
    return this.store.addProjection(p);
  }

  /** Signal that initial sync (catalog + room) has completed. */
  markSyncComplete(): void {
    this.store.markSyncComplete();
  }

  dispose(): void {
    this._vmPool = null;
  }
}
