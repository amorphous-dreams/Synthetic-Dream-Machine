/**
 * protected-doc-guard — ONE guard at the head of a vessel's share verdict for documents classed by IDENTITY (road `P26`;
 * controller design ruling 2026-10-31).
 *
 * A protected document crosses a wire lane only while its class's decider holds for the asking peer, read live. The class
 * rides the document's id alone: never a title, a catalog pointer, an alias, a registration or the asker's present
 * standing, so a document keeps its class after the authority that named it lapses, and a second name for it changes
 * nothing. The guard answers "withhold" or "not mine": a document it does not class falls through to the ordinary lanes,
 * and a classed document the decider admits still needs an ordinary lane to open it. It holds no key and reads no peer's
 * word; the composing vessel hands it the id map and the deciders.
 *
 *   · FAIL CLOSED. An id map that throws withholds every document; a decider that throws, or a class with no decider,
 *     withholds its documents; a classed ask with no peer withholds.
 *   · ONE GUARD, MANY CLASSES. `ProtectedDocClass` names each class the guard serves; a later security feature adds its
 *     class (its ids and its decider) to this guard rather than standing a second one. P26 populates `kahu-canon`: the
 *     live `lares` and `lararium` documents, decided by Kahu reach at the wire. Lane `ralias` populates `vessel-private`:
 *     the vessel's daemon document, each face's five planes and the catalog, decided by the relation the peer proved
 *     (the same-face view, the sibling gate, a face-join grant), never by a realm, registration, contract or carriage lane.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/stable-founding-road#/P26
 */

/** The classes of protected documents this guard serves. */
export type ProtectedDocClass = "kahu-canon" | "vessel-private";

/** The guard a share verdict asks first. */
export interface ProtectedDocGuard {
  /** The class this document carries by id, or null. A map that throws reads as protected (fail closed). */
  classOf(documentId: string | undefined): ProtectedDocClass | "unreadable" | null;
  /** True where the document is classed and this peer's class decider does not hold now: the verdict answers no. */
  withholds(peerId: string | undefined, documentId: string | undefined): Promise<boolean>;
}

export interface ProtectedDocGuardOptions {
  /** Every protected document id the vessel holds, by class. Read at each ask; the vessel keeps it current. */
  readonly ids: () => ReadonlyMap<string, ProtectedDocClass>;
  /** RECOUNT BEFORE SERVE (road `P26`): where given, every ask waits for the ids' pending recount, so a classification write
   *  a moment ago classes the very next ask. A recount that fails still lets the ask read the map that stands. */
  readonly settled?: () => Promise<void>;
  /** Whether a recount stands queued and unfinished NOW. With it, an ask waits until none does and classes in that same
   *  turn, so a write queued after the ask began, before it resumed, still classes the ask. The wait runs at most
   *  `SETTLE_ROUNDS` rounds of `settled`: a source still pending past them withholds the ask (fail closed), so a
   *  self-replenishing classification writer never holds an ask forever. */
  readonly pending?: () => boolean;
  /** A bound that tripped: the guard withheld an ask past `SETTLE_ROUNDS`. The composer re-asks its cached verdicts once the
   *  queue drains, so a document withheld at the bound never stays withheld in the Repo's cache. */
  readonly onBound?: () => void;
  /** INCOMPLETE (controller re-ruling 2026-10-31): the classification met a read failure and no whole recount has cleared it.
   *  While it reads true, every document reads `unreadable`: withheld from every peer the guard stands before. */
  readonly incomplete?: () => boolean;
  /** Each class's live decider: does this peer hold the class's reach now, for THIS document (its own home's standing)? */
  readonly decide: { readonly [C in ProtectedDocClass]?: (peerId: string, documentId: string) => boolean | Promise<boolean> };
}

/** BOUNDED BY ROUNDS, NEVER A CLOCK: how many settle rounds an ask waits for the recount queue to drain. The holder
 *  coalesces recounts, so a finite burst drains in two (the running count, then one coalesced behind it). */
export const SETTLE_ROUNDS = 8;

export function protectedDocGuard(opts: ProtectedDocGuardOptions): ProtectedDocGuard {
  const classOf = (documentId: string | undefined): ProtectedDocClass | "unreadable" | null => {
    if (documentId === undefined) return null;
    try {
      if (opts.incomplete?.() === true) return "unreadable";   // no document stands proven unprotected while the count is torn
      return opts.ids().get(String(documentId)) ?? null;
    } catch { return "unreadable"; }
  };
  return {
    classOf,
    async withholds(peerId, documentId) {
      if (documentId !== undefined && opts.settled) {
        try {
          let rounds = 0;
          do {
            if (rounds++ >= SETTLE_ROUNDS) {             // a writer that never lets the count settle withholds (fail closed)
              try { opts.onBound?.(); } catch { /* a listener never opens the ask */ }
              return true;
            }
            await opts.settled();
          } while (opts.pending?.() === true);
        } catch { return true; }                         // a count that cannot settle classes nothing it may serve
      }
      const cls = classOf(documentId);                   // the same turn the last check held
      if (cls === null) return false;
      if (cls === "unreadable" || !peerId) return true;
      const decide = opts.decide[cls];
      if (!decide) return true;
      try { return (await decide(peerId, String(documentId))) !== true; } catch { return true; }
    },
  };
}
