/**
 * sealed-chunk-door: the names the package barrel exports from `sealed-chunk.ts`, on a subpath of their own.
 *
 * `sealed-chunk.ts` exports more than the barrel lends (helpers its own package composes with); a reader that names a
 * subpath instead of the barrel reaches this door, which carries exactly the barrel's names from that module and
 * nothing else. `tools/mesh-barrel-witness.test.mjs` holds every exported subpath to the barrel's reach.
 */
export {
  sealChunk, openChunk, authorizeAddress, sealedAddressOf, keyVersionIdOf, contextDigest, mintContentKey,
  readContentKey, readKeyVersionId, readSealedAddress, isChunkRole, sealedImage, readSealedImage, isWellFormedText,
  CHUNK_ROLES, ADDRESS_SOURCES, SEAL_REFUSALS, OPEN_REFUSALS, CONTENT_KEY_LEN, SEALED_HEADER_LEN, SEALED_SEGMENT_LEN, SEALED_TAG_LEN, SEALED_CHUNK_MARK, SEALED_MARK_LEN, SEALED_VALUE_POINTER, namesSealedPointer, bearsSealedMark,
} from "./sealed-chunk.js";
export type {
  ContentKey, KeyVersionId, SealedAddress, ChunkRole, SealContext, AuthorizedAddress, AddressSource,
  SealedChunk, SealResult, OpenResult, SealRefusalName, OpenRefusalName,
} from "./sealed-chunk.js";
