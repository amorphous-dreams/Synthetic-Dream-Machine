/**
 * Relation-scoped authority evidence.
 *
 * This is an evidence reading, not a universal admission gate. A relation
 * names the thing that was checked; the state names what the verifier could
 * establish from the witnesses it was given. Callers still choose the local
 * action for an unavailable or stale reading.
 */
export type AuthorityEvidenceState =
  | "checked-valid"
  | "unavailable"
  | "stale"
  | "malformed"
  | "revoked"
  | "rejected";

export interface AuthorityEvidenceVerdict<TRelation extends string> {
  readonly relation: TRelation;
  readonly state: AuthorityEvidenceState;
  /** Whether the signed or structural proof itself verified. */
  readonly cryptographicallyValid: boolean;
  readonly reason?: string;
}
