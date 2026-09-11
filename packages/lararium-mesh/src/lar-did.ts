/**
 * lar-did — the one spelling of a vessel's DID: `"0x"` + the bare 32-byte Ed25519 verifying-key hex,
 * lowercase. A device-delegation edge, a dyad ref, a persona KEL event and a wiki's per-vessel draft
 * doc key all name the vessel this way; a host that hand-builds the prefix, or keys under a bare
 * verifying key or a `did:web:` stub, forks every key derived from it. Mint through
 * `didFromVerifyingKey`, gate through `isLarDid`, and read the key back through `verifyingKeyFromDid`.
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/lar-did
 */

/** "0x" + raw 32-byte Ed25519 verifying-key hex (lowercase). */
export type LarDid = string;

/** The one DID shape: "0x" + 64 lowercase hex chars. */
export const LAR_DID_RE = /^0x[0-9a-f]{64}$/;

/** The one DID spelling: 0x + bare 32-byte hex. Exported so a mint never hand-builds the prefix. */
export const didFromVerifyingKey = (vkHex: string): LarDid => `0x${vkHex}`;

/** The bare verifying-key hex a DID carries; a value with no prefix passes through for the verifier
 *  to refuse on shape. */
export const verifyingKeyFromDid = (did: string): string => (did.startsWith("0x") ? did.slice(2) : did);

/** True where `did` reads as the one spelling. */
export const isLarDid = (did: unknown): did is LarDid => typeof did === "string" && LAR_DID_RE.test(did);

/** The DID, or a loud refusal naming the spelling — for a key derivation that must never fork. */
export function requireLarDid(did: string, where: string): LarDid {
  if (!isLarDid(did)) {
    throw new Error(`${where}: a vessel DID carries one spelling — "0x" + the bare 32-byte verifying-key hex (got "${did}")`);
  }
  return did;
}
