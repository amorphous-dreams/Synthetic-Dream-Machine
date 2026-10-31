/**
 * peer-arrivals — ONE TABLE OF PROVEN ARRIVALS PER REPO, keyed by (adapter, peerId) (road `P26`; controller transport
 * ruling 2026-10-31: "A peer's share standing comes from the relation its ARRIVAL proved, on every adapter and in both
 * directions, held in ONE table keyed by (adapter, peerId). A replacement arrival drops the standing.").
 *
 * automerge-repo's network subsystem takes a second arrival of a live peer id as a REPLACEMENT connection and routes that
 * id through the newest adapter. So a relation keyed by the id alone lends itself to whoever claims the id next, on any
 * adapter. Here each adapter that proves a relation MARKS its own arrival from its own `peer-candidate` listener, attached
 * BEFORE the adapter joins the network, so the mark lands before the subsystem's `peer` event inside the one synchronous
 * emit. The table hears that `peer` event: an id that arrives with no mark pending arrived on an adapter that proved
 * nothing, and its standing relation drops; an id marked on another adapter displaces the standing one. Either way the
 * displaced arrival's unseat hook fires once, and the owner clears what it seated.
 *
 * The same adapter announcing the same id again continues one arrival: its newer mark supersedes the prior one quietly.
 *
 * GENERATION-SAFE. Each mark answers its own unseat, which removes THAT arrival alone: an old leg's late cleanup never
 * deletes a newer seating of the same id.
 *
 * The relation is the owner's to name: the house's own islands (`island-repo`), an inbound gate session, an outbound dial's
 * proven relation. The table judges arrival, never the relation's worth.
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/island-repo
 */
import type { Repo } from "@automerge/automerge-repo";

/** One proven arrival: the adapter it arrived on, the id it claimed, and the relation its owner proved there. */
export interface PeerArrival<R = unknown> {
  readonly adapter:  object;
  readonly peerId:   string;
  readonly relation: R;
}

export interface PeerArrivals {
  /** The arrival standing for `peerId` now, or null. */
  of(peerId: string): PeerArrival | null;
  /** Mark one arrival from the adapter's own `peer-candidate`; answers this arrival's own unseat. `onUnseat` fires once,
   *  when the arrival leaves the table by any road (a replacement, an unmarked arrival, its own unseat). */
  mark(adapter: object, peerId: string, relation: unknown, onUnseat?: () => void): () => void;
}

interface Entry { readonly arrival: PeerArrival; readonly onUnseat: (() => void) | undefined; live: boolean }
interface Book { readonly standing: Map<string, Entry>; readonly pending: Map<string, Entry>; readonly api: PeerArrivals }
const BOOKS = new WeakMap<Repo, Book>();

function retire(entry: Entry | undefined): void {
  if (!entry || !entry.live) return;
  entry.live = false;
  try { entry.onUnseat?.(); } catch { /* an owner's cleanup never breaks the table */ }
}

/** The one arrival table of `repo`. */
export function peerArrivals(repo: Repo): PeerArrivals {
  const held = BOOKS.get(repo);
  if (held) return held.api;
  const standing = new Map<string, Entry>();
  const pending = new Map<string, Entry>();
  const unstand = (peerId: string): void => {
    const old = standing.get(peerId);
    standing.delete(peerId);
    retire(old);
  };
  repo.networkSubsystem.on("peer", ({ peerId }) => {
    const marked = pending.get(peerId);
    pending.delete(peerId);
    if (marked && standing.get(peerId) === marked) return;   // the arrival its own adapter marked
    unstand(peerId);                                         // the same id arrived on an adapter that proved nothing
  });
  const api: PeerArrivals = {
    of: (peerId) => standing.get(peerId)?.arrival ?? null,
    mark(adapter, peerId, relation, onUnseat) {
      const entry: Entry = { arrival: Object.freeze({ adapter, peerId, relation }), onUnseat, live: true };
      const prior = standing.get(peerId);
      // The SAME adapter announcing the same id again (a handshake's arrive and welcome) continues one arrival: the newer mark
      // supersedes it quietly, since its owner seats afresh. Another adapter's mark is a replacement: the prior relation drops.
      if (prior !== undefined && prior.arrival.adapter === adapter) prior.live = false;
      else if (prior !== undefined) unstand(peerId);
      standing.set(peerId, entry);
      pending.set(peerId, entry);
      return () => {
        if (pending.get(peerId) === entry) pending.delete(peerId);
        if (standing.get(peerId) === entry) { standing.delete(peerId); retire(entry); }
      };
    },
  };
  BOOKS.set(repo, { standing, pending, api });
  return api;
}
