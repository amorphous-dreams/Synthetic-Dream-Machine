/**
 * self-slot-share — the per-peer, per-document share verdict the node sharePolicy enacts, keyed on the CLASS
 * the gate's sorter answered before the socket's verdict.
 *
 *   · an IN-PROCESS island peer (no WS socket) — a house member — shares FREELY (empty relay ring);
 *   · a SAME-OPERATOR WS peer — the keyholder vouched admin@daemon or a KEL-pinned device edge, both
 *     UNFORGEABLE — shares FREELY too (full device sync; the operator's own fleet carries every private plane);
 *   · every other WS peer — contracted, walker, stranger, or one with no class — rides a singleton relay ring
 *     over the deterministic federatable shelf (crossroads · WHO · kapae-antigen · boards). The CARRY-SPLIT lets
 *     a peer the nexus-doc consult names a MEMBER (a held, presented admit) blind-transit a PROVABLY-SEALED
 *     private plane (carry the ciphertext, never the read-cap). The read-lane denial stays absolute.
 *
 * POSTURE IS NOT READ HERE. A stranger the gate does not answer never holds a socket: under PRIVATE the sorter
 * answers silence before any verdict, so every peer this decision sees was admitted, and posture has one reader.
 *
 * FAIL-CLOSED: a WS peer with no class routes to the shelf; the sealed-carry lane opens only for a
 * PROVABLY-member peer over a PROVABLY-sealed plane. THE SPLIT RIDES THE OUTER RING — the deterministic
 * federatable set — and that placement IS the safety: nothing runs ahead of it, so a permissive substitution
 * could leak a private-own plane there, and the split seats a CLOSED-SET membership test instead. The INNER
 * verifyCapability-for-self ring stays null; the composition ANDs outer-first, so an inner ring can only ever
 * NARROW this verdict (`lararium-mesh/tests/allow-all-ring-ordering.test.ts`). The #59 antigen consult runs
 * AHEAD (a Kapae'd presenter draws Mu even for a federatable plane).
 *
 * Meme: lar:///ha.ka.ba/lararium/node/self-slot-share
 */
import type { DocumentId } from "@automerge/automerge-repo";
import { carryContractShareDecision, carrierShareDecision } from "@lararium/mesh";
import type { AntigenRing, FederationGate, NexusMembership, PeerClass, PlaneSeal } from "@lararium/mesh";

/** A same-operator peer + every in-process island peer ride this empty relay ring → shared freely. */
const NO_RELAY_PEERS: ReadonlySet<string> = new Set<string>();

export interface SelfSlotShareInput {
  /** True for a WS peer (an outside carrier); false for an in-process island peer (a house member). */
  readonly hasWsSocket: boolean;
  /** The class the gate's sorter answered; `undefined` → the shelf, fail-closed. */
  readonly peerClass: PeerClass | undefined;
  /** The federatable-own classifier (a pure function of this Nexus's pubkey). Null before it stands. */
  readonly selfSlotFedGate: FederationGate | null;
  /** The #59 Kapae-antigen ring (consulted AHEAD; a Kapae'd presenter draws Mu). Null denies nobody. */
  readonly antigenRing: AntigenRing | null;
  /** The nexus-doc membership consult — a MEMBER blind-transits a sealed plane. Null → no peer is a member. */
  readonly membership: NexusMembership | null;
  /** The plane-seal oracle — only a PROVABLY-sealed plane blind-transits. Null → deny-carry, fail-closed. */
  readonly planeSeal: PlaneSeal | null;
  readonly peerId: string;
  /** The doc under decision; `undefined` (a gated relay peer with no doc id) → deny-by-default. */
  readonly documentId: DocumentId | undefined;
}

/**
 * The per-peer share verdict. A same-operator / in-process peer full-syncs; every other WS peer reaches only
 * the deterministically-federatable planes (and, as a member, a provably-sealed plane's ciphertext); a Kapae'd
 * presenter draws Mu regardless. The self-slot INNER capability ring stays inert (identity = null).
 */
export async function selfSlotShareDecision(input: SelfSlotShareInput): Promise<boolean> {
  if (input.hasWsSocket && input.peerClass !== "same-operator") {
    // FAIL-CLOSED at the boot edge: a gated peer whose federatable classifier has not yet stood gets a
    // DenyAllGate floor (`carryContractShareDecision` reads a null fed gate as "same-operator relay → full
    // sync", a DIFFERENT case, so a gated peer must never reach it null — that would leak every plane).
    const fedGate: FederationGate = input.selfSlotFedGate ?? new DenyAllGate();
    return carrierShareDecision(
      new Set<string>([input.peerId]),
      fedGate,
      input.antigenRing,
      null,
      input.membership,
      input.planeSeal,
      input.peerId,
      input.documentId,
    );
  }
  // A same-operator / in-process peer: empty relay ring → shared freely (the antigen still draws Mu).
  return carryContractShareDecision(NO_RELAY_PEERS, null, input.antigenRing, null, input.peerId, input.documentId);
}

/** A federation gate that federates NOTHING — the fail-closed stand-in before selfSlotFedGate arms. */
class DenyAllGate implements FederationGate {
  mayFederate(): boolean { return false; }
}
