/**
 * persona-group-ring — THE PERSONAGROUP OWNS THE IDENTITY-SLOT VERDICT.
 *
 * THE RULING (2026-09-13, arm (B) of the fork `lar:///ha.ka.ba/lares/docs/pono/identity-slot-policy`):
 * "a slot doc's verdict = the face's grant records (the joinee's own act), never the realm's `keptBy`, never a
 * roster; the realm never reads persona planes."
 *
 * WHAT IT REPLACES. `OpenIdentitySlot.verifyCapability` answered `return true` for every ask, and the measured
 * reading found that answer UNREACHED on every live path — both vessels passed `identity = null`, so the
 * allow-all sat as dead code behind an unwired socket. Retiring it costs nothing and removes the shape that
 * would have gone live the day someone wired the socket naively.
 *
 * WHAT DECIDES INSTEAD. A grant record on this face's PersonaGroup plane (`face-join-grant/v1` —
 * `@lararium/keyhive`'s `face-grant-record.ts`), naming the asking peer's OWN vessel key and verifying against
 * the published seal. That record is the joinee's own act of taking a seat, written where both vessels already
 * sync it. The ring never re-cuts a seal: the verify rides in as a function, so the ONE implementation the
 * joinee's own kit runs is the one that answers here — mesh holds no keyhive dependency and never will.
 *
 * WHAT IT REFUSES TO READ, by having no field for it:
 *   · a REALM registration's `keptBy` — the realm never reads persona planes, and a name in a book's steward
 *     set says what a hand may WRITE to that book, never who stands in a face;
 *   · a ROSTER — a compiled-about registry at any scope rejects the fork (`api/pono/registry-filter`);
 *   · anything the peer says about itself — `provenVesselKey` surfaces what this vessel's own gate PROVED, and
 *     a peer that proved nothing reads null, which refuses.
 *
 * IT WIDENS AND NEVER NARROWS. `compose` is the realm leg's own shape: the base's allow stands untouched, and
 * the ring adds ONE admit path for the planes it governs. So a ring wired into a vessel can open a door and can
 * never close one that stood — a property the composition test pins with a permissive base.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/identity-slot-policy#/the-fork-that-wants-a-ruling
 */

import type { DocumentId, PeerId } from "@automerge/automerge-repo";
import type { FederationGate } from "./federation-gate.js";

/** The plane's own reading: the records that rest on it, and the seal check that judges one. */
export interface PersonaGroupGrantReading {
  /** The grant records standing on this face's PersonaGroup plane, as the plane carries them. */
  records(): Iterable<unknown> | Promise<Iterable<unknown>>;
  /**
   * Does this record seat THAT vessel key, verified against the published seal? Injected — the caller hands in
   * `verifyFaceGrantRecord` bound to this face's pinned root and group, so the ring re-cuts nothing and a
   * change to the seal's law reaches here by construction rather than by a second edit.
   */
  verify(record: unknown, joineeVesselKey: string): Promise<boolean>;
}

export interface PersonaGroupIdentityRing {
  /** The ring's own predicate — the thing that decides, asked directly so a test never measures the base. */
  admitsPeer(documentId: DocumentId, peerId: PeerId): Promise<boolean>;
  /** The base gate widened by this ring's admit path, and by nothing else. */
  compose(base: FederationGate): FederationGate;
}

export function makePersonaGroupIdentityRing(opts: {
  /** The docs this ring answers for — this face's own planes. Every other doc is not its business. */
  readonly governs: (documentId: DocumentId) => boolean;
  /** The vessel's OWN hand — its in-process island, its own fleet. Never questioned, never read for. */
  readonly isOwnHand?: (peerId: PeerId) => boolean;
  /** The vessel verifying key this peer PROVED at this vessel's gate; null for a peer that proved none. */
  readonly provenVesselKey: (peerId: PeerId) => string | null;
  readonly grants: PersonaGroupGrantReading;
}): PersonaGroupIdentityRing {
  const admitsPeer = async (documentId: DocumentId, peerId: PeerId): Promise<boolean> => {
    // The own hand short-circuits AHEAD of every reading — a vessel asking itself never consults a grant, and
    // the founder's own reads must not move because a ring got wired.
    if (opts.isOwnHand?.(peerId)) return true;
    if (!opts.governs(documentId)) return false;
    const key = opts.provenVesselKey(peerId);
    if (!key) return false;                       // proved nothing → fail-closed
    for (const record of await opts.grants.records()) {
      let ok = false;
      try { ok = await opts.grants.verify(record, key); } catch { ok = false; }   // a torn record withholds
      if (ok) return true;
    }
    return false;
  };
  return {
    admitsPeer,
    compose: (base) => ({
      mayFederate: async (documentId, peerId) => {
        if (await base.mayFederate(documentId, peerId)) return true;
        if (!peerId) return false;
        return admitsPeer(documentId, peerId);
      },
    }),
  };
}
