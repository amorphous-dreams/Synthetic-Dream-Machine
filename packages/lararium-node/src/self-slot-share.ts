/**
 * self-slot-share — the per-peer, per-document share verdict the node sharePolicy enacts, keyed on the CLASS
 * the gate's sorter answered before the socket's verdict.
 *
 *   · an IN-PROCESS island peer (no WS socket) — a house member — shares FREELY (empty relay ring);
 *   · a SIBLING (proven over the sibling channel, under the peer id its proven device key derives) — a device of
 *     the mounted face's PersonaGroup — holds STANDING, never the house: the sibling gate alone decides it (the face's
 *     own planes and the public boards; never the @daemon, never another face's planes). It decides FIRST; an id a
 *     WS socket also holds denies;
 *   · a SAME-OPERATOR WS peer — a face the gate read admitted, with its PersonaGroup's grant and no fleet shadow —
 *     holds TRANSPORT, never a blanket (D3, "Sharing after the gate"): the gate of the face the session PROVED
 *     (`sessionFace`) decides each document, and beside it the peer reads what any admitted peer reads. Two
 *     sessions wearing two faces read two sets of books;
 *   · every WS peer — contracted, walker, stranger, one with no class, and a same-operator one past its face gate —
 *     rides a singleton relay ring
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
import { carryContractShareDecision, carrierShareDecision, presenterIsKapaed, presenterStandsAside, siblingShareDecision } from "@lararium/mesh";
import type { AntigenRing, FederationGate, NexusMembership, PeerClass, PlaneSeal, ProtectedDocGuard, ShadowConsult } from "@lararium/mesh";

/** Every in-process island peer rides this empty relay ring → shared freely. */
const NO_RELAY_PEERS: ReadonlySet<string> = new Set<string>();

export interface SelfSlotShareInput {
  /** True for a WS peer (an outside carrier); false for an in-process island peer (a house member). */
  readonly hasWsSocket: boolean;
  /** True for a peer id the SIBLING CHANNEL proved — a device of the mounted face's PersonaGroup. It holds standing,
   *  never the house: only `siblingGate` decides what reaches it, and an id a WS socket also holds denies. */
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
  /** The edge-shadow consult (kapae#/reach): a device set aside from the fleet draws Mu on EVERY lane, the
   *  same-operator and sibling lanes included. Null sets nobody aside. */
  readonly shadow?: ShadowConsult | null;
  /** D3: the gate of the face a SAME-OPERATOR session proved — that face's own planes and the public boards. The
   *  class grants no document; this gate does. Null → the session reads what any admitted peer reads. */
  readonly sessionFace?: FederationGate | null;
  /**
   * THE ONE GUARD for documents classed by identity (road `P26`, `protectedDocGuard`): a classed document crosses to a wire
   * or sibling peer only while its class's decider holds for that peer now, ahead of every lane below (the same-face
   * bridge, the realm gate, the shelf). Absent → no document is classed here.
   */
  readonly protectedDocs?: ProtectedDocGuard | null;
}

/**
 * The per-peer share verdict. A sibling reaches what the sibling gate federates; an in-process peer full-syncs;
 * a same-operator WS peer reaches what its proven face's gate federates, and beside it, as every other WS peer,
 * only
 * the deterministically-federatable planes (and, as a member, a provably-sealed plane's ciphertext); a Kapae'd
 * presenter draws Mu regardless. The self-slot INNER capability ring stays inert (identity = null).
 */
export async function selfSlotShareDecision(input: SelfSlotShareInput): Promise<boolean> {
  // THE EDGE SHADOW reads FIRST. A socket admitted before the shadow arrived keeps its class until the gate
  // re-sorts it; this verdict never waits for that, so a device set aside reads nothing from its next ask on.
  if (presenterStandsAside(input.shadow, input.peerId)) return false;
  // THE PROTECTED DOCUMENTS read next, ahead of every lane: a document classed by its id (the live Kahu canon) crosses to a
  // wire or sibling peer only while its class's decider holds now, whatever alias, title or registration names it. The
  // vessel's own in-process islands stand inside the house and pass to the lanes below.
  if ((input.hasWsSocket || input.sibling) && input.protectedDocs && await input.protectedDocs.withholds(input.peerId, input.documentId)) return false;
  // A SIBLING never shares freely: it arrives on no WS socket, yet it is no house member. Sibling-ness decides
  // FIRST, so a sibling's id never reads the house or WS verdict; an id that both a sibling and a WS socket claim
  // reads as neither (one id names one carrier) and denies. The sibling gate holds its whole verdict (the face's
  // own planes and the public boards), and the antigen still draws Mu ahead of it.
  if (input.sibling) {
    if (input.hasWsSocket) return false;
    if (presenterIsKapaed(input.antigenRing, input.peerId)) return false;
    return siblingShareDecision(input.siblingGate ?? null, input.peerId, input.documentId);
  }
  // D3: TRANSPORT KINSHIP GRANTS NO READERSHIP. A same-operator session reads its proven face's documents through
  // that face's gate, the antigen ahead; past it, it reads what any admitted peer reads.
  if (input.hasWsSocket && input.peerClass === "same-operator") {
    if (presenterIsKapaed(input.antigenRing, input.peerId)) return false;
    if (await siblingShareDecision(input.sessionFace ?? null, input.peerId, input.documentId)) return true;
  }
  if (input.hasWsSocket) {
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
  // An in-process peer: empty relay ring → shared freely (the antigen still draws Mu).
  return carryContractShareDecision(NO_RELAY_PEERS, null, input.antigenRing, null, input.peerId, input.documentId);
}

/** A federation gate that federates NOTHING — the fail-closed stand-in before selfSlotFedGate arms. */
class DenyAllGate implements FederationGate {
  mayFederate(): boolean { return false; }
}
