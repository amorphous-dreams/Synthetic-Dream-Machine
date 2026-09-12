/**
 * anchor-store — the veiled-Handle's sentinel-anchor SHORE (platform-blind).
 *
 * A vessel binds to its veiled Handle through three sentinel ids the founding ceremony mints off
 * keyhive's CSPRNG — unreproducible from any seed. Those ids live OUTSIDE the wiped substrate so a
 * rebirth reforges the store while re-reading the SAME anchors, and the Handle survives the substrate.
 *
 * The core owns only the SHAPE + the roster contract; the platform supplies HOW it persists. Anchors
 * carry PUBLIC doc-ids — no secret material rides here, so no seal touches this shore. (The at-rest
 * seal governs the keyhive ARCHIVE, a distinct node-adapter concern; the core never sees seal policy.)
 *
 * PLURALITY PONO at the identity layer: a vessel that wears several personas anchors EACH to its OWN
 * veiled Handle (a distinct PersonaGroup + MeshCabal + agentId), so the store keys by handle-index. The
 * ROSTER reads the store's OWN keys — an explicit record the writer maintains, never a dir-scan pattern.
 *
 * Meme: lar:///ha.ka.ba/lararium/api/anchor-store
 */

import type { DeviceDelegationTiddler } from "./device-delegation.js";

/** The sentinel anchors that bind a vessel to ONE veiled Handle. Hex doc-ids + agentId — all public. */
export interface IdentityAnchors {
  readonly personaGroupDocIdHex: string;
  readonly meshCabalDocIdHex: string;
  /** The PersonaGroup agentId — Gate-C membership reads it, and the bootstrap never carried it. */
  readonly personaGroupAgentIdHex: string;
  /** The persona-root DID this face signs as. PUBLIC (a verifying-key identifier, never a secret). */
  readonly signerDid?: string;
  /** The prefix of this face's persona-KEL — its continuity anchor, walkable from the shared board. PUBLIC. */
  readonly personaKelPrefix?: string;
  /** The SIGNED device→persona delegation edge this face founds. PUBLIC (a signed grant record, no secret).
   *  ── THE WEAR-REBOOT MOUNT-SWITCH ── The mounted face (h0) pins its signerDid/KEL-prefix/edge into the
   *  daemon doc, but an added compartment (N>0) founds mount:false and pins NONE. Persisting the three here,
   *  out of every substrate wipe, lets a reboot RE-PIN a switched-to persona's mount from its own anchors —
   *  the boot re-verifies the edge's signature (the gate is a signature, never a list), so a stored edge
   *  confers nothing a fresh signature-check would not. OPTIONAL: anchors written before this slot existed,
   *  a joinee (no self-minted edge), and h0 (whose live pins already carry them) may hold none. */
  readonly deviceEdge?: DeviceDelegationTiddler;
  /** The founder-veil tag — the per-founding namespace `deriveDyadVeil(vesselSeed, veilTag)` scopes the
   *  creator-veil leaf by. NOT a secret (the veil SEED derives from the vessel seed; the tag only names the
   *  leaf), and it lived ONLY in the wiped daemon doc, so a preserving re-pave re-minted it and stood a
   *  DIFFERENT veil. Persisted here, a re-light re-derives the SAME veil from it. OPTIONAL: anchors written
   *  before this slot existed, and a joinee (whose veil tag IS its carried group id), carry none. */
  readonly veilTag?: string;
}

/**
 * How a runtime persists the veiled-Handle anchor SET — keyed by handle-index (one anchor set per
 * persona the vessel holds). `list` returns the roster from the store's OWN explicit record, never a
 * regex dir-scan. A joinee holds anchors at its admitted index with no matching root (listRoots()=[]).
 */
export interface AnchorStore {
  /** Read ONE persona's anchors back, or null when that index holds none. */
  load(handleIndex: number): IdentityAnchors | null;
  /** Write ONE persona's anchors, recording the index into the roster. */
  save(handleIndex: number, anchors: IdentityAnchors): void;
  /** The anchored-persona roster — every handle-index this vessel anchors, ascending. */
  list(): number[];
}

/**
 * Validate an anchor shape read back from a store — every field a present hex string. Returns the
 * value branded as IdentityAnchors, or null when a field is absent/mistyped (a torn write reads null,
 * never a half-anchor the Handle would trust).
 */
export function readIdentityAnchors(parsed: Partial<IdentityAnchors> | null | undefined): IdentityAnchors | null {
  if (
    parsed &&
    typeof parsed.personaGroupDocIdHex === "string" &&
    typeof parsed.meshCabalDocIdHex === "string" &&
    typeof parsed.personaGroupAgentIdHex === "string" &&
    (parsed.veilTag === undefined || typeof parsed.veilTag === "string") &&
    // The wear-reboot mount material is optional (old anchors, joinees, and h0 hold none), but a PRESENT
    // one must be well-shaped — a torn signerDid/prefix (non-string) or a device edge that is not a record
    // reads the WHOLE anchor as null, so the re-pin never hands verifyDeviceDelegation a half-grant.
    (parsed.signerDid === undefined || typeof parsed.signerDid === "string") &&
    (parsed.personaKelPrefix === undefined || typeof parsed.personaKelPrefix === "string") &&
    (parsed.deviceEdge === undefined || (typeof parsed.deviceEdge === "object" && parsed.deviceEdge !== null))
  ) {
    return parsed as IdentityAnchors;
  }
  return null;
}
