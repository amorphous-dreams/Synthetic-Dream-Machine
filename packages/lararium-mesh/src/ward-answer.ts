/**
 * ward-answer — THE CO-SIGNER'S WARD ON THE WIRE (seat-harness#/the-swarm-slices).
 *
 * Each device holds a WARD KEY per face: a signing key that opens only inside a fresh unlock of that face's ward on that device,
 * its public half riding the device's signed admission into the face (`wardKey`, beside the blinded vessel tag). A node derives it
 * from the face's own ward key (the random key its `ward-slots.bin` tree wraps), a browser mints it at random in the face's own
 * keystore row; neither reads a vessel-wide key or a seed, so two faces of one vessel present ward keys no reader links.
 *
 * An approve of a ward ask carries the answerer's ward signature over (the answer, the ask's digest, the fleet frontier the answerer
 * read), so the co-signer's fresh unlock stands on the wire, and the frontier the outcome must cite rides the co-signer's own
 * signature, never the issuer's alone.
 */
import { canonicalJsonBytes } from "./crypto.js";
import { WARD_ANSWER_DOMAIN } from "./domains.js";

/** The bytes a co-signer's ward key signs in its answer: the answer's own words, the ask's digest and the frontier it read. */
export function wardAnswerImage(parts: {
  readonly group: string; readonly ask: string; readonly detail: string; readonly verdict: "approve" | "deny"; readonly executor: string; readonly frontier: string;
}): Uint8Array {
  return canonicalJsonBytes({ domain: WARD_ANSWER_DOMAIN, group: parts.group, ask: parts.ask, detail: parts.detail, verdict: parts.verdict,
    executor: parts.executor.toLowerCase(), frontier: parts.frontier });
}
