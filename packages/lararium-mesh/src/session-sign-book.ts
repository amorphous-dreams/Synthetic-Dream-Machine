/**
 * session-sign-book — the vessel's side of the session sign door: the daemon island signs a sealed record through the
 * session that placed its ask, and that session's key never leaves the vessel's thread. Both vessels stand it: the
 * node books each call its session socket places, the browser each call its own session places.
 *
 * THE BOOK. The vessel books each call a session places by its request id, naming the verb it placed and the session
 * that placed it (its signer, its anchor, its proof subject), and drops the booking once the call concludes. The
 * island's ask names the request id and the verb; a booking that names another verb, or none, answers
 * `signer-unavailable`, so no summons reusing an id and no ask a session never placed borrows a signer.
 *
 * THE LAW (sealed-store#/the-store, face-proof#/the-key-hierarchy):
 *   · The signer holds the only copy of its secret: it signs here, and asks its owner's table before every signature.
 *     A lock, a close or a switch drops it, and the next signature refuses `signer-refused`; the island holds nothing
 *     to revoke.
 *   · Only a Nexus-anchored session signs a sealed record: a place session holds a place certificate, which no record
 *     carries, and answers `session-anchor-place`.
 *   · The answer carries the vessel's own verified face chain (public), from which the island reads who may write.
 *     No chain standing answers `signer-unavailable`.
 *
 * Canon: lar:///ha.ka.ba/lararium/mesh/sealed-store#/the-store
 */
import type { SessionOwnChain } from "./island-protocol.js";
import type { SessionSignDoor } from "./capability-record.js";

/** The signer one booked session holds, as the book reads it. */
export interface BookedSessionSigner {
  readonly dropped: boolean;
  readonly certificate: unknown;
  sign(purpose: "act", payload: Uint8Array): Promise<{ readonly signature: string } | { readonly refusal: string }>;
}

/** The session that placed one booked call. */
export interface BookedSession {
  readonly signer: BookedSessionSigner;
  readonly anchor: { readonly kind: "nexus" | "place" };
  /** The session's proof subject, as its face reads on the owner's table. */
  readonly subject: string;
}

interface Booking { readonly verb: string; readonly session: BookedSession }

export class SessionSignBook {
  readonly #held = new Map<string, Booking>();
  readonly #onHold: ((session: BookedSession, verb: string) => void) | undefined;

  /** `onHold` hears each session as a call of its books here: the vessel's sealed rest books the changes that session
   *  writes and seals the saves that waited for one (sealed-store#/owed, R2). */
  constructor(opts: { readonly onHold?: (session: BookedSession, verb: string) => void } = {}) { this.#onHold = opts.onHold; }

  readonly #seated = new Map<object, BookedSession>();

  /** Seat a session for its signer's life (P2-4): a change written while it stands open books it, with no call in flight.
   *  It hears as a hold (`session:seat`), so the saves that waited for a session seal now. Returns the unseat. */
  seat(session: BookedSession): () => void {
    if (!this.#seated.has(session.signer)) {
      this.#seated.set(session.signer, session);
      try { this.#onHold?.(session, "session:seat"); } catch { /* a listener's fault never unseats the session */ }
    }
    return () => this.unseat(session.signer);
  }
  /** The session holding `signer` leaves the seat (its signer drops). */
  unseat(signer: object): void { this.#seated.delete(signer); }
  /** The sessions seated now: open, their signers standing. */
  seated(): BookedSession[] { return [...this.#seated.values()].filter((s) => !s.signer.dropped); }

  /** The sessions whose calls stand booked now, each once. */
  standing(): BookedSession[] { return [...new Set([...this.#held.values()].map((b) => b.session))]; }

  /** Book one call a session placed; the returned release drops this booking alone. An id already booked keeps its
   *  first booking: a second call under it (a retry, a sibling socket of the same face) books nothing, so no later
   *  call re-routes an in-flight one to another session's signer. The seat's ledger runs one act per id. */
  hold(requestId: string, verb: string, session: BookedSession): () => void {
    if (this.#held.has(requestId)) return () => {};
    const booking: Booking = { verb, session };
    this.#held.set(requestId, booking);
    try { this.#onHold?.(session, verb); } catch { /* a listener's fault never unbooks the call */ }
    return () => { if (this.#held.get(requestId) === booking) this.#held.delete(requestId); };
  }

  /** How many calls stand booked now (a vector reads it; a booking never outlives its call). */
  get size(): number { return this.#held.size; }

  /** The door the daemon island's asks reach. `chain` answers this vessel's own verified face chain, or null;
   *  `raises` answers what the vessel counts on the face's fleet board and what no subscriber has taken yet. */
  door(chain: () => SessionOwnChain | null, raises: () => Promise<{ readonly read: boolean; readonly counted: readonly string[]; readonly unanswered: readonly string[] }> = async () => ({ read: false, counted: [], unanswered: [] })): SessionSignDoor {
    const fold = async (): Promise<{ readonly read: boolean; readonly counted: readonly string[]; readonly unanswered: readonly string[] } | null> => {
      try { return await raises(); } catch { return null; }
    };
    return async (ask) => {
      // THE VESSEL'S OWN READING, no session asked: its chain and its fold, public, for the island's own count (a
      // backup's cut, a restore's import). It signs nothing; with no chain or no fold it refuses.
      if (ask.op === "own") {
        const own = chain();
        const read = own === null ? null : await fold();
        return own === null || read === null ? { refusal: "chain-absent" } : { own: true, chain: own, foldRead: read.read, counted: [...read.counted], unanswered: [...read.unanswered] };
      }
      const booking = this.#held.get(ask.ask);
      if (booking === undefined || booking.verb !== ask.verb) return { refusal: "signer-unavailable" };
      const { signer, anchor, subject } = booking.session;
      if (anchor.kind !== "nexus") return { refusal: "session-anchor-place" };
      if (signer.dropped) return { refusal: "signer-refused" };
      const own = chain();
      if (own === null) return { refusal: "signer-unavailable" };
      if (ask.op === "read") {
        // A fold that fails reads as nothing counted and nothing unanswered never: it refuses, and nothing seals.
        const read = await fold();
        if (read === null) return { refusal: "signer-unavailable" };
        return { certificate: signer.certificate, subject, chain: own, foldRead: read.read, counted: [...read.counted], unanswered: [...read.unanswered] };
      }
      if (!(ask.payload instanceof Uint8Array)) return { refusal: "signer-refused" };
      const signed = await signer.sign("act", ask.payload);
      return "signature" in signed ? { signature: signed.signature } : { refusal: "signer-refused" };
    };
  }
}
