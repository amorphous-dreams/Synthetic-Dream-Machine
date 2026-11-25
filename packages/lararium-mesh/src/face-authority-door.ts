/**
 * face-authority-door: the names the package barrel exports from `face-authority.ts`, on a subpath of their own.
 *
 * `face-authority.ts` exports more than the barrel lends (helpers its own package composes with); a reader that names a
 * subpath instead of the barrel reaches this door, which carries exactly the barrel's names from that module and
 * nothing else. `tools/mesh-barrel-witness.test.mjs` holds every exported subpath to the barrel's reach.
 */
export { withdrawKey, foldWithdrawals, heldWithdrawals, learnWithdrawals, isWithdrawalMemory, FACE_PROOF_CUSTODY_RECORDS } from "./face-authority.js";
export type { FaceKeyCustody, WithdrawalMemory, FaceAuthorityRefusal } from "./face-authority.js";
export { requestCertificate, issueCertificate, mintVesselFaceKey, checkVesselChain } from "./face-authority.js";
export type { VesselFaceKeyCustody, MintedKey, VesselChainVerdict } from "./face-authority.js";
