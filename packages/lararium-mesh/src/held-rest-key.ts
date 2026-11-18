/**
 * held-rest-key — the rest key of a document only its own vessel holds: the vessel's SECRET home.
 *
 * PLACEMENT, NEVER PATTERN (placement-over-patterns, operator ruling 2026-11-09). Whether a record reaches plaintext disk
 * follows where it rests. The vessel's secret document (group-secret seals, dyads, Keyhive cap event bytes) rests sealed
 * under 32 random bytes its custody keeps in a sealed row beside its other vessel rows; no page recipe mounts it, no disk
 * mirror projects it, and no peer replicates it.
 *
 * WHY NOT THE CONTENT-KEY HOLDER. A wiki bag seals through the holder in the daemon island, under a session that wears the
 * bag's face. The secret home takes its first write at founding, in the direct holder, where no island, session or face
 * stands yet; and its records belong to the vessel, never to one face. So it seals the way a public bag does
 * (`published-bag-key`): the sealed value itself rests, under a key derived from bytes the reader holds. The difference
 * sits in who holds them: a public bag's lookup leaves with its publication, while a held key never leaves its vessel's
 * custody, so only an unlocked vessel opens its own secret home.
 *
 * Canon: lar:///ha.ka.ba/lararium/mesh/sealed-store#/owed
 */
import { hkdf } from "@noble/hashes/hkdf.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { defaultCryptoProvider, hexToBytes, utf8Bytes, type RandomProvider } from "./crypto.js";
import { FLOOR_REST_KEY_INFO } from "./domains.js";
import {
  authorizeAddress, keyVersionIdOf, openChunk, readContentKey, sealChunk, sealedAddressOf, sealedImage,
  type ChunkRole, type ContentKey, type OpenResult, type SealResult,
} from "./sealed-chunk.js";

export const HELD_REST_KEY_LEN = 32;
const HELD_KEY_INFO = "lares-vessel-held-rest-key";

declare const HELD_REST_KEY: unique symbol;
/** A vessel-held rest key: 32 bytes its custody alone keeps. */
export type HeldRestKey = Uint8Array & { readonly [HELD_REST_KEY]: true };

/** Mint a fresh held rest key. */
export function mintHeldRestKey(random: Pick<RandomProvider, "getRandomValues"> = defaultCryptoProvider): HeldRestKey {
  return random.getRandomValues(new Uint8Array(HELD_REST_KEY_LEN)) as HeldRestKey;
}

/** Read a held rest key off its bytes; null: not 32 bytes. */
export function readHeldRestKey(value: unknown): HeldRestKey | null {
  return value instanceof Uint8Array && value.length === HELD_REST_KEY_LEN ? (Uint8Array.from(value) as HeldRestKey) : null;
}

/**
 * A FLOOR KEY DOOR: one host's way to a 32-byte child under a registered domain. A node hands its custody root's derive
 * door (it answers only while the custody stands unlocked, so a locked hearth and a herm, which never unlocks, derive
 * nothing); a browser hands `seedFloorDoor` over its `floor-rest` seed row. A door that cannot answer throws.
 */
export type FloorKeyDoor = (info: string) => Uint8Array;

/** The floor door of a host that keeps a random seed for its floor (a browser's `floor-rest` row). */
export function seedFloorDoor(seed: Uint8Array): FloorKeyDoor {
  if (!(seed instanceof Uint8Array) || seed.length !== HELD_REST_KEY_LEN) throw new TypeError("held-rest-key: a floor seed rides exactly 32 bytes");
  const held = Uint8Array.from(seed);
  return (info) => hkdf(sha256, held, undefined, utf8Bytes(info), HELD_REST_KEY_LEN);
}

/**
 * THE FLOOR'S REST KEY, one helper for every host (the-veil-ladder#/the-base-model): the key a vessel's floor documents
 * seal under, derived through the host's own door under `FLOOR_REST_KEY_INFO`. It names no secret home: the floor stands
 * with no face, and the secret home's random key mints with the face. Each floor bag still binds its own content key
 * (`sealHeld` and `openHeld` derive per bag), so two floor bags never open under one key.
 */
export function floorRestKey(door: FloorKeyDoor): HeldRestKey {
  const key = readHeldRestKey(door(FLOOR_REST_KEY_INFO));
  if (key === null) throw new TypeError("held-rest-key: the floor door answered no 32-byte child");
  return key;
}

/** The bag's content key: HKDF-SHA-256 over the held key, bound to the bag's own id. */
function heldBagKey(bagId: string, held: Uint8Array): ContentKey {
  const read = readHeldRestKey(held);
  if (read === null) throw new TypeError("held-rest-key: a held key rides exactly 32 bytes");
  const key = readContentKey(hkdf(sha256, read, undefined, sealedImage(HELD_KEY_INFO, utf8Bytes(bagId)), 32));
  read.fill(0);
  if (key === null) throw new TypeError("held-rest-key: the derived key reads malformed");
  return key;
}

const contextOf = (bagId: string, key: ContentKey, role: ChunkRole, ref: string) =>
  ({ bagId, keyVersion: keyVersionIdOf(key, bagId), role, logicalRef: hexToBytes(ref) });

/** Seal one value of a held bag under its vessel's held key. */
export function sealHeld(args: { readonly bagId: string; readonly held: Uint8Array; readonly role: ChunkRole; readonly ref: string; readonly plaintext: Uint8Array;
  readonly random?: Pick<RandomProvider, "getRandomValues"> }): SealResult {
  const key = heldBagKey(args.bagId, args.held);
  return sealChunk({ key, context: contextOf(args.bagId, key, args.role, args.ref), plaintext: args.plaintext, ...(args.random ? { random: args.random } : {}) });
}

/** Open one value of a held bag with its vessel's held key. */
export function openHeld(args: { readonly bagId: string; readonly held: Uint8Array; readonly role: ChunkRole; readonly ref: string; readonly sealed: Uint8Array }): OpenResult {
  const key = heldBagKey(args.bagId, args.held);
  const authorized = authorizeAddress(sealedAddressOf(args.sealed), "own-receipt");
  if (authorized === null) return { refusal: "address-unauthorized" } as OpenResult;
  return openChunk({ key, context: contextOf(args.bagId, key, args.role, args.ref), sealed: args.sealed, authorized });
}
