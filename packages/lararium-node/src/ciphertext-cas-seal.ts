/**
 * ciphertext-cas-seal — the SEAL INSTALLER (the node side-effect that lights the member lane).
 *
 * The one call that seals a body into the cad store: it seals the plaintext as one sealed value under its bag's
 * content key (`sealPrivateBody`: randomized, authenticated, bound to the bag, the key version, the role `blob`
 * and the body's plaintext digest), writes the ciphertext into the fs `cad/` tier under its address
 * (`blake3:` over the ciphertext), and — AS A SIDE-EFFECT — registers the body's docId into the live
 * `SealedPlaneRegistry`. That side-effect IS the seal-producer: a docId reaches the sealed set ONLY through a
 * successful seal and CAS write, so a cleartext body can NEVER register (no plaintext door), and a doc can NEVER
 * self-label sealed. The member blind-transit lane (`carrierShareDecision`) opens for exactly the docIds this
 * installer sealed.
 *
 * VERIFY ⊥ READ: a relay serves and verifies the ciphertext holding no key (`verifyCiphertextCid`). The content
 * key never enters this module's answer: a reader opens the body with the key its own lockbox delivered, an
 * authorized address and the digest the pointer names.
 *
 * FAIL-CLOSED: a seal that refuses (a malformed key, a bag with no name) THROWS before any byte lands or any
 * docId registers, so the body stays local and unsealed, never a plaintext body registered as sealed.
 *
 * NO CONVERGENCE SECRET SEALS HERE. The scope a body registers under names the Nexus the sealed block belongs
 * to, which the carry lane's own gates read; it names no key.
 *
 * TWO HANDS MAY SEAL, AND ONE DOOR REGISTERS. A vessel's content-key holder lives beside its key seat (the
 * daemon island), seals a body there and rests the ciphertext in this same `cad/` tier; the vessel then
 * registers that body by its address (`registerSealedBody`). A caller that itself holds a content key seals
 * and registers in one call (`installSealedBody`). Either way a docId enters the sealed set only for bytes
 * that rest in the tier, recompute to their address and carry the sealed value's own format mark.
 *
 * Meme: lar:///ha.ka.ba/lararium/node/ciphertext-cas-seal · lar:///ha.ka.ba/lararium/mesh/sealed-store
 */

import {
  interpretAsDocumentId, stringifyAutomergeUrl,
  type BinaryDocumentId, type DocumentId,
} from "@automerge/automerge-repo";
import {
  SEALED_CHUNK_MARK, SEALED_HEADER_LEN, SEALED_MARK_LEN, SEALED_TAG_LEN, sealPrivateBody, parseDigest, hexToBytes, readSealedAddress,
  type PrivateBodyKey, type KeyVersionId,
} from "@lararium/mesh";
import { readVerifiedCasBlobFromFs, writeCasEntriesFs } from "./node-cas.js";
import type { SealedPlaneRegistry } from "./plane-seal.js";
import type { NexusEpochName } from "./plane-seal.js";

/** The outcome of sealing one body into the cad store. Every field may cross to a caller; none holds a key. */
export interface InstalledSealedBody {
  /** `blake3:<hex>` — the ciphertext address a relay recomputes holding no key. */
  readonly cid: string;
  /** The Automerge docId derived from the cid — the sealed-plane key the member lane gates on. */
  readonly docId: DocumentId;
  /** The Nexus the sealed block belongs to. */
  readonly nexusAid: string;
  /** The charter epoch that scope stood at when the body sealed. */
  readonly epochCid: string;
  /** The content key version the body sealed under. */
  readonly keyVersion: KeyVersionId;
  /** The body's logical reference: hex SHA-256 of its plaintext, the digest its pointer names. */
  readonly ref: string;
}

/**
 * Derive a stable Automerge DocumentId from a ciphertext cid — the content-addressed doc that carries the sealed
 * body in the sync graph. A `blake3:<hex>` cid is 32 bytes; a BinaryDocumentId is 16, so the FIRST 16 bytes of
 * the blake3 digest key the doc. Deterministic (same cid ⇒ same docId), so the seal registry, the sharePolicy,
 * and a remote transit leg all name the ONE doc without hand-maintenance.
 */
export function docIdForCiphertextCid(cid: string): DocumentId {
  const { hex } = parseDigest(cid);
  const digest = hexToBytes(hex);
  const idBytes = digest.slice(0, 16) as Uint8Array as BinaryDocumentId;
  return interpretAsDocumentId(stringifyAutomergeUrl({ documentId: idBytes }));
}

/** What registering one sealed body answers: the address, the docId and the scope. None holds a key. */
export type RegisteredSealedBody = Pick<InstalledSealedBody, "cid" | "docId" | "nexusAid" | "epochCid">;

/** A seal that refused: the body stays local and unsealed, and nothing registered. */
export class SealRefused extends Error {
  override readonly name = "SealRefused";
  constructor(readonly refusal: string) {
    super(`ciphertext-cas-seal: the body did not seal (${refusal}); it stays local and unsealed`);
  }
}

/**
 * Seal a body into the cad store and REGISTER it — the load-bearing side-effect. Order is the discipline: seal →
 * write the ciphertext to CAS → register the docId. A refusal throws BEFORE any write or registration, so a body
 * never half-lands sealed, and a docId never stands in the sealed set with no ciphertext behind it.
 *
 * @param registry  the live sealed-plane registry the vessel sharePolicy holds (`registry.seal`).
 * @param casDir    the fs `cad/` dir (the SAME dir a relay serves from).
 * @param plaintext the body bytes leaving the CRDT.
 * @param under     the bag the body belongs to and that bag's current content key.
 * @param scope     the Nexus the sealed block belongs to, and its charter epoch: the sidecar the carry lane's
 *                  gates read. It names no key and never enters the cid.
 */
export function installSealedBody(
  registry:  SealedPlaneRegistry,
  casDir:    string,
  plaintext: Uint8Array,
  under:     PrivateBodyKey,
  scope:     NexusEpochName,
): InstalledSealedBody {
  const sealed = sealPrivateBody(plaintext, under);
  if (!("body" in sealed)) throw new SealRefused(sealed.refusal);
  const { cid, ciphertext, keyVersion, ref } = sealed.body;
  writeCasEntriesFs([{ cid, bytes: ciphertext }], casDir);
  return { ...registerSealedBody(registry, casDir, cid, scope), keyVersion, ref };
}

/**
 * REGISTER a body some hand already sealed and rested in the cad tier: THE SIDE-EFFECT (the sealed set and
 * its scope sidecar together). The bytes must rest under `cid`, recompute to it, and read as a sealed value:
 * long enough for a header and one segment, under the sealed value's own format mark. A missing, altered or
 * cleartext body throws `SealRefused` and registers nothing, so no plaintext door opens here.
 */
export function registerSealedBody(
  registry: SealedPlaneRegistry,
  casDir:   string,
  cid:      string,
  scope:    NexusEpochName,
): RegisteredSealedBody {
  const address = readSealedAddress(cid);
  if (address === null) throw new SealRefused("address-malformed");
  const bytes = readVerifiedCasBlobFromFs(address, casDir);
  if (bytes === null) throw new SealRefused("value-absent");
  if (bytes.length < SEALED_HEADER_LEN + SEALED_TAG_LEN || !SEALED_CHUNK_MARK.every((byte, i) => bytes[i] === byte) || SEALED_CHUNK_MARK.length !== SEALED_MARK_LEN) {
    throw new SealRefused("format-unknown");
  }
  const docId = docIdForCiphertextCid(address);
  registry.register(docId, scope);
  return { cid: address, docId, nexusAid: scope.nexusAid, epochCid: scope.epochCid };
}
