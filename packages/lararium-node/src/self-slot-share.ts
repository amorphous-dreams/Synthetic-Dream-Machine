/**
 * self-slot-share — the per-peer, per-document share verdict the node sharePolicy enacts, keyed on the CLASS
 * the gate's sorter answered before the socket's verdict.
 *
 *   · an IN-PROCESS island peer (no WS socket) — a house member — shares FREELY (empty relay ring);
 *   · a SIBLING (no WS socket, proven over the sibling channel) — a device of the worn face's PersonaGroup —
 *     holds STANDING, never the house: the sibling gate alone decides it (the face's own planes and the public
 *     boards; never the @daemon, never another face's planes);
 *   · a SAME-OPERATOR WS peer — the keyholder vouched admin@daemon or a KEL-pinned device edge, both
 *     UNFORGEABLE — shares FREELY too (full device sync; the operator's own fleet carries every private plane);
 *   · every other WS peer — contracted, walker, stranger, or one with no class — rides a singleton relay ring
 *     over the deterministic federatable shelf (crossroads · WHO · kapae-antigen · boards). A WALKER also reaches
 *     its hearth's HOSTING DOC in the Nexus its grant names — the doc that hearth's hosting acts ride, which it
 *     reads to check what the hearth published (`walkerBoard`) — and NEVER the carriage board: the carrier set is
 *     a contract ledger, read by those who hold contracts, so the least-trusted relation never sees the
 *     Nexus's infrastructure graph. A CONTRACTED peer (a carrier) also replicates this hearth's own hosting docs
 *     (`hostingDocs`) for the cross-check. The CARRY-SPLIT lets
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
import { carryContractShareDecision, carrierShareDecision, presenterIsKapaed, siblingShareDecision } from "@lararium/mesh";
import type { AntigenRing, FederationGate, NexusMembership, PeerClass, PlaneSeal } from "@lararium/mesh";

/** A same-operator peer + every in-process island peer ride this empty relay ring → shared freely. */
const NO_RELAY_PEERS: ReadonlySet<string> = new Set<string>();

export interface SelfSlotShareInput {
  /** True for a WS peer (an outside carrier); false for an in-process island peer (a house member). */
  readonly hasWsSocket: boolean;
  /** True for a peer the SIBLING CHANNEL proved — a device of the worn face's PersonaGroup, on no WS socket. It
   *  holds standing, never the house: only `siblingGate` decides what reaches it. */
  readonly sibling?: boolean;
  /** The sibling gate — the PersonaGroup ring's sibling path over the public boards. Null denies every doc. */
  readonly siblingGate?: FederationGate | null;
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
  /** A walker's hearth's hosting doc in its Nexus — the one doc beyond the shelf a walker reaches. */
  readonly walkerBoard?: DocumentId | null;
  /** This vessel's own carriage board — on the shelf for every other class, withheld from a walker. */
  readonly carriageBoard?: DocumentId | null;
  /** This hearth's own hosting docs — a contracted peer replicates them. */
  readonly hostingDocs?: ReadonlySet<DocumentId>;
}

/**
 * The per-peer share verdict. A sibling reaches what the sibling gate federates; a same-operator / in-process
 * peer full-syncs; every other WS peer reaches only
 * the deterministically-federatable planes (and, as a member, a provably-sealed plane's ciphertext); a Kapae'd
 * presenter draws Mu regardless. The self-slot INNER capability ring stays inert (identity = null).
 */
export async function selfSlotShareDecision(input: SelfSlotShareInput): Promise<boolean> {
  // A SIBLING never shares freely: it arrives on no WS socket, yet it is no house member. The sibling gate holds
  // its whole verdict (the face's own planes and the public boards), and the antigen still draws Mu ahead of it.
  if (!input.hasWsSocket && input.sibling) {
    if (presenterIsKapaed(input.antigenRing, input.peerId)) return false;
    return siblingShareDecision(input.siblingGate ?? null, input.peerId, input.documentId);
  }
  if (input.hasWsSocket && input.peerClass !== "same-operator") {
    if (input.peerClass === "walker" && input.walkerBoard && input.documentId === input.walkerBoard) {
      // Its hearth's hosting doc names only that hearth's acts; the antigen still draws Mu on a Kapae'd presenter.
      return carryContractShareDecision(NO_RELAY_PEERS, null, input.antigenRing, null, input.peerId, input.documentId);
    }
    // A walker never reads the contract ledger, even where the shelf would carry it.
    if (input.peerClass === "walker" && input.carriageBoard && input.documentId === input.carriageBoard) return false;
    if (input.peerClass === "contracted" && input.documentId && input.hostingDocs?.has(input.documentId)) {
      return carryContractShareDecision(NO_RELAY_PEERS, null, input.antigenRing, null, input.peerId, input.documentId);
    }
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
