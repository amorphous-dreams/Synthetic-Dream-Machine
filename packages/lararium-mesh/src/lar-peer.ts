import type { MemeProjection } from "./meme-provider.js";
import type { LarTiddlerStore } from "./tiddler-store.js";
import type { IdentitySlot } from "./identity-slot.js";
import { OpenIdentitySlot } from "./identity-slot.js";

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
 * Server and browser peers are symmetric nodes on the same mesh.
 */
export interface LarPeerCapabilities {
  diskAccess:            boolean;
  corsHop:               boolean;
  persistentRelay:       boolean;
  broadcastChannel:      boolean;
  /** May fire non-idempotent ReactionEngine write-backs (e.g. generate summary tiddlers).
   *  Must be true on exactly one peer per room (the node server peer).
   *  Browser peers must set this false — reactions fire on all peers but only
   *  authoritativeReactions:true peers write non-idempotent outputs to the store. */
  authoritativeReactions: boolean;
}

export const PEER_CAPABILITIES_NONE: LarPeerCapabilities = {
  diskAccess: false, corsHop: false, persistentRelay: false,
  broadcastChannel: false, authoritativeReactions: false,
};

export const PEER_CAPABILITIES_NODE: LarPeerCapabilities = {
  diskAccess: true, corsHop: true, persistentRelay: true,
  broadcastChannel: false, authoritativeReactions: true,
};

export const PEER_CAPABILITIES_BROWSER: LarPeerCapabilities = {
  diskAccess: false, corsHop: false, persistentRelay: false,
  broadcastChannel: true, authoritativeReactions: false,
};

/**
 * LarPeerOptions — construction args for a LarPeer.
 *
 * `store` holds the full composite store (system → corpus:* → room → draft).
 * Factories build the CompositeStore and call markSyncComplete() on the writable
 * AutomergeDocStore layers before constructing the peer.
 */
export interface LarPeerOptions<TVm = unknown> {
  peerId:        string;
  /** Full doc stack — CompositeStore(system → corpus:* → room → draft) from the factory. */
  store:         LarTiddlerStore;
  vmPool?:       TVm | null;
  capabilities?: Partial<LarPeerCapabilities>;
  identity?:     IdentitySlot;
  /** @deprecated — pass identity: KeyhiveIdentitySlot instead once Keyhive WASM lands. */
  keyhive?:      KeyhiveSlot;
}

/**
 * LarPeer — the one peer class for browser, Node, and worker.
 *
 * Server and browser peers are symmetric. The Repo's storage/network adapters
 * and `capabilities` preset encode the environmental difference — not subclasses.
 *
 * `store` holds the full composite stack. Factories own the Automerge DocHandles;
 * LarPeer receives only the assembled LarTiddlerStore interface.
 */
export class LarPeer<TVm = unknown> {
  readonly peerId:       string;
  /** Full doc stack — CompositeStore(system → corpus:* → room → draft). */
  readonly store:        LarTiddlerStore;
  readonly capabilities: LarPeerCapabilities;
  readonly identity:     IdentitySlot;
  /** @deprecated — access via identity slot once Keyhive WASM lands. */
  readonly keyhive:      KeyhiveSlot | undefined;

  private _vmPool: TVm | null;

  constructor(opts: LarPeerOptions<TVm>) {
    this.peerId       = opts.peerId;
    this.store        = opts.store;
    this.capabilities = { ...PEER_CAPABILITIES_NONE, ...opts.capabilities };
    this.identity     = opts.identity ?? new OpenIdentitySlot(opts.peerId);
    this.keyhive      = opts.keyhive;
    this._vmPool      = opts.vmPool ?? null;
  }

  get vmPool(): TVm | null { return this._vmPool; }

  attachVmPool(pool: TVm): void {
    this._vmPool = pool;
  }

  get ready(): boolean { return this._vmPool !== null; }

  /** Subscribe a projection to the full composite store. */
  addProjection(p: MemeProjection): () => void {
    return this.store.subscribe((change) => p.onUriChanged(change));
  }

  dispose(): void {
    this._vmPool = null;
  }
}
