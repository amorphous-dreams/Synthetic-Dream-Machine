/**
 * browser-island-caps — the browser's own MEMBERS of its island record. The record itself composes through the one
 * composer the node composes through (`islandFloorStack`, `islandLiftStack`, `larVesselOf`, @lararium/mesh lar-vessel):
 * this file builds only what the browser hands those stacks.
 *
 *   THE FLOOR'S RECEIPT (`browserIslandReceipt`): a receipt resolves once every named document rests in the vessel's
 *   own Repo. The floor carries it beside `cas` (the origin's OPFS content plane); the island reads its own fleet
 *   board, so no dyad member stands.
 *   THE LIFT (`browserSessionLift`): one unlocked session's `sessionSign` door through a book (`SessionSignBook`), and
 *   the drop its lock runs. The session meets the worn face at a Nexus (a joined face's presentation) or at this browser's
 *   own place (a self-founded face, its atom presented to the place KEL this browser armed at its founding). The island's ask signs only through a call a session of this vessel booked, under the
 *   vessel's own verified chain, and the session's key signs on the vessel's thread. No key crosses the island's port:
 *   a payload goes out and a signature comes back.
 *
 * Canon: lar:///ha.ka.ba/lares/docs/pono/browser-vessel-lift#/the-slices (slices 5a, 5b) · lar:///ha.ka.ba/lararium/mesh/sealed-store#/the-store
 */
import {
  answerReceiptWithHeads, SessionSignBook,
  type BookedSessionSigner, type CustodyWriter, type IslandLift, type ReceiptIssuer, type Repo, type SessionOwnChain,
} from "@lararium/mesh";
import { faceProofSubjectRef, placeProofSubjectRef } from "@lararium/mesh/face-proof-subjects";

/** The floor's receipt over the vessel's own Repo: it resolves once every named document rests there. */
export function browserIslandReceipt(repo: Repo): ReceiptIssuer {
  return async (documentIds, heads) => {
    const answer = await answerReceiptWithHeads(repo, { type: "receipt:request", requestId: "browser-receipt", documentIds: [...documentIds], ...(heads ? { heads: heads as Record<string, string[]> } : {}) });
    if (!answer.issued) throw new Error(answer.why ?? "receipt-unissued: the vessel's Repo holds the named documents at no rest");
  };
}

/** The unlocked session a lift stands on: its signer, and the vessel's own chain at the session's anchor. A joined face's
 *  presentation meets the face at a Nexus (`scope`); a self-founded face meets it at this browser's own place (`place`, the
 *  face's atom at the place KEL the founding armed). The book it stands reads (face, anchor) as the node's does. */
export interface BrowserUnlockedSession {
  readonly signer: BookedSessionSigner;
  readonly chain: SessionOwnChain;
}

/** The anchor a chain names and the proof subject the face reads under there. */
export function sessionAnchorOf(chain: SessionOwnChain): { readonly kind: "nexus" | "place"; readonly subject: string } {
  return "scope" in chain
    ? { kind: "nexus", subject: faceProofSubjectRef(chain.scope as never) }
    : { kind: "place", subject: placeProofSubjectRef(chain.place as never) };
}

/** One session's lift, ready for `islandLiftStack`: the lift itself, and the booking its session places. */
export interface BrowserSessionLift {
  /** What `islandLiftStack` seats: the face, `custodyWrite`, the book's door, and the drop the lock runs once. */
  readonly lift: IslandLift;
  readonly book: SessionSignBook;
  /** The face's proof subject at the session's anchor: the sealed rest maps the face's bags under it. */
  readonly subject: string;
  /** Book one call this vessel's session placed, by its request id and verb; the release drops that booking. After the
   *  lock it books nothing. */
  hold(requestId: string, verb: string): () => void;
}

/**
 * Build one unlocked session's lift: a book over the session, its door, and the drop that refuses every later read
 * and drops the session's signer once. Seating and taking back stay the lift stack's alone.
 */
export function browserSessionLift(session: BrowserUnlockedSession, custodyWrite?: CustodyWriter): BrowserSessionLift {
  const book = new SessionSignBook();
  const { signer, chain } = session;
  const { kind, subject } = sessionAnchorOf(chain);
  let dropped = false;
  const lift: IslandLift = {
    face: subject,
    ...(custodyWrite ? { custodyWrite } : {}),
    sessionSign: book.door(() => (dropped ? null : chain)),
    drop: () => {
      if (dropped) return;
      dropped = true;
      (signer as { drop?: () => void }).drop?.();
    },
  };
  return {
    lift, book, subject,
    hold: (requestId, verb) => (dropped ? () => {} : book.hold(requestId, verb, { signer, anchor: { kind }, subject })),
  };
}
