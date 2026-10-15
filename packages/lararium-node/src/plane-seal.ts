/**
 * plane-seal — the ENCRYPT-FIRST guard on the carry-split: which planes are PROVABLY sealed, so a member
 * relay may blind-transit their bytes and hand the member nothing readable?
 *
 * THE SEAL-STATUS FINDING (surfaced fork, fail-closed). Only a plane whose bytes are CIPHERTEXT (BeeKEM-
 * sealed) or IMMUTABLE (content-addressed CID) may blind-transit — carrying a cleartext plane would leak
 * plaintext and breach the read-lane denial the split MUST keep absolute. TODAY the automerge sync wire
 * carries CLEARTEXT documents: the private planes rest on random-16-byte doc-id obscurity, not per-doc
 * crypto (federation-gate's own HONEST BOUND; the BeeKEM/CGKA read-floor is design-intent, not yet enforced
 * on the sync wire). So NO private plane is provably sealed, and the correct floor is DENY-CARRY of every
 * plane: the member blind-transit lane stands ready but stays INERT until a sealed plane type lands.
 *
 * WHEN a sealed plane type stands — the `cad` ciphertext-addressed CAS (`cid = BLAKE3(ciphertext)`, verify-
 * cap ⊥ read-cap) or BeeKEM-on-the-sync-wire — register its docIds here (a set / a predicate over the doc's
 * seal marker), and the carry-split blind-transits exactly those. The gate and its fail-closed discipline
 * stay put; only the oracle's affirmative set grows.
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/carry-contract#/carry-read-contract
 */

import type { DocumentId } from "@automerge/automerge-repo";
import type { PlaneSeal } from "@lararium/mesh";

/**
 * The fail-closed floor: NO plane is provably sealed, so nothing blind-transits (the whole private surface
 * deny-carries to a cross-operator). This is the correct plane-seal oracle while the automerge sync wire
 * carries cleartext — the carry-split's member lane is present and tested, but inert until a sealed plane
 * type registers its docIds through a widened oracle.
 */
export const DENY_ALL_PLANE_SEAL: PlaneSeal = {
  isSealedPlane(_documentId: DocumentId): boolean { return false; },
};

/**
 * THE SEAL-PRODUCER SOCKET — a LIVE, growable sealed-plane registry. The `seal` reads the CURRENT set (so a
 * body sealed AFTER the sharePolicy closed over `seal` lights the member lane immediately), and `register` is
 * the ONLY door into that set. The door opens for a docId ONLY as a SIDE-EFFECT of the encrypt-on-CAS installer
 * (`installSealedBody`) — the same call that content-addresses + encrypts a body. A cleartext body reaches NO
 * encrypt path, so NOTHING registers it: the load-bearing honesty is that a doc can NEVER self-label sealed, and
 * a plaintext body can NEVER land in this set. The registry itself encrypts nothing; it only records what the
 * installer sealed.
 *
 * FAIL-CLOSED: empty registry ⇒ `isSealedPlane` is `false` for every doc ⇒ behaves EXACTLY as
 * `DENY_ALL_PLANE_SEAL` (the read-lane-untouched floor) until the first body seals.
 */
/** The scope a sealed block registers under: the Nexus it belongs to and the charter epoch that scope stood at. It names no key. */
export interface NexusEpochName {
  /** The Nexus AID: the charter's genesis epoch CID, lower-cased. */
  readonly nexusAid: string;
  /** The seal lineage's CID for this epoch, lower-cased. */
  readonly epochCid: string;
}

export interface SealedPlaneRegistry {
  /** The oracle the sharePolicy holds — reads the CURRENT sealed set (live; reflects post-open seals). */
  readonly seal: PlaneSeal;
  /**
   * Record a docId as sealed, WITH ITS SCOPE — the SOLE caller is the seal installer, always AFTER a successful
   * seal. The scope is the SIDECAR: the Nexus AID the sealed block belongs to and the charter epoch CID that
   * scope stood at, which the carry lane's own gates read. It names no key: a body seals under its bag's content
   * key. The scope NEVER enters the cid (the cid stays `blake3:` over the ciphertext); it rides beside the sealed set.
   */
  register(documentId: DocumentId, sealedUnder: NexusEpochName): void;
  /** The scope a sealed body registered under, or `undefined` for an unsealed / unknown doc (fail-closed read). */
  epochFor(documentId: DocumentId): NexusEpochName | undefined;
  /** How many sealed docIds stand (audit / test). */
  readonly size: number;
}

/**
 * Stand a live sealed-plane registry. Empty at birth ⇒ fail-closed (DENY-ALL) until the encrypt path seals a body.
 * The seal-set and the epoch sidecar move together: `register` adds both, so a docId is NEVER in the sealed set
 * without the name it sealed under (a reader that finds a sealed doc always finds its epoch).
 */
export function makeSealedPlaneRegistry(): SealedPlaneRegistry {
  const sealed = new Set<DocumentId>();
  const epochOf = new Map<DocumentId, NexusEpochName>();
  return {
    seal: { isSealedPlane(documentId: DocumentId): boolean { return sealed.has(documentId); } },
    register(documentId: DocumentId, sealedUnder: NexusEpochName): void {
      sealed.add(documentId);
      epochOf.set(documentId, { nexusAid: sealedUnder.nexusAid, epochCid: sealedUnder.epochCid });
    },
    epochFor(documentId: DocumentId): NexusEpochName | undefined { return epochOf.get(documentId); },
    get size(): number { return sealed.size; },
  };
}
