/**
 * island-session-proof — what the daemon island reads of the session that placed one ask.
 *
 * THE ISLAND HOLDS NO SESSION KEY. A session's signer lives on the vessel's main thread, beside the owner's table that
 * decides whether its session still stands, and holds the only copy of its secret (face-proof#/the-key-hierarchy). The
 * island names the invocation a session placed, and the vessel answers from THAT session: its certificate, its proof
 * subject and the vessel's own verified face chain, then each signature on ask. A lock, a close or a switch drops the
 * signer on the main thread, and the next signature refuses there; the island learns nothing it must forget.
 *
 * The law the island applies to a reading (sealed-store#/the-store):
 *   · ONLY A NEXUS-ANCHORED SESSION REACHES THE SEALED STORE. A record carries a session certificate beneath the
 *     vessel's face-scoped key; a place session holds none, and the vessel refuses it `session-anchor-place`.
 *   · THE SESSION WEARS THIS ISLAND'S OWN FACE. Its proof subject equals the subject of the vessel's own chain, or
 *     every sealed verb refuses `session-face-foreign`: another face's session opens nothing this face sealed.
 *   · A WRITER STANDS ONLY UNDER THE VESSEL'S OWN CHAIN. `holdsWrite` reads true for a certificate whose scope and
 *     face-scoped key are the chain's, over a bag this face registers. Every other writer reads not capable until
 *     the grant ring reads by face key (face-proof#/owed): the reading fails closed.
 *
 * Canon: lar:///ha.ka.ba/lararium/mesh/sealed-store#/the-store
 */
import type { RecordSigner, WriterStanding } from "@lararium/mesh";
import type { SessionOwnChain } from "@lararium/mesh";

/** The invocation a session placed, as the island names it: its request id and the verb it placed. */
export interface SessionAsk {
  readonly requestId: string;
  readonly verb: string;
}

/** The vessel's answer for one ask: the session's signer (its certificate, its signatures on the main thread), its
 *  proof subject and this vessel's own verified chain; or one refusal by name. */
export type SessionReading =
  | {
    readonly signer: RecordSigner; readonly subject: string; readonly chain: SessionOwnChain;
    /** The raises the vessel counts on its face's fleet board (its own fold): the evidence a removal version counts by. */
    readonly counted: readonly string[];
    /** The counted raises no subscriber has taken yet (no mark in the vessel's ledger): owed, a restart included. */
    readonly unanswered: readonly string[];
  }
  | { readonly refusal: string };

/** The island's port onto the session that placed an ask. `null` names an ask no session placed (a summons, a
 *  maintenance frame): it reads `signer-unavailable`, and no vessel key or daemon key signs in its place. */
export interface IslandSessionProof {
  signer(ask: SessionAsk | null): Promise<SessionReading>;
  /** The vessel's own chain and fold with no session behind the ask (a backup's cut, a restore's import): the island
   *  counts records by them and signs nothing. Absent, or a refusal: the island reads as before. */
  own?(): Promise<{ readonly chain: SessionOwnChain; readonly counted: readonly string[]; readonly unanswered: readonly string[] } | { readonly refusal: string }>;
}

const bare = (s: string): string => s.trim().toLowerCase().replace(/^0x/, "");

/** The certificate's scope and face-scoped key, read without trusting its shape. */
function chainOf(certificate: unknown): { faceKey: string; nexus: string; vesselFaceKey: string } | null {
  if (typeof certificate !== "object" || certificate === null) return null;
  const { scope, vesselFaceKey } = certificate as { scope?: unknown; vesselFaceKey?: unknown };
  if (typeof scope !== "object" || scope === null || typeof vesselFaceKey !== "string") return null;
  const { faceKey, nexus } = scope as { faceKey?: unknown; nexus?: unknown };
  return typeof faceKey === "string" && typeof nexus === "string" ? { faceKey, nexus, vesselFaceKey } : null;
}

/** Does `certificate` stand under `chain`: the same face, the same Nexus, the same face-scoped key? */
export function certificateUnderChain(certificate: unknown, chain: SessionOwnChain | null): boolean {
  if (chain === null) return false;
  const read = chainOf(certificate);
  return read !== null && bare(read.faceKey) === bare(chain.scope.faceKey) && read.nexus === chain.scope.nexus && bare(read.vesselFaceKey) === bare(chain.vesselFaceKey);
}

/**
 * The writer standing an island reads under its own chain: `chain()` answers the vessel's verified own-face chain as
 * the last session reading carried it (null before any), and `bags()` the bags this face registers.
 */
export function ownChainStanding(chain: () => SessionOwnChain | null, bags: () => readonly string[]): WriterStanding {
  return {
    holdsWrite: ({ certificate, bagId }) => certificateUnderChain(certificate, chain()) && bags().includes(bagId),
    // No chain before a session asked: the holder takes no reading and settles no roll until one stands.
    chainOf: () => { const c = chain(); return c === null ? null : `${bare(c.scope.faceKey)}|${c.scope.nexus}|${bare(c.vesselFaceKey)}`; },
  };
}
