/**
 * vessel-kel — the floor key's own inception: the key revealed and signed by itself, with no next key committed.
 *
 * THE FLOOR STANDS NON-TRANSFERABLE. A vessel's floor key names a place on one device, and it commits no next
 * key-set, so it cannot rotate by construction (KERI's non-transferable identifier). A lost or stolen floor key gets
 * answered by founding the place afresh, never by a rotation. A next-key seed would rest on the same disk as the key
 * it succeeds, so a thief of the disk would take both, and no verb rotates the floor key: such a commitment guards
 * nothing. See lar:///ha.ka.ba/lararium/mesh/identity-classes.
 *
 * NO CLOCK, NO VERSION. The record holds `t` (the event kind), `k` (the key) and `sig`, and nothing beside them: no
 * creation date, no version tag, no sequence counter, no next-key digest and no next threshold. The key signs the
 * canonical bytes under the `vessel-kel` domain; Ed25519 signs deterministically, so one seed mints one byte string.
 *
 * ONE SHAPE, READ STRICTLY. The reader and the check both refuse a record that carries any other field, so an
 * inception that commits a next key, or tells a time, never reads as this one.
 */

import { ed25519 } from "@noble/curves/ed25519.js";
import { canonicalJsonBytes, hex } from "./crypto.js";
import { VESSEL_KEL_DOMAIN } from "./domains.js";
import { verifyEd25519 } from "./ed25519-door.js";

export interface VesselKelInception {
  readonly t:   "icp";
  /** The floor key's public bytes, hex: one key. */
  readonly k:   readonly string[];
  /** The floor key's Ed25519 signature over the signed bytes, hex. */
  readonly sig: string;
}

/** The fields an inception holds, sorted: any record holding others refuses. */
const FIELDS = "k,sig,t";

/** The bytes the key signs: the domain, then the event kind and the key. */
const signedBytes = (t: string, k: readonly string[]): Uint8Array => canonicalJsonBytes({ domain: VESSEL_KEL_DOMAIN, t, k });

/** Mint the inception from the floor seed. Pure: the same seed mints the same bytes. */
export function inceptVesselKel(signingSeed: Uint8Array): { readonly inception: VesselKelInception; readonly bytes: Uint8Array } {
  if (signingSeed.length !== 32) throw new Error("vessel-kel: the floor seed must ride 32 bytes");
  const t = "icp" as const;
  const k = [hex(ed25519.getPublicKey(signingSeed))];
  const inception: VesselKelInception = { t, k, sig: hex(ed25519.sign(signedBytes(t, k), signingSeed)) };
  return { inception, bytes: canonicalJsonBytes(inception) };
}

/** Does the inception hold exactly its own fields, name one key, and carry that key's signature under `vessel-kel`? */
export function verifyVesselKelInception(inception: VesselKelInception): boolean {
  try {
    if (Object.keys(inception).sort().join(",") !== FIELDS) return false;
    if (inception.t !== "icp" || !Array.isArray(inception.k) || inception.k.length !== 1 || typeof inception.k[0] !== "string") return false;
    return verifyEd25519(inception.sig, signedBytes(inception.t, inception.k), inception.k[0]);
  } catch {
    return false;
  }
}

/** Read an inception from its bytes; anything torn, extra or missing reads `null`, a next-key commitment among them. */
export function decodeVesselKelInception(bytes: Uint8Array): VesselKelInception | null {
  try {
    const raw = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as Record<string, unknown>;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    if (Object.keys(raw).sort().join(",") !== FIELDS) return null;
    const strings = (v: unknown): v is string[] => Array.isArray(v) && v.every((s) => typeof s === "string");
    if (raw.t !== "icp" || !strings(raw.k) || typeof raw.sig !== "string") return null;
    return { t: "icp", k: raw.k, sig: raw.sig };
  } catch {
    return null;
  }
}
