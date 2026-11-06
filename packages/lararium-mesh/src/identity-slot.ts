/**
 * IdentitySlot — pluggable DID-based identity abstraction.
 *
 * Shaped for DID-backed providers (an AT Protocol DID, an OAuth handle mapped to did:web). No production
 * implementation stands: the Keyhive slot retired with K23 (stable-founding-road), since a self-DID verifier
 * binds no presenter; a slot that binds one joins a PROVED peer or session presenter to the share decision.
 *
 * STATUS NOTE: Keyhive runs
 * LIVE at the OPERATOR level (bootDaemonKeyhive Gates A/B/C, the sealed face gate,
 * resolveOrMintBinding) in @lararium/keyhive. THIS slot governs only USER-level access
 * (Bluesky/GitHub/keyhive-user), which remains the alpha stub. The node sharePolicy
 * gates inbound network peers through the sealed face gate (`face-gate`); the browser admits
 * only same-origin/in-process peers (a legitimate asymmetry, not an open hole). See
 * lararium-canonical-model #open-drift (point 4).
 *
 * The interface is intentionally narrow — only what the federation gate's share decision needs. Keyhive's full three-layer stack (convergent
 * capabilities + Group CRDT + BeeKEM) slots in without changing the interface.
 *
 * DNS-based identity namespace:
 *   User identity is expressed as a DID — typically did:web:<handle> for
 *   Bluesky (e.g. did:web:user.bsky.social) or did:web:github.com/<user>.
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

/**
 * CapabilityToken — an opaque token proving access to a document.
 *
 * In UCAN mode: a JWT string with proof chain.
 * In Keyhive mode: a serialized convergent capability (ConcAp token).
 * In alpha/open mode: null (sharePolicy returns true unconditionally).
 */
export type CapabilityToken = string | null;

/**
 * IdentitySlot — minimum surface the federation gate's share decision needs from an identity provider.
 *
 * All methods are async so implementations can lazily fetch keys from
 * IndexedDB (browser) or a key file (node) without blocking construction.
 */
export interface IdentitySlot {
  /** The vessel/operator DID — e.g. "did:web:user.bsky.social" or "did:plc:xxxxx". */
  readonly did: string;

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
  ): Promise<CapabilityToken>;

  /**
   * Verify a capability token presented by a remote vessel.
   * The Automerge Repo sharePolicy calls this when a vessel requests a doc.
   */
  verifyDelegation(token: CapabilityToken, docUrl: string): Promise<boolean>;
}

// ---------------------------------------------------------------------------
// NO DEFAULT SLOT — the PersonaGroup ring decides (2026-09-13)
// ---------------------------------------------------------------------------
//
// No slot here answers `true` to every `verifyCapability` (`lar:///ha.ka.ba/lares/docs/pono/identity-slot-policy`):
// a self-slot asking "may I sync my own doc" with presenter equal to self reads as an allow-all the moment
// it is consulted.
//
// The operator ruled arm (B): a slot doc's verdict = the FACE's grant records, never the realm's `keptBy`,
// never a roster. `makePersonaGroupIdentityRing` (`persona-group-ring.ts`) answers it, and a vessel that
// names no slot carries none, with no alias standing in.
