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
 *   · The book reads the session's (face, anchor), whatever the anchor: a Nexus session signs under its session
 *     certificate, a place session under the place certificate its face's atom signed at the vessel's own place.
 *   · The answer carries the verified chain (public) of THE FACE THE SESSION WEARS, from which the island reads who may
 *     write: the worn face's for its own sessions, a lit sibling's for that sibling's (each hat its own chain; the
 *     answer names the sibling's `face`, so the island seals through that face's holder). A chain that names no standing
 *     at the session's anchor (no chain, or no place beside a Nexus) answers `signer-unavailable`: a floor, a locked face
 *     or a shut sibling signs nothing, and its save waits, never written clear, while every other face keeps signing.
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
  /** The lit sibling face this session wears, by its bare atom key; absent, the worn face. The door reads this face's own
   *  chain and fold for it, never the worn face's. */
  readonly face?: string;
}

/** What the vessel counts on one face's fleet board and what no subscriber has taken yet. */
export interface FaceFold { readonly read: boolean; readonly counted: readonly string[]; readonly unanswered: readonly string[] }

interface Booking { readonly verb: string; readonly session: BookedSession }

export class SessionSignBook {
  readonly #held = new Map<string, Booking>();
  readonly #onHold: ((session: BookedSession, verb: string) => void) | undefined;
  readonly #onRefused: ((session: BookedSession, verb: string, why: string) => void) | undefined;

  /** `onHold` hears each session as a call of its books here: the vessel's sealed rest books the changes that session
   *  writes and seals the saves that waited for one (sealed-store#/owed, R2). `onRefused` hears each signature a booked
   *  session's signer refused, with the signer's OWN word (`signer-dropped`, `session-not-live`, `anchor-unread`, ...): the
   *  island hears `signer-refused` alone, so the vessel's log names which session refused and why. */
  constructor(opts: { readonly onHold?: (session: BookedSession, verb: string) => void; readonly onRefused?: (session: BookedSession, verb: string, why: string) => void } = {}) {
    this.#onHold = opts.onHold;
    this.#onRefused = opts.onRefused;
  }
  #refused(booking: Booking, why: string): void {
    try { this.#onRefused?.(booking.session, booking.verb, why); } catch { /* a listener's fault never changes the answer */ }
  }

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

  /** The sessions whose calls stand booked now, each once; a session whose signer dropped stands for nothing, even while
   *  a call it booked (a seal it asked) still runs. */
  standing(): BookedSession[] { return [...new Set([...this.#held.values()].map((b) => b.session))].filter((s) => !s.signer.dropped); }

  /** THE LIVE SESSION THAT STANDS FOR A FACE: the first call's session that `wears` passes, else the first seated one; never
   *  a dropped signer, and never a call of another face that merely stands first. Null: none stands, and a save waits. */
  standingFor(wears: (session: BookedSession) => boolean): BookedSession | null {
    return this.standing().find(wears) ?? this.seated().find(wears) ?? null;
  }

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

  /** The door the daemon island's asks reach. `chain(face)` answers the verified chain of one face this vessel holds open
   *  (null: the worn face; a sibling by its bare atom key), or null where that face stands shut; `raises(face)` answers
   *  what the vessel counts on THAT face's fleet board and what no subscriber has taken yet. */
  door(chain: (face: string | null) => SessionOwnChain | null, raises: (face: string | null) => Promise<FaceFold> = async () => ({ read: false, counted: [], unanswered: [] })): SessionSignDoor {
    const fold = async (face: string | null): Promise<FaceFold | null> => {
      try { return await raises(face); } catch { return null; }
    };
    return async (ask) => {
      // THE VESSEL'S OWN READING, no session asked: its chain and its fold, public, for the island's own count (a
      // backup's cut, a restore's import). It signs nothing; with no chain or no fold it refuses.
      if (ask.op === "own") {
        const face = typeof ask.face === "string" ? ask.face : null;
        const own = chain(face);
        const read = own === null ? null : await fold(face);
        return own === null || read === null ? { refusal: "chain-absent" } : { own: true, chain: own, foldRead: read.read, counted: [...read.counted], unanswered: [...read.unanswered] };
      }
      const booking = this.#held.get(ask.ask);
      if (booking === undefined || booking.verb !== ask.verb) return { refusal: "signer-unavailable" };
      const { signer, anchor, subject } = booking.session;
      if (signer.dropped) { this.#refused(booking, "signer-dropped"); return { refusal: "signer-refused" }; }
      const face = booking.session.face ?? null;
      const own = chain(face);
      if (own === null || !chainStandsAt(own, anchor.kind)) return { refusal: "signer-unavailable" };
      if (ask.op === "read") {
        // A fold that fails reads as nothing counted and nothing unanswered never: it refuses, and nothing seals.
        const read = await fold(face);
        if (read === null) return { refusal: "signer-unavailable" };
        return { certificate: signer.certificate, subject, chain: own, foldRead: read.read, counted: [...read.counted], unanswered: [...read.unanswered], ...(face !== null ? { face } : {}) };
      }
      if (!(ask.payload instanceof Uint8Array)) return { refusal: "signer-refused" };
      const signed = await signer.sign("act", ask.payload);
      if ("signature" in signed) return { signature: signed.signature };
      this.#refused(booking, typeof signed.refusal === "string" ? signed.refusal : "signer-refused");
      return { refusal: "signer-refused" };
    };
  }
}

/** Does the vessel's own chain name a standing at this anchor: a Nexus scope, or its own place? */
function chainStandsAt(chain: SessionOwnChain, anchor: "nexus" | "place"): boolean {
  return anchor === "nexus" ? "scope" in chain : chain.place !== undefined;
}

/**
 * THE VESSEL'S OWN STANDING SESSION, seated in whichever book its lift stands (sealed-store#/owed, V6). A node vessel's
 * dial opens a session of its worn face at the Nexus it dials, as a browser's lift opens its own; while that session
 * stands, a change written with no call in flight books it, so `save-unbooked` waits only where no face stands unlocked;
 * a vessel that dials nothing seats its worn face's place session the same way.
 * `stand` seats the session (null: the dial cleared), replacing the one before; `book` moves the seat to the book a lift
 * stood (null: the lift left).
 */
export function standingSessionSeat(): { book(book: SessionSignBook | null): void; stand(session: BookedSession | null): void } {
  let book: SessionSignBook | null = null;
  let session: BookedSession | null = null;
  let unseat: (() => void) | null = null;
  const reseat = (): void => {
    unseat?.();
    unseat = book !== null && session !== null ? book.seat(session) : null;
  };
  return {
    book(next) { book = next; reseat(); },
    stand(next) { session = next; reseat(); },
  };
}
