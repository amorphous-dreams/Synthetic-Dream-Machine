/**
 * swarm-present — a swarm joiner's PRESENT binds to its presenter: proof of possession over the founder's challenge.
 *
 * The founder's admit names the joiner's member id (its Keyhive Individual id, which IS its Ed25519 verifying
 * key) and carries a fresh challenge the founder issued for that one admit. To present, the joiner signs the
 * challenge with the key the admit names. The founder holds a presented admit only when:
 *   - the signature verifies under the member id the admit names, so a party presenting another party's admit
 *     (read off the open relay, which carries every admit in the clear) holds nothing;
 *   - the challenge is the one the founder issued for that member and has not yet been spent, so a replay of an
 *     earlier verified present holds nothing;
 *   - Keyhive answers, on ask, that this one member holds (`dwellersHolding`).
 * A failed present spends nothing, so a forger racing ahead of the real joiner cannot burn its challenge.
 *
 * The bytes signed are the house's one presentation proof (`leafProofBytes`, under PRESENTED_LEAF_PROOF_DOMAIN):
 * the challenge as its nonce, the founder's key as the verifier's key, the member id as the presenting key, and
 * the digest of the kind-tagged admit as the presentation's CID. One relation (a presenter proves possession of
 * what it presents, bound to one verifier's challenge), so one name. No clock rides it: the single-use challenge
 * is the freshness.
 *
 * Meme: lar:///ha.ka.ba/lares/api/pono/cabal-realm
 */

import { createHash, randomBytes } from "node:crypto";
import { leafProofBytes, ed25519SignerFromSeed, ed25519VerifyHex } from "@lararium/mesh";

/** What the founder's admit carries to one joiner. */
export interface SwarmAdmit {
  readonly realmDocIdHex: string;
  readonly memberIdHex:   string;
  readonly challenge:     string;
}

/** What a joiner presents: its admit, and its signature over the founder's challenge. */
export interface SwarmPresent extends SwarmAdmit {
  readonly proof: string;
}

/** The bare Ed25519 key a Keyhive id names (`0x`-prefixed hex, as Keyhive spells it), or null for any other shape. */
export function memberKey(id: unknown): string | null {
  const m = typeof id === "string" ? /^(?:0x)?([0-9a-f]{64})$/i.exec(id) : null;
  return m ? m[1]!.toLowerCase() : null;
}

/** The digest of the kind-tagged admit: the presentation CID the proof binds. */
export function swarmAdmitCid(admit: Pick<SwarmAdmit, "realmDocIdHex" | "memberIdHex">): string {
  const content = JSON.stringify({ kind: "swarm-admit", memberKey: memberKey(admit.memberIdHex), realmDocIdHex: admit.realmDocIdHex.toLowerCase() });
  return createHash("sha256").update(content).digest("hex");
}

function proofBytes(admit: SwarmAdmit, founderKeyHex: string): Uint8Array {
  return leafProofBytes({
    nonce:        admit.challenge,
    gatePubKey:   memberKey(founderKeyHex) ?? "",
    vesselKey:    memberKey(admit.memberIdHex) ?? "",
    presentedCid: swarmAdmitCid(admit),
  });
}

/** The joiner's half: sign the founder's challenge with the seed behind the member id the admit names. */
export async function signPresent(admit: SwarmAdmit, founderKeyHex: string, seed: Uint8Array): Promise<SwarmPresent> {
  return { ...admit, proof: await ed25519SignerFromSeed(seed)(proofBytes(admit, founderKeyHex)) };
}

/**
 * The founder's half. It issues one challenge per admit and holds a present only when its proof verifies under
 * the member id it names, over the live challenge issued for that member, and Keyhive answers that the member
 * holds. A verified present spends its challenge.
 */
export class PresentVerifier {
  readonly #issued = new Map<string, SwarmAdmit>();

  constructor(private readonly founderKeyHex: string) {
    if (memberKey(founderKeyHex) === null) throw new Error(`swarm-present: the founder key "${founderKeyHex}" names no Ed25519 key`);
  }

  /** The admit for one member, carrying a fresh challenge. A re-issue replaces the member's prior challenge. */
  admit(realmDocIdHex: string, memberIdHex: string): SwarmAdmit {
    const key = memberKey(memberIdHex);
    if (key === null) throw new Error(`swarm-present: the member id "${memberIdHex}" names no Ed25519 key`);
    const admit = { realmDocIdHex, memberIdHex, challenge: randomBytes(32).toString("hex") };
    this.#issued.set(key, admit);
    return admit;
  }

  /** Does this present hold? Malformed input reads false, never throws. */
  async verify(present: unknown, holds: (memberIdHex: string) => Promise<boolean>): Promise<{ holds: boolean; memberIdHex: string; why?: string }> {
    const p = (present ?? {}) as Partial<SwarmPresent>;
    const key = memberKey(p.memberIdHex);
    const member = typeof p.memberIdHex === "string" ? p.memberIdHex : "";
    if (key === null) return { holds: false, memberIdHex: member, why: "names no member key" };
    const issued = this.#issued.get(key);
    if (issued === undefined || p.challenge !== issued.challenge) return { holds: false, memberIdHex: member, why: "answers no live challenge issued for that member" };
    if (typeof p.proof !== "string") return { holds: false, memberIdHex: member, why: "carries no proof" };
    // The proof verifies over the admit the founder ISSUED, never over what the present claims beside it.
    const signed = await ed25519VerifyHex(p.proof, proofBytes(issued, this.founderKeyHex), key);
    if (!signed) return { holds: false, memberIdHex: issued.memberIdHex, why: "is not signed by the key its admit names" };
    if (!(await holds(issued.memberIdHex))) return { holds: false, memberIdHex: issued.memberIdHex, why: "names a member Keyhive does not hold" };
    this.#issued.delete(key);
    return { holds: true, memberIdHex: issued.memberIdHex };
  }
}
