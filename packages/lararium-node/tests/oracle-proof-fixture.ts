/**
 * oracle-proof-fixture — the two ends of "peers prove first" for suites that stand a real oracle face:
 * a verify shore that admits a reader on a V3 proof checked against the face's own gate key (the keyholder
 * worker's floor, without keyhive), and a reader identity whose card names its key.
 */
import {
  verifyAuthProof, ed25519SignerFromSeed, ed25519VerifyingKeyFromSeed,
  type AuthVerifierShore, type LeafIdentity,
} from "@lararium/mesh";
import type { SocketSorter } from "../src/daemon-auth-gate.js";

/** A face that answers proven strangers — its vessel stands in an OPEN Nexus. */
export const openSorter: SocketSorter = async (input) => ({ class: input.sameOperator ? "same-operator" : "stranger" });
/** A face whose every Nexus reads PRIVATE: a proven stranger is silence. */
export const privateSorter: SocketSorter = async (input) => (input.sameOperator ? { class: "same-operator" } : null);

/** A shore that admits exactly the readers whose proof holds for `gateSeed`'s key — the card is the reader's key. */
export async function provingShore(gateSeed: Uint8Array): Promise<AuthVerifierShore> {
  const gatePubKey = await ed25519VerifyingKeyFromSeed(gateSeed);
  return {
    verify: async (cardBytes, bagUrl, _access, proof) => {
      const peerPubKey = new TextDecoder().decode(cardBytes);
      if (!proof) return { ok: false, reason: "V3 proof required" };
      const v = await verifyAuthProof({ nonce: proof.nonce, gatePubKey, peerPubKey, aud: bagUrl, sig: proof.sig });
      return v.ok
        ? { ok: true, identifier: peerPubKey, proofVerified: true }
        : { ok: false, reason: `V3 proof rejected: ${v.reason ?? "unverified"}` };
    },
  };
}

/** A reader that proves `seed`'s key; its card names that key. */
export async function readerIdentity(seed: Uint8Array): Promise<LeafIdentity> {
  const pub = await ed25519VerifyingKeyFromSeed(seed);
  return { contactCard: pub, peerPubKey: pub, sign: ed25519SignerFromSeed(seed) };
}
