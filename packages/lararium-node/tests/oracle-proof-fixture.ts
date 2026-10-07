/**
 * oracle-proof-fixture — the two ends of "peers prove first" for suites that stand a real oracle face:
 * a verify shore that admits a reader on a V3 proof checked against the face's own gate key (the keyholder
 * worker's floor, without keyhive), and a reader identity whose card names its key.
 */
import {
  verifyAuthProof, ed25519SignerFromSeed, ed25519VerifyingKeyFromSeed,
  type AuthVerifierShore, type LeafIdentity,
} from "@lararium/mesh";

/** A shore that admits exactly the readers whose proof holds for `gateSeed`'s key — the card is the reader's key. */
export async function provingShore(gateSeed: Uint8Array): Promise<AuthVerifierShore> {
  const gatePubKey = await ed25519VerifyingKeyFromSeed(gateSeed);
  return {
    verify: async (cardBytes, bagUrl, _access, proof) => {
      const peerPubKey = new TextDecoder().decode(cardBytes);
      if (!proof) return { ok: false, reason: "V3 proof required" };
      const v = await verifyAuthProof({ nonce: proof.nonce, gatePubKey, peerPubKey, aud: bagUrl, ts: proof.ts, sig: proof.sig });
      return v.ok
        ? { ok: true, identifier: peerPubKey, proofVerified: true, peerClass: "cross-operator" }
        : { ok: false, reason: `V3 proof rejected: ${v.reason ?? "unverified"}` };
    },
  };
}

/** A reader that proves `seed`'s key; its card names that key. */
export async function readerIdentity(seed: Uint8Array): Promise<LeafIdentity> {
  const pub = await ed25519VerifyingKeyFromSeed(seed);
  return { contactCard: pub, peerPubKey: pub, sign: ed25519SignerFromSeed(seed) };
}
