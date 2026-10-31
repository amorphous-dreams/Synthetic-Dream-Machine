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
 *     live `lares` and `lararium` documents, decided by Kahu reach at the wire.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/stable-founding-road#/P26
 */

/** The classes of protected documents this guard serves. */
export type ProtectedDocClass = "kahu-canon";

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
  /** Each class's live decider: does this peer hold the class's reach now, for THIS document (its own home's standing)? */
  readonly decide: { readonly [C in ProtectedDocClass]?: (peerId: string, documentId: string) => boolean | Promise<boolean> };
}

export function protectedDocGuard(opts: ProtectedDocGuardOptions): ProtectedDocGuard {
  const classOf = (documentId: string | undefined): ProtectedDocClass | "unreadable" | null => {
    if (documentId === undefined) return null;
    try { return opts.ids().get(String(documentId)) ?? null; } catch { return "unreadable"; }
  };
  return {
    classOf,
    async withholds(peerId, documentId) {
      if (documentId !== undefined && opts.settled) { try { await opts.settled(); } catch { /* the standing map still classes */ } }
      const cls = classOf(documentId);
      if (cls === null) return false;
      if (cls === "unreadable" || !peerId) return true;
      const decide = opts.decide[cls];
      if (!decide) return true;
      try { return (await decide(peerId, String(documentId))) !== true; } catch { return true; }
    },
  };
}
