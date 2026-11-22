/**
 * lit-relation — the relation a composition PROVED a lit face under, read through the same test the lit set reads
 * (`litOrdinals`): the face's actor reads `lit`, and a sibling's own place session stands. A sibling not yet up, a face closing
 * while its saves drain, or a worn face that closed while the composition still serves verbs answers no relation.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/kahua-memory-stage
 */
export interface LitRelationReading {
  /** The face the composition mounts, or null. */
  readonly mount: number | null;
  /** The relation the worn face stands proved under, or null. */
  readonly wornRelation: string | null;
  /** Each sibling the composition holds: its ordinal, its relation, whether its own place session stands. */
  readonly siblings: Iterable<{ readonly ordinal: number; readonly relation: string | null; readonly session: boolean }>;
  /** Whether a face's actor reads `lit` now. */
  readonly lit: (ordinal: number) => boolean;
}

/** The relation `ordinal` stands proved and lit under now, else null. */
export function provedLitRelation(ordinal: number, at: LitRelationReading): string | null {
  if (!at.lit(ordinal)) return null;
  if (ordinal === at.mount && at.wornRelation !== null) return at.wornRelation;
  for (const s of at.siblings) if (s.ordinal === ordinal && s.relation !== null && s.session) return s.relation;
  return null;
}
