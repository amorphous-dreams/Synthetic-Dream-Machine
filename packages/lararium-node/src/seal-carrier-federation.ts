/**
 * seal-carrier-federation — the cad seal's live producer: seal a staged carrier body into the ciphertext
 * federation plane, ADDITIVELY, beside the cleartext-local corpus CAS the wake path reads.
 *
 * TWO LAYERS, TWO JOBS, COMPOSED (never fused). The cas-stage shore already keeps an oversized carrier body OUT of
 * the CRDT: it writes the CLEARTEXT bytes to the corpus CAS + rides a skinny `textCid` handle, and the local wake
 * resolves it cleartext (the operator's own island projects its own files). This producer adds the OTHER job: it
 * seals the SAME body as one sealed value under its bag's content key, so a CROSS-OPERATOR member may blind-transit
 * the bytes and read NOTHING (carry ⊥ read). It NEVER touches the cleartext resolveByCid wake read.
 *
 * VERIFY ⊥ READ: the sealed body's cid reads `blake3:` over its ciphertext — a relay recomputes it holding no key
 * (`verifyCiphertextCid`). The seal registers the ciphertext docId into the live `SealedPlaneRegistry` as a
 * side-effect, opening the member blind-transit lane for exactly that body — a cleartext body reaches no seal
 * path, so nothing self-labels sealed.
 *
 * THE KEY STAYS WITH THE CONTENT-KEY HOLDER, NEVER A NEXUS SECRET. A vessel's holder lives beside its key seat,
 * in the daemon island: it seals a body under its bag's content key there and rests the ciphertext in the
 * `cad/` tier (the island's `sealed-seal` verb). The vessel then REGISTERS that body by its address
 * (`registerSealedCarrier`, the `cad-seal` verb), so no bare key crosses the island's port. A caller that itself
 * holds a content key seals and registers in one call (`sealCarrierForFederation`). FAIL-CLOSED: a caller that
 * names no key seals NOTHING — `ContentKeyUnavailable` — and the body stays cleartext-local only.
 *
 * Meme: lar:///ha.ka.ba/lararium/node/seal-carrier-federation · lar:///ha.ka.ba/lararium/mesh/sealed-store
 */

import { join } from "node:path";
import type { CasHolder, PrivateBodyKey } from "@lararium/mesh";
import { installSealedBody, registerSealedBody, type InstalledSealedBody, type RegisteredSealedBody } from "./ciphertext-cas-seal.js";
import { noteInstalledBody } from "./bag-tracker.js";
import type { BagTracker } from "./bag-tracker.js";
import type { SealedPlaneRegistry } from "./plane-seal.js";
import type { NexusEpochName } from "./plane-seal.js";

/** The cad ciphertext CAS tier — a DISTINCT dir from the cleartext `cas` tier, so the cleartext wake read
 *  (corpus / runtime CAS) is never touched by a sealed body. A member serves + `cas-transit resolveByCid`
 *  fetches from here; the bytes are ciphertext, the cid `blake3:` over them. */
export function cadSealDir(storageDir: string): string {
  return join(storageDir, "cad");
}

/** No content key reached the seal: nothing sealed, and the body stays cleartext-local. */
export class ContentKeyUnavailable extends Error {
  override readonly name = "ContentKeyUnavailable";
  constructor() {
    super("cad-seal: a private body seals under its bag's content key, and no content-key holder handed one here — " +
      "nothing sealed and the body stays cleartext-local (the sealed store's lockbox store supplies the holder)");
  }
}

/**
 * Seal one carrier body's PLAINTEXT into the cad federation plane. Wraps the seal installer (the SOLE door into
 * the sealed-plane registry) + the bag-tracker announce, so a cid reaches BOTH the seal set AND the discovery index
 * ONLY through the seal path. Returns what a caller may show: the address, the docId, the scope, the key version
 * and the body's digest. No key rides the answer. Additive: writes only the ciphertext `cad/` tier, the registry
 * and the tracker — the cleartext corpus CAS the wake reads stays untouched.
 */
export function sealCarrierForFederation(args: {
  readonly registry:  SealedPlaneRegistry;
  readonly cadDir:    string;
  readonly plaintext: Uint8Array;
  /** The bag the body belongs to and that bag's current content key. Absent: `ContentKeyUnavailable`. */
  readonly under?:    PrivateBodyKey;
  /** The Nexus the sealed block belongs to, and its charter epoch. */
  readonly scope?:    NexusEpochName;
  /** Optional discovery announce: note the sealed cid on the relay-side bag-tracker under this holder handle. */
  readonly tracker?:  BagTracker;
  readonly self?:     CasHolder;
}): InstalledSealedBody {
  if (!args.under || !args.scope) throw new ContentKeyUnavailable();
  const installed = installSealedBody(args.registry, args.cadDir, args.plaintext, args.under, args.scope);
  if (args.tracker && args.self) noteInstalledBody(args.tracker, installed, args.self);
  return installed;
}

/**
 * Register one carrier body the content-key holder already sealed into the cad tier: the sealed set, its scope
 * sidecar and the discovery announce, for exactly the address handed in. The bytes must rest in `cadDir`,
 * recompute to `cid` and read as a sealed value; anything else throws `SealRefused` and registers nothing.
 */
export function registerSealedCarrier(args: {
  readonly registry: SealedPlaneRegistry;
  readonly cadDir:   string;
  /** `blake3:<hex>`: the address the holder's seal answered. */
  readonly cid:      string;
  /** The Nexus the sealed block belongs to, and its charter epoch. */
  readonly scope:    NexusEpochName;
  readonly tracker?: BagTracker;
  readonly self?:    CasHolder;
}): RegisteredSealedBody {
  const registered = registerSealedBody(args.registry, args.cadDir, args.cid, args.scope);
  if (args.tracker && args.self) args.tracker.note(registered.cid, args.self);
  return registered;
}
