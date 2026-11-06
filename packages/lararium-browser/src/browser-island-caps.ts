/**
 * browser-island-caps — the browser vessel's CAPABILITY RECORD, composed as the node composes its own: the floor at
 * construction, the lift on unlock.
 *
 *   THE FLOOR (at construction): `receipt` (the vessel's own Repo rests the named documents), `cas` (the origin's OPFS
 *   content plane), `dyad` where the vessel holds a fleet reading. A record at its floor carries no `custodyWrite`
 *   and no `sessionSign`, so a `session:sign` ask answers `signer-unavailable` by name, as a herm's does
 *   (`composeHerm`): a floor signs nothing.
 *   THE LIFT (on unlock, `liftBrowserIslandCaps`): `custodyWrite` and `sessionSign`, seated by the lift alone and
 *   dropped by it at the lock. The session sign door reads a book (`SessionSignBook`): the island's ask signs only
 *   through a call a session of this vessel booked, under the vessel's own verified chain, and the session's key
 *   signs on the vessel's thread. No key crosses the island's port: a payload goes out and a signature comes back.
 *
 * The vessel worker answers its daemon island's asks through this record (`answerIslandAsks`, mesh), so the island's
 * `cas:want`, `receipt:request`, `dyad:ask`, `custody:write` and `session:sign` each draw one answer from the member
 * of its name, read at ask time.
 *
 * Canon: lar:///ha.ka.ba/lares/docs/pono/browser-vessel-lift#/the-slices (slice 5a) · lar:///ha.ka.ba/lararium/mesh/sealed-store#/the-store
 */
import {
  answerReceiptWithHeads, SessionSignBook,
  type BookedSessionSigner, type CapabilityRecord, type CasFetcher, type CustodyWriter, type DyadReader, type Repo, type SessionOwnChain,
} from "@lararium/mesh";
import { faceProofSubjectRef } from "@lararium/mesh/face-proof-subjects";

/** What the floor hands the record at construction. */
export interface BrowserIslandFloor {
  /** The vessel's own Repo: a receipt resolves once every named document rests there. Null: no receipt stands. */
  readonly repo: Repo | null;
  readonly cas: CasFetcher;
  readonly dyad?: DyadReader;
}

/** Compose the record at the floor: receipt, cas and dyad. No lift member stands. */
export function composeBrowserIslandCaps(floor: BrowserIslandFloor): CapabilityRecord {
  const record: CapabilityRecord = { cas: floor.cas };
  if (floor.dyad) record.dyad = floor.dyad;
  const repo = floor.repo;
  if (repo !== null) {
    record.receipt = async (documentIds, heads) => {
      const answer = await answerReceiptWithHeads(repo, { type: "receipt:request", requestId: "browser-receipt", documentIds: [...documentIds], ...(heads ? { heads: heads as Record<string, string[]> } : {}) });
      if (!answer.issued) throw new Error(answer.why ?? "receipt-unissued: the vessel's Repo holds the named documents at no rest");
    };
  }
  return record;
}

/** The unlocked session a lift seats: its signer (a Nexus-anchored session's own), and the vessel's own chain. */
export interface BrowserUnlockedSession {
  readonly signer: BookedSessionSigner;
  readonly chain: SessionOwnChain;
}

/** What one lift stands: the book its door reads, and the drop that takes both lift members back. */
export interface BrowserIslandLift {
  readonly book: SessionSignBook;
  /** Book one call this vessel's session placed, by its request id and verb; the release drops that booking. */
  hold(requestId: string, verb: string): () => void;
  /** Take the lift back: both members leave the record, the session's signer drops, and every later ask refuses. */
  drop(): void;
}

/**
 * Seat the lift on unlock: `custodyWrite` where the vessel seals for its island, and `sessionSign` through a book over
 * the unlocked session. The lift alone seats `sessionSign`, and its drop takes back only what it seated.
 */
export function liftBrowserIslandCaps(record: CapabilityRecord, lift: { readonly session: BrowserUnlockedSession; readonly custodyWrite?: CustodyWriter }): BrowserIslandLift {
  const book = new SessionSignBook();
  const { signer, chain } = lift.session;
  const subject = faceProofSubjectRef(chain.scope as never);
  let dropped = false;
  const door = book.door(() => (dropped ? null : chain));
  record.sessionSign = door;
  const custodyWrite = lift.custodyWrite;
  if (custodyWrite) record.custodyWrite = custodyWrite;
  return {
    book,
    hold: (requestId, verb) => (dropped ? () => {} : book.hold(requestId, verb, { signer, anchor: { kind: "nexus" }, subject })),
    drop: () => {
      if (dropped) return;
      dropped = true;
      if (record.sessionSign === door) delete record.sessionSign;
      if (custodyWrite && record.custodyWrite === custodyWrite) delete record.custodyWrite;
      const drops = signer as { drop?: () => void };
      drops.drop?.();
    },
  };
}
