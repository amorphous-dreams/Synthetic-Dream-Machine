/**
 * IdentitySlot — pluggable DID-based identity abstraction.
 *
 * Designed to be satisfied by three concrete implementations:
 *
 *   BlueskyIdentitySlot    — AT Protocol DID (did:plc or did:web:user.bsky.social)
 *   GitHubIdentitySlot     — OAuth token mapped to did:web:github.com/<username>
 *   KeyhiveIdentitySlot    — Keyhive convergent capabilities (Ink & Switch)
 *
 * STATUS NOTE: Keyhive runs
 * LIVE at the OPERATOR level (bootDaemonKeyhive Gates A/B/C, the V3 peer-boundary gate,
 * resolveOrMintBinding) in @lararium/keyhive. THIS slot governs only USER-level access
 * (Bluesky/GitHub/keyhive-user), which remains the alpha stub. The node sharePolicy
 * already gates inbound network peers via the V3 daemon-auth gate; the browser admits
 * only same-origin/in-process peers (a legitimate asymmetry, not an open hole). See
 * lararium-canonical-model #open-drift (point 4).
 *
 * The interface is intentionally narrow — only what LarVessel and the Automerge
 * sharePolicy need to function. Keyhive's full three-layer stack (convergent
 * capabilities + Group CRDT + BeeKEM) slots in without changing the interface.
 *
 * DNS-based identity namespace:
 *   User identity is expressed as a DID — typically did:web:<handle> for
 *   Bluesky (e.g. did:web:user.bsky.social) or did:web:github.com/<user>.
 *   The DID's signing key is used to derive stable Automerge actor IDs and
 *   (future) to derive deterministic doc URLs per user namespace.
 *
 * URI convention:
 *   lar://did:web:user.bsky.social/wikis/garden
 *         └─ userNamespace ──────┘└─ path ────────┘
 *
 * Quine fit:
 *   The IdentitySlot implementation class lives in TypeScript (it must — crypto
 *   primitives can't live in the wiki). BUT the identity config (which DID to
 *   use, which OAuth provider, which capability token) MUST be stored as
 *   lar: URI tiddlers so users can inspect and override from within the wiki:
 *     lar:///ha.ka.ba/lararium/config/identity/did
 *     lar:///ha.ka.ba/lararium/config/identity/provider
 *     lar:///ha.ka.ba/bags/catalog
 *   Reserve $:/ ONLY for TW5 core + TW5 plugins. All Lararium config is lar:.
 *   Tiddlers with lar: URIs serve as the heleuma sync candidates; $:/ tiddlers do not.
 */

/** Automerge-compatible actor ID — 16-byte UUID string, stable per vessel. */
export type ActorId = string;

/**
 * CapabilityToken — an opaque token proving access to a document.
 *
 * In UCAN mode: a JWT string with proof chain.
 * In Keyhive mode: a serialized convergent capability (ConcAp token).
 * In alpha/open mode: null (sharePolicy returns true unconditionally).
 */
export type CapabilityToken = string | null;

/**
 * IdentitySlot — minimum surface LarVessel needs from an identity provider.
 *
 * All methods are async so implementations can lazily fetch keys from
 * IndexedDB (browser) or a key file (node) without blocking construction.
 */
export interface IdentitySlot {
  /** The vessel/operator DID — e.g. "did:web:user.bsky.social" or "did:plc:xxxxx". */
  readonly did: string;

  /**
   * Derive a stable Automerge actor ID from this identity's signing key.
   * Must be deterministic: same key → same actorId across reboots.
   * Typically: first 16 bytes of BLAKE3(signingPublicKey), formatted as UUID.
   */
  deriveActorId(): Promise<ActorId>;

  /**
   * Verify that this vessel holds a valid capability to access the given doc.
   * Called from Automerge Repo's sharePolicy.
   * Returns true if the vessel should be allowed to sync docUrl.
   */
  verifyCapability(docUrl: string, ability: "read" | "edit"): Promise<boolean>;

  /**
   * Issue a capability token delegating access to docUrl to another vessel DID.
   * Used for wiki invitations: the island author issues tokens; joiners present them.
   */
  delegateCapability(
    docUrl:     string,
    toDid:      string,
    ability:    "read" | "edit",
    expiresIn?: number,  // seconds; undefined = no expiry
  ): Promise<CapabilityToken>;

  /**
   * Verify a capability token presented by a remote vessel.
   * The Automerge Repo sharePolicy calls this when a vessel requests a doc.
   */
  verifyDelegation(token: CapabilityToken, docUrl: string): Promise<boolean>;
}

// ---------------------------------------------------------------------------
// THE DEFAULT SLOT RETIRED — the PersonaGroup ring decides (2026-09-13)
// ---------------------------------------------------------------------------
//
// `OpenIdentitySlot` stood here and answered `return true` to every `verifyCapability`. Measured
// (`lar:///ha.ka.ba/lares/docs/pono/identity-slot-policy`), that answer reached NO live path: both vessels
// passed `identity = null`, so the allow-all sat as dead code behind an unwired socket — and lighting the
// socket naively would have made it live, because a self-slot asking "may I sync my own doc" with presenter
// equal to self reads as an allow-all the moment it is consulted.
//
// The operator ruled arm (B): a slot doc's verdict = the FACE's grant records, never the realm's `keptBy`,
// never a roster. `makePersonaGroupIdentityRing` (`persona-group-ring.ts`) answers it, and a vessel that
// names no slot now carries none — the alpha line takes the retirement whole, with no alias standing in.
