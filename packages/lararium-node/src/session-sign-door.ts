/**
 * session-sign-door — the vessel's side of the session sign door: the daemon island signs a sealed record through the
 * session that placed its ask, and that session's key never leaves this thread.
 *
 * THE BOOK. The session seat books each `session:call` it places by its request id, naming the verb it placed and the
 * session that placed it (its signer, its anchor, its proof subject), and drops the booking once the call concludes. The
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
 *     No chain standing (no dial presentation composed) answers `signer-unavailable`.
 *
 * Canon: lar:///ha.ka.ba/lararium/mesh/sealed-store#/the-store
 */
import type { SessionOwnChain } from "@lararium/mesh";
import type { SessionAnchor, UdsSessionSigner } from "./uds-channel.js";
import type { SessionSignDoor } from "./worker-handle.js";

/** The session that placed one booked call. */
export interface BookedSession {
  readonly signer: UdsSessionSigner;
  readonly anchor: SessionAnchor;
  /** The session's proof subject, as its face reads on the owner's table. */
  readonly subject: string;
}

interface Booking { readonly verb: string; readonly session: BookedSession }

export class SessionSignBook {
  readonly #held = new Map<string, Booking>();

  /** Book one call a session placed; the returned release drops this booking alone. An id already booked keeps its
   *  first booking: a second call under it (a retry, a sibling socket of the same face) books nothing, so no later
   *  call re-routes an in-flight one to another session's signer. The seat's ledger runs one act per id. */
  hold(requestId: string, verb: string, session: BookedSession): () => void {
    if (this.#held.has(requestId)) return () => {};
    const booking: Booking = { verb, session };
    this.#held.set(requestId, booking);
    return () => { if (this.#held.get(requestId) === booking) this.#held.delete(requestId); };
  }

  /** How many calls stand booked now (a vector reads it; a booking never outlives its call). */
  get size(): number { return this.#held.size; }

  /** The door the daemon island's asks reach. `chain` answers this vessel's own verified face chain, or null;
   *  `raises` answers what the vessel counts on the face's fleet board and what no subscriber has taken yet. */
  door(chain: () => SessionOwnChain | null, raises: () => Promise<{ readonly counted: readonly string[]; readonly unanswered: readonly string[] }> = async () => ({ counted: [], unanswered: [] })): SessionSignDoor {
    const fold = async (): Promise<{ readonly counted: readonly string[]; readonly unanswered: readonly string[] } | null> => {
      try { return await raises(); } catch { return null; }
    };
    return async (ask) => {
      // THE VESSEL'S OWN READING, no session asked: its chain and its fold, public, for the island's own count (a
      // backup's cut, a restore's import). It signs nothing; with no chain or no fold it refuses.
      if (ask.op === "own") {
        const own = chain();
        const read = own === null ? null : await fold();
        return own === null || read === null ? { refusal: "chain-absent" } : { own: true, chain: own, counted: [...read.counted], unanswered: [...read.unanswered] };
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
        return { certificate: signer.certificate, subject, chain: own, counted: [...read.counted], unanswered: [...read.unanswered] };
      }
      if (!(ask.payload instanceof Uint8Array)) return { refusal: "signer-refused" };
      const signed = await signer.sign("act", ask.payload);
      return "signature" in signed ? { signature: signed.signature } : { refusal: "signer-refused" };
    };
  }
}
